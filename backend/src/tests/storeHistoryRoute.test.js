const test = require('node:test');
const assert = require('node:assert/strict');

const storeRoutes = require('../routes/storeRoutes');

test('store routes expose a store manager movement history endpoint', () => {
  const historyRoute = storeRoutes.stack.find((layer) => layer.route && layer.route.path === '/history' && layer.route.methods.get);

  assert.ok(historyRoute, 'expected /history GET route in the store router');
  assert.equal(historyRoute.route.path, '/history');
});
