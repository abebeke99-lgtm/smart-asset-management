const { Op } = require('sequelize');
const { Asset, User, Department } = require('../models');

const pageValues = (query) => {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 25));
  return { page, limit, offset: (page - 1) * limit };
};

const getDepartmentDashboard = async (req, res, next) => {
  try {
    const { departmentId } = req.organizationScope;
    const [assets, staff] = await Promise.all([
      Asset.findAll({ where: { departmentId }, attributes: ['status', 'category', 'currentValue'], raw: true }),
      User.count({ where: { departmentId } }),
    ]);
    const normalized = (value) => String(value || '').toLowerCase().replace(/[_-]/g, ' ');
    const usable = assets.filter((asset) => !['disposed', 'retired'].includes(normalized(asset.status)));
    const assigned = usable.filter((asset) => ['assigned', 'in use'].includes(normalized(asset.status))).length;
    const groupBy = (key) => Object.entries(assets.reduce((result, item) => {
      const value = String(item[key] || 'Unknown');
      result[value] = (result[value] || 0) + 1;
      return result;
    }, {})).map(([label, value]) => ({ label, value }));
    res.json({ success: true, data: {
      department: req.organizationScope.department.toJSON(),
      totalAssets: assets.length,
      availableAssets: assets.filter((asset) => normalized(asset.status) === 'available').length,
      assignedAssets: assigned,
      underMaintenance: assets.filter((asset) => normalized(asset.status).includes('maintenance')).length,
      missingAssets: assets.filter((asset) => ['missing', 'lost'].includes(normalized(asset.status))).length,
      damagedAssets: assets.filter((asset) => normalized(asset.status) === 'damaged').length,
      staffCount: staff,
      assetValue: assets.reduce((total, asset) => total + Number(asset.currentValue || 0), 0),
      utilizationRate: usable.length ? assigned / usable.length : 0,
      assetByStatus: groupBy('status'),
      assetByCategory: groupBy('category'),
    }});
  } catch (error) { next(error); }
};

const listDepartmentAssets = async (req, res, next) => {
  try {
    const { page, limit, offset } = pageValues(req.query);
    const where = { departmentId: req.organizationScope.departmentId };
    if (req.query.category) where.category = String(req.query.category);
    if (req.query.status) where.status = String(req.query.status);
    if (req.query.location) where.location = String(req.query.location);
    if (req.query.search) where[Op.or] = [{ name: { [Op.like]: `%${String(req.query.search).trim()}%` } }, { assetCode: { [Op.like]: `%${String(req.query.search).trim()}%` } }, { serialNumber: { [Op.like]: `%${String(req.query.search).trim()}%` } }, { rfidTag: { [Op.like]: `%${String(req.query.search).trim()}%` } }];
    const { count, rows } = await Asset.findAndCountAll({ where, order: [['updatedAt', 'DESC']], limit, offset });
    res.json({ success: true, data: rows, pagination: { page, limit, total: count, pages: Math.ceil(count / limit) } });
  } catch (error) { next(error); }
};

const listDepartmentStaff = async (req, res, next) => {
  try {
    const { page, limit, offset } = pageValues(req.query);
    const { count, rows } = await User.findAndCountAll({ where: { departmentId: req.organizationScope.departmentId }, attributes: { exclude: ['password'] }, order: [['fullName', 'ASC']], limit, offset });
    res.json({ success: true, data: rows, pagination: { page, limit, total: count, pages: Math.ceil(count / limit) } });
  } catch (error) { next(error); }
};

module.exports = { getDepartmentDashboard, listDepartmentAssets, listDepartmentStaff };
