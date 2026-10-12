const test = require('node:test');
const assert = require('node:assert/strict');
const { Op } = require('sequelize');
const { Assignment, ServiceRequest } = require('../models');
const { getStudentDashboard } = require('../controllers/studentDashboardController');

const withMocks = async (mocks, run) => {
  const originals = mocks.map(([object, methods]) => Object.entries(methods).map(([method, implementation]) => {
    const previous = object[method];
    object[method] = implementation;
    return [object, method, previous];
  })).flat();
  try {
    await run();
  } finally {
    for (const [object, method, previous] of originals) object[method] = previous;
  }
};

test('student dashboard queries and returns only assets and requests owned by the authenticated student', async () => {
  const studentId = 41;
  const result = { status: 200, body: null, nextError: null };
  let assignmentFilter;
  let requestFilters = [];
  const res = {
    status(status) { result.status = status; return this; },
    json(body) { result.body = body; return this; },
  };

  await withMocks([
    [Assignment, {
      count: async ({ where }) => {
        assignmentFilter = where;
        return 1;
      },
      findAll: async ({ where }) => {
        assert.equal(where, assignmentFilter);
        return [{
          id: 7,
          assignedTo: studentId,
          assignedToType: 'user',
          status: 'active',
          Asset: { id: 8, assetCode: 'ASSET-8', name: 'Laptop', status: 'assigned' },
        }];
      },
    }],
    [ServiceRequest, {
      findAll: async ({ where }) => {
        requestFilters.push(where);
        return where.reportedBy === studentId
          ? (requestFilters.length === 1
            ? [{ status: 'submitted', count: 1 }, { status: 'completed', count: 1 }]
            : [{ id: 5, requestCode: 'REQ-5', title: 'Laptop repair', status: 'submitted' }])
          : [];
      },
    }],
  ], async () => {
    await getStudentDashboard({ user: { id: studentId, role: 'student' } }, res, (error) => { result.nextError = error; });
  });

  assert.equal(result.status, 200);
  assert.equal(result.nextError, null);
  assert.equal(assignmentFilter.assignedToType, 'user');
  assert.equal(assignmentFilter.status, 'active');
  assert.deepEqual(assignmentFilter[Op.or], [{ assignedTo: studentId }, { assignedToId: studentId }]);
  assert.deepEqual(requestFilters, [{ reportedBy: studentId }, { reportedBy: studentId }]);
  assert.deepEqual(result.body.data.summary, { assignedAssets: 1, totalRequests: 2, openRequests: 1 });
  assert.equal(result.body.data.assets[0].asset.name, 'Laptop');
  assert.equal(result.body.data.requests[0].requestCode, 'REQ-5');
});

test('student dashboard rejects invalid authenticated user identifiers', async () => {
  const result = { status: 200, body: null };
  const res = {
    status(status) { result.status = status; return this; },
    json(body) { result.body = body; return this; },
  };
  await getStudentDashboard({ user: { id: 'invalid' } }, res, () => {});
  assert.equal(result.status, 401);
  assert.equal(result.body.message, 'Authentication required.');
});

test('student dashboard endpoint is mounted behind authentication and the student role guard', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const routeSource = fs.readFileSync(path.join(__dirname, '../routes/studentRoutes.js'), 'utf8');
  const appSource = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
  assert.match(routeSource, /router\.get\('\/dashboard', requireAuth, requireRole\('student'\), getStudentDashboard\)/);
  assert.match(appSource, /app\.use\('\/api\/student', studentRoutes\)/);
});
