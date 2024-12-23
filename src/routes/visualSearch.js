const express = require('express');
const mime = require('mime-types');
const cloudServices = require('../services/storage');

const router = express.Router();

router.post('/visual-search', async (req, res) => {
  try {
    const { sessionId } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Session ID is required.'
      });
    }

    console.log(`Processing visual search for session ID: ${sessionId}`);

    const bucket = cloudServices.getBucket();
    const metadataFile = bucket.file(`sessions/${sessionId}/metadata.json`);
    const [metadataExists] = await metadataFile.exists();

    if (!metadataExists) {
      return res.status(404).json({
        success: false,
        message: 'Session not found.'
      });
    }

    const [metadataContent] = await metadataFile.download();
    const metadata = JSON.parse(metadataContent.toString());

    const fileExtension = mime.extension(metadata.mimeType);
    const imageFileName = `sessions/${sessionId}/UserUploadedImage.${fileExtension}`;
    const imageFile = bucket.file(imageFileName);
    const [imageExists] = await imageFile.exists();

    if (!imageExists) {
      return res.status(404).json({
        success: false,
        message: 'Image not found.'
      });
    }

    console.log('Initiating Google Vision web detection...');
    
    const visionClient = cloudServices.getVisionClient();
    const [result] = await visionClient.webDetection({
      image: {
        source: {
          imageUri: metadata.imageUrl
        }
      },
      imageContext: {
        webDetectionParams: {
          includeGeoResults: false
        }
      },
    });

    const webDetection = result.webDetection;

    const formattedResults = {
      description: {
        labels: webDetection.bestGuessLabels?.map(label => label.label) || [],
        confidence: webDetection.bestGuessLabels?.[0]?.score || 0
      },
      matches: {
        exact: (webDetection.fullMatchingImages || []).map(img => ({
          url: img.url,
          score: img.score || 1.0,
          type: 'exact'
        })),
        partial: (webDetection.partialMatchingImages || []).map(img => ({
          url: img.url,
          score: img.score || 0.5,
          type: 'partial'
        })),
        similar: (webDetection.visuallySimilarImages || []).map(img => ({
          url: img.url,
          score: img.score || 0.3,
          type: 'similar'
        }))
      }
    };

    // Update metadata to mark image as analyzed
    metadata.analyzed = true;
    metadata.analysisTimestamp = Date.now();
    metadata.analysisResults = {
      labels: formattedResults.description.labels,
      matchCounts: {
        exact: formattedResults.matches.exact.length,
        partial: formattedResults.matches.partial.length,
        similar: formattedResults.matches.similar.length
      }
    };

    // Save updated metadata
    await metadataFile.save(JSON.stringify(metadata, null, 2), {
      contentType: 'application/json',
      metadata: {
        cacheControl: 'no-cache'
      }
    });

    console.log('Web detection completed successfully');
    console.log(`Analysis results:
      Labels: ${formattedResults.description.labels.length}
      Exact matches: ${formattedResults.matches.exact.length}
      Partial matches: ${formattedResults.matches.partial.length}
      Similar images: ${formattedResults.matches.similar.length}`);

    res.json({
      success: true,
      message: 'Visual search completed successfully.',
      results: formattedResults,
      analyzed: true,
      analysisTimestamp: metadata.analysisTimestamp
    });

  } catch (error) {
    console.error('Error processing visual search:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing visual search.',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal Server Error.'
    });
  }
});

module.exports = router;