const fetch = require('node-fetch');
const cloudServices = require('../../../services/storage');

const TIMEOUT_MS = 5000; // 5 second timeout

async function downloadImage(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    
    const response = await fetch(url, { 
      signal: controller.signal,
      headers: {
        'User-Agent': 'node-fetch/1.0 (+https://github.com/bitinn/node-fetch)'
      }
    });
    
    clearTimeout(timeout);
    
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.statusText}`);
    }
    
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.startsWith('image/')) {
      throw new Error('Invalid content type: ' + contentType);
    }
    
    return response.buffer();
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`Download timeout after ${TIMEOUT_MS}ms`);
    }
    console.error(`Error downloading image from ${url}:`, error);
    throw error;
  }
}

exports.downloadAndStoreSimilarImages = async function(sessionId, similarImages) {
  const bucket = cloudServices.getBucket();
  const results = [];
  
  // Limit to first 5 images
  const imagesToProcess = similarImages.slice(0, 5);
  
  console.log(`\nDownloading similar images for session ${sessionId}...`);
  
  for (let i = 0; i < imagesToProcess.length; i++) {
    const image = imagesToProcess[i];
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
      console.log(`Skipping image ${imageNumber} and continuing with next...`);
      // Continue with next image
    }
  }
  
  console.log(`\nCompleted processing ${results.length} similar images`);
  return results;
}