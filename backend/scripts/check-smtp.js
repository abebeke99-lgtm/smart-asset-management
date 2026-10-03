const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { getMailerStatus, getTransporter } = require('../src/utils/mailer');

const classifyError = (error) => {
  const code = String(error?.code || '').toUpperCase();
  if (code === 'EMAIL_NOT_CONFIGURED') return 'EMAIL_NOT_CONFIGURED';
  if (code === 'EAUTH' || Number(error?.responseCode) === 535) return 'EAUTH';
  if (code === 'ECONNECTION') return 'ECONNECTION';
  if (code === 'ETIMEDOUT' || code === 'ESOCKETTIMEDOUT') return 'ETIMEDOUT';
  return 'EMAIL_NETWORK_ERROR';
};

const main = async () => {
  const status = getMailerStatus();
  if (!status.configured) {
    console.log('EMAIL_NOT_CONFIGURED');
    process.exitCode = 1;
    return;
  }

  const transporter = getTransporter();
  if (!transporter) {
    console.log('EMAIL_NOT_CONFIGURED');
    process.exitCode = 1;
    return;
  }

  try {
    await transporter.verify();
    console.log('SMTP ready');
  } catch (error) {
    console.log(classifyError(error));
    process.exitCode = 1;
  }
};

main().catch((error) => {
  console.log(classifyError(error));
  process.exitCode = 1;
});