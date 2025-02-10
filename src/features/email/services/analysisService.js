const cloudServices = require('../../../services/storage');
const fetch = require('node-fetch');

class AnalysisService {
  async processRequiredAnalyses(sessionId, req) {
    const bucket = cloudServices.getBucket();
    const baseUrl = `${req.protocol}://${req.get('host')}`;

    // Check required analyses
    const [analysisExists, originExists, detailedExists, valueExists] = await Promise.all([
      bucket.file(`sessions/${sessionId}/analysis.json`).exists(),
      bucket.file(`sessions/${sessionId}/origin.json`).exists(),
      bucket.file(`sessions/${sessionId}/detailed.json`).exists(),
      bucket.file(`sessions/${sessionId}/value.json`).exists()
    ]);

    // Process visual analysis if needed
    if (!analysisExists[0]) {
      await this.triggerAnalysis(baseUrl, 'visual-search', sessionId);
      await this.verifyAnalysisFile(bucket, sessionId, 'analysis.json');
    }

    // Process origin analysis if needed
    if (!originExists[0]) {
      await this.triggerAnalysis(baseUrl, 'origin-analysis', sessionId);
      await this.verifyAnalysisFile(bucket, sessionId, 'origin.json');
    }

    // Process detailed analysis if needed
    if (!detailedExists[0]) {
      await this.triggerAnalysis(baseUrl, 'full-analysis', sessionId);
      await this.verifyAnalysisFile(bucket, sessionId, 'detailed.json');
    }

    // Process value analysis if needed
    if (!valueExists[0]) {
      await this.triggerAnalysis(baseUrl, 'find-value', sessionId);
      await this.verifyAnalysisFile(bucket, sessionId, 'value.json');
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