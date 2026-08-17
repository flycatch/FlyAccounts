from __future__ import annotations

from app.models import Role, User


def _role_summary(role: Role) -> dict:
    summary: dict = {"id": str(role.id), "name": role.name}
    if role.description:
        summary["description"] = role.description
    return summary


def build_me_response(user: User, roles: list[Role], permissions: set[str]) -> dict:
    authorized = len(roles) > 0
    landing: dict = {
        "accessState": "authorized" if authorized else "pending",
        "sections": [],
    }

    return {
        "id": str(user.id),
        "displayName": user.display_name,
        "upn": user.upn,
        "roles": [_role_summary(role) for role in roles],
        "permissions": sorted(permissions),
        "landing": landing,
    }
