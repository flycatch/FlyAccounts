from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Invite(Base):
    __tablename__ = "invites"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    invited_by_user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_utcnow)
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    invited_by: Mapped["User"] = relationship(
        back_populates="invites_sent",
        foreign_keys=[invited_by_user_id],
    )
    invite_roles: Mapped[list["InviteRole"]] = relationship(back_populates="invite")

    @property
    def is_active(self) -> bool:
        return self.consumed_at is None and self.cancelled_at is None


class InviteRole(Base):
    __tablename__ = "invite_roles"
    __table_args__ = (UniqueConstraint("invite_id", "role_id", name="uq_invite_role"),)

    invite_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("invites.id"), primary_key=True
    )
    role_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("roles.id"), primary_key=True
    )

    invite: Mapped[Invite] = relationship(back_populates="invite_roles")
    role: Mapped["Role"] = relationship(back_populates="invite_roles")
