const cors = require('cors');

const corsMiddleware = cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    
    const allowedDomains = [
      '.webcontainer-api.io',
      'localhost',
      '127.0.0.1',
      '.run.app',
      'stackblitz.io',
      'stackblitz.com',
      'appraisily.com'
    ];
    
    if (allowedDomains.some(domain => origin.includes(domain))) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
});

module.exports = corsMiddleware;