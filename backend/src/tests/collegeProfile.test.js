const test = require('node:test');
const assert = require('node:assert/strict');
const { College, AuditLog } = require('../models');
const { updateCollegeProfile } = require('../controllers/collegeController');

const makeResponse = () => ({
  statusCode: 200,
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.payload = payload; return this; },
});

const makeCollege = () => ({
  id: 4,
  collegeName: 'Engineering College',
  description: '',
  location: '',
  phone: '',
  email: '',
  toJSON() {
    return {
      id: this.id,
      collegeName: this.collegeName,
      description: this.description,
      location: this.location,
      phone: this.phone,
      email: this.email,
    };
  },
  async update(values) { Object.assign(this, values); },
});

test('college profile update rejects malformed phone values without writing', async (t) => {
  const originalFindByPk = College.findByPk;
  const college = makeCollege();
  let auditWrites = 0;
  College.findByPk = async () => college;
  const originalAuditCreate = AuditLog.create;
  AuditLog.create = async () => { auditWrites += 1; };
  t.after(() => {
    College.findByPk = originalFindByPk;
    AuditLog.create = originalAuditCreate;
  });

  for (const phone of ['+++++++', '123456', '1234567890123456', '12+34567']) {
    const response = makeResponse();
    let forwardedError;
    await updateCollegeProfile({
      organizationScope: { collegeId: 4 },
      user: { id: 2, role: 'college_manager' },
      body: { collegeName: college.collegeName, phone },
    }, response, (error) => { forwardedError = error; });
    assert.equal(forwardedError, undefined);
    assert.equal(response.statusCode, 400);
    assert.match(response.payload.message, /7 to 15 digits/);
  }
  assert.equal(auditWrites, 0);
});

test('college profile update accepts formatted phone numbers with 7 to 15 digits', async (t) => {
  const originalFindByPk = College.findByPk;
  const originalAuditCreate = AuditLog.create;
  const college = makeCollege();
  let auditWrites = 0;
  College.findByPk = async () => college;
  AuditLog.create = async () => { auditWrites += 1; };
  t.after(() => {
    College.findByPk = originalFindByPk;
    AuditLog.create = originalAuditCreate;
  });

  const phone = '+251 (911) 234-567';
  const response = makeResponse();
  let forwardedError;
  await updateCollegeProfile({
    organizationScope: { collegeId: 4 },
    user: { id: 2, role: 'college_manager' },
    body: { collegeName: college.collegeName, phone },
  }, response, (error) => { forwardedError = error; });

  assert.equal(forwardedError, undefined);
  assert.equal(response.statusCode, 200);
  assert.equal(response.payload.data.phone, phone);
  assert.equal(auditWrites, 1);
});
