const OpenAI = require('openai');

const MODELS = {
  VISUAL_SEARCH: 'gpt-4o',
  ORIGIN: 'o1'
};

class OpenAIService {
  constructor() {
    this.client = null;
  }

  getModel(type) {
    return MODELS[type] || MODELS.VISUAL_SEARCH;
  }

  initialize(apiKey) {
    this.client = new OpenAI({
      apiKey: apiKey
    });
  }

  async analyzeImage(imageUrl, prompt, modelType = 'VISUAL_SEARCH') {
    if (!this.client) {
      throw new Error('OpenAI client not initialized');
    }

    try {
      const response = await this.client.chat.completions.create({
        model: this.getModel(modelType),
        messages: [
          {
            role: "system",
            content: prompt || systemPrompt
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

      let content = response.choices[0]?.message?.content || '{}';
      content = content.replace(/```json\n?|\n?```/g, '').trim();
      
      try {
        return JSON.parse(content);
      } catch (parseError) {
        console.error('JSON Parse Error. Content:', content);
        throw new Error(`Failed to parse OpenAI response: ${parseError.message}`);
      }
    } catch (error) {
      console.error('Error analyzing image with OpenAI:', error);
      throw error;
    }
  }

  async analyzeOrigin(userImageUrl, similarImages, prompt) {
    if (!this.client) {
      throw new Error('OpenAI client not initialized');
    }
    
    try {
      // Prepare the content array with the user's image first
      const content = [
        {
          type: "image_url",
          image_url: { url: userImageUrl }
        }
      ];

      // Add similar images (up to 5)
      const topSimilarImages = similarImages.slice(0, 5);
      topSimilarImages.forEach(img => {
        content.push({
          type: "image_url",
          image_url: { url: img.url }
        });
      });

      const response = await this.client.chat.completions.create({
        model: this.getModel('ORIGIN'),
        messages: [
          {
            role: "system",
            content: prompt
          },
          {
            role: "user", 
            content: content
          }
        ],
        max_tokens: 500,
        temperature: 0.7
      });

      console.log('OpenAI raw response:', response);

      const responseContent = response.choices[0]?.message?.content || '{}';
      const cleanContent = responseContent.replace(/```json\n?|\n?```/g, '').trim();
      
      try {
        const parsedContent = JSON.parse(cleanContent);
        console.log('OpenAI parsed response:', JSON.stringify(parsedContent, null, 2));
        return parsedContent;
      } catch (parseError) {
        console.error('JSON Parse Error. Content:', cleanContent);
        throw new Error(`Failed to parse OpenAI response: ${parseError.message}`);
      }
    } catch (error) {
      console.error('Error analyzing origin with OpenAI:', error);
      throw error;
    }
  }
}

module.exports = new OpenAIService();