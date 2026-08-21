"""Restore contracts.client_id FK to clients.

Revision ID: 0014_restore_contract_client_id
Revises: 0013_invite_token_hash
Create Date: 2026-08-21
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0014_restore_contract_client_id"
down_revision: Union[str, None] = "0013_invite_token_hash"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "contracts",
        sa.Column("client_id", sa.Uuid(), sa.ForeignKey("clients.id"), nullable=True),
    )
    op.create_index("ix_contracts_client_id", "contracts", ["client_id"])


def downgrade() -> None:
    op.drop_index("ix_contracts_client_id", table_name="contracts")
    op.drop_column("contracts", "client_id")
