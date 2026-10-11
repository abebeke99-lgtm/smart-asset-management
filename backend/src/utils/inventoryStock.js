const rawDefaultReorderLevel = process.env.STORE_DEFAULT_REORDER_LEVEL;
const DEFAULT_REORDER_LEVEL = rawDefaultReorderLevel === undefined ? 5 : Number(rawDefaultReorderLevel);

if (!Number.isSafeInteger(DEFAULT_REORDER_LEVEL) || DEFAULT_REORDER_LEVEL < 0) {
  throw new Error('STORE_DEFAULT_REORDER_LEVEL must be a non-negative integer');
}

const effectiveReorderLevel = (inventory) => {
  const configured = Number(inventory.minimumQuantity);
  return Number.isSafeInteger(configured) && configured > 0 ? configured : DEFAULT_REORDER_LEVEL;
};

// A stored zero means "use the system default"; availableQuantity already reflects reservations and stock movements.
const effectiveReorderLevelSql = () => `CASE WHEN minimum_quantity > 0 THEN minimum_quantity ELSE ${DEFAULT_REORDER_LEVEL} END`;

module.exports = { DEFAULT_REORDER_LEVEL, effectiveReorderLevel, effectiveReorderLevelSql };
