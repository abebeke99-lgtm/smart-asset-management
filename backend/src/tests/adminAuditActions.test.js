const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const sources = [
  '../controllers/assetController.js',
  '../controllers/assetExtendedController.js',
  '../controllers/chemicalController.js',
  '../controllers/collegeController.js',
  '../controllers/maintenanceController.js',
  '../controllers/userController.js',
  '../routes/adminRoleRoutes.js',
  '../routes/adminSupportRoutes.js',
  '../routes/assignmentRoutes.js',
  '../routes/assetRoutes.js',
  '../routes/departmentRoutes.js',
  '../routes/transferRoutes.js',
  '../services/notificationService.js',
].map((source) => fs.readFileSync(path.resolve(__dirname, source), 'utf8')).join('\n');

const actions = [
  'CREATE_ASSET',
  'UPDATE_ASSET',
  'ASSIGN_ASSET',
  'TRANSFER_ASSET',
  'DISPOSE_ASSET',
  'CREATE_USER',
  'UPDATE_USER',
  'CHANGE_ROLE',
  'CHANGE_PERMISSION',
  'CREATE_DEPARTMENT',
  'UPDATE_DEPARTMENT',
  'CREATE_COLLEGE',
  'UPDATE_COLLEGE',
  'CREATE_MAINTENANCE',
  'UPDATE_MAINTENANCE',
  'CREATE_NOTIFICATION',
  'BACKUP_OPERATION',
  'QUARANTINE_OPERATION',
];

test('all required administrator audit action names use the shared normalized writer', () => {
  for (const action of actions) {
    assert.match(sources, new RegExp(`createAuditLog\\(\\{[\\s\\S]{0,700}action:\\s*[^\\n]*'${action}'`), `${action} must use createAuditLog`);
  }
});

test('the normalized writer persists identity, role, action, entity ID, timestamp, and snapshots in existing details', () => {
  const writer = fs.readFileSync(path.resolve(__dirname, '../services/auditLogService.js'), 'utf8');
  for (const field of ['user:', 'role:', 'action,', 'entity_id:', 'timestamp:', 'old_value:', 'new_value:']) {
    assert.ok(writer.includes(field), `expected normalized audit details to contain ${field}`);
  }
  assert.match(writer, /userId:\s*userId/);
  assert.match(writer, /createdAt:\s*occurredAt/);
});