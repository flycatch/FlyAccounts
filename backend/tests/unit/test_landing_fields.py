from app.core.me import build_me_response
from app.core.permissions import load_assigned_roles, load_combined_permissions
from tests.conftest import assign_role, create_user, role_by_name


def test_sensitive_fields_omitted_from_payload_when_permission_absent(db):
    user = create_user(db)
    assign_role(db, user, role_by_name(db, "HR User"))
    db.commit()
    payload = build_me_response(
        user,
        load_assigned_roles(db, user.id),
        load_combined_permissions(db, user.id),
    )
    assert "sensitiveFinancialFields" not in payload["landing"]
    assert "cost" not in str(payload)
    assert "margin" not in str(payload)


def test_sensitive_fields_present_when_permission_granted(db):
    user = create_user(db)
    assign_role(db, user, role_by_name(db, "Finance User"))
    db.commit()
    payload = build_me_response(
        user,
        load_assigned_roles(db, user.id),
        load_combined_permissions(db, user.id),
    )
    fields = payload["landing"]["sensitiveFinancialFields"]
    assert fields["cost"] == "1000.00"
    assert fields["margin"] == "250.00"
