const express = require('express');
const cloudServices = require('../services/storage');

const router = express.Router();

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

    res.json({
      success: true,
      session: {
        id: sessionId,
        metadata,
        analysis,
        origin
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

module.exports = router;