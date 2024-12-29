const { formatDate } = require('../utils/dateFormatter');

class ReportComposer {
  composeAnalysisReport(analysisData, originData) {
    // Handle case where analysis or origin data is missing
    if (!analysisData && !originData) {
      return `
        <div style="color: #1f2937;">
          <div style="margin-bottom: 24px;">
            <h2 style="color: #1f2937; font-size: 20px; margin-bottom: 16px;">Basic Report</h2>
            <div style="background: #f8fafc; padding: 16px; border-radius: 8px;">
              <p style="margin: 0;">Your image has been received and is pending analysis. For a complete analysis including 
              artwork authenticity, origin determination, and professional recommendations, please visit our website.</p>
            </div>
          </div>
        </div>
      `;
    }

    const {
      openai: { category, description } = {},
      vision: {
        webEntities = [],
        description: { labels = [] } = {}
      } = {}
    } = analysisData;

    const {
      originAnalysis: {
        originality,
        confidence,
        style_analysis,
        unique_characteristics = [],
        estimated_era,
        estimated_origin,
        material_or_medium,
        comparison_notes,
        recommendation
      } = {}
    } = originData;

    return `
      <div style="color: #1f2937;">
        <div style="margin-bottom: 24px;">
          <h2 style="color: #1f2937; font-size: 20px; margin-bottom: 16px;">Visual Analysis Summary</h2>
          <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
            <p style="margin: 0 0 8px;"><strong>Category:</strong> ${category || 'Not specified'}</p>
            <p style="margin: 0;"><strong>Description:</strong> ${description || 'Not available'}</p>
          </div>
          ${this._renderLabelsSection(labels)}
        </div>

        <div style="margin-bottom: 24px;">
          <h2 style="color: #1f2937; font-size: 20px; margin-bottom: 16px;">Expert Analysis</h2>
          <div style="background: #f8fafc; padding: 16px; border-radius: 8px;">
            ${this._renderOriginSection({
              originality,
              confidence,
              style_analysis,
              estimated_era,
              estimated_origin,
              material_or_medium
            })}
          </div>
        </div>

        ${this._renderCharacteristicsSection(unique_characteristics)}
        
        ${comparison_notes ? `
          <div style="margin-bottom: 24px;">
            <h3 style="color: #1f2937; font-size: 18px; margin-bottom: 12px;">Comparative Analysis</h3>
            <p style="margin: 0; line-height: 1.6;">${comparison_notes}</p>
          </div>
        ` : ''}

        ${recommendation ? `
          <div style="margin-top: 24px; padding: 16px; background: #f0f9ff; border-radius: 8px; border-left: 4px solid #3b82f6;">
            <h3 style="color: #1f2937; font-size: 18px; margin: 0 0 8px;">Professional Recommendation</h3>
            <p style="margin: 0; line-height: 1.6;">${recommendation}</p>
          </div>
        ` : ''}

        <div style="margin-top: 24px; font-size: 14px; color: #6b7280;">
          <p style="margin: 0;">Analysis Date: ${formatDate(Date.now())}</p>
        </div>
      </div>
    `;
  }

  _renderLabelsSection(labels) {
    if (!labels || labels.length === 0) return '';

    return `
      <div style="margin-top: 16px;">
        <h3 style="color: #1f2937; font-size: 18px; margin-bottom: 12px;">Identified Elements</h3>
        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
          ${labels.map(label => `
            <span style="background: #e5e7eb; padding: 4px 12px; border-radius: 16px; font-size: 14px;">
              ${label}
            </span>
          `).join('')}
        </div>
      </div>
    `;
  }

  _renderOriginSection({ originality, confidence, style_analysis, estimated_era, estimated_origin, material_or_medium }) {
    return `
      <div style="display: grid; gap: 12px;">
        ${originality ? `
          <div>
            <strong>Assessment:</strong> 
            <span style="color: ${originality === 'original' ? '#059669' : '#dc2626'}">
              ${originality === 'original' ? 'Original Work' : 'Reproduction'}
            </span>
            ${confidence ? ` (${Math.round(confidence * 100)}% confidence)` : ''}
          </div>
        ` : ''}
        
        ${style_analysis ? `
          <div><strong>Style Analysis:</strong> ${style_analysis}</div>
        ` : ''}
        
        ${estimated_era ? `
          <div><strong>Estimated Era:</strong> ${estimated_era}</div>
        ` : ''}
        
        ${estimated_origin ? `
          <div><strong>Estimated Origin:</strong> ${estimated_origin}</div>
        ` : ''}
        
        ${material_or_medium ? `
          <div><strong>Material/Medium:</strong> ${material_or_medium}</div>
        ` : ''}
      </div>
    `;
  }

  _renderCharacteristicsSection(characteristics) {
    if (!characteristics || characteristics.length === 0) return '';

    return `
      <div style="margin-bottom: 24px;">
        <h3 style="color: #1f2937; font-size: 18px; margin-bottom: 12px;">Unique Characteristics</h3>
        <ul style="margin: 0; padding-left: 20px;">
          ${characteristics.map(char => `
            <li style="margin-bottom: 8px;">${char}</li>
          `).join('')}
        </ul>
      </div>
    `;
  }
}

module.exports = new ReportComposer();