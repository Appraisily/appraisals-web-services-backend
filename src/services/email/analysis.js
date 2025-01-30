const cloudServices = require('../storage');
const fetch = require('node-fetch');

// Increased timeout to 60 seconds for long-running analyses
const FETCH_TIMEOUT = 60000;
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function performAnalysisWithRetry(endpoint, sessionId, baseUrl, retryCount = 0) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    const response = await fetch(`${baseUrl}/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`${endpoint} failed with status ${response.status}`);
    }

    const result = await response.json();
    return endpoint === 'full-analysis' ? result.results.detailedAnalysis : result.results;
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error(`Timeout exceeded for ${endpoint} (${FETCH_TIMEOUT}ms)`);
    } else {
      console.error(`Error in ${endpoint}:`, error);
    }

    if (retryCount < MAX_RETRIES) {
      console.log(`Retrying ${endpoint} (attempt ${retryCount + 1}/${MAX_RETRIES})...`);
      await sleep(RETRY_DELAY);
      return performAnalysisWithRetry(endpoint, sessionId, baseUrl, retryCount + 1);
    }

    console.error(`${endpoint} failed after ${MAX_RETRIES} retries`);
    return null;
  }
}

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

  const results = {
    analysis: null,
    origin: null,
    detailed: null
  };

  // Helper function to load existing analysis
  const loadExistingAnalysis = async (file, type) => {
    try {
      console.log(`Loading existing ${type} analysis...`);
      const [content] = await file.download();
      return JSON.parse(content.toString());
    } catch (error) {
      console.error(`Error loading existing ${type} analysis:`, error);
      return null;
    }
  };

  // Process visual search first if needed
  if (!analysisExists[0]) {
    console.log('\nPerforming visual search analysis...');
    results.analysis = await performAnalysisWithRetry('visual-search', sessionId, baseUrl);
  } else {
    results.analysis = await loadExistingAnalysis(files.analysis, 'visual search');
  }

  // Only proceed with origin and detailed analysis if visual search succeeded
  if (results.analysis) {
    // Process origin and detailed analysis in parallel
    const [originResult, detailedResult] = await Promise.all([
      !originExists[0] ? 
        performAnalysisWithRetry('origin-analysis', sessionId, baseUrl) : 
        loadExistingAnalysis(files.origin, 'origin'),
      !detailedExists[0] ? 
        performAnalysisWithRetry('full-analysis', sessionId, baseUrl) : 
        loadExistingAnalysis(files.detailed, 'detailed')
    ]);

    results.origin = originResult;
    results.detailed = detailedResult;
  }

  console.log('\nAnalysis processing complete:', {
    visualSearch: results.analysis ? '✓' : '✗',
    origin: results.origin ? '✓' : '✗',
    detailed: results.detailed ? '✓' : '✗'
  });
  console.log('=== Analysis Processing Complete ===\n');

  return results;
}

module.exports = { processAnalysis };