const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const routeSource = fs.readFileSync(path.resolve(__dirname, '../src/routes/infrastructureRoutes.js'), 'utf8');
const apiClientSource = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/services/apiClient.js'), 'utf8');
const transformersComponentSource = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/components/infrastructure/InfrastructureTransformers.jsx'), 'utf8');

test('infrastructure transformer route is mounted under the real API namespace', () => {
  assert.match(routeSource, /router\.get\('\/transformers', requireRole\('admin', 'infrastructure'\), getTransformers\)/);
  assert.doesNotMatch(routeSource, /router\.get\('\/transformers', requireRole\('admin', 'infrastructure'\), .*undefined/);
});

test('shared API client uses the authenticated API namespace and transformer page calls the mounted route', () => {
  assert.match(apiClientSource, /baseURL:\s*API_BASE_URL/);
  assert.match(apiClientSource, /http:\/\/localhost:5000\/api|\/api\$/);
  assert.match(transformersComponentSource, /['\"]\/api\/infrastructure\/transformers['\"]/);
  assert.doesNotMatch(transformersComponentSource, /['\"]\/infrastructure\/transformers['\"]/);
});
