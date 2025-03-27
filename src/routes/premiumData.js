/**
 * Premium Data Routes
 * Handles premium data features based on subscription status
 */

const express = require('express');
const cloudServices = require('../services/storage');
const auctionDataService = require('../services/auctionData');
const keywordExtraction = require('../services/keywordExtraction');

const router = express.Router();

/**
 * Get premium auction data for a session
 * Includes more comprehensive auction results and price trend data
 */
router.post('/premium-auction-data', async (req, res) => {
  try {
    const { sessionId, subscriptionKey } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Session ID is required'
      });
    }
    
    // Check subscription status
    // This is a placeholder - in a real implementation, you would verify the subscription
    // against a database or subscription service
    const hasValidSubscription = subscriptionKey === 'premium_123';
    
    if (!hasValidSubscription) {
      return res.status(403).json({
        success: false,
        message: 'Valid subscription required for premium data',
        subscriptionRequired: true
      });
    }
    
    // Get the session's detailed analysis
    const bucket = cloudServices.getBucket();
    const detailedFile = bucket.file(`sessions/${sessionId}/detailed.json`);
    const [detailedExists] = await detailedFile.exists();

    if (!detailedExists) {
      return res.status(404).json({
        success: false,
        message: 'Detailed analysis not found'
      });
    }

    // Load detailed analysis to extract optimal keywords
    const [detailedContent] = await detailedFile.download();
    const detailedAnalysis = JSON.parse(detailedContent.toString());
    
    // Extract keywords for enhanced auction searching
    const keywords = await keywordExtraction.extractKeywords(detailedAnalysis, { maxKeywords: 5 });
    
    // Fetch auction results for multiple keywords to get comprehensive data
    const allResults = [];
    let totalResults = 0;
    
    // Process up to 3 keywords (or all if fewer) for comprehensive results
    const keywordsToProcess = keywords.slice(0, 3);
    
    for (const keyword of keywordsToProcess) {
      // Fetch results for this keyword
      const results = await auctionDataService.getAuctionResults(
        keyword,
        500, // Lower minimum price for premium data to get more results
        15  // More results per keyword for premium users
      );
      
      if (results && results.auctionResults && results.auctionResults.length > 0) {
        // Track keyword and add to our collection
        allResults.push({
          keyword,
          results: results.auctionResults
        });
        
        totalResults += results.auctionResults.length;
      }
    }
    
    // Fetch additional metadata like price trends if available
    let priceTrendData = null;
    try {
      // This would be a separate call to get historical price data
      // For now, we'll just format the existing data as price trends
      const allAuctionResults = allResults.flatMap(set => set.results);
      
      if (allAuctionResults.length > 0) {
        // Sort by date
        allAuctionResults.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        // Group by year/month for trends
        const trendsByMonth = {};
        allAuctionResults.forEach(result => {
          const date = new Date(result.date);
          const key = `${date.getFullYear()}-${date.getMonth() + 1}`;
          
          if (!trendsByMonth[key]) {
            trendsByMonth[key] = {
              date: key,
              prices: [],
              avgPrice: 0,
              count: 0
            };
          }
          
          trendsByMonth[key].prices.push(result.price.amount);
          trendsByMonth[key].count++;
        });
        
        // Calculate averages
        Object.values(trendsByMonth).forEach(month => {
          const total = month.prices.reduce((sum, price) => sum + price, 0);
          month.avgPrice = total / month.count;
        });
        
        priceTrendData = {
          trends: Object.values(trendsByMonth),
          earliest: allAuctionResults[0].date,
          latest: allAuctionResults[allAuctionResults.length - 1].date
        };
      }
    } catch (trendError) {
      console.warn('Error generating price trend data:', trendError);
      // Continue without trend data if it fails
    }
    
    // Save premium results to the session (for caching)
    const premiumDataFile = bucket.file(`sessions/${sessionId}/premium-data.json`);
    const premiumData = {
      timestamp: Date.now(),
      subscriptionKey,
      keywords,
      keywordResults: allResults,
      totalResults,
      priceTrends: priceTrendData
    };
    
    await premiumDataFile.save(JSON.stringify(premiumData, null, 2), {
      contentType: 'application/json',
      metadata: {
        cacheControl: 'no-cache'
      }
    });
    
    // Return the premium data
    res.json({
      success: true,
      data: {
        keywords,
        keywordResults: allResults,
        totalResults,
        priceTrends: priceTrendData
      },
      message: 'Premium auction data retrieved successfully'
    });
    
  } catch (error) {
    console.error('Error retrieving premium data:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving premium auction data',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;