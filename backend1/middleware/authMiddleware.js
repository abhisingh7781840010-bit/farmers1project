const jwt = require('jsonwebtoken');
const config = require('../config/config');
const User = require('../models/User');
const ApiResponse = require('../utils/apiResponse');

/**
 * Protect routes: verify JWT Bearer token
 */
const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return ApiResponse.unauthorized(res, 'Authentication token is required to access this resource');
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return ApiResponse.unauthorized(res, 'User belonging to this token no longer exists');
    }

    if (!user.isActive) {
      return ApiResponse.unauthorized(res, 'User account is deactivated');
    }

    req.user = user;
    next();
  } catch (err) {
    return ApiResponse.unauthorized(res, 'Invalid or expired authentication token');
  }
};

/**
 * Optional authentication middleware: if token present, hydrate req.user, otherwise continue
 */
const optionalAuth = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, config.jwt.secret);
      const user = await User.findById(decoded.id).select('-password');
      if (user && user.isActive) {
        req.user = user;
      }
    } catch (err) {
      // Ignore token error in optional auth
    }
  }
  next();
};

/**
 * Grant access only to specified roles (e.g. 'admin', 'staff')
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return ApiResponse.forbidden(
        res,
        `User role '${req.user ? req.user.role : 'anonymous'}' is not authorized to access this route`
      );
    }
    next();
  };
};

module.exports = { protect, optionalAuth, authorize };
