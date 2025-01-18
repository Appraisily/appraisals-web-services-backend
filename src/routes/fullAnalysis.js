const express = require('express');
const cloudServices = require('../services/storage');
const openai = require('../services/openai');
const sheetsService = require('../services/sheets');

const router = express.Router();

router.post('/full-analysis', async (req, res) => {
  try {
    const { sessionId } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Session ID is required.'
      });
    }

    console.log(`Processing full analysis for session ID: ${sessionId}`);

    // Get session metadata
    const bucket = cloudServices.getBucket();
    const metadataFile = bucket.file(`sessions/${sessionId}/metadata.json`);

    // Check if session exists
    const [metadataExists] = await metadataFile.exists();
    if (!metadataExists) {
      return res.status(404).json({
        success: false,
        message: 'Session not found.'
      });
    }

    // Load metadata
    const [metadataContent] = await metadataFile.download();
    const metadata = JSON.parse(metadataContent.toString());

    // Perform detailed AI analysis
    console.log('Starting detailed AI analysis...');
    const detailedAnalysis = await openai.analyzeWithFullPrompt(metadata.imageUrl);

    // Save detailed analysis to GCS
    const detailedAnalysisFile = bucket.file(`sessions/${sessionId}/detailed.json`);
    await detailedAnalysisFile.save(JSON.stringify(detailedAnalysis, null, 2), {
      contentType: 'application/json',
      metadata: {
        cacheControl: 'no-cache'
      }
    });

    // Log detailed analysis to sheets
    try {
      await sheetsService.updateDetailedAnalysis(
        sessionId,
        detailedAnalysis
      ).catch(error => {
        // Log error but don't fail the request
        console.error('Failed to log detailed analysis to sheets:', error);
      });
    } catch (error) {
      console.error('Error logging to sheets:', error);
      // Don't fail the request if sheets logging fails
    }

    // Return results
    res.json({
      success: true,
      message: 'Full analysis completed successfully.',
      results: {
        metadata,
        detailedAnalysis
      },
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('Error processing full analysis:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing full analysis.',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal Server Error.'
    });
  }
});

module.exports = router;