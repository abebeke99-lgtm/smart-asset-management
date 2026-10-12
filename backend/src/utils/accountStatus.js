const INACTIVE_ACCOUNT_STATUSES = new Set(['inactive', 'disabled', 'suspended', 'blocked']);

const isAccountActive = (active, status) => (
  active === true
  || active === 1
  || active === '1'
  || (typeof active === 'string' && active.trim().toLowerCase() === 'true')
) && !INACTIVE_ACCOUNT_STATUSES.has(String(status || '').trim().toLowerCase());

module.exports = { isAccountActive };
