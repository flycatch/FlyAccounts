"""Add entity-scoped resources table.

Revision ID: 0010_resources
Revises: 0009_clients
Create Date: 2026-08-19
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0010_resources"
down_revision: Union[str, None] = "0010_remove_contract_client"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "resources",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("contract_id", sa.Uuid(), sa.ForeignKey("contracts.id"), nullable=False),
        sa.Column("resource_type", sa.String(32), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("monthly_allocation_percent", sa.Integer(), nullable=False),
        sa.Column("month", sa.Date(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_resources_contract_id", "resources", ["contract_id"])
    op.create_index("ix_resources_contract_id_month", "resources", ["contract_id", "month"])
    op.create_index("ix_resources_name", "resources", ["name"])


def downgrade() -> None:
    op.drop_index("ix_resources_name", table_name="resources")
    op.drop_index("ix_resources_contract_id_month", table_name="resources")
    op.drop_index("ix_resources_contract_id", table_name="resources")
    op.drop_table("resources")
