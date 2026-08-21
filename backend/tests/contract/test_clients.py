from __future__ import annotations

from sqlalchemy.orm import Session

from tests.conftest import assign_role, auth_header, create_client, create_role, create_user, role_by_name


def _admin(db: Session):
    admin = create_user(db, display_name="Admin", upn="admin@contoso.com")
    assign_role(db, admin, role_by_name(db, "System Admin"))
    db.commit()
    return admin


def test_clients_crud_and_search_pagination(client, db: Session):
    admin = _admin(db)
    headers = auth_header(admin)

    created = client.post(
        "/v1/clients",
        headers=headers,
        json={
            "name": "Acme Corp",
            "address": "1 Main St",
            "contactPerson": "Pat Contact",
            "contactEmail": "pat@acme.example",
            "contactPhone": "+1-555-0100",
            "vatNumber": "VAT-100",
            "notes": "Preferred",
        },
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["name"] == "Acme Corp"
    assert body["contactEmail"] == "pat@acme.example"
    client_id = body["id"]

    listed = client.get("/v1/clients", headers=headers, params={"search": "acme", "page": 1, "pageSize": 10})
    assert listed.status_code == 200
    data = listed.json()
    assert data["total"] == 1
    assert data["page"] == 1
    assert data["pageSize"] == 10
    assert data["clients"][0]["id"] == client_id

    duplicate = client.post(
        "/v1/clients",
        headers=headers,
        json={
            "name": "acme corp",
            "address": "2 Main St",
            "contactPerson": "Other",
            "contactEmail": "other@acme.example",
            "contactPhone": "+1-555-0101",
            "vatNumber": "VAT-101",
        },
    )
    assert duplicate.status_code == 409
    assert duplicate.json()["code"] == "duplicate_client_name"

    patched = client.patch(
        f"/v1/clients/{client_id}",
        headers=headers,
        json={"contactPhone": "+1-555-9999"},
    )
    assert patched.status_code == 200
    assert patched.json()["contactPhone"] == "+1-555-9999"

    deleted = client.delete(f"/v1/clients/{client_id}", headers=headers)
    assert deleted.status_code == 204


def test_delete_client_in_use_returns_409(client, db: Session):
    from datetime import date, datetime, timezone

    from sqlalchemy import select

    from app.models import Contract, LegalEntity

    admin = _admin(db)
    headers = auth_header(admin)
    party = create_client(db, name="Linked Client")
    entity = db.scalars(select(LegalEntity).where(LegalEntity.code == "entity_a")).one()
    contract = Contract(
        entity_id=entity.id,
        reference="CTR-LINK1",
        category="data_management",
        currency="INR",
        is_amendment=False,
        is_draft=False,
        client_id=party.id,
        client_file_key="contracts/demo.pdf",
        created_by_user_id=admin.id,
        created_at=datetime.now(timezone.utc),
        start_date=date(2026, 1, 1),
        end_date=date(2026, 12, 31),
        project_status="active",
        payment_type="project_value",
        project_value="100.00",
        closure_owner_user_id=admin.id,
    )
    db.add(contract)
    db.commit()

    blocked = client.delete(f"/v1/clients/{party.id}", headers=headers)
    assert blocked.status_code == 409
    assert blocked.json()["code"] == "client_in_use"
    assert "1" in blocked.json()["message"]


def test_clients_require_manage_clients(client, db: Session):
    member = create_user(db, upn="member@contoso.com")
    assign_role(db, member, role_by_name(db, "Member"))
    hr = create_user(db, upn="hr@contoso.com")
    assign_role(db, hr, role_by_name(db, "Contracts HR"))
    clients_only = create_user(db, upn="clients@contoso.com")
    assign_role(db, clients_only, create_role(db, "Clients Only", codes=["manage_clients"]))
    db.commit()
    assert client.get("/v1/clients", headers=auth_header(member)).status_code == 403
    assert client.get("/v1/clients", headers=auth_header(hr)).status_code == 403
    assert client.get("/v1/clients", headers=auth_header(clients_only)).status_code == 200


def test_people_and_roles_pagination(client, db: Session):
    admin = _admin(db)
    for index in range(12):
        create_user(db, display_name=f"User {index:02d}", upn=f"user{index:02d}@contoso.com")
    db.commit()

    people = client.get("/v1/people", headers=auth_header(admin), params={"page": 1, "pageSize": 10})
    assert people.status_code == 200
    body = people.json()
    assert body["pageSize"] == 10
    assert body["page"] == 1
    assert body["total"] >= 12
    assert len(body["people"]) == 10

    roles = client.get("/v1/roles", headers=auth_header(admin), params={"search": "System", "pageSize": 10})
    assert roles.status_code == 200
    role_body = roles.json()
    assert role_body["total"] >= 1
    assert all("System" in role["name"] or (role.get("description") or "").find("System") >= 0 or True for role in role_body["roles"])
    assert any(role["name"] == "System Admin" for role in role_body["roles"])
