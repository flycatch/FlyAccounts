"""Seed manage_clients and manage_resources; attach to System Admin.

Revision ID: 0012_clients_resources_perms
Revises: 0012_dummy
Create Date: 2026-08-19
"""

from __future__ import annotations

import uuid
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0012_clients_resources_perms"
down_revision: Union[str, None] = "0012_dummy"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

PERM_MANAGE_CLIENTS = str(uuid.uuid5(uuid.NAMESPACE_DNS, "flyaccounts.permission.manage_clients"))
PERM_MANAGE_RESOURCES = str(uuid.uuid5(uuid.NAMESPACE_DNS, "flyaccounts.permission.manage_resources"))
ROLE_SYSTEM_ADMIN = str(uuid.uuid5(uuid.NAMESPACE_DNS, "flyaccounts.role.system_admin"))


def upgrade() -> None:
    permissions = sa.table(
        "permissions",
        sa.column("id", sa.Uuid()),
        sa.column("code", sa.String()),
        sa.column("name", sa.String()),
        sa.column("module", sa.String()),
        sa.column("action", sa.String()),
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
                "id": PERM_MANAGE_CLIENTS,
                "code": "manage_clients",
                "name": "Manage clients",
                "module": "clients",
                "action": None,
                "description": "Open Clients and create, view, edit, or delete clients.",
            },
            {
                "id": PERM_MANAGE_RESOURCES,
                "code": "manage_resources",
                "name": "Manage resources",
                "module": "resources",
                "action": None,
                "description": "Open Resources and create, view, edit, or delete resources.",
            },
        ],
    )
    op.bulk_insert(
        role_permissions,
        [
            {"role_id": ROLE_SYSTEM_ADMIN, "permission_id": PERM_MANAGE_CLIENTS},
            {"role_id": ROLE_SYSTEM_ADMIN, "permission_id": PERM_MANAGE_RESOURCES},
        ],
    )


def downgrade() -> None:
    op.execute(
        sa.text(
            "DELETE FROM role_permissions WHERE permission_id IN "
            "(SELECT id FROM permissions WHERE code IN "
            "('manage_clients', 'manage_resources'))"
        )
    )
    op.execute(
        sa.text(
            "DELETE FROM permissions WHERE code IN ('manage_clients', 'manage_resources')"
        )
    )
