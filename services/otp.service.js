const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');

function generateOTP() {
  return crypto.randomInt(100000, 999999).toString();
}

async function createOTP(userId) {
  const otp = generateOTP();
  const saltRounds = 10;
  const otpHash = await bcrypt.hash(otp, saltRounds);
  const expiryMinutes = parseInt(process.env.OTP_EXPIRY_MINUTES) || 5;
  const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

  // Invalidate previous OTPs for this user
  await pool.query('UPDATE otp_store SET used = TRUE WHERE user_id = $1 AND used = FALSE', [userId]);

  await pool.query(
    'INSERT INTO otp_store (user_id, otp_hash, expires_at) VALUES ($1, $2, $3)',
    [userId, otpHash, expiresAt]
  );

  return otp;
}

async function verifyOTP(userId, otpInput) {
  const result = await pool.query(
    `SELECT * FROM otp_store 
     WHERE user_id = $1 AND used = FALSE AND expires_at > NOW() 
     ORDER BY created_at DESC LIMIT 1`,
    [userId]
  );

  if (result.rows.length === 0) {
    return { valid: false, reason: 'OTP expired or not found' };
  }

  const otpRecord = result.rows[0];
  const maxAttempts = 3;

  if (otpRecord.attempts >= maxAttempts) {
    return { valid: false, reason: 'Too many failed OTP attempts. Please request a new OTP.' };
  }

  const match = await bcrypt.compare(otpInput, otpRecord.otp_hash);

  if (!match) {
    await pool.query('UPDATE otp_store SET attempts = attempts + 1 WHERE id = $1', [otpRecord.id]);
    const remainingAttempts = maxAttempts - otpRecord.attempts - 1;
    if (remainingAttempts <= 0) {
      // Lock account for 15 min
      const lockoutMinutes = parseInt(process.env.LOCKOUT_DURATION_MINUTES) || 15;
      await pool.query(
        'UPDATE users SET locked_until = $1 WHERE id = $2',
        [new Date(Date.now() + lockoutMinutes * 60 * 1000), userId]
      );
      return { valid: false, reason: 'Account locked due to too many failed OTP attempts. Try again in 15 minutes.' };
    }
    return { valid: false, reason: `Invalid OTP. ${remainingAttempts} attempt(s) remaining.` };
  }

  await pool.query('UPDATE otp_store SET used = TRUE WHERE id = $1', [otpRecord.id]);
  return { valid: true };
}

module.exports = { createOTP, verifyOTP };
