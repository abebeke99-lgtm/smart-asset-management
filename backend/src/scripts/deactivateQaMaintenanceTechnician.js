const { randomBytes } = require('crypto');
const bcrypt = require('bcryptjs');
const { sequelize, User, Maintenance, MaintenanceWorkOrder, MaintenanceRepair, AuditLog } = require('../models');

const target = {
  id: 11,
  username: 'qa_maintenance_technician',
  email: 'qa-maintenance-technician@local.test',
  fullName: 'QA Maintenance Technician',
  role: 'maintenance',
};
const auditAction = 'QA_MAINTENANCE_TECHNICIAN_DEACTIVATED';
const auditEntity = `user:${target.id}`;

const readState = async (transaction) => {
  const user = await User.findByPk(target.id, { transaction });
  if (!user || user.username !== target.username || user.email !== target.email || user.fullName !== target.fullName || user.role !== target.role) {
    throw new Error('Refusing to modify: user ID 11 does not match the expected QA technician identity.');
  }
  const [requests, workOrders, repairs, priorMigration] = await Promise.all([
    Maintenance.count({ where: { assignedTo: target.id }, transaction }),
    MaintenanceWorkOrder.count({ where: { technicianId: target.id }, transaction }),
    MaintenanceRepair.count({ where: { technicianId: target.id }, transaction }),
    AuditLog.findOne({ where: { action: auditAction, entity: auditEntity }, transaction }),
  ]);
  return { user, references: { requests, workOrders, repairs }, alreadyMigrated: Boolean(priorMigration) && !user.active };
};

const main = async () => {
  const apply = process.argv.includes('--apply');
  const args = process.argv.slice(2);
  if (args.some((argument) => !['--apply', '--dry-run'].includes(argument))) {
    throw new Error('Use --dry-run (default) or --apply.');
  }
  if (apply && process.env.NODE_ENV === 'production') {
    throw new Error('This QA account migration cannot be applied in production.');
  }

  const state = await readState();
  const result = {
    mode: apply ? 'apply' : 'dry-run',
    database: sequelize.config.database,
    nodeEnvironment: process.env.NODE_ENV || 'development',
    target: { id: target.id, username: target.username },
    currentActive: Boolean(state.user.active),
    referencesRetained: state.references,
    alreadyMigrated: state.alreadyMigrated,
    plannedChanges: state.alreadyMigrated ? [] : ['set active=false', 'replace password with an unguessable bcrypt hash', 'increment sessionVersion', 'clear password reset tokens', 'write immutable QA audit marker'],
    historicalRecords: 'preserved; no request, work-order, repair, or history rows are deleted or rewritten',
  };

  if (!apply || state.alreadyMigrated) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const transaction = await sequelize.transaction();
  try {
    const locked = await readState(transaction);
    if (locked.alreadyMigrated) {
      await transaction.commit();
      console.log(JSON.stringify({ ...result, alreadyMigrated: true, plannedChanges: [] }, null, 2));
      return;
    }
    await locked.user.update({
      active: false,
      password: await bcrypt.hash(randomBytes(48).toString('hex'), 12),
      sessionVersion: Number(locked.user.sessionVersion || 0) + 1,
      resetTokenHash: null,
      resetTokenExpiresAt: null,
      resetOtpHash: null,
      resetOtpExpiresAt: null,
    }, { transaction });
    await AuditLog.create({
      userId: null,
      action: auditAction,
      entity: auditEntity,
      details: JSON.stringify({ target: target.username, referencesRetained: locked.references, reason: 'QA account deactivated; history retained for audit.' }),
    }, { transaction });
    await transaction.commit();
    console.log(JSON.stringify({ ...result, applied: true }, null, 2));
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    throw error;
  }
};

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
}).finally(async () => {
  await sequelize.close();
});
