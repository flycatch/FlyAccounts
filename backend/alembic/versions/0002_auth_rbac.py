"""Auth and RBAC tables plus seeded permissions and roles.

Revision ID: 0002_auth_rbac
Revises: 0001_baseline
Create Date: 2026-08-14
"""

from __future__ import annotations

import uuid
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002_auth_rbac"
down_revision: Union[str, None] = "0001_baseline"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

PERM_ACCESS_ADMIN = uuid.UUID("aaaaaaaa-0000-4000-8000-000000000001")
PERM_SENSITIVE = uuid.UUID("aaaaaaaa-0000-4000-8000-000000000002")
PERM_FINANCE = uuid.UUID("aaaaaaaa-0000-4000-8000-000000000003")
PERM_HR = uuid.UUID("aaaaaaaa-0000-4000-8000-000000000004")
PERM_PMO = uuid.UUID("aaaaaaaa-0000-4000-8000-000000000005")

ROLE_ENTITY_ADMIN = uuid.UUID("bbbbbbbb-0000-4000-8000-000000000001")
ROLE_FINANCE = uuid.UUID("bbbbbbbb-0000-4000-8000-000000000002")
ROLE_HR = uuid.UUID("bbbbbbbb-0000-4000-8000-000000000003")
ROLE_PMO = uuid.UUID("bbbbbbbb-0000-4000-8000-000000000004")


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("microsoft_oid", sa.String(255), nullable=False),
        sa.Column("tenant_id", sa.String(255), nullable=False),
        sa.Column("display_name", sa.String(255), nullable=False),
        sa.Column("upn", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("microsoft_oid", name="uq_users_microsoft_oid"),
    )
    op.create_table(
        "permissions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("code", sa.String(128), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.UniqueConstraint("code", name="uq_permissions_code"),
    )
    op.create_table(
        "roles",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.String(512), nullable=True),
        sa.UniqueConstraint("name", name="uq_roles_name"),
    )
    op.create_table(
        "role_permissions",
        sa.Column("role_id", sa.Uuid(), sa.ForeignKey("roles.id"), primary_key=True),
        sa.Column("permission_id", sa.Uuid(), sa.ForeignKey("permissions.id"), primary_key=True),
        sa.UniqueConstraint("role_id", "permission_id", name="uq_role_permission"),
    )
    op.create_table(
        "role_assignments",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("role_id", sa.Uuid(), sa.ForeignKey("roles.id"), nullable=False),
        sa.Column("assigned_by_user_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("user_id", "role_id", name="uq_user_role"),
    )
    op.create_table(
        "refresh_tokens",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False),
        sa.Column("family_id", sa.Uuid(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("replaced_by_id", sa.Uuid(), sa.ForeignKey("refresh_tokens.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("token_hash", name="uq_refresh_tokens_hash"),
    )

    permissions = sa.table(
        "permissions",
        sa.column("id", sa.Uuid()),
        sa.column("code", sa.String()),
        sa.column("name", sa.String()),
    )
    roles = sa.table(
        "roles",
        sa.column("id", sa.Uuid()),
        sa.column("name", sa.String()),
        sa.column("description", sa.String()),
    )
    role_permissions = sa.table(
        "role_permissions",
        sa.column("role_id", sa.Uuid()),
        sa.column("permission_id", sa.Uuid()),
    )

    op.bulk_insert(
        permissions,
        [
            {"id": PERM_ACCESS_ADMIN, "code": "access_administration", "name": "Access administration"},
            {
                "id": PERM_SENSITIVE,
                "code": "view_sensitive_financial_fields",
                "name": "View sensitive financial fields",
            },
            {"id": PERM_FINANCE, "code": "finance_landing", "name": "Finance landing"},
            {"id": PERM_HR, "code": "hr_landing", "name": "HR landing"},
            {"id": PERM_PMO, "code": "pmo_landing", "name": "PMO landing"},
        ],
    )
    op.bulk_insert(
        roles,
        [
            {
                "id": ROLE_ENTITY_ADMIN,
                "name": "Entity Admin",
                "description": "Assign and revoke existing roles",
            },
            {
                "id": ROLE_FINANCE,
                "name": "Finance User",
                "description": "Finance landing and sensitive financial fields",
            },
            {"id": ROLE_HR, "name": "HR User", "description": "HR landing"},
            {"id": ROLE_PMO, "name": "PMO User", "description": "PMO landing"},
        ],
    )
    op.bulk_insert(
        role_permissions,
        [
            {"role_id": ROLE_ENTITY_ADMIN, "permission_id": PERM_ACCESS_ADMIN},
            {"role_id": ROLE_FINANCE, "permission_id": PERM_SENSITIVE},
            {"role_id": ROLE_FINANCE, "permission_id": PERM_FINANCE},
            {"role_id": ROLE_HR, "permission_id": PERM_HR},
            {"role_id": ROLE_PMO, "permission_id": PERM_PMO},
        ],
    )


def downgrade() -> None:
    op.drop_table("refresh_tokens")
    op.drop_table("role_assignments")
    op.drop_table("role_permissions")
    op.drop_table("roles")
    op.drop_table("permissions")
    op.drop_table("users")
