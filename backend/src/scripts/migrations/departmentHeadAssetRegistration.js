require('dotenv').config();

const { DataTypes } = require('sequelize');
const {
  sequelize, Asset, AssetHistory, AssetRegistrationRequest,
} = require('../../models');

const normalizeColumn = (value) => String(value || '').replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
const hasUniqueIndex = (indexes, column) => indexes.some((index) => index.unique
  && index.fields.some((field) => [
    field.attribute,
    field.name,
    field,
  ].some((candidate) => candidate === column || normalizeColumn(candidate) === column)));

const assertUniqueSerials = async (table) => {
  const [duplicates] = await sequelize.query(
    `SELECT UPPER(TRIM(serial_number)) AS serial_number, COUNT(*) AS count
     FROM \`${table}\`
     WHERE serial_number IS NOT NULL AND TRIM(serial_number) <> ''
     GROUP BY UPPER(TRIM(serial_number))
     HAVING COUNT(*) > 1`,
  );
  if (duplicates.length) {
    throw new Error(`Resolve duplicate serial numbers in ${table} before applying this migration: ${JSON.stringify(duplicates)}`);
  }
};

const ensureUniqueSerialIndex = async (table, indexName) => {
  const queryInterface = sequelize.getQueryInterface();
  const indexes = await queryInterface.showIndex(table);
  await assertUniqueSerials(table);
  await sequelize.query(`UPDATE \`${table}\` SET serial_number = NULL WHERE serial_number IS NOT NULL AND TRIM(serial_number) = ''`);
  await sequelize.query(`UPDATE \`${table}\` SET serial_number = TRIM(serial_number) WHERE serial_number IS NOT NULL`);
  await queryInterface.changeColumn(table, 'serial_number', {
    type: DataTypes.STRING(255),
    allowNull: true,
    defaultValue: null,
  });
  if (!hasUniqueIndex(indexes, 'serial_number')) {
    await queryInterface.addConstraint(table, {
      fields: ['serial_number'],
      type: 'unique',
      name: indexName,
    });
  }
};

const ensurePositiveQuantityCheck = async () => {
  const [rows] = await sequelize.query(
    'SELECT COUNT(*) AS count FROM asset_requests WHERE quantity < 1',
  );
  if (Number(rows[0]?.count || 0) > 0) {
    throw new Error('Resolve asset registration requests with non-positive quantity before applying this migration.');
  }
  try {
    await sequelize.query(
      'ALTER TABLE asset_requests ADD CONSTRAINT chk_asset_registration_quantity CHECK (quantity > 0)',
    );
  } catch (error) {
    if (!/duplicate|already exists/i.test(error.message)) throw error;
  }
};

const up = async () => {
  const queryInterface = sequelize.getQueryInterface();
  const assetHistoryExists = await queryInterface.tableExists('asset_history');
  if (!assetHistoryExists) await AssetHistory.sync({ force: false });
  const registrationExists = await queryInterface.tableExists('asset_requests');
  if (!registrationExists) await AssetRegistrationRequest.sync({ force: false });

  await ensureUniqueSerialIndex('assets', 'assets_serial_number_unique');
  await ensureUniqueSerialIndex('asset_requests', 'asset_requests_serial_number_unique');
  await ensurePositiveQuantityCheck();
  return { assetHistory: 'ready', registrationRequests: 'ready', serialNumberUnique: true, positiveQuantity: true };
};

if (require.main === module) {
  (async () => {
    try {
      await sequelize.authenticate();
      const report = await up();
      console.log(JSON.stringify(report, null, 2));
    } catch (error) {
      console.error(`Department Head asset registration migration failed: ${error.message}`);
      process.exitCode = 1;
    } finally {
      await sequelize.close();
    }
  })();
}

module.exports = { assertUniqueSerials, ensureUniqueSerialIndex, ensurePositiveQuantityCheck, up };
