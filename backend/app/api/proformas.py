from __future__ import annotations

import re
import uuid
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, Header, Response
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, joinedload

from app.api.contracts import (
    _decimal_string,
    parse_entity_header,
    require_single_entity,
)
from app.core.config import get_settings
from app.core.deps import CurrentUser, require_manage_proformas
from app.core.errors import not_found, validation_error
from app.core.pagination import list_query_deps, paginate
from app.core.permissions import VIEW_CONTRACT_FINANCIALS
from app.db.session import get_db
from app.models import Contract, Proforma
from app.proformas.pdf import build_proforma_pdf

router = APIRouter()

CODE_PATTERN = re.compile(r"^PF-(\d+)$")
PROFORMA_STATUSES = {"draft", "shared_with_client", "approved"}


class CreateProformaRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)
    contract_id: uuid.UUID = Field(alias="contractId")
    estimated_amount: str | None = Field(default=None, alias="estimatedAmount")
    valid_until: date = Field(alias="validUntil")
    status: str


class UpdateProformaRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)
    estimated_amount: str | None = Field(default=None, alias="estimatedAmount")
    valid_until: date | None = Field(default=None, alias="validUntil")
    status: str | None = None


def next_proforma_code(db: Session, entity_id: uuid.UUID) -> str:
    codes = db.scalars(select(Proforma.code).where(Proforma.entity_id == entity_id)).all()
    max_n = 0
    for code in codes:
        match = CODE_PATTERN.match(code or "")
        if match:
            max_n = max(max_n, int(match.group(1)))
    return f"PF-{max_n + 1:04d}"


def estimated_from_contract(contract: Contract) -> str | None:
    if contract.payment_type == "project_value" and contract.project_value:
        return contract.project_value
    if contract.payment_type == "monthly" and contract.monthly_rate:
        return contract.monthly_rate
    if contract.project_value:
        return contract.project_value
    if contract.monthly_rate:
        return contract.monthly_rate
    return None


def proforma_payload(proforma: Proforma, *, can_view_financials: bool) -> dict:
    payload: dict = {
        "id": str(proforma.id),
        "code": proforma.code,
        "entityId": str(proforma.entity_id),
        "entityName": proforma.entity.name if proforma.entity else "",
        "contractId": str(proforma.contract_id),
        "contractReference": proforma.contract.reference if proforma.contract else "",
        "clientName": proforma.client_name,
        "clientAddress": proforma.client_address,
        "clientVatNumber": proforma.client_vat_number,
        "clientEmail": proforma.client_email,
        "currency": proforma.currency,
        "validUntil": proforma.valid_until.isoformat(),
        "status": proforma.status,
        "createdAt": proforma.created_at.astimezone(timezone.utc).isoformat().replace("+00:00", "Z"),
    }
    if can_view_financials and proforma.estimated_amount is not None:
        payload["estimatedAmount"] = proforma.estimated_amount
    return payload


def letterhead_payload() -> dict:
    settings = get_settings()
    return {
        "companyAddressLine1": settings.proforma_company_address_line1,
        "companyAddressLine2": settings.proforma_company_address_line2,
        "companyCity": settings.proforma_company_city,
        "companyState": settings.proforma_company_state,
        "companyPostalCode": settings.proforma_company_postal_code,
        "companyCountry": settings.proforma_company_country,
        "companyPhone": settings.proforma_company_phone,
        "companyEmail": settings.proforma_company_email,
        "accountName": settings.proforma_account_name,
        "accountNumber": settings.proforma_account_number,
        "iban": settings.proforma_iban,
        "bankName": settings.proforma_bank_name,
        "bankAddress": settings.proforma_bank_address,
    }


def load_proforma(db: Session, proforma_id: uuid.UUID) -> Proforma | None:
    return db.scalars(
        select(Proforma)
        .options(
            joinedload(Proforma.entity),
            joinedload(Proforma.contract),
        )
        .where(Proforma.id == proforma_id)
    ).first()


def _load_contract_for_entity(db: Session, contract_id: uuid.UUID, entity_id: uuid.UUID) -> Contract:
    contract = db.scalars(
        select(Contract)
        .options(joinedload(Contract.client), joinedload(Contract.entity))
        .where(Contract.id == contract_id)
    ).first()
    if (
        contract is None
        or contract.deleted_at is not None
        or contract.entity_id != entity_id
    ):
        raise not_found("Contract was not found.")
    return contract


def _resolve_proforma(
    db: Session,
    proforma_id: uuid.UUID,
    x_entity_id: str | None,
    *,
    require_entity: bool,
) -> Proforma:
    if require_entity:
        entity_id = require_single_entity(x_entity_id)
    else:
        entity_id = parse_entity_header(x_entity_id)
    proforma = load_proforma(db, proforma_id)
    if proforma is None:
        raise not_found("Proforma was not found.")
    if entity_id is not None and proforma.entity_id != entity_id:
        raise not_found("Proforma was not found.")
    return proforma


@router.get("/proformas")
def list_proformas(
    current: CurrentUser = Depends(require_manage_proformas),
    db: Session = Depends(get_db),
    x_entity_id: str | None = Header(default=None, alias="X-Entity-Id"),
    list_params: tuple[str | None, int, int] = Depends(list_query_deps),
) -> dict:
    search, page, page_size = list_params
    entity_id = parse_entity_header(x_entity_id)
    query = (
        select(Proforma)
        .options(joinedload(Proforma.entity), joinedload(Proforma.contract))
        .order_by(Proforma.created_at.desc())
    )
    if entity_id is not None:
        query = query.where(Proforma.entity_id == entity_id)
    if search:
        term = f"%{search}%"
        query = query.join(Contract, Contract.id == Proforma.contract_id).where(
            or_(
                Proforma.code.ilike(term),
                Proforma.client_name.ilike(term),
                Contract.reference.ilike(term),
            )
        )
    rows, total = paginate(db, query, page=page, page_size=page_size)
    can_view = VIEW_CONTRACT_FINANCIALS in current.permissions
    return {
        "proformas": [proforma_payload(row, can_view_financials=can_view) for row in rows],
        "page": page,
        "pageSize": page_size,
        "total": total,
    }


@router.post("/proformas", status_code=201)
def create_proforma(
    body: CreateProformaRequest,
    current: CurrentUser = Depends(require_manage_proformas),
    db: Session = Depends(get_db),
    x_entity_id: str | None = Header(default=None, alias="X-Entity-Id"),
) -> dict:
    entity_id = require_single_entity(x_entity_id)
    if body.status not in PROFORMA_STATUSES:
        raise validation_error("status must be draft, shared_with_client, or approved.")
    contract = _load_contract_for_entity(db, body.contract_id, entity_id)
    if contract.client is None:
        raise validation_error("Contract must have a client before creating a proforma.")

    can_view = VIEW_CONTRACT_FINANCIALS in current.permissions
    amount = _decimal_string(body.estimated_amount, field="estimatedAmount")
    if amount is None:
        amount = estimated_from_contract(contract)
    if can_view and amount is None:
        raise validation_error("estimatedAmount is required.")

    proforma = Proforma(
        entity_id=entity_id,
        code=next_proforma_code(db, entity_id),
        contract_id=contract.id,
        client_name=contract.client.name,
        client_address=contract.client.address,
        client_vat_number=contract.client.vat_number,
        client_email=contract.client.contact_email,
        estimated_amount=amount,
        currency=contract.currency,
        valid_until=body.valid_until,
        status=body.status,
        created_by_user_id=current.user.id,
        created_at=datetime.now(timezone.utc),
    )
    db.add(proforma)
    db.commit()
    loaded = load_proforma(db, proforma.id)
    assert loaded is not None
    return proforma_payload(loaded, can_view_financials=can_view)


@router.get("/proformas/letterhead")
def get_proforma_letterhead(
    current: CurrentUser = Depends(require_manage_proformas),
) -> dict:
    return letterhead_payload()


@router.get("/proformas/{proforma_id}")
def get_proforma(
    proforma_id: uuid.UUID,
    current: CurrentUser = Depends(require_manage_proformas),
    db: Session = Depends(get_db),
    x_entity_id: str | None = Header(default=None, alias="X-Entity-Id"),
) -> dict:
    proforma = _resolve_proforma(db, proforma_id, x_entity_id, require_entity=False)
    can_view = VIEW_CONTRACT_FINANCIALS in current.permissions
    return proforma_payload(proforma, can_view_financials=can_view)


@router.patch("/proformas/{proforma_id}")
def update_proforma(
    proforma_id: uuid.UUID,
    body: UpdateProformaRequest,
    current: CurrentUser = Depends(require_manage_proformas),
    db: Session = Depends(get_db),
    x_entity_id: str | None = Header(default=None, alias="X-Entity-Id"),
) -> dict:
    proforma = _resolve_proforma(db, proforma_id, x_entity_id, require_entity=True)
    can_view = VIEW_CONTRACT_FINANCIALS in current.permissions

    if body.status is not None:
        if body.status not in PROFORMA_STATUSES:
            raise validation_error("status must be draft, shared_with_client, or approved.")
        proforma.status = body.status
    if body.valid_until is not None:
        proforma.valid_until = body.valid_until
    if body.estimated_amount is not None:
        if not can_view:
            raise validation_error("estimatedAmount cannot be updated without view_contract_financials.")
        amount = _decimal_string(body.estimated_amount, field="estimatedAmount")
        if amount is None:
            raise validation_error("estimatedAmount is required.")
        proforma.estimated_amount = amount

    db.commit()
    loaded = load_proforma(db, proforma.id)
    assert loaded is not None
    return proforma_payload(loaded, can_view_financials=can_view)


@router.get("/proformas/{proforma_id}/pdf")
def download_proforma_pdf(
    proforma_id: uuid.UUID,
    current: CurrentUser = Depends(require_manage_proformas),
    db: Session = Depends(get_db),
    x_entity_id: str | None = Header(default=None, alias="X-Entity-Id"),
) -> Response:
    proforma = _resolve_proforma(db, proforma_id, x_entity_id, require_entity=False)
    can_view = VIEW_CONTRACT_FINANCIALS in current.permissions
    pdf_bytes = build_proforma_pdf(proforma, can_view_financials=can_view)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{proforma.code}.pdf"',
        },
    )
