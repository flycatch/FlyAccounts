from tests.conftest import assign_role, auth_header, create_invite, create_user, role_by_name


def test_invite_assign_adds_without_replacing(client, db):
    admin = create_user(db, upn="admin@contoso.com")
    assign_role(db, admin, role_by_name(db, "Entity Admin"))
    finance = role_by_name(db, "Finance User")
    hr = role_by_name(db, "HR User")
    invite = create_invite(db, email="invitee@contoso.com", invited_by=admin, roles=[finance])
    db.commit()
    headers = auth_header(admin)

    added = client.post(
        f"/v1/people/invites/{invite.id}/roles",
        headers=headers,
        json={"roleId": str(hr.id)},
    )
    assert added.status_code == 200
    assert {role["name"] for role in added.json()["roles"]} == {"Finance User", "HR User"}

    duplicate = client.post(
        f"/v1/people/invites/{invite.id}/roles",
        headers=headers,
        json={"roleId": str(hr.id)},
    )
    assert duplicate.status_code == 409
    assert duplicate.json()["code"] == "duplicate_assignment"

    revoked = client.delete(f"/v1/people/invites/{invite.id}/roles/{hr.id}", headers=headers)
    assert revoked.status_code == 200
    assert {role["name"] for role in revoked.json()["roles"]} == {"Finance User"}


def test_invite_assign_forbidden_and_not_found(client, db):
    admin = create_user(db, upn="admin@contoso.com")
    assign_role(db, admin, role_by_name(db, "Entity Admin"))
    hr_user = create_user(db, upn="hr@contoso.com")
    assign_role(db, hr_user, role_by_name(db, "HR User"))
    invite = create_invite(db, email="invitee@contoso.com", invited_by=admin)
    finance = role_by_name(db, "Finance User")
    db.commit()

    assert (
        client.post(
            f"/v1/people/invites/{invite.id}/roles",
            headers=auth_header(hr_user),
            json={"roleId": str(finance.id)},
        ).status_code
        == 403
    )
    missing = "00000000-0000-4000-8000-000000000098"
    assert (
        client.post(
            f"/v1/people/invites/{missing}/roles",
            headers=auth_header(admin),
            json={"roleId": str(finance.id)},
        ).status_code
        == 404
    )


def test_last_admin_does_not_apply_to_unused_invites(client, db):
    admin = create_user(db, upn="admin@contoso.com")
    entity_admin = role_by_name(db, "Entity Admin")
    assign_role(db, admin, entity_admin)
    invite = create_invite(db, email="future-admin@contoso.com", invited_by=admin, roles=[entity_admin])
    db.commit()

    revoked = client.delete(
        f"/v1/people/invites/{invite.id}/roles/{entity_admin.id}",
        headers=auth_header(admin),
    )
    assert revoked.status_code == 200
    assert revoked.json()["roles"] == []
