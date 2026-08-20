"""Placeholder migration.

Revision ID: 0012_dummy
Revises: 0011_remove_contract_client
Create Date: 2026-08-19
"""

from __future__ import annotations

from typing import Sequence, Union

revision: str = "0012_dummy"
down_revision: Union[str, None] = "0011_remove_contract_client"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
