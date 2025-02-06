const fetch = require('node-fetch');
const cloudServices = require('../../../services/storage');

async function downloadImage(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.statusText}`);
    }
    return response.buffer();
  } catch (error) {
    console.error(`Error downloading image from ${url}:`, error);
    throw error;
  }
}

exports.downloadAndStoreSimilarImages = async function(sessionId, similarImages) {
  const bucket = cloudServices.getBucket();
  const results = [];
  
  console.log(`\nDownloading similar images for session ${sessionId}...`);
  
  for (let i = 0; i < similarImages.length; i++) {
    const image = similarImages[i];
    const imageNumber = i + 1;
    const fileName = `sessions/${sessionId}/similar-image${imageNumber}.jpg`;
    
    try {
      console.log(`Downloading image ${imageNumber} from ${image.url}...`);
      const imageBuffer = await downloadImage(image.url);
      
      const file = bucket.file(fileName);
      await file.save(imageBuffer, {
        contentType: 'image/jpeg',
        metadata: {
          cacheControl: 'public, max-age=3600'
        }
      });
      
      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
      console.log(`✓ Image ${imageNumber} saved to GCS: ${fileName}`);
      
      results.push({
        originalUrl: image.url,
        storedUrl: publicUrl,
        fileName,
        score: image.score
      });
    } catch (error) {
      console.error(`Failed to process image ${imageNumber}:`, error);
      // Continue with next image
    }
  }
  
  console.log(`\nCompleted processing ${results.length} similar images`);
  return results;
}