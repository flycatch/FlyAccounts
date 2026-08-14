import yaml

from tests.conftest import FEATURE_OPENAPI, assign_role, auth_header, create_user, role_by_name


def test_me_unauthorized_without_bearer(client):
    spec = yaml.safe_load(FEATURE_OPENAPI.read_text(encoding="utf-8"))
    response = client.get("/v1/me")
    assert response.status_code == 401
    body = response.json()
    assert body["code"] == "unauthorized"
    assert body["code"] in spec["components"]["schemas"]["ErrorResponse"]["properties"]["code"]["enum"]


def test_me_pending_has_empty_roles_permissions_sections(client, db):
    user = create_user(db, display_name="Alex Example", upn="alex@contoso.com")
    db.commit()

    response = client.get("/v1/me", headers=auth_header(user))
    assert response.status_code == 200
    body = response.json()
    assert body["displayName"] == "Alex Example"
    assert body["upn"] == "alex@contoso.com"
    assert body["roles"] == []
    assert body["permissions"] == []
    assert body["landing"]["accessState"] == "pending"
    assert body["landing"]["sections"] == []
    assert "sensitiveFinancialFields" not in body["landing"]


def test_me_authorized_sections_follow_combined_permissions(client, db):
    user = create_user(db, display_name="Alex Example", upn="alex@contoso.com")
    assign_role(db, user, role_by_name(db, "Finance User"))
    assign_role(db, user, role_by_name(db, "HR User"))
    db.commit()

    response = client.get("/v1/me", headers=auth_header(user))
    assert response.status_code == 200
    body = response.json()
    assert body["landing"]["accessState"] == "authorized"
    codes = {section["code"] for section in body["landing"]["sections"]}
    assert codes == {"finance_landing", "hr_landing"}
    assert "pmo_landing" not in codes
    assert "sensitiveFinancialFields" in body["landing"]
    assert body["landing"]["sensitiveFinancialFields"]["cost"] == "1000.00"
    assert body["landing"]["sensitiveFinancialFields"]["margin"] == "250.00"
    assert {role["name"] for role in body["roles"]} == {"Finance User", "HR User"}


def test_me_omits_sensitive_fields_without_permission(client, db):
    user = create_user(db, upn="hr@contoso.com")
    assign_role(db, user, role_by_name(db, "HR User"))
    db.commit()

    response = client.get("/v1/me", headers=auth_header(user))
    assert response.status_code == 200
    body = response.json()
    assert body["landing"]["sections"][0]["code"] == "hr_landing"
    assert "sensitiveFinancialFields" not in body["landing"]
    assert "view_sensitive_financial_fields" not in body["permissions"]
