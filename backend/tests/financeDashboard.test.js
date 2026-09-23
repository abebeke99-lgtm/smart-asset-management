const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const routeSource = fs.readFileSync(path.resolve(__dirname, '../src/routes/financeRoutes.js'), 'utf8');
const appSource = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/App.jsx'), 'utf8');

test('finance dashboard routes expose dashboard and dashboard filter endpoints for finance authorized access', () => {
  assert.match(routeSource, /router\.get\(['"]\/dashboard['"]/i);
  assert.match(routeSource, /router\.get\(['"]\/dashboard\/filters['"]/i);
  assert.match(routeSource, /financeAccess/i);
});

test('finance report routes expose asset value, financial, budget, and depreciation report endpoints', () => {
  assert.match(routeSource, /router\.get\(['"]\/financial-reports['"]/i);
  assert.match(routeSource, /router\.get\(['"]\/financial-reports\/filters['"]/i);
  assert.match(routeSource, /router\.get\(['"]\/budget-reports['"]/i);
  assert.match(routeSource, /router\.get\(['"]\/budget-reports\/filters['"]/i);
  assert.match(routeSource, /router\.get\(['"]\/depreciation-reports['"]/i);
  assert.match(routeSource, /router\.get\(['"]\/depreciation-reports\/filters['"]/i);
  assert.match(routeSource, /router\.get\(['"]\/asset-value-reports['"]/i);
  assert.match(routeSource, /router\.get\(['"]\/asset-value-reports\/filters['"]/i);
});

test('finance valuation routes expose the real asset valuation detail and depreciation history endpoints', () => {
  assert.match(routeSource, /router\.get\(['"]\/valuation\/:id['"]/i);
  assert.match(routeSource, /router\.get\(['"]\/valuation\/:id\/depreciation['"]/i);
  assert.match(routeSource, /router\.get\(['"]\/assets\/:id\/valuation-history['"]/i);
});

test('finance depreciation routes expose listing, calculation, and posting endpoints for the authoritative depreciation workflow', () => {
  assert.match(routeSource, /router\.get\(['"]\/depreciation['"]/i);
  assert.match(routeSource, /router\.get\(['"]\/depreciation\/:id['"]/i);
  assert.match(routeSource, /router\.post\(['"]\/depreciation\/calculate['"]/i);
  assert.match(routeSource, /router\.post\(['"]\/depreciation\/post['"]/i);
});

test('finance purchase requests route is exposed for finance users in the app shell and backend routes', () => {
  assert.match(routeSource, /router\.get\(['"]\/purchase-requests['"]/i);
  assert.match(appSource, /FinancePurchaseRequests/i);
  assert.match(appSource, /path=\"purchase-requests\"/i);
  assert.match(appSource, /path=\"\/finance\"/i);
});
test('invoice payment history is exposed for each invoice through the real payment records flow', () => {
  const invoiceControllerSource = fs.readFileSync(path.resolve(__dirname, '../src/controllers/financeInvoiceController.js'), 'utf8');
  assert.match(routeSource, /router\.get\(['"]\/invoices\/:id\/payments['"]/i);
  assert.match(invoiceControllerSource, /listInvoicePayments|Payment\.findAll|invoiceId/i);
});