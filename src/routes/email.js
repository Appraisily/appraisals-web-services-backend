const express = require('express');
const { rateLimit } = require('express-rate-limit');
const validator = require('validator');
const sheetsService = require('../services/sheets');
const pubsubService = require('../services/pubsub');
const cloudServices = require('../services/storage');

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
    console.log('\n=== Starting Email Submission Process ===');
    const { email, sessionId } = req.body;

    // Validate request
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

    // Get session metadata
    const bucket = cloudServices.getBucket();
    const metadataFile = bucket.file(`sessions/${sessionId}/metadata.json`);
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

    // Prepare message for CRM
    const message = {
      crmProcess: "screenerNotification",
      customer: {
        email: email
      },
      origin: "screener",
      timestamp: Date.now(),
      sessionId: sessionId,
      metadata: {
        analysisId: sessionId,
        source: "analysis-backend",
        imageUrl: metadata.imageUrl,
        originalName: metadata.originalName,
        analyzed: metadata.analyzed,
        originAnalyzed: metadata.originAnalyzed || false
      }
    };

    // Publish to CRM-tasks topic
    await pubsubService.publishToCRM(message);
    console.log('✓ Message published to CRM-tasks');

    // Update Google Sheets with email submission
    try {
      const rowIndex = await sheetsService.findRowBySessionId(sessionId);
      if (rowIndex === -1) {
        console.warn(`Session ID ${sessionId} not found in spreadsheet`);
      } else {
        await sheetsService.sheets.spreadsheets.values.update({
          spreadsheetId: sheetsService.sheetsId,
          range: `Sheet1!K${rowIndex + 1}:L${rowIndex + 1}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [[
              email,
              new Date().toISOString()
            ]]
          }
        });
        console.log('✓ Email submission logged to sheets');
      }
    } catch (error) {
      console.error('Failed to log email submission to sheets:', error);
      // Don't fail the request if sheets logging fails
    }

    // Update metadata with email submission
    metadata.email = {
      submissionTime: message.timestamp,
      processed: false
    };

    await metadataFile.save(JSON.stringify(metadata, null, 2), {
      contentType: 'application/json',
      metadata: {
        cacheControl: 'no-cache'
      }
    });

    console.log('✓ Session metadata updated with email submission');
    console.log('=== Email Submission Process Complete ===\n');

    // Send success response
    res.json({
      success: true,
      message: 'Email submission received and queued for processing.',
      submissionTime: message.timestamp
    });

  } catch (error) {
    console.error('\n✗ Email submission error:', error);
    console.error('Stack trace:', error.stack);
    console.log('=== Email Submission Process Failed ===\n');
    
    res.status(500).json({
      success: false,
      message: 'Error processing email submission.',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal Server Error'
    });
  }
});

module.exports = router;