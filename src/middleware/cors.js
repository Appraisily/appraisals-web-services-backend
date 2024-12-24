const cors = require('cors');

const corsMiddleware = cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    
    if (
      origin.includes('.webcontainer-api.io') ||
      origin.includes('localhost') ||
      origin.includes('127.0.0.1')
      origin.includes('.run.app') ||
      origin.includes('stackblitz.io')
    ) {
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