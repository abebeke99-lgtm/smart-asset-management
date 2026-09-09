const { Op, Sequelize } = require('sequelize');
const { Asset, Inventory, InventoryTransaction, User, Department, Maintenance } = require('../models');
const inventoryController = require('./inventoryController');

const getDashboard = async (req, res, next) => {
  return inventoryController.getStoreDashboard(req, res, next);
};

const getInventory = async (req, res, next) => {
  return inventoryController.getInventory(req, res, next);
};

const getLowStock = async (req, res, next) => {
  try {
    const items = await Inventory.findAll({
      include: [{ model: Asset, attributes: ['id', 'assetCode', 'name', 'category', 'status'] }, { model: Department, attributes: ['id', 'name'] }],
      where: Sequelize.where(
        Sequelize.col('available_quantity'),
        Op.lte,
        Sequelize.col('minimum_quantity')
      )
    });

    return res.json({
      success: true,
      data: items.map(item => ({
        id: item.id,
        assetId: item.assetId,
        item: item.Asset?.name || 'Inventory Item',
        category: item.Asset?.category || '',
        currentQuantity: item.availableQuantity,
        minimumQuantity: item.minimumQuantity,
        reorderLevel: item.minimumQuantity,
        status: item.availableQuantity <= 0 ? 'Out of Stock' : item.availableQuantity <= item.minimumQuantity ? 'Low Stock' : 'Normal',
        lastUpdated: item.updatedAt,
      })),
    });
  } catch (error) {
    return next(error);
  }
};

const getAvailableAssets = async (req, res, next) => {
  try {
    const search = String(req.query.search || '').trim().toLowerCase();
    const category = String(req.query.category || '').trim();
    const location = String(req.query.location || '').trim();
    const condition = String(req.query.condition || '').trim();

    const inventoryRows = await Inventory.findAll({
      include: [{ model: Asset, attributes: ['id', 'assetCode', 'name', 'category', 'status', 'condition', 'location', 'serialNumber', 'rfidTag'] }],
      where: { availableQuantity: { [Op.gt]: 0 } },
    });

    const rows = inventoryRows.map((row) => row.toJSON()).filter((row) => {
      const asset = row.Asset || {};
      const inStore = row.status === 'available' || asset.status === 'available' || asset.status === 'in_store' || asset.status === 'available';
      const excluded = ['assigned', 'under maintenance', 'disposed', 'lost', 'damaged'].includes(String(asset.status || '').toLowerCase());
      if (excluded || !inStore) return false;
      if (category && String(asset.category || '').toLowerCase() !== category.toLowerCase()) return false;
      if (location && String(asset.location || '').toLowerCase() !== location.toLowerCase()) return false;
      if (condition && String(asset.condition || '').toLowerCase() !== condition.toLowerCase()) return false;
      if (search) {
        const haystack = [asset.assetCode, asset.name, asset.serialNumber, asset.rfidTag, asset.category, asset.location, asset.condition]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });

    return res.json({
      success: true,
      data: rows.map((row) => ({
        id: row.assetId,
        assetCode: row.Asset?.assetCode,
        name: row.Asset?.name,
        category: row.Asset?.category,
        status: row.Asset?.status || row.status,
        condition: row.Asset?.condition,
        location: row.Asset?.location,
        serialNumber: row.Asset?.serialNumber,
        rfidTag: row.Asset?.rfidTag,
        availableQuantity: row.availableQuantity,
        inventoryStatus: row.status,
      })),
      pagination: { page: 1, limit: rows.length, total: rows.length, pages: 1 },
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getDashboard,
  getInventory,
  getLowStock,
  getAvailableAssets,
};
