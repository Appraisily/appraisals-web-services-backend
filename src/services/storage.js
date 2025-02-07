const { Storage } = require('@google-cloud/storage');
const { ImageAnnotatorClient } = require('@google-cloud/vision');
const openai = require('./openai');

class CloudServices {
  constructor() {
    this.storage = null;
    this.bucket = null;
    this.visionClient = null;
  }

  async initialize(projectId, keyFilePath, bucketName, openaiApiKey) {
    try {
      // Initialize Google Cloud Storage
      console.log('Initializing Google Cloud Storage client...');
      this.storage = new Storage({
        projectId,
        keyFilename: keyFilePath,
      });
      console.log('Google Cloud Storage client initialized.');

      this.bucket = this.storage.bucket(bucketName);
      console.log(`Bucket set to: ${bucketName}`);

      // Verify bucket exists
      const [exists] = await this.bucket.exists();
      if (!exists) {
        throw new Error(`Bucket '${bucketName}' does not exist.`);
      }
      console.log(`Bucket '${bucketName}' exists and is accessible.`);

      // Initialize Vision client
      console.log('Initializing Google Vision client...');
      this.visionClient = new ImageAnnotatorClient({
        projectId,
        keyFilename: keyFilePath,
      });
      console.log('Google Vision client initialized.');
      // Initialize OpenAI client
      console.log('Initializing OpenAI client...');
      openai.initialize(openaiApiKey);
      console.log('OpenAI client initialized.');

    } catch (error) {
      console.error('Error initializing cloud services:', error);
      throw error;
    }
  }

  getBucket() {
    return this.bucket;
  }

  getVisionClient() {
    return this.visionClient;
  }

  async generateHtmlReport(sessionId) {
    if (!this.bucket) {
      throw new Error('Storage not initialized');
    }

    try {
      console.log(`Generating HTML report for session ${sessionId}...`);
      
      // Load all analysis files including value analysis
      const [analysisContent, originContent, detailedContent, valueContent] = await Promise.all([
        this.bucket.file(`sessions/${sessionId}/analysis.json`).download().then(([content]) => JSON.parse(content.toString())),
        this.bucket.file(`sessions/${sessionId}/origin.json`).download().then(([content]) => JSON.parse(content.toString())),
        this.bucket.file(`sessions/${sessionId}/detailed.json`).download().then(([content]) => JSON.parse(content.toString())),
        this.bucket.file(`sessions/${sessionId}/value.json`).download().then(([content]) => JSON.parse(content.toString()))
      ]);

      // Prepare data for OpenAI
      const reportData = {
        visualAnalysis: analysisContent,
        originAnalysis: originContent,
        detailedAnalysis: detailedContent,
        valueAnalysis: valueContent
      };

      // Generate HTML report
      const htmlContent = await openai.generateHtmlReport(reportData);

      // Save HTML report
      const reportFile = this.bucket.file(`sessions/${sessionId}/report.html`);
      await reportFile.save(htmlContent, {
        contentType: 'text/html',
        metadata: {
          cacheControl: 'no-cache'
        }
      });

      console.log('✓ HTML report generated and saved');
      return htmlContent;
    } catch (error) {
      console.error('Error generating HTML report:', error);
      throw error;
    }
  }
}

module.exports = new CloudServices();