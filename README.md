# Art Analysis Backend Service

A specialized Node.js backend service focused on art and antique image analysis using Google Cloud Vision API and OpenAI Vision. This service provides comprehensive artwork analysis, origin determination, and visual search capabilities.

## Overview

This service is part of a microservices architecture, specifically handling:
- Image upload and storage
- Visual similarity analysis
- Origin determination
- Detailed artwork analysis

The service communicates with other components through Google Cloud Pub/Sub for asynchronous operations like email notifications and user communications.

## Repository Structure

```
.
├── Dockerfile
├── README.md
├── index.js
├── package.json
└── src/
    ├── config/
    │   ├── models.js        # OpenAI model configuration
    │   ├── prompts.js       # System prompts for AI analysis
    │   └── secrets.js       # Secret management configuration
    ├── middleware/
    │   └── cors.js          # CORS configuration
    ├── routes/
    │   ├── fullAnalysis.js  # Complete artwork analysis
    │   ├── health.js        # Health check endpoints
    │   ├── originAnalysis.js # Origin determination
    │   ├── session.js       # Session management
    │   ├── upload.js        # File upload handling
    │   └── visualSearch.js  # Visual search processing
    ├── services/
    │   ├── openai.js        # OpenAI integration
    │   ├── pubsub.js        # Pub/Sub message publishing
    │   ├── storage.js       # Cloud storage management
    │   └── vision.js        # Google Vision integration
    └── utils/
        ├── validators.js    # Input validation utilities
        └── formatters.js    # Response formatting utilities
```

## Core Features

### Image Analysis
- Dual analysis system using Google Cloud Vision and OpenAI Vision
- Origin analysis for artwork authenticity
- Visual similarity search with parallel API processing
- Comprehensive image metadata extraction

### Storage & Data Management
- Session-based file organization
- Automatic file cleanup
- Structured JSON storage for analysis results
- Metadata tracking for all uploads

### Cloud Integration
- Google Cloud Storage for file management
- Google Cloud Secret Manager for secure configuration
- Google Cloud Vision API for image analysis
- OpenAI GPT-4 Vision for expert analysis
- Google Cloud Pub/Sub for event publishing

## API Endpoints

### Step-by-Step Endpoint Actions

#### 1. Image Upload (`POST /upload-temp`)
Handles the initial image upload and creates a new analysis session.

1. **Request Validation**
   - Validates presence of image file
   - Checks file type (JPEG, PNG, WebP only)
   - Enforces 10MB size limit

2. **Session Creation**
   - Generates unique session ID (UUID)
   - Creates session folder in Google Cloud Storage
   - Standardizes image filename: `UserUploadedImage.[ext]`

3. **Metadata Generation**
   ```json
   {
     "originalName": "string",
     "timestamp": "number",
     "analyzed": false,
     "mimeType": "string",
     "size": "number",
     "fileName": "string",
     "imageUrl": "string"
   }
   ```

4. **Storage Operations**
   - Creates session folder structure:
     ```
     sessions/{sessionId}/
     ├── UserUploadedImage.[ext]
     └── metadata.json
     ```
   - Uploads image with public caching (3600s)
   - Saves metadata with no-cache setting

5. **Logging**
   - Logs upload to Google Sheets:
     - Timestamp
     - Session ID
     - Upload time
     - Image URL

6. **Response Format**
   ```typescript
   {
     success: boolean;
     message?: string;  // Optional error message if success is false
     imageUrl: string;  // URL of the uploaded image
     sessionId: string;  // Unique session identifier
   }
   ```

7. **Error Handling**
   - Invalid file type: 400 Bad Request
   - Missing file: 400 Bad Request
   - Storage errors: 500 Internal Server Error
   - Metadata errors: 500 Internal Server Error
   - Sheets logging: Non-blocking (continues on error)

#### 2. Session Data (`GET /session/{sessionId}`)
1. User provides a session ID
2. System retrieves:
   - Session metadata (file info, timestamps)
   - Visual analysis results (if completed)
   - Origin analysis results (if completed)
3. Returns consolidated session data including:
   - Original upload information
   - Analysis status and results
   - Processing timestamps

#### 3. Visual Analysis (`POST /visual-search`)
1. User submits a session ID for analysis
2. System performs:
   - Google Vision API analysis for web detection
   - OpenAI Vision analysis for expert insights
   - Parallel processing of both analyses
3. Results include:
   - Similar images found online
   - Web entities and labels
   - Category classification
   - Confidence scores
   - Expert description

#### 4. Origin Analysis (`POST /origin-analysis`)
1. User requests origin analysis with session ID
2. System:
   - Retrieves visual analysis (runs it if not exists)
   - Filters and validates similar images
   - Performs OpenAI analysis for authenticity
3. Provides:
   - Originality assessment
   - Style analysis
   - Unique characteristics
   - Comparison with similar works
   - Professional recommendations

#### 5. Full Analysis (`POST /full-analysis`)
1. User requests comprehensive analysis
2. System performs detailed AI analysis including:
   - Maker/artist identification
   - Signature verification
   - Origin determination
   - Marks and hallmarks recognition
   - Age estimation
   - Similar artwork comparison
3. Returns:
   - Complete analysis report
   - All metadata
   - Detailed findings in each category

#### 6. Submit Email (`POST /submit-email`)
1. User submits email with session ID
2. System:
   - Validates email format
   - Associates email with session
   - Queues CRM notification
3. Returns:
   - Submission confirmation
   - Timestamp
   - Processing status

#### 7. Health Check (`GET /api/health/status`)
1. User or monitoring system checks service health
2. System verifies:
   - Storage connectivity
   - Vision API availability
   - Overall service status
3. Returns:
   - Service health status
   - Uptime information
   - Component status details

#### 8. API Documentation (`GET /api/health/endpoints`)
1. User requests API documentation
2. System provides:
   - Complete endpoint listing
   - Required parameters
   - Response formats
   - Service version information

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
    }
  }
}
```

### Full Analysis
```http
POST /full-analysis
Content-Type: application/json

{
  "sessionId": "uuid"
}

Response: {
  "success": boolean,
  "message": string,
  "results": {
    "metadata": object,
    "detailedAnalysis": {
      "maker_analysis": {
        "creator_name": string,
        "reasoning": string
      },
      "signature_check": {
        "signature_text": string,
        "interpretation": string
      },
      "origin_analysis": {
        "likely_origin": string,
        "reasoning": string
      },
      "marks_recognition": {
        "marks_identified": string,
        "interpretation": string
      },
      "age_analysis": {
        "estimated_date_range": string,
        "reasoning": string
      },
      "visual_search": {
        "similar_artworks": string,
        "notes": string
      }
    }
  }
}
```

## Event Publishing

The service publishes events to Google Cloud Pub/Sub for the following scenarios:

### CRM Notification
Topic: `CRM-tasks`
```json
{
  "crmProcess": "screenerNotification",
  "customer": {
    "email": "string"
  },
  "sessionId": "string",
  "metadata": {
    "originalName": "string",
    "imageUrl": "string",
    "mimeType": "string",
    "size": "number"
  },
  "timestamp": "number"
}
```

This message is published when a user submits their email for analysis results. All required analyses (visual, origin, and detailed) must be completed before the message is published.

## Required Environment Variables

The following secrets must be configured in Google Cloud Secret Manager:
- `GOOGLE_CLOUD_PROJECT_ID`
- `GCS_BUCKET_NAME`
- `OPENAI_API_KEY`
- `SERVICE_ACCOUNT_JSON`
- `PUBSUB_TOPIC_ANALYSIS_COMPLETE`

## Development

To run locally:

1. Set up Google Cloud project and enable required APIs
2. Configure secrets in Google Cloud Secret Manager
3. Install dependencies:
```bash
npm install
```

4. Start the server:
```bash
npm start
```

The server will start on port 8080 by default.

## Docker Support

Build and run using Docker:

```bash
docker build -t art-analysis-backend .
docker run -p 8080:8080 art-analysis-backend
```