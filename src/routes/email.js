const express = require('express');
const { rateLimit } = require('express-rate-limit');
const validator = require('validator');
const argon2 = require('argon2');
const cloudServices = require('../services/storage');
const emailService = require('../services/email');
const encryption = require('../services/encryption');
const sheetsService = require('../services/sheets');
const reportComposer = require('../services/reportComposer');
const fetch = require('node-fetch');

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

    if (!email || !sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Email and sessionId are required.'
      });
    }

    if (!validator.isEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format.'
      });
    }

    const sessionFolder = `sessions/${sessionId}`;
    const bucket = cloudServices.getBucket();
    const metadataFile = bucket.file(`${sessionFolder}/metadata.json`);
    const baseUrl = `${req.protocol}://${req.get('host')}`;

    const [exists] = await metadataFile.exists();

    if (!exists) {
      return res.status(404).json({
        success: false,
        message: 'Session not found.'
      });
    }

    const [metadataContent] = await metadataFile.download();
    const metadata = JSON.parse(metadataContent.toString());

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

    // Check for existing analyses
    const analysisFile = bucket.file(`${sessionFolder}/analysis.json`);
    const originFile = bucket.file(`${sessionFolder}/origin.json`);
    const detailedFile = bucket.file(`${sessionFolder}/detailed.json`);

    const [analysisExists, originExists, detailedExists] = await Promise.all([
      analysisFile.exists(),
      originFile.exists(),
      detailedFile.exists()
    ]);

    // Load or perform visual search analysis
    let analysisContent;
    if (analysisExists[0]) {
      console.log('Loading existing visual search analysis...');
      [analysisContent] = await analysisFile.download()
        .then(([content]) => [JSON.parse(content.toString())]);
    } else {
      console.log('Performing visual search analysis...');
      const visualSearchResponse = await fetch(`${baseUrl}/visual-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      });
      
      if (!visualSearchResponse.ok) {
        throw new Error('Failed to perform visual search analysis');
      }
      
      const visualSearchResult = await visualSearchResponse.json();
      analysisContent = visualSearchResult.results;
    }

    // Load or perform origin analysis
    let originContent;
    if (originExists[0]) {
      console.log('Loading existing origin analysis...');
      [originContent] = await originFile.download()
        .then(([content]) => [JSON.parse(content.toString())]);
    } else {
      console.log('Performing origin analysis...');
      const originAnalysisResponse = await fetch(`${baseUrl}/origin-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      });
      
      if (!originAnalysisResponse.ok) {
        throw new Error('Failed to perform origin analysis');
      }
      
      const originAnalysisResult = await originAnalysisResponse.json();
      originContent = originAnalysisResult.results;
    }

    // Load or perform detailed analysis
    let detailedContent;
    if (detailedExists[0]) {
      console.log('Loading existing detailed analysis...');
      [detailedContent] = await detailedFile.download()
        .then(([content]) => [JSON.parse(content.toString())]);
    } else {
      console.log('Performing detailed analysis...');
      const fullAnalysisResponse = await fetch(`${baseUrl}/full-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      });
      
      if (!fullAnalysisResponse.ok) {
        throw new Error('Failed to perform detailed analysis');
      }
      
      const fullAnalysisResult = await fullAnalysisResponse.json();
      detailedContent = fullAnalysisResult.results.detailedAnalysis;
    }

    console.log('Full analysis completed successfully');

    // Generate the report using the composer
    const reportHtml = reportComposer.composeAnalysisReport(
      metadata,
      {
        visualSearch: analysisContent,
        originAnalysis: originContent,
        detailedAnalysis: detailedContent
      }
    );

    await emailService.sendFreeReport(email, reportHtml);

    try {
      await sheetsService.updateEmailSubmission(
        sessionId,
        email
      ).catch(error => {
        console.error('Failed to log email submission to sheets:', error);
      });
    } catch (error) {
      console.error('Error logging to sheets:', error);
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