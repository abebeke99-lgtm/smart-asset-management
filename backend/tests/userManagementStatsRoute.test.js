const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const routePath = path.join(__dirname, '../src/routes/adminSupportRoutes.js');
const routeSource = fs.readFileSync(routePath, 'utf8');

test('admin user management exposes a real statistics endpoint', () => {
  assert.match(routeSource, /router\.get\('\/users\/stats'/, 'expected user stats route');
  assert.match(routeSource, /count\s*\(\s*\{\s*where\s*:\s*\{\s*active\s*:\s*true/,
    'expected active user count query');
  assert.match(routeSource, /count\s*\(\s*\{\s*where\s*:\s*\{\s*active\s*:\s*false/,
    'expected inactive user count query');
  assert.match(routeSource, /role\s*:\s*'admin'/,
    'expected admin role count query');
});
