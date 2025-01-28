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

  async updateVisualSearchResults(sessionId, analysisJson, category) {
    if (!this.initialized) {
      throw new Error('Sheets service not initialized');
    }
    if (!this.sheetsId) {
      throw new Error('Sheets ID not set');
    }

    try {
      console.log('Attempting to update visual search results in Google Sheets...');
      
      // Get auth client
      const client = await this.auth.getClient();
      console.log('Auth client obtained successfully');

      // Find the row with matching sessionId
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.sheetsId,
        range: 'Sheet1!A:M', // Extended range to include new columns
      });

      const rows = response.data.values || [];
      const rowIndex = rows.findIndex(row => row[1] === sessionId);

      if (rowIndex === -1) {
        console.error(`Session ID ${sessionId} not found in spreadsheet`);
        return false;
      }

      // Update the row with analysis results (columns D and E)
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.sheetsId,
        range: `Sheet1!D${rowIndex + 1}:E${rowIndex + 1}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[JSON.stringify(analysisJson), category]]
        }
      });

      console.log('Successfully updated visual search results in sheets');
      return true;
    } catch (error) {
      console.error('Error updating visual search results in sheets:', error);
      return false;
    }
  }

  async updateDetailedAnalysis(sessionId, detailedAnalysis) {
    if (!this.initialized) {
      throw new Error('Sheets service not initialized');
    }

    try {
      console.log('Attempting to update detailed analysis in Google Sheets...');
      
      // Get auth client
      const client = await this.auth.getClient();
      console.log('Auth client obtained successfully');

      // Find the row with matching sessionId
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.sheetsId,
        range: 'Sheet1!A:M',
      });

      const rows = response.data.values || [];
      const rowIndex = rows.findIndex(row => row[1] === sessionId);

      if (rowIndex === -1) {
        console.error(`Session ID ${sessionId} not found in spreadsheet`);
        return false;
      }

      // Update the row with detailed analysis (column H)
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.sheetsId,
        range: `Sheet1!H${rowIndex + 1}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[JSON.stringify(detailedAnalysis)]]
        }
      });

      console.log('Successfully updated detailed analysis in sheets');
      return true;
    } catch (error) {
      console.error('Error updating detailed analysis in sheets:', error);
      return false;
    }
  }

  async updateOriginAnalysisResults(sessionId, originJson) {
    if (!this.initialized) {
      throw new Error('Sheets service not initialized');
    }

    try {
      console.log('Attempting to update origin analysis results in Google Sheets...');
      
      // Get auth client
      const client = await this.auth.getClient();
      console.log('Auth client obtained successfully');

      // Find the row with matching sessionId
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.sheetsId,
        range: 'Sheet1!A:M',
      });

      const rows = response.data.values || [];
      const rowIndex = rows.findIndex(row => row[1] === sessionId);

      if (rowIndex === -1) {
        console.error(`Session ID ${sessionId} not found in spreadsheet`);
        return false;
      }

      // Update the row with origin analysis results (column F)
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.sheetsId,
        range: `Sheet1!F${rowIndex + 1}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[JSON.stringify(originJson)]]
        }
      });

      console.log('Successfully updated origin analysis results in sheets');
      return true;
    } catch (error) {
      console.error('Error updating origin analysis results in sheets:', error);
      return false;
    }
  }

  async logUpload(sessionId, timestamp, imageUrl) {
    if (!this.initialized) {
      throw new Error('Sheets service not initialized');
    }

    // Validate inputs
    if (!sessionId || !timestamp || !imageUrl) {
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

      // Attempt to append the data with new columns initialized as empty
      try {
        const response = await this.sheets.spreadsheets.values.append({
          spreadsheetId: this.sheetsId,
          range: 'Sheet1!A:M',
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [[
              formattedDate,      // A: Upload Date
              sessionId,          // B: Session ID
              imageUrl,           // C: Image URL
              '',                 // D: Visual Search Results
              '',                 // E: Category
              '',                 // F: Origin Analysis
              '',                 // G: Reserved
              '',                 // H: Detailed Analysis
              '',                 // I: Email
              '',                 // J: Email Submission Time
              '',                 // K: Email Status
              '',                 // L: Offer Sent Time
              ''                  // M: Offer Content
            ]]
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

  async updateEmailSubmission(sessionId, email) {
    if (!this.initialized) {
      throw new Error('Sheets service not initialized');
    }

    try {
      console.log('Attempting to update email submission in Google Sheets...');
      const client = await this.auth.getClient();

      // Find the row with matching sessionId
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.sheetsId,
        range: 'Sheet1!A:M',
      });

      const rows = response.data.values || [];
      const rowIndex = rows.findIndex(row => row[1] === sessionId);

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
              range: `Sheet1!I${rowIndex + 1}:K${rowIndex + 1}`,
              values: [[
                email,                          // I: Email
                new Date().toISOString(),       // J: Email Submission Time
                'Email Submitted'               // K: Email Status
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

  async updateEmailOfferStatus(sessionId, offerContent) {
    if (!this.initialized) {
      throw new Error('Sheets service not initialized');
    }

    try {
      console.log('Attempting to update email offer status in Google Sheets...');
      const client = await this.auth.getClient();

      // Find the row with matching sessionId
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.sheetsId,
        range: 'Sheet1!A:M',
      });

      const rows = response.data.values || [];
      const rowIndex = rows.findIndex(row => row[1] === sessionId);

      if (rowIndex === -1) {
        console.error(`Session ID ${sessionId} not found in spreadsheet`);
        return false;
      }

      // Update offer status and content
      await this.sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: this.sheetsId,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          data: [
            {
              range: `Sheet1!K${rowIndex + 1}:M${rowIndex + 1}`,
              values: [[
                'Offer Sent',                   // K: Email Status
                new Date().toISOString(),       // L: Offer Sent Time
                offerContent                    // M: Offer Content
              ]]
            }
          ]
        }
      });

      console.log('Successfully updated email offer status in sheets');
      return true;
    } catch (error) {
      console.error('Error updating email offer status in sheets:', error);
      return false;
    }
  }
}

module.exports = new SheetsService();