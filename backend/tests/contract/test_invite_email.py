from __future__ import annotations

from app.core.invites import hash_invite_token
from app.core.mail import MailConfigurationError, MailSendError
from tests.conftest import active_invite_by_email, assign_role, auth_header, create_user, role_by_name


def test_create_invite_sends_email_with_token_url(client, db, monkeypatch):
    admin = create_user(db, upn="admin@contoso.com")
    assign_role(db, admin, role_by_name(db, "System Admin"))
    db.commit()
    headers = auth_header(admin)

    sent: dict = {}

    def _capture(self, *, to, subject, text_body):
        sent["to"] = to
        sent["subject"] = subject
        sent["text_body"] = text_body

    monkeypatch.setattr("app.core.mail.MailService.send", _capture)

    response = client.post(
        "/v1/people/invites",
        headers=headers,
        json={"email": "new-invitee@contoso.com"},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["email"] == "new-invitee@contoso.com"
    assert "token" not in body
    assert sent["to"] == "new-invitee@contoso.com"
    assert "http://localhost:8080/invite?token=" in sent["text_body"]

    token_part = sent["text_body"].split("invite?token=")[1].split()[0]
    invite = active_invite_by_email(db, "new-invitee@contoso.com")
    assert invite is not None
    assert invite.token_hash == hash_invite_token(token_part)
    assert invite.token_hash != token_part


def test_create_invite_smtp_failure_rolls_back(client, db, monkeypatch):
    admin = create_user(db, upn="admin@contoso.com")
    assign_role(db, admin, role_by_name(db, "System Admin"))
    db.commit()
    headers = auth_header(admin)

    def _fail(self, **_kwargs):
        raise MailSendError("The email could not be sent.")

    monkeypatch.setattr("app.core.mail.MailService.send", _fail)

    response = client.post(
        "/v1/people/invites",
        headers=headers,
        json={"email": "fail-mail@contoso.com"},
    )
    assert response.status_code == 502
    payload = response.json()
    assert payload["code"] == "invite_email_failed"
    assert payload["message"] == "The invitation email could not be sent."
    assert "test-smtp-password-never-leak" not in str(payload)
    assert "smtp.test.local" not in str(payload)
    assert "test-smtp-user" not in str(payload)

    listed = client.get("/v1/people", headers=headers)
    emails = {person["email"] for person in listed.json()["people"]}
    assert "fail-mail@contoso.com" not in emails


def test_create_invite_smtp_config_missing_rolls_back(client, db, monkeypatch):
    admin = create_user(db, upn="admin@contoso.com")
    assign_role(db, admin, role_by_name(db, "System Admin"))
    db.commit()
    headers = auth_header(admin)

    def _fail_config(self, **_kwargs):
        raise MailConfigurationError("SMTP is not configured.")

    monkeypatch.setattr("app.core.mail.MailService.send", _fail_config)

    response = client.post(
        "/v1/people/invites",
        headers=headers,
        json={"email": "no-smtp@contoso.com"},
    )
    assert response.status_code == 502
    assert response.json()["code"] == "invite_email_failed"

    listed = client.get("/v1/people", headers=headers)
    emails = {person["email"] for person in listed.json()["people"]}
    assert "no-smtp@contoso.com" not in emails
