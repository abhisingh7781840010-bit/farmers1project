const Token = require('../models/Token');
const ProcurementCenter = require('../models/ProcurementCenter');
const Farmer = require('../models/Farmer');
const Procurement = require('../models/Procurement');
const WaitingTimeService = require('./waitingTimeService');
const AvailabilityService = require('./availabilityService');
const SocketEvents = require('../sockets/socketEvents');
const logger = require('../utils/logger');

class QueueService {
  /**
   * Check if a farmer already has an active token in any or specific center
   * @param {string} farmerId
   * @param {string} [centerId]
   * @returns {Promise<Object|null>}
   */
  static async getActiveTokenForFarmer(farmerId, centerId = null) {
    const query = {
      farmerId: farmerId.toUpperCase(),
      status: { $in: ['WAITING', 'CALLED', 'IN_PROGRESS'] }
    };
    if (centerId) {
      query.centerId = centerId.toUpperCase();
    }
    return await Token.findOne(query);
  }

  /**
   * Add farmer to queue and generate unique token
   * @param {Object} data
   * @param {string} data.farmerId
   * @param {string} data.centerId
   * @param {string} data.crop
   * @param {number} [data.quantityKg=0]
   */
  static async generateToken({ farmerId, centerId, crop, quantityKg = 0 }) {
    const cleanFarmerId = farmerId.trim().toUpperCase();
    const cleanCenterId = centerId.trim().toUpperCase();

    // 1. Validate Center existence and availability
    const center = await ProcurementCenter.findOne({ centerId: cleanCenterId, isActive: true });
    if (!center) {
      const error = new Error(`Procurement center '${cleanCenterId}' not found or inactive`);
      error.statusCode = 404;
      throw error;
    }

    const availability = await AvailabilityService.getCenterAvailability(center);
    if (availability.status === 'CLOSED') {
      const error = new Error(`Center is currently CLOSED. ${availability.details.reason}`);
      error.statusCode = 400;
      throw error;
    }
    if (availability.status === 'FULL') {
      const error = new Error(`Center has reached maximum daily capacity. Cannot generate token at this time.`);
      error.statusCode = 400;
      throw error;
    }

    // 2. Prevent duplicate active tokens for the same farmer
    const existingActiveToken = await this.getActiveTokenForFarmer(cleanFarmerId);
    if (existingActiveToken) {
      const error = new Error(
        `Farmer ${cleanFarmerId} already has an active token (#${existingActiveToken.tokenNumber}) with status '${existingActiveToken.status}' at center ${existingActiveToken.centerId}`
      );
      error.statusCode = 409; // Conflict
      error.existingToken = existingActiveToken;
      throw error;
    }

    // 3. Ensure farmer record exists or create placeholder if not present
    let farmer = await Farmer.findOne({ farmerId: cleanFarmerId });
    if (!farmer) {
      farmer = await Farmer.create({
        farmerId: cleanFarmerId,
        name: `Farmer ${cleanFarmerId}`,
        phone: '9999999999',
        cropsCultivated: [crop]
      });
    }

    // 4. Calculate sequence and unique token number
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const tokensTodayCount = await Token.countDocuments({
      centerId: cleanCenterId,
      createdAt: { $gte: startOfDay }
    });

    const tokenSeq = 100 + tokensTodayCount + 1; // e.g. 101, 102...
    const tokenNumber = `${tokenSeq}`; // or `${cleanCenterId}-${tokenSeq}`

    // 5. Calculate queue position among current WAITING tokens
    const peopleAhead = await Token.countDocuments({
      centerId: cleanCenterId,
      status: 'WAITING'
    });
    const queuePosition = peopleAhead + 1;

    // Total active in queue for ML context
    const totalActive = await Token.countDocuments({
      centerId: cleanCenterId,
      status: { $in: ['WAITING', 'CALLED', 'IN_PROGRESS'] }
    });

    // 6. Calculate estimated waiting time (ML model with fallback)
    const { waitingTime } = await WaitingTimeService.calculateWaitingTime({
      queueLength: totalActive + 1,
      peopleAhead,
      numberOfCounters: center.numberOfCounters,
      averageProcessingTime: center.averageProcessingTime || 5
    });

    // 7. Save token
    const token = await Token.create({
      tokenNumber,
      tokenSeq,
      farmerId: cleanFarmerId,
      centerId: cleanCenterId,
      crop,
      quantityKg,
      queuePosition,
      estimatedWaitingTime: waitingTime,
      status: 'WAITING'
    });

    logger.info(`Token generated: #${tokenNumber} for Farmer ${cleanFarmerId} at Center ${cleanCenterId}, Position ${queuePosition}, Est. Time ${waitingTime}m`);

    // 8. Emit Socket.IO real-time events
    SocketEvents.emitTokenGenerated(token);

    // If queue position is 1 or 2, also emit turn approaching
    if (queuePosition <= 2) {
      SocketEvents.emitTurnApproaching(token);
    }

    // Broadcast updated queue to center
    const queueList = await this.getCenterQueue(cleanCenterId);
    SocketEvents.emitQueueUpdated(cleanCenterId, queueList);

    return token;
  }

  /**
   * Get current queue status for a farmer
   * @param {string} farmerId
   */
  static async getFarmerStatus(farmerId) {
    const cleanFarmerId = farmerId.trim().toUpperCase();

    // Find latest active or completed token
    let token = await Token.findOne({
      farmerId: cleanFarmerId,
      status: { $in: ['WAITING', 'CALLED', 'IN_PROGRESS'] }
    }).sort({ createdAt: -1 });

    if (!token) {
      // Fallback: check most recent completed/cancelled token
      token = await Token.findOne({ farmerId: cleanFarmerId }).sort({ createdAt: -1 });
    }

    if (!token) {
      const error = new Error(`No token found for farmer ID '${cleanFarmerId}'`);
      error.statusCode = 404;
      throw error;
    }

    // Fetch center details
    const center = await ProcurementCenter.findOne({ centerId: token.centerId });

    // If token is currently WAITING, dynamically refresh position and waiting time
    if (token.status === 'WAITING') {
      const currentPeopleAhead = await Token.countDocuments({
        centerId: token.centerId,
        status: 'WAITING',
        createdAt: { $lt: token.createdAt }
      });

      const currentPosition = currentPeopleAhead + 1;
      const totalActive = await Token.countDocuments({
        centerId: token.centerId,
        status: { $in: ['WAITING', 'CALLED', 'IN_PROGRESS'] }
      });

      const { waitingTime } = await WaitingTimeService.calculateWaitingTime({
        queueLength: totalActive,
        peopleAhead: currentPeopleAhead,
        numberOfCounters: center ? center.numberOfCounters : 1,
        averageProcessingTime: center ? center.averageProcessingTime : 5
      });

      // Update in db if changed
      if (token.queuePosition !== currentPosition || token.estimatedWaitingTime !== waitingTime) {
        token.queuePosition = currentPosition;
        token.estimatedWaitingTime = waitingTime;
        await token.save();
      }
    }

    return {
      tokenNumber: Number(token.tokenNumber) || token.tokenNumber,
      currentQueuePosition: token.queuePosition,
      estimatedWaitingTime: token.estimatedWaitingTime,
      currentStatus: token.status,
      assignedCenter: {
        centerId: token.centerId,
        name: center ? center.name : 'Unknown Center',
        location: center ? center.location : null,
        numberOfCounters: center ? center.numberOfCounters : 1
      },
      crop: token.crop,
      counterAssigned: token.counterAssigned,
      tokenDetails: token
    };
  }

  /**
   * Get active queue for a procurement center
   * @param {string} centerId
   */
  static async getCenterQueue(centerId) {
    const cleanCenterId = centerId.trim().toUpperCase();

    const activeTokens = await Token.find({
      centerId: cleanCenterId,
      status: { $in: ['WAITING', 'CALLED', 'IN_PROGRESS'] }
    }).sort({ status: -1, queuePosition: 1, createdAt: 1 });

    const waitingTokens = activeTokens.filter(t => t.status === 'WAITING');
    const calledTokens = activeTokens.filter(t => t.status === 'CALLED');
    const inProgressTokens = activeTokens.filter(t => t.status === 'IN_PROGRESS');

    return {
      centerId: cleanCenterId,
      totalActive: activeTokens.length,
      waitingCount: waitingTokens.length,
      calledCount: calledTokens.length,
      inProgressCount: inProgressTokens.length,
      inProgress: inProgressTokens.map(t => ({
        tokenNumber: t.tokenNumber,
        farmerId: t.farmerId,
        crop: t.crop,
        counter: t.counterAssigned
      })),
      called: calledTokens.map(t => ({
        tokenNumber: t.tokenNumber,
        farmerId: t.farmerId,
        crop: t.crop,
        counter: t.counterAssigned
      })),
      waiting: waitingTokens.map(t => ({
        tokenNumber: t.tokenNumber,
        farmerId: t.farmerId,
        crop: t.crop,
        position: t.queuePosition,
        estimatedWaitingTime: t.estimatedWaitingTime
      }))
    };
  }

  /**
   * Recalculate queue positions and waiting times for all WAITING tokens in a center
   * @param {string} centerId
   */
  static async recalculateQueuePositions(centerId) {
    const cleanCenterId = centerId.trim().toUpperCase();
    const center = await ProcurementCenter.findOne({ centerId: cleanCenterId });
    const counters = center ? center.numberOfCounters : 1;
    const avgTime = center ? center.averageProcessingTime : 5;

    // Get all WAITING tokens in chronological order
    const waitingTokens = await Token.find({
      centerId: cleanCenterId,
      status: 'WAITING'
    }).sort({ createdAt: 1 });

    const totalActive = await Token.countDocuments({
      centerId: cleanCenterId,
      status: { $in: ['WAITING', 'CALLED', 'IN_PROGRESS'] }
    });

    for (let i = 0; i < waitingTokens.length; i++) {
      const token = waitingTokens[i];
      const newPosition = i + 1;
      const peopleAhead = i;

      const { waitingTime } = await WaitingTimeService.calculateWaitingTime({
        queueLength: totalActive,
        peopleAhead,
        numberOfCounters: counters,
        averageProcessingTime: avgTime
      });

      token.queuePosition = newPosition;
      token.estimatedWaitingTime = waitingTime;
      await token.save();

      // Check if turn is approaching (position <= 2) and send notification
      if (newPosition <= 2) {
        SocketEvents.emitTurnApproaching(token);
      }
    }

    logger.info(`Recalculated queue positions for ${waitingTokens.length} tokens in center ${cleanCenterId}`);

    // Emit queue update to center room
    const queueList = await this.getCenterQueue(cleanCenterId);
    SocketEvents.emitQueueUpdated(cleanCenterId, queueList);

    return queueList;
  }

  /**
   * Update procurement and token status (e.g., WAITING -> CALLED -> IN_PROGRESS -> COMPLETED)
   */
  static async updateProcurementStatus({
    tokenId,
    tokenNumber,
    status,
    counterNumber,
    remarks,
    quantityProcuredKg,
    qualityGrade,
    pricePerQuintal,
    userId
  }) {
    // 1. Locate token by ID or tokenNumber
    let query = {};
    if (tokenId) {
      query._id = tokenId;
    } else if (tokenNumber) {
      query.tokenNumber = String(tokenNumber);
    } else {
      const error = new Error('Either tokenId or tokenNumber must be provided');
      error.statusCode = 400;
      throw error;
    }

    const token = await Token.findOne(query);
    if (!token) {
      const error = new Error('Token not found');
      error.statusCode = 404;
      throw error;
    }

    const previousStatus = token.status;
    const targetStatus = status.toUpperCase();

    // 2. Validate status transitions
    const validTransitions = {
      WAITING: ['CALLED', 'CANCELLED'],
      CALLED: ['IN_PROGRESS', 'WAITING', 'CANCELLED'],
      IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
      COMPLETED: [],
      CANCELLED: []
    };

    if (!validTransitions[previousStatus] || !validTransitions[previousStatus].includes(targetStatus)) {
      const error = new Error(`Invalid status transition from '${previousStatus}' to '${targetStatus}'`);
      error.statusCode = 400;
      throw error;
    }

    // 3. Update token fields based on target status
    token.status = targetStatus;
    if (remarks) token.remarks = remarks;
    if (userId) token.servedBy = userId;

    if (targetStatus === 'WAITING') {
      token.calledAt = null;
      token.counterAssigned = null;
      await token.save();
      await this.recalculateQueuePositions(token.centerId);

    } else if (targetStatus === 'CALLED') {
      token.calledAt = new Date();
      token.counterAssigned = counterNumber || token.counterAssigned || 1;
      token.queuePosition = null; // Removed from active waiting line
      await token.save();

      SocketEvents.emitFarmerCalled(token, token.counterAssigned);
      await this.recalculateQueuePositions(token.centerId);


    } else if (targetStatus === 'IN_PROGRESS') {
      token.startedAt = new Date();
      token.counterAssigned = counterNumber || token.counterAssigned || 1;
      token.queuePosition = null;
      await token.save();

      SocketEvents.emitProcurementStarted(token, token.counterAssigned);

    } else if (targetStatus === 'COMPLETED') {
      token.completedAt = new Date();
      token.queuePosition = null;
      await token.save();

      // Create permanent Procurement record
      const totalAmount = (quantityProcuredKg && pricePerQuintal)
        ? (quantityProcuredKg / 100) * pricePerQuintal
        : 0;

      const procurement = await Procurement.create({
        tokenId: token._id,
        tokenNumber: token.tokenNumber,
        farmerId: token.farmerId,
        centerId: token.centerId,
        crop: token.crop,
        quantityProcuredKg: quantityProcuredKg || token.quantityKg || 0,
        qualityGrade: qualityGrade || 'Standard',
        pricePerQuintal: pricePerQuintal || 0,
        totalAmount,
        status: 'COMPLETED',
        counterNumber: token.counterAssigned || 1,
        procuredBy: userId,
        startedAt: token.startedAt || new Date(),
        completedAt: new Date(),
        notes: remarks || ''
      });

      SocketEvents.emitProcurementCompleted(token, procurement);
      await this.recalculateQueuePositions(token.centerId);

    } else if (targetStatus === 'CANCELLED') {
      token.cancelledAt = new Date();
      token.queuePosition = null;
      await token.save();

      await this.recalculateQueuePositions(token.centerId);
    }

    return token;
  }

  /**
   * Cancel / Remove farmer from queue
   */
  static async cancelToken(tokenIdentifier, reason = 'Cancelled by user or operator') {
    return await this.updateProcurementStatus({
      ...(tokenIdentifier.length === 24 ? { tokenId: tokenIdentifier } : { tokenNumber: tokenIdentifier }),
      status: 'CANCELLED',
      remarks: reason
    });
  }
}

module.exports = QueueService;
