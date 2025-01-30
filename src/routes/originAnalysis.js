const express = require('express');
const cloudServices = require('../services/storage');
const openai = require('../services/openai');
const { filterValidImageUrls } = require('../utils/urlValidator');
const originFormatter = require('../services/originFormatter');
const sheetsService = require('../services/sheets');
const fetch = require('node-fetch');

const router = express.Router();

async function waitForAnalysis(sessionId, bucket, maxRetries = 5, retryDelay = 2000) {
  console.log(`\n=== Waiting for Analysis (Session: ${sessionId}) ===`);
  let retries = 0;
  while (retries < maxRetries) {
    const analysisFile = bucket.file(`sessions/${sessionId}/analysis.json`);
    console.log(`Checking for analysis file (attempt ${retries + 1}/${maxRetries})...`);
    const [exists] = await analysisFile.exists();
    
    if (exists) {
      console.log('✓ Analysis file found, downloading content...');
      const [content] = await analysisFile.download();
      const analysis = JSON.parse(content.toString());
      console.log('✓ Analysis content loaded successfully');
      console.log('=== Wait for Analysis Complete ===\n');
      return analysis;
    }
    
    retries++;
    if (retries < maxRetries) {
      console.log(`Waiting ${retryDelay}ms before next attempt...`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }
  console.log('✗ Analysis wait timeout exceeded');
  console.log('=== Wait for Analysis Failed ===\n');
  throw new Error('Visual analysis did not complete in time');
}

router.post('/origin-analysis', async (req, res) => {
  try {
    console.log('\n=== Starting Origin Analysis ===');
    const { sessionId } = req.body;
    
    if (!sessionId) {
      console.log('✗ No session ID provided');
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
    console.log('\nChecking session existence...');
    const [metadataExists] = await metadataFile.exists();
    if (!metadataExists) {
      console.log('✗ Session not found');
      return res.status(404).json({
        success: false,
        message: 'Session not found.'
      });
    }
    console.log('✓ Session exists');

    // Check if analysis exists
    console.log('\nChecking for existing visual analysis...');
    const [analysisExists] = await analysisFile.exists();
    let analysis;

    if (!analysisExists) {
      console.log('Visual analysis not found, initiating visual search...');
      try {
        // Get base URL for visual search
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        console.log(`Base URL for visual search: ${baseUrl}`);

        // Trigger visual search
        console.log('Sending visual search request...');
        const response = await fetch(`${baseUrl}/visual-search`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ sessionId })
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Visual search response:', {
            status: response.status,
            statusText: response.statusText,
            body: errorText
          });
          throw new Error(`Visual search failed with status ${response.status}: ${errorText}`);
        }

        // Wait for analysis to complete
        console.log('Visual search initiated, waiting for completion...');
        analysis = await waitForAnalysis(sessionId, bucket);
        console.log('✓ Visual analysis completed successfully');
      } catch (error) {
        console.error('✗ Error performing visual analysis:', error);
        console.error('Stack trace:', error.stack);
        return res.status(500).json({
          success: false,
          message: 'Failed to perform required visual analysis.',
          error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
      }
    } else {
      // Load existing analysis
      console.log('Loading existing visual analysis...');
      const [analysisContent] = await analysisFile.download();
      analysis = JSON.parse(analysisContent.toString());
      console.log('✓ Existing analysis loaded');
    }

    // Load metadata
    console.log('\nLoading session metadata...');
    const [metadataContent] = await metadataFile.download();
    const metadata = JSON.parse(metadataContent.toString());
    console.log('✓ Session metadata loaded');

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
    console.log('Processing similar images...');
    const allSimilarImages = analysis.vision?.matches?.similar || [];
    console.log(`Found ${allSimilarImages.length} similar images`);
    
    // Filter and validate similar image URLs before sending to OpenAI
    console.log('\nFiltering and validating top 5 similar images...');
    const topSimilarImages = allSimilarImages.slice(0, 5);
    const validSimilarImages = await filterValidImageUrls(topSimilarImages);
    console.log(`✓ Validated ${validSimilarImages.length} images out of ${topSimilarImages.length}`);

    // Call OpenAI with the user's image and similar images
    console.log('\nCalling OpenAI for origin analysis...');
    const originAnalysis = await openai.analyzeOrigin(
      metadata.imageUrl,
      validSimilarImages
    );
    console.log('✓ OpenAI analysis complete');

    // Log analysis details
    console.log('\nAnalysis Summary:');
    console.log('----------------');
    console.log('Session:', {
      id: sessionId,
      metadata: {
        originalName: metadata.originalName,
        timestamp: metadata.timestamp,
        analyzed: metadata.analyzed,
        mimeType: metadata.mimeType,
        size: metadata.size
      }
    });
    console.log('Analysis Results:', {
      timestamp: analysis.timestamp,
      webEntities: analysis.vision?.webEntities?.length || 0,
      matches: {
        exact: analysis.vision?.matches?.exact?.length || 0,
        partial: analysis.vision?.matches?.partial?.length || 0,
        similar: analysis.vision?.matches?.similar?.length || 0
      },
      labels: analysis.vision?.description?.labels?.length || 0
    });
    console.log('----------------\n');

    // Get the user uploaded image path
    const fileExtension = metadata.mimeType ? metadata.mimeType.split('/')[1] : 'jpeg';
    const userImagePath = `sessions/${sessionId}/UserUploadedImage.${fileExtension}`;
    
    // Verify image exists
    console.log('Verifying original image...');
    const imageFile = bucket.file(userImagePath);
    const [imageExists] = await imageFile.exists();
    
    if (!imageExists) {
      console.log('✗ Original image not found');
      return res.status(404).json({
        success: false,
        message: 'Original uploaded image not found.'
      });
    }
    console.log('✓ Original image verified');

    const userImageUrl = `https://storage.googleapis.com/${bucket.name}/${userImagePath}`;

    // Extract relevant data from analysis
    console.log('\nExtracting analysis data...');
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
    console.log('\nFormatting and saving origin analysis...');
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
      console.error('✗ Failed to save origin analysis results');
      throw new Error('Failed to save origin analysis results');
    }
    console.log('✓ Origin analysis saved successfully');

    // Update metadata to mark origin analysis as complete
    console.log('\nUpdating session metadata...');
    metadata.originAnalyzed = true;
    metadata.originAnalysisTimestamp = Date.now();
    
    await metadataFile.save(JSON.stringify(metadata, null, 2), {
      contentType: 'application/json',
      metadata: {
        cacheControl: 'no-cache'
      }
    });
    console.log('✓ Session metadata updated');

    console.log(`\n✓ Origin analysis completed for session ${sessionId}`);
    console.log('=== Origin Analysis Complete ===\n');

    res.json({
      success: true,
      message: 'Origin analysis completed successfully.',
      results: originResults,
      analyzed: true,
      analysisTimestamp: metadata.originAnalysisTimestamp
    });

  } catch (error) {
    console.error('\n✗ Error processing origin analysis:', error);
    console.error('Stack trace:', error.stack);
    console.log('=== Origin Analysis Failed ===\n');
    
    res.status(500).json({
      success: false,
      message: 'Error processing origin analysis.',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal Server Error.'
    });
  }
});

module.exports = router;