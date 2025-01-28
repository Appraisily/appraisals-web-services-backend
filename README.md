# Art Appraisal Web Services Backend

A robust Node.js backend service for art and antique image analysis using Google Cloud Vision API and OpenAI Vision. This service provides comprehensive artwork analysis, origin determination, and professional reporting capabilities.

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
    │   ├── email.js         # Email submission handling
    │   ├── fullAnalysis.js  # Complete artwork analysis
    │   ├── health.js        # Health check endpoints
    │   ├── originAnalysis.js # Origin determination
    │   ├── session.js       # Session management
    │   ├── upload.js        # File upload handling
    │   └── visualSearch.js  # Visual search processing
    ├── services/
    │   ├── email/
    │   │   ├── AnalysisService.js  # Analysis processing
    │   │   ├── MichelleService.js  # Personal offer generation
    │   │   ├── SendGridService.js  # Email delivery
    │   │   ├── analysis.js         # Analysis orchestration
    │   │   ├── delivery.js         # Email delivery orchestration
    │   │   ├── index.js            # Main email service
    │   │   └── validation.js       # Email validation
    │   ├── encryption.js     # AES encryption utilities
    │   ├── openai.js         # OpenAI integration
    │   ├── originFormatter.js # Analysis formatting
    │   ├── reportComposer.js # Email report generation
    │   ├── sheets.js         # Google Sheets integration
    │   └── storage.js        # Cloud storage management
    ├── templates/
    │   ├── emails.js         # Free report email template
    │   └── personalOffer.html # Personal offer template
    └── utils/
        ├── dateFormatter.js   # Date formatting utilities
        └── urlValidator.js    # URL validation utilities
```

## Status

✅ **Production Ready**
- All core features implemented and tested
- Email reporting system operational
- Rate limiting and security measures in place
- Cloud storage integration complete
- API endpoints fully documented

## Core Features

### Image Analysis
- Dual analysis system using Google Cloud Vision and OpenAI Vision
- Origin analysis for artwork authenticity
- Visual similarity search with parallel API processing
- Comprehensive image metadata extraction

### Security & Privacy
- Email encryption using AES-256-GCM
- Argon2 password hashing
- Rate limiting protection (5 requests per minute)
- Secure session management
- CORS protection with domain allowlist
- Request timeout handling (5s for external resources)

### Storage & Data Management
- Session-based file organization
- Automatic file cleanup
- Structured JSON storage for analysis results
- Metadata tracking for all uploads
- Efficient URL validation with timeouts

### Cloud Integration
- Google Cloud Storage for file management
- Google Cloud Secret Manager for secure configuration
- Google Cloud Vision API for image analysis
- OpenAI GPT-4 Vision for expert analysis
- SendGrid for email delivery
- Google Sheets for logging and tracking

### Email Features
- Professional HTML email templates
- Secure email encryption
- Rate-limited submissions
- Dynamic email content generation
- Personalized offer emails
- Comprehensive analysis reports
- Smart retry logic for analysis completion
- Parallel email delivery

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

### Email Submission
```http
POST /submit-email
Content-Type: application/json

{
  "email": string,
  "sessionId": string
}

Response: {
  "success": boolean,
  "message": string,
  "emailHash": string,
  "submissionTime": number
}
```

## Data Logging

### Google Sheets Structure
The application logs all operations to a Google Sheet with the following columns:

```
A: Row Number
B: Session ID
C: Upload Time
D: Image URL
E: Analysis Status
F: Analysis Time
G: Origin Status
H: Origin Time
I: Email
J: Email Submission Time
K: Free Report Status
L: Free Report Time
M: Offer Status
N: Offer Time
O: Offer Delivered
P: Offer Content
```

## Required Environment Variables

The following secrets must be configured in Google Cloud Secret Manager:
- `GOOGLE_CLOUD_PROJECT_ID`
- `GCS_BUCKET_NAME`
- `OPENAI_API_KEY`
- `EMAIL_ENCRYPTION_KEY`
- `SERVICE_ACCOUNT_JSON`
- `SENDGRID_API_KEY`
- `SENDGRID_EMAIL`
- `SEND_GRID_TEMPLATE_FREE_REPORT`
- `SEND_GRID_TEMPLATE_PERSONAL_OFFER`
- `DIRECT_API_KEY` (for Michelle API)
- `SHEETS_ID_FREE_REPORTS_LOG`

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
docker build -t art-appraisal-backend .
docker run -p 8080:8080 art-appraisal-backend
```