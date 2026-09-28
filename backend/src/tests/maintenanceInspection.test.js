const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { validateInspection } = require('../controllers/maintenanceInspectionController');

const validInspection = {
  assetId: 12,
  inspectionDate: '2026-09-28',
  inspectionType: 'Routine Inspection',
  inspectorId: 4,
  condition: 'Good',
  status: 'scheduled',
};

test('maintenance inspection validation accepts required valid fields', () => {
  assert.equal(validateInspection(validInspection), null);
});

test('maintenance inspection validation rejects missing required fields and unsupported values', () => {
  assert.equal(validateInspection({ ...validInspection, assetId: '' }), 'Asset is required.');
  assert.equal(validateInspection({ ...validInspection, inspectionType: 'Annual' }), 'Select a valid inspection type.');
  assert.equal(validateInspection({ ...validInspection, condition: 'Unsafe' }), 'Select a valid asset condition.');
  assert.equal(validateInspection({ ...validInspection, status: 'unknown' }), 'Select a valid inspection status.');
});

test('maintenance inspection validation rejects impossible and reversed dates', () => {
  assert.match(validateInspection({ ...validInspection, inspectionDate: '2026-02-30' }), /valid inspection date/i);
  assert.match(validateInspection({ ...validInspection, nextInspectionDate: 'not-a-date' }), /next inspection date/i);
  assert.match(validateInspection({ ...validInspection, nextInspectionDate: '2026-09-27' }), /cannot be before/i);
});

test('inspection routes are maintenance-authenticated and deletion is admin-only', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../routes/maintenanceRoutes.js'), 'utf8');
  assert.match(source, /router\.get\('\/inspections', \.\.\.inspectionReadAccess/);
  assert.match(source, /router\.get\('\/inspections\/options', \.\.\.inspectionReadAccess/);
  assert.match(source, /router\.post\('\/inspections', \.\.\.inspectionReadAccess/);
  assert.match(source, /router\.put\('\/inspections\/:id', \.\.\.inspectionReadAccess/);
  assert.match(source, /router\.delete\('\/inspections\/:id', requireAuth, requireRole\('admin'\)/);
  assert.match(source, /requireRole\('admin', 'maintenance', 'ict_officer'\)/);
});