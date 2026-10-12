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

// Provider mailboxes are frequently and mistakenly used as the SMTP host
// (for example EMAIL_HOST=account@gmail.com instead of smtp.gmail.com). That
// configuration passes any "is it set?" check, so the failure only appears as a
// generic delivery error at send time. Map the known provider domains to their
// real SMTP hosts and reject anything else that is not a valid host.
const PROVIDER_SMTP_HOSTS = {
  'gmail.com': 'smtp.gmail.com',
  'googlemail.com': 'smtp.gmail.com',
  'smtp.gmail.com': 'smtp.gmail.com',
  'smtp.googlemail.com': 'smtp.gmail.com',
  'outlook.com': 'smtp-mail.outlook.com',
  'hotmail.com': 'smtp-mail.outlook.com',
  'live.com': 'smtp-mail.outlook.com',
  'yahoo.com': 'smtp.mail.yahoo.com',
  'ymail.com': 'smtp.mail.yahoo.com',
};

const HOSTNAME_PATTERN = /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/i;
const IPV4_PATTERN = /^\d{1,3}(?:\.\d{1,3}){3}$/;
const IPV6_PATTERN = /^\[[0-9a-f:.]+\]$/i;

// Resolve the configured value into a usable SMTP host. Returns:
//   host     - the normalized host to connect to ('' when unusable)
//   invalid  - the value was non-empty but cannot be a host or known provider
//   normalized - a provider mailbox/domain was corrected to its SMTP host
const resolveSmtpHost = (value) => {
  const raw = String(value || '').trim().replace(/^["']+|["']+$/g, '');
  if (!raw) return { host: '', invalid: false, normalized: false };

  let candidate = raw.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
  candidate = candidate.split(/[/?#]/)[0].trim();

  const atIndex = candidate.lastIndexOf('@');
  const fromMailbox = atIndex > 0;
  if (fromMailbox) candidate = candidate.slice(atIndex + 1);

  const portMatch = candidate.match(/^(.*):(\d+)$/);
  if (portMatch) candidate = portMatch[1];

  const hostname = candidate.trim().toLowerCase().replace(/\.$/, '');
  if (!hostname) return { host: '', invalid: true, normalized: false };

  if (PROVIDER_SMTP_HOSTS[hostname]) {
    const host = PROVIDER_SMTP_HOSTS[hostname];
    return { host, invalid: false, normalized: host !== hostname };
  }

  if (fromMailbox) return { host: '', invalid: true, normalized: false };

  const valid = HOSTNAME_PATTERN.test(hostname) || IPV4_PATTERN.test(hostname) || IPV6_PATTERN.test(hostname);
  return { host: valid ? hostname : '', invalid: !valid, normalized: false };
};

const hasExplicitSmtpConfig = () => {
  const host = String(process.env.SMTP_HOST || process.env.EMAIL_HOST || '').trim();
  const user = String(process.env.SMTP_USER || process.env.EMAIL_USER || '').trim();
  const password = String(process.env.SMTP_PASSWORD || process.env.EMAIL_PASSWORD || process.env.SMTP_PASS || process.env.EMAIL_PASS || '').replace(/\s/g, '');
  return Boolean(host && (user || password));
};

const getMailDriver = () => {
  const explicitDriver = String(process.env.MAIL_DRIVER || process.env.EMAIL_DRIVER || process.env.SMTP_DRIVER || '').trim().toLowerCase();
  if (explicitDriver) return explicitDriver;
  return 'smtp';
};
const isDevelopmentMailDriver = () => ['log', 'console', 'mock', 'dev', 'test', 'memory'].includes(getMailDriver());

const isProductionEnvironment = () => String(process.env.NODE_ENV || '').trim().toLowerCase() === 'production';

// Read a primary variable plus its supported aliases. When the primary and an
// alias are both set to different values we report a conflict by name (never by
// value) so a stale SMTP_* variable cannot silently override the intended
// EMAIL_* credential.
const readEnvValue = (name, stripWhitespace) => {
  const raw = String(process.env[name] ?? '').trim();
  return stripWhitespace ? raw.replace(/\s/g, '') : raw;
};

const detectValueConflict = (primary, aliases, { stripWhitespace = false, transform = (value) => value } = {}) => {
  const primaryValue = transform(readEnvValue(primary, stripWhitespace));
  if (!primaryValue) return { conflict: false, names: [] };
  for (const alias of aliases) {
    const aliasValue = transform(readEnvValue(alias, stripWhitespace));
    if (aliasValue && aliasValue !== primaryValue) return { conflict: true, names: [primary, alias] };
  }
  return { conflict: false, names: [] };
};

const readMailerConfig = () => {
  const driver = getMailDriver();
  if (isDevelopmentMailDriver()) {
    if (isProductionEnvironment()) {
      // A development logging mailer must never be used in production; fail the
      // configuration check instead of silently discarding password-reset email.
      return {
        host: '',
        port: 0,
        secure: false,
        user: '',
        password: '',
        from: '',
        missingVariables: [],
        driver,
        driverInvalid: true,
        hostNormalized: false,
        hostInvalid: false,
        configConflicts: [],
        requireTls: false,
      };
    }
    const host = String(process.env.SMTP_HOST || process.env.EMAIL_HOST || 'localhost').trim() || 'localhost';
    const rawPort = process.env.SMTP_PORT || process.env.EMAIL_PORT || '1025';
    const port = Number(rawPort) || 1025;
    const user = String(process.env.SMTP_USER || process.env.EMAIL_USER || 'dev@example.com').trim() || 'dev@example.com';
    const password = String(process.env.SMTP_PASSWORD || process.env.EMAIL_PASSWORD || process.env.SMTP_PASS || process.env.EMAIL_PASS || 'dev-secret').replace(/\s/g, '');
    const from = String(process.env.EMAIL_FROM || process.env.MAIL_FROM || process.env.SMTP_FROM || user).trim() || user;
    const missingVariables = hasExplicitSmtpConfig() ? [] : ['EMAIL_HOST', 'EMAIL_PORT', 'EMAIL_USER', 'EMAIL_PASSWORD'];
    return {
      host,
      port,
      secure: false,
      user,
      password,
      from,
      missingVariables,
      driver,
      driverInvalid: false,
      hostNormalized: false,
      hostInvalid: false,
      configConflicts: [],
      requireTls: false,
    };
  }

  const configuredHost = String(process.env.EMAIL_HOST || process.env.SMTP_HOST || '').trim();
  const hostResolution = resolveSmtpHost(configuredHost);
  const host = hostResolution.host;
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

  // Compare the resolved SMTP host so a mailbox EMAIL_HOST and a correct
  // SMTP_HOST are not reported as conflicting when they point at the same server.
  const resolveHostValue = (value) => resolveSmtpHost(value).host || String(value || '').trim().toLowerCase();
  const conflictResults = [
    detectValueConflict('EMAIL_HOST', ['SMTP_HOST'], { transform: resolveHostValue }),
    detectValueConflict('EMAIL_PORT', ['SMTP_PORT']),
    detectValueConflict('EMAIL_USER', ['SMTP_USER'], { transform: (value) => value.toLowerCase() }),
    detectValueConflict('EMAIL_PASSWORD', ['SMTP_PASSWORD', 'SMTP_PASS', 'EMAIL_PASS'], { stripWhitespace: true }),
  ];
  const configConflicts = [...new Set(conflictResults.flatMap((result) => result.names))];

  const requireTlsOverride = process.env.SMTP_REQUIRE_TLS;
  const requireTls = secure
    ? false
    : (requireTlsOverride === undefined || String(requireTlsOverride).trim() === '' ? port === 587 : isTruthy(requireTlsOverride));

  return {
    host,
    port,
    secure,
    user,
    password,
    from,
    missingVariables,
    driver,
    driverInvalid: false,
    hostNormalized: hostResolution.normalized,
    hostInvalid: hostResolution.invalid,
    configConflicts,
    requireTls,
  };
};

const getMailerStatus = () => {
  const config = readMailerConfig();
  const configured = !isDevelopmentMailDriver()
    && !config.driverInvalid
    && config.missingVariables.length === 0
    && config.configConflicts.length === 0;
  let code = null;
  if (config.driverInvalid) code = 'EMAIL_DRIVER_INVALID';
  else if (config.configConflicts.length) code = 'EMAIL_CONFIG_CONFLICT';
  else if (config.hostInvalid) code = 'EMAIL_HOST_INVALID';
  else if (config.missingVariables.length) code = 'EMAIL_NOT_CONFIGURED';
  return {
    configured,
    missingVariables: config.missingVariables,
    driver: config.driver,
    code,
    conflicts: config.configConflicts,
  };
};

// Classify a Nodemailer/SMTP error into a stable, non-sensitive category so the
// failure can be logged and acted on without ever exposing credentials, hosts,
// provider responses, or stack traces.
const TLS_ERROR_CODES = new Set([
  'ETLS',
  'ERR_TLS_HANDSHAKE_TIMEOUT',
  'ERR_TLS_CERT_ALTNAME_INVALID',
  'ERR_SSL_WRONG_VERSION_NUMBER',
  'ERR_SSL_TLSV1_ALERT_UNKNOWN_CA',
  'CERT_HAS_EXPIRED',
  'CERT_NOT_YET_VALID',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
]);

const isTlsError = (code, message) => {
  const normalizedCode = String(code || '').toUpperCase();
  if (TLS_ERROR_CODES.has(normalizedCode)) return true;
  if (/^(ERR_TLS|ERR_SSL|CERT_)/.test(normalizedCode)) return true;
  return /certificate|self[- ]signed|starttls|tls handshake|ssl|wrong version number/i.test(String(message || ''));
};

const classifyEmailError = (error) => {
  const code = String(error?.code || '').toUpperCase();
  const responseCode = Number(error?.responseCode);
  const response = String(error?.response || '');
  const message = String(error?.message || '');

  if (!code && !Number.isInteger(responseCode)) {
    return isTlsError(code, message) ? 'EMAIL_TLS_ERROR' : 'EMAIL_NETWORK_ERROR';
  }

  if (code === 'EMAIL_NOT_CONFIGURED') return 'EMAIL_NOT_CONFIGURED';
  if (code === 'EMAIL_CONFIG_CONFLICT') return 'EMAIL_CONFIG_CONFLICT';
  if (code === 'EMAIL_DRIVER_INVALID') return 'EMAIL_DRIVER_INVALID';
  if (code === 'EMAIL_HOST_INVALID') return 'EMAIL_HOST_INVALID';
  if (code === 'EMAIL_RECIPIENT_NOT_ACCEPTED') return 'EMAIL_PROVIDER_REJECTED';
  if (code === 'EAUTH' || code === 'EACCES' || responseCode === 535 || responseCode === 534) return 'EMAIL_AUTH_FAILED';
  if (isTlsError(code, message)) return 'EMAIL_TLS_ERROR';
  if (['ETIMEDOUT', 'ETIMEOUT', 'ESOCKETTIMEDOUT', 'ESMTP_TIMEOUT', 'ECONNECTIONTIMEOUT'].includes(code)) return 'EMAIL_CONNECTION_TIMEOUT';
  if (['ECONNECTION', 'ECONNREFUSED', 'ECONNRESET', 'EPIPE', 'ENOTFOUND', 'EDNS', 'EAI_AGAIN'].includes(code)) return 'EMAIL_CONNECTION_FAILED';
  if (Number.isInteger(responseCode) && responseCode >= 500 && responseCode <= 599) return 'EMAIL_PROVIDER_REJECTED';
  if (/^5\d\d/.test(response)) return 'EMAIL_PROVIDER_REJECTED';
  return 'EMAIL_NETWORK_ERROR';
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
  if (config.driverInvalid) return null;
  if (config.configConflicts.length && !isDevelopmentMailDriver()) return null;
  if (config.missingVariables.length && !isDevelopmentMailDriver()) return null;

  const configKey = JSON.stringify([config.host, config.port, config.secure, config.user, config.password, config.driver, config.requireTls, config.configConflicts]);
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
          requireTLS: Boolean(config.requireTls),
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

module.exports = {
  classifyEmailError,
  getMailDriver,
  getMailerStatus,
  getSmtpTimeouts,
  getTransporter,
  isDevelopmentMailDriver,
  readMailerConfig,
  resetTransporter,
  resolveSmtpHost,
};
