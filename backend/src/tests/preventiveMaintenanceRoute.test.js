const test = require('node:test');
const assert = require('node:assert/strict');
const maintenanceRoutes = require('../routes/maintenanceRoutes');
const { validatePreventiveScheduleInput, isValidPreventiveTransition } = require('../controllers/maintenanceController');

const preventiveRoutes = {
  list: maintenanceRoutes.stack.find((layer) => layer.route && layer.route.path === '/preventive' && layer.route.methods.get),
  detail: maintenanceRoutes.stack.find((layer) => layer.route && layer.route.path === '/preventive/:id' && layer.route.methods.get),
  update: maintenanceRoutes.stack.find((layer) => layer.route && layer.route.path === '/preventive/:id' && layer.route.methods.put),
  cancel: maintenanceRoutes.stack.find((layer) => layer.route && layer.route.path === '/preventive/:id' && layer.route.methods.delete),
  activate: maintenanceRoutes.stack.find((layer) => layer.route && layer.route.path === '/preventive/:id/activate' && layer.route.methods.patch),
  start: maintenanceRoutes.stack.find((layer) => layer.route && layer.route.path === '/preventive/:id/start' && layer.route.methods.patch),
};

test('maintenance preventive routes expose the real schedule-backed API surface', () => {
  assert.ok(preventiveRoutes.list, 'expected GET /api/maintenance/preventive route');
  assert.ok(preventiveRoutes.detail, 'expected GET /api/maintenance/preventive/:id route');
  assert.ok(preventiveRoutes.update, 'expected PUT /api/maintenance/preventive/:id route');
  assert.ok(preventiveRoutes.cancel, 'expected DELETE /api/maintenance/preventive/:id route');
  assert.ok(preventiveRoutes.activate, 'expected PATCH /api/maintenance/preventive/:id/activate route');
  assert.ok(preventiveRoutes.start, 'expected PATCH /api/maintenance/preventive/:id/start route');
  for (const route of Object.values(preventiveRoutes)) {
    assert.ok(route, 'expected preventive maintenance route to be mounted');
    assert.ok(Array.isArray(route.route.stack), 'expected mounted route handlers');
    assert.ok(route.route.stack.length > 0, 'expected at least one handler');
  }
});

test('preventive schedule transitions reject restarting completed work and completing unopened work', () => {
  assert.equal(isValidPreventiveTransition('scheduled', 'in-progress'), true);
  assert.equal(isValidPreventiveTransition('cancelled', 'scheduled'), true);
  assert.equal(isValidPreventiveTransition('completed', 'in-progress'), false);
  assert.equal(isValidPreventiveTransition('scheduled', 'completed'), false);
});

test('preventive schedule input rejects invalid dates, costs, frequencies, and technician ids', () => {
  const schedule = { assetId: 9, maintenanceType: 'Inspection', scheduleDate: '2026-09-29', nextScheduleDate: '2026-10-01' };
  assert.equal(validatePreventiveScheduleInput({ ...schedule, estimatedCost: -1 }).error, 'Estimated cost must be a non-negative number');
  assert.equal(validatePreventiveScheduleInput({ ...schedule, scheduleDate: 'invalid' }).error, 'Schedule date is invalid');
  assert.match(validatePreventiveScheduleInput({ ...schedule, nextScheduleDate: '2026-09-28' }).error, /on or after/);
  assert.match(validatePreventiveScheduleInput({ ...schedule, frequency: 'whenever' }).error, /frequency/i);
  assert.match(validatePreventiveScheduleInput({ ...schedule, technicianId: 'invalid' }).error, /technician/i);
  assert.equal(validatePreventiveScheduleInput(schedule).error, undefined);
});
