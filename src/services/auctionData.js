/**
 * Auction Data Service
 * Provides integration with the valuer-agent service to fetch auction data
 */

const fetch = require('node-fetch');

class AuctionDataService {
  constructor() {
    this.baseUrl = process.env.VALUER_AGENT_URL || 'https://valuer-agent-856401495068.us-central1.run.app';
  }

  /**
   * Fetches auction results for a keyword
   * @param {string} keyword - Search keyword
   * @param {number} minPrice - Minimum price (default: 1000)
   * @param {number} limit - Maximum number of results (default: 10)
   * @returns {Promise<Object>} Auction results
   */
  async getAuctionResults(keyword, minPrice = 1000, limit = 10) {
    console.log(`Fetching auction results for: "${keyword}" (min: $${minPrice}, limit: ${limit})`);
    
    try {
      const response = await fetch(`${this.baseUrl}/api/auction-results`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          keyword,
          minPrice,
          limit
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Error fetching auction results: Status ${response.status}`, errorText);
        throw new Error(`Failed to fetch auction results: ${response.status}`);
      }

      const data = await response.json();
      console.log(`Found ${data.totalResults} auction results for "${keyword}"`);
      
      return data;
    } catch (error) {
      console.error('Auction data service error:', error);
      throw new Error(`Failed to fetch auction results: ${error.message}`);
    }
  }

  /**
   * Finds a value range for an item description using valuer-agent
   * @param {string} description - Item description
   * @param {boolean} useAccurateValuation - Whether to use the accurate valuation model
   * @returns {Promise<Object>} Value range with auction results
   */
  async findValueRange(description, useAccurateValuation = true) {
    console.log(`Finding value range for: "${description}" (using ${useAccurateValuation ? 'accurate' : 'standard'} valuation model)`);
    
    try {
      // Build request with precision parameter
      const requestBody = {
        text: description
      };
      
      // If using accurate valuation, add the parameter
      if (useAccurateValuation) {
        requestBody.useAccurateModel = true;
      }
      
      const response = await fetch(`${this.baseUrl}/api/find-value-range`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Error finding value range: Status ${response.status}`, errorText);
        throw new Error(`Failed to find value range: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success === false) {
        throw new Error(data.error || 'Unknown error from valuer service');
      }
      
      console.log(`Value range found: $${data.minValue} - $${data.maxValue}`);
      console.log(`Confidence level: ${data.confidenceLevel || 'Not provided'}`);
      console.log(`Market trend: ${data.marketTrend || 'Not provided'}`);
      
      // Log some statistics about how tight the range is
      if (data.minValue && data.maxValue) {
        const range = data.maxValue - data.minValue;
        const avgValue = (data.maxValue + data.minValue) / 2;
        const rangePct = (range / avgValue) * 100;
        console.log(`Value range: $${range.toLocaleString()} (${rangePct.toFixed(1)}% of average value)`);
      }
      
      return data;
    } catch (error) {
      console.error('Value range service error:', error);
      throw new Error(`Failed to find value range: ${error.message}`);
    }
  }

  /**
   * Justifies a valuation for an item
   * @param {string} description - Item description
   * @param {number} value - Value to justify
   * @returns {Promise<Object>} Justification with auction results
   */
  async justifyValue(description, value) {
    console.log(`Justifying value of $${value} for: "${description}"`);
    
    try {
      const response = await fetch(`${this.baseUrl}/api/justify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: description,
          value
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Error justifying value: Status ${response.status}`, errorText);
        throw new Error(`Failed to justify value: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Value justification service error:', error);
      throw new Error(`Failed to justify value: ${error.message}`);
    }
  }
}

module.exports = new AuctionDataService();