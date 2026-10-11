const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Approval = require('../models/Approval');

const migration = fs.readFileSync(
  path.resolve(__dirname, '../../database/migrations/20261011_approval_fulfillment_timestamp.sql'),
  'utf8',
);
const requestDetailsMigration = fs.readFileSync(
  path.resolve(__dirname, '../../database/migrations/20261012_approval_request_details.sql'),
  'utf8',
);

test('approval fulfillment timestamp model attribute has an idempotent additive migration', () => {
  assert.equal(Approval.rawAttributes.fulfilledAt.field, 'fulfilled_at');
  assert.equal(Approval.rawAttributes.fulfilledAt.allowNull, true);
  assert.match(migration, /TABLE_NAME = 'approvals'[\s\S]*?COLUMN_NAME = 'fulfilled_at'/);
  assert.match(migration, /ALTER TABLE approvals ADD COLUMN fulfilled_at DATETIME NULL/);
  assert.doesNotMatch(migration, /DROP TABLE|DROP COLUMN|TRUNCATE|DELETE FROM/i);
});

test('approval request details have nullable model attributes and an idempotent additive migration', () => {
  assert.equal(Approval.rawAttributes.requestedFor.field, 'requested_for');
  assert.equal(Approval.rawAttributes.requestedFor.allowNull, true);
  assert.equal(Approval.rawAttributes.requiredDate.field, 'required_date');
  assert.equal(Approval.rawAttributes.requiredDate.allowNull, true);
  assert.equal(Approval.rawAttributes.requiredDate.type.key, 'DATEONLY');
  assert.match(requestDetailsMigration, /TABLE_NAME = 'approvals'[\s\S]*?COLUMN_NAME = 'requested_for'/);
  assert.match(requestDetailsMigration, /ALTER TABLE approvals ADD COLUMN requested_for INT NULL/);
  assert.match(requestDetailsMigration, /TABLE_NAME = 'approvals'[\s\S]*?COLUMN_NAME = 'required_date'/);
  assert.match(requestDetailsMigration, /ALTER TABLE approvals ADD COLUMN required_date DATE NULL/);
  assert.doesNotMatch(requestDetailsMigration, /DROP TABLE|DROP COLUMN|TRUNCATE|DELETE FROM/i);
});
