/**
 * Image Zoom Component
 * 
 * Creates a zoomable image container that opens a modal when clicked
 */

/**
 * Generate HTML for a zoomable image component
 * 
 * @param {string} imageUrl URL of the image to display
 * @param {string} altText Alt text for the image
 * @param {string} id Unique identifier for the image container
 * @returns {string} HTML for the image component
 */
function imageZoomComponent(imageUrl, altText, id) {
  if (!imageUrl) {
    return `<div class="image-wrapper" id="${id}-container">
      <div class="image-container">
        <img src="https://ik.imagekit.io/appraisily/WebPage/no-image.png" alt="No image available" class="zoomable">
      </div>
    </div>`;
  }

  return `
    <div class="image-wrapper" id="${id}-container">
      <div class="image-container">
        <img src="${imageUrl}" alt="${altText || 'Image'}" class="zoomable" id="${id}">
      </div>
    </div>
  `;
}

module.exports = { imageZoomComponent };