const michelleService = require('./MichelleService');
const analysisService = require('./AnalysisService');
const sendGridService = require('./SendGridService');
const cloudServices = require('../storage');

class EmailService {
  constructor() {
    this.initialized = false;
  }

  initialize(apiKey, fromEmail, freeReportTemplateId, personalOfferTemplateId, personalEmail, directApiKey) {
    // Initialize SendGrid service
    sendGridService.initialize(apiKey, fromEmail, freeReportTemplateId, personalOfferTemplateId);

    // Initialize Michelle service
    michelleService.initialize(directApiKey, fromEmail);

    // Initialize Analysis service
    analysisService.initialize(cloudServices.getBucket());

    this.initialized = true;
  }

  async sendPersonalOffer(toEmail, subject, analysisData, scheduledTime = null) {
    if (!this.initialized) {
      throw new Error('Email service not initialized');
    }

    console.log('\n=== Starting Personal Offer Email Process ===');
    console.log(`Recipient: ${toEmail}`);
    console.log('Analysis data available:', {
      hasDetailedAnalysis: !!analysisData?.detailedAnalysis,
      hasVisualSearch: !!analysisData?.visualSearch,
      hasOriginAnalysis: !!analysisData?.originAnalysis
    });

    try {
      // Wait for detailed analysis if needed
      if (!analysisData?.detailedAnalysis) {
        console.log('Detailed analysis not available, waiting for results...');
        const detailedAnalysis = await analysisService.waitForDetailedAnalysis(analysisData.sessionId);
        
        if (!detailedAnalysis) {
          throw new Error('Detailed analysis not available after waiting');
        }
        
        analysisData.detailedAnalysis = detailedAnalysis;
        console.log('✓ Detailed analysis loaded successfully');
      }

      // Generate email content
      const { subject: generatedSubject, content } = await michelleService.generateContent(analysisData);
      
      // Send email with scheduling
      const result = await sendGridService.sendPersonalOffer(
        toEmail, 
        subject || generatedSubject, 
        content,
        scheduledTime
      );
      
      console.log(scheduledTime ? 
        `✓ Personal offer email scheduled for ${new Date(scheduledTime).toISOString()}` :
        '✓ Personal offer email sent immediately'
      );
      
      return result;
    } catch (error) {
      console.error('✗ Error sending personal offer email:', error);
      throw error;
    } finally {
      console.log('=== End Personal Offer Email Process ===\n');
    }
  }

  async sendFreeReport(toEmail, reportData) {
    if (!this.initialized) {
      throw new Error('Email service not initialized');
    }
    
    return sendGridService.sendFreeReport(toEmail, reportData);
  }
}

module.exports = new EmailService();