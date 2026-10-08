const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const ensureRoomSchema = async () => {
  const queryInterface = sequelize.getQueryInterface();
  const columns = await queryInterface.describeTable('rooms');

  if (!columns.responsible_staff_id) {
    await queryInterface.addColumn('rooms', 'responsible_staff_id', {
      type: DataTypes.INTEGER,
      allowNull: true,
    });
    columns.responsible_staff_id = { allowNull: true };
  }

  if (!columns.condition) {
    await queryInterface.addColumn('rooms', 'condition', {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: 'Good',
    });
  }

  const foreignKeys = await queryInterface.getForeignKeyReferencesForTable('rooms');
  const staffForeignKey = foreignKeys.find((foreignKey) => foreignKey.columnName === 'responsible_staff_id');
  if (staffForeignKey) {
    if (staffForeignKey.referencedTableName !== 'users' || staffForeignKey.referencedColumnName !== 'id') {
      throw new Error('rooms.responsible_staff_id references an unexpected table or column.');
    }
    return true;
  }

  const [orphanRows] = await sequelize.query(
    'SELECT COUNT(*) AS count FROM rooms AS room_row LEFT JOIN users AS user_row ON room_row.responsible_staff_id = user_row.id WHERE room_row.responsible_staff_id IS NOT NULL AND user_row.id IS NULL',
  );
  if (Number(orphanRows[0]?.count || 0) > 0) {
    throw new Error('Resolve rooms with invalid responsible_staff_id values before adding the users foreign key.');
  }

  await queryInterface.addConstraint('rooms', {
    fields: ['responsible_staff_id'],
    type: 'foreign key',
    name: 'fk_dh_rooms_responsible_staff_id',
    references: { table: 'users', field: 'id' },
    onDelete: 'SET NULL',
    onUpdate: 'RESTRICT',
  });
  return true;
};

module.exports = { ensureRoomSchema };
