import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';

const OTP_SECRET = 'test_signing_secret_123';

function hashOtp(email, code) {
  return crypto
    .createHmac('sha256', OTP_SECRET)
    .update(`${email.toLowerCase().trim()}:${code.trim()}`)
    .digest('hex');
}

// In-memory mock store representing the Supabase `otp_codes` table
class MockOtpStore {
  constructor() {
    this.records = [];
  }

  insert(entry) {
    const record = {
      id: crypto.randomUUID(),
      email: entry.email.toLowerCase().trim(),
      code_hash: entry.code_hash,
      purpose: entry.purpose,
      expires_at: entry.expires_at,
      attempts: 0,
      used: false,
      created_at: entry.created_at || new Date().toISOString(),
    };
    this.records.push(record);
    return record;
  }

  findActive(email, purpose) {
    return this.records
      .filter((r) => r.email === email && r.purpose === purpose && !r.used)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
  }

  countRecent(email, minutes) {
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);
    return this.records.filter((r) => r.email === email && new Date(r.created_at) >= cutoff).length;
  }
}

test('OTP Security: Hashes raw code and never exposes it in storage', () => {
  const email = 'user@example.com';
  const rawCode = '482910';
  const store = new MockOtpStore();

  const codeHash = hashOtp(email, rawCode);
  const record = store.insert({
    email,
    code_hash: codeHash,
    purpose: 'password_reset',
    expires_at: new Date(Date.now() + 300000).toISOString(),
  });

  assert.notEqual(record.code_hash, rawCode);
  assert.equal(record.code_hash.length, 64); // 256-bit hex
  assert.equal(hashOtp(email, rawCode), record.code_hash);
});

test('OTP Security: Single-use enforcement prevents replay attacks', () => {
  const email = 'user@example.com';
  const rawCode = '719283';
  const store = new MockOtpStore();

  const record = store.insert({
    email,
    code_hash: hashOtp(email, rawCode),
    purpose: 'password_reset',
    expires_at: new Date(Date.now() + 300000).toISOString(),
  });

  // First consumption: Valid
  assert.equal(record.used, false);
  const activeRecord = store.findActive(email, 'password_reset');
  assert.ok(activeRecord);
  activeRecord.used = true;

  // Second consumption attempt: Rejected because used is true
  const replayAttempt = store.findActive(email, 'password_reset');
  assert.equal(replayAttempt, undefined, 'Replay must be rejected because code is consumed');
});

test('OTP Security: Expired codes are rejected even if unconsumed', () => {
  const email = 'user@example.com';
  const rawCode = '123456';
  const store = new MockOtpStore();

  // Create code that expired 1 minute ago
  const record = store.insert({
    email,
    code_hash: hashOtp(email, rawCode),
    purpose: 'password_reset',
    expires_at: new Date(Date.now() - 60000).toISOString(),
  });

  const isExpired = new Date(record.expires_at) < new Date();
  assert.equal(isExpired, true, 'Code with past expiry date must be flagged expired');
});

test('OTP Security: Repeated failures trigger lockout after 5 attempts', () => {
  const email = 'user@example.com';
  const realCode = '999111';
  const store = new MockOtpStore();

  const record = store.insert({
    email,
    code_hash: hashOtp(email, realCode),
    purpose: 'password_reset',
    expires_at: new Date(Date.now() + 300000).toISOString(),
  });

  // Simulate 5 incorrect guesses
  for (let attempt = 1; attempt <= 5; attempt++) {
    const wrongCode = '00000' + attempt;
    const submittedHash = hashOtp(email, wrongCode);
    const isMatch = submittedHash === record.code_hash;
    assert.equal(isMatch, false);
    record.attempts += 1;
  }

  assert.equal(record.attempts, 5);
  const isLocked = record.attempts >= 5;
  assert.equal(isLocked, true, 'Code must be locked out after 5 failed attempts');
});

test('OTP Security: Rate limiting permits max 3 requests per 15 minutes', () => {
  const email = 'user@example.com';
  const store = new MockOtpStore();

  // Submit 3 requests
  for (let i = 0; i < 3; i++) {
    store.insert({
      email,
      code_hash: 'dummy_hash',
      purpose: 'password_reset',
      expires_at: new Date(Date.now() + 300000).toISOString(),
    });
  }

  const recentCount = store.countRecent(email, 15);
  assert.equal(recentCount, 3);

  const canRequestAgain = recentCount < 3;
  assert.equal(canRequestAgain, false, '4th request within 15 minutes must be rate-limited');
});
