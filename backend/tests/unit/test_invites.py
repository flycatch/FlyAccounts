from datetime import datetime, timezone

from app.core.invites import find_active_invite, find_user_by_email, normalize_email
from app.models import Invite
from tests.conftest import create_invite, create_user


def test_active_invite_is_unique_on_normalized_email(db):
    admin = create_user(db, upn="admin@contoso.com")
    create_invite(db, email="Pat@Contoso.com", invited_by=admin)
    db.commit()

    assert find_active_invite(db, "pat@contoso.com") is not None
    assert find_active_invite(db, "  PAT@contoso.com ") is not None
    assert normalize_email("  PAT@contoso.com ") == "pat@contoso.com"


def test_already_present_matches_listed_user_upn(db):
    create_user(db, upn="Alex@Contoso.com")
    db.commit()
    assert find_user_by_email(db, "alex@contoso.com") is not None
    assert find_user_by_email(db, "missing@contoso.com") is None


def test_zero_role_invite_is_active(db):
    admin = create_user(db, upn="admin@contoso.com")
    invite = create_invite(db, email="none@contoso.com", invited_by=admin, roles=[])
    db.commit()
    loaded = find_active_invite(db, "none@contoso.com")
    assert loaded is not None
    assert loaded.id == invite.id
    assert loaded.invite_roles == []


def test_consumed_or_cancelled_invite_is_not_active(db):
    admin = create_user(db, upn="admin@contoso.com")
    consumed = create_invite(db, email="done@contoso.com", invited_by=admin)
    consumed.consumed_at = datetime.now(timezone.utc)
    cancelled = Invite(
        email="gone@contoso.com",
        invited_by_user_id=admin.id,
        cancelled_at=datetime.now(timezone.utc),
    )
    db.add(cancelled)
    db.commit()
    assert find_active_invite(db, "done@contoso.com") is None
    assert find_active_invite(db, "gone@contoso.com") is None
    assert find_active_invite(db, "fresh@contoso.com") is None
