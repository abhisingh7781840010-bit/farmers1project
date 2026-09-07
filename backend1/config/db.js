const mongoose = require('mongoose');
const config = require('./config');
const logger = require('../utils/logger');

let isConnected = false;

/**
 * Connect to MongoDB database
 */
const connectDB = async () => {
  if (isConnected) {
    logger.info('Using existing MongoDB connection');
    return;
  }

  try {
    const conn = await mongoose.connect(config.mongoUri, {
      serverSelectionTimeoutMS: 5000 // 5 seconds timeout
    });

    isConnected = conn.connections[0].readyState === 1;
    logger.info(`MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
  } catch (error) {
    logger.error('MongoDB connection failed:', error.message);
    logger.warn('If MongoDB is not running locally, please start it or set MONGODB_URI in your .env file to a valid connection string (e.g. MongoDB Atlas).');
    // Note: Do not exit process immediately in dev so developers can see what is happening or run tests
    if (config.env === 'production') {
      process.exit(1);
    }
  }
};

mongoose.connection.on('disconnected', () => {
  isConnected = false;
  logger.warn('MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
  isConnected = true;
  logger.info('MongoDB reconnected');
});

module.exports = { connectDB, mongoose };
