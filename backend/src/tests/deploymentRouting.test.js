const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { readFileSync } = require('node:fs');
const request = require('supertest');
const app = require('../app');

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

test('production CORS accepts the project Vercel domain and preview preflights with Authorization', async () => {
  const response = await request(app)
    .options('/api/college/dashboard')
    .set('Origin', 'https://smart-asset-management-six-git-audit-abebeke99-lgtm.vercel.app')
    .set('Access-Control-Request-Method', 'GET')
    .set('Access-Control-Request-Headers', 'authorization');

  assert.equal(response.status, 204);
  assert.equal(response.headers['access-control-allow-origin'], 'https://smart-asset-management-six-git-audit-abebeke99-lgtm.vercel.app');
  assert.match(response.headers['access-control-allow-headers'], /authorization/i);
});
