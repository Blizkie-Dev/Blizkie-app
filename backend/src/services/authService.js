const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../config/database');
const { generateOtp } = require('../utils/otp');
const { sign } = require('../utils/jwt');
const nodemailer = require('nodemailer');

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes

// ─── Email Transport ───────────────────────────────────────────────────────

function getTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

async function sendEmailOtp(email, code) {
  if (process.env.DEV_MODE === 'true') {
    console.log(`[DEV] OTP for ${email}: ${code}`);
    return;
  }
  const transport = getTransport();
  await transport.sendMail({
    from: process.env.EMAIL_FROM || 'Blizkie <no-reply@blizkie.app>',
    to: email,
    subject: `Your Blizkie code: ${code}`,
    text: `Your verification code is: ${code}\n\nValid for 10 minutes. Do not share it.`,
    html: `<p>Your verification code is: <strong>${code}</strong></p><p>Valid for 10 minutes. Do not share it.</p>`,
  });
}

async function sendPhoneOtp(phone, code) {
  // Stub: In production integrate Twilio or similar
  if (process.env.DEV_MODE === 'true') {
    console.log(`[DEV] OTP for ${phone}: ${code}`);
    return;
  }
  console.warn(`[SMS] SMS sending not configured. Code for ${phone}: ${code}`);
}

// ─── Core Logic ────────────────────────────────────────────────────────────

function isEmail(target) {
  return target.includes('@');
}

/**
 * Sends an OTP to phone or email.
 */
async function sendCode(target) {
  const db = getDb();
  const code = generateOtp();
  const codeHash = await bcrypt.hash(code, 10);
  const now = Date.now();

  db.prepare(
    'INSERT INTO otps (id, target, code_hash, expires_at, used, created_at) VALUES (?, ?, ?, ?, 0, ?)'
  ).run([uuidv4(), target.toLowerCase().trim(), codeHash, now + OTP_TTL_MS, now]);

  if (isEmail(target)) {
    await sendEmailOtp(target, code);
  } else {
    await sendPhoneOtp(target, code);
  }
}

/**
 * Verifies the OTP and returns a JWT token.
 */
async function verifyCode(target, code) {
  const db = getDb();
  const normalTarget = target.toLowerCase().trim();
  const now = Date.now();

  // Find most recent non-used, non-expired OTP for this target
  const otp = db
    .prepare(
      `SELECT * FROM otps
       WHERE target = ? AND used = 0 AND expires_at > ?
       ORDER BY created_at DESC LIMIT 1`
    )
    .get([normalTarget, now]);

  if (!otp) {
    throw Object.assign(new Error('Invalid or expired code'), { status: 400 });
  }

  const valid = await bcrypt.compare(code, otp.code_hash);
  if (!valid) {
    throw Object.assign(new Error('Invalid or expired code'), { status: 400 });
  }

  // Mark OTP as used
  db.prepare('UPDATE otps SET used = 1 WHERE id = ?').run(otp.id);

  // Upsert user
  let user = isEmail(normalTarget)
    ? db.prepare('SELECT * FROM users WHERE email = ?').get(normalTarget)
    : db.prepare('SELECT * FROM users WHERE phone = ?').get(normalTarget);

  let isNew = false;
  if (!user) {
    isNew = true;
    const userId = uuidv4();
    const ts = Date.now();
    db.prepare(
      `INSERT INTO users (id, phone, email, username, display_name, created_at, last_seen_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run([
      userId,
      isEmail(normalTarget) ? null : normalTarget,
      isEmail(normalTarget) ? normalTarget : null,
      null,
      '',
      ts,
      ts,
    ]);
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  } else {
    db.prepare('UPDATE users SET last_seen_at = ? WHERE id = ?').run([Date.now(), user.id]);
  }

  // Create session
  const sessionId = uuidv4();
  db.prepare(
    'INSERT INTO sessions (id, user_id, created_at, revoked) VALUES (?, ?, ?, 0)'
  ).run([sessionId, user.id, Date.now()]);

  const token = sign({ sub: user.id, jti: sessionId });
  return { token, user: sanitizeUser(user), isNew };
}

function sanitizeUser(u) {
  return {
    id: u.id,
    phone: u.phone,
    email: u.email,
    username: u.username,
    display_name: u.display_name,
    avatar_url: u.avatar_url,
    created_at: u.created_at,
    last_seen_at: u.last_seen_at,
  };
}

module.exports = { sendCode, verifyCode, sanitizeUser };
