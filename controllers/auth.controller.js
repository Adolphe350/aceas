const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
const { createOTP, verifyOTP } = require('../services/otp.service');
const { sendOTPEmail } = require('../services/email.service');

async function logAudit(pool, userId, action, entityType, entityId, ipAddress) {
  try {
    await pool.query(
      'INSERT INTO audit_log (user_id, action, entity_type, entity_id, ip_address) VALUES ($1, $2, $3, $4, $5)',
      [userId, action, entityType, entityId, ipAddress]
    );
  } catch (e) {
    console.error('Audit log error:', e.message);
  }
}

async function login(req, res) {
  const { email, password } = req.body;
  const ip = req.ip || req.connection.remoteAddress;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(401).json({ error: 'Account is deactivated. Contact an administrator.' });
    }

    // Check lockout
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const minutesLeft = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
      return res.status(423).json({ error: `Account locked. Try again in ${minutesLeft} minute(s).` });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      const maxAttempts = parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5;
      const newAttempts = (user.failed_login_attempts || 0) + 1;

      if (newAttempts >= maxAttempts) {
        const lockoutMinutes = parseInt(process.env.LOCKOUT_DURATION_MINUTES) || 15;
        await pool.query(
          'UPDATE users SET failed_login_attempts = $1, locked_until = $2 WHERE id = $3',
          [newAttempts, new Date(Date.now() + lockoutMinutes * 60 * 1000), user.id]
        );
        await logAudit(pool, user.id, 'LOGIN_LOCKED', 'users', user.id, ip);
        return res.status(423).json({ error: `Too many failed attempts. Account locked for ${lockoutMinutes} minutes.` });
      } else {
        await pool.query('UPDATE users SET failed_login_attempts = $1 WHERE id = $2', [newAttempts, user.id]);
        return res.status(401).json({ error: `Invalid email or password. ${maxAttempts - newAttempts} attempt(s) remaining.` });
      }
    }

    // Reset failed attempts
    await pool.query('UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1', [user.id]);

    // Generate and send OTP
    const otp = await createOTP(user.id);
    const emailResult = await sendOTPEmail(user.email, user.full_name, otp);

    if (!emailResult.success) {
      console.error('Failed to send OTP email, but proceeding:', emailResult.error);
    }

    await logAudit(pool, user.id, 'LOGIN_OTP_SENT', 'users', user.id, ip);

    // Return user ID + masked email for OTP step (not JWT yet)
    const maskedEmail = user.email.replace(/^(.{2})(.*)(@.*)$/, (_, a, b, c) => a + '*'.repeat(Math.max(b.length, 3)) + c);

    res.json({
      message: 'OTP sent to your email',
      userId: user.id,
      maskedEmail,
      requiresOTP: true,
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function verifyOTPHandler(req, res) {
  const { userId, otp } = req.body;
  const ip = req.ip || req.connection.remoteAddress;

  if (!userId || !otp) {
    return res.status(400).json({ error: 'User ID and OTP are required' });
  }

  try {
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid session' });
    }

    const user = userResult.rows[0];

    // Check lockout
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const minutesLeft = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
      return res.status(423).json({ error: `Account locked. Try again in ${minutesLeft} minute(s).` });
    }

    const result = await verifyOTP(userId, otp.toString().trim());

    if (!result.valid) {
      return res.status(401).json({ error: result.reason });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    await logAudit(pool, user.id, 'LOGIN_SUCCESS', 'users', user.id, ip);

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('OTP verify error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function resendOTP(req, res) {
  const { userId } = req.body;
  const ip = req.ip || req.connection.remoteAddress;

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  try {
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      return res.status(423).json({ error: 'Account is locked. Cannot resend OTP.' });
    }

    const otp = await createOTP(user.id);
    const emailResult = await sendOTPEmail(user.email, user.full_name, otp);

    await logAudit(pool, user.id, 'OTP_RESEND', 'users', user.id, ip);

    if (!emailResult.success) {
      return res.status(500).json({ error: 'Failed to send OTP email. Please try again.' });
    }

    const maskedEmail = user.email.replace(/^(.{2})(.*)(@.*)$/, (_, a, b, c) => a + '*'.repeat(Math.max(b.length, 3)) + c);
    res.json({ message: `New OTP sent to ${maskedEmail}` });
  } catch (err) {
    console.error('Resend OTP error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function register(req, res) {
  const { full_name, email, password } = req.body;
  const ip = req.ip || req.connection.remoteAddress;

  if (!full_name || !email || !password) {
    return res.status(400).json({ error: 'Full name, email, and password are required' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      'INSERT INTO users (full_name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, full_name, email, role',
      [full_name.trim(), email.toLowerCase().trim(), passwordHash, 'ai_developer']
    );

    const newUser = result.rows[0];
    await logAudit(pool, newUser.id, 'USER_REGISTERED', 'users', newUser.id, ip);

    res.status(201).json({
      message: 'Registration successful. You can now log in.',
      user: { id: newUser.id, fullName: newUser.full_name, email: newUser.email, role: newUser.role },
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function logout(req, res) {
  // JWT is stateless; client clears token
  res.json({ message: 'Logged out successfully' });
}

module.exports = { login, verifyOTPHandler, resendOTP, register, logout };
