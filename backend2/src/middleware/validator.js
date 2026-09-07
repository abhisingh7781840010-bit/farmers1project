import { z } from 'zod';

/**
 * Higher-order middleware to validate req.body against a Zod schema
 * @param {z.ZodSchema} schema
 */
export function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        issues: result.error.issues.map(i => ({
          field: i.path.join('.'),
          message: i.message
        }))
      });
    }
    req.validatedBody = result.data;
    next();
  };
}

/**
 * Higher-order middleware to validate req.query against a Zod schema
 * @param {z.ZodSchema} schema
 */
export function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'Query parameter validation failed',
        issues: result.error.issues.map(i => ({
          field: i.path.join('.'),
          message: i.message
        }))
      });
    }
    req.validatedQuery = result.data;
    next();
  };
}

// Schemas
export const createTokenSchema = z.preprocess((val) => {
  if (typeof val !== 'object' || val === null) return val;
  const farmerId = val.farmerId || val.farmer_id || 'IND-KISAN-981240';
  const centerId = val.centerId || val.center_id || 'up_c1';
  const cropName = val.cropName || val.crop_name || val.crop_type || 'Wheat';
  const cropId = val.cropId || val.crop_id || cropName.toLowerCase().replace(/[^a-z0-9]/g, '_');
  const qty = val.estimatedQuantityQtl != null
    ? Number(val.estimatedQuantityQtl)
    : (val.quantity_quintals != null
      ? Number(val.quantity_quintals)
      : (val.quantity_kg != null ? Number(val.quantity_kg) / 100 : 40));

  return {
    farmerId,
    centerId,
    cropId,
    cropName,
    category: val.category || 'cereals',
    estimatedQuantityQtl: qty,
    vehicleType: val.vehicleType || val.vehicle_type || 'Tractor-Trolley',
    vehicleNumber: val.vehicleNumber || val.vehicle_number || '',
    scheduledDate: val.scheduledDate || val.scheduled_date || new Date().toISOString().split('T')[0],
    scheduledSlotTime: val.scheduledSlotTime || val.scheduled_slot_time || '09:00 - 11:00 AM'
  };
}, z.object({
  farmerId: z.string().min(1),
  centerId: z.string().min(1),
  cropId: z.string().min(1),
  cropName: z.string().min(1),
  category: z.string().optional().default('cereals'),
  estimatedQuantityQtl: z.number().positive(),
  vehicleType: z.string().optional().default('Tractor-Trolley'),
  vehicleNumber: z.string().optional().default(''),
  scheduledDate: z.string().optional(),
  scheduledSlotTime: z.string().optional()
}));

export const updateStatusSchema = z.object({
  tokenId: z.union([z.number(), z.string({ required_error: 'tokenId is required' })]),
  newStatus: z.enum([
    'WAITING', 'CALLED', 'IN_PROCUREMENT', 'PROCESSING', 'ACCEPTED', 'COMPLETED', 'CANCELLED', 'REGISTERED',
    'waiting', 'called', 'in_procurement', 'processing', 'accepted', 'completed', 'cancelled', 'registered'
  ], {
    required_error: 'newStatus is required (WAITING, CALLED, PROCESSING, ACCEPTED, COMPLETED, CANCELLED)'
  }),
  reason: z.string().optional().default(''),
  inspectorName: z.string().optional().default('Center Officer')
});

export const updateScheduleSchema = z.object({
  scheduleDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'scheduleDate must be YYYY-MM-DD').optional(),
  openTime: z.string().optional(),
  closeTime: z.string().optional(),
  totalSlots: z.number().int().positive().optional(),
  isHoliday: z.boolean().optional(),
  notes: z.string().optional()
});

export const adminReorderQueueSchema = z.object({
  reorderList: z.array(
    z.object({
      tokenId: z.number().int().positive(),
      newPosition: z.number().int().positive()
    })
  ).min(1, 'reorderList must contain at least one element')
});

export const sendNotificationSchema = z.object({
  farmerId: z.string().min(1),
  tokenId: z.number().optional(),
  centerId: z.string().min(1),
  eventType: z.enum([
    'TOKEN_GENERATED',
    'QUEUE_MOVED',
    'TURN_APPROACHING',
    'FARMER_CALLED',
    'PROCUREMENT_STARTED',
    'PROCUREMENT_COMPLETED',
    'PROCUREMENT_CANCELLED',
    'SCHEDULE_CHANGED'
  ]),
  title: z.string().min(1),
  message: z.string().min(1),
  channel: z.string().optional().default('SMS+IN_APP')
});

export const predictWaitTimeSchema = z.object({
  centerId: z.string().min(1),
  queuePosition: z.coerce.number().int().min(0),
  activeBays: z.coerce.number().int().positive().optional().default(4),
  cropId: z.string().optional().default('wheat'),
  vehicleType: z.string().optional().default('Tractor-Trolley'),
  estimatedQuantityQtl: z.coerce.number().positive().optional().default(30)
});

export default {
  validateBody,
  validateQuery,
  createTokenSchema,
  updateStatusSchema,
  updateScheduleSchema,
  adminReorderQueueSchema,
  sendNotificationSchema,
  predictWaitTimeSchema
};
