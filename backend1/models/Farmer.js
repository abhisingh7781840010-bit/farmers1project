const mongoose = require('mongoose');

const farmerSchema = new mongoose.Schema(
  {
    farmerId: {
      type: String,
      required: [true, 'Farmer ID is required'],
      unique: true,
      trim: true,
      uppercase: true,
      index: true
    },
    name: {
      type: String,
      required: [true, 'Farmer name is required'],
      trim: true
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true
    },
    aadhaarNumber: {
      type: String,
      trim: true
    },
    address: {
      village: { type: String, trim: true },
      district: { type: String, trim: true },
      state: { type: String, trim: true },
      pincode: { type: String, trim: true }
    },
    cropsCultivated: [{
      type: String,
      trim: true
    }],
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Farmer', farmerSchema);
