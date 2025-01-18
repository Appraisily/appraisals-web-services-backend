const express = require('express');
const { rateLimit } = require('express-rate-limit');
const cloudServices = require('../services/storage');
const emailService = require('../services/email');
const sheetsService = require('../services/sheets');
const pkg = require('../../package.json');
const os = require('os');

const router = express.Router();

// Rate limiting: 60 requests per minute per IP
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later.'
    }
  }
});

router.use(limiter);

router.get('/endpoints', (req, res) => {
  res.json({
    service: pkg.name,
    version: pkg.version,
    endpoints: [
      {
        path: "/api/route/upload-temp",
        method: 'POST',
        description: 'Upload an image for temporary storage and analysis',
        requiredParams: ['image'],
        response: {
          success: true,
          message: 'Image uploaded successfully.',
          imageUrl: 'https://storage.googleapis.com/bucket-name/path/to/image.jpg',
          sessionId: 'uuid'
        }
      },
      {
        path: "/api/route/session/:sessionId",
        method: 'GET',
        description: 'Get session data including analysis results',
        requiredParams: ['sessionId'],
        response: {
          success: true,
          session: {
            id: 'uuid',
            metadata: {},
            analysis: {},
            origin: {}
          }
        }
      },
      {
        path: "/api/route/visual-search",
        method: 'POST',
        description: 'Perform visual analysis on uploaded image',
        requiredParams: ['sessionId'],
        response: {
          success: true,
          message: 'Visual search completed successfully.',
          results: {
            vision: {},
            openai: {}
          }
        }
      },
      {
        path: "/api/route/origin-analysis",
        method: 'POST',
        description: 'Analyze artwork origin and authenticity',
        requiredParams: ['sessionId'],
        response: {
          success: true,
          message: 'Origin analysis completed successfully.',
          results: {}
        }
      },
      {
        path: "/full-analysis",
        method: 'POST',
        description: 'Perform complete analysis including visual search and origin analysis',
        requiredParams: ['sessionId'],
        response: {
          success: true,
          message: 'Full analysis completed successfully.',
          results: {
            metadata: {},
            visualSearch: {},
            originAnalysis: {}
          },
          timestamp: 'number'
        }
      },
      {
        path: "/submit-email",
        method: 'POST',
        description: 'Submit email for analysis report',
        requiredParams: ['email', 'sessionId'],
        response: {
          success: true,
          message: 'Email submitted successfully.',
          emailHash: 'string',
          submissionTime: 'number'
        }
      },
      {
        path: "/api/health/endpoints",
        method: 'GET',
        description: 'List all available API endpoints',
        requiredParams: [],
        response: {
          service: 'string',
          version: 'string',
          endpoints: []
        }
      },
      {
        path: "/api/health/status",
        method: 'GET',
        description: 'Get service health status',
        requiredParams: [],
        response: {
          status: 'string',
          uptime: 'number',
          timestamp: 'string',
          services: {}
        }
      }
    ]
  });
});

router.get('/status', async (req, res) => {
  try {
    const startTime = process.uptime() * 1000; // Convert to milliseconds

    // Check Google Cloud Storage
    const bucket = cloudServices.getBucket();
    const [bucketExists] = await bucket.exists();
    const storageHealthy = bucketExists;

    // Check Vision API
    const visionClient = cloudServices.getVisionClient();
    const visionHealthy = !!visionClient;

    // Check Email Service
    const emailHealthy = emailService.initialized;

    // Check Sheets Service
    const sheetsHealthy = sheetsService.initialized;

    // Determine overall status
    const allServicesHealthy = storageHealthy && visionHealthy && emailHealthy && sheetsHealthy;
    const status = allServicesHealthy ? 'healthy' : 'degraded';

    const timestamp = new Date().toISOString();

    res.json({
      status,
      uptime: startTime,
      timestamp,
      services: {
        storage: storageHealthy,
        email: emailHealthy,
        sheets: sheetsHealthy
      }
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({
      error: {
        code: 'HEALTH_CHECK_FAILED',
        message: 'Failed to check service health',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      }
    });
  }
});

module.exports = router;