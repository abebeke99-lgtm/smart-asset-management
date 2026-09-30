const test = require('node:test');
const assert = require('node:assert/strict');
const { isMaintenanceOverdue } = require('../controllers/collegeController');

test('college maintenance marks explicit overdue records as overdue', () => {
  assert.equal(isMaintenanceOverdue({ status: 'overdue' }), true);
});

test('college maintenance marks past due dates as overdue', () => {
  assert.equal(isMaintenanceOverdue({ status: 'in-progress', dueDate: '2000-01-01' }), true);
});

test('college maintenance excludes terminal records from overdue counts', () => {
  assert.equal(isMaintenanceOverdue({ status: 'completed', dueDate: '2000-01-01' }), false);
  assert.equal(isMaintenanceOverdue({ status: 'cancelled', dueDate: '2000-01-01' }), false);
  assert.equal(isMaintenanceOverdue({ status: 'rejected', dueDate: '2000-01-01' }), false);
});
