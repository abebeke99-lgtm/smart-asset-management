const test = require('node:test');
const assert = require('node:assert/strict');
const { Op } = require('sequelize');
const repository = require('../repositories/departmentAnalyticsRepository');
const service = require('../services/departmentAnalyticsService');
const controller = require('../controllers/departmentAnalyticsController');
const {
  Asset,
  Assignment,
  Approval,
  DepartmentAssetVerification,
  Inventory,
  Maintenance,
  Room,
  ServiceRequest,
  Transfer,
} = require('../models');

const makeResponse = () => ({
  statusCode: 200,
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.payload = payload; return this; },
});

test('analytics repository constrains assets, inventory, approvals, services, verifications and transfers to department scope', async (t) => {
  const models = [Asset, Assignment, Approval, Inventory, Maintenance, Room, ServiceRequest, Transfer, DepartmentAssetVerification];
  const originals = models.map((model) => [model, model.findAll, model.count]);
  const filters = [];
  for (const model of models) {
    model.findAll = async (options) => {
      filters.push({ model: model.name, where: options.where, include: options.include });
      return [];
    };
    model.count = async (options) => {
      filters.push({ model: model.name, where: options.where });
      return 0;
    };
  }
  t.after(() => originals.forEach(([model, findAll, count]) => {
    model.findAll = findAll;
    model.count = count;
  }));

  await repository.getDepartmentAnalytics(17, {});

  assert.ok(filters.some((entry) => entry.model === 'Asset' && entry.where.departmentId === 17));
  assert.ok(filters.some((entry) => entry.model === 'Assignment' && entry.where.departmentId === 17));
  assert.ok(filters.some((entry) => entry.model === 'Approval' && entry.where.departmentId === 17));
  assert.ok(filters.some((entry) => entry.model === 'ServiceRequest' && entry.where.departmentId === 17));
  assert.ok(filters.some((entry) => entry.model === 'DepartmentAssetVerification' && entry.where.departmentId === 17));
  const transferQuery = filters.find((entry) => entry.model === 'Transfer');
  assert.ok(transferQuery.where[Op.or].some((scope) => scope.sourceDepartmentId === 17));
  assert.ok(transferQuery.where[Op.or].some((scope) => scope.destinationDepartmentId === 17));
  const inventoryQuery = filters.find((entry) => entry.model === 'Inventory');
  assert.equal(inventoryQuery.where.departmentId, 17);
  assert.equal(inventoryQuery.include[0].where.departmentId, 17);
});

test('analytics endpoint requires resolved department scope and validates date filters', async (t) => {
  const response = makeResponse();
  await controller.getAnalytics({ organizationScope: {}, query: {} }, response, (error) => { throw error; });
  assert.equal(response.statusCode, 403);

  const invalid = makeResponse();
  await controller.getAnalytics({ organizationScope: { departmentId: 17 }, query: { dateFrom: '2026-02-30' } }, invalid, (error) => { throw error; });
  assert.equal(invalid.statusCode, 400);
});

test('report endpoint rejects invalid pagination and forwards authenticated department ID', async (t) => {
  const original = repository.getDepartmentReport;
  let calledWith;
  repository.getDepartmentReport = async (...args) => {
    calledWith = args;
    return { count: 0, rows: [] };
  };
  t.after(() => { repository.getDepartmentReport = original; });

  const invalid = makeResponse();
  await controller.getReport('assignments')({
    organizationScope: { departmentId: 17 },
    query: { page: 0 },
  }, invalid, (error) => { throw error; });
  assert.equal(invalid.statusCode, 400);
  assert.equal(calledWith, undefined);

  const valid = makeResponse();
  await controller.getReport('assignments')({
    organizationScope: { departmentId: 17 },
    query: { page: '2', limit: '10', search: 'microscope' },
  }, valid, (error) => { throw error; });
  assert.equal(calledWith[0], 17);
  assert.equal(calledWith[1], 'assignments');
  assert.deepEqual(valid.payload.pagination, { page: 2, limit: 10, total: 0, pages: 0 });
});

test('report data scope is fixed to the authorized department for each report family', async (t) => {
  const models = [Assignment, Transfer, DepartmentAssetVerification, ServiceRequest, Inventory];
  const originals = models.map((model) => [model, model.findAndCountAll]);
  const queries = [];
  for (const model of models) model.findAndCountAll = async (options) => {
    queries.push({ name: model.name, options });
    return { count: 0, rows: [] };
  };
  t.after(() => originals.forEach(([model, findAndCountAll]) => { model.findAndCountAll = findAndCountAll; }));

  for (const type of ['assignments', 'transfers', 'verification', 'escalations', 'inventory']) {
    await repository.getDepartmentReport(17, type, { page: 1, limit: 10, search: '', status: '' });
  }
  assert.equal(queries.find((query) => query.name === 'Assignment').options.where.departmentId, 17);
  const transferScope = queries.find((query) => query.name === 'Transfer').options.where[Op.and][0][Op.or];
  assert.ok(transferScope.some((scope) => scope.sourceDepartmentId === 17));
  assert.ok(transferScope.some((scope) => scope.destinationDepartmentId === 17));
  assert.equal(queries.find((query) => query.name === 'DepartmentAssetVerification').options.where.departmentId, 17);
  const escalationScope = queries.find((query) => query.name === 'ServiceRequest').options.where;
  assert.equal(escalationScope.departmentId, 17);
  assert.equal(escalationScope.escalated, true);
  assert.equal(queries.find((query) => query.name === 'Inventory').options.where.departmentId, 17);
});

test('query parsers bound report pagination and validate date ranges', () => {
  assert.deepEqual(service.parsePagination({ page: '3', limit: '20' }), { page: 3, limit: 20 });
  assert.throws(() => service.parsePagination({ limit: '101' }), { statusCode: 400 });
  assert.throws(() => service.parseFilters({ dateFrom: '2026-12-31', dateTo: '2026-01-01' }), { statusCode: 400 });
});
