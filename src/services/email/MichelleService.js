const fetch = require('node-fetch');

class MichelleService {
  constructor() {
    this.apiUrl = 'https://michelle-gmail-856401495068.us-central1.run.app/api/process-message';
    this.apiKey = null;
    this.fromEmail = null;
  }

  initialize(apiKey, fromEmail) {
    this.apiKey = apiKey;
    this.fromEmail = fromEmail;
  }

  async generatePrompt(analysisData) {
    const {
      maker_analysis = {},
      origin_analysis = {},
      age_analysis = {},
      visual_search = {},
      marks_recognition = {}
    } = analysisData.detailedAnalysis || {};

    return `You are an expert art appraiser writing a personalized follow-up email to potential clients. Your goal is to convert their free art analysis into a professional appraisal service.

Context:
[Analysis Details from Initial Screening]
- Item Type: ${maker_analysis.creator_name || 'artwork'}
- Maker Analysis: ${maker_analysis.reasoning || 'Not available'}
- Origin Analysis: ${origin_analysis.reasoning || 'Not available'}
- Age Analysis: ${age_analysis.reasoning || 'Not available'}
- Visual Analysis: ${visual_search.notes || 'Not available'}
- Notable Features: ${marks_recognition.marks_identified || 'Not available'}
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
{
  "subject": "Your engaging subject line here",
  "content": "Your complete email content here"
}

Remember: The goal is to demonstrate expertise while building trust and creating urgency without being pushy.`;
  }

  async generateContent(analysisData) {
    if (!this.apiKey || !this.fromEmail) {
      throw new Error('Michelle service not initialized');
    }

    const prompt = await this.generatePrompt(analysisData);
    const requestBody = {
      text: prompt,
      senderName: 'Andrés Gómez',
      senderEmail: this.fromEmail
    };

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Michelle API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    if (!data.success || !data.response || !data.response.text) {
      throw new Error('Invalid response format from Michelle API');
    }

    try {
      const content = JSON.parse(data.response.text);
      if (!content.subject || !content.content) {
        throw new Error('Missing required fields in email content');
      }
      return content;
    } catch (error) {
      throw new Error(`Failed to parse Michelle API response: ${error.message}`);
    }
  }
}

module.exports = new MichelleService();