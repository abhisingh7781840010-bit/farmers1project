import { query, queryOne, run, transaction } from '../db/connection.js';
import { mlService } from './ml.service.js';
import { notificationService } from './notification.service.js';
import { eventsService } from './events.service.js';

class QueueService {
  /**
   * Get the live queue for a procurement center
   * @param {string} centerId
   * @returns {Promise<object>}
   */
  async getCenterQueue(centerId) {
    const center = queryOne(`SELECT * FROM centers WHERE id = ?`, [centerId]);
    if (!center) {
      throw new Error(`Procurement center with ID '${centerId}' not found.`);
    }

    const today = new Date().toISOString().split('T')[0];

    // 1. Fetch tokens in all active states
    const activeTokens = query(
      `SELECT t.*, f.name as farmer_name, f.phone as farmer_phone, f.registration_number
       FROM tokens t
       JOIN farmers f ON t.farmer_id = f.id
       WHERE t.center_id = ? AND t.scheduled_date = ?
       ORDER BY
         CASE
           WHEN t.status = 'IN_PROCUREMENT' THEN 1
           WHEN t.status = 'CALLED' THEN 2
           WHEN t.status = 'WAITING' THEN 3
           ELSE 4
         END,
         t.queue_position ASC,
         t.created_at ASC`,
      [centerId, today]
    );

    const inProcurement = [];
    const called = [];
    const waiting = [];
    const completed = [];
    const cancelled = [];

    for (const t of activeTokens) {
      if (t.status === 'IN_PROCUREMENT') {
        // Fetch current stage
        const currentStage = queryOne(
          `SELECT * FROM procurement_stages WHERE token_id = ? AND status = 'IN_PROGRESS' ORDER BY stage_number ASC LIMIT 1`,
          [t.id]
        );
        inProcurement.push({ ...t, currentStage });
      } else if (t.status === 'CALLED') {
        called.push(t);
      } else if (t.status === 'WAITING') {
        // Estimate waiting time for waiting farmer
        const waitPrediction = await mlService.predictWaitTime({
          tokenId: t.id,
          centerId: t.center_id,
          queuePosition: t.queue_position,
          activeBays: center.active_bays,
          cropId: t.crop_id,
          cropName: t.crop_name,
          vehicleType: t.vehicle_type,
          estimatedQuantityQtl: t.estimated_quantity_qtl
        });

        waiting.push({
          ...t,
          predictedWaitMinutes: waitPrediction.predicted_wait_minutes,
          estimatedCallTime: waitPrediction.estimated_call_time,
          formattedCallTime: waitPrediction.formatted_call_time
        });
      } else if (t.status === 'COMPLETED') {
        completed.push(t);
      } else if (t.status === 'CANCELLED') {
        cancelled.push(t);
      }
    }

    // Calculate center queue metrics
    const totalWaiting = waiting.length;
    const avgWaitMinutes = waiting.length > 0
      ? Math.round(waiting.reduce((sum, w) => sum + (w.predictedWaitMinutes || 0), 0) / waiting.length)
      : 0;

    return {
      center: {
        id: center.id,
        code: center.code,
        name: center.name,
        subName: center.sub_name,
        status: center.status,
        activeBays: center.active_bays,
        capacityPerDay: center.capacity_per_day
      },
      summary: {
        totalWaiting,
        inProcurementCount: inProcurement.length,
        calledCount: called.length,
        completedToday: completed.length,
        cancelledToday: cancelled.length,
        avgWaitMinutes,
        activeBaysInUse: inProcurement.length
      },
      queue: {
        inProcurement,
        called,
        waiting,
        completed: completed.slice(0, 10), // return last 10 completed
        cancelled: cancelled.slice(0, 5)
      }
    };
  }

  /**
   * Atomically re-indexes the WAITING queue for a center
   * Ensures contiguous 1, 2, 3... positions and fires approaching turn notifications
   * @param {string} centerId
   * @returns {Array} Updated waiting tokens
   */
  reorderQueue(centerId) {
    const today = new Date().toISOString().split('T')[0];
    const center = queryOne(`SELECT name FROM centers WHERE id = ?`, [centerId]);
    const centerName = center ? center.name : centerId;

    return transaction(() => {
      // 1. Fetch all tokens currently marked WAITING, sorted by arrival time
      const waitingTokens = query(
        `SELECT * FROM tokens
         WHERE center_id = ? AND scheduled_date = ? AND status = 'WAITING'
         ORDER BY created_at ASC, id ASC`,
        [centerId, today]
      );

      const updated = [];

      for (let i = 0; i < waitingTokens.length; i++) {
        const token = waitingTokens[i];
        const newPosition = i + 1;
        const oldPosition = token.queue_position;

        if (oldPosition !== newPosition) {
          run(`UPDATE tokens SET queue_position = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [newPosition, token.id]);
          token.queue_position = newPosition;

          // Check if farmer's turn is approaching (e.g. entered top 3)
          if (newPosition <= 3 && (oldPosition > 3 || oldPosition === 0)) {
            notificationService.notifyTurnApproaching(token, centerName);
          }
        }

        updated.push(token);
      }

      // Ensure any non-waiting tokens have queue_position = 0
      run(
        `UPDATE tokens SET queue_position = 0
         WHERE center_id = ? AND scheduled_date = ? AND status != 'WAITING' AND queue_position != 0`,
        [centerId, today]
      );

      // Broadcast queue change event to connected UI clients
      eventsService.broadcast('queue_updated', { centerId, totalWaiting: updated.length }, centerId);

      return updated;
    });
  }

  /**
   * Manually re-order or adjust queue priority (Admin operation)
   * @param {string} centerId
   * @param {Array<{tokenId: number, newPosition: number}>} reorderList
   */
  adminReorderQueue(centerId, reorderList) {
    return transaction(() => {
      for (const item of reorderList) {
        run(
          `UPDATE tokens SET queue_position = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND center_id = ? AND status = 'WAITING'`,
          [item.newPosition, item.tokenId, centerId]
        );
      }
      return this.reorderQueue(centerId);
    });
  }
}

export const queueService = new QueueService();
export default queueService;
