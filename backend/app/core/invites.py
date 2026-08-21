from __future__ import annotations

import hashlib
import secrets
from urllib.parse import urlencode

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.core.config import get_settings
from app.core.errors import invite_email_failed
from app.core.mail import MailConfigurationError, MailSendError, MailService
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


def generate_invite_token() -> str:
    return secrets.token_urlsafe(32)


def hash_invite_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def build_invite_url(raw_token: str) -> str:
    base = get_settings().public_frontend_url
    query = urlencode({"token": raw_token})
    return f"{base}/invite?{query}"


def send_invite_email(*, to: str, invite_url: str) -> None:
    body = (
        "You have been invited to FlyAccounts.\n\n"
        f"Open this link to continue: {invite_url}\n\n"
        "Sign in with the matching organizational Microsoft work or school account."
    )
    try:
        MailService().send(
            to=to,
            subject="You're invited to FlyAccounts",
            text_body=body,
        )
    except (MailConfigurationError, MailSendError):
        raise invite_email_failed() from None
