const Schedule = require('../models/Schedule');
const ProcurementCenter = require('../models/ProcurementCenter');
const ApiResponse = require('../utils/apiResponse');

/**
 * @desc   Get center schedule by centerId
 * @route  GET /api/v1/centers/:id/schedule
 * @access Public
 */
const getCenterSchedule = async (req, res, next) => {
  try {
    const centerId = req.params.id.toUpperCase();
    const schedules = await Schedule.find({ centerId }).sort({ dayOfWeek: 1 });

    if (!schedules || schedules.length === 0) {
      // Return default operating hours from center if explicit schedule records don't exist yet
      const center = await ProcurementCenter.findOne({ centerId });
      if (!center) {
        return ApiResponse.notFound(res, `Center '${centerId}' not found`);
      }

      return ApiResponse.success(res, 'Default center schedule fetched', {
        centerId,
        isDefault: true,
        operatingHours: `${center.openingTime} - ${center.closingTime}`,
        schedules: []
      });
    }

    return ApiResponse.success(res, `Schedules fetched for center ${centerId}`, schedules);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Create or update center schedule for a specific day of week
 * @route  PUT /api/v1/centers/:id/schedule
 * @access Private (Admin)
 */
const updateCenterSchedule = async (req, res, next) => {
  try {
    const centerId = req.params.id.toUpperCase();
    const {
      dayOfWeek,
      dayName,
      openingTime,
      closingTime,
      isOperational,
      maxDailyTokens,
      remarks
    } = req.body;

    const center = await ProcurementCenter.findOne({ centerId });
    if (!center) {
      return ApiResponse.notFound(res, `Center '${centerId}' not found`);
    }

    // Upsert schedule document
    const updatedSchedule = await Schedule.findOneAndUpdate(
      { centerId, dayOfWeek },
      {
        centerId,
        dayOfWeek,
        dayName,
        openingTime,
        closingTime,
        isOperational: isOperational !== undefined ? isOperational : true,
        maxDailyTokens: maxDailyTokens || center.dailyCapacity,
        remarks: remarks || ''
      },
      { new: true, upsert: true, runValidators: true }
    );

    return ApiResponse.success(res, `Schedule for ${dayName} updated successfully`, updatedSchedule);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCenterSchedule,
  updateCenterSchedule
};
