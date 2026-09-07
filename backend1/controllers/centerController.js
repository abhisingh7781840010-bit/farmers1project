const mongoose = require('mongoose');
const ProcurementCenter = require('../models/ProcurementCenter');
const Schedule = require('../models/Schedule');
const Token = require('../models/Token');
const AvailabilityService = require('../services/availabilityService');
const QueueService = require('../services/queueService');
const ApiResponse = require('../utils/apiResponse');

/**
 * Helper to find center by either centerId (e.g. 'C001') or ObjectId
 */
const findCenterByIdentifier = async (identifier) => {
  const query = mongoose.Types.ObjectId.isValid(identifier)
    ? { $or: [{ _id: identifier }, { centerId: identifier.toUpperCase() }] }
    : { centerId: identifier.toUpperCase() };

  return await ProcurementCenter.findOne(query);
};

/**
 * @desc   Get all procurement centers with dynamic queue size and availability status
 * @route  GET /api/v1/centers
 * @access Public
 */
const getCenters = async (req, res, next) => {
  try {
    const centers = await ProcurementCenter.find({ isActive: true });

    const enrichedCenters = await Promise.all(
      centers.map(async (center) => {
        // Compute real-time queue count
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const currentQueueSize = await Token.countDocuments({
          centerId: center.centerId,
          status: { $in: ['WAITING', 'CALLED', 'IN_PROGRESS'] },
          createdAt: { $gte: startOfDay }
        });

        // Compute real-time availability
        const availability = await AvailabilityService.getCenterAvailability(center);

        return {
          id: center._id,
          centerId: center.centerId,
          name: center.name,
          location: center.location,
          openingTime: center.openingTime,
          closingTime: center.closingTime,
          dailyCapacity: center.dailyCapacity,
          numberOfCounters: center.numberOfCounters,
          averageProcessingTime: center.averageProcessingTime,
          supportedCrops: center.supportedCrops,
          currentQueueSize,
          availabilityStatus: availability.status,
          availabilityDetails: availability.details
        };
      })
    );

    return ApiResponse.success(res, 'Procurement centers fetched successfully', enrichedCenters);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Get single procurement center by ID or centerId
 * @route  GET /api/v1/centers/:id
 * @access Public
 */
const getCenterById = async (req, res, next) => {
  try {
    const center = await findCenterByIdentifier(req.params.id);
    if (!center) {
      return ApiResponse.notFound(res, `Procurement center '${req.params.id}' not found`);
    }

    const currentQueueSize = await Token.countDocuments({
      centerId: center.centerId,
      status: { $in: ['WAITING', 'CALLED', 'IN_PROGRESS'] }
    });

    const availability = await AvailabilityService.getCenterAvailability(center);

    return ApiResponse.success(res, 'Procurement center details fetched', {
      centerId: center.centerId,
      name: center.name,
      location: center.location,
      openingTime: center.openingTime,
      closingTime: center.closingTime,
      dailyCapacity: center.dailyCapacity,
      numberOfCounters: center.numberOfCounters,
      averageProcessingTime: center.averageProcessingTime,
      supportedCrops: center.supportedCrops,
      currentQueueSize,
      availabilityStatus: availability.status,
      availabilityDetails: availability.details
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Get center availability status (AVAILABLE, BUSY, FULL, CLOSED)
 * @route  GET /api/v1/centers/:id/availability
 * @access Public
 */
const getCenterAvailability = async (req, res, next) => {
  try {
    const center = await findCenterByIdentifier(req.params.id);
    if (!center) {
      return ApiResponse.notFound(res, `Procurement center '${req.params.id}' not found`);
    }

    const availability = await AvailabilityService.getCenterAvailability(center);

    return ApiResponse.success(res, `Center status is ${availability.status}`, {
      centerId: center.centerId,
      name: center.name,
      availabilityStatus: availability.status,
      ...availability.details
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Get center queue (WAITING, CALLED, IN_PROGRESS)
 * @route  GET /api/v1/centers/:id/queue
 * @access Public
 */
const getCenterQueue = async (req, res, next) => {
  try {
    const center = await findCenterByIdentifier(req.params.id);
    if (!center) {
      return ApiResponse.notFound(res, `Procurement center '${req.params.id}' not found`);
    }

    const queueData = await QueueService.getCenterQueue(center.centerId);
    return ApiResponse.success(res, `Current queue for center ${center.centerId}`, queueData);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Get center schedule
 * @route  GET /api/v1/centers/:id/schedule
 * @access Public
 */
const getCenterSchedule = async (req, res, next) => {
  try {
    const center = await findCenterByIdentifier(req.params.id);
    if (!center) {
      return ApiResponse.notFound(res, `Procurement center '${req.params.id}' not found`);
    }

    const schedules = await Schedule.find({ centerId: center.centerId }).sort({ dayOfWeek: 1 });

    return ApiResponse.success(res, `Weekly schedule for center ${center.centerId}`, {
      centerId: center.centerId,
      name: center.name,
      operatingHours: `${center.openingTime} - ${center.closingTime}`,
      schedules
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Create a new procurement center (Admin only)
 * @route  POST /api/v1/centers
 * @access Private (Admin)
 */
const createCenter = async (req, res, next) => {
  try {
    const existing = await ProcurementCenter.findOne({ centerId: req.body.centerId.toUpperCase() });
    if (existing) {
      return ApiResponse.conflict(res, `Center with ID '${req.body.centerId}' already exists`);
    }

    const center = await ProcurementCenter.create({
      ...req.body,
      centerId: req.body.centerId.toUpperCase()
    });

    return ApiResponse.created(res, 'Procurement center created successfully', center);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCenters,
  getCenterById,
  getCenterAvailability,
  getCenterQueue,
  getCenterSchedule,
  createCenter
};
