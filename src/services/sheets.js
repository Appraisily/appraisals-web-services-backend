const { google } = require('googleapis');

class SheetsService {
  constructor() {
    this.initialized = false;
    this.sheetsId = null;
    this.sheets = null;
  }

  initialize(keyFilePath, sheetsId) {
    if (!keyFilePath || !sheetsId) {
      throw new Error('Service account key file and sheets ID are required');
    }

    const auth = new google.auth.GoogleAuth({
      keyFile: keyFilePath,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    this.sheets = google.sheets({ version: 'v4', auth });
    this.sheetsId = sheetsId;
    this.initialized = true;
  }

  async logUpload(sessionId, timestamp) {
    if (!this.initialized) {
      throw new Error('Sheets service not initialized');
    }

    try {
      const formattedDate = new Date(timestamp).toISOString();
      
      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.sheetsId,
        range: 'Sheet1!A:B',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[formattedDate, sessionId]]
        }
      });

      console.log(`Logged upload to sheets - Session: ${sessionId}, Date: ${formattedDate}`);
      return true;
    } catch (error) {
      console.error('Error logging to sheets:', error);
      throw error;
    }
  }
}

module.exports = new SheetsService();