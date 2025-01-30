const fetch = require('node-fetch');

class MichelleService {
  constructor() {
    this.apiUrl = 'https://michelle-gmail-856401495068.us-central1.run.app/api/process-message';
    this.apiKey = null;
    this.fromEmail = null;
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 second
  }

  initialize(apiKey, fromEmail) {
    this.apiKey = apiKey;
    this.fromEmail = fromEmail;
  }

  async generatePrompt(analysisData) {
    const {
      detailedAnalysis = {},
      visualSearch = {},
      originAnalysis = {}
    } = analysisData;

    const {
      maker_analysis = {},
      origin_analysis = {},
      age_analysis = {},
      visual_search = {},
      marks_recognition = {}
    } = detailedAnalysis;

    return `You are Andrés Gómez, Lead Art Appraiser at Appraisily. You're writing a follow-up email to a potential client who used our free screening tool. The goal is to invite them to purchase a professional appraisal for their item in a warm, direct, and personal manner—without sounding overly formal or automated.

CONTEXT:
[Analysis Details from Initial Screening]
- Item Type: ${maker_analysis.creator_name || 'artwork'}
- Maker Analysis: ${maker_analysis.reasoning || 'Not available'}
- Origin Analysis: ${origin_analysis.reasoning || 'Not available'}
- Age Analysis: ${age_analysis.reasoning || 'Not available'}
- Visual Analysis: ${visual_search.notes || 'Not available'}
- Notable Features: ${marks_recognition.marks_identified || 'Not available'}
- Preliminary Value Range: Requires professional appraisal
- Special Offer: 20% discount on our base appraisal fee

OBJECTIVE:
- Encourage the client to move forward with a full professional appraisal.
- Highlight what makes their piece interesting or potentially valuable.
- Use a tone that is personable, genuine, and not overly formal.
- Emphasize the limited-time 20% discount on our base appraisal fee.
- Create a sense of urgency by mentioning the discount is only available for 48 hours.

OUTPUT REQUIREMENTS:
1. Your final answer must be **valid JSON** with exactly two keys: "subject" and "content".
2. The value of "content" must be an **HTML string** (basic tags like \`<p>\` or \`<br>\` are acceptable). 
3. No additional keys or placeholders.
4. Style the text freely—no strict structure—yet keep it succinct (around 200–300 words if possible).
5. Use **friendly, natural language** that fits a direct yet professional tone.
6. Avoid definitive value claims or guarantees; do not use placeholders or variables. Provide a plain, readable message.
7. IMPORTANT: Make sure to mention the 20% discount naturally in the content, emphasizing it's a limited-time offer.

Now, please produce your final answer **in valid JSON** with the structure:
{
  "subject": "...",
  "content": "..."
}`;
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async fetchWithRetry(url, options, retryCount = 0) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
      
      const response = await fetch(url, { 
        method: 'HEAD',
        signal: controller.signal 
      });
      
      clearTimeout(timeout);
      
      if (!response.ok) return false;
      
      const contentType = response.headers.get('content-type');
      return contentType && contentType.startsWith('image/');
    } catch (error) {
      if (error.name === 'AbortError') {
        console.warn(`Timeout validating URL: ${url} (exceeded ${TIMEOUT_MS}ms)`);
      } else {
        console.warn(`Failed to validate URL: ${url}`, error.message);
      }
      return false;
    }
  }

  async generateContent(analysisData) {
    if (!this.apiKey || !this.fromEmail) {
      throw new Error('Michelle service not initialized');
    }

    console.log('\n=== Michelle API Request Details ===');
    console.log('Analysis Data:', {
      maker_analysis: analysisData.detailedAnalysis?.maker_analysis || 'Not available',
      origin_analysis: analysisData.detailedAnalysis?.origin_analysis || 'Not available',
      age_analysis: analysisData.detailedAnalysis?.age_analysis || 'Not available',
      visual_search: analysisData.detailedAnalysis?.visual_search || 'Not available',
      marks_recognition: analysisData.detailedAnalysis?.marks_recognition || 'Not available'
    });

    const prompt = await this.generatePrompt(analysisData);
    console.log('\nGenerated Prompt:');
    console.log('---------------');
    console.log(prompt);
    console.log('---------------\n');

    const requestBody = {
      text: prompt,
      senderName: 'Andrés Gómez',
      senderEmail: this.fromEmail
    };

    console.log('Sending request to Michelle API...');
    const response = await this.fetchWithRetry(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();
    if (!data.success || !data.response || !data.response.text) {
      throw new Error('Invalid response format from Michelle API');
    }

    try {
      const content = JSON.parse(data.response.text);
      if (!content.subject || !content.content) {
        console.error('Invalid content structure:', content);
        throw new Error('Missing required fields in email content');
      }
      console.log('\nMichelle API Response:');
      console.log('Subject:', content.subject);
      console.log('Content Length:', content.content.length, 'characters');
      console.log('=== End Michelle API Request ===\n');
      return content;
    } catch (error) {
      console.error('Failed to parse Michelle API response:', error);
      throw new Error(`Failed to parse Michelle API response: ${error.message}`);
    }
  }
}

module.exports = new MichelleService();