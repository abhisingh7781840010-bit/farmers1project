import { Router } from 'express';
import { mlService } from '../services/ml.service.js';
import { validateBody, predictWaitTimeSchema } from '../middleware/validator.js';
import { query } from '../db/connection.js';

const router = Router();

// Test or query ML waiting time model directly
router.post('/predict', validateBody(predictWaitTimeSchema), async (req, res, next) => {
  try {
    const result = await mlService.predictWaitTime(req.validatedBody);
    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
});

// ML historical logs & status
router.get('/history', (req, res) => {
  const { limit = 20 } = req.query;
  const history = query(
    `SELECT p.*, c.name as center_name
     FROM waiting_time_predictions p
     JOIN centers c ON p.center_id = c.id
     ORDER BY p.created_at DESC
     LIMIT ?`,
    [Number(limit)]
  ).map(row => ({
    ...row,
    features_json: row.features_json ? JSON.parse(row.features_json) : null
  }));

  res.json({
    success: true,
    count: history.length,
    data: history
  });
});

export default router;
