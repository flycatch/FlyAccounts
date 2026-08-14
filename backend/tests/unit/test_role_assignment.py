from sqlalchemy import select

from app.core.permissions import would_remove_last_admin
from app.models import RoleAssignment
from tests.conftest import assign_role, create_user, role_by_name


def test_assign_adds_without_replacing(db):
    user = create_user(db)
    assign_role(db, user, role_by_name(db, "HR User"))
    assign_role(db, user, role_by_name(db, "PMO User"))
    db.commit()
    roles = db.scalars(select(RoleAssignment).where(RoleAssignment.user_id == user.id)).all()
    assert len(roles) == 2


def test_duplicate_assignment_unique(db):
    user = create_user(db)
    hr = role_by_name(db, "HR User")
    assign_role(db, user, hr)
    db.commit()
    try:
        assign_role(db, user, hr)
        db.commit()
        raised = False
    except Exception:
        db.rollback()
        raised = True
    assert raised
    remaining = list(db.scalars(select(RoleAssignment).where(RoleAssignment.user_id == user.id)))
    assert len(remaining) == 1


def test_last_admin_uses_combined_permission_not_role_name(db):
    admin = create_user(db, upn="admin@contoso.com")
    other = create_user(db, upn="other@contoso.com")
    entity_admin = role_by_name(db, "Entity Admin")
    assign_role(db, admin, entity_admin)
    assign_role(db, admin, role_by_name(db, "Finance User"))
    db.commit()

    assert would_remove_last_admin(db, admin.id, entity_admin.id) is True
    assign_role(db, other, entity_admin)
    db.commit()
    assert would_remove_last_admin(db, admin.id, entity_admin.id) is False
    assert would_remove_last_admin(db, admin.id, role_by_name(db, "Finance User").id) is False
