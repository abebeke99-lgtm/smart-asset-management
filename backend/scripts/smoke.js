require('dotenv').config({ path: require('node:path').resolve(__dirname, '../.env') });
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const request = require('supertest');
const { Asset, User, sequelize } = require('../src/models');
const app = require('../src/app');
const { getJwtSecret } = require('../src/config/jwt');

const apiOrigin = process.env.SMOKE_API_URL
  ? String(process.env.SMOKE_API_URL).replace(/\/+$/, '')
  : null;
const results = [];
const roles = {};

const makeToken = (user) => jwt.sign(
  { id: user.id, sessionVersion: Number(user.sessionVersion || 0) },
  getJwtSecret(),
  { expiresIn: '5m' },
);

const runProbe = async ({ role, label, path, expectedStatuses = [200], verify }) => {
  const headers = { Accept: 'application/json' };
  if (role) headers.Authorization = `Bearer ${roles[role]}`;
  try {
    const response = apiOrigin
      ? await fetch(`${apiOrigin}${path}`, { headers, redirect: 'manual' })
      : await request(app).get(path).set(headers);
    const body = apiOrigin ? await response.json().catch(() => null) : response.body;
    const validStatus = expectedStatuses.includes(response.status);
    const verification = validStatus && verify ? verify(body) : true;
    const cacheControl = apiOrigin
      ? response.headers.get('cache-control')
      : response.headers['cache-control'];
    const etag = apiOrigin ? response.headers.get('etag') : response.headers.etag;
    const cachePolicyValid = !path.startsWith('/api')
      || (String(cacheControl || '').includes('no-store') && !etag);
    const passed = validStatus && verification && cachePolicyValid;
    results.push({
      label,
      status: response.status,
      result: passed ? 'PASS' : 'FAIL',
      message: passed
        ? (body?.message || '')
        : (!validStatus
          ? (body?.message || `Unexpected status ${response.status}`)
          : !cachePolicyValid
            ? 'API response must include Cache-Control: no-store and no ETag.'
            : body?.message || 'Response verification failed.'),
    });
  } catch (error) {
    results.push({ label, status: 'NETWORK_ERROR', result: 'FAIL', message: error.message });
  }
};

const findActiveUser = async (role) => User.findOne({
  where: { role, active: true },
  attributes: ['id', 'role', 'active', 'sessionVersion'],
  order: [['id', 'ASC']],
});

const verifyListContains = (assetId) => (body) => {
  const items = body?.data?.items;
  return Array.isArray(items) && items.some((item) => Number(item.id) === Number(assetId));
};

const findSearchValue = async (attribute) => {
  const asset = await Asset.findOne({
    where: { [attribute]: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] } },
    attributes: ['id', attribute],
    order: [['id', 'ASC']],
  });
  return asset ? { id: asset.id, value: String(asset.get(attribute)).trim() } : null;
};

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Smoke tests that create development JWTs are disabled in production.');
  }
  getJwtSecret();
  await sequelize.authenticate();

  for (const role of ['admin', 'store_manager']) {
    const user = await findActiveUser(role);
    if (!user) throw new Error(`Smoke test requires an active ${role} account in the configured development database.`);
    roles[role] = makeToken(user);
  }

  await runProbe({ label: 'GET /api/health', path: '/api/health' });
  for (const [label, path] of [
    ['GET /api/approvals', '/api/approvals'],
    ['GET /api/assets', '/api/assets'],
    ['GET /api/assignments', '/api/assignments'],
    ['GET /api/service-requests', '/api/service-requests'],
    ['GET /api/service-requests/routing-options', '/api/service-requests/routing-options'],
    ['GET /api/admin/rfid/summary', '/api/admin/rfid/summary'],
    ['GET /api/admin/rfid/assets', '/api/admin/rfid/assets?page=1&limit=10'],
  ]) {
    await runProbe({ role: 'admin', label, path });
  }
  await runProbe({
    role: 'admin',
    label: 'GET /api/service-requests/eligible-assignees',
    path: '/api/service-requests/eligible-assignees?category=Maintenance&role=maintenance',
    expectedStatuses: [200, 403],
  });
  for (const [label, path] of [
    ['GET /api/store/dashboard', '/api/store/dashboard'],
    ['GET /api/store/inventory', '/api/store/inventory?page=1&limit=10'],
    ['GET /api/store/history', '/api/store/history?page=1&limit=10'],
    ['GET /api/store/low-stock', '/api/store/low-stock?page=1&pageSize=10'],
    ['GET /api/store/stock-adjustments', '/api/store/stock-adjustments?page=1&pageSize=10'],
    ['GET /api/store/receive', '/api/store/receive?page=1&pageSize=10'],
    ['GET /api/store/returns', '/api/store/returns?page=1&pageSize=10'],
    ['GET /api/assignments (Store Manager scope)', '/api/assignments?page=1&limit=10'],
  ]) {
    await runProbe({ role: 'store_manager', label, path });
  }

  await runProbe({
    role: 'admin',
    label: 'GET /api/admin/rfid/lookup/asset-id (not-found response)',
    path: '/api/admin/rfid/lookup/asset-id/__smoke_not_found__',
    expectedStatuses: [404],
    verify: (body) => body?.success === false && /not found/i.test(body?.message || ''),
  });
  await runProbe({
    role: 'admin',
    label: 'GET /api/admin/rfid/lookup/code (not-found response)',
    path: '/api/admin/rfid/lookup/code/__smoke_not_found__',
    expectedStatuses: [404],
    verify: (body) => body?.success === false && /not found/i.test(body?.message || ''),
  });

  const searchableFields = [
    ['asset ID', 'assetCode'],
    ['name', 'name'],
    ['serial number', 'serialNumber'],
    ['RFID', 'rfidTag'],
    ['QR', 'qrCode'],
    ['department', 'department'],
  ];
  for (const [label, attribute] of searchableFields) {
    const match = await findSearchValue(attribute);
    if (!match) {
      results.push({ label: `RFID list search by ${label}`, status: 'SKIPPED', result: 'SKIP', message: 'No non-empty development fixture value exists.' });
      continue;
    }
    const search = encodeURIComponent(match.value);
    await runProbe({
      role: 'admin',
      label: `RFID list search by ${label}`,
      path: `/api/admin/rfid/assets?search=${search}&page=1&limit=100`,
      verify: verifyListContains(match.id),
    });
  }

  const trackedAsset = await Asset.findOne({ attributes: ['id', 'assetCode', 'status', 'rfidTag', 'qrCode', 'digitalId'], order: [['id', 'ASC']] });
  if (trackedAsset) {
    const assetId = trackedAsset.id;
    await runProbe({
      role: 'admin',
      label: 'GET /api/admin/rfid/assets/:id/tracking',
      path: `/api/admin/rfid/assets/${encodeURIComponent(assetId)}/tracking`,
      verify: (body) => Number(body?.data?.asset?.id) === Number(assetId),
    });
    await runProbe({
      role: 'admin',
      label: 'GET /api/admin/rfid/lookup/asset-id/:assetId',
      path: `/api/admin/rfid/lookup/asset-id/${encodeURIComponent(trackedAsset.assetCode || assetId)}`,
      verify: (body) => Number(body?.data?.asset?.id) === Number(assetId),
    });
    const trackingCode = [trackedAsset.qrCode, trackedAsset.digitalId, trackedAsset.rfidTag]
      .find((value) => typeof value === 'string' && value.trim());
    if (trackingCode) {
      await runProbe({
        role: 'admin',
        label: 'GET /api/admin/rfid/lookup/code (existing QR/RFID)',
        path: `/api/admin/rfid/lookup/code/${encodeURIComponent(trackingCode)}`,
        verify: (body) => Number(body?.data?.asset?.id) === Number(assetId),
      });
    } else {
      results.push({ label: 'GET /api/admin/rfid/lookup/code (existing QR/RFID)', status: 'SKIPPED', result: 'SKIP', message: 'No non-empty tracking code exists on the selected asset.' });
    }
    const status = String(trackedAsset.status || '').trim();
    if (status) {
      await runProbe({
        role: 'admin',
        label: 'RFID status filter',
        path: `/api/admin/rfid/assets?status=${encodeURIComponent(status)}&page=1&limit=100`,
        verify: verifyListContains(assetId),
      });
    }
  } else {
    results.push({ label: 'RFID asset detail and lookup checks', status: 'SKIPPED', result: 'SKIP', message: 'No asset records exist in the configured database.' });
  }

  console.log('Endpoint smoke results:');
  for (const result of results) {
    console.log(`${result.result.padEnd(4)} ${String(result.status).padEnd(13)} ${result.label}${result.message ? ` — ${result.message}` : ''}`);
  }
  const failures = results.filter((result) => result.result === 'FAIL').length;
  console.log(`Summary: ${results.length} checks, ${results.length - failures} passed or skipped, ${failures} failed.`);
  if (failures) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(`Smoke test could not run: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
