import { query, queryOne, run } from '../db/connection.js';
import { mlService } from './ml.service.js';
import { eventsService } from './events.service.js';

class ScheduleService {
  /**
   * Check whether a procurement center is available
   * Returns center status, queue length, available slots, and operating schedule
   * @param {string} centerId
   * @param {string} [date] YYYY-MM-DD
   */
  async getCenterAvailability(centerId, date = null) {
    const today = new Date().toISOString().split('T')[0];
    const targetDate = date || today;

    const center = queryOne(`SELECT * FROM centers WHERE id = ?`, [centerId]);
    if (!center) {
      throw new Error(`Procurement center '${centerId}' not found.`);
    }

    // Fetch or create schedule for the requested date
    let schedule = queryOne(
      `SELECT * FROM schedules WHERE center_id = ? AND schedule_date = ?`,
      [centerId, targetDate]
    );

    if (!schedule) {
      run(
        `INSERT INTO schedules (center_id, schedule_date, open_time, close_time, total_slots, booked_slots, is_holiday, notes)
         VALUES (?, ?, '08:00', '18:00', ?, 0, 0, 'Standard Operating Hours')`,
        [centerId, targetDate, center.capacity_per_day]
      );
      schedule = queryOne(`SELECT * FROM schedules WHERE center_id = ? AND schedule_date = ?`, [centerId, targetDate]);
    }

    // Count current active queue lengths
    const queueCounts = queryOne(
      `SELECT
         COUNT(CASE WHEN status = 'WAITING' THEN 1 END) as waiting_count,
         COUNT(CASE WHEN status = 'IN_PROCUREMENT' THEN 1 END) as in_procurement_count,
         COUNT(CASE WHEN status = 'CALLED' THEN 1 END) as called_count,
         COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed_count
       FROM tokens
       WHERE center_id = ? AND scheduled_date = ?`,
      [centerId, targetDate]
    );

    const waitingCount = queueCounts ? Number(queueCounts.waiting_count) : 0;
    const inProcurementCount = queueCounts ? Number(queueCounts.in_procurement_count) : 0;
    const calledCount = queueCounts ? Number(queueCounts.called_count) : 0;
    const completedCount = queueCounts ? Number(queueCounts.completed_count) : 0;

    const totalSlots = schedule.total_slots;
    const bookedSlots = schedule.booked_slots;
    const availableSlots = Math.max(0, totalSlots - bookedSlots);

    const isCenterOperational = center.status === 'open' || center.status === 'busy';
    const isAvailable = isCenterOperational && schedule.is_holiday === 0 && availableSlots > 0;

    // Estimate waiting time for a new incoming token
    const nextQueuePos = waitingCount + 1;
    const waitPrediction = await mlService.predictWaitTime({
      centerId,
      queuePosition: nextQueuePos,
      activeBays: center.active_bays
    });

    return {
      centerId: center.id,
      centerCode: center.code,
      centerName: center.name,
      subName: center.sub_name,
      state: center.state,
      district: center.district,
      centerStatus: center.status,
      isAvailable,
      unavailabilityReason: !isCenterOperational
        ? `Center is currently ${center.status.toUpperCase()}`
        : schedule.is_holiday === 1
          ? 'Center is marked as a Holiday for this date'
          : availableSlots === 0
            ? 'All procurement slots for this date are fully booked'
            : null,
      currentQueueLength: waitingCount,
      activeProcurementCount: inProcurementCount,
      calledCount,
      completedTodayCount: completedCount,
      activeBays: center.active_bays,
      availableProcurementSlots: availableSlots,
      totalProcurementSlots: totalSlots,
      bookedProcurementSlots: bookedSlots,
      currentOperatingSchedule: {
        date: schedule.schedule_date,
        openTime: schedule.open_time,
        closeTime: schedule.close_time,
        slotDurationMinutes: schedule.slot_duration_minutes,
        isHoliday: schedule.is_holiday === 1,
        notes: schedule.notes
      },
      estimatedWaitTimeForNewToken: {
        predictedWaitMinutes: waitPrediction.predicted_wait_minutes,
        estimatedCallTime: waitPrediction.estimated_call_time,
        formattedCallTime: waitPrediction.formatted_call_time
      }
    };
  }

  /**
   * Get procurement center schedule
   * @param {string} centerId
   * @param {string} [startDate]
   * @param {number} [days=7]
   */
  getSchedule(centerId, startDate = null, days = 7) {
    const today = startDate || new Date().toISOString().split('T')[0];

    const center = queryOne(`SELECT * FROM centers WHERE id = ?`, [centerId]);
    if (!center) {
      throw new Error(`Procurement center '${centerId}' not found.`);
    }

    const schedules = query(
      `SELECT * FROM schedules
       WHERE center_id = ? AND schedule_date >= ?
       ORDER BY schedule_date ASC
       LIMIT ?`,
      [centerId, today, days]
    );

    return {
      center: {
        id: center.id,
        code: center.code,
        name: center.name,
        subName: center.sub_name,
        capacityPerDay: center.capacity_per_day
      },
      schedules
    };
  }

  /**
   * Update center operating schedule
   * @param {string} centerId
   * @param {object} data
   */
  updateSchedule(centerId, { scheduleDate, openTime, closeTime, totalSlots, isHoliday, notes }) {
    const targetDate = scheduleDate || new Date().toISOString().split('T')[0];

    const center = queryOne(`SELECT * FROM centers WHERE id = ?`, [centerId]);
    if (!center) {
      throw new Error(`Center '${centerId}' not found.`);
    }

    let existing = queryOne(
      `SELECT * FROM schedules WHERE center_id = ? AND schedule_date = ?`,
      [centerId, targetDate]
    );

    if (!existing) {
      run(
        `INSERT INTO schedules (center_id, schedule_date, open_time, close_time, total_slots, booked_slots, is_holiday, notes)
         VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
        [
          centerId,
          targetDate,
          openTime || '08:00',
          closeTime || '18:00',
          totalSlots || center.capacity_per_day,
          isHoliday ? 1 : 0,
          notes || ''
        ]
      );
    } else {
      run(
        `UPDATE schedules
         SET open_time = COALESCE(?, open_time),
             close_time = COALESCE(?, close_time),
             total_slots = COALESCE(?, total_slots),
             is_holiday = COALESCE(?, is_holiday),
             notes = COALESCE(?, notes),
             updated_at = CURRENT_TIMESTAMP
         WHERE center_id = ? AND schedule_date = ?`,
        [
          openTime !== undefined ? openTime : null,
          closeTime !== undefined ? closeTime : null,
          totalSlots !== undefined ? totalSlots : null,
          isHoliday !== undefined ? (isHoliday ? 1 : 0) : null,
          notes !== undefined ? notes : null,
          centerId,
          targetDate
        ]
      );
    }

    const updated = queryOne(
      `SELECT * FROM schedules WHERE center_id = ? AND schedule_date = ?`,
      [centerId, targetDate]
    );

    eventsService.broadcast('schedule_updated', { centerId, schedule: updated }, centerId);

    return updated;
  }
}

export const scheduleService = new ScheduleService();
export default scheduleService;
