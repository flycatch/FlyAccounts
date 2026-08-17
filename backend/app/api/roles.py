from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.core.deps import CurrentUser, require_manage_roles
from app.core.errors import (
    duplicate_permission,
    duplicate_role_name,
    last_admin_required,
    not_found,
    role_still_assigned,
)
from app.core.permissions import would_delete_role_leave_last_admin, would_detach_leave_last_admin
from app.db.session import get_db
from app.models import Invite, InviteRole, Permission, Role, RoleAssignment, RolePermission

router = APIRouter()


class CreateRoleRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str
    description: str | None = None


class UpdateRoleRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str | None = None
    description: str | None = None


class AttachPermissionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)
    permission_id: uuid.UUID = Field(alias="permissionId")


def permission_payload(permission: Permission) -> dict:
    payload: dict = {
        "id": str(permission.id),
        "name": permission.name,
        "permission": permission.code,
    }
    if permission.description:
        payload["description"] = permission.description
    return payload


def role_payload(role: Role) -> dict:
    permissions = [
        permission_payload(link.permission)
        for link in sorted(role.role_permissions, key=lambda item: item.permission.code)
    ]
    payload: dict = {
        "id": str(role.id),
        "name": role.name,
        "permissions": permissions,
    }
    if role.description:
        payload["description"] = role.description
    return payload


def load_roles_with_permissions(db: Session) -> list[Role]:
    return list(
        db.scalars(
            select(Role)
            .options(selectinload(Role.role_permissions).selectinload(RolePermission.permission))
            .order_by(Role.name)
        ).all()
    )


def load_role(db: Session, role_id: uuid.UUID) -> Role | None:
    return db.scalars(
        select(Role)
        .options(selectinload(Role.role_permissions).selectinload(RolePermission.permission))
        .where(Role.id == role_id)
    ).first()


@router.get("/roles")
def list_roles(
    _current: CurrentUser = Depends(require_manage_roles),
    db: Session = Depends(get_db),
) -> dict:
    return {"roles": [role_payload(role) for role in load_roles_with_permissions(db)]}


@router.post("/roles", status_code=201)
def create_role(
    body: CreateRoleRequest,
    _current: CurrentUser = Depends(require_manage_roles),
    db: Session = Depends(get_db),
) -> dict:
    name = body.name.strip()
    if db.scalars(select(Role).where(Role.name == name)).first() is not None:
        raise duplicate_role_name()
    role = Role(name=name, description=body.description)
    db.add(role)
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise duplicate_role_name() from exc
    db.expire(role)
    loaded = load_role(db, role.id)
    assert loaded is not None
    return role_payload(loaded)


@router.patch("/roles/{roleId}")
def update_role(
    roleId: uuid.UUID,
    body: UpdateRoleRequest,
    _current: CurrentUser = Depends(require_manage_roles),
    db: Session = Depends(get_db),
) -> dict:
    role = load_role(db, roleId)
    if role is None:
        raise not_found()
    if body.name is not None:
        name = body.name.strip()
        other = db.scalars(select(Role).where(Role.name == name, Role.id != role.id)).first()
        if other is not None:
            raise duplicate_role_name()
        role.name = name
    if body.description is not None:
        role.description = body.description
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise duplicate_role_name() from exc
    db.expire(role)
    loaded = load_role(db, role.id)
    assert loaded is not None
    return role_payload(loaded)


@router.post("/roles/{roleId}/permissions")
def attach_permission(
    roleId: uuid.UUID,
    body: AttachPermissionRequest,
    _current: CurrentUser = Depends(require_manage_roles),
    db: Session = Depends(get_db),
) -> dict:
    role = load_role(db, roleId)
    permission = db.get(Permission, body.permission_id)
    if role is None or permission is None:
        raise not_found()
    existing = db.scalars(
        select(RolePermission).where(
            RolePermission.role_id == role.id,
            RolePermission.permission_id == permission.id,
        )
    ).first()
    if existing is not None:
        raise duplicate_permission()
    db.add(RolePermission(role_id=role.id, permission_id=permission.id))
    try:
        db.flush()
    except IntegrityError as exc:
        raise duplicate_permission() from exc
    db.expire(role)
    loaded = load_role(db, role.id)
    assert loaded is not None
    return role_payload(loaded)


@router.delete("/roles/{roleId}/permissions/{permissionId}")
def detach_permission(
    roleId: uuid.UUID,
    permissionId: uuid.UUID,
    _current: CurrentUser = Depends(require_manage_roles),
    db: Session = Depends(get_db),
) -> dict:
    role = load_role(db, roleId)
    permission = db.get(Permission, permissionId)
    if role is None or permission is None:
        raise not_found()
    link = db.scalars(
        select(RolePermission).where(
            RolePermission.role_id == role.id,
            RolePermission.permission_id == permission.id,
        )
    ).first()
    if link is None:
        raise not_found()
    if would_detach_leave_last_admin(db, role.id, permission.id):
        raise last_admin_required()
    db.delete(link)
    db.flush()
    db.expire(role)
    loaded = load_role(db, role.id)
    assert loaded is not None
    return role_payload(loaded)


@router.delete("/roles/{roleId}", status_code=204)
def delete_role(
    roleId: uuid.UUID,
    _current: CurrentUser = Depends(require_manage_roles),
    db: Session = Depends(get_db),
) -> None:
    role = db.get(Role, roleId)
    if role is None:
        raise not_found()
    if would_delete_role_leave_last_admin(db, role.id):
        raise last_admin_required()
    user_assigned = db.scalars(select(RoleAssignment).where(RoleAssignment.role_id == role.id)).first()
    invite_assigned = db.scalars(
        select(InviteRole)
        .join(Invite, Invite.id == InviteRole.invite_id)
        .where(
            InviteRole.role_id == role.id,
            Invite.consumed_at.is_(None),
            Invite.cancelled_at.is_(None),
        )
    ).first()
    if user_assigned is not None or invite_assigned is not None:
        raise role_still_assigned()
    for link in db.scalars(select(RolePermission).where(RolePermission.role_id == role.id)).all():
        db.delete(link)
    db.delete(role)
    db.flush()
