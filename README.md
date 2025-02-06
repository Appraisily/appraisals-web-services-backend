# Art Analysis Backend Service

A specialized Node.js backend service focused on art and antique image analysis using Google Cloud Vision API and OpenAI Vision. This service provides comprehensive artwork analysis, origin determination, and visual search capabilities, deployed on Google Cloud Run with automated health checks.

## Overview

This service is part of a microservices architecture, specifically handling:
- Image upload and storage
- Visual similarity analysis
- Origin determination
- Detailed artwork analysis
- Automated health monitoring

The service communicates with other components through Google Cloud Pub/Sub for asynchronous operations and maintains high availability through scheduled health checks.

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

### Cloud Integration
- Google Cloud Storage for file management
- Google Cloud Secret Manager for secure configuration
- Google Cloud Vision API for image analysis
- OpenAI GPT-4 Vision for expert analysis
- Google Cloud Pub/Sub for event publishing
- Cloud Scheduler for health monitoring

## Repository Structure

\`\`\`
.
├── Dockerfile                # Container configuration
├── README.md                # Project documentation
├── index.js                 # Application entry point
├── package.json             # Dependencies and scripts
└── src/
    ├── config/             # Configuration files
    │   ├── models.js       # OpenAI model configuration
    │   ├── prompts.js      # System prompts for AI analysis
    │   └── secrets.js      # Secret management configuration
    ├── features/           # Feature modules
    │   └── visualSearch/   # Visual search feature
    │       ├── controllers/
    │       ├── routes/
    │       └── utils/
    ├── middleware/         # Global middleware
    │   └── cors.js        # CORS configuration
    ├── routes/            # API routes
    │   ├── email.js       # Email submission handling
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
\`\`\`

## Prerequisites

1. Google Cloud SDK installed and configured
2. Node.js 18 or later
3. Docker installed (for local development)
4. Enabled Google Cloud APIs:
   - Cloud Run API
   - Cloud Build API
   - Cloud Scheduler API
   - Secret Manager API
   - Cloud Storage API
   - Cloud Vision API
   - Cloud Pub/Sub API

## Local Development

1. Clone the repository:
   \`\`\`bash
   git clone [repository-url]
   cd appraisals-web-services-backend
   \`\`\`

2. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

3. Set up environment variables:
   \`\`\`bash
   export GOOGLE_CLOUD_PROJECT_ID="your-project-id"
   export GCS_BUCKET_NAME="your-bucket-name"
   export OPENAI_API_KEY="your-openai-key"
   \`\`\`

4. Run locally:
   \`\`\`bash
   npm start
   \`\`\`

5. Test the health endpoint:
   \`\`\`bash
   curl http://localhost:8080/api/health/status
   \`\`\`

## Deploying to Cloud Run

1. Build and push the container image:
   \`\`\`bash
   gcloud builds submit --tag gcr.io/[PROJECT_ID]/art-analysis-backend
   \`\`\`

2. Deploy to Cloud Run:
   \`\`\`bash
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
   \`\`\`

## Setting Up Cloud Scheduler

1. Create a scheduler job for health checks:
   \`\`\`bash
   gcloud scheduler jobs create http keep-alive-art-analysis \
     --schedule="*/30 * * * *" \
     --uri="https://[SERVICE_URL]/api/health/status" \
     --http-method=GET \
     --attempt-deadline=30s \
     --time-zone="UTC" \
     --location=us-central1
   \`\`\`

2. Verify the job:
   \`\`\`bash
   gcloud scheduler jobs describe keep-alive-art-analysis --location=us-central1
   \`\`\`

## Logging and Monitoring

### Viewing Logs
\`\`\`bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=art-analysis-backend" --limit 50
\`\`\`

### Monitoring Dashboard
1. Visit the Cloud Run service in Google Cloud Console
2. Navigate to the "Metrics" tab
3. Monitor:
   - Request count
   - Response latency
   - Container instance count
   - Memory utilization

## Contributing Guidelines

1. Fork the repository
2. Create a feature branch
3. Follow the existing code style
4. Add tests for new functionality
5. Update documentation
6. Submit a pull request

### Code Style
- Use ESLint configuration
- Follow Node.js best practices
- Document all functions and modules
- Include error handling
- Add appropriate logging

## License and Support

This project is licensed under the MIT License. See the LICENSE file for details.

For support:
1. Check existing issues
2. Create a new issue with:
   - Clear description
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details

## Health Check Endpoint

The service exposes a health check endpoint at \`/api/health/status\` that returns:

\`\`\`json
{
  "status": "healthy",
  "uptime": 123456,
  "timestamp": "2024-01-01T00:00:00Z",
  "services": {
    "storage": true,
    "vision": true,
    "pubsub": true
  }
}
\`\`\`

This endpoint is called every 30 minutes by Cloud Scheduler to keep the service active and monitor its health.