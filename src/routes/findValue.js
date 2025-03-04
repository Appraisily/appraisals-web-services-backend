const express = require('express');
const fetch = require('node-fetch');
const cloudServices = require('../services/storage');
const sheetsService = require('../services/sheets');
const { body } = require('express-validator');
const { validate } = require('../middleware/validation');
const { ValidationError, NotFoundError } = require('../utils/errors');

const router = express.Router();

router.post('/find-value', [
  body('sessionId')
    .notEmpty()
    .withMessage('Session ID is required')
    .isString()
    .withMessage('Session ID must be a string'),
  validate
], async (req, res, next) => {
  try {
    const { sessionId } = req.body;
    
    console.log(`Processing value estimation for session ID: ${sessionId}`);

    // Get session metadata and detailed analysis
    const bucket = cloudServices.getBucket();
    const detailedFile = bucket.file(`sessions/${sessionId}/detailed.json`);
    const [detailedExists] = await detailedFile.exists();

    if (!detailedExists) {
      throw new NotFoundError('Detailed analysis not found. Please run full analysis first.');
    }

    // Load detailed analysis
    const [detailedContent] = await detailedFile.download();
    const detailedAnalysis = JSON.parse(detailedContent.toString());

    if (!detailedAnalysis.concise_description) {
      throw new ValidationError('Concise description not found in detailed analysis.', 
        { param: 'detailed_analysis', required: 'concise_description' });
    }

    // Call valuer agent API
    const response = await fetch('https://valuer-agent-856401495068.us-central1.run.app/api/find-value-range', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: detailedAnalysis.concise_description
      })
    });

    if (!response.ok) {
      throw new Error(`Valuer agent responded with status: ${response.status}`);
    }

    const valueData = await response.json();

    // Save value estimation to session
    console.log('Saving value estimation results to GCS...');
    const valueFile = bucket.file(`sessions/${sessionId}/value.json`);
    const valueResults = {
      timestamp: Date.now(),
      query: detailedAnalysis.concise_description,
      ...valueData,  // Include all fields from the response
      auctionResults: valueData.auctionResults.map(result => ({
        title: result.title,
        price: result.price,
        currency: result.currency,
        house: result.house,
        date: result.date,
        description: result.description
      }))
    };
    
    await valueFile.save(JSON.stringify(valueResults, null, 2), {
      contentType: 'application/json',
      metadata: {
        cacheControl: 'no-cache'
      }
    });

    // Verify the file was saved
    const [exists] = await valueFile.exists();
    if (!exists) {
      throw new Error('Failed to save value estimation results');
    }
    console.log(`✓ Value estimation results saved successfully with ${valueResults.auctionResults.length} auction results`);

    // Update Google Sheets
    try {
      const rowIndex = await sheetsService.findRowBySessionId(sessionId);
      if (rowIndex === -1) {
        console.warn(`Session ID ${sessionId} not found in spreadsheet`);
      } else {
        await sheetsService.sheets.spreadsheets.values.update({
          spreadsheetId: sheetsService.sheetsId,
          range: `Sheet1!Q${rowIndex + 1}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [['Value Analysis Complete']]
          }
        });
        console.log('✓ Value analysis status logged to sheets');
      }
    } catch (error) {
      console.error('Failed to log value analysis to sheets:', error);
      // Don't fail the request if sheets logging fails
    }

    res.json({
      success: true,
      message: 'Value estimation completed successfully.',
      results: {
        ...valueResults,
        auctionResultsCount: valueResults.auctionResults.length
      }
    });

  } catch (error) {
    next(error);
  }
});

module.exports = router;