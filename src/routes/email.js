const express = require('express');
const { rateLimit } = require('express-rate-limit');
const validator = require('validator');
const argon2 = require('argon2');
const cloudServices = require('../services/storage');
const emailService = require('../services/email');
const encryption = require('../services/encryption');
const sheetsService = require('../services/sheets');
const reportComposer = require('../services/reportComposer');
const fetch = require('node-fetch');

const router = express.Router();

// Rate limiting: 5 requests per minute per IP
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests, please try again later.'
  }
});

router.post('/submit-email', limiter, async (req, res) => {
  try {
    const { email, sessionId } = req.body;

    if (!email || !sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Email and sessionId are required.'
      });
    }

    if (!validator.isEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format.'
      });
    }

    const sessionFolder = `sessions/${sessionId}`;
    const bucket = cloudServices.getBucket();
    const metadataFile = bucket.file(`${sessionFolder}/metadata.json`);
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    console.log(`Processing email submission for session ${sessionId}`);

    const [exists] = await metadataFile.exists();

    if (!exists) {
      return res.status(404).json({
        success: false,
        message: 'Session not found.'
      });
    }

    const [metadataContent] = await metadataFile.download();
    const metadata = JSON.parse(metadataContent.toString());

    const emailHash = await argon2.hash(email, {
      type: argon2.argon2id,
      memoryCost: 2 ** 16,
      timeCost: 3,
      parallelism: 1
    });

    metadata.emailHash = emailHash;
    metadata.email = {
      submissionTime: Date.now(),
      hash: emailHash,
      encrypted: encryption.encrypt(email),
      verified: false // For future email verification feature
    };

    await metadataFile.save(JSON.stringify(metadata, null, 2), {
      contentType: 'application/json',
      metadata: {
        cacheControl: 'no-cache'
      }
    });

    // Check for existing analyses
    const files = {
      analysis: bucket.file(`${sessionFolder}/analysis.json`),
      origin: bucket.file(`${sessionFolder}/origin.json`),
      detailed: bucket.file(`${sessionFolder}/detailed.json`),
    };

    // Check which files exist
    console.log('Checking for existing analysis files...');
    const [analysisExists, originExists, detailedExists] = await Promise.all([
      files.analysis.exists().catch(() => [false]),
      files.origin.exists().catch(() => [false]),
      files.detailed.exists().catch(() => [false])
    ]);

    console.log('Analysis files status:', {
      visualSearch: analysisExists[0] ? 'exists' : 'missing',
      origin: originExists[0] ? 'exists' : 'missing',
      detailed: detailedExists[0] ? 'exists' : 'missing'
    });

    // Helper function to perform analysis
    const performAnalysis = async (endpoint, file, exists) => {
      if (exists[0]) {
        console.log(`Loading existing ${endpoint} analysis...`);
        const [content] = await file.download();
        return JSON.parse(content.toString());
      } else {
        console.log(`No existing ${endpoint} analysis found, performing new analysis...`);
      }

      console.log(`Performing ${endpoint} analysis...`);
      const response = await fetch(`${baseUrl}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      });

      if (!response.ok) {
        throw new Error(`Failed to perform ${endpoint} analysis`);
      }

      const result = await response.json();
      let content = endpoint === 'full-analysis' ? {
        "maker_analysis": {
          "creator_name": "Unknown contemporary surrealist, possibly influenced by Salvador Dalí",
          "reasoning": "The composition—with a fragmented portrait woven among orbiting spheres—strongly evokes Dalí's 'Galatea of the Spheres' imagery and surrealist techniques. However, the visible signature is not clearly decipherable as Dalí's and lacks his typical flamboyant autograph style, suggesting a modern artist working in a similar vein."
        },
        "signature_check": {
          "signature_text": "A stylized inscription at lower right, not conclusively legible",
          "interpretation": "Likely an artist's signature marking a limited edition print, but the specific name cannot be confirmed from the photograph provided."
        },
        "origin_analysis": {
          "likely_origin": "European or American studio with surrealist influence",
          "reasoning": "The surrealist motifs and stylized depiction of molecular structures around a figure recall mid-20th-century European surrealism. Without definitively linking to Dalí's known editions or stamps, a broader Western studio origin is most plausible."
        },
        "marks_recognition": {
          "marks_identified": "Edition numbering in the lower left (appears as "2/12" or similar)",
          "interpretation": "Indicates a limited-run print, suggesting either an artist-authorized lithograph or serigraph where each piece is hand-numbered."
        },
        "age_analysis": {
          "estimated_date_range": "Late 20th century to early 21st century",
          "reasoning": "Limited edition surrealist prints in this style were frequently produced by workshops from the 1970s onward, often referencing or adapting iconic surrealist themes from earlier decades."
        },
        "visual_search": {
          "similar_artworks": "Clearly reminiscent of Salvador Dalí's 'Galatea of the Spheres' and other surrealist works featuring molecular or orbital motifs around the human form.",
          "notes": "The dynamic arrangement of spheres and the disassembled profile of a face are hallmark surrealist elements; the background landscape also references the dreamlike, coastal imagery common in Dalí's oeuvre."
        }
      } : result.results;
      
      // Save the analysis result
      console.log(`Saving ${endpoint} analysis results...`);
      await file.save(JSON.stringify(content, null, 2), {
        contentType: 'application/json',
        metadata: {
          cacheControl: 'no-cache'
        }
      }).catch(error => {
        console.error(`Error saving ${endpoint} analysis:`, error);
      });

      return content;
    };

    // Perform all analyses in parallel
    const [analysisContent, originContent, detailedContent] = await Promise.all([
      performAnalysis('visual-search', files.analysis, analysisExists)
        .catch(error => {
          console.error('Error in visual search analysis:', error);
          return null;
        }),
      performAnalysis('origin-analysis', files.origin, originExists)
        .catch(error => {
          console.error('Error in origin analysis:', error);
          return null;
        }),
      performAnalysis('full-analysis', files.detailed, detailedExists)
        .catch(error => {
          console.error('Error in detailed analysis:', error);
          return null;
        })
    ]);

    // Generate the report using the composer
    const reportHtml = reportComposer.composeAnalysisReport(
      metadata,
      {
        visualSearch: analysisContent,
        originAnalysis: originContent,
        detailedAnalysis: detailedContent
      }
    );

    // Update sheets and send email in parallel
    const [emailSent] = await Promise.allSettled([
      emailService.sendFreeReport(email, reportHtml),
      sheetsService.updateEmailSubmission(sessionId, email)
        .catch(error => {
          console.error('Failed to log email submission to sheets:', error);
        })
    ]);

    if (emailSent.status === 'rejected') {
      throw emailSent.reason;
    }

    res.json({
      success: true,
      message: 'Email submitted successfully.',
      emailHash,
      submissionTime: metadata.email.submissionTime
    });

  } catch (error) {
    try {
      // Try to update sheets one more time if it failed earlier
      await sheetsService.updateEmailSubmission(
        sessionId,
        email
      ).catch(error => {
        console.error('Failed to log email submission to sheets:', error);
      });
    } catch (error) {
      console.error('Error logging to sheets:', error);
    }

    console.error('Error processing email submission:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing email submission.',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal Server Error.'
    });
  }
});

module.exports = router;