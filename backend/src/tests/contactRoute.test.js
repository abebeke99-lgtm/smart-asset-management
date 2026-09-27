const test = require('node:test');
const assert = require('node:assert/strict');
const { createContactDetailsHandler, createContactHandler, validateContactSubmission } = require('../routes/contactRoutes');

const validSubmission = {
  name: 'Test User',
  email: 'user@example.org',
  subject: 'Asset assistance',
  message: 'Please help me with this asset record.',
};

const createResponse = () => ({
  statusCode: 200,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});

test('contact validation rejects invalid email and unreasonable message length', () => {
  const invalid = validateContactSubmission({ ...validSubmission, email: 'invalid', message: 'x'.repeat(5001) });
  assert.ok(invalid.errors.email);
  assert.ok(invalid.errors.message);
});

test('contact handler sends plain text to the configured recipient and confirms delivery', async () => {
  let sentMail;
  const response = createResponse();
  const handler = createContactHandler({
    getRecipient: () => 'admin@example.org',
    sendEmail: async (mail) => {
      sentMail = mail;
      return { status: 'sent' };
    },
  });

  await handler({ body: validSubmission }, response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { success: true, delivery: 'sent' });
  assert.equal(sentMail.to, 'admin@example.org');
  assert.equal(sentMail.replyTo, validSubmission.email);
  assert.match(sentMail.text, /Please help me with this asset record\./);
  assert.equal(sentMail.html, undefined);
});

test('contact handler refuses delivery when the administrator recipient is not configured', async () => {
  let sendCalled = false;
  const response = createResponse();
  const handler = createContactHandler({
    getRecipient: () => '',
    sendEmail: async () => { sendCalled = true; return { status: 'sent' }; },
  });

  await handler({ body: validSubmission }, response);

  assert.equal(response.statusCode, 503);
  assert.equal(response.body.success, false);
  assert.equal(sendCalled, false);
});

test('contact handler does not report success when the mail service fails', async () => {
  const response = createResponse();
  const handler = createContactHandler({
    getRecipient: () => 'admin@example.org',
    sendEmail: async () => ({ status: 'failed', reason: 'private SMTP detail' }),
  });

  await handler({ body: validSubmission }, response);

  assert.equal(response.statusCode, 502);
  assert.deepEqual(response.body, { success: false, message: 'Contact message could not be delivered.' });
  assert.doesNotMatch(JSON.stringify(response.body), /private SMTP detail/);
});

test('contact handler reports mail-service timeouts without claiming delivery', async () => {
  const response = createResponse();
  const handler = createContactHandler({
    getRecipient: () => 'admin@example.org',
    sendEmail: async () => ({ status: 'failed', timedOut: true }),
  });

  await handler({ body: validSubmission }, response);

  assert.equal(response.statusCode, 504);
  assert.deepEqual(response.body, { success: false, message: 'Contact message delivery timed out.' });
});

test('public contact details expose only configured organization contact fields', async () => {
  const response = createResponse();
  const handler = createContactDetailsHandler({
    findConfig: async (key) => key === 'settings:organization' ? {
      value: JSON.stringify({
        university_name: 'Mekdela Amba University',
        contact_email: 'support@example.org',
        contact_phone: '+251 11 234 5678',
        address: 'Mekdela Amba',
        smtp_password: 'must-not-be-public',
      }),
    } : null,
  });

  await handler({}, response, (error) => { throw error; });

  assert.deepEqual(response.body, {
    success: true,
    data: {
      universityName: 'Mekdela Amba University',
      email: 'support@example.org',
      phone: '+251 11 234 5678',
      address: 'Mekdela Amba',
      website: '',
    },
  });
  assert.doesNotMatch(JSON.stringify(response.body), /must-not-be-public/);
});

test('public contact details fall back to legacy system settings', async () => {
  const response = createResponse();
  const handler = createContactDetailsHandler({
    findConfig: async (key) => key === 'system' ? { value: JSON.stringify({ email: 'legacy@example.org' }) } : null,
  });

  await handler({}, response, (error) => { throw error; });

  assert.equal(response.body.data.email, 'legacy@example.org');
});