from __future__ import annotations

from app.models import Role, User

SECTION_CATALOG = {
    "finance_landing": ("Finance", "Content allowed by finance_landing."),
    "hr_landing": ("HR", "Content allowed by hr_landing."),
    "pmo_landing": ("PMO", "Content allowed by pmo_landing."),
}

DEMO_COST = "1000.00"
DEMO_MARGIN = "250.00"
VIEW_SENSITIVE = "view_sensitive_financial_fields"


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
    if authorized:
        for code, (title, body) in SECTION_CATALOG.items():
            if code in permissions:
                landing["sections"].append({"code": code, "title": title, "body": body})
        if VIEW_SENSITIVE in permissions:
            landing["sensitiveFinancialFields"] = {"cost": DEMO_COST, "margin": DEMO_MARGIN}

    return {
        "id": str(user.id),
        "displayName": user.display_name,
        "upn": user.upn,
        "roles": [_role_summary(role) for role in roles],
        "permissions": sorted(permissions),
        "landing": landing,
    }
