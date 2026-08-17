import os

import pytest

from tests.conftest import assign_role, auth_header, create_invite, create_user, role_by_name

pytestmark = pytest.mark.skipif(
    os.getenv("RUN_STACK_TESTS") != "1",
    reason="Set RUN_STACK_TESTS=1 with Compose Postgres running",
)


def test_cancelled_or_removed_email_may_sign_in_and_be_invited_again(client, db):
    admin = create_user(db, upn="admin@contoso.com")
    assign_role(db, admin, role_by_name(db, "System Admin"))
    invite = create_invite(db, email="return@contoso.com", invited_by=admin)
    person = create_user(db, upn="gone@contoso.com")
    db.commit()
    headers = auth_header(admin)

    assert client.delete(f"/v1/people/invites/{invite.id}", headers=headers).status_code == 204
    assert client.delete(f"/v1/people/{person.id}", headers=headers).status_code == 204
    assert client.post("/v1/people/invites", headers=headers, json={"email": "return@contoso.com"}).status_code == 201
    assert client.post("/v1/people/invites", headers=headers, json={"email": "gone@contoso.com"}).status_code == 201
