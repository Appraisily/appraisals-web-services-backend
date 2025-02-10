const cloudServices = require('../../../services/storage');

async function validateSession(sessionId) {
  const bucket = cloudServices.getBucket();
  const metadataFile = bucket.file(`sessions/${sessionId}/metadata.json`);
  const [exists] = await metadataFile.exists();

  if (!exists) {
    const error = new Error('Session not found.');
    error.statusCode = 404;
    throw error;
  }

  const [metadataContent] = await metadataFile.download();
  const metadata = JSON.parse(metadataContent.toString());

  return { metadata };
}

module.exports = {
  validateSession
};