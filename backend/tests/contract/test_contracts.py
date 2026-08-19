from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from io import BytesIO

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Contract, ContractResource, LegalEntity, User
from tests.conftest import assign_role, auth_header, create_client, create_user, role_by_name


def _entity(db: Session, code: str) -> LegalEntity:
    return db.scalars(select(LegalEntity).where(LegalEntity.code == code)).one()


def _create_complete_contract(
    db: Session,
    *,
    entity: LegalEntity,
    owner: User,
    reference: str,
    status: str = "active",
    project_value: str = "1000.00",
) -> Contract:
    party = create_client(db, name=f"Client {reference}")
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
        project_status=status,
        payment_type="project_value",
        project_value=project_value,
        resource_type="inhouse",
        client_id=party.id,
        client_file_key="contracts/demo.pdf",
        created_by_user_id=owner.id,
        created_at=datetime.now(timezone.utc),
    )
    db.add(contract)
    db.flush()
    db.add(
        ContractResource(
            contract_id=contract.id,
            mode="inhouse",
            resource_name="Dev",
            allocation_percent=50,
            cost_of_resource="100.00",
        )
    )
    db.flush()
    return contract


def test_list_entities_seeded(client, db: Session):
    admin = create_user(db, display_name="Admin", upn="admin@contoso.com")
    assign_role(db, admin, role_by_name(db, "System Admin"))
    db.commit()

    response = client.get("/v1/entities", headers=auth_header(admin))
    assert response.status_code == 200
    names = {item["name"] for item in response.json()["entities"]}
    assert names == {"Entity A", "Entity B", "Entity C"}


def test_list_contracts_scoped_and_unique(client, db: Session):
    admin = create_user(db, display_name="Admin", upn="admin@contoso.com")
    assign_role(db, admin, role_by_name(db, "System Admin"))
    entity_a = _entity(db, "entity_a")
    entity_b = _entity(db, "entity_b")
    _create_complete_contract(db, entity=entity_a, owner=admin, reference="CTR-0001")
    _create_complete_contract(db, entity=entity_b, owner=admin, reference="CTR-0001")
    db.commit()

    only_a = client.get(
        "/v1/contracts",
        headers={**auth_header(admin), "X-Entity-Id": str(entity_a.id)},
    )
    assert only_a.status_code == 200
    refs = [item["reference"] for item in only_a.json()["contracts"]]
    assert refs == ["CTR-0001"]
    ids = [item["id"] for item in only_a.json()["contracts"]]
    assert len(ids) == len(set(ids))


def test_step1_create_generates_reference_and_one_list_row(client, db: Session):
    admin = create_user(db, display_name="Admin", upn="admin@contoso.com")
    assign_role(db, admin, role_by_name(db, "System Admin"))
    entity_a = _entity(db, "entity_a")
    party = create_client(db)
    db.commit()

    payload = {
        "clientId": str(party.id),
        "clientFileKey": "contracts/file.pdf",
        "clientFileName": "file.pdf",
        "clientFileContentType": "application/pdf",
        "clientFileSizeBytes": 12,
        "isAmendment": False,
        "category": "time_and_material",
        "currency": "INR",
    }
    created = client.post(
        "/v1/contracts",
        headers={**auth_header(admin), "X-Entity-Id": str(entity_a.id)},
        json=payload,
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["isDraft"] is True
    assert body["reference"] == "CTR-0001"
    assert body["clientId"] == str(party.id)
    assert body["clientName"] == party.name
    assert "closureOwnerUserId" not in body or body.get("startDate") is None

    listed = client.get(
        "/v1/contracts",
        headers={**auth_header(admin), "X-Entity-Id": str(entity_a.id)},
    )
    assert listed.status_code == 200
    assert listed.json()["total"] >= 1
    rows = [item for item in listed.json()["contracts"] if item["reference"] == "CTR-0001"]
    assert len(rows) == 1


def test_create_rejects_all_entities_and_invalid_currency(client, db: Session):
    admin = create_user(db, display_name="Admin", upn="admin@contoso.com")
    assign_role(db, admin, role_by_name(db, "System Admin"))
    entity_a = _entity(db, "entity_a")
    party = create_client(db)
    db.commit()

    payload = {
        "clientId": str(party.id),
        "clientFileKey": "contracts/file.pdf",
        "isAmendment": False,
        "category": "time_and_material",
        "currency": "INR",
    }
    rejected = client.post(
        "/v1/contracts",
        headers={**auth_header(admin), "X-Entity-Id": "*"},
        json=payload,
    )
    assert rejected.status_code == 403
    assert rejected.json()["code"] == "entity_context_required"

    bad_currency = dict(payload)
    bad_currency["currency"] = "SAR"
    response_currency = client.post(
        "/v1/contracts",
        headers={**auth_header(admin), "X-Entity-Id": str(entity_a.id)},
        json=bad_currency,
    )
    assert response_currency.status_code == 400
    assert response_currency.json()["code"] == "invalid_currency"


def test_patch_completes_after_step3_without_resource(client, db: Session):
    admin = create_user(db, display_name="Admin", upn="admin@contoso.com")
    assign_role(db, admin, role_by_name(db, "System Admin"))
    entity_c = _entity(db, "entity_c")
    party = create_client(db, name="Entity C Client")
    db.commit()

    created = client.post(
        "/v1/contracts",
        headers={**auth_header(admin), "X-Entity-Id": str(entity_c.id)},
        json={
            "clientId": str(party.id),
            "clientFileKey": "contracts/file.pdf",
            "isAmendment": False,
            "category": "data_management",
            "currency": "SAR",
        },
    )
    assert created.status_code == 201
    contract_id = created.json()["id"]

    step2 = client.patch(
        f"/v1/contracts/{contract_id}",
        headers={**auth_header(admin), "X-Entity-Id": str(entity_c.id)},
        json={
            "closureOwnerUserId": str(admin.id),
            "startDate": "2026-02-01",
            "endDate": "2026-08-01",
            "projectStatus": "active",
        },
    )
    assert step2.status_code == 200

    complete = client.patch(
        f"/v1/contracts/{contract_id}",
        headers={**auth_header(admin), "X-Entity-Id": str(entity_c.id)},
        json={
            "paymentType": "monthly",
            "monthlyRate": "10.50",
            "months": 6,
            "milestones": [
                {
                    "name": "Kickoff",
                    "value": "100.00",
                    "dueConditionOrDate": "2026-02-15",
                    "sortOrder": 0,
                }
            ],
            "complete": True,
        },
    )
    assert complete.status_code == 200, complete.text
    body = complete.json()
    assert body["isDraft"] is False
    assert body["monthlyRate"] == "10.50"
    assert body.get("resourceType") is None
    assert body["reference"].startswith("CTR-")


def test_soft_delete_hides_from_list_and_get(client, db: Session):
    admin = create_user(db, display_name="Admin", upn="admin@contoso.com")
    assign_role(db, admin, role_by_name(db, "System Admin"))
    entity_a = _entity(db, "entity_a")
    contract = _create_complete_contract(db, entity=entity_a, owner=admin, reference="CTR-DEL1")
    db.commit()

    deleted = client.delete(
        f"/v1/contracts/{contract.id}",
        headers={**auth_header(admin), "X-Entity-Id": str(entity_a.id)},
    )
    assert deleted.status_code == 204

    listed = client.get(
        "/v1/contracts",
        headers={**auth_header(admin), "X-Entity-Id": str(entity_a.id)},
    )
    assert listed.status_code == 200
    assert all(item["id"] != str(contract.id) for item in listed.json()["contracts"])

    fetched = client.get(
        f"/v1/contracts/{contract.id}",
        headers={**auth_header(admin), "X-Entity-Id": str(entity_a.id)},
    )
    assert fetched.status_code == 404


def test_delete_forbidden_without_financials(client, db: Session):
    hr = create_user(db, display_name="HR User", upn="hr-del@contoso.com")
    assign_role(db, hr, role_by_name(db, "Contracts HR"))
    entity_a = _entity(db, "entity_a")
    contract = _create_complete_contract(db, entity=entity_a, owner=hr, reference="CTR-HRD1")
    db.commit()

    response = client.delete(
        f"/v1/contracts/{contract.id}",
        headers={**auth_header(hr), "X-Entity-Id": str(entity_a.id)},
    )
    assert response.status_code == 403


def test_closure_owners_requires_manage_contracts(client, db: Session):
    admin = create_user(db, display_name="Admin", upn="admin-owners@contoso.com")
    assign_role(db, admin, role_by_name(db, "System Admin"))
    pending = create_user(db, display_name="Pending", upn="pending@contoso.com")
    db.commit()

    ok = client.get("/v1/contracts/closure-owners", headers=auth_header(admin))
    assert ok.status_code == 200
    ids = {item["id"] for item in ok.json()["owners"]}
    assert str(admin.id) in ids
    assert str(pending.id) in ids

    forbidden = client.get("/v1/contracts/closure-owners", headers=auth_header(pending))
    assert forbidden.status_code == 403


def test_hr_list_redacts_financials(client, db: Session):
    hr = create_user(db, display_name="HR User", upn="hr@contoso.com")
    assign_role(db, hr, role_by_name(db, "Contracts HR"))
    entity_a = _entity(db, "entity_a")
    _create_complete_contract(db, entity=entity_a, owner=hr, reference="CTR-HR01", project_value="9999.00")
    db.commit()

    response = client.get(
        "/v1/contracts",
        headers={**auth_header(hr), "X-Entity-Id": str(entity_a.id)},
    )
    assert response.status_code == 200
    contract = response.json()["contracts"][0]
    assert "projectValue" not in contract
    assert contract["paymentDisplay"] == "Restricted"


def test_upload_contract_file_mocked(client, db: Session, monkeypatch):
    admin = create_user(db, display_name="Admin", upn="admin@contoso.com")
    assign_role(db, admin, role_by_name(db, "System Admin"))
    entity_a = _entity(db, "entity_a")
    db.commit()

    monkeypatch.setattr(
        "app.api.contracts.upload_bytes",
        lambda **kwargs: f"contracts/{uuid.uuid4()}/demo.pdf",
    )

    response = client.post(
        "/v1/contracts/files",
        headers={**auth_header(admin), "X-Entity-Id": str(entity_a.id)},
        files={"file": ("demo.pdf", BytesIO(b"%PDF-1.4"), "application/pdf")},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["fileKey"].endswith("demo.pdf")
    assert body["fileName"] == "demo.pdf"
    assert body["sizeBytes"] == 8


def test_upload_contract_doc_file_accepted(client, db: Session, monkeypatch):
    admin = create_user(db, display_name="Admin", upn="admin@contoso.com")
    assign_role(db, admin, role_by_name(db, "System Admin"))
    entity_a = _entity(db, "entity_a")
    db.commit()

    monkeypatch.setattr(
        "app.api.contracts.upload_bytes",
        lambda **kwargs: f"contracts/{uuid.uuid4()}/legacy.doc",
    )

    response = client.post(
        "/v1/contracts/files",
        headers={**auth_header(admin), "X-Entity-Id": str(entity_a.id)},
        files={"file": ("legacy.doc", BytesIO(b"DOC"), "application/msword")},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["fileName"] == "legacy.doc"
