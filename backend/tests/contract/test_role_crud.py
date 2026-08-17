from tests.conftest import assign_role, auth_header, create_user, permission_by_code, role_by_name


def test_create_patch_attach_detach_role(client, db):
    admin = create_user(db, upn="admin@contoso.com")
    assign_role(db, admin, role_by_name(db, "Entity Admin"))
    hr = permission_by_code(db, "hr_landing")
    pmo = permission_by_code(db, "pmo_landing")
    db.commit()
    headers = auth_header(admin)

    created = client.post("/v1/roles", headers=headers, json={"name": "Ops", "description": "Operations"})
    assert created.status_code == 201
    role_id = created.json()["id"]
    assert created.json()["permissions"] == []

    duplicate = client.post("/v1/roles", headers=headers, json={"name": "Ops"})
    assert duplicate.status_code == 409
    assert duplicate.json()["code"] == "duplicate_role_name"

    patched = client.patch(f"/v1/roles/{role_id}", headers=headers, json={"name": "Operations", "description": "Updated"})
    assert patched.status_code == 200
    assert patched.json()["name"] == "Operations"

    attached = client.post(f"/v1/roles/{role_id}/permissions", headers=headers, json={"permissionId": str(hr.id)})
    assert attached.status_code == 200
    client.post(f"/v1/roles/{role_id}/permissions", headers=headers, json={"permissionId": str(pmo.id)})
    again = client.post(f"/v1/roles/{role_id}/permissions", headers=headers, json={"permissionId": str(hr.id)})
    assert again.status_code == 409
    assert again.json()["code"] == "duplicate_permission"

    detached = client.delete(f"/v1/roles/{role_id}/permissions/{pmo.id}", headers=headers)
    assert detached.status_code == 200
    assert {row["code"] for row in detached.json()["permissions"]} == {"hr_landing"}


def test_role_crud_forbidden_and_last_admin_detach(client, db):
    admin = create_user(db, upn="admin@contoso.com")
    entity_admin = role_by_name(db, "Entity Admin")
    assign_role(db, admin, entity_admin)
    hr_user = create_user(db, upn="hr@contoso.com")
    assign_role(db, hr_user, role_by_name(db, "HR User"))
    access = permission_by_code(db, "access_administration")
    db.commit()

    assert client.post("/v1/roles", headers=auth_header(hr_user), json={"name": "Nope"}).status_code == 403
    detach = client.delete(
        f"/v1/roles/{entity_admin.id}/permissions/{access.id}",
        headers=auth_header(admin),
    )
    assert detach.status_code == 409
    assert detach.json()["code"] == "last_admin_required"
