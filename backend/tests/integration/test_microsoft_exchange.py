import os
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings
from app.core.microsoft import validate_microsoft_id_token
from app.db.session import get_engine, reset_engine
from app.main import app

pytestmark = pytest.mark.skipif(
    os.getenv("RUN_STACK_TESTS") != "1",
    reason="Set RUN_STACK_TESTS=1 with Compose Postgres running",
)

TENANT = "11111111-1111-1111-1111-111111111111"
CLIENT = "22222222-2222-2222-2222-222222222222"


def test_microsoft_exchange_and_refresh_with_mocked_jwks(monkeypatch):
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    monkeypatch.setenv("MICROSOFT_TENANT_ID", TENANT)
    monkeypatch.setenv("MICROSOFT_CLIENT_ID", CLIENT)
    get_settings.cache_clear()
    reset_engine()

    monkeypatch.setattr(
        "app.core.microsoft.get_jwks_client",
        lambda: SimpleNamespace(
            get_signing_key_from_jwt=lambda _token: SimpleNamespace(key=private_key.public_key())
        ),
    )

    now = datetime.now(timezone.utc)
    token = jwt.encode(
        {
            "oid": "stack-oid-1",
            "tid": TENANT,
            "iss": f"https://login.microsoftonline.com/{TENANT}/v2.0",
            "aud": CLIENT,
            "preferred_username": "stack@contoso.com",
            "name": "Stack User",
            "iat": int(now.timestamp()),
            "exp": int((now + timedelta(minutes=10)).timestamp()),
        },
        private_key,
        algorithm="RS256",
    )
    assert validate_microsoft_id_token(token)["oid"] == "stack-oid-1"

    client = TestClient(app)
    exchanged = client.post("/v1/auth/microsoft", json={"idToken": token})
    assert exchanged.status_code == 200
    first = exchanged.json()
    refreshed = client.post("/v1/auth/refresh", json={"refreshToken": first["refreshToken"]})
    assert refreshed.status_code == 200
    assert refreshed.json()["refreshToken"] != first["refreshToken"]
    get_settings.cache_clear()
