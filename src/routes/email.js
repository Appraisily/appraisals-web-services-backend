const express = require('express');
const { rateLimit } = require('express-rate-limit');
const validator = require('validator');
const { validateAndProcessEmail } = require('../services/email/validation');
const { processAnalysis } = require('../services/email/analysis');
const { sendEmails } = require('../services/email/delivery');
const sheetsService = require('../services/sheets');

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
    console.log('Request body:', {
      email: req.body.email ? '***@***.***' : undefined,
      sessionId: req.body.sessionId
    });

    // Validate request and process email
    const validationResult = await validateAndProcessEmail(req.body);
    if (!validationResult.success) {
      console.log('✗ Validation failed:', validationResult.message);
      return res.status(400).json(validationResult);
    }

    const { email, sessionId, metadata } = validationResult;
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    console.log('✓ Validation successful');
    console.log('Session metadata updated with email hash');

    // Immediately log email to sheets (don't await)
    sheetsService.updateEmailSubmission(sessionId, email)
      .then(() => console.log('✓ Email logged to sheets'))
      .catch(error => console.error('✗ Failed to log email to sheets:', error));

    // Send immediate success response to client
    console.log('Sending success response to client');
    res.json({
      success: true,
      message: 'Email submission received. Analysis in progress.',
      emailHash: metadata.emailHash,
      submissionTime: metadata.email.submissionTime
    });

    // Process analysis and send emails in background
    (async () => {
      try {
        // Process analysis in background
        console.log('\n=== Starting Background Processing ===');
        console.log('Processing analysis for session:', sessionId);
        const analysisResults = await processAnalysis(sessionId, baseUrl);
        console.log('✓ Analysis processing complete');
        
        // Send emails and update sheets
        console.log('\n=== Starting Email Delivery ===');
        await sendEmails(email, analysisResults, metadata, sessionId);
        console.log('✓ Email delivery complete');
        console.log('=== Email Submission Process Complete ===\n');
      } catch (error) {
        // Log error but don't stop the process
        console.error('\n✗ Background processing error:', error);
        console.error('Stack trace:', error.stack);
        
        // Try to send emails anyway with whatever analysis results we have
        try {
          console.log('\n=== Attempting Email Delivery Despite Errors ===');
          await sendEmails(email, { analysis: null, origin: null, detailed: null }, metadata, sessionId);
          console.log('✓ Email delivery completed with limited analysis');
        } catch (emailError) {
          console.error('✗ Final email delivery attempt failed:', emailError);
        }
        
        console.log('=== Email Submission Process Complete with Errors ===\n');
      }
    })().catch(error => {
      console.error('Unhandled error in background processing:', error);
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