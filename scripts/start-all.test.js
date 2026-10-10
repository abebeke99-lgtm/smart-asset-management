const assert = require('node:assert/strict');
const http = require('node:http');
const { once } = require('node:events');
const test = require('node:test');
const { backendIsHealthy, startApplication, waitForBackend } = require('./start-all');

test('backend health requires both HTTP success and a connected database', async (t) => {
  let health = { status: 'ok', database: 'connected' };
  const server = http.createServer((_request, response) => {
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify(health));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));

  const { port } = server.address();
  assert.equal(await backendIsHealthy(port), true);

  health = { status: 'error', database: 'unavailable' };
  assert.equal(await backendIsHealthy(port), false);
});

test('launcher starts the frontend only after backend readiness succeeds', async () => {
  const started = [];
  let markHealthy;
  const ready = new Promise((resolve) => { markHealthy = resolve; });
  const backendChild = { exitCode: null, signalCode: null };
  const spawnProcess = (_command, _args, name) => {
    started.push(name);
    return backendChild;
  };
  const application = startApplication({
    spawnProcess,
    port: 5000,
    development: true,
    waitForHealth: async () => ready,
  });

  assert.deepEqual(started, ['backend']);
  markHealthy();
  await application;
  assert.deepEqual(started, ['backend', 'frontend']);
});

test('launcher does not start the frontend when backend readiness fails', async () => {
  const started = [];
  const backendChild = { exitCode: null, signalCode: null };
  const spawnProcess = (_command, _args, name) => {
    started.push(name);
    return backendChild;
  };

  await assert.rejects(
    startApplication({
      spawnProcess,
      port: 5000,
      development: true,
      waitForHealth: async () => { throw new Error('database unavailable'); },
    }),
    /database unavailable/,
  );
  assert.deepEqual(started, ['backend']);
});

test('waitForBackend rejects a child that exits before database readiness', async () => {
  await assert.rejects(
    waitForBackend({ exitCode: 1, signalCode: null }, 5000, {
      isHealthy: async () => false,
      startupTimeoutMs: 100,
      intervalMs: 1,
    }),
    /stopped before its database-backed health check passed/,
  );
});
