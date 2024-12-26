const sgMail = require('@sendgrid/mail');
const { getFreeReportTemplate } = require('../templates/emails');

class EmailService {
  constructor() {
    this.initialized = false;
    this.templateId = null;
  }

  initialize(apiKey, fromEmail, templateId) {
    if (!apiKey || !fromEmail) {
      throw new Error('SendGrid API key and from email are required');
    }
    sgMail.setApiKey(apiKey);
    this.fromEmail = fromEmail;
    this.templateId = templateId;
    this.initialized = true;
  }

  async sendFreeReport(toEmail, reportData) {
    if (!this.initialized) {
      throw new Error('Email service not initialized');
    }
    
    const template = getFreeReportTemplate();
    const htmlContent = template.replace('{{free_report}}', reportData);
    
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