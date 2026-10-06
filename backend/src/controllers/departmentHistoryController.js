const { Op } = require('sequelize');
const { AuditLog, Asset, Department, Maintenance, MaintenanceHistory, Transfer, User } = require('../models');
const { sanitizeValue } = require('../services/auditLogService');

const parseDetails = (value) => {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const safeFilter = (value, name) => {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value !== 'string' || value.length > 255) {
    throw new TypeError(`Invalid ${name} filter`);
  }
  return value.trim();
};

const dateFilter = (value) => {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new TypeError('Invalid date filter');
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new TypeError('Invalid date filter');
  }
  return value;
};

const resolveStatus = (details) => {
  const newValue = details.new_value || details.newValue || {};
  const oldValue = details.old_value || details.oldValue || details.previousValue || {};
  return details.afterStatus
    ?? details.newStatus
    ?? details.status
    ?? newValue.status
    ?? details.beforeStatus
    ?? oldValue.status
    ?? '';
};

const resolveEntityId = (entity, details) => {
  const recordedId = details.entity_id
    ?? details.entityId
    ?? details.assetId
    ?? details.requestId
    ?? details.departmentAssetRequestId
    ?? details.maintenanceId;
  if (recordedId !== undefined && recordedId !== null) return String(recordedId);
  const parts = String(entity || '').split(':');
  return parts.length === 2 ? parts[1] : '';
};

const textMatches = (value, filter) => !filter || String(value || '').toLowerCase().includes(filter.toLowerCase());

const resolvePreviousValue = (details) => {
  const value = details.old_value ?? details.oldValue ?? details.previousValue;
  if (value !== undefined && value !== null) return sanitizeValue(value);
  const status = details.previousStatus ?? details.beforeStatus ?? details.previousAssetStatus;
  return status === undefined || status === null ? null : { status };
};

const resolveNewValue = (details) => {
  const value = details.new_value ?? details.newValue;
  if (value !== undefined && value !== null) return sanitizeValue(value);
  const status = details.newStatus ?? details.afterStatus ?? details.newAssetStatus;
  return status === undefined || status === null ? null : { status };
};

const getRecordedDepartmentIds = (details) => {
  const values = [
    details.departmentId,
    details.department_id,
    details.sourceDepartmentId,
    details.destinationDepartmentId,
    details.source_department_id,
    details.destination_department_id,
    details.old_value?.departmentId,
    details.old_value?.department_id,
    details.new_value?.departmentId,
    details.new_value?.department_id,
    details.oldValue?.departmentId,
    details.oldValue?.department_id,
    details.newValue?.departmentId,
    details.newValue?.department_id,
  ];
  return values.map(Number).filter(Number.isSafeInteger);
};

const getDepartmentAssetHistory = async (req, res, next) => {
  const departmentId = Number(req.organizationScope?.departmentId);
  if (!Number.isSafeInteger(departmentId) || departmentId < 1) {
    return res.status(403).json({ success: false, message: 'Department scope is not configured for this account' });
  }

  let filters;
  try {
    filters = {
      date: dateFilter(req.query?.date),
      user: safeFilter(req.query?.user, 'user'),
      action: safeFilter(req.query?.action, 'action'),
      entity: safeFilter(req.query?.entity, 'entity'),
      status: safeFilter(req.query?.status, 'status'),
    };
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }

  try {
    const [department, departmentAssets, departmentTransfers] = await Promise.all([
      Department.findByPk(departmentId, { attributes: ['id', 'name'] }),
      Asset.findAll({
        where: { departmentId },
        attributes: ['id', 'name', 'assetCode'],
        paranoid: false,
      }),
      Transfer.findAll({
        where: {
          [Op.or]: [
            { sourceDepartmentId: departmentId },
            { destinationDepartmentId: departmentId },
          ],
        },
        attributes: ['id', 'assetId', 'sourceDepartmentId', 'destinationDepartmentId'],
      }),
    ]);
    if (!department) {
      return res.status(403).json({ success: false, message: 'Department scope is not configured for this account' });
    }

    const currentAssetIds = new Set(departmentAssets.map((asset) => Number(asset.id)));
    const transferById = new Map(departmentTransfers.map((transfer) => [String(transfer.id), transfer]));
    const [departmentMaintenance, maintenanceHistory] = currentAssetIds.size
      ? await Promise.all([
        Maintenance.findAll({
          where: { assetId: { [Op.in]: [...currentAssetIds] } },
          attributes: ['id', 'assetId'],
        }),
        MaintenanceHistory.findAll({
          where: { assetId: { [Op.in]: [...currentAssetIds] } },
          attributes: ['id', 'assetId', 'userId', 'actionType', 'actionDate', 'previousStatus', 'newStatus'],
          order: [['actionDate', 'DESC'], ['id', 'DESC']],
        }),
      ])
      : [[], []];
    const maintenanceById = new Map(departmentMaintenance.map((record) => [String(record.id), record]));
    const candidateAssetIds = new Set([
      ...currentAssetIds,
      ...departmentTransfers.map((transfer) => Number(transfer.assetId)),
    ]);
    const candidateEntityKeys = [
      ...[...candidateAssetIds].map((id) => `asset:${id}`),
      ...[...transferById.keys()].map((id) => `transfer:${id}`),
      ...[...maintenanceById.keys()].map((id) => `maintenance:${id}`),
    ];
    const conditions = [];
    if (candidateEntityKeys.length) conditions.push({ entity: { [Op.in]: candidateEntityKeys } });
    for (const id of candidateAssetIds) {
      conditions.push(
        { details: { [Op.like]: `%"assetId":${id}%` } },
        { details: { [Op.like]: `%"assetId": ${id}%` } },
        { details: { [Op.like]: `%"asset_id":${id}%` } },
        { details: { [Op.like]: `%"asset_id": ${id}%` } },
      );
    }
    conditions.push(
      { details: { [Op.like]: `%"departmentId":${departmentId}%` } },
      { details: { [Op.like]: `%"departmentId": ${departmentId}%` } },
      { details: { [Op.like]: `%"department_id":${departmentId}%` } },
      { details: { [Op.like]: `%"department_id": ${departmentId}%` } },
    );
    const candidates = conditions.length
      ? await AuditLog.findAll({
        where: { [Op.or]: conditions },
        order: [['createdAt', 'DESC'], ['id', 'DESC']],
      })
      : [];

    const scopedLogs = candidates.map((log) => {
      const details = parseDetails(log.details);
      const entity = String(log.entity || '');
      const [, entityType = '', entityId = ''] = entity.match(/^([^:]+):(.+)$/) || [];
      const transfer = entityType === 'transfer' ? transferById.get(entityId) : null;
      const maintenance = entityType === 'maintenance' ? maintenanceById.get(entityId) : null;
      const linkedAssetId = entityType === 'asset'
        ? Number(entityId)
        : Number(details.assetId ?? details.asset_id ?? transfer?.assetId ?? maintenance?.assetId);
      const isCurrentDepartmentAsset = currentAssetIds.has(linkedAssetId);
      const isScopedTransfer = Boolean(transfer)
        || (String(details.transferId ?? details.transfer_id ?? '') !== ''
          && transferById.has(String(details.transferId ?? details.transfer_id)));
      const hasRecordedDepartmentScope = getRecordedDepartmentIds(details).includes(departmentId);

      if (!Number.isSafeInteger(linkedAssetId) || linkedAssetId < 1) return null;
      if (!isCurrentDepartmentAsset && !isScopedTransfer && !hasRecordedDepartmentScope) return null;
      return { log, details, linkedAssetId };
    }).filter(Boolean);

    const scopedAssetIds = [...new Set(scopedLogs.map(({ linkedAssetId }) => linkedAssetId))];
    const actorIds = [...new Set([
      ...scopedLogs.map(({ log }) => Number(log.userId)),
      ...maintenanceHistory.map((record) => Number(record.userId)),
    ].filter(Number.isSafeInteger))];
    const [assets, actors] = await Promise.all([
      scopedAssetIds.length
        ? Asset.findAll({
          where: { id: { [Op.in]: scopedAssetIds } },
          attributes: ['id', 'name', 'assetCode'],
          paranoid: false,
        })
        : [],
      actorIds.length
        ? User.findAll({
          where: { id: { [Op.in]: actorIds } },
          attributes: ['id', 'fullName', 'username'],
        })
        : [],
    ]);
    const assetById = new Map(assets.map((asset) => [Number(asset.id), asset]));
    const actorById = new Map(actors.map((actor) => [Number(actor.id), actor]));

    const auditRecords = scopedLogs.map(({ log, details, linkedAssetId }) => {
      const asset = assetById.get(linkedAssetId);
      const actor = actorById.get(Number(log.userId));
      const occurredAt = log.createdAt instanceof Date ? log.createdAt : new Date(log.createdAt);
      const entityName = asset?.name || `Asset ${linkedAssetId}`;
      const entity = asset?.assetCode ? `${entityName} (${asset.assetCode})` : entityName;
      return {
        id: log.id,
        sortId: Number(log.id) || 0,
        user: actor?.fullName || actor?.username || (log.userId ? `User ${log.userId}` : 'System'),
        userId: log.userId ?? null,
        action: log.action,
        entity,
        entityId: String(linkedAssetId),
        auditEntity: String(log.entity || ''),
        status: String(resolveStatus(details) || ''),
        previousValue: resolvePreviousValue(details),
        newValue: resolveNewValue(details),
        dateTime: Number.isNaN(occurredAt.getTime()) ? null : occurredAt.toISOString(),
        department: department.name,
      };
    });
    const maintenanceRecords = maintenanceHistory.map((record) => {
      const linkedAssetId = Number(record.assetId);
      const asset = assetById.get(linkedAssetId);
      const actor = actorById.get(Number(record.userId));
      const occurredAt = record.actionDate instanceof Date ? record.actionDate : new Date(record.actionDate);
      const entityName = asset?.name || `Asset ${linkedAssetId}`;
      const entity = asset?.assetCode ? `${entityName} (${asset.assetCode})` : entityName;
      return {
        id: `maintenance-history:${record.id}`,
        sortId: Number(record.id) || 0,
        user: actor?.fullName || actor?.username || (record.userId ? `User ${record.userId}` : 'System'),
        userId: record.userId ?? null,
        action: record.actionType || 'Maintenance',
        entity,
        entityId: String(linkedAssetId),
        auditEntity: `maintenance_history:${record.id}`,
        status: String(record.newStatus || ''),
        previousValue: record.previousStatus ? { status: record.previousStatus } : null,
        newValue: record.newStatus ? { status: record.newStatus } : null,
        dateTime: Number.isNaN(occurredAt.getTime()) ? null : occurredAt.toISOString(),
        department: department.name,
      };
    });

    const data = [...auditRecords, ...maintenanceRecords].filter((record) => {
      if (filters.date && record.dateTime?.slice(0, 10) !== filters.date) return false;
      return textMatches(record.user, filters.user)
        && textMatches(record.action, filters.action)
        && textMatches(`${record.entity} ${record.auditEntity}`, filters.entity)
        && textMatches(record.status, filters.status);
    }).sort((left, right) => {
      const dateDifference = new Date(right.dateTime || 0).getTime() - new Date(left.dateTime || 0).getTime();
      return dateDifference || right.sortId - left.sortId;
    }).map(({ sortId, ...record }) => record);

    return res.json({ success: true, data, total: data.length });
  } catch (error) {
    return next(error);
  }
};

const getDepartmentHistory = async (req, res, next) => {
  const departmentId = Number(req.organizationScope?.departmentId);
  if (!Number.isSafeInteger(departmentId) || departmentId < 1) {
    return res.status(403).json({ success: false, message: 'Department scope is not configured for this account' });
  }

  let filters;
  try {
    filters = {
      date: dateFilter(req.query?.date),
      user: safeFilter(req.query?.user, 'user'),
      action: safeFilter(req.query?.action, 'action'),
      entity: safeFilter(req.query?.entity, 'entity'),
      status: safeFilter(req.query?.status, 'status'),
    };
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }

  try {
    const [department, departmentUsers, departmentAssets] = await Promise.all([
      Department.findByPk(departmentId, { attributes: ['id', 'name'] }),
      User.findAll({ where: { departmentId }, attributes: ['id'] }),
      Asset.findAll({ where: { departmentId }, attributes: ['id'], paranoid: false }),
    ]);
    if (!department) {
      return res.status(403).json({ success: false, message: 'Department scope is not configured for this account' });
    }

    const departmentUserIds = departmentUsers.map((user) => Number(user.id));
    const departmentAssetEntities = departmentAssets.map((asset) => `asset:${asset.id}`);
    const detailsPatterns = [
      `%"departmentId":${departmentId}%`,
      `%"departmentId": ${departmentId}%`,
      `%"department_id":${departmentId}%`,
      `%"department_id": ${departmentId}%`,
    ];
    const scopeConditions = [
      ...detailsPatterns.map((pattern) => ({ details: { [Op.like]: pattern } })),
      { entity: { [Op.like]: `department:${departmentId}%` } },
    ];
    if (departmentUserIds.length) scopeConditions.push({ userId: { [Op.in]: departmentUserIds } });
    if (departmentAssetEntities.length) scopeConditions.push({ entity: { [Op.in]: departmentAssetEntities } });

    const candidates = await AuditLog.findAll({
      where: { [Op.or]: scopeConditions },
      order: [['createdAt', 'DESC'], ['id', 'DESC']],
    });
    const scopedUserIds = new Set(departmentUserIds);
    const scopedAssetEntitySet = new Set(departmentAssetEntities);
    const scopedLogs = candidates.filter((log) => {
      const details = parseDetails(log.details);
      const detailsDepartmentId = Number(details.departmentId ?? details.department_id);
      const entity = String(log.entity || '');
      return scopedUserIds.has(Number(log.userId))
        || scopedAssetEntitySet.has(entity)
        || detailsDepartmentId === departmentId
        || entity === `department:${departmentId}`
        || entity.startsWith(`department:${departmentId}:`);
    });

    const actorIds = [...new Set(scopedLogs.map((log) => Number(log.userId)).filter(Number.isSafeInteger))];
    const actors = actorIds.length
      ? await User.findAll({ where: { id: { [Op.in]: actorIds } }, attributes: ['id', 'fullName', 'username'] })
      : [];
    const actorById = new Map(actors.map((actor) => [Number(actor.id), actor]));

    const data = scopedLogs.map((log) => {
      const details = parseDetails(log.details);
      const actor = actorById.get(Number(log.userId));
      const occurredAt = log.createdAt instanceof Date ? log.createdAt : new Date(log.createdAt);
      return {
        id: log.id,
        user: actor?.fullName || actor?.username || (log.userId ? `User ${log.userId}` : 'System'),
        userId: log.userId ?? null,
        action: log.action,
        entity: String(log.entity || '').split(':')[0] || '',
        entityId: resolveEntityId(log.entity, details),
        status: String(resolveStatus(details) || ''),
        dateTime: Number.isNaN(occurredAt.getTime()) ? null : occurredAt.toISOString(),
        department: department.name,
      };
    }).filter((record) => {
      if (filters.date && record.dateTime?.slice(0, 10) !== filters.date) return false;
      return textMatches(record.user, filters.user)
        && textMatches(record.action, filters.action)
        && textMatches(record.entity, filters.entity)
        && textMatches(record.status, filters.status);
    }).sort((left, right) => {
      const dateDifference = new Date(right.dateTime || 0).getTime() - new Date(left.dateTime || 0).getTime();
      return dateDifference || Number(right.id || 0) - Number(left.id || 0);
    });

    return res.json({ success: true, data, total: data.length });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getDepartmentHistory,
  getDepartmentAssetHistory,
  parseDetails,
  resolveEntityId,
  resolveStatus,
  resolvePreviousValue,
  resolveNewValue,
};
