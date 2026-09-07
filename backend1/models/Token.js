const mongoose = require('mongoose');

const tokenSchema = new mongoose.Schema(
  {
    tokenNumber: {
      type: String,
      required: true,
      index: true
    },
    tokenSeq: {
      type: Number,
      required: true
    },
    farmerId: {
      type: String,
      ref: 'Farmer',
      required: [true, 'Farmer ID is required'],
      trim: true,
      uppercase: true,
      index: true
    },
    centerId: {
      type: String,
      ref: 'ProcurementCenter',
      required: [true, 'Center ID is required'],
      trim: true,
      uppercase: true,
      index: true
    },
    crop: {
      type: String,
      required: [true, 'Crop name is required'],
      trim: true
    },
    quantityKg: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      enum: {
        values: ['WAITING', 'CALLED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
        message: '{VALUE} is not a valid token status'
      },
      default: 'WAITING',
      index: true
    },
    queuePosition: {
      type: Number,
      default: null // 1-based index when WAITING, null/0 once called/completed
    },
    estimatedWaitingTime: {
      type: Number, // in minutes
      default: 0
    },
    counterAssigned: {
      type: Number,
      default: null
    },
    servedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    calledAt: { type: Date },
    startedAt: { type: Date },
    completedAt: { type: Date },
    cancelledAt: { type: Date },
    remarks: { type: String, trim: true }
  },
  {
    timestamps: true
  }
);

// Compound index to help query active tokens per center and per farmer
tokenSchema.index({ centerId: 1, status: 1, createdAt: 1 });
tokenSchema.index({ farmerId: 1, status: 1 });

module.exports = mongoose.model('Token', tokenSchema);
