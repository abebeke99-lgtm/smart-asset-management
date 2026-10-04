const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Readable } = require('node:stream');
const { requirePermission } = require('../src/middlewares/auth');
const ictAssetRoutes = require('../src/routes/ictAssetRoutes');

const appSource = fs.readFileSync(path.resolve(__dirname, '../src/app.js'), 'utf8');
const routeSource = fs.readFileSync(path.resolve(__dirname, '../src/routes/ictAssetRoutes.js'), 'utf8');

test('ICT asset routes are registered without the conflicting duplicate mount', () => {
  assert.doesNotMatch(appSource, /app\.use\('\/api\/ict\/assets',\s*ictAssetRoutes\)/);
  assert.match(appSource, /app\.use\('\/api\/ict',\s*ictAssetRoutes\)/);
  assert.match(routeSource, /router\.get\('\/assets',\s*\.\.\.scopedIctAccess\('ict\.assets\.view'\),\s*controller\.listIctAssets\)/);
  assert.match(routeSource, /router\.get\('\/assets\/:id',\s*\.\.\.scopedIctAccess\('ict\.assets\.view'\),\s*controller\.getIctAsset\)/);
  assert.match(routeSource, /router\.get\('\/reports',\s*\.\.\.scopedIctAccess\('ict\.reports\.view'\),\s*reportController\.getIctReports\)/);
  assert.match(routeSource, /router\.get\('\/reports\/export',\s*\.\.\.scopedIctAccess\('ict\.reports\.export'\),\s*reportController\.exportIctReport\)/);
  assert.match(routeSource, /router\.get\('\/inventory',\s*\.\.\.scopedIctAccess\('ict\.inventory\.view'\),\s*ictInventoryController\.getInventory\)/);
  assert.match(routeSource, /router\.post\('\/inventory\/import',\s*\.\.\.scopedIctAccess\('ict\.inventory\.import'\),\s*receiveInventoryImport,\s*ictInventoryController\.importInventory\)/);
  assert.match(routeSource, /limits:\s*\{\s*fileSize:\s*10\s*\*\s*1024\s*\*\s*1024/);
  assert.match(routeSource, /requireRole\('admin', 'ict_officer'\)/);
  assert.match(routeSource, /requirePermission\(permission\)/);
});

test('inventory and reports view and export permissions are independently enforced', () => {
  const checkPermission = (permission, permissions) => {
    const res = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        this.body = body;
        return this;
      },
    };
    let proceeded = false;
    requirePermission(permission)(
      { user: { role: 'ict_officer', permissions } },
      res,
      () => { proceeded = true; },
    );
    return { res, proceeded };
  };

  assert.equal(checkPermission('ict.inventory.view', ['ict.inventory.view']).proceeded, true);
  assert.equal(checkPermission('ict.inventory.import', ['ict.inventory.import']).proceeded, true);
  assert.equal(checkPermission('ict.inventory.view', ['ict.inventory.import']).res.statusCode, 403);
  assert.equal(checkPermission('ict.inventory.import', ['ict.inventory.view']).res.statusCode, 403);
  assert.equal(checkPermission('ict.reports.view', ['ict.reports.view']).proceeded, true);
  assert.equal(checkPermission('ict.reports.export', ['ict.reports.export']).proceeded, true);
  assert.equal(checkPermission('ict.reports.view', ['ict.reports.export']).res.statusCode, 403);
  assert.equal(checkPermission('ict.reports.export', ['ict.reports.view']).res.statusCode, 403);
});

test('inventory import upload rejects unsupported types and files over 10 MB', async () => {
  const importRoute = ictAssetRoutes.stack.find((layer) => layer.route?.path === '/inventory/import');
  const uploadMiddleware = importRoute.route.stack.find((layer) => layer.handle.name === 'receiveInventoryImport').handle;
  const invokeUpload = async (filename, mimeType, contents) => {
    const boundary = 'ict-inventory-test-boundary';
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`),
      contents,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    const req = Readable.from([body]);
    req.headers = {
      'content-type': `multipart/form-data; boundary=${boundary}`,
      'content-length': String(body.length),
    };
    req.method = 'POST';
    req.body = {};
    let complete;
    const completed = new Promise((resolve) => { complete = resolve; });
    const res = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.body = payload;
        complete();
        return this;
      },
    };
    let proceeded = false;
    uploadMiddleware(req, res, () => {
      proceeded = true;
      complete();
    });
    await completed;
    return { req, res, proceeded };
  };

  const rejectedType = await invokeUpload('inventory.exe', 'application/octet-stream', Buffer.from('bad'));
  assert.equal(rejectedType.res.statusCode, 400);
  assert.equal(rejectedType.proceeded, false);

  const oversize = await invokeUpload('inventory.csv', 'text/csv', Buffer.alloc(10 * 1024 * 1024 + 1, 97));
  assert.equal(oversize.res.statusCode, 413, JSON.stringify(oversize.res.body));
  assert.equal(oversize.proceeded, false);

  const accepted = await invokeUpload('inventory.csv', 'text/csv', Buffer.from('Asset Name\nLaptop'));
  assert.equal(accepted.proceeded, true);
  assert.equal(accepted.req.file.originalname, 'inventory.csv');
});
