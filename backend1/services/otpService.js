const crypto = require('crypto');
const nodemailer = require('nodemailer');
const twilio = require('twilio');
const Otp = require('../models/Otp');
const config = require('../config/config');

const hashCode = (code) => crypto
  .createHash('sha256')
  .update(`${code}:${config.otp.hashSecret}`)
  .digest('hex');

const createCode = () => crypto.randomInt(100000, 1000000).toString();

const isEmailConfigured = () => {
  const { host, user, password, from } = config.otp.email;
  return Boolean(host && user && password && from);
};

const isSmsConfigured = () => {
  const { accountSid, authToken, from } = config.otp.sms;
  return Boolean(accountSid && authToken && from);
};

const sendCode = async (identifier, code, channel) => {
  if (channel === 'sms') {
    if (!isSmsConfigured()) {
      if (config.env === 'production') throw new Error('Twilio OTP delivery is not configured');
      console.log(`[OTP] ${identifier}: ${code}`);
      return;
    }

    const client = twilio(config.otp.sms.accountSid, config.otp.sms.authToken);
    await client.messages.create({
      body: `Your Smart Agri verification code is ${code}. It expires in ${config.otp.ttlMinutes} minutes.`,
      from: config.otp.sms.from,
      to: identifier
    });
    return;
  }

  if (!isEmailConfigured()) {
    if (config.env === 'production') {
      throw new Error('SMTP OTP delivery is not configured');
    }
    console.log(`[OTP] ${identifier}: ${code}`);
    return;
  }

  const transporter = nodemailer.createTransport({
    host: config.otp.email.host,
    port: config.otp.email.port,
    secure: config.otp.email.secure,
    auth: {
      user: config.otp.email.user,
      pass: config.otp.email.password
    }
  });

  await transporter.sendMail({
    from: config.otp.email.from,
    to: identifier,
    subject: 'Your Smart Agri verification code',
    text: `Your verification code is ${code}. It expires in ${config.otp.ttlMinutes} minutes.`,
    html: `<p>Your verification code is <strong>${code}</strong>.</p><p>It expires in ${config.otp.ttlMinutes} minutes.</p>`
  });
};

const issueOtp = async (identifier, channel, purpose = 'login') => {
  const code = createCode();
  const expiresAt = new Date(Date.now() + config.otp.ttlMinutes * 60 * 1000);

  await Otp.deleteMany({ identifier, channel, purpose, consumedAt: null });
  const otp = await Otp.create({ identifier, channel, purpose, codeHash: hashCode(code), expiresAt });

  try {
    await sendCode(identifier, code, channel);
  } catch (error) {
    await Otp.deleteOne({ _id: otp._id });
    throw error;
  }

  return { code, expiresAt };
};

const verifyOtp = async (identifier, code, channel, purpose = 'login') => {
  const otp = await Otp.findOne({ identifier, channel, purpose, consumedAt: null })
    .sort({ createdAt: -1 })
    .select('+codeHash');

  if (!otp || otp.expiresAt <= new Date()) {
    return { valid: false, reason: 'expired' };
  }

  if (otp.attempts >= config.otp.maxAttempts) {
    return { valid: false, reason: 'locked' };
  }

  if (hashCode(code) !== otp.codeHash) {
    otp.attempts += 1;
    await otp.save();
    return {
      valid: false,
      reason: otp.attempts >= config.otp.maxAttempts ? 'locked' : 'invalid'
    };
  }

  otp.consumedAt = new Date();
  await otp.save();
  return { valid: true };
};

module.exports = { issueOtp, verifyOtp };