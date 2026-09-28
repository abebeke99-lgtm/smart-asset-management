const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeTestResult, validateTestResult } = require('../utils/maintenanceTesting');

test('normalizes only supported maintenance test results', () => {
  assert.equal(normalizeTestResult('pass'), 'Passed');
  assert.equal(normalizeTestResult('FAIL'), 'Failed');
  assert.equal(normalizeTestResult('retest_required'), 'Retest Required');
  assert.equal(normalizeTestResult('conditional pass'), '');
});

test('requires explicit observations and completed required checks before pass', () => {
  assert.match(validateTestResult({ result: 'pass' }).message, /observed test result/);
  assert.match(validateTestResult({ result: 'pass', actualResult: 'Powers on', checklist: [{ label: 'Power', completed: false }] }).message, /required checklist/);
  assert.equal(validateTestResult({ result: 'pass', actualResult: 'Powers on', checklist: [{ label: 'Power', completed: true }] }).message, '');
});

test('requires actionable failure details for failed and retest outcomes', () => {
  const missing = validateTestResult({ result: 'fail', actualResult: 'No power' });
  assert.equal(missing.message, 'Record a failure reason.');

  const valid = validateTestResult({
    result: 'retest required',
    actualResult: 'No power',
    failureReason: 'Unit does not start',
    failedCheck: 'Power-on check',
    recommendedAction: 'Return to repair',
  });
  assert.equal(valid.message, '');
});