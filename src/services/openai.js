const OpenAI = require('openai');
const { getModel } = require('../config/models');
const { VISUAL_SEARCH_PROMPT, ORIGIN_ANALYSIS_PROMPT, FULL_ANALYSIS_PROMPT, HTML_REPORT_PROMPT, INTERACTIVE_REPORT_PROMPT } = require('../config/prompts');

class OpenAIService {
  constructor() {
    this.client = null;
  }

  initialize(apiKey) {
    if (!apiKey) {
      throw new Error('OpenAI API key is required');
    }
    this.client = new OpenAI({ apiKey });
  }

  async analyzeImage(imageUrl, prompt, modelType = 'VISUAL_SEARCH') {
    if (!this.client) {
      throw new Error('OpenAI client not initialized');
    }

    try {
      const response = await this.client.chat.completions.create({
        model: getModel(modelType),
        messages: [
          {
            role: "system",
            content: prompt || VISUAL_SEARCH_PROMPT
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
        model: getModel('ORIGIN'),
        messages: [
          {
            role: "system",
            content: prompt || ORIGIN_ANALYSIS_PROMPT
          },
          {
            role: "user", 
            content: content
          }
        ]
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

  async analyzeWithFullPrompt(imageUrl) {
    if (!this.client) {
      throw new Error('OpenAI client not initialized');
    }

    try {
      const response = await this.client.chat.completions.create({
        model: getModel('ORIGIN'), // Using o1 model as specified
        messages: [
          {
            role: "system",
            content: FULL_ANALYSIS_PROMPT
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
        ]
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
      console.error('Error performing full analysis with OpenAI:', error);
      throw error;
    }
  }

  async generateHtmlReport(analysisData) {
    if (!this.client) {
      throw new Error('OpenAI client not initialized');
    }

    // Ensure metadata is available
    if (!analysisData.metadata?.sessionId || !analysisData.metadata?.imageUrl) {
      console.warn('Missing metadata for report generation:', {
        hasSessionId: !!analysisData.metadata?.sessionId,
        hasImageUrl: !!analysisData.metadata?.imageUrl
      });
    }
    try {
      const response = await this.client.chat.completions.create({
        model: getModel('HTML_REPORT'),
        messages: [
          {
            role: "assistant",
            content: HTML_REPORT_PROMPT
          },
          {
            role: "assistant",
            content: JSON.stringify({
              ...analysisData,
              sessionId: analysisData.metadata?.sessionId || 'N/A',
              userImageUrl: analysisData.metadata?.imageUrl || ''
            })
          }
        ]
      });

      return response.choices[0]?.message?.content || '';
    } catch (error) {
      console.error('Error generating HTML report with OpenAI:', error);
      throw error;
    }
  }

  async generateInteractiveReport(analysisData) {
    if (!this.client) {
      throw new Error('OpenAI client not initialized');
    }

    // Ensure metadata is available
    if (!analysisData.metadata?.sessionId || !analysisData.metadata?.imageUrl) {
      console.warn('Missing metadata for interactive report generation:', {
        hasSessionId: !!analysisData.metadata?.sessionId,
        hasImageUrl: !!analysisData.metadata?.imageUrl
      });
    }
    
    try {
      const response = await this.client.chat.completions.create({
        model: getModel('INTERACTIVE_REPORT'), // Using a more powerful model for the interactive report
        messages: [
          {
            role: "assistant",
            content: INTERACTIVE_REPORT_PROMPT
          },
          {
            role: "assistant",
            content: JSON.stringify({
              ...analysisData,
              sessionId: analysisData.metadata?.sessionId || 'N/A',
              userImageUrl: analysisData.metadata?.imageUrl || ''
            })
          }
        ]
      });

      // Process the response to match the interactive template format
      const { generateInteractiveReport } = require('../templates/interactiveReport');
      return generateInteractiveReport({
        metadata: {
          sessionId: analysisData.metadata?.sessionId || 'N/A',
          imageUrl: analysisData.metadata?.imageUrl || ''
        },
        detailedAnalysis: analysisData.detailedAnalysis || null,
        visualAnalysis: analysisData.visualAnalysis || null,
        originAnalysis: analysisData.originAnalysis || null,
        valueAnalysis: analysisData.valueAnalysis || null,
        // Add OpenAI-generated content as dynamic content
        dynamicContent: response.choices[0]?.message?.content || ''
      });
    } catch (error) {
      console.error('Error generating interactive report with OpenAI:', error);
      throw error;
    }
  }
}

module.exports = new OpenAIService();