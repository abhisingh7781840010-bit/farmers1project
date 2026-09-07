import { procurementService } from '../services/procurement.service.js';

export function updateStatus(req, res, next) {
  try {
    const { tokenId, newStatus, reason, inspectorName } = req.validatedBody;
    const officerName = inspectorName || (req.user ? req.user.full_name || req.user.username : 'Center Officer');

    const result = procurementService.updateStatus({
      tokenId,
      newStatus,
      reason,
      inspectorName: officerName
    });

    res.json({
      success: true,
      message: `Procurement status updated to '${newStatus}'`,
      data: result
    });
  } catch (err) {
    next(err);
  }
}

export function updateStage(req, res, next) {
  try {
    const { tokenId, stageNumber, status, notes, inspectorName } = req.body;

    if (!tokenId || !stageNumber || !status) {
      return res.status(400).json({
        success: false,
        error: 'tokenId, stageNumber, and status are required fields.'
      });
    }

    const updated = procurementService.updateStage({
      tokenId: Number(tokenId),
      stageNumber: Number(stageNumber),
      status,
      notes,
      inspectorName: inspectorName || (req.user ? req.user.username : 'Inspector')
    });

    res.json({
      success: true,
      message: `Stage #${stageNumber} updated successfully`,
      data: updated
    });
  } catch (err) {
    next(err);
  }
}

export default {
  updateStatus,
  updateStage
};
