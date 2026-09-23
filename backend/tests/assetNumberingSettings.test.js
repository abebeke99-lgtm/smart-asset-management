const test = require('node:test');
const assert = require('node:assert/strict');
const { buildAssetCodeFromConfig, readAssetNumberSettings } = require('../src/controllers/assetExtendedController');
const { sequelize, Asset, Config } = require('../src/models');

const resetTestConfig = async () => {
  await Config.destroy({ where: { key: 'settings:assets' }, force: true });
  await Asset.destroy({ where: {}, force: true });
};

test('asset numbering uses the backend settings configuration instead of a hardcoded format', async () => {
  await resetTestConfig();

  await Config.create({ key: 'settings:assets', value: JSON.stringify({ enabled: true, prefix: 'MAU', categoryCode: 'IT', year: 2026, sequenceLength: 6, startNumber: 1, separator: '-', format: '{PREFIX}-{CATEGORY}-{YEAR}-{SEQUENCE}' }) });

  const settings = await readAssetNumberSettings();
  assert.equal(settings.prefix, 'MAU');
  assert.equal(settings.categoryCode, 'IT');
  assert.equal(settings.format, '{PREFIX}-{CATEGORY}-{YEAR}-{SEQUENCE}');

  const first = await buildAssetCodeFromConfig({ category: 'IT' });
  assert.equal(first, 'MAU-IT-2026-000001');

  await Asset.create({ name: 'Laptop 01', category: 'IT', assetCode: first, digitalId: 'DIG-TEST-1', status: 'available', condition: 'Good' });

  const second = await buildAssetCodeFromConfig({ category: 'IT' });
  assert.equal(second, 'MAU-IT-2026-000002');

  await resetTestConfig();
  await sequelize.close();
});
