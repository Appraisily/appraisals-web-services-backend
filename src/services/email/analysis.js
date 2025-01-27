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
      const [content] = await file.download();
      return JSON.parse(content.toString());
    }

    console.log(`Performing new ${endpoint} analysis...`);
    const response = await fetch(`${baseUrl}/${endpoint}`, {
      timeout: 30000, // 30 second timeout
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId })
    });

    if (!response.ok) {
      throw new Error(`Failed to perform ${endpoint} analysis`);
    }

    const result = await response.json();
    const content = endpoint === 'full-analysis' ? result.results.detailedAnalysis : result.results;

    console.log(`Saving ${endpoint} analysis results...`);
    await file.save(JSON.stringify(content, null, 2), {
      contentType: 'application/json',
      metadata: { cacheControl: 'no-cache' }
    });

    return content;
  };

  // Perform analyses in parallel
  [results.analysis, results.origin, results.detailed] = await Promise.all([
    performAnalysis('visual-search', files.analysis, analysisExists),
    performAnalysis('origin-analysis', files.origin, originExists),
    performAnalysis('full-analysis', files.detailed, detailedExists)
  ]);

  console.log('\nAnalysis processing complete:', {
    visualSearch: results.analysis ? '✓' : '✗',
    origin: results.origin ? '✓' : '✗',
    detailed: results.detailed ? '✓' : '✗'
  });
  console.log('=== Analysis Processing Complete ===\n');

  return results;
}

module.exports = { processAnalysis };