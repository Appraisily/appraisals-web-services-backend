const validator = require('validator');
const emailService = require('../services/emailService');
const { validateSession } = require('../utils/validators');

async function submitEmail(req, res) {
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

    // Validate session exists
    const { metadata } = await validateSession(sessionId);

    // Send immediate success response to client
    console.log('Sending success response to client...');
    res.json({
      success: true,
      message: 'Email submission received and processing started.',
      submissionTime: Date.now()
    });
    console.log('✓ Success response sent to client');

    // Process email submission asynchronously
    emailService.processEmailSubmission(email, sessionId, metadata, req)
      .catch(error => {
        console.error('Async processing error:', error);
      });

  } catch (error) {
    console.error('\n✗ Email submission error:', error);
    console.error('Stack trace:', error.stack);
    console.log('=== Email Submission Process Failed ===\n');
    
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Error processing email submission.',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal Server Error'
      });
    }
  }
}