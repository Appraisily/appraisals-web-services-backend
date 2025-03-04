class AppError extends Error {
  constructor(message, code, statusCode, details = null) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

class ValidationError extends AppError {
  constructor(message, details) {
    super(message, 'VALIDATION_ERROR', 400, details);
  }
}

class NotFoundError extends AppError {
  constructor(message) {
    super(message, 'NOT_FOUND', 404);
  }
}

class AuthorizationError extends AppError {
  constructor(message) {
    super(message, 'UNAUTHORIZED', 401);
  }
}

class ServerError extends AppError {
  constructor(message, details) {
    super(message, 'SERVER_ERROR', 500, details);
  }
}

module.exports = {
  AppError,
  ValidationError,
  NotFoundError,
  AuthorizationError,
  ServerError
}; 