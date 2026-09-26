import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import logging
from app.config import settings

logger = logging.getLogger(__name__)


async def send_otp_email(to_email: str, otp: str, company_name: str = "Shelfy IMS") -> bool:
    """
    Sends single-use 6-digit OTP email using SMTP relay (e.g. Gmail).
    """
    if not settings.SMTP_USER or not settings.SMTP_PASS:
        logger.warning(f"[DEV FALLBACK] SMTP not configured. OTP for {to_email} is: {otp}")
        return True

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"[{company_name}] Password Reset Verification Code"
    msg["From"] = settings.SMTP_FROM or settings.SMTP_USER
    msg["To"] = to_email

    text_body = f"Your Shelfy password reset code is: {otp}. It expires in 5 minutes."

    html_body = f"""
    <!DOCTYPE html>
    <html>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; padding: 24px; color: #0f172a;">
        <div style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
          <div style="margin-bottom: 20px;">
            <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #0284c7; background: #e0f2fe; padding: 4px 8px; border-radius: 4px;">
              Security Verification
            </span>
          </div>
          <h2 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 700; color: #0f172a;">Password Reset Code</h2>
          <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #475569;">
            You requested a password reset for your account at <strong>{company_name}</strong>. Enter the 6-digit code below to set a new password.
          </p>
          <div style="background: #f1f5f9; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0; border: 1px dashed #cbd5e1;">
            <span style="font-family: 'SF Mono', Monaco, Consolas, monospace; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #0284c7;">
              {otp}
            </span>
          </div>
          <p style="margin: 0; font-size: 12px; color: #64748b;">
            This single-use code is valid for <strong>5 minutes</strong>. If you did not make this request, please ignore this email.
          </p>
        </div>
      </body>
    </html>
    """

    msg.attach(MIMEText(text_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    try:
        # Use standard smtplib with STARTTLS
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.ehlo()
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASS)
            server.sendmail(msg["From"], [to_email], msg.as_string())

        logger.info(f"OTP email sent successfully to {to_email}")
        return True
    except Exception as e:
        logger.error(f"Failed to deliver SMTP OTP to {to_email}: {e}")
        # Return fallback in dev
        if settings.ENVIRONMENT != "production":
            logger.info(f"[DEV FALLBACK] OTP code for {to_email}: {otp}")
            return True
        raise e
