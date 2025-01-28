const emailService = require('./index');
const sheetsService = require('../sheets');
const reportComposer = require('../reportComposer');

async function sendEmails(email, analysisResults, metadata, sessionId) {
  console.log('\n=== Starting Email Delivery Process ===');
  console.log('Recipient:', email);
  
  const { analysis: visualSearch, origin: originAnalysis, detailed: detailedAnalysis } = analysisResults;

  // Generate report
  console.log('Generating analysis report...');
  const reportHtml = reportComposer.composeAnalysisReport(
    metadata,
    {
      visualSearch,
      originAnalysis,
      detailedAnalysis
    }
  );
  console.log('✓ Report generated successfully');

  // Send free report immediately
  console.log('\nSending free report...');
  const freeReport = await emailService.sendFreeReport(email, reportHtml);
  
  // Schedule personal offer for 1 hour later
  console.log('\nScheduling personal offer...');
  const scheduledTime = Date.now() + (60 * 60 * 1000); // 1 hour from now
  
  const personalOffer = await emailService.sendPersonalOffer(
    email,
    'Special Professional Appraisal Offer', // Add explicit subject
    {
      sessionId,
      detailedAnalysis,
      visualSearch,
      originAnalysis
    },
    scheduledTime  // Pass scheduledTime as the fourth argument
  );

  // Update free report status
  try {
    await sheetsService.updateFreeReportStatus(
      sessionId,
      freeReport === true
    );
  } catch (error) {
    console.error('Failed to update free report status in sheets:', error);
  }

  // Update offer status if personal offer was scheduled
  if (personalOffer?.success) {
    try {
      await sheetsService.updateOfferStatus(
        sessionId,
        true,
        personalOffer.content || 'No content available',
        scheduledTime
      );
    } catch (error) {
      console.error('Failed to update offer status in sheets:', error);
    }
  } else {
    try {
      await sheetsService.updateOfferStatus(
        sessionId,
        false,
        'Failed to schedule offer'
      );
    } catch (error) {
      console.error('Failed to update failed offer status in sheets:', error);
    }
  }

  // Log results
  console.log('\nDelivery Results:');
  console.log('Free Report:', freeReport ? '✓ Sent' : '✗ Failed');
  console.log('Personal Offer:', personalOffer?.success ? 
    `✓ Scheduled for ${new Date(scheduledTime).toISOString()}` : 
    '✗ Failed to schedule');

  console.log('=== Email Delivery Process Complete ===\n');
}

module.exports = { sendEmails };