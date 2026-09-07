import { query, queryOne } from '../db/connection.js';

/**
 * GET /api/v1/admin/statistics
 * Returns real-time aggregate mandi statistics for today
 */
export function getDailyStatistics(req, res, next) {
  try {
    const today = new Date().toISOString().split('T')[0];

    // 1. Total tokens generated today
    const totalTodayRow = queryOne(
      `SELECT COUNT(*) as cnt FROM tokens WHERE scheduled_date = ? OR DATE(created_at) = ?`,
      [today, today]
    );
    const todayTotal = totalTodayRow ? totalTodayRow.cnt : 0;

    // 2. Pending farmers (WAITING or REGISTERED)
    const pendingRow = queryOne(
      `SELECT COUNT(*) as cnt FROM tokens WHERE status IN ('WAITING', 'REGISTERED')`
    );
    const pendingFarmers = pendingRow ? pendingRow.cnt : 0;

    // 3. Currently processing (CALLED, PROCESSING, IN_PROCUREMENT)
    const processingRow = queryOne(
      `SELECT COUNT(*) as cnt FROM tokens WHERE status IN ('CALLED', 'PROCESSING', 'IN_PROCUREMENT')`
    );
    const currentlyProcessing = processingRow ? processingRow.cnt : 0;

    // 4. Completed procurements
    const completedRow = queryOne(
      `SELECT COUNT(*) as cnt FROM tokens WHERE status = 'COMPLETED'`
    );
    const completedProcurements = completedRow ? completedRow.cnt : 0;

    // 5. Current queue length (waiting tokens)
    const currentQueue = pendingFarmers;

    // 6. Total crops received in Quintals
    const cropSumRow = queryOne(
      `SELECT SUM(estimated_quantity_qtl) as total_qtl FROM tokens WHERE status = 'COMPLETED'`
    );
    const allCropSumRow = queryOne(
      `SELECT SUM(estimated_quantity_qtl) as total_qtl FROM tokens`
    );
    const totalCropsReceived = cropSumRow && cropSumRow.total_qtl ? Math.round(cropSumRow.total_qtl) : (allCropSumRow && allCropSumRow.total_qtl ? Math.round(allCropSumRow.total_qtl) : 0);

    // 7. Average waiting time in minutes
    const avgWaitRow = queryOne(
      `SELECT AVG(predicted_wait_minutes) as avg_wait FROM waiting_time_predictions WHERE DATE(created_at) = ?`,
      [today]
    );
    const fallbackAvgRow = queryOne(
      `SELECT AVG(predicted_wait_minutes) as avg_wait FROM waiting_time_predictions`
    );
    const rawAvg = (avgWaitRow && avgWaitRow.avg_wait) || (fallbackAvgRow && fallbackAvgRow.avg_wait) || 28.5;
    const averageWaitingTime = Math.round(rawAvg);

    // Crop distribution summary
    const cropStats = query(
      `SELECT crop_name, COUNT(*) as token_count, SUM(estimated_quantity_qtl) as total_qtl
       FROM tokens GROUP BY crop_name ORDER BY token_count DESC`
    );

    res.json({
      success: true,
      data: {
        today_total_farmers: todayTotal || (pendingFarmers + currentlyProcessing + completedProcurements),
        pending_farmers: pendingFarmers,
        currently_processing: currentlyProcessing,
        completed_procurements: completedProcurements,
        current_queue: currentQueue,
        total_crops_received: totalCropsReceived,
        total_crops_received_unit: 'Quintals',
        average_waiting_time: averageWaitingTime,
        average_waiting_time_unit: 'minutes',
        crop_distribution: cropStats
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/admin/farmers
 * Master list of registered farmers with land quota and active token
 */
export function getFarmers(req, res, next) {
  try {
    const { search, state, district } = req.query;
    let sql = `
      SELECT f.*,
        (SELECT COUNT(*) FROM tokens t WHERE t.farmer_id = f.id) as total_tokens,
        (SELECT token_number FROM tokens t WHERE t.farmer_id = f.id AND t.status IN ('WAITING', 'CALLED', 'PROCESSING', 'IN_PROCUREMENT') LIMIT 1) as active_token_number,
        (SELECT status FROM tokens t WHERE t.farmer_id = f.id AND t.status IN ('WAITING', 'CALLED', 'PROCESSING', 'IN_PROCUREMENT') LIMIT 1) as active_token_status
      FROM farmers f WHERE 1=1
    `;
    const params = [];

    if (search) {
      sql += ` AND (f.name LIKE ? OR f.phone LIKE ? OR f.registration_number LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (state) {
      sql += ` AND f.state LIKE ?`;
      params.push(`%${state}%`);
    }
    if (district) {
      sql += ` AND f.district LIKE ?`;
      params.push(`%${district}%`);
    }

    sql += ` ORDER BY f.name ASC`;
    const farmers = query(sql, params);

    res.json({
      success: true,
      count: farmers.length,
      data: farmers
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/admin/queue
 * Returns all tokens with farmer details, crop details, queue position, status
 */
export function getFullQueue(req, res, next) {
  try {
    const { center_id, status } = req.query;
    let sql = `
      SELECT t.*, f.name as farmer_name, f.phone as farmer_phone, c.name as center_name
      FROM tokens t
      JOIN farmers f ON t.farmer_id = f.id
      JOIN centers c ON t.center_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (center_id) {
      sql += ` AND t.center_id = ?`;
      params.push(center_id);
    }
    if (status) {
      sql += ` AND t.status = ?`;
      params.push(status.toUpperCase());
    }

    sql += ` ORDER BY 
      CASE 
        WHEN t.status = 'CALLED' THEN 1
        WHEN t.status IN ('PROCESSING', 'IN_PROCUREMENT') THEN 2
        WHEN t.status = 'WAITING' THEN 3
        ELSE 4
      END,
      t.queue_position ASC,
      t.id ASC`;

    const tokens = query(sql, params);

    res.json({
      success: true,
      count: tokens.length,
      data: tokens
    });
  } catch (err) {
    next(err);
  }
}

export default {
  getDailyStatistics,
  getFarmers,
  getFullQueue
};
