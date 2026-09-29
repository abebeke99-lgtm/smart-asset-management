const decisions = new Set(['approved', 'rejected', 'conditional-approval', 'retest-required']);
const activeStatuses = new Set(['pending', 'in-review']);

const normalizeQcStatus = (value) => String(value || '').trim().toLowerCase().replace(/[_\s]+/g, '-');
const normalizeTestStatus = (value) => String(value || '').trim().toLowerCase().replace(/[_\s]+/g, '-');
const resolveQcStatusForDecision = (decision, requestedStatus) => normalizeQcStatus(requestedStatus) || normalizeQcStatus(decision) || 'in-review';

const isTestEligibleForQualityControl = (test) => {
  if (!test || !test.maintenanceId || !test.assetId) return false;
  const status = normalizeTestStatus(test.status);
  const result = normalizeTestStatus(test.overallResult);
  return ['passed', 'completed'].includes(status) && ['passed', 'pass'].includes(result);
};

const validateChecklist = (checklist = []) => {
  if (!Array.isArray(checklist)) return 'Checklist must be a list.';
  for (const item of checklist) {
    if (!item || typeof item.requirement !== 'string' || !item.requirement.trim()) {
      return 'Every checklist item needs a requirement.';
    }
    if (!['pass', 'fail', 'not-applicable'].includes(normalizeQcStatus(item.result))) {
      return `Complete the result for: ${item.requirement}`;
    }
    if (item.required !== false && normalizeQcStatus(item.result) !== 'pass') {
      return `Required checklist item must pass: ${item.requirement}`;
    }
  }
  return '';
};

const validateQcDecision = (decision, payload = {}, test) => {
  const normalizedDecision = normalizeQcStatus(decision);
  if (!decisions.has(normalizedDecision)) return { decision: '', message: 'Select a supported quality-control decision.' };

  const checklistError = validateChecklist(payload.checklist);
  if (checklistError) return { decision: normalizedDecision, message: checklistError };

  if (normalizedDecision === 'approved' && !isTestEligibleForQualityControl(test)) {
    return { decision: normalizedDecision, message: 'Approval requires a completed test with a passing result.' };
  }
  if (normalizedDecision === 'rejected') {
    for (const [field, message] of [
      ['rejectionReason', 'Provide a rejection reason.'],
      ['failedRequirement', 'Identify the failed requirement.'],
      ['correctiveAction', 'Describe the corrective action.'],
    ]) {
      if (!String(payload[field] || '').trim()) return { decision: normalizedDecision, message };
    }
  }
  if (normalizedDecision === 'conditional-approval') {
    for (const [field, message] of [
      ['condition', 'Describe the approval condition.'],
      ['restriction', 'Describe the operating restriction.'],
      ['correctiveAction', 'Describe the required corrective action.'],
      ['responsiblePerson', 'Assign a person responsible for the condition.'],
      ['conditionDeadline', 'Set a deadline for the condition.'],
    ]) {
      if (!String(payload[field] || '').trim()) return { decision: normalizedDecision, message };
    }
  }

  return { decision: normalizedDecision, message: '' };
};

module.exports = {
  activeStatuses,
  isTestEligibleForQualityControl,
  normalizeQcStatus,
  resolveQcStatusForDecision,
  validateChecklist,
  validateQcDecision,
};