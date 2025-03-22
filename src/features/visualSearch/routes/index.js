const express = require('express');
const { processVisualSearch } = require('../controllers/visualSearchController');

const router = express.Router();

router.post('/visual-search', processVisualSearch);

module.exports = router;