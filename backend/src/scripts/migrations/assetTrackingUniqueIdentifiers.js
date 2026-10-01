const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const hasUniqueIndex = (indexes, field) => indexes.some((index) => index.unique
  && index.fields.some((item) => (item.attribute || item.name || item) === field));

const assertNoDuplicates = async (field) => {
  const [duplicates] = await sequelize.query(
    `SELECT \`${field}\` AS value, COUNT(*) AS total FROM assets WHERE \`${field}\` IS NOT NULL AND \`${field}\` <> ? GROUP BY \`${field}\` HAVING COUNT(*) > 1`,
    { replacements: [''] },
  );
  if (duplicates.length) {
    throw new Error(`Duplicate ${field} values must be resolved before migration: ${JSON.stringify(duplicates)}`);
  }
};

const up = async () => {
  const queryInterface = sequelize.getQueryInterface();
  const columns = await queryInterface.describeTable('assets');
  const qrField = columns.qr_code ? 'qr_code' : 'digital_id';
  if (!columns[qrField]) throw new Error('Assets table has neither qr_code nor digital_id.');
  if (!columns.rfid_tag) throw new Error('Assets table is missing rfid_tag.');

  await assertNoDuplicates(qrField);
  await assertNoDuplicates('rfid_tag');

  let indexes = await queryInterface.showIndex('assets');
  if (!hasUniqueIndex(indexes, qrField)) {
    await queryInterface.addConstraint('assets', {
      fields: [qrField],
      type: 'unique',
      name: qrField === 'qr_code' ? 'unique_qr' : 'assets_digital_id_unique',
    });
  }

  await sequelize.query('UPDATE assets SET rfid_tag = NULL WHERE rfid_tag = ?', { replacements: [''] });
  await queryInterface.changeColumn('assets', 'rfid_tag', {
    type: DataTypes.STRING(255),
    allowNull: true,
    defaultValue: null,
  });
  indexes = await queryInterface.showIndex('assets');
  if (!hasUniqueIndex(indexes, 'rfid_tag')) {
    await queryInterface.addConstraint('assets', { fields: ['rfid_tag'], type: 'unique', name: 'unique_rfid_tag' });
  }
};

if (require.main === module) {
  up().then(() => console.log('Asset tracking unique identifiers migration completed.'))
    .catch((error) => {
      console.error(`Asset tracking migration failed: ${error.message}`);
      process.exitCode = 1;
    })
    .finally(() => sequelize.close());
}

module.exports = { up };