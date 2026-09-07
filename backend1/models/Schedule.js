const mongoose = require('mongoose');

const scheduleSchema = new mongoose.Schema(
  {
    centerId: {
      type: String,
      ref: 'ProcurementCenter',
      required: [true, 'Center ID is required'],
      trim: true,
      uppercase: true,
      index: true
    },
    dayOfWeek: {
      type: Number,
      required: [true, 'Day of week is required (0 = Sunday, 1 = Monday, ..., 6 = Saturday)'],
      min: 0,
      max: 6
    },
    dayName: {
      type: String,
      enum: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      required: true
    },
    openingTime: {
      type: String,
      required: [true, 'Opening time is required (e.g., "09:00")'],
      default: '09:00'
    },
    closingTime: {
      type: String,
      required: [true, 'Closing time is required (e.g., "17:00")'],
      default: '17:00'
    },
    isOperational: {
      type: Boolean,
      default: true
    },
    maxDailyTokens: {
      type: Number,
      default: 100,
      min: [0, 'Max daily tokens cannot be negative']
    },
    remarks: {
      type: String,
      trim: true
    }
  },
  {
    timestamps: true
  }
);

// Compound index to guarantee one schedule per day per center
scheduleSchema.index({ centerId: 1, dayOfWeek: 1 }, { unique: true });

module.exports = mongoose.model('Schedule', scheduleSchema);
