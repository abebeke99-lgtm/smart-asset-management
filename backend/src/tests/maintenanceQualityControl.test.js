const test = require('node:test');
const assert = require('node:assert/strict');
const { validateQcDecision, isTestEligibleForQualityControl } = require('../utils/maintenanceQualityControl');

test('approved QC requires a passed technical test', () => {
  const testRecord = { maintenanceId: 10, assetId: 7, status: 'completed', overallResult: 'Passed' };
  assert.equal(isTestEligibleForQualityControl(testRecord), true);
  assert.equal(validateQcDecision('approved', { checklist: [{ requirement: 'Power works', result: 'pass' }] }, testRecord).message, '');
  assert.match(validateQcDecision('approved', { checklist: [{ requirement: 'Power works', result: 'fail' }] }, testRecord).message, /must pass/i);
});

test('rejected QC requires reason and corrective action', () => {
  const testRecord = { maintenanceId: 10, assetId: 7, status: 'completed', overallResult: 'Passed' };
  const invalid = validateQcDecision('rejected', { checklist: [{ requirement: 'Power works', result: 'pass' }] }, testRecord);
  assert.match(invalid.message, /Provide a rejection reason/i);

  const valid = validateQcDecision('rejected', {
    checklist: [{ requirement: 'Power works', result: 'pass' }],
    rejectionReason: 'Safety hazard',
    failedRequirement: 'Power switch',
    correctiveAction: 'Repair wiring',
  }, testRecord);
  assert.equal(valid.message, '');
});
