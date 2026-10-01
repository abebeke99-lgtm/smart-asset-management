const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { sequelize, Asset } = require('../models');

const enabled = process.env.RFID_INTEGRATION_DB === '1';

test('assets reject a duplicate QR identifier', { skip: !enabled }, async () => {
  assert.notEqual(process.env.NODE_ENV, 'production', 'database write tests are disabled in production');
  await sequelize.authenticate();
  const transaction = await sequelize.transaction();
  const marker = randomUUID();
  try {
    await Asset.create({ name: 'QR uniqueness fixture', assetCode: `QR-ONE-${marker}`, digitalId: marker }, { transaction });
    await assert.rejects(
      Asset.create({ name: 'Duplicate QR fixture', assetCode: `QR-TWO-${marker}`, digitalId: marker }, { transaction }),
      (error) => error.name === 'SequelizeUniqueConstraintError',
    );
  } finally {
    if (!transaction.finished) await transaction.rollback();
    else if (transaction.finished !== 'rollback') await transaction.rollback();
  }
});