import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
from app.config import settings
import logging

logger = logging.getLogger(__name__)


async def send_email(
    recipient: str,
    subject: str,
    body_html: str,
    body_text: Optional[str] = None,
) -> bool:
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        logger.warning("SMTP not configured, skipping email send")
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.SMTP_FROM
    msg["To"] = recipient

    if body_text:
        msg.attach(MIMEText(body_text, "plain", "utf-8"))
    msg.attach(MIMEText(body_html, "html", "utf-8"))

    try:
        await aiosmtplib.send(
            msg,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USER,
            password=settings.SMTP_PASSWORD,
            start_tls=True,
        )
        logger.info(f"Email sent to {recipient}: {subject}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {recipient}: {e}")
        return False


async def send_payment_reminder(
    recipient: str,
    customer_name: str,
    invoice_number: str,
    amount: float,
    due_date: str,
    level: int,
    company_name: str,
) -> bool:
    level_texts = {
        1: ("Zahlungserinnerung", "freundlich darauf hinweisen"),
        2: ("1. Mahnung", "mahnen"),
        3: ("2. Mahnung - Letzte Aufforderung", "letztmalig auffordern"),
    }
    level_subject, level_action = level_texts.get(level, ("Zahlungserinnerung", "erinnern"))

    subject = f"{level_subject}: Rechnung {invoice_number} - {company_name}"
    body_html = f"""
    <html>
    <body style="font-family: Arial, sans-serif; color: #333;">
        <h2>{level_subject}</h2>
        <p>Sehr geehrte Damen und Herren,</p>
        <p>wir möchten Sie {level_action}, dass folgende Rechnung noch nicht beglichen wurde:</p>
        <table style="border-collapse: collapse; width: 100%; margin: 20px 0;">
            <tr style="background: #f5f5f5;">
                <td style="padding: 10px; border: 1px solid #ddd;">Rechnungsnummer</td>
                <td style="padding: 10px; border: 1px solid #ddd;"><strong>{invoice_number}</strong></td>
            </tr>
            <tr>
                <td style="padding: 10px; border: 1px solid #ddd;">Betrag</td>
                <td style="padding: 10px; border: 1px solid #ddd;"><strong>{amount:.2f} €</strong></td>
            </tr>
            <tr style="background: #f5f5f5;">
                <td style="padding: 10px; border: 1px solid #ddd;">Fälligkeitsdatum</td>
                <td style="padding: 10px; border: 1px solid #ddd;"><strong>{due_date}</strong></td>
            </tr>
        </table>
        <p>Bitte überweisen Sie den ausstehenden Betrag umgehend auf unser Konto.</p>
        <p>Mit freundlichen Grüßen,<br><strong>{company_name}</strong></p>
    </body>
    </html>
    """
    return await send_email(recipient, subject, body_html)


async def send_feedback_response(
    recipient: str,
    user_name: str,
    feedback_title: str,
    admin_response: str,
    status: str,
) -> bool:
    status_text = "genehmigt" if status == "approved" else "abgelehnt"
    subject = f"Antwort auf Ihr Feedback: {feedback_title}"
    body_html = f"""
    <html>
    <body style="font-family: Arial, sans-serif; color: #333;">
        <h2>Antwort auf Ihr Feedback</h2>
        <p>Sehr geehrte/r {user_name},</p>
        <p>Ihr Feedback "<strong>{feedback_title}</strong>" wurde <strong>{status_text}</strong>.</p>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Antwort des Administrators:</strong></p>
            <p>{admin_response}</p>
        </div>
        <p>Vielen Dank für Ihr Feedback!</p>
        <p>Mit freundlichen Grüßen,<br><strong>HandwerkerBrief Team</strong></p>
    </body>
    </html>
    """
    return await send_email(recipient, subject, body_html)
