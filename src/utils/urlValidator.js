const fetch = require('node-fetch');

async function isValidImageUrl(url) {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    if (!response.ok) return false;
    
    const contentType = response.headers.get('content-type');
    return contentType && contentType.startsWith('image/');
  } catch (error) {
    console.warn(`Failed to validate URL: ${url}`, error.message);
    return false;
  }
}

async function filterValidImageUrls(images) {
  const originalCount = images.length;
  console.log('\nValidating similar image URLs:');
  console.log('Original URLs:');
  images.forEach((img, index) => {
    console.log(`${index + 1}. ${img.url} (score: ${img.score || 'N/A'})`);
  });
  
  const validImages = [];
  for (const img of images) {
    console.log(`\nChecking URL: ${img.url}`);
    if (await isValidImageUrl(img.url)) {
      console.log('✓ Valid image URL');
      validImages.push(img);
    } else {
      console.log('✗ Invalid or inaccessible image URL');
    }
  }
  
  console.log('\nFiltered Results:');
  validImages.forEach((img, index) => {
    console.log(`${index + 1}. ${img.url} (score: ${img.score || 'N/A'})`);
  });
  console.log(`\nValidation complete: ${validImages.length} valid images out of ${originalCount} total`);
  
  return validImages;
}

module.exports = {
  isValidImageUrl,
  filterValidImageUrls
};