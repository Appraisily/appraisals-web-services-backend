# SCREENER - Appraisals Web Services Backend

A specialized Node.js backend service focused on art and antique image analysis using Google Cloud Vision API and OpenAI Vision. This service provides comprehensive artwork analysis, origin determination, and visual search capabilities, deployed on Google Cloud Run.

## Overview

SCREENER is an AI-powered art and antique analysis system that helps users identify, authenticate, and value artwork through advanced machine learning models.

### Key Features
- Dual analysis system (Google Cloud Vision + OpenAI Vision)
- Origin and authenticity determination
- Visual similarity search
- Value estimation
- Comprehensive image metadata extraction
- Interactive HTML report generation
- Email delivery system

### Tech Stack
- Node.js with Express.js
- Google Cloud Platform (Cloud Run, Storage, Vision, Secret Manager, Pub/Sub)
- OpenAI GPT-4 Vision API
- Google Sheets API

## Installation

1. Clone the repository:
```bash
git clone https://github.com/Appraisily/appraisals-web-services-backend.git
cd appraisals-web-services-backend
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
export SHEETS_ID_FREE_REPORTS_LOG="your-sheets-id"
export PUBSUB_TOPIC_ANALYSIS_COMPLETE="your-pubsub-topic"
```

## Usage

### Running the Server
```bash
npm start
# OR
node index.js
```

### Testing the API
```bash
# Test with a specific session ID
node test-api.js [sessionId]

# Test file upload functionality
node test-api-upload.js [imagePath]
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/upload-temp` | POST | Upload image for analysis |
| `/session/:sessionId` | GET | Get session data |
| `/visual-search` | POST | Visual analysis using AI |
| `/origin-analysis` | POST | Analyze artwork's origin |
| `/full-analysis` | POST | Comprehensive artwork analysis |
| `/find-value` | POST | Estimate artwork value |
| `/submit-email` | POST | Send analysis report by email |
| `/api/health/status` | GET | Check API health status |
| `/api/health/endpoints` | GET | List available endpoints |

For detailed API documentation, see [api-documentation.md](./api-documentation.md).

## Project Structure

```
src/
├── config/             # Configuration files
├── features/           # Feature modules
│   ├── email/          # Email processing
│   └── visualSearch/   # Visual search functionality
├── middleware/         # Global middleware
├── routes/             # API routes
├── services/           # Core services
├── templates/          # Report templates
└── utils/              # Utility functions
```

## Deployment

### Build and Deploy to Cloud Run
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
  --allow-unauthenticated
```

## Development Guidelines

See [CLAUDE.md](./CLAUDE.md) for detailed development guidelines, including:
- Code style and structure
- Error handling patterns
- Response format standards
- Naming conventions

## License

MIT License