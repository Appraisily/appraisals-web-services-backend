# SCREENER - Appraisals Web Services Backend

A sophisticated Node.js microservice for art and antique image analysis, deployed on Google Cloud Run. This service provides comprehensive artwork analysis using Google Cloud Vision API and OpenAI Vision models, with advanced origin determination, visual search capabilities, and automated report generation.

## Technical Overview

SCREENER is an AI-powered art analysis system that combines multiple machine learning models to provide detailed artwork identification, authentication, valuation, and comprehensive reporting. The service operates as a stateless microservice with session-based data management through Google Cloud Storage.

### Core Architecture
- **Runtime**: Node.js 18
- **Framework**: Express.js with middleware architecture
- **Deployment**: Google Cloud Run (containerized)
- **Storage**: Google Cloud Storage for session management
- **AI Services**: Google Cloud Vision API + OpenAI GPT-4o/o1/o3 models
- **Communication**: Google Pub/Sub for async processing
- **Monitoring**: Google Sheets API for logging and analytics
- **Security**: Google Secret Manager for credential management

### Key Capabilities
- Dual AI analysis pipeline (Google Vision + OpenAI Vision)
- Multi-stage artwork authentication and origin analysis
- Visual similarity matching with stored image repository
- Market value estimation and comparative analysis
- Interactive HTML report generation with embedded analytics
- Email delivery system with templated reports
- Session-based workflow management
- Comprehensive health monitoring and endpoint documentation

## Complete File Structure

```
appraisals-web-services-backend/
├── index.js                           # Main application entry point (68 lines)
├── package.json                       # Dependencies and project configuration (29 lines)
├── Dockerfile                         # Container deployment configuration (23 lines)
├── README.md                         # This documentation (123 lines)
├── CLAUDE.md                         # Development guidelines (27 lines)
├── .gitignore                        # Git ignore rules (2 lines)
├── api-documentation.md              # API documentation (411 lines)
└── src/                              # Source code directory
    ├── config/                       # Configuration files
    │   ├── models.js                 # OpenAI model configuration (22 lines)
    │   ├── prompts.js                # AI analysis prompts (410 lines)
    │   └── secrets.js                # Secret Manager integration (73 lines)
    ├── middleware/                   # Global middleware
    │   └── cors.js                   # CORS configuration (30 lines)
    ├── services/                     # Core business logic services
    │   ├── storage.js                # Google Cloud Storage service (236 lines)
    │   ├── openai.js                 # OpenAI API integration (249 lines)
    │   ├── sheets.js                 # Google Sheets logging service (145 lines)
    │   ├── pubsub.js                 # Google Pub/Sub messaging (41 lines)
    │   ├── auctionData.js            # Auction data processing (147 lines)
    │   ├── keywordExtraction.js      # Text analysis utilities (134 lines)
    │   └── originFormatter.js        # Origin analysis formatting (68 lines)
    ├── routes/                       # API route handlers
    │   ├── upload.js                 # File upload endpoint (139 lines)
    │   ├── session.js                # Session management (211 lines)
    │   ├── health.js                 # Health check endpoints (181 lines)
    │   ├── originAnalysis.js         # Origin analysis endpoint (381 lines)
    │   ├── fullAnalysis.js           # Complete analysis workflow (115 lines)
    │   ├── findValue.js              # Value estimation endpoint (461 lines)
    │   └── premiumData.js            # Premium data access (173 lines)
    ├── features/                     # Feature-specific modules
    │   ├── email/                    # Email processing feature
    │   │   ├── routes/
    │   │   │   └── index.js          # Email route configuration (25 lines)
    │   │   ├── controllers/          # Email business logic
    │   │   ├── services/             # Email-specific services
    │   │   ├── templates/            # Email templates
    │   │   └── utils/                # Email utilities
    │   └── visualSearch/             # Visual search feature
    │       ├── routes/
    │       │   └── index.js          # Visual search routes (8 lines)
    │       ├── controllers/
    │       │   └── visualSearchController.js  # Visual analysis logic (162 lines)
    │       └── utils/                # Visual search utilities
    ├── utils/                        # Shared utilities
    │   └── urlValidator.js           # URL validation utilities (62 lines)
    └── templates/                    # Report templates
        ├── interactiveReport.js      # Interactive report generator (648 lines)
        └── components/               # Report components
```

## Core Classes and Services

### CloudServices Class (`src/services/storage.js`)
Primary service for Google Cloud Platform integration and storage management.

#### Methods:
- `initialize(projectId, keyFilePath, bucketName, openaiApiKey)` - Initialize all cloud services
- `getBucket()` - Get Google Cloud Storage bucket instance
- `getVisionClient()` - Get Google Vision API client
- `getSessionMetadata(sessionId)` - Retrieve session metadata from storage
- `generateHtmlReport(sessionId)` - Generate HTML analysis report
- `generateInteractiveReport(sessionId)` - Generate interactive HTML report with embedded analytics

#### Properties:
- `storage` - Google Cloud Storage client instance
- `bucket` - Active storage bucket reference
- `visionClient` - Google Vision API client instance

### OpenAIService Class (`src/services/openai.js`)
Manages all OpenAI API interactions and AI model orchestration.

#### Methods:
- `initialize(apiKey)` - Initialize OpenAI client with API key
- `analyzeImage(imageUrl, prompt, modelType)` - Analyze image with specified AI model
- `analyzeOrigin(userImageUrl, similarImages, prompt)` - Multi-image origin analysis
- `analyzeWithFullPrompt(imageUrl)` - Comprehensive image analysis
- `generateHtmlReport(analysisData)` - Generate HTML report using AI
- `generateInteractiveReport(analysisData)` - Generate interactive report using AI

#### Supported Models:
- `gpt-4o` - Visual search and standard analysis
- `o1` - Complex origin and authenticity analysis
- `o3-mini` - HTML report generation
- `o3` - Interactive report generation

### SheetsService (`src/services/sheets.js`)
Google Sheets integration for logging and analytics.

#### Methods:
- `initialize(keyFilePath, sheetsId)` - Initialize Google Sheets API client
- `logUpload(sessionId, timestamp, imageUrl)` - Log image upload events
- `findRowBySessionId(sessionId)` - Find existing session in sheets
- Sheet update methods for analysis progress tracking

### PubSubService (`src/services/pubsub.js`)
Google Pub/Sub messaging for asynchronous processing.

#### Methods:
- `initialize(projectId, topicName)` - Initialize Pub/Sub client
- Message publishing and subscription management

## Complete API Endpoints Documentation

### 1. File Upload Endpoint
**Endpoint**: `POST /upload-temp`
**Purpose**: Upload image files for analysis with session creation

#### Request Parameters:
```json
{
  "image": "File (multipart/form-data)",
  "Content-Type": "multipart/form-data"
}
```

#### Request Constraints:
- Maximum file size: 10MB
- Supported formats: JPEG, PNG, WebP
- Single file upload only

#### Response Format:
```json
{
  "success": true,
  "message": "Image uploaded successfully.",
  "imageUrl": "https://storage.googleapis.com/bucket-name/sessions/{sessionId}/UserUploadedImage.{ext}",
  "sessionId": "uuid-v4-string"
}
```

#### Error Responses:
- `400`: No file uploaded or invalid file type
- `500`: Storage or processing error

#### Processing Flow:
1. Validate file type and size
2. Generate UUID session ID
3. Create session folder in GCS
4. Upload image to `sessions/{sessionId}/UserUploadedImage.{ext}`
5. Save session metadata to `sessions/{sessionId}/metadata.json`
6. Log upload to Google Sheets
7. Return session details

---

### 2. Session Retrieval Endpoint
**Endpoint**: `GET /session/:sessionId`
**Purpose**: Retrieve complete session data including all analysis results

#### URL Parameters:
- `sessionId` (required): UUID session identifier

#### Response Format:
```json
{
  "success": true,
  "session": {
    "id": "uuid-string",
    "metadata": {
      "originalName": "filename.jpg",
      "timestamp": 1640995200000,
      "analyzed": true,
      "mimeType": "image/jpeg",
      "size": 2048576,
      "fileName": "UserUploadedImage.jpg",
      "imageUrl": "https://storage.googleapis.com/...",
      "analysisTimestamp": 1640995300000,
      "originAnalyzed": true,
      "originAnalysisTimestamp": 1640995400000
    },
    "analysis": {
      "timestamp": 1640995300000,
      "vision": {
        "webEntities": [...],
        "matches": {...},
        "description": {...}
      },
      "openai": {
        "category": "painting",
        "description": "..."
      }
    },
    "origin": {
      "originality": "reproduction",
      "confidence": 0.85,
      "style_analysis": "...",
      "estimated_era": "19th century",
      "estimated_origin": "Europe"
    },
    "detailed": {
      "comprehensive_analysis": "...",
      "technical_details": {...}
    }
  }
}
```

#### Error Responses:
- `400`: Missing session ID
- `404`: Session not found
- `500`: Storage access error

---

### 3. Session Status Endpoint
**Endpoint**: `GET /session/:sessionId/status`
**Purpose**: Get real-time analysis progress and status

#### URL Parameters:
- `sessionId` (required): UUID session identifier

#### Response Format:
```json
{
  "success": true,
  "data": {
    "sessionId": "uuid-string",
    "status": "processing|complete|starting",
    "visual_progress": {
      "status": "complete|processing|pending",
      "percent": 100
    },
    "details_progress": {
      "status": "complete|processing|pending", 
      "percent": 100
    },
    "origin_progress": {
      "status": "complete|processing|pending",
      "percent": 100
    },
    "market_progress": {
      "status": "processing|pending",
      "percent": 30
    },
    "results": {
      "metadata": {...},
      "visualAnalysis": {...},
      "detailedAnalysis": {...},
      "originAnalysis": {...}
    }
  },
  "timestamp": 1640995500000
}
```

---

### 4. Visual Search Endpoint
**Endpoint**: `POST /visual-search`
**Purpose**: Perform AI-powered visual analysis using Google Vision and OpenAI

#### Request Body:
```json
{
  "sessionId": "uuid-string"
}
```

#### Response Format:
```json
{
  "success": true,
  "message": "Visual search completed successfully.",
  "results": {
    "vision": {
      "webEntities": [
        {
          "entityId": "string",
          "description": "Painting",
          "score": 0.95
        }
      ],
      "matches": {
        "exact": [],
        "partial": [],
        "similar": [
          {
            "url": "https://example.com/image.jpg",
            "score": 0.85,
            "storedImage": {
              "storedUrl": "https://storage.googleapis.com/...",
              "filename": "similar_1.jpg"
            }
          }
        ]
      },
      "description": {
        "labels": [
          {
            "description": "Art",
            "score": 0.98
          }
        ],
        "confidence": 0.95
      },
      "pagesWithMatchingImages": [...],
      "webLabels": [...]
    },
    "openai": {
      "category": "painting",
      "description": "Classical oil painting depicting...",
      "style": "Renaissance",
      "estimated_period": "16th century",
      "technical_analysis": "..."
    }
  },
  "analyzed": true,
  "analysisTimestamp": 1640995300000
}
```

#### Processing Steps:
1. Validate session existence
2. Load session metadata and image
3. Execute parallel analysis:
   - Google Vision web detection
   - OpenAI Vision analysis
4. Download and store similar images
5. Format and combine results
6. Save analysis to `sessions/{sessionId}/analysis.json`
7. Update session metadata
8. Log progress to Google Sheets

---

### 5. Origin Analysis Endpoint
**Endpoint**: `POST /origin-analysis`
**Purpose**: Determine artwork authenticity, origin, and historical context

#### Request Body:
```json
{
  "sessionId": "uuid-string"
}
```

#### Response Format:
```json
{
  "success": true,
  "message": "Origin analysis completed successfully.",
  "results": {
    "originality": "original|reproduction|unknown",
    "confidence": 0.85,
    "style_analysis": "The artwork demonstrates characteristics typical of...",
    "unique_characteristics": [
      "Brushwork technique",
      "Color palette",
      "Composition style"
    ],
    "estimated_era": "19th century",
    "estimated_origin": "European, likely French",
    "material_or_medium": "Oil on canvas",
    "comparison_notes": "When compared to similar works...",
    "recommendation": "Further analysis recommended...",
    "matches_analysis": {
      "exact_matches": 0,
      "partial_matches": 2,
      "similar_matches": 5,
      "total_analyzed": 7
    },
    "web_entities_summary": [
      {
        "entity": "Impressionist painting",
        "relevance": 0.92
      }
    ]
  },
  "analyzed": true,
  "analysisTimestamp": 1640995400000
}
```

#### Prerequisites:
- Session must exist
- Visual analysis must be completed (auto-triggered if missing)

#### Processing Flow:
1. Check for existing visual analysis
2. If missing, trigger visual search and wait for completion
3. Extract similar images from analysis results
4. Call OpenAI with user image + up to 5 similar images
5. Format comprehensive origin analysis
6. Save results to `sessions/{sessionId}/origin.json`
7. Update metadata and sheets logging

---

### 6. Full Analysis Endpoint
**Endpoint**: `POST /full-analysis`
**Purpose**: Execute complete analysis workflow (visual + origin + detailed)

#### Request Body:
```json
{
  "sessionId": "uuid-string"
}
```

#### Response Format:
```json
{
  "success": true,
  "message": "Full analysis completed successfully.",
  "results": {
    "metadata": {
      "sessionId": "uuid-string",
      "originalName": "artwork.jpg",
      "analysisComplete": true
    },
    "visualSearch": {
      "vision": {...},
      "openai": {...}
    },
    "originAnalysis": {
      "originality": "...",
      "confidence": 0.85,
      "style_analysis": "..."
    },
    "detailedAnalysis": {
      "comprehensive_analysis": "...",
      "market_context": "...",
      "technical_assessment": "..."
    }
  },
  "timestamp": 1640995500000
}
```

#### Sequential Processing:
1. Trigger visual search analysis
2. Execute origin analysis
3. Perform detailed analysis with full prompt
4. Combine all results
5. Generate comprehensive report

---

### 7. Value Estimation Endpoint
**Endpoint**: `POST /find-value`
**Purpose**: Estimate artwork market value based on analysis results

#### Request Body:
```json
{
  "sessionId": "uuid-string"
}
```

#### Response Format:
```json
{
  "success": true,
  "message": "Value analysis completed successfully.",
  "results": {
    "estimated_value": {
      "range": {
        "low": 1000,
        "high": 5000,
        "currency": "USD"
      },
      "confidence": 0.75,
      "methodology": "Comparative market analysis based on..."
    },
    "market_factors": [
      "Artist recognition",
      "Historical significance", 
      "Condition assessment",
      "Provenance"
    ],
    "comparable_sales": [
      {
        "title": "Similar artwork",
        "sale_price": 2500,
        "sale_date": "2023-06-15",
        "similarity_score": 0.85
      }
    ],
    "market_trends": "...",
    "investment_outlook": "..."
  },
  "timestamp": 1640995600000
}
```

---

### 8. Email Submission Endpoint
**Endpoint**: `POST /submit-email`
**Purpose**: Generate and send analysis report via email

#### Request Body:
```json
{
  "email": "user@example.com",
  "sessionId": "uuid-string",
  "reportType": "standard|premium" // optional
}
```

#### Rate Limiting:
- 5 requests per minute per IP address
- Express rate limiter with trust proxy configuration

#### Response Format:
```json
{
  "success": true,
  "message": "Email submitted successfully.",
  "emailHash": "hashed-email-string",
  "submissionTime": 1640995700000,
  "reportGenerated": true
}
```

#### Processing Steps:
1. Rate limit validation
2. Email format validation
3. Session existence verification
4. Generate interactive HTML report
5. Send email via SendGrid API
6. Hash and store email for privacy
7. Log submission to Google Sheets

---

### 9. Premium Data Endpoint
**Endpoint**: `GET /api/premium/:sessionId`
**Purpose**: Access premium analysis data and detailed reports

#### URL Parameters:
- `sessionId` (required): UUID session identifier

#### Response Format:
```json
{
  "success": true,
  "data": {
    "session": {...},
    "premiumAnalysis": {...},
    "marketData": {...},
    "expertInsights": {...}
  }
}
```

---

### 10. Health Check Endpoints

#### System Status
**Endpoint**: `GET /api/health/status`
**Purpose**: Monitor service health and dependencies

#### Response Format:
```json
{
  "status": "healthy|degraded",
  "uptime": 1234567,
  "timestamp": "2024-01-15T10:30:00.000Z",
  "services": {
    "storage": true,
    "vision": true,
    "pubsub": true
  }
}
```

#### Available Endpoints
**Endpoint**: `GET /api/health/endpoints`
**Purpose**: List all available API endpoints with documentation

#### Response Format:
```json
{
  "service": "appraisals-web-services-backend",
  "version": "1.0.0",
  "endpoints": [
    {
      "path": "/upload-temp",
      "method": "POST",
      "description": "Upload an image for temporary storage and analysis",
      "requiredParams": ["image"],
      "response": {...}
    }
  ]
}
```

## Configuration Management

### Model Configuration (`src/config/models.js`)
Centralized OpenAI model configuration for easy model switching and updates.

```javascript
const OPENAI_MODELS = {
  VISUAL_SEARCH: 'gpt-4o',      // Standard visual analysis
  ORIGIN: 'o1',                  // Complex reasoning for origin analysis
  HTML_REPORT: 'o3-mini',        // Efficient report generation
  INTERACTIVE_REPORT: 'o3',      // Advanced interactive reports
  DEFAULT: 'gpt-4o'
};
```

### Secrets Management (`src/config/secrets.js`)
Google Secret Manager integration for secure credential handling in Cloud Run.

#### Required Secrets:
- `GOOGLE_CLOUD_PROJECT_ID` - GCP project identifier
- `service-account-json` - Service account credentials
- `GCS_BUCKET_NAME` - Storage bucket name
- `OPENAI_API_KEY` - OpenAI API access key
- `EMAIL_ENCRYPTION_KEY` - Email encryption key
- `SENDGRID_API_KEY` - SendGrid API key
- `SENDGRID_EMAIL` - Sender email address
- `SEND_GRID_TEMPLATE_FREE_REPORT` - Email template ID
- `SHEETS_ID_FREE_REPORTS_LOG` - Google Sheets ID for logging
- `PUBSUB_TOPIC_ANALYSIS_COMPLETE` - Pub/Sub topic name

### AI Prompts (`src/config/prompts.js`)
Comprehensive prompt engineering for different analysis types:
- `VISUAL_SEARCH_PROMPT` - Visual analysis and categorization
- `ORIGIN_ANALYSIS_PROMPT` - Authenticity and origin determination
- `FULL_ANALYSIS_PROMPT` - Comprehensive artwork analysis
- `HTML_REPORT_PROMPT` - Report generation instructions
- `INTERACTIVE_REPORT_PROMPT` - Interactive report generation

## Middleware Components

### CORS Configuration (`src/middleware/cors.js`)
Cross-origin resource sharing configuration for web client integration.

```javascript
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests from any origin or specific domains
    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
```

## Utility Functions

### URL Validator (`src/utils/urlValidator.js`)
Image URL validation and filtering utilities:
- `isValidImageUrl(url)` - Validate image URL format
- `filterValidImageUrls(urls)` - Filter array of valid image URLs
- Domain whitelist validation
- Protocol security checks

### Origin Formatter (`src/services/originFormatter.js`)
Standardized formatting for origin analysis results:
- `formatOriginAnalysis(data)` - Format comprehensive origin analysis
- Confidence score normalization
- Structured data output formatting

## Deployment Configuration

### Dockerfile
Optimized for Google Cloud Run deployment:

```dockerfile
FROM node:18
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install --only=production
COPY . .
EXPOSE 8080
CMD [ "npm", "start" ]
```

### Dependencies (package.json)
Production dependencies for Cloud Run optimization:

```json
{
  "dependencies": {
    "@google-cloud/pubsub": "^4.0.7",
    "@google-cloud/secret-manager": "^4.2.0", 
    "@google-cloud/storage": "^6.9.2",
    "@google-cloud/vision": "^4.2.0",
    "cors": "^2.8.5",
    "express": "^4.18.2",
    "express-rate-limit": "^7.1.5",
    "googleapis": "^129.0.0",
    "mime-types": "^2.1.35",
    "multer": "^1.4.5-lts.1",
    "node-fetch": "^2.6.7",
    "openai": "^4.89.0",
    "uuid": "^9.0.0",
    "validator": "^13.11.0"
  }
}
```

## Cloud Run Deployment

### Build and Deploy Commands
```bash
# Build container image
docker build -t gcr.io/[PROJECT_ID]/appraisals-backend .

# Push to Google Container Registry
docker push gcr.io/[PROJECT_ID]/appraisals-backend

# Deploy to Cloud Run
gcloud run deploy appraisals-backend \
  --image gcr.io/[PROJECT_ID]/appraisals-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --timeout 900 \
  --concurrency 100 \
  --min-instances 0 \
  --max-instances 10
```

### Environment Configuration
All configuration is managed through Google Secret Manager for security in Cloud Run:
- No environment variables in deployment
- Runtime secret access through Service Account
- Automatic credential management
- Secure inter-service communication

## Performance and Monitoring

### Health Monitoring
- Continuous service health checks at `/api/health/status`
- Dependency verification (Storage, Vision, Pub/Sub)
- Uptime tracking and performance metrics
- Automatic endpoint documentation at `/api/health/endpoints`

### Rate Limiting
- Global rate limiting: 60 requests/minute for health endpoints
- Email submission: 5 requests/minute per IP
- Express rate limiter with proxy trust configuration
- Graceful rate limit response formatting

### Session Management
- UUID-based session identification
- Cloud Storage session persistence
- Automatic session metadata tracking
- Progress tracking across analysis stages
- Comprehensive logging to Google Sheets

### Error Handling
- Structured error responses with development/production modes
- Comprehensive logging throughout processing pipeline
- Graceful degradation for non-critical failures (sheets logging)
- Automatic retry mechanisms for transient failures

## Security Features

### Authentication & Authorization
- Google Cloud IAM for service-to-service authentication
- Service Account key management through Secret Manager
- No API keys in environment variables or code
- Secure credential rotation support

### Data Protection
- File type validation and size limits
- URL validation for external image processing
- Email hashing for privacy protection
- Secure temporary file handling
- CORS protection for web integration

## Technical Specifications

### Performance Characteristics
- **Concurrency**: Up to 100 concurrent requests per instance
- **Memory**: 2GB allocated per Cloud Run instance
- **CPU**: 2 vCPU allocated per instance
- **Timeout**: 15-minute maximum request timeout
- **Auto-scaling**: 0-10 instances based on demand
- **Cold start**: Optimized for sub-second initialization

### Storage Architecture
- **Session Storage**: `sessions/{sessionId}/` folder structure
- **Image Storage**: Original + processed similar images
- **Metadata**: JSON files for session state management
- **Reports**: Generated HTML reports with embedded analytics
- **Retention**: Configurable retention policies

### AI Model Integration
- **Google Vision**: Web detection, label detection, OCR capabilities
- **OpenAI GPT-4o**: Visual analysis and categorization
- **OpenAI o1**: Complex reasoning for origin analysis
- **OpenAI o3**: Advanced report generation
- **Model Selection**: Dynamic model selection based on analysis type

This microservice provides enterprise-grade art analysis capabilities with comprehensive technical documentation, robust error handling, and production-ready deployment configuration for Google Cloud Run environments.