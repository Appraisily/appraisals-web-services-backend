# Appraisals Web Services Backend Guidelines

## Build Commands
- `npm start` - Start the server
- `node index.js` - Run the backend service
- `node test-api.js [sessionId]` - Test the API with a specific session ID
- `node test-api-upload.js [imagePath]` - Test file upload functionality

## Code Style Guidelines
- **Structure**: Follow feature-based organization (controllers, routes, services, utils)
- **Error Handling**: Use custom error classes from `src/utils/errors.js`
- **Validation**: Use express-validator with `validate` middleware
- **Response Format**: Always use standardized format:
  ```
  { success: true|false, data: {...}|null, error: null|{...} }
  ```
- **Async/Await**: Use try/catch blocks for error handling with async functions
- **Middleware**: Use middleware for cross-cutting concerns (validation, error handling)
- **Imports**: Group imports by source (node modules first, then project modules)
- **Naming Convention**: camelCase for variables/functions, PascalCase for classes
- **Documentation**: Add JSDoc comments for functions and complex logic
- **Environment**: Use secrets management for sensitive configuration
- **Logging**: Include appropriate error logging and context

## Development Workflow
- Backend (this repo) handles the API and services
- Frontend is separate, deployed on Netlify
- Use standardized API response format for frontend integration
- Follow the error handling implementation in error-handling-implementation.md