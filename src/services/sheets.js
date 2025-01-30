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
      range: 'Sheet1!A:P',
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
            new Date().toISOString(),           // A: Timestamp
            sessionId,                          // B: Session ID
            new Date(timestamp).toISOString(),  // C: Upload Time
            imageUrl,                           // D: Image URL
            'Pending Analysis',                 // E: Analysis Status
            '',                                // F: Analysis Time
            'Pending Origin',                   // G: Origin Status
            ''                                 // H: Origin Time
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

      await this.sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: this.sheetsId,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          data: [
            {
              range: `Sheet1!I${rowIndex + 1}:J${rowIndex + 1}`,
              values: [[
                email,
                new Date().toISOString()
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
                success ? 'Free Report Sent' : 'Free Report Failed',
                new Date().toISOString()
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

  async updateOfferStatus(sessionId, success = true, offerContent = '', scheduledTime = null) {
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

      const status = scheduledTime ? 'Offer Scheduled' : (success ? 'Offer Sent' : 'Offer Failed');
      const timestamp = scheduledTime ? new Date(scheduledTime).toISOString() : new Date().toISOString();

      await this.sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: this.sheetsId,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          data: [
            {
              range: `Sheet1!M${rowIndex + 1}:P${rowIndex + 1}`,
              values: [[
                status,
                timestamp,
                success ? 'Pending' : 'No',
                offerContent
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

  async updateVisualSearchResults(sessionId, analysisResults, category) {
    if (!this.initialized) {
      throw new Error('Sheets service not initialized');
    }

    try {
      console.log('Attempting to update visual search results in Google Sheets...');
      
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
              range: `Sheet1!E${rowIndex + 1}:F${rowIndex + 1}`,
              values: [[
                `Analysis Complete - ${category || 'Unknown'}`,
                new Date().toISOString()
              ]]
            }
          ]
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
      
      const rowIndex = await this.findRowBySessionId(sessionId);
      if (rowIndex === -1) {
        console.error(`Session ID ${sessionId} not found in spreadsheet`);
        return false;
      }

      // Extract key information from detailed analysis
      const {
        maker_analysis = {},
        age_analysis = {},
        origin_analysis = {}
      } = detailedAnalysis || {};

      const analysisInfo = [
        maker_analysis.creator_name || 'Unknown',
        age_analysis.estimated_date_range || 'Unknown',
        origin_analysis.likely_origin || 'Unknown'
      ].join(' | ');

      await this.sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: this.sheetsId,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          data: [
            {
              range: `Sheet1!G${rowIndex + 1}:H${rowIndex + 1}`,
              values: [[
                `Detailed Analysis Complete - ${analysisInfo}`,
                new Date().toISOString()
              ]]
            }
          ]
        }
      });

      console.log('Successfully updated detailed analysis in sheets');
      return true;
    } catch (error) {
      console.error('Error updating detailed analysis in sheets:', error);
      return false;
    }
  }
}

module.exports = new SheetsService();