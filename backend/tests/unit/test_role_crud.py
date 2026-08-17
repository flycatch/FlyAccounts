from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.core.permissions import load_combined_permissions, would_detach_leave_last_admin
from app.models import Role, RolePermission
from tests.conftest import assign_role, create_user, permission_by_code, role_by_name


def test_role_name_and_permission_pair_are_unique(db):
    db.add(Role(name="System Admin", description="dup"))
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
    manage_roles = permission_by_code(db, "manage_roles")
    db.add(RolePermission(role_id=role.id, permission_id=manage_roles.id))
    db.flush()
    db.add(RolePermission(role_id=role.id, permission_id=manage_roles.id))
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
    manage_roles = permission_by_code(db, "manage_roles")
    manage_permissions = permission_by_code(db, "manage_permissions")
    db.add(RolePermission(role_id=custom.id, permission_id=manage_roles.id))
    db.add(RolePermission(role_id=custom.id, permission_id=manage_permissions.id))
    assign_role(db, admin, custom)
    db.commit()

    link = db.scalars(
        select(RolePermission).where(
            RolePermission.role_id == custom.id,
            RolePermission.permission_id == manage_permissions.id,
        )
    ).one()
    db.delete(link)
    db.commit()
    assert load_combined_permissions(db, admin.id) == {"manage_roles"}
    assert "manage_permissions" not in load_combined_permissions(db, admin.id)


def test_last_admin_on_detach(db):
    admin = create_user(db, upn="admin@contoso.com")
    system_admin = role_by_name(db, "System Admin")
    assign_role(db, admin, system_admin)
    access = permission_by_code(db, "manage_users")
    db.commit()
    assert would_detach_leave_last_admin(db, system_admin.id, access.id) is True
