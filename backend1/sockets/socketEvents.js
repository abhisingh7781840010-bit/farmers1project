const { getIO } = require('./socketManager');
const logger = require('../utils/logger');

/**
 * Socket.IO Real-time Notification Dispatcher
 */
class SocketEvents {
  /**
   * Helper to emit to a room or globally
   */
  static emitEvent(room, eventName, payload) {
    const io = getIO();
    if (!io) return;

    if (room) {
      io.to(room).emit(eventName, payload);
      logger.info(`Socket event [${eventName}] emitted to room [${room}]`);
    } else {
      io.emit(eventName, payload);
      logger.info(`Socket event [${eventName}] broadcasted to all clients`);
    }
  }

  /**
   * 1. Token Generated notification
   * Emitted to farmer's room and center's room
   */
  static emitTokenGenerated(token) {
    const payload = {
      event: 'TOKEN_GENERATED',
      timestamp: new Date(),
      data: {
        tokenNumber: token.tokenNumber,
        farmerId: token.farmerId,
        centerId: token.centerId,
        crop: token.crop,
        queuePosition: token.queuePosition,
        estimatedWaitingTime: token.estimatedWaitingTime,
        status: token.status
      }
    };

    this.emitEvent(`farmer:${token.farmerId}`, 'token_generated', payload);
    this.emitEvent(`center:${token.centerId}`, 'token_generated', payload);
  }

  /**
   * 2. Farmer's Turn Approaching notification (when position <= 2)
   */
  static emitTurnApproaching(token) {
    const payload = {
      event: 'TURN_APPROACHING',
      timestamp: new Date(),
      message: `Your turn is approaching! Current queue position: ${token.queuePosition}. Please move closer to the counter area.`,
      data: {
        tokenNumber: token.tokenNumber,
        farmerId: token.farmerId,
        centerId: token.centerId,
        queuePosition: token.queuePosition,
        estimatedWaitingTime: token.estimatedWaitingTime
      }
    };

    this.emitEvent(`farmer:${token.farmerId}`, 'turn_approaching', payload);
  }

  /**
   * 3. Farmer Called notification
   * Emitted when staff calls a token to a specific counter
   */
  static emitFarmerCalled(token, counterNumber) {
    const payload = {
      event: 'FARMER_CALLED',
      timestamp: new Date(),
      message: `Token ${token.tokenNumber} has been called to Counter #${counterNumber}`,
      data: {
        tokenNumber: token.tokenNumber,
        farmerId: token.farmerId,
        centerId: token.centerId,
        counterNumber,
        status: 'CALLED'
      }
    };

    this.emitEvent(`farmer:${token.farmerId}`, 'farmer_called', payload);
    this.emitEvent(`center:${token.centerId}`, 'farmer_called', payload);
  }

  /**
   * 4. Procurement Started notification
   */
  static emitProcurementStarted(token, counterNumber) {
    const payload = {
      event: 'PROCUREMENT_STARTED',
      timestamp: new Date(),
      message: `Procurement inspection and weighing started for token ${token.tokenNumber}`,
      data: {
        tokenNumber: token.tokenNumber,
        farmerId: token.farmerId,
        centerId: token.centerId,
        counterNumber,
        status: 'IN_PROGRESS'
      }
    };

    this.emitEvent(`farmer:${token.farmerId}`, 'procurement_started', payload);
    this.emitEvent(`center:${token.centerId}`, 'procurement_started', payload);
  }

  /**
   * 5. Procurement Completed notification
   */
  static emitProcurementCompleted(token, procurementDetails = {}) {
    const payload = {
      event: 'PROCUREMENT_COMPLETED',
      timestamp: new Date(),
      message: `Procurement completed successfully for token ${token.tokenNumber}`,
      data: {
        tokenNumber: token.tokenNumber,
        farmerId: token.farmerId,
        centerId: token.centerId,
        status: 'COMPLETED',
        details: procurementDetails
      }
    };

    this.emitEvent(`farmer:${token.farmerId}`, 'procurement_completed', payload);
    this.emitEvent(`center:${token.centerId}`, 'procurement_completed', payload);
  }

  /**
   * 6. Queue Delay or General Update
   * Broadcasted when queue shifts or delays occur
   */
  static emitQueueUpdated(centerId, queueSummary) {
    const payload = {
      event: 'QUEUE_UPDATED',
      timestamp: new Date(),
      centerId,
      data: queueSummary
    };

    this.emitEvent(`center:${centerId}`, 'queue_updated', payload);
  }
}

module.exports = SocketEvents;
