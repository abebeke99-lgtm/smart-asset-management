const test = require('node:test');
const assert = require('node:assert/strict');
const { buildAssetCodeFromConfig, readAssetNumberSettings } = require('../src/controllers/assetExtendedController');
const { Asset, Config } = require('../src/models');

test('asset numbering uses the backend settings configuration instead of a hardcoded format', async () => {
  const originalConfigFindByPk = Config.findByPk;
  const originalAssetFindOne = Asset.findOne;
  const settingsValue = JSON.stringify({ enabled: true, prefix: 'MAU', categoryCode: 'IT', year: 2026, sequenceLength: 6, startNumber: 1, separator: '-', format: '{PREFIX}-{CATEGORY}-{YEAR}-{SEQUENCE}' });
  let lastAssetCode = null;

  Config.findByPk = async (key) => key === 'settings:assets' ? { value: settingsValue } : null;
  Asset.findOne = async () => (lastAssetCode ? { assetCode: lastAssetCode } : null);

  try {
    const settings = await readAssetNumberSettings();
    assert.equal(settings.prefix, 'MAU');
    assert.equal(settings.categoryCode, 'IT');
    assert.equal(settings.format, '{PREFIX}-{CATEGORY}-{YEAR}-{SEQUENCE}');

    const first = await buildAssetCodeFromConfig({ category: 'IT' });
    assert.equal(first, 'MAU-IT-2026-000001');

    lastAssetCode = first;
    const second = await buildAssetCodeFromConfig({ category: 'IT' });
    assert.equal(second, 'MAU-IT-2026-000002');
  } finally {
    Config.findByPk = originalConfigFindByPk;
    Asset.findOne = originalAssetFindOne;
  }
});
