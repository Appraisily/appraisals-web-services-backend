const express = require('express');
const { loadSecrets } = require('./src/config/secrets');
const cloudServices = require('./src/services/storage');
const pubsubService = require('./src/services/pubsub');
const sheetsService = require('./src/services/sheets');
const corsMiddleware = require('./src/middleware/cors');
const uploadRouter = require('./src/routes/upload');
const visualSearchRouter = require('./src/routes/visualSearch');
const sessionRouter = require('./src/routes/session');
const emailRouter = require('./src/routes/email');
const originAnalysisRouter = require('./src/routes/originAnalysis');
const fullAnalysisRouter = require('./src/routes/fullAnalysis');
const healthRouter = require('./src/routes/health');

const app = express();

app.use(express.json());

app.use(corsMiddleware);

// Mount routes
app.use(uploadRouter);
app.use('/session', sessionRouter);
app.use(visualSearchRouter);
app.use(emailRouter);
app.use(originAnalysisRouter);
app.use(fullAnalysisRouter);
app.use('/api/health', healthRouter);

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