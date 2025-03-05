# Appraisals Web Services API Documentation

This document provides comprehensive documentation for all endpoints available in the Appraisals Web Services API.

## API Response Format

All API responses follow a standard format:

```json
{
  "success": true | false,
  "data": {
    // Response data specific to the endpoint
  },
  "error": null | {
    "code": "ERROR_CODE",
    "message": "Error message",
    "details": {}
  }
}
```

## Endpoints

### 1. Upload Image

Uploads an image file for analysis.

- **URL:** `/upload-temp`
- **Method:** `POST`
- **Content-Type:** `multipart/form-data`

**Request Parameters:**

| Parameter | Type   | Required | Description                                 |
|-----------|--------|----------|---------------------------------------------|
| image     | File   | Yes      | Image file (JPEG, PNG, WebP, max 10MB)      |

**Response:**

```json
{
  "success": true,
  "data": {
    "sessionId": "string",
    "imageUrl": "string"
  },
  "error": null
}
```

### 2. Get Session Data

Retrieves all data associated with a session, including metadata, analysis results, and origin analysis.

- **URL:** `/session/:sessionId`
- **Method:** `GET`

**URL Parameters:**

| Parameter | Type   | Required | Description          |
|-----------|--------|----------|----------------------|
| sessionId | string | Yes      | Session identifier   |

**Response:**

```json
{
  "success": true,
  "data": {
    "session": {
      "id": "string",
      "metadata": {
        "originalName": "string",
        "timestamp": "number",
        "analyzed": "boolean",
        "mimeType": "string",
        "size": "number",
        "fileName": "string",
        "imageUrl": "string"
      },
      "analysis": {
        "timestamp": "number",
        "vision": {
          "webEntities": [],
          "matches": {
            "exact": [],
            "partial": [],
            "similar": []
          },
          "description": {
            "labels": [],
            "confidence": "number"
          }
        },
        "openai": {}
      },
      "origin": {}
    }
  },
  "error": null
}
```

### 3. Visual Search

Performs visual analysis on the uploaded image using Google Vision API and OpenAI.

- **URL:** `/visual-search`
- **Method:** `POST`
- **Content-Type:** `application/json`

**Request Body:**

```json
{
  "sessionId": "string"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Visual search completed successfully.",
  "results": {
    "vision": {
      "description": {
        "labels": ["string"],
        "confidence": "number"
      },
      "webEntities": [
        {
          "entityId": "string",
          "score": "number",
          "description": "string"
        }
      ],
      "matches": {
        "exact": [],
        "partial": [],
        "similar": [
          {
            "url": "string",
            "score": "number",
            "storedImage": {
              "storedUrl": "string"
            }
          }
        ]
      },
      "pagesWithMatchingImages": [],
      "webLabels": []
    },
    "openai": {
      "description": "string",
      "tags": ["string"]
    }
  },
  "analyzed": true,
  "analysisTimestamp": "number"
}
```

### 4. Origin Analysis

Analyzes the artwork's origin and authenticity based on the uploaded image.

- **URL:** `/origin-analysis`
- **Method:** `POST`
- **Content-Type:** `application/json`

**Request Body:**

```json
{
  "sessionId": "string"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "origin": {
      "originality": "string",
      "confidence": "number",
      "style_analysis": "string",
      "unique_characteristics": ["string"],
      "estimated_era": "string",
      "estimated_origin": "string",
      "material_or_medium": "string",
      "comparison_notes": "string",
      "recommendation": "string"
    }
  },
  "error": null
}
```

### 5. Full Analysis

Performs a comprehensive detailed analysis of the artwork using OpenAI.

- **URL:** `/full-analysis`
- **Method:** `POST`
- **Content-Type:** `application/json`

**Request Body:**

```json
{
  "sessionId": "string"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "detailedAnalysis": {
      "concise_description": "string",
      "detailed_analysis": "string",
      "artist_identification": {
        "artist_name": "string",
        "confidence": "number",
        "similar_artists": ["string"]
      },
      "style_period": "string",
      "subject_matter": "string",
      "composition": "string",
      "color_palette": "string",
      "condition_assessment": "string",
      "signature_analysis": "string",
      "framing_notes": "string",
      "provenance_indicators": "string",
      "market_relevance": "string",
      "additional_observations": "string"
    }
  },
  "error": null
}
```

### 6. Find Value

Estimates the value range of the artwork based on detailed analysis.

- **URL:** `/find-value`
- **Method:** `POST`
- **Content-Type:** `application/json`

**Request Body:**

```json
{
  "sessionId": "string"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Value estimation completed successfully.",
  "results": {
    "timestamp": "number",
    "query": "string",
    "estimatedValueRange": {
      "low": "number",
      "high": "number",
      "currency": "string"
    },
    "confidence": "string",
    "marketTrends": "string",
    "additionalNotes": "string",
    "auctionResults": [
      {
        "title": "string",
        "price": "number",
        "currency": "string",
        "house": "string",
        "date": "string",
        "description": "string"
      }
    ],
    "auctionResultsCount": "number"
  }
}
```

### 7. Submit Email

Submits an email address to receive the analysis report.

- **URL:** `/submit-email`
- **Method:** `POST`
- **Content-Type:** `application/json`

**Request Body:**

```json
{
  "email": "string",
  "sessionId": "string",
  "name": "string (optional)",
  "subscribeToNewsletter": "boolean (optional)"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Email submitted successfully.",
  "emailHash": "string",
  "submissionTime": "number"
}
```

### 8. API Health Status

Check the health status of the API and its services.

- **URL:** `/api/health/status`
- **Method:** `GET`

**Response:**

```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "version": "string",
    "services": {
      "storage": {
        "status": "healthy | unhealthy",
        "message": "string"
      },
      "pubsub": {
        "status": "healthy | unhealthy",
        "message": "string"
      }
    },
    "timestamp": "string"
  },
  "error": null
}
```

### 9. List API Endpoints

Lists all available API endpoints and their documentation.

- **URL:** `/api/health/endpoints`
- **Method:** `GET`

**Response:**

```json
{
  "success": true,
  "data": {
    "service": "string",
    "version": "string",
    "endpoints": [
      {
        "path": "string",
        "method": "string",
        "description": "string",
        "requiredParams": ["string"],
        "response": {}
      }
    ]
  },
  "error": null
}
```

## Error Handling

When an error occurs, the API returns a standardized error response:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {}
  }
}
```

Common error codes:

| Error Code | HTTP Status | Description |
|------------|-------------|-------------|
| NOT_FOUND | 404 | The requested resource was not found |
| VALIDATION_ERROR | 400 | Request validation failed |
| SERVER_ERROR | 500 | Internal server error |
| RATE_LIMIT_EXCEEDED | 429 | Too many requests | 