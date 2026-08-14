from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.permissions import ACCESS_ADMINISTRATION, load_assigned_roles
from app.models import Permission, Role, RoleAssignment, RolePermission, User


def upsert_user(db: Session, claims: dict) -> User:
    oid = str(claims["oid"])
    tenant_id = str(claims["tid"])
    upn = str(claims.get("preferred_username") or claims.get("email") or oid)
    display_name = str(claims.get("name") or upn)
    now = datetime.now(timezone.utc)

    user = db.scalars(select(User).where(User.microsoft_oid == oid)).first()
    if user is None:
        user = User(
            microsoft_oid=oid,
            tenant_id=tenant_id,
            display_name=display_name,
            upn=upn,
            created_at=now,
            updated_at=now,
        )
        db.add(user)
        db.flush()
        return user

    user.display_name = display_name
    user.upn = upn
    user.tenant_id = tenant_id
    user.updated_at = now
    db.flush()
    return user


def bootstrap_initial_admin(db: Session, user: User, claims: dict) -> None:
    if load_assigned_roles(db, user.id):
        return

    configured = (get_settings().initial_admin_email or "").strip().lower()
    if not configured:
        return

    candidates = []
    for key in ("preferred_username", "email"):
        value = claims.get(key)
        if isinstance(value, str) and value.strip():
            candidates.append(value.strip().lower())
    if configured not in candidates:
        return

    role = db.scalars(
        select(Role)
        .join(RolePermission, RolePermission.role_id == Role.id)
        .join(Permission, Permission.id == RolePermission.permission_id)
        .where(Permission.code == ACCESS_ADMINISTRATION)
    ).first()
    if role is None:
        return
    db.add(RoleAssignment(user_id=user.id, role_id=role.id, assigned_by_user_id=None))
    db.flush()
