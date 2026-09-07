import { Router } from 'express';
import { eventsService } from '../services/events.service.js';

const router = Router();

// GET /events or /api/v1/events - Server-Sent Events real-time event stream
router.get('/', (req, res) => {
  eventsService.addClient(req, res);
});

export default router;
