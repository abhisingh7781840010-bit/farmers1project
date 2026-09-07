const express = require('express');
const router = express.Router();
const { getCenterSchedule, updateCenterSchedule } = require('../controllers/scheduleController');
const { optionalAuth } = require('../middleware/authMiddleware');
const { validate, updateScheduleSchema } = require('../middleware/validationMiddleware');

router.get('/:id', getCenterSchedule);
router.put('/:id', optionalAuth, validate(updateScheduleSchema), updateCenterSchedule);

module.exports = router;
