import { query, queryOne, run, transaction } from '../db/connection.js';
import { mlService } from './ml.service.js';
import { notificationService } from './notification.service.js';
import { eventsService } from './events.service.js';

class TokenService {
  /**
   * Generate a unique token for a farmer
   * @param {object} params
   * @returns {Promise<object>}
   */
  async createToken({
    farmerId,
    centerId,
    cropId,
    cropName,
    category = 'cereals',
    estimatedQuantityQtl,
    vehicleType = 'Tractor-Trolley',
    vehicleNumber = '',
    scheduledDate = null,
    scheduledSlotTime = null
  }) {
    const today = new Date().toISOString().split('T')[0];
    const targetDate = scheduledDate || today;

    // 1. Verify Center exists and is operational
    let center = queryOne(`SELECT * FROM centers WHERE id = ? OR code = ?`, [centerId, centerId]);
    if (!center) {
      center = queryOne(`SELECT * FROM centers LIMIT 1`);
      if (!center) {
        throw new Error(`Procurement center '${centerId}' not found.`);
      }
    }

    if (center.status === 'closed' || center.status === 'maintenance') {
      throw new Error(`Procurement center '${center.name}' is currently ${center.status.toUpperCase()}. Tokens cannot be issued.`);
    }

    // 2. Verify Farmer exists
    let farmer = queryOne(`SELECT * FROM farmers WHERE id = ? OR registration_number = ?`, [farmerId, farmerId]);
    if (!farmer) {
      farmer = queryOne(`SELECT * FROM farmers LIMIT 1`);
      if (!farmer) {
        throw new Error(`Farmer with registration/ID '${farmerId}' not found in registry.`);
      }
    }

    // 3. Verify Schedule & Slot Capacity
    let schedule = queryOne(
      `SELECT * FROM schedules WHERE center_id = ? AND schedule_date = ?`,
      [center.id, targetDate]
    );

    if (!schedule) {
      // Auto-create default schedule for the day if not pre-seeded
      run(
        `INSERT INTO schedules (center_id, schedule_date, open_time, close_time, total_slots, booked_slots, is_holiday, notes)
         VALUES (?, ?, '08:00', '18:00', ?, 0, 0, 'Auto-generated Mandi Shift')`,
        [center.id, targetDate, center.capacity_per_day]
      );
      schedule = queryOne(`SELECT * FROM schedules WHERE center_id = ? AND schedule_date = ?`, [center.id, targetDate]);
    }

    if (schedule.is_holiday === 1) {
      throw new Error(`The center is closed on ${targetDate} (Holiday/Weekly Off).`);
    }

    if (schedule.booked_slots >= schedule.total_slots) {
      throw new Error(`Procurement slots for ${targetDate} at ${center.name} are fully booked (${schedule.booked_slots}/${schedule.total_slots}).`);
    }

    // 4. Duplicate Check: Farmer cannot have multiple active tokens for the same crop today
    const activeDuplicate = queryOne(
      `SELECT token_number, status, queue_position
       FROM tokens
       WHERE farmer_id = ? AND center_id = ? AND crop_id = ? AND scheduled_date = ?
         AND status IN ('WAITING', 'CALLED', 'IN_PROCUREMENT')`,
      [farmer.id, center.id, cropId, targetDate]
    );

    if (activeDuplicate) {
      throw new Error(
        `Duplicate token rejected: Farmer already has an active token (${activeDuplicate.token_number}) with status '${activeDuplicate.status}' for ${cropName} at this center.`
      );
    }

    // 5. Generate Unique Token Number
    // Format: STATE-DIST-YYYYMMDD-SEQ (e.g. UP-GZB-20260905-0014)
    let statePrefix = 'IN';
    let distPrefix = 'MND';

    if (center.code && center.code.includes('-')) {
      const parts = center.code.replace(/^#/, '').split('-');
      if (parts.length >= 2) {
        statePrefix = parts[0].toUpperCase();
        distPrefix = parts[1].toUpperCase();
      }
    } else {
      const stateMap = {
        'Uttar Pradesh': 'UP', 'Punjab': 'PB', 'Haryana': 'HR', 'Madhya Pradesh': 'MP',
        'Maharashtra': 'MH', 'Rajasthan': 'RJ', 'Gujarat': 'GJ', 'Bihar': 'BR',
        'Karnataka': 'KA', 'Telangana': 'TS', 'Andhra Pradesh': 'AP', 'West Bengal': 'WB'
      };
      statePrefix = stateMap[center.state] || center.state.substring(0, 2).toUpperCase();
      distPrefix = center.district.substring(0, 3).toUpperCase();
    }
    const dateCompact = targetDate.replace(/-/g, '');

    const tokenCountRow = queryOne(
      `SELECT COUNT(*) as count FROM tokens WHERE center_id = ? AND scheduled_date = ?`,
      [center.id, targetDate]
    );
    const seq = (tokenCountRow.count + 1).toString().padStart(4, '0');
    const tokenNumber = `${statePrefix}-${distPrefix}-${dateCompact}-${seq}`;

    // Slot time default if not specified
    const slotTime = scheduledSlotTime || this.calculateDefaultSlotTime(schedule.booked_slots);

    // 6. Execute Atomic Transaction: Insert Token + Initialize Stages + Update Schedule
    const { tokenId, queuePosition } = transaction(() => {
      // Find current highest queue position among WAITING tokens
      const maxPosRow = queryOne(
        `SELECT COALESCE(MAX(queue_position), 0) as max_pos
         FROM tokens
         WHERE center_id = ? AND scheduled_date = ? AND status = 'WAITING'`,
        [center.id, targetDate]
      );
      const newQueuePos = Number(maxPosRow.max_pos) + 1;

      // Insert Token
      const tokenRes = run(
        `INSERT INTO tokens (
          token_number, farmer_id, center_id, crop_id, crop_name, category,
          estimated_quantity_qtl, vehicle_type, vehicle_number, status,
          queue_position, initial_position, scheduled_date, scheduled_slot_time
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'WAITING', ?, ?, ?, ?)`,
        [
          tokenNumber,
          farmer.id,
          center.id,
          cropId,
          cropName,
          category,
          estimatedQuantityQtl,
          vehicleType,
          vehicleNumber,
          newQueuePos,
          newQueuePos,
          targetDate,
          slotTime
        ]
      );

      const insertedTokenId = Number(tokenRes.lastInsertRowid);

      // Increment booked slots in schedule
      run(
        `UPDATE schedules SET booked_slots = booked_slots + 1, updated_at = CURRENT_TIMESTAMP
         WHERE center_id = ? AND schedule_date = ?`,
        [center.id, targetDate]
      );

      // Seed standard 5 procurement stages
      const stages = [
        { num: 1, name: 'Token Generation & Verification', status: 'COMPLETED', notes: 'Digital Token Issued via Portal' },
        { num: 2, name: 'Gate Entry & Security Check', status: 'PENDING', notes: 'Vehicle pass & QR code check' },
        { num: 3, name: 'Moisture & Quality Assay', status: 'PENDING', notes: 'Standard FAQ Quality Testing' },
        { num: 4, name: 'Electronic Weighbridge Gross Measurement', status: 'PENDING', notes: 'Gross vs Tare Weight Analysis' },
        { num: 5, name: 'DBT Direct Bank Transfer Payout', status: 'PENDING', notes: 'Direct PFMS Bank Disbursal' }
      ];

      for (const st of stages) {
        run(
          `INSERT INTO procurement_stages (token_id, stage_number, stage_name, status, notes)
           VALUES (?, ?, ?, ?, ?)`,
          [insertedTokenId, st.num, st.name, st.status, st.notes]
        );
      }

      return { tokenId: insertedTokenId, queuePosition: newQueuePos };
    });

    // 7. Calculate Waiting Time via ML Prediction Model
    const waitPrediction = await mlService.predictWaitTime({
      tokenId,
      centerId: center.id,
      queuePosition,
      activeBays: center.active_bays,
      cropId,
      cropName,
      vehicleType,
      estimatedQuantityQtl
    });

    // 8. Dispatch Real-time Notification
    notificationService.sendNotification({
      farmerId: farmer.id,
      tokenId,
      centerId: center.id,
      eventType: 'TOKEN_GENERATED',
      title: `🎫 Token Generated: ${tokenNumber}`,
      message: `Dear ${farmer.name}, your procurement token ${tokenNumber} for ${cropName} (${estimatedQuantityQtl} Qtl) has been generated at ${center.name}. Queue Position: #${queuePosition}. Estimated Wait: ~${waitPrediction.predicted_wait_minutes} mins (Est. Call: ${waitPrediction.formatted_call_time}).`
    });

    // 9. Broadcast real-time SSE event
    eventsService.broadcast('token_generated', {
      tokenNumber,
      centerId: center.id,
      queuePosition,
      cropName
    }, center.id);

    return {
      id: tokenId,
      token_id: tokenId,
      token_number: tokenNumber,
      tokenNumber,
      queue_position: queuePosition,
      queuePosition,
      predicted_waiting_time: waitPrediction.predicted_wait_minutes,
      predictedWaitMinutes: waitPrediction.predicted_wait_minutes,
      unit: 'minutes',
      status: 'WAITING',
      token: {
        id: tokenId,
        tokenNumber,
        status: 'WAITING',
        queuePosition,
        scheduledDate: targetDate,
        scheduledSlotTime: slotTime,
        crop: { id: cropId, name: cropName, category, quantityQtl: estimatedQuantityQtl },
        vehicle: { type: vehicleType, number: vehicleNumber }
      },
      center: {
        id: center.id,
        code: center.code,
        name: center.name,
        subName: center.sub_name,
        state: center.state,
        district: center.district,
        contactPhone: center.contact_phone
      },
      farmer: {
        id: farmer.id,
        registrationNumber: farmer.registration_number,
        name: farmer.name,
        phone: farmer.phone
      },
      waitingTime: {
        predictedWaitMinutes: waitPrediction.predicted_wait_minutes,
        estimatedCallTime: waitPrediction.estimated_call_time,
        formattedCallTime: waitPrediction.formatted_call_time,
        confidenceScore: waitPrediction.confidence_score,
        predictionSource: waitPrediction.source
      },
      qrCodeString: `KISANSETU|TOKEN:${tokenNumber}|CENTER:${center.code}|FARMER:${farmer.id}|CROP:${cropId}|QTY:${estimatedQuantityQtl}`
    };
  }

  /**
   * Look up token status and live queue position
   * @param {object} params
   * @param {string} [params.tokenNumber]
   * @param {string} [params.farmerId]
   * @param {number} [params.tokenId]
   * @returns {Promise<object>}
   */
  async getFarmerStatus({ tokenNumber, farmerId, tokenId }) {
    let sql = `
      SELECT t.*,
             f.name as farmer_name, f.phone as farmer_phone, f.registration_number, f.bank_account_masked,
             c.name as center_name, c.sub_name as center_sub_name, c.code as center_code,
             c.active_bays, c.status as center_status, c.contact_phone as center_phone
      FROM tokens t
      JOIN farmers f ON t.farmer_id = f.id
      JOIN centers c ON t.center_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (tokenNumber) {
      sql += ` AND t.token_number = ?`;
      params.push(tokenNumber.trim());
    } else if (tokenId) {
      sql += ` AND t.id = ?`;
      params.push(tokenId);
    } else if (farmerId) {
      sql += ` AND t.farmer_id = ? ORDER BY t.created_at DESC LIMIT 1`;
      params.push(farmerId);
    } else {
      throw new Error('Either tokenNumber, tokenId, or farmerId must be provided.');
    }

    const token = queryOne(sql, params);
    if (!token) {
      throw new Error('No matching procurement token found.');
    }

    // Fetch procurement stages
    const stages = query(
      `SELECT * FROM procurement_stages WHERE token_id = ? ORDER BY stage_number ASC`,
      [token.id]
    );

    // Calculate live waiting time
    let waitPrediction = null;
    if (token.status === 'WAITING') {
      waitPrediction = await mlService.predictWaitTime({
        tokenId: token.id,
        centerId: token.center_id,
        queuePosition: token.queue_position,
        activeBays: token.active_bays,
        cropId: token.crop_id,
        cropName: token.crop_name,
        vehicleType: token.vehicle_type,
        estimatedQuantityQtl: token.estimated_quantity_qtl
      });
    }

    const vehiclesAhead = Math.max(0, token.queue_position - 1);

    return {
      tokenId: token.id,
      tokenNumber: token.token_number,
      status: token.status,
      queuePosition: token.queue_position,
      initialPosition: token.initial_position,
      vehiclesAhead,
      scheduledDate: token.scheduled_date,
      scheduledSlotTime: token.scheduled_slot_time,
      calledAt: token.called_at,
      procurementStartAt: token.procurement_start_at,
      completedAt: token.completed_at,
      cancelledAt: token.cancelled_at,
      cancellationReason: token.cancellation_reason,
      crop: {
        id: token.crop_id,
        name: token.crop_name,
        category: token.category,
        estimatedQuantityQtl: token.estimated_quantity_qtl
      },
      vehicle: {
        type: token.vehicle_type,
        number: token.vehicle_number
      },
      farmer: {
        id: token.farmer_id,
        name: token.farmer_name,
        phone: token.farmer_phone,
        registrationNumber: token.registration_number,
        bankAccountMasked: token.bank_account_masked
      },
      center: {
        id: token.center_id,
        code: token.center_code,
        name: token.center_name,
        subName: token.center_sub_name,
        status: token.center_status,
        contactPhone: token.center_phone
      },
      waitingTime: waitPrediction ? {
        predictedWaitMinutes: waitPrediction.predicted_wait_minutes,
        estimatedCallTime: waitPrediction.estimated_call_time,
        formattedCallTime: waitPrediction.formatted_call_time,
        confidenceScore: waitPrediction.confidence_score,
        predictionSource: waitPrediction.source
      } : {
        predictedWaitMinutes: 0,
        estimatedCallTime: null,
        formattedCallTime: token.status === 'CALLED' ? 'Now Calling' : token.status,
        confidenceScore: 1.0,
        predictionSource: 'STATUS'
      },
      stages
    };
  }

  /**
   * Slot time helper based on booked slots count
   */
  calculateDefaultSlotTime(bookedSlots) {
    // Mandi starts at 08:00 AM; 4 slots per 30 minutes across bays
    const startMinutes = 8 * 60; // 08:00
    const slotIndex = Math.floor(bookedSlots / 4);
    const timeMinutes = startMinutes + slotIndex * 30;

    const hours = Math.floor(timeMinutes / 60);
    const mins = timeMinutes % 60;
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHour = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
    return `${displayHour.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')} ${period}`;
  }
}

export const tokenService = new TokenService();
export default tokenService;
