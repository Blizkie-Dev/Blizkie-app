const express = require('express');
const rateLimit = require('express-rate-limit');
const { sendCode, verifyCode } = require('../services/authService');

const router = express.Router();

const isDev = process.env.DEV_MODE === 'true';

const sendCodeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 100 : 5,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// POST /auth/send-code
router.post('/send-code', sendCodeLimiter, async (req, res, next) => {
  try {
    const { target } = req.body; // phone or email
    if (!target || typeof target !== 'string' || target.trim().length < 3) {
      return res.status(400).json({ error: 'Phone or email is required' });
    }
    await sendCode(target.trim());
    res.json({ success: true, message: 'Verification code sent' });
  } catch (err) {
    next(err);
  }
});

// POST /auth/verify
router.post('/verify', async (req, res, next) => {
  try {
    const { target, code } = req.body;
    if (!target || !code) {
      return res.status(400).json({ error: 'target and code are required' });
    }
    const result = await verifyCode(target.trim(), code.trim());
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
