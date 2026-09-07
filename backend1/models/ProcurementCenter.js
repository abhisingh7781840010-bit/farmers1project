const mongoose = require('mongoose');

const procurementCenterSchema = new mongoose.Schema(
  {
    centerId: {
      type: String,
      required: [true, 'Center ID is required'],
      unique: true,
      trim: true,
      uppercase: true,
      index: true
    },
    name: {
      type: String,
      required: [true, 'Center name is required'],
      trim: true
    },
    location: {
      address: { type: String, required: true, trim: true },
      district: { type: String, required: true, trim: true },
      state: { type: String, required: true, trim: true },
      pincode: { type: String, trim: true },
      coordinates: {
        latitude: { type: Number },
        longitude: { type: Number }
      }
    },
    openingTime: {
      type: String,
      required: [true, 'Opening time is required (e.g., "09:00")'],
      default: '09:00',
      trim: true
    },
    closingTime: {
      type: String,
      required: [true, 'Closing time is required (e.g., "17:00")'],
      default: '17:00',
      trim: true
    },
    dailyCapacity: {
      type: Number,
      required: [true, 'Daily capacity is required'],
      min: [1, 'Daily capacity must be at least 1'],
      default: 100
    },
    numberOfCounters: {
      type: Number,
      required: [true, 'Number of counters is required'],
      min: [1, 'Must have at least 1 counter'],
      default: 3
    },
    averageProcessingTime: {
      type: Number,
      default: 5, // in minutes
      min: [1, 'Average processing time must be at least 1 minute']
    },
    supportedCrops: [{
      type: String,
      trim: true
    }],
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual populate for active tokens / queue size
procurementCenterSchema.virtual('tokens', {
  ref: 'Token',
  localField: 'centerId',
  foreignField: 'centerId'
});

module.exports = mongoose.model('ProcurementCenter', procurementCenterSchema);
