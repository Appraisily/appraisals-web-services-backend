const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
const fs = require('fs').promises;
const path = require('path');

const secretClient = new SecretManagerServiceClient();

const getSecret = async (secretName) => {
  try {
    const projectId = 'civil-forge-403609';
    const name = `projects/${projectId}/secrets/${secretName}/versions/latest`;

    console.log(`Attempting to retrieve secret '${secretName}' from Secret Manager.`);
    const [version] = await secretClient.accessSecretVersion({ name });
    const payload = version.payload.data.toString('utf8');
    console.log(`Secret '${secretName}' retrieved successfully.`);
    return payload;
  } catch (error) {
    console.error(`Error retrieving secret '${secretName}':`, error);
    throw new Error(`Could not retrieve secret '${secretName}'.`);
  }
};

const loadSecrets = async () => {
  try {
    console.log('Loading secrets from Secret Manager...');
    const secrets = {
      GOOGLE_CLOUD_PROJECT_ID: await getSecret('GOOGLE_CLOUD_PROJECT_ID'),
      SERVICE_ACCOUNT_JSON: await getSecret('service-account-json'),
      GCS_BUCKET_NAME: await getSecret('GCS_BUCKET_NAME'),
      OPENAI_API_KEY: await getSecret('OPENAI_API_KEY'),
      EMAIL_ENCRYPTION_KEY: await getSecret('EMAIL_ENCRYPTION_KEY')
    };
    console.log('All secrets loaded successfully.');

    // Write service account JSON to temporary file
    const keyFilePath = path.join(__dirname, '../../keyfile.json');
    console.log(`Writing service account JSON to ${keyFilePath}.`);
    await fs.writeFile(keyFilePath, secrets.SERVICE_ACCOUNT_JSON);
    console.log('Service account JSON written successfully.');

    return { secrets, keyFilePath };
  } catch (error) {
    console.error('Error loading secrets:', error);
    throw error;
  }
};

module.exports = { loadSecrets };