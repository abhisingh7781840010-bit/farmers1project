const ApiResponse = require('../utils/apiResponse');
const logger = require('../utils/logger');

/**
 * 404 Not Found Middleware
 */
const notFound = (req, res, next) => {
  ApiResponse.notFound(res, `Endpoint not found: [${req.method}] ${req.originalUrl}`);
};

/**
 * Central Error Handler Middleware
 */
const errorHandler = (err, req, res, next) => {
  logger.error(`Unhandled Error: ${err.message}`, err);

  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let errors = err.errors || null;

  // Handle Mongoose Bad ObjectId
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid format for field '${err.path}': ${err.value}`;
  }

  // Handle Mongoose Duplicate Key Error
  if (err.code === 11000) {
    statusCode = 409;
    const duplicatedField = Object.keys(err.keyValue || {})[0] || 'resource';
    message = `Duplicate value entered for '${duplicatedField}'. Must be unique.`;
  }

  // Handle Mongoose Validation Error
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation failed';
    errors = Object.values(err.errors).map((val) => val.message);
  }

  return ApiResponse.error(res, message, statusCode, errors);
};

module.exports = { notFound, errorHandler };
