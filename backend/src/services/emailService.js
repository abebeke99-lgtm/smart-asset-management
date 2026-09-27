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

// Nodemailer only fails fast when every stage of the SMTP handshake is bounded.
// A stalled connect, greeting or socket would otherwise keep the request open indefinitely.
const getSmtpTimeouts = () => ({
  connectionTimeout: readPositiveInt('SMTP_CONNECTION_TIMEOUT_MS', DEFAULT_SMTP_TIMEOUTS.connectionTimeout),
  greetingTimeout: readPositiveInt('SMTP_GREETING_TIMEOUT_MS', DEFAULT_SMTP_TIMEOUTS.greetingTimeout),
  socketTimeout: readPositiveInt('SMTP_SOCKET_TIMEOUT_MS', DEFAULT_SMTP_TIMEOUTS.socketTimeout),
  dnsTimeout: readPositiveInt('SMTP_DNS_TIMEOUT_MS', DEFAULT_SMTP_TIMEOUTS.dnsTimeout),
  hardTimeout: readPositiveInt('SMTP_HARD_TIMEOUT_MS', DEFAULT_SMTP_TIMEOUTS.hardTimeout),
});

const getEmailConfig = () => {
  const host = process.env.EMAIL_HOST || process.env.SMTP_HOST;
  const port = Number(process.env.EMAIL_PORT || process.env.SMTP_PORT || 0);
  const user = process.env.EMAIL_USER || process.env.SMTP_USER;
  const password = process.env.EMAIL_PASSWORD || process.env.SMTP_PASSWORD;
  const from = process.env.EMAIL_FROM || process.env.MAIL_FROM || process.env.SMTP_FROM;
  return { host, port, user, password, from };
};

const validateEmailConfiguration = () => {
  const config = getEmailConfig();
  if (!config.host || !config.port || !config.user || !config.password || !config.from) return { valid: false, reason: 'Email service is not configured' };
  return { valid: true, config };
};

const createEmailTransport = (config) => nodemailer.createTransport({
  host: config.host,
  port: config.port,
  secure: config.port === 465,
  auth: { user: config.user, pass: config.password },
  ...getSmtpTimeouts(),
});

const getEmailTransport = () => {
  const validation = validateEmailConfiguration();
  if (!validation.valid) return null;
  return { transporter: createEmailTransport(validation.config), from: validation.config.from };
};

const createSmtpTimeoutError = (label, timeoutMs) => {
  const error = new Error(`SMTP ${label} timed out after ${timeoutMs}ms`);
  error.code = 'ESMTP_TIMEOUT';
  return error;
};

// Belt-and-braces guard: even a driver that ignores its own timeout cannot hang the request.
const withHardTimeout = (operation, label, timeoutMs) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(createSmtpTimeoutError(label, timeoutMs)), timeoutMs);
  if (typeof timer.unref === 'function') timer.unref();

  Promise.resolve()
    .then(operation)
    .then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
});

const sendMail = async (mailOptions) => {
  const { hardTimeout, ...transportTimeouts } = getSmtpTimeouts();
  const mailer = getEmailTransport();
  if (!mailer) return { status: 'failed', reason: 'Email service is not configured' };

  try {
    const info = await withHardTimeout(
      () => mailer.transporter.sendMail({ from: mailer.from, ...mailOptions }),
      'send',
      hardTimeout,
    );
    return { status: 'sent', provider: 'smtp', providerMessageId: info?.messageId || null, timeouts: transportTimeouts };
  } catch (error) {
    return {
      status: 'failed',
      reason: error?.code === 'ESMTP_TIMEOUT' ? error.message : 'Email delivery failed',
      timedOut: error?.code === 'ESMTP_TIMEOUT',
    };
  }
};

// Reports SMTP reachability and authentication without sending a message.
const verifySmtpConnection = async () => {
  const validation = validateEmailConfiguration();
  if (!validation.valid) return { ok: false, reason: validation.reason };

  const { hardTimeout } = getSmtpTimeouts();
  const mailer = getEmailTransport();
  if (!mailer) return { ok: false, reason: 'Email service is not configured' };

  try {
    await withHardTimeout(() => mailer.transporter.verify(), 'verification', hardTimeout);
    return { ok: true, host: validation.config.host, port: validation.config.port, user: validation.config.user };
  } catch (error) {
    return {
      ok: false,
      reason: error?.code === 'ESMTP_TIMEOUT' ? error.message : 'SMTP authentication failed',
      timedOut: error?.code === 'ESMTP_TIMEOUT',
    };
  }
};

const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const sendNotificationEmail = async ({ recipient, notification }) => {
  if (!recipient?.email) return { status: 'failed', reason: 'Recipient email is missing' };

  return sendMail({
    to: recipient.email,
    subject: notification.title,
    text: notification.message,
    html: `<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto"><h2 style="color:#1A237E">Mekdela Amba University</h2><p style="color:#64748b">University Asset Management System</p><hr/><h3>${notification.title}</h3><p>${String(notification.message).replace(/\n/g, '<br/>')}</p><p><strong>Priority:</strong> ${notification.priority}</p><p><strong>Type:</strong> ${notification.type}</p><hr/><small>This is an automated notification. Do not reply directly to this email.</small></div>`,
  });
};

const sendPasswordResetEmail = async ({ to, fullName, resetUrl, ttlMinutes }) => {
  const greetingName = escapeHtml(fullName || '');
  const safeResetUrl = escapeHtml(resetUrl);

  return sendMail({
    to,
    subject: 'Reset Your University Asset Management System Password',
    text: `Mekdela Amba University Asset Management System\n\nHello ${fullName},\n\nA password reset was requested for your account.\n\nReset your password here:\n${resetUrl}\n\nThis link expires in ${ttlMinutes} minutes and can only be used once. If you did not request this, you can safely ignore this email.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#172033"><div style="background:#0EA5E9;padding:24px;color:#fff"><h1 style="margin:0;font-size:22px">Mekdela Amba University</h1><p style="margin:8px 0 0">University Asset Management System</p></div><div style="padding:28px;border:1px solid #dbe4ef"><h2>Reset Your Password</h2><p>Hello ${greetingName},</p><p>A password reset was requested for your account.</p><p><a href="${safeResetUrl}" style="display:inline-block;background:#0EA5E9;color:#fff;padding:12px 20px;text-decoration:none;border-radius:8px;font-weight:700">Reset Password</a></p><p>This link expires in ${ttlMinutes} minutes and can only be used once.</p><p>If you did not request this, you can safely ignore this email.</p></div></div>`,
  });
};

module.exports = {
  getSmtpTimeouts,
  validateEmailConfiguration,
  getEmailTransport,
  sendMail,
  verifySmtpConnection,
  sendNotificationEmail,
  sendPasswordResetEmail,
};
