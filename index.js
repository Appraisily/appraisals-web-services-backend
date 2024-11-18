const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { Storage } = require('@google-cloud/storage');
const vision = require('@google-cloud/vision');
const fetch = require('node-fetch');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const path = require('path');
const mime = require('mime-types');
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');

// Initialize Express application
const app = express();

// Middleware for parsing JSON
app.use(express.json());

// Enable CORS for all routes
app.use(cors());

// Initialize Secret Manager client
const secretClient = new SecretManagerServiceClient();

// Function to get secrets from Secret Manager
const getSecret = async (secretName) => {
  try {
    const projectId = 'civil-forge-403609';
    const name = `projects/${projectId}/secrets/${secretName}/versions/latest`;

    console.log(`Attempting to retrieve secret '${secretName}' from Secret Manager.`);
    const [version] = await secretClient.accessSecretVersion({ name });
    const payload = version.payload.data.toString('utf8');
    console.log(`Secret '${secretName}' retrieved successfully.`);
    return payload;
  } catch (error) {
    console.error(`Error retrieving secret '${secretName}':`, error);
    throw new Error(`Could not retrieve secret '${secretName}'.`);
  }
};

// Variables to store secrets
let GOOGLE_CLOUD_PROJECT_ID;
let SERVICE_ACCOUNT_JSON;
let GCS_BUCKET_NAME;
let OPENAI_API_KEY;

// Function to load all secrets at startup
const loadSecrets = async () => {
  try {
    console.log('Loading secrets from Secret Manager...');
    GOOGLE_CLOUD_PROJECT_ID = await getSecret('GOOGLE_CLOUD_PROJECT_ID');
    SERVICE_ACCOUNT_JSON = await getSecret('service-account-json');
    GCS_BUCKET_NAME = await getSecret('GCS_BUCKET_NAME');
    OPENAI_API_KEY = await getSecret('OPENAI_API_KEY');
    console.log('All secrets loaded successfully.');

    // Write service account JSON to temporary file
    const keyFilePath = path.join(__dirname, 'keyfile.json');
    console.log(`Writing service account JSON to ${keyFilePath}.`);
    await fs.writeFile(keyFilePath, SERVICE_ACCOUNT_JSON);
    console.log('Service account JSON written successfully.');

    // Initialize Google Cloud Storage
    console.log('Initializing Google Cloud Storage client...');
    storage = new Storage({
      projectId: GOOGLE_CLOUD_PROJECT_ID,
      keyFilename: keyFilePath,
    });
    console.log('Google Cloud Storage client initialized.');

    bucket = storage.bucket(GCS_BUCKET_NAME);
    console.log(`Bucket set to: ${GCS_BUCKET_NAME}`);

    // Verify bucket exists
    try {
      const [exists] = await bucket.exists();
      if (exists) {
        console.log(`Bucket '${GCS_BUCKET_NAME}' exists and is accessible.`);
      } else {
        console.error(`Bucket '${GCS_BUCKET_NAME}' does not exist.`);
        throw new Error(`Bucket '${GCS_BUCKET_NAME}' does not exist.`);
      }
    } catch (bucketError) {
      console.error(`Error accessing bucket '${GCS_BUCKET_NAME}':`, bucketError);
      throw new Error(`Bucket '${GCS_BUCKET_NAME}' does not exist or is not accessible.`);
    }

    // Initialize Vision client
    console.log('Initializing Google Vision client...');
    visionClient = new vision.ImageAnnotatorClient({
      projectId: GOOGLE_CLOUD_PROJECT_ID,
      keyFilename: keyFilePath,
    });
    console.log('Google Vision client initialized.');
  } catch (error) {
    console.error('Error loading secrets:', error);
    process.exit(1);
  }
};

// Variables initialized after loading secrets
let storage;
let bucket;
let visionClient;

// Initialize Multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

// In-memory session storage (replace with Redis for production)
const sessions = {};

// Declare USE_GOOGLE_CLOUD_STORAGE
const USE_GOOGLE_CLOUD_STORAGE = true;

// New endpoint: Upload Temp
app.post('/upload-temp', upload.single('image'), async (req, res) => {
  try {
    console.log('Received request to /upload-temp endpoint.');

    // Check if file was uploaded
    if (!req.file) {
      console.warn('No file uploaded in the request.');
      return res.status(400).json({ 
        success: false, 
        message: 'No file uploaded.' 
      });
    }

    // Validate file type
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(req.file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid file type. Only JPEG, PNG, and WebP images are allowed.'
      });
    }

    console.log(`Received file: ${req.file.originalname}, size: ${req.file.size} bytes.`);
    
    // Generate unique filename
    const fileExtension = mime.extension(req.file.mimetype);
    const fileName = `temp-uploads/${uuidv4()}.${fileExtension}`;
    
    // Upload to Google Cloud Storage
    const file = bucket.file(fileName);
    
    console.log(`Preparing to upload image as: ${fileName}`);

    await file.save(req.file.buffer, {
      resumable: false,
      contentType: req.file.mimetype,
      metadata: {
        cacheControl: 'public, max-age=3600', // 1 hour cache
      },
    });

    console.log('Image uploaded to GCS successfully.');

    // Generate temporary URL
    const tempUrl = `https://storage.googleapis.com/${GCS_BUCKET_NAME}/${fileName}`;
    
    // Create new session
    const sessionId = uuidv4();
    sessions[sessionId] = {
      tempImageUrl: tempUrl,
      originalName: req.file.originalname,
      timestamp: Date.now(),
      analyzed: false
    };

    console.log(`Session created with ID: ${sessionId}`);

    // Return success response
    res.json({
      success: true,
      message: 'Image uploaded successfully.',
      tempUrl: tempUrl,
      sessionId: sessionId
    });

    console.log('Response sent to client successfully.');
  } catch (error) {
    console.error('Error processing temporary upload:', error);
    
    const isDevelopment = process.env.NODE_ENV === 'development';
    res.status(500).json({
      success: false,
      message: 'Error processing image upload.',
      error: isDevelopment ? error.message : 'Internal Server Error.'
    });
  }
});

// [Previous endpoints remain unchanged...]

// Start server after loading secrets
loadSecrets().then(() => {
  const PORT = process.env.PORT || 8080;
  app.listen(PORT, () => {
    console.log(`Backend server is running on port ${PORT}`);
  });
});