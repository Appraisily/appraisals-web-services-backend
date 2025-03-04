# Error Handling Implementation

This document provides an overview of the error handling implementation in the Appraisals Web Service backend.

## Files Created

1. **src/utils/errors.js** - Custom error classes
2. **src/middleware/errorHandler.js** - Centralized error handling middleware
3. **src/middleware/validation.js** - Validation middleware

## Changes Made

1. **index.js**
   - Added error handling middleware
   - Added 404 handler for non-existent routes

2. **src/routes/session.js**
   - Refactored to use the new error handling approach
   - Updated response format to match the standardized structure
   - Added express-validator validation for session ID

3. **src/routes/upload.js**
   - Refactored to use the new error handling approach
   - Updated response format to match the standardized structure
   - Added custom middleware for file validation

4. **src/routes/findValue.js**
   - Refactored to use the new error handling approach
   - Added express-validator validation for the session ID

5. **src/routes/originAnalysis.js**
   - Refactored to use the new error handling approach with proper error classes
   - Added express-validator validation for input parameters

6. **src/routes/email.js**
   - Refactored to use the new error handling approach
   - Added complex validation rules for email submissions
   - Updated rate limiting response to match standardized error format

7. **src/routes/fullAnalysis.js**
   - Refactored to use the new error handling approach
   - Added express-validator validation for session ID parameter
   - Updated response format to match the standardized structure

8. **src/features/visualSearch/routes/index.js**
   - Added express-validator validation for the visual search route

9. **src/features/visualSearch/controllers/visualSearchController.js**
   - Refactored to use the new error handling approach
   - Updated response format to match the standardized structure

10. **src/features/email/routes/index.js**
    - Added comprehensive validation for email submissions
    - Updated rate limiting response to match standardized error format

11. **src/routes/health.js**
    - Updated endpoints to use the standardized response format
    - Refactored status endpoint to use the standardized error handling
    - Improved health check with more detailed service status reporting

## How to Use

### Error Classes

```javascript
const { ValidationError, NotFoundError, AuthorizationError, ServerError } = require('../utils/errors');

// Example usage
if (!userId) {
  throw new ValidationError('User ID is required', { param: 'userId' });
}

if (!userExists) {
  throw new NotFoundError('User not found');
}

if (!isAuthorized) {
  throw new AuthorizationError('Not authorized to access this resource');
}

if (somethingWentWrong) {
  throw new ServerError('Database connection failed', { details: error });
}
```

### Validation Middleware

#### Basic Validation

```javascript
const { body, param, query } = require('express-validator');
const { validate } = require('../middleware/validation');

router.post('/example',
  [
    body('email').isEmail().withMessage('Invalid email format'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    validate // This will throw ValidationError if validation fails
  ],
  async (req, res, next) => {
    // Your route handler
  }
);
```

#### Complex Validation

```javascript
router.post('/advanced-example',
  [
    // Parameter validation
    body('email')
      .notEmpty()
      .withMessage('Email is required')
      .isEmail()
      .withMessage('Invalid email format')
      .normalizeEmail({ all_lowercase: true, gmail_remove_dots: false }),
    
    // String validation with length constraints
    body('name')
      .optional()
      .isString()
      .withMessage('Name must be a string')
      .isLength({ min: 2, max: 100 })
      .withMessage('Name must be between 2 and 100 characters'),
    
    // Boolean validation
    body('subscribeToNewsletter')
      .optional()
      .isBoolean()
      .withMessage('Subscribe to newsletter must be a boolean value'),
    
    // Custom validation
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long')
      .matches(/[a-z]/)
      .withMessage('Password must contain at least one lowercase letter')
      .matches(/[A-Z]/)
      .withMessage('Password must contain at least one uppercase letter')
      .matches(/[0-9]/)
      .withMessage('Password must contain at least one number')
      .matches(/[^a-zA-Z0-9]/)
      .withMessage('Password must contain at least one special character'),
    
    // URL validation
    body('websiteUrl')
      .optional()
      .isURL({ require_protocol: true })
      .withMessage('Website URL must be a valid URL with protocol (http:// or https://)'),
    
    validate
  ],
  async (req, res, next) => {
    // Your route handler
  }
);
```

#### Custom Validation Middleware

```javascript
// Custom middleware for file validation
const validateFileUpload = (req, res, next) => {
  try {
    if (!req.file) {
      throw new ValidationError('No file uploaded', { param: 'image' });
    }

    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(req.file.mimetype)) {
      throw new ValidationError('Invalid file type. Only JPEG, PNG, and WebP images are allowed.', 
        { param: 'image', allowedTypes: allowedMimeTypes });
    }
    
    next();
  } catch (error) {
    next(error);
  }
};

router.post('/upload', 
  upload.single('image'), 
  validateFileUpload,
  async (req, res, next) => {
    // Route handler
  }
);
```

### Route Handler Pattern

```javascript
router.get('/resource/:id', async (req, res, next) => {
  try {
    // Your logic here
    
    // Return success response
    res.json({
      success: true,
      data: {
        // Your data here
      },
      error: null
    });
  } catch (error) {
    // Pass to error handling middleware
    next(error);
  }
});
```

### Standardized Response Format

For all API responses, the following format is used:

#### Success Response

```javascript
{
  "success": true,
  "data": {
    // Response data specific to the endpoint
  },
  "error": null
}
```

#### Error Response

```javascript
{
  "success": false,
  "data": null,
  "error": {
    "code": "ERROR_CODE", // e.g., "VALIDATION_ERROR", "NOT_FOUND", "SERVER_ERROR"
    "message": "Human-readable error message",
    "details": {
      // Additional error details when available
    }
  }
}
```

## Frontend Integration

The frontend should be updated to handle the standardized response format:

```javascript
// Example using axios
api.get('/resource/123')
  .then(response => {
    if (response.data.success) {
      // Handle success
      const data = response.data.data;
      // Update UI with data
    } else {
      // Handle API-level failure
      handleError(response.data.error);
    }
  })
  .catch(error => {
    // Handle network or unexpected errors
    if (error.response && error.response.data && error.response.data.error) {
      // Handle structured error from API
      handleError(error.response.data.error);
    } else {
      // Handle other errors
      handleError({ 
        code: 'UNKNOWN_ERROR', 
        message: 'An unexpected error occurred' 
      });
    }
  });

// Error handling function
function handleError(error) {
  // Display error message to user
  showErrorNotification(error.message);
  
  // Log error for debugging
  console.error('API Error:', error);
  
  // Take action based on error code
  switch (error.code) {
    case 'VALIDATION_ERROR':
      highlightFormErrors(error.details);
      break;
    case 'UNAUTHORIZED':
      redirectToLogin();
      break;
    // Handle other error types
  }
}
```

## Next Steps

1. **Complete Route Refactoring**
   - Ensure all remaining routes (if any) are updated to use the new error handling approach
   - Thoroughly test each route with various error scenarios

2. **Update Frontend**
   - Modify the frontend API client to handle the standardized response format
   - Implement global error handling in the frontend
   - Create error display components

3. **Testing**
   - Develop automated tests for validation rules
   - Test all error scenarios
   - Ensure frontend properly handles all error types
   - Verify validation works correctly

4. **Documentation**
   - Update API documentation to reflect the standardized response format
   - Document validation rules for each endpoint 