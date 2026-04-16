import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

import httpx
from twilio.rest import Client
from twilio.base.exceptions import TwilioException

from ..core.config import settings

logger = logging.getLogger(__name__)

class NotificationService:
    """
    Service responsible for sending notifications via multiple channels.
    Failures are logged but do not raise exceptions to avoid blocking workflows.
    """

    def __init__(self):
        if settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN:
            self.twilio_client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        else:
            self.twilio_client = None
            logger.warning("Twilio credentials not found. SMS/WhatsApp notifications will be disabled.")

    async def notify(self, event_type: str, pa_id: str, recipients: dict, payload: dict):
        """
        Routes notifications to the correct channels based on the event type.
        """
        logger.info(f"Processing notification for event '{event_type}' for PA ID {pa_id}")
        
        message_template = self.get_message_template(event_type, payload)
        if not message_template:
            logger.error(f"No message template found for event type '{event_type}'")
            return

        # Notification Matrix Logic
        if event_type == "pa.submitted":
            if "patient" in recipients:
                await self._send_whatsapp_sms(recipients["patient"].get("phone"), message_template)
            if "hospital" in recipients:
                await self._notify_portal(recipients["hospital"].get("portal_url"), payload)
                await self._send_email(recipients["hospital"].get("email"), f"PA Submitted: {pa_id}", message_template)
        
        elif event_type in ["pa.approved", "pa.denied"]:
            if "patient" in recipients:
                await self._send_whatsapp_sms(recipients["patient"].get("phone"), message_template)
            if "hospital" in recipients:
                await self._notify_portal(recipients["hospital"].get("portal_url"), payload)
            if "tpa" in recipients:
                 await self._send_email(recipients["tpa"].get("email"), f"PA {event_type.split('.')[1].capitalize()}: {pa_id}", message_template)

        elif event_type == "pa.review_required":
            if "patient" in recipients:
                await self._send_whatsapp_sms(recipients["patient"].get("phone"), message_template)
            if "hospital" in recipients:
                await self._notify_portal(recipients["hospital"].get("portal_url"), payload)

        elif event_type == "pa.document_requested":
            if "hospital" in recipients: # Assuming provider email is in hospital recipients
                await self._notify_portal(recipients["hospital"].get("portal_url"), payload)
                await self._send_email(recipients["hospital"].get("email"), f"Documents Requested for PA: {pa_id}", message_template)

    async def _send_whatsapp_sms(self, phone: str, message: str) -> bool:
        """Sends a WhatsApp or SMS message via Twilio."""
        if not self.twilio_client or not phone:
            return False
        
        try:
            self.twilio_client.messages.create(
                body=message,
                from_=settings.TWILIO_FROM_NUMBER,
                to=phone
            )
            logger.info(f"Successfully sent message to {phone}")
            return True
        except TwilioException as e:
            logger.error(f"Failed to send message to {phone}: {e}")
            return False

    async def _send_email(self, to_email: str, subject: str, body: str) -> bool:
        """Sends an HTML email using smtplib."""
        if not to_email or not all([settings.SMTP_HOST, settings.SMTP_PORT, settings.SMTP_USER, settings.SMTP_PASSWORD]):
            logger.warning("SMTP settings or recipient email missing. Email not sent.")
            return False

        msg = MIMEMultipart()
        msg['From'] = settings.SMTP_USER
        msg['To'] = to_email
        msg['Subject'] = subject
        msg.attach(MIMEText(body, 'html'))

        try:
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                server.starttls()
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.send_message(msg)
                logger.info(f"Successfully sent email to {to_email}")
                return True
        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {e}")
            return False

    async def _notify_portal(self, portal_url: str, payload: dict) -> bool:
        """Sends a webhook notification to a hospital portal."""
        if not portal_url:
            return False
            
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(portal_url, json=payload, timeout=10.0)
                response.raise_for_status()
                logger.info(f"Successfully sent portal notification to {portal_url}. Status: {response.status_code}")
                return True
        except httpx.RequestError as e:
            logger.error(f"Failed to send portal notification to {portal_url}: {e}")
            return False

    def get_message_template(self, event_type: str, payload: dict) -> str:
        """Generates a patient-friendly message for a given event."""
        pa_id = payload.get("pa_id", "N/A")
        templates = {
            "pa.submitted": f"Your Prior Authorization request (ID: {pa_id}) has been submitted and is under review. Expected response within 24-48 hours.",
            "pa.approved": f"Your Prior Authorization (ID: {pa_id}) has been APPROVED. Authorization Code: {payload.get('auth_code', 'N/A')}. Valid until: {payload.get('valid_until', 'N/A')}.",
            "pa.denied": f"Your Prior Authorization (ID: {pa_id}) has been reviewed. Additional information is required. Please contact your provider for next steps.",
            "pa.review_required": f"Your Prior Authorization (ID: {pa_id}) is under clinical review. You will be notified within 24 business hours.",
            "pa.document_requested": f"Additional documents are required for your Prior Authorization (ID: {pa_id}). Missing: {', '.join(payload.get('missing_docs', []))}.",
        }
        return templates.get(event_type, "")

