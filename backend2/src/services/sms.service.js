/**
 * SMS Service -- e-KisanSetu
 * Supports: Fast2SMS (recommended for India), MSG91, Twilio
 * Falls back to console log when no API key configured (dev/demo mode)
 */

export async function sendOTPSms(phone, otp) {
  const cleanPhone = phone.replace(/\D/g, '').slice(-10);

  if (process.env.FAST2SMS_API_KEY) return sendFast2SMS(cleanPhone, otp);
  if (process.env.MSG91_API_KEY) return sendMSG91(cleanPhone, otp);
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) return sendTwilio(cleanPhone, otp);

  // Console fallback (dev/demo mode - OTP shown in server terminal)
  const line = '='.repeat(60);
  console.log('\n' + line);
  console.log('SMS [DEV MODE] - Would send to: +91' + cleanPhone);
  console.log('OTP Code: ' + otp);
  console.log('Tip: Add FAST2SMS_API_KEY to backend2/.env for real SMS');
  console.log(line + '\n');
  return {
    success: true,
    provider: 'CONSOLE_DEV_MODE',
    dev_otp: otp,
    message: 'OTP printed to server console. No SMS sent. Set FAST2SMS_API_KEY in .env for real SMS.'
  };
}

async function sendFast2SMS(phone, otp) {
  try {
    const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
      method: 'POST',
      headers: { authorization: process.env.FAST2SMS_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ route: 'otp', variables_values: otp, numbers: phone, flash: 0 })
    });
    const data = await response.json();
    if (data.return === true) {
      console.log('Fast2SMS OTP sent to +91' + phone);
      return { success: true, provider: 'FAST2SMS', message: 'OTP sent to +91' + phone };
    }
    return { success: false, provider: 'FAST2SMS', message: String(data.message || 'SMS failed') };
  } catch (err) {
    return { success: false, provider: 'FAST2SMS', message: err.message };
  }
}

async function sendMSG91(phone, otp) {
  try {
    const response = await fetch('https://api.msg91.com/api/v5/otp', {
      method: 'POST',
      headers: { authkey: process.env.MSG91_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mobile: '91' + phone,
        otp,
        otp_expiry: parseInt(process.env.OTP_EXPIRY_MINUTES) || 10
      })
    });
    const data = await response.json();
    if (data.type === 'success') return { success: true, provider: 'MSG91', message: 'OTP sent to +91' + phone };
    return { success: false, provider: 'MSG91', message: data.message || 'SMS failed' };
  } catch (err) {
    return { success: false, provider: 'MSG91', message: err.message };
  }
}

async function sendTwilio(phone, otp) {
  try {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_PHONE_NUMBER;
    const expiry = process.env.OTP_EXPIRY_MINUTES || 10;
    const msgBody = 'Your e-KisanSetu OTP: ' + otp + '. Valid ' + expiry + ' min. Do not share.';
    const cred = Buffer.from(sid + ':' + token).toString('base64');
    const res = await fetch(
      'https://api.twilio.com/2010-04-01/Accounts/' + sid + '/Messages.json',
      {
        method: 'POST',
        headers: { Authorization: 'Basic ' + cred, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'To=%2B91' + phone + '&From=' + encodeURIComponent(from) + '&Body=' + encodeURIComponent(msgBody)
      }
    );
    const data = await res.json();
    if (data.sid) return { success: true, provider: 'TWILIO', message: 'OTP sent to +91' + phone };
    return { success: false, provider: 'TWILIO', message: data.message || 'SMS failed' };
  } catch (err) {
    return { success: false, provider: 'TWILIO', message: err.message };
  }
}

export default { sendOTPSms };
