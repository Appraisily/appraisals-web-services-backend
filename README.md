# Art Appraisal Web Services Backend

A robust Node.js backend service for art and antique image analysis using Google Cloud Vision API and OpenAI Vision.

## Core Features

### Image Analysis
- Dual analysis system using Google Cloud Vision and OpenAI Vision
- Origin analysis for artwork authenticity
- Visual similarity search
- Comprehensive image metadata extraction

### Security & Privacy
- Email encryption using AES-256-GCM
- Argon2 password hashing
- Rate limiting protection
- Secure session management
- CORS protection with domain allowlist

### Cloud Integration
- Google Cloud Storage for file management
- Google Cloud Secret Manager for secure configuration
- Scalable session-based storage architecture

## API Endpoints

### Image Upload
```http
POST /upload-temp
Content-Type: multipart/form-data

{
  "image": <file>
}
```
- Supports JPEG, PNG, WebP formats
- 10MB file size limit
- Returns session ID and image URL

### Visual Analysis
```http
POST /visual-search
Content-Type: application/json

{
  "sessionId": "uuid"
}
```
- Performs parallel Google Vision and OpenAI analysis
- Uses OpenAI model `gpt-4o` for visual analysis
- Returns comprehensive image analysis results

### Origin Analysis
```http
POST /origin-analysis
Content-Type: application/json

{
  "sessionId": "uuid"
}
```
- Analyzes artwork originality
- Compares with similar images
- Uses OpenAI model `o1` for origin analysis
- Provides expert analysis and recommendations

### Email Submission
```http
POST /submit-email
Content-Type: application/json

{
  "email": "user@example.com",
  "sessionId": "uuid"
}
```
- Rate limited to 5 requests per minute
- Secure email storage with encryption
- Email validation and hashing

## Project Structure

```
src/
├── config/
│   ├── models.js        # OpenAI model configuration
│   ├── prompts.js       # System prompts
│   └── secrets.js       # Secret management
├── middleware/
│   └── cors.js          # CORS configuration
├── routes/
│   ├── email.js         # Email handling
│   ├── originAnalysis.js # Origin analysis
│   ├── upload.js        # File uploads
│   └── visualSearch.js  # Visual search
├── services/
│   ├── encryption.js    # AES encryption
│   ├── openai.js        # OpenAI integration
│   └── storage.js       # Cloud storage
└── utils/
    └── urlValidator.js  # URL validation
```

## Security Features

### Data Protection
- AES-256-GCM encryption for sensitive data
- Argon2id hashing for emails
- Secure session management
- Request rate limiting

### Access Control
- Domain-based CORS protection
- File type validation
- Size limits enforcement
- Secure cloud storage access

## Cloud Storage Structure

```
sessions/
├── {sessionId}/
│   ├── UserUploadedImage.{ext}
│   ├── metadata.json
│   ├── analysis.json
│   └── origin.json
```

## Environment Variables

Required secrets in Google Cloud Secret Manager:
- `GOOGLE_CLOUD_PROJECT_ID`
- `GCS_BUCKET_NAME`
- `OPENAI_API_KEY`
- `EMAIL_ENCRYPTION_KEY`
- `SERVICE_ACCOUNT_JSON`

## Dependencies

Core dependencies:
```json
{
  "@google-cloud/storage": "^6.9.2",
  "@google-cloud/vision": "^4.2.0",
  "@google-cloud/secret-manager": "^4.2.0",
  "openai": "^4.0.0",
  "express": "^4.18.2",
  "argon2": "^0.31.2",
  "express-rate-limit": "^7.1.5",
  "validator": "^13.11.0"
}
```

## Error Handling

- Environment-specific error responses
- Detailed error logging
- Graceful failure handling
- Request validation
- Session verification

## Performance Optimizations

- Parallel API processing
- Memory-efficient uploads
- Response caching
- Metadata optimization
- URL validation and filtering

## Development

To run locally:
```bash
npm install
npm start
```

The server will start on port 8080 by default.

## Response Formats

### Visual Search Response
```typescript
interface VisualSearchResponse {
  success: boolean;
  results: {
    openai: {
      category: 'Art' | 'Antique';
      description: string;
    };
    vision: {
      description: {
        labels: string[];
        confidence: number;
      };
      webEntities: Array<{
        entityId: string;
        score: number;
        description: string;
      }>;
      webLabels: Array<{
        label: string;
        score: number;
        languages: string[];
      }>;
      derivedSubjects: string[];
      matches?: {
        exact: Array<{
          url: string;
          score: number;
          type: string;
          metadata: any;
        }>;
        partial: Array<{
          url: string;
          score: number;
          type: string;
          metadata: any;
        }>;
        similar: Array<{
          url: string;
          score: number;
          type: string;
          metadata: any;
        }>;
      };
      pagesWithMatchingImages?: Array<any>;
    };
  };
  message?: string;
  error?: string; // Only in development
}
```

### Origin Analysis Response
```typescript
interface OriginAnalysisResponse {
  success: boolean;
  message: string;
  results: {
    timestamp: number;
    matches: {
      exact: Array<ImageMatch>;
      partial: Array<ImageMatch>;
      similar: Array<ImageMatch>;
    };
    originAnalysis: {
      originality: 'original' | 'reproduction';
      confidence: number;
      style_analysis: string;
      unique_characteristics: string[];
      comparison_notes: string;
      recommendation: string;
    };
    webEntities: Array<{
      entityId: string;
      score: number;
      description: string;
    }>;
    visionLabels: {
      labels: string[];
      confidence: number;
    };
    openaiAnalysis: {
      category: string;
      description: string;
    };
    imageMetadata: {
      imageUrl: string;
      originalName: string;
      mimeType: string;
      size: number;
      url: string;
      userImage: string;
    };
  };
}
```