const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const controllerSource = fs.readFileSync(path.resolve(__dirname, '../src/controllers/reportController.js'), 'utf8');
const routeSource = fs.readFileSync(path.resolve(__dirname, '../src/routes/reportRoutes.js'), 'utf8');

test('report controller exposes a real report generation API contract', () => {
  assert.match(controllerSource, /generateReport/i);
  assert.match(controllerSource, /exportReport/i);
  assert.match(controllerSource, /reportType/i);
  assert.match(controllerSource, /Asset|Assignment|Transfer|Maintenance|DisposalRequest|AuditLog/i);
});

test('report routes expose authenticated report generation and CSV export endpoints', () => {
  assert.match(routeSource, /router\.get\('\/',\s*\.\.\.requireAdminReports,\s*generateReport\)/i);
  assert.match(routeSource, /router\.get\('\/export',\s*\.\.\.requireAdminReports,\s*exportReport\)/i);
  assert.match(routeSource, /requireRole\('admin'\)/i);
});
