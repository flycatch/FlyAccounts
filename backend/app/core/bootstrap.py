from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.invites import find_active_invite
from app.core.permissions import ACCESS_ADMINISTRATION, load_combined_permissions
from app.models import Permission, Role, RoleAssignment, RolePermission, User


def upsert_user(db: Session, claims: dict) -> tuple[User, bool]:
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
        return user, True

    user.display_name = display_name
    user.upn = upn
    user.tenant_id = tenant_id
    user.updated_at = now
    db.flush()
    return user, False


def consume_invite(db: Session, user: User, claims: dict) -> bool:
    candidates: list[str] = []
    for key in ("preferred_username", "email"):
        value = claims.get(key)
        if isinstance(value, str) and value.strip():
            candidates.append(value)
    seen: set = set()
    for email in candidates:
        invite = find_active_invite(db, email)
        if invite is None or invite.id in seen:
            continue
        seen.add(invite.id)
        existing = {
            assignment.role_id
            for assignment in db.scalars(select(RoleAssignment).where(RoleAssignment.user_id == user.id)).all()
        }
        for link in invite.invite_roles:
            if link.role_id in existing:
                continue
            db.add(
                RoleAssignment(
                    user_id=user.id,
                    role_id=link.role_id,
                    assigned_by_user_id=invite.invited_by_user_id,
                )
            )
            existing.add(link.role_id)
        invite.consumed_at = datetime.now(timezone.utc)
        user.entry_path = "invite"
        db.flush()
        return True
    return False


def apply_entry_path(user: User, created: bool, consumed: bool) -> None:
    if consumed:
        return
    if created and user.entry_path is None:
        user.entry_path = "organization"


def bootstrap_initial_admin(db: Session, user: User, claims: dict) -> None:
    if ACCESS_ADMINISTRATION in load_combined_permissions(db, user.id):
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
    existing = db.scalars(
        select(RoleAssignment).where(RoleAssignment.user_id == user.id, RoleAssignment.role_id == role.id)
    ).first()
    if existing is not None:
        return
    db.add(RoleAssignment(user_id=user.id, role_id=role.id, assigned_by_user_id=None))
    db.flush()
