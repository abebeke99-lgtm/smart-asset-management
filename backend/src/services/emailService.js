const nodemailer = require('nodemailer');

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

const sendNotificationEmail = async ({ recipient, notification }) => {
  const validation = validateEmailConfiguration();
  if (!validation.valid) return { status: 'failed', reason: validation.reason };
  if (!recipient?.email) return { status: 'failed', reason: 'Recipient email is missing' };
  const { config } = validation;
  const transporter = nodemailer.createTransport({ host: config.host, port: config.port, secure: config.port === 465, auth: { user: config.user, pass: config.password } });
  const info = await transporter.sendMail({
    from: config.from,
    to: recipient.email,
    subject: notification.title,
    text: notification.message,
    html: `<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto"><h2 style="color:#1A237E">Mekdela Amba University</h2><p style="color:#64748b">Smart Asset Management System</p><hr/><h3>${notification.title}</h3><p>${String(notification.message).replace(/\n/g, '<br/>')}</p><p><strong>Priority:</strong> ${notification.priority}</p><p><strong>Type:</strong> ${notification.type}</p><hr/><small>This is an automated notification. Do not reply directly to this email.</small></div>`,
  });
  return { status: 'sent', provider: 'smtp', providerMessageId: info.messageId };
};

module.exports = { validateEmailConfiguration, sendNotificationEmail };
