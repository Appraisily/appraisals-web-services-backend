# Art Analysis Backend Service

A specialized Node.js backend service focused on art and antique image analysis using Google Cloud Vision API and OpenAI Vision. This service provides comprehensive artwork analysis, origin determination, and visual search capabilities, deployed on Google Cloud Run with automated health checks.

## Table of Contents
- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Requirements](#requirements)
- [Installation](#installation)
- [Configuration](#configuration)
- [Deployment](#deployment)
- [Usage](#usage)
- [Testing](#testing)
- [CI/CD Integration](#cicd-integration)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)
- [Acknowledgments](#acknowledgments)

## Overview

### Purpose
This service provides expert art and antique analysis through AI-powered visual recognition and valuation. It helps users identify, authenticate, and value artwork and antiques using advanced machine learning models.

### Scope
- Image analysis and recognition
- Origin and authenticity determination
- Value estimation
- Detailed artwork analysis reports
- Email report delivery system

### Tech Stack
- Node.js 18
- Express.js
- Google Cloud Platform
  - Cloud Run
  - Cloud Storage
  - Cloud Vision API
  - Secret Manager
  - Pub/Sub
  - Cloud Scheduler
- OpenAI GPT-4 Vision
- Google Sheets API

## Features

### Core Analysis Features
- Dual analysis system using Google Cloud Vision and OpenAI Vision
- Origin analysis for artwork authenticity
- Visual similarity search with parallel API processing
- Value estimation using AI-powered valuation model
- Comprehensive image metadata extraction
- Concise 5-word descriptions for quick item identification

### Technical Features
- RESTful API endpoints
- Automatic scaling with Cloud Run
- Scheduled health checks via Cloud Scheduler
- Secure secret management
- Rate limiting and CORS protection
- Comprehensive error handling
- Detailed logging and monitoring

### Storage & Data Management
- Session-based file organization
- Automatic file cleanup
- Structured JSON storage for analysis results
- Metadata tracking for all uploads
- Similar image storage and management
- Value estimation results storage

## Architecture

### Components
```
src/
├── config/             # Configuration files
│   ├── models.js       # OpenAI model configuration
│   ├── prompts.js      # System prompts for AI analysis
│   └── secrets.js      # Secret management configuration
├── features/           # Feature modules
│   ├── email/         # Email processing feature
│   │   ├── controllers/
│   │   ├── routes/
│   │   ├── services/
│   │   └── utils/
│   └── visualSearch/   # Visual search feature
│       ├── controllers/
│       ├── routes/
│       └── utils/
├── middleware/         # Global middleware
│   └── cors.js        # CORS configuration
├── routes/            # API routes
│   ├── findValue.js   # Value estimation
│   ├── fullAnalysis.js # Complete artwork analysis
│   ├── health.js      # Health check endpoints
│   ├── session.js     # Session management
│   └── upload.js      # File upload handling
├── services/          # Core services
│   ├── openai.js      # OpenAI integration
│   ├── pubsub.js      # Pub/Sub message publishing
│   ├── storage.js     # Cloud storage management
│   └── sheets.js      # Google Sheets integration
└── utils/             # Utility functions
    └── urlValidator.js # URL validation utilities
```

### Request Flow
1. Client uploads image → Temporary storage in GCS
2. Visual analysis triggered → Parallel processing with Vision API and OpenAI
3. Origin analysis → Combines visual search results with AI analysis
4. Value estimation → Based on detailed analysis
5. Report generation → Comprehensive HTML report
6. Email delivery → Async processing and CRM notification

## Requirements

### Prerequisites
1. Google Cloud Account with enabled APIs:
   - Cloud Run API
   - Cloud Build API
   - Cloud Scheduler API
   - Secret Manager API
   - Cloud Storage API
   - Cloud Vision API
   - Cloud Pub/Sub API
2. Node.js 18 or later
3. Docker for containerization
4. Google Cloud SDK
5. OpenAI API key

## Installation

1. Clone the repository:
```bash
git clone [repository-url]
cd art-analysis-backend
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
export GOOGLE_CLOUD_PROJECT_ID="your-project-id"
export GCS_BUCKET_NAME="your-bucket-name"
export OPENAI_API_KEY="your-openai-key"
```

## Configuration

### Environment Variables
Required environment variables:
- `GOOGLE_CLOUD_PROJECT_ID`: GCP project identifier
- `GCS_BUCKET_NAME`: Cloud Storage bucket name
- `OPENAI_API_KEY`: OpenAI API key
- `SHEETS_ID_FREE_REPORTS_LOG`: Google Sheets ID for logging
- `PUBSUB_TOPIC_ANALYSIS_COMPLETE`: Pub/Sub topic name

### Secrets Management
All sensitive configuration is managed through Google Cloud Secret Manager:
- Service account credentials
- API keys
- Encryption keys
- Email configuration

## Deployment

### Build and Deploy
```bash
# Build container
docker build -t gcr.io/[PROJECT_ID]/art-analysis-backend .

# Push to Container Registry
docker push gcr.io/[PROJECT_ID]/art-analysis-backend

# Deploy to Cloud Run
gcloud run deploy art-analysis-backend \
  --image gcr.io/[PROJECT_ID]/art-analysis-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --timeout 300 \
  --set-env-vars "GOOGLE_CLOUD_PROJECT_ID=[PROJECT_ID]" \
  --set-secrets "OPENAI_API_KEY=openai-api-key:latest,GCS_BUCKET_NAME=gcs-bucket-name:latest"
```

### Health Monitoring
```bash
# Create scheduler job for health checks
gcloud scheduler jobs create http keep-alive-art-analysis \
  --schedule="*/30 * * * *" \
  --uri="https://[SERVICE_URL]/api/health/status" \
  --http-method=GET \
  --attempt-deadline=30s \
  --time-zone="UTC" \
  --location=us-central1
```

## Usage

### API Endpoints

#### File Upload
```bash
POST /upload-temp
Content-Type: multipart/form-data
Body: { "image": <file> }
```

#### Analysis Endpoints
```bash
POST /visual-search
Body: { "sessionId": "uuid" }

POST /origin-analysis
Body: { "sessionId": "uuid" }

POST /full-analysis
Body: { "sessionId": "uuid" }

POST /find-value
Body: { "sessionId": "uuid" }
```

#### Email Submission
```bash
POST /submit-email
Body: {
  "email": "user@example.com",
  "sessionId": "uuid"
}
```

#### Health Check
```bash
GET /api/health/status
```

## Testing
Run tests using:
```bash
npm test
```

## CI/CD Integration
Automated deployment pipeline using Cloud Build:
1. Build and test
2. Security scanning
3. Container build
4. Deployment to Cloud Run

## Troubleshooting

### Common Issues
1. Image upload failures
   - Check file size (max 10MB)
   - Verify supported formats (JPEG, PNG, WebP)
2. Analysis timeout
   - Check service memory allocation
   - Verify API quotas

### Logging
```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=art-analysis-backend"
```

## Contributing
1. Fork the repository
2. Create a feature branch
3. Follow code style guidelines
4. Submit pull request

## License
MIT License

## Acknowledgments
- Google Cloud Platform
- OpenAI
- Node.js community