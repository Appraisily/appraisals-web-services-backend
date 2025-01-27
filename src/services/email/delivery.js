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

  // Send emails and update sheets in parallel
  console.log('\nSending emails and updating sheets...');
  const [freeReport, personalOffer, sheetsUpdate] = await Promise.allSettled([
    emailService.sendFreeReport(email, reportHtml),
    emailService.sendPersonalOffer(email, {
      sessionId,
      detailedAnalysis,
      visualSearch,
      originAnalysis
    }),
    sheetsService.updateEmailSubmission(sessionId, email)
  ]);

  // Log results
  console.log('\nDelivery Results:');
  console.log('Free Report:', freeReport.status === 'fulfilled' ? '✓ Sent' : `✗ Failed: ${freeReport.reason}`);
  console.log('Personal Offer:', personalOffer.status === 'fulfilled' ? '✓ Sent' : `✗ Failed: ${personalOffer.reason}`);
  console.log('Sheets Update:', sheetsUpdate.status === 'fulfilled' ? '✓ Updated' : `✗ Failed: ${sheetsUpdate.reason}`);

  // Check for any failures
  const failures = [freeReport, personalOffer, sheetsUpdate].filter(result => result.status === 'rejected');
  if (failures.length > 0) {
    console.error('\n✗ Some operations failed:', failures.map(f => f.reason));
  }

  console.log('=== Email Delivery Process Complete ===\n');
}

module.exports = { sendEmails };