from __future__ import annotations

import uuid
from datetime import datetime, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import get_settings
from app.core.errors import ApiError
from app.core.security import issue_access_token
from app.db.session import get_db
from app.main import app
from app.models import Base, Invite, InviteRole, Permission, Role, RoleAssignment, RolePermission, User

FEATURE_OPENAPI = (
    Path(__file__).resolve().parents[2]
    / "specs"
    / "003-user-management"
    / "contracts"
    / "openapi.yaml"
)

PERMISSION_SEED = [
    (
        "access_administration",
        "Access administration",
        "settings",
        None,
        "Open Settings and manage people, roles, and assignments.",
    ),
    (
        "view_sensitive_financial_fields",
        "View sensitive financial fields",
        "finance",
        "view_sensitive_financial_fields",
        "View cost, margin, and other sensitive financial fields.",
    ),
    ("finance_landing", "Finance landing", "finance", None, "Open the finance landing."),
    ("hr_landing", "HR landing", "hr", None, "Open the HR landing."),
    ("pmo_landing", "PMO landing", "pmo", None, "Open the PMO landing."),
]

ROLE_SEED = [
    ("Entity Admin", "Assign and revoke existing roles", ["access_administration"]),
    (
        "Finance User",
        "Finance landing and sensitive financial fields",
        ["view_sensitive_financial_fields", "finance_landing"],
    ),
    ("HR User", "HR landing", ["hr_landing"]),
    ("PMO User", "PMO landing", ["pmo_landing"]),
]


def seed_rbac(db: Session) -> dict[str, Role]:
    permissions: dict[str, Permission] = {}
    for code, name, module, action, description in PERMISSION_SEED:
        permission = Permission(
            code=code,
            name=name,
            module=module,
            action=action,
            description=description,
        )
        db.add(permission)
        permissions[code] = permission
    db.flush()

    roles: dict[str, Role] = {}
    for name, description, codes in ROLE_SEED:
        role = Role(name=name, description=description)
        db.add(role)
        db.flush()
        for code in codes:
            db.add(RolePermission(role_id=role.id, permission_id=permissions[code].id))
        roles[name] = role
    db.flush()
    return roles


def create_user(
    db: Session,
    *,
    display_name: str = "Alex Example",
    upn: str = "alex@contoso.com",
    microsoft_oid: str | None = None,
    tenant_id: str = "11111111-1111-1111-1111-111111111111",
) -> User:
    user = User(
        microsoft_oid=microsoft_oid or str(uuid.uuid4()),
        tenant_id=tenant_id,
        display_name=display_name,
        upn=upn,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(user)
    db.flush()
    return user


def assign_role(db: Session, user: User, role: Role, assigned_by: User | None = None) -> RoleAssignment:
    assignment = RoleAssignment(
        user_id=user.id,
        role_id=role.id,
        assigned_by_user_id=assigned_by.id if assigned_by else None,
    )
    db.add(assignment)
    db.flush()
    return assignment


def role_by_name(db: Session, name: str) -> Role:
    role = db.scalars(select(Role).where(Role.name == name)).first()
    assert role is not None
    return role


def permission_by_code(db: Session, code: str) -> Permission:
    permission = db.scalars(select(Permission).where(Permission.code == code)).first()
    assert permission is not None
    return permission


def create_invite(
    db: Session,
    *,
    email: str,
    invited_by: User,
    roles: list[Role] | None = None,
) -> Invite:
    invite = Invite(
        email=email,
        invited_by_user_id=invited_by.id,
        created_at=datetime.now(timezone.utc),
    )
    db.add(invite)
    db.flush()
    for role in roles or []:
        db.add(InviteRole(invite_id=invite.id, role_id=role.id))
    db.flush()
    return invite


def active_invite_by_email(db: Session, email: str) -> Invite | None:
    normalized = email.strip().lower()
    invites = db.scalars(
        select(Invite).where(Invite.consumed_at.is_(None), Invite.cancelled_at.is_(None))
    ).all()
    return next((invite for invite in invites if invite.email.strip().lower() == normalized), None)


def auth_header(user: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {issue_access_token(user.id)}"}


@pytest.fixture(autouse=True)
def auth_settings(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("JWT_SIGNING_KEY", "test-signing-key-not-a-secret-32b")
    monkeypatch.setenv("MICROSOFT_TENANT_ID", "11111111-1111-1111-1111-111111111111")
    monkeypatch.setenv("MICROSOFT_CLIENT_ID", "22222222-2222-2222-2222-222222222222")
    monkeypatch.setenv("INITIAL_ADMIN_EMAIL", "admin@contoso.com")
    monkeypatch.setenv("OPENAPI_PATH", str(FEATURE_OPENAPI))
    monkeypatch.setenv("JWT_ACCESS_TTL_SECONDS", "900")
    monkeypatch.setenv("JWT_REFRESH_TTL_SECONDS", "604800")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture
def sqlite_engine():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine, "connect")
    def _fk(dbapi_connection, _connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(engine)
    try:
        yield engine
    finally:
        engine.dispose()


@pytest.fixture
def db(sqlite_engine) -> Session:
    factory = sessionmaker(bind=sqlite_engine, autoflush=False, expire_on_commit=False)
    session = factory()
    seed_rbac(session)
    session.commit()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db: Session) -> TestClient:
    def _override_db():
        try:
            yield db
            db.commit()
        except ApiError:
            db.commit()
            raise
        except Exception:
            db.rollback()
            raise

    app.dependency_overrides[get_db] = _override_db
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()
