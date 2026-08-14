from __future__ import annotations

import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone

import jwt
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import RefreshToken

ACCESS_JWT_ALGORITHM = "HS256"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def issue_access_token(user_id: uuid.UUID) -> str:
    settings = get_settings()
    now = _utcnow()
    payload = {
        "sub": str(user_id),
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=settings.jwt_access_ttl_seconds)).timestamp()),
        "jti": str(uuid.uuid4()),
    }
    return jwt.encode(payload, settings.jwt_signing_key, algorithm=ACCESS_JWT_ALGORITHM)


def verify_access_token(token: str) -> uuid.UUID:
    settings = get_settings()
    payload = jwt.decode(token, settings.jwt_signing_key, algorithms=[ACCESS_JWT_ALGORITHM])
    return uuid.UUID(payload["sub"])


def generate_refresh_token() -> str:
    return secrets.token_urlsafe(48)


def hash_refresh_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def persist_refresh_token(
    db: Session,
    user_id: uuid.UUID,
    family_id: uuid.UUID | None = None,
) -> tuple[str, RefreshToken]:
    settings = get_settings()
    raw = generate_refresh_token()
    row = RefreshToken(
        user_id=user_id,
        token_hash=hash_refresh_token(raw),
        family_id=family_id or uuid.uuid4(),
        expires_at=_utcnow() + timedelta(seconds=settings.jwt_refresh_ttl_seconds),
    )
    db.add(row)
    db.flush()
    return raw, row


def revoke_refresh_family(db: Session, family_id: uuid.UUID) -> None:
    now = _utcnow()
    rows = db.scalars(select(RefreshToken).where(RefreshToken.family_id == family_id)).all()
    for row in rows:
        if row.revoked_at is None:
            row.revoked_at = now
    db.flush()


def rotate_refresh_token(db: Session, raw_token: str) -> tuple[uuid.UUID, str] | None:
    token_hash = hash_refresh_token(raw_token)
    row = db.scalars(select(RefreshToken).where(RefreshToken.token_hash == token_hash)).first()
    if row is None:
        return None

    now = _utcnow()
    if row.revoked_at is not None:
        revoke_refresh_family(db, row.family_id)
        return None

    if _as_utc(row.expires_at) <= now:
        return None

    raw_new, replacement = persist_refresh_token(db, row.user_id, family_id=row.family_id)
    row.revoked_at = now
    row.replaced_by_id = replacement.id
    db.flush()
    return row.user_id, raw_new
