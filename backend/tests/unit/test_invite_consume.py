from app.core.bootstrap import bootstrap_initial_admin, consume_invite, upsert_user
from app.core.permissions import load_combined_permissions
from app.models import RoleAssignment
from sqlalchemy import select

from tests.conftest import assign_role, create_invite, create_user, role_by_name


def test_consume_invite_copies_roles_case_insensitively(db):
    admin = create_user(db, upn="admin@contoso.com")
    finance = role_by_name(db, "Finance User")
    hr = role_by_name(db, "HR User")
    create_invite(db, email="Pat@Contoso.com", invited_by=admin, roles=[finance, hr])
    db.commit()

    claims = {
        "oid": "oid-invited-1",
        "tid": "11111111-1111-1111-1111-111111111111",
        "name": "Pat Invited",
        "preferred_username": "pat@contoso.com",
    }
    user, _created = upsert_user(db, claims)
    assert consume_invite(db, user, claims) is True
    db.commit()

    assignments = list(db.scalars(select(RoleAssignment).where(RoleAssignment.user_id == user.id)))
    assert {row.role_id for row in assignments} == {finance.id, hr.id}
    assert user.entry_path == "invite"
    assert load_combined_permissions(db, user.id) == {
        "finance_landing",
        "view_sensitive_financial_fields",
        "hr_landing",
    }


def test_consume_invite_skips_duplicate_role_assignments(db):
    admin = create_user(db, upn="admin@contoso.com")
    hr = role_by_name(db, "HR User")
    user = create_user(db, upn="pat@contoso.com", microsoft_oid="oid-invited-2")
    assign_role(db, user, hr)
    create_invite(db, email="pat@contoso.com", invited_by=admin, roles=[hr, role_by_name(db, "PMO User")])
    db.commit()

    consume_invite(db, user, {"preferred_username": "PAT@contoso.com"})
    db.commit()
    assignments = list(db.scalars(select(RoleAssignment).where(RoleAssignment.user_id == user.id)))
    assert len(assignments) == 2
    assert user.entry_path == "invite"


def test_initial_admin_still_runs_after_non_admin_invite(db, monkeypatch):
    monkeypatch.setenv("INITIAL_ADMIN_EMAIL", "admin@contoso.com")
    from app.core.config import get_settings

    get_settings.cache_clear()
    inviter = create_user(db, upn="other-admin@contoso.com")
    create_invite(db, email="admin@contoso.com", invited_by=inviter, roles=[role_by_name(db, "HR User")])
    db.commit()

    claims = {
        "oid": "oid-admin-invite",
        "tid": "11111111-1111-1111-1111-111111111111",
        "name": "Pat Admin",
        "preferred_username": "admin@contoso.com",
    }
    user, _created = upsert_user(db, claims)
    consume_invite(db, user, claims)
    bootstrap_initial_admin(db, user, claims)
    db.commit()
    assert "access_administration" in load_combined_permissions(db, user.id)
    assert "hr_landing" in load_combined_permissions(db, user.id)
    get_settings.cache_clear()
