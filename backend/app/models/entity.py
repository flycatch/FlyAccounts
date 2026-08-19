from __future__ import annotations

import uuid

from sqlalchemy import Boolean, String, Uuid
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON as GenericJSON

from app.models.base import Base


class LegalEntity(Base):
    __tablename__ = "legal_entities"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    allowed_currencies: Mapped[list] = mapped_column(GenericJSON().with_variant(JSON(), "postgresql"), nullable=False)
    active: Mapped[bool] = mapped_column(Boolean(), nullable=False, default=True)

    contracts: Mapped[list["Contract"]] = relationship(back_populates="entity")
