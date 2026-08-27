const { Asset, User, Maintenance, Inventory } = require('../models');

const getDashboardStats = async (req, res) => {
  try {
    const [totalAssets, totalUsers, activeMaintenance, inventory] = await Promise.all([
      Asset.count(),
      User.count(),
      Maintenance.count({ where: { status: ['pending', 'approved', 'assigned', 'in-progress'] } }),
      Inventory.findAll({ attributes: ['availableQuantity'], raw: true }),
    ]);
    res.json({
      success: true,
      data: {
        totalAssets,
        totalUsers,
        activeMaintenance,
        inventoryValue: inventory.reduce((sum, item) => sum + Number(item.availableQuantity || 0), 0),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getDashboardStats };
