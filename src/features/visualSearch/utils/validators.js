const mime = require('mime-types');
const cloudServices = require('../../../services/storage');

async function validateSession(sessionId) {
  const bucket = cloudServices.getBucket();
  const metadataFile = bucket.file(`sessions/${sessionId}/metadata.json`);
  const [metadataExists] = await metadataFile.exists();

  if (!metadataExists) {
    const error = new Error('Session not found.');
    error.statusCode = 404;
    throw error;
  }

  const [metadataContent] = await metadataFile.download();
  const metadata = JSON.parse(metadataContent.toString());

  const fileExtension = mime.extension(metadata.mimeType);
  const imageFileName = `sessions/${sessionId}/UserUploadedImage.${fileExtension}`;
  const imageFile = bucket.file(imageFileName);
  const [imageExists] = await imageFile.exists();

  if (!imageExists) {
    const error = new Error('Image not found.');
    error.statusCode = 404;
    throw error;
  }

  return { metadata, imageFile };
}