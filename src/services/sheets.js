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
        range: `Sheet1!A${nextRow}:D${nextRow}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[
            new Date().toISOString(),           // A: Timestamp
            sessionId,                          // B: Session ID
            new Date(timestamp).toISOString(),  // C: Upload Time
            imageUrl                            // D: Image URL
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

  async updateAnalysisStatus(sessionId, analysisType, results) {
    if (!this.initialized) {
      throw new Error('Sheets service not initialized');
    }

    try {
      console.log(`Updating ${analysisType} analysis status in Google Sheets...`);
      
      const rowIndex = await this.findRowBySessionId(sessionId);
      if (rowIndex === -1) {
        console.error(`Session ID ${sessionId} not found in spreadsheet`);
        return false;
      }

      let range;
      let values;

      switch (analysisType) {
        case 'visual':
          range = `Sheet1!E${rowIndex + 1}:F${rowIndex + 1}`;
          values = [[
            'Visual Analysis Complete',
            new Date().toISOString()
          ]];
          break;
        case 'origin':
          range = `Sheet1!G${rowIndex + 1}:H${rowIndex + 1}`;
          values = [[
            'Origin Analysis Complete',
            new Date().toISOString()
          ]];
          break;
        case 'detailed':
          range = `Sheet1!I${rowIndex + 1}:J${rowIndex + 1}`;
          values = [[
            'Detailed Analysis Complete',
            new Date().toISOString()
          ]];
          break;
        default:
          throw new Error(`Invalid analysis type: ${analysisType}`);
      }

      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.sheetsId,
        range,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values }
      });

      console.log(`Successfully updated ${analysisType} analysis status in sheets`);
      return true;
    } catch (error) {
      console.error(`Error updating ${analysisType} analysis status in sheets:`, error);
      return false;
    }
  }
}

module.exports = new SheetsService();