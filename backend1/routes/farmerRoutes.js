const express = require('express');
const router = express.Router();
const {
  generateToken,
  getFarmerStatus,
  cancelToken
} = require('../controllers/tokenController');
const { validate, generateTokenSchema } = require('../middleware/validationMiddleware');

// Farmer Token Generation
router.post('/token', validate(generateTokenSchema), generateToken);

// Farmer Queue Status
router.get('/status/:farmerId', getFarmerStatus);
router.get('/token/:farmerId', getFarmerStatus);
router.get('/queue/:farmerId', getFarmerStatus);

// Cancel active token
router.post('/token/cancel', cancelToken);

module.exports = router;
