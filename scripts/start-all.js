const { spawn } = require('child_process');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const isDevelopment = process.argv.includes('--dev');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const children = [];
let shuttingDown = false;

function stopProcess(child) {
  if (child.killed) return;

  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    child.kill();
  }
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
}

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const { child } of children) {
    stopProcess(child);
  }

  setTimeout(() => process.exit(exitCode), 250);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

if (isDevelopment) {
  startProcess(npmCommand, ['--prefix', 'backend', 'run', 'dev'], 'backend');
} else {
  startProcess(process.execPath, ['scripts/start-backend.js'], 'backend');
}

startProcess(npmCommand, ['--prefix', 'frontend', 'start'], 'frontend');

console.log(`Starting backend and frontend${isDevelopment ? ' in development mode' : ''}...`);