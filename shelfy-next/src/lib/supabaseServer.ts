import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Creates a Supabase client authenticated with the active Clerk user's session JWT.
 * Supabase evaluates Row Level Security (RLS) policies against this token,
 * extracting `company_id = (auth.jwt() ->> 'org_id')`.
 */
export async function supabaseServer() {
  const { getToken } = await auth();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase environment variables (NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY) are missing.');
  }

  return createClient(supabaseUrl, supabaseKey, {
    accessToken: async () => {
      const token = await getToken();
      return token ?? null;
    },
  });
}

/**
 * Service-role Supabase client with elevated privileges.
 * NEVER exposed to the browser. Used exclusively for:
 * 1. Custom OTP generation & verification (otp_codes table)
 * 2. System and super-admin audit logs (admin_audit_logs)
 */
export function supabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for admin server operations.');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
