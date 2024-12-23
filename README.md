# Art Appraisal Web Services Backend

A robust Node.js backend service for art and antique image analysis using Google Cloud Vision API and OpenAI Vision.

## Features

### Image Upload and Session Management
- Secure temporary image upload with session-based tracking
- Support for JPEG, PNG, and WebP formats
- 10MB file size limit
- Automatic session metadata management
- Google Cloud Storage integration for reliable file storage

### Visual Analysis
- **Dual Analysis System**
  - Google Cloud Vision web detection
  - OpenAI Vision analysis
- Parallel processing for improved performance
- Comprehensive image matching and recognition

### Storage and Organization
- Session-based file organization
- Automatic metadata tracking
- Cached analysis results
- Clean session management

## API Endpoints

### POST `/upload-temp`
Handles temporary image uploads and creates a new session.

**Request:**
- Method: `POST`
- Content-Type: `multipart/form-data`
- Body: 
  - `image`: Image file (JPEG, PNG, or WebP)

**Response:**
```json
{
  "success": true,
  "message": "Image uploaded successfully.",
  "imageUrl": "https://storage.googleapis.com/bucket-name/path/to/image",
  "sessionId": "unique-session-id"
}
```

### POST `/visual-search`
Performs visual analysis on the uploaded image using both Google Vision and OpenAI.

**Request:**
- Method: `POST`
- Content-Type: `application/json`
- Body:
```json
{
  "sessionId": "unique-session-id"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Visual search completed successfully.",
  "results": {
    "vision": {
      "webEntities": [...],
      "description": {...},
      "matches": {...},
      "webLabels": [...]
    },
    "openai": {
      "category": "Art|Antique",
      "description": "Brief description"
    }
  },
  "analyzed": true,
  "analysisTimestamp": 1234567890
}
```

## Security Features

- CORS protection with allowlist
- Request size limits
- File type validation
- Secure cloud storage
- Environment-based error handling

## Environment Setup

Required environment variables:
- `GOOGLE_CLOUD_PROJECT_ID`
- `GCS_BUCKET_NAME`
- `OPENAI_API_KEY`

All secrets are managed through Google Cloud Secret Manager.

## Architecture

### Services
- `CloudServices`: Manages Google Cloud Storage and Vision API
- `OpenAIService`: Handles OpenAI Vision analysis

### Middleware
- CORS configuration
- File upload handling
- Error handling

### Routes
- Upload management
- Visual search processing

## Error Handling

- Detailed error logging
- Development/production error responses
- Graceful failure handling
- Session validation

## Storage Structure

```
sessions/
  ├── {sessionId}/
  │   ├── UserUploadedImage.{ext}
  │   └── metadata.json
```

## Performance Optimizations

- Parallel API processing
- Efficient file handling
- Metadata caching
- Response formatting
- Memory-efficient uploads