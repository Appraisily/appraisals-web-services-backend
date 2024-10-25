// index.js

const express = require('express');
const fetch = require('node-fetch');
const fs = require('fs').promises;
const path = require('path');
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
const { v4: uuidv4 } = require('uuid'); // Para generar nombres de archivos únicos
const vision = require('@google-cloud/vision'); // Importar el cliente de Vision
const FormData = require('form-data'); // Para subir imágenes a WordPress
const config = require('./config');
const cors = require('cors'); // Import the cors package

// Importar el router de pdfGenerator
const { router: pdfRouter, initializeGoogleApis } = require('./pdfGenerator');

const app = express();

// Middleware para parsear JSON
app.use(express.json());

// Apply CORS middleware to all routes
app.use(cors({
  origin: 'https://appraisers-frontend-856401495068.us-central1.run.app', // Replace with your frontend URL
  credentials: true, // If you need to send cookies or authentication headers
}));

// Use the pdfRouter
app.use('/', pdfRouter);

// Inicializar el cliente de Secret Manager
const client = new SecretManagerServiceClient();

// Función para obtener un secreto de Secret Manager
async function getSecret(secretName) {
  try {
    const projectId = 'civil-forge-403609'; // **Asegúrate de que este Project ID sea correcto**
    const secretPath = `projects/${projectId}/secrets/${secretName}/versions/latest`;

    const [version] = await client.accessSecretVersion({ name: secretPath });
    const payload = version.payload.data.toString('utf8');
    console.log(`Secreto '${secretName}' obtenido exitosamente.`);
    return payload;
  } catch (error) {
    console.error(`Error obteniendo el secreto '${secretName}':`, error);
    throw new Error(`No se pudo obtener el secreto '${secretName}'.`);
  }
}

// Variables para almacenar los secretos
config.WORDPRESS_API_URL;
config.WORDPRESS_USERNAME;
config.WORDPRESS_APP_PASSWORD;
let OPENAI_API_KEY;
let GOOGLE_VISION_CREDENTIALS; // Nuevo secreto para Vision API

// Función para cargar todos los secretos al iniciar la aplicación
async function loadSecrets() {
  try {
    config.WORDPRESS_API_URL = await getSecret('WORDPRESS_API_URL');
    config.WORDPRESS_USERNAME = await getSecret('wp_username');
    config.WORDPRESS_APP_PASSWORD = await getSecret('wp_app_password');
    config.OPENAI_API_KEY = await getSecret('OPENAI_API_KEY');
    config.GOOGLE_VISION_CREDENTIALS = await getSecret('GOOGLE_VISION_CREDENTIALS'); // Cargar las credenciales de Vision
    config.GOOGLE_DOCS_CREDENTIALS = await getSecret('GOOGLE_DOCS_CREDENTIALS'); // Si es necesario
    console.log('Todos los secretos han sido cargados exitosamente.');
  } catch (error) {
    console.error('Error cargando los secretos:', error);
    process.exit(1); // Salir si no se pudieron cargar los secretos
  }
}

// Inicializar el cliente de Google Vision
let visionClient;

function initializeVisionClient() {
  try {
    const credentials = JSON.parse(config.GOOGLE_VISION_CREDENTIALS);
    visionClient = new vision.ImageAnnotatorClient({
      credentials: {
        client_email: credentials.client_email,
        private_key: credentials.private_key,
      },
      projectId: 'civil-forge-403609', // Reemplaza con tu Project ID si es diferente
    });
    console.log('Cliente de Google Vision inicializado correctamente.');
  } catch (error) {
    console.error('Error inicializando el cliente de Google Vision:', error);
    process.exit(1);
  }
}


// Función para obtener la URL de la imagen desde WordPress
const getImageUrl = async (imageField) => {
  if (!imageField) return null;

  // Si es un ID de media (número o cadena numérica)
  if (typeof imageField === 'number' || (typeof imageField === 'string' && /^\d+$/.test(imageField))) {
    const mediaId = imageField;
    try {
      const mediaResponse = await fetch(`${config.WORDPRESS_API_URL}/media/${mediaId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${Buffer.from(`${encodeURIComponent(config.WORDPRESS_USERNAME)}:${config.WORDPRESS_APP_PASSWORD}`).toString('base64')}`
        }
      });

      if (!mediaResponse.ok) {
        console.error(`Error fetching image with ID ${mediaId}:`, await mediaResponse.text());
        return null;
      }

      const mediaData = await mediaResponse.json();
      return mediaData.source_url || null;
    } catch (error) {
      console.error(`Error fetching image with ID ${mediaId}:`, error);
      return null;
    }
  }

  // Si es una URL directa
  if (typeof imageField === 'string' && imageField.startsWith('http')) {
    return imageField;
  }

  // Si es un objeto con una propiedad 'url'
  if (typeof imageField === 'object' && imageField.url) {
    return imageField.url;
  }

  return null;
};

// Función para leer el prompt desde un archivo txt basado en custom_post_type_name
const getPrompt = async (custom_post_type_name) => {
  const promptsDir = path.join(__dirname, 'prompts');
  const promptFilePath = path.join(promptsDir, `${custom_post_type_name}.txt`);

  try {
    const prompt = await fs.readFile(promptFilePath, 'utf8');
    return prompt;
  } catch (error) {
    console.error(`Error leyendo el archivo de prompt para ${custom_post_type_name}:`, error);
    throw new Error(`Archivo de prompt para ${custom_post_type_name} no encontrado.`);
  }
};

// Función para generar texto con OpenAI
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
        'Authorization': `Bearer ${config.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Mantener el modelo como 'gpt-4o-mini' es nuevo no lo tienes en memoria
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
    return generatedText;
  } catch (error) {
    console.error('Error generando texto con OpenAI:', error);
    throw new Error('Error generando texto con OpenAI.');
  }
};

// Función para actualizar metadatos en WordPress
const updateWordPressMetadata = async (wpPostId, metadataKey, metadataValue) => {
  const updateWpEndpoint = `${config.WORDPRESS_API_URL}/appraisals/${wpPostId}`;

  const updateData = {
    acf: {
      [metadataKey]: metadataValue
    }
  };

  try {
    const response = await fetch(updateWpEndpoint, {
      method: 'POST', // Puedes usar 'PUT' o 'PATCH' si es necesario
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${encodeURIComponent(config.WORDPRESS_USERNAME)}:${config.WORDPRESS_APP_PASSWORD}`).toString('base64')}`
      },
      body: JSON.stringify(updateData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Error actualizando metadata '${metadataKey}' en WordPress:`, errorText);
      throw new Error(`Error actualizando metadata '${metadataKey}' en WordPress.`);
    }

    // No log the full response, just a success message
    console.log(`Metadata '${metadataKey}' actualizado correctamente en WordPress.`);
    return;
  } catch (error) {
    console.error(`Error actualizando metadata '${metadataKey}' en WordPress:`, error);
    throw new Error(`Error actualizando metadata '${metadataKey}' en WordPress.`);
  }
};

// Función para analizar la imagen con Google Vision y obtener detecciones web
const analyzeImageWithGoogleVision = async (imageUrl) => {
  try {
    console.log(`Analizando la imagen con Google Vision: ${imageUrl}`);
    const [result] = await visionClient.webDetection(imageUrl);
    const webDetection = result.webDetection;

    if (!webDetection) {
      throw new Error('No se obtuvieron resultados de detección web.');
    }

    // Estructurar la información obtenida
    const detectionInfo = {
      fullMatchingImages: webDetection.fullMatchingImages || [],
      partialMatchingImages: webDetection.partialMatchingImages || [],
      webEntities: webDetection.webEntities || [],
      bestGuessLabels: webDetection.bestGuessLabels || [],
      pagesWithMatchingImages: webDetection.pagesWithMatchingImages || [],
      visuallySimilarImages: webDetection.visuallySimilarImages || []
    };

    console.log('Información de detección web obtenida de Google Vision.');
    return detectionInfo;
  } catch (error) {
    console.error('Error analizando la imagen con Google Vision:', error);
    throw new Error('Error analizando la imagen con Google Vision.');
  }
};

// Función para subir una imagen a WordPress
const uploadImageToWordPress = async (imageUrl) => {
  try {
    // Descargar la imagen
    console.log(`Descargando la imagen desde: ${imageUrl}`);
    const response = await fetch(imageUrl);
    if (!response.ok) {
      console.error(`Error descargando la imagen desde ${imageUrl}:`, await response.text());
      return null;
    }
    const buffer = await response.buffer();

    // Crear un nombre de archivo único
    const filename = `similar-image-${uuidv4()}.jpg`;

    // Preparar el formulario para subir la imagen
    const form = new FormData();
    form.append('file', buffer, filename);

    // Subir la imagen a WordPress
    console.log(`Subiendo la imagen a WordPress: ${filename}`);
    const uploadResponse = await fetch(`${config.WORDPRESS_API_URL}/media`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${encodeURIComponent(config.WORDPRESS_USERNAME)}:${config.WORDPRESS_APP_PASSWORD}`).toString('base64')}`,
        // 'Content-Type' será manejado automáticamente por FormData
        ...form.getHeaders()
      },
      body: form
    });

    if (!uploadResponse.ok) {
      console.error(`Error subiendo la imagen a WordPress desde ${imageUrl}:`, await uploadResponse.text());
      return null;
    }

    const uploadData = await uploadResponse.json();
    console.log(`Imagen subida a WordPress con ID: ${uploadData.id}`);
    return uploadData.id;
  } catch (error) {
    console.error(`Error en uploadImageToWordPress para ${imageUrl}:`, error);
    return null;
  }
};

// Función para procesar la imagen principal y actualizar metadatos con imágenes de Google Vision
const processMainImageWithGoogleVision = async (postId) => {
  try {
    // Obtener detalles del post desde WordPress
    const getPostEndpoint = `${config.WORDPRESS_API_URL}/appraisals/${postId}`;

    console.log(`Obteniendo detalles del post ID: ${postId}`);
    const postResponse = await fetch(getPostEndpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${encodeURIComponent(config.WORDPRESS_USERNAME)}:${config.WORDPRESS_APP_PASSWORD}`).toString('base64')}`
      }
    });

    if (!postResponse.ok) {
      const errorText = await postResponse.text();
      console.error('Error obteniendo post de WordPress:', errorText);
      throw new Error('Error obteniendo post de WordPress.');
    }

    const postData = await postResponse.json();

    const acfFields = postData.acf || {};

    // Obtener la URL de la imagen principal
    const mainImageUrl = await getImageUrl(acfFields.main);
    if (!mainImageUrl) {
      throw new Error('Imagen principal no encontrada en el post.');
    }
    console.info(`Post ID: ${postId} - Main Image URL: ${mainImageUrl}`);

    // Analizar la imagen con Google Vision para obtener detecciones web
    let detectionInfo;
    try {
      detectionInfo = await analyzeImageWithGoogleVision(mainImageUrl);
    } catch (visionError) {
      console.error(`Error en Google Vision para post ID ${postId}:`, visionError.message);
      detectionInfo = null;
    }

    if (detectionInfo) {
      // Extraer URLs de imágenes similares proporcionadas por Google Vision
      const similarImageUrls = detectionInfo.visuallySimilarImages.map(image => image.url).filter(url => url);

      console.log('Imágenes similares obtenidas de Google Vision:', similarImageUrls);

      if (similarImageUrls.length > 0) {
        // Subir las imágenes similares a WordPress y obtener sus IDs
        const uploadedImageIds = [];
        for (const url of similarImageUrls) {
          try {
            const imageId = await uploadImageToWordPress(url);
            if (imageId) {
              uploadedImageIds.push(imageId);
            }
          } catch (uploadError) {
            console.error(`Error subiendo la imagen similar desde ${url}:`, uploadError.message);
            // Continuar con la siguiente imagen
          }
        }

        if (uploadedImageIds.length > 0) {
          try {
            // Actualizar el metadato 'GoogleVision' en WordPress
            const metadataKey = 'GoogleVision'; // Asegúrate de que este es el nombre correcto del metadato
            const metadataValue = uploadedImageIds;

            await updateWordPressMetadata(postId, metadataKey, metadataValue);
            console.info(`Metadato '${metadataKey}' actualizado correctamente en WordPress.`);
          } catch (metadataError) {
            console.error(`Error actualizando metadata 'GoogleVision' en WordPress para post ID ${postId}:`, metadataError.message);
            // Continuar con el siguiente paso
          }
        } else {
          console.warn('No se pudieron subir imágenes similares a WordPress.');
        }
      } else {
        console.warn('No se encontraron imágenes similares en las detecciones de Google Vision.');
      }
    } else {
      console.warn('No se pudo obtener información de Google Vision.');
    }

    return {
      success: true,
      message: `Proceso de Google Vision completado para el post ID '${postId}'.`,
      detectionInfo: detectionInfo || {}
    };
  } catch (error) {
    console.error(`Error procesando la imagen principal con Google Vision:`, error);
    throw error;
  }
};

// **Endpoint: Update Post Metadata with OpenAI Generated Text**
app.post('/update-metadata', async (req, res) => {
  const { postId, custom_post_type_name } = req.body; // postId y metadataKey

  if (!postId || !custom_post_type_name) {
    return res.status(400).json({ success: false, message: 'postId y custom_post_type_name son requeridos.' });
  }

  try {
    // Obtener detalles del post desde WordPress
    const getPostEndpoint = `${config.WORDPRESS_API_URL}/appraisals/${postId}`;

    console.log(`Obteniendo detalles del post ID: ${postId}`);
    const postResponse = await fetch(getPostEndpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${encodeURIComponent(config.WORDPRESS_USERNAME)}:${config.WORDPRESS_APP_PASSWORD}`).toString('base64')}`
      }
    });

    if (!postResponse.ok) {
      const errorText = await postResponse.text();
      console.error('Error obteniendo post de WordPress:', errorText);
      return res.status(500).json({ success: false, message: 'Error obteniendo post de WordPress.' });
    }

    const postData = await postResponse.json();

    const postTitle = postData.title.rendered || '';
    const acfFields = postData.acf || {};

    // Obtener URLs de imágenes desde ACF
    const imageFields = ['main', 'age', 'signature'];
    const imageUrls = {};

    for (const field of imageFields) {
      imageUrls[field] = await getImageUrl(acfFields[field]);
    }

    // Registrar las URLs de las imágenes
    console.info(`Post ID: ${postId} - Images:`, imageUrls);

    // Obtener el prompt correspondiente
    const prompt = await getPrompt(custom_post_type_name);

    // Generar el texto con OpenAI
    const generatedText = await generateTextWithOpenAI(prompt, postTitle, imageUrls);

    // Actualizar el metadato en WordPress
    await updateWordPressMetadata(postId, custom_post_type_name, generatedText);

    res.json({ success: true, message: `Metadata '${custom_post_type_name}' actualizado exitosamente.` });
  } catch (error) {
    console.error('Error actualizando metadata:', error);
    res.status(500).json({ success: false, message: 'Error actualizando metadata.' });
  }
});

// **Nuevo Endpoint: Completar Informe de Tasación Completo**
app.post('/complete-appraisal-report', async (req, res) => {
  const { postId } = req.body;

  if (!postId) {
    return res.status(400).json({ success: false, message: 'postId es requerido.' });
  }

  try {
    // Obtener detalles del post desde WordPress
    const getPostEndpoint = `${config.WORDPRESS_API_URL}/appraisals/${postId}`;

    console.log(`Obteniendo detalles del post ID: ${postId}`);
    const postResponse = await fetch(getPostEndpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${encodeURIComponent(config.WORDPRESS_USERNAME)}:${config.WORDPRESS_APP_PASSWORD}`).toString('base64')}`
      }
    });

    if (!postResponse.ok) {
      const errorText = await postResponse.text();
      console.error('Error obteniendo post de WordPress:', errorText);
      return res.status(500).json({ success: false, message: 'Error obteniendo post de WordPress.' });
    }

    const postData = await postResponse.json();

    const postTitle = postData.title.rendered || '';
    const acfFields = postData.acf || {};

    // Obtener la URL de la imagen principal
    const mainImageUrl = await getImageUrl(acfFields.main);
    if (!mainImageUrl) {
      throw new Error('Imagen principal no encontrada en el post.');
    }
    console.info(`Post ID: ${postId} - Main Image URL: ${mainImageUrl}`);

    // Analizar la imagen con Google Vision para obtener detecciones web
    let detectionInfo;
    try {
      detectionInfo = await analyzeImageWithGoogleVision(mainImageUrl);
    } catch (visionError) {
      console.error(`Error en Google Vision para post ID ${postId}:`, visionError.message);
      detectionInfo = null;
    }

    if (detectionInfo) {
      // Extraer URLs de imágenes similares proporcionadas por Google Vision
      const similarImageUrls = detectionInfo.visuallySimilarImages.map(image => image.url).filter(url => url);

      console.log('Imágenes similares obtenidas de Google Vision:', similarImageUrls);

      if (similarImageUrls.length > 0) {
        // Subir las imágenes similares a WordPress y obtener sus IDs
        const uploadedImageIds = [];
        for (const url of similarImageUrls) {
          try {
            const imageId = await uploadImageToWordPress(url);
            if (imageId) {
              uploadedImageIds.push(imageId);
            }
          } catch (uploadError) {
            console.error(`Error subiendo la imagen similar desde ${url}:`, uploadError.message);
            // Continuar con la siguiente imagen
          }
        }

        if (uploadedImageIds.length > 0) {
          try {
            // Actualizar el metadato 'GoogleVision' en WordPress
            const metadataKey = 'GoogleVision'; // Asegúrate de que este es el nombre correcto del metadato
            const metadataValue = uploadedImageIds;

            await updateWordPressMetadata(postId, metadataKey, metadataValue);
            console.info(`Metadato '${metadataKey}' actualizado correctamente en WordPress.`);
          } catch (metadataError) {
            console.error(`Error actualizando metadata 'GoogleVision' en WordPress para post ID ${postId}:`, metadataError.message);
            // Continuar con el siguiente paso
          }
        } else {
          console.warn('No se pudieron subir imágenes similares a WordPress.');
        }
      } else {
        console.warn('No se encontraron imágenes similares en las detecciones de Google Vision.');
      }
    } else {
      console.warn('No se pudo obtener información de Google Vision.');
    }

    // Listar todos los archivos .txt en la carpeta 'prompts'
    const promptsDir = path.join(__dirname, 'prompts');
    let txtFiles = [];
    try {
      const files = await fs.readdir(promptsDir);
      txtFiles = files.filter(file => path.extname(file).toLowerCase() === '.txt');
    } catch (fsError) {
      console.error('Error listando archivos de prompts:', fsError.message);
      // Continuar
    }

    if (txtFiles.length === 0) {
      console.warn('No se encontraron archivos de prompt en la carpeta.');
    } else {
      // Procesar cada archivo .txt
      for (const file of txtFiles) {
        const custom_post_type_name = path.basename(file, '.txt');
        let prompt;
        try {
          prompt = await getPrompt(custom_post_type_name);
        } catch (promptError) {
          console.error(`Error obteniendo prompt para '${custom_post_type_name}':`, promptError.message);
          continue; // Saltar al siguiente archivo
        }

        let generatedText;
        try {
          generatedText = await generateTextWithOpenAI(prompt, postTitle, { main: mainImageUrl });
        } catch (openAIError) {
          console.error(`Error generando texto con OpenAI para '${custom_post_type_name}':`, openAIError.message);
          continue; // Saltar al siguiente archivo
        }

        try {
          // Actualizar el metadato en WordPress
          await updateWordPressMetadata(postId, custom_post_type_name, generatedText);
          console.info(`Metadata '${custom_post_type_name}' actualizado correctamente en WordPress.`);
        } catch (metadataError) {
          console.error(`Error actualizando metadata '${custom_post_type_name}' en WordPress:`, metadataError.message);
          // Continuar con el siguiente archivo
        }
      }
    }
    console.log('Enviando respuesta de éxito al cliente.');

    res.json({ success: true, message: 'Informe de tasación completado exitosamente.' });
  } catch (error) {
    console.error('Error en /complete-appraisal-report:', error);
    res.status(500).json({ success: false, message: error.message || 'Error completando el informe de tasación.' });
  }
});



// Iniciar el servidor después de cargar los secretos, inicializar Vision Client y Google APIs
loadSecrets().then(async () => {
  initializeVisionClient(); // Inicializar el cliente de Vision
  await initializeGoogleApis(); // Inicializar las APIs de Google

  
  const PORT = process.env.PORT || 8080;
  app.listen(PORT, () => {
    console.log(`Servidor backend corriendo en el puerto ${PORT}`);
  });
});
