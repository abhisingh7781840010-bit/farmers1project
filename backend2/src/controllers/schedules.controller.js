import { query, queryOne, run } from '../db/connection.js';

// Ensure crop column exists in schedules table
try {
  run(`ALTER TABLE schedules ADD COLUMN crop TEXT DEFAULT 'Wheat'`);
} catch (e) {
  // Column already exists or table structure is preserved
}

/**
 * GET /api/v1/schedules
 * List all schedules across all centers or filtered by center/crop/date
 */
export function getAllSchedules(req, res, next) {
  try {
    const { center_id, crop, date } = req.query;
    let sql = `
      SELECT s.*, c.name as center_name, c.state, c.district
      FROM schedules s
      JOIN centers c ON s.center_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (center_id) {
      sql += ` AND s.center_id = ?`;
      params.push(center_id);
    }
    if (crop) {
      sql += ` AND (s.crop LIKE ? OR s.notes LIKE ?)`;
      params.push(`%${crop}%`, `%${crop}%`);
    }
    if (date) {
      sql += ` AND s.schedule_date = ?`;
      params.push(date);
    }

    sql += ` ORDER BY s.schedule_date ASC, s.open_time ASC`;
    const schedules = query(sql, params).map(s => ({
      ...s,
      crop: s.crop || 'Wheat',
      start_time: s.open_time,
      end_time: s.close_time
    }));

    res.json({
      success: true,
      count: schedules.length,
      data: schedules
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/schedules
 * Admin creates a new schedule
 */
export function createSchedule(req, res, next) {
  try {
    const {
      center_id,
      crop = 'Wheat',
      schedule_date,
      start_time = '08:00',
      end_time = '18:00',
      open_time = start_time,
      close_time = end_time,
      total_slots = 50,
      notes = ''
    } = req.body;

    if (!center_id || !schedule_date) {
      return res.status(400).json({
        success: false,
        error: 'center_id and schedule_date are required'
      });
    }

    // Verify center exists
    const center = queryOne(`SELECT id, name FROM centers WHERE id = ?`, [center_id]);
    if (!center) {
      return res.status(404).json({ success: false, error: `Center '${center_id}' not found.` });
    }

    // Upsert or insert schedule
    run(
      `INSERT INTO schedules (center_id, crop, schedule_date, open_time, close_time, total_slots, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(center_id, schedule_date) DO UPDATE SET
        crop = excluded.crop,
        open_time = excluded.open_time,
        close_time = excluded.close_time,
        total_slots = excluded.total_slots,
        notes = excluded.notes,
        updated_at = CURRENT_TIMESTAMP`,
      [center_id, crop, schedule_date, open_time, close_time, Number(total_slots), notes]
    );

    const created = queryOne(
      `SELECT s.*, c.name as center_name FROM schedules s JOIN centers c ON s.center_id = c.id WHERE s.center_id = ? AND s.schedule_date = ?`,
      [center_id, schedule_date]
    );

    res.status(201).json({
      success: true,
      message: `Procurement schedule created for ${crop} at ${center.name}`,
      data: {
        ...created,
        start_time: created.open_time,
        end_time: created.close_time
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/v1/schedules/:id
 * Admin edits a schedule
 */
export function updateSchedule(req, res, next) {
  try {
    const { id } = req.params;
    const existing = queryOne(`SELECT * FROM schedules WHERE id = ?`, [id]);
    if (!existing) {
      return res.status(404).json({ success: false, error: `Schedule #${id} not found.` });
    }

    const {
      crop = existing.crop,
      schedule_date = existing.schedule_date,
      start_time = existing.open_time,
      end_time = existing.close_time,
      total_slots = existing.total_slots,
      notes = existing.notes
    } = req.body;

    run(
      `UPDATE schedules SET
        crop = ?,
        schedule_date = ?,
        open_time = ?,
        close_time = ?,
        total_slots = ?,
        notes = ?,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [crop, schedule_date, start_time, end_time, Number(total_slots), notes, id]
    );

    const updated = queryOne(
      `SELECT s.*, c.name as center_name FROM schedules s JOIN centers c ON s.center_id = c.id WHERE s.id = ?`,
      [id]
    );

    res.json({
      success: true,
      message: `Schedule #${id} updated successfully`,
      data: {
        ...updated,
        start_time: updated.open_time,
        end_time: updated.close_time
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/v1/schedules/:id
 * Admin deletes a schedule
 */
export function deleteSchedule(req, res, next) {
  try {
    const { id } = req.params;
    const existing = queryOne(`SELECT * FROM schedules WHERE id = ?`, [id]);
    if (!existing) {
      return res.status(404).json({ success: false, error: `Schedule #${id} not found.` });
    }

    run(`DELETE FROM schedules WHERE id = ?`, [id]);

    res.json({
      success: true,
      message: `Schedule #${id} deleted successfully`
    });
  } catch (err) {
    next(err);
  }
}

export default {
  getAllSchedules,
  createSchedule,
  updateSchedule,
  deleteSchedule
};
