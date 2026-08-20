"""Remove client_id from contracts table.

Revision ID: 0011_remove_contract_client
Revises: 0010_resources
Create Date: 2026-08-19
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0011_remove_contract_client"
down_revision: Union[str, None] = "0010_resources"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_contracts_client_id")
    op.execute("ALTER TABLE contracts DROP COLUMN IF EXISTS client_id")


def downgrade() -> None:
    op.add_column(
        "contracts",
        sa.Column("client_id", sa.Uuid(), sa.ForeignKey("clients.id"), nullable=True),
    )
    op.create_index("ix_contracts_client_id", "contracts", ["client_id"])
