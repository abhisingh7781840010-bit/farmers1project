const { Server } = require('socket.io');
const logger = require('../utils/logger');
const config = require('../config/config');

let io = null;

/**
 * Initialize Socket.IO with HTTP Server
 * @param {import('http').Server} server
 */
const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: config.corsOrigin,
      methods: ['GET', 'POST', 'PUT']
    }
  });

  io.on('connection', (socket) => {
    logger.info(`New Socket.IO client connected: ${socket.id}`);

    // Join room for a specific farmer (for personal alerts)
    socket.on('join_farmer_room', (farmerId) => {
      if (farmerId) {
        const roomName = `farmer:${farmerId.toUpperCase()}`;
        socket.join(roomName);
        logger.info(`Socket ${socket.id} joined room: ${roomName}`);
        socket.emit('joined_room', { room: roomName, message: `Subscribed to alerts for ${farmerId}` });
      }
    });

    // Join room for a specific procurement center (for queue display boards)
    socket.on('join_center_room', (centerId) => {
      if (centerId) {
        const roomName = `center:${centerId.toUpperCase()}`;
        socket.join(roomName);
        logger.info(`Socket ${socket.id} joined room: ${roomName}`);
        socket.emit('joined_room', { room: roomName, message: `Subscribed to updates for center ${centerId}` });
      }
    });

    // Leave rooms on demand
    socket.on('leave_room', (roomName) => {
      socket.leave(roomName);
      logger.info(`Socket ${socket.id} left room: ${roomName}`);
    });

    socket.on('disconnect', (reason) => {
      logger.info(`Socket ${socket.id} disconnected: ${reason}`);
    });
  });

  return io;
};

/**
 * Get active Socket.IO server instance
 */
const getIO = () => {
  if (!io) {
    logger.warn('Socket.IO has not been initialized yet.');
  }
  return io;
};

module.exports = { initSocket, getIO };
