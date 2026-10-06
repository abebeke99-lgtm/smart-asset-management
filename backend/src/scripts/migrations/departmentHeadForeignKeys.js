require('dotenv').config();

const { sequelize } = require('../../models');

// Only relationships declared by the existing Department Head model graph.
// History-bearing records use RESTRICT; optional laboratory responsibility can be unset.
const RELATIONSHIPS = [
  ['users', 'department_id', 'departments', 'id', 'RESTRICT'],
  ['departments', 'head_id', 'users', 'id', 'RESTRICT'],
  ['departments', 'location_id', 'locations', 'id', 'RESTRICT'],
  ['assets', 'department_id', 'departments', 'id', 'RESTRICT'],
  ['assets', 'room_id', 'rooms', 'id', 'RESTRICT'],
  ['rooms', 'department_id', 'departments', 'id', 'RESTRICT'],
  ['rooms', 'responsible_staff_id', 'users', 'id', 'SET NULL'],
  ['assignments', 'asset_id', 'assets', 'id', 'RESTRICT'],
  ['assignments', 'assigned_to', 'users', 'id', 'RESTRICT'],
  ['assignments', 'assigned_by', 'users', 'id', 'RESTRICT'],
  ['assignments', 'department_id', 'departments', 'id', 'RESTRICT'],
  ['transfers', 'asset_id', 'assets', 'id', 'RESTRICT'],
  ['transfers', 'created_by', 'users', 'id', 'RESTRICT'],
  ['transfers', 'requested_by', 'users', 'id', 'RESTRICT'],
  ['transfers', 'approved_by', 'users', 'id', 'RESTRICT'],
  ['transfers', 'dispatched_by', 'users', 'id', 'RESTRICT'],
  ['transfers', 'received_by', 'users', 'id', 'RESTRICT'],
  ['department_asset_requests', 'department_id', 'departments', 'id', 'RESTRICT'],
  ['department_asset_requests', 'requested_by', 'users', 'id', 'RESTRICT'],
  ['department_asset_requests', 'asset_id', 'assets', 'id', 'RESTRICT'],
  ['department_asset_request_histories', 'request_id', 'department_asset_requests', 'id', 'RESTRICT'],
  ['department_asset_request_histories', 'changed_by', 'users', 'id', 'RESTRICT'],
  ['approvals', 'asset_id', 'assets', 'id', 'RESTRICT'],
  ['approvals', 'department_id', 'departments', 'id', 'RESTRICT'],
  ['approvals', 'requested_by', 'users', 'id', 'RESTRICT'],
  ['approvals', 'reviewed_by', 'users', 'id', 'RESTRICT'],
  ['service_requests', 'asset_id', 'assets', 'id', 'RESTRICT'],
  ['service_requests', 'department_id', 'departments', 'id', 'RESTRICT'],
  ['service_requests', 'reported_by', 'users', 'id', 'RESTRICT'],
  ['service_requests', 'assigned_to', 'users', 'id', 'RESTRICT'],
  ['service_requests', 'resolved_by', 'users', 'id', 'RESTRICT'],
  ['service_requests', 'closed_by', 'users', 'id', 'RESTRICT'],
  ['request_status_histories', 'request_id', 'service_requests', 'id', 'RESTRICT'],
  ['request_status_histories', 'changed_by', 'users', 'id', 'RESTRICT'],
  ['request_attachments', 'request_id', 'service_requests', 'id', 'RESTRICT'],
  ['request_attachments', 'uploaded_by', 'users', 'id', 'RESTRICT'],
  ['feedbacks', 'request_id', 'service_requests', 'id', 'RESTRICT'],
  ['feedbacks', 'submitted_by', 'users', 'id', 'RESTRICT'],
  ['verification_sessions', 'department_id', 'departments', 'id', 'RESTRICT'],
  ['verification_sessions', 'started_by', 'users', 'id', 'RESTRICT'],
  ['verification_items', 'session_id', 'verification_sessions', 'id', 'RESTRICT'],
  ['verification_items', 'asset_id', 'assets', 'id', 'RESTRICT'],
  ['department_asset_verifications', 'department_id', 'departments', 'id', 'RESTRICT'],
  ['department_asset_verifications', 'asset_id', 'assets', 'id', 'RESTRICT'],
  ['department_asset_verifications', 'verified_by', 'users', 'id', 'RESTRICT'],
];

const quoteIdentifier = (value) => `\`${String(value).replace(/`/g, '``')}\``;

const inspectRelationship = async ([child, childColumn, parent, parentColumn, onDelete]) => {
  const [columns] = await sequelize.query(
    'SELECT TABLE_NAME, COLUMN_NAME, IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND ((TABLE_NAME = :child AND COLUMN_NAME = :childColumn) OR (TABLE_NAME = :parent AND COLUMN_NAME = :parentColumn))',
    { replacements: { child, childColumn, parent, parentColumn } },
  );
  const childColumnInfo = columns.find((row) => row.TABLE_NAME === child && row.COLUMN_NAME === childColumn);
  const parentColumnInfo = columns.find((row) => row.TABLE_NAME === parent && row.COLUMN_NAME === parentColumn);
  if (!childColumnInfo || !parentColumnInfo) {
    return { child, childColumn, parent, parentColumn, onDelete, state: 'SCHEMA_COLUMN_MISSING' };
  }

  if (onDelete === 'SET NULL' && childColumnInfo.IS_NULLABLE !== 'YES') {
    return { child, childColumn, parent, parentColumn, onDelete, state: 'DELETE_RULE_INVALID_FOR_NOT_NULL_COLUMN' };
  }

  const [existing] = await sequelize.query(
    'SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :child AND COLUMN_NAME = :childColumn AND REFERENCED_TABLE_NAME = :parent AND REFERENCED_COLUMN_NAME = :parentColumn',
    { replacements: { child, childColumn, parent, parentColumn } },
  );
  const [orphanRows] = await sequelize.query(
    `SELECT COUNT(*) AS count FROM ${quoteIdentifier(child)} AS child_row LEFT JOIN ${quoteIdentifier(parent)} AS parent_row ON child_row.${quoteIdentifier(childColumn)} = parent_row.${quoteIdentifier(parentColumn)} WHERE child_row.${quoteIdentifier(childColumn)} IS NOT NULL AND parent_row.${quoteIdentifier(parentColumn)} IS NULL`,
  );
  const orphanCount = Number(orphanRows[0].count);
  return {
    child,
    childColumn,
    parent,
    parentColumn,
    onDelete,
    existingConstraint: existing[0]?.CONSTRAINT_NAME || null,
    orphanCount,
    state: existing.length ? 'PRESENT' : orphanCount ? 'BLOCKED_BY_ORPHANS' : 'READY',
  };
};

const applyDepartmentHeadForeignKeys = async ({ apply = false } = {}) => {
  const report = [];
  for (const relation of RELATIONSHIPS) {
    const item = await inspectRelationship(relation);
    if (apply && item.state === 'READY') {
      const [child, childColumn, parent, parentColumn, onDelete] = relation;
      const name = `fk_dh_${child}_${childColumn}`.slice(0, 60);
      await sequelize.getQueryInterface().addConstraint(child, {
        fields: [childColumn],
        type: 'foreign key',
        name,
        references: { table: parent, field: parentColumn },
        onDelete,
        onUpdate: 'RESTRICT',
      });
      item.state = 'ADDED';
    }
    report.push(item);
  }
  return report;
};

if (require.main === module) {
  (async () => {
    try {
      await sequelize.authenticate();
      const apply = process.argv.includes('--apply');
      const report = await applyDepartmentHeadForeignKeys({ apply });
      console.log(JSON.stringify({ mode: apply ? 'apply-safe-constraints' : 'dry-run', report }, null, 2));
      if (report.some((item) => item.state === 'BLOCKED_BY_ORPHANS' || item.state.startsWith('SCHEMA_') || item.state.startsWith('DELETE_RULE_'))) {
        process.exitCode = 2;
      }
    } catch (error) {
      console.error('Department Head FK verification failed:', error.code || error.message);
      process.exitCode = 1;
    } finally {
      await sequelize.close();
    }
  })();
}

module.exports = { RELATIONSHIPS, applyDepartmentHeadForeignKeys };
