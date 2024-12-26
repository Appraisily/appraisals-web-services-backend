const express = require('express');
const { rateLimit } = require('express-rate-limit');
const validator = require('validator');
const argon2 = require('argon2');
const cloudServices = require('../services/storage');
const emailService = require('../services/email');
const encryption = require('../services/encryption');
const reportComposer = require('../services/reportComposer');

const router = express.Router();

// Rate limiting: 5 requests per minute per IP
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  message: {
    success: false,
    message: 'Too many requests, please try again later.'
  }
});

router.post('/submit-email', limiter, async (req, res) => {
  try {
    const { email, sessionId } = req.body;

    // Validate required fields
    if (!email || !sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Email and sessionId are required.'
      });
    }

    // Validate email format
    if (!validator.isEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format.'
      });
    }

    // Validate session exists
    const sessionFolder = `sessions/${sessionId}`;
    const bucket = cloudServices.getBucket();
    const metadataFile = bucket.file(`${sessionFolder}/metadata.json`);
    const analysisFile = bucket.file(`${sessionFolder}/analysis.json`);
    const originFile = bucket.file(`${sessionFolder}/origin.json`);

    const [exists] = await metadataFile.exists();

    if (!exists) {
      return res.status(404).json({
        success: false,
        message: 'Session not found.'
      });
    }

    // Hash email using Argon2
    const emailHash = await argon2.hash(email, {
      type: argon2.argon2id,
      memoryCost: 2 ** 16,
      timeCost: 3,
      parallelism: 1
    });

    // Update session metadata with hashed email
    const [metadataContent] = await metadataFile.download();
    const metadata = JSON.parse(metadataContent.toString());
    
    metadata.emailHash = emailHash;
    metadata.email = {
      submissionTime: Date.now(),
      hash: emailHash,
      encrypted: encryption.encrypt(email),
      verified: false // For future email verification feature
    };

    await metadataFile.save(JSON.stringify(metadata, null, 2), {
      contentType: 'application/json',
      metadata: {
        cacheControl: 'no-cache'
      }
    });

    // Load analysis and origin data for the report
    const [analysisContent, originContent] = await Promise.all([
      analysisFile.download().then(([content]) => JSON.parse(content.toString())),
      originFile.download().then(([content]) => JSON.parse(content.toString()))
    ]);
    
    // Generate the report using the composer
    const reportHtml = reportComposer.composeAnalysisReport(analysisContent, originContent);

    // Send email with the report
    await emailService.sendFreeReport(email, reportHtml);

    res.json({
      success: true,
      message: 'Email submitted successfully.',
      emailHash,
      submissionTime: metadata.email.submissionTime
    });

  } catch (error) {
    console.error('Error processing email submission:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing email submission.',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal Server Error.'
    });
  }
});

module.exports = router;