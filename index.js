const express = require('express');
const { loadSecrets } = require('./src/config/secrets');
const cloudServices = require('./src/services/storage');
const corsMiddleware = require('./src/middleware/cors');
const uploadRouter = require('./src/routes/upload');
const visualSearchRouter = require('./src/routes/visualSearch');

const app = express();

app.use(express.json());
app.use(corsMiddleware);

// Mount routes
app.use(uploadRouter);
app.use(visualSearchRouter);

// Initialize application
const init = async () => {
  try {
    const { secrets, keyFilePath } = await loadSecrets();
    await cloudServices.initialize(
      secrets.GOOGLE_CLOUD_PROJECT_ID,
      keyFilePath,
      secrets.GCS_BUCKET_NAME
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