const OpenAI = require('openai');

class OpenAIService {
  constructor() {
    this.client = null;
  }

  initialize(apiKey) {
    this.client = new OpenAI({
      apiKey: apiKey
    });
  }

  async analyzeImage(imageUrl, prompt) {
    if (!this.client) {
      throw new Error('OpenAI client not initialized');
    }
    
    // Default system prompt for art/antique classification
    const systemPrompt = `You are a vision-enabled AI. Your task is to analyze an uploaded image and:
1) Decide if the object is "Art" or "Antique."
2) Provide a very short description (1–2 words) of the object.

Always respond in JSON with the following keys:
{
  "category": "Art" or "Antique",
  "description": "One or two words describing the object"
}

Do not include any additional commentary or text.`;

    try {
      const response = await this.client.chat.completions.create({
        // Using gpt-4o model for vision analysis
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user", 
            content: [
              {
                type: "image_url",
                image_url: {
                  url: imageUrl
                }
              }
            ]
          }
        ],
        max_tokens: 150,
        temperature: 0.7
      });

      // Parse the JSON response
      const content = response.choices[0]?.message?.content || '{}';
      return JSON.parse(content);
    } catch (error) {
      console.error('Error analyzing image with OpenAI:', error);
      throw error;
    }
  }
}

module.exports = new OpenAIService();