"""Create proformas table and seed manage_proformas.

Revision ID: 0015_proformas
Revises: 0014_restore_contract_client_id
Create Date: 2026-08-21
"""

from __future__ import annotations

import uuid
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0015_proformas"
down_revision: Union[str, None] = "0014_restore_contract_client_id"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

PERM_MANAGE_PROFORMAS = str(uuid.uuid5(uuid.NAMESPACE_DNS, "flyaccounts.permission.manage_proformas"))
ROLE_SYSTEM_ADMIN = str(uuid.uuid5(uuid.NAMESPACE_DNS, "flyaccounts.role.system_admin"))


def upgrade() -> None:
    op.create_table(
        "proformas",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("entity_id", sa.Uuid(), sa.ForeignKey("legal_entities.id"), nullable=False),
        sa.Column("code", sa.String(32), nullable=False),
        sa.Column("contract_id", sa.Uuid(), sa.ForeignKey("contracts.id"), nullable=False),
        sa.Column("client_name", sa.String(255), nullable=False),
        sa.Column("client_address", sa.Text(), nullable=False),
        sa.Column("client_vat_number", sa.String(128), nullable=False),
        sa.Column("client_email", sa.String(255), nullable=False),
        sa.Column("estimated_amount", sa.String(64), nullable=True),
        sa.Column("currency", sa.String(8), nullable=False),
        sa.Column("valid_until", sa.Date(), nullable=False),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("created_by_user_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("entity_id", "code", name="uq_proformas_entity_code"),
    )
    op.create_index("ix_proformas_entity_id", "proformas", ["entity_id"])
    op.create_index("ix_proformas_contract_id", "proformas", ["contract_id"])

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
                "id": PERM_MANAGE_PROFORMAS,
                "code": "manage_proformas",
                "name": "Manage proformas",
                "module": "proformas",
                "action": None,
                "description": "Open Proformas, create proformas, and download proforma PDFs.",
            },
        ],
    )
    op.bulk_insert(
        role_permissions,
        [
            {"role_id": ROLE_SYSTEM_ADMIN, "permission_id": PERM_MANAGE_PROFORMAS},
        ],
    )


def downgrade() -> None:
    op.execute(
        sa.text(
            "DELETE FROM role_permissions WHERE permission_id IN "
            "(SELECT id FROM permissions WHERE code = 'manage_proformas')"
        )
    )
    op.execute(sa.text("DELETE FROM permissions WHERE code = 'manage_proformas'"))
    op.drop_index("ix_proformas_contract_id", table_name="proformas")
    op.drop_index("ix_proformas_entity_id", table_name="proformas")
    op.drop_table("proformas")
