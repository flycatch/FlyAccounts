import jwt
import yaml
from sqlalchemy import select

from app.core.errors import invalid_token, personal_account, unknown_tenant
from app.models import User
from tests.conftest import FEATURE_OPENAPI

TOKEN_FIELDS = {"accessToken", "refreshToken", "tokenType", "expiresIn", "user"}
ME_FIELDS = {"id", "displayName", "upn", "roles", "permissions", "landing"}


def _error_codes() -> set[str]:
    spec = yaml.safe_load(FEATURE_OPENAPI.read_text(encoding="utf-8"))
    return set(spec["components"]["schemas"]["ErrorResponse"]["properties"]["code"]["enum"])


def _claims(**overrides) -> dict:
    base = {
        "oid": "oid-alex-1",
        "tid": "11111111-1111-1111-1111-111111111111",
        "name": "Alex Example",
        "preferred_username": "alex@contoso.com",
    }
    base.update(overrides)
    return base


def test_microsoft_exchange_returns_token_response(client, db, monkeypatch):
    monkeypatch.setattr("app.api.auth.validate_microsoft_id_token", lambda _token: _claims())

    response = client.post("/v1/auth/microsoft", json={"idToken": "valid-id-token"})
    assert response.status_code == 200
    body = response.json()
    assert set(body.keys()) == TOKEN_FIELDS
    assert body["tokenType"] == "bearer"
    assert body["expiresIn"] >= 1
    assert set(body["user"].keys()) == ME_FIELDS
    payload = jwt.decode(body["accessToken"], options={"verify_signature": False})
    assert "roles" not in payload
    assert "permissions" not in payload
    assert db.scalars(select(User)).first() is not None


def test_microsoft_exchange_invalid_token(client, db, monkeypatch):
    monkeypatch.setattr(
        "app.api.auth.validate_microsoft_id_token",
        lambda _token: (_ for _ in ()).throw(invalid_token()),
    )

    response = client.post("/v1/auth/microsoft", json={"idToken": "bad"})
    assert response.status_code == 401
    assert response.json()["code"] == "invalid_token"
    assert response.json()["code"] in _error_codes()
    assert db.scalars(select(User)).first() is None


def test_microsoft_exchange_personal_account(client, db, monkeypatch):
    monkeypatch.setattr(
        "app.api.auth.validate_microsoft_id_token",
        lambda _token: (_ for _ in ()).throw(personal_account()),
    )

    response = client.post("/v1/auth/microsoft", json={"idToken": "personal"})
    assert response.status_code == 401
    assert response.json()["code"] == "personal_account"
    assert db.scalars(select(User)).first() is None


def test_microsoft_exchange_unknown_tenant(client, db, monkeypatch):
    monkeypatch.setattr(
        "app.api.auth.validate_microsoft_id_token",
        lambda _token: (_ for _ in ()).throw(unknown_tenant()),
    )

    response = client.post("/v1/auth/microsoft", json={"idToken": "other-tenant"})
    assert response.status_code == 401
    assert response.json()["code"] == "unknown_tenant"
    assert db.scalars(select(User)).first() is None
