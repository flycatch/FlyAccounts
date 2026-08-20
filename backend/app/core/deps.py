from __future__ import annotations

from dataclasses import dataclass, field

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

import jwt

from app.core.errors import forbidden, pending_access, unauthorized
from app.core.permissions import (
    MANAGE_CLIENTS,
    MANAGE_CONTRACTS,
    MANAGE_PERMISSIONS,
    MANAGE_RESOURCES,
    MANAGE_ROLES,
    MANAGE_USERS,
    VIEW_CONTRACT_FINANCIALS,
    load_assigned_roles,
    load_combined_permissions,
)
from app.core.security import verify_access_token
from app.db.session import get_db
from app.models import Role, User

_bearer = HTTPBearer(auto_error=False)


@dataclass
class CurrentUser:
    user: User
    permissions: set[str] = field(default_factory=set)
    roles: list[Role] = field(default_factory=list)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> CurrentUser:
    if credentials is None or credentials.scheme.lower() != "bearer" or not credentials.credentials:
        raise unauthorized()
    try:
        user_id = verify_access_token(credentials.credentials)
    except (jwt.InvalidTokenError, ValueError, KeyError):
        raise unauthorized()

    user = db.get(User, user_id)
    if user is None:
        raise unauthorized()

    return CurrentUser(
        user=user,
        permissions=load_combined_permissions(db, user.id),
        roles=load_assigned_roles(db, user.id),
    )


def require_at_least_one_role(current: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    if not current.roles:
        raise pending_access()
    return current


def _require_permission(current: CurrentUser, code: str) -> CurrentUser:
    if code not in current.permissions:
        raise forbidden()
    return current


def require_manage_users(current: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    return _require_permission(current, MANAGE_USERS)


def require_manage_roles(current: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    return _require_permission(current, MANAGE_ROLES)


def require_manage_permissions(current: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    return _require_permission(current, MANAGE_PERMISSIONS)


def require_manage_clients(current: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    return _require_permission(current, MANAGE_CLIENTS)


def require_manage_resources(current: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    return _require_permission(current, MANAGE_RESOURCES)


def require_manage_contracts(current: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    return _require_permission(current, MANAGE_CONTRACTS)


def require_list_contracts(current: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    if MANAGE_CONTRACTS in current.permissions or MANAGE_RESOURCES in current.permissions:
        return current
    raise forbidden()


def require_delete_contracts(current: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    if MANAGE_CONTRACTS not in current.permissions or VIEW_CONTRACT_FINANCIALS not in current.permissions:
        raise forbidden()
    return current

