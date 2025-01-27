const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
const fs = require('fs').promises;
const path = require('path');

const PROJECT_ID = 'civil-forge-403609';
const REQUIRED_SECRETS = [
  'GOOGLE_CLOUD_PROJECT_ID',
  'service-account-json',
  'GCS_BUCKET_NAME',
  'OPENAI_API_KEY',
  'EMAIL_ENCRYPTION_KEY',
  'SENDGRID_API_KEY',
  'SENDGRID_EMAIL',
  'SEND_GRID_TEMPLATE_FREE_REPORT',
  'SEND_GRID_TEMPLATE_PERSONAL_OFFER',
  'DIRECT_API_KEY',
  'SHEETS_ID_FREE_REPORTS_LOG'
];

const secretClient = new SecretManagerServiceClient();

const getSecret = async (secretName) => {
  try {
    const name = `projects/${PROJECT_ID}/secrets/${secretName}/versions/latest`;

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
    
    // Load all secrets in parallel
    const secretPromises = REQUIRED_SECRETS.map(async (secretName) => {
      const value = await getSecret(secretName);
      return [secretName.replace(/-/g, '_'), value];
    });
    
    const secretEntries = await Promise.all(secretPromises);
    const secrets = Object.fromEntries(secretEntries);
    
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