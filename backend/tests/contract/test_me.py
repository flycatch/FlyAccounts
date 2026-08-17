import yaml

from tests.conftest import FEATURE_OPENAPI, assign_role, auth_header, create_user, role_by_name


def test_me_unauthorized_without_bearer(client):
    spec = yaml.safe_load(FEATURE_OPENAPI.read_text(encoding="utf-8"))
    response = client.get("/v1/me")
    assert response.status_code == 401
    body = response.json()
    assert body["code"] == "unauthorized"
    assert body["code"] in spec["components"]["schemas"]["ErrorResponse"]["properties"]["code"]["enum"]


def test_me_pending_has_empty_roles_permissions_sections(client, db):
    user = create_user(db, display_name="Alex Example", upn="alex@contoso.com")
    db.commit()

    response = client.get("/v1/me", headers=auth_header(user))
    assert response.status_code == 200
    body = response.json()
    assert body["displayName"] == "Alex Example"
    assert body["upn"] == "alex@contoso.com"
    assert body["roles"] == []
    assert body["permissions"] == []
    assert body["landing"]["accessState"] == "pending"
    assert body["landing"]["sections"] == []
    assert "sensitiveFinancialFields" not in body["landing"]


def test_me_authorized_lists_roles_without_legacy_sections(client, db):
    user = create_user(db, display_name="Alex Example", upn="alex@contoso.com")
    assign_role(db, user, role_by_name(db, "Member"))
    assign_role(db, user, role_by_name(db, "Operator"))
    db.commit()

    response = client.get("/v1/me", headers=auth_header(user))
    assert response.status_code == 200
    body = response.json()
    assert body["landing"]["accessState"] == "authorized"
    assert body["landing"]["sections"] == []
    assert "sensitiveFinancialFields" not in body["landing"]
    assert {role["name"] for role in body["roles"]} == {"Member", "Operator"}
    assert body["permissions"] == []


def test_me_system_admin_has_manage_permissions(client, db):
    user = create_user(db, upn="admin@contoso.com")
    assign_role(db, user, role_by_name(db, "System Admin"))
    db.commit()

    response = client.get("/v1/me", headers=auth_header(user))
    assert response.status_code == 200
    body = response.json()
    assert set(body["permissions"]) == {
        "manage_users",
        "manage_roles",
        "manage_permissions",
    }
    assert body["landing"]["sections"] == []


def test_me_after_consumed_invite_returns_union(client, db):
    from app.core.bootstrap import consume_invite, upsert_user
    from tests.conftest import create_invite

    admin = create_user(db, upn="admin@contoso.com")
    create_invite(
        db,
        email="invited@contoso.com",
        invited_by=admin,
        roles=[role_by_name(db, "Member"), role_by_name(db, "Operator")],
    )
    db.commit()
    claims = {
        "oid": "oid-me-invite",
        "tid": "11111111-1111-1111-1111-111111111111",
        "name": "Invited Person",
        "preferred_username": "invited@contoso.com",
    }
    user, _created = upsert_user(db, claims)
    consume_invite(db, user, claims)
    db.commit()

    response = client.get("/v1/me", headers=auth_header(user))
    assert response.status_code == 200
    body = response.json()
    assert {role["name"] for role in body["roles"]} == {"Member", "Operator"}
    assert body["permissions"] == []
    assert body["landing"]["sections"] == []
