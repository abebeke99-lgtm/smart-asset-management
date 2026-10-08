const express = require('express');
const rateLimit = require('express-rate-limit');
const rateLimitKeyGenerator = require('../utils/rateLimitKeyGenerator');
const { sendMail } = require('../services/emailService');
const Config = require('../models/Config');

const router = express.Router();
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  keyGenerator: rateLimitKeyGenerator,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, message: 'Too many messages. Please try again later.' },
});

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const containsControlCharacters = (value) => /[\u0000-\u001f\u007f]/.test(value);
const parseConfigValue = (record) => {
  try { return record ? JSON.parse(record.value || '{}') : {}; } catch { return {}; }
};

const createContactDetailsHandler = ({ findConfig = (key) => Config.findByPk(key) } = {}) => async (req, res, next) => {
  try {
    const organization = await findConfig('settings:organization') || await findConfig('system');
    const settings = parseConfigValue(organization);
    const value = (...keys) => {
      const configured = keys.map((key) => settings[key]).find((item) => typeof item === 'string' && item.trim());
      return configured ? configured.trim() : '';
    };

    return res.json({
      success: true,
      data: {
        universityName: value('university_name', 'orgName', 'organizationName', 'university'),
        email: value('contact_email', 'email'),
        phone: value('contact_phone', 'phone'),
        address: value('address'),
        website: value('website'),
      },
    });
  } catch (error) {
    return next(error);
  }
};

const validateContactSubmission = (body = {}) => {
  const errors = {};
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
  const message = typeof body.message === 'string' ? body.message.trim() : '';

  if (name.length < 2 || name.length > 100 || containsControlCharacters(name)) errors.name = 'Enter a name between 2 and 100 characters.';
  if (email.length > 254 || !emailPattern.test(email) || containsControlCharacters(email)) errors.email = 'Enter a valid email address.';
  if (subject.length < 3 || subject.length > 150 || containsControlCharacters(subject)) errors.subject = 'Enter a subject between 3 and 150 characters.';
  if (message.length < 20 || message.length > 5000) errors.message = 'Enter a message between 20 and 5000 characters.';

  return {
    errors,
    values: { name, email, subject, message },
  };
};

const createContactHandler = ({ sendEmail = sendMail, getRecipient = () => process.env.CONTACT_TO_EMAIL } = {}) => async (req, res) => {
  const { errors, values } = validateContactSubmission(req.body);
  if (Object.keys(errors).length) {
    return res.status(400).json({ success: false, message: 'Please correct the highlighted fields.', errors });
  }

  const configuredRecipient = getRecipient();
  const recipient = typeof configuredRecipient === 'string' ? configuredRecipient.trim() : '';
  if (!emailPattern.test(recipient)) {
    return res.status(503).json({ success: false, message: 'Contact message delivery is not configured.' });
  }

  let delivery;
  try {
    delivery = await sendEmail({
      to: recipient,
      replyTo: values.email,
      subject: `Contact form: ${values.subject}`,
      text: `Name: ${values.name}\nEmail: ${values.email}\n\n${values.message}`,
    });
  } catch {
    delivery = { status: 'failed' };
  }

  if (delivery?.status !== 'sent') {
    const timedOut = delivery?.timedOut === true;
    return res.status(timedOut ? 504 : 502).json({
      success: false,
      message: timedOut ? 'Contact message delivery timed out.' : 'Contact message could not be delivered.',
    });
  }

  return res.status(200).json({ success: true, delivery: 'sent' });
};

router.post('/', contactLimiter, createContactHandler());
router.get('/details', createContactDetailsHandler());

module.exports = router;
module.exports.createContactHandler = createContactHandler;
module.exports.createContactDetailsHandler = createContactDetailsHandler;
module.exports.validateContactSubmission = validateContactSubmission;