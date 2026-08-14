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
    assert "people" in people.json()
    assert {person["upn"] for person in people.json()["people"]} >= {
        "pending@contoso.com",
        "hr@contoso.com",
        "admin@contoso.com",
    }

    roles = client.get("/v1/roles", headers=auth_header(admin))
    assert roles.status_code == 200
    names = {role["name"] for role in roles.json()["roles"]}
    assert names == {"Entity Admin", "Finance User", "HR User", "PMO User"}
