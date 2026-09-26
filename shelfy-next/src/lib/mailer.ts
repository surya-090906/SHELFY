import nodemailer, { Transporter } from 'nodemailer';

let transporter: Transporter | null = null;

export function getTransporter(): Transporter {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    console.warn('[Shelfy Mailer] SMTP credentials not fully provided; using mock/fallback transport.');
    transporter = nodemailer.createTransport({
      streamTransport: true,
      newline: 'windows',
      buffer: true,
    });
    return transporter;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
  });

  return transporter;
}

export interface SendOtpOptions {
  toEmail: string;
  otp: string;
  purpose: 'password_reset' | 'signup_verification';
  companyName?: string;
}

export async function sendOtpEmail({
  toEmail,
  otp,
  purpose,
  companyName = 'Shelfy IMS',
}: SendOtpOptions): Promise<{ success: boolean; messageId?: string }> {
  const mailer = getTransporter();
  const from = process.env.SMTP_FROM || `"Shelfy Security" <${process.env.SMTP_USER || 'noreply@shelfy.local'}>`;
  const isReset = purpose === 'password_reset';

  const subject = isReset
    ? `[${companyName}] Password Reset Verification Code`
    : `[${companyName}] Confirm Your Email`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #0f172a; }
          .container { max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
          .header { display: flex; align-items: center; gap: 8px; margin-bottom: 24px; }
          .badge { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #0284c7; background: #e0f2fe; padding: 4px 8px; border-radius: 4px; }
          h2 { margin: 12px 0 8px 0; font-size: 20px; font-weight: 700; color: #0f172a; }
          p { margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #475569; }
          .otp-box { background: #f1f5f9; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0; border: 1px dashed #cbd5e1; }
          .otp-code { font-family: 'SF Mono', Monaco, Menlo, Consolas, monospace; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #0284c7; }
          .footer { margin-top: 24px; padding-top: 16px; border-top: 1px solid #f1f5f9; font-size: 12px; color: #94a3b8; line-height: 1.5; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <span class="badge">Security Verification</span>
          </div>
          <h2>${isReset ? 'Reset Your Account Password' : 'Verify Your Email Address'}</h2>
          <p>
            ${isReset
              ? `You requested a password reset for your account at <strong>${companyName}</strong>. Enter the 6-digit code below to proceed.`
              : `Welcome to <strong>${companyName}</strong>. Please enter the verification code below to verify your email.`
            }
          </p>
          <div class="otp-box">
            <div class="otp-code">${otp}</div>
          </div>
          <p>This single-use code is valid for <strong>5 minutes</strong>. If you did not make this request, you can safely ignore this email.</p>
          <div class="footer">
            Shelfy Multi-Tenant Inventory Management System &bull; Secure Authentication Service
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `${isReset ? 'Password Reset Code' : 'Email Verification Code'}: ${otp}. Valid for 5 minutes. If you did not request this, ignore this email.`;

  try {
    const info = await mailer.sendMail({
      from,
      to: toEmail,
      subject,
      text,
      html,
    });
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error('[Shelfy Mailer Error]', err);
    throw new Error('Failed to send verification email. Please try again.');
  }
}
