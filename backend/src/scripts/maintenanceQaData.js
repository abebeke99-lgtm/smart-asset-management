const { randomBytes } = require('crypto');
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const {
  sequelize,
  Asset,
  User,
  Maintenance,
  MaintenanceWorkOrder,
  MaintenanceRepair,
  MaintenanceInspection,
  MaintenanceTest,
  MaintenanceQualityControl,
  MaintenanceQualityControlItem,
  PreventiveMaintenance,
  MaintenanceCost,
  MaintenanceHistory,
  MaintenanceTask,
  SparePartTransaction,
  Notification,
  AuditLog,
} = require('../models');

const qaAssetCode = 'QA-MAINT-2026-001';
const qaDigitalId = 'QA-MAINT-2026-001';
const qaTechnicianUsername = 'qa_maintenance_technician';
const qaTechnicianEmail = 'qa-maintenance-technician@local.test';

const assertLocalEnvironment = () => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Maintenance QA data is disabled in production.');
  }
};

const inspect = async () => {
  const [asset, technician, coordinator] = await Promise.all([
    Asset.findOne({ where: { digitalId: qaDigitalId }, paranoid: false }),
    User.findOne({ where: { username: qaTechnicianUsername } }),
    User.findOne({ where: { username: 'maintenance', role: 'maintenance', active: true } }),
  ]);
  console.log(JSON.stringify({
    database: sequelize.config.database,
    host: sequelize.config.host,
    nodeEnvironment: process.env.NODE_ENV || 'development',
    coordinatorAvailable: Boolean(coordinator),
    qaAssetExists: Boolean(asset),
    qaTechnicianExists: Boolean(technician),
    qaAssetId: asset?.id || null,
    qaTechnicianId: technician?.id || null,
  }, null, 2));
};

const seed = async () => {
  const coordinator = await User.findOne({ where: { username: 'maintenance', role: 'maintenance', active: true } });
  const department = await sequelize.models.Department.findOne({ where: { name: 'Engineering' } });
  if (!coordinator) throw new Error('An active maintenance coordinator is required before seeding QA data.');
  if (!department) throw new Error('The Engineering department is required before seeding QA data.');

  await sequelize.transaction(async (transaction) => {
    let technician = await User.findOne({ where: { username: qaTechnicianUsername }, transaction });
    if (technician) {
      if (technician.fullName !== 'QA Maintenance Technician' || technician.role !== 'maintenance' || !technician.active) {
        throw new Error(`Existing user ${qaTechnicianUsername} does not match the QA seed identity.`);
      }
    } else {
      technician = await User.create({
        username: qaTechnicianUsername,
        email: qaTechnicianEmail,
        password: await bcrypt.hash(randomBytes(32).toString('hex'), 10),
        fullName: 'QA Maintenance Technician',
        role: 'maintenance',
        department: department.name,
        departmentId: department.id,
        active: true,
      }, { transaction });
    }

    let asset = await Asset.findOne({ where: { digitalId: qaDigitalId }, paranoid: false, transaction });
    if (asset) {
      if (asset.name !== 'QA Maintenance Asset' || asset.assetCode !== qaAssetCode || asset.deletedAt) {
        throw new Error(`Existing asset ${qaDigitalId} does not match the QA seed identity.`);
      }
    } else {
      asset = await Asset.create({
        name: 'QA Maintenance Asset',
        category: 'Computer Equipment',
        description: 'Local end-to-end maintenance QA asset. Not university inventory.',
        serialNumber: qaAssetCode,
        assetCode: qaAssetCode,
        digitalId: qaDigitalId,
        status: 'available',
        condition: 'Good',
        department: department.name,
        departmentId: department.id,
        collegeId: department.collegeId,
        location: 'QA Lab',
        quantity: 1,
        createdBy: coordinator.id,
      }, { transaction });
    }
    console.log(JSON.stringify({ assetId: asset.id, technicianId: technician.id, assetCode: qaAssetCode }));
  });
};

const cleanup = async () => {
  await sequelize.transaction(async (transaction) => {
    const asset = await Asset.findOne({ where: { digitalId: qaDigitalId }, paranoid: false, transaction });
    const technician = await User.findOne({ where: { username: qaTechnicianUsername }, transaction });
    if (!asset && !technician) {
      console.log('No tagged maintenance QA records found.');
      return;
    }

    const maintenanceRows = asset ? await Maintenance.findAll({ where: { assetId: asset.id }, attributes: ['id'], transaction }) : [];
    const maintenanceIds = maintenanceRows.map((item) => item.id);
    const workOrders = asset ? await MaintenanceWorkOrder.findAll({ where: { assetId: asset.id }, attributes: ['id'], transaction }) : [];
    const workOrderIds = workOrders.map((item) => item.id);
    const repairs = asset ? await MaintenanceRepair.findAll({ where: { assetId: asset.id }, attributes: ['id'], transaction }) : [];
    const repairIds = repairs.map((item) => item.id);
    const reviews = asset ? await MaintenanceQualityControl.findAll({ where: { assetId: asset.id }, attributes: ['id'], transaction }) : [];
    const reviewIds = reviews.map((item) => item.id);
    const entities = [
      ...maintenanceIds.map((id) => `maintenance:${id}`),
      ...workOrderIds.map((id) => `maintenance_work_order:${id}`),
      ...repairIds.map((id) => `maintenance_repair:${id}`),
    ];

    if (reviewIds.length) await MaintenanceQualityControlItem.destroy({ where: { qualityControlId: { [Op.in]: reviewIds } }, transaction });
    if (asset) {
      await Notification.destroy({ where: { [Op.or]: [{ assetId: asset.id }, ...(technician ? [{ userId: technician.id }, { recipientId: technician.id }] : [])] }, transaction });
      await MaintenanceInspection.destroy({ where: { assetId: asset.id }, force: true, transaction });
      await MaintenanceTest.destroy({ where: { assetId: asset.id }, transaction });
      await MaintenanceQualityControl.destroy({ where: { assetId: asset.id }, transaction });
      await MaintenanceTask.destroy({ where: { assetId: asset.id }, transaction });
      await SparePartTransaction.destroy({ where: { [Op.or]: [{ maintenanceId: { [Op.in]: maintenanceIds.length ? maintenanceIds : [-1] } }, { repairId: { [Op.in]: repairIds.length ? repairIds : [-1] } }] }, transaction });
      await MaintenanceCost.destroy({ where: { assetId: asset.id }, transaction });
      await MaintenanceHistory.destroy({ where: { assetId: asset.id }, transaction });
      await MaintenanceRepair.destroy({ where: { assetId: asset.id }, transaction });
      await MaintenanceWorkOrder.destroy({ where: { assetId: asset.id }, transaction });
      await PreventiveMaintenance.destroy({ where: { assetId: asset.id }, transaction });
      await Maintenance.destroy({ where: { assetId: asset.id }, transaction });
      if (entities.length) await AuditLog.destroy({ where: { entity: { [Op.in]: entities } }, transaction });
      await Asset.destroy({ where: { id: asset.id }, force: true, transaction });
    }

    if (technician) {
      const references = await Promise.all([
        Maintenance.count({ where: { assignedTo: technician.id }, transaction }),
        MaintenanceWorkOrder.count({ where: { technicianId: technician.id }, transaction }),
        MaintenanceRepair.count({ where: { technicianId: technician.id }, transaction }),
        PreventiveMaintenance.count({ where: { technicianId: technician.id }, transaction }),
      ]);
      if (references.some(Boolean)) throw new Error('QA technician still has maintenance assignments; cleanup rolled back.');
      await AuditLog.destroy({ where: { userId: technician.id }, transaction });
      await User.destroy({ where: { id: technician.id }, transaction });
    }
  });
  console.log('Tagged maintenance QA data removed.');
};

const main = async () => {
  assertLocalEnvironment();
  const command = process.argv[2] || '--inspect';
  if (command === '--inspect') await inspect();
  else if (command === '--seed') await seed();
  else if (command === '--cleanup') await cleanup();
  else throw new Error('Use --inspect, --seed, or --cleanup.');
};

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
}).finally(async () => {
  await sequelize.close();
});