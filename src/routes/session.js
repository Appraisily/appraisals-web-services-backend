const express = require('express');
const cloudServices = require('../services/storage');
const { ValidationError, NotFoundError } = require('../utils/errors');
const { param } = require('express-validator');
const { validate } = require('../middleware/validation');

const router = express.Router();

// Add validation for sessionId parameter
router.get('/:sessionId', [
  param('sessionId')
    .notEmpty()
    .withMessage('Session ID is required')
    .isString()
    .withMessage('Session ID must be a string'),
  validate
], async (req, res, next) => {
  try {
    const { sessionId } = req.params;

    const bucket = cloudServices.getBucket();
    const metadataFile = bucket.file(`sessions/${sessionId}/metadata.json`);
    const [metadataExists] = await metadataFile.exists();

    if (!metadataExists) {
      throw new NotFoundError('Session not found');
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
      data: {
        session: {
          id: sessionId,
          metadata,
          analysis,
          origin
        }
      },
      error: null
    });

  } catch (error) {
    next(error);
  }
});

module.exports = router;