from __future__ import annotations

from datetime import date, datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import Contract, LegalEntity
from tests.conftest import (
    assign_role,
    auth_header,
    create_client,
    create_role,
    create_user,
    role_by_name,
)


def _entity(db: Session, code: str) -> LegalEntity:
    return db.scalars(select(LegalEntity).where(LegalEntity.code == code)).one()


def _admin(db: Session):
    admin = create_user(db, display_name="Admin", upn="admin-pf@contoso.com")
    assign_role(db, admin, role_by_name(db, "System Admin"))
    db.commit()
    return admin


def _contract_with_client(db: Session, *, entity: LegalEntity, owner, reference: str = "CTR-PF-1") -> Contract:
    client_row = create_client(
        db,
        name=f"Client {reference}",
        address="10 King St",
        contact_person="Pat",
        contact_email="pat@client.example",
        contact_phone="+1-555-0100",
        vat_number="VAT-900",
    )
    contract = Contract(
        entity_id=entity.id,
        reference=reference,
        category="time_and_material",
        currency=entity.allowed_currencies[0],
        is_amendment=False,
        is_draft=False,
        client_id=client_row.id,
        closure_owner_user_id=owner.id,
        start_date=date(2026, 1, 1),
        end_date=date(2026, 12, 31),
        project_status="active",
        payment_type="project_value",
        project_value="2500.00",
        resource_type="inhouse",
        client_file_key="contracts/demo.pdf",
        created_by_user_id=owner.id,
        created_at=datetime.now(timezone.utc),
    )
    db.add(contract)
    db.commit()
    db.refresh(contract)
    return contract


def test_create_list_and_pdf_proforma(client, db: Session, monkeypatch):
    monkeypatch.setenv("PROFORMA_ACCOUNT_NAME", "FlyAccounts Operating Account")
    monkeypatch.setenv("PROFORMA_ACCOUNT_NUMBER", "ACCT-778899")
    monkeypatch.setenv("PROFORMA_IBAN", "GB00TESTIBAN000")
    monkeypatch.setenv("PROFORMA_BANK_NAME", "Example Bank")
    monkeypatch.setenv("PROFORMA_BANK_ADDRESS", "1 Bank Street")
    get_settings.cache_clear()

    admin = _admin(db)
    entity = _entity(db, "entity_a")
    contract = _contract_with_client(db, entity=entity, owner=admin)
    headers = {**auth_header(admin), "X-Entity-Id": str(entity.id)}

    created = client.post(
        "/v1/proformas",
        headers=headers,
        json={
            "contractId": str(contract.id),
            "estimatedAmount": "2500.00",
            "validUntil": "2026-12-31",
            "status": "draft",
        },
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["code"] == "PF-0001"
    assert body["contractReference"] == contract.reference
    assert body["clientName"].startswith("Client ")
    assert body["clientVatNumber"] == "VAT-900"
    assert body["estimatedAmount"] == "2500.00"
    assert "gst" not in body
    assert "tax" not in {k.lower() for k in body}
    proforma_id = body["id"]

    listed = client.get("/v1/proformas", headers=headers)
    assert listed.status_code == 200
    assert listed.json()["total"] == 1
    assert listed.json()["proformas"][0]["id"] == proforma_id

    detail = client.get(f"/v1/proformas/{proforma_id}", headers=headers)
    assert detail.status_code == 200
    assert detail.json()["code"] == "PF-0001"

    patched = client.patch(
        f"/v1/proformas/{proforma_id}",
        headers=headers,
        json={"status": "approved", "validUntil": "2027-01-15", "estimatedAmount": "2600.00"},
    )
    assert patched.status_code == 200, patched.text
    assert patched.json()["status"] == "approved"
    assert patched.json()["validUntil"] == "2027-01-15"
    assert patched.json()["estimatedAmount"] == "2600.00"
    assert patched.json()["contractId"] == str(contract.id)
    assert patched.json()["clientName"] == body["clientName"]

    second = client.post(
        "/v1/proformas",
        headers=headers,
        json={
            "contractId": str(contract.id),
            "estimatedAmount": "100.00",
            "validUntil": "2026-11-30",
            "status": "approved",
        },
    )
    assert second.status_code == 201
    assert second.json()["code"] == "PF-0002"

    pdf = client.get(f"/v1/proformas/{proforma_id}/pdf", headers=headers)
    assert pdf.status_code == 200
    assert pdf.headers["content-type"].startswith("application/pdf")
    assert pdf.content[:4] == b"%PDF"
    assert b"PROFORMA INVOICE" in pdf.content
    assert b"ACCOUNT DETAILS" in pdf.content
    assert b"FlyAccounts Operating Account" in pdf.content
    assert b"ACCT-778899" in pdf.content
    assert b"GB00TESTIBAN000" in pdf.content
    assert b"Example Bank" in pdf.content
    assert b"gstAmount" not in pdf.content
    assert b"vatAmount" not in pdf.content
    assert b"VAT No" not in pdf.content
    assert b"VAT-900" not in pdf.content

    get_settings.cache_clear()


def test_proforma_letterhead_from_settings(client, db: Session, monkeypatch):
    monkeypatch.setenv("PROFORMA_COMPANY_ADDRESS_LINE1", "100 Aviation Way")
    monkeypatch.setenv("PROFORMA_COMPANY_CITY", "Riyadh")
    monkeypatch.setenv("PROFORMA_ACCOUNT_NAME", "Letterhead Account")
    monkeypatch.setenv("PROFORMA_IBAN", "SA00LETTERHEAD")
    get_settings.cache_clear()

    admin = _admin(db)
    response = client.get("/v1/proformas/letterhead", headers=auth_header(admin))
    assert response.status_code == 200
    body = response.json()
    assert body["companyAddressLine1"] == "100 Aviation Way"
    assert body["companyCity"] == "Riyadh"
    assert body["accountName"] == "Letterhead Account"
    assert body["iban"] == "SA00LETTERHEAD"
    assert "vat" not in {k.lower() for k in body}
    assert "tax" not in {k.lower() for k in body}

    get_settings.cache_clear()


def test_create_refuses_all_entities(client, db: Session):
    admin = _admin(db)
    entity = _entity(db, "entity_a")
    contract = _contract_with_client(db, entity=entity, owner=admin)
    response = client.post(
        "/v1/proformas",
        headers={**auth_header(admin), "X-Entity-Id": "*"},
        json={
            "contractId": str(contract.id),
            "estimatedAmount": "10.00",
            "validUntil": "2026-12-31",
            "status": "draft",
        },
    )
    assert response.status_code == 403
    assert response.json()["code"] == "entity_context_required"


def test_proforma_amount_redacted_without_financials(client, db: Session):
    admin = _admin(db)
    entity = _entity(db, "entity_a")
    contract = _contract_with_client(db, entity=entity, owner=admin, reference="CTR-PF-HR")

    hr = create_user(db, display_name="HR", upn="hr-pf@contoso.com")
    role = create_role(db, "Proforma HR", codes=["manage_proformas"])
    assign_role(db, hr, role)
    db.commit()

    headers_admin = {**auth_header(admin), "X-Entity-Id": str(entity.id)}
    created = client.post(
        "/v1/proformas",
        headers=headers_admin,
        json={
            "contractId": str(contract.id),
            "estimatedAmount": "999.00",
            "validUntil": "2026-12-31",
            "status": "shared_with_client",
        },
    )
    assert created.status_code == 201
    proforma_id = created.json()["id"]

    headers_hr = {**auth_header(hr), "X-Entity-Id": str(entity.id)}
    listed = client.get("/v1/proformas", headers=headers_hr)
    assert listed.status_code == 200
    row = listed.json()["proformas"][0]
    assert "estimatedAmount" not in row

    detail = client.get(f"/v1/proformas/{proforma_id}", headers=headers_hr)
    assert detail.status_code == 200
    assert "estimatedAmount" not in detail.json()

    pdf = client.get(f"/v1/proformas/{proforma_id}/pdf", headers=headers_hr)
    assert pdf.status_code == 200
    assert pdf.content[:4] == b"%PDF"
    assert b"999.00" not in pdf.content
    assert b"Restricted" in pdf.content


def test_contract_detail_includes_client_snapshot_fields(client, db: Session):
    admin = _admin(db)
    entity = _entity(db, "entity_a")
    contract = _contract_with_client(db, entity=entity, owner=admin, reference="CTR-PF-DET")
    detail = client.get(
        f"/v1/contracts/{contract.id}",
        headers={**auth_header(admin), "X-Entity-Id": str(entity.id)},
    )
    assert detail.status_code == 200
    body = detail.json()
    assert body["clientAddress"] == "10 King St"
    assert body["clientVatNumber"] == "VAT-900"
    assert body["clientEmail"] == "pat@client.example"
