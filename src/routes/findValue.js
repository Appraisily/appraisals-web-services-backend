const express = require('express');
const fetch = require('node-fetch');
const cloudServices = require('../services/storage');
const sheetsService = require('../services/sheets');

const router = express.Router();

// Map to track in-progress value estimations
const valueEstimationStatusMap = new Map();

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
    
    // Set initial status in the map
    valueEstimationStatusMap.set(sessionId, {
      status: 'processing',
      percentComplete: 10,
      stage: 'Starting value estimation',
      message: 'Beginning value estimation process...',
      startTime: Date.now(),
      estimatedTimeRemaining: 40 // seconds
    });

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

    // Add fallback for missing concise_description
    if (!detailedAnalysis.concise_description) {
      console.warn('Missing concise_description in detailed analysis, generating fallback...');
      
      try {
        // Attempt to generate a concise description from available data
        const metadata = await cloudServices.getSessionMetadata(sessionId);
        
        let category = 'Unknown Item';
        let description = '';
        
        if (metadata && metadata.analysisResults && metadata.analysisResults.openaiAnalysis) {
          category = metadata.analysisResults.openaiAnalysis.category || 'Art';
          description = metadata.analysisResults.openaiAnalysis.description || '';
        }
        
        // Create a fallback description that's usable for value estimation
        detailedAnalysis.concise_description = `${category} ${description}`.trim();
        console.log(`Generated fallback description: "${detailedAnalysis.concise_description}"`);
        
        if (!detailedAnalysis.concise_description || detailedAnalysis.concise_description === '') {
          detailedAnalysis.concise_description = 'Unknown Art Item';
          console.log('Using generic "Unknown Art Item" fallback description');
        }
      } catch (metadataError) {
        console.error('Error getting metadata for fallback description:', metadataError);
        // Set a generic fallback if all else fails
        detailedAnalysis.concise_description = 'Unknown Art Item';
        console.log('Using generic "Unknown Art Item" fallback description due to error');
      }
      
      // Save the updated analysis back to storage
      try {
        await detailedFile.save(JSON.stringify(detailedAnalysis, null, 2), {
          contentType: 'application/json',
          metadata: { cacheControl: 'no-cache' }
        });
        console.log('Updated detailed analysis with fallback concise_description');
      } catch (saveErr) {
        console.error('Failed to save updated detailed analysis:', saveErr);
        // Continue with the fallback in memory even if save fails
      }
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

    // Update status in the map
    valueEstimationStatusMap.set(sessionId, {
      status: 'processing',
      percentComplete: 80,
      stage: 'Processing valuation data',
      message: 'Finalizing value estimation...',
      startTime: Date.now(),
      estimatedTimeRemaining: 10 // seconds
    });

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
    
    // Mark the task as completed in the status map
    valueEstimationStatusMap.set(sessionId, {
      status: 'completed',
      percentComplete: 100,
      stage: 'Value estimation complete',
      message: 'Your value estimation is ready!',
      estimatedTimeRemaining: 0
    });

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
    console.error('\n✗ Error processing value estimation:', error);
    console.error('Stack trace:', error.stack);
    
    // Mark the task as error in the status map
    if (req.body && req.body.sessionId) {
      valueEstimationStatusMap.set(req.body.sessionId, {
        status: 'error',
        percentComplete: 0,
        stage: 'Value estimation failed',
        message: error.message || 'An error occurred during value estimation',
        estimatedTimeRemaining: 0
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error processing value estimation.',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal Server Error'
    });
  }
});

// Add the status endpoint
router.post('/find-value/status', async (req, res) => {
  try {
    const { sessionId } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Session ID is required.'
      });
    }

    // First check if we have an in-memory status
    if (valueEstimationStatusMap.has(sessionId)) {
      const status = valueEstimationStatusMap.get(sessionId);
      
      // If processing, update progress based on elapsed time
      if (status.status === 'processing' && status.startTime) {
        const elapsedMs = Date.now() - status.startTime;
        const elapsedSeconds = Math.floor(elapsedMs / 1000);
        
        // For long-running tasks, simulate progress based on time
        if (elapsedSeconds > 5 && status.percentComplete < 95) {
          // Increase percent complete based on elapsed time
          // Aim for about 2.5% per second, but slower as we approach 100%
          const newPercent = Math.min(
            95, 
            status.percentComplete + (2.5 * Math.max(1, 10 - elapsedSeconds/5))
          );
          
          // Update stages based on progress
          let stage = status.stage;
          let message = status.message;
          
          if (newPercent >= 80 && status.percentComplete < 80) {
            stage = 'Finalizing value estimation';
            message = 'Preparing final results...';
          } else if (newPercent >= 60 && status.percentComplete < 60) {
            stage = 'Calculating value ranges';
            message = 'Determining likely value ranges...';
          } else if (newPercent >= 40 && status.percentComplete < 40) {
            stage = 'Processing auction data';
            message = 'Analyzing comparable sales...';
          } else if (newPercent >= 20 && status.percentComplete < 20) {
            stage = 'Researching market data';
            message = 'Gathering market information...';
          }
          
          // Update the status with new progress
          status.percentComplete = newPercent;
          status.stage = stage;
          status.message = message;
          status.estimatedTimeRemaining = Math.max(0, Math.round((95 - newPercent) / 2.5));
          
          // Save updated status
          valueEstimationStatusMap.set(sessionId, status);
        }
      }
      
      // Return the current status
      return res.json({
        success: true,
        ...valueEstimationStatusMap.get(sessionId)
      });
    }
    
    // If not in memory, check if value.json exists for this session
    const bucket = cloudServices.getBucket();
    const valueFile = bucket.file(`sessions/${sessionId}/value.json`);
    const [valueExists] = await valueFile.exists();
    
    if (valueExists) {
      // Value file exists, indicating completed status
      return res.json({
        success: true,
        status: 'completed',
        percentComplete: 100,
        stage: 'Value estimation complete',
        message: 'Your value estimation is ready!'
      });
    }
    
    // If we reach here, we don't have status information
    // Check if analysis has begun by looking for detailed analysis
    const detailedFile = bucket.file(`sessions/${sessionId}/detailed.json`);
    const [detailedExists] = await detailedFile.exists();
    
    if (detailedExists) {
      // Detailed analysis exists, but value estimation hasn't started yet
      // Create a new entry in the status map
      valueEstimationStatusMap.set(sessionId, {
        status: 'queued',
        percentComplete: 0,
        stage: 'Waiting to start',
        message: 'Value estimation has not started yet',
        startTime: Date.now(),
        estimatedTimeRemaining: 45
      });
      
      return res.json({
        success: true,
        status: 'queued',
        percentComplete: 0,
        stage: 'Waiting to start',
        message: 'Value estimation has not started yet',
        estimatedTimeRemaining: 45
      });
    }
    
    // No detailed analysis either
    return res.status(404).json({
      success: false,
      message: 'No value estimation status found for this session.'
    });
  } catch (error) {
    console.error('Error checking value estimation status:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking value estimation status.',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal Server Error'
    });
  }
});

module.exports = router;