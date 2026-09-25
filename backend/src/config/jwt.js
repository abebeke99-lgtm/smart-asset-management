require('dotenv').config();
const crypto = require('crypto');

let cachedDevSecret = null;

function getJwtSecret() {
  const configured = String(process.env.JWT_SECRET || '').trim();
  if (configured) return configured;

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'JWT_SECRET must be configured in production. Set JWT_SECRET in the environment before starting the server.'
    );
  }

  if (!cachedDevSecret) {
    cachedDevSecret = process.env.JWT_DEV_SECRET || crypto.randomBytes(48).toString('hex');
    console.warn(
      'JWT_SECRET is not set. Using JWT_DEV_SECRET or a generated development secret. Set JWT_SECRET in the environment.'
    );
  }
  return cachedDevSecret;
}

module.exports = { getJwtSecret };