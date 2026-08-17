from tests.conftest import assign_role, auth_header, create_user, role_by_name


def test_permissions_catalog_requires_admin(client, db):
    pending = create_user(db, upn="pending@contoso.com")
    member = create_user(db, upn="member@contoso.com")
    assign_role(db, member, role_by_name(db, "Member"))
    admin = create_user(db, upn="admin@contoso.com")
    assign_role(db, admin, role_by_name(db, "System Admin"))
    db.commit()

    assert client.get("/v1/permissions").status_code == 401
    assert client.get("/v1/permissions", headers=auth_header(pending)).status_code == 403
    assert client.get("/v1/permissions", headers=auth_header(member)).status_code == 403

    response = client.get("/v1/permissions", headers=auth_header(admin))
    assert response.status_code == 200
    modules = response.json()["modules"]
    assert len(modules) == 1
    assert modules[0]["module"] == "settings"
    by_key = {row["permission"]: row for row in modules[0]["permissions"]}
    assert set(by_key) == {"manage_users", "manage_roles", "manage_permissions"}
    assert by_key["manage_users"]["name"] == "Manage users"
    assert "Open Settings → Users" in by_key["manage_users"]["description"]
    assert "module" not in by_key["manage_users"]
    assert "action" not in by_key["manage_users"]
    assert "code" not in by_key["manage_users"]
    assert client.post("/v1/permissions", headers=auth_header(admin), json={}).status_code in {404, 405}
