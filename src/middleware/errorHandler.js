const { AppError } = require('../utils/errors');

// Log errors to console and potentially to a monitoring service
const logError = (err) => {
  console.error('ERROR:', {
    message: err.message,
    code: err.code,
    stack: err.stack,
    details: err.details || {}
  });
  
  // Here you could add integration with error monitoring services
  // like Sentry, New Relic, etc.
};

// Error handling middleware
const errorHandler = (err, req, res, next) => {
  // Log the error
  logError(err);
  
  // Handle AppError instances
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      data: null,
      error: {
        code: err.code,
        message: err.message,
        details: err.details
      }
    });
  }
  
  // Handle validation errors from express-validator
  if (err.array && typeof err.array === 'function') {
    return res.status(400).json({
      success: false,
      data: null,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: err.array()
      }
    });
  }
  
  // Handle multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      data: null,
      error: {
        code: 'FILE_TOO_LARGE',
        message: 'Uploaded file is too large',
        details: { maxSize: '10MB' }
      }
    });
  }
  
  // Handle any other errors as server errors
  const isDev = process.env.NODE_ENV === 'development';
  
  return res.status(500).json({
    success: false,
    data: null,
    error: {
      code: 'SERVER_ERROR',
      message: 'An unexpected error occurred',
      details: isDev ? { 
        originalMessage: err.message,
        stack: err.stack 
      } : null
    }
  });
};

module.exports = errorHandler; 