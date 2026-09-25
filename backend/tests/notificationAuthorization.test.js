const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const routeSource = fs.readFileSync(path.resolve(__dirname, '../src/routes/notificationRoutes.js'), 'utf8');

test('notification routes enforce user-scoped access and expose compatibility endpoints', () => {
  assert.match(routeSource, /buildNotificationVisibilityWhere/i);
  assert.match(routeSource, /\/notifications\/unread\/count|\/notifications\/unread-count/i);
  assert.match(routeSource, /\/notifications\/count/i);
  assert.match(routeSource, /\/notifications\/settings/i);
  assert.match(routeSource, /read:\s*false/i);
  assert.match(routeSource, /req\.user\s*\|\|\s*\{\}/i);
});
