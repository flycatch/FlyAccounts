from __future__ import annotations

import re
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal, InvalidOperation

from fastapi import APIRouter, Depends, File, Header, UploadFile
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from app.core.deps import (
    CurrentUser,
    require_delete_contracts,
    require_list_contracts,
    require_manage_contracts,
)
from app.core.errors import (
    entity_context_required,
    invalid_currency,
    invalid_file_type,
    not_found,
    validation_error,
)
from app.core.pagination import list_query_deps, paginate
from app.core.permissions import VIEW_CONTRACT_FINANCIALS
from app.db.session import get_db
from app.models import Client, Contract, ContractMilestone, ContractResource, LegalEntity, User
from app.storage.s3 import upload_bytes

router = APIRouter()

ALLOWED_EXTENSIONS = {".pdf", ".doc", ".docx"}
ALL_ENTITY_SENTINELS = {None, "", "*"}
REF_PATTERN = re.compile(r"^CTR-(\d+)$", re.IGNORECASE)


class MilestoneIn(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)
    name: str
    value: str
    due_condition_or_date: str = Field(alias="dueConditionOrDate")
    sort_order: int = Field(alias="sortOrder", ge=0)


class ResourceIn(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)
    mode: str
    resource_user_id: uuid.UUID | None = Field(default=None, alias="resourceUserId")
    resource_name: str | None = Field(default=None, alias="resourceName")
    allocation_percent: int | None = Field(default=None, alias="allocationPercent", ge=0, le=100)
    cost_of_resource: str | None = Field(default=None, alias="costOfResource")
    vendor_contract_ref: str | None = Field(default=None, alias="vendorContractRef")
    vendor_contract_file_key: str | None = Field(default=None, alias="vendorContractFileKey")
    monthly_vendor_invoice: str | None = Field(default=None, alias="monthlyVendorInvoice")
    monthly_vendor_invoice_file_key: str | None = Field(
        default=None, alias="monthlyVendorInvoiceFileKey"
    )
    tds_paid_payable: str | None = Field(default=None, alias="tdsPaidPayable")
    gst_paid_payable: str | None = Field(default=None, alias="gstPaidPayable")


class CreateContractRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)
    client_file_key: str = Field(alias="clientFileKey")
    client_id: uuid.UUID = Field(alias="clientId")
    is_amendment: bool = Field(alias="isAmendment")
    parent_contract_id: uuid.UUID | None = Field(default=None, alias="parentContractId")
    category: str
    currency: str
    client_file_name: str | None = Field(default=None, alias="clientFileName")
    client_file_content_type: str | None = Field(default=None, alias="clientFileContentType")
    client_file_size_bytes: int | None = Field(default=None, alias="clientFileSizeBytes")


class UpdateContractRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)
    category: str | None = None
    currency: str | None = None
    client_file_key: str | None = Field(default=None, alias="clientFileKey")
    client_id: uuid.UUID | None = Field(default=None, alias="clientId")
    client_file_name: str | None = Field(default=None, alias="clientFileName")
    client_file_content_type: str | None = Field(default=None, alias="clientFileContentType")
    client_file_size_bytes: int | None = Field(default=None, alias="clientFileSizeBytes")
    is_amendment: bool | None = Field(default=None, alias="isAmendment")
    parent_contract_id: uuid.UUID | None = Field(default=None, alias="parentContractId")
    closure_owner_user_id: uuid.UUID | None = Field(default=None, alias="closureOwnerUserId")
    start_date: date | None = Field(default=None, alias="startDate")
    end_date: date | None = Field(default=None, alias="endDate")
    project_status: str | None = Field(default=None, alias="projectStatus")
    pmo_note: str | None = Field(default=None, alias="pmoNote")
    payment_type: str | None = Field(default=None, alias="paymentType")
    project_value: str | None = Field(default=None, alias="projectValue")
    monthly_rate: str | None = Field(default=None, alias="monthlyRate")
    months: int | None = Field(default=None, ge=1)
    milestones: list[MilestoneIn] | None = None
    resource_type: str | None = Field(default=None, alias="resourceType")
    resource: ResourceIn | None = None
    complete: bool | None = None


def _require_client(db: Session, client_id: uuid.UUID) -> Client:
    client = db.get(Client, client_id)
    if client is None:
        raise validation_error("Client was not found.")
    return client


def parse_entity_header(x_entity_id: str | None) -> uuid.UUID | None:
    if x_entity_id in ALL_ENTITY_SENTINELS:
        return None
    try:
        return uuid.UUID(x_entity_id)  # type: ignore[arg-type]
    except (ValueError, TypeError):
        raise validation_error("X-Entity-Id must be a UUID or *.")


def require_single_entity(x_entity_id: str | None) -> uuid.UUID:
    entity_id = parse_entity_header(x_entity_id)
    if entity_id is None:
        raise entity_context_required()
    return entity_id


def _decimal_string(value: str | None, *, field: str) -> str | None:
    if value is None or value == "":
        return None
    try:
        amount = Decimal(value)
    except InvalidOperation as exc:
        raise validation_error(f"{field} must be a decimal string.") from exc
    if amount < 0:
        raise validation_error(f"{field} must not be negative.")
    return format(amount, "f")


def _allowed_currencies(entity: LegalEntity) -> list[str]:
    currencies = entity.allowed_currencies
    if isinstance(currencies, str):
        import json

        currencies = json.loads(currencies)
    return list(currencies)


def next_contract_reference(db: Session, entity_id: uuid.UUID) -> str:
    refs = db.scalars(
        select(Contract.reference).where(
            Contract.entity_id == entity_id,
        )
    ).all()
    max_n = 0
    for ref in refs:
        match = REF_PATTERN.match(ref or "")
        if match:
            max_n = max(max_n, int(match.group(1)))
    return f"CTR-{max_n + 1:04d}"


def payment_display(contract: Contract, *, can_view_financials: bool) -> str | None:
    if contract.payment_type is None:
        return None
    if not can_view_financials:
        return "Restricted"
    if contract.payment_type == "project_value":
        return f"{contract.currency} {contract.project_value or '—'}"
    return f"{contract.currency} {contract.monthly_rate or '—'} × {contract.months or '—'} mo"


def resource_payload(resource: ContractResource, *, can_view_financials: bool) -> dict:
    payload: dict = {"mode": resource.mode}
    if resource.resource_user_id:
        payload["resourceUserId"] = str(resource.resource_user_id)
    if resource.resource_name:
        payload["resourceName"] = resource.resource_name
    if resource.allocation_percent is not None:
        payload["allocationPercent"] = resource.allocation_percent
    if resource.vendor_contract_ref:
        payload["vendorContractRef"] = resource.vendor_contract_ref
    if resource.vendor_contract_file_key:
        payload["vendorContractFileKey"] = resource.vendor_contract_file_key
    if resource.monthly_vendor_invoice_file_key:
        payload["monthlyVendorInvoiceFileKey"] = resource.monthly_vendor_invoice_file_key
    if can_view_financials:
        if resource.cost_of_resource is not None:
            payload["costOfResource"] = resource.cost_of_resource
        if resource.monthly_vendor_invoice is not None:
            payload["monthlyVendorInvoice"] = resource.monthly_vendor_invoice
        if resource.tds_paid_payable is not None:
            payload["tdsPaidPayable"] = resource.tds_paid_payable
        if resource.gst_paid_payable is not None:
            payload["gstPaidPayable"] = resource.gst_paid_payable
    return payload


def contract_payload(contract: Contract, *, can_view_financials: bool, detail: bool = False) -> dict:
    payload: dict = {
        "id": str(contract.id),
        "entityId": str(contract.entity_id),
        "entityName": contract.entity.name if contract.entity else "",
        "reference": contract.reference,
        "category": contract.category,
        "currency": contract.currency,
        "isAmendment": contract.is_amendment,
        "isDraft": contract.is_draft,
        "clientFileKey": contract.client_file_key,
        "createdAt": contract.created_at.astimezone(timezone.utc).isoformat().replace("+00:00", "Z"),
    }
    if contract.parent_contract_id:
        payload["parentContractId"] = str(contract.parent_contract_id)
        if contract.parent is not None:
            payload["parentContractReference"] = contract.parent.reference
    if contract.client_id:
        payload["clientId"] = str(contract.client_id)
        payload["clientName"] = contract.client.name if contract.client else ""
    if contract.closure_owner_user_id:
        payload["closureOwnerUserId"] = str(contract.closure_owner_user_id)
        payload["closureOwnerName"] = (
            contract.closure_owner.display_name if contract.closure_owner else ""
        )
    if contract.start_date:
        payload["startDate"] = contract.start_date.isoformat()
    if contract.end_date:
        payload["endDate"] = contract.end_date.isoformat()
    if contract.project_status:
        payload["projectStatus"] = contract.project_status
    if contract.pmo_note:
        payload["pmoNote"] = contract.pmo_note
    if contract.payment_type:
        payload["paymentType"] = contract.payment_type
        display = payment_display(contract, can_view_financials=can_view_financials)
        if display is not None:
            payload["paymentDisplay"] = display
    if contract.resource_type:
        payload["resourceType"] = contract.resource_type
    if contract.months is not None:
        payload["months"] = contract.months
    if contract.client_file_name:
        payload["clientFileName"] = contract.client_file_name
    if contract.client_file_content_type:
        payload["clientFileContentType"] = contract.client_file_content_type
    if contract.client_file_size_bytes is not None:
        payload["clientFileSizeBytes"] = contract.client_file_size_bytes

    if can_view_financials:
        if contract.project_value is not None:
            payload["projectValue"] = contract.project_value
        if contract.monthly_rate is not None:
            payload["monthlyRate"] = contract.monthly_rate
    if detail:
        payload["milestones"] = [
            {
                "name": item.name,
                "value": item.value if can_view_financials else "0",
                "dueConditionOrDate": item.due_condition_or_date,
                "sortOrder": item.sort_order,
            }
            for item in sorted(contract.milestones, key=lambda row: row.sort_order)
        ]
        if contract.resources:
            payload["resource"] = resource_payload(
                contract.resources[0], can_view_financials=can_view_financials
            )
    return payload


def load_contract(db: Session, contract_id: uuid.UUID) -> Contract | None:
    return db.scalars(
        select(Contract)
        .options(
            selectinload(Contract.entity),
            selectinload(Contract.parent),
            selectinload(Contract.client),
            selectinload(Contract.closure_owner),
            selectinload(Contract.milestones),
            selectinload(Contract.resources),
        )
        .where(Contract.id == contract_id, Contract.deleted_at.is_(None))
    ).first()


def _dedupe_contracts(rows: list[Contract]) -> list[Contract]:
    seen: set[uuid.UUID] = set()
    unique: list[Contract] = []
    for item in rows:
        if item.id in seen:
            continue
        seen.add(item.id)
        unique.append(item)
    return unique


def _apply_resource(
    db: Session,
    contract: Contract,
    body: ResourceIn,
    *,
    resource_type: str,
    can_view: bool,
) -> None:
    if body.mode != resource_type:
        raise validation_error("Resource mode must match resource type.")
    cost = None
    if body.mode == "inhouse":
        if not body.resource_name and body.resource_user_id is None:
            raise validation_error("Inhouse resource requires a resource name or user.")
        if body.allocation_percent is None:
            raise validation_error("Allocation percent is required for inhouse resources.")
        if can_view:
            cost = _decimal_string(body.cost_of_resource, field="costOfResource")
    else:
        if not body.vendor_contract_ref and not body.vendor_contract_file_key:
            raise validation_error("Vendor resource requires a vendor contract reference or file.")

    resource_name = body.resource_name
    if body.resource_user_id and not resource_name:
        resource_user = db.get(User, body.resource_user_id)
        resource_name = resource_user.display_name if resource_user else None

    for existing in list(contract.resources):
        db.delete(existing)
    db.flush()
    db.add(
        ContractResource(
            contract_id=contract.id,
            mode=body.mode,
            resource_user_id=body.resource_user_id,
            resource_name=resource_name,
            allocation_percent=body.allocation_percent,
            cost_of_resource=cost,
            vendor_contract_ref=body.vendor_contract_ref,
            vendor_contract_file_key=body.vendor_contract_file_key,
            monthly_vendor_invoice=_decimal_string(
                body.monthly_vendor_invoice, field="monthlyVendorInvoice"
            )
            if can_view
            else None,
            monthly_vendor_invoice_file_key=body.monthly_vendor_invoice_file_key,
            tds_paid_payable=_decimal_string(body.tds_paid_payable, field="tdsPaidPayable")
            if can_view
            else None,
            gst_paid_payable=_decimal_string(body.gst_paid_payable, field="gstPaidPayable")
            if can_view
            else None,
        )
    )


@router.get("/contracts")
def list_contracts(
    status: str = "all",
    list_params: tuple[str | None, int, int] = Depends(list_query_deps),
    x_entity_id: str | None = Header(default=None, alias="X-Entity-Id"),
    current: CurrentUser = Depends(require_list_contracts),
    db: Session = Depends(get_db),
) -> dict:
    search, page, page_size = list_params
    entity_id = parse_entity_header(x_entity_id)
    query = select(Contract).options(
        selectinload(Contract.entity),
        selectinload(Contract.parent),
        selectinload(Contract.client),
        selectinload(Contract.closure_owner),
    ).where(Contract.deleted_at.is_(None))
    if entity_id is not None:
        query = query.where(Contract.entity_id == entity_id)
    if status and status != "all":
        query = query.where(Contract.project_status == status)
    if search:
        term = f"%{search.strip()}%"
        query = (
            query.outerjoin(User, User.id == Contract.closure_owner_user_id)
            .outerjoin(Client, Client.id == Contract.client_id)
            .where(
                or_(
                    Contract.reference.ilike(term),
                    User.display_name.ilike(term),
                    Client.name.ilike(term),
                )
            )
            .distinct()
        )
    query = query.order_by(Contract.created_at.desc())
    contracts, total = paginate(db, query, page=page, page_size=page_size)
    contracts = _dedupe_contracts(contracts)
    can_view = VIEW_CONTRACT_FINANCIALS in current.permissions
    return {
        "contracts": [contract_payload(item, can_view_financials=can_view) for item in contracts],
        "page": page,
        "pageSize": page_size,
        "total": total,
    }


@router.get("/contracts/closure-owners")
def list_closure_owners(
    _current: CurrentUser = Depends(require_manage_contracts),
    db: Session = Depends(get_db),
) -> dict:
    users = list(db.scalars(select(User).order_by(User.display_name)).all())
    return {
        "owners": [
            {"id": str(user.id), "displayName": user.display_name}
            for user in users
        ]
    }


@router.get("/contracts/{contract_id}")
def get_contract(
    contract_id: uuid.UUID,
    x_entity_id: str | None = Header(default=None, alias="X-Entity-Id"),
    current: CurrentUser = Depends(require_manage_contracts),
    db: Session = Depends(get_db),
) -> dict:
    contract = load_contract(db, contract_id)
    if contract is None:
        raise not_found("Contract was not found.")
    entity_id = parse_entity_header(x_entity_id)
    if entity_id is not None and contract.entity_id != entity_id:
        raise not_found("Contract was not found.")
    can_view = VIEW_CONTRACT_FINANCIALS in current.permissions
    return contract_payload(contract, can_view_financials=can_view, detail=True)


@router.post("/contracts", status_code=201)
def create_contract(
    body: CreateContractRequest,
    x_entity_id: str | None = Header(default=None, alias="X-Entity-Id"),
    current: CurrentUser = Depends(require_manage_contracts),
    db: Session = Depends(get_db),
) -> dict:
    entity_id = require_single_entity(x_entity_id)
    entity = db.get(LegalEntity, entity_id)
    if entity is None or not entity.active:
        raise not_found("Legal entity was not found.")

    if body.currency not in _allowed_currencies(entity):
        raise invalid_currency()
    if body.category not in {"time_and_material", "data_management", "contract_staffing"}:
        raise validation_error("Invalid category.")
    if not body.client_file_key.strip():
        raise validation_error("Client contract file is required.")

    client = _require_client(db, body.client_id)

    if body.is_amendment:
        if body.parent_contract_id is None:
            raise validation_error("Amendment requires a parent contract.")
        parent = db.get(Contract, body.parent_contract_id)
        if parent is None or parent.entity_id != entity_id:
            raise validation_error("Parent contract was not found for this entity.")
    elif body.parent_contract_id is not None:
        raise validation_error("parentContractId is only allowed for amendments.")

    reference = next_contract_reference(db, entity_id)
    contract = Contract(
        entity_id=entity_id,
        reference=reference,
        category=body.category,
        currency=body.currency,
        is_amendment=body.is_amendment,
        is_draft=True,
        parent_contract_id=body.parent_contract_id if body.is_amendment else None,
        client_id=client.id,
        client_file_key=body.client_file_key.strip(),
        client_file_name=body.client_file_name,
        client_file_content_type=body.client_file_content_type,
        client_file_size_bytes=body.client_file_size_bytes,
        created_by_user_id=current.user.id,
        created_at=datetime.now(timezone.utc),
    )
    db.add(contract)
    db.flush()

    loaded = load_contract(db, contract.id)
    assert loaded is not None
    can_view = VIEW_CONTRACT_FINANCIALS in current.permissions
    return contract_payload(loaded, can_view_financials=can_view, detail=True)


@router.patch("/contracts/{contract_id}")
def update_contract(
    contract_id: uuid.UUID,
    body: UpdateContractRequest,
    x_entity_id: str | None = Header(default=None, alias="X-Entity-Id"),
    current: CurrentUser = Depends(require_manage_contracts),
    db: Session = Depends(get_db),
) -> dict:
    entity_id = require_single_entity(x_entity_id)
    contract = load_contract(db, contract_id)
    if contract is None or contract.entity_id != entity_id:
        raise not_found("Contract was not found.")

    can_view = VIEW_CONTRACT_FINANCIALS in current.permissions

    if body.category is not None:
        if body.category not in {"time_and_material", "data_management", "contract_staffing"}:
            raise validation_error("Invalid category.")
        contract.category = body.category
    if body.currency is not None:
        entity = db.get(LegalEntity, contract.entity_id)
        if entity is None or body.currency not in _allowed_currencies(entity):
            raise invalid_currency()
        contract.currency = body.currency
    if body.client_file_key is not None:
        if not body.client_file_key.strip():
            raise validation_error("Client contract file is required.")
        contract.client_file_key = body.client_file_key.strip()
    if body.client_file_name is not None:
        contract.client_file_name = body.client_file_name
    if body.client_file_content_type is not None:
        contract.client_file_content_type = body.client_file_content_type
    if body.client_file_size_bytes is not None:
        contract.client_file_size_bytes = body.client_file_size_bytes
    if body.client_id is not None:
        client = _require_client(db, body.client_id)
        contract.client_id = client.id
    if body.is_amendment is not None:
        contract.is_amendment = body.is_amendment
        if not body.is_amendment:
            contract.parent_contract_id = None
    if "parent_contract_id" in body.model_fields_set:
        if body.parent_contract_id is None:
            contract.parent_contract_id = None
        else:
            parent = db.get(Contract, body.parent_contract_id)
            if parent is None or parent.entity_id != entity_id:
                raise validation_error("Parent contract was not found for this entity.")
            contract.parent_contract_id = body.parent_contract_id


    if body.closure_owner_user_id is not None:
        owner = db.get(User, body.closure_owner_user_id)
        if owner is None:
            raise validation_error("Closure owner was not found.")
        contract.closure_owner_user_id = body.closure_owner_user_id
    if body.start_date is not None:
        contract.start_date = body.start_date
    if body.end_date is not None:
        contract.end_date = body.end_date
    if body.project_status is not None:
        if body.project_status not in {"active", "on_hold", "support", "cancelled"}:
            raise validation_error("Invalid project status.")
        contract.project_status = body.project_status
    if body.pmo_note is not None:
        contract.pmo_note = body.pmo_note

    if contract.start_date and contract.end_date and contract.end_date < contract.start_date:
        raise validation_error("End date must be on or after the start date.")

    if body.payment_type is not None:
        if body.payment_type not in {"project_value", "monthly"}:
            raise validation_error("Invalid payment type.")
        contract.payment_type = body.payment_type
        if body.payment_type == "project_value":
            contract.monthly_rate = None
            contract.months = None
        else:
            contract.project_value = None
    if body.project_value is not None:
        contract.project_value = _decimal_string(body.project_value, field="projectValue")
    if body.monthly_rate is not None:
        contract.monthly_rate = _decimal_string(body.monthly_rate, field="monthlyRate")
    if body.months is not None:
        contract.months = body.months

    if body.milestones is not None:
        for existing in list(contract.milestones):
            db.delete(existing)
        db.flush()
        for index, milestone in enumerate(body.milestones):
            value = _decimal_string(milestone.value, field="milestone value")
            if value is None:
                raise validation_error("Milestone value is required.")
            db.add(
                ContractMilestone(
                    contract_id=contract.id,
                    name=milestone.name.strip(),
                    value=value if can_view else value,
                    due_condition_or_date=milestone.due_condition_or_date.strip(),
                    sort_order=milestone.sort_order if milestone.sort_order is not None else index,
                )
            )

    if body.resource_type is not None:
        if body.resource_type not in {"inhouse", "vendor"}:
            raise validation_error("Invalid resource type.")
        contract.resource_type = body.resource_type
    if body.resource is not None:
        if not contract.resource_type:
            raise validation_error("resourceType is required when setting resource.")
        _apply_resource(
            db,
            contract,
            body.resource,
            resource_type=contract.resource_type,
            can_view=can_view,
        )
        db.flush()
        db.expire(contract, ["resources"])

    if body.complete:
        missing: list[str] = []
        if not contract.client_id:
            missing.append("clientId")
        if not contract.closure_owner_user_id:
            missing.append("closureOwnerUserId")
        if not contract.start_date or not contract.end_date:
            missing.append("dates")
        if not contract.project_status:
            missing.append("projectStatus")
        if not contract.payment_type:
            missing.append("paymentType")
        if contract.payment_type == "project_value" and not contract.project_value:
            missing.append("projectValue")
        if contract.payment_type == "monthly" and (not contract.monthly_rate or not contract.months):
            missing.append("monthlyRate/months")
        if contract.category == "time_and_material" and not contract.milestones:
            missing.append("milestones")
        if missing:
            raise validation_error(f"Cannot complete contract; missing: {', '.join(missing)}.")
        contract.is_draft = False

    db.flush()
    loaded = load_contract(db, contract.id)
    assert loaded is not None
    return contract_payload(loaded, can_view_financials=can_view, detail=True)


@router.delete("/contracts/{contract_id}", status_code=204)
def delete_contract(
    contract_id: uuid.UUID,
    x_entity_id: str | None = Header(default=None, alias="X-Entity-Id"),
    _current: CurrentUser = Depends(require_delete_contracts),
    db: Session = Depends(get_db),
) -> None:
    entity_id = require_single_entity(x_entity_id)
    contract = load_contract(db, contract_id)
    if contract is None or contract.entity_id != entity_id:
        raise not_found("Contract was not found.")
    contract.deleted_at = datetime.now(timezone.utc)
    db.flush()


@router.post("/contracts/files", status_code=201)
async def upload_contract_file(
    file: UploadFile = File(...),
    x_entity_id: str | None = Header(default=None, alias="X-Entity-Id"),
    _current: CurrentUser = Depends(require_manage_contracts),
) -> dict:
    require_single_entity(x_entity_id)
    filename = file.filename or "upload.bin"
    lower = filename.lower()
    if not any(lower.endswith(ext) for ext in ALLOWED_EXTENSIONS):
        raise invalid_file_type()
    data = await file.read()
    if not data:
        raise validation_error("Uploaded file is empty.")
    content_type = file.content_type or "application/octet-stream"
    key = upload_bytes(
        data=data,
        content_type=content_type,
        filename=filename,
    )
    return {
        "fileKey": key,
        "fileName": filename,
        "contentType": content_type,
        "sizeBytes": len(data),
    }
