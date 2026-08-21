"""Add invite token_hash for invitation email links.

Revision ID: 0013_invite_token_hash
Revises: 0012_clients_resources_perms
Create Date: 2026-08-21
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0013_invite_token_hash"
down_revision: Union[str, None] = "0012_clients_resources_perms"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("invites", sa.Column("token_hash", sa.String(64), nullable=True))


def downgrade() -> None:
    op.drop_column("invites", "token_hash")
