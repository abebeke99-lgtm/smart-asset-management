const crypto = require('crypto');

const normalizePhoneNumber = (value) => {
  const raw = String(value || '').replace(/[^\d+]/g, '');
  if (!raw) return null;

  if (/^\+2519\d{8}$/.test(raw)) return raw;
  if (/^\+2517\d{8}$/.test(raw)) return raw;
  if (/^\+2517\d{8}$/.test(raw)) return raw;
  if (/^2519\d{8}$/.test(raw)) return `+251${raw.slice(3)}`;
  if (/^2517\d{8}$/.test(raw)) return `+251${raw.slice(3)}`;
  if (/^2517\d{8}$/.test(raw)) return `+251${raw.slice(3)}`;
  if (/^07\d{8}$/.test(raw)) return `+251${raw.slice(1)}`;
  if (/^09\d{8}$/.test(raw)) return `+251${raw.slice(1)}`;
  if (/^7\d{9}$/.test(raw)) return `+251${raw}`;
  if (/^07\d{8}$/.test(raw)) return `+251${raw.slice(1)}`;
  if (/^9\d{8}$/.test(raw)) return `+251${raw}`;
  if (/^7\d{8}$/.test(raw)) return `+251${raw}`;

  return null;
};

const getSmsDriver = () => String(process.env.SMS_PROVIDER || '').trim().toLowerCase();
const isDevelopmentSmsDriver = () => ['log', 'console', 'mock', 'dev', 'test'].includes(getSmsDriver());

const ensureSmsConfig = () => {
  const provider = getSmsDriver();
  if (!provider) return { ok: false, reason: 'SMS service is not configured' };

  if (isDevelopmentSmsDriver()) {
    return { ok: true, provider, apiKey: process.env.SMS_PROVIDER_KEY || 'dev-provider-key', apiSecret: process.env.SMS_PROVIDER_SECRET || process.env.SMS_API_SECRET || 'dev-provider-secret', senderId: process.env.SMS_SENDER_ID || process.env.SMS_SENDER || 'SMARTASSET' };
  }

  const config = {
    provider,
    apiKey: process.env.SMS_API_KEY || process.env.SMS_PROVIDER_KEY || '',
    apiSecret: process.env.SMS_API_SECRET || process.env.SMS_PROVIDER_SECRET || '',
    senderId: process.env.SMS_SENDER_ID || process.env.SMS_SENDER || '',
  };

  const hasCredentials = config.apiKey && (config.apiSecret || provider === 'africastalking');
  if (!hasCredentials) {
    return { ok: false, reason: 'SMS provider credentials are not configured' };
  }

  return { ok: true, ...config };
};

const isSmsConfigured = () => {
  const config = ensureSmsConfig();
  return config.ok && ['twilio', 'africastalking', 'africa_talking'].includes(config.provider);
};

const smsHeaders = (contentType = 'application/json') => ({
  'Content-Type': contentType,
  Accept: 'application/json',
});

const sendTwilioSms = async (normalizedPhoneNumber, message) => {
  const accountSid = String(process.env.SMS_API_KEY || '').trim();
  const authToken = String(process.env.SMS_API_SECRET || '').trim();
  const senderId = String(process.env.SMS_SENDER_ID || process.env.SMS_SENDER || '').trim();

  if (!accountSid || !authToken) {
    return { status: 'failed', reason: 'Twilio credentials are not configured' };
  }

  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
  const payload = new URLSearchParams({
    To: normalizedPhoneNumber,
    From: senderId || 'SMARTASSET',
    Body: message,
  });

  const response = await fetch('https://api.twilio.com/2010-04-01/Accounts/' + accountSid + '/Messages.json', {
    method: 'POST',
    headers: {
      ...smsHeaders('application/x-www-form-urlencoded'),
      Authorization: `Basic ${auth}`,
    },
    body: payload,
  });

  const text = await response.text();
  if (!response.ok) {
    return { status: 'failed', reason: `Twilio SMS request failed (${response.status})` };
  }

  try {
    const json = JSON.parse(text);
    if (json?.status === 'queued' || json?.sid) {
      return { status: 'sent', provider: 'twilio', messageId: json.sid || null };
    }
  } catch (error) {
    return { status: 'failed', reason: 'Twilio returned an invalid response' };
  }

  return { status: 'failed', reason: 'Twilio did not confirm message acceptance' };
};

const sendAfricaTalkingSms = async (normalizedPhoneNumber, message) => {
  const username = String(process.env.SMS_API_KEY || '').trim();
  const apiKey = String(process.env.SMS_API_SECRET || '').trim();
  const senderId = String(process.env.SMS_SENDER_ID || process.env.SMS_SENDER || '').trim();

  if (!username || !apiKey) {
    return { status: 'failed', reason: 'AfricaTalking credentials are not configured' };
  }

  const response = await fetch('https://api.africastalking.com/version1/messaging', {
    method: 'POST',
    headers: {
      ...smsHeaders(),
      apiKey,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Username': username,
    },
    body: JSON.stringify({
      username,
      to: [normalizedPhoneNumber],
      message,
      from: senderId || 'SMARTASSET',
    }),
  });

  const text = await response.text();
  if (!response.ok) {
    return { status: 'failed', reason: `AfricaTalking SMS request failed (${response.status})` };
  }

  try {
    const json = JSON.parse(text);
    if (json?.SMSMessageData?.Recipients?.some((entry) => entry.status === 'Success')) {
      return { status: 'sent', provider: 'africastalking', messageId: json?.SMSMessageData?.Recipients?.[0]?.messageId || null };
    }
  } catch (error) {
    return { status: 'failed', reason: 'AfricaTalking returned an invalid response' };
  }

  return { status: 'failed', reason: 'AfricaTalking did not confirm message acceptance' };
};

const sendSMS = async (phoneNumber, message) => {
  const normalized = normalizePhoneNumber(phoneNumber);
  if (!normalized) return { status: 'failed', reason: 'Invalid or missing phone number' };

  const config = ensureSmsConfig();
  if (!config.ok) return { status: 'failed', reason: config.reason };

  try {
    if (isDevelopmentSmsDriver()) {
      console.info(`[SMS_LOG] to=${normalized} message=${message}`);
      return { status: 'sent', provider: config.provider, messageId: `dev-${Date.now()}` };
    }
    if (config.provider === 'twilio') {
      return await sendTwilioSms(normalized, message);
    }
    if (config.provider === 'africastalking' || config.provider === 'africa_talking') {
      return await sendAfricaTalkingSms(normalized, message);
    }

    return { status: 'failed', reason: `SMS provider ${config.provider} is not supported` };
  } catch (error) {
    return { status: 'failed', reason: 'SMS provider request failed' };
  }
};

const sendOtpSms = async (phoneNumber, otp, options = {}) => {
  const normalized = normalizePhoneNumber(phoneNumber);
  if (!normalized) return { status: 'failed', reason: 'Invalid or missing phone number' };

  const otpCode = String(otp || '').trim();
  if (!/^\d{6}$/.test(otpCode)) {
    return { status: 'failed', reason: 'Invalid OTP format' };
  }

  const ttlMinutes = Math.min(60, Math.max(1, Number(options.ttlMinutes) || 5));
  const message = `Your verification code is ${otpCode}. It expires in ${ttlMinutes} minutes.`;
  return sendSMS(normalized, message);
};

module.exports = { normalizePhoneNumber, sendSMS, sendOtpSms, isSmsConfigured };
