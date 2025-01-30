const { formatDate } = require('../utils/dateFormatter');

class ReportComposer {
  composeAnalysisReport(metadata, analyses) {
    // Handle case where metadata or analyses is missing
    if (!metadata || !analyses) {
      return this._generateBasicReport();
    }

    const { 
      visualSearch,
      originAnalysis,
      detailedAnalysis
    } = analyses;

    // Extract data safely with fallbacks
    const {
      maker_analysis = {},
      signature_check = {},
      origin_analysis = {},
      marks_recognition = {},
      age_analysis = {},
      visual_search = {}
    } = detailedAnalysis || {};

    const {
      originalName = 'Artwork',
      imageUrl
    } = metadata;

    return `
      <div style="color: #1f2937;">
        <div style="margin-bottom: 24px;">
          <h2 style="color: #1f2937; font-size: 20px; margin-bottom: 16px;">Visual Analysis Summary</h2>
          <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
            <p style="margin: 0 0 8px;"><strong>Item:</strong> ${originalName}</p>
            ${maker_analysis ? `
              <p style="margin: 0;"><strong>Maker Analysis:</strong> ${maker_analysis.creator_name || 'Unknown'}</p>
              <p style="margin: 0;"><strong>Reasoning:</strong> ${maker_analysis.reasoning || 'Not available'}</p>
            ` : ''}
          </div>
        </div>

        ${this._renderVisualSearchSection(visualSearch)}
        ${this._renderOriginAnalysisSection(originAnalysis)}

        ${detailedAnalysis ? `
          <div style="margin-bottom: 24px;">
            <h2 style="color: #1f2937; font-size: 20px; margin-bottom: 16px;">Detailed Analysis</h2>
            <div style="background: #f8fafc; padding: 16px; border-radius: 8px;">
              ${this._renderSignatureSection(signature_check)}
              ${this._renderOriginSection(origin_analysis)}
              ${this._renderMarksSection(marks_recognition)}
              ${this._renderAgeSection(age_analysis)}
            </div>
          </div>
        ` : ''}

        ${visual_search?.notes ? `
          <div style="margin-bottom: 24px;">
            <h3 style="color: #1f2937; font-size: 18px; margin-bottom: 12px;">Visual Analysis Notes</h3>
            <p style="margin: 0; line-height: 1.6;">${visual_search.notes}</p>
          </div>
        ` : ''}

        ${visual_search?.similar_artworks ? `
          <div style="margin-top: 24px; padding: 16px; background: #f0f9ff; border-radius: 8px; border-left: 4px solid #3b82f6;">
            <h3 style="color: #1f2937; font-size: 18px; margin: 0 0 8px;">Similar Artworks</h3>
            <p style="margin: 0; line-height: 1.6;">${visual_search.similar_artworks}</p>
          </div>
        ` : ''}

        <div style="margin-top: 24px; font-size: 14px; color: #6b7280;">
          <p style="margin: 0;">Analysis Date: ${formatDate(Date.now())}</p>
        </div>
      </div>
    `;
  }

  _generateBasicReport() {
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

  _renderVisualSearchSection(visualSearch) {
    if (!visualSearch?.vision?.description?.labels) return '';

    return `
      <div style="margin-bottom: 24px;">
        <h2 style="color: #1f2937; font-size: 20px; margin-bottom: 16px;">Visual Search Results</h2>
        <div style="background: #f8fafc; padding: 16px; border-radius: 8px;">
          ${visualSearch.openai ? `
            <p style="margin: 0 0 8px;"><strong>Category:</strong> ${visualSearch.openai.category || 'Not specified'}</p>
            <p style="margin: 0 0 8px;"><strong>Description:</strong> ${visualSearch.openai.description || 'Not available'}</p>
          ` : ''}
          <div style="margin-top: 12px;">
            <strong>Identified Elements:</strong>
            <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px;">
              ${visualSearch.vision.description.labels.map(label => `
                <span style="background: #e5e7eb; padding: 4px 12px; border-radius: 16px; font-size: 14px;">
                  ${label}
                </span>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  _renderOriginAnalysisSection(originAnalysis) {
    if (!originAnalysis?.originAnalysis) return '';

    const {
      originality,
      confidence,
      style_analysis,
      unique_characteristics,
      estimated_era,
      estimated_origin,
      material_or_medium,
      comparison_notes,
      recommendation
    } = originAnalysis.originAnalysis;

    return `
      <div style="margin-bottom: 24px;">
        <h2 style="color: #1f2937; font-size: 20px; margin-bottom: 16px;">Origin Analysis</h2>
        <div style="background: #f8fafc; padding: 16px; border-radius: 8px;">
          ${originality ? `
            <p style="margin: 0 0 8px;">
              <strong>Assessment:</strong> 
              <span style="color: ${originality === 'original' ? '#059669' : '#dc2626'}">
                ${originality === 'original' ? 'Original Work' : 'Reproduction'}
              </span>
              ${confidence ? ` (${Math.round(confidence * 100)}% confidence)` : ''}
            </p>
          ` : ''}
          ${style_analysis ? `<p style="margin: 0 0 8px;"><strong>Style Analysis:</strong> ${style_analysis}</p>` : ''}
          ${estimated_era ? `<p style="margin: 0 0 8px;"><strong>Estimated Era:</strong> ${estimated_era}</p>` : ''}
          ${estimated_origin ? `<p style="margin: 0 0 8px;"><strong>Estimated Origin:</strong> ${estimated_origin}</p>` : ''}
          ${material_or_medium ? `<p style="margin: 0 0 8px;"><strong>Material/Medium:</strong> ${material_or_medium}</p>` : ''}
          ${comparison_notes ? `<p style="margin: 0 0 8px;"><strong>Comparison Notes:</strong> ${comparison_notes}</p>` : ''}
          ${recommendation ? `
            <div style="margin-top: 12px; padding: 12px; background: #f0f9ff; border-radius: 8px; border-left: 4px solid #3b82f6;">
              <strong>Professional Recommendation:</strong><br>
              ${recommendation}
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }
  
  _renderSignatureSection(signature = {}) {
    if (!signature.signature_text) return '';
    return `
      <div style="margin-bottom: 16px;">
        <strong>Signature:</strong> ${signature.signature_text}<br>
        <strong>Interpretation:</strong> ${signature.interpretation || 'Not available'}
      </div>
    `;
  }

  _renderOriginSection(origin = {}) {
    if (!origin.likely_origin) return '';
    return `
      <div style="margin-bottom: 16px;">
        <strong>Likely Origin:</strong> ${origin.likely_origin}<br>
        <strong>Reasoning:</strong> ${origin.reasoning || 'Not available'}
      </div>
    `;
  }

  _renderMarksSection(marks = {}) {
    if (!marks.marks_identified) return '';
    return `
      <div style="margin-bottom: 16px;">
        <strong>Marks Identified:</strong> ${marks.marks_identified}<br>
        <strong>Interpretation:</strong> ${marks.interpretation || 'Not available'}
      </div>
    `;
  }

  _renderAgeSection(age = {}) {
    if (!age.estimated_date_range) return '';
    return `
      <div style="margin-bottom: 16px;">
        <strong>Estimated Date Range:</strong> ${age.estimated_date_range}<br>
        <strong>Reasoning:</strong> ${age.reasoning || 'Not available'}
      </div>
    `;
  }
}

module.exports = new ReportComposer();