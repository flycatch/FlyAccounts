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


def _id_token(private_key, oid: str, email: str, name: str) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode(
        {
            "oid": oid,
            "tid": TENANT,
            "iss": f"https://login.microsoftonline.com/{TENANT}/v2.0",
            "aud": CLIENT,
            "preferred_username": email,
            "name": name,
            "iat": int(now.timestamp()),
            "exp": int((now + timedelta(minutes=10)).timestamp()),
        },
        private_key,
        algorithm="RS256",
    )


def test_microsoft_exchange_consumes_matching_invite(monkeypatch):
    from sqlalchemy import select

    from app.models import Invite, Role, User
    from tests.conftest import seed_rbac

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

    engine = get_engine()
    factory = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    session = factory()
    try:
        admin = session.scalars(select(User)).first()
        if admin is None:
            seed_rbac(session)
            from tests.conftest import create_user

            admin = create_user(session, upn="stack-admin@contoso.com")
        finance = session.scalars(select(Role).where(Role.name == "Finance User")).one()
        hr = session.scalars(select(Role).where(Role.name == "HR User"))
        hr_role = hr.first()
        invite = Invite(email="invited-stack@contoso.com", invited_by_user_id=admin.id)
        session.add(invite)
        session.flush()
        from app.models import InviteRole

        session.add(InviteRole(invite_id=invite.id, role_id=finance.id))
        if hr_role is not None:
            session.add(InviteRole(invite_id=invite.id, role_id=hr_role.id))
        session.commit()
    finally:
        session.close()

    client = TestClient(app)
    exchanged = client.post(
        "/v1/auth/microsoft",
        json={"idToken": _id_token(private_key, "stack-oid-invite", "invited-stack@contoso.com", "Invited Stack")},
    )
    assert exchanged.status_code == 200
    user = exchanged.json()["user"]
    assert {role["name"] for role in user["roles"]} >= {"Finance User"}
    assert user["landing"]["accessState"] == "authorized"
    get_settings.cache_clear()


def test_uninvited_org_account_signs_in_pending_and_personal_refused(monkeypatch):
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
    client = TestClient(app)
    exchanged = client.post(
        "/v1/auth/microsoft",
        json={"idToken": _id_token(private_key, "stack-oid-org", "uninvited-stack@contoso.com", "Uninvited")},
    )
    assert exchanged.status_code == 200
    assert exchanged.json()["user"]["landing"]["accessState"] == "pending"
    assert exchanged.json()["user"]["roles"] == []

    personal = jwt.encode(
        {
            "oid": "personal-oid",
            "tid": "9188040d-6c67-4c5b-b112-36a304b66dad",
            "iss": "https://login.microsoftonline.com/9188040d-6c67-4c5b-b112-36a304b66dad/v2.0",
            "aud": CLIENT,
            "preferred_username": "personal@outlook.com",
            "name": "Personal",
            "iat": int(datetime.now(timezone.utc).timestamp()),
            "exp": int((datetime.now(timezone.utc) + timedelta(minutes=10)).timestamp()),
        },
        private_key,
        algorithm="RS256",
    )
    refused = client.post("/v1/auth/microsoft", json={"idToken": personal})
    assert refused.status_code == 401
    assert refused.json()["code"] == "personal_account"
    get_settings.cache_clear()
