import { Router } from 'express';
import { updateStatus, updateStage } from '../controllers/procurement.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validateBody, updateStatusSchema } from '../middleware/validator.js';

const router = Router();

// Procurement Status Transitions (Admin / Center Officer Protected)
router.put('/status', authenticate, validateBody(updateStatusSchema), updateStatus);

// Stage progression (Inspection / Weighbridge / Lab Updates)
router.post('/stage', authenticate, updateStage);

export default router;
