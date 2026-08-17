from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.roles import permission_payload
from app.core.deps import CurrentUser, require_access_administration
from app.db.session import get_db
from app.models import Permission

router = APIRouter()


@router.get("/permissions")
def list_permissions(
    _current: CurrentUser = Depends(require_access_administration),
    db: Session = Depends(get_db),
) -> dict:
    permissions = db.scalars(select(Permission).order_by(Permission.module, Permission.code)).all()
    return {"permissions": [permission_payload(permission) for permission in permissions]}
