const express = require('express');
const router = express.Router();
const { updateStatus, getProcurementHistory } = require('../controllers/procurementController');
const { optionalAuth } = require('../middleware/authMiddleware');
const { validate, updateProcurementStatusSchema } = require('../middleware/validationMiddleware');

// Update Procurement Status (WAITING -> CALLED -> IN_PROGRESS -> COMPLETED)
router.put('/status', optionalAuth, validate(updateProcurementStatusSchema), updateStatus);

// View Procurement History
router.get('/history', optionalAuth, getProcurementHistory);

module.exports = router;
