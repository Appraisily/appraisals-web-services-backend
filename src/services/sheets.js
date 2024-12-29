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

    // Validate inputs
    if (!sessionId || !timestamp) {
      console.error('Invalid input parameters for sheets logging');
      return false;
    }

    try {
      console.log('Attempting to log upload to Google Sheets...');
      
      // Get auth client with retry
      let client;
      try {
        client = await this.auth.getClient();
        console.log('Auth client obtained successfully');
      } catch (authError) {
        console.error('Auth client error:', authError);
        return false;
      }

      const formattedDate = new Date(timestamp).toISOString();
      
      // First verify access to the spreadsheet
      try {
        await this.sheets.spreadsheets.get({
          spreadsheetId: this.sheetsId,
          ranges: ['Sheet1!A1:B1'],
          fields: 'sheets.properties.title'
        });
      } catch (accessError) {
        if (accessError.code === 403) {
          console.error(`Access denied to spreadsheet. Please ensure the service account (${client.email}) has edit access to the spreadsheet.`);
          return false;
        }
        throw accessError;
      }

      // Attempt to append the data
      try {
        const response = await this.sheets.spreadsheets.values.append({
          spreadsheetId: this.sheetsId,
          range: 'Sheet1!A:B',
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [[formattedDate, sessionId]]
          }
        });

        console.log('Successfully logged to sheets:', {
          updatedRange: response.data.updates.updatedRange,
          updatedRows: response.data.updates.updatedRows
        });
      } catch (appendError) {
        console.error('Error appending data:', appendError);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error logging to sheets:', {
        message: error.message,
        code: error.code,
        status: error.status,
        details: error.errors || error
      });
      return false;
    }
  }
}

module.exports = new SheetsService();