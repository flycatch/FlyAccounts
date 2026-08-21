from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage

from app.core.config import Settings, get_settings

logger = logging.getLogger(__name__)


class MailConfigurationError(Exception):
    """SMTP is not configured for sending."""


class MailSendError(Exception):
    """Outbound email could not be sent. Message MUST NOT include credentials."""


class MailService:
    """Reusable SMTP mailer. Credentials and host details never appear in raised messages."""

    def __init__(self, settings: Settings | None = None) -> None:
        self._settings = settings or get_settings()

    def send(self, *, to: str, subject: str, text_body: str) -> None:
        host = self._settings.smtp_host.strip()
        from_addr = self._settings.smtp_from.strip()
        if not host or not from_addr:
            raise MailConfigurationError("SMTP is not configured.")

        message = EmailMessage()
        message["From"] = from_addr
        message["To"] = to
        message["Subject"] = subject
        message.set_content(text_body)

        port = self._settings.smtp_port
        username = self._settings.smtp_username.strip()
        password = self._settings.smtp_password

        try:
            if port == 465:
                with smtplib.SMTP_SSL(host, port, timeout=30) as client:
                    self._authenticate(client, username, password)
                    client.send_message(message)
            else:
                with smtplib.SMTP(host, port, timeout=30) as client:
                    if port == 587 or (username and password):
                        client.starttls()
                    self._authenticate(client, username, password)
                    client.send_message(message)
        except MailConfigurationError:
            raise
        except Exception:
            logger.warning("Outbound email could not be sent.")
            raise MailSendError("The email could not be sent.") from None

    @staticmethod
    def _authenticate(client: smtplib.SMTP, username: str, password: str) -> None:
        if username and password:
            client.login(username, password)
