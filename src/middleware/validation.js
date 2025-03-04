const { validationResult } = require('express-validator');
const { ValidationError } = require('../utils/errors');

// Middleware to check validation results
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }
  next();
};

module.exports = { validate }; 