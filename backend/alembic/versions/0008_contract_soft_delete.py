"""Add soft delete column for contracts.

Revision ID: 0008_contract_soft_delete
Revises: 0007_contract_drafts
Create Date: 2026-08-17
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0008_contract_soft_delete"
down_revision: Union[str, None] = "0007_contract_drafts"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("contracts", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_contracts_deleted_at", "contracts", ["deleted_at"])


def downgrade() -> None:
    op.drop_index("ix_contracts_deleted_at", table_name="contracts")
    op.drop_column("contracts", "deleted_at")
