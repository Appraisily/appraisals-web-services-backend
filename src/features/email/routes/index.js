const express = require('express');
const { rateLimit } = require('express-rate-limit');
const emailController = require('../controllers/emailController');
const { body } = require('express-validator');
const { validate } = require('../../../middleware/validation');

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
    data: null,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later.',
      details: { retryAfter: '60 seconds' }
    }
  }
});

router.post('/submit-email', 
  limiter, 
  [
    body('email')
      .notEmpty()
      .withMessage('Email is required')
      .isEmail()
      .withMessage('Invalid email format')
      .normalizeEmail({ all_lowercase: true, gmail_remove_dots: false }),
    
    body('sessionId')
      .notEmpty()
      .withMessage('Session ID is required')
      .isString()
      .withMessage('Session ID must be a string'),
    
    // Optional fields can be validated too
    body('name')
      .optional()
      .isString()
      .withMessage('Name must be a string')
      .isLength({ min: 2, max: 100 })
      .withMessage('Name must be between 2 and 100 characters'),
    
    body('subscribeToNewsletter')
      .optional()
      .isBoolean()
      .withMessage('Subscribe to newsletter must be a boolean value'),
    
    validate
  ], 
  emailController.submitEmail
);

module.exports = router;