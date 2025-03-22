const express = require('express');
const { rateLimit } = require('express-rate-limit');
const validator = require('validator');
const sheetsService = require('../services/sheets');
const pubsubService = require('../services/pubsub');
const cloudServices = require('../services/storage');
const fetch = require('node-fetch');
const { body } = require('express-validator');
const { validate } = require('../middleware/validation');
const { ValidationError, NotFoundError, ServerError } = require('../utils/errors');

const router = express.Router();

// Rate limiting: 5 requests per minute per IP
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  validate: {
    trustProxy: false,
    xForwardedForHeader: true
  },
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    data: null,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later.',
      details: { retryAfter: '60 seconds' }
    }
  }
});

router.post('/submit-email', 
  limiter, 
  [
    body('email')
      .notEmpty()
      .withMessage('Email is required')
      .isEmail()
      .withMessage('Invalid email format')
      .normalizeEmail({ all_lowercase: true, gmail_remove_dots: false }),
    
    body('sessionId')
      .notEmpty()
      .withMessage('Session ID is required')
      .isString()
      .withMessage('Session ID must be a string'),
    
    // Optional fields can be validated too
    body('name')
      .optional()
      .isString()
      .withMessage('Name must be a string')
      .isLength({ min: 2, max: 100 })
      .withMessage('Name must be between 2 and 100 characters'),
    
    body('subscribeToNewsletter')
      .optional()
      .isBoolean()
      .withMessage('Subscribe to newsletter must be a boolean value'),
    
    validate
  ], 
  async (req, res, next) => {
    try {
      console.log('\n=== Starting Email Submission Process ===');
      const { email, sessionId } = req.body;

      // Get session metadata
      const bucket = cloudServices.getBucket();
      const metadataFile = bucket.file(`sessions/${sessionId}/metadata.json`);
      const [exists] = await metadataFile.exists();

      if (!exists) {
        throw new NotFoundError('Session not found');
      }

      // Send immediate success response to client
      res.json({
        success: true,
        message: 'Email submission received and processing started.',
        submissionTime: Date.now()
      });

      // Continue with async processing
      console.log('Checking session and analysis files...');

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

      // Check for value analysis
      console.log('\nChecking for value analysis...');
      const valueFile = bucket.file(`sessions/${sessionId}/value.json`);
      const [valueExists] = await valueFile.exists();

      if (!valueExists) {
        console.log('Value analysis missing, triggering analysis...');
        try {
          const response = await fetch(`${baseUrl}/find-value`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId })
          });
          
          if (!response.ok) {
            throw new Error(`Value analysis failed with status ${response.status}`);
          }
        } catch (error) {
          console.error('Failed to perform value analysis:', error);
          throw new Error('Failed to complete required value analysis');
        }

        // Verify value analysis is now complete
        const [finalValueExists] = await bucket.file(`sessions/${sessionId}/value.json`).exists();
        if (!finalValueExists) {
          throw new Error('Failed to complete value analysis');
        }
        console.log('✓ Value analysis completed');
      }
      
      // Generate both HTML reports (regular and interactive)
      console.log('\nGenerating HTML reports...');
      try {
        // Generate standard HTML report
        await cloudServices.generateHtmlReport(sessionId);
        console.log('✓ Standard HTML report generated and saved to GCS');

        // Verify report was created
        const [reportExists] = await bucket.file(`sessions/${sessionId}/report.html`).exists();
        if (!reportExists) {
          throw new Error('Standard HTML report file was not created');
        }
        console.log('✓ Standard HTML report file verified');
        
        // Generate interactive HTML report
        await cloudServices.generateInteractiveReport(sessionId);
        console.log('✓ Interactive HTML report generated and saved to GCS');

        // Verify interactive report was created
        const [interactiveReportExists] = await bucket.file(`sessions/${sessionId}/interactive-report.html`).exists();
        if (!interactiveReportExists) {
          throw new Error('Interactive HTML report file was not created');
        }
        console.log('✓ Interactive HTML report file verified');
      } catch (error) {
        console.error('Error generating HTML reports:', error);
        console.error('Stack trace:', error.stack);
        throw new Error('Failed to generate HTML reports: ' + error.message);
      }

      // Prepare message for CRM
      const timestamp = Date.now();
      const message = {
        crmProcess: "screenerNotification",
        customer: {
          email: email,
          name: null
        },
        origin: "screener",
        timestamp: timestamp,
        sessionId: sessionId,
        metadata: {
          originalName: metadata.originalName,
          imageUrl: metadata.imageUrl,
          timestamp: timestamp,
          analyzed: metadata.analyzed || false,
          originAnalyzed: metadata.originAnalyzed || false,
          size: metadata.size,
          mimeType: metadata.mimeType
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

    } catch (error) {
      console.error('\n✗ Email submission error:', error);
      console.error('Stack trace:', error.stack);
      console.log('=== Email Submission Process Failed ===\n');
      
      // Only send error response if we haven't sent the success response yet
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'Error processing email submission.',
          error: process.env.NODE_ENV === 'development' ? error.message : 'Internal Server Error'
        });
      } else {
        console.error('Error occurred after sending success response to client');
      }
    }
  }
);

module.exports = router;