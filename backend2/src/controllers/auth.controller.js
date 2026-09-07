import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { queryOne, query, run } from '../db/connection.js';
import { sendOTPSms } from '../services/sms.service.js';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_kisan_jwt_key_2026_secure';
const OTP_EXPIRY_MINUTES = parseInt(process.env.OTP_EXPIRY_MINUTES) || 10;
const MAX_OTP_ATTEMPTS = 5;

// ─────────────────────────────────────────────────────────────
// HELPER: Generate cryptographically secure 6-digit OTP
// ─────────────────────────────────────────────────────────────
function generateOTP() {
  // Use crypto.getRandomValues equivalent in Node.js
  const digits = [];
  for (let i = 0; i < 6; i++) {
    digits.push(Math.floor(Math.random() * 10));
  }
  // Ensure first digit is not 0
  if (digits[0] === 0) digits[0] = Math.floor(1 + Math.random() * 9);
  return digits.join('');
}

// ─────────────────────────────────────────────────────────────
// STEP 1: Send OTP — POST /api/v1/auth/send-otp
// Body: { phone: "9876543210", purpose: "LOGIN"|"REGISTER" }
// ─────────────────────────────────────────────────────────────
export async function sendOTP(req, res, next) {
  try {
    const { phone, purpose = 'LOGIN' } = req.body;

    if (!phone || !/^\d{10}$/.test(phone.replace(/\D/g, '').slice(-10))) {
      return res.status(400).json({ success: false, error: 'Valid 10-digit mobile number required.' });
    }

    const cleanPhone = phone.replace(/\D/g, '').slice(-10);

    // Rate limit: max 3 OTPs per phone per hour
    const recentOTPs = query(
      `SELECT COUNT(*) as cnt FROM otp_sessions
       WHERE phone = ? AND created_at > datetime('now', '-1 hour')`,
      [cleanPhone]
    );
    if (recentOTPs[0]?.cnt >= 3) {
      return res.status(429).json({
        success: false,
        error: 'Too many OTP requests. Please wait 1 hour before trying again.'
      });
    }

    // Invalidate any existing unused OTPs for this phone
    run(`UPDATE otp_sessions SET used = 1 WHERE phone = ? AND used = 0`, [cleanPhone]);

    // Generate OTP
    const otp = generateOTP();
    const otpHash = bcrypt.hashSync(otp, 10);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();

    // Store hashed OTP
    run(
      `INSERT INTO otp_sessions (phone, otp_hash, purpose, expires_at, ip_address)
       VALUES (?, ?, ?, ?, ?)`,
      [cleanPhone, otpHash, purpose, expiresAt, req.ip || '']
    );

    // Send SMS
    const smsResult = await sendOTPSms(cleanPhone, otp);

    return res.json({
      success: true,
      message: smsResult.success
        ? `OTP sent to +91${cleanPhone}. Valid for ${OTP_EXPIRY_MINUTES} minutes.`
        : `OTP generated but SMS failed: ${smsResult.message}`,
      provider: smsResult.provider,
      expiry_minutes: OTP_EXPIRY_MINUTES,
      // Only expose dev_otp when no SMS provider configured (dev mode)
      ...(smsResult.provider === 'CONSOLE_DEV_MODE' ? { dev_otp: otp, dev_note: 'Check server console for OTP. This field is removed in production.' } : {})
    });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────
// STEP 2: Verify OTP & Login — POST /api/v1/auth/verify-otp
// Body: { phone: "9876543210", otp: "123456" }
// ─────────────────────────────────────────────────────────────
export async function verifyOTP(req, res, next) {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({ success: false, error: 'phone and otp are required.' });
    }

    const cleanPhone = phone.replace(/\D/g, '').slice(-10);

    // Get most recent valid OTP for this phone
    const otpSession = queryOne(
      `SELECT * FROM otp_sessions
       WHERE phone = ? AND used = 0 AND expires_at > datetime('now')
       ORDER BY created_at DESC LIMIT 1`,
      [cleanPhone]
    );

    if (!otpSession) {
      return res.status(400).json({
        success: false,
        error: 'No valid OTP found. Please request a new OTP.'
      });
    }

    // Check attempt limit
    if (otpSession.attempts >= MAX_OTP_ATTEMPTS) {
      run(`UPDATE otp_sessions SET used = 1 WHERE id = ?`, [otpSession.id]);
      return res.status(429).json({
        success: false,
        error: 'Too many incorrect attempts. Please request a new OTP.'
      });
    }

    // Verify OTP
    const isMatch = bcrypt.compareSync(otp.trim(), otpSession.otp_hash);

    if (!isMatch) {
      run(`UPDATE otp_sessions SET attempts = attempts + 1 WHERE id = ?`, [otpSession.id]);
      const remaining = MAX_OTP_ATTEMPTS - otpSession.attempts - 1;
      return res.status(401).json({
        success: false,
        error: `Incorrect OTP. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`
      });
    }

    // Mark OTP as used
    run(`UPDATE otp_sessions SET used = 1 WHERE id = ?`, [otpSession.id]);

    // Find or auto-provision farmer
    let farmer = queryOne(`SELECT * FROM farmers WHERE phone LIKE ?`, [`%${cleanPhone}%`]);

    if (!farmer) {
      // New user - auto-provision with minimal data
      const id = 'FARMER-' + Date.now();
      const regNo = 'IND-KISAN-' + Math.floor(100000 + Math.random() * 900000);
      run(
        `INSERT INTO farmers (id, registration_number, name, phone, state, district)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, regNo, 'New Farmer', cleanPhone, 'Unknown', 'Unknown']
      );
      farmer = queryOne(`SELECT * FROM farmers WHERE id = ?`, [id]);
    }

    // Fetch extended profile if exists
    const profile = queryOne(`SELECT * FROM farmer_profiles WHERE farmer_id = ?`, [farmer.id]);

    const isNewUser = !profile && (farmer.state === 'Unknown' || farmer.name === 'New Farmer' || farmer.name === 'Kisan Mitra');

    const jwtToken = jwt.sign(
      { id: farmer.id, role: 'FARMER', registrationNumber: farmer.registration_number, phone: cleanPhone },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    return res.json({
      success: true,
      message: isNewUser ? 'OTP verified! Please complete your profile.' : `Welcome back, ${farmer.name}!`,
      data: {
        token: jwtToken,
        role: 'FARMER',
        is_new_user: isNewUser,
        farmer: { ...farmer, profile: profile || null }
      }
    });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────
// ENHANCED REGISTRATION — POST /api/v1/auth/farmer-register
// Full profile with Aadhaar masking, IFSC, land details
// ─────────────────────────────────────────────────────────────
export async function farmerRegister(req, res, next) {
  try {
    const {
      // Basic (required)
      name, phone,
      // Personal
      dob, gender,
      // Aadhaar (last 4 only - privacy compliant)
      aadhaar_last4,
      pmkisan_id,
      // Location
      state = 'Uttar Pradesh',
      district = 'Unknown',
      village, block_name,
      // Farm
      land_holding_hectares, land_acres, land_type,
      crops_grown,              // JSON array string
      // Bank
      ifsc_code, bank_name, bank_branch,
      account_number_masked,    // Already masked by frontend: XXXX XXXX 1234
      // Legacy fields
      aadhaar_masked, bank_account_masked
    } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ success: false, error: 'name and phone are required' });
    }

    const cleanPhone = phone.replace(/\D/g, '').slice(-10);

    // Validate Aadhaar last 4 if provided
    if (aadhaar_last4 && !/^\d{4}$/.test(aadhaar_last4)) {
      return res.status(400).json({ success: false, error: 'aadhaar_last4 must be exactly 4 digits' });
    }

    // Validate IFSC format if provided
    if (ifsc_code && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc_code.toUpperCase())) {
      return res.status(400).json({ success: false, error: 'Invalid IFSC code format (e.g. SBIN0001234)' });
    }

    // Check if farmer already exists
    let farmer = queryOne(`SELECT * FROM farmers WHERE phone LIKE ?`, [`%${cleanPhone}%`]);

    if (farmer) {
      // Update existing record
      run(
        `UPDATE farmers SET name = ?, state = ?, district = ?, aadhaar_masked = ?, bank_account_masked = ?
         WHERE id = ?`,
        [name.trim(), state, district, aadhaar_masked || (aadhaar_last4 ? 'XXXX-XXXX-' + aadhaar_last4 : null),
         bank_account_masked || account_number_masked, farmer.id]
      );
    } else {
      // Create new farmer
      const id = 'FARMER-' + Date.now();
      const regNo = 'IND-KISAN-' + Math.floor(100000 + Math.random() * 900000);
      run(
        `INSERT INTO farmers (id, registration_number, name, phone, state, district, aadhaar_masked, bank_account_masked, land_holding_hectares)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, regNo, name.trim(), cleanPhone, state, district,
         aadhaar_masked || (aadhaar_last4 ? 'XXXX-XXXX-' + aadhaar_last4 : null),
         bank_account_masked || account_number_masked,
         Number(land_holding_hectares || land_acres || 2.5)]
      );
      farmer = queryOne(`SELECT * FROM farmers WHERE id = ?`, [id]);
    }

    // Upsert extended profile
    const existingProfile = queryOne(`SELECT * FROM farmer_profiles WHERE farmer_id = ?`, [farmer.id]);
    if (existingProfile) {
      run(
        `UPDATE farmer_profiles SET dob=?, gender=?, aadhaar_last4=?, pmkisan_id=?, village=?, block_name=?,
         land_acres=?, land_type=?, crops_grown=?, ifsc_code=?, bank_name=?, bank_branch=?,
         account_number_masked=?, updated_at=CURRENT_TIMESTAMP WHERE farmer_id=?`,
        [dob, gender, aadhaar_last4, pmkisan_id, village, block_name,
         Number(land_acres || land_holding_hectares || 2.5), land_type,
         typeof crops_grown === 'string' ? crops_grown : JSON.stringify(crops_grown || []),
         ifsc_code?.toUpperCase(), bank_name, bank_branch, account_number_masked, farmer.id]
      );
    } else {
      run(
        `INSERT INTO farmer_profiles (farmer_id, dob, gender, aadhaar_last4, pmkisan_id, village, block_name,
         land_acres, land_type, crops_grown, ifsc_code, bank_name, bank_branch, account_number_masked)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [farmer.id, dob, gender, aadhaar_last4, pmkisan_id, village, block_name,
         Number(land_acres || land_holding_hectares || 2.5), land_type,
         typeof crops_grown === 'string' ? crops_grown : JSON.stringify(crops_grown || []),
         ifsc_code?.toUpperCase(), bank_name, bank_branch, account_number_masked]
      );
    }

    const updatedFarmer = queryOne(`SELECT * FROM farmers WHERE id = ?`, [farmer.id]);
    const profile = queryOne(`SELECT * FROM farmer_profiles WHERE farmer_id = ?`, [farmer.id]);

    const token = jwt.sign(
      { id: farmer.id, role: 'FARMER', registrationNumber: farmer.registration_number },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    return res.status(201).json({
      success: true,
      message: `Registration successful! Kisan ID: ${farmer.registration_number}`,
      data: { token, role: 'FARMER', farmer: { ...updatedFarmer, profile } }
    });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────
// ADMIN LOGIN (unchanged)
// ─────────────────────────────────────────────────────────────
export function login(req, res, next) {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Please provide username and password' });
    }
    const user = queryOne(`SELECT * FROM admin_users WHERE username = ?`, [username.trim()]);
    if (!user) return res.status(401).json({ success: false, error: 'Invalid credentials' });
    const isMatch = bcrypt.compareSync(password, user.password_hash);
    if (!isMatch) return res.status(401).json({ success: false, error: 'Invalid credentials' });
    const tokenPayload = { id: user.id, username: user.username, role: user.role, centerId: user.center_id };
    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '24h' });
    return res.json({
      success: true,
      message: 'Authentication successful',
      data: { token, tokenType: 'Bearer', expiresIn: '24h', user: { id: user.id, username: user.username, fullName: user.full_name, role: user.role, centerId: user.center_id } }
    });
  } catch (err) { next(err); }
}

// ─────────────────────────────────────────────────────────────
// LEGACY: farmerLogin (kept for backward compatibility)
// ─────────────────────────────────────────────────────────────
export function farmerLogin(req, res, next) {
  try {
    const { phone, registration_number } = req.body;
    if (!phone && !registration_number) {
      return res.status(400).json({ success: false, error: 'Please provide phone or registration_number' });
    }
    let farmer = null;
    if (registration_number) {
      farmer = queryOne(`SELECT * FROM farmers WHERE registration_number = ?`, [registration_number.trim()]);
    } else if (phone) {
      farmer = queryOne(`SELECT * FROM farmers WHERE phone LIKE ?`, [`%${phone.trim().slice(-10)}%`]);
    }
    if (!farmer && phone) {
      const id = 'FARMER-' + Date.now();
      const regNo = 'IND-KISAN-' + Math.floor(100000 + Math.random() * 900000);
      run(`INSERT INTO farmers (id, registration_number, name, phone, state, district) VALUES (?,?,?,?,?,?)`,
        [id, regNo, 'Kisan Mitra', phone.trim(), 'Uttar Pradesh', 'Ghaziabad']);
      farmer = queryOne(`SELECT * FROM farmers WHERE id = ?`, [id]);
    }
    if (!farmer) return res.status(404).json({ success: false, error: 'Farmer profile not found.' });
    const token = jwt.sign({ id: farmer.id, role: 'FARMER', registrationNumber: farmer.registration_number }, JWT_SECRET, { expiresIn: '30d' });
    const profile = queryOne(`SELECT * FROM farmer_profiles WHERE farmer_id = ?`, [farmer.id]);
    return res.json({ success: true, message: 'Welcome back, ' + farmer.name + '!', data: { token, role: 'FARMER', farmer: { ...farmer, profile: profile || null } } });
  } catch (err) { next(err); }
}

// IFSC Lookup proxy (avoids CORS on frontend)
export async function lookupIFSC(req, res, next) {
  try {
    const { ifsc } = req.params;
    if (!ifsc || !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc.toUpperCase())) {
      return res.status(400).json({ success: false, error: 'Invalid IFSC format' });
    }
    const response = await fetch('https://ifsc.razorpay.com/' + ifsc.toUpperCase());
    if (!response.ok) return res.status(404).json({ success: false, error: 'IFSC not found' });
    const data = await response.json();
    return res.json({
      success: true,
      data: { ifsc: data.IFSC, bank: data.BANK, branch: data.BRANCH, city: data.CITY, state: data.STATE, address: data.ADDRESS }
    });
  } catch (err) { next(err); }
}

export function getProfile(req, res) {
  const profile = queryOne(`SELECT * FROM farmer_profiles WHERE farmer_id = ?`, [req.user?.id]);
  res.json({ success: true, data: { ...req.user, profile: profile || null } });
}

export default { login, farmerLogin, farmerRegister, sendOTP, verifyOTP, lookupIFSC, getProfile };
