from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models import Permission, Role, RoleAssignment, RolePermission, User

ACCESS_ADMINISTRATION = "access_administration"


def load_combined_permissions(db: Session, user_id: uuid.UUID) -> set[str]:
    rows = db.scalars(
        select(Permission.code)
        .join(RolePermission, RolePermission.permission_id == Permission.id)
        .join(RoleAssignment, RoleAssignment.role_id == RolePermission.role_id)
        .where(RoleAssignment.user_id == user_id)
    ).all()
    return set(rows)


def load_assigned_roles(db: Session, user_id: uuid.UUID) -> list[Role]:
    return list(
        db.scalars(
            select(Role)
            .join(RoleAssignment, RoleAssignment.role_id == Role.id)
            .where(RoleAssignment.user_id == user_id)
            .order_by(Role.name)
        ).all()
    )


def load_user_assignments(db: Session, user: User) -> list[RoleAssignment]:
    return list(
        db.scalars(
            select(RoleAssignment)
            .options(selectinload(RoleAssignment.role))
            .where(RoleAssignment.user_id == user.id)
        ).all()
    )


def users_with_permission(db: Session, code: str) -> set[uuid.UUID]:
    rows = db.scalars(
        select(RoleAssignment.user_id)
        .join(RolePermission, RolePermission.role_id == RoleAssignment.role_id)
        .join(Permission, Permission.id == RolePermission.permission_id)
        .where(Permission.code == code)
        .distinct()
    ).all()
    return set(rows)


def would_remove_last_admin(db: Session, user_id: uuid.UUID, role_id: uuid.UUID) -> bool:
    current_admins = users_with_permission(db, ACCESS_ADMINISTRATION)
    remaining_codes = set(
        db.scalars(
            select(Permission.code)
            .join(RolePermission, RolePermission.permission_id == Permission.id)
            .join(RoleAssignment, RoleAssignment.role_id == RolePermission.role_id)
            .where(RoleAssignment.user_id == user_id, RoleAssignment.role_id != role_id)
        ).all()
    )
    remaining_admins = set(current_admins)
    if ACCESS_ADMINISTRATION not in remaining_codes:
        remaining_admins.discard(user_id)
    return len(remaining_admins) == 0
