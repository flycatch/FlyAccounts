from tests.conftest import assign_role, auth_header, create_user, role_by_name


def test_permissions_catalog_requires_admin(client, db):
    pending = create_user(db, upn="pending@contoso.com")
    hr = create_user(db, upn="hr@contoso.com")
    assign_role(db, hr, role_by_name(db, "HR User"))
    admin = create_user(db, upn="admin@contoso.com")
    assign_role(db, admin, role_by_name(db, "Entity Admin"))
    db.commit()

    assert client.get("/v1/permissions").status_code == 401
    assert client.get("/v1/permissions", headers=auth_header(pending)).status_code == 403
    assert client.get("/v1/permissions", headers=auth_header(hr)).status_code == 403

    response = client.get("/v1/permissions", headers=auth_header(admin))
    assert response.status_code == 200
    permissions = response.json()["permissions"]
    by_code = {row["code"]: row for row in permissions}
    assert set(by_code) == {
        "access_administration",
        "finance_landing",
        "hr_landing",
        "pmo_landing",
        "view_sensitive_financial_fields",
    }
    assert by_code["access_administration"]["module"] == "settings"
    assert by_code["access_administration"].get("action") in (None, "")
    assert by_code["view_sensitive_financial_fields"]["module"] == "finance"
    assert by_code["view_sensitive_financial_fields"]["action"] == "view_sensitive_financial_fields"
    assert client.post("/v1/permissions", headers=auth_header(admin), json={}).status_code in {404, 405}
