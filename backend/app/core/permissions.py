from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models import Permission, Role, RoleAssignment, RolePermission, User

MANAGE_USERS = "manage_users"
MANAGE_ROLES = "manage_roles"
MANAGE_PERMISSIONS = "manage_permissions"
MANAGE_CLIENTS = "manage_clients"
MANAGE_RESOURCES = "manage_resources"
MANAGE_CONTRACTS = "manage_contracts"
MANAGE_PROFORMAS = "manage_proformas"
VIEW_CONTRACT_FINANCIALS = "view_contract_financials"


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


def _user_codes_excluding(
    db: Session,
    user_id: uuid.UUID,
    *,
    exclude_role_id: uuid.UUID | None = None,
    exclude_role_permission: tuple[uuid.UUID, uuid.UUID] | None = None,
) -> set[str]:
    query = (
        select(Permission.code, RolePermission.role_id, RolePermission.permission_id)
        .join(RolePermission, RolePermission.permission_id == Permission.id)
        .join(RoleAssignment, RoleAssignment.role_id == RolePermission.role_id)
        .where(RoleAssignment.user_id == user_id)
    )
    codes: set[str] = set()
    for code, role_id, permission_id in db.execute(query):
        if exclude_role_id is not None and role_id == exclude_role_id:
            continue
        if exclude_role_permission is not None and (role_id, permission_id) == exclude_role_permission:
            continue
        codes.add(code)
    return codes


def would_remove_last_admin(db: Session, user_id: uuid.UUID, role_id: uuid.UUID) -> bool:
    current_admins = users_with_permission(db, MANAGE_USERS)
    remaining_admins = set(current_admins)
    if MANAGE_USERS not in _user_codes_excluding(db, user_id, exclude_role_id=role_id):
        remaining_admins.discard(user_id)
    return len(remaining_admins) == 0


def would_detach_leave_last_admin(db: Session, role_id: uuid.UUID, permission_id: uuid.UUID) -> bool:
    current_admins = users_with_permission(db, MANAGE_USERS)
    remaining_admins: set[uuid.UUID] = set()
    for admin_id in current_admins:
        remaining = _user_codes_excluding(
            db,
            admin_id,
            exclude_role_permission=(role_id, permission_id),
        )
        if MANAGE_USERS in remaining:
            remaining_admins.add(admin_id)
    return len(remaining_admins) == 0


def would_delete_role_leave_last_admin(db: Session, role_id: uuid.UUID) -> bool:
    current_admins = users_with_permission(db, MANAGE_USERS)
    remaining_admins: set[uuid.UUID] = set()
    for admin_id in current_admins:
        remaining = _user_codes_excluding(db, admin_id, exclude_role_id=role_id)
        if MANAGE_USERS in remaining:
            remaining_admins.add(admin_id)
    return len(remaining_admins) == 0


def would_remove_person_leave_last_admin(db: Session, user_id: uuid.UUID) -> bool:
    current_admins = users_with_permission(db, MANAGE_USERS)
    remaining_admins = set(current_admins)
    remaining_admins.discard(user_id)
    return len(remaining_admins) == 0
