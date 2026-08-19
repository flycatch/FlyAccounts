from __future__ import annotations

from datetime import date, datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Contract, LegalEntity, Resource, User
from tests.conftest import assign_role, auth_header, create_user, role_by_name


def _entity(db: Session, code: str) -> LegalEntity:
    return db.scalars(select(LegalEntity).where(LegalEntity.code == code)).one()


def _admin(db: Session) -> User:
    admin = create_user(db, display_name="Admin", upn="admin@contoso.com")
    assign_role(db, admin, role_by_name(db, "System Admin"))
    db.commit()
    return admin


def _create_contract(
    db: Session,
    *,
    entity: LegalEntity,
    owner: User,
    reference: str = "CTR-1001",
) -> Contract:
    contract = Contract(
        entity_id=entity.id,
        reference=reference,
        category="time_and_material",
        currency=entity.allowed_currencies[0],
        is_amendment=False,
        is_draft=False,
        closure_owner_user_id=owner.id,
        start_date=date(2026, 1, 1),
        end_date=date(2026, 12, 31),
        project_status="active",
        payment_type="project_value",
        project_value="1000.00",
        resource_type="inhouse",
        client_file_key="contracts/demo.pdf",
        created_by_user_id=owner.id,
        created_at=datetime.now(timezone.utc),
    )
    db.add(contract)
    db.flush()
    return contract


def test_resources_crud_and_over_allocation(client, db: Session):
    admin = _admin(db)
    entity = _entity(db, "entity_a")
    contract = _create_contract(db, entity=entity, owner=admin)
    db.commit()
    headers = {**auth_header(admin), "X-Entity-Id": str(entity.id)}

    created = client.post(
        "/v1/resources",
        headers=headers,
        json={
            "resourceType": "inhouse",
            "name": "Alex Dev",
            "monthlyAllocationPercent": 150,
            "contractId": str(contract.id),
            "month": "2026-08",
        },
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["name"] == "Alex Dev"
    assert body["monthlyAllocationPercent"] == 150
    assert body["contractReference"] == "CTR-1001"
    assert body["month"] == "2026-08"
    resource_id = body["id"]

    listed = client.get(
        "/v1/resources",
        headers=headers,
        params={"search": "alex", "page": 1, "pageSize": 10, "sortBy": "name", "sortOrder": "asc"},
    )
    assert listed.status_code == 200
    data = listed.json()
    assert data["total"] == 1
    assert data["resources"][0]["id"] == resource_id
    assert data["resources"][0]["monthlyAllocationPercent"] == 150

    patched = client.patch(
        f"/v1/resources/{resource_id}",
        headers=headers,
        json={"monthlyAllocationPercent": 80, "resourceType": "vendor"},
    )
    assert patched.status_code == 200
    assert patched.json()["monthlyAllocationPercent"] == 80
    assert patched.json()["resourceType"] == "vendor"

    deleted = client.delete(f"/v1/resources/{resource_id}", headers=headers)
    assert deleted.status_code == 204

    missing = client.get(f"/v1/resources/{resource_id}", headers=headers)
    assert missing.status_code == 404


def test_resources_require_single_entity_for_create(client, db: Session):
    admin = _admin(db)
    entity = _entity(db, "entity_a")
    contract = _create_contract(db, entity=entity, owner=admin)
    db.commit()

    response = client.post(
        "/v1/resources",
        headers={**auth_header(admin), "X-Entity-Id": "*"},
        json={
            "resourceType": "both",
            "name": "Pat Vendor",
            "monthlyAllocationPercent": 50,
            "contractId": str(contract.id),
            "month": "2026-09",
        },
    )
    assert response.status_code == 403
    assert response.json()["code"] == "entity_context_required"


def test_resources_require_manage_contracts(client, db: Session):
    member = create_user(db, upn="member@contoso.com")
    assign_role(db, member, role_by_name(db, "Member"))
    db.commit()
    assert client.get("/v1/resources", headers=auth_header(member)).status_code == 403


def test_resources_search_pagination_and_sort(client, db: Session):
    admin = _admin(db)
    entity = _entity(db, "entity_a")
    contract = _create_contract(db, entity=entity, owner=admin, reference="CTR-SORT")
    for index, name in enumerate(["Zoe", "Amy", "Mia"]):
        db.add(
            Resource(
                contract_id=contract.id,
                resource_type="inhouse",
                name=name,
                monthly_allocation_percent=10 * (index + 1),
                month=date(2026, index + 1, 1),
                created_at=datetime.now(timezone.utc),
            )
        )
    db.commit()
    headers = {**auth_header(admin), "X-Entity-Id": str(entity.id)}

    page1 = client.get(
        "/v1/resources",
        headers=headers,
        params={"page": 1, "pageSize": 10, "sortBy": "name", "sortOrder": "asc"},
    )
    assert page1.status_code == 200
    names = [item["name"] for item in page1.json()["resources"]]
    assert names == ["Amy", "Mia", "Zoe"]

    desc_page = client.get(
        "/v1/resources",
        headers=headers,
        params={"page": 1, "pageSize": 10, "sortBy": "monthlyAllocationPercent", "sortOrder": "desc"},
    )
    percents = [item["monthlyAllocationPercent"] for item in desc_page.json()["resources"]]
    assert percents == [30, 20, 10]

    searched = client.get(
        "/v1/resources",
        headers=headers,
        params={"search": "CTR-SORT", "page": 1, "pageSize": 10},
    )
    assert searched.json()["total"] == 3


def test_resources_scoped_by_entity(client, db: Session):
    admin = _admin(db)
    entity_a = _entity(db, "entity_a")
    entity_b = _entity(db, "entity_b")
    contract_a = _create_contract(db, entity=entity_a, owner=admin, reference="CTR-A")
    contract_b = _create_contract(db, entity=entity_b, owner=admin, reference="CTR-B")
    db.add(
        Resource(
            contract_id=contract_a.id,
            resource_type="inhouse",
            name="Only A",
            monthly_allocation_percent=40,
            month=date(2026, 3, 1),
            created_at=datetime.now(timezone.utc),
        )
    )
    db.add(
        Resource(
            contract_id=contract_b.id,
            resource_type="vendor",
            name="Only B",
            monthly_allocation_percent=60,
            month=date(2026, 4, 1),
            created_at=datetime.now(timezone.utc),
        )
    )
    db.commit()

    only_a = client.get(
        "/v1/resources",
        headers={**auth_header(admin), "X-Entity-Id": str(entity_a.id)},
    )
    assert only_a.status_code == 200
    assert only_a.json()["total"] == 1
    assert only_a.json()["resources"][0]["name"] == "Only A"

    all_entities = client.get(
        "/v1/resources",
        headers={**auth_header(admin), "X-Entity-Id": "*"},
    )
    assert all_entities.status_code == 200
    assert all_entities.json()["total"] == 2
