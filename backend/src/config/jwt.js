require('dotenv').config();

function getJwtSecret() {
  const configured = String(process.env.JWT_SECRET || '').trim();
  if (configured) return configured;

  throw new Error('JWT_SECRET must be configured before starting the server.');
}

module.exports = { getJwtSecret };