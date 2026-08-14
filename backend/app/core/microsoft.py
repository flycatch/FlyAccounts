from __future__ import annotations

import jwt
from jwt import PyJWKClient

from app.core.config import get_settings
from app.core.errors import invalid_token, personal_account, unknown_tenant

PERSONAL_TENANT_ID = "9188040d-6c67-4c5b-b112-36a304b66dad"


def get_jwks_client() -> PyJWKClient:
    settings = get_settings()
    url = f"https://login.microsoftonline.com/{settings.microsoft_tenant_id}/discovery/v2.0/keys"
    return PyJWKClient(url)


def validate_microsoft_id_token(id_token: str) -> dict:
    try:
        unverified = jwt.decode(id_token, options={"verify_signature": False, "verify_exp": False})
    except jwt.InvalidTokenError as exc:
        raise invalid_token() from exc

    tid = unverified.get("tid")
    issuer = unverified.get("iss") or ""
    if tid == PERSONAL_TENANT_ID or "/consumers" in issuer:
        raise personal_account()

    settings = get_settings()
    if not tid or tid != settings.microsoft_tenant_id:
        raise unknown_tenant()

    try:
        signing_key = get_jwks_client().get_signing_key_from_jwt(id_token)
        claims = jwt.decode(
            id_token,
            signing_key.key,
            algorithms=["RS256"],
            audience=settings.microsoft_client_id,
            issuer=f"https://login.microsoftonline.com/{settings.microsoft_tenant_id}/v2.0",
        )
    except jwt.InvalidTokenError as exc:
        raise invalid_token() from exc

    if not claims.get("oid"):
        raise invalid_token()
    return claims
