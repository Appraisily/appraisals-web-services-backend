// index.js

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { Storage } = require('@google-cloud/storage');
const vision = require('@google-cloud/vision');
const fetch = require('node-fetch');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

// Initialize Express app
const app = express();

// Middleware to parse JSON
app.use(express.json());

// Enable CORS for all routes
app.use(cors());

// Initialize Google Cloud Storage
const storage = new Storage({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  keyFilename: process.env.GOOGLE_CLOUD_KEYFILE,
});
const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);

// Initialize Google Vision Client
const visionClient = new vision.ImageAnnotatorClient({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  keyFilename: process.env.GOOGLE_CLOUD_KEYFILE,
});

// Initialize Multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(), // Store files in memory temporarily
});

// In-memory session store (replace with Redis for production)
const sessions = {};

// Feature flag
const USE_GOOGLE_CLOUD_STORAGE = process.env.USE_GOOGLE_CLOUD_STORAGE === 'true';

// Function to analyze image with Google Vision
const analyzeImageWithGoogleVision = async (imageUri) => {
  try {
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

    return prompt.trim();
  } catch (error) {
    console.error('Error reading prompt file:', error);
    throw new Error('Error generating prompt.');
  }
};

// Function to generate text with OpenAI
const generateTextWithOpenAI = async (prompt) => {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo', // Use the model you have access to
        messages: [
          { role: 'system', content: 'You are an art expert providing detailed analysis of artworks.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorDetails = await response.text();
      console.error('Error from OpenAI:', errorDetails);
      throw new Error('Error generating text with OpenAI.');
    }

    const data = await response.json();
    const generatedText = data.choices[0].message.content.trim();
    console.log('OpenAI generated text successfully.');
    return generatedText;
  } catch (error) {
    console.error('Error generating text with OpenAI:', error);
    throw new Error('Error generating text with OpenAI.');
  }
};

// Endpoint: Upload Image and Get Similar Images
app.post('/upload-image', upload.single('image'), async (req, res) => {
  try {
    // Step 1: Retrieve the uploaded image
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    const imageBuffer = req.file.buffer;
    const originalName = req.file.originalname;
    const fileName = `customer-images/${uuidv4()}_${originalName}`;
    const file = bucket.file(fileName);

    let customerImageUrl;

    if (USE_GOOGLE_CLOUD_STORAGE) {
      // Step 2A: Upload to GCS
      await file.save(imageBuffer, {
        resumable: false,
        contentType: req.file.mimetype,
        metadata: {
          cacheControl: 'no-cache',
        },
      });

      // Make the file publicly accessible (optional)
      await file.makePublic();

      customerImageUrl = `https://storage.googleapis.com/${process.env.GCS_BUCKET_NAME}/${fileName}`;
      console.log(`Image uploaded to GCS: ${customerImageUrl}`);
    } else {
      // Step 2B: Upload to WordPress (existing functionality)
      // Implement uploadImageToWordPress if needed
      throw new Error('WordPress upload not implemented.');
    }

    // Step 3: Analyze the image with Google Vision API
    const { webDetection, labels } = await analyzeImageWithGoogleVision(customerImageUrl);

    // Step 4: Extract similar image URLs from Google Vision's response
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

    // Step 6: Return the similar images and session ID to the client
    res.json({
      success: true,
      message: 'Image processed successfully.',
      sessionId: sessionId,
      customerImageUrl: customerImageUrl,
      similarImageUrls: similarImageUrls,
    });
  } catch (error) {
    console.error('Error processing image:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing image.',
      error: error.message,
    });
  }
});

// Endpoint: Generate Analysis with OpenAI
app.post('/generate-analysis', async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId || !sessions[sessionId]) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or missing sessionId.',
      });
    }

    // Retrieve session data
    const { customerImageUrl, similarImageUrls, labels } = sessions[sessionId];

    // Step 1: Construct the prompt for OpenAI
    const prompt = await generatePrompt(customerImageUrl, similarImageUrls, labels);

    // Step 2: Call OpenAI API with the prompt
    const generatedText = await generateTextWithOpenAI(prompt);

    // Step 3: Clean up the session data
    delete sessions[sessionId];

    // Step 4: Return the generated analysis to the client
    res.json({
      success: true,
      message: 'Analysis generated successfully.',
      analysis: generatedText,
    });
  } catch (error) {
    console.error('Error generating analysis:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating analysis.',
      error: error.message,
    });
  }
});

// Start the server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Backend server is running on port ${PORT}`);
});
