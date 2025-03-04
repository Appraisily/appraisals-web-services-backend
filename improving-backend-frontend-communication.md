# Improving Backend-Frontend Communication in Appraisals Web Service

This document outlines a plan to enhance the communication between the backend and frontend, focusing on:
1. Standardizing API responses
2. Improving error handling
3. Establishing a robust error reporting system
4. Handling malformed requests consistently

## Current State Analysis

The current backend implementation:
- Uses a mix of error handling approaches across different routes
- Returns varying response structures based on the route
- Lacks a centralized error handling middleware
- Doesn't have a standardized way to communicate validation errors

## Proposed Implementation Plan

### 1. Standardize API Response Format

Create a consistent response structure for all API endpoints:

```javascript
{
  success: boolean,        // true for successful operations, false for failures
  data: object | null,     // the main response payload (null when error occurs)
  error: {                 // only present when success is false
    code: string,          // machine-readable error code (e.g., "VALIDATION_ERROR")
    message: string,       // human-readable error message
    details: object | null // additional error information (validation errors, etc.)
  }
}
```

### 2. Implement Centralized Error Handling

#### 2.1. Create Error Classes

Create a file `src/utils/errors.js`:

```javascript
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
```

#### 2.2. Create Error Handling Middleware

Create a file `src/middleware/errorHandler.js`:

```javascript
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
```

#### 2.3. Create Request Validation Middleware

Create a file `src/middleware/validation.js`:

```javascript
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
```

### 3. Update Main Application File

Update `index.js`:

```javascript
// Add after all the routes
const errorHandler = require('./src/middleware/errorHandler');

// Existing routes...
app.use('/api/health', healthRouter);

// 404 handler - must come after all valid routes
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    data: null,
    error: {
      code: 'NOT_FOUND',
      message: 'The requested resource was not found',
      details: null
    }
  });
});

// Error handling middleware - must be last
app.use(errorHandler);
```

### 4. Refactor Route Handlers

Example refactoring for a route handler:

```javascript
// Before
router.get('/:sessionId', async (req, res) => {
  try {
    // ... existing logic ...
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Session ID is required.'
      });
    }
    // ... more logic ...
    res.json({
      success: true,
      session: { /* data */ }
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error message'
    });
  }
});

// After
const { ValidationError, NotFoundError } = require('../utils/errors');

router.get('/:sessionId', async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    
    if (!sessionId) {
      throw new ValidationError('Session ID is required', { param: 'sessionId' });
    }
    
    // ... existing logic ...
    
    if (!metadataExists) {
      throw new NotFoundError('Session not found');
    }
    
    // ... more logic ...
    
    // Return standardized success response
    res.json({
      success: true,
      data: {
        session: { /* data */ }
      },
      error: null
    });
  } catch (error) {
    // Pass to error handling middleware
    next(error);
  }
});
```

### 5. Frontend Integration

Update the frontend to handle the standardized response format:

```javascript
// Example frontend API client using axios
import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

// Response interceptor for global error handling
api.interceptors.response.use(
  (response) => {
    // Return data for successful requests
    if (response.data && response.data.success) {
      return response.data.data;
    }
    
    // If API returns failure but HTTP status is 2xx
    // create and throw an error to be caught by the error handler
    const error = new Error(
      (response.data?.error?.message) || 'Unknown error occurred'
    );
    error.code = response.data?.error?.code || 'UNKNOWN_ERROR';
    error.details = response.data?.error?.details || null;
    throw error;
  },
  (error) => {
    // Handle network errors or any response with error status
    if (!error.response) {
      // Network error
      const networkError = new Error('Network error: Cannot connect to server');
      networkError.code = 'NETWORK_ERROR';
      return Promise.reject(networkError);
    }
    
    // If the response includes our standard error format
    if (error.response.data && error.response.data.error) {
      const apiError = new Error(error.response.data.error.message);
      apiError.code = error.response.data.error.code;
      apiError.details = error.response.data.error.details;
      return Promise.reject(apiError);
    }
    
    // Fallback for unexpected error formats
    const fallbackError = new Error('An unexpected error occurred');
    fallbackError.code = 'UNKNOWN_ERROR';
    fallbackError.originalError = error;
    return Promise.reject(fallbackError);
  }
);

// Error toast/notification component in UI
function ErrorNotification({ error }) {
  if (!error) return null;
  
  // Map error codes to user-friendly messages
  const friendlyMessages = {
    'VALIDATION_ERROR': 'There are issues with the information provided. Please check the form and try again.',
    'UNAUTHORIZED': 'You must be logged in to perform this action.',
    'NOT_FOUND': 'The requested information could not be found.',
    'SERVER_ERROR': 'Sorry, something went wrong on our end. Please try again later.',
    'NETWORK_ERROR': 'Unable to connect to the server. Please check your internet connection.'
  };
  
  const message = friendlyMessages[error.code] || error.message;
  
  return (
    <div className="error-notification">
      <h4>Error</h4>
      <p>{message}</p>
      {error.details && (
        <ul>
          {Object.entries(error.details).map(([key, value]) => (
            <li key={key}>{`${key}: ${value}`}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

## Implementation Steps

1. **Phase 1: Backend Infrastructure (Est. 1-2 days)**
   - Create error utility classes
   - Implement error handling middleware
   - Add validation middleware

2. **Phase 2: Route Updates (Est. 2-3 days)**
   - Standardize response format across all existing routes
   - Update error handling in each route
   - Add proper validation to each endpoint

3. **Phase 3: Frontend Integration (Est. 1-2 days)**
   - Update API client to handle standardized responses
   - Implement global error handling in the frontend
   - Create error display components

4. **Phase 4: Testing (Est. 1-2 days)**
   - Test all error scenarios
   - Ensure frontend properly handles all error types
   - Verify validation works correctly

## Benefits

- **Consistent Error Experience**: Users will receive clear, actionable error messages
- **Easier Debugging**: Standardized error format makes troubleshooting simpler
- **Reduced Duplication**: Centralized error handling reduces code repetition
- **Better Security**: Proper error handling prevents leaking sensitive information
- **Improved Developer Experience**: Consistent patterns make the codebase easier to maintain

## Minimal Changes Required

This plan is designed to minimize changes to the existing codebase:
- No major architectural changes needed
- Can be implemented incrementally, route by route
- Existing functionality remains unchanged
- Backward compatibility maintained with proper response format mapping 