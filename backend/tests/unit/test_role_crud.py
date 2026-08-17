from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.core.permissions import load_combined_permissions, would_detach_leave_last_admin
from app.models import Role, RolePermission
from tests.conftest import assign_role, create_user, permission_by_code, role_by_name


def test_role_name_and_permission_pair_are_unique(db):
    db.add(Role(name="Entity Admin", description="dup"))
    try:
        db.commit()
        raised = False
    except IntegrityError:
        db.rollback()
        raised = True
    assert raised

    role = Role(name="Custom")
    db.add(role)
    db.flush()
    hr = permission_by_code(db, "hr_landing")
    db.add(RolePermission(role_id=role.id, permission_id=hr.id))
    db.flush()
    db.add(RolePermission(role_id=role.id, permission_id=hr.id))
    try:
        db.commit()
        dup = False
    except IntegrityError:
        db.rollback()
        dup = True
    assert dup


def test_detach_uses_exact_code_not_prefix(db):
    admin = create_user(db, upn="admin@contoso.com")
    custom = Role(name="Mixed")
    db.add(custom)
    db.flush()
    finance = permission_by_code(db, "finance_landing")
    sensitive = permission_by_code(db, "view_sensitive_financial_fields")
    db.add(RolePermission(role_id=custom.id, permission_id=finance.id))
    db.add(RolePermission(role_id=custom.id, permission_id=sensitive.id))
    assign_role(db, admin, custom)
    db.commit()

    link = db.scalars(
        select(RolePermission).where(
            RolePermission.role_id == custom.id,
            RolePermission.permission_id == sensitive.id,
        )
    ).one()
    db.delete(link)
    db.commit()
    assert load_combined_permissions(db, admin.id) == {"finance_landing"}
    assert "view_sensitive_financial_fields" not in load_combined_permissions(db, admin.id)


def test_last_admin_on_detach(db):
    admin = create_user(db, upn="admin@contoso.com")
    entity_admin = role_by_name(db, "Entity Admin")
    assign_role(db, admin, entity_admin)
    access = permission_by_code(db, "access_administration")
    db.commit()
    assert would_detach_leave_last_admin(db, entity_admin.id, access.id) is True
