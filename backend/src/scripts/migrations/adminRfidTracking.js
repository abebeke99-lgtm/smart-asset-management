const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const hasUniqueIndex = (indexes, field) => indexes.some((index) => index.unique
  && index.fields.some((item) => (item.attribute || item.name || item) === field));

const assertNoDuplicates = async (field) => {
  const [rows] = await sequelize.query(
    `SELECT UPPER(TRIM(\`${field}\`)) AS value, COUNT(*) AS total FROM assets WHERE \`${field}\` IS NOT NULL AND TRIM(\`${field}\`) <> '' GROUP BY UPPER(TRIM(\`${field}\`)) HAVING COUNT(*) > 1`,
  );
  if (rows.length) {
    throw new Error(`Duplicate ${field} values must be resolved before migration: ${JSON.stringify(rows)}`);
  }
};

const up = async () => {
  const queryInterface = sequelize.getQueryInterface();
  let columns = await queryInterface.describeTable('assets');
  if (!columns.qr_code) {
    await queryInterface.addColumn('assets', 'qr_code', {
      type: DataTypes.STRING(100),
      allowNull: true,
      defaultValue: null,
    });
  }
  columns = await queryInterface.describeTable('assets');
  if (!columns.digital_id) throw new Error('Assets table is missing digital_id and cannot backfill qr_code.');
  if (!columns.rfid_tag) {
    await queryInterface.addColumn('assets', 'rfid_tag', {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: null,
    });
  }
  await sequelize.query('UPDATE assets SET qr_code = digital_id WHERE (qr_code IS NULL OR TRIM(qr_code) = \'\') AND digital_id IS NOT NULL AND TRIM(digital_id) <> \'\'');
  await sequelize.query('UPDATE assets SET qr_code = CONCAT(\'QR-\', UPPER(REPLACE(UUID(), \'-\', \'\'))) WHERE qr_code IS NULL OR TRIM(qr_code) = \'\'');
  await sequelize.query('UPDATE assets SET qr_code = NULL WHERE TRIM(qr_code) = \'\'');
  await sequelize.query('UPDATE assets SET rfid_tag = NULL WHERE TRIM(rfid_tag) = \'\'');
  await assertNoDuplicates('qr_code');
  await assertNoDuplicates('rfid_tag');
  await queryInterface.changeColumn('assets', 'qr_code', {
    type: DataTypes.STRING(100),
    allowNull: false,
  });
  await queryInterface.changeColumn('assets', 'rfid_tag', {
    type: DataTypes.STRING(255),
    allowNull: true,
    defaultValue: null,
  });
  const indexes = await queryInterface.showIndex('assets');
  if (!hasUniqueIndex(indexes, 'qr_code')) {
    await queryInterface.addConstraint('assets', {
      fields: ['qr_code'],
      type: 'unique',
      name: 'assets_qr_code_unique',
    });
  }
  if (!hasUniqueIndex(indexes, 'rfid_tag')) {
    await queryInterface.addConstraint('assets', {
      fields: ['rfid_tag'],
      type: 'unique',
      name: 'assets_rfid_tag_unique',
    });
  }

  const logColumns = await queryInterface.describeTable('rfid_logs');
  if (!logColumns.scanned_by) {
    await queryInterface.addColumn('rfid_logs', 'scanned_by', {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
  }
};

if (require.main === module) {
  up().then(() => console.log('Admin RFID tracking migration completed.'))
    .catch((error) => {
      console.error(`Admin RFID tracking migration failed: ${error.message}`);
      process.exitCode = 1;
    })
    .finally(() => sequelize.close());
}

module.exports = { up };
