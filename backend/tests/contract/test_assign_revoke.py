from tests.conftest import assign_role, auth_header, create_user, role_by_name


def test_assign_and_revoke_roles(client, db):
    admin = create_user(db, upn="admin@contoso.com")
    assign_role(db, admin, role_by_name(db, "Entity Admin"))
    person = create_user(db, upn="alex@contoso.com")
    finance = role_by_name(db, "Finance User")
    hr = role_by_name(db, "HR User")
    db.commit()
    headers = auth_header(admin)

    first = client.post(f"/v1/people/{person.id}/roles", headers=headers, json={"roleId": str(finance.id)})
    assert first.status_code == 200
    assert {role["name"] for role in first.json()["roles"]} == {"Finance User"}

    second = client.post(f"/v1/people/{person.id}/roles", headers=headers, json={"roleId": str(hr.id)})
    assert second.status_code == 200
    assert {role["name"] for role in second.json()["roles"]} == {"Finance User", "HR User"}

    duplicate = client.post(f"/v1/people/{person.id}/roles", headers=headers, json={"roleId": str(hr.id)})
    assert duplicate.status_code == 409
    assert duplicate.json()["code"] == "duplicate_assignment"

    revoked = client.delete(f"/v1/people/{person.id}/roles/{hr.id}", headers=headers)
    assert revoked.status_code == 200
    assert {role["name"] for role in revoked.json()["roles"]} == {"Finance User"}


def test_assign_forbidden_without_admin(client, db):
    hr_user = create_user(db, upn="hr@contoso.com")
    assign_role(db, hr_user, role_by_name(db, "HR User"))
    person = create_user(db, upn="alex@contoso.com")
    finance = role_by_name(db, "Finance User")
    db.commit()

    response = client.post(
        f"/v1/people/{person.id}/roles",
        headers=auth_header(hr_user),
        json={"roleId": str(finance.id)},
    )
    assert response.status_code == 403


def test_assign_unknown_person_or_role(client, db):
    admin = create_user(db, upn="admin@contoso.com")
    assign_role(db, admin, role_by_name(db, "Entity Admin"))
    finance = role_by_name(db, "Finance User")
    db.commit()
    missing_user = "00000000-0000-4000-8000-000000000099"
    missing_role = "00000000-0000-4000-8000-000000000098"
    headers = auth_header(admin)

    assert client.post(f"/v1/people/{missing_user}/roles", headers=headers, json={"roleId": str(finance.id)}).status_code == 404
    person = create_user(db, upn="alex@contoso.com")
    db.commit()
    assert client.post(f"/v1/people/{person.id}/roles", headers=headers, json={"roleId": missing_role}).status_code == 404


def test_last_admin_cannot_be_revoked(client, db):
    admin = create_user(db, upn="admin@contoso.com")
    entity_admin = role_by_name(db, "Entity Admin")
    assign_role(db, admin, entity_admin)
    assign_role(db, admin, role_by_name(db, "HR User"))
    db.commit()

    response = client.delete(
        f"/v1/people/{admin.id}/roles/{entity_admin.id}",
        headers=auth_header(admin),
    )
    assert response.status_code == 409
    assert response.json()["code"] == "last_admin_required"
