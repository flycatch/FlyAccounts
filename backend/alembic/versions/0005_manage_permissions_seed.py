"""Replace demo RBAC seeds with System Admin and manage_* permissions.

Revision ID: 0005_manage_permissions_seed
Revises: 0004_permission_description
Create Date: 2026-08-17
"""

from __future__ import annotations

import uuid
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0005_manage_permissions_seed"
down_revision: Union[str, None] = "0004_permission_description"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

PERM_MANAGE_USERS = str(uuid.uuid5(uuid.NAMESPACE_DNS, "flyaccounts.permission.manage_users"))
PERM_MANAGE_ROLES = str(uuid.uuid5(uuid.NAMESPACE_DNS, "flyaccounts.permission.manage_roles"))
PERM_MANAGE_PERMISSIONS = str(uuid.uuid5(uuid.NAMESPACE_DNS, "flyaccounts.permission.manage_permissions"))
ROLE_SYSTEM_ADMIN = str(uuid.uuid5(uuid.NAMESPACE_DNS, "flyaccounts.role.system_admin"))

NEW_PERMISSIONS = [
    (
        PERM_MANAGE_USERS,
        "manage_users",
        "Manage users",
        "settings",
        "Open Settings → Users and manage people, invites, and role assignments.",
    ),
    (
        PERM_MANAGE_ROLES,
        "manage_roles",
        "Manage roles",
        "settings",
        "Open Settings → Roles and create, edit, or delete roles and attach permissions.",
    ),
    (
        PERM_MANAGE_PERMISSIONS,
        "manage_permissions",
        "Manage permissions",
        "settings",
        "Open Settings → Permissions and view the permission catalog.",
    ),
]


def upgrade() -> None:
    op.execute("DELETE FROM invite_roles")
    op.execute("DELETE FROM role_assignments")
    op.execute("DELETE FROM role_permissions")
    op.execute("DELETE FROM roles")
    op.execute("DELETE FROM permissions")

    permissions = sa.table(
        "permissions",
        sa.column("id", sa.Uuid()),
        sa.column("code", sa.String()),
        sa.column("name", sa.String()),
        sa.column("module", sa.String()),
        sa.column("action", sa.String()),
        sa.column("description", sa.String()),
    )
    roles = sa.table(
        "roles",
        sa.column("id", sa.Uuid()),
        sa.column("name", sa.String()),
        sa.column("description", sa.String()),
    )
    role_permissions = sa.table(
        "role_permissions",
        sa.column("role_id", sa.Uuid()),
        sa.column("permission_id", sa.Uuid()),
    )

    op.bulk_insert(
        permissions,
        [
            {
                "id": perm_id,
                "code": code,
                "name": name,
                "module": module,
                "action": None,
                "description": description,
            }
            for perm_id, code, name, module, description in NEW_PERMISSIONS
        ],
    )
    op.bulk_insert(
        roles,
        [
            {
                "id": ROLE_SYSTEM_ADMIN,
                "name": "System Admin",
                "description": "Manage users, roles, and permissions",
            }
        ],
    )
    op.bulk_insert(
        role_permissions,
        [
            {"role_id": ROLE_SYSTEM_ADMIN, "permission_id": PERM_MANAGE_USERS},
            {"role_id": ROLE_SYSTEM_ADMIN, "permission_id": PERM_MANAGE_ROLES},
            {"role_id": ROLE_SYSTEM_ADMIN, "permission_id": PERM_MANAGE_PERMISSIONS},
        ],
    )


def downgrade() -> None:
    # Irreversible seed replacement; prior demo seeds lived in 0002.
    op.execute("DELETE FROM invite_roles")
    op.execute("DELETE FROM role_assignments")
    op.execute("DELETE FROM role_permissions")
    op.execute("DELETE FROM roles")
    op.execute("DELETE FROM permissions")
