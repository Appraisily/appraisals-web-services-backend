const express = require('express');
const { rateLimit } = require('express-rate-limit');
const cloudServices = require('../services/storage');
const pubsubService = require('../services/pubsub');
const pkg = require('../../package.json');
const { ServerError } = require('../utils/errors');

const router = express.Router();

// Rate limiting: 60 requests per minute per IP
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    data: null,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later.',
      details: { retryAfter: '60 seconds' }
    }
  }
});

router.use(limiter);

router.get('/endpoints', (req, res) => {
  res.json({
    success: true,
    data: {
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
            data: {
              imageUrl: 'https://storage.googleapis.com/bucket-name/path/to/image.jpg',
              sessionId: 'uuid'
            },
            error: null
          }
        },
        {
          path: "/api/route/session/:sessionId",
          method: 'GET',
          description: 'Get session data including analysis results',
          requiredParams: ['sessionId'],
          response: {
            success: true,
            data: {
              session: {
                id: 'uuid',
                metadata: {},
                analysis: {},
                origin: {}
              }
            },
            error: null
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
    },
    error: null
  });
});

router.get('/status', async (req, res, next) => {
  try {
    // Check storage service
    const storageStatus = await checkStorage();
    
    // Check pub/sub service
    const pubsubStatus = await checkPubSub();
    
    // Return the status with standardized response format
    res.json({
      success: true,
      data: {
        status: 'healthy',
        version: pkg.version,
        services: {
          storage: storageStatus,
          pubsub: pubsubStatus,
          // Add other services as needed
        },
        timestamp: new Date().toISOString()
      },
      error: null
    });
  } catch (error) {
    next(error);
  }
});

async function checkStorage() {
  try {
    // Check if storage service is initialized
    if (!cloudServices.isInitialized()) {
      throw new ServerError('Storage service not initialized');
    }
    
    // Try to list files to verify access
    const [files] = await cloudServices.getBucket().getFiles({ maxResults: 1 });
    return { status: 'healthy', message: 'Storage service is operating normally' };
  } catch (error) {
    console.error('Storage health check failed:', error);
    return { 
      status: 'unhealthy', 
      message: 'Storage service check failed',
      error: error.message
    };
  }
}

async function checkPubSub() {
  try {
    // Check if pub/sub service is initialized
    if (!pubsubService.isInitialized()) {
      throw new ServerError('Pub/Sub service not initialized');
    }
    
    // Other pub/sub checks can be added here
    return { status: 'healthy', message: 'Pub/Sub service is operating normally' };
  } catch (error) {
    console.error('Pub/Sub health check failed:', error);
    return { 
      status: 'unhealthy', 
      message: 'Pub/Sub service check failed',
      error: error.message 
    };
  }
}

module.exports = router;