"""Email adapter: mock when SMTP not configured, else SMTP. Phase 5.7."""

from app.config import settings


def send_email(to: str, subject: str, body_text: str, body_html: str | None = None) -> bool:
    """Send email. Returns True on success. Mock when SMTP_HOST not set."""
    if not settings.smtp_host:
        # Mock: log and succeed
        import logging
        logging.getLogger(__name__).info(
            "Email (mock): to=%s subject=%s", to, subject[:50]
        )
        return True

    try:
        import smtplib
        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.notification_from_email
        msg["To"] = to
        msg.attach(MIMEText(body_text, "plain"))
        if body_html:
            msg.attach(MIMEText(body_html, "html"))

        with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
            if settings.smtp_user and settings.smtp_password:
                server.starttls()
                server.login(settings.smtp_user, settings.smtp_password)
            server.sendmail(settings.notification_from_email, [to], msg.as_string())
        return True
    except Exception as e:
        import logging
        logging.getLogger(__name__).error("Email send failed: %s", e)
        return False
