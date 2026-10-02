const nodemailer = require('nodemailer');

const DEFAULT_SMTP_TIMEOUTS = {
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000,
  dnsTimeout: 10000,
  hardTimeout: 30000,
};

const readPositiveInt = (name, fallback) => {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const isTruthy = (value) => /^(1|true|yes)$/i.test(String(value || '').trim());

const readMailerConfig = () => {
  const host = String(process.env.EMAIL_HOST || process.env.SMTP_HOST || '').trim();
  const rawPort = process.env.EMAIL_PORT || process.env.SMTP_PORT || '587';
  const port = Number(rawPort);
  const user = String(process.env.EMAIL_USER || process.env.SMTP_USER || '').trim();
  const password = String(process.env.EMAIL_PASSWORD || process.env.SMTP_PASSWORD || '').replace(/\s/g, '');
  const from = String(process.env.EMAIL_FROM || process.env.MAIL_FROM || process.env.SMTP_FROM || user).trim();
  const secure = port === 465 ? true : port === 587 ? false : isTruthy(process.env.EMAIL_SECURE);
  const missingVariables = [];

  if (!host) missingVariables.push('EMAIL_HOST');
  if (!Number.isInteger(port) || port < 1 || port > 65535) missingVariables.push('EMAIL_PORT');
  if (!user) missingVariables.push('EMAIL_USER');
  if (!password) missingVariables.push('EMAIL_PASSWORD');

  return { host, port, secure, user, password, from, missingVariables };
};

const getMailerStatus = () => {
  const { missingVariables } = readMailerConfig();
  return { configured: missingVariables.length === 0, missingVariables };
};

const getSmtpTimeouts = () => ({
  connectionTimeout: readPositiveInt('SMTP_CONNECTION_TIMEOUT_MS', DEFAULT_SMTP_TIMEOUTS.connectionTimeout),
  greetingTimeout: readPositiveInt('SMTP_GREETING_TIMEOUT_MS', DEFAULT_SMTP_TIMEOUTS.greetingTimeout),
  socketTimeout: readPositiveInt('SMTP_SOCKET_TIMEOUT_MS', DEFAULT_SMTP_TIMEOUTS.socketTimeout),
  dnsTimeout: readPositiveInt('SMTP_DNS_TIMEOUT_MS', DEFAULT_SMTP_TIMEOUTS.dnsTimeout),
  hardTimeout: readPositiveInt('SMTP_HARD_TIMEOUT_MS', DEFAULT_SMTP_TIMEOUTS.hardTimeout),
});

let reusableTransporter = null;
let transporterConfigKey = '';

const getTransporter = () => {
  const config = readMailerConfig();
  if (config.missingVariables.length) return null;

  const configKey = JSON.stringify([config.host, config.port, config.secure, config.user, config.password]);
  if (!reusableTransporter || transporterConfigKey !== configKey) {
    reusableTransporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.user, pass: config.password },
      ...getSmtpTimeouts(),
    });
    transporterConfigKey = configKey;
  }

  return reusableTransporter;
};

module.exports = { getMailerStatus, getSmtpTimeouts, getTransporter, readMailerConfig };
