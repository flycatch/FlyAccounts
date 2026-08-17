from sqlalchemy import select

from app.core.security import hash_refresh_token
from app.models import RefreshToken
from tests.conftest import assign_role, auth_header, create_user, role_by_name


def test_logout_requires_access_jwt(client):
    response = client.post("/v1/auth/logout", json={"refreshToken": "anything"})
    assert response.status_code == 401


def test_logout_revokes_refresh_family(client, db, monkeypatch):
    monkeypatch.setattr(
        "app.api.auth.validate_microsoft_id_token",
        lambda _token: {
            "oid": "oid-logout-1",
            "tid": "11111111-1111-1111-1111-111111111111",
            "name": "Alex Example",
            "preferred_username": "alex@contoso.com",
        },
    )
    login = client.post("/v1/auth/microsoft", json={"idToken": "valid"})
    assert login.status_code == 200
    tokens = login.json()

    response = client.post(
        "/v1/auth/logout",
        headers={"Authorization": f"Bearer {tokens['accessToken']}"},
        json={"refreshToken": tokens["refreshToken"]},
    )
    assert response.status_code == 204

    refresh = client.post("/v1/auth/refresh", json={"refreshToken": tokens["refreshToken"]})
    assert refresh.status_code == 401

    rows = list(db.scalars(select(RefreshToken)))
    assert rows
    assert all(row.revoked_at is not None for row in rows)
    assert hash_refresh_token(tokens["refreshToken"]) in {row.token_hash for row in rows}


def test_logout_authorized_user(client, db):
    user = create_user(db)
    assign_role(db, user, role_by_name(db, "Operator"))
    db.commit()
    response = client.post(
        "/v1/auth/logout",
        headers=auth_header(user),
        json={"refreshToken": "unknown-refresh"},
    )
    assert response.status_code == 204
