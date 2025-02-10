const cloudServices = require('../../../services/storage');
const fetch = require('node-fetch');

class AnalysisService {
  async processRequiredAnalyses(sessionId, req) {
    const bucket = cloudServices.getBucket();
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    let analysisErrors = [];

    // Check required analyses
    const [analysisExists, originExists, detailedExists, valueExists] = await Promise.all([
      bucket.file(`sessions/${sessionId}/analysis.json`).exists(),
      bucket.file(`sessions/${sessionId}/origin.json`).exists(),
      bucket.file(`sessions/${sessionId}/detailed.json`).exists(),
      bucket.file(`sessions/${sessionId}/value.json`).exists()
    ]);

    // Process visual analysis if needed
    if (!analysisExists[0]) {
      try {
        await this.triggerAnalysis(baseUrl, 'visual-search', sessionId);
        await this.verifyAnalysisFile(bucket, sessionId, 'analysis.json');
      } catch (error) {
        console.error('Visual analysis failed:', error);
        analysisErrors.push({ type: 'visual-search', error: error.message });
      }
    }

    // Process origin analysis if needed
    if (!originExists[0]) {
      try {
        await this.triggerAnalysis(baseUrl, 'origin-analysis', sessionId);
        await this.verifyAnalysisFile(bucket, sessionId, 'origin.json');
      } catch (error) {
        console.error('Origin analysis failed:', error);
        analysisErrors.push({ type: 'origin-analysis', error: error.message });
      }
    }

    // Process detailed analysis if needed
    if (!detailedExists[0]) {
      try {
        await this.triggerAnalysis(baseUrl, 'full-analysis', sessionId);
        await this.verifyAnalysisFile(bucket, sessionId, 'detailed.json');
      } catch (error) {
        console.error('Detailed analysis failed:', error);
        analysisErrors.push({ type: 'full-analysis', error: error.message });
      }
    }

    // Process value analysis if needed
    if (!valueExists[0]) {
      try {
        await this.triggerAnalysis(baseUrl, 'find-value', sessionId);
        await this.verifyAnalysisFile(bucket, sessionId, 'value.json');
      } catch (error) {
        console.error('Value analysis failed:', error);
        analysisErrors.push({ type: 'find-value', error: error.message });
      }
    }

    // Log analysis errors but don't throw
    if (analysisErrors.length > 0) {
      console.log('\nAnalysis Errors Summary:');
      analysisErrors.forEach(({ type, error }) => {
        console.log(`- ${type}: ${error}`);
      });
    }
  }

  async triggerAnalysis(baseUrl, endpoint, sessionId) {
    console.log(`${endpoint} missing, triggering analysis...`);
    try {
      const response = await fetch(`${baseUrl}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      });
      
      if (!response.ok) {
        throw new Error(`${endpoint} failed with status ${response.status}`);
      }
    } catch (error) {
      console.error(`Failed to perform ${endpoint}:`, error);
      throw new Error(`Failed to complete required ${endpoint}`);
    }
  }

  async verifyAnalysisFile(bucket, sessionId, filename) {
    const [exists] = await bucket.file(`sessions/${sessionId}/${filename}`).exists();
    if (!exists) {
      throw new Error(`Failed to complete analysis: ${filename} not found`);
    }
    console.log(`✓ ${filename} verified`);
  }
}

module.exports = new AnalysisService();