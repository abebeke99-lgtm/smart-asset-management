const { spawn } = require('child_process');
const http = require('http');
const net = require('net');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const backendRoot = path.resolve(projectRoot, 'backend');
require(path.resolve(backendRoot, 'node_modules/dotenv')).config({ path: path.resolve(backendRoot, '.env') });
const PORT = Number(process.env.PORT || 5000);

function portInUse(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', (err) => resolve(err.code === 'EADDRINUSE'));
    server.once('listening', () => {
      server.close(() => resolve(false));
    });
    server.listen(port, '0.0.0.0');
  });
}

function backendIsHealthy(port) {
  return new Promise((resolve) => {
    const request = http.get(`http://127.0.0.1:${port}/api/health`, (response) => {
      response.resume();
      resolve(response.statusCode === 200);
    });
    request.setTimeout(1000, () => {
      request.destroy();
      resolve(false);
    });
    request.on('error', () => resolve(false));
  });
}

async function main() {
  const inUse = await portInUse(PORT);

  if (inUse) {
    if (await backendIsHealthy(PORT)) {
      console.log(`Backend is already running and healthy on port ${PORT}.`);
      return;
    }

    console.error(`Port ${PORT} is in use by a process that is not a healthy backend. Identify and stop it manually, or configure another PORT.`);
    process.exitCode = 1;
    return;
  }

  startBackend();
}

function startBackend() {
  const child = spawn(process.execPath, ['src/app.js'], {
    cwd: backendRoot,
    stdio: 'inherit',
    env: { ...process.env, PORT: String(PORT) },
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });
}

main();
