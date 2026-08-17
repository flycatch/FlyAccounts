from tests.conftest import assign_role, auth_header, create_user, permission_by_code, role_by_name


def test_create_patch_attach_detach_role(client, db):
    admin = create_user(db, upn="admin@contoso.com")
    assign_role(db, admin, role_by_name(db, "System Admin"))
    manage_roles = permission_by_code(db, "manage_roles")
    manage_permissions = permission_by_code(db, "manage_permissions")
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

    attached = client.post(
        f"/v1/roles/{role_id}/permissions",
        headers=headers,
        json={"permissionId": str(manage_roles.id)},
    )
    assert attached.status_code == 200
    client.post(
        f"/v1/roles/{role_id}/permissions",
        headers=headers,
        json={"permissionId": str(manage_permissions.id)},
    )
    again = client.post(
        f"/v1/roles/{role_id}/permissions",
        headers=headers,
        json={"permissionId": str(manage_roles.id)},
    )
    assert again.status_code == 409
    assert again.json()["code"] == "duplicate_permission"

    detached = client.delete(f"/v1/roles/{role_id}/permissions/{manage_permissions.id}", headers=headers)
    assert detached.status_code == 200
    assert {row["permission"] for row in detached.json()["permissions"]} == {"manage_roles"}


def test_role_crud_forbidden_and_last_admin_detach(client, db):
    admin = create_user(db, upn="admin@contoso.com")
    system_admin = role_by_name(db, "System Admin")
    assign_role(db, admin, system_admin)
    member = create_user(db, upn="member@contoso.com")
    assign_role(db, member, role_by_name(db, "Member"))
    access = permission_by_code(db, "manage_users")
    db.commit()

    assert client.post("/v1/roles", headers=auth_header(member), json={"name": "Nope"}).status_code == 403
    detach = client.delete(
        f"/v1/roles/{system_admin.id}/permissions/{access.id}",
        headers=auth_header(admin),
    )
    assert detach.status_code == 409
    assert detach.json()["code"] == "last_admin_required"
