const sgMail = require('@sendgrid/mail');
const { getFreeReportTemplate } = require('../templates/emails');
const fetch = require('node-fetch');

class EmailService {
  constructor() {
    this.initialized = false;
    this.michelleApiUrl = 'https://michelle-gmail-856401495068.us-central1.run.app/api/process-message';
  }

  initialize(apiKey, fromEmail) {
    if (!apiKey || !fromEmail) {
      throw new Error('SendGrid API key and from email are required');
    }
    sgMail.setApiKey(apiKey);
    this.fromEmail = fromEmail;
    this.initialized = true;
  }

  async sendFreeReport(toEmail, reportData) {
    if (!this.initialized) {
      throw new Error('Email service not initialized');
    }
    
    const template = getFreeReportTemplate();
    // Escape special characters for SendGrid
    const escapedReportData = reportData
      .replace(/\{/g, '&#123;')
      .replace(/\}/g, '&#125;')
      .replace(/"/g, '&quot;');
    
    const htmlContent = template.replace('{{free_report}}', escapedReportData);
    
    const msg = {
      to: toEmail,
      from: this.fromEmail,
      subject: 'Your Free Art Analysis Report from Appraisily',
      html: htmlContent
    };

    try {
      await sgMail.send(msg);
      return true;
    } catch (error) {
      console.error('SendGrid error:', error);
      throw error;
    }
  }
}

module.exports = new EmailService();