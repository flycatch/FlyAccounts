from tests.conftest import assign_role, auth_header, create_invite, create_user, role_by_name


def test_delete_unused_role(client, db):
    admin = create_user(db, upn="admin@contoso.com")
    assign_role(db, admin, role_by_name(db, "Entity Admin"))
    db.commit()
    headers = auth_header(admin)
    created = client.post("/v1/roles", headers=headers, json={"name": "Temporary"})
    role_id = created.json()["id"]
    deleted = client.delete(f"/v1/roles/{role_id}", headers=headers)
    assert deleted.status_code == 204


def test_delete_role_still_assigned_and_last_admin(client, db):
    admin = create_user(db, upn="admin@contoso.com")
    entity_admin = role_by_name(db, "Entity Admin")
    assign_role(db, admin, entity_admin)
    person = create_user(db, upn="alex@contoso.com")
    hr = role_by_name(db, "HR User")
    assign_role(db, person, hr)
    invite = create_invite(db, email="wait@contoso.com", invited_by=admin, roles=[role_by_name(db, "PMO User")])
    db.commit()
    headers = auth_header(admin)

    assigned = client.delete(f"/v1/roles/{hr.id}", headers=headers)
    assert assigned.status_code == 409
    assert assigned.json()["code"] == "role_still_assigned"

    invited = client.delete(f"/v1/roles/{role_by_name(db, 'PMO User').id}", headers=headers)
    assert invited.status_code == 409
    assert invited.json()["code"] == "role_still_assigned"

    last_admin = client.delete(f"/v1/roles/{entity_admin.id}", headers=headers)
    assert last_admin.status_code == 409
    assert last_admin.json()["code"] == "last_admin_required"

    hr_user = create_user(db, upn="hr@contoso.com")
    assign_role(db, hr_user, hr)
    db.commit()
    assert client.delete(f"/v1/roles/{hr.id}", headers=auth_header(hr_user)).status_code == 403
    _ = invite
