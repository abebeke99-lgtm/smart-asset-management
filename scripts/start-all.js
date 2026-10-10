const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const backendRoot = path.resolve(projectRoot, 'backend');
const frontendRoot = path.resolve(projectRoot, 'frontend');
const isDevelopment = process.argv.includes('--dev');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const children = [];
let shuttingDown = false;

function getBackendPort() {
  const envPath = path.join(backendRoot, '.env');
  let fileEnv = {};

  if (fs.existsSync(envPath)) {
    const dotenvPath = require.resolve('dotenv', { paths: [backendRoot] });
    fileEnv = require(dotenvPath).parse(fs.readFileSync(envPath));
  }

  const port = Number(process.env.PORT || fileEnv.PORT || 5000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be a valid TCP port.');
  }
  return port;
}

function stopProcess(child) {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) return Promise.resolve();

  if (process.platform === 'win32') {
    return new Promise((resolve) => {
      const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
      killer.once('error', (error) => {
        console.error(`[shutdown] Could not stop process tree ${child.pid}: ${error.message}`);
        resolve();
      });
      killer.once('exit', (code) => {
        if (code !== 0 && child.exitCode === null && child.signalCode === null) {
          console.error(`[shutdown] Could not stop process tree ${child.pid} (taskkill exit ${code}).`);
        }
        resolve();
      });
    });
  }

  child.kill();
  return Promise.resolve();
}

function startProcess(command, args, name, options = {}) {
  const child = spawn(command, args, {
    cwd: projectRoot,
    stdio: 'inherit',
    env: process.env,
    shell: command === npmCommand,
    ...options
  });

  children.push({ child, name });
  child.on('error', (error) => {
    console.error(`[${name}] ${error.message}`);
    shutdown(1);
  });
  child.on('exit', (code, signal) => {
    if (!shuttingDown && (code || signal)) {
      console.error(`[${name}] stopped unexpectedly.`);
      shutdown(code || 1);
    }
  });
  return child;
}

function backendIsHealthy(port) {
  return new Promise((resolve) => {
    const request = http.get(`http://127.0.0.1:${port}/api/health`, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => {
        try {
          const health = JSON.parse(body);
          resolve(response.statusCode === 200 && health.status === 'ok' && health.database === 'connected');
        } catch {
          resolve(false);
        }
      });
    });
    request.setTimeout(1500, () => {
      request.destroy();
      resolve(false);
    });
    request.on('error', () => resolve(false));
  });
}

async function waitForBackend(child, port, {
  isHealthy = backendIsHealthy,
  startupTimeoutMs = 180000,
  intervalMs = 1000,
} = {}) {
  const startupDeadline = Date.now() + startupTimeoutMs;

  while (!shuttingDown && Date.now() < startupDeadline) {
    if (await isHealthy(port)) return;
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error('The backend stopped before its database-backed health check passed.');
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  if (!shuttingDown) {
    throw new Error(`The backend did not become healthy on port ${port}. Check MySQL and backend/.env.`);
  }
}

async function startApplication({
  spawnProcess = startProcess,
  port = getBackendPort(),
  development = isDevelopment,
  waitForHealth = waitForBackend,
} = {}) {
  const backend = development
    ? spawnProcess(npmCommand, ['run', 'dev'], 'backend', { cwd: backendRoot })
    : spawnProcess(process.execPath, ['scripts/start-backend.js'], 'backend');

  console.log(`Starting backend${development ? ' in development mode' : ''}...`);
  await waitForHealth(backend, port);
  if (shuttingDown) return;

  console.log(`Backend and database are healthy on port ${port}. Starting frontend...`);
  spawnProcess(npmCommand, ['start'], 'frontend', { cwd: frontendRoot });
}

async function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  await Promise.all(children.map(({ child }) => stopProcess(child)));
  process.exit(exitCode);
}

function main() {
  process.on('SIGINT', () => shutdown(0));
  process.on('SIGTERM', () => shutdown(0));

  startApplication().catch((error) => {
    console.error(`[startup] ${error.message}`);
    shutdown(1);
  });
}

if (require.main === module) main();

module.exports = { backendIsHealthy, getBackendPort, startApplication, waitForBackend };