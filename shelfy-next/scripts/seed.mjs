import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
// Built-in environment file support via Node.js --env-file=.env.local

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function runSeed() {
  console.log('🌱 Starting Shelfy Multi-Tenant Seed Script…');

  if (!supabaseUrl || !serviceRoleKey) {
    console.log('⚠️ SUPABASE_SERVICE_ROLE_KEY not supplied. Skipping remote Supabase insertion.');
    console.log('✅ Seed definitions are ready in /supabase/seed.sql');
  } else {
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Insert 2 demo companies
    console.log('Inserting demo organizations…');
    const { error: compErr } = await supabase.from('companies').upsert([
      { id: 'org_apex_global', name: 'Apex Global Logistics', short_code: 'APEX', is_active: true },
      { id: 'org_omni_retail', name: 'Omni Retail Warehousing', short_code: 'OMNI', is_active: true },
    ]);

    if (compErr) console.warn('Company upsert:', compErr.message);
    else console.log('✅ Companies seeded successfully.');
  }

  // Exercise one demo OTP request end-to-end via SMTP
  console.log('\n📧 Exercising Demo OTP Request end-to-end via SMTP…');
  const testEmail = process.env.SMTP_USER || 'suryanarayananr06@gmail.com';
  const testCode = crypto.randomInt(100000, 1000000).toString();

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || `"Shelfy Security" <${testEmail}>`,
      to: testEmail,
      subject: '[Shelfy IMS] Automated Seed Verification Code',
      text: `Your demo seed verification code is: ${testCode}`,
      html: `<h3>Shelfy IMS Automated Verification</h3><p>Demo Code: <strong>${testCode}</strong></p>`,
    });

    console.log(`✅ Demo OTP email delivered to [${testEmail}]!`);
    console.log(`📬 Message ID: ${info.messageId}`);
    console.log(`🔑 Verification Code: ${testCode}`);
  } catch (err) {
    console.error('❌ SMTP Demo delivery error:', err.message);
  }

  console.log('\n🏁 Seed execution completed.');
}

runSeed();
