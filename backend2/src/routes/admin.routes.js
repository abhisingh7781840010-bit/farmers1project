import { Router } from 'express';
import { getDailyStatistics, getFarmers, getFullQueue } from '../controllers/admin.controller.js';

const router = Router();

// Admin Statistics & Overview (Public/Admin accessible for dashboard display)
router.get('/statistics', getDailyStatistics);
router.get('/farmers', getFarmers);
router.get('/queue', getFullQueue);

export default router;
