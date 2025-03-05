const express = require('express');
const { rateLimit } = require('express-rate-limit');
const emailController = require('../controllers/emailController');

const router = express.Router();

// Rate limiting: 5 requests per minute per IP
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  validate: {
    trustProxy: false,
    xForwardedForHeader: true
  },
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests, please try again later.'
  }
});

router.post('/submit-email', limiter, emailController.submitEmail);

module.exports = router;