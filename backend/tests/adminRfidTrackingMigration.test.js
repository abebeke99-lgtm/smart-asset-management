const test = require('node:test');
const assert = require('node:assert/strict');
const { sequelize } = require('../src/config/database');
const { ensureQrCodeColumn } = require('../src/scripts/migrations/adminRfidTracking');

test('QR schema repair adds and constrains only the missing asset QR column', { concurrency: false }, async () => {
  const queryInterface = sequelize.getQueryInterface();
  const originals = {
    describeTable: queryInterface.describeTable,
    addColumn: queryInterface.addColumn,
    changeColumn: queryInterface.changeColumn,
    showIndex: queryInterface.showIndex,
    addConstraint: queryInterface.addConstraint,
    query: sequelize.query,
  };
  const columns = { digital_id: { allowNull: true }, rfid_tag: { allowNull: true } };
  const schemaChanges = [];
  const sql = [];
  const indexes = [];
  queryInterface.describeTable = async () => ({ ...columns });
  queryInterface.addColumn = async (table, name, definition) => {
    schemaChanges.push(['addColumn', table, name, definition.allowNull]);
    columns[name] = { allowNull: definition.allowNull };
  };
  queryInterface.changeColumn = async (table, name, definition) => {
    schemaChanges.push(['changeColumn', table, name, definition.allowNull]);
    columns[name] = { allowNull: definition.allowNull };
  };
  queryInterface.showIndex = async () => indexes;
  queryInterface.addConstraint = async (table, constraint) => {
    schemaChanges.push(['addConstraint', table, ...constraint.fields]);
    indexes.push({ unique: true, fields: constraint.fields });
  };
  sequelize.query = async (statement) => {
    sql.push(statement);
    return [[], {}];
  };

  try {
    assert.equal(await ensureQrCodeColumn(), true);
    assert.deepEqual(schemaChanges, [
      ['addColumn', 'assets', 'qr_code', true],
      ['changeColumn', 'assets', 'qr_code', false],
      ['addConstraint', 'assets', 'qr_code'],
    ]);
    assert.match(sql[0], /SET qr_code = digital_id/);
    assert.match(sql[1], /SET qr_code = CONCAT\('QR-'/);
    assert.ok(!sql.some((statement) => /UPDATE\s+(?:assets SET rfid_tag|rfid_logs)/i.test(statement)));
    assert.equal(columns.qr_code.allowNull, false);
    assert.equal(indexes.some((index) => index.unique && index.fields.includes('qr_code')), true);
  } finally {
    queryInterface.describeTable = originals.describeTable;
    queryInterface.addColumn = originals.addColumn;
    queryInterface.changeColumn = originals.changeColumn;
    queryInterface.showIndex = originals.showIndex;
    queryInterface.addConstraint = originals.addConstraint;
    sequelize.query = originals.query;
  }
});

test('QR schema repair leaves an already-correct asset column unchanged', { concurrency: false }, async () => {
  const queryInterface = sequelize.getQueryInterface();
  const originalDescribeTable = queryInterface.describeTable;
  const originalShowIndex = queryInterface.showIndex;
  const originalQuery = sequelize.query;
  queryInterface.describeTable = async () => ({ qr_code: { allowNull: false }, digital_id: { allowNull: true } });
  queryInterface.showIndex = async () => [{ unique: true, fields: ['qr_code'] }];
  sequelize.query = async () => {
    throw new Error('A current QR schema should not run data backfills.');
  };

  try {
    assert.equal(await ensureQrCodeColumn(), false);
  } finally {
    queryInterface.describeTable = originalDescribeTable;
    queryInterface.showIndex = originalShowIndex;
    sequelize.query = originalQuery;
  }
});
