from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import CurrentUser, require_at_least_one_role
from app.db.session import get_db
from app.models import LegalEntity

router = APIRouter()


def entity_payload(entity: LegalEntity) -> dict:
    currencies = entity.allowed_currencies
    if isinstance(currencies, str):
        import json

        currencies = json.loads(currencies)
    return {
        "id": str(entity.id),
        "code": entity.code,
        "name": entity.name,
        "allowedCurrencies": list(currencies),
        "active": entity.active,
    }


@router.get("/entities")
def list_entities(
    _current: CurrentUser = Depends(require_at_least_one_role),
    db: Session = Depends(get_db),
) -> dict:
    entities = list(
        db.scalars(
            select(LegalEntity).where(LegalEntity.active.is_(True)).order_by(LegalEntity.name)
        ).all()
    )
    return {"entities": [entity_payload(entity) for entity in entities]}
