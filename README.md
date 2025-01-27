# Art Appraisal Web Services Backend

A robust Node.js backend service for art and antique image analysis using Google Cloud Vision API and OpenAI Vision. This service provides comprehensive artwork analysis, origin determination, and professional reporting capabilities.

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

### Email Features
- Professional HTML email templates
- Secure email encryption
- Rate-limited submissions (5 requests per minute)
- Analysis report generation
- CTA for professional services
- Dynamic SendGrid templates for personalized offers
- Michelle API integration for content generation

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
    "metadata": {
      "originalName": string,
      "timestamp": number,
      "analyzed": boolean,
      "mimeType": string,
      "size": number,
      "imageUrl": string
    },
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
    },
    "visualSearch": object,
    "originAnalysis": object
  },
  "timestamp": number
}
```
- Performs comprehensive analysis including:
  - Detailed AI analysis of maker, signature, origin, marks, and age
  - Visual search results
  - Origin analysis
- Returns combined results from all analyses
- Includes session metadata and timestamp

### Email Submission
```http
POST /submit-email
Content-Type: application/json

{
  "email": "user@example.com",
  "sessionId": "uuid"
}

Response: {
  "success": boolean,
  "message": string,
  "emailHash": string,
  "submissionTime": number
}

#### Process Flow
1. Request Validation
   - Rate limiting check (5 requests per minute per IP)
   - Validates required fields (email and sessionId)
   - Email format validation

2. Session Verification
   - Checks if session exists in cloud storage
   - Loads session metadata

3. Email Security
   - Generates Argon2id hash of email address
   - Encrypts email using AES-256-GCM
   - Stores encrypted email in session metadata

4. Analysis Processing
   - Checks for existing analyses (visual search, origin, detailed)
   - If any analysis is missing:
     - Performs visual search analysis
     - Performs origin analysis
     - Performs detailed analysis
   - All analyses run in parallel for efficiency

5. Report Generation
   - Composes comprehensive HTML report including:
     - Visual analysis results
     - Origin analysis findings
     - Detailed expert analysis
     - Professional recommendations

6. Email Delivery
   - Initial Email:
     - Sends comprehensive analysis report
     - Uses professional HTML template
     - Includes detailed findings and insights
   - Follow-up Email (Immediate):
     - Sent from personal expert email address
     - Uses SendGrid dynamic template
     - Content generated by Michelle API
     - Includes personalized observations about the item
     - Offers special limited-time pricing ($47 instead of $59)
     - 48-hour expiry window for special offer
     - Customized based on analysis results

7. Data Logging
   - Updates Google Sheets log with:
     - Email submission timestamp
     - Session information
     - Analysis status

8. Response
   - Returns success status
   - Includes email hash for reference
   - Provides submission timestamp

#### Security Features
- Rate limiting protection
- Email encryption (AES-256-GCM)
- Secure hash storage (Argon2id)
- No plaintext email storage

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
│   ├── session.js       # Session management
│   ├── upload.js        # File uploads
│   └── visualSearch.js  # Visual search
├── services/
│   ├── email.js         # Email service
│   ├── encryption.js    # AES encryption
│   ├── openai.js        # OpenAI integration
│   ├── originFormatter.js # Analysis formatting
│   ├── reportComposer.js # Email report generation
│   └── storage.js       # Cloud storage
├── templates/
   └── emails.js        # Free report email template
└── utils/
    ├── dateFormatter.js # Date formatting
    └── urlValidator.js  # URL validation
```

## Security Features

### Data Protection
- AES-256-GCM encryption for sensitive data
- Argon2id hashing for emails
- Secure session management
- Request rate limiting
- URL validation with timeouts

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
- `SENDGRID_PERSONAL_EMAIL`
- `DIRECT_API_KEY` (for Michelle API)

## Dependencies

### Core Dependencies
```json
{
  "@google-cloud/storage": "^6.9.2",
  "@google-cloud/vision": "^4.2.0",
  "@google-cloud/secret-manager": "^4.2.0",
  "@sendgrid/mail": "^7.7.0",
  "openai": "^4.0.0",
  "express": "^4.18.2",
  "cors": "^2.8.5",
  "multer": "^1.4.5-lts.1",
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
- URL validation timeouts

## Performance Optimizations

- Parallel API processing
- Memory-efficient file uploads using streams
- Response caching
- Metadata optimization
- URL validation with timeouts (5s)
- Limited similar image processing (max 5)
- Parallel API processing for email content generation

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

## License

MIT