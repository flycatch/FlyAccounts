from __future__ import annotations

import re
import uuid
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, Header, Response
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import asc, desc, or_, select
from sqlalchemy.orm import Session, joinedload

from app.api.contracts import parse_entity_header, require_single_entity
from app.core.deps import CurrentUser, require_manage_resources
from app.core.errors import not_found, validation_error
from app.core.pagination import paginate, sortable_list_query_deps
from app.db.session import get_db
from app.models import Contract, Resource

router = APIRouter()

RESOURCE_TYPES = {"inhouse", "vendor", "both"}
MONTH_RE = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")

SORT_COLUMNS = {
    "resourceType": Resource.resource_type,
    "name": Resource.name,
    "monthlyAllocationPercent": Resource.monthly_allocation_percent,
    "contract": Contract.reference,
    "month": Resource.month,
}


class CreateResourceRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)
    resource_type: str = Field(alias="resourceType")
    name: str
    monthly_allocation_percent: float = Field(alias="monthlyAllocationPercent")
    contract_id: uuid.UUID = Field(alias="contractId")
    month: str


class UpdateResourceRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)
    resource_type: str | None = Field(default=None, alias="resourceType")
    name: str | None = None
    monthly_allocation_percent: float | None = Field(default=None, alias="monthlyAllocationPercent")
    contract_id: uuid.UUID | None = Field(default=None, alias="contractId")
    month: str | None = None


def resource_payload(resource: Resource) -> dict:
    return {
        "id": str(resource.id),
        "resourceType": resource.resource_type,
        "name": resource.name,
        "monthlyAllocationPercent": resource.monthly_allocation_percent,
        "contractId": str(resource.contract_id),
        "contractReference": resource.contract.reference if resource.contract else "",
        "month": resource.month.strftime("%Y-%m"),
        "createdAt": resource.created_at.isoformat().replace("+00:00", "Z"),
    }


def _require_nonempty(value: str | None, field: str) -> str:
    if value is None or not value.strip():
        raise validation_error(f"{field} is required.")
    return value.strip()


def _require_resource_type(value: str | None) -> str:
    resource_type = _require_nonempty(value, "resourceType")
    if resource_type not in RESOURCE_TYPES:
        raise validation_error("resourceType must be inhouse, vendor, or both.")
    return resource_type


def _require_percent(value: float | None) -> int:
    if value is None:
        raise validation_error("monthlyAllocationPercent is required.")
    try:
        percent = float(value)
    except (TypeError, ValueError) as exc:
        raise validation_error("monthlyAllocationPercent must be a number.") from exc
    if not percent == percent:  # NaN
        raise validation_error("monthlyAllocationPercent must be a number.")
    return int(percent) if percent == int(percent) else int(round(percent))


def _require_month(value: str | None) -> date:
    month = _require_nonempty(value, "month")
    if not MONTH_RE.match(month):
        raise validation_error("month must be YYYY-MM.")
    year, month_num = month.split("-")
    return date(int(year), int(month_num), 1)


def _load_contract(db: Session, contract_id: uuid.UUID, entity_id: uuid.UUID) -> Contract:
    contract = db.get(Contract, contract_id)
    if contract is None or contract.deleted_at is not None or contract.entity_id != entity_id:
        raise not_found("Contract was not found.")
    return contract


def _get_resource_for_entity(
    db: Session,
    resource_id: uuid.UUID,
    *,
    entity_id: uuid.UUID | None,
) -> Resource:
    query = (
        select(Resource)
        .options(joinedload(Resource.contract))
        .join(Contract)
        .where(Resource.id == resource_id, Contract.deleted_at.is_(None))
    )
    if entity_id is not None:
        query = query.where(Contract.entity_id == entity_id)
    resource = db.scalars(query).first()
    if resource is None:
        raise not_found("Resource was not found.")
    return resource


@router.get("/resources")
def list_resources(
    list_params: tuple[str | None, int, int, str, str] = Depends(sortable_list_query_deps),
    x_entity_id: str | None = Header(default=None, alias="X-Entity-Id"),
    _current: CurrentUser = Depends(require_manage_resources),
    db: Session = Depends(get_db),
) -> dict:
    search, page, page_size, sort_by, sort_order = list_params
    entity_id = parse_entity_header(x_entity_id)

    query = (
        select(Resource)
        .options(joinedload(Resource.contract))
        .join(Contract)
        .where(Contract.deleted_at.is_(None))
    )
    if entity_id is not None:
        query = query.where(Contract.entity_id == entity_id)
    if search:
        term = f"%{search}%"
        query = query.where(
            or_(
                Resource.name.ilike(term),
                Contract.reference.ilike(term),
                Resource.resource_type.ilike(term),
            )
        )

    column = SORT_COLUMNS.get(sort_by, Resource.name)
    order_fn = asc if sort_order == "asc" else desc
    query = query.order_by(order_fn(column), Resource.name.asc())

    resources, total = paginate(db, query, page=page, page_size=page_size)
    return {
        "resources": [resource_payload(item) for item in resources],
        "page": page,
        "pageSize": page_size,
        "total": total,
    }


@router.post("/resources", status_code=201)
def create_resource(
    body: CreateResourceRequest,
    x_entity_id: str | None = Header(default=None, alias="X-Entity-Id"),
    _current: CurrentUser = Depends(require_manage_resources),
    db: Session = Depends(get_db),
) -> dict:
    entity_id = require_single_entity(x_entity_id)
    contract = _load_contract(db, body.contract_id, entity_id)
    resource = Resource(
        contract_id=contract.id,
        resource_type=_require_resource_type(body.resource_type),
        name=_require_nonempty(body.name, "name"),
        monthly_allocation_percent=_require_percent(body.monthly_allocation_percent),
        month=_require_month(body.month),
        created_at=datetime.now(timezone.utc),
    )
    db.add(resource)
    db.commit()
    db.refresh(resource)
    resource = db.scalars(
        select(Resource).options(joinedload(Resource.contract)).where(Resource.id == resource.id)
    ).one()
    return resource_payload(resource)


@router.get("/resources/{resource_id}")
def get_resource(
    resource_id: uuid.UUID,
    x_entity_id: str | None = Header(default=None, alias="X-Entity-Id"),
    _current: CurrentUser = Depends(require_manage_resources),
    db: Session = Depends(get_db),
) -> dict:
    entity_id = parse_entity_header(x_entity_id)
    resource = _get_resource_for_entity(db, resource_id, entity_id=entity_id)
    return resource_payload(resource)


@router.patch("/resources/{resource_id}")
def update_resource(
    resource_id: uuid.UUID,
    body: UpdateResourceRequest,
    x_entity_id: str | None = Header(default=None, alias="X-Entity-Id"),
    _current: CurrentUser = Depends(require_manage_resources),
    db: Session = Depends(get_db),
) -> dict:
    entity_id = require_single_entity(x_entity_id)
    resource = _get_resource_for_entity(db, resource_id, entity_id=entity_id)
    data = body.model_dump(exclude_unset=True)
    if "resource_type" in data:
        resource.resource_type = _require_resource_type(data["resource_type"])
    if "name" in data:
        resource.name = _require_nonempty(data["name"], "name")
    if "monthly_allocation_percent" in data:
        resource.monthly_allocation_percent = _require_percent(data["monthly_allocation_percent"])
    if "contract_id" in data:
        contract = _load_contract(db, data["contract_id"], entity_id)
        resource.contract_id = contract.id
    if "month" in data:
        resource.month = _require_month(data["month"])
    db.commit()
    resource = db.scalars(
        select(Resource).options(joinedload(Resource.contract)).where(Resource.id == resource.id)
    ).one()
    return resource_payload(resource)


@router.delete("/resources/{resource_id}", status_code=204)
def delete_resource(
    resource_id: uuid.UUID,
    x_entity_id: str | None = Header(default=None, alias="X-Entity-Id"),
    _current: CurrentUser = Depends(require_manage_resources),
    db: Session = Depends(get_db),
) -> Response:
    entity_id = require_single_entity(x_entity_id)
    resource = _get_resource_for_entity(db, resource_id, entity_id=entity_id)
    db.delete(resource)
    db.commit()
    return Response(status_code=204)
