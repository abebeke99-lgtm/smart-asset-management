const supportedResults = new Set(['Passed', 'Failed', 'Retest Required']);

const normalizeTestResult = (value) => {
  const normalized = String(value || '').trim().toLowerCase().replace(/[_-]+/g, ' ');
  if (normalized === 'pass' || normalized === 'passed') return 'Passed';
  if (normalized === 'fail' || normalized === 'failed') return 'Failed';
  if (normalized === 'retest required') return 'Retest Required';
  return '';
};

const validateTestResult = (payload = {}) => {
  const result = normalizeTestResult(payload.overallResult ?? payload.result);
  if (!supportedResults.has(result)) return { result: '', message: 'Select a supported test result.' };

  if (!String(payload.actualResult || '').trim()) {
    return { result, message: 'Record the observed test result before completing the test.' };
  }

  const checklist = Array.isArray(payload.checklist) ? payload.checklist : [];
  const incompleteRequiredItem = checklist.find((item) => item && item.required !== false && !item.completed);
  if (result === 'Passed' && incompleteRequiredItem) {
    return { result, message: 'Complete every required checklist item before recording a pass.' };
  }

  if (result !== 'Passed') {
    const requiredFailureFields = [
      ['failureReason', 'Record a failure reason.'],
      ['failedCheck', 'Identify the failed test or check.'],
      ['actualResult', 'Record the observed condition.'],
      ['recommendedAction', 'Record the recommended corrective action.'],
    ];
    for (const [field, message] of requiredFailureFields) {
      if (!String(payload[field] || '').trim()) return { result, message };
    }
  }

  return { result, message: '' };
};

module.exports = { normalizeTestResult, validateTestResult, supportedResults };