const { Asset } = require('../models');

const getAssetReferenceCounts = async (assetId, transaction) => {
  const references = [];
  const historicalAssociations = Object.values(Asset.associations || {})
    .filter((association) => ['HasMany', 'HasOne'].includes(association.associationType));

  for (const association of historicalAssociations) {
    const count = await association.target.count({
      where: { [association.foreignKey]: assetId },
      ...(transaction ? { transaction } : {}),
    });
    if (count > 0) references.push({ relation: association.as, count });
  }

  return references;
};

module.exports = { getAssetReferenceCounts };
