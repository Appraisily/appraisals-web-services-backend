const getFreeReportTemplate = () => `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Your Free Art Analysis Report</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background-color: #f9fafb;
      color: #1f2937;
      line-height: 1.6;
      margin: 0;
      padding: 20px;
    }
    
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      padding: 32px;
      border-radius: 16px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    }
    
    .header {
      text-align: center;
      margin-bottom: 32px;
    }
    
    .logo {
      width: 40px;
      height: 40px;
      vertical-align: middle;
      margin-right: 10px;
    }
    
    .company-name {
      display: inline-block;
      vertical-align: middle;
      font-size: 24px;
      font-weight: bold;
      color: #1f2937;
    }
    
    .content {
      color: #4b5563;
      font-size: 16px;
      padding: 0 8px;
    }
    
    .heading {
      font-size: 24px;
      font-weight: 600;
      color: #1f2937;
      margin-bottom: 24px;
      text-align: center;
    }

    .report-container {
      margin: 32px 0;
      padding: 24px;
      background-color: #f8fafc;
      border-radius: 12px;
      border: 1px solid #e5e7eb;
    }
    
    .signature {
      margin: 32px 0;
      padding-top: 24px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
    }
    
    .footer {
      margin-top: 32px;
      padding-top: 24px;
      border-top: 1px solid #e5e7eb;
      font-size: 14px;
      color: #4b5563;
      text-align: center;
    }
    
    .footer a {
      color: #007bff;
      text-decoration: none;
      font-weight: 500;
    }
    
    .cta-button {
      display: inline-block;
      background-color: #007bff;
      color: #ffffff !important;
      padding: 16px 32px;
      margin: 24px 0;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 600;
      text-align: center;
      transition: background-color 0.2s;
    }
    
    .cta-button:hover {
      background-color: #0056b3;
    }
    
    @media only screen and (max-width: 600px) {
      body {
        padding: 16px;
      }
      
      .container {
        padding: 24px;
      }
      
      .logo {
        width: 35px;
        height: 35px;
      }
      
      .company-name {
        font-size: 20px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <table width="100%" border="0" cellspacing="0" cellpadding="0">
      <tr>
        <td align="center" style="padding-bottom: 32px;">
          <table border="0" cellspacing="0" cellpadding="0">
            <tr>
              <td>
                <img src="http://cdn.mcauto-images-production.sendgrid.net/304ac75ef1d5c007/8aeb2689-2b5b-402d-a6f3-6521621e123a/300x300.png" alt="Appraisily Logo" class="logo" width="40" height="40" style="vertical-align: middle;">
              </td>
              <td style="padding-left: 10px;">
                <span class="company-name" style="vertical-align: middle;">Appraisily</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <h1 class="heading">Your Free Art Analysis Report</h1>

    <div class="content">
      <p>Thank you for using Appraisily! Here's your free art analysis report:</p>

      <div class="report-container">
        {{free_report}}
      </div>

      <p>Want a more detailed analysis? Our professional appraisal service provides:</p>
      <ul>
        <li>Comprehensive artwork evaluation</li>
        <li>Detailed market value assessment</li>
        <li>Authentication insights</li>
        <li>Historical context and provenance</li>
      </ul>

      <div style="text-align: center;">
        <a href="https://appraisily.com/start" class="cta-button">
          Get Professional Appraisal
        </a>
      </div>

      <div class="signature">
        <p>Thank you for choosing Appraisily!<br>Best regards,<br>The Appraisily Team</p>
      </div>
    </div>

    <div class="footer">
      <p>Visit our website at <a href="https://www.appraisily.com">www.appraisily.com</a></p>
      <p>&copy; ${new Date().getFullYear()} Appraisily. All rights reserved.</p>
      <p>If you have any questions, our support team is here to help 24/7.</p>
    </div>
  </div>
</body>
</html>`;

module.exports = {
  getFreeReportTemplate
};