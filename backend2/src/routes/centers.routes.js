import { Router } from 'express';
import {
  getCenters,
  getCenterSchedule,
  getCenterQueue,
  getCenterAvailability,
  updateCenterSchedule,
  updateCenterQueue,
  createCenter,
  updateCenter,
  deleteCenter
} from '../controllers/centers.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validateBody, updateScheduleSchema, adminReorderQueueSchema } from '../middleware/validator.js';

const router = Router();

// Public Centers APIs
router.get('/', getCenters);
router.get('/:id/schedule', getCenterSchedule);
router.get('/:id/queue', getCenterQueue);
router.get('/:id/availability', getCenterAvailability);

// Admin / Management Operations
router.post('/', createCenter);
router.put('/:id', updateCenter);
router.delete('/:id', deleteCenter);
router.put('/:id/schedule', authenticate, validateBody(updateScheduleSchema), updateCenterSchedule);
router.put('/:id/queue', authenticate, validateBody(adminReorderQueueSchema), updateCenterQueue);

export default router;
