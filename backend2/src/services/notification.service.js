import { run, query, queryOne } from '../db/connection.js';
import { eventsService } from './events.service.js';

class NotificationService {
  /**
   * Dispatch and persist a notification to a farmer
   * @param {object} params
   * @param {string} params.farmerId
   * @param {number|null} [params.tokenId]
   * @param {string} params.centerId
   * @param {string} params.eventType
   * @param {string} params.title
   * @param {string} params.message
   * @param {string} [params.channel='SMS+IN_APP']
   * @returns {object}
   */
  sendNotification({ farmerId, tokenId = null, centerId, eventType, title, message, channel = 'SMS+IN_APP' }) {
    // 1. Persist to DB
    const res = run(
      `INSERT INTO notifications (farmer_id, token_id, center_id, event_type, title, message, channel, is_read, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)`,
      [farmerId, tokenId, centerId, eventType, title, message, channel]
    );

    const notificationId = Number(res.lastInsertRowid);
    const notification = {
      id: notificationId,
      farmerId,
      tokenId,
      centerId,
      eventType,
      title,
      message,
      channel,
      isRead: false,
      createdAt: new Date().toISOString()
    };

    // 2. Fetch Farmer details to log SMS
    const farmer = queryOne(`SELECT name, phone FROM farmers WHERE id = ?`, [farmerId]);
    const phone = farmer ? farmer.phone : 'N/A';

    // 3. Simulated SMS Gateway output
    console.log(`\n📱 [SMS DISPATCH] To: ${phone} (${farmer ? farmer.name : farmerId})`);
    console.log(`   Event: [${eventType}] ${title}`);
    console.log(`   Body: "${message}"`);
    console.log(`   Sent at: ${notification.createdAt}\n`);

    // 4. Real-time push via SSE
    eventsService.broadcast('notification_sent', notification, centerId);

    return notification;
  }

  /**
   * Get notifications for a specific farmer
   * @param {string} farmerId
   * @param {number} limit
   * @returns {Array}
   */
  getFarmerNotifications(farmerId, limit = 20) {
    return query(
      `SELECT n.*, c.name as center_name, t.token_number
       FROM notifications n
       LEFT JOIN centers c ON n.center_id = c.id
       LEFT JOIN tokens t ON n.token_id = t.id
       WHERE n.farmer_id = ?
       ORDER BY n.created_at DESC
       LIMIT ?`,
      [farmerId, limit]
    );
  }

  /**
   * Mark a notification as read
   * @param {number} notificationId
   * @returns {boolean}
   */
  markAsRead(notificationId) {
    const res = run(`UPDATE notifications SET is_read = 1 WHERE id = ?`, [notificationId]);
    return res.changes > 0;
  }

  /**
   * Helper to trigger automated notifications on queue events
   */
  notifyTurnApproaching(token, centerName) {
    return this.sendNotification({
      farmerId: token.farmer_id,
      tokenId: token.id,
      centerId: token.center_id,
      eventType: 'TURN_APPROACHING',
      title: '🚨 Your Turn is Approaching!',
      message: `Token ${token.token_number}: You are now at position #${token.queue_position} in the queue at ${centerName}. Please keep your vehicle and documents ready near Gate 1.`
    });
  }

  notifyFarmerCalled(token, centerName) {
    return this.sendNotification({
      farmerId: token.farmer_id,
      tokenId: token.id,
      centerId: token.center_id,
      eventType: 'FARMER_CALLED',
      title: '📢 Your Token has been Called!',
      message: `Token ${token.token_number}: Please proceed immediately to Security Gate 1 & Moisture Testing Lab at ${centerName}.`
    });
  }

  notifyProcurementStarted(token, centerName) {
    return this.sendNotification({
      farmerId: token.farmer_id,
      tokenId: token.id,
      centerId: token.center_id,
      eventType: 'PROCUREMENT_STARTED',
      title: '⚖️ Procurement & Weighbridge Started',
      message: `Token ${token.token_number}: Your crop (${token.crop_name}, ~${token.estimated_quantity_qtl} Qtl) is currently undergoing weighbridge gross measurement at ${centerName}.`
    });
  }

  notifyProcurementCompleted(token, centerName) {
    return this.sendNotification({
      farmerId: token.farmer_id,
      tokenId: token.id,
      centerId: token.center_id,
      eventType: 'PROCUREMENT_COMPLETED',
      title: '✅ Procurement Completed & DBT Initiated',
      message: `Token ${token.token_number}: Procurement for ${token.crop_name} is complete at ${centerName}. Digital receipt has been generated, and DBT payout has been forwarded to PFMS.`
    });
  }

  notifyProcurementCancelled(token, centerName, reason) {
    return this.sendNotification({
      farmerId: token.farmer_id,
      tokenId: token.id,
      centerId: token.center_id,
      eventType: 'PROCUREMENT_CANCELLED',
      title: '❌ Token Cancelled',
      message: `Token ${token.token_number} at ${centerName} has been cancelled. Reason: ${reason || 'Not specified'}.`
    });
  }
}

export const notificationService = new NotificationService();
export default notificationService;
