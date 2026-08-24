from __future__ import annotations

import uuid
from datetime import date, datetime, timezone

from sqlalchemy import Date, DateTime, ForeignKey, String, Text, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Proforma(Base):
    __tablename__ = "proformas"
    __table_args__ = (UniqueConstraint("entity_id", "code", name="uq_proformas_entity_code"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    entity_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("legal_entities.id"), nullable=False, index=True
    )
    code: Mapped[str] = mapped_column(String(32), nullable=False)
    contract_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("contracts.id"), nullable=False, index=True
    )
    client_name: Mapped[str] = mapped_column(String(255), nullable=False)
    client_address: Mapped[str] = mapped_column(Text(), nullable=False)
    client_vat_number: Mapped[str] = mapped_column(String(128), nullable=False)
    client_email: Mapped[str] = mapped_column(String(255), nullable=False)
    estimated_amount: Mapped[str | None] = mapped_column(String(64), nullable=True)
    currency: Mapped[str] = mapped_column(String(8), nullable=False)
    valid_until: Mapped[date] = mapped_column(Date(), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    created_by_user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_utcnow)

    entity: Mapped["LegalEntity"] = relationship()
    contract: Mapped["Contract"] = relationship()
    created_by: Mapped["User"] = relationship()
