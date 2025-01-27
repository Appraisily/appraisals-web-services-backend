const express = require('express');
const { loadSecrets } = require('./src/config/secrets');
const cloudServices = require('./src/services/storage');
const corsMiddleware = require('./src/middleware/cors');
const uploadRouter = require('./src/routes/upload');
const encryption = require('./src/services/encryption');
const visualSearchRouter = require('./src/routes/visualSearch');
const sessionRouter = require('./src/routes/session');
const emailService = require('./src/services/email');
const originAnalysisRouter = require('./src/routes/originAnalysis');
const emailRouter = require('./src/routes/email');
const sheetsService = require('./src/services/sheets');
const fullAnalysisRouter = require('./src/routes/fullAnalysis');
const healthRouter = require('./src/routes/health');

const app = express();

app.use(express.json());

// Trust proxy - required for rate limiting behind reverse proxy
app.set('trust proxy', 1);

app.use(corsMiddleware);

// Mount routes
app.use(uploadRouter);
app.use('/session', sessionRouter);
app.use(visualSearchRouter);
app.use(originAnalysisRouter);
app.use(fullAnalysisRouter);
app.use(emailRouter);
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

    // Initialize encryption service
    encryption.initialize(secrets.EMAIL_ENCRYPTION_KEY);

    // Initialize email service
    emailService.initialize(
      secrets.SENDGRID_API_KEY,
      secrets.SENDGRID_EMAIL,
      secrets.SEND_GRID_TEMPLATE_FREE_REPORT,
      secrets.SEND_GRID_TEMPLATE_PERSONAL_OFFER,
      secrets.SENDGRID_EMAIL,
      secrets.DIRECT_API_KEY
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