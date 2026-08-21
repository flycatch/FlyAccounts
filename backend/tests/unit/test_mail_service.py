from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from app.core.config import Settings
from app.core.mail import MailConfigurationError, MailSendError, MailService


def _settings(**overrides) -> Settings:
    values = {
        "smtp_host": "smtp.example.com",
        "smtp_port": 587,
        "smtp_username": "mailuser",
        "smtp_password": "super-secret-password",
        "smtp_from": "noreply@example.com",
    }
    values.update(overrides)
    return Settings(**values)


def test_send_port_587_uses_starttls():
    client = MagicMock()
    client.__enter__ = MagicMock(return_value=client)
    client.__exit__ = MagicMock(return_value=False)

    with patch("app.core.mail.smtplib.SMTP", return_value=client) as smtp_cls:
        MailService(_settings(smtp_port=587)).send(
            to="invitee@contoso.com",
            subject="You're invited",
            text_body="Open https://app.example/invite?token=abc",
        )

    smtp_cls.assert_called_once_with("smtp.example.com", 587, timeout=30)
    client.starttls.assert_called_once()
    client.login.assert_called_once_with("mailuser", "super-secret-password")
    client.send_message.assert_called_once()


def test_send_port_465_uses_ssl():
    client = MagicMock()
    client.__enter__ = MagicMock(return_value=client)
    client.__exit__ = MagicMock(return_value=False)

    with patch("app.core.mail.smtplib.SMTP_SSL", return_value=client) as ssl_cls:
        with patch("app.core.mail.smtplib.SMTP") as smtp_cls:
            MailService(_settings(smtp_port=465)).send(
                to="invitee@contoso.com",
                subject="You're invited",
                text_body="Body",
            )

    ssl_cls.assert_called_once_with("smtp.example.com", 465, timeout=30)
    smtp_cls.assert_not_called()
    client.starttls.assert_not_called()
    client.login.assert_called_once()
    client.send_message.assert_called_once()


def test_send_missing_host_raises_configuration_error():
    with pytest.raises(MailConfigurationError):
        MailService(_settings(smtp_host="")).send(to="a@b.com", subject="S", text_body="B")


def test_send_missing_from_raises_configuration_error():
    with pytest.raises(MailConfigurationError):
        MailService(_settings(smtp_from="")).send(to="a@b.com", subject="S", text_body="B")


def test_send_smtp_failure_is_sanitized():
    client = MagicMock()
    client.__enter__ = MagicMock(return_value=client)
    client.__exit__ = MagicMock(return_value=False)
    client.starttls.side_effect = OSError("auth failed for mailuser@smtp.example.com with super-secret-password")

    with patch("app.core.mail.smtplib.SMTP", return_value=client):
        with pytest.raises(MailSendError) as exc_info:
            MailService(_settings()).send(to="a@b.com", subject="S", text_body="B")

    message = str(exc_info.value)
    assert "super-secret-password" not in message
    assert "smtp.example.com" not in message
    assert "mailuser" not in message
    assert message == "The email could not be sent."


def test_send_port_1025_without_credentials_skips_tls():
    client = MagicMock()
    client.__enter__ = MagicMock(return_value=client)
    client.__exit__ = MagicMock(return_value=False)

    with patch("app.core.mail.smtplib.SMTP", return_value=client):
        MailService(
            _settings(smtp_port=1025, smtp_username="", smtp_password="")
        ).send(to="a@b.com", subject="S", text_body="B")

    client.starttls.assert_not_called()
    client.login.assert_not_called()
    client.send_message.assert_called_once()
