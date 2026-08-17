from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.roles import permission_payload
from app.core.deps import CurrentUser, require_manage_permissions
from app.db.session import get_db
from app.models import Permission

router = APIRouter()


@router.get("/permissions")
def list_permissions(
    _current: CurrentUser = Depends(require_manage_permissions),
    db: Session = Depends(get_db),
) -> dict:
    permissions = db.scalars(select(Permission).order_by(Permission.module, Permission.code)).all()
    groups: dict[str, list[dict]] = {}
    for permission in permissions:
        groups.setdefault(permission.module, []).append(permission_payload(permission))
    return {
        "modules": [
            {"module": module, "permissions": rows}
            for module, rows in sorted(groups.items(), key=lambda item: item[0])
        ]
    }
