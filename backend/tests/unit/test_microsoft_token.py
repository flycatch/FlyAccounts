from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa

from app.core.errors import ApiError
from app.core.microsoft import PERSONAL_TENANT_ID, validate_microsoft_id_token

TENANT = "11111111-1111-1111-1111-111111111111"
CLIENT = "22222222-2222-2222-2222-222222222222"


@pytest.fixture(scope="module")
def rsa_key():
    return rsa.generate_private_key(public_exponent=65537, key_size=2048)


def _token(private_key, **claims) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "oid": "oid-1",
        "tid": TENANT,
        "iss": f"https://login.microsoftonline.com/{TENANT}/v2.0",
        "aud": CLIENT,
        "preferred_username": "alex@contoso.com",
        "name": "Alex Example",
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=10)).timestamp()),
        **claims,
    }
    return jwt.encode(payload, private_key, algorithm="RS256")


def _mock_jwks(monkeypatch, public_key):
    monkeypatch.setattr(
        "app.core.microsoft.get_jwks_client",
        lambda: SimpleNamespace(get_signing_key_from_jwt=lambda _token: SimpleNamespace(key=public_key)),
    )


def test_valid_organizational_token(rsa_key, monkeypatch):
    _mock_jwks(monkeypatch, rsa_key.public_key())
    monkeypatch.setenv("MICROSOFT_TENANT_ID", TENANT)
    monkeypatch.setenv("MICROSOFT_CLIENT_ID", CLIENT)
    from app.core.config import get_settings

    get_settings.cache_clear()
    claims = validate_microsoft_id_token(_token(rsa_key))
    assert claims["oid"] == "oid-1"
    get_settings.cache_clear()


def test_expired_token(rsa_key, monkeypatch):
    _mock_jwks(monkeypatch, rsa_key.public_key())
    monkeypatch.setenv("MICROSOFT_TENANT_ID", TENANT)
    monkeypatch.setenv("MICROSOFT_CLIENT_ID", CLIENT)
    from app.core.config import get_settings

    get_settings.cache_clear()
    expired = datetime.now(timezone.utc) - timedelta(minutes=5)
    token = _token(rsa_key, exp=int(expired.timestamp()), iat=int((expired - timedelta(minutes=5)).timestamp()))
    with pytest.raises(ApiError) as exc:
        validate_microsoft_id_token(token)
    assert exc.value.code == "invalid_token"
    get_settings.cache_clear()


def test_personal_account_rejected(rsa_key, monkeypatch):
    _mock_jwks(monkeypatch, rsa_key.public_key())
    monkeypatch.setenv("MICROSOFT_TENANT_ID", TENANT)
    monkeypatch.setenv("MICROSOFT_CLIENT_ID", CLIENT)
    from app.core.config import get_settings

    get_settings.cache_clear()
    token = _token(
        rsa_key,
        tid=PERSONAL_TENANT_ID,
        iss=f"https://login.microsoftonline.com/{PERSONAL_TENANT_ID}/v2.0",
    )
    with pytest.raises(ApiError) as exc:
        validate_microsoft_id_token(token)
    assert exc.value.code == "personal_account"
    get_settings.cache_clear()


def test_unknown_tenant_rejected(rsa_key, monkeypatch):
    _mock_jwks(monkeypatch, rsa_key.public_key())
    monkeypatch.setenv("MICROSOFT_TENANT_ID", TENANT)
    monkeypatch.setenv("MICROSOFT_CLIENT_ID", CLIENT)
    from app.core.config import get_settings

    get_settings.cache_clear()
    other = "99999999-9999-9999-9999-999999999999"
    token = _token(rsa_key, tid=other, iss=f"https://login.microsoftonline.com/{other}/v2.0")
    with pytest.raises(ApiError) as exc:
        validate_microsoft_id_token(token)
    assert exc.value.code == "unknown_tenant"
    get_settings.cache_clear()


def test_wrong_audience(rsa_key, monkeypatch):
    _mock_jwks(monkeypatch, rsa_key.public_key())
    monkeypatch.setenv("MICROSOFT_TENANT_ID", TENANT)
    monkeypatch.setenv("MICROSOFT_CLIENT_ID", CLIENT)
    from app.core.config import get_settings

    get_settings.cache_clear()
    with pytest.raises(ApiError) as exc:
        validate_microsoft_id_token(_token(rsa_key, aud="someone-else"))
    assert exc.value.code == "invalid_token"
    get_settings.cache_clear()


def test_garbage_token(monkeypatch):
    monkeypatch.setenv("MICROSOFT_TENANT_ID", TENANT)
    monkeypatch.setenv("MICROSOFT_CLIENT_ID", CLIENT)
    from app.core.config import get_settings

    get_settings.cache_clear()
    with pytest.raises(ApiError) as exc:
        validate_microsoft_id_token("not-a-jwt")
    assert exc.value.code == "invalid_token"
    get_settings.cache_clear()
