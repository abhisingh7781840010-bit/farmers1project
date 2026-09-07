import { queryOne, run, transaction, query } from '../db/connection.js';
import { queueService } from './queue.service.js';
import { notificationService } from './notification.service.js';
import { eventsService } from './events.service.js';

class ProcurementService {
  /**
   * Allowed state transitions map
   */
  static VALID_TRANSITIONS = {
    REGISTERED: ['WAITING', 'CANCELLED'],
    WAITING: ['CALLED', 'PROCESSING', 'IN_PROCUREMENT', 'CANCELLED'],
    CALLED: ['PROCESSING', 'IN_PROCUREMENT', 'ACCEPTED', 'COMPLETED', 'CANCELLED', 'WAITING'],
    PROCESSING: ['ACCEPTED', 'COMPLETED', 'CANCELLED'],
    IN_PROCUREMENT: ['ACCEPTED', 'PROCESSING', 'COMPLETED', 'CANCELLED'],
    ACCEPTED: ['COMPLETED', 'CANCELLED'],
    COMPLETED: [],
    CANCELLED: []
  };

  /**
   * Update procurement status for a farmer token
   * @param {object} params
   * @param {number|string} params.tokenId Token ID or Token Number
   * @param {string} params.newStatus
   * @param {string} [params.reason]
   * @param {string} [params.inspectorName]
   * @returns {object} Updated token and queue state
   */
  updateStatus({ tokenId, newStatus, reason = '', inspectorName = 'Center Officer' }) {
    let targetStatus = newStatus.toUpperCase();
    if (targetStatus === 'IN_PROGRESS') targetStatus = 'PROCESSING';

    // 1. Fetch current token
    let token = queryOne(
      `SELECT t.*, c.name as center_name, c.active_bays, f.name as farmer_name, f.phone as farmer_phone
       FROM tokens t
       JOIN centers c ON t.center_id = c.id
       JOIN farmers f ON t.farmer_id = f.id
       WHERE t.id = ? OR t.token_number = ?`,
      [tokenId, tokenId]
    );

    if (!token) {
      throw new Error(`Token '${tokenId}' not found.`);
    }

    const currentStatus = token.status;

    // Check idempotency (if already in target state)
    if (currentStatus === targetStatus) {
      return { token, message: `Token is already in status '${targetStatus}'.` };
    }

    // 2. Validate state transition
    const allowed = ProcurementService.VALID_TRANSITIONS[currentStatus] || [];
    const isEquivalent = (currentStatus === 'IN_PROCUREMENT' && (targetStatus === 'PROCESSING' || targetStatus === 'ACCEPTED'));
    if (!allowed.includes(targetStatus) && !isEquivalent) {
      throw new Error(
        `Invalid status transition: Cannot transition from '${currentStatus}' to '${targetStatus}'. Allowed transitions: [${allowed.join(', ')}]`
      );
    }

    const centerId = token.center_id;
    const centerName = token.center_name;

    // 3. Perform atomic state update and queue re-ordering
    const result = transaction(() => {
      let dbStatus = targetStatus;
      if (dbStatus === 'PROCESSING' || dbStatus === 'ACCEPTED') dbStatus = 'IN_PROCUREMENT';
      if (dbStatus === 'REGISTERED') dbStatus = 'WAITING';

      let updateSql = `UPDATE tokens SET status = ?, updated_at = CURRENT_TIMESTAMP`;
      const updateParams = [dbStatus];

      if (targetStatus === 'CALLED') {
        updateSql += `, called_at = CURRENT_TIMESTAMP, queue_position = 0`;
      } else if (targetStatus === 'IN_PROCUREMENT' || targetStatus === 'PROCESSING') {
        updateSql += `, procurement_start_at = CURRENT_TIMESTAMP, queue_position = 0`;
      } else if (targetStatus === 'ACCEPTED') {
        updateSql += `, queue_position = 0`;
      } else if (targetStatus === 'COMPLETED') {
        updateSql += `, completed_at = CURRENT_TIMESTAMP, queue_position = 0`;
      } else if (targetStatus === 'CANCELLED') {
        updateSql += `, cancelled_at = CURRENT_TIMESTAMP, queue_position = 0, cancellation_reason = ?`;
        updateParams.push(reason);
      }

      updateSql += ` WHERE id = ?`;
      updateParams.push(token.id);

      run(updateSql, updateParams);

      // Advance/update procurement stages
      this.syncProcurementStages(token.id, targetStatus, inspectorName, reason);

      // Re-index remaining WAITING tokens
      const updatedQueue = queueService.reorderQueue(centerId);

      // Fetch refreshed token
      const refreshedToken = queryOne(`SELECT * FROM tokens WHERE id = ?`, [token.id]);
      if (refreshedToken) {
        refreshedToken.status = targetStatus;
        refreshedToken.procurement_status = targetStatus;
      }

      return { refreshedToken, updatedQueue };
    });

    const updatedToken = result.refreshedToken;

    // 4. Trigger Domain Event Notifications
    if (targetStatus === 'CALLED') {
      notificationService.notifyFarmerCalled(updatedToken, centerName);
      eventsService.broadcast('farmer_called', { token: updatedToken }, centerId);
    } else if (targetStatus === 'IN_PROCUREMENT' || targetStatus === 'PROCESSING') {
      notificationService.notifyProcurementStarted(updatedToken, centerName);
      eventsService.broadcast('procurement_started', { token: updatedToken }, centerId);
    } else if (targetStatus === 'ACCEPTED') {
      eventsService.broadcast('procurement_accepted', { token: updatedToken }, centerId);
    } else if (targetStatus === 'COMPLETED') {
      notificationService.notifyProcurementCompleted(updatedToken, centerName);
      eventsService.broadcast('procurement_completed', { token: updatedToken }, centerId);
    } else if (targetStatus === 'CANCELLED') {
      notificationService.notifyProcurementCancelled(updatedToken, centerName, reason);
      eventsService.broadcast('procurement_cancelled', { token: updatedToken, reason }, centerId);
    }

    return {
      success: true,
      token: updatedToken,
      previousStatus: currentStatus,
      newStatus: targetStatus,
      remainingWaitingCount: result.updatedQueue.length
    };
  }

  /**
   * Synchronize procurement stages based on token status
   */
  syncProcurementStages(tokenId, targetStatus, inspectorName, notes) {
    if (targetStatus === 'CALLED') {
      // Stage 2: Gate Entry -> IN_PROGRESS
      run(
        `UPDATE procurement_stages SET status = 'IN_PROGRESS', inspector_name = ?, updated_at = CURRENT_TIMESTAMP
         WHERE token_id = ? AND stage_number = 2`,
        [inspectorName, tokenId]
      );
    } else if (targetStatus === 'IN_PROCUREMENT' || targetStatus === 'PROCESSING') {
      // Stage 2: Gate Entry -> PASSED
      run(
        `UPDATE procurement_stages SET status = 'PASSED', updated_at = CURRENT_TIMESTAMP
         WHERE token_id = ? AND stage_number = 2`,
        [tokenId]
      );
      // Stage 3: Moisture -> IN_PROGRESS
      run(
        `UPDATE procurement_stages SET status = 'IN_PROGRESS', inspector_name = ?, updated_at = CURRENT_TIMESTAMP
         WHERE token_id = ? AND stage_number = 3`,
        [inspectorName, tokenId]
      );
      run(
        `UPDATE procurement_stages SET status = 'IN_PROGRESS', updated_at = CURRENT_TIMESTAMP
         WHERE token_id = ? AND stage_number = 4`,
        [tokenId]
      );
    } else if (targetStatus === 'ACCEPTED') {
      // Stage 2 & 3: PASSED
      run(
        `UPDATE procurement_stages SET status = 'PASSED', updated_at = CURRENT_TIMESTAMP
         WHERE token_id = ? AND stage_number IN (2, 3)`,
        [tokenId]
      );
      run(
        `UPDATE procurement_stages SET status = 'PASSED', updated_at = CURRENT_TIMESTAMP
         WHERE token_id = ? AND stage_number = 4`,
        [tokenId]
      );
    } else if (targetStatus === 'COMPLETED') {
      // Mark all stages COMPLETED / PASSED
      run(
        `UPDATE procurement_stages
         SET status = CASE
           WHEN stage_number IN (2, 3) THEN 'PASSED'
           ELSE 'COMPLETED'
         END,
         updated_at = CURRENT_TIMESTAMP
         WHERE token_id = ?`,
        [tokenId]
      );
    } else if (targetStatus === 'CANCELLED') {
      run(
        `UPDATE procurement_stages SET status = 'FAILED', notes = ?, updated_at = CURRENT_TIMESTAMP
         WHERE token_id = ? AND status IN ('PENDING', 'IN_PROGRESS')`,
        [`Cancelled: ${notes}`, tokenId]
      );
    }
  }

  /**
   * Update a specific procurement stage (e.g. Moisture testing lab result or Weighbridge readout)
   */
  updateStage({ tokenId, stageNumber, status, notes = '', inspectorName = 'Lab Technician' }) {
    const validStatuses = ['PENDING', 'IN_PROGRESS', 'PASSED', 'FAILED', 'COMPLETED'];
    if (!validStatuses.includes(status.toUpperCase())) {
      throw new Error(`Invalid stage status '${status}'. Must be one of [${validStatuses.join(', ')}]`);
    }

    const stage = queryOne(
      `SELECT * FROM procurement_stages WHERE token_id = ? AND stage_number = ?`,
      [tokenId, stageNumber]
    );

    if (!stage) {
      throw new Error(`Stage #${stageNumber} for token ID ${tokenId} not found.`);
    }

    run(
      `UPDATE procurement_stages
       SET status = ?, notes = ?, inspector_name = ?, updated_at = CURRENT_TIMESTAMP
       WHERE token_id = ? AND stage_number = ?`,
      [status.toUpperCase(), notes, inspectorName, tokenId, stageNumber]
    );

    const updatedStage = queryOne(
      `SELECT * FROM procurement_stages WHERE token_id = ? AND stage_number = ?`,
      [tokenId, stageNumber]
    );

    eventsService.broadcast('stage_updated', { tokenId, stage: updatedStage });

    return updatedStage;
  }
}

export const procurementService = new ProcurementService();
export default procurementService;
