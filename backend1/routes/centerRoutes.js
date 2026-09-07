const express = require('express');
const router = express.Router();
const {
  getCenters,
  getCenterById,
  getCenterAvailability,
  getCenterQueue,
  getCenterSchedule,
  createCenter
} = require('../controllers/centerController');
const { updateCenterSchedule } = require('../controllers/scheduleController');
const { generateToken } = require('../controllers/tokenController');
const { optionalAuth, authorize } = require('../middleware/authMiddleware');
const { validate, createCenterSchema, updateScheduleSchema, generateTokenSchema } = require('../middleware/validationMiddleware');

// Public Center APIs
router.get('/', getCenters);
router.get('/:id', getCenterById);
router.get('/:id/schedule', getCenterSchedule);
router.get('/:id/queue', getCenterQueue);
router.get('/:id/availability', getCenterAvailability);

// Expose token generation also via /centers/:id/queue and /centers/:id/token
router.post(
  '/:id/queue',
  (req, res, next) => {
    req.body.centerId = req.body.centerId || req.params.id;
    next();
  },
  validate(generateTokenSchema),
  generateToken
);

router.post(
  '/:id/token',
  (req, res, next) => {
    req.body.centerId = req.body.centerId || req.params.id;
    next();
  },
  validate(generateTokenSchema),
  generateToken
);

// Admin / Staff Management APIs
router.post('/', optionalAuth, validate(createCenterSchema), createCenter);
router.put('/:id/schedule', optionalAuth, validate(updateScheduleSchema), updateCenterSchedule);

module.exports = router;

