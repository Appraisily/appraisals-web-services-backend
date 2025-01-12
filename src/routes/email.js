const express = require('express');
const { rateLimit } = require('express-rate-limit');
const validator = require('validator');
const argon2 = require('argon2');
const cloudServices = require('../services/storage');
const emailService = require('../services/email');
const encryption = require('../services/encryption');
const sheetsService = require('../services/sheets');
const reportComposer = require('../services/reportComposer');

const router = express.Router();

// Rate limiting: 5 requests per minute per IP
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
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
    const baseUrl = `${req.protocol}://${req.get('host')}`;

    const [exists] = await metadataFile.exists();

    if (!exists) {
      return res.status(404).json({
        success: false,
        message: 'Session not found.'
      });
    }

    // Load metadata
    const [metadataContent] = await metadataFile.download();
    const metadata = JSON.parse(metadataContent.toString());

    // Hash email using Argon2
    const emailHash = await argon2.hash(email, {
      type: argon2.argon2id,
      memoryCost: 2 ** 16,
      timeCost: 3,
      parallelism: 1
    });

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
    let analysisContent = null;
    let originContent = null;
    let visualSearchCompleted = false;
    let originAnalysisCompleted = false;

    // Check if visual analysis exists, if not perform it
    try {
      [analysisContent] = await analysisFile.download()
        .then(([content]) => [JSON.parse(content.toString())]);
      visualSearchCompleted = true;
    } catch (error) {
      console.log('Analysis file not found, continuing without analysis data');
      const visualSearchResponse = await fetch(`${baseUrl}/visual-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      });
      
      if (!visualSearchResponse.ok) {
        throw new Error('Failed to perform visual analysis');
      }
      
      const visualSearchResult = await visualSearchResponse.json();
      visualSearchCompleted = visualSearchResult.success;
      analysisContent = visualSearchResult.results;
    }

    // Check if origin analysis exists, if not perform it
    try {
      [originContent] = await originFile.download()
        .then(([content]) => [JSON.parse(content.toString())]);
      originAnalysisCompleted = true;
    } catch (error) {
      console.log('Origin file not found, performing origin analysis...');
      const originAnalysisResponse = await fetch(`${req.protocol}://${req.get('host')}/origin-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      });
      
      if (!originAnalysisResponse.ok) {
        throw new Error('Failed to perform origin analysis');
      }
      
      const originAnalysisResult = await originAnalysisResponse.json();
      originAnalysisCompleted = originAnalysisResult.success;
      originContent = originAnalysisResult.results;
    }
    
    if (!visualSearchCompleted || !originAnalysisCompleted) {
      throw new Error('Failed to complete required analysis');
    }
    console.log('All required analysis completed successfully');

    // Generate the report using the composer
    const reportHtml = reportComposer.composeAnalysisReport(analysisContent, originContent);

    // Send email with the report
    await emailService.sendFreeReport(email, reportHtml);

    // Log email submission to sheets
    try {
      await sheetsService.updateEmailSubmission(
        sessionId,
        email
      ).catch(error => {
        // Log error but don't fail the request
        console.error('Failed to log email submission to sheets:', error);
      });
    } catch (error) {
      console.error('Error logging to sheets:', error);
      // Don't fail the request if sheets logging fails
    }

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