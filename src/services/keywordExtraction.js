/**
 * Keyword Extraction Service
 * Extracts optimal keywords from analysis results for auction searches
 */

const openai = require('./openai');

class KeywordExtractionService {
  /**
   * Extracts keywords from detailed analysis for optimal auction search
   * @param {Object} detailedAnalysis - The detailed analysis object
   * @param {Object} options - Options for extraction
   * @param {number} options.maxKeywords - Maximum number of keyword sets to generate (default: 3)
   * @returns {Promise<string[]>} Array of keyword sets
   */
  async extractKeywords(detailedAnalysis, options = {}) {
    const { maxKeywords = 3 } = options;
    
    if (!detailedAnalysis) {
      console.warn('No detailed analysis provided for keyword extraction');
      return [];
    }
    
    try {
      // Extract basic information from the analysis
      const description = detailedAnalysis.concise_description || '';
      const creator = detailedAnalysis.maker_analysis?.creator_name || '';
      const origin = detailedAnalysis.origin_analysis?.likely_origin || '';
      const period = detailedAnalysis.age_analysis?.estimated_date_range || '';
      const style = detailedAnalysis.style_analysis?.art_style || '';
      
      // If we don't have concise description, fail
      if (!description) {
        console.warn('No concise description available for keyword extraction');
        return [];
      }
      
      // For simpler cases, extract keywords directly from the analysis
      if (!openai.isConfigured()) {
        console.log('OpenAI not configured, using simple keyword extraction');
        return this.extractKeywordsFromAnalysis(detailedAnalysis);
      }
      
      // Construct a prompt for AI-assisted keyword generation
      const prompt = `
You are an expert in fine art and antiques with deep knowledge of the auction market.

Please analyze this art object and generate ${maxKeywords} optimal search queries for finding similar items in auction databases. Each query should be a comma-separated list of terms.

OBJECT INFORMATION:
- Description: ${description}
- Creator: ${creator || 'Unknown'}
- Origin: ${origin || 'Unknown'}
- Period: ${period || 'Unknown'}
- Style: ${style || 'Unknown'}

GUIDELINES:
1. Focus on the most distinctive and valuable aspects 
2. Include category, medium, time period, and style where applicable
3. Create broad, medium, and specific queries
4. Sort from specific to general
5. Remove unnecessary words like "the", "a", "an"
6. Do not include price estimates or speculation
7. Return ONLY an array of strings in JSON format, nothing else

RESPONSE FORMAT:
["specific query with more terms", "medium query", "general query with fewer terms"]
`;

      // Call OpenAI to generate keywords
      const response = await openai.generateContent(prompt, {
        temperature: 0.2, // Low temperature for more predictable output
        model: 'gpt-3.5-turbo' // Use a cheaper model for this simple task
      });
      
      // Parse the response (should be a JSON array)
      try {
        const content = response.trim();
        const jsonContent = content.replace(/```json|```/g, '').trim();
        const keywords = JSON.parse(jsonContent);
        
        if (Array.isArray(keywords) && keywords.length > 0) {
          console.log('Generated keywords:', keywords);
          return keywords;
        }
      } catch (parseError) {
        console.error('Error parsing keyword response:', parseError);
        // If parsing fails, fall back to simple extraction
      }
      
      // Fallback to simple extraction
      return this.extractKeywordsFromAnalysis(detailedAnalysis);
      
    } catch (error) {
      console.error('Error in keyword extraction:', error);
      // Fallback to simple extraction on any error
      return this.extractKeywordsFromAnalysis(detailedAnalysis);
    }
  }
  
  /**
   * Simple keyword extraction from analysis without AI
   * @param {Object} analysis - The analysis object
   * @returns {string[]} Array of keyword strings
   */
  extractKeywordsFromAnalysis(analysis) {
    // Default keywords from the concise description
    const description = analysis.concise_description || '';
    const keywords = [description];
    
    // If we have a creator and it's not "unknown", add a query with creator
    const creator = analysis.maker_analysis?.creator_name || '';
    if (creator && !creator.toLowerCase().includes('unknown')) {
      let creatorTerms = creator.split(' ');
      // Use just the last name if it's a full name
      if (creatorTerms.length > 1) {
        const lastName = creatorTerms[creatorTerms.length - 1];
        keywords.push(`${lastName} ${description.split(' ').slice(0, 2).join(' ')}`);
      } else {
        keywords.push(`${creator} ${description.split(' ').slice(0, 2).join(' ')}`);
      }
    }
    
    // Add a more general query based on the object type
    const typeWords = description.split(' ');
    if (typeWords.length > 2) {
      keywords.push(typeWords.slice(0, 2).join(' '));
    }
    
    return keywords;
  }
}

module.exports = new KeywordExtractionService();