const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const mime = require('mime-types');
const cloudServices = require('../services/storage');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

router.post('/upload-temp', upload.single('image'), async (req, res) => {
  try {
    console.log('Received request to /upload-temp endpoint.');
    
    if (!req.file) {
      console.warn('No file uploaded in the request.');
      return res.status(400).json({ 
        success: false, 
        message: 'No file uploaded.' 
      });
    }

    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(req.file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid file type. Only JPEG, PNG, and WebP images are allowed. Maximum file size is 10MB.'
      });
    }

    console.log(`Received file: ${req.file.originalname}, size: ${req.file.size} bytes.`);

    const sessionId = uuidv4();
    const sessionFolder = `sessions/${sessionId}`;
    const fileExtension = mime.extension(req.file.mimetype);
    const imageFileName = `${sessionFolder}/UserUploadedImage.${fileExtension}`;

    const sessionMetadata = {
      originalName: req.file.originalname,
      timestamp: Date.now(),
      analyzed: false,
      mimeType: req.file.mimetype,
      size: req.file.size
    };

    const bucket = cloudServices.getBucket();
    const file = bucket.file(imageFileName);
    console.log(`Preparing to upload image as: ${imageFileName}`);

    await file.save(req.file.buffer, {
      resumable: false,
      contentType: req.file.mimetype,
      metadata: {
        cacheControl: 'public, max-age=3600',
      },
    });

    console.log('Image uploaded to GCS successfully.');
    
    const imageUrl = `https://storage.googleapis.com/${bucket.name}/${imageFileName}`;
    sessionMetadata.imageUrl = imageUrl;

    const metadataFile = bucket.file(`${sessionFolder}/metadata.json`);
    await metadataFile.save(JSON.stringify(sessionMetadata, null, 2), {
      contentType: 'application/json',
      metadata: {
        cacheControl: 'no-cache'
      }
    });

    console.log(`Session metadata saved for session ID: ${sessionId}`);

    res.json({
      success: true,
      message: 'Image uploaded successfully.',
      imageUrl: imageUrl,
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

module.exports = router;