from sqlalchemy import select

from app.core.security import hash_refresh_token
from app.models import RefreshToken


def _login(client, monkeypatch, oid: str = "oid-refresh-1") -> dict:
    monkeypatch.setattr(
        "app.api.auth.validate_microsoft_id_token",
        lambda _token: {
            "oid": oid,
            "tid": "11111111-1111-1111-1111-111111111111",
            "name": "Alex Example",
            "preferred_username": "alex@contoso.com",
        },
    )
    response = client.post("/v1/auth/microsoft", json={"idToken": "valid"})
    assert response.status_code == 200
    return response.json()


def test_refresh_returns_new_pair(client, db, monkeypatch):
    first = _login(client, monkeypatch)
    response = client.post("/v1/auth/refresh", json={"refreshToken": first["refreshToken"]})
    assert response.status_code == 200
    body = response.json()
    assert body["accessToken"] != first["accessToken"]
    assert body["refreshToken"] != first["refreshToken"]
    assert body["tokenType"] == "bearer"
    assert set(body["user"].keys()) == {"id", "displayName", "upn", "roles", "permissions", "landing"}


def test_refresh_unknown_token(client):
    response = client.post("/v1/auth/refresh", json={"refreshToken": "does-not-exist"})
    assert response.status_code == 401
    assert response.json()["code"] == "invalid_token"


def test_refresh_reused_token_revokes_family(client, db, monkeypatch):
    first = _login(client, monkeypatch)
    rotated = client.post("/v1/auth/refresh", json={"refreshToken": first["refreshToken"]})
    assert rotated.status_code == 200

    reused = client.post("/v1/auth/refresh", json={"refreshToken": first["refreshToken"]})
    assert reused.status_code == 401
    assert reused.json()["code"] == "invalid_token"

    second = client.post("/v1/auth/refresh", json={"refreshToken": rotated.json()["refreshToken"]})
    assert second.status_code == 401

    family_rows = list(db.scalars(select(RefreshToken)))
    assert family_rows
    assert all(row.revoked_at is not None for row in family_rows)
