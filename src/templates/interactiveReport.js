/**
 * Interactive HTML Report Template
 * 
 * This template generates an enhanced HTML report with interactive JavaScript features
 * including image zoom, collapsible sections, and technical/simple toggles.
 */

const { imageZoomComponent } = require('./components/imageZoom');
const { collapsibleSectionComponent } = require('./components/collapsibleSection');
const { explanationToggleComponent } = require('./components/explanationToggle');

/**
 * Generate an interactive HTML report from analysis data
 * 
 * @param {Object} data The complete analysis data
 * @returns {string} Complete HTML report
 */
function generateInteractiveReport(data) {
  const {
    metadata,
    detailedAnalysis,
    visualAnalysis,
    originAnalysis,
    valueAnalysis
  } = data;

  // Extract key data for use in the report
  const sessionId = metadata?.sessionId || 'N/A';
  const userImageUrl = metadata?.imageUrl || '';
  const category = visualAnalysis?.openai?.category || 'Unknown Item';
  const description = visualAnalysis?.openai?.description || 'No description available';
  
  // Value information
  const valueRange = valueAnalysis ? 
    `$${valueAnalysis.minValue.toLocaleString()} - $${valueAnalysis.maxValue.toLocaleString()}` : 
    'Unable to determine value range';
  
  const mostLikelyValue = valueAnalysis?.mostLikelyValue ?
    `$${valueAnalysis.mostLikelyValue.toLocaleString()}` :
    'Unknown';

  // Similar images
  const similarImages = visualAnalysis?.vision?.matches?.similar || [];
  
  // Base report HTML
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Appraisily Analysis Report - ${description}</title>
  <style>
    /* Base styles */
    :root {
      --primary-color: #2563eb;
      --primary-light: rgba(59, 130, 246, 0.05);
      --gray-100: #f3f4f6;
      --gray-200: #e5e7eb;
      --gray-300: #d1d5db;
      --gray-500: #6b7280;
      --gray-700: #374151;
      --gray-900: #111827;
      --success: #10b981;
      --success-light: rgba(16, 185, 129, 0.1);
      --warning: #f59e0b;
      --warning-light: rgba(245, 158, 11, 0.1);
      --error: #ef4444;
      --error-light: rgba(239, 68, 68, 0.1);
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      line-height: 1.5;
      color: var(--gray-700);
      background-color: #f8fafc;
      padding: 0;
      margin: 0;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
    }
    .report-box {
      background-color: white;
      border-radius: 12px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }
    .header {
      text-align: center;
      padding: 20px;
      margin-bottom: 20px;
    }
    .header h1 {
      color: var(--gray-900);
      font-size: 24px;
      margin-bottom: 8px;
    }
    .header-logo {
      width: 120px;
      margin-bottom: 20px;
    }
    .section {
      margin-bottom: 24px;
      border-bottom: 1px solid var(--gray-200);
      padding-bottom: 24px;
    }
    .section:last-child {
      border-bottom: none;
    }
    h2 {
      font-size: 20px;
      font-weight: 600;
      color: var(--gray-900);
      margin-bottom: 16px;
    }
    h3 {
      font-size: 16px;
      font-weight: 500;
      color: var(--gray-700);
      margin-bottom: 12px;
    }
    p {
      margin-bottom: 12px;
    }
    .text-muted {
      color: var(--gray-500);
      font-size: 14px;
    }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 500;
    }
    .badge-primary {
      background-color: var(--primary-light);
      color: var(--primary-color);
    }
    .badge-info {
      background-color: #e0f2fe;
      color: #0369a1;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
    }
    .card {
      background-color: var(--gray-100);
      border-radius: 8px;
      padding: 16px;
    }
    .meta-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      font-size: 14px;
    }
    .meta-label {
      color: var(--gray-500);
      font-weight: 500;
    }
    .meta-value {
      color: var(--gray-900);
      font-weight: 600;
    }
    .image-wrapper {
      width: 100%;
      margin-bottom: 20px;
      position: relative;
      border-radius: 8px;
      overflow: hidden;
      background-color: var(--gray-100);
    }
    .image-container {
      width: 100%;
      padding-top: 75%; /* 4:3 aspect ratio */
      position: relative;
    }
    .image-container img {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
    .similar-images {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
      gap: 12px;
      margin-top: 16px;
    }
    .similar-image-container {
      border-radius: 8px;
      overflow: hidden;
      padding-top: 100%; /* 1:1 aspect ratio */
      position: relative;
      cursor: pointer;
      border: 2px solid transparent;
      transition: all 0.2s ease;
    }
    .similar-image-container:hover {
      border-color: var(--primary-color);
      transform: scale(1.02);
    }
    .similar-image-container img {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .progress-container {
      width: 100%;
      height: 8px;
      background-color: var(--gray-200);
      border-radius: 4px;
      overflow: hidden;
      margin-top: 8px;
    }
    .progress-bar {
      height: 100%;
      background-color: var(--primary-color);
      width: 0;
      transition: width 0.5s ease;
    }
    .button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 8px 16px;
      border-radius: 6px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      text-decoration: none;
    }
    .button-primary {
      background-color: var(--primary-color);
      color: white;
    }
    .button-primary:hover {
      background-color: #1d4ed8;
    }
    .button-outline {
      border: 1px solid var(--gray-300);
      color: var(--gray-700);
    }
    .button-outline:hover {
      background-color: var(--gray-100);
    }
    .icon {
      width: 16px;
      height: 16px;
      margin-right: 8px;
    }
    .footer {
      text-align: center;
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid var(--gray-200);
      color: var(--gray-500);
      font-size: 14px;
    }
    
    /* Collapsible section styles */
    .collapsible {
      border: 1px solid var(--gray-200);
      border-radius: 8px;
      margin-bottom: 16px;
      overflow: hidden;
    }
    .collapsible-header {
      padding: 16px;
      background-color: var(--gray-100);
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
      transition: background-color 0.2s ease;
    }
    .collapsible-header:hover {
      background-color: #e5e7eb;
    }
    .collapsible-title {
      font-weight: 500;
      color: var(--gray-900);
    }
    .collapsible-content {
      padding: 0;
      max-height: 0;
      overflow: hidden;
      transition: all 0.3s ease;
    }
    .collapsible.open .collapsible-content {
      padding: 16px;
      max-height: 500px;
    }
    .collapsible-icon {
      transform: rotate(0deg);
      transition: transform 0.2s ease;
    }
    .collapsible.open .collapsible-icon {
      transform: rotate(180deg);
    }
    
    /* Toggle switches */
    .toggle-container {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 16px;
    }
    .toggle-switch {
      position: relative;
      display: inline-block;
      width: 48px;
      height: 24px;
    }
    .toggle-switch input {
      opacity: 0;
      width: 0;
      height: 0;
    }
    .toggle-slider {
      position: absolute;
      cursor: pointer;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: var(--gray-300);
      transition: .4s;
      border-radius: 24px;
    }
    .toggle-slider:before {
      position: absolute;
      content: "";
      height: 16px;
      width: 16px;
      left: 4px;
      bottom: 4px;
      background-color: white;
      transition: .4s;
      border-radius: 50%;
    }
    input:checked + .toggle-slider {
      background-color: var(--primary-color);
    }
    input:checked + .toggle-slider:before {
      transform: translateX(24px);
    }
    .toggle-label {
      margin-right: 8px;
      font-size: 14px;
      color: var(--gray-700);
    }
    
    /* Image zoom styles */
    .zoom-modal {
      display: none;
      position: fixed;
      z-index: 1000;
      left: 0;
      top: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.9);
    }
    .zoom-modal-content {
      width: 90%;
      max-width: 800px;
      max-height: 90%;
      margin: auto;
      display: block;
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      object-fit: contain;
    }
    .zoom-close {
      position: absolute;
      top: 15px;
      right: 25px;
      color: #f1f1f1;
      font-size: 40px;
      font-weight: bold;
      transition: 0.3s;
      cursor: pointer;
    }
    .zoom-close:hover {
      color: #bbb;
    }
    
    /* Responsive styles */
    @media (max-width: 768px) {
      .container {
        padding: 20px 12px;
      }
      .grid {
        grid-template-columns: 1fr;
      }
      .similar-images {
        grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="report-box">
      <div class="header">
        <img src="https://ik.imagekit.io/appraisily/WebPage/logo_new.png" alt="Appraisily Logo" class="header-logo">
        <h1>Art Analysis Report</h1>
        <span class="badge badge-primary">${category}</span>
      </div>
      
      <!-- Customer Image Section -->
      <div class="section">
        ${imageZoomComponent(userImageUrl, "Your Item", "customer-image")}
        
        <div class="meta-row">
          <span class="meta-label">Description:</span>
          <span class="meta-value">${description}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Analysis ID:</span>
          <span class="meta-value">${sessionId}</span>
        </div>
      </div>
      
      <!-- Value Estimation Section -->
      <div class="section">
        <h2>Value Estimation</h2>
        <div class="grid">
          <div class="card">
            <h3>Estimated Range</h3>
            <p class="text-primary" style="font-size: 20px; font-weight: 600; color: var(--primary-color);">${valueRange}</p>
          </div>
          <div class="card">
            <h3>Most Likely Value</h3>
            <p class="text-primary" style="font-size: 20px; font-weight: 600; color: var(--primary-color);">${mostLikelyValue}</p>
          </div>
        </div>
        
        ${collapsibleSectionComponent(
          "valuation-methodology", 
          "Valuation Methodology", 
          `<p>${valueAnalysis?.explanation || "No valuation methodology available."}</p>`
        )}
      </div>
      
      <!-- Detailed Analysis Section -->
      <div class="section">
        <h2>Detailed Analysis</h2>
        
        <div class="toggle-container">
          <span class="toggle-label">Technical Details</span>
          ${explanationToggleComponent()}
        </div>
        
        ${collapsibleSectionComponent(
          "maker-analysis", 
          "Maker Analysis", 
          `<div class="simple-content">
            <p><strong>Creator:</strong> ${detailedAnalysis?.maker_analysis?.creator_name || "Unknown"}</p>
          </div>
          <div class="technical-content" style="display: none;">
            <p><strong>Creator:</strong> ${detailedAnalysis?.maker_analysis?.creator_name || "Unknown"}</p>
            <p><strong>Analysis Reasoning:</strong> ${detailedAnalysis?.maker_analysis?.reasoning || "No detailed reasoning available."}</p>
          </div>`
        )}
        
        ${collapsibleSectionComponent(
          "origin-analysis", 
          "Origin Analysis", 
          `<div class="simple-content">
            <p><strong>Likely Origin:</strong> ${detailedAnalysis?.origin_analysis?.likely_origin || "Unknown"}</p>
          </div>
          <div class="technical-content" style="display: none;">
            <p><strong>Likely Origin:</strong> ${detailedAnalysis?.origin_analysis?.likely_origin || "Unknown"}</p>
            <p><strong>Analysis Reasoning:</strong> ${detailedAnalysis?.origin_analysis?.reasoning || "No detailed reasoning available."}</p>
          </div>`
        )}
        
        ${collapsibleSectionComponent(
          "age-analysis", 
          "Age Analysis", 
          `<div class="simple-content">
            <p><strong>Estimated Date Range:</strong> ${detailedAnalysis?.age_analysis?.estimated_date_range || "Unknown"}</p>
          </div>
          <div class="technical-content" style="display: none;">
            <p><strong>Estimated Date Range:</strong> ${detailedAnalysis?.age_analysis?.estimated_date_range || "Unknown"}</p>
            <p><strong>Analysis Reasoning:</strong> ${detailedAnalysis?.age_analysis?.reasoning || "No detailed reasoning available."}</p>
          </div>`
        )}
        
        ${originAnalysis ? collapsibleSectionComponent(
          "originality-analysis", 
          "Originality Assessment", 
          `<div class="simple-content">
            <p><strong>Assessment:</strong> ${originAnalysis.originality === 'original' ? 'Likely Original' : 'Likely Reproduction'}</p>
            <div class="progress-container">
              <div class="progress-bar" style="width: ${(originAnalysis.confidence * 100)}%;"></div>
            </div>
            <p class="text-muted">Confidence: ${Math.round(originAnalysis.confidence * 100)}%</p>
          </div>
          <div class="technical-content" style="display: none;">
            <p><strong>Assessment:</strong> ${originAnalysis.originality === 'original' ? 'Likely Original' : 'Likely Reproduction'}</p>
            <div class="progress-container">
              <div class="progress-bar" style="width: ${(originAnalysis.confidence * 100)}%;"></div>
            </div>
            <p class="text-muted">Confidence: ${Math.round(originAnalysis.confidence * 100)}%</p>
            <p><strong>Style Analysis:</strong> ${originAnalysis.style_analysis}</p>
            <p><strong>Unique Characteristics:</strong></p>
            <ul>
              ${originAnalysis.unique_characteristics.map(characteristic => `<li>${characteristic}</li>`).join('')}
            </ul>
            <p><strong>Comparison Notes:</strong> ${originAnalysis.comparison_notes}</p>
          </div>`
        ) : ''}
      </div>
      
      <!-- Similar Images Section -->
      ${similarImages.length > 0 ? `
      <div class="section">
        <h2>Similar Items Found</h2>
        <p class="text-muted">These visually similar items were found in our reference database:</p>
        
        <div class="similar-images">
          ${similarImages.map((image, index) => `
            ${imageZoomComponent(image.url, `Similar Image ${index + 1}`, `similar-image-${index}`)}
          `).join('')}
        </div>
      </div>
      ` : ''}
      
      <!-- Call to Action -->
      <div class="section" style="text-align: center; padding: 32px 16px;">
        <h2>Get a Professional Appraisal</h2>
        <p>For a detailed professional appraisal and authentication of your artwork</p>
        <a href="https://appraisily.com/professional-appraisal" class="button button-primary" style="margin-top: 16px;">
          Get Started
        </a>
      </div>
      
      <div class="footer">
        <p>© ${new Date().getFullYear()} Appraisily. All rights reserved.</p>
        <p>Analysis ID: ${sessionId}</p>
      </div>
    </div>
  </div>
  
  <!-- Zoom Modal -->
  <div id="zoom-modal" class="zoom-modal">
    <span class="zoom-close">&times;</span>
    <img id="zoom-image" class="zoom-modal-content">
  </div>

  <script>
    // Initialize all interactive components
    document.addEventListener('DOMContentLoaded', function() {
      // Initialize collapsible sections
      initCollapsibleSections();
      
      // Initialize image zoom functionality
      initImageZoom();
      
      // Initialize explanation toggles
      initExplanationToggles();
    });
    
    // Collapsible sections
    function initCollapsibleSections() {
      const collapsibles = document.querySelectorAll('.collapsible');
      
      collapsibles.forEach(collapsible => {
        const header = collapsible.querySelector('.collapsible-header');
        
        header.addEventListener('click', () => {
          collapsible.classList.toggle('open');
        });
      });
    }
    
    // Image zoom functionality
    function initImageZoom() {
      const modal = document.getElementById('zoom-modal');
      const modalImg = document.getElementById('zoom-image');
      const closeBtn = document.querySelector('.zoom-close');
      const zoomableImages = document.querySelectorAll('.zoomable');
      
      zoomableImages.forEach(img => {
        img.addEventListener('click', () => {
          modal.style.display = 'block';
          modalImg.src = img.src;
          modalImg.alt = img.alt;
        });
      });
      
      closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
      });
      
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.style.display = 'none';
        }
      });
    }
    
    // Explanation toggle functionality
    function initExplanationToggles() {
      const toggleSwitch = document.getElementById('explanation-toggle');
      const simpleContent = document.querySelectorAll('.simple-content');
      const technicalContent = document.querySelectorAll('.technical-content');
      
      if (toggleSwitch) {
        toggleSwitch.addEventListener('change', () => {
          if (toggleSwitch.checked) {
            // Show technical content
            simpleContent.forEach(content => content.style.display = 'none');
            technicalContent.forEach(content => content.style.display = 'block');
          } else {
            // Show simple content
            simpleContent.forEach(content => content.style.display = 'block');
            technicalContent.forEach(content => content.style.display = 'none');
          }
        });
      }
    }
  </script>
</body>
</html>
  `;
}

module.exports = { generateInteractiveReport };