from __future__ import annotations

import uuid

from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.deps import CurrentUser, require_manage_users
from app.core.errors import (
    already_present,
    duplicate_assignment,
    duplicate_invite,
    last_admin_required,
    not_found,
)
from app.core.invites import attach_invite_roles, find_active_invite, find_user_by_email, load_active_invites
from app.core.permissions import load_assigned_roles, would_remove_last_admin, would_remove_person_leave_last_admin
from app.core.security import revoke_refresh_tokens_for_user
from app.db.session import get_db
from app.models import Invite, InviteRole, RefreshToken, Role, RoleAssignment, User

router = APIRouter()


class AssignRoleRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)
    role_ids: list[uuid.UUID] = Field(alias="roleIds", min_length=1)


class CreateInviteRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)
    email: str
    role_ids: list[uuid.UUID] = Field(default_factory=list, alias="roleIds")


def _role_summary(role: Role) -> dict:
    summary: dict = {"id": str(role.id), "name": role.name}
    if role.description:
        summary["description"] = role.description
    return summary


def _person_payload(db: Session, user: User) -> dict:
    roles = load_assigned_roles(db, user.id)
    payload: dict = {
        "id": str(user.id),
        "personType": "user",
        "email": user.upn,
        "status": "active" if roles else "pending",
        "roles": [_role_summary(role) for role in roles],
    }
    if user.display_name:
        payload["displayName"] = user.display_name
    if user.entry_path:
        payload["entryPath"] = user.entry_path
    return payload


def _invite_payload(db: Session, invite: Invite) -> dict:
    roles = db.scalars(
        select(Role)
        .join(InviteRole, InviteRole.role_id == Role.id)
        .where(InviteRole.invite_id == invite.id)
        .order_by(Role.name)
    ).all()
    return {
        "id": str(invite.id),
        "personType": "invite",
        "email": invite.email,
        "status": "invited",
        "roles": [_role_summary(role) for role in roles],
    }


@router.get("/people")
def list_people(
    _current: CurrentUser = Depends(require_manage_users),
    db: Session = Depends(get_db),
) -> dict:
    users = db.scalars(select(User).order_by(User.display_name, User.upn)).all()
    invites = load_active_invites(db)
    return {
        "people": [_person_payload(db, user) for user in users]
        + [_invite_payload(db, invite) for invite in invites]
    }


@router.post("/people/invites", status_code=201)
def create_invite(
    body: CreateInviteRequest,
    current: CurrentUser = Depends(require_manage_users),
    db: Session = Depends(get_db),
) -> dict:
    email = body.email.strip()
    if find_active_invite(db, email) is not None:
        raise duplicate_invite()
    if find_user_by_email(db, email) is not None:
        raise already_present()

    roles: list[Role] = []
    for role_id in body.role_ids:
        role = db.get(Role, role_id)
        if role is None:
            raise not_found()
        roles.append(role)

    invite = Invite(
        email=email,
        invited_by_user_id=current.user.id,
        created_at=datetime.now(timezone.utc),
    )
    db.add(invite)
    db.flush()
    attach_invite_roles(db, invite, roles)
    loaded = find_active_invite(db, email)
    assert loaded is not None
    return _invite_payload(db, loaded)


@router.post("/people/{userId}/roles")
def assign_role(
    userId: uuid.UUID,
    body: AssignRoleRequest,
    current: CurrentUser = Depends(require_manage_users),
    db: Session = Depends(get_db),
) -> dict:
    user = db.get(User, userId)
    if user is None:
        raise not_found()

    roles: list[Role] = []
    for role_id in body.role_ids:
        role = db.get(Role, role_id)
        if role is None:
            raise not_found()
        roles.append(role)

    for role in roles:
        existing = db.scalars(
            select(RoleAssignment).where(RoleAssignment.user_id == user.id, RoleAssignment.role_id == role.id)
        ).first()
        if existing is not None:
            raise duplicate_assignment()

    for role in roles:
        db.add(
            RoleAssignment(
                user_id=user.id,
                role_id=role.id,
                assigned_by_user_id=current.user.id,
            )
        )
    try:
        db.flush()
    except IntegrityError as exc:
        raise duplicate_assignment() from exc
    return _person_payload(db, user)


@router.delete("/people/{userId}/roles/{roleId}")
def revoke_role(
    userId: uuid.UUID,
    roleId: uuid.UUID,
    _current: CurrentUser = Depends(require_manage_users),
    db: Session = Depends(get_db),
) -> dict:
    user = db.get(User, userId)
    role = db.get(Role, roleId)
    if user is None or role is None:
        raise not_found()

    assignment = db.scalars(
        select(RoleAssignment).where(RoleAssignment.user_id == user.id, RoleAssignment.role_id == role.id)
    ).first()
    if assignment is None:
        raise not_found()

    if would_remove_last_admin(db, user.id, role.id):
        raise last_admin_required()

    db.delete(assignment)
    db.flush()
    return _person_payload(db, user)


def _active_invite_or_404(db: Session, invite_id: uuid.UUID) -> Invite:
    invite = db.get(Invite, invite_id)
    if invite is None or not invite.is_active:
        raise not_found()
    loaded = find_active_invite(db, invite.email)
    if loaded is None:
        raise not_found()
    return loaded


@router.post("/people/invites/{inviteId}/roles")
def assign_invite_role(
    inviteId: uuid.UUID,
    body: AssignRoleRequest,
    _current: CurrentUser = Depends(require_manage_users),
    db: Session = Depends(get_db),
) -> dict:
    invite = _active_invite_or_404(db, inviteId)
    roles: list[Role] = []
    for role_id in body.role_ids:
        role = db.get(Role, role_id)
        if role is None:
            raise not_found()
        roles.append(role)

    for role in roles:
        existing = db.scalars(
            select(InviteRole).where(InviteRole.invite_id == invite.id, InviteRole.role_id == role.id)
        ).first()
        if existing is not None:
            raise duplicate_assignment()

    for role in roles:
        db.add(InviteRole(invite_id=invite.id, role_id=role.id))
    try:
        db.flush()
    except IntegrityError as exc:
        raise duplicate_assignment() from exc
    return _invite_payload(db, invite)


@router.delete("/people/invites/{inviteId}/roles/{roleId}")
def revoke_invite_role(
    inviteId: uuid.UUID,
    roleId: uuid.UUID,
    _current: CurrentUser = Depends(require_manage_users),
    db: Session = Depends(get_db),
) -> dict:
    invite = _active_invite_or_404(db, inviteId)
    role = db.get(Role, roleId)
    if role is None:
        raise not_found()
    link = db.scalars(
        select(InviteRole).where(InviteRole.invite_id == invite.id, InviteRole.role_id == role.id)
    ).first()
    if link is None:
        raise not_found()
    db.delete(link)
    db.flush()
    return _invite_payload(db, invite)


@router.delete("/people/invites/{inviteId}", status_code=204)
def cancel_invite(
    inviteId: uuid.UUID,
    _current: CurrentUser = Depends(require_manage_users),
    db: Session = Depends(get_db),
) -> None:
    invite = _active_invite_or_404(db, inviteId)
    invite.cancelled_at = datetime.now(timezone.utc)
    db.flush()


@router.delete("/people/{userId}", status_code=204)
def remove_person(
    userId: uuid.UUID,
    current: CurrentUser = Depends(require_manage_users),
    db: Session = Depends(get_db),
) -> None:
    user = db.get(User, userId)
    if user is None:
        raise not_found()
    if would_remove_person_leave_last_admin(db, user.id):
        raise last_admin_required()

    for invite in db.scalars(select(Invite).where(Invite.invited_by_user_id == user.id)).all():
        invite.invited_by_user_id = current.user.id
    for assignment in db.scalars(select(RoleAssignment).where(RoleAssignment.assigned_by_user_id == user.id)).all():
        assignment.assigned_by_user_id = None
    db.flush()

    revoke_refresh_tokens_for_user(db, user.id)
    for assignment in db.scalars(select(RoleAssignment).where(RoleAssignment.user_id == user.id)).all():
        db.delete(assignment)
    for token in db.scalars(select(RefreshToken).where(RefreshToken.user_id == user.id)).all():
        db.delete(token)
    db.delete(user)
    db.flush()
