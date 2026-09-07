const jwt = require('jsonwebtoken');
const User = require('../models/User');
const config = require('../config/config');
const ApiResponse = require('../utils/apiResponse');
const { issueOtp, verifyOtp } = require('../services/otpService');

/**
 * Generate JWT token for user
 */
const generateToken = (id, role) => {
  return jwt.sign({ id, role }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn
  });
};

/**
 * @desc   Register a new user (admin / staff)
 * @route  POST /api/v1/auth/register
 * @access Public (or Admin in production)
 */
const register = async (req, res, next) => {
  try {
    const { name, email, phone, password, role, assignedCenterId, counterNumber } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists) {
      return ApiResponse.conflict(res, 'User with this email already exists');
    }

    const user = await User.create({
      name,
      email,
      phone,
      password,
      role: role || 'staff',
      assignedCenterId,
      counterNumber
    });

    const token = generateToken(user._id, user.role);

    return ApiResponse.created(res, 'User registered successfully', {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        assignedCenterId: user.assignedCenterId,
        counterNumber: user.counterNumber
      },
      token
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Authenticate user and obtain JWT
 * @route  POST /api/v1/auth/login
 * @access Public
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return ApiResponse.unauthorized(res, 'Invalid email or password');
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return ApiResponse.unauthorized(res, 'Invalid email or password');
    }

    if (!user.isActive) {
      return ApiResponse.unauthorized(res, 'User account is deactivated');
    }

    const token = generateToken(user._id, user.role);

    return ApiResponse.success(res, 'Logged in successfully', {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        assignedCenterId: user.assignedCenterId,
        counterNumber: user.counterNumber
      },
      token
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Get current logged in user profile
 * @route  GET /api/v1/auth/me
 * @access Private
 */
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    return ApiResponse.success(res, 'User profile fetched', user);
  } catch (error) {
    next(error);
  }
};

const requestOtp = async (req, res, next) => {
  try {
    const { email, phone } = req.body;
    const identifier = email || phone;
    const channel = email ? 'email' : 'sms';
    const user = await User.findOne(email ? { email } : { phone });

    if (!user || !user.isActive) {
      return ApiResponse.success(res, 'If an active account exists, an OTP has been sent');
    }

    const { code, expiresAt } = await issueOtp(identifier, channel);
    const data = { expiresAt };
    if (config.env !== 'production') data.devOtp = code;

    return ApiResponse.success(res, 'OTP sent successfully', data);
  } catch (error) {
    next(error);
  }
};

const verifyLoginOtp = async (req, res, next) => {
  try {
    const { email, phone, code } = req.body;
    const identifier = email || phone;
    const channel = email ? 'email' : 'sms';
    const result = await verifyOtp(identifier, code, channel);

    if (!result.valid) {
      const message = result.reason === 'locked'
        ? 'Too many invalid attempts. Request a new OTP.'
        : 'Invalid or expired OTP';
      return ApiResponse.unauthorized(res, message);
    }

    const user = await User.findOne(email ? { email } : { phone });
    if (!user || !user.isActive) {
      return ApiResponse.unauthorized(res, 'User account is deactivated');
    }

    const token = generateToken(user._id, user.role);
    return ApiResponse.success(res, 'OTP verified successfully', {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        assignedCenterId: user.assignedCenterId,
        counterNumber: user.counterNumber
      },
      token
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { register, login, getMe, requestOtp, verifyLoginOtp };
