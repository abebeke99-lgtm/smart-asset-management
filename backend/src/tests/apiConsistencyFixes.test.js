const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const financeRoutes = require('../routes/financeRoutes');

test('finance router exposes the invoices CRUD contract used by the frontend', () => {
  for (const [method, routePath] of [
    ['get', '/invoices'],
    ['get', '/invoices/:id'],
    ['post', '/invoices'],
    ['put', '/invoices/:id'],
    ['delete', '/invoices/:id'],
  ]) {
    const route = financeRoutes.stack.find((layer) => layer.route && layer.route.path === routePath && layer.route.methods[method]);
    assert.ok(route, `expected ${method.toUpperCase()} ${routePath} route in the finance router`);
    assert.equal(typeof route.route.stack[0].handle, 'function');
  }
});

test('assignment history deletion is rejected so assignment records remain auditable', () => {
  const assignmentRoutes = require('../routes/assignmentRoutes');
  const deleteRoute = assignmentRoutes.stack.find((layer) => layer.route && layer.route.path === '/:id' && layer.route.methods.delete);
  assert.ok(deleteRoute, 'expected a protected DELETE /:id rejection route in the assignment router');
  const routeSource = fs.readFileSync(path.join(__dirname, '../routes/assignmentRoutes.js'), 'utf8');
  assert.match(routeSource, /status\(405\)\.json\(\{ success: false, message: 'Assignment history is retained/);
  assert.doesNotMatch(routeSource, /assignment\.destroy\(/, 'assignment records must never be destroyed');
});

test('invoice models are registered and associated with the include aliases the controller relies on', () => {
  const models = require('../models');
  assert.ok(models.Invoice, 'expected Invoice model to be registered');
  assert.ok(models.InvoiceItem, 'expected InvoiceItem model to be registered');
  const indexSource = fs.readFileSync(path.join(__dirname, '../models/index.js'), 'utf8');
  assert.match(indexSource, /Invoice\.hasMany\(InvoiceItem, \{ foreignKey: 'invoiceId', as: 'items'/);
  assert.match(indexSource, /Invoice\.belongsTo\(PurchaseOrder, \{ foreignKey: 'purchaseOrderId', as: 'PurchaseOrder' \}\)/);
  assert.match(indexSource, /Invoice\.belongsTo\(Department, \{ foreignKey: 'departmentId', as: 'DepartmentRecord' \}\)/);
  assert.match(indexSource, /Invoice\.belongsTo\(User, \{ foreignKey: 'createdBy', as: 'Creator' \}\)/);
});

test('bulk notification deletion is registered before the id-scoped notification delete so it is not shadowed', () => {
  const adminSupportRoutes = require('../routes/adminSupportRoutes');
  const deleteRoutes = adminSupportRoutes.stack
    .filter((layer) => layer.route && layer.route.path && layer.route.methods.delete)
    .filter((layer) => String(layer.route.path).startsWith('/notifications'))
    .map((layer) => layer.route.path);

  assert.ok(deleteRoutes.includes('/notifications/all'), 'expected a /notifications/all delete route');
  assert.ok(deleteRoutes.includes('/notifications/:id'), 'expected a /notifications/:id delete route');
  assert.ok(
    deleteRoutes.indexOf('/notifications/all') < deleteRoutes.indexOf('/notifications/:id'),
    'expected /notifications/all to be matched before the param route so it cannot be shadowed',
  );
});

test('app registers a JSON 404 handler for unmatched /api routes before the error middleware', () => {
  const appSource = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
  const api404Index = appSource.indexOf("app.use('/api', (req, res) => {");
  const errorIndex = appSource.indexOf('app.use((err, req, res, next) => {');
  assert.ok(api404Index >= 0, 'expected a JSON 404 handler for unmatched /api routes');
  assert.ok(errorIndex > api404Index, 'expected the /api 404 handler to be registered before the error middleware');
  assert.match(appSource, /status\(404\)\.json\(\{ success: false, message: 'API endpoint not found' \}\)/);
});

test('dead legacy admin router file has been removed from the project', () => {
  assert.equal(fs.existsSync(path.join(__dirname, '../routes/adminRoutes.js')), false, 'expected removal of the unmounted legacy adminRoutes.js');
});