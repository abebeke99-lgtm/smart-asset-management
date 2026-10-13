const test = require('node:test');
const assert = require('node:assert/strict');
const auditLogService = require('../services/auditLogService');
const originalCreateAuditLog = auditLogService.createAuditLog;
auditLogService.createAuditLog = async () => {};
const adminSupportRoutes = require('../routes/adminSupportRoutes');
const backupService = require('../services/backupService');

const createBackupRoute = adminSupportRoutes.stack.find((layer) => (
  layer.route?.path === '/backups' && layer.route.methods.post
));
const createBackupHandler = createBackupRoute.route.stack.at(-1).handle;

test.after(() => {
  auditLogService.createAuditLog = originalCreateAuditLog;
});

test('backup creation logs the original failure and returns a safe JSON error response', async (t) => {
  const originalCreateBackup = backupService.createManualBackup;
  const originalConsoleError = console.error;
  const failure = new Error('mysqldump is unavailable');
  let logged;
  let response;
  backupService.createManualBackup = async () => { throw failure; };
  console.error = (...args) => { logged = args; };
  t.after(() => {
    backupService.createManualBackup = originalCreateBackup;
    console.error = originalConsoleError;
  });

  const res = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      response = payload;
      return this;
    },
  };
  await createBackupHandler({
    user: { id: 19, username: 'admin.test', fullName: 'Test Admin', role: 'admin' },
  }, res, (error) => { throw error; });

  assert.equal(logged[0], 'Backup creation failed:');
  assert.equal(logged[1].message, failure.message);
  assert.equal(logged[1].stack, failure.stack);
  assert.equal(res.statusCode, 500);
  assert.deepEqual(response, {
    success: false,
    message: 'Database backup could not be completed. Check the backup configuration and server logs.',
  });
  assert.equal(JSON.stringify(response).includes('mysqldump'), false);
});

test('backup creation passes the authenticated user identity to backup metadata', async (t) => {
  const originalCreateBackup = backupService.createManualBackup;
  let receivedOptions;
  backupService.createManualBackup = async (options) => {
    receivedOptions = options;
    return { filename: 'backup.json', size: 1, checksum: 'test', status: 'completed', type: 'Manual' };
  };
  t.after(() => { backupService.createManualBackup = originalCreateBackup; });

  const res = {
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
  };
  await createBackupHandler({
    user: { id: 19, username: 'admin.test', fullName: 'Test Admin', role: 'admin' },
  }, res, (error) => { throw error; });

  assert.deepEqual(receivedOptions.createdBy, {
    id: 19,
    username: 'admin.test',
    fullName: 'Test Admin',
  });
  assert.equal(res.statusCode, 201);
  assert.equal(res.payload.data.status, 'completed');
});
