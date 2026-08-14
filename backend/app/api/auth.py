from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.bootstrap import bootstrap_initial_admin, upsert_user
from app.core.config import get_settings
from app.core.deps import CurrentUser, get_current_user
from app.core.errors import invalid_token
from app.core.me import build_me_response
from app.core.microsoft import validate_microsoft_id_token
from app.core.permissions import load_assigned_roles, load_combined_permissions
from app.core.security import (
    hash_refresh_token,
    issue_access_token,
    persist_refresh_token,
    revoke_refresh_family,
    rotate_refresh_token,
)
from app.db.session import get_db
from app.models import RefreshToken, User

router = APIRouter()


class MicrosoftTokenRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)
    id_token: str = Field(alias="idToken")


class RefreshTokenRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)
    refresh_token: str = Field(alias="refreshToken")


def _token_response(db: Session, user: User, refresh_token: str) -> dict:
    roles = load_assigned_roles(db, user.id)
    permissions = load_combined_permissions(db, user.id)
    return {
        "accessToken": issue_access_token(user.id),
        "refreshToken": refresh_token,
        "tokenType": "bearer",
        "expiresIn": get_settings().jwt_access_ttl_seconds,
        "user": build_me_response(user, roles, permissions),
    }


@router.post("/auth/microsoft")
def exchange_microsoft_token(body: MicrosoftTokenRequest, db: Session = Depends(get_db)) -> dict:
    claims = validate_microsoft_id_token(body.id_token)
    user = upsert_user(db, claims)
    bootstrap_initial_admin(db, user, claims)
    raw_refresh, _row = persist_refresh_token(db, user.id)
    return _token_response(db, user, raw_refresh)


@router.post("/auth/refresh")
def refresh_session(body: RefreshTokenRequest, db: Session = Depends(get_db)) -> dict:
    rotated = rotate_refresh_token(db, body.refresh_token)
    if rotated is None:
        raise invalid_token("Refresh token is not valid.")
    user_id, raw_refresh = rotated
    user = db.get(User, user_id)
    if user is None:
        raise invalid_token("Refresh token is not valid.")
    return _token_response(db, user, raw_refresh)


@router.post("/auth/logout", status_code=204)
def logout(
    body: RefreshTokenRequest,
    _current: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    row = db.scalars(
        select(RefreshToken).where(RefreshToken.token_hash == hash_refresh_token(body.refresh_token))
    ).first()
    if row is not None:
        revoke_refresh_family(db, row.family_id)
    return None
