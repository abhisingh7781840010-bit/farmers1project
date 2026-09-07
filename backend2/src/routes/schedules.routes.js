import { Router } from 'express';
import {
  getAllSchedules,
  createSchedule,
  updateSchedule,
  deleteSchedule
} from '../controllers/schedules.controller.js';

const router = Router();

// Schedule Endpoints
router.get('/', getAllSchedules);
router.post('/', createSchedule);
router.put('/:id', updateSchedule);
router.delete('/:id', deleteSchedule);

export default router;
