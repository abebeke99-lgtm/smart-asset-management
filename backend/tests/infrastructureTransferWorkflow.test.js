const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { sequelize, Infrastructure, Transfer, AuditLog, User } = require('../src/models');
const infrastructureController = require('../src/controllers/infrastructureController');

const makeTransaction = () => ({
  LOCK: { UPDATE: 'UPDATE' },
  finished: undefined,
  async commit() { this.finished = 'commit'; },
  async rollback() { this.finished = 'rollback'; },
});

const makeResponse = () => ({
  statusCode: 200,
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.payload = payload; return this; },
});

const setupController = (t, initialStatus = 'Operational') => {
  const originals = {
    transaction: sequelize.transaction,
    findByPk: Infrastructure.findByPk,
    auditCreate: AuditLog.create,
    unscoped: Transfer.unscoped,
  };
  const transaction = makeTransaction();
  const audits = [];
  const asset = {
    id: 17,
    name: 'Generator',
    assetCode: 'INFRA-17',
    serialNumber: 'SER-17',
    category: 'Generator',
    location: 'East Wing',
    department: 'Engineering',
    status: initialStatus,
    condition: 'Good',
    async update(values) { Object.assign(this, values); },
  };
  const transfer = {
    id: 31,
    assetType: 'infrastructure',
    assetId: asset.id,
    currentLocation: 'East Wing',
    newLocation: 'West Wing',
    destinationDepartment: 'Facilities',
    transferNumber: 'TRF-2026-31',
    transferReason: 'Reallocation',
    status: 'Pending',
    toJSON() { return { ...this }; },
    async update(values) { Object.assign(this, values); },
  };
  const records = {
    findOne: async ({ where }) => {
      assert.equal(where.assetType, 'infrastructure');
      return where.id !== undefined && transfer.id === Number(where.id) ? transfer : null;
    },
    create: async (values) => {
      Object.assign(transfer, values);
      return transfer;
    },
  };
  sequelize.transaction = async () => transaction;
  Infrastructure.findByPk = async () => asset;
  AuditLog.create = async (entry) => { audits.push(entry); };
  Transfer.unscoped = () => records;
  delete require.cache[require.resolve('../src/controllers/infrastructureTransferController')];
  const controller = require('../src/controllers/infrastructureTransferController');
  t.after(() => {
    sequelize.transaction = originals.transaction;
    Infrastructure.findByPk = originals.findByPk;
    AuditLog.create = originals.auditCreate;
    Transfer.unscoped = originals.unscoped;
    delete require.cache[require.resolve('../src/controllers/infrastructureTransferController')];
  });
  return { controller, asset, transfer, audits, transaction };
};

test('infrastructure transfer requests defer asset location and record requester audit', async (t) => {
  const { controller, asset, transfer, audits, transaction } = setupController(t);
  const response = makeResponse();

  await controller.create({
    body: {
      assetId: asset.id,
      fromLocationId: 'East Wing',
      toLocationId: 'West Wing',
      destinationDepartment: 'Facilities',
      reason: 'Reallocation',
    },
    user: { id: 8 },
  }, response, (error) => { throw error; });

  assert.equal(response.statusCode, 201);
  assert.equal(response.payload.data.status, 'Pending');
  assert.equal(transfer.assetType, 'infrastructure');
  assert.equal(asset.location, 'East Wing');
  assert.equal(transaction.finished, 'commit');
  assert.equal(audits[0].userId, 8);
  assert.equal(audits[0].action, 'TRANSFER_CREATED');
});

test('infrastructure transfer approval and receipt update the asset only at receipt', async (t) => {
  const { controller, asset, transfer, audits } = setupController(t);
  const approvedResponse = makeResponse();
  await controller.approve({ params: { id: transfer.id }, body: {}, user: { id: 9 } }, approvedResponse, (error) => { throw error; });

  assert.equal(approvedResponse.payload.data.status, 'Approved');
  assert.equal(asset.location, 'East Wing');
  assert.equal(audits.at(-1).userId, 9);
  assert.equal(audits.at(-1).action, 'TRANSFER_APPROVED');

  const receiptResponse = makeResponse();
  await controller.complete({ params: { id: transfer.id }, body: {}, user: { id: 10 } }, receiptResponse, (error) => { throw error; });

  assert.equal(receiptResponse.payload.data.status, 'Completed');
  assert.equal(asset.location, 'West Wing');
  assert.equal(asset.department, 'Facilities');
  assert.equal(asset.status, 'Operational');
  assert.equal(audits.at(-1).userId, 10);
  assert.equal(audits.at(-1).action, 'TRANSFER_COMPLETED');
});

test('pending infrastructure transfers can be rejected and cannot be received before approval', async (t) => {
  const { controller, asset, transfer, audits } = setupController(t);
  const invalidReceipt = makeResponse();
  await controller.complete({ params: { id: transfer.id }, body: {}, user: { id: 9 } }, invalidReceipt, (error) => { throw error; });
  assert.equal(invalidReceipt.statusCode, 409);
  assert.equal(asset.location, 'East Wing');

  const rejectedResponse = makeResponse();
  await controller.reject({ params: { id: transfer.id }, body: { reason: 'Not required' }, user: { id: 11 } }, rejectedResponse, (error) => { throw error; });
  assert.equal(rejectedResponse.payload.data.status, 'Rejected');
  assert.equal(asset.location, 'East Wing');
  assert.equal(transfer.approvalReason, 'Not required');
  assert.equal(audits.at(-1).userId, 11);
  assert.equal(audits.at(-1).action, 'TRANSFER_REJECTED');
});

test('infrastructure transfer actions remain authenticated and role-gated', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/routes/infrastructureRoutes.js'), 'utf8');
  const migration = fs.readFileSync(path.resolve(__dirname, '../database/migrations/20261013_infrastructure_transfer_asset_type.sql'), 'utf8');
  assert.match(source, /router\.use\(requireAuth\)/);
  assert.match(source, /router\.patch\('\/transfer\/:id\/reject', requireRole\('admin', 'infrastructure'\), infrastructureTransfer\.reject\)/);
  assert.equal(Transfer.options.defaultScope.where.assetType, 'asset');
  assert.match(migration, /ADD COLUMN asset_type VARCHAR\(32\) NOT NULL DEFAULT 'asset'/);
});

test('infrastructure assets apply backend filters and return accurate fields, status counts, and pagination', async (t) => {
  const originals = {
    findAndCountAll: Infrastructure.findAndCountAll,
    findAll: Infrastructure.findAll,
    userFindAll: User.findAll,
  };
  let listQuery;
  Infrastructure.findAndCountAll = async (options) => {
    listQuery = options;
    return {
      count: 7,
      rows: [{
        id: 22,
        assignedTo: 55,
        toJSON: () => ({
          id: 22, name: 'Generator', assetCode: 'INFRA-22',
          serialNumber: 'GEN-22', category: 'Generator',
          type: 'Fixed Asset', location: 'East Wing',
          status: 'Operational', createdAt: '2026-01-02T00:00:00.000Z',
        }),
      }],
    };
  };
  Infrastructure.findAll = async ({ attributes }) => {
    if (attributes.includes('condition')) {
      return [
        { status: 'Operational', condition: 'Good' },
        { status: 'Under Maintenance', condition: 'Fair' },
        { status: 'Missing', condition: 'Critical' },
      ];
    }
    if (attributes[0] === 'category') return [{ category: 'Generator' }];
    if (attributes[0] === 'location') return [{ location: 'East Wing' }];
    return [{ status: 'Operational' }, { status: 'Under Maintenance' }, { status: 'Missing' }];
  };
  User.findAll = async () => [{ id: 55, fullName: 'Alem Bekele', username: 'alem' }];
  t.after(() => {
    Infrastructure.findAndCountAll = originals.findAndCountAll;
    Infrastructure.findAll = originals.findAll;
    User.findAll = originals.userFindAll;
  });

  const response = makeResponse();
  await infrastructureController.getAllInfrastructureAssets({
    query: { page: '2', limit: '5', search: 'gen', category: 'Generator', location: 'East Wing', status: 'Operational' },
  }, response);

  assert.equal(listQuery.limit, 5);
  assert.equal(listQuery.offset, 5);
  assert.equal(listQuery.where.category, 'Generator');
  assert.equal(listQuery.where.location, 'East Wing');
  assert.equal(listQuery.where.status, 'Operational');
  assert.equal(response.payload.data[0].assetCode, 'INFRA-22');
  assert.equal(response.payload.data[0].serialNumber, 'GEN-22');
  assert.equal(response.payload.data[0].assignedToName, 'Alem Bekele');
  assert.deepEqual(response.payload.summary, {
    total: 3, operational: 1, maintenance: 1, critical: 1, missing: 1,
  });
  assert.deepEqual(response.payload.pagination, {
    page: 2, limit: 5, total: 7, pages: 2, totalPages: 2,
  });
});

test('infrastructure inventory keeps field mapping explicit and summaries independent of active filters', async (t) => {
  const originals = {
    findAndCountAll: Infrastructure.findAndCountAll,
    findAll: Infrastructure.findAll,
    userFindAll: User.findAll,
  };
  let listQuery;
  Infrastructure.findAndCountAll = async (options) => {
    listQuery = options;
    return {
      count: 1,
      rows: [{
        assignedTo: 55,
        toJSON: () => ({
          id: 22,
          name: 'Generator',
          assetCode: 'INFRA-22',
          serialNumber: 'GEN-22',
          category: 'Generator',
          type: 'Fixed Asset',
          status: 'Operational',
          location: 'East Wing',
          purchaseDate: '2026-01-02T00:00:00.000Z',
          assignedTo: 55,
        }),
      }],
    };
  };
  Infrastructure.findAll = async (options) => {
    assert.equal(options.where, undefined, 'summary and filter choices must cover the full inventory');
    if (options.attributes.includes('assignedTo')) {
      return [
        { status: 'Operational', condition: 'Good', assignedTo: null },
        { status: 'Operational', condition: 'Good', assignedTo: 55 },
        { status: 'Under Maintenance', condition: 'Fair', assignedTo: null },
        { status: 'Missing', condition: 'Critical', assignedTo: null },
      ];
    }
    if (options.attributes[0] === 'category') return [{ category: 'Generator' }];
    if (options.attributes[0] === 'location') return [{ location: 'East Wing' }];
    if (options.attributes[0] === 'condition') return [{ condition: 'Fair' }, { condition: 'Good' }];
    return [{ status: 'Missing' }, { status: 'Operational' }, { status: 'Under Maintenance' }];
  };
  User.findAll = async () => [{ id: 55, fullName: 'Alem Bekele', username: 'alem' }];
  t.after(() => {
    Infrastructure.findAndCountAll = originals.findAndCountAll;
    Infrastructure.findAll = originals.findAll;
    User.findAll = originals.userFindAll;
  });

  const response = makeResponse();
  await infrastructureController.getInfrastructureInventory({
    query: { page: '2', limit: '5', status: 'Operational', category: 'Generator', location: 'East Wing', search: 'gen' },
  }, response);

  assert.equal(listQuery.where.status, 'Operational');
  assert.equal(listQuery.where.category, 'Generator');
  assert.equal(listQuery.where.location, 'East Wing');
  assert.equal(response.payload.data.assets[0].assetCode, 'INFRA-22');
  assert.equal(response.payload.data.assets[0].serialNumber, 'GEN-22');
  assert.equal(response.payload.data.assets[0].category, 'Generator');
  assert.equal(response.payload.data.assets[0].status, 'Operational');
  assert.equal(response.payload.data.assets[0].location, 'East Wing');
  assert.equal(response.payload.data.assets[0].assignedToName, 'Alem Bekele');
  assert.deepEqual(response.payload.data.summary, {
    total: 4, available: 1, assigned: 1, maintenance: 1, missing: 1, damaged: 0, disposed: 0,
  });
  assert.deepEqual(response.payload.data.filters, {
    categories: ['Generator'],
    locations: ['East Wing'],
    conditions: ['Fair', 'Good'],
    statuses: ['Missing', 'Operational', 'Under Maintenance'],
  });
  assert.deepEqual(response.payload.pagination, { page: 2, limit: 5, total: 1, pages: 1 });
});

test('infrastructure asset creation reports duplicate identifiers as a conflict', async (t) => {
  const originals = {
    findOne: Infrastructure.findOne,
    create: Infrastructure.create,
  };
  let createCalled = false;
  Infrastructure.findOne = async () => ({ id: 1 });
  Infrastructure.create = async () => { createCalled = true; };
  t.after(() => {
    Infrastructure.findOne = originals.findOne;
    Infrastructure.create = originals.create;
  });

  const response = makeResponse();
  await infrastructureController.createInfrastructureAsset({
    body: { name: 'Generator', category: 'Electrical Equipment', assetCode: 'INFRA-1' },
    user: { id: 9 },
  }, response);

  assert.equal(response.statusCode, 409);
  assert.match(response.payload.message, /already exists/i);
  assert.equal(createCalled, false);
});

test('infrastructure asset updates only editable fields and reject duplicate identifiers', async (t) => {
  const originals = {
    findByPk: Infrastructure.findByPk,
    findOne: Infrastructure.findOne,
  };
  const asset = {
    id: 22,
    async update(values) { Object.assign(this, values); },
  };
  let updateLookup;
  Infrastructure.findByPk = async () => asset;
  Infrastructure.findOne = async (options) => {
    updateLookup = options;
    return { id: 23 };
  };
  t.after(() => {
    Infrastructure.findByPk = originals.findByPk;
    Infrastructure.findOne = originals.findOne;
  });

  const response = makeResponse();
  await infrastructureController.updateInfrastructureAsset({
    params: { id: '22' },
    body: { name: 'Generator 2', category: 'Generator', serialNumber: 'SER-23', assignedTo: 999, createdBy: 9 },
  }, response);

  assert.equal(response.statusCode, 409);
  assert.equal(updateLookup.where.id[require('sequelize').Op.ne], 22);
  assert.equal(updateLookup.where[require('sequelize').Op.or][0].serialNumber, 'SER-23');
  assert.equal(asset.name, undefined, 'a conflicting update must not modify the asset');
});
