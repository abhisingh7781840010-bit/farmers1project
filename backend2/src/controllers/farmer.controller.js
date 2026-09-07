import { tokenService } from '../services/token.service.js';
import { mlService } from '../services/ml.service.js';
import { queryOne } from '../db/connection.js';

export async function createToken(req, res, next) {
  try {
    const result = await tokenService.createToken(req.validatedBody);
    res.status(201).json({
      success: true,
      message: 'Procurement token generated successfully',
      data: result
    });
  } catch (err) {
    next(err);
  }
}

export async function getStatus(req, res, next) {
  try {
    const tokenNumber = req.query.tokenNumber || req.params.tokenNumber || req.params.token;
    const { farmerId, tokenId } = req.query;
    if (!tokenNumber && !farmerId && !tokenId) {
      return res.status(400).json({
        success: false,
        error: 'Please provide either ?tokenNumber=..., ?farmerId=..., or ?tokenId=...'
      });
    }

    const statusData = await tokenService.getFarmerStatus({
      tokenNumber,
      farmerId,
      tokenId: tokenId ? Number(tokenId) : undefined
    });

    res.json({
      success: true,
      data: statusData,
      token: statusData
    });
  } catch (err) {
    next(err);
  }
}

export async function getWaitingTime(req, res, next) {
  try {
    const { tokenId, tokenNumber, centerId, queuePosition, cropId, vehicleType, estimatedQuantityQtl } = req.query;

    if (tokenNumber || tokenId) {
      // Look up existing token
      const statusData = await tokenService.getFarmerStatus({
        tokenNumber,
        tokenId: tokenId ? Number(tokenId) : undefined
      });

      return res.json({
        success: true,
        data: {
          tokenId: statusData.tokenId,
          tokenNumber: statusData.tokenNumber,
          status: statusData.status,
          queuePosition: statusData.queuePosition,
          waitingTime: statusData.waitingTime
        }
      });
    }

    // Direct ad-hoc estimation
    if (!centerId || queuePosition === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Either provide ?tokenNumber=... or provide ?centerId=...&queuePosition=...'
      });
    }

    const center = queryOne(`SELECT active_bays FROM centers WHERE id = ?`, [centerId]);
    const activeBays = center ? center.active_bays : 4;

    const prediction = await mlService.predictWaitTime({
      centerId,
      queuePosition: Number(queuePosition),
      activeBays,
      cropId: cropId || 'wheat',
      vehicleType: vehicleType || 'Tractor-Trolley',
      estimatedQuantityQtl: estimatedQuantityQtl ? Number(estimatedQuantityQtl) : 30
    });

    res.json({
      success: true,
      data: prediction
    });
  } catch (err) {
    next(err);
  }
}

export default {
  createToken,
  getStatus,
  getWaitingTime
};
