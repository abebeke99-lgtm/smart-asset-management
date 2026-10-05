const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { sequelize, Asset } = require('../models');
const { getSummaryCounts } = require('../controllers/adminRfidController');

const enabled = process.env.RFID_INTEGRATION_DB === '1';

test('assets reject duplicate QR and RFID identifiers', { skip: !enabled }, async () => {
  assert.notEqual(process.env.NODE_ENV, 'production', 'database write tests are disabled in production');
  await sequelize.authenticate();
  const transaction = await sequelize.transaction();
  const marker = randomUUID();
  try {
    await Asset.create({ name: 'QR uniqueness fixture', assetCode: `QR-ONE-${marker}`, qrCode: marker, digitalId: marker }, { transaction });
    await assert.rejects(
      Asset.create({ name: 'Duplicate QR fixture', assetCode: `QR-TWO-${marker}`, qrCode: marker, digitalId: `${marker}-OTHER` }, { transaction }),
      (error) => error.name === 'SequelizeUniqueConstraintError',
    );
    await Asset.create({ name: 'RFID uniqueness fixture', assetCode: `RFID-ONE-${marker}`, digitalId: `${marker}-RFID-ONE`, rfidTag: marker }, { transaction });
    await assert.rejects(
      Asset.create({ name: 'Duplicate RFID fixture', assetCode: `RFID-TWO-${marker}`, digitalId: `${marker}-RFID-TWO`, rfidTag: marker }, { transaction }),
      (error) => error.name === 'SequelizeUniqueConstraintError',
    );
  } finally {
    if (!transaction.finished) await transaction.rollback();
    else if (transaction.finished !== 'rollback') await transaction.rollback();
  }
});

test('tracking summary excludes null, empty, and whitespace-only RFID values', { skip: !enabled }, async () => {
  assert.notEqual(process.env.NODE_ENV, 'production', 'database write tests are disabled in production');
  await sequelize.authenticate();
  const baseline = await getSummaryCounts();
  const testTags = [
    { value: 'RFID-SUMMARY-VALID', assigned: 1 },
    { value: null, assigned: 0 },
    { value: '', assigned: 0 },
    { value: '   ', assigned: 0 },
    { value: '\t\r\n', assigned: 0 },
  ];

  for (const { value, assigned } of testTags) {
    const transaction = await sequelize.transaction();
    const marker = randomUUID();
    try {
      const asset = await Asset.create({
        name: 'Tracking summary fixture',
        assetCode: `RFID-SUMMARY-${marker}`,
        qrCode: `QR-SUMMARY-${marker}`,
        digitalId: `QR-SUMMARY-${marker}`,
        rfidTag: null,
      }, { transaction });
      if (value !== null) {
        await sequelize.query('UPDATE assets SET rfid_tag = :value WHERE id = :id', {
          replacements: { value, id: asset.id },
          transaction,
        });
      }

      const summary = await getSummaryCounts(transaction);
      assert.equal(summary.totalAssets, baseline.totalAssets + 1);
      assert.equal(summary.qrAssigned, baseline.qrAssigned + 1);
      assert.equal(summary.rfidAssigned, baseline.rfidAssigned + assigned);
      assert.equal(summary.fullyTracked, baseline.fullyTracked + assigned);
      assert.equal(summary.notFullyTracked, baseline.notFullyTracked + 1 - assigned);
    } finally {
      if (!transaction.finished) await transaction.rollback();
    }
  }
});

test('tracking summary excludes empty and whitespace-only QR values', { skip: !enabled }, async () => {
  assert.notEqual(process.env.NODE_ENV, 'production', 'database write tests are disabled in production');
  await sequelize.authenticate();
  const qrColumn = await sequelize.getQueryInterface().describeTable('assets');
  assert.equal(qrColumn.qr_code.allowNull, false, 'registered assets must have a QR value');
  const baseline = await getSummaryCounts();

  for (const value of ['', '   ', '\t', '\r\n']) {
    const transaction = await sequelize.transaction();
    const marker = randomUUID();
    try {
      const asset = await Asset.create({
        name: 'QR summary fixture',
        assetCode: `QR-SUMMARY-${marker}`,
        qrCode: `QR-SUMMARY-${marker}`,
        digitalId: `QR-SUMMARY-${marker}`,
        rfidTag: `RFID-SUMMARY-${marker}`,
      }, { transaction });
      await sequelize.query('UPDATE assets SET qr_code = :value WHERE id = :id', {
        replacements: { value, id: asset.id },
        transaction,
      });

      const summary = await getSummaryCounts(transaction);
      assert.equal(summary.totalAssets, baseline.totalAssets + 1);
      assert.equal(summary.rfidAssigned, baseline.rfidAssigned + 1);
      assert.equal(summary.qrAssigned, baseline.qrAssigned);
      assert.equal(summary.fullyTracked, baseline.fullyTracked);
      assert.equal(summary.notFullyTracked, baseline.notFullyTracked + 1);
    } finally {
      if (!transaction.finished) await transaction.rollback();
    }
  }
});