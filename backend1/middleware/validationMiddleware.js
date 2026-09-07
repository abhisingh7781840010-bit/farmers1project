const Joi = require('joi');
const ApiResponse = require('../utils/apiResponse');

/**
 * Generic middleware generator for Joi schema validation
 */
const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errorDetails = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message.replace(/['"]/g, '')
      }));
      return ApiResponse.badRequest(res, 'Validation error', errorDetails);
    }

    req[property] = value;
    next();
  };
};

// 1. Farmer Token Generation Schema
const generateTokenSchema = Joi.object({
  farmerId: Joi.string().trim().required().messages({
    'any.required': 'farmerId is required',
    'string.empty': 'farmerId cannot be empty'
  }),
  centerId: Joi.string().trim().required().messages({
    'any.required': 'centerId is required',
    'string.empty': 'centerId cannot be empty'
  }),
  crop: Joi.string().trim().required().messages({
    'any.required': 'crop is required',
    'string.empty': 'crop cannot be empty'
  }),
  quantityKg: Joi.number().min(0).optional().default(0)
});

// 2. Procurement Status Update Schema
const updateProcurementStatusSchema = Joi.object({
  tokenId: Joi.string().trim().optional(),
  tokenNumber: Joi.alternatives().try(Joi.string(), Joi.number()).optional(),
  status: Joi.string()
    .valid('WAITING', 'CALLED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')
    .required()
    .messages({
      'any.required': 'status is required',
      'any.only': 'status must be one of WAITING, CALLED, IN_PROGRESS, COMPLETED, CANCELLED'
    }),
  counterNumber: Joi.number().integer().min(1).optional(),
  remarks: Joi.string().trim().allow('').optional(),
  quantityProcuredKg: Joi.number().min(0).optional(),
  qualityGrade: Joi.string().valid('Grade A', 'Grade B', 'Grade C', 'Standard', 'FAQ', 'Pending', 'Rejected').optional(),
  pricePerQuintal: Joi.number().min(0).optional()
}).or('tokenId', 'tokenNumber').messages({
  'object.missing': 'Either tokenId or tokenNumber is required'
});

// 3. Procurement Center Creation Schema
const createCenterSchema = Joi.object({
  centerId: Joi.string().trim().required(),
  name: Joi.string().trim().required(),
  location: Joi.object({
    address: Joi.string().trim().required(),
    district: Joi.string().trim().required(),
    state: Joi.string().trim().required(),
    pincode: Joi.string().trim().optional(),
    coordinates: Joi.object({
      latitude: Joi.number().optional(),
      longitude: Joi.number().optional()
    }).optional()
  }).required(),
  openingTime: Joi.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).default('09:00').messages({
    'string.pattern.base': 'openingTime must be in 24-hour HH:MM format (e.g. 09:00)'
  }),
  closingTime: Joi.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).default('17:00').messages({
    'string.pattern.base': 'closingTime must be in 24-hour HH:MM format (e.g. 17:00)'
  }),
  dailyCapacity: Joi.number().integer().min(1).default(100),
  numberOfCounters: Joi.number().integer().min(1).default(3),
  averageProcessingTime: Joi.number().min(1).default(5),
  supportedCrops: Joi.array().items(Joi.string()).optional()
});

// 4. Schedule Update Schema
const updateScheduleSchema = Joi.object({
  dayOfWeek: Joi.number().integer().min(0).max(6).required(),
  dayName: Joi.string().valid('Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday').required(),
  openingTime: Joi.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).required(),
  closingTime: Joi.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).required(),
  isOperational: Joi.boolean().default(true),
  maxDailyTokens: Joi.number().integer().min(0).default(100),
  remarks: Joi.string().trim().allow('').optional()
});

// 5. Auth Schemas
const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

const registerSchema = Joi.object({
  name: Joi.string().trim().required(),
  email: Joi.string().email().required(),
  phone: Joi.string().pattern(/^\+?[1-9]\d{9,14}$/).optional().messages({
    'string.pattern.base': 'phone must be a valid international number, e.g. +919876543210'
  }),
  password: Joi.string().min(6).required(),
  role: Joi.string().valid('admin', 'staff', 'farmer').default('staff'),
  assignedCenterId: Joi.string().trim().optional(),
  counterNumber: Joi.number().integer().optional()
});

const otpRequestSchema = Joi.object({
  email: Joi.string().email(),
  phone: Joi.string().pattern(/^\+?[1-9]\d{9,14}$/).messages({
    'string.pattern.base': 'phone must be a valid international number, e.g. +919876543210'
  })
}).xor('email', 'phone').required();

const otpVerifySchema = Joi.object({
  email: Joi.string().email(),
  phone: Joi.string().pattern(/^\+?[1-9]\d{9,14}$/).messages({
    'string.pattern.base': 'phone must be a valid international number, e.g. +919876543210'
  }),
  code: Joi.string().pattern(/^\d{6}$/).required().messages({
    'string.pattern.base': 'code must be a 6-digit number'
  })
}).xor('email', 'phone').required();

module.exports = {
  validate,
  generateTokenSchema,
  updateProcurementStatusSchema,
  createCenterSchema,
  updateScheduleSchema,
  loginSchema,
  registerSchema,
  otpRequestSchema,
  otpVerifySchema
};
