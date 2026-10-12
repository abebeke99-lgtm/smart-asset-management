require('dotenv').config();

const DEV_FALLBACK_JWT_SECRET = 'development-local-jwt-secret';

function getJwtSecret(options = {}) {
  const configured = String(process.env.JWT_SECRET || '').trim();
  if (configured) return configured;

  if (options.allowFallback) {
    return DEV_FALLBACK_JWT_SECRET;
  }

  throw new Error('JWT_SECRET must be configured before starting the server.');
}

module.exports = { getJwtSecret };