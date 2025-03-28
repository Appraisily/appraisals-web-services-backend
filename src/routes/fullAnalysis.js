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

    // Check if detailed analysis already exists
    const detailedAnalysisFile = bucket.file(`sessions/${sessionId}/detailed.json`);
    const [detailedAnalysisExists] = await detailedAnalysisFile.exists();

    let detailedAnalysis;
    if (detailedAnalysisExists) {
      console.log('Loading existing detailed analysis from GCS...');
      const [detailedAnalysisContent] = await detailedAnalysisFile.download();
      detailedAnalysis = JSON.parse(detailedAnalysisContent.toString());

      // Ensure concise_description exists in existing analysis
      if (!detailedAnalysis.concise_description) {
        console.log('Existing analysis missing concise_description, triggering new analysis...');
        detailedAnalysis = await openai.analyzeWithFullPrompt(metadata.imageUrl);
        
        // Save updated analysis
        await detailedAnalysisFile.save(JSON.stringify(detailedAnalysis, null, 2), {
          contentType: 'application/json',
          metadata: {
            cacheControl: 'no-cache'
          }
        });
      }
    } else {
      // Perform new detailed AI analysis
      console.log('Starting new detailed AI analysis...');
      detailedAnalysis = await openai.analyzeWithFullPrompt(metadata.imageUrl);

      // Save new analysis to GCS
      await detailedAnalysisFile.save(JSON.stringify(detailedAnalysis, null, 2), {
        contentType: 'application/json',
        metadata: {
          cacheControl: 'no-cache'
        }
      });

      // Log new analysis to sheets
      try {
        const rowIndex = await sheetsService.findRowBySessionId(sessionId);
        if (rowIndex !== -1) {
          await sheetsService.sheets.spreadsheets.values.update({
            spreadsheetId: sheetsService.sheetsId,
            range: `Sheet1!I${rowIndex + 1}:J${rowIndex + 1}`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
              values: [['Detailed Analysis Complete', JSON.stringify(detailedAnalysis)]]
            }
          });
          console.log('✓ Detailed analysis status and JSON saved to sheets');
        }
      } catch (error) {
        console.error('Failed to log detailed analysis to sheets:', error);
        // Don't fail the request if sheets logging fails
      }
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