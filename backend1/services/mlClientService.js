const axios = require('axios');
const config = require('../config/config');
const logger = require('../utils/logger');

/**
 * Service to call Python/FastAPI ML Model for Waiting Time Prediction
 */
class MlClientService {
  /**
   * Request waiting time prediction from external Python ML API
   * @param {Object} params
   * @param {number} params.queueLength - Total active queue length
   * @param {number} params.peopleAhead - People ahead of this farmer
   * @param {number} params.numberOfCounters - Number of active counters
   * @param {number} params.averageProcessingTime - Avg time per procurement (minutes)
   * @param {number} params.hour - Hour of the day (0-23)
   * @param {number} params.dayOfWeek - Day of the week (0-6)
   * @returns {Promise<{ predictedWaitingTime: number, source: string } | null>}
   */
  static async getPredictedWaitingTime(params) {
    try {
      const payload = {
        queueLength: Number(params.queueLength) || 0,
        peopleAhead: Number(params.peopleAhead) || 0,
        numberOfCounters: Number(params.numberOfCounters) || 1,
        averageProcessingTime: Number(params.averageProcessingTime) || 5,
        hour: params.hour !== undefined ? params.hour : new Date().getHours(),
        dayOfWeek: params.dayOfWeek !== undefined ? params.dayOfWeek : new Date().getDay()
      };

      logger.debug('Sending feature vector to ML Service:', payload);

      const response = await axios.post(config.mlService.url, payload, {
        timeout: config.mlService.timeoutMs,
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.data && typeof response.data.predictedWaitingTime === 'number') {
        logger.info(`ML Prediction succeeded: ${response.data.predictedWaitingTime} mins (Model Version: ${response.data.modelVersion || 'v1'})`);
        return {
          predictedWaitingTime: Math.max(1, Math.round(response.data.predictedWaitingTime)),
          source: 'ML_MODEL'
        };
      }

      return null;
    } catch (error) {
      // Gracefully log warning and allow fallback
      logger.warn(`ML Service unavailable at ${config.mlService.url} (${error.code || error.message}). Falling back to heuristic calculation.`);
      return null;
    }
  }
}

module.exports = MlClientService;
