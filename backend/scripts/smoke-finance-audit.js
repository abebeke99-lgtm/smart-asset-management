require('dotenv').config();

const jwt = require('jsonwebtoken');
const { sequelize } = require('../src/config/database');
const { AuditLog, User } = require('../src/models');
const { getJwtSecret } = require('../src/config/jwt');

const apiBaseUrl = process.env.FINANCE_AUDIT_SMOKE_API_URL || 'http://localhost:5000/api';
const nonFinanceRole = (process.env.FINANCE_AUDIT_SMOKE_NON_FINANCE_ROLE || 'department_head').trim().toLowerCase();
const roleTests = [
  { role: 'finance', username: process.env.FINANCE_AUDIT_SMOKE_FINANCE_USER },
  { role: 'admin', username: process.env.FINANCE_AUDIT_SMOKE_ADMIN_USER },
  { role: nonFinanceRole, username: process.env.FINANCE_AUDIT_SMOKE_NON_FINANCE_USER },
];
const results = [];

const isLocalHost = (hostname) => {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  return ['localhost', '127.0.0.1', '::1', '0:0:0:0:0:0:0:1'].includes(host);
};

const addResult = (check, passed, detail) => {
  results.push({ check, result: passed ? 'PASS' : 'FAIL', detail });
};

const printResults = () => {
  const widths = {
    check: Math.max('Check'.length, ...results.map(({ check }) => check.length)),
    result: 'Result'.length,
    detail: Math.max('Detail'.length, ...results.map(({ detail }) => detail.length)),
  };
  const row = ({ check, result, detail }) => (
    `${check.padEnd(widths.check)}  ${result.padEnd(widths.result)}  ${detail}`
  );

  console.log(row({ check: 'Check', result: 'Result', detail: 'Detail' }));
  console.log(`${'-'.repeat(widths.check)}  ${'-'.repeat(widths.result)}  ${'-'.repeat(widths.detail)}`);
  results.forEach((result) => console.log(row(result)));
  const failed = results.filter(({ result }) => result === 'FAIL').length;
  console.log(`\n${results.length - failed} passed, ${failed} failed.`);
};

const callAuditEndpoint = async (label, token, expectedStatus) => {
  try {
    const response = await fetch(`${apiBaseUrl.replace(/\/+$/, '')}/finance/audit`, {
      headers: token ? { Authorization: `Bearer ${token}`, Accept: 'application/json' } : { Accept: 'application/json' },
      signal: AbortSignal.timeout(15000),
    });
    await response.body?.cancel().catch(() => {});
    const passed = response.status === expectedStatus;
    addResult(
      label,
      passed,
      `expected HTTP ${expectedStatus}, got ${response.status}`
    );
  } catch (error) {
    addResult(label, false, `request failed: ${error.message}`);
  }
};

const findActiveUser = async ({ role, username }) => User.findOne({
  where: {
    role,
    active: true,
    status: 'active',
    ...(username ? { username } : {}),
  },
  attributes: ['id', 'username', 'role', 'sessionVersion', 'active', 'status'],
  order: [['id', 'ASC']],
});

const createLocalToken = (user) => jwt.sign(
  { id: user.id, sessionVersion: Number(user.sessionVersion || 0) },
  getJwtSecret(),
  { expiresIn: '5m' }
);

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to create smoke-test JWTs when NODE_ENV=production.');
  }
  if (['admin', 'finance'].includes(nonFinanceRole)) {
    throw new Error('FINANCE_AUDIT_SMOKE_NON_FINANCE_ROLE must be a role other than admin or finance.');
  }

  const apiUrl = new URL(apiBaseUrl);
  if (apiUrl.protocol !== 'http:' || !isLocalHost(apiUrl.hostname)) {
    throw new Error('The smoke API URL must use http://localhost, 127.0.0.1, or ::1.');
  }

  try {
    await sequelize.authenticate();
    addResult('MySQL connection', true, 'Connected using backend .env configuration');
  } catch (error) {
    addResult('MySQL connection', false, `${error.original?.code || error.code || 'ERROR'}: ${error.original?.sqlMessage || error.message}`);
    roleTests.forEach(({ role }) => addResult(`${role} API access`, false, 'not run because the database connection failed'));
    addResult('No-token API access', false, 'not run because the database connection failed');
    return;
  }

  let auditTableExists = false;
  try {
    auditTableExists = await sequelize.getQueryInterface().tableExists('audit_logs');
    addResult('audit_logs table', auditTableExists, auditTableExists ? 'Table exists' : 'Table is missing');
  } catch (error) {
    addResult('audit_logs table', false, `${error.original?.code || error.code || 'ERROR'}: ${error.original?.sqlMessage || error.message}`);
  }

  if (auditTableExists) {
    try {
      const columns = await sequelize.getQueryInterface().describeTable('audit_logs');
      const expectedColumns = Object.values(AuditLog.getAttributes())
        .map((attribute) => attribute.field || attribute.fieldName);
      const missingColumns = expectedColumns.filter((column) => !columns[column]);
      addResult(
        'audit_logs model columns',
        missingColumns.length === 0,
        missingColumns.length ? `Missing: ${missingColumns.join(', ')}` : `Found: ${expectedColumns.join(', ')}`
      );
    } catch (error) {
      addResult('audit_logs model columns', false, `${error.original?.code || error.code || 'ERROR'}: ${error.original?.sqlMessage || error.message}`);
    }
  } else {
    addResult('audit_logs model columns', false, 'not checked because audit_logs does not exist');
  }

  try {
    const columns = await sequelize.getQueryInterface().describeTable('users');
    const userAttributes = User.getAttributes();
    const expectedColumns = ['id', 'username', 'fullName', 'role']
      .map((attributeName) => userAttributes[attributeName].field || userAttributes[attributeName].fieldName);
    const missingColumns = expectedColumns.filter((column) => !columns[column]);
    addResult(
      'users join columns',
      missingColumns.length === 0,
      missingColumns.length ? `Missing: ${missingColumns.join(', ')}` : `Found: ${expectedColumns.join(', ')}`
    );
  } catch (error) {
    addResult('users join columns', false, `${error.original?.code || error.code || 'ERROR'}: ${error.original?.sqlMessage || error.message}`);
  }

  await callAuditEndpoint('No-token API access', null, 401);

  for (const roleTest of roleTests) {
    try {
      const user = await findActiveUser(roleTest);
      if (!user) {
        addResult(
          `${roleTest.role} API access`,
          false,
          `no active ${roleTest.role} test account found${roleTest.username ? ` for username "${roleTest.username}"` : ''}`
        );
        continue;
      }

      const expectedStatus = ['finance', 'admin'].includes(roleTest.role) ? 200 : 403;
      await callAuditEndpoint(
        `${roleTest.role} API access (${user.username})`,
        createLocalToken(user),
        expectedStatus
      );
    } catch (error) {
      addResult(`${roleTest.role} API access`, false, `could not prepare local test token: ${error.message}`);
    }
  }
}

main()
  .catch((error) => {
    addResult('Smoke test setup', false, error.message);
  })
  .finally(async () => {
    printResults();
    await sequelize.close().catch((error) => {
      console.error('Could not close the MySQL connection:', error.message);
      process.exitCode = 1;
    });
    if (results.some(({ result }) => result === 'FAIL')) process.exitCode = 1;
  });
