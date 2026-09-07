const mongoose = require('mongoose');

const procurementSchema = new mongoose.Schema(
  {
    tokenId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Token',
      required: true,
      index: true
    },
    tokenNumber: {
      type: String,
      required: true
    },
    farmerId: {
      type: String,
      ref: 'Farmer',
      required: true,
      trim: true,
      index: true
    },
    centerId: {
      type: String,
      ref: 'ProcurementCenter',
      required: true,
      trim: true,
      index: true
    },
    crop: {
      type: String,
      required: true,
      trim: true
    },
    quantityProcuredKg: {
      type: Number,
      default: 0
    },
    qualityGrade: {
      type: String,
      enum: ['Grade A', 'Grade B', 'Grade C', 'Standard', 'FAQ', 'Pending', 'Rejected'],
      default: 'Pending'
    },
    moistureContentPercent: {
      type: Number
    },
    pricePerQuintal: {
      type: Number
    },
    totalAmount: {
      type: Number
    },
    status: {
      type: String,
      enum: ['INITIATED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'CANCELLED'],
      default: 'INITIATED'
    },
    counterNumber: {
      type: Number
    },
    procuredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    startedAt: {
      type: Date
    },
    completedAt: {
      type: Date
    },
    notes: {
      type: String,
      trim: true
    }
  },
  {
    timestamps: true
  }
);

procurementSchema.index({ centerId: 1, createdAt: -1 });

module.exports = mongoose.model('Procurement', procurementSchema);
