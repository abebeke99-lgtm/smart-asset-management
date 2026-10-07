jest.mock('../src/models', () => require('./mocks/departmentDashboardDatabase'));

const express = require('express');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const { getDepartmentDashboardSection } = require('../src/controllers/departmentController');
const { requirePermission } = require('../src/middlewares/auth');
const { requireDepartmentHead, resolveDepartmentScope } = require('../src/middlewares/organizationScope');
const database = require('../src/models');

process.env.JWT_SECRET = 'department-dashboard-test-secret';

const createApp = () => {
  const app = express();
  const router = express.Router();
  router.use(...requireDepartmentHead, resolveDepartmentScope, requirePermission('assets.view'));
  router.get('/dashboard/kpis', getDepartmentDashboardSection('kpis'));
  router.get('/dashboard/asset-status', getDepartmentDashboardSection('assetByStatus'));
  router.get('/dashboard/recent-activities', getDepartmentDashboardSection('recentActivities'));
  app.use('/api/department-head', router);
  return app;
};

const app = createApp();
const tokenFor = (id = 1, options = {}) => jwt.sign(
  { id, sessionVersion: 0 },
  process.env.JWT_SECRET,
  { expiresIn: '5m', ...options },
);

beforeEach(() => {
  database.resetDashboardDatabase();
});

describe('department-head dashboard API authentication', () => {
  test('accepts a valid department-head JWT and resolves its database-owned department scope', async () => {
    const response = await request(app)
      .get('/api/department-head/dashboard/kpis')
      .set('Authorization', `Bearer ${tokenFor()}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.totalAssets).toBe(0);
    expect(database.Department.findOne).toHaveBeenCalledWith({
      where: { id: 11, status: 'active' },
    });
  });

  test('returns 401 for missing, invalid, expired, and tampered JWTs', async () => {
    const missing = await request(app).get('/api/department-head/dashboard/kpis');
    const invalid = await request(app)
      .get('/api/department-head/dashboard/kpis')
      .set('Authorization', 'Bearer not-a-jwt');
    const expired = await request(app)
      .get('/api/department-head/dashboard/kpis')
      .set('Authorization', `Bearer ${tokenFor(1, { expiresIn: -1 })}`);
    const [header, payload, signature] = tokenFor().split('.');
    const tamperedToken = `${header}.${payload}.${signature.slice(0, -1)}x`;
    const tampered = await request(app)
      .get('/api/department-head/dashboard/kpis')
      .set('Authorization', `Bearer ${tamperedToken}`);

    expect(missing.status).toBe(401);
    expect(invalid.status).toBe(401);
    expect(expired.status).toBe(401);
    expect(tampered.status).toBe(401);
    expect(database.Asset.findAll).not.toHaveBeenCalled();
  });

  test('returns 403 for authenticated users with a different role', async () => {
    const response = await request(app)
      .get('/api/department-head/dashboard/kpis')
      .set('Authorization', `Bearer ${tokenFor(2)}`);

    expect(response.status).toBe(403);
    expect(response.body.message).toMatch(/role/i);
    expect(database.Asset.findAll).not.toHaveBeenCalled();
  });

  test('blocks access when the authenticated user has no configured department', async () => {
    database.User.findByPk.mockResolvedValueOnce({
      id: 1,
      role: 'department_head',
      departmentId: null,
      sessionVersion: 0,
      active: true,
    });
    const response = await request(app)
      .get('/api/department-head/dashboard/kpis')
      .set('Authorization', `Bearer ${tokenFor()}`);

    expect(response.status).toBe(403);
    expect(response.body.message).toMatch(/department scope/i);
    expect(database.Asset.findAll).not.toHaveBeenCalled();
  });
});

describe('department-head dashboard data isolation', () => {
  test('returns department-only KPI counts and scopes every database query to the authenticated department', async () => {
    database.Asset.findAll.mockResolvedValue([
      { id: 1, departmentId: 11, status: 'active', category: 'computer', currentValue: 50 },
      { id: 2, departmentId: 22, status: 'damaged', category: 'laboratory', currentValue: 80 },
    ].filter((asset) => asset.departmentId === 11));
    database.User.count.mockResolvedValue(4);
    database.Approval.findAll.mockResolvedValue([
      { id: 1, type: 'purchase', item: 'Laptop', status: 'pending', createdAt: '2026-10-01T10:00:00Z' },
      { id: 2, type: 'purchase', item: 'Microscope', status: 'approved', createdAt: '2026-10-02T10:00:00Z' },
    ]);

    const response = await request(app)
      .get('/api/department-head/dashboard/kpis')
      .query({ department_id: '11 OR 1=1' })
      .set('Authorization', `Bearer ${tokenFor()}`);

    expect(response.status).toBe(200);
    expect(response.body.data.totalAssets).toBe(1);
    expect(response.body.data.activeAssets).toBe(1);
    expect(response.body.data.pendingApprovals).toBe(1);
    expect(response.body.data.laboratories).toBe(0);
    expect(database.Asset.findAll.mock.calls[0][0].where).toEqual({ departmentId: 11 });
    expect(database.User.count.mock.calls[0][0].where).toEqual({ departmentId: 11 });
    expect(database.Approval.findAll.mock.calls[0][0].where).toEqual({ departmentId: 11 });
  });

  test('returns only the authenticated department asset-status dataset', async () => {
    database.Asset.findAll.mockResolvedValue([
      { id: 1, departmentId: 11, status: 'active', category: 'computer', currentValue: 50 },
    ]);
    const response = await request(app)
      .get('/api/department-head/dashboard/asset-status')
      .set('Authorization', `Bearer ${tokenFor()}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(6);
    expect(response.body.data[0]).toEqual({ label: 'Active', count: 1, value: 1, percentage: 100 });
    expect(database.Asset.findAll.mock.calls[0][0].where).toEqual({ departmentId: 11 });
  });

  test('does not allow a caller to select another department through a query parameter', async () => {
    database.Asset.findAll.mockResolvedValue([
      { id: 1, departmentId: 11, status: 'active', category: 'computer', currentValue: 50 },
    ]);
    const response = await request(app)
      .get('/api/department-head/dashboard/kpis')
      .query({ department_id: 22 })
      .set('Authorization', `Bearer ${tokenFor()}`);

    expect(response.status).toBe(200);
    expect(response.body.data.totalAssets).toBe(1);
    expect(database.Asset.findAll.mock.calls[0][0].where).toEqual({ departmentId: 11 });
  });

  test('sorts recent activities newest first and keeps nested records department-scoped', async () => {
    database.ServiceRequest.findAll.mockResolvedValue([
      {
        id: 1,
        title: 'Older ticket',
        status: 'completed',
        completedAt: '2026-10-01T10:00:00Z',
        createdAt: '2026-10-01T09:00:00Z',
        Reporter: { fullName: 'Reporter' },
      },
      {
        id: 2,
        title: 'Newer ticket',
        status: 'completed',
        completedAt: '2026-10-04T10:00:00Z',
        createdAt: '2026-10-04T09:00:00Z',
        Reporter: { fullName: 'Reporter' },
      },
    ]);
    const response = await request(app)
      .get('/api/department-head/dashboard/recent-activities')
      .set('Authorization', `Bearer ${tokenFor()}`);

    expect(response.status).toBe(200);
    expect(response.body.data.map((activity) => activity.entity)).toEqual(['Newer ticket', 'Older ticket']);
    expect(database.ServiceRequest.findAll.mock.calls[0][0].where).toEqual({ departmentId: 11 });
    expect(database.ServiceRequest.findAll.mock.calls[0][0].include.find((item) => item.model === database.Asset).where)
      .toEqual({ departmentId: 11 });
  });

  test('serves isolated KPI, chart, and recent-activity queries within the 500ms API budget', async () => {
    const token = tokenFor();
    for (const endpoint of ['kpis', 'asset-status', 'recent-activities']) {
      const startedAt = performance.now();
      const response = await request(app)
        .get(`/api/department-head/dashboard/${endpoint}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(performance.now() - startedAt).toBeLessThan(500);
    }
  });
});
