from tests.conftest import assign_role, auth_header, create_user, role_by_name


def test_people_and_roles_require_admin(client, db):
    pending = create_user(db, upn="pending@contoso.com")
    hr = create_user(db, upn="hr@contoso.com")
    assign_role(db, hr, role_by_name(db, "HR User"))
    admin = create_user(db, upn="admin@contoso.com")
    assign_role(db, admin, role_by_name(db, "Entity Admin"))
    db.commit()

    assert client.get("/v1/people").status_code == 401
    assert client.get("/v1/roles").status_code == 401
    assert client.get("/v1/people", headers=auth_header(hr)).status_code == 403
    assert client.get("/v1/roles", headers=auth_header(hr)).status_code == 403
    assert client.get("/v1/people", headers=auth_header(pending)).status_code == 403

    people = client.get("/v1/people", headers=auth_header(admin))
    assert people.status_code == 200
    emails = {person["email"] for person in people.json()["people"]}
    assert emails >= {"pending@contoso.com", "hr@contoso.com", "admin@contoso.com"}

    by_email = {person["email"]: person for person in people.json()["people"]}
    pending_person = by_email["pending@contoso.com"]
    assert pending_person["personType"] == "user"
    assert pending_person["status"] == "pending"
    assert pending_person["displayName"]
    assert "upn" not in pending_person

    hr_person = by_email["hr@contoso.com"]
    assert hr_person["personType"] == "user"
    assert hr_person["status"] == "active"
    assert {role["name"] for role in hr_person["roles"]} == {"HR User"}

    roles = client.get("/v1/roles", headers=auth_header(admin))
    assert roles.status_code == 200
    names = {role["name"] for role in roles.json()["roles"]}
    assert names == {"Entity Admin", "Finance User", "HR User", "PMO User"}
    entity_admin = next(role for role in roles.json()["roles"] if role["name"] == "Entity Admin")
    assert "permissions" in entity_admin
    codes = {permission["code"] for permission in entity_admin["permissions"]}
    assert codes == {"access_administration"}
    admin_permission = entity_admin["permissions"][0]
    assert admin_permission["module"] == "settings"
    assert admin_permission.get("action") in (None, "")
    finance = next(role for role in roles.json()["roles"] if role["name"] == "Finance User")
    sensitive = next(
        permission
        for permission in finance["permissions"]
        if permission["code"] == "view_sensitive_financial_fields"
    )
    assert sensitive["module"] == "finance"
    assert sensitive["action"] == "view_sensitive_financial_fields"
