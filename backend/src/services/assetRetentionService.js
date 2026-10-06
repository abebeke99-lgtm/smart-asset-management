const { Op } = require('sequelize');
const { sequelize, Asset, AssetDocument, AssetGrant, AssetCustody, Config } = require('../models');
const { createAuditLog } = require('./auditLogService');
const { getAssetReferenceCounts } = require('./assetReferenceService');

const DEFAULT_RECOVERY_DAYS = 30;
let scheduledTask = null;

const getRecoveryDays = async () => {
  try {
    const record = await Config.findByPk('settings:assets');
    const settings = record?.value ? JSON.parse(record.value) : {};
    const days = Number(settings.recoveryDays ?? settings.recovery_days);
    return Number.isInteger(days) && days > 0 ? days : DEFAULT_RECOVERY_DAYS;
  } catch (error) {
    return DEFAULT_RECOVERY_DAYS;
  }
};

const purgeExpiredAssets = async () => {
  const recoveryDays = await getRecoveryDays();
  const cutoff = new Date(Date.now() - recoveryDays * 86400000);
  const expiredAssets = await Asset.findAll({
    where: { deletedAt: { [Op.lte]: cutoff } },
    paranoid: false,
    attributes: ['id'],
    order: [['deletedAt', 'ASC']],
    limit: 50,
  });
  let deletedCount = 0;
  let failedCount = 0;
  let preservedCount = 0;

  for (const expiredAsset of expiredAssets) {
    const transaction = await sequelize.transaction();
    try {
      const asset = await Asset.findOne({
        where: { id: expiredAsset.id, deletedAt: { [Op.lte]: cutoff } },
        paranoid: false,
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!asset) {
        await transaction.commit();
        continue;
      }
      const references = await getAssetReferenceCounts(asset.id, transaction);
      if (references.length) {
        await transaction.commit();
        preservedCount += 1;
        continue;
      }
      const previousValue = asset.toJSON();
      await AssetDocument.destroy({ where: { assetId: asset.id }, transaction });
      await AssetGrant.destroy({ where: { assetId: asset.id }, transaction });
      await AssetCustody.destroy({ where: { assetId: asset.id }, transaction });
      await createAuditLog({
        userId: null,
        role: 'system',
        action: 'PERMANENT_DELETE_ASSET',
        entity: `asset:${asset.id}`,
        entityId: asset.id,
        oldValue: previousValue,
        newValue: null,
        details: { reason: 'recovery_period_expired', recoveryDays, deletedAt: asset.deletedAt },
        transaction,
      });
      await asset.destroy({ force: true, transaction });
      await transaction.commit();
      deletedCount += 1;
    } catch (error) {
      if (!transaction.finished) await transaction.rollback();
      failedCount += 1;
      console.error(`Expired asset purge failed for asset ${expiredAsset.id}:`, error.stack || error);
    }
  }

  return { deletedCount, failedCount, preservedCount, recoveryDays };
};

const startAssetRetentionScheduler = () => {
  if (scheduledTask) return scheduledTask;
  try {
    const cron = require('node-cron');
    const schedule = process.env.ASSET_RECOVERY_CLEANUP_SCHEDULE || '0 2 * * *';
    scheduledTask = cron.schedule(schedule, async () => {
      try {
        const result = await purgeExpiredAssets();
        if (result.deletedCount || result.failedCount) console.log('Asset recovery cleanup completed:', result);
      } catch (error) {
        console.error('Asset recovery cleanup failed:', error.stack || error);
      }
    }, { timezone: process.env.TZ || 'UTC' });
    return scheduledTask;
  } catch (error) {
    console.error('Asset recovery cleanup scheduler could not start:', error.stack || error);
    return null;
  }
};

module.exports = { getRecoveryDays, purgeExpiredAssets, startAssetRetentionScheduler };
