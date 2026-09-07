const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 5000,
  corsOrigin: process.env.CORS_ORIGIN || '*',
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/smart_agri_procurement',
  jwt: {
    secret: process.env.JWT_SECRET || 'fallback_secret_for_smart_agri_procurement_2024',
    expiresIn: process.env.JWT_EXPIRE || '7d'
  },
  otp: {
    ttlMinutes: parseInt(process.env.OTP_TTL_MINUTES, 10) || 10,
    maxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS, 10) || 5,
    hashSecret: process.env.OTP_HASH_SECRET || process.env.JWT_SECRET || 'otp_hash_secret_dev_only',
    email: {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT, 10) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      user: process.env.SMTP_USER,
      password: process.env.SMTP_PASSWORD,
      from: process.env.OTP_FROM_EMAIL || process.env.SMTP_USER
    },
    sms: {
      accountSid: process.env.TWILIO_ACCOUNT_SID,
      authToken: process.env.TWILIO_AUTH_TOKEN,
      from: process.env.TWILIO_FROM_NUMBER
    }
  },
  mlService: {
    url: process.env.ML_SERVICE_URL || 'http://localhost:8000/predict-waiting-time',
    timeoutMs: parseInt(process.env.ML_SERVICE_TIMEOUT_MS, 10) || 2000
  },
  defaults: {
    averageProcessingTime: parseInt(process.env.DEFAULT_AVERAGE_PROCESSING_TIME, 10) || 5
  }
};

module.exports = config;
