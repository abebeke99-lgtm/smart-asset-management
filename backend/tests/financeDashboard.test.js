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

test('Finance dashboard years follow Asset purchase dates and depreciation totals use stored financial records', () => {
  const controllerSource = fs.readFileSync(path.resolve(__dirname, '../src/controllers/financeController.js'), 'utf8');
  const filterHandler = controllerSource.slice(controllerSource.indexOf('const getFinanceDashboardFilters ='), controllerSource.indexOf('const getFinanceDashboard ='));
  const dashboardHandler = controllerSource.slice(controllerSource.indexOf('const getFinanceDashboard ='), controllerSource.indexOf('const listValuation ='));

  assert.match(filterHandler, /Asset\.findAll\(\{ attributes: \['purchaseDate'\]/);
  assert.match(filterHandler, /asset\.purchaseDate/);
  assert.doesNotMatch(filterHandler, /row\.purchaseDate/);
  assert.match(dashboardHandler, /DepreciationRecord\.findAll\(\{ where: \{ assetId: \{ \[Op\.in\]: assetIds \}, status: 'POSTED' \}/);
  assert.match(dashboardHandler, /latestFinancialByAsset\.get\(asset\.id\)\?\.depreciationAmount/);
  assert.doesNotMatch(dashboardHandler, /purchasePrice\) - money\(asset\.currentValue/);
});

test('financial report depreciation comes from stored posted or financial records', () => {
  const controllerSource = fs.readFileSync(path.resolve(__dirname, '../src/controllers/financeController.js'), 'utf8');
  const reportsHandler = controllerSource.slice(controllerSource.indexOf('const listFinanceReports ='), controllerSource.indexOf('const generateFinanceReport ='));

  assert.match(reportsHandler, /DepreciationRecord\.findAll\(\{ where: \{ assetId: \{ \[Op\.in\]: assetIds \}, status: 'POSTED' \}/);
  assert.match(reportsHandler, /latestFinancialByAsset\.get\(asset\.id\)\?\.depreciationAmount/);
  assert.doesNotMatch(reportsHandler, /Math\.max\(0, purchaseCost - currentValue\)/);
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

test('Finance financial reports route uses the backend-backed report screen', () => {
  assert.match(appSource, /const FinanceFinancialReports = lazy\(\(\) => import\('\.\/components\/finance\/FinanceFinancialReports'\)\)/);
  assert.match(appSource, /<Route path="financial-reports" element={<FinanceFinancialReports \/>} \/>/);
  assert.match(appSource, /<Route path="budget" element={<FinanceReports \/>} \/>/);
});

test('financial report summaries aggregate only records for the selected report type', () => {
  const controllerSource = fs.readFileSync(path.resolve(__dirname, '../src/controllers/financeController.js'), 'utf8');
  const reportsHandler = controllerSource.slice(controllerSource.indexOf('const listFinanceReports ='), controllerSource.indexOf('const generateFinanceReport ='));

  assert.match(reportsHandler, /filters\.reportType === 'payments'[\s\S]*?\{ assets: \[\], purchaseOrders: \[\], invoices: \[\], payments \}/);
  assert.match(reportsHandler, /filters\.reportType === 'procurement'[\s\S]*?purchaseOrders, invoices: \[\]/);
  assert.match(reportsHandler, /const summary = buildFinanceReportSummary\(\{ \.\.\.summarySources, accumulatedDepreciation:/);
});

test('financial reports do not classify inventory movement quantities as financial transactions', () => {
  const controllerSource = fs.readFileSync(path.resolve(__dirname, '../src/controllers/financeController.js'), 'utf8');
  const reportsHandler = controllerSource.slice(controllerSource.indexOf('const listFinanceReports ='), controllerSource.indexOf('const generateFinanceReport ='));
  const generateHandler = controllerSource.slice(controllerSource.indexOf('const generateFinanceReport ='), controllerSource.indexOf('const listBudgetReports ='));

  assert.match(reportsHandler, /filters\.reportType === 'transactions'[\s\S]*?res\.status\(501\)/);
  assert.doesNotMatch(reportsHandler, /InventoryTransaction|transactionRows/);
  assert.doesNotMatch(controllerSource, /transactions: transactions\.reduce/);
  assert.match(generateHandler, /filters\.reportType === 'transactions'[\s\S]*?res\.status\(501\)/);
});

test('finance transactions do not synthesize ledger rows when no persisted ledger model exists', () => {
  const transactionController = require('../src/controllers/financeTransactionController');
  const routeSource = fs.readFileSync(path.resolve(__dirname, '../src/routes/financeRoutes.js'), 'utf8');
  const appSource = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/components/finance/FinanceTransactions.jsx'), 'utf8');

  assert.match(routeSource, /router\.get\('\/transactions', \.\.\.financeAccess, listFinanceTransactions\)/);
  assert.doesNotMatch(routeSource, /router\.(post|put|patch|delete)\('\/transactions/);
  assert.doesNotMatch(appSource, /openEdit\(\s*selectedTransaction\s*\)/);
  assert.ok(transactionController.listFinanceTransactions);
});

test('finance valuation routes expose the real asset valuation detail and depreciation history endpoints', () => {
  assert.match(routeSource, /router\.get\(['"]\/valuation\/:id['"]/i);
  assert.match(routeSource, /router\.get\(['"]\/valuation\/:id\/depreciation['"]/i);
  assert.match(routeSource, /router\.get\(['"]\/assets\/:id\/valuation-history['"]/i);
});

test('finance asset records apply condition, use valid Asset sort fields, and summarize all filtered records', () => {
  const controllerSource = fs.readFileSync(path.resolve(__dirname, '../src/controllers/financeController.js'), 'utf8');
  const listHandler = controllerSource.slice(controllerSource.indexOf('const listValuation ='), controllerSource.indexOf('const getAssetValuationDetail ='));

  assert.match(listHandler, /const condition = req\.query\.condition/);
  assert.match(listHandler, /if \(condition\) where\.condition = condition/);
  assert.match(listHandler, /requestedSort === 'assetTag' \? 'assetCode'/);
  assert.match(listHandler, /sortableFields\.includes\(requestedSort\)/);
  assert.match(listHandler, /getValuationSummary\(filteredAssets\.map\(normalizeAsset\)\)/);
  assert.doesNotMatch(listHandler, /getValuationSummary\(paginatedAssets\)/);
});

test('finance revaluation preserves omitted settings from the latest financial record', () => {
  const controllerSource = fs.readFileSync(path.resolve(__dirname, '../src/controllers/financeController.js'), 'utf8');
  const updateHandler = controllerSource.slice(controllerSource.indexOf('const updateValuation ='), controllerSource.indexOf('const valuationHistory ='));

  assert.match(updateHandler, /FinancialRecord\.findOne\(\{ where: \{ assetId: asset\.id \}.*transaction: tx \}\)/);
  assert.match(updateHandler, /req\.body\.additional_costs \?\? previousRecord\?\.additionalCosts/);
  assert.match(updateHandler, /req\.body\.residual_value \?\? previousRecord\?\.residualValue/);
  assert.match(updateHandler, /req\.body\.useful_life \?\? previousRecord\?\.usefulLife/);
  assert.match(updateHandler, /req\.body\.depreciation_method \|\| previousRecord\?\.depreciationMethod/);
  assert.match(updateHandler, /previousRecord \? 'revaluation' : 'valuation'/);
  assert.match(updateHandler, /Invalid financial record type/);
});

test('finance depreciation routes expose listing, calculation, and posting endpoints for the authoritative depreciation workflow', () => {
  assert.match(routeSource, /router\.get\(['"]\/depreciation['"]/i);
  assert.match(routeSource, /router\.get\(['"]\/depreciation\/:id['"]/i);
  assert.match(routeSource, /router\.post\(['"]\/depreciation\/calculate['"]/i);
  assert.match(routeSource, /router\.post\(['"]\/depreciation\/post['"]/i);
});

test('depreciation uses persisted configuration and backend Straight Line period calculation only', () => {
  const serviceSource = fs.readFileSync(path.resolve(__dirname, '../src/services/depreciationService.js'), 'utf8');
  const screenSource = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/components/finance/FinanceDepreciation.jsx'), 'utf8');

  assert.match(serviceSource, /Only the configured Straight Line method is currently supported/);
  assert.match(serviceSource, /Math\.round\(basis \/ usefulLife \/ 12\)/);
  assert.match(screenSource, /axios\.post\('\/api\/finance\/depreciation\/calculate'/);
  assert.match(screenSource, /axios\.post\('\/api\/finance\/depreciation\/post'/);
  assert.doesNotMatch(screenSource, /axios\.get\('\/api\/assets'/);
  assert.doesNotMatch(screenSource, /purchaseCost \* 0\.1|usefulLife \|\| 5/);
  assert.doesNotMatch(screenSource, /Array\.from\(\{ length: 10 \}/);
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

test('Finance payment list filters dates and summarizes all matching database rows without exposing bank account data', () => {
  const paymentControllerSource = fs.readFileSync(path.resolve(__dirname, '../src/controllers/financePaymentController.js'), 'utf8');
  const paymentScreenSource = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/components/finance/FinancePayments.jsx'), 'utf8');

  assert.match(paymentControllerSource, /delete safeValue\.bankAccount/);
  const invoiceControllerSource = fs.readFileSync(path.resolve(__dirname, '../src/controllers/financeInvoiceController.js'), 'utf8');
  assert.match(invoiceControllerSource, /const safeValue = \{ \.\.\.value \}/);
  assert.match(invoiceControllerSource, /delete safeValue\.bankAccount/);
  assert.match(paymentControllerSource, /where\.paymentDate\[Op\.gte\] = dateFrom/);
  assert.match(paymentControllerSource, /where\.paymentDate\[Op\.lte\] = dateTo/);
  assert.match(paymentControllerSource, /Payment\.sum\('amount', \{ where \}\)/);
  assert.match(paymentControllerSource, /Payment\.count\(\{ where: \{ \.\.\.where, status: 'PENDING_APPROVAL' \} \}\)/);
  assert.match(paymentScreenSource, /params\.dateFrom = dateFrom/);
  assert.match(paymentScreenSource, /params\.dateTo = dateTo/);
  assert.doesNotMatch(paymentScreenSource, /PAY-\$\{Date\.now\(\)\}|REF-\$\{Date\.now\(\)\}/);
  assert.match(paymentScreenSource, /summary\.totalAmount/);
  assert.match(paymentScreenSource, /summary\.pending \+ summary\.approved \+ summary\.processing/);
});

test('Finance notifications use recipient-scoped backend search and pagination', () => {
  const notificationController = fs.readFileSync(path.resolve(__dirname, '../src/controllers/financeNotificationController.js'), 'utf8');
  const notificationScreen = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/components/finance/FinanceNotifications.jsx'), 'utf8');

  assert.match(notificationController, /const where = \{ userId: req\.user\.id \}/);
  assert.match(notificationController, /offset: \(page - 1\) \* limit/);
  assert.match(notificationController, /where\[Op\.or\] = \[\{ title:/);
  assert.match(notificationController, /pagination: \{ page, limit, total, totalPages:/);
  assert.match(notificationScreen, /params\.set\("page", String\(page\)\)/);
  assert.match(notificationScreen, /params\.set\("search", search\.trim\(\)\)/);
});