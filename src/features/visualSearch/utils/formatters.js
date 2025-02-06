/**
 * Formats the results from Google Vision API web detection
 */
exports.formatVisionResults = function(webDetection) {
  return {
    webEntities: (webDetection.webEntities || []).map(entity => ({
      entityId: entity.entityId,
      score: entity.score,
      description: entity.description
    })),
    description: {
      labels: webDetection.bestGuessLabels?.map(label => label.label) || [],
      confidence: webDetection.bestGuessLabels?.[0]?.score || 0
    },
    pagesWithMatchingImages: (webDetection.pagesWithMatchingImages || []).map(page => ({
      url: page.url,
      pageTitle: page.pageTitle,
      fullMatchingImages: page.fullMatchingImages || [],
      partialMatchingImages: page.partialMatchingImages || []
    })),
    matches: {
      exact: (webDetection.fullMatchingImages || []).map(img => ({
        url: img.url,
        score: img.score || 1.0,
        type: 'exact',
        metadata: img.metadata || {}
      })),
      partial: (webDetection.partialMatchingImages || []).map(img => ({
        url: img.url,
        score: img.score || 0.5,
        type: 'partial',
        metadata: img.metadata || {}
      })),
      similar: (webDetection.visuallySimilarImages || []).map(img => ({
        url: img.url,
        score: img.score || 0.3,
        type: 'similar',
        metadata: img.metadata || {}
      }))
    },
    derivedSubjects: webDetection.derivedSubjects || [],
    webLabels: (webDetection.webLabels || []).map(label => ({
      label: label.label,
      score: label.score,
      languages: label.languages || []
    }))
  };
};