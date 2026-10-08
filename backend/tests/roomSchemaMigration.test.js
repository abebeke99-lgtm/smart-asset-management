const test = require('node:test');
const assert = require('node:assert/strict');
const { DataTypes } = require('sequelize');
const { sequelize } = require('../src/config/database');
const { ensureRoomSchema } = require('../src/scripts/migrations/roomSchema');

test('room schema repair adds only missing model columns and the optional staff foreign key', { concurrency: false }, async () => {
  const queryInterface = sequelize.getQueryInterface();
  const originals = {
    describeTable: queryInterface.describeTable,
    addColumn: queryInterface.addColumn,
    getForeignKeyReferencesForTable: queryInterface.getForeignKeyReferencesForTable,
    addConstraint: queryInterface.addConstraint,
    query: sequelize.query,
  };
  const columns = { id: {}, room_name: {} };
  const foreignKeys = [];
  const addedColumns = [];
  const addedConstraints = [];
  const statements = [];

  queryInterface.describeTable = async () => columns;
  queryInterface.addColumn = async (table, name, definition) => {
    addedColumns.push({ table, name, definition });
    columns[name] = { allowNull: definition.allowNull };
  };
  queryInterface.getForeignKeyReferencesForTable = async () => foreignKeys;
  queryInterface.addConstraint = async (table, constraint) => {
    addedConstraints.push({ table, constraint });
    foreignKeys.push({
      columnName: constraint.fields[0],
      referencedTableName: constraint.references.table,
      referencedColumnName: constraint.references.field,
    });
  };
  sequelize.query = async (statement) => {
    statements.push(statement);
    return [[{ count: 0 }], {}];
  };

  try {
    assert.equal(await ensureRoomSchema(), true);
    assert.equal(addedColumns.length, 2);
    assert.equal(addedColumns[0].table, 'rooms');
    assert.equal(addedColumns[0].name, 'responsible_staff_id');
    assert.equal(addedColumns[0].definition.type.key, DataTypes.INTEGER.key);
    assert.equal(addedColumns[0].definition.allowNull, true);
    assert.equal(addedColumns[1].table, 'rooms');
    assert.equal(addedColumns[1].name, 'condition');
    assert.equal(addedColumns[1].definition.type.toString(), DataTypes.STRING(100).toString());
    assert.equal(addedColumns[1].definition.allowNull, false);
    assert.equal(addedColumns[1].definition.defaultValue, 'Good');
    assert.deepEqual(addedConstraints, [{
      table: 'rooms',
      constraint: {
        fields: ['responsible_staff_id'],
        type: 'foreign key',
        name: 'fk_dh_rooms_responsible_staff_id',
        references: { table: 'users', field: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'RESTRICT',
      },
    }]);
    assert.match(statements[0], /SELECT COUNT\(\*\).*rooms.*users/s);

    assert.equal(await ensureRoomSchema(), true);
    assert.equal(addedColumns.length, 2);
    assert.equal(addedConstraints.length, 1);
    assert.equal(statements.length, 1);
  } finally {
    queryInterface.describeTable = originals.describeTable;
    queryInterface.addColumn = originals.addColumn;
    queryInterface.getForeignKeyReferencesForTable = originals.getForeignKeyReferencesForTable;
    queryInterface.addConstraint = originals.addConstraint;
    sequelize.query = originals.query;
  }
});

test('room schema repair refuses to add the staff foreign key when room assignments are orphaned', { concurrency: false }, async () => {
  const queryInterface = sequelize.getQueryInterface();
  const originals = {
    describeTable: queryInterface.describeTable,
    addColumn: queryInterface.addColumn,
    getForeignKeyReferencesForTable: queryInterface.getForeignKeyReferencesForTable,
    addConstraint: queryInterface.addConstraint,
    query: sequelize.query,
  };
  const columns = { responsible_staff_id: { allowNull: true }, condition: { allowNull: false } };
  let constraintsAdded = 0;
  queryInterface.describeTable = async () => columns;
  queryInterface.addColumn = async () => {
    throw new Error('A complete room schema should not add columns.');
  };
  queryInterface.getForeignKeyReferencesForTable = async () => [];
  queryInterface.addConstraint = async () => { constraintsAdded += 1; };
  sequelize.query = async () => [[{ count: 1 }], {}];

  try {
    await assert.rejects(ensureRoomSchema(), /Resolve rooms with invalid responsible_staff_id/);
    assert.equal(constraintsAdded, 0);
  } finally {
    queryInterface.describeTable = originals.describeTable;
    queryInterface.addColumn = originals.addColumn;
    queryInterface.getForeignKeyReferencesForTable = originals.getForeignKeyReferencesForTable;
    queryInterface.addConstraint = originals.addConstraint;
    sequelize.query = originals.query;
  }
});
