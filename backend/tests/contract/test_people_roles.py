from tests.conftest import assign_role, auth_header, create_user, role_by_name


def test_people_and_roles_require_admin(client, db):
    pending = create_user(db, upn="pending@contoso.com")
    member = create_user(db, upn="member@contoso.com")
    assign_role(db, member, role_by_name(db, "Member"))
    admin = create_user(db, upn="admin@contoso.com")
    assign_role(db, admin, role_by_name(db, "System Admin"))
    db.commit()

    assert client.get("/v1/people").status_code == 401
    assert client.get("/v1/roles").status_code == 401
    assert client.get("/v1/people", headers=auth_header(member)).status_code == 403
    assert client.get("/v1/roles", headers=auth_header(member)).status_code == 403
    assert client.get("/v1/people", headers=auth_header(pending)).status_code == 403

    people = client.get("/v1/people", headers=auth_header(admin))
    assert people.status_code == 200
    emails = {person["email"] for person in people.json()["people"]}
    assert emails >= {"pending@contoso.com", "member@contoso.com", "admin@contoso.com"}

    by_email = {person["email"]: person for person in people.json()["people"]}
    pending_person = by_email["pending@contoso.com"]
    assert pending_person["personType"] == "user"
    assert pending_person["status"] == "pending"
    assert pending_person["displayName"]
    assert "upn" not in pending_person

    member_person = by_email["member@contoso.com"]
    assert member_person["personType"] == "user"
    assert member_person["status"] == "active"
    assert {role["name"] for role in member_person["roles"]} == {"Member"}

    roles = client.get("/v1/roles", headers=auth_header(admin))
    assert roles.status_code == 200
    names = {role["name"] for role in roles.json()["roles"]}
    assert names == {"System Admin", "Member", "Operator"}
    system_admin = next(role for role in roles.json()["roles"] if role["name"] == "System Admin")
    assert "permissions" in system_admin
    keys = {permission["permission"] for permission in system_admin["permissions"]}
    assert keys == {"manage_users", "manage_roles", "manage_permissions"}
    member_role = next(role for role in roles.json()["roles"] if role["name"] == "Member")
    assert member_role["permissions"] == []
