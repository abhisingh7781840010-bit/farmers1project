const QueueService = require('../services/queueService');
const Procurement = require('../models/Procurement');
const ApiResponse = require('../utils/apiResponse');

/**
 * @desc   Update farmer's procurement status (WAITING -> CALLED -> IN_PROGRESS -> COMPLETED)
 * @route  PUT /api/v1/procurement/status
 * @access Private (Staff / Admin) or Authorized Token Holder
 */
const updateStatus = async (req, res, next) => {
  try {
    const {
      tokenId,
      tokenNumber,
      status,
      counterNumber,
      remarks,
      quantityProcuredKg,
      qualityGrade,
      pricePerQuintal
    } = req.body;

    const updatedToken = await QueueService.updateProcurementStatus({
      tokenId,
      tokenNumber,
      status,
      counterNumber,
      remarks,
      quantityProcuredKg,
      qualityGrade,
      pricePerQuintal,
      userId: req.user ? req.user._id : null
    });

    return ApiResponse.success(res, `Procurement status updated to '${status}' successfully`, {
      tokenId: updatedToken._id,
      tokenNumber: updatedToken.tokenNumber,
      farmerId: updatedToken.farmerId,
      centerId: updatedToken.centerId,
      status: updatedToken.status,
      counterAssigned: updatedToken.counterAssigned,
      queuePosition: updatedToken.queuePosition,
      calledAt: updatedToken.calledAt,
      startedAt: updatedToken.startedAt,
      completedAt: updatedToken.completedAt,
      cancelledAt: updatedToken.cancelledAt,
      remarks: updatedToken.remarks
    });
  } catch (error) {
    if (error.statusCode === 400) {
      return ApiResponse.badRequest(res, error.message);
    }
    if (error.statusCode === 404) {
      return ApiResponse.notFound(res, error.message);
    }
    next(error);
  }
};

/**
 * @desc   Get list of completed procurement transactions
 * @route  GET /api/v1/procurement/history
 * @access Private (Staff / Admin)
 */
const getProcurementHistory = async (req, res, next) => {
  try {
    const { centerId, farmerId, crop, page = 1, limit = 20 } = req.query;

    const filter = {};
    if (centerId) filter.centerId = centerId.toUpperCase();
    if (farmerId) filter.farmerId = farmerId.toUpperCase();
    if (crop) filter.crop = new RegExp(crop, 'i');

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const total = await Procurement.countDocuments(filter);
    const records = await Procurement.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    return ApiResponse.success(res, 'Procurement history fetched', {
      total,
      page: parseInt(page, 10),
      pages: Math.ceil(total / parseInt(limit, 10)),
      records
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  updateStatus,
  getProcurementHistory
};
