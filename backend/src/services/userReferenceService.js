const { User } = require('../models');

const NON_BLOCKING_AUDIT_ASSOCIATIONS = new Set(['AuditLogs', 'UserActivityLogs']);

const getUserReferenceCounts = async (userId, transaction) => {
  const references = [];
  const associations = Object.values(User.associations || {}).filter((association) => (
    ['HasMany', 'HasOne'].includes(association.associationType)
    && !NON_BLOCKING_AUDIT_ASSOCIATIONS.has(association.as)
  ));

  for (const association of associations) {
    const count = await association.target.count({
      where: { [association.foreignKey]: userId },
      ...(transaction ? { transaction } : {}),
    });
    if (count > 0) references.push({ relation: association.as, count });
  }

  return references;
};

module.exports = { getUserReferenceCounts };
