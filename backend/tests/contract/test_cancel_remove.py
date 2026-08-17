from app.models import RefreshToken
from sqlalchemy import select

from app.core.security import persist_refresh_token
from tests.conftest import assign_role, auth_header, create_invite, create_user, role_by_name


def test_cancel_unused_invite(client, db):
    admin = create_user(db, upn="admin@contoso.com")
    assign_role(db, admin, role_by_name(db, "Entity Admin"))
    invite = create_invite(db, email="cancel-me@contoso.com", invited_by=admin)
    db.commit()
    headers = auth_header(admin)

    cancelled = client.delete(f"/v1/people/invites/{invite.id}", headers=headers)
    assert cancelled.status_code == 204
    people = client.get("/v1/people", headers=headers)
    emails = {person["email"] for person in people.json()["people"]}
    assert "cancel-me@contoso.com" not in emails

    again = client.post("/v1/people/invites", headers=headers, json={"email": "cancel-me@contoso.com"})
    assert again.status_code == 201


def test_remove_person_revokes_refresh_and_last_admin(client, db):
    admin = create_user(db, upn="admin@contoso.com")
    assign_role(db, admin, role_by_name(db, "Entity Admin"))
    person = create_user(db, upn="remove-me@contoso.com")
    persist_refresh_token(db, person.id)
    db.commit()
    headers = auth_header(admin)

    removed = client.delete(f"/v1/people/{person.id}", headers=headers)
    assert removed.status_code == 204
    tokens = list(db.scalars(select(RefreshToken).where(RefreshToken.user_id == person.id)))
    assert tokens == [] or all(token.revoked_at is not None for token in tokens)

    last = client.delete(f"/v1/people/{admin.id}", headers=headers)
    assert last.status_code == 409
    assert last.json()["code"] == "last_admin_required"
