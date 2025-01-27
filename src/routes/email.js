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
    console.log(`Processing email submission for session ${sessionId}`);

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
    const files = {
      analysis: bucket.file(`${sessionFolder}/analysis.json`),
      origin: bucket.file(`${sessionFolder}/origin.json`),
      detailed: bucket.file(`${sessionFolder}/detailed.json`),
    };

    // Check which files exist
    console.log('Checking for existing analysis files...');
    const [analysisExists, originExists, detailedExists] = await Promise.all([
      files.analysis.exists().catch(() => [false]),
      files.origin.exists().catch(() => [false]),
      files.detailed.exists().catch(() => [false])
    ]);

    console.log('Analysis files status:', {
      visualSearch: analysisExists[0] ? 'exists' : 'missing',
      origin: originExists[0] ? 'exists' : 'missing',
      detailed: detailedExists[0] ? 'exists' : 'missing'
    });

    // Helper function to perform analysis
    const performAnalysis = async (endpoint, file, exists) => {
      if (exists[0]) {
        console.log(`Loading existing ${endpoint} analysis...`);
        const [content] = await file.download();
        return JSON.parse(content.toString());
      } else {
        console.log(`No existing ${endpoint} analysis found, performing new analysis...`);
      }

      console.log(`Performing ${endpoint} analysis...`);
      console.log(`Request URL: ${baseUrl}/${endpoint}`);
      console.log(`Request body:`, { sessionId });

      const response = await fetch(`${baseUrl}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      });

      const responseText = await response.text();
      console.log(`Response status: ${response.status}`);
      console.log(`Response body: ${responseText}`);

      if (!response.ok) {
        throw new Error(`Failed to perform ${endpoint} analysis: ${response.status} ${responseText}`);
      }

      let result;
      try {
        result = JSON.parse(responseText);
      } catch (error) {
        console.error(`Error parsing ${endpoint} response:`, error);
        throw new Error(`Invalid JSON response from ${endpoint}`);
      }

      if (!result.success) {
        throw new Error(`${endpoint} analysis failed: ${result.message}`);
      }

      let content = endpoint === 'full-analysis' ? result.results.detailedAnalysis : result.results;
      
      // Save the analysis result
      console.log(`Saving ${endpoint} analysis results...`);
      console.log(`Content to save:`, JSON.stringify(content, null, 2));

      await file.save(JSON.stringify(content, null, 2), {
        contentType: 'application/json',
        metadata: {
          cacheControl: 'no-cache'
        }
      }).catch(error => {
        console.error(`Error saving ${endpoint} analysis to file:`, error);
        throw error;
      });

      return content;
    };

    // Perform all analyses in parallel
    const [analysisContent, originContent, detailedContent] = await Promise.all([
      performAnalysis('visual-search', files.analysis, analysisExists)
        .catch(error => {
          console.error('Error in visual search analysis:', error);
          return null;
        }),
      performAnalysis('origin-analysis', files.origin, originExists)
        .catch(error => {
          console.error('Error in origin analysis:', error);
          return null;
        }),
      performAnalysis('full-analysis', files.detailed, detailedExists)
        .catch(error => {
          console.error('Error in detailed analysis:', error);
          return null;
        })
    ]);

    // Generate the report using the composer
    const reportHtml = reportComposer.composeAnalysisReport(
      metadata,
      {
        visualSearch: analysisContent,
        originAnalysis: originContent,
        detailedAnalysis: detailedContent
      }
    );

    // Update sheets and send email in parallel
    const [emailSent] = await Promise.allSettled([
      emailService.sendFreeReport(email, reportHtml),
      emailService.sendPersonalOffer(email, detailedContent),
      sheetsService.updateEmailSubmission(sessionId, email)
        .catch(error => {
          console.error('Failed to log email submission to sheets:', error);
        })
    ]);

    if (emailSent.status === 'rejected') {
      throw emailSent.reason;
    }

    res.json({
      success: true,
      message: 'Email submitted successfully.',
      emailHash,
      submissionTime: metadata.email.submissionTime
    });

  } catch (error) {
    try {
      // Try to update sheets one more time if it failed earlier
      await sheetsService.updateEmailSubmission(
        sessionId,
        email
      ).catch(error => {
        console.error('Failed to log email submission to sheets:', error);
      });
    } catch (error) {
      console.error('Error logging to sheets:', error);
    }

    console.error('Error processing email submission:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing email submission.',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal Server Error.'
    });
  }
});

module.exports = router;