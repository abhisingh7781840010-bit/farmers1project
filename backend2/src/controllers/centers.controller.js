import { query, queryOne, run } from '../db/connection.js';
import { queueService } from '../services/queue.service.js';
import { scheduleService } from '../services/schedule.service.js';

export async function getCenters(req, res, next) {
  try {
    const { state, district, status, crop } = req.query;
    let sql = `SELECT * FROM centers WHERE 1=1`;
    const params = [];

    if (state) {
      sql += ` AND state LIKE ?`;
      params.push(`%${state}%`);
    }
    if (district) {
      sql += ` AND district LIKE ?`;
      params.push(`%${district}%`);
    }
    if (status) {
      sql += ` AND status = ?`;
      params.push(status);
    }
    if (crop) {
      sql += ` AND supported_crops LIKE ?`;
      params.push(`%${crop}%`);
    }

    sql += ` ORDER BY name ASC`;
    const centers = query(sql, params).map(c => ({
      ...c,
      supported_crops: c.supported_crops ? JSON.parse(c.supported_crops) : []
    }));

    res.json({
      success: true,
      count: centers.length,
      data: centers
    });
  } catch (err) {
    next(err);
  }
}

export async function getCenterSchedule(req, res, next) {
  try {
    const { id } = req.params;
    const { startDate, days } = req.query;
    const scheduleData = scheduleService.getSchedule(id, startDate, days ? Number(days) : 7);
    res.json({
      success: true,
      data: scheduleData
    });
  } catch (err) {
    next(err);
  }
}

export async function getCenterQueue(req, res, next) {
  try {
    const { id } = req.params;
    const queueData = await queueService.getCenterQueue(id);
    res.json({
      success: true,
      data: queueData
    });
  } catch (err) {
    next(err);
  }
}

export async function getCenterAvailability(req, res, next) {
  try {
    const { id } = req.params;
    const { date } = req.query;
    const availabilityData = await scheduleService.getCenterAvailability(id, date);
    res.json({
      success: true,
      data: availabilityData
    });
  } catch (err) {
    next(err);
  }
}

export async function updateCenterSchedule(req, res, next) {
  try {
    const { id } = req.params;
    const updated = scheduleService.updateSchedule(id, req.validatedBody);
    res.json({
      success: true,
      message: 'Center schedule successfully updated',
      data: updated
    });
  } catch (err) {
    next(err);
  }
}

export async function updateCenterQueue(req, res, next) {
  try {
    const { id } = req.params;
    const { reorderList } = req.validatedBody;
    const updatedQueue = queueService.adminReorderQueue(id, reorderList);
    res.json({
      success: true,
      message: 'Center queue re-ordered successfully',
      data: {
        centerId: id,
        totalWaiting: updatedQueue.length,
        queue: updatedQueue
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function createCenter(req, res, next) {
  try {
    const {
      name,
      code,
      sub_name = '',
      state,
      district,
      address = '',
      lat = 28.6139,
      lng = 77.2090,
      status = 'open',
      capacity_per_day = 50,
      active_bays = 4,
      contact_phone = '+91-1800-180-1551',
      supported_crops = ['Wheat', 'Paddy (Common)']
    } = req.body;

    if (!name || !state || !district) {
      return res.status(400).json({
        success: false,
        error: 'name, state, and district are required fields'
      });
    }

    const id = 'mnd_' + Date.now();
    const centerCode = code || `#${state.substring(0, 2).toUpperCase()}-${Date.now().toString().slice(-4)}`;

    run(
      `INSERT INTO centers (id, code, name, sub_name, state, district, address, lat, lng, status, capacity_per_day, active_bays, contact_phone, supported_crops)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        centerCode,
        name,
        sub_name,
        state,
        district,
        address,
        Number(lat),
        Number(lng),
        status.toLowerCase(),
        Number(capacity_per_day),
        Number(active_bays),
        contact_phone,
        JSON.stringify(Array.isArray(supported_crops) ? supported_crops : [supported_crops])
      ]
    );

    const created = queryOne(`SELECT * FROM centers WHERE id = ?`, [id]);
    res.status(201).json({
      success: true,
      message: 'Procurement center created successfully',
      data: {
        ...created,
        supported_crops: JSON.parse(created.supported_crops || '[]')
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function updateCenter(req, res, next) {
  try {
    const { id } = req.params;
    const existing = queryOne(`SELECT * FROM centers WHERE id = ?`, [id]);
    if (!existing) {
      return res.status(404).json({ success: false, error: `Center '${id}' not found.` });
    }

    const {
      name = existing.name,
      sub_name = existing.sub_name,
      status = existing.status,
      capacity_per_day = existing.capacity_per_day,
      active_bays = existing.active_bays,
      contact_phone = existing.contact_phone,
      address = existing.address,
      supported_crops
    } = req.body;

    run(
      `UPDATE centers SET
        name = ?,
        sub_name = ?,
        status = ?,
        capacity_per_day = ?,
        active_bays = ?,
        contact_phone = ?,
        address = ?,
        supported_crops = ?,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        name,
        sub_name,
        status.toLowerCase(),
        Number(capacity_per_day),
        Number(active_bays),
        contact_phone,
        address,
        supported_crops ? JSON.stringify(Array.isArray(supported_crops) ? supported_crops : [supported_crops]) : existing.supported_crops,
        id
      ]
    );

    const updated = queryOne(`SELECT * FROM centers WHERE id = ?`, [id]);
    res.json({
      success: true,
      message: `Center '${name}' updated successfully`,
      data: {
        ...updated,
        supported_crops: JSON.parse(updated.supported_crops || '[]')
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteCenter(req, res, next) {
  try {
    const { id } = req.params;
    const existing = queryOne(`SELECT * FROM centers WHERE id = ?`, [id]);
    if (!existing) {
      return res.status(404).json({ success: false, error: `Center '${id}' not found.` });
    }

    run(`DELETE FROM centers WHERE id = ?`, [id]);

    res.json({
      success: true,
      message: `Center '${existing.name}' deleted successfully`
    });
  } catch (err) {
    next(err);
  }
}

export default {
  getCenters,
  getCenterSchedule,
  getCenterQueue,
  getCenterAvailability,
  updateCenterSchedule,
  updateCenterQueue,
  createCenter,
  updateCenter,
  deleteCenter
};

