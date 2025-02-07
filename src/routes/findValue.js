const express = require('express');
const fetch = require('node-fetch');
const cloudServices = require('../services/storage');

const router = express.Router();

router.post('/find-value', async (req, res) => {
  try {
    const { sessionId } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Session ID is required.'
      });
    }

    console.log(`Processing value estimation for session ID: ${sessionId}`);

    // Get session metadata and detailed analysis
    const bucket = cloudServices.getBucket();
    const detailedFile = bucket.file(`sessions/${sessionId}/detailed.json`);
    const [detailedExists] = await detailedFile.exists();

    if (!detailedExists) {
      return res.status(404).json({
        success: false,
        message: 'Detailed analysis not found. Please run full analysis first.'
      });
    }

    // Load detailed analysis
    const [detailedContent] = await detailedFile.download();
    const detailedAnalysis = JSON.parse(detailedContent.toString());

    if (!detailedAnalysis.concise_description) {
      return res.status(400).json({
        success: false,
        message: 'Concise description not found in detailed analysis.'
      });
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
        cacheControl: 'no-cache',
        contentEncoding: 'gzip'  // Enable compression for larger responses
      }
    });

    // Verify the file was saved
    const [exists] = await valueFile.exists();
    if (!exists) {
      throw new Error('Failed to save value estimation results');
    }
    console.log(`✓ Value estimation results saved successfully with ${valueResults.auctionResults.length} auction results`);

    res.json({
      success: true,
      message: 'Value estimation completed successfully.',
      results: {
        ...valueResults,
        auctionResultsCount: valueResults.auctionResults.length
      }
    });

  } catch (error) {
    console.error('\n✗ Error processing value estimation:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Error processing value estimation.',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal Server Error'
    });
  }
});

module.exports = router;