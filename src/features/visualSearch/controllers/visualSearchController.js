const cloudServices = require('../../../services/storage');
const openai = require('../../../services/openai');
const sheetsService = require('../../../services/sheets');
const { formatVisionResults } = require('../utils/formatters');
const { updateMetadata } = require('../utils/metadataHandler');
const { downloadAndStoreSimilarImages } = require('../utils/imageDownloader');
const mime = require('mime-types');

module.exports = { processVisualSearch };

async function processVisualSearch(req, res) {
  try {
    const { sessionId } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Session ID is required.'
      });
    }

    console.log(`Processing visual search for session ID: ${sessionId}`);

    // Get session metadata
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

    // Verify image exists
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
    const formattedResults = formatVisionResults(webDetection);

    // Download and store similar images
    console.log('\nProcessing similar images...');
    const similarImages = formattedResults.matches.similar;
    const storedImages = await downloadAndStoreSimilarImages(sessionId, similarImages);
    
    // Add stored image information to the results
    formattedResults.matches.similar = formattedResults.matches.similar.map((img, index) => ({
      ...img,
      storedImage: storedImages[index] || null
    }));

    // Save complete analysis results
    const analysisResults = {
      timestamp: Date.now(),
      vision: formattedResults,
      openai: openaiAnalysis
    };

    // Save analysis results
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

    // Update metadata
    const updatedMetadata = await updateMetadata(sessionId, metadata, formattedResults, openaiAnalysis);

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
      analysisTimestamp: updatedMetadata.analysisTimestamp
    });

  } catch (error) {
    console.error('Error processing visual search:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing visual search.',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal Server Error.'
    });
  }
}