const cloudServices = require('../../../services/storage');

exports.updateMetadata = async function(sessionId, metadata, formattedResults, openaiAnalysis) {
  const bucket = cloudServices.getBucket();
  const metadataFile = bucket.file(`sessions/${sessionId}/metadata.json`);

  // Update metadata with analysis results
  const updatedMetadata = {
    ...metadata,
    analyzed: true,
    analysisTimestamp: Date.now(),
    analysisResults: {
      labels: formattedResults.description.labels,
      webEntities: formattedResults.webEntities.length,
      matchCounts: {
        exact: formattedResults.matches.exact.length,
        partial: formattedResults.matches.partial.length,
        similar: formattedResults.matches.similar.length,
        storedSimilar: formattedResults.matches.similar.filter(img => img.storedImage).length
      },
      pagesWithMatches: formattedResults.pagesWithMatchingImages.length,
      webLabels: formattedResults.webLabels.length,
      openaiAnalysis: openaiAnalysis
    }
  };

  // Save updated metadata
  await metadataFile.save(JSON.stringify(updatedMetadata, null, 2), {
    contentType: 'application/json',
    metadata: {
      cacheControl: 'no-cache'
    }
  });

  return updatedMetadata;