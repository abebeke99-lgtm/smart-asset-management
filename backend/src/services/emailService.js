const { getMailerStatus, getSmtpTimeouts, getTransporter, readMailerConfig } = require('../utils/mailer');

const validateEmailConfiguration = () => {
  const status = getMailerStatus();
  if (!status.configured) {
    return { valid: false, reason: 'Email service is not configured', missingVariables: status.missingVariables };
  }
  return { valid: true, config: readMailerConfig() };
};

const getEmailTransport = () => {
  const validation = validateEmailConfiguration();
  if (!validation.valid) return null;
  return { transporter: getTransporter(), from: validation.config.from };
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
  return { status: 'sent', provider: 'smtp', providerMessageId: info?.messageId || null };
};

const sendMail = async (mailOptions) => {
  const mailer = getEmailTransport();
  if (!mailer) return { status: 'failed', reason: 'Email service is not configured', code: 'EMAIL_NOT_CONFIGURED' };

  try {
    return await sendMailWithTransport(mailer, mailOptions);
  } catch (error) {
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
    return { ok: false, reason: error?.message || 'SMTP verification failed', code: error?.code };
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

const sendOtpEmail = async ({ to, fullName, otp, ttlMinutes }) => {
  const mailer = getEmailTransport();
  if (!mailer) {
    const error = new Error('Email service is not configured');
    error.code = 'EMAIL_NOT_CONFIGURED';
    throw error;
  }

  const greetingName = escapeHtml(fullName || 'there');
  const safeOtp = escapeHtml(String(otp || ''));
  return sendMailWithTransport(mailer, {
    to,
    subject: 'Your verification code for password recovery',
    text: `Mekdela Amba University Asset Management System\n\nHello ${fullName || 'there'},\n\nYour password recovery verification code is ${otp}.\n\nThis code expires in ${ttlMinutes} minutes. Do not share it with anyone. If you did not request this code, you can safely ignore this email.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#172033"><div style="background:#0EA5E9;padding:24px;color:#fff"><h1 style="margin:0;font-size:22px">Mekdela Amba University</h1><p style="margin:8px 0 0">Asset Management System</p></div><div style="padding:28px;border:1px solid #dbe4ef"><h2>Password Recovery</h2><p>Hello ${greetingName},</p><p>Your six-digit verification code is:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px;margin:22px 0">${safeOtp}</p><p>This code expires in ${ttlMinutes} minutes. Do not share it with anyone.</p><p>If you did not request this code, you can safely ignore this email.</p></div></div>`,
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
  sendOtpEmail,
  sendPasswordResetEmail,
};