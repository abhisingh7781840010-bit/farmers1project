import { Router } from 'express';
import { createToken, getStatus, getWaitingTime } from '../controllers/farmer.controller.js';
import { validateBody, createTokenSchema } from '../middleware/validator.js';

const router = Router();

// Farmer Token Generation & Real-time Status
router.post('/token', validateBody(createTokenSchema), createToken);
router.get('/status', getStatus);
router.get('/token/:tokenNumber', getStatus);
router.get('/queue-position/:tokenNumber', getStatus);
router.get('/waiting-time', getWaitingTime);

export default router;
