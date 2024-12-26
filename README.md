# Art Appraisal Web Services Backend

A robust Node.js backend service for art and antique image analysis using Google Cloud Vision API and OpenAI Vision.

## Core Features

### Image Analysis
- Dual analysis system using Google Cloud Vision and OpenAI Vision
- Origin analysis for artwork authenticity
- Visual similarity search with parallel API processing
- Comprehensive image metadata extraction

### Security & Privacy
- Email encryption using AES-256-GCM
- Argon2 password hashing
- Rate limiting protection
- Secure session management
- CORS protection with domain allowlist

### Storage
- Session-based file organization
- Automatic file cleanup
- Structured JSON storage for analysis results
- Metadata tracking for all uploads

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
- 10MB file size limit with validation
- Returns session ID and image URL
- Creates session storage structure

### Session Data
```http
GET /session/{sessionId}

Response: {
  "success": boolean,
  "session": {
    "id": string,
    "metadata": {
      "originalName": string,
      "timestamp": number,
      "analyzed": boolean,
      "mimeType": string,
      "size": number,
      "imageUrl": string
    },
    "analysis": object | null,
    "origin": object | null
  }
}
```
- Returns complete session data including metadata
- Includes analysis and origin results if available
- Returns 404 if session not found

### Visual Analysis
```http
POST /visual-search
Content-Type: application/json

{
  "sessionId": "uuid"
}

Response: {
  "success": boolean,
  "message": string,
  "results": {
    "vision": {
      "webEntities": Array<Entity>,
      "description": {
        "labels": string[],
        "confidence": number
      },
      "matches": {
        "exact": Array<Match>,
        "partial": Array<Match>,
        "similar": Array<Match>
      }
    },
    "openai": {
      "category": "Art" | "Antique",
      "description": string
    }
  }
}
```
- Performs parallel Google Vision and OpenAI analysis
- Uses OpenAI model `gpt-4-vision-preview` for visual analysis
- Returns comprehensive image analysis results
- Saves results to `analysis.json` in session storage

### Origin Analysis
```http
POST /origin-analysis
Content-Type: application/json

{
  "sessionId": "uuid"
}

Response: {
  "success": boolean,
  "message": string,
  "results": {
    "timestamp": number,
    "matches": {
      "exact": Array<Match>,
      "partial": Array<Match>,
      "similar": Array<Match>
    },
    "originAnalysis": {
      "originality": "original" | "reproduction",
      "confidence": number,
      "style_analysis": string,
      "unique_characteristics": string[],
      "comparison_notes": string,
      "recommendation": string
    },
    "webEntities": Array<Entity>,
    "visionLabels": {
      "labels": string[],
      "confidence": number
    },
    "openaiAnalysis": {
      "category": string,
      "description": string
    },
    "imageMetadata": {
      "imageUrl": string,
      "originalName": string,
      "mimeType": string,
      "size": number,
      "url": string,
      "userImage": string
    }
  }
}
```
- Analyzes artwork originality
- Compares with similar images
- Uses OpenAI model `gpt-4-vision-preview` for origin analysis
- Provides expert analysis and recommendations
- Saves results to `origin.json` in session storage

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
│   ├── metadata.json      # Upload metadata and session info
│   ├── analysis.json      # Visual search analysis results
│   └── origin.json        # Origin analysis results
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
- Google Cloud: Storage, Vision API, Secret Manager
- OpenAI API for image analysis
- Express.js for API routing
- Security: Argon2, express-rate-limit, validator
- File handling: multer, mime-types
- Utilities: uuid, node-fetch

## Error Handling

- Environment-specific error responses
- Detailed error logging
- Graceful failure handling
- Request validation
- Session verification

## Performance Optimizations

- Parallel API processing
- Memory-efficient file uploads using streams
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