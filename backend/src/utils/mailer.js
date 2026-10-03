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
const hasExplicitSmtpConfig = () => {
  const host = String(process.env.SMTP_HOST || process.env.EMAIL_HOST || '').trim();
  const user = String(process.env.SMTP_USER || process.env.EMAIL_USER || '').trim();
  const password = String(process.env.SMTP_PASSWORD || process.env.EMAIL_PASSWORD || process.env.SMTP_PASS || process.env.EMAIL_PASS || '').replace(/\s/g, '');
  return Boolean(host && (user || password));
};

const getMailDriver = () => {
  const explicitDriver = String(process.env.MAIL_DRIVER || process.env.EMAIL_DRIVER || process.env.SMTP_DRIVER || '').trim().toLowerCase();
  if (explicitDriver) return explicitDriver;
  if (hasExplicitSmtpConfig()) return 'smtp';
  return 'smtp';
};
const isDevelopmentMailDriver = () => ['log', 'console', 'mock', 'dev', 'test', 'memory'].includes(getMailDriver());

const readMailerConfig = () => {
  const driver = getMailDriver();
  if (isDevelopmentMailDriver()) {
    const host = String(process.env.SMTP_HOST || process.env.EMAIL_HOST || 'localhost').trim() || 'localhost';
    const rawPort = process.env.SMTP_PORT || process.env.EMAIL_PORT || '1025';
    const port = Number(rawPort) || 1025;
    const user = String(process.env.SMTP_USER || process.env.EMAIL_USER || 'dev@example.com').trim() || 'dev@example.com';
    const password = String(process.env.SMTP_PASSWORD || process.env.EMAIL_PASSWORD || process.env.SMTP_PASS || process.env.EMAIL_PASS || 'dev-secret').replace(/\s/g, '');
    const from = String(process.env.EMAIL_FROM || process.env.MAIL_FROM || process.env.SMTP_FROM || user).trim() || user;
    const missingVariables = hasExplicitSmtpConfig() ? [] : ['EMAIL_HOST', 'EMAIL_PORT', 'EMAIL_USER', 'EMAIL_PASSWORD'];
    return { host, port, secure: false, user, password, from, missingVariables, driver };
  }

  const host = String(process.env.EMAIL_HOST || process.env.SMTP_HOST || '').trim();
  const rawPort = process.env.EMAIL_PORT || process.env.SMTP_PORT || '';
  const port = Number(rawPort);
  const user = String(process.env.EMAIL_USER || process.env.SMTP_USER || '').trim();
  const password = String(process.env.EMAIL_PASSWORD || process.env.SMTP_PASSWORD || process.env.SMTP_PASS || process.env.EMAIL_PASS || '').replace(/\s/g, '');
  const from = String(process.env.EMAIL_FROM || process.env.MAIL_FROM || process.env.SMTP_FROM || user).trim();
  const secure = port === 465 ? true : port === 587 ? false : isTruthy(process.env.EMAIL_SECURE);
  const missingVariables = [];

  if (!host) missingVariables.push('EMAIL_HOST');
  if (!Number.isInteger(port) || port < 1 || port > 65535) missingVariables.push('EMAIL_PORT');
  if (!user) missingVariables.push('EMAIL_USER');
  if (!password) missingVariables.push('EMAIL_PASSWORD');

  return { host, port, secure, user, password, from, missingVariables, driver };
};

const getMailerStatus = () => {
  const config = readMailerConfig();
  const configured = config.missingVariables.length === 0 && (isDevelopmentMailDriver() ? hasExplicitSmtpConfig() : !config.missingVariables.length);
  return { configured, missingVariables: config.missingVariables };
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
  if (config.missingVariables.length && !isDevelopmentMailDriver()) return null;

  const configKey = JSON.stringify([config.host, config.port, config.secure, config.user, config.password, config.driver]);
  if (!reusableTransporter || transporterConfigKey !== configKey) {
    const transportOptions = isDevelopmentMailDriver()
      ? {
          streamTransport: true,
          newline: 'unix',
          buffer: true,
        }
      : {
          host: config.host,
          port: config.port,
          secure: config.secure,
          auth: { user: config.user, pass: config.password },
          connectionTimeout: getSmtpTimeouts().connectionTimeout,
          greetingTimeout: getSmtpTimeouts().greetingTimeout,
          socketTimeout: getSmtpTimeouts().socketTimeout,
          dnsTimeout: getSmtpTimeouts().dnsTimeout,
          hardTimeout: getSmtpTimeouts().hardTimeout,
        };

    reusableTransporter = nodemailer.createTransport(transportOptions);
    transporterConfigKey = configKey;
  }

  return reusableTransporter;
};

const resetTransporter = () => {
  reusableTransporter = null;
  transporterConfigKey = '';
};

module.exports = { getMailerStatus, getSmtpTimeouts, getTransporter, readMailerConfig, resetTransporter };
