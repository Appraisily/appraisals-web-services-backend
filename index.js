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

// Inicializar la aplicación Express
const app = express();

// Middleware para parsear JSON
app.use(express.json());

// Habilitar CORS para todas las rutas
app.use(cors());

// Inicializar el cliente de Secret Manager
const secretClient = new SecretManagerServiceClient();

// Función para obtener secretos de Secret Manager
const getSecret = async (secretName) => {
  try {
    const projectId = 'civil-forge-403609'; // Reemplaza con tu ID de proyecto
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

// Variables para almacenar los secretos
let GOOGLE_CLOUD_PROJECT_ID;
let SERVICE_ACCOUNT_JSON;
let GCS_BUCKET_NAME;
let OPENAI_API_KEY;

// Función para cargar todos los secretos al inicio
const loadSecrets = async () => {
  try {
    console.log('Loading secrets from Secret Manager...');
    GOOGLE_CLOUD_PROJECT_ID = await getSecret('GOOGLE_CLOUD_PROJECT_ID');
    SERVICE_ACCOUNT_JSON = await getSecret('service-account-json'); // Nombre actualizado del secreto
    GCS_BUCKET_NAME = await getSecret('GCS_BUCKET_NAME');
    OPENAI_API_KEY = await getSecret('OPENAI_API_KEY');
    console.log('All secrets loaded successfully.');

    // Escribir el contenido del JSON de la cuenta de servicio en un archivo temporal
    const keyFilePath = path.join(__dirname, 'keyfile.json');
    console.log(`Writing service account JSON to ${keyFilePath}.`);
    await fs.writeFile(keyFilePath, SERVICE_ACCOUNT_JSON);
    console.log('Service account JSON written successfully.');

    // Inicializar Google Cloud Storage
    console.log('Initializing Google Cloud Storage client...');
    storage = new Storage({
      projectId: GOOGLE_CLOUD_PROJECT_ID,
      keyFilename: keyFilePath,
    });
    console.log('Google Cloud Storage client initialized.');

    bucket = storage.bucket(GCS_BUCKET_NAME);
    console.log(`Bucket set to: ${GCS_BUCKET_NAME}`);

    // Verificar que el bucket existe
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

    // Inicializar el cliente de Google Vision
    console.log('Initializing Google Vision client...');
    visionClient = new vision.ImageAnnotatorClient({
      projectId: GOOGLE_CLOUD_PROJECT_ID,
      keyFilename: keyFilePath,
    });
    console.log('Google Vision client initialized.');
  } catch (error) {
    console.error('Error loading secrets:', error);
    process.exit(1); // Salir si no se pudieron cargar los secretos
  }
};

// Variables inicializadas después de cargar los secretos
let storage;
let bucket;
let visionClient;

// Inicializar Multer para cargas de archivos
const upload = multer({
  storage: multer.memoryStorage(), // Almacenar archivos en memoria temporalmente
});

// Almacenamiento de sesiones en memoria (reemplazar con Redis para producción)
const sessions = {};

// Declaración de USE_GOOGLE_CLOUD_STORAGE
const USE_GOOGLE_CLOUD_STORAGE = true; // Set to true since we're using GCS

/**
 * Función para verificar si una URL apunta a una imagen válida y accesible.
 * @param {string} url - La URL de la imagen a verificar.
 * @returns {Promise<boolean>} - Retorna true si la URL es válida y accesible, false de lo contrario.
 */
const isValidImageUrl = async (url) => {
  try {
    const response = await fetch(url, { method: 'HEAD', timeout: 5000 });
    if (!response.ok) {
      console.warn(`URL inválida o inaccesible: ${url}`);
      return false;
    }
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.startsWith('image/')) {
      return true;
    } else {
      console.warn(`URL no apunta a una imagen válida: ${url}`);
      return false;
    }
  } catch (error) {
    console.warn(`Error al verificar la URL: ${url}`, error.message);
    return false;
  }
};

/**
 * Función para generar texto con OpenAI.
 * @param {string} prompt - El prompt a enviar a OpenAI.
 * @param {string} title - El título del análisis.
 * @param {Object} imageUrls - Objeto con URLs de imágenes (main y similares).
 * @returns {Promise<string>} - Retorna el texto generado por OpenAI.
 */
const generateTextWithOpenAI = async (prompt, title, imageUrls) => {
  // Construir el contenido del mensaje siguiendo la estructura correcta
  const messagesWithRoles = [
    {
      role: 'system',
      content: 'You are a professional art expert.',
    },
    {
      role: 'user',
      content: [
        { type: 'text', text: `Title: ${title}` },
        ...(imageUrls.main ? [{ type: 'image_url', image_url: { url: imageUrls.main } }] : []),
        // Agregar más imágenes similares si existen
        ...(imageUrls.similar && imageUrls.similar.length > 0
          ? imageUrls.similar.map((url, index) => ({
              type: 'image_url',
              image_url: { url: url, label: `Similar Image ${index + 1}` },
            }))
          : []),
        { type: 'text', text: prompt },
      ],
    },
  ];

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Usando el modelo indicado
        messages: messagesWithRoles,
        max_tokens: 500,
        temperature: 0.7,
      }),
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

/**
 * Función para analizar imágenes con Google Vision.
 * @param {string} imageUri - La URL de la imagen a analizar.
 * @returns {Promise<Object>} - Retorna un objeto con webDetection, labels y similarImageUrls.
 */
const analyzeImageWithGoogleVision = async (imageUri) => {
  try {
    console.log(`Analyzing image with Google Vision API: ${imageUri}`);
    const [result] = await visionClient.webDetection(imageUri);
    const webDetection = result.webDetection;

    if (!webDetection) {
      throw new Error('No web detection results.');
    }

    console.log('Google Vision web detection results obtained.');

    // Extraer etiquetas y entidades web
    const labels = webDetection.webEntities
      .filter((entity) => entity.description)
      .map((entity) => entity.description);

    // Extraer imágenes similares
    let similarImageUrls = webDetection.visuallySimilarImages
      .map((image) => image.url)
      .filter((url) => url);

    console.log('Similar images found:', similarImageUrls);

    // Validar y filtrar URLs de imágenes similares
    const validSimilarImageUrls = [];
    for (const url of similarImageUrls) {
      const isValid = await isValidImageUrl(url);
      if (isValid) {
        validSimilarImageUrls.push(url);
      }
      // Limitar a un máximo de 5 imágenes similares válidas para evitar sobrecarga
      if (validSimilarImageUrls.length >= 5) break;
    }

    console.log('Valid similar images after filtering:', validSimilarImageUrls);

    return { webDetection, labels, similarImageUrls: validSimilarImageUrls };
  } catch (error) {
    console.error('Error analyzing image with Google Vision:', error);
    throw new Error('Error analyzing image with Google Vision.');
  }
};

/**
 * Función para generar el prompt para OpenAI.
 * @param {string} customerImageUrl - La URL de la imagen del cliente.
 * @param {Array<string>} similarImageUrls - Lista de URLs de imágenes similares válidas.
 * @param {Array<string>} labels - Lista de etiquetas obtenidas de Google Vision.
 * @returns {Promise<string>} - Retorna el prompt generado.
 */
const generatePrompt = async (customerImageUrl, similarImageUrls, labels) => {
  try {
    const promptFilePath = path.join(__dirname, 'prompts', 'front-image-test.txt');
    console.log(`Reading prompt file from ${promptFilePath}.`);
    let prompt = await fs.readFile(promptFilePath, 'utf8');

    // Reemplazar marcadores en el prompt
    prompt = prompt.replace('{{customerImageUrl}}', customerImageUrl);

    // Manejar URLs de imágenes similares
    let similarImagesText;
    if (similarImageUrls.length > 0) {
      similarImagesText = similarImageUrls.map((url, index) => `${index + 1}. ${url}`).join('\n');
    } else {
      similarImagesText = 'No similar images were found.';
    }
    prompt = prompt.replace('{{similarImageUrls}}', similarImagesText);

    // Manejar etiquetas/descripciones de Google Vision
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

    // Paso 1: Recuperar la imagen subida
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
      // Paso 2A: Subir a GCS
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
      // Paso 2B: Subir a WordPress (funcionalidad existente)
      // Implementar uploadImageToWordPress si es necesario
      throw new Error('WordPress upload not implemented.');
    }

    // Paso 3: Analizar la imagen con Google Vision API
    console.log('Analyzing the uploaded image with Google Vision API...');
    const { webDetection, labels, similarImageUrls } = await analyzeImageWithGoogleVision(customerImageUrl);

    // Paso 4: Extraer URLs de imágenes similares de la respuesta de Google Vision
    console.log('Similar images found:', similarImageUrls);

    // Paso 5: Almacenar datos de sesión
    const sessionId = uuidv4();
    sessions[sessionId] = {
      customerImageUrl,
      similarImageUrls,
      labels,
      timestamp: Date.now(),
    };
    console.log(`Session data stored with sessionId: ${sessionId}`);

    // Paso 6: Devolver las imágenes similares y el ID de sesión al cliente
    res.json({
      success: true,
      message: 'Image processed successfully.',
      sessionId: sessionId,
      customerImageUrl: customerImageUrl,
      similarImageUrls: similarImageUrls,
      labels: labels,
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

    // Recuperar datos de sesión
    const { customerImageUrl, similarImageUrls, labels } = sessions[sessionId];
    console.log('Session data retrieved:', { customerImageUrl, similarImageUrls, labels });

    // Generar el prompt
    const prompt = await generatePrompt(customerImageUrl, similarImageUrls, labels);

    // Preparar URLs de imágenes
    const imageUrls = {
      main: customerImageUrl,
      similar: similarImageUrls, // Lista de URLs similares
    };

    // Llamar a OpenAI con el prompt, título y URLs de imágenes
    const title = 'Artwork Analysis'; // Puedes ajustar el título según sea necesario
    const generatedText = await generateTextWithOpenAI(prompt, title, imageUrls);
    console.log('Received generated text from OpenAI.');

    // Devolver el análisis generado al cliente
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

    // Recuperar datos de sesión
    const { customerImageUrl, similarImageUrls } = sessions[sessionId];
    console.log('Session data retrieved:', { customerImageUrl, similarImageUrls });

    // Leer la plantilla de prompt desde 'offer.txt' para la segunda llamada
    const offerPromptPath = path.join(__dirname, 'prompts', 'offer.txt');
    console.log(`Reading prompt file from ${offerPromptPath}.`);
    const offerPromptTemplate = await fs.readFile(offerPromptPath, 'utf8');

    // Preparar URLs de imágenes
    const imageUrls = {
      main: customerImageUrl,
      similar: similarImageUrls, // Lista de URLs similares
    };

    // Generar el prompt final para la segunda llamada reemplazando marcadores
    const offerPrompt = offerPromptTemplate
      .replace('{{customerImageUrl}}', customerImageUrl)
      .replace('{{analysisText}}', analysisText);

    // Establecer el título u otros parámetros necesarios
    const title = 'Artwork Offer';

    // Llamar a OpenAI con el prompt de 'offer.txt' (Segunda llamada)
    const offerText = await generateTextWithOpenAI(offerPrompt, title, imageUrls);
    console.log('Received offer text from OpenAI (Second Call).');

    // Devolver el texto generado por la segunda llamada al cliente
    res.json({
      success: true,
      message: 'Offer generated successfully.',
      enhancedAnalysis: analysisText, // Análisis previo
      offerText: offerText, // Oferta generada
    });

    console.log('Offer response sent to client successfully.');
  } catch (error) {
    console.error('Error generating offer:', error);

    // Enviar una respuesta más detallada solo en entornos de desarrollo
    const isDevelopment = process.env.NODE_ENV === 'development';

    res.status(500).json({
      success: false,
      message: 'Error generating offer.',
      error: isDevelopment ? error.message : 'Internal Server Error.',
    });
  }
});

// Iniciar el servidor después de cargar los secretos
loadSecrets().then(() => {
  const PORT = process.env.PORT || 8080;
  app.listen(PORT, () => {
    console.log(`Backend server is running on port ${PORT}`);
  });
});
