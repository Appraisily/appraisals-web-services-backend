# Appraisals Web Services Backend Guidelines

## Build Commands
- `npm start` or `node index.js` - Start the server
- `npm install` - Install dependencies
- `node test-api.js [sessionId]` - Test the API with a specific session ID
- `node test-api-upload.js [imagePath]` - Test file upload functionality

## Code Style Guidelines
- **Structure**: Feature-based organization (controllers, routes, services, utils)
- **Error Handling**: Try/catch in async functions with standardized responses
- **Response Format**: `{ success: boolean, data: object|null, error: null|object }`
- **Validation**: Input validation in controllers with descriptive error messages
- **Imports**: Group by 1) Node modules 2) Project modules
- **Async Code**: Use Promise.all for parallel operations, async/await pattern
- **Naming**: camelCase for variables/functions, PascalCase for classes
- **Documentation**: JSDoc comments for functions and complex logic
- **Environment**: Use secrets management for sensitive configuration
- **Logging**: Include appropriate error context with console.error
- **Security**: Validate user inputs, implement rate limiting
- **Parallelism**: Use Promise.all for concurrent operations

## Development Workflow
- Backend handles API, storage, and AI service integration
- API response standards: HTTP codes, consistent response format
- Error handling includes environment-specific detail levels
- Proper Cloud service initialization before server startup