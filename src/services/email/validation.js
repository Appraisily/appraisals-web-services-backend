const validator = require('validator');
const argon2 = require('argon2');
const cloudServices = require('../storage');
const encryption = require('../encryption');

async function validateAndProcessEmail({ email, sessionId }) {
  // Validate required fields
  if (!email || !sessionId) {
    return {
      success: false,
      message: 'Email and sessionId are required.'
    };
  }

  // Validate email format
  if (!validator.isEmail(email)) {
    return {
      success: false,
      message: 'Invalid email format.'
    };
  }

  // Get session metadata
  const bucket = cloudServices.getBucket();
  const metadataFile = bucket.file(`sessions/${sessionId}/metadata.json`);
  const [exists] = await metadataFile.exists();

  if (!exists) {
    return {
      success: false,
      message: 'Session not found.'
    };
  }

  // Process email security
  const emailHash = await argon2.hash(email, {
    type: argon2.argon2id,
    memoryCost: 2 ** 16,
    timeCost: 3,
    parallelism: 1
  });

  const [metadataContent] = await metadataFile.download();
  const metadata = JSON.parse(metadataContent.toString());

  metadata.emailHash = emailHash;
  metadata.email = {
    submissionTime: Date.now(),
    hash: emailHash,
    encrypted: encryption.encrypt(email),
    verified: false
  };

  await metadataFile.save(JSON.stringify(metadata, null, 2), {
    contentType: 'application/json',
    metadata: { cacheControl: 'no-cache' }
  });

  return {
    success: true,
    email,
    sessionId,
    metadata
  };
}

module.exports = { validateAndProcessEmail };