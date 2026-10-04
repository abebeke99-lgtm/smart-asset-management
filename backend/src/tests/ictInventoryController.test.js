const test = require('node:test');
const assert = require('node:assert/strict');
const { Op } = require('sequelize');
const models = require('../models');
const { getInventory, importInventory } = require('../controllers/ictInventoryController');

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

const stub = (model, method, replacement) => {
  const original = model[method];
  model[method] = replacement;
  return () => { model[method] = original; };
};

const setupLookups = () => [
  stub(models.Category, 'findAll', async () => [{ id: 3, name: 'Computer Equipment' }]),
  stub(models.Department, 'findAll', async () => [{ id: 8, name: 'ICT Services', collegeId: 5 }]),
  stub(models.College, 'findAll', async () => [{ id: 5, collegeName: 'Science College', campusId: 2 }]),
  stub(models.Campus, 'findAll', async () => [{ id: 2, campusName: 'Main Campus' }]),
];

test('ICT inventory GET returns scoped, paginated assets and status totals', async () => {
  const restore = setupLookups();
  let assetQuery;
  let countCall = 0;
  restore.push(stub(models.Asset, 'findAndCountAll', async (query) => {
    assetQuery = query;
    return {
      rows: [{
        toJSON: () => ({
          id: 4,
          name: 'Laptop',
          assetCode: 'ICT-004',
          CampusRecord: { campusName: 'Main Campus' },
          College: { collegeName: 'Science College' },
          DepartmentRecord: { name: 'ICT Services' },
        }),
      }],
      count: 6,
    };
  }));
  restore.push(stub(models.Asset, 'count', async () => {
    countCall += 1;
    return [20, 3, 2][countCall - 1];
  }));
  restore.push(stub(models.Asset, 'findAll', async (query) => {
    if (query.group) {
      return [
        { status: 'available', count: '8' },
        { status: 'assigned', count: '5' },
        { status: 'under-maintenance', count: '2' },
        { status: 'missing', count: '1' },
        { status: 'replaced', count: '1' },
      ];
    }
    return [];
  }));
  try {
    const req = {
      user: { id: 10, role: 'ict_officer' },
      organizationScope: { collegeId: 5 },
      query: {
        page: '2',
        limit: '5',
        search: 'laptop',
        category: 'Computer Equipment',
        status: 'assigned',
        condition: 'Good',
        campusId: '2',
        collegeId: '5',
        departmentId: '8',
        location: 'Room 12',
        sortBy: 'name',
        sortOrder: 'ASC',
      },
    };
    const res = createResponse();
    let nextError;
    await getInventory(req, res, (error) => { nextError = error; });

    assert.equal(nextError, undefined);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data[0].campus, 'Main Campus');
    assert.equal(res.body.data[0].college, 'Science College');
    assert.equal(res.body.data[0].departmentName, 'ICT Services');
    assert.equal(res.body.summary.totalItems, 20);
    assert.equal(res.body.summary.available, 8);
    assert.equal(res.body.summary.assigned, 5);
    assert.equal(res.body.summary.damaged, 3);
    assert.equal(res.body.summary.missing, 1);
    assert.equal(res.body.summary.underMaintenance, 2);
    assert.equal(res.body.summary.replaced, 1);
    assert.equal(res.body.summary.expired, 2);
    assert.equal(res.body.pagination.page, 2);
    assert.equal(res.body.pagination.limit, 5);
    assert.equal(res.body.pagination.totalPages, 2);
    assert.equal(assetQuery.offset, 5);
    assert.deepEqual(assetQuery.order, [['name', 'ASC']]);
    assert.ok(assetQuery.where[Op.and].some((filter) => filter.collegeId === 5));
    assert.ok(assetQuery.where[Op.and].some((filter) => filter.departmentId === 8));
  } finally {
    restore.reverse().forEach((reset) => reset());
  }
});

test('ICT inventory import preview reports duplicates and invalid fields without writing', async () => {
  const restore = setupLookups();
  restore.push(stub(models.Asset, 'findAll', async () => [{ serialNumber: 'SER-DB' }]));
  let transactionCalls = 0;
  restore.push(stub(models.sequelize, 'transaction', async () => {
    transactionCalls += 1;
    throw new Error('Preview must not start a transaction');
  }));
  try {
    const req = {
      user: { id: 10, role: 'ict_officer' },
      organizationScope: { collegeId: 5 },
      body: {
        preview: true,
        rows: [
          { 'Asset Name': 'Laptop', Category: 'Computer Equipment', Department: 'ICT Services', Status: 'Available', 'Serial Number': 'SER-DB' },
          { 'Asset Name': '', Category: 'Nonexistent', Department: 'ICT Services', Status: 'Not a status', 'Purchase Date': '2/30/2024' },
        ],
      },
    };
    const res = createResponse();
    let nextError;
    await importInventory(req, res, (error) => { nextError = error; });

    assert.equal(nextError, undefined);
    assert.equal(res.body.success, true);
    assert.equal(res.body.summary.total, 2);
    assert.equal(res.body.summary.valid, 0);
    assert.equal(res.body.summary.duplicates, 1);
    assert.equal(res.body.summary.errors, 1);
    assert.ok(res.body.results[0].duplicate);
    assert.deepEqual(
      res.body.results[1].errors.map((item) => item.field),
      ['name', 'category', 'status', 'purchaseDate']
    );
    assert.equal(transactionCalls, 0);
  } finally {
    restore.reverse().forEach((reset) => reset());
  }
});

test('ICT inventory import does not write rows with duplicate serial numbers', async () => {
  const restore = setupLookups();
  restore.push(stub(models.Asset, 'findAll', async () => []));
  let createdRecords;
  let committed = false;
  let rolledBack = false;
  restore.push(stub(models.Asset, 'bulkCreate', async (records, options) => {
    createdRecords = records;
    assert.ok(options.transaction);
    return records.map((record, index) => ({ id: index + 1, ...record }));
  }));
  restore.push(stub(models.AuditLog, 'create', async () => ({})));
  restore.push(stub(models.sequelize, 'transaction', async () => ({
    finished: false,
    async commit() { committed = true; this.finished = 'commit'; },
    async rollback() { rolledBack = true; this.finished = 'rollback'; },
  })));
  try {
    const req = {
      user: { id: 10, role: 'ict_officer' },
      organizationScope: { collegeId: 5 },
      body: {
        rows: [
          { 'Asset Name': 'Laptop A', Category: 'Computer Equipment', Department: 'ICT Services', Status: 'In Use', 'Serial Number': 'SER-01', Location: 'Room 2' },
          { 'Asset Name': 'Laptop B', Category: 'Computer Equipment', Department: 'ICT Services', Status: 'Available', 'Serial Number': 'SER-01' },
        ],
      },
    };
    const res = createResponse();
    let nextError;
    await importInventory(req, res, (error) => { nextError = error; });

    assert.equal(nextError, undefined);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.summary, {
      total: 2,
      imported: 0,
      rejected: 2,
      duplicates: 2,
      errors: 0,
      valid: 0,
    });
    assert.equal(createdRecords, undefined);
    assert.equal(committed, false);
    assert.equal(rolledBack, false);
  } finally {
    restore.reverse().forEach((reset) => reset());
  }
});

test('ICT inventory import persists valid rows and commits the audit entry', async () => {
  const restore = setupLookups();
  restore.push(stub(models.Asset, 'findAll', async () => []));
  let createdRecords;
  let auditEntry;
  let committed = false;
  restore.push(stub(models.Asset, 'bulkCreate', async (records) => {
    createdRecords = records;
    return records.map((record, index) => ({ id: index + 1, ...record }));
  }));
  restore.push(stub(models.AuditLog, 'create', async (entry, options) => {
    auditEntry = { entry, options };
  }));
  restore.push(stub(models.sequelize, 'transaction', async () => ({
    finished: false,
    async commit() { committed = true; this.finished = 'commit'; },
    async rollback() { this.finished = 'rollback'; },
  })));
  try {
    const req = {
      user: { id: 10, role: 'ict_officer' },
      organizationScope: { collegeId: 5 },
      body: {
        rows: [
          { 'Asset Name': 'Laptop A', Category: 'Computer Equipment', Department: 'ICT Services', Status: 'In Use', 'Serial Number': 'SER-01', Campus: 'Main Campus', Location: 'Room 2' },
        ],
      },
    };
    const res = createResponse();
    let nextError;
    await importInventory(req, res, (error) => { nextError = error; });

    assert.equal(nextError, undefined);
    assert.equal(res.statusCode, 201);
    assert.deepEqual(res.body.summary, {
      total: 1,
      imported: 1,
      rejected: 0,
      duplicates: 0,
      errors: 0,
      valid: 1,
    });
    assert.equal(createdRecords[0].name, 'Laptop A');
    assert.equal(createdRecords[0].departmentId, 8);
    assert.equal(createdRecords[0].collegeId, 5);
    assert.equal(createdRecords[0].campusId, 2);
    assert.equal(createdRecords[0].status, 'in-use');
    assert.equal(auditEntry.entry.action, 'ICT_INVENTORY_IMPORT');
    assert.ok(auditEntry.options.transaction);
    assert.equal(committed, true);
  } finally {
    restore.reverse().forEach((reset) => reset());
  }
});
