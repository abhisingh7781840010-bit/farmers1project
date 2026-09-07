const QueueService = require('../services/queueService');
const ApiResponse = require('../utils/apiResponse');

/**
 * @desc   Generate a unique farmer token and join procurement queue
 * @route  POST /api/v1/farmer/token
 * @access Public
 */
const generateToken = async (req, res, next) => {
  try {
    const { farmerId, crop, quantityKg } = req.body;
    const centerId = req.body.centerId || req.params.id;

    const tokenDoc = await QueueService.generateToken({
      farmerId,
      centerId,
      crop,
      quantityKg
    });

    // Format matching exact user specifications:
    // { success: true, message: "...", data: { token: 105, position: 7, estimatedWaitingTime: 35, status: "WAITING" } }
    const responseData = {
      token: Number(tokenDoc.tokenNumber) || tokenDoc.tokenNumber,
      tokenNumber: tokenDoc.tokenNumber,
      tokenId: tokenDoc._id,
      farmerId: tokenDoc.farmerId,
      centerId: tokenDoc.centerId,
      crop: tokenDoc.crop,
      position: tokenDoc.queuePosition,
      queuePosition: tokenDoc.queuePosition,
      estimatedWaitingTime: tokenDoc.estimatedWaitingTime,
      status: tokenDoc.status,
      createdAt: tokenDoc.createdAt
    };

    return ApiResponse.created(res, 'Token generated successfully', responseData);
  } catch (error) {
    if (error.statusCode === 409) {
      return ApiResponse.conflict(res, error.message, error.existingToken);
    }
    if (error.statusCode === 404) {
      return ApiResponse.notFound(res, error.message);
    }
    if (error.statusCode === 400) {
      return ApiResponse.badRequest(res, error.message);
    }
    next(error);
  }
};

/**
 * @desc   Get real-time queue status for a farmer
 * @route  GET /api/v1/farmer/status/:farmerId
 * @access Public
 */
const getFarmerStatus = async (req, res, next) => {
  try {
    const { farmerId } = req.params;

    const statusData = await QueueService.getFarmerStatus(farmerId);

    // Format matching exact user specifications:
    // token number, current queue position, estimated waiting time, current status, assigned center
    const responseData = {
      token: statusData.tokenNumber,
      tokenNumber: statusData.tokenNumber,
      currentQueuePosition: statusData.currentQueuePosition,
      position: statusData.currentQueuePosition,
      estimatedWaitingTime: statusData.estimatedWaitingTime,
      currentStatus: statusData.currentStatus,
      status: statusData.currentStatus,
      assignedCenter: statusData.assignedCenter,
      crop: statusData.crop,
      counterAssigned: statusData.counterAssigned
    };

    return ApiResponse.success(res, `Farmer queue status fetched successfully`, responseData);
  } catch (error) {
    if (error.statusCode === 404) {
      return ApiResponse.notFound(res, error.message);
    }
    next(error);
  }
};

/**
 * @desc   Cancel a farmer's active token
 * @route  POST /api/v1/farmer/token/cancel
 * @access Public / Staff
 */
const cancelToken = async (req, res, next) => {
  try {
    const { tokenId, tokenNumber, reason } = req.body;
    const identifier = tokenId || tokenNumber;

    if (!identifier) {
      return ApiResponse.badRequest(res, 'Either tokenId or tokenNumber is required');
    }

    const cancelledToken = await QueueService.cancelToken(identifier, reason);

    return ApiResponse.success(res, 'Token cancelled successfully', {
      tokenNumber: cancelledToken.tokenNumber,
      status: cancelledToken.status,
      cancelledAt: cancelledToken.cancelledAt,
      remarks: cancelledToken.remarks
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  generateToken,
  getFarmerStatus,
  cancelToken
};
