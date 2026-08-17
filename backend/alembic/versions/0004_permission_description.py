"""Add optional description on permissions.

Revision ID: 0004_permission_description
Revises: 0003_user_management
Create Date: 2026-08-17
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0004_permission_description"
down_revision: Union[str, None] = "0003_user_management"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

PERMISSION_DESCRIPTIONS = [
    ("access_administration", "Open Settings and manage people, roles, and assignments."),
    ("finance_landing", "Open the finance landing."),
    ("hr_landing", "Open the HR landing."),
    ("pmo_landing", "Open the PMO landing."),
    (
        "view_sensitive_financial_fields",
        "View cost, margin, and other sensitive financial fields.",
    ),
]


def upgrade() -> None:
    op.add_column("permissions", sa.Column("description", sa.String(512), nullable=True))

    permissions = sa.table(
        "permissions",
        sa.column("code", sa.String()),
        sa.column("description", sa.String()),
    )
    for code, description in PERMISSION_DESCRIPTIONS:
        op.execute(
            permissions.update()
            .where(permissions.c.code == code)
            .values(description=description)
        )


def downgrade() -> None:
    op.drop_column("permissions", "description")
