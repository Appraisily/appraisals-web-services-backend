class AnalysisService {
  constructor() {
    this.bucket = null;
  }

  initialize(bucket) {
    this.bucket = bucket;
  }

  async waitForDetailedAnalysis(sessionId, maxRetries = 5, retryDelay = 2000) {
    if (!this.bucket) {
      throw new Error('Analysis service not initialized');
    }

    let retries = 0;
    while (retries < maxRetries) {
      try {
        const detailedFile = this.bucket.file(`sessions/${sessionId}/detailed.json`);
        const [exists] = await detailedFile.exists();
        
        if (exists) {
          const [content] = await detailedFile.download();
          return JSON.parse(content.toString());
        }
      } catch (error) {
        console.error(`Error checking detailed analysis (attempt ${retries + 1}):`, error);
      }
      
      retries++;
      if (retries < maxRetries) {
        console.log(`Waiting for detailed analysis... (attempt ${retries}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
    return null;
  }
}

module.exports = new AnalysisService();