const express = require('express');
const router = express.Router();
const { register, login, getMe, requestOtp, verifyLoginOtp } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const {
	validate,
	registerSchema,
	loginSchema,
	otpRequestSchema,
	otpVerifySchema
} = require('../middleware/validationMiddleware');

router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.post('/otp/request', validate(otpRequestSchema), requestOtp);
router.post('/otp/verify', validate(otpVerifySchema), verifyLoginOtp);
router.get('/me', protect, getMe);

module.exports = router;
