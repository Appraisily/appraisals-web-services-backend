const express = require('express');
const cloudServices = require('../services/storage');
const openai = require('../services/openai');
const { filterValidImageUrls } = require('../utils/urlValidator');
const originFormatter = require('../services/originFormatter');
const sheetsService = require('../services/sheets');

const router = express.Router();

router.post('/origin-analysis', async (req, res) => {
  try {
    const { sessionId } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Session ID is required.'
      });
    }

    console.log(`Processing origin analysis for session ID: ${sessionId}`);

    // Get session metadata and analysis results
    const bucket = cloudServices.getBucket();
    const metadataFile = bucket.file(`sessions/${sessionId}/metadata.json`);
    const analysisFile = bucket.file(`sessions/${sessionId}/analysis.json`);

    // Check if session exists
    const [metadataExists] = await metadataFile.exists();
    if (!metadataExists) {
      return res.status(404).json({
        success: false,
        message: 'Session not found.'
      });
    }

    // Check if analysis exists
    const [analysisExists] = await analysisFile.exists();
    if (!analysisExists) {
      return res.status(400).json({
        success: false,
        message: 'Visual analysis must be performed before origin analysis.'
      });
    }

    // Load metadata and analysis
    const [metadataContent, analysisContent] = await Promise.all([
      metadataFile.download(),
      analysisFile.download()
    ]);

    const metadata = JSON.parse(metadataContent.toString());
    const analysis = JSON.parse(analysisContent.toString());

    // Debug logging for URLs
    console.log('\nURLs to process:');
    console.log('---------------');
    console.log('User Image:', metadata.imageUrl);
    console.log('\nSimilar Images:');
    (analysis.vision?.matches?.similar || []).forEach((img, index) => {
      console.log(`${index + 1}. ${img.url} (score: ${img.score || 'N/A'})`);
    });
    console.log('---------------\n');

    // Extract similar images from the analysis
    const allSimilarImages = analysis.vision?.matches?.similar || [];
    
    // Filter and validate similar image URLs before sending to OpenAI
    // Take only the first 5 images to optimize processing time
    const topSimilarImages = allSimilarImages.slice(0, 5);
    const validSimilarImages = await filterValidImageUrls(topSimilarImages);

    // Call OpenAI with the user's image and similar images
    const originAnalysis = await openai.analyzeOrigin(
      metadata.imageUrl,
      validSimilarImages
    );

    // Log available variables
    console.log('Origin Analysis Variables:');
    console.log('-------------------------');
    console.log('Session ID:', sessionId);
    console.log('Metadata:', {
      originalName: metadata.originalName,
      timestamp: metadata.timestamp,
      analyzed: metadata.analyzed,
      mimeType: metadata.mimeType,
      size: metadata.size,
      imageUrl: metadata.imageUrl
    });
    console.log('Analysis:', {
      timestamp: analysis.timestamp,
      webEntities: analysis.vision?.webEntities?.length,
      matches: {
        exact: analysis.vision?.matches?.exact?.length || 0,
        partial: analysis.vision?.matches?.partial?.length || 0,
        similar: analysis.vision?.matches?.similar?.length || 0
      },
      labels: analysis.vision?.description?.labels,
      openai: analysis.openai
    });

    // Get the user uploaded image path
    const fileExtension = metadata.mimeType ? metadata.mimeType.split('/')[1] : 'jpeg';
    const userImagePath = `sessions/${sessionId}/UserUploadedImage.${fileExtension}`;
    
    // Verify image exists
    const imageFile = bucket.file(userImagePath);
    const [imageExists] = await imageFile.exists();
    
    if (!imageExists) {
      return res.status(404).json({
        success: false,
        message: 'Original uploaded image not found.'
      });
    }

    const userImageUrl = `https://storage.googleapis.com/${bucket.name}/${userImagePath}`;

    // Extract relevant data from analysis
    const {
      vision: {
        webEntities = [],
        matches: {
          exact = [],
          partial = [],
          similar = []
        } = {},
        description: {
          labels = [],
          confidence = 0
        } = {}
      } = {},
      openai: {
        category = '',
        description: openaiDescription = ''
      } = {}
    } = analysis;

    // Organize matches by type
    const allMatches = {
      exact: exact.map(match => ({
        url: match.url,
        score: match.score || 1.0,
        type: 'exact',
        metadata: match.metadata || {}
      })),
      partial: partial.map(match => ({
        url: match.url,
        score: match.score || 0.5,
        type: 'partial',
        metadata: match.metadata || {}
      })),
      similar: similar.map(match => ({
        url: match.url,
        score: match.score || 0.3,
        type: 'similar',
        metadata: match.metadata || {}
      }))
    };

    // Save origin analysis results
    const originResults = originFormatter.formatOriginAnalysis({
      originAnalysis,
      matches: allMatches,
      webEntities,
      visionLabels: { labels, confidence },
      openaiAnalysis: { category, description: openaiDescription }
    });

    const originFile = bucket.file(`sessions/${sessionId}/origin.json`);
    const originString = JSON.stringify(originResults, null, 2);
    await originFile.save(originString, {
      contentType: 'application/json',
      metadata: {
        cacheControl: 'no-cache'
      }
    });

    // Verify the file was saved
    const [exists] = await originFile.exists();
    if (!exists) {
      throw new Error('Failed to save origin analysis results');
    }
    console.log(`Origin analysis results saved successfully to sessions/${sessionId}/origin.json`);

    // Update metadata to mark origin analysis as complete
    metadata.originAnalyzed = true;
    metadata.originAnalysisTimestamp = Date.now();
    
    await metadataFile.save(JSON.stringify(metadata, null, 2), {
      contentType: 'application/json',
      metadata: {
        cacheControl: 'no-cache'
      }
    });

    console.log(`Origin analysis completed for session ${sessionId}`);

    res.json({
      success: true,
      message: 'Origin analysis completed successfully.',
      results: originResults,
      analyzed: true,
      analysisTimestamp: metadata.originAnalysisTimestamp
    });

  } catch (error) {
    console.error('Error processing origin analysis:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing origin analysis.',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal Server Error.'
    });
  }
});

module.exports = router;