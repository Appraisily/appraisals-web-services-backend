/**
 * Service to format and structure origin analysis data
 */
class OriginFormatter {
  formatOriginAnalysis(originData) {
    const {
      originAnalysis,
      matches,
      webEntities = [],
      visionLabels = { labels: [], confidence: 0 },
      openaiAnalysis = {}
    } = originData;

    return {
      timestamp: Date.now(),
      matches: this._formatMatches(matches),
      originAnalysis: this._formatAnalysisResults(originAnalysis),
      webEntities: this._formatWebEntities(webEntities),
      visionLabels,
      openaiAnalysis
    };
  }

  _formatMatches(matches = {}) {
    const { exact = [], partial = [], similar = [] } = matches;
    
    return {
      exact: this._formatMatchArray(exact, 1.0, 'exact'),
      partial: this._formatMatchArray(partial, 0.5, 'partial'),
      similar: this._formatMatchArray(similar, 0.3, 'similar')
    };
  }

  _formatMatchArray(matches, defaultScore, type) {
    return matches.map(match => ({
      url: match.url,
      score: match.score || defaultScore,
      type,
      metadata: match.metadata || {}
    }));
  }

  _formatWebEntities(entities) {
    return entities.map(entity => ({
      entityId: entity.entityId,
      score: entity.score,
      description: entity.description
    }));
  }

  _formatAnalysisResults(analysis) {
    if (!analysis) return null;

    return {
      originality: analysis.originality || 'unknown',
      confidence: analysis.confidence || 0,
      style_analysis: analysis.style_analysis || '',
      unique_characteristics: analysis.unique_characteristics || [],
      estimated_era: analysis.estimated_era || 'unknown',
      estimated_origin: analysis.estimated_origin || 'unknown',
      material_or_medium: analysis.material_or_medium || 'unknown',
      comparison_notes: analysis.comparison_notes || '',
      recommendation: analysis.recommendation || ''
    };
  }
}

module.exports = new OriginFormatter();