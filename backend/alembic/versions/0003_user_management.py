"""Invite tables, user entry_path, and permission module/action.

Revision ID: 0003_user_management
Revises: 0002_auth_rbac
Create Date: 2026-08-14
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003_user_management"
down_revision: Union[str, None] = "0002_auth_rbac"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

PERMISSION_BACKFILL = [
    ("access_administration", "settings", None),
    ("finance_landing", "finance", None),
    ("hr_landing", "hr", None),
    ("pmo_landing", "pmo", None),
    ("view_sensitive_financial_fields", "finance", "view_sensitive_financial_fields"),
]


def upgrade() -> None:
    op.add_column("users", sa.Column("entry_path", sa.String(32), nullable=True))
    op.add_column("permissions", sa.Column("module", sa.String(64), nullable=True))
    op.add_column("permissions", sa.Column("action", sa.String(128), nullable=True))

    permissions = sa.table(
        "permissions",
        sa.column("code", sa.String()),
        sa.column("module", sa.String()),
        sa.column("action", sa.String()),
    )
    for code, module, action in PERMISSION_BACKFILL:
        op.execute(
            permissions.update()
            .where(permissions.c.code == code)
            .values(module=module, action=action)
        )

    op.alter_column("permissions", "module", existing_type=sa.String(64), nullable=False)

    op.create_table(
        "invites",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("invited_by_user_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_table(
        "invite_roles",
        sa.Column("invite_id", sa.Uuid(), sa.ForeignKey("invites.id"), primary_key=True),
        sa.Column("role_id", sa.Uuid(), sa.ForeignKey("roles.id"), primary_key=True),
        sa.UniqueConstraint("invite_id", "role_id", name="uq_invite_role"),
    )
    op.execute(
        """
        CREATE UNIQUE INDEX uq_invites_active_email
        ON invites (lower(trim(email)))
        WHERE consumed_at IS NULL AND cancelled_at IS NULL
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_invites_active_email")
    op.drop_table("invite_roles")
    op.drop_table("invites")
    op.drop_column("permissions", "action")
    op.drop_column("permissions", "module")
    op.drop_column("users", "entry_path")
