const express = require('express');
const { rateLimit } = require('express-rate-limit');
const validator = require('validator');
const sheetsService = require('../services/sheets');
const pubsubService = require('../services/pubsub');
const cloudServices = require('../services/storage');
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
    console.log('Checking session and analysis files...');
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

    // Check for required analysis files
    const analysisFile = bucket.file(`sessions/${sessionId}/analysis.json`);
    const originFile = bucket.file(`sessions/${sessionId}/origin.json`);
    const detailedFile = bucket.file(`sessions/${sessionId}/detailed.json`);

    const [analysisExists, originExists, detailedExists] = await Promise.all([
      analysisFile.exists(),
      originFile.exists(),
      detailedFile.exists()
    ]);

    // Get base URL for API calls
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    
    // Trigger missing analyses in sequence
    if (!analysisExists[0]) {
      console.log('Visual analysis missing, triggering analysis...');
      try {
        const response = await fetch(`${baseUrl}/visual-search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId })
        });
        
        if (!response.ok) {
          throw new Error(`Visual search failed with status ${response.status}`);
        }
      } catch (error) {
        console.error('Failed to perform visual analysis:', error);
        throw new Error('Failed to complete required visual analysis');
      }
    }

    if (!originExists[0]) {
      console.log('Origin analysis missing, triggering analysis...');
      try {
        const response = await fetch(`${baseUrl}/origin-analysis`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId })
        });
        
        if (!response.ok) {
          throw new Error(`Origin analysis failed with status ${response.status}`);
        }
      } catch (error) {
        console.error('Failed to perform origin analysis:', error);
        throw new Error('Failed to complete required origin analysis');
      }
    }

    // Verify all analyses are now complete
    const [finalAnalysisExists, finalOriginExists] = await Promise.all([
      bucket.file(`sessions/${sessionId}/analysis.json`).exists(),
      bucket.file(`sessions/${sessionId}/origin.json`).exists()
    ]);

    if (!finalAnalysisExists[0] || !finalOriginExists[0]) {
      throw new Error('Failed to complete all required analyses');
    }

    if (!detailedExists[0]) {
      console.log('Detailed analysis missing, triggering analysis...');
      try {
        const response = await fetch(`${baseUrl}/full-analysis`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId })
        });
        
        if (!response.ok) {
          throw new Error(`Detailed analysis failed with status ${response.status}`);
        }
      } catch (error) {
        console.error('Failed to perform detailed analysis:', error);
        throw new Error('Failed to complete required detailed analysis');
      }
    }

    // Verify detailed analysis is now complete
    const [finalDetailedExists] = await bucket.file(`sessions/${sessionId}/detailed.json`).exists();
    if (!finalDetailedExists) {
      throw new Error('Failed to complete detailed analysis');
    }

    // Prepare message for CRM
    const message = {
      crmProcess: "screenerNotification",
      customer: {
        email: email
      },
      sessionId: sessionId,
      metadata: {
        originalName: metadata.originalName,
        imageUrl: metadata.imageUrl,
        mimeType: metadata.mimeType,
        size: metadata.size
      },
      timestamp: Date.now()
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