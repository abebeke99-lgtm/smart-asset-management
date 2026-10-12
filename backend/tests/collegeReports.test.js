const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const models = require('../src/models');
const controller = require('../src/controllers/collegeController');
const { Op } = require('sequelize');

const controllerSource = fs.readFileSync(path.resolve(__dirname, '../src/controllers/collegeController.js'), 'utf8');
const routeSource = fs.readFileSync(path.resolve(__dirname, '../src/routes/collegeRoutes.js'), 'utf8');
const reportModels = [models.Asset, models.Assignment, models.Transfer, models.AssetReturn, models.Maintenance, models.VerificationSession, models.Approval, models.AssetMovement];
const originalMethods = {
  departmentFindAll: models.Department.findAll,
  departmentFindOne: models.Department.findOne,
  categoryFindAll: models.Category.findAll,
  categoryFindByPk: models.Category.findByPk,
  userFindAll: models.User.findAll,
  reportModels: reportModels.map((model) => ({
    model,
    findAll: model.findAll,
    findAndCountAll: model.findAndCountAll,
    count: model.count,
  })),
};

const restoreModels = () => {
  models.Department.findAll = originalMethods.departmentFindAll;
  models.Department.findOne = originalMethods.departmentFindOne;
  models.Category.findAll = originalMethods.categoryFindAll;
  models.Category.findByPk = originalMethods.categoryFindByPk;
  models.User.findAll = originalMethods.userFindAll;
  for (const { model, findAll, findAndCountAll, count } of originalMethods.reportModels) {
    model.findAll = findAll;
    model.findAndCountAll = findAndCountAll;
    model.count = count;
  }
};

const setupReportMocks = () => {
  const calls = {};
  models.Department.findAll = async (options) => {
    calls.departmentFindAll = options;
    return [{ id: 31, name: 'Physics', code: 'PHY' }];
  };
  models.Department.findOne = async (options) => {
    calls.departmentFindOne = options;
    return { id: 31 };
  };
  models.Category.findAll = async () => [];
  models.Category.findByPk = async (id) => ({ id, name: 'Furniture' });
  models.User.findAll = async () => [];
  for (const model of reportModels) {
    model.findAll = async (options) => {
      calls[`${model.name}.findAll`] = options;
      return [];
    };
    model.findAndCountAll = async (options) => {
      calls[`${model.name}.findAndCountAll`] = options;
      return { count: 0, rows: [] };
    };
    model.count = async (options) => {
      calls[`${model.name}.count`] = options;
      return 0;
    };
  }
  return calls;
};

const response = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

test('college reports controller enforces college scoping and includes a report API contract', () => {
  assert.match(controllerSource, /getCollegeReports/i);
  assert.match(controllerSource, /req\.organizationScope\?\.collegeId|req\.organizationScope\.collegeId/i);
  assert.match(controllerSource, /reportType/i);
  assert.match(controllerSource, /departmentId/i);
  assert.match(controllerSource, /search/i);
});

test('college routes expose the college reports endpoint for college managers', () => {
  assert.match(routeSource, /router\.get\('\/reports'\s*,\s*requirePermission\('college\.reports\.view'\)\s*,\s*getCollegeReports\)/i);
  assert.match(routeSource, /getCollegeReports/i);
});

test('all college report types return the successful empty-result contract with empty optional filters', async (t) => {
  const calls = setupReportMocks();
  t.after(restoreModels);
  const reportTypes = ['inventory', 'status', 'departments', 'assignments', 'transfers', 'returns', 'maintenance', 'verification', 'requests', 'movement'];

  for (const reportType of reportTypes) {
    const res = response();
    await controller.getCollegeReports({
      organizationScope: { collegeId: 22 },
      query: { reportType, page: '1', limit: '10', departmentId: '', categoryId: '', status: '', dateFrom: '', dateTo: '' },
    }, res, (error) => { throw error; });

    assert.equal(res.statusCode, 200, `${reportType} should load`);
    assert.equal(res.body.reportType, reportType);
    if (reportType === 'departments') {
      assert.equal(res.body.data[0].department, 'Physics');
      assert.equal(res.body.pagination.total, 1);
    } else {
      assert.deepEqual(res.body.data, []);
      assert.equal(res.body.pagination.total, 0);
    }
  }

  assert.equal(calls['Asset.findAndCountAll'].where.collegeId, 22);
  assert.equal(calls['Assignment.findAndCountAll'].include[0].where.collegeId, 22);
  assert.equal(calls['Transfer.findAndCountAll'].include[0].where.collegeId, 22);
  assert.equal(calls['AssetReturn.findAndCountAll'].include[0].where.collegeId, 22);
  assert.equal(calls['Maintenance.findAndCountAll'].include[0].where.collegeId, 22);
  assert.equal(calls['VerificationSession.findAndCountAll'].where.collegeId, 22);
  assert.deepEqual(calls['Approval.findAndCountAll'].where.departmentId[Op.in], [31]);
  assert.equal(calls['AssetMovement.findAndCountAll'].include[0].where.collegeId, 22);
});

test('report filters reject malformed ids, dates, report names, and foreign departments', async (t) => {
  setupReportMocks();
  t.after(restoreModels);
  const invalidQueries = [
    { reportType: 'inventory', departmentId: 'not-an-id' },
    { reportType: 'inventory', categoryId: 'not-an-id' },
    { reportType: 'inventory', dateFrom: 'not-a-date' },
    { reportType: 'unknown' },
    { reportType: 'inventory', page: '0' },
  ];

  for (const query of invalidQueries) {
    const res = response();
    await controller.getCollegeReports({ organizationScope: { collegeId: 22 }, query }, res, (error) => { throw error; });
    assert.equal(res.statusCode, 400);
  }

  models.Department.findOne = async () => null;
  const foreignDepartment = response();
  await controller.getCollegeReports({
    organizationScope: { collegeId: 22 },
    query: { reportType: 'inventory', departmentId: '99' },
  }, foreignDepartment, (error) => { throw error; });
  assert.equal(foreignDepartment.statusCode, 400);
  assert.match(foreignDepartment.body.message, /part of your college/i);
});

test('each report applies college, department, category, status, and date filters to its matching records', async (t) => {
  const calls = setupReportMocks();
  t.after(restoreModels);
  const filters = {
    page: '1',
    limit: '10',
    departmentId: '31',
    categoryId: '4',
    status: 'active',
    dateFrom: '2026-01-01',
    dateTo: '2026-01-31',
  };
  const dateField = {
    inventory: 'updatedAt',
    status: 'createdAt',
    departments: 'createdAt',
    assignments: 'createdAt',
    transfers: 'transferDate',
    returns: 'requestedAt',
    maintenance: 'createdAt',
    verification: 'createdAt',
    requests: 'createdAt',
    movement: 'createdAt',
  };
  const eventModel = {
    assignments: models.Assignment,
    transfers: models.Transfer,
    returns: models.AssetReturn,
    maintenance: models.Maintenance,
    verification: models.VerificationSession,
    requests: models.Approval,
    movement: models.AssetMovement,
  };
  const findAssetScope = (includes = []) => {
    for (const include of includes) {
      if (include.model === models.Asset) return include.where;
      const nested = findAssetScope(include.include || []);
      if (nested) return nested;
    }
    return null;
  };
  const reportTypes = Object.keys(dateField);

  for (const reportType of reportTypes) {
    for (const key of Object.keys(calls)) delete calls[key];
    const res = response();
    await controller.getCollegeReports({
      organizationScope: { collegeId: 22 },
      query: { ...filters, reportType },
    }, res, (error) => { throw error; });
    assert.equal(res.statusCode, 200, `${reportType} should accept valid filters`);
    assert.ok(Array.isArray(res.body.charts));

    const baseOptions = reportType === 'inventory'
      ? calls['Asset.findAndCountAll']
      : reportType === 'status' || reportType === 'departments'
        ? calls['Asset.findAll']
        : calls[`${eventModel[reportType].name}.findAndCountAll`];
    assert.ok(baseOptions, `${reportType} should execute its report query`);
    const assetWhere = reportType === 'inventory' || reportType === 'status' || reportType === 'departments'
      ? baseOptions.where
      : findAssetScope(baseOptions.include || []);
    assert.equal(assetWhere.collegeId, 22, `${reportType} should constrain asset college`);
    assert.equal(assetWhere.departmentId, 31, `${reportType} should constrain department`);
    assert.equal(assetWhere.category, 'Furniture', `${reportType} should map category ID to the physical asset category value`);
    assert.equal(assetWhere.status, reportType === 'movement' || reportType === 'inventory' || reportType === 'status' || reportType === 'departments' ? 'active' : undefined);
    if (!['inventory', 'status', 'departments'].includes(reportType)) {
      if (reportType === 'movement') {
        assert.equal(baseOptions.include[0].where.status, 'active', 'movement should filter its associated asset status');
      } else {
        assert.equal(baseOptions.where.status, 'active', `${reportType} should apply status to its report record`);
      }
    }
    assert.equal(baseOptions.where[dateField[reportType]][Op.gte].toISOString(), '2026-01-01T00:00:00.000Z');
    assert.equal(baseOptions.where[dateField[reportType]][Op.lte].toISOString(), '2026-01-31T23:59:59.999Z');
  }
});
