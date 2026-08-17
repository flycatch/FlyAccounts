from tests.conftest import assign_role, auth_header, create_invite, create_user, role_by_name


def test_create_invite_with_and_without_roles(client, db):
    admin = create_user(db, upn="admin@contoso.com")
    assign_role(db, admin, role_by_name(db, "Entity Admin"))
    finance = role_by_name(db, "Finance User")
    hr = role_by_name(db, "HR User")
    db.commit()
    headers = auth_header(admin)

    with_roles = client.post(
        "/v1/people/invites",
        headers=headers,
        json={"email": "two-roles@contoso.com", "roleIds": [str(finance.id), str(hr.id)]},
    )
    assert with_roles.status_code == 201
    body = with_roles.json()
    assert body["personType"] == "invite"
    assert body["status"] == "invited"
    assert body["email"] == "two-roles@contoso.com"
    assert "displayName" not in body
    assert {role["name"] for role in body["roles"]} == {"Finance User", "HR User"}

    no_roles = client.post("/v1/people/invites", headers=headers, json={"email": "no-roles@contoso.com"})
    assert no_roles.status_code == 201
    assert no_roles.json()["roles"] == []
    assert no_roles.json()["status"] == "invited"

    listed = client.get("/v1/people", headers=headers)
    emails = {person["email"]: person for person in listed.json()["people"]}
    assert emails["two-roles@contoso.com"]["personType"] == "invite"
    assert emails["no-roles@contoso.com"]["status"] == "invited"


def test_create_invite_errors(client, db):
    admin = create_user(db, upn="admin@contoso.com")
    assign_role(db, admin, role_by_name(db, "Entity Admin"))
    existing = create_user(db, upn="alex@contoso.com")
    finance = role_by_name(db, "Finance User")
    create_invite(db, email="already@contoso.com", invited_by=admin)
    db.commit()
    headers = auth_header(admin)

    duplicate = client.post("/v1/people/invites", headers=headers, json={"email": "Already@contoso.com"})
    assert duplicate.status_code == 409
    assert duplicate.json()["code"] == "duplicate_invite"

    present = client.post("/v1/people/invites", headers=headers, json={"email": existing.upn})
    assert present.status_code == 409
    assert present.json()["code"] == "already_present"

    missing_role = client.post(
        "/v1/people/invites",
        headers=headers,
        json={"email": "new@contoso.com", "roleIds": ["00000000-0000-4000-8000-000000000098"]},
    )
    assert missing_role.status_code == 404

    hr_user = create_user(db, upn="hr@contoso.com")
    assign_role(db, hr_user, role_by_name(db, "HR User"))
    db.commit()
    forbidden = client.post(
        "/v1/people/invites",
        headers=auth_header(hr_user),
        json={"email": "other@contoso.com", "roleIds": [str(finance.id)]},
    )
    assert forbidden.status_code == 403
