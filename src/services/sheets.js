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
    this.sheetsId = sheetsId;

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
      
      this.initialized = true;
      console.log('Google Sheets service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Google Sheets service:', error);
      throw error;
    }
  }

  async findRowBySessionId(sessionId) {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.sheetsId,
      range: 'Sheet1!A:P', // Extended range to include new columns
    });

    const rows = response.data.values || [];
    return rows.findIndex(row => row[1] === sessionId);
  }

  async logUpload(sessionId, timestamp, imageUrl) {
    if (!this.initialized) {
      throw new Error('Sheets service not initialized');
    }

    try {
      console.log('Logging upload to Google Sheets...');
      
      // Get the next available row
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.sheetsId,
        range: 'Sheet1!A:A'
      });
      
      const nextRow = (response.data.values || []).length + 1;
      
      // Add new row with upload data
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.sheetsId,
        range: `Sheet1!A${nextRow}:H${nextRow}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[
            nextRow - 1,                    // A: Row number
            sessionId,                      // B: Session ID
            new Date(timestamp).toISOString(), // C: Upload Time
            imageUrl,                       // D: Image URL
            'Pending Analysis',             // E: Analysis Status
            '',                            // F: Analysis Time
            'Pending Origin',               // G: Origin Status
            ''                             // H: Origin Time
          ]]
        }
      });

      console.log('Successfully logged upload to sheets');
      return true;
    } catch (error) {
      console.error('Error logging upload to sheets:', error);
      throw error;
    }
  }

  async updateEmailSubmission(sessionId, email) {
    if (!this.initialized) {
      throw new Error('Sheets service not initialized');
    }

    try {
      console.log('Attempting to update email submission in Google Sheets...');
      
      const rowIndex = await this.findRowBySessionId(sessionId);
      if (rowIndex === -1) {
        console.error(`Session ID ${sessionId} not found in spreadsheet`);
        return false;
      }

      // Update email submission details
      await this.sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: this.sheetsId,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          data: [
            {
              range: `Sheet1!I${rowIndex + 1}:J${rowIndex + 1}`,
              values: [[
                email,                          // I: Email
                new Date().toISOString(),       // J: Email Submission Time
              ]]
            }
          ]
        }
      });

      console.log('Successfully updated email submission in sheets');
      return true;
    } catch (error) {
      console.error('Error updating email submission in sheets:', error);
      return false;
    }
  }

  async updateFreeReportStatus(sessionId, success = true) {
    if (!this.initialized) {
      throw new Error('Sheets service not initialized');
    }

    try {
      console.log('Attempting to update free report status in Google Sheets...');
      
      const rowIndex = await this.findRowBySessionId(sessionId);
      if (rowIndex === -1) {
        console.error(`Session ID ${sessionId} not found in spreadsheet`);
        return false;
      }

      await this.sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: this.sheetsId,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          data: [
            {
              range: `Sheet1!K${rowIndex + 1}:L${rowIndex + 1}`,
              values: [[
                success ? 'Free Report Sent' : 'Free Report Failed',  // K: Free Report Status
                new Date().toISOString(),                            // L: Free Report Time
              ]]
            }
          ]
        }
      });

      console.log('Successfully updated free report status in sheets');
      return true;
    } catch (error) {
      console.error('Error updating free report status in sheets:', error);
      return false;
    }
  }

  async updateOfferStatus(sessionId, success = true, offerContent = '') {
    if (!this.initialized) {
      throw new Error('Sheets service not initialized');
    }

    try {
      console.log('Attempting to update offer status in Google Sheets...');
      
      const rowIndex = await this.findRowBySessionId(sessionId);
      if (rowIndex === -1) {
        console.error(`Session ID ${sessionId} not found in spreadsheet`);
        return false;
      }

      await this.sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: this.sheetsId,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          data: [
            {
              range: `Sheet1!M${rowIndex + 1}:P${rowIndex + 1}`,
              values: [[
                success ? 'Offer Sent' : 'Offer Failed',  // M: Offer Status
                new Date().toISOString(),                 // N: Offer Time
                success ? 'Yes' : 'No',                   // O: Offer Delivered
                offerContent                              // P: Offer Content
              ]]
            }
          ]
        }
      });

      console.log('Successfully updated offer status in sheets');
      return true;
    } catch (error) {
      console.error('Error updating offer status in sheets:', error);
      return false;
    }
  }
}

module.exports = new SheetsService();