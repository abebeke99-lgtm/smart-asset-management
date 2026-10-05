const { spawnSync } = require('node:child_process');

const result = spawnSync(process.execPath, ['--test', ...process.argv.slice(2)], {
  env: { ...process.env, NODE_ENV: 'test' },
  stdio: 'inherit',
});

if (result.error) {
  console.error('Unable to start the backend test runner:', result.error.message);
  process.exitCode = 1;
} else if (result.signal) {
  console.error(`Backend test runner terminated by signal ${result.signal}.`);
  process.exitCode = 1;
} else {
  process.exitCode = result.status ?? 1;
}
