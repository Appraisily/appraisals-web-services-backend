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
    const secrets = {};

    // Load all secrets in parallel with proper mapping
    await Promise.all(REQUIRED_SECRETS.map(async (secretName) => {
      try {
        const value = await getSecret(secretName);
        // Special handling for service-account-json
        if (secretName === 'service-account-json') {
          secrets.service_account_json = value;
        } else {
          secrets[secretName.replace(/-/g, '_').toUpperCase()] = value;
        }
      } catch (error) {
        console.error(`Failed to load secret ${secretName}:`, error);
        throw error;
      }
    }));
    
    console.log('All secrets loaded successfully.');

    // Write service account JSON to temporary file
    const keyFilePath = path.join(__dirname, '../../keyfile.json');
    console.log(`Writing service account JSON to ${keyFilePath}.`);
    await fs.writeFile(keyFilePath, secrets.service_account_json);
    console.log('Service account JSON written successfully.');

    return { secrets, keyFilePath };
  } catch (error) {
    console.error('Error loading secrets:', error);
    throw error;
  }
};

module.exports = { loadSecrets };