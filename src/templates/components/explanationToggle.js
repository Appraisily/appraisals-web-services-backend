/**
 * Explanation Toggle Component
 * 
 * Creates a toggle switch to switch between simple and technical explanations
 */

/**
 * Generate HTML for an explanation toggle component
 * 
 * @returns {string} HTML for the toggle component
 */
function explanationToggleComponent() {
  return `
    <label class="toggle-switch">
      <input type="checkbox" id="explanation-toggle">
      <span class="toggle-slider"></span>
    </label>
  `;
}

module.exports = { explanationToggleComponent };