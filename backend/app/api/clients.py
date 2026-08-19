from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.deps import CurrentUser, require_manage_contracts
from app.core.errors import client_in_use, duplicate_client_name, not_found, validation_error
from app.core.pagination import list_query_deps, paginate
from app.db.session import get_db
from app.models import Client, Contract

router = APIRouter()

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class CreateClientRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)
    name: str
    address: str
    contact_person: str = Field(alias="contactPerson")
    contact_email: str = Field(alias="contactEmail")
    contact_phone: str = Field(alias="contactPhone")
    vat_number: str = Field(alias="vatNumber")
    notes: str | None = None


class UpdateClientRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)
    name: str | None = None
    address: str | None = None
    contact_person: str | None = Field(default=None, alias="contactPerson")
    contact_email: str | None = Field(default=None, alias="contactEmail")
    contact_phone: str | None = Field(default=None, alias="contactPhone")
    vat_number: str | None = Field(default=None, alias="vatNumber")
    notes: str | None = None


def client_payload(client: Client) -> dict:
    payload = {
        "id": str(client.id),
        "name": client.name,
        "address": client.address,
        "contactPerson": client.contact_person,
        "contactEmail": client.contact_email,
        "contactPhone": client.contact_phone,
        "vatNumber": client.vat_number,
        "createdAt": client.created_at.isoformat().replace("+00:00", "Z"),
    }
    if client.notes is not None:
        payload["notes"] = client.notes
    return payload


def _require_nonempty(value: str | None, field: str) -> str:
    if value is None or not value.strip():
        raise validation_error(f"{field} is required.")
    return value.strip()


def _require_email(value: str | None) -> str:
    email = _require_nonempty(value, "contactEmail")
    if not EMAIL_RE.match(email):
        raise validation_error("contactEmail must be a valid email address.")
    return email


def _assert_unique_name(db: Session, name: str, *, exclude_id: uuid.UUID | None = None) -> None:
    query = select(Client).where(func.lower(Client.name) == name.lower())
    if exclude_id is not None:
        query = query.where(Client.id != exclude_id)
    if db.scalars(query).first() is not None:
        raise duplicate_client_name()


@router.get("/clients")
def list_clients(
    list_params: tuple[str | None, int, int] = Depends(list_query_deps),
    _current: CurrentUser = Depends(require_manage_contracts),
    db: Session = Depends(get_db),
) -> dict:
    search, page, page_size = list_params
    query = select(Client).order_by(Client.name)
    if search:
        term = f"%{search}%"
        query = query.where(
            or_(
                Client.name.ilike(term),
                Client.address.ilike(term),
                Client.contact_person.ilike(term),
                Client.contact_email.ilike(term),
                Client.contact_phone.ilike(term),
                Client.vat_number.ilike(term),
            )
        )
    clients, total = paginate(db, query, page=page, page_size=page_size)
    return {
        "clients": [client_payload(item) for item in clients],
        "page": page,
        "pageSize": page_size,
        "total": total,
    }


@router.post("/clients", status_code=201)
def create_client(
    body: CreateClientRequest,
    _current: CurrentUser = Depends(require_manage_contracts),
    db: Session = Depends(get_db),
) -> dict:
    name = _require_nonempty(body.name, "name")
    _assert_unique_name(db, name)
    client = Client(
        name=name,
        address=_require_nonempty(body.address, "address"),
        contact_person=_require_nonempty(body.contact_person, "contactPerson"),
        contact_email=_require_email(body.contact_email),
        contact_phone=_require_nonempty(body.contact_phone, "contactPhone"),
        vat_number=_require_nonempty(body.vat_number, "vatNumber"),
        notes=body.notes.strip() if body.notes and body.notes.strip() else None,
        created_at=datetime.now(timezone.utc),
    )
    db.add(client)
    db.commit()
    db.refresh(client)
    return client_payload(client)


@router.get("/clients/{client_id}")
def get_client(
    client_id: uuid.UUID,
    _current: CurrentUser = Depends(require_manage_contracts),
    db: Session = Depends(get_db),
) -> dict:
    client = db.get(Client, client_id)
    if client is None:
        raise not_found("Client was not found.")
    return client_payload(client)


@router.patch("/clients/{client_id}")
def update_client(
    client_id: uuid.UUID,
    body: UpdateClientRequest,
    _current: CurrentUser = Depends(require_manage_contracts),
    db: Session = Depends(get_db),
) -> dict:
    client = db.get(Client, client_id)
    if client is None:
        raise not_found("Client was not found.")
    data = body.model_dump(exclude_unset=True)
    if "name" in data:
        name = _require_nonempty(data["name"], "name")
        _assert_unique_name(db, name, exclude_id=client.id)
        client.name = name
    if "address" in data:
        client.address = _require_nonempty(data["address"], "address")
    if "contact_person" in data:
        client.contact_person = _require_nonempty(data["contact_person"], "contactPerson")
    if "contact_email" in data:
        client.contact_email = _require_email(data["contact_email"])
    if "contact_phone" in data:
        client.contact_phone = _require_nonempty(data["contact_phone"], "contactPhone")
    if "vat_number" in data:
        client.vat_number = _require_nonempty(data["vat_number"], "vatNumber")
    if "notes" in data:
        notes = data["notes"]
        client.notes = notes.strip() if isinstance(notes, str) and notes.strip() else None
    db.commit()
    db.refresh(client)
    return client_payload(client)


@router.delete("/clients/{client_id}", status_code=204)
def delete_client(
    client_id: uuid.UUID,
    _current: CurrentUser = Depends(require_manage_contracts),
    db: Session = Depends(get_db),
) -> Response:
    client = db.get(Client, client_id)
    if client is None:
        raise not_found("Client was not found.")
    linked = db.scalar(
        select(func.count())
        .select_from(Contract)
        .where(Contract.client_id == client_id, Contract.deleted_at.is_(None))
    )
    count = int(linked or 0)
    if count > 0:
        raise client_in_use(
            f"This client is linked to {count} contract{'s' if count != 1 else ''} and cannot be deleted."
        )
    db.delete(client)
    db.commit()
    return Response(status_code=204)
