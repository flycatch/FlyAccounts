from __future__ import annotations

import uuid
from datetime import date, datetime, timezone

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Contract(Base):
    __tablename__ = "contracts"
    __table_args__ = (UniqueConstraint("entity_id", "reference", name="uq_contracts_entity_reference"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    entity_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("legal_entities.id"), nullable=False
    )
    reference: Mapped[str] = mapped_column(String(128), nullable=False)
    category: Mapped[str] = mapped_column(String(64), nullable=False)
    currency: Mapped[str] = mapped_column(String(8), nullable=False)
    is_amendment: Mapped[bool] = mapped_column(Boolean(), nullable=False, default=False)
    is_draft: Mapped[bool] = mapped_column(Boolean(), nullable=False, default=True)
    parent_contract_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("contracts.id"), nullable=True
    )
    closure_owner_user_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    start_date: Mapped[date | None] = mapped_column(Date(), nullable=True)
    end_date: Mapped[date | None] = mapped_column(Date(), nullable=True)
    project_status: Mapped[str | None] = mapped_column(String(32), nullable=True)
    pmo_note: Mapped[str | None] = mapped_column(Text(), nullable=True)
    payment_type: Mapped[str | None] = mapped_column(String(32), nullable=True)
    project_value: Mapped[str | None] = mapped_column(String(64), nullable=True)
    monthly_rate: Mapped[str | None] = mapped_column(String(64), nullable=True)
    months: Mapped[int | None] = mapped_column(Integer(), nullable=True)
    resource_type: Mapped[str | None] = mapped_column(String(32), nullable=True)
    client_file_key: Mapped[str] = mapped_column(String(512), nullable=False)
    client_file_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    client_file_content_type: Mapped[str | None] = mapped_column(String(128), nullable=True)
    client_file_size_bytes: Mapped[int | None] = mapped_column(Integer(), nullable=True)
    created_by_user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_utcnow)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    entity: Mapped["LegalEntity"] = relationship(back_populates="contracts")
    closure_owner: Mapped["User | None"] = relationship(foreign_keys=[closure_owner_user_id])
    created_by: Mapped["User"] = relationship(foreign_keys=[created_by_user_id])
    milestones: Mapped[list["ContractMilestone"]] = relationship(
        back_populates="contract", cascade="all, delete-orphan"
    )
    resources: Mapped[list["ContractResource"]] = relationship(
        back_populates="contract", cascade="all, delete-orphan"
    )


class ContractMilestone(Base):
    __tablename__ = "contract_milestones"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    contract_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("contracts.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    value: Mapped[str] = mapped_column(String(64), nullable=False)
    due_condition_or_date: Mapped[str] = mapped_column(String(255), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer(), nullable=False, default=0)

    contract: Mapped[Contract] = relationship(back_populates="milestones")


class ContractResource(Base):
    __tablename__ = "contract_resources"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    contract_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("contracts.id", ondelete="CASCADE"), nullable=False
    )
    mode: Mapped[str] = mapped_column(String(32), nullable=False)
    resource_user_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    resource_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    allocation_percent: Mapped[int | None] = mapped_column(Integer(), nullable=True)
    cost_of_resource: Mapped[str | None] = mapped_column(String(64), nullable=True)
    vendor_contract_ref: Mapped[str | None] = mapped_column(String(255), nullable=True)
    vendor_contract_file_key: Mapped[str | None] = mapped_column(String(512), nullable=True)
    monthly_vendor_invoice: Mapped[str | None] = mapped_column(String(64), nullable=True)
    monthly_vendor_invoice_file_key: Mapped[str | None] = mapped_column(String(512), nullable=True)
    tds_paid_payable: Mapped[str | None] = mapped_column(String(64), nullable=True)
    gst_paid_payable: Mapped[str | None] = mapped_column(String(64), nullable=True)

    contract: Mapped[Contract] = relationship(back_populates="resources")
