const test = require('node:test');
const assert = require('node:assert/strict');
const { Op } = require('sequelize');
const { sequelize, Asset, DepartmentAssetVerification, User, AuditLog } = require('../models');
const controller = require('../controllers/departmentVerificationController');

const makeResponse = () => ({
  statusCode: 200,
  payload: null,
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.payload = payload; return this; },
});

const request = (body = {}, overrides = {}) => ({
  organizationScope: { departmentId: 12, collegeId: 4 },
  user: { id: 8 },
  body,
  query: {},
  ...overrides,
});

const asset = {
  id: 34,
  assetCode: 'AST-034',
  name: 'Microscope',
  location: 'Science Lab',
  condition: 'Good',
  qrCode: 'QR-034',
};

const verifyBody = (overrides = {}) => ({
  asset_id: 34,
  actual_location: 'Science Lab',
  actual_condition: 'Good',
  verification_date: '2026-10-06',
  exceptions: '',
  ...overrides,
});

const mockAuditTransaction = (t) => {
  const originals = { transaction: sequelize.transaction, auditCreate: AuditLog.create };
  let auditRecord;
  const transaction = { finished: false, commit: async function commit() { this.finished = 'commit'; }, rollback: async function rollback() { this.finished = 'rollback'; } };
  sequelize.transaction = async () => transaction;
  AuditLog.create = async (values, options) => { auditRecord = { values, options }; };
  t.after(() => {
    sequelize.transaction = originals.transaction;
    AuditLog.create = originals.auditCreate;
  });
  return { transaction, getAudit: () => auditRecord };
};

test('normal physical verification records the expected asset, date, and authenticated verifier', async (t) => {
  const audit = mockAuditTransaction(t);
  const originals = { findOne: Asset.findOne, create: DepartmentAssetVerification.create };
  let assetQuery;
  let created;
  Asset.findOne = async (options) => { assetQuery = options; return asset; };
  DepartmentAssetVerification.create = async (values) => { created = values; return { id: 1, ...values }; };
  t.after(() => {
    Asset.findOne = originals.findOne;
    DepartmentAssetVerification.create = originals.create;
  });

  const response = makeResponse();
  await controller.createVerification(request(verifyBody()), response, (error) => { throw error; });

  assert.equal(response.statusCode, 201);
  assert.equal(assetQuery.where.departmentId, 12);
  assert.equal(created.departmentId, 12);
  assert.equal(created.expectedLocation, 'Science Lab');
  assert.equal(created.actualLocation, 'Science Lab');
  assert.equal(created.verificationDate, '2026-10-06');
  assert.equal(created.verifiedBy, 8);
  assert.equal(created.exceptions, '');
  assert.equal(audit.transaction.finished, 'commit');
  assert.equal(audit.getAudit().values.action, 'DEPARTMENT_ASSET_VERIFIED');
  assert.equal(audit.getAudit().values.entity, 'asset:34');
  assert.equal(audit.getAudit().options.transaction, audit.transaction);
});

test('location mismatch is persisted as an exception', async (t) => {
  mockAuditTransaction(t);
  const original = DepartmentAssetVerification.create;
  let created;
  Asset.findOne = async () => asset;
  DepartmentAssetVerification.create = async (values) => { created = values; return values; };
  t.after(() => {
    Asset.findOne = originalAssetFindOne;
    DepartmentAssetVerification.create = original;
  });

  const response = makeResponse();
  await controller.createVerification(request(verifyBody({ actual_location: 'Storage Room', exceptions: 'Room label is missing.' })), response, (error) => { throw error; });

  assert.equal(response.statusCode, 201);
  assert.match(created.exceptions, /Location mismatch: expected "Science Lab", found "Storage Room"/);
  assert.match(created.exceptions, /Room label is missing/);
});

test('condition mismatch is persisted as an exception', async (t) => {
  mockAuditTransaction(t);
  const originalFindOne = Asset.findOne;
  const originalCreate = DepartmentAssetVerification.create;
  let created;
  Asset.findOne = async () => asset;
  DepartmentAssetVerification.create = async (values) => { created = values; return values; };
  t.after(() => {
    Asset.findOne = originalFindOne;
    DepartmentAssetVerification.create = originalCreate;
  });

  const response = makeResponse();
  await controller.createVerification(request(verifyBody({ actual_condition: 'Damaged' })), response, (error) => { throw error; });

  assert.equal(response.statusCode, 201);
  assert.equal(created.expectedCondition, 'Good');
  assert.equal(created.actualCondition, 'Damaged');
  assert.match(created.exceptions, /Condition mismatch: expected "Good", found "Damaged"/);
});

test('QR verification resolves only an asset in the caller department and saves the scanned code', async (t) => {
  mockAuditTransaction(t);
  const originalFindOne = Asset.findOne;
  const originalCreate = DepartmentAssetVerification.create;
  let query;
  let created;
  Asset.findOne = async (options) => { query = options; return asset; };
  DepartmentAssetVerification.create = async (values) => { created = values; return values; };
  t.after(() => {
    Asset.findOne = originalFindOne;
    DepartmentAssetVerification.create = originalCreate;
  });

  const response = makeResponse();
  await controller.createVerification(request(verifyBody({ asset_id: undefined, qr_code: ' qr-034 ' })), response, (error) => { throw error; });

  assert.equal(response.statusCode, 201);
  assert.equal(query.where.departmentId, 12);
  assert.equal(query.where[Op.or][0].qrCode, 'QR-034');
  assert.equal(created.scannedQrCode, 'QR-034');
});

test('QR identifying an asset outside the department is denied and never creates a record', async (t) => {
  const originalFindOne = Asset.findOne;
  const originalCreate = DepartmentAssetVerification.create;
  let query;
  let createCalled = false;
  Asset.findOne = async (options) => { query = options; return null; };
  DepartmentAssetVerification.create = async () => { createCalled = true; };
  t.after(() => {
    Asset.findOne = originalFindOne;
    DepartmentAssetVerification.create = originalCreate;
  });

  const response = makeResponse();
  await controller.createVerification(request({ qr_code: 'QR-FOREIGN' }), response, (error) => { throw error; });

  assert.equal(response.statusCode, 404);
  assert.equal(query.where.departmentId, 12);
  assert.equal(createCalled, false);
});

test('verification history is filtered to the resolved department', async (t) => {
  const original = DepartmentAssetVerification.findAndCountAll;
  let query;
  DepartmentAssetVerification.findAndCountAll = async (options) => {
    query = options;
    return { count: 1, rows: [{ id: 1 }] };
  };
  t.after(() => { DepartmentAssetVerification.findAndCountAll = original; });

  const response = makeResponse();
  await controller.listVerifications(request(undefined, { query: { page: '2', limit: '5' } }), response, (error) => { throw error; });

  assert.deepEqual(query.where, { departmentId: 12 });
  assert.equal(query.limit, 5);
  assert.equal(query.offset, 5);
  assert.equal(query.include.find((entry) => entry.model === User).as, 'Verifier');
  assert.equal(response.payload.pagination.total, 1);
});

test('verification rejects missing department scope before asset lookup', async (t) => {
  const original = Asset.findOne;
  let lookedUp = false;
  Asset.findOne = async () => { lookedUp = true; return asset; };
  t.after(() => { Asset.findOne = original; });

  const response = makeResponse();
  await controller.createVerification(request(verifyBody(), { organizationScope: {} }), response, (error) => { throw error; });

  assert.equal(response.statusCode, 403);
  assert.equal(lookedUp, false);
});

const originalAssetFindOne = Asset.findOne;
