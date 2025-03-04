const cloudServices = require('../../../services/storage');
const openai = require('../../../services/openai');
const sheetsService = require('../../../services/sheets');
const formatters = require('../utils/formatters');
const metadataHandler = require('../utils/metadataHandler');
const imageDownloader = require('../utils/imageDownloader');
const mime = require('mime-types');
const { ValidationError, NotFoundError, ServerError } = require('../../../utils/errors');

module.exports = { processVisualSearch };

async function processVisualSearch(req, res, next) {
  try {
    const { sessionId } = req.body;
    
    console.log(`Processing visual search for session ID: ${sessionId}`);

    // Get session metadata
    const bucket = cloudServices.getBucket();
    const metadataFile = bucket.file(`sessions/${sessionId}/metadata.json`);
    const [metadataExists] = await metadataFile.exists();

    if (!metadataExists) {
      throw new NotFoundError('Session not found');
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
      throw new NotFoundError('Image not found');
    }

    // Check if analysis already exists
    const analysisFile = bucket.file(`sessions/${sessionId}/analysis.json`);
    const [analysisExists] = await analysisFile.exists();

    if (analysisExists) {
      // Load existing analysis
      const [analysisContent] = await analysisFile.download();
      const analysis = JSON.parse(analysisContent.toString());
      
      console.log('Using existing analysis');
      
      // Update metadata if needed
      if (!metadata.analyzed) {
        metadata.analyzed = true;
        await metadataHandler.updateMetadata(sessionId, metadata);
      }
      
      // Return standardized success response
      return res.json({
        success: true,
        data: {
          analysis
        },
        error: null
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
    const formattedResults = formatters.formatVisionResults(webDetection);

    // Download and store similar images
    console.log('\nProcessing similar images...');
    const similarImages = formattedResults.matches.similar;
    const storedImages = await imageDownloader.downloadAndStoreSimilarImages(sessionId, similarImages);
    
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
    const analysisString = JSON.stringify(analysisResults, null, 2);
    await analysisFile.save(analysisString, {
      contentType: 'application/json',
      metadata: {
        cacheControl: 'no-cache'
      }
    });

    // Log analysis to sheets
    try {
      const rowIndex = await sheetsService.findRowBySessionId(sessionId);
      if (rowIndex !== -1) {
        await sheetsService.sheets.spreadsheets.values.update({
          spreadsheetId: sheetsService.sheetsId,
          range: `Sheet1!E${rowIndex + 1}:F${rowIndex + 1}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [['Visual Analysis Complete', JSON.stringify(analysisResults)]]
          }
        });
        console.log('✓ Visual analysis status and JSON saved to sheets');
      }
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
    const updatedMetadata = await metadataHandler.updateMetadata(sessionId, metadata, formattedResults, openaiAnalysis);

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
    next(error);
  }
}