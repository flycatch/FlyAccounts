from pathlib import Path

import yaml

from tests.conftest import auth_header, assign_role, create_user, role_by_name

FEATURE_OPENAPI = (
    Path(__file__).resolve().parents[3]
    / "specs"
    / "002-microsoft-auth-rbac"
    / "contracts"
    / "openapi.yaml"
)


def _error_codes(spec: dict) -> set[str]:
    return set(spec["components"]["schemas"]["ErrorResponse"]["properties"]["code"]["enum"])


def test_status_unauthorized_without_bearer(client):
    spec = yaml.safe_load(FEATURE_OPENAPI.read_text(encoding="utf-8"))
    response = client.get("/v1/status")
    assert response.status_code == 401
    body = response.json()
    assert body["code"] == "unauthorized"
    assert body["code"] in _error_codes(spec)
    assert "message" in body


def test_status_pending_access_with_no_role_jwt(client, db):
    spec = yaml.safe_load(FEATURE_OPENAPI.read_text(encoding="utf-8"))
    user = create_user(db, upn="pending@contoso.com")
    db.commit()

    response = client.get("/v1/status", headers=auth_header(user))
    assert response.status_code == 403
    body = response.json()
    assert body["code"] == "pending_access"
    assert body["code"] in _error_codes(spec)


def test_status_matches_openapi_contract(client, db, monkeypatch):
    monkeypatch.setattr("app.api.status.check_database", lambda: "ok")
    monkeypatch.setattr("app.api.status.check_storage", lambda: "ok")

    spec = yaml.safe_load(FEATURE_OPENAPI.read_text(encoding="utf-8"))
    schema = spec["components"]["schemas"]["StatusResponse"]
    user = create_user(db, upn="authorized@contoso.com")
    assign_role(db, user, role_by_name(db, "Operator"))
    db.commit()

    response = client.get("/v1/status", headers=auth_header(user))
    assert response.status_code == 200
    body = response.json()

    assert set(schema["required"]) <= set(body.keys())
    assert set(body.keys()) == {"service", "database", "storage"}
    assert body["service"] in schema["properties"]["service"]["enum"]
    assert body["database"] in schema["properties"]["database"]["enum"]
    assert body["storage"] in schema["properties"]["storage"]["enum"]
    assert schema["additionalProperties"] is False
