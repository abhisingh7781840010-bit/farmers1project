const http = require('http');
const app = require('./app');
const config = require('./config/config');
const { connectDB } = require('./config/db');
const { initSocket } = require('./sockets/socketManager');
const logger = require('./utils/logger');

// Create HTTP Server
const server = http.createServer(app);

// Initialize Socket.IO on the HTTP server
const io = initSocket(server);

// Start Server
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();

    server.listen(config.port, () => {
      logger.info(`========================================================`);
      logger.info(`  Smart Agri Procurement Management System Backend`);
      logger.info(`  Environment : ${config.env}`);
      logger.info(`  HTTP Port   : ${config.port}`);
      logger.info(`  Base URL    : http://localhost:${config.port}`);
      logger.info(`  Socket.IO   : Ready for real-time queue notifications`);
      logger.info(`  ML Service  : ${config.mlService.url}`);
      logger.info(`========================================================`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error(`Unhandled Rejection: ${err.message}`, err);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error(`Uncaught Exception: ${err.message}`, err);
});

startServer();

module.exports = { server, app, io };
