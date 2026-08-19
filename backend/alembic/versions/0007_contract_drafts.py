"""Add draft contracts support: is_draft, nullable step-2+ fields, unique reference.

Revision ID: 0007_contract_drafts
Revises: 0006_contracts_module
Create Date: 2026-08-17
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0007_contract_drafts"
down_revision: Union[str, None] = "0006_contracts_module"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "contracts",
        sa.Column("is_draft", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.add_column("contracts", sa.Column("client_file_name", sa.String(255), nullable=True))
    op.add_column("contracts", sa.Column("client_file_content_type", sa.String(128), nullable=True))
    op.add_column("contracts", sa.Column("client_file_size_bytes", sa.Integer(), nullable=True))

    op.alter_column("contracts", "closure_owner_user_id", existing_type=sa.Uuid(), nullable=True)
    op.alter_column("contracts", "start_date", existing_type=sa.Date(), nullable=True)
    op.alter_column("contracts", "end_date", existing_type=sa.Date(), nullable=True)
    op.alter_column("contracts", "project_status", existing_type=sa.String(length=32), nullable=True)
    op.alter_column("contracts", "payment_type", existing_type=sa.String(length=32), nullable=True)
    op.alter_column("contracts", "resource_type", existing_type=sa.String(length=32), nullable=True)

    # Existing demo/buggy duplicate rows (same entity_id + reference) must be uniquified
    # before the unique constraint can be created.
    op.execute(
        sa.text(
            """
            WITH ranked AS (
                SELECT
                    id,
                    ROW_NUMBER() OVER (
                        PARTITION BY entity_id, reference
                        ORDER BY created_at ASC, id ASC
                    ) AS rn
                FROM contracts
            )
            UPDATE contracts AS c
            SET reference = left(c.reference, 100) || '-' || replace(left(c.id::text, 8), '-', '')
            FROM ranked AS r
            WHERE c.id = r.id
              AND r.rn > 1
            """
        )
    )

    op.create_unique_constraint("uq_contracts_entity_reference", "contracts", ["entity_id", "reference"])


def downgrade() -> None:
    op.drop_constraint("uq_contracts_entity_reference", "contracts", type_="unique")
    op.alter_column("contracts", "resource_type", existing_type=sa.String(length=32), nullable=False)
    op.alter_column("contracts", "payment_type", existing_type=sa.String(length=32), nullable=False)
    op.alter_column("contracts", "project_status", existing_type=sa.String(length=32), nullable=False)
    op.alter_column("contracts", "end_date", existing_type=sa.Date(), nullable=False)
    op.alter_column("contracts", "start_date", existing_type=sa.Date(), nullable=False)
    op.alter_column("contracts", "closure_owner_user_id", existing_type=sa.Uuid(), nullable=False)
    op.drop_column("contracts", "client_file_size_bytes")
    op.drop_column("contracts", "client_file_content_type")
    op.drop_column("contracts", "client_file_name")
    op.drop_column("contracts", "is_draft")
