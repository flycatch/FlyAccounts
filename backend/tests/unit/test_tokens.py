from datetime import datetime, timedelta, timezone

import jwt
from sqlalchemy import select

from app.core.config import get_settings
from app.core.security import (
    hash_refresh_token,
    issue_access_token,
    persist_refresh_token,
    rotate_refresh_token,
    verify_access_token,
)
from app.models import RefreshToken
from tests.conftest import create_user


def test_access_jwt_omits_roles_and_permissions(db):
    user = create_user(db)
    db.commit()
    token = issue_access_token(user.id)
    payload = jwt.decode(token, get_settings().jwt_signing_key, algorithms=["HS256"])
    assert payload["sub"] == str(user.id)
    assert "roles" not in payload
    assert "permissions" not in payload
    assert verify_access_token(token) == user.id


def test_refresh_rotation(db):
    user = create_user(db)
    raw, row = persist_refresh_token(db, user.id)
    db.commit()

    rotated = rotate_refresh_token(db, raw)
    db.commit()
    assert rotated is not None
    user_id, new_raw = rotated
    assert user_id == user.id
    assert new_raw != raw

    db.refresh(row)
    assert row.revoked_at is not None
    assert row.replaced_by_id is not None


def test_refresh_reuse_revokes_family(db):
    user = create_user(db)
    raw, row = persist_refresh_token(db, user.id)
    db.commit()
    first = rotate_refresh_token(db, raw)
    db.commit()
    assert first is not None

    reused = rotate_refresh_token(db, raw)
    db.commit()
    assert reused is None

    family = list(db.scalars(select(RefreshToken).where(RefreshToken.family_id == row.family_id)))
    assert family
    assert all(member.revoked_at is not None for member in family)
    assert rotate_refresh_token(db, first[1]) is None


def test_expired_refresh_does_not_issue(db):
    user = create_user(db)
    raw, row = persist_refresh_token(db, user.id)
    row.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
    db.commit()
    assert rotate_refresh_token(db, raw) is None
    assert hash_refresh_token(raw) == row.token_hash
