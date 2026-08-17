from app.core.bootstrap import apply_entry_path, consume_invite, upsert_user
from app.core.permissions import load_assigned_roles

from tests.conftest import create_user


def test_new_user_without_invite_gets_organization_entry(db):
    claims = {
        "oid": "oid-org-1",
        "tid": "11111111-1111-1111-1111-111111111111",
        "name": "Org Person",
        "preferred_username": "org@contoso.com",
    }
    user, created = upsert_user(db, claims)
    consumed = consume_invite(db, user, claims)
    apply_entry_path(user, created, consumed)
    db.commit()

    assert created is True
    assert consumed is False
    assert user.entry_path == "organization"
    assert load_assigned_roles(db, user.id) == []


def test_existing_user_without_invite_keeps_null_entry_path(db):
    existing = create_user(db, upn="old@contoso.com", microsoft_oid="oid-old")
    db.commit()
    claims = {
        "oid": "oid-old",
        "tid": "11111111-1111-1111-1111-111111111111",
        "name": "Old Person",
        "preferred_username": "old@contoso.com",
    }
    user, created = upsert_user(db, claims)
    consumed = consume_invite(db, user, claims)
    apply_entry_path(user, created, consumed)
    db.commit()
    assert created is False
    assert user.entry_path is None
