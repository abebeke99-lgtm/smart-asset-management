const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { RFIDLog, Asset } = require('../src/models');
const { getAllLogs, createLog } = require('../src/controllers/rfidController');

const routeSource = fs.readFileSync(path.resolve(__dirname, '../src/routes/rfidRoutes.js'), 'utf8');
const controllerSource = fs.readFileSync(path.resolve(__dirname, '../src/controllers/rfidController.js'), 'utf8');

test('RFID device and log read routes require an authorized role', () => {
  assert.match(routeSource, /const requireRfidAccess = requireRole\('admin', 'ict_officer', 'store_manager'\)/);
  assert.match(routeSource, /router\.get\('\/devices', requireAuth, requireRfidAccess,/);
  assert.match(routeSource, /router\.get\('\/devices\/:id', requireAuth, requireRfidAccess,/);
  assert.match(routeSource, /router\.get\('\/', requireAuth, requireRfidAccess, getAllLogs\)/);
  assert.match(routeSource, /router\.get\('\/logs', requireAuth, requireRfidAccess, getAllLogs\)/);
  assert.match(routeSource, /router\.get\('\/history\/:assetId', requireAuth, requireRfidAccess, getAllLogs\)/);
});

test('no RFID read route is guarded by authentication only', () => {
  const unguarded = routeSource
    .split('\n')
    .filter((line) => /router\.get\(/.test(line) && !/requireRole\(|requireAdmin|requireRfidAccess/.test(line));
  assert.deepEqual(unguarded, []);
});

test('RFID controller never returns raw error messages to clients', () => {
  assert.doesNotMatch(controllerSource, /message:\s*error\.message/);
});

test('getAllLogs forwards failures to the error handler instead of leaking the message', async (t) => {
  const original = RFIDLog.findAll;
  RFIDLog.findAll = async () => { throw new Error('ER_DUP_ENTRY: column rfid_logs.secret'); };
  t.after(() => { RFIDLog.findAll = original; });

  let forwarded;
  const res = { json() { assert.fail('must not send a response body on failure'); } };
  await getAllLogs({ params: {}, query: {} }, res, (error) => { forwarded = error; });
  assert.match(forwarded.message, /ER_DUP_ENTRY/);
});

test('createLog forwards failures to the error handler instead of leaking the message', async (t) => {
  const original = Asset.findByPk;
  Asset.findByPk = async () => { throw new Error('ER_ACCESS_DENIED: internal host detail'); };
  t.after(() => { Asset.findByPk = original; });

  let forwarded;
  const res = { status() { return this; }, json() { assert.fail('must not send a response body on failure'); } };
  await createLog({ params: {}, body: { rfid_tag: 'TAG-1', asset_id: 5 }, user: { id: 1 } }, res, (error) => { forwarded = error; });
  assert.match(forwarded.message, /ER_ACCESS_DENIED/);
});
