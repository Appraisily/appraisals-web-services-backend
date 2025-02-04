const express = require('express');
const mime = require('mime-types');
const cloudServices = require('../services/storage');
const openai = require('../services/openai');
const sheetsService = require('../services/sheets');

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
    console.log('Initiating OpenAI Vision analysis...');
    
    // Run both analyses in parallel
    const [visionResult, openaiAnalysis] = await Promise.all([
      cloudServices.getVisionClient().webDetection({
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
      }),
      openai.analyzeImage(metadata.imageUrl)
    ]);

    const webDetection = visionResult[0].webDetection;

    const formattedResults = {
      webEntities: (webDetection.webEntities || []).map(entity => ({
        entityId: entity.entityId,
        score: entity.score,
        description: entity.description
      })),
      description: {
        labels: webDetection.bestGuessLabels?.map(label => label.label) || [],
        confidence: webDetection.bestGuessLabels?.[0]?.score || 0
      },
      pagesWithMatchingImages: (webDetection.pagesWithMatchingImages || []).map(page => ({
        url: page.url,
        pageTitle: page.pageTitle,
        fullMatchingImages: page.fullMatchingImages || [],
        partialMatchingImages: page.partialMatchingImages || []
      })),
      matches: {
        exact: (webDetection.fullMatchingImages || []).map(img => ({
          url: img.url,
          score: img.score || 1.0,
          type: 'exact',
          metadata: img.metadata || {}
        })),
        partial: (webDetection.partialMatchingImages || []).map(img => ({
          url: img.url,
          score: img.score || 0.5,
          type: 'partial',
          metadata: img.metadata || {}
        })),
        similar: (webDetection.visuallySimilarImages || []).map(img => ({
          url: img.url,
          score: img.score || 0.3,
          type: 'similar',
          metadata: img.metadata || {}
        }))
      },
      derivedSubjects: webDetection.derivedSubjects || [],
      webLabels: (webDetection.webLabels || []).map(label => ({
        label: label.label,
        score: label.score,
        languages: label.languages || []
      }))
    };

    // Save complete analysis results to a dedicated file
    const analysisResults = {
      timestamp: Date.now(),
      vision: formattedResults,
      openai: openaiAnalysis
    };

    const analysisFile = bucket.file(`sessions/${sessionId}/analysis.json`);
    const analysisString = JSON.stringify(analysisResults, null, 2);
    await analysisFile.save(analysisString, {
      contentType: 'application/json',
      metadata: {
        cacheControl: 'no-cache'
      }
    });

    // Log analysis to sheets
    try {
      await sheetsService.updateAnalysisStatus(
        sessionId,
        'visual',
        analysisResults
      );
      console.log('✓ Analysis logged to sheets');
    } catch (error) {
      console.error('Failed to log analysis to sheets:', error);
      // Don't fail the request if sheets logging fails
    }

    // Verify the file was saved
    const [exists] = await analysisFile.exists();
    if (!exists) {
      throw new Error('Failed to save analysis results');
    }
    console.log(`Analysis results saved successfully to sessions/${sessionId}/analysis.json`);

    // Update metadata to mark image as analyzed
    metadata.analyzed = true;
    metadata.analysisTimestamp = Date.now();
    metadata.analysisResults = {
      labels: formattedResults.description.labels,
      webEntities: formattedResults.webEntities.length,
      matchCounts: {
        exact: formattedResults.matches.exact.length,
        partial: formattedResults.matches.partial.length,
        similar: formattedResults.matches.similar.length
      },
      pagesWithMatches: formattedResults.pagesWithMatchingImages.length,
      webLabels: formattedResults.webLabels.length,
      openaiAnalysis: openaiAnalysis
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
      Web Entities: ${formattedResults.webEntities.length}
      Exact matches: ${formattedResults.matches.exact.length}
      Partial matches: ${formattedResults.matches.partial.length}
      Similar images: ${formattedResults.matches.similar.length}
      Pages with matches: ${formattedResults.pagesWithMatchingImages.length}
      Web labels: ${formattedResults.webLabels.length}`);

    res.json({
      success: true,
      message: 'Visual search completed successfully.',
      results: {
        vision: formattedResults,
        openai: openaiAnalysis
      },
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