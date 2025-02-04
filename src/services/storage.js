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
}

module.exports = new CloudServices();