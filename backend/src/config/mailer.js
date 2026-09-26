const nodemailer = require('nodemailer');

let transporter = null;

const createTransporter = async () => {
  // Retain compatibility with the original local environment variable names.
  for (const key of ['HOST', 'PORT', 'USER', 'PASS', 'FROM']) {
    if (!process.env[`SMTP_${key}`] && process.env[`EMAIL_${key}`]) process.env[`SMTP_${key}`] = process.env[`EMAIL_${key}`];
  }
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.ethereal.email',
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  if (process.env.NODE_ENV === 'production') throw Object.assign(new Error('SMTP is not configured. Set SMTP_HOST, SMTP_USER and SMTP_PASS.'), { statusCode: 503 });

  // Development fallback: ethereal or mock
  return nodemailer.createTransport({
    streamTransport: true,
    newline: 'windows',
    buffer: true,
  });
};

const sendOtpEmail = async (toEmail, otp) => {
  try {
    if (!transporter) {
      transporter = await createTransporter();
    }

    const mailOptions = {
      from: process.env.SMTP_FROM || '"Shelfy Security" <noreply@shelfy.local>',
      to: toEmail,
      subject: 'Shelfy Password Reset OTP',
      text: `Your Shelfy password reset code is: ${otp}. It will expire in 5 minutes. If you did not request this, please ignore this email.`,
      html: `
        <div style="font-family: Arial, sans-serif; background-color: #f8fafc; padding: 30px; border-radius: 8px;">
          <div style="max-width: 500px; margin: 0 auto; background: #ffffff; padding: 24px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
            <div style="display: flex; align-items: center; margin-bottom: 20px;">
              <h2 style="color: #0f172a; margin: 0; font-size: 22px;">📦 Shelfy IMS</h2>
            </div>
            <p style="color: #334155; font-size: 15px; line-height: 1.5;">You requested a password reset for your Shelfy account.</p>
            <div style="background: #f1f5f9; border-radius: 8px; padding: 16px; text-align: center; margin: 24px 0;">
              <span style="font-size: 32px; letter-spacing: 6px; font-weight: bold; color: #0284c7;">${otp}</span>
            </div>
            <p style="color: #64748b; font-size: 13px;">This code is valid for <strong>5 minutes</strong>. If you did not request this reset, no action is required.</p>
          </div>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    if (process.env.NODE_ENV !== 'production') console.log(`\n======================================================`);
    if (process.env.NODE_ENV !== 'production') console.log(`🔑 PASSWORD RESET OTP for [${toEmail}]: >>> ${otp} <<<`);
    if (process.env.NODE_ENV !== 'production') console.log(`======================================================\n`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Failed to send OTP email:', error);
    if (process.env.NODE_ENV === 'production') throw error;
    // Still display to console in dev mode
    console.log(`\n======================================================`);
    console.log(`🔑 [DEV-FALLBACK] OTP for [${toEmail}]: >>> ${otp} <<<`);
    console.log(`======================================================\n`);
    return { success: true, fallback: true };
  }
};

module.exports = { sendOtpEmail };
