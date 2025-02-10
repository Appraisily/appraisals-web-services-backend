const sheetsService = require('../../../services/sheets');
const pubsubService = require('../../../services/pubsub');
const cloudServices = require('../../../services/storage');
const analysisService = require('./analysisService');

class EmailService {
  async processEmailSubmission(email, sessionId, metadata, req) {
    try {
      // Save email to sheets
      await this.saveEmailToSheets(email, sessionId);
      
      // Process all required analyses
      await analysisService.processRequiredAnalyses(sessionId, req);
      
      // Generate report
      await this.generateReport(sessionId);
      
      // Notify CRM
      await this.notifyCRM(email, sessionId, metadata);
      
      // Update final status
      await this.updateFinalStatus(email, sessionId, metadata);
      
      console.log('=== Email Submission Process Complete ===\n');
    } catch (error) {
      console.error('Email processing failed:', error);
      throw error;
    }
  }

  async saveEmailToSheets(email, sessionId) {
    try {
      console.log('\nSaving email to Google Sheets...');
      const rowIndex = await sheetsService.findRowBySessionId(sessionId);
      if (rowIndex === -1) {
        console.warn(`Session ID ${sessionId} not found in spreadsheet`);
        return;
      }
      
      await sheetsService.sheets.spreadsheets.values.update({
        spreadsheetId: sheetsService.sheetsId,
        range: `Sheet1!R${rowIndex + 1}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[email]]
        }
      });
      console.log('✓ Email saved to sheets column R');
    } catch (error) {
      console.error('Failed to save email to sheets:', error);
      // Continue processing despite sheets error
    }
  }

  async generateReport(sessionId) {
    console.log('\nGenerating HTML report...');
    try {
      await cloudServices.generateHtmlReport(sessionId);
      console.log('✓ HTML report generated and saved to GCS');

      const [reportExists] = await cloudServices.getBucket()
        .file(`sessions/${sessionId}/report.html`)
        .exists();
        
      if (!reportExists) {
        throw new Error('HTML report file was not created');
      }
      console.log('✓ HTML report file verified');
    } catch (error) {
      console.error('Error generating HTML report:', error);
      throw new Error('Failed to generate HTML report: ' + error.message);
    }
  }

  async notifyCRM(email, sessionId, metadata) {
    const timestamp = Date.now();
    const message = {
      crmProcess: "screenerNotification",
      customer: {
        email: email,
        name: null
      },
      origin: "screener",
      timestamp: timestamp,
      sessionId: sessionId,
      metadata: {
        originalName: metadata.originalName,
        imageUrl: metadata.imageUrl,
        timestamp: timestamp,
        analyzed: metadata.analyzed || false,
        originAnalyzed: metadata.originAnalyzed || false,
        size: metadata.size,
        mimeType: metadata.mimeType
      }
    };

    await pubsubService.publishToCRM(message);
    console.log('✓ Message published to CRM-tasks');
  }

  async updateFinalStatus(email, sessionId, metadata) {
    try {
      // Update sheets status
      const rowIndex = await sheetsService.findRowBySessionId(sessionId);
      if (rowIndex !== -1) {
        await sheetsService.sheets.spreadsheets.values.update({
          spreadsheetId: sheetsService.sheetsId,
          range: `Sheet1!S${rowIndex + 1}:T${rowIndex + 1}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [[
              'Email Processing Complete',
              new Date().toISOString()
            ]]
          }
        });
        console.log('✓ Email processing status updated in sheets');
      }

      // Update metadata
      const metadataFile = cloudServices.getBucket().file(`sessions/${sessionId}/metadata.json`);
      metadata.email = {
        submissionTime: Date.now(),
        processed: false
      };

      await metadataFile.save(JSON.stringify(metadata, null, 2), {
        contentType: 'application/json',
        metadata: {
          cacheControl: 'no-cache'
        }
      });

      console.log('✓ Session metadata updated with email submission');
    } catch (error) {
      console.error('Failed to update final status:', error);
      throw error;
    }
  }
}

module.exports = new EmailService();