const test = require('node:test');
const assert = require('node:assert/strict');
const { Op } = require('sequelize');
const controller = require('../src/controllers/ictAssetController');
const { Asset, Assignment, AuditLog, Category, Department, User } = require('../src/models');
const assetController = require('../src/controllers/assetController');
const maintenanceController = require('../src/controllers/maintenanceController');

const originals = {
  assetFindAndCountAll: Asset.findAndCountAll,
  assetFindAll: Asset.findAll,
  assetFindOne: Asset.findOne,
  auditLogCreate: AuditLog.create,
  assignmentFindAll: Assignment.findAll,
  categoryFindAll: Category.findAll,
  categoryFindOne: Category.findOne,
  departmentFindAll: Department.findAll,
  departmentFindOne: Department.findOne,
  createAsset: assetController.createAsset,
  createMaintenance: maintenanceController.createMaintenance,
  userFindAll: User.findAll,
};

test('ICT asset list scopes ICT data and applies real filters, sorting, and pagination', async () => {
  let listQuery;
  let assignmentQueries = [];
  Asset.findAndCountAll = async (query) => {
    listQuery = query;
    return {
      count: 21,
      rows: [{ id: 42, name: 'Laptop 42', assetCode: 'ICT-42', category: 'Laptop', status: 'assigned' }],
    };
  };
  Asset.findAll = async () => [
    { status: 'available' },
    { status: 'assigned' },
    { status: 'under maintenance' },
    { status: 'missing' },
  ];
  User.findAll = async () => [];
  Assignment.findAll = async (query) => {
    assignmentQueries.push(query);
    return [{ assetId: 42 }];
  };

  const req = {
    user: { id: 9, role: 'ict_officer' },
    organizationScope: { collegeId: 5 },
    query: {
      search: '42', category: 'Laptop', status: 'assigned', condition: 'Good',
      department: 'ICT', assignmentStatus: 'assigned', sortBy: 'cost',
      sortOrder: 'ASC', page: '2', limit: '10',
    },
  };
  const res = { json(payload) { this.payload = payload; return payload; } };

  await controller.listIctAssets(req, res, (error) => { throw error; });

  assert.equal(listQuery.where.collegeId, 5);
  assert.equal(listQuery.where.category, 'Laptop');
  assert.equal(listQuery.where.status, 'assigned');
  assert.equal(listQuery.where.condition, 'Good');
  assert.equal(listQuery.where.department, 'ICT');
  assert.ok(listQuery.where[Op.or].some((clause) => clause.category?.[Op.like] === '%laptop%'));
  assert.ok(listQuery.where[Op.or].some((clause) => clause.name?.[Op.like] === '%network%'));
  const searchClause = listQuery.where[Op.and].find((clause) => clause[Op.or]);
  assert.ok(searchClause[Op.or].some((clause) => clause.id === 42), 'numeric search matches the database asset ID');
  assert.deepEqual(listQuery.order, [['purchasePrice', 'ASC']]);
  assert.equal(listQuery.limit, 10);
  assert.equal(listQuery.offset, 10);
  assert.equal(assignmentQueries[0].include[0].where.collegeId, 5);
  assert.equal(res.payload.total, 21);
  assert.deepEqual(res.payload.summary, { total: 4, assigned: 1, available: 1, maintenance: 1, missing: 1 });
  assert.deepEqual(res.payload.pagination, { page: 2, limit: 10, total: 21, pages: 3, totalPages: 3 });
});

test('empty ICT asset results have real zero summary values and a stable one-page response', async () => {
  Asset.findAndCountAll = async () => ({ count: 0, rows: [] });
  Asset.findAll = async () => [];
  Assignment.findAll = async () => [];
  User.findAll = async () => [];
  const req = { user: { id: 1, role: 'admin' }, query: { page: '1', limit: '25' } };
  const res = { json(payload) { this.payload = payload; return payload; } };

  await controller.listIctAssets(req, res, (error) => { throw error; });

  assert.deepEqual(res.payload.assets, []);
  assert.equal(res.payload.total, 0);
  assert.deepEqual(res.payload.summary, { total: 0, assigned: 0, available: 0, maintenance: 0, missing: 0 });
  assert.deepEqual(res.payload.pagination, { page: 1, limit: 25, total: 0, pages: 1, totalPages: 1 });
});

test('ICT filter options exclude non-ICT catalog values and keep departments in college scope', async () => {
  let categoryQuery;
  let departmentQuery;
  Category.findAll = async (query) => { categoryQuery = query; return []; };
  Department.findAll = async (query) => { departmentQuery = query; return []; };
  Asset.findAll = async () => [];
  const req = {
    user: { id: 9, role: 'ict_officer' },
    organizationScope: { collegeId: 5 },
  };
  const res = { json(payload) { this.payload = payload; return payload; } };

  await controller.getIctOptions(req, res, (error) => { throw error; });

  assert.equal(categoryQuery.where.status, 'active');
  assert.ok(categoryQuery.where[Op.or].some((clause) => clause.name[Op.like] === '%computer%'));
  assert.ok(categoryQuery.where[Op.or].some((clause) => clause.name[Op.like] === '%network%'));
  assert.equal(departmentQuery.where.collegeId, 5);
  assert.deepEqual(res.payload.categories, []);
  assert.deepEqual(res.payload.departments, []);
});

test('ICT asset creation delegates blank asset codes to the existing backend generator', async () => {
  let duplicateLookups = 0;
  let createdBody;
  Asset.findOne = async () => { duplicateLookups += 1; return null; };
  Category.findOne = async () => ({ id: 1, name: 'Laptop' });
  Department.findOne = async () => ({ id: 2, name: 'Engineering', collegeId: 5 });
  assetController.createAsset = async (req, res) => {
    createdBody = req.body;
    return res.status(201).json({ success: true, data: { assetCode: 'ICT-42' } });
  };
  const req = {
    user: { id: 9, role: 'ict_officer' },
    organizationScope: { collegeId: 5 },
    body: { asset_id: '', name: 'Test Laptop', category_id: '1', department_id: '2' },
  };
  const res = {
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return payload; },
  };

  await controller.createIctAsset(req, res, (error) => { throw error; });

  assert.equal(duplicateLookups, 0);
  assert.equal(createdBody.assetCode, '');
  assert.equal(createdBody.category, 'Laptop');
  assert.equal(createdBody.departmentId, 2);
  assert.equal(createdBody.collegeId, 5);
  assert.equal(res.statusCode, 201);
  assert.equal(res.payload.data.assetCode, 'ICT-42');
});

test('ICT maintenance requests first validate the asset against ICT organization scope', async () => {
  let assetQuery;
  let maintenanceRequest;
  Asset.findOne = async (query) => { assetQuery = query; return { id: 42 }; };
  maintenanceController.createMaintenance = async (req, res) => {
    maintenanceRequest = req.body;
    return res.status(201).json({ success: true });
  };
  const req = {
    user: { id: 9, role: 'ict_officer' },
    organizationScope: { collegeId: 5 },
    params: { id: '42' },
    body: { title: 'Repair laptop', description: 'Screen issue' },
  };
  const res = {
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return payload; },
  };

  await controller.createIctMaintenanceRequest(req, res, (error) => { throw error; });

  assert.equal(assetQuery.where.collegeId, 5);
  assert.ok(assetQuery.where[Op.or].some((clause) => clause.category?.[Op.like] === '%laptop%'));
  assert.equal(maintenanceRequest.asset_id, 42);
  assert.equal(res.statusCode, 201);
});

test('ICT retirement is scoped and records the authenticated actor', async () => {
  let assetQuery;
  let auditEntry;
  const asset = {
    id: 42,
    status: 'available',
    notes: '',
    toJSON() { return { id: this.id, status: this.status, notes: this.notes }; },
    async update(updates) { Object.assign(this, updates); },
  };
  Asset.findOne = async (query) => { assetQuery = query; return asset; };
  AuditLog.create = async (entry) => { auditEntry = entry; };
  const req = {
    user: { id: 9, role: 'ict_officer' },
    organizationScope: { collegeId: 5 },
    params: { id: '42' },
    body: { reason: 'End of service life' },
  };
  const res = { json(payload) { this.payload = payload; return payload; } };

  await controller.retireIctAsset(req, res, (error) => { throw error; });

  assert.equal(assetQuery.where.collegeId, 5);
  assert.equal(asset.status, 'retired');
  assert.equal(auditEntry.userId, 9);
  assert.equal(auditEntry.action, 'RETIRE_ICT_ASSET');
  assert.equal(res.payload.asset.status, 'retired');
});

test('ICT asset updates persist and audit supported purchase fields', async () => {
  let assetQuery;
  let auditEntry;
  const asset = {
    id: 42,
    category: 'Laptop',
    purchasePrice: 100,
    supplier: 'Old supplier',
    purchaseDate: null,
    warrantyExpiry: null,
    toJSON() { return { id: this.id, category: this.category, purchasePrice: this.purchasePrice, supplier: this.supplier }; },
    async update(updates) { Object.assign(this, updates); },
  };
  Asset.findOne = async (query) => { assetQuery = query; return asset; };
  AuditLog.create = async (entry) => { auditEntry = entry; };
  const req = {
    user: { id: 9, role: 'ict_officer' },
    organizationScope: { collegeId: 5 },
    params: { id: '42' },
    body: { purchasePrice: '750.50', supplier: 'New supplier' },
  };
  const res = { json(payload) { this.payload = payload; return payload; } };

  await controller.updateIctAsset(req, res, (error) => { throw error; });

  assert.equal(assetQuery.where.collegeId, 5);
  assert.equal(asset.purchasePrice, 750.5);
  assert.equal(asset.supplier, 'New supplier');
  assert.equal(auditEntry.userId, 9);
  assert.equal(auditEntry.action, 'UPDATE_ICT_ASSET');
  assert.equal(res.payload.asset.purchasePrice, 750.5);
});

test.afterEach(() => {
  Asset.findAndCountAll = originals.assetFindAndCountAll;
  Asset.findAll = originals.assetFindAll;
  Asset.findOne = originals.assetFindOne;
  AuditLog.create = originals.auditLogCreate;
  Assignment.findAll = originals.assignmentFindAll;
  Category.findAll = originals.categoryFindAll;
  Category.findOne = originals.categoryFindOne;
  Department.findAll = originals.departmentFindAll;
  Department.findOne = originals.departmentFindOne;
  assetController.createAsset = originals.createAsset;
  maintenanceController.createMaintenance = originals.createMaintenance;
  User.findAll = originals.userFindAll;
});