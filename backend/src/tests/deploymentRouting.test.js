const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { readFileSync } = require('node:fs');

test('Vercel proxies API paths to the backend before applying the SPA fallback', () => {
  const configPath = path.resolve(__dirname, '../../../vercel.json');
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  const apiRewriteIndexes = config.rewrites
    .map((rewrite, index) => ({ rewrite, index }))
    .filter(({ rewrite }) => rewrite.source === '/api' || rewrite.source === '/api/(.*)');
  const spaRewriteIndex = config.rewrites.findIndex((rewrite) => rewrite.destination === '/index.html');

  assert.equal(apiRewriteIndexes.length, 2);
  assert.ok(apiRewriteIndexes.every(({ index }) => index < spaRewriteIndex));
  assert.ok(apiRewriteIndexes.every(({ rewrite }) => rewrite.destination.startsWith('https://smart-asset-management-3-production-9258.up.railway.app/api')));
});
