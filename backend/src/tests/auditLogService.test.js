const test = require('node:test');
const assert = require('node:assert/strict');
const { AuditLog } = require('../models');
const { createAuditLog } = require('../services/auditLogService');

test('audit writer stores normalized metadata in existing details and redacts secrets', async () => {
  const originalCreate = AuditLog.create;
  let values;
  AuditLog.create = async (record) => { values = record; return record; };

  try {
    const timestamp = new Date('2026-09-28T12:00:00.000Z');
    await createAuditLog({
      userId: 7,
      role: 'admin',
      action: 'UPDATE_ASSET',
      entity: 'asset:42',
      timestamp,
      oldValue: { status: 'available', password_hash: 'old-secret' },
      newValue: { status: 'assigned', nested: { jwtSecret: 'private', note: 'visible' } },
      details: { legacyField: 'preserved' },
    });

    const details = JSON.parse(values.details);
    assert.equal(values.userId, 7);
    assert.equal(values.action, 'UPDATE_ASSET');
    assert.equal(values.entity, 'asset:42');
    assert.equal(values.createdAt.toISOString(), timestamp.toISOString());
    assert.equal(details.user.id, 7);
    assert.equal(details.role, 'admin');
    assert.equal(details.entity_id, '42');
    assert.equal(details.timestamp, timestamp.toISOString());
    assert.deepEqual(details.old_value, { status: 'available' });
    assert.deepEqual(details.new_value, { status: 'assigned', nested: { note: 'visible' } });
    assert.deepEqual(details.previousValue, details.old_value);
    assert.deepEqual(details.newValue, details.new_value);
    assert.equal(details.legacyField, 'preserved');
  } finally {
    AuditLog.create = originalCreate;
  }
});

test('audit writer forwards the existing database transaction', async () => {
  const originalCreate = AuditLog.create;
  const transaction = { id: 'transaction' };
  let options;
  AuditLog.create = async (_record, createOptions) => { options = createOptions; };

  try {
    await createAuditLog({ userId: 1, role: 'admin', action: 'CREATE_ASSET', entity: 'asset:1', transaction });
    assert.equal(options.transaction, transaction);
  } finally {
    AuditLog.create = originalCreate;
  }
});
