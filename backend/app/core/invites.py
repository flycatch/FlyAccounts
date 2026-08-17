from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models import Invite, InviteRole, Role, User


def normalize_email(email: str) -> str:
    return email.strip().lower()


def find_active_invite(db: Session, email: str) -> Invite | None:
    normalized = normalize_email(email)
    return db.scalars(
        select(Invite)
        .options(selectinload(Invite.invite_roles).selectinload(InviteRole.role))
        .where(
            func.lower(func.trim(Invite.email)) == normalized,
            Invite.consumed_at.is_(None),
            Invite.cancelled_at.is_(None),
        )
    ).first()


def find_user_by_email(db: Session, email: str) -> User | None:
    return db.scalars(select(User).where(func.lower(func.trim(User.upn)) == normalize_email(email))).first()


def load_active_invites(db: Session) -> list[Invite]:
    return list(
        db.scalars(
            select(Invite)
            .options(selectinload(Invite.invite_roles).selectinload(InviteRole.role))
            .where(Invite.consumed_at.is_(None), Invite.cancelled_at.is_(None))
            .order_by(Invite.email)
        ).all()
    )


def attach_invite_roles(db: Session, invite: Invite, roles: list[Role]) -> None:
    for role in roles:
        db.add(InviteRole(invite_id=invite.id, role_id=role.id))
    db.flush()
