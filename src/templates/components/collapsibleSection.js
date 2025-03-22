/**
 * Collapsible Section Component
 * 
 * Creates a collapsible section with a header that can be clicked to expand/collapse
 */

/**
 * Generate HTML for a collapsible section component
 * 
 * @param {string} id Unique identifier for the section
 * @param {string} title Title for the section header
 * @param {string} content HTML content for the section body
 * @returns {string} HTML for the collapsible section
 */
function collapsibleSectionComponent(id, title, content) {
  return `
    <div class="collapsible" id="${id}">
      <div class="collapsible-header">
        <span class="collapsible-title">${title}</span>
        <svg class="collapsible-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </div>
      <div class="collapsible-content">
        ${content}
      </div>
    </div>
  `;
}

module.exports = { collapsibleSectionComponent };