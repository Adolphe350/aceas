const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { login, verifyOTPHandler, resendOTP, register, logout } = require('../controllers/auth.controller');
const { authenticateToken } = require('../middleware/auth');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/login', authLimiter, login);
router.post('/verify-otp', authLimiter, verifyOTPHandler);
router.post('/resend-otp', authLimiter, resendOTP);
router.post('/register', authLimiter, register);
router.post('/logout', authenticateToken, logout);

// Token validation endpoint — used by login page to check if stored token is still valid
router.get('/me', authenticateToken, (req, res) => {
  res.json({ id: req.user.id, email: req.user.email, role: req.user.role });
});

module.exports = router;
