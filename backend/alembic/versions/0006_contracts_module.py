"""Legal entities and contracts tables; seed Entity A/B/C and contract permissions.

Revision ID: 0006_contracts_module
Revises: 0005_manage_permissions_seed
Create Date: 2026-08-17
"""

from __future__ import annotations

import uuid
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0006_contracts_module"
down_revision: Union[str, None] = "0005_manage_permissions_seed"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

ENTITY_A = str(uuid.uuid5(uuid.NAMESPACE_DNS, "flyaccounts.entity.entity_a"))
ENTITY_B = str(uuid.uuid5(uuid.NAMESPACE_DNS, "flyaccounts.entity.entity_b"))
ENTITY_C = str(uuid.uuid5(uuid.NAMESPACE_DNS, "flyaccounts.entity.entity_c"))

PERM_MANAGE_CONTRACTS = str(uuid.uuid5(uuid.NAMESPACE_DNS, "flyaccounts.permission.manage_contracts"))
PERM_VIEW_CONTRACT_FINANCIALS = str(
    uuid.uuid5(uuid.NAMESPACE_DNS, "flyaccounts.permission.view_contract_financials")
)
ROLE_SYSTEM_ADMIN = str(uuid.uuid5(uuid.NAMESPACE_DNS, "flyaccounts.role.system_admin"))


def upgrade() -> None:
    op.create_table(
        "legal_entities",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("code", sa.String(64), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("allowed_currencies", sa.JSON(), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.UniqueConstraint("code", name="uq_legal_entities_code"),
    )
    op.create_table(
        "contracts",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("entity_id", sa.Uuid(), sa.ForeignKey("legal_entities.id"), nullable=False),
        sa.Column("reference", sa.String(128), nullable=False),
        sa.Column("category", sa.String(64), nullable=False),
        sa.Column("currency", sa.String(8), nullable=False),
        sa.Column("is_amendment", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("parent_contract_id", sa.Uuid(), sa.ForeignKey("contracts.id"), nullable=True),
        sa.Column("closure_owner_user_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("project_status", sa.String(32), nullable=False),
        sa.Column("pmo_note", sa.Text(), nullable=True),
        sa.Column("payment_type", sa.String(32), nullable=False),
        sa.Column("project_value", sa.String(64), nullable=True),
        sa.Column("monthly_rate", sa.String(64), nullable=True),
        sa.Column("months", sa.Integer(), nullable=True),
        sa.Column("resource_type", sa.String(32), nullable=False),
        sa.Column("client_file_key", sa.String(512), nullable=False),
        sa.Column("created_by_user_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_contracts_entity_id", "contracts", ["entity_id"])
    op.create_index("ix_contracts_reference", "contracts", ["reference"])
    op.create_index("ix_contracts_project_status", "contracts", ["project_status"])

    op.create_table(
        "contract_milestones",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("contract_id", sa.Uuid(), sa.ForeignKey("contracts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("value", sa.String(64), nullable=False),
        sa.Column("due_condition_or_date", sa.String(255), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_index("ix_contract_milestones_contract_id", "contract_milestones", ["contract_id"])

    op.create_table(
        "contract_resources",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("contract_id", sa.Uuid(), sa.ForeignKey("contracts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("mode", sa.String(32), nullable=False),
        sa.Column("resource_user_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("resource_name", sa.String(255), nullable=True),
        sa.Column("allocation_percent", sa.Integer(), nullable=True),
        sa.Column("cost_of_resource", sa.String(64), nullable=True),
        sa.Column("vendor_contract_ref", sa.String(255), nullable=True),
        sa.Column("vendor_contract_file_key", sa.String(512), nullable=True),
        sa.Column("monthly_vendor_invoice", sa.String(64), nullable=True),
        sa.Column("monthly_vendor_invoice_file_key", sa.String(512), nullable=True),
        sa.Column("tds_paid_payable", sa.String(64), nullable=True),
        sa.Column("gst_paid_payable", sa.String(64), nullable=True),
    )
    op.create_index("ix_contract_resources_contract_id", "contract_resources", ["contract_id"])

    entities = sa.table(
        "legal_entities",
        sa.column("id", sa.Uuid()),
        sa.column("code", sa.String()),
        sa.column("name", sa.String()),
        sa.column("allowed_currencies", sa.JSON()),
        sa.column("active", sa.Boolean()),
    )
    op.bulk_insert(
        entities,
        [
            {
                "id": ENTITY_A,
                "code": "entity_a",
                "name": "Entity A",
                "allowed_currencies": ["INR", "USD"],
                "active": True,
            },
            {
                "id": ENTITY_B,
                "code": "entity_b",
                "name": "Entity B",
                "allowed_currencies": ["INR", "USD"],
                "active": True,
            },
            {
                "id": ENTITY_C,
                "code": "entity_c",
                "name": "Entity C",
                "allowed_currencies": ["SAR", "USD"],
                "active": True,
            },
        ],
    )

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
                "id": PERM_MANAGE_CONTRACTS,
                "code": "manage_contracts",
                "name": "Manage contracts",
                "module": "contracts",
                "action": None,
                "description": "Open Contracts, list contracts, and create contracts for the active entity.",
            },
            {
                "id": PERM_VIEW_CONTRACT_FINANCIALS,
                "code": "view_contract_financials",
                "name": "View contract financials",
                "module": "contracts",
                "action": None,
                "description": "See contract cost, value, rates, and other money fields.",
            },
        ],
    )
    op.bulk_insert(
        role_permissions,
        [
            {"role_id": ROLE_SYSTEM_ADMIN, "permission_id": PERM_MANAGE_CONTRACTS},
            {"role_id": ROLE_SYSTEM_ADMIN, "permission_id": PERM_VIEW_CONTRACT_FINANCIALS},
        ],
    )


def downgrade() -> None:
    op.execute(
        sa.text(
            "DELETE FROM role_permissions WHERE permission_id IN "
            "(SELECT id FROM permissions WHERE code IN "
            "('manage_contracts', 'view_contract_financials'))"
        )
    )
    op.execute(
        sa.text(
            "DELETE FROM permissions WHERE code IN "
            "('manage_contracts', 'view_contract_financials')"
        )
    )
    op.drop_table("contract_resources")
    op.drop_table("contract_milestones")
    op.drop_table("contracts")
    op.drop_table("legal_entities")
