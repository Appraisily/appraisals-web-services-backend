const sgMail = require('@sendgrid/mail');
const { getFreeReportTemplate } = require('../templates/emails');
const fetch = require('node-fetch');

class EmailService {
  constructor() {
    this.initialized = false;
    this.freeReportTemplateId = null;
    this.personalOfferTemplateId = null;
    this.personalEmail = null;
    this.directApiKey = null;
    this.michelleApiUrl = 'https://michelle-gmail-856401495068.us-central1.run.app/api/process-message';
  }

  initialize(apiKey, fromEmail, freeReportTemplateId, personalOfferTemplateId, personalEmail, directApiKey) {
    if (!apiKey || !fromEmail) {
      throw new Error('SendGrid API key and from email are required');
    }
    sgMail.setApiKey(apiKey);
    this.fromEmail = fromEmail;
    this.freeReportTemplateId = freeReportTemplateId;
    this.personalOfferTemplateId = personalOfferTemplateId;
    this.personalEmail = personalEmail;
    this.directApiKey = directApiKey;
    this.initialized = true;
  }

  async generatePersonalizedEmail(analysisData) {
    console.log('\n=== Michelle API Request ===');
    console.log('Analysis Data:', JSON.stringify(analysisData, null, 2));

    const prompt = `You are an expert art appraiser writing a personalized follow-up email to potential clients. Your goal is to convert their free art analysis into a professional appraisal service.

Context:
[Analysis Details from Initial Screening]
- Item Type: ${analysisData.detailedAnalysis?.maker_analysis?.creator_name || 'artwork'}
- Maker Analysis: ${analysisData.detailedAnalysis?.maker_analysis?.reasoning || 'Not available'}
- Origin Analysis: ${analysisData.detailedAnalysis?.origin_analysis?.reasoning || 'Not available'}
- Age Analysis: ${analysisData.detailedAnalysis?.age_analysis?.reasoning || 'Not available'}
- Visual Analysis: ${analysisData.detailedAnalysis?.visual_search?.notes || 'Not available'}
- Notable Features: ${analysisData.detailedAnalysis?.marks_recognition?.marks_identified || 'Not available'}
- Preliminary Value Range: Requires professional appraisal

Guidelines:
1. Tone: Professional yet warm and personal
2. Voice: Write as Andrés Gómez, Lead Art Appraiser at Appraisily
3. Length: 200-300 words maximum
4. Structure:
   - Personal greeting
   - Specific observation about their item
   - Value proposition
   - Clear call to action
   - Professional signature

Key Elements to Include:
- Reference at least 2 specific details from their item's analysis
- Highlight one intriguing aspect that warrants further investigation
- Mention current market conditions or trends if relevant
- Include a time-sensitive offer (20% discount, valid for 48 hours)
- Emphasize the importance of professional appraisal for items of this nature

Example Value Propositions:
- Insurance documentation
- Authentication verification
- Market value assessment
- Historical significance documentation
- Provenance research

DO NOT:
- Use generic sales language
- Make definitive value claims
- Promise unrealistic outcomes
- Use excessive formatting or emojis
- Sound automated or impersonal

Special Instructions:
- Customize the urgency based on the item's potential value
- Adapt the tone based on the item's historical significance
- Include relevant credentials when discussing specific art periods or styles
- Reference similar items recently appraised when applicable

Output Format:
Subject Line: [Engaging subject line related to their specific item]

Email Body:
[Personalized greeting]
[Main content following guidelines]
[Call to action with link to https://buy.stripe.com/9AQaIKd925jC6Ag6pQ?prefilled_promo_code=FRIENDS20]
[Professional signature]

Remember: The goal is to demonstrate expertise while building trust and creating urgency without being pushy.`;

    console.log('\nPrompt for Michelle:', prompt);

    const requestBody = {
      text: prompt,
      senderName: 'Andrés Gómez',
      senderEmail: this.personalEmail
    };

    console.log('\nRequest Body:', JSON.stringify(requestBody, null, 2));
    try {
      const response = await fetch(this.michelleApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.directApiKey
        },
        body: JSON.stringify(requestBody)
      });

      console.log('\nMichelle API Response Status:', response.status);

      if (!response.ok) {
        console.error('Michelle API Error Response:', await response.text());
        throw new Error('Failed to generate email content');
      }

      const data = await response.json();
      console.log('\nMichelle API Response Data:', JSON.stringify(data, null, 2));
      console.log('=== End Michelle API Request ===\n');
      return JSON.parse(data.text);
    } catch (error) {
      console.error('\nError generating email content:', error);
      console.error('Error details:', error.stack);
      console.log('=== End Michelle API Request with Error ===\n');
      throw error;
    }
  }

  async sendPersonalOffer(toEmail, analysisData) {
    if (!this.initialized) {
      throw new Error('Email service not initialized');
    }

    try {
      // Generate personalized email content using Michelle's API
      const emailContent = await this.generatePersonalizedEmail(analysisData);
      const { subject, content } = emailContent;

      const personalMsg = {
        to: toEmail,
        from: {
          email: this.personalEmail,
          name: 'Andrés - Art Expert'
        },
        subject: subject,
        html: content
      };

      await sgMail.send(personalMsg);
      console.log(`Personal offer email sent to ${toEmail}`);
    } catch (error) {
      console.error('Error sending personal offer email:', error);
      throw error;
    }
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