const { AuditLog } = require('../models');

const SECRET_FIELD_PATTERN = /password|passphrase|secret|token|credential|authorization|cookie|api.?key/i;

const sanitizeValue = (value, seen = new WeakSet()) => {
  if (value === null || value === undefined || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  if (Buffer.isBuffer(value)) return '[binary data omitted]';
  if (typeof value !== 'object') return String(value);
  if (seen.has(value)) return '[circular reference]';
  seen.add(value);

  const source = typeof value.toJSON === 'function' ? value.toJSON() : value;
  if (Array.isArray(source)) return source.map((item) => sanitizeValue(item, seen));

  return Object.fromEntries(Object.entries(source).flatMap(([key, entry]) => (
    SECRET_FIELD_PATTERN.test(key) ? [] : [[key, sanitizeValue(entry, seen)]]
  )));
};

const resolveEntityId = (entity, entityId) => {
  if (entityId !== undefined && entityId !== null) return entityId;
  const separator = String(entity || '').indexOf(':');
  return separator === -1 ? null : String(entity).slice(separator + 1);
};

const createAuditLog = async ({
  userId,
  role,
  action,
  entity,
  entityId,
  oldValue = null,
  newValue = null,
  details = {},
  transaction,
  timestamp = new Date(),
}) => {
  const occurredAt = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (!action || !entity || Number.isNaN(occurredAt.getTime())) {
    throw new TypeError('Audit action, entity, and valid timestamp are required');
  }

  const safeOldValue = sanitizeValue(oldValue);
  const safeNewValue = sanitizeValue(newValue);
  const safeDetails = sanitizeValue(details) || {};
  const resolvedEntityId = resolveEntityId(entity, entityId);
  const normalizedDetails = {
    ...safeDetails,
    user: { id: userId ?? null, role: role || null },
    userId: userId ?? null,
    role: role || null,
    action,
    entity,
    entity_id: resolvedEntityId,
    entityId: resolvedEntityId,
    timestamp: occurredAt.toISOString(),
    old_value: safeOldValue,
    new_value: safeNewValue,
    oldValue: safeOldValue,
    previousValue: safeDetails.previousValue ?? safeOldValue,
    newValue: safeNewValue,
  };

  const record = {
    userId: userId ?? null,
    action,
    entity,
    details: JSON.stringify(normalizedDetails),
    createdAt: occurredAt,
    updatedAt: occurredAt,
  };
  return AuditLog.create(record, transaction ? { transaction } : undefined);
};

module.exports = { createAuditLog, sanitizeValue };
