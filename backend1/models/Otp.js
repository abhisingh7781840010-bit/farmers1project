const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema(
  {
    identifier: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    channel: {
      type: String,
      enum: ['email', 'sms'],
      required: true
    },
    purpose: {
      type: String,
      enum: ['login'],
      default: 'login'
    },
    codeHash: {
      type: String,
      required: true,
      select: false
    },
    expiresAt: {
      type: Date,
      required: true
    },
    attempts: {
      type: Number,
      default: 0
    },
    consumedAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Otp', otpSchema);