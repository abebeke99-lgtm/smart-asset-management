const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const models = require('../src/models');
const controller = require('../src/controllers/collegeController');
const { Op, col, fn } = require('sequelize');

const collegeRoutesSource = fs.readFileSync(path.resolve(__dirname, '../src/routes/collegeRoutes.js'), 'utf8');
const collegeControllerSource = fs.readFileSync(path.resolve(__dirname, '../src/controllers/collegeController.js'), 'utf8');
const originalMethods = {
  departmentFindAll: models.Department.findAll,
  categoryFindByPk: models.Category.findByPk,
  assetFindAll: models.Asset.findAll,
  assetCount: models.Asset.count,
  assetSum: models.Asset.sum,
  assignmentFindAll: models.Assignment.findAll,
  assignmentCount: models.Assignment.count,
  maintenanceFindAll: models.Maintenance.findAll,
  verificationItemFindAll: models.VerificationItem.findAll,
  transferFindAll: models.Transfer.findAll,
  returnFindAll: models.AssetReturn.findAll,
  sequelizeQuery: models.sequelize.query,
};

const restoreModels = () => {
  models.Department.findAll = originalMethods.departmentFindAll;
  models.Category.findByPk = originalMethods.categoryFindByPk;
  models.Asset.findAll = originalMethods.assetFindAll;
  models.Asset.count = originalMethods.assetCount;
  models.Asset.sum = originalMethods.assetSum;
  models.Assignment.findAll = originalMethods.assignmentFindAll;
  models.Assignment.count = originalMethods.assignmentCount;
  models.Maintenance.findAll = originalMethods.maintenanceFindAll;
  models.VerificationItem.findAll = originalMethods.verificationItemFindAll;
  models.Transfer.findAll = originalMethods.transferFindAll;
  models.AssetReturn.findAll = originalMethods.returnFindAll;
  models.sequelize.query = originalMethods.sequelizeQuery;
};

const response = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

const setupAnalyticsMocks = () => {
  const calls = { assets: [], maintenance: [], verification: [] };
  models.Department.findAll = async () => [{ id: 5, name: 'Science', code: 'SCI' }];
  models.Category.findByPk = async (id) => ({ id, name: 'Equipment' });
  models.Asset.findAll = async (options) => {
    calls.assets.push(options);
    if (options.include?.some((include) => include.model === models.Department)) {
      return [{
        id: 10,
        assetCode: 'SCI-10',
        name: 'Microscope',
        category: 'Equipment',
        department: 'Science',
        departmentId: 5,
        location: 'Laboratory',
        status: 'available',
        condition: 'Good',
        currentValue: 100,
        DepartmentRecord: { id: 5, name: 'Science' },
      }];
    }
    return [];
  };
  models.Asset.count = async () => 1;
  models.Asset.sum = async () => 100;
  models.Assignment.findAll = async (options) => { calls.assignments = calls.assignments || []; calls.assignments.push(options); return []; };
  models.Assignment.count = async () => 0;
  models.Maintenance.findAll = async (options) => {
    calls.maintenance.push(options);
    return [];
  };
  models.VerificationItem.findAll = async (options) => {
    calls.verification.push(options);
    return [];
  };
  models.Transfer.findAll = async () => [];
  models.AssetReturn.findAll = async () => [];
  return calls;
};

test('college asset analytics route is protected and scoped to the authenticated college', () => {
  assert.match(collegeRoutesSource, /router\.get\('\/analytics\/assets'/);
  assert.match(collegeControllerSource, /getCollegeAssetAnalytics/i);
  assert.match(collegeControllerSource, /req\.organizationScope\?\.collegeId|req\.organizationScope\.collegeId/i);
});

test('college analytics handles empty filters and applies the same authorized filters to summaries and assets', async (t) => {
  const calls = setupAnalyticsMocks();
  t.after(restoreModels);

  const res = response();
  await controller.getCollegeAssetAnalytics({
    organizationScope: { collegeId: 22, college: { collegeName: 'Science College' } },
    query: {
      departmentId: '',
      categoryId: '',
      locationId: '',
      status: '',
      condition: '',
      dateFrom: '',
      dateTo: '',
      page: '1',
      limit: '10',
    },
  }, res, (error) => { throw error; });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.summary.totalAssets, 1);
  assert.equal(res.body.data.table.rows[0].department, 'Science');
  assert.deepEqual(res.body.data.table.pagination, { page: 1, limit: 10, total: 1, totalPages: 1 });
  const assetWhere = calls.assets[0].where;
  assert.deepEqual(assetWhere, { collegeId: 22 });
  assert.equal(calls.verification.length, 2, 'verification details and aggregate should each be fetched once');
  assert.equal(res.body.data.summary.totalAssetValue, 100, 'the aggregate results must stay aligned with the corresponding models');
  const maintenanceAggregate = calls.maintenance.find((options) => options.attributes.some(([, alias]) => alias === 'count') && options.group?.[0]?.col === 'Maintenance.status');
  const verificationAggregate = calls.verification.find((options) => options.group?.[0]?.col === 'VerificationItem.state');
  assert.ok(maintenanceAggregate);
  assert.ok(verificationAggregate);
  assert.equal(maintenanceAggregate.attributes.find(([, alias]) => alias === 'count')[0].args[0].col, 'Maintenance.id');
  assert.deepEqual(maintenanceAggregate.include[0].attributes, []);
  assert.equal(verificationAggregate.attributes.find(([, alias]) => alias === 'count')[0].args[0].col, 'VerificationItem.id');
  assert.deepEqual(verificationAggregate.include[0].attributes, []);
  assert.deepEqual(verificationAggregate.include[1].where, { collegeId: 22 });
});

test('college analytics validates filters, scopes departments, and maps category IDs to stored category names', async (t) => {
  const calls = setupAnalyticsMocks();
  t.after(restoreModels);

  const valid = response();
  await controller.getCollegeAssetAnalytics({
    organizationScope: { collegeId: 22 },
    query: {
      departmentId: '5',
      categoryId: '4',
      locationId: 'Laboratory',
      status: 'available',
      condition: 'Good',
      dateFrom: '2026-01-01',
      dateTo: '2026-01-31',
      page: '2',
      limit: '5',
    },
  }, valid, (error) => { throw error; });

  assert.equal(valid.statusCode, 200);
  assert.deepEqual(calls.assets[0].where, {
    collegeId: 22,
    departmentId: 5,
    category: 'Equipment',
    status: 'available',
    condition: 'Good',
    location: 'Laboratory',
    createdAt: { [Op.gte]: new Date('2026-01-01'), [Op.lte]: new Date('2026-01-31T23:59:59.999Z') },
  });
  assert.deepEqual(valid.body.data.table.pagination, { page: 2, limit: 5, total: 1, totalPages: 1 });

  for (const [query, expectedStatus] of [
    [{ departmentId: 'not-an-id' }, 400],
    [{ categoryId: 'not-an-id' }, 400],
    [{ dateFrom: 'not-a-date' }, 422],
    [{ page: '0' }, 400],
  ]) {
    const invalid = response();
    await controller.getCollegeAssetAnalytics({ organizationScope: { collegeId: 22 }, query }, invalid, (error) => { throw error; });
    assert.equal(invalid.statusCode, expectedStatus);
  }
});

test('analytics aggregate SQL qualifies joined primary keys and groups without selecting extra joined columns', async (t) => {
  const statements = [];
  models.sequelize.query = async (sql) => { statements.push(sql); return []; };
  t.after(restoreModels);

  await models.Maintenance.findAll({
    attributes: ['status', [fn('COUNT', col('Maintenance.id')), 'count']],
    group: [col('Maintenance.status')],
    include: [{ model: models.Asset, required: true, where: { collegeId: 22 }, attributes: [] }],
    raw: true,
  });
  await models.VerificationItem.findAll({
    attributes: ['state', [fn('COUNT', col('VerificationItem.id')), 'count']],
    group: [col('VerificationItem.state')],
    include: [
      { model: models.Asset, required: true, where: { collegeId: 22 }, attributes: [] },
      { model: models.VerificationSession, required: true, where: { collegeId: 22 }, attributes: [] },
    ],
    raw: true,
  });

  assert.match(statements[0], /COUNT\(`Maintenance`\.`id`\)/);
  assert.match(statements[0], /GROUP BY `Maintenance`\.`status`/);
  assert.doesNotMatch(statements[0], /`Asset`\.`id` AS/);
  assert.match(statements[1], /COUNT\(`VerificationItem`\.`id`\)/);
  assert.match(statements[1], /GROUP BY `VerificationItem`\.`state`/);
  assert.match(statements[1], /`VerificationSession`\.`college_id` = 22/);
  assert.doesNotMatch(statements[1], /`Asset`\.`id` AS/);
});
