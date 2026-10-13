const { classifyEmailError, getMailDriver, getMailerStatus, getSmtpTimeouts, getTransporter, readMailerConfig } = require('../utils/mailer');
const { getRequestContext } = require('../middlewares/requestContext');

const DEVELOPMENT_MAIL_DRIVERS = ['log', 'console', 'mock', 'dev', 'test', 'memory'];
const isDevelopmentDriver = (driver) => DEVELOPMENT_MAIL_DRIVERS.includes(String(driver || '').toLowerCase());

const validateEmailConfiguration = () => {
  const status = getMailerStatus();
  if (!status.configured) {
    return {
      valid: false,
      reason: 'Email service is not configured',
      code: status.code || 'EMAIL_NOT_CONFIGURED',
      missingVariables: status.missingVariables,
      conflicts: status.conflicts || [],
    };
  }
  const { password, ...safeConfig } = readMailerConfig();
  return { valid: true, config: safeConfig };
};

const getEmailTransport = () => {
  const validation = validateEmailConfiguration();
  if (!validation.valid) return null;
  return { transporter: getTransporter(), from: validation.config.from };
};

const logEmailDiagnostic = (operation, details = {}, requestId) => {
  const contextRequestId = getRequestContext()?.requestId;
  const candidateRequestId = requestId || contextRequestId || 'unavailable';
  const safeRequestId = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(String(candidateRequestId))
    ? String(candidateRequestId)
    : 'unavailable';
  const normalizeCode = (value) => /^[A-Za-z0-9_-]{1,64}$/.test(String(value || ''))
    ? String(value).toUpperCase()
    : null;

  const errorCode = normalizeCode(details.error?.code);
  const assignedAppCode = normalizeCode(details.code);
  const providerCode = normalizeCode(details.providerCode) || errorCode;
  const classification = normalizeCode(details.classification)
    || assignedAppCode
    || (details.error ? classifyEmailError(details.error) : null)
    || 'EMAIL_DELIVERY_FAILED';
  const diagnostic = {
    event: 'email_delivery_failed',
    operation,
    requestId: safeRequestId,
    code: classification,
    ...(providerCode && providerCode !== classification ? { providerCode } : {}),
  };

  const responseCode = Number(details.responseCode ?? details.error?.responseCode);
  if (Number.isInteger(responseCode) && responseCode >= 400 && responseCode <= 599) {
    diagnostic.responseCode = responseCode;
  }

  const missingVariables = Array.isArray(details.missingVariables)
    ? details.missingVariables.filter((name) => /^(EMAIL|SMTP)_[A-Z0-9_]+$/.test(name))
    : [];
  if (missingVariables.length) diagnostic.missingVariables = missingVariables;

  const conflicts = Array.isArray(details.conflicts)
    ? details.conflicts.filter((name) => /^(EMAIL|SMTP)_[A-Z0-9_]+$/.test(name))
    : [];
  if (conflicts.length) diagnostic.conflicts = conflicts;

  console.error(JSON.stringify(diagnostic));
};

const createSmtpTimeoutError = (label, timeoutMs) => {
  const error = new Error(`SMTP ${label} timed out after ${timeoutMs}ms`);
  error.code = 'ESMTP_TIMEOUT';
  return error;
};

const withHardTimeout = (operation, label, timeoutMs) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(createSmtpTimeoutError(label, timeoutMs)), timeoutMs);

  Promise.resolve()
    .then(operation)
    .then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
});

const sendMailWithTransport = async (mailer, mailOptions) => {
  const { hardTimeout } = getSmtpTimeouts();
  const info = await withHardTimeout(
    () => mailer.transporter.sendMail({ from: mailer.from, ...mailOptions }),
    'send',
    hardTimeout,
  );
  if (!Array.isArray(info?.accepted) || info.accepted.length === 0) {
    const error = new Error('Email provider did not accept any recipients');
    error.code = 'EMAIL_RECIPIENT_NOT_ACCEPTED';
    throw error;
  }
  return { status: 'sent', provider: 'smtp', providerMessageId: info?.messageId || null };
};

const sendMail = async (mailOptions) => {
  const mailer = getEmailTransport();
  if (!mailer) {
    const validation = validateEmailConfiguration();
    logEmailDiagnostic('send', {
      code: 'EMAIL_NOT_CONFIGURED',
      missingVariables: validation.missingVariables,
    });
    return { status: 'failed', reason: 'Email service is not configured', code: 'EMAIL_NOT_CONFIGURED' };
  }

  try {
    return await sendMailWithTransport(mailer, mailOptions);
  } catch (error) {
    logEmailDiagnostic('send', { error });
    return { status: 'failed', reason: 'Email delivery failed', code: error?.code };
  }
};

const verifySmtpConnection = async () => {
  const validation = validateEmailConfiguration();
  if (!validation.valid) {
    return {
      ok: false,
      reason: validation.reason,
      code: 'EMAIL_NOT_CONFIGURED',
      missingVariables: validation.missingVariables,
    };
  }

  const mailer = getEmailTransport();
  if (!mailer) return { ok: false, reason: 'Email service is not configured', code: 'EMAIL_NOT_CONFIGURED' };

  try {
    const { hardTimeout } = getSmtpTimeouts();
    await withHardTimeout(() => mailer.transporter.verify(), 'verification', hardTimeout);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      reason: 'SMTP verification failed',
      code: classifyEmailError(error),
      providerCode: error?.code,
    };
  }
};

// Runs once at application startup. It makes a misconfigured production mail
// setup visible in the deployment logs immediately instead of only when a user
// requests a password reset. It never logs credentials and never throws.
const initializeEmailService = async () => {
  const driver = getMailDriver();
  const isProduction = String(process.env.NODE_ENV || '').trim().toLowerCase() === 'production';

  if (isDevelopmentDriver(driver)) {
    if (isProduction) {
      console.error(JSON.stringify({
        event: 'email_service_not_configured',
        code: 'EMAIL_DRIVER_INVALID',
        driver,
        reason: 'development_mail_driver_in_production',
        hint: 'MAIL_DRIVER must be smtp in production. A logging mailer can never deliver password recovery email.',
      }));
      return { ok: false, code: 'EMAIL_DRIVER_INVALID', driver };
    }
    console.warn(JSON.stringify({
      event: 'email_service_disabled',
      code: 'EMAIL_NOT_CONFIGURED',
      driver,
      reason: 'development_mail_driver',
      hint: 'Set MAIL_DRIVER=smtp and provide EMAIL_HOST/EMAIL_PORT/EMAIL_USER/EMAIL_PASSWORD to deliver password recovery email.',
    }));
    return { ok: false, code: 'EMAIL_NOT_CONFIGURED', driver };
  }

  const status = getMailerStatus();
  if (!status.configured) {
    const config = readMailerConfig();
    const code = status.code || (config.hostInvalid ? 'EMAIL_HOST_INVALID' : 'EMAIL_NOT_CONFIGURED');
    const hints = {
      EMAIL_HOST_INVALID: 'EMAIL_HOST/SMTP_HOST must be an SMTP hostname such as smtp.gmail.com, not an email address.',
      EMAIL_CONFIG_CONFLICT: `Conflicting email variables were found (${status.conflicts.join(', ')}). Remove the stale SMTP_* aliases or set them to the same value as EMAIL_*.`,
      EMAIL_DRIVER_INVALID: 'MAIL_DRIVER must be smtp in production.',
      EMAIL_NOT_CONFIGURED: 'Set MAIL_DRIVER=smtp and provide EMAIL_HOST/EMAIL_PORT/EMAIL_USER/EMAIL_PASSWORD.',
    };
    console.error(JSON.stringify({
      event: 'email_service_not_configured',
      code,
      missingVariables: status.missingVariables,
      ...(status.conflicts.length ? { conflicts: status.conflicts } : {}),
      hint: hints[code] || hints.EMAIL_NOT_CONFIGURED,
    }));
    return { ok: false, code, missingVariables: status.missingVariables, conflicts: status.conflicts };
  }

  const config = readMailerConfig();
  if (config.hostNormalized) {
    console.warn(JSON.stringify({
      event: 'email_host_normalized',
      code: 'EMAIL_HOST_NORMALIZED',
      host: config.host,
      hint: 'EMAIL_HOST/SMTP_HOST looked like a provider mailbox and was resolved to its SMTP host. Prefer setting it directly.',
    }));
  }

  const result = await verifySmtpConnection();
  if (result.ok) {
    console.log(JSON.stringify({ event: 'email_transport_ready', driver: status.driver, host: config.host, port: config.port, secure: config.secure, requireTls: config.requireTls }));
    return { ok: true };
  }

  logEmailDiagnostic('startup_verification', {
    code: result.code,
    providerCode: result.providerCode,
  });

  return result;
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

const sendOtpEmail = async ({ to, fullName, otp, ttlMinutes, purpose = 'forgot_password' }) => {
  const mailer = getEmailTransport();
  if (!mailer) {
    const error = new Error('Email service is not configured');
    error.code = 'EMAIL_NOT_CONFIGURED';
    throw error;
  }

  const greetingName = escapeHtml(fullName || 'there');
  const safeOtp = escapeHtml(String(otp || ''));
  const isFirstLogin = purpose === 'first_login';
  const emailTitle = isFirstLogin ? 'Secure your account' : 'Password Recovery';
  const emailDescription = isFirstLogin
    ? 'Use this verification code to set your own account password.'
    : 'Use this verification code to continue your password recovery.';
  return sendMailWithTransport(mailer, {
    to,
    subject: isFirstLogin ? 'Set up your university account password' : 'Your verification code for password recovery',
    text: `Mekdela Amba University Asset Management System\n\nHello ${fullName || 'there'},\n\n${emailDescription}\n\nYour verification code is ${otp}.\n\nThis code expires in ${ttlMinutes} minutes. Do not share it with anyone. If you did not request this code, you can safely ignore this email.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#172033"><div style="background:#0EA5E9;padding:24px;color:#fff"><h1 style="margin:0;font-size:22px">Mekdela Amba University</h1><p style="margin:8px 0 0">Asset Management System</p></div><div style="padding:28px;border:1px solid #dbe4ef"><h2>${emailTitle}</h2><p>Hello ${greetingName},</p><p>${emailDescription}</p><p>Your six-digit verification code is:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px;margin:22px 0">${safeOtp}</p><p>This code expires in ${ttlMinutes} minutes. Do not share it with anyone.</p><p>If you did not request this code, you can safely ignore this email.</p></div></div>`,
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
  initializeEmailService,
  sendMail,
  logEmailDiagnostic,
  verifySmtpConnection,
  sendNotificationEmail,
  sendOtpEmail,
  sendPasswordResetEmail,
};