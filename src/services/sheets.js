const { google } = require('googleapis');

class SheetsService {
  constructor() {
    this.initialized = false;
    this.sheetsId = null;
    this.sheets = null;
    this.auth = null;
  }

  initialize(keyFilePath, sheetsId) {
    if (!keyFilePath || !sheetsId) {
      throw new Error('Service account key file and sheets ID are required');
    }

    try {
      console.log('Initializing Google Sheets service...');
      this.auth = new google.auth.GoogleAuth({
        keyFile: keyFilePath,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });

      this.sheets = google.sheets({ 
        version: 'v4', 
        auth: this.auth 
      });
      
      this.sheetsId = sheetsId;
      this.initialized = true;
      console.log('Google Sheets service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Google Sheets service:', error);
      throw error;
    }
  }

  async logUpload(sessionId, timestamp) {
    if (!this.initialized) {
      throw new Error('Sheets service not initialized');
    }

    try {
      console.log('Attempting to log upload to Google Sheets...');
      
      // Verify auth and access
      const client = await this.auth.getClient();
      console.log('Auth client obtained successfully');

      const formattedDate = new Date(timestamp).toISOString();
      
      const response = await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.sheetsId,
        range: 'Sheet1!A:B',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[formattedDate, sessionId]]
        }
      });

      console.log('Sheets API Response:', response.status, response.statusText);
      console.log(`Successfully logged upload - Session: ${sessionId}, Date: ${formattedDate}`);
      return true;
    } catch (error) {
      console.error('Error logging to sheets:', {
        message: error.message,
        code: error.code,
        status: error.status,
        details: error.errors
      });
      if (error.message.includes('permission')) {
        console.error('This is likely a permissions issue. Ensure the service account has access to the spreadsheet.');
      }
      throw error;
    }
  }
}

module.exports = new SheetsService();