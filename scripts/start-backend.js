const { spawn, execSync } = require('child_process');
const net = require('net');
const path = require('path');

const PORT = Number(process.env.PORT || 5000);
const projectRoot = path.resolve(__dirname, '..');

function portInUse(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', (err) => resolve(err.code === 'EADDRINUSE'));
    server.once('listening', () => {
      server.close(() => resolve(false));
    });
    server.listen(port, '127.0.0.1');
  });
}

function clearPort(port) {
  try {
    execSync(
      `powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force }"`,
      { stdio: 'ignore' }
    );
  } catch (error) {
    // Ignore if no process is listening or PowerShell is unavailable.
  }
}

async function main() {
  const inUse = await portInUse(PORT);

  if (inUse) {
    console.log(`Port ${PORT} is already in use. Clearing stale listener...`);
    clearPort(PORT);

    setTimeout(async () => {
      const stillInUse = await portInUse(PORT);
      if (stillInUse) {
        console.error(`Port ${PORT} is still busy. Please stop the existing process manually and retry.`);
        process.exit(1);
      }
      startBackend();
    }, 500);
    return;
  }

  startBackend();
}

function startBackend() {
  const child = spawn(process.execPath, ['backend/src/app.js'], {
    cwd: projectRoot,
    stdio: 'inherit',
    env: { ...process.env, PORT: String(PORT) }
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
