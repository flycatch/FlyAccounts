"""Add global clients table and contracts.client_id FK.

Revision ID: 0009_clients
Revises: 0008_contract_soft_delete
Create Date: 2026-08-19
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0009_clients"
down_revision: Union[str, None] = "0008_contract_soft_delete"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "clients",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("address", sa.Text(), nullable=False),
        sa.Column("contact_person", sa.String(255), nullable=False),
        sa.Column("contact_email", sa.String(255), nullable=False),
        sa.Column("contact_phone", sa.String(64), nullable=False),
        sa.Column("vat_number", sa.String(128), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_clients_name", "clients", ["name"], unique=True)
    op.create_index("ix_clients_created_at", "clients", ["created_at"])

    op.add_column(
        "contracts",
        sa.Column("client_id", sa.Uuid(), sa.ForeignKey("clients.id"), nullable=True),
    )
    op.create_index("ix_contracts_client_id", "contracts", ["client_id"])


def downgrade() -> None:
    op.drop_index("ix_contracts_client_id", table_name="contracts")
    op.drop_column("contracts", "client_id")
    op.drop_index("ix_clients_created_at", table_name="clients")
    op.drop_index("ix_clients_name", table_name="clients")
    op.drop_table("clients")
