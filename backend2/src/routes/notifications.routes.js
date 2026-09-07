import { Router } from 'express';
import {
  createNotification,
  getNotifications,
  markAsRead
} from '../controllers/notifications.controller.js';
import { validateBody, sendNotificationSchema } from '../middleware/validator.js';

const router = Router();

// Dispatch notification (Can be invoked by system, admin, or external event)
router.post('/', validateBody(sendNotificationSchema), createNotification);

// Query notifications (by ?farmerId=... or ?centerId=...)
router.get('/', getNotifications);

// Mark as read
router.put('/:id/read', markAsRead);

export default router;
