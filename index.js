const express = require('express');
const { loadSecrets } = require('./src/config/secrets');
const cloudServices = require('./src/services/storage');
const pubsubService = require('./src/services/pubsub');
const sheetsService = require('./src/services/sheets');
const corsMiddleware = require('./src/middleware/cors');
const errorHandler = require('./src/middleware/errorHandler');
const uploadRouter = require('./src/routes/upload');
const visualSearchRouter = require('./src/features/visualSearch/routes');
const sessionRouter = require('./src/routes/session');
const emailRouter = require('./src/features/email/routes');
const originAnalysisRouter = require('./src/routes/originAnalysis');
const fullAnalysisRouter = require('./src/routes/fullAnalysis');
const findValueRouter = require('./src/routes/findValue');
const healthRouter = require('./src/routes/health');

const app = express();

// Enable trust proxy for rate limiter to work with forwarded requests
app.enable('trust proxy');

app.use(express.json());

app.use(corsMiddleware);

// Mount routes
app.use(uploadRouter);
app.use('/session', sessionRouter);
app.use(visualSearchRouter);
app.use(emailRouter);
app.use(originAnalysisRouter);
app.use(fullAnalysisRouter);
app.use(findValueRouter);
app.use('/api/health', healthRouter);

// 404 handler - must come after all valid routes
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    data: null,
    error: {
      code: 'NOT_FOUND',
      message: 'The requested resource was not found',
      details: null
    }
  });
});

// Error handling middleware - must be last
app.use(errorHandler);

// Initialize application
const init = async () => {
  try {
    const { secrets, keyFilePath } = await loadSecrets();
    await cloudServices.initialize(
      secrets.GOOGLE_CLOUD_PROJECT_ID,
      keyFilePath,
      secrets.GCS_BUCKET_NAME,
      secrets.OPENAI_API_KEY
    );

    // Initialize sheets service
    sheetsService.initialize(keyFilePath, secrets.SHEETS_ID_FREE_REPORTS_LOG);

    // Initialize Pub/Sub service
    pubsubService.initialize(
      secrets.GOOGLE_CLOUD_PROJECT_ID,
      secrets.PUBSUB_TOPIC_ANALYSIS_COMPLETE
    );

    const PORT = process.env.PORT || 8080;
    app.listen(PORT, () => {
      console.log(`Backend server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to initialize application:', error);
    process.exit(1);
  }
};

init();