const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const mime = require('mime-types');
const cloudServices = require('../services/storage');
const sheetsService = require('../services/sheets');

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
    const imageFileName = `UserUploadedImage.${fileExtension}`;
    const fullImagePath = `${sessionFolder}/${imageFileName}`;

    const sessionMetadata = {
      originalName: req.file.originalname,
      timestamp: Date.now(),
      analyzed: false,
      mimeType: req.file.mimetype,
      size: req.file.size,
      fileName: imageFileName
    };

    const bucket = cloudServices.getBucket();
    const file = bucket.file(fullImagePath);
    console.log(`Preparing to upload image as: ${fullImagePath}`);

    // Create session folder
    try {
      await bucket.file(sessionFolder + '/.keep').save('');
      console.log(`Created session folder: ${sessionFolder}`);
    } catch (error) {
      console.warn('Error creating session folder:', error);
      // Continue since this is not critical
    }

    // Upload the image
    await file.save(req.file.buffer, {
      resumable: false,
      contentType: req.file.mimetype,
      metadata: {
        cacheControl: 'public, max-age=3600',
      },
    });

    console.log('Image uploaded to GCS successfully.');
    
    const imageUrl = `https://storage.googleapis.com/${bucket.name}/${fullImagePath}`;
    sessionMetadata.imageUrl = imageUrl;

    const metadataFile = bucket.file(`${sessionFolder}/metadata.json`);
    const metadataString = JSON.stringify(sessionMetadata, null, 2);
    await metadataFile.save(metadataString, {
      contentType: 'application/json',
      metadata: {
        cacheControl: 'no-cache'
      }
    });

    // Verify metadata was saved
    const [metadataExists] = await metadataFile.exists();
    if (!metadataExists) {
      throw new Error('Failed to save session metadata');
    }
    console.log(`Session metadata saved for session ID: ${sessionId}`);

    // Verify complete session structure
    const sessionFiles = await bucket.getFiles({
      prefix: sessionFolder
    });
    
    console.log('Session structure created:');
    console.log(`- ${sessionFolder}/`);
    console.log(`  ├── ${imageFileName}`);
    console.log(`  └── metadata.json`);

    try {
      await sheetsService.logUpload(
        sessionId,
        sessionMetadata.timestamp,
        imageUrl
      );
      console.log('✓ Upload logged to sheets');
    } catch (error) {
      console.error('Failed to log upload to sheets:', error);
      // Don't fail the request if sheets logging fails
    }

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