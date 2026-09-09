const normalizePhoneNumber = (value) => {
  const raw = String(value || '').replace(/[\s()-]/g, '');
  if (/^09\d{8}$/.test(raw)) return `+251${raw.slice(1)}`;
  if (/^\+2519\d{8}$/.test(raw)) return raw;
  return null;
};

const sendSMS = async (phoneNumber, message) => {
  const normalized = normalizePhoneNumber(phoneNumber);
  if (!normalized) return { status: 'failed', reason: 'Invalid or missing phone number' };
  if (!process.env.SMS_PROVIDER) return { status: 'failed', reason: 'SMS service is not configured' };
  return { status: 'failed', reason: `SMS provider ${process.env.SMS_PROVIDER} is not implemented` };
};

module.exports = { normalizePhoneNumber, sendSMS };
