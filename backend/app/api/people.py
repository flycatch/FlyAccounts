from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.deps import CurrentUser, require_access_administration
from app.core.errors import duplicate_assignment, last_admin_required, not_found
from app.core.permissions import load_assigned_roles, would_remove_last_admin
from app.db.session import get_db
from app.models import Role, RoleAssignment, User

router = APIRouter()


class AssignRoleRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)
    role_id: uuid.UUID = Field(alias="roleId")


def _role_summary(role: Role) -> dict:
    summary: dict = {"id": str(role.id), "name": role.name}
    if role.description:
        summary["description"] = role.description
    return summary


def _person_payload(db: Session, user: User) -> dict:
    return {
        "id": str(user.id),
        "displayName": user.display_name,
        "upn": user.upn,
        "roles": [_role_summary(role) for role in load_assigned_roles(db, user.id)],
    }


@router.get("/people")
def list_people(
    _current: CurrentUser = Depends(require_access_administration),
    db: Session = Depends(get_db),
) -> dict:
    users = db.scalars(select(User).order_by(User.display_name, User.upn)).all()
    return {"people": [_person_payload(db, user) for user in users]}


@router.get("/roles")
def list_roles(
    _current: CurrentUser = Depends(require_access_administration),
    db: Session = Depends(get_db),
) -> dict:
    roles = db.scalars(select(Role).order_by(Role.name)).all()
    return {"roles": [_role_summary(role) for role in roles]}


@router.post("/people/{userId}/roles")
def assign_role(
    userId: uuid.UUID,
    body: AssignRoleRequest,
    current: CurrentUser = Depends(require_access_administration),
    db: Session = Depends(get_db),
) -> dict:
    user = db.get(User, userId)
    role = db.get(Role, body.role_id)
    if user is None or role is None:
        raise not_found()

    existing = db.scalars(
        select(RoleAssignment).where(RoleAssignment.user_id == user.id, RoleAssignment.role_id == role.id)
    ).first()
    if existing is not None:
        raise duplicate_assignment()

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
    _current: CurrentUser = Depends(require_access_administration),
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
