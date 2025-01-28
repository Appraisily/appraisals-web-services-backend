const sgMail = require('@sendgrid/mail');
const { getFreeReportTemplate } = require('../../templates/emails');

class SendGridService {
  constructor() {
    this.initialized = false;
    this.fromEmail = null;
    this.freeReportTemplateId = null;
    this.personalOfferTemplateId = null;
  }

  initialize(apiKey, fromEmail, freeReportTemplateId, personalOfferTemplateId) {
    if (!apiKey || !fromEmail) {
      throw new Error('SendGrid API key and from email are required');
    }
    sgMail.setApiKey(apiKey);
    this.fromEmail = fromEmail;
    this.freeReportTemplateId = freeReportTemplateId;
    this.personalOfferTemplateId = personalOfferTemplateId;
    this.initialized = true;
  }

  async sendPersonalOffer(toEmail, subject, content, scheduledTime = null) {
    if (!this.initialized) {
      throw new Error('SendGrid service not initialized');
    }

    const personalMsg = {
      to: toEmail,
      from: {
        email: this.fromEmail,
        name: 'Andrés - Art Expert'
      },
      templateId: this.personalOfferTemplateId,
      dynamicTemplateData: {
        subject: this.escapeHtmlForSendGrid(subject),
        email_content: this.escapeHtmlForSendGrid(content),
        year: new Date().getFullYear()
      }
    };

    // Add send_at if scheduledTime is provided
    if (scheduledTime) {
      personalMsg.send_at = Math.floor(scheduledTime / 1000); // Convert to Unix timestamp
    }

    await sgMail.send(personalMsg);
    return {
      success: true,
      timestamp: Date.now(),
      subject,
      content,
      contentLength: content.length,
      recipient: toEmail,
      scheduledTime
    };
  }

  async sendFreeReport(toEmail, reportData) {
    if (!this.initialized) {
      throw new Error('SendGrid service not initialized');
    }
    
    try {
      const template = getFreeReportTemplate();
      const escapedReportData = this.escapeHtmlForSendGrid(reportData);
      const htmlContent = template.replace('{{free_report}}', escapedReportData);
      
      const msg = {
        to: toEmail,
        from: this.fromEmail,
        subject: 'Your Free Art Analysis Report from Appraisily',
        html: htmlContent
      };

      await sgMail.send(msg);
      return true;
    } catch (error) {
      console.error('SendGrid error:', error);
      throw error;
    }
  }

  escapeHtmlForSendGrid(text) {
    return text
      .replace(/\{/g, '&#123;')
      .replace(/\}/g, '&#125;')
      .replace(/"/g, '&quot;');
  }
}

module.exports = new SendGridService();