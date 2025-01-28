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
INSTRUCTIONS:
1. Output MUST be valid JSON:
   {
     "subject": "...",
     "content": "..."
   }

2. The "content" value must be an HTML string (use basic paragraphs or line breaks; no advanced HTML/CSS needed). Example:
   "<p>Hello, </p><p>Your analysis is complete...</p>"

3. Tone: Natural, friendly, and professional. Imagine you're speaking directly to a friend.

4. Structure (200–300 words total):
   - A personal greeting with the client's name (e.g., "Dear Sarah,").
   - Refer to at least two specific observations from the analysis (e.g., mention the style, origin, or notable mark).
   - Highlight an intriguing aspect that makes their piece special.
   - Mention a 20% discount valid for 48 hours.
   - Briefly explain why a professional appraisal matters for this item, touching on current market interest or trends.
   - Close with a clear invitation to take the next step.

5. Style points:
   - Keep paragraphs short.
   - Avoid pushy sales language.
   - Do NOT make definitive value claims or guarantees.
   - Do NOT use variables or placeholders in the final text. Provide a plain, readable message.

6. No emojis or heavy formatting.

7. The final JSON must not include additional keys or placeholders; only "subject" and "content".

Now, please produce your final answer in valid JSON format with the structure:
{
  "subject": "Your short subject line here",
  "content": "Your complete email in HTML here"
}`;
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