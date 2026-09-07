const Token = require('../models/Token');
const Schedule = require('../models/Schedule');
const { isTimeWithinOperatingHours } = require('../utils/dateUtils');
const logger = require('../utils/logger');

/**
 * Service to compute Center Availability Status
 * Statuses: AVAILABLE | BUSY | FULL | CLOSED
 */
class AvailabilityService {
  /**
   * Determine center availability based on queue size, daily capacity, and schedule
   * @param {Object} center - ProcurementCenter document or object
   * @returns {Promise<{ status: 'AVAILABLE' | 'BUSY' | 'FULL' | 'CLOSED', details: Object }>}
   */
  static async getCenterAvailability(center) {
    if (!center) {
      return { status: 'CLOSED', details: { reason: 'Center does not exist' } };
    }

    if (center.isActive === false) {
      return { status: 'CLOSED', details: { reason: 'Center is marked inactive' } };
    }

    const now = new Date();
    const currentDayOfWeek = now.getDay();

    // 1. Check Schedule for today
    const schedule = await Schedule.findOne({
      centerId: center.centerId,
      dayOfWeek: currentDayOfWeek
    });

    let openTime = center.openingTime || '09:00';
    let closeTime = center.closingTime || '17:00';
    let isOperational = true;
    let effectiveCapacity = center.dailyCapacity || 100;

    if (schedule) {
      isOperational = schedule.isOperational;
      openTime = schedule.openingTime || openTime;
      closeTime = schedule.closingTime || closeTime;
      if (schedule.maxDailyTokens) {
        effectiveCapacity = schedule.maxDailyTokens;
      }
    }

    // If center is scheduled off or current time is outside operational hours
    if (!isOperational) {
      return {
        status: 'CLOSED',
        details: {
          reason: 'Center is not scheduled to operate today',
          openTime,
          closeTime
        }
      };
    }

    const isOpenNow = isTimeWithinOperatingHours(openTime, closeTime, now);
    if (!isOpenNow) {
      return {
        status: 'CLOSED',
        details: {
          reason: `Center operating hours are ${openTime} to ${closeTime}`,
          openTime,
          closeTime
        }
      };
    }

    // 2. Count active tokens in queue today
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const activeTokensCount = await Token.countDocuments({
      centerId: center.centerId,
      status: { $in: ['WAITING', 'CALLED', 'IN_PROGRESS'] },
      createdAt: { $gte: startOfDay }
    });

    const totalIssuedToday = await Token.countDocuments({
      centerId: center.centerId,
      status: { $ne: 'CANCELLED' },
      createdAt: { $gte: startOfDay }
    });

    // 3. Determine status based on capacity thresholds
    let status = 'AVAILABLE';
    let reason = 'Center is operating normally with capacity available';

    if (totalIssuedToday >= effectiveCapacity || activeTokensCount >= effectiveCapacity) {
      status = 'FULL';
      reason = `Center has reached its daily capacity limit (${effectiveCapacity})`;
    } else if (activeTokensCount >= effectiveCapacity * 0.7) {
      status = 'BUSY';
      reason = `Center is experiencing high queue volume (${activeTokensCount}/${effectiveCapacity})`;
    }

    return {
      status,
      details: {
        activeQueueSize: activeTokensCount,
        totalIssuedToday,
        dailyCapacity: effectiveCapacity,
        openingTime: openTime,
        closingTime: closeTime,
        numberOfCounters: center.numberOfCounters,
        reason
      }
    };
  }
}

module.exports = AvailabilityService;
