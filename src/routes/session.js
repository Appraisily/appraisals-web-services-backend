const express = require('express');
const cloudServices = require('../services/storage');

const router = express.Router();

// Helper function to calculate progress for a specific analysis step
function calculateStepProgress(analysisType, sessionId, fileExists, fileData) {
  // Default progress state
  const progress = {
    status: 'pending',
    percent: 0
  };

  if (fileExists) {
    progress.status = 'complete';
    progress.percent = 100;
  } else {
    // Check if it's in progress by looking at timestamps or flags in metadata
    // For now, we'll use a simplified approach
    progress.status = 'processing';
    progress.percent = 50; // Default to 50% when processing
  }

  return progress;
}

router.get('/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Session ID is required.'
      });
    }

    const bucket = cloudServices.getBucket();
    const metadataFile = bucket.file(`sessions/${sessionId}/metadata.json`);
    const [metadataExists] = await metadataFile.exists();

    if (!metadataExists) {
      return res.status(404).json({
        success: false,
        message: 'Session not found.'
      });
    }

    // Load session data
    const [metadataContent] = await metadataFile.download();
    const metadata = JSON.parse(metadataContent.toString());

    // Check if analysis exists
    const analysisFile = bucket.file(`sessions/${sessionId}/analysis.json`);
    const [analysisExists] = await analysisFile.exists();
    let analysis = null;
    
    if (analysisExists) {
      const [analysisContent] = await analysisFile.download();
      analysis = JSON.parse(analysisContent.toString());
    }

    // Check if origin analysis exists
    const originFile = bucket.file(`sessions/${sessionId}/origin.json`);
    const [originExists] = await originFile.exists();
    let origin = null;

    if (originExists) {
      const [originContent] = await originFile.download();
      origin = JSON.parse(originContent.toString());
    }

    // Check if detailed analysis exists
    const detailedFile = bucket.file(`sessions/${sessionId}/detailed.json`);
    const [detailedExists] = await detailedFile.exists();
    let detailed = null;

    if (detailedExists) {
      const [detailedContent] = await detailedFile.download();
      detailed = JSON.parse(detailedContent.toString());
    }

    res.json({
      success: true,
      session: {
        id: sessionId,
        metadata,
        analysis,
        origin,
        detailed
      }
    });

  } catch (error) {
    console.error('Error retrieving session:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving session data.',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal Server Error.'
    });
  }
});

// Add a new endpoint specifically for session status and progress tracking
router.get('/:sessionId/status', async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Session ID is required.'
      });
    }

    console.log(`Fetching status for session: ${sessionId}`);
    
    const bucket = cloudServices.getBucket();
    const metadataFile = bucket.file(`sessions/${sessionId}/metadata.json`);
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

    // Check if visual search analysis exists
    const analysisFile = bucket.file(`sessions/${sessionId}/analysis.json`);
    const [analysisExists] = await analysisFile.exists();
    let analysis = null;
    
    if (analysisExists) {
      const [analysisContent] = await analysisFile.download();
      analysis = JSON.parse(analysisContent.toString());
    }

    // Check if detailed analysis exists
    const detailedFile = bucket.file(`sessions/${sessionId}/detailed.json`);
    const [detailedExists] = await detailedFile.exists();
    let detailed = null;

    if (detailedExists) {
      const [detailedContent] = await detailedFile.download();
      detailed = JSON.parse(detailedContent.toString());
    }

    // Check if origin analysis exists
    const originFile = bucket.file(`sessions/${sessionId}/origin.json`);
    const [originExists] = await originFile.exists();
    let origin = null;

    if (originExists) {
      const [originContent] = await originFile.download();
      origin = JSON.parse(originContent.toString());
    }

    // Determine progress for each step
    const visual_progress = calculateStepProgress('visual', sessionId, analysisExists, analysis);
    const details_progress = calculateStepProgress('details', sessionId, detailedExists, detailed);
    const origin_progress = calculateStepProgress('origin', sessionId, originExists, origin);
    
    // Market research is the final step, usually dependent on origin
    const market_progress = {
      status: origin_progress.status === 'complete' ? 'processing' : 'pending',
      percent: origin_progress.status === 'complete' ? 30 : 0
    };

    // Overall status
    const overallStatus = 
      !analysisExists && !detailedExists && !originExists ? 'starting' :
      analysisExists && detailedExists && originExists ? 'complete' : 'processing';

    // Prepare results object with available analysis data
    const results = {
      metadata,
      ...(analysis && { visualAnalysis: analysis }),
      ...(detailed && { detailedAnalysis: detailed }),
      ...(origin && { originAnalysis: origin })
    };

    res.json({
      success: true,
      data: {
        sessionId,
        status: overallStatus,
        visual_progress,
        details_progress,
        origin_progress,
        market_progress,
        results: overallStatus === 'complete' ? results : null
      },
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('Error retrieving session status:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving session status.',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal Server Error.'
    });
  }
});

module.exports = router;