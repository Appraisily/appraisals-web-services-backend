const cloudServices = require('../storage');
const fetch = require('node-fetch');

async function processAnalysis(sessionId, baseUrl) {
  console.log('\n=== Starting Analysis Processing ===');
  console.log('Session ID:', sessionId);

  const bucket = cloudServices.getBucket();
  const sessionFolder = `sessions/${sessionId}`;

  // Check for existing analyses
  console.log('Checking for existing analysis files...');
  const files = {
    analysis: bucket.file(`${sessionFolder}/analysis.json`),
    origin: bucket.file(`${sessionFolder}/origin.json`),
    detailed: bucket.file(`${sessionFolder}/detailed.json`),
  };

  const [analysisExists, originExists, detailedExists] = await Promise.all([
    files.analysis.exists().catch(() => [false]),
    files.origin.exists().catch(() => [false]),
    files.detailed.exists().catch(() => [false])
  ]);

  console.log('Analysis files status:', {
    visualSearch: analysisExists[0] ? 'exists' : 'missing',
    origin: originExists[0] ? 'exists' : 'missing',
    detailed: detailedExists[0] ? 'exists' : 'missing'
  });

  console.log('\nProcessing required analyses...');

  // Load or perform analyses
  const results = {
    analysis: null,
    origin: null,
    detailed: null
  };

  // Helper function to perform analysis
  const performAnalysis = async (endpoint, file, exists) => {
    if (exists[0]) {
      console.log(`Loading existing ${endpoint} analysis...`);
      try {
        const [content] = await file.download();
        return JSON.parse(content.toString());
      } catch (error) {
        console.error(`Error loading existing ${endpoint} analysis:`, error);
        return null;
      }
    }

    console.log(`Performing new ${endpoint} analysis...`);
    try {
      const response = await fetch(`${baseUrl}/${endpoint}`, {
        timeout: 30000, // 30 second timeout
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      });

      if (!response.ok) {
        console.error(`${endpoint} analysis failed with status ${response.status}`);
        return null;
      }

      const result = await response.json();
      const content = endpoint === 'full-analysis' ? result.results.detailedAnalysis : result.results;

      try {
        console.log(`Saving ${endpoint} analysis results...`);
        await file.save(JSON.stringify(content, null, 2), {
          contentType: 'application/json',
          metadata: { cacheControl: 'no-cache' }
        });
      } catch (saveError) {
        console.error(`Error saving ${endpoint} analysis:`, saveError);
        // Continue with the content even if saving fails
      }

      return content;
    } catch (error) {
      console.error(`Error performing ${endpoint} analysis:`, error);
      return null;
    }
  };

  // Perform analyses in parallel and handle failures gracefully
  const analysisPromises = await Promise.allSettled([
    performAnalysis('visual-search', files.analysis, analysisExists),
    performAnalysis('origin-analysis', files.origin, originExists),
    performAnalysis('full-analysis', files.detailed, detailedExists)
  ]);

  // Process results, keeping null for failed analyses
  results.analysis = analysisPromises[0].status === 'fulfilled' ? analysisPromises[0].value : null;
  results.origin = analysisPromises[1].status === 'fulfilled' ? analysisPromises[1].value : null;
  results.detailed = analysisPromises[2].status === 'fulfilled' ? analysisPromises[2].value : null;

  console.log('\nAnalysis processing complete:', {
    visualSearch: results.analysis ? '✓' : '✗',
    origin: results.origin ? '✓' : '✗',
    detailed: results.detailed ? '✓' : '✗'
  });
  console.log('=== Analysis Processing Complete ===\n');

  return results;
}

module.exports = { processAnalysis };