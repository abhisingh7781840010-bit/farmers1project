const MlClientService = require('./mlClientService');
const { getCurrentTemporalFeatures } = require('../utils/dateUtils');
const logger = require('../utils/logger');

/**
 * Modular Waiting Time Calculation Service
 * Supports Python ML model prediction with seamless fallback to mathematical queueing formula
 */
class WaitingTimeService {
  /**
   * Mathematical formula fallback calculation
   * Formula: ceil((numberOfPeopleAhead * averageProcessingTime) / numberOfCounters)
   * 
   * @param {number} peopleAhead
   * @param {number} averageProcessingTime - In minutes
   * @param {number} numberOfCounters - Number of operational counters
   * @returns {number} Waiting time in minutes
   */
  static calculateMathematicalWaitingTime(peopleAhead, averageProcessingTime = 5, numberOfCounters = 1) {
    if (peopleAhead <= 0) {
      return 0; // Farmer is next or currently called
    }

    const safeCounters = Math.max(1, Number(numberOfCounters) || 1);
    const safeAvgTime = Math.max(1, Number(averageProcessingTime) || 5);
    const safePeople = Math.max(0, Number(peopleAhead) || 0);

    // M/M/c queuing approximation: items are processed concurrently across available counters
    const estimatedMinutes = Math.ceil((safePeople * safeAvgTime) / safeCounters);
    return estimatedMinutes;
  }

  /**
   * Calculate waiting time using ML model if available, else heuristic fallback
   * 
   * @param {Object} options
   * @param {number} options.queueLength - Total people in queue
   * @param {number} options.peopleAhead - People ahead of this token
   * @param {number} options.numberOfCounters - Operational counters in center
   * @param {number} options.averageProcessingTime - Center's average processing time
   * @returns {Promise<{ waitingTime: number, calculationMethod: string }>}
   */
  static async calculateWaitingTime({
    queueLength = 0,
    peopleAhead = 0,
    numberOfCounters = 1,
    averageProcessingTime = 5
  }) {
    // If no one ahead, waiting time is 0
    if (peopleAhead <= 0) {
      return {
        waitingTime: 0,
        calculationMethod: 'IMMEDIATE'
      };
    }

    const { hour, dayOfWeek } = getCurrentTemporalFeatures();

    // 1. Attempt ML prediction via Python microservice
    const mlResult = await MlClientService.getPredictedWaitingTime({
      queueLength,
      peopleAhead,
      numberOfCounters,
      averageProcessingTime,
      hour,
      dayOfWeek
    });

    if (mlResult && typeof mlResult.predictedWaitingTime === 'number') {
      return {
        waitingTime: mlResult.predictedWaitingTime,
        calculationMethod: 'ML_MODEL'
      };
    }

    // 2. Fallback to mathematical estimation
    const fallbackTime = this.calculateMathematicalWaitingTime(
      peopleAhead,
      averageProcessingTime,
      numberOfCounters
    );

    return {
      waitingTime: fallbackTime,
      calculationMethod: 'MATHEMATICAL_FALLBACK'
    };
  }
}

module.exports = WaitingTimeService;
