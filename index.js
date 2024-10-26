const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { Storage } = require('@google-cloud/storage');
const vision = require('@google-cloud/vision');
const fetch = require('node-fetch');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const path = require('path');
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');

// Initialize Express app
const app = express();

// Middleware to parse JSON
app.use(express.json());

// Enable CORS for all routes
app.use(cors());

// Initialize Secret Manager client
const secretClient = new SecretManagerServiceClient();

// Function to get secret from Secret Manager
const getSecret = async (secretName) => {
  try {
    const projectId = 'civil-forge-403609'; // Replace with your project ID
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
    SERVICE_ACCOUNT_JSON = await getSecret('service-account-json'); // Updated secret name
    GCS_BUCKET_NAME = await getSecret('GCS_BUCKET_NAME');
    OPENAI_API_KEY = await getSecret('OPENAI_API_KEY');
    console.log('All secrets loaded successfully.');

    // Write the service account JSON content to a temporary file
    const keyFilePath = path.join(__dirname, 'keyfile.json');
    console.log(`Writing service account JSON to ${keyFilePath}.`);
    await fs.writeFile(keyFilePath, SERVICE_ACCOUNT_JSON);
    console.log('Service account JSON written successfully.');

    // Log the contents of SERVICE_ACCOUNT_JSON for debugging
    console.log(`Contents of SERVICE_ACCOUNT_JSON starts with: ${SERVICE_ACCOUNT_JSON.substring(0, 100)}...`);

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

    // Initialize Google Vision Client
    console.log('Initializing Google Vision client...');
    visionClient = new vision.ImageAnnotatorClient({
      projectId: GOOGLE_CLOUD_PROJECT_ID,
      keyFilename: keyFilePath,
    });
    console.log('Google Vision client initialized.');
  } catch (error) {
    console.error('Error loading secrets:', error);
    process.exit(1); // Exit if secrets could not be loaded
  }
};

// Initialize variables (will be set after loading secrets)
let storage;
let bucket;
let visionClient;

// Initialize Multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(), // Store files in memory temporarily
});

// In-memory session store (replace with Redis for production)
const sessions = {};

// Feature flag
const USE_GOOGLE_CLOUD_STORAGE = true; // Set to true since we're using GCS
const generateTextWithOpenAI = async (prompt, title, imageUrls) => {
  // Construir el contenido del mensaje siguiendo la estructura correcta
  const messagesWithRoles = [
    {
      role: "system",
      content: "You are a professional art expert."
    },
    {
      role: "user",
      content: [
        { type: "text", text: `Title: ${title}` },
        ...(imageUrls.main ? [{ type: "image_url", image_url: { url: imageUrls.main } }] : []),
        ...(imageUrls.age ? [{ type: "image_url", image_url: { url: imageUrls.age } }] : []),
        ...(imageUrls.signature ? [{ type: "image_url", image_url: { url: imageUrls.signature } }] : []),
        { type: "text", text: prompt }
      ]
    }
  ];

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Usando el modelo indicado
        messages: messagesWithRoles,
        max_tokens: 500,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorDetails = await response.text();
      console.error('Error en la respuesta de OpenAI:', errorDetails);
      throw new Error('Error generando texto con OpenAI.');
    }

    const data = await response.json();
    const generatedText = data.choices[0].message.content.trim();
    console.log('OpenAI generated text successfully.');
    return generatedText;
  } catch (error) {
    console.error('Error generando texto con OpenAI:', error);
    throw new Error('Error generando texto con OpenAI.');
  }
};

// Endpoint: Enhance Analysis with OpenAI
app.post('/enhance-analysis', async (req, res) => {
  try {
    console.log('Received request to /enhance-analysis endpoint.');

    const { sessionId, analysisText } = req.body;

    if (!sessionId || !sessions[sessionId]) {
      console.warn('Invalid or missing sessionId in the request.');
      return res.status(400).json({
        success: false,
        message: 'Invalid or missing sessionId.',
      });
    }

    if (!analysisText) {
      console.warn('Missing analysisText in the request.');
      return res.status(400).json({
        success: false,
        message: 'Missing analysisText.',
      });
    }

    console.log(`Processing enhanced analysis for sessionId: ${sessionId}`);

    // Retrieve session data
    const { customerImageUrl } = sessions[sessionId];
    console.log('Session data retrieved:', { customerImageUrl });

    // Read the prompt template from 'conclusion.txt'
    const promptFilePath = path.join(__dirname, 'prompts', 'conclusion.txt');
    console.log(`Reading prompt file from ${promptFilePath}.`);
    const promptTemplate = await fs.readFile(promptFilePath, 'utf8');

    // Prepare image URLs
    const imageUrls = {
      main: customerImageUrl,
      // Add other images if needed
      // age: 'url_of_age_image',
      // signature: 'url_of_signature_image',
    };

    // Generate the final prompt by replacing placeholders
    const prompt = promptTemplate.replace('{{analysisText}}', analysisText);

    // Set the title or other necessary parameters
    const title = 'Enhanced Artwork Analysis';

    // Call OpenAI with the prompt, title, and image URLs
    const enhancedText = await generateTextWithOpenAI(prompt, title, imageUrls);
    console.log('Received enhanced text from OpenAI.');

    // Return the generated enhanced analysis to the client
    res.json({
      success: true,
      message: 'Enhanced analysis generated successfully.',
      enhancedAnalysis: enhancedText,
    });

    console.log('Enhanced analysis response sent to client successfully.');
  } catch (error) {
    console.error('Error generating enhanced analysis:', error);

    // Send a more detailed response only in development environments
    const isDevelopment = process.env.NODE_ENV === 'development';

    res.status(500).json({
      success: false,
      message: 'Error generating enhanced analysis.',
      error: isDevelopment ? error.message : 'Internal Server Error.',
    });
  }
});



// Function to analyze image with Google Vision
const analyzeImageWithGoogleVision = async (imageUri) => {
  try {
    console.log(`Analyzing image with Google Vision API: ${imageUri}`);
    const [result] = await visionClient.webDetection(imageUri);
    const webDetection = result.webDetection;

    if (!webDetection) {
      throw new Error('No web detection results.');
    }

    console.log('Google Vision web detection results obtained.');

    // Extract labels and web entities
    const labels = webDetection.webEntities
      .filter((entity) => entity.description)
      .map((entity) => entity.description);

    return { webDetection, labels };
  } catch (error) {
    console.error('Error analyzing image with Google Vision:', error);
    throw new Error('Error analyzing image with Google Vision.');
  }
};

// Function to generate prompt for OpenAI
const generatePrompt = async (customerImageUrl, similarImageUrls, labels) => {
  try {
    const promptFilePath = path.join(__dirname, 'prompts', 'front-image-test.txt');
    console.log(`Reading prompt file from ${promptFilePath}.`);
    let prompt = await fs.readFile(promptFilePath, 'utf8');

    // Replace placeholders in the prompt
    prompt = prompt.replace('{{customerImageUrl}}', customerImageUrl);

    // Handle similar image URLs
    let similarImagesText;
    if (similarImageUrls.length > 0) {
      similarImagesText = similarImageUrls.map((url, index) => `${index + 1}. ${url}`).join('\n');
    } else {
      similarImagesText = 'No similar images were found.';
    }
    prompt = prompt.replace('{{similarImageUrls}}', similarImagesText);

    // Handle labels/descriptions from Google Vision
    let labelsText;
    if (labels && labels.length > 0) {
      labelsText = labels.join(', ');
    } else {
      labelsText = 'No descriptions available.';
    }
    prompt = prompt.replace('{{labels}}', labelsText);

    console.log('Prompt generated successfully.');
    return prompt.trim();
  } catch (error) {
    console.error('Error reading prompt file:', error);
    throw new Error('Error generating prompt.');
  }
};



// Endpoint: Upload Image and Get Similar Images
app.post('/upload-image', upload.single('image'), async (req, res) => {
  try {
    console.log('Received request to /upload-image endpoint.');

    // Step 1: Retrieve the uploaded image
    if (!req.file) {
      console.warn('No file uploaded in the request.');
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    console.log(`Received file: ${req.file.originalname}, size: ${req.file.size} bytes.`);
    const imageBuffer = req.file.buffer;
    const originalName = req.file.originalname;
    const fileName = `customer-images/${uuidv4()}_${originalName}`;
    const file = bucket.file(fileName);

    console.log(`Preparing to upload image as: ${fileName}`);

    let customerImageUrl;

    if (USE_GOOGLE_CLOUD_STORAGE) {
      // Step 2A: Upload to GCS
      console.log('Uploading image to Google Cloud Storage...');
      await file.save(imageBuffer, {
        resumable: false,
        contentType: req.file.mimetype,
        metadata: {
          cacheControl: 'no-cache',
        },
      });
      console.log('Image uploaded to GCS successfully.');

   

      customerImageUrl = `https://storage.googleapis.com/${GCS_BUCKET_NAME}/${fileName}`;
      console.log(`Customer Image URL: ${customerImageUrl}`);
    } else {
      // Step 2B: Upload to WordPress (existing functionality)
      // Implement uploadImageToWordPress if needed
      throw new Error('WordPress upload not implemented.');
    }

    // Step 3: Analyze the image with Google Vision API
    console.log('Analyzing the uploaded image with Google Vision API...');
    const { webDetection, labels } = await analyzeImageWithGoogleVision(customerImageUrl);

    // Step 4: Extract similar image URLs from Google Vision's response
    console.log('Extracting similar image URLs from Google Vision response...');
    const similarImageUrls = webDetection.visuallySimilarImages
      .map((image) => image.url)
      .filter((url) => url);

    console.log('Similar images found:', similarImageUrls);

    // Step 5: Store session data
    const sessionId = uuidv4();
    sessions[sessionId] = {
      customerImageUrl,
      similarImageUrls,
      labels,
      timestamp: Date.now(),
    };
    console.log(`Session data stored with sessionId: ${sessionId}`);

    // Step 6: Return the similar images and session ID to the client
    res.json({
      success: true,
      message: 'Image processed successfully.',
      sessionId: sessionId,
      customerImageUrl: customerImageUrl,
      similarImageUrls: similarImageUrls,
    });

    console.log('Response sent to client successfully.');
  } catch (error) {
    console.error('Error processing image:', error);

    // Enviar una respuesta más detallada solo en entornos de desarrollo
    const isDevelopment = process.env.NODE_ENV === 'development';

    res.status(500).json({
      success: false,
      message: 'Error processing image.',
      error: isDevelopment ? error.message : 'Internal Server Error.',
    });
  }
});

// Endpoint: Generate Analysis with OpenAI
app.post('/generate-analysis', async (req, res) => {
  try {
    console.log('Received request to /generate-analysis endpoint.');

    const { sessionId } = req.body;

    if (!sessionId || !sessions[sessionId]) {
      console.warn('Invalid or missing sessionId in the request.');
      return res.status(400).json({
        success: false,
        message: 'Invalid or missing sessionId.',
      });
    }

    console.log(`Processing analysis for sessionId: ${sessionId}`);

    // Retrieve session data
    const { customerImageUrl, similarImageUrls, labels } = sessions[sessionId];
    console.log('Session data retrieved:', { customerImageUrl, similarImageUrls, labels });

    // Construir el prompt
    const promptFilePath = path.join(__dirname, 'prompts', 'front-image-test.txt');
    console.log(`Reading prompt file from ${promptFilePath}.`);
    const prompt = await fs.readFile(promptFilePath, 'utf8');

    // Preparar los URLs de imágenes
    const imageUrls = {
      main: customerImageUrl,
      // Si tienes otras imágenes, puedes agregarlas aquí
      // age: 'url_de_la_imagen_de_edad',
      // signature: 'url_de_la_imagen_de_firma',
    };

    // Llamar a OpenAI con el prompt, título y URLs de imágenes
    const title = 'Artwork Analysis'; // Puedes ajustar el título según sea necesario
    const generatedText = await generateTextWithOpenAI(prompt, title, imageUrls);
    console.log('Received generated text from OpenAI.');

    // Clean up the session data
    delete sessions[sessionId];
    console.log(`Session data for sessionId ${sessionId} has been cleaned up.`);

    // Return the generated analysis to the client
    res.json({
      success: true,
      message: 'Analysis generated successfully.',
      analysis: generatedText,
    });

    console.log('Analysis response sent to client successfully.');
  } catch (error) {
    console.error('Error generating analysis:', error);

    // Enviar una respuesta más detallada solo en entornos de desarrollo
    const isDevelopment = process.env.NODE_ENV === 'development';

    res.status(500).json({
      success: false,
      message: 'Error generating analysis.',
      error: isDevelopment ? error.message : 'Internal Server Error.',
    });
  }
});


// Start the server after loading secrets
loadSecrets().then(() => {
  const PORT = process.env.PORT || 8080;
  app.listen(PORT, () => {
    console.log(`Backend server is running on port ${PORT}`);
  });
});
