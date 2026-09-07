import { notificationService } from '../services/notification.service.js';
import { query } from '../db/connection.js';

export function createNotification(req, res, next) {
  try {
    const notification = notificationService.sendNotification(req.validatedBody);
    res.status(201).json({
      success: true,
      message: 'Notification sent successfully',
      data: notification
    });
  } catch (err) {
    next(err);
  }
}

export function getNotifications(req, res, next) {
  try {
    const { farmerId, centerId, limit } = req.query;

    if (farmerId) {
      const list = notificationService.getFarmerNotifications(farmerId, limit ? Number(limit) : 20);
      return res.json({
        success: true,
        count: list.length,
        data: list
      });
    }

    if (centerId) {
      const list = query(
        `SELECT n.*, f.name as farmer_name, f.phone as farmer_phone, t.token_number
         FROM notifications n
         JOIN farmers f ON n.farmer_id = f.id
         LEFT JOIN tokens t ON n.token_id = t.id
         WHERE n.center_id = ?
         ORDER BY n.created_at DESC
         LIMIT ?`,
        [centerId, limit ? Number(limit) : 30]
      );
      return res.json({
        success: true,
        count: list.length,
        data: list
      });
    }

    // Default: recent 30 notifications
    const recent = query(
      `SELECT n.*, f.name as farmer_name, f.phone as farmer_phone, t.token_number
       FROM notifications n
       JOIN farmers f ON n.farmer_id = f.id
       LEFT JOIN tokens t ON n.token_id = t.id
       ORDER BY n.created_at DESC
       LIMIT ?`,
      [limit ? Number(limit) : 30]
    );

    res.json({
      success: true,
      count: recent.length,
      data: recent
    });
  } catch (err) {
    next(err);
  }
}

export function markAsRead(req, res, next) {
  try {
    const { id } = req.params;
    const ok = notificationService.markAsRead(Number(id));
    res.json({
      success: ok,
      message: ok ? 'Notification marked as read' : 'Notification not found'
    });
  } catch (err) {
    next(err);
  }
}

export default {
  createNotification,
  getNotifications,
  markAsRead
};
