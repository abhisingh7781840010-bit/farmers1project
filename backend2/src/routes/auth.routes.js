import { Router } from 'express';
import {
  login, farmerLogin, farmerRegister,
  sendOTP, verifyOTP, lookupIFSC, getProfile
} from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Admin Login
router.post('/login', login);

// === REAL OTP FLOW (NEW) ===
// Step 1: Send OTP to phone number (real SMS or console in dev mode)
router.post('/send-otp', sendOTP);
// Step 2: Verify OTP and get JWT token
router.post('/verify-otp', verifyOTP);

// IFSC Code Lookup (proxy to Razorpay IFSC API - avoids CORS)
router.get('/ifsc/:ifsc', lookupIFSC);

// Full farmer registration / profile update
router.post('/farmer-register', farmerRegister);

// Legacy farmer login (OTP bypass for backward compat)
router.post('/farmer-login', farmerLogin);

// Get logged-in user profile
router.get('/me', authenticate, getProfile);

export default router;
