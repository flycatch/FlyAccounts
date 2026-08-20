from app.core.me import build_me_response
from app.core.permissions import load_assigned_roles, load_combined_permissions
from tests.conftest import assign_role, create_user, role_by_name


def test_landing_has_no_demo_sections_without_module_codes(db):
    user = create_user(db)
    assign_role(db, user, role_by_name(db, "Member"))
    db.commit()
    payload = build_me_response(
        user,
        load_assigned_roles(db, user.id),
        load_combined_permissions(db, user.id),
    )
    assert payload["landing"]["accessState"] == "authorized"
    assert payload["landing"]["sections"] == []
    assert "sensitiveFinancialFields" not in payload["landing"]


def test_system_admin_landing_lists_manage_permissions(db):
    user = create_user(db)
    assign_role(db, user, role_by_name(db, "System Admin"))
    db.commit()
    payload = build_me_response(
        user,
        load_assigned_roles(db, user.id),
        load_combined_permissions(db, user.id),
    )
    assert set(payload["permissions"]) == {
        "manage_users",
        "manage_roles",
        "manage_permissions",
        "manage_clients",
        "manage_resources",
        "manage_contracts",
        "view_contract_financials",
    }
    assert payload["landing"]["sections"] == []
