'use server';

import crypto from 'crypto';
import { createClerkClient } from '@clerk/backend';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { sendOtpEmail } from '@/lib/mailer';

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

const OTP_SECRET = process.env.OTP_SECRET || process.env.JWT_SECRET || 'shelfy_otp_secret_signing_key_456';

/**
 * Computes HMAC-SHA256 hash of the 6-digit OTP code.
 * Raw codes are never persisted in the database.
 */
function hashOtp(email: string, code: string): string {
  return crypto
    .createHmac('sha256', OTP_SECRET)
    .update(`${email.toLowerCase().trim()}:${code.trim()}`)
    .digest('hex');
}

export interface RequestOtpResponse {
  success: boolean;
  message: string;
  error?: string;
  devCodePreview?: string;
}

export interface VerifyOtpResponse {
  success: boolean;
  message: string;
  error?: string;
}

/**
 * Server Action: Requests a single-use OTP for Password Reset or Sign-up Verification.
 * Enforces rate limiting (max 3 per 15 mins) and sends via SMTP.
 */
export async function requestOtp(
  emailInput: string,
  purpose: 'password_reset' | 'signup_verification' = 'password_reset',
  companyCode?: string
): Promise<RequestOtpResponse> {
  const email = emailInput?.toLowerCase().trim();
  const genericMessage = 'If an account exists with this email, a 6-digit verification code has been sent. It expires in 5 minutes.';

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { success: false, message: 'Please provide a valid email address.', error: 'INVALID_EMAIL' };
  }

  const supabase = supabaseAdmin();

  // 1. Rate Limiting: Max 3 requests per 15 minutes per email
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { data: recentRequests, error: countErr } = await supabase
    .from('otp_codes')
    .select('id')
    .eq('email', email)
    .gte('created_at', fifteenMinutesAgo);

  if (!countErr && recentRequests && recentRequests.length >= 3) {
    return {
      success: false,
      message: 'Too many verification code requests. Please wait 15 minutes before trying again.',
      error: 'RATE_LIMITED',
    };
  }

  // 2. Check if user exists in Clerk (avoid revealing existence to client)
  let clerkUserId: string | null = null;
  try {
    const userList = await clerkClient.users.getUserList({ emailAddress: [email] });
    if (userList.data && userList.data.length > 0) {
      clerkUserId = userList.data[0].id;
    }
  } catch (err) {
    console.error('[Clerk User Lookup Error]', err);
  }

  // If password_reset is requested and user does not exist in Clerk, exit cleanly with generic message
  if (purpose === 'password_reset' && !clerkUserId) {
    return { success: true, message: genericMessage };
  }

  // Look up company name for the email template if companyCode is passed
  let companyName = 'Shelfy IMS';
  if (companyCode) {
    const { data: company } = await supabase
      .from('companies')
      .select('name')
      .eq('short_code', companyCode.toUpperCase())
      .single();
    if (company?.name) companyName = company.name;
  }

  // 3. Generate secure 6-digit numeric OTP
  const rawCode = crypto.randomInt(100000, 1000000).toString();
  const codeHash = hashOtp(email, rawCode);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutes

  // Invalidate any previously unconsumed OTPs for this email and purpose
  await supabase
    .from('otp_codes')
    .update({ used: true })
    .eq('email', email)
    .eq('purpose', purpose)
    .eq('used', false);

  // Store hashed OTP in service-role table
  const { error: insertErr } = await supabase.from('otp_codes').insert({
    email,
    code_hash: codeHash,
    purpose,
    expires_at: expiresAt,
    attempts: 0,
    used: false,
  });

  if (insertErr) {
    console.error('[OTP Insert Error]', insertErr);
    return { success: false, message: 'Unable to initiate verification. Please try again.', error: 'DB_ERROR' };
  }

  // 4. Send branded email via Nodemailer SMTP
  try {
    await sendOtpEmail({
      toEmail: email,
      otp: rawCode,
      purpose,
      companyName,
    });
  } catch (mailErr) {
    console.error('[SMTP Send Error]', mailErr);
    return { success: false, message: 'Could not deliver verification email. Please check your SMTP configuration.', error: 'SMTP_FAILED' };
  }

  // 5. Audit Log (Never log the code!)
  await supabase.from('admin_audit_logs').insert({
    clerk_user_id: clerkUserId || 'unauthenticated',
    action: `otp.requested:${purpose}`,
    details: { email, purpose, success: true },
  });

  return {
    success: true,
    message: genericMessage,
    devCodePreview: process.env.NODE_ENV === 'development' ? rawCode : undefined,
  };
}

/**
 * Server Action: Verifies the submitted OTP and executes the password reset or verification.
 * Enforces single-use, 5-minute expiry, and lockout after 5 incorrect attempts.
 */
export async function verifyOtp(
  emailInput: string,
  codeInput: string,
  purpose: 'password_reset' | 'signup_verification' = 'password_reset',
  newPassword?: string
): Promise<VerifyOtpResponse> {
  const email = emailInput?.toLowerCase().trim();
  const code = codeInput?.trim();

  if (!email || !code || code.length !== 6) {
    return { success: false, message: 'Please enter a valid 6-digit verification code.', error: 'INVALID_INPUT' };
  }

  const supabase = supabaseAdmin();

  // 1. Fetch latest active OTP record for this email & purpose
  const { data: record, error: fetchErr } = await supabase
    .from('otp_codes')
    .select('*')
    .eq('email', email)
    .eq('purpose', purpose)
    .eq('used', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (fetchErr || !record) {
    return { success: false, message: 'No active verification code found or it has expired. Please request a new code.', error: 'EXPIRED' };
  }

  // Check Expiry (5 minutes)
  if (new Date(record.expires_at) < new Date()) {
    await supabase.from('otp_codes').update({ used: true }).eq('id', record.id);
    return { success: false, message: 'This verification code has expired. Please request a new one.', error: 'EXPIRED' };
  }

  // Check Lockout (5 attempts)
  if (record.attempts >= 5) {
    await supabase.from('otp_codes').update({ used: true }).eq('id', record.id);
    return { success: false, message: 'Too many incorrect attempts. This code is locked. Please request a new one.', error: 'LOCKED_OUT' };
  }

  // 2. Compare HMAC-SHA256 hashes
  const submittedHash = hashOtp(email, code);
  const isValid = crypto.timingSafeEqual(Buffer.from(record.code_hash, 'hex'), Buffer.from(submittedHash, 'hex'));

  if (!isValid) {
    const newAttempts = record.attempts + 1;
    await supabase.from('otp_codes').update({ attempts: newAttempts }).eq('id', record.id);

    const remaining = 5 - newAttempts;
    return {
      success: false,
      message: remaining > 0
        ? `Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
        : 'Code locked after 5 failed attempts. Please request a new code.',
      error: 'MISMATCH',
    };
  }

  // 3. Match: Mark code used immediately (single-use guarantee)
  await supabase.from('otp_codes').update({ used: true }).eq('id', record.id);

  // 4. Execute operation
  if (purpose === 'password_reset') {
    if (!newPassword || newPassword.length < 8) {
      return { success: false, message: 'Password must be at least 8 characters long.', error: 'WEAK_PASSWORD' };
    }

    try {
      const userList = await clerkClient.users.getUserList({ emailAddress: [email] });
      if (!userList.data || userList.data.length === 0) {
        return { success: false, message: 'User account not found.', error: 'USER_NOT_FOUND' };
      }

      const userId = userList.data[0].id;
      // Execute password change directly on Clerk Backend API
      await clerkClient.users.updateUser(userId, { password: newPassword });

      await supabase.from('admin_audit_logs').insert({
        clerk_user_id: userId,
        action: 'password_reset.completed',
        details: { email, method: 'custom_smtp_otp', timestamp: new Date().toISOString() },
      });

      return {
        success: true,
        message: 'Password successfully updated! You can now sign in with your new password.',
      };
    } catch (err: unknown) {
      console.error('[Clerk Password Update Error]', err);
      const msg = err instanceof Error ? err.message : 'Failed to update password with identity provider.';
      return { success: false, message: msg, error: 'CLERK_UPDATE_FAILED' };
    }
  }

  if (purpose === 'signup_verification') {
    try {
      const userList = await clerkClient.users.getUserList({ emailAddress: [email] });
      if (userList.data && userList.data.length > 0) {
        const user = userList.data[0];
        const emailObj = user.emailAddresses.find(e => e.emailAddress.toLowerCase() === email);
        if (emailObj) {
          await clerkClient.emailAddresses.updateEmailAddress(emailObj.id, { verified: true });
        }
      }
    } catch (err) {
      console.error('[Clerk Email Verification Error]', err);
    }

    return {
      success: true,
      message: 'Email successfully verified!',
    };
  }

  return { success: true, message: 'Verification successful.' };
}
