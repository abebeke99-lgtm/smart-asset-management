const { Op } = require('sequelize');
const { Asset, Assignment, AuditLog, Category, Department, Maintenance, User } = require('../models');

const scopeWhere = (req) => req.user.role === 'admin' ? {} : { collegeId: req.organizationScope.collegeId };

const serialize = (asset, assignment) => ({
  ...asset.toJSON(),
  assetTag: asset.assetCode,
  assignedTo: assignment?.User?.fullName || assignment?.User?.username || null,
  assignedToId: assignment?.assignedTo || null,
  assignmentStatus: assignment ? 'assigned' : 'unassigned',
});

const listIctAssets = async (req, res, next) => {
  try {
    const where = { ...scopeWhere(req) };
    const search = String(req.query.search || '').trim();
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 50));
    if (req.query.category) where.category = req.query.category;
    if (req.query.status) where.status = req.query.status;
    if (req.query.condition) where.condition = req.query.condition;
    if (req.query.location) where.location = { [Op.like]: `%${String(req.query.location).trim()}%` };
    if (req.query.department) where.department = req.query.department;
    if (search) {
      const users = await User.findAll({ where: { [Op.or]: [{ username: { [Op.like]: `%${search}%` } }, { fullName: { [Op.like]: `%${search}%` } }] }, attributes: ['id'] });
      const assignments = users.length ? await Assignment.findAll({ where: { assignedTo: { [Op.in]: users.map((user) => user.id) }, status: 'active' }, attributes: ['assetId'] }) : [];
      where[Op.or] = [...['name', 'assetCode', 'serialNumber', 'manufacturer', 'model', 'department', 'location'].map((field) => ({ [field]: { [Op.like]: `%${search}%` } })), { id: { [Op.in]: assignments.map((assignment) => assignment.assetId) } }];
    }
    if (req.query.assignmentStatus === 'assigned' || req.query.assignmentStatus === 'unassigned') {
      const assignedIds = (await Assignment.findAll({ where: { status: 'active' }, attributes: ['assetId'] })).map((item) => item.assetId);
      where.id = req.query.assignmentStatus === 'assigned' ? { [Op.in]: assignedIds } : { [Op.notIn]: assignedIds };
    }
    const { count, rows } = await Asset.findAndCountAll({ where, order: [['updatedAt', 'DESC']], limit, offset: (page - 1) * limit });
    const assignments = await Assignment.findAll({ where: { assetId: { [Op.in]: rows.map((asset) => asset.id) }, status: 'active' }, include: [{ model: User, attributes: ['id', 'username', 'fullName'] }] });
    const summaryRows = await Asset.findAll({ where: scopeWhere(req), attributes: ['status'], raw: true });
    const summary = summaryRows.reduce((result, row) => { const status = String(row.status || '').toLowerCase().replace(/[_ ]/g, '-'); const key = status === 'in-use' || status === 'assigned' ? 'assigned' : status === 'under-maintenance' ? 'maintenance' : status; result[key] = (result[key] || 0) + 1; return result; }, { total: summaryRows.length });
    res.json({ success: true, assets: rows.map((asset) => serialize(asset, assignments.find((item) => item.assetId === asset.id))), total: count, summary, pagination: { page, limit, pages: Math.ceil(count / limit) } });
  } catch (error) { next(error); }
};

const getIctAsset = async (req, res, next) => {
  try {
    const asset = await Asset.findOne({ where: { id: req.params.id, ...scopeWhere(req) } });
    if (!asset) return res.status(404).json({ success: false, message: 'ICT asset not found' });
    const [assignment, maintenance, history] = await Promise.all([
      Assignment.findOne({ where: { assetId: asset.id, status: 'active' }, include: [{ model: User, attributes: ['id', 'username', 'fullName'] }] }),
      Maintenance.findAll({ where: { assetId: asset.id }, order: [['createdAt', 'DESC']], limit: 10 }),
      AuditLog.findAll({ where: { entity: `asset:${asset.id}` }, order: [['createdAt', 'DESC']], limit: 20 }),
    ]);
    res.json({ success: true, asset: serialize(asset, assignment), maintenance, history });
  } catch (error) { next(error); }
};

const updateIctAsset = async (req, res, next) => {
  try {
    const asset = await Asset.findOne({ where: { id: req.params.id, ...scopeWhere(req) } });
    if (!asset) return res.status(404).json({ success: false, message: 'ICT asset not found' });
    const allowed = ['name', 'category', 'description', 'serialNumber', 'assetCode', 'status', 'condition', 'department', 'departmentId', 'location', 'purchaseDate', 'manufacturer', 'model', 'warrantyExpiry', 'notes'];
    const updates = Object.fromEntries(allowed.filter((field) => req.body[field] !== undefined).map((field) => [field, req.body[field]]));
    const previousValue = asset.toJSON();
    await asset.update(updates);
    await AuditLog.create({ userId: req.user.id, action: 'UPDATE_ICT_ASSET', entity: `asset:${asset.id}`, details: JSON.stringify({ previousValue, newValue: asset.toJSON() }) });
    res.json({ success: true, asset: asset.toJSON() });
  } catch (error) { next(error); }
};

const getIctOptions = async (req, res, next) => {
  try {
    const assetWhere = scopeWhere(req);
    const [categories, departments, statuses, conditions] = await Promise.all([
      Category.findAll({ where: { status: 'active' }, attributes: ['id', 'name'], order: [['name', 'ASC']] }),
      Department.findAll({ where: req.user.role === 'admin' ? {} : { collegeId: req.organizationScope.collegeId, status: 'active' }, attributes: ['id', 'name'], order: [['name', 'ASC']] }),
      Asset.findAll({ where: assetWhere, attributes: [[Asset.sequelize.fn('DISTINCT', Asset.sequelize.col('status')), 'value']], raw: true }),
      Asset.findAll({ where: assetWhere, attributes: [[Asset.sequelize.fn('DISTINCT', Asset.sequelize.col('condition')), 'value']], raw: true }),
    ]);
    res.json({ success: true, categories, departments, statuses: statuses.map((item) => item.value).filter(Boolean), conditions: conditions.map((item) => item.value).filter(Boolean) });
  } catch (error) { next(error); }
};

module.exports = { listIctAssets, getIctAsset, updateIctAsset, getIctOptions };