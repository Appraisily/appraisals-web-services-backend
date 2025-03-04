const express = require('express');
const { processVisualSearch } = require('../controllers/visualSearchController');
const { body } = require('express-validator');
const { validate } = require('../../../middleware/validation');

const router = express.Router();

router.post('/visual-search', [
  body('sessionId')
    .notEmpty()
    .withMessage('Session ID is required')
    .isString()
    .withMessage('Session ID must be a string'),
  validate
], processVisualSearch);

module.exports = router;