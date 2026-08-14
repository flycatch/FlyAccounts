from sqlalchemy import select

from app.core.bootstrap import bootstrap_initial_admin, upsert_user
from app.core.permissions import load_combined_permissions
from app.models import RoleAssignment


def _claims(**overrides) -> dict:
    base = {
        "oid": "oid-admin-1",
        "tid": "11111111-1111-1111-1111-111111111111",
        "name": "Pat Admin",
        "preferred_username": "admin@contoso.com",
    }
    base.update(overrides)
    return base


def test_initial_admin_match_is_case_insensitive(db, monkeypatch):
    monkeypatch.setenv("INITIAL_ADMIN_EMAIL", "Admin@Contoso.com")
    from app.core.config import get_settings

    get_settings.cache_clear()
    user = upsert_user(db, _claims(preferred_username="ADMIN@contoso.com"))
    bootstrap_initial_admin(db, user, _claims(preferred_username="ADMIN@contoso.com"))
    db.commit()
    assert "access_administration" in load_combined_permissions(db, user.id)
    get_settings.cache_clear()


def test_initial_admin_matches_email_claim(db, monkeypatch):
    monkeypatch.setenv("INITIAL_ADMIN_EMAIL", "admin@contoso.com")
    from app.core.config import get_settings

    get_settings.cache_clear()
    claims = _claims(preferred_username="pat@contoso.com", email="admin@contoso.com")
    user = upsert_user(db, claims)
    bootstrap_initial_admin(db, user, claims)
    db.commit()
    assert "access_administration" in load_combined_permissions(db, user.id)
    get_settings.cache_clear()


def test_initial_admin_assigns_once(db, monkeypatch):
    monkeypatch.setenv("INITIAL_ADMIN_EMAIL", "admin@contoso.com")
    from app.core.config import get_settings

    get_settings.cache_clear()
    claims = _claims()
    user = upsert_user(db, claims)
    bootstrap_initial_admin(db, user, claims)
    bootstrap_initial_admin(db, user, claims)
    db.commit()
    assignments = list(db.scalars(select(RoleAssignment).where(RoleAssignment.user_id == user.id)))
    assert len(assignments) == 1
    get_settings.cache_clear()


def test_no_match_stays_pending(db, monkeypatch):
    monkeypatch.setenv("INITIAL_ADMIN_EMAIL", "admin@contoso.com")
    from app.core.config import get_settings

    get_settings.cache_clear()
    claims = _claims(oid="oid-other", preferred_username="other@contoso.com")
    user = upsert_user(db, claims)
    bootstrap_initial_admin(db, user, claims)
    db.commit()
    assert load_combined_permissions(db, user.id) == set()
    get_settings.cache_clear()
