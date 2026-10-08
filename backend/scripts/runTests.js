const { spawnSync } = require('node:child_process');
const path = require('node:path');

const arguments_ = process.argv.slice(2);
const jest = arguments_.includes('--jest');
const runnerArguments = arguments_.filter((argument) => argument !== '--jest');
const testCommand = jest
  ? [process.execPath, [path.resolve(__dirname, '../node_modules/jest/bin/jest.js'), ...runnerArguments]]
  : [process.execPath, ['--test', ...runnerArguments]];
const result = spawnSync(testCommand[0], testCommand[1], {
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
