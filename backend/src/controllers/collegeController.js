const { Op } = require('sequelize');
const { Asset, User, Department, Maintenance, Approval, Transfer, AuditLog } = require('../models');

const collegeScope = (req) => String(req.user?.department || '').trim();

const getCollegeDashboard = async (req, res, next) => {
  try {
    const collegeScopeValue = collegeScope(req);
    if (!collegeScopeValue) return res.status(403).json({ success: false, message: 'College authorization is not configured for this user' });

    // The current schema stores the authorized college scope in the user's department field.
    const assetWhere = { department: collegeScopeValue };
    const userWhere = { department: collegeScopeValue };
    const [assets, staff, departments, maintenance, approvals, transfers, audits] = await Promise.all([
      Asset.findAll({ where: assetWhere, order: [['updatedAt', 'DESC']], limit: 10 }),
      User.findAll({ where: userWhere, attributes: ['id', 'username', 'fullName', 'role', 'department'], order: [['id', 'ASC']] }),
      Department.findAll({ where: { name: collegeScopeValue }, order: [['name', 'ASC']] }),
      Maintenance.findAll({ include: [{ model: Asset, where: assetWhere, required: true }], order: [['updatedAt', 'DESC']], limit: 10 }),
      Approval.findAll({ where: { departmentId: { [Op.ne]: null } }, include: [{ model: Department, where: { name: collegeScopeValue }, required: true }], order: [['updatedAt', 'DESC']], limit: 10 }),
      Transfer.findAll({ include: [{ model: Asset, where: assetWhere, required: true }], order: [['updatedAt', 'DESC']], limit: 10 }),
      AuditLog.findAll({ order: [['createdAt', 'DESC']], limit: 10 })
    ]);

    const assetRows = await Asset.findAll({ where: assetWhere, attributes: ['status', 'category', 'currentValue'], raw: true });
    const groupBy = (rows, key) => Object.entries(rows.reduce((counts, row) => {
      const value = String(row[key] || 'Unknown');
      counts[value] = (counts[value] || 0) + 1;
      return counts;
    }, {})).map(([label, value]) => ({ label, value }));
    const activeStatuses = ['in-use', 'assigned', 'In-Use', 'Assigned'];
    const pendingRequests = maintenance.filter((item) => ['pending', 'Pending'].includes(item.status)).length;
    const pendingApprovals = approvals.filter((item) => ['pending', 'Pending'].includes(item.status)).length;

    res.json({ success: true, data: {
      totalAssets: assetRows.length,
      activeAssets: assetRows.filter((asset) => activeStatuses.includes(asset.status)).length,
      availableAssets: assetRows.filter((asset) => String(asset.status).toLowerCase() === 'available').length,
      underMaintenance: assetRows.filter((asset) => String(asset.status).toLowerCase().includes('maintenance') || String(asset.status).toLowerCase().includes('repair')).length,
      pendingRequests,
      pendingApprovals,
      totalDepartments: departments.length,
      totalStaff: staff.length,
      totalAssetValue: assetRows.reduce((sum, asset) => sum + Number(asset.currentValue || 0), 0),
      recentActivities: [...assets, ...maintenance, ...transfers, ...audits].slice(0, 10),
      assetByStatus: groupBy(assetRows, 'status'),
      assetByCategory: groupBy(assetRows, 'category'),
      departmentSummary: departments.map((department) => ({ id: department.id, name: department.name, code: department.code }))
    }});
  } catch (error) {
    next(error);
  }
};

module.exports = { getCollegeDashboard };
