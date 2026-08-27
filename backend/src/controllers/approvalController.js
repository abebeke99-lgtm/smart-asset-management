const { Approval, Asset, Department, User } = require('../models');
const { Op } = require('sequelize');

const normalize = (item) => {
  const data = item.toJSON();
  return { ...data, request_id: `REQ-${String(data.id).padStart(6, '0')}`, requested_by: item.Requester?.fullName || item.Requester?.username, requested_by_id: data.requestedBy, department: item.Department?.name, approved_by: item.Reviewer?.fullName || item.Reviewer?.username, created_at: data.createdAt, updated_at: data.updatedAt, approval_comment: data.comment };
};
const include = [{ model: Asset, attributes: ['id', 'assetCode', 'name', 'department'] }, { model: Department, attributes: ['id', 'name'] }, { model: User, as: 'Requester', attributes: ['id', 'username', 'fullName', 'department'] }, { model: User, as: 'Reviewer', attributes: ['id', 'username', 'fullName'] }];

const listApprovals = async (req, res, next) => {
  try {
    const where = {};
    if (req.query.status) where.status = String(req.query.status).toLowerCase();
    if (req.query.type) where.type = req.query.type;
    if (req.query.requested_by) where.requestedBy = req.query.requested_by;
    const items = await Approval.findAll({ where, include, order: [['createdAt', 'DESC']] });
    const result = items.filter((item) => {
      if (req.user.role !== 'department_head') return true;
      return item.Department?.id === Number(req.user.department_id || req.user.departmentId)
        || item.Department?.name === req.user.department
        || item.Asset?.department === req.user.department
        || item.Requester?.department === req.user.department;
    });
    res.json({ success: true, requests: result.map(normalize), approvals: result.map(normalize), total: result.length });
  } catch (error) { next(error); }
};

const createApproval = async (req, res, next) => {
  try {
    const { type, asset_id, department_id, item, quantity = 1, priority = 'medium', reason } = req.body;
    if (!type || !reason || !Number.isInteger(Number(quantity)) || Number(quantity) <= 0) return res.status(400).json({ success: false, message: 'Type, reason, and positive quantity are required' });
    const asset = asset_id ? await Asset.findByPk(asset_id) : null;
    if (asset_id && !asset) return res.status(404).json({ success: false, message: 'Asset not found' });
    if (req.user.role === 'department_head' && asset && asset.department !== req.user.department) return res.status(403).json({ success: false, message: 'Department authorization required' });
    const authenticatedDepartment = req.user.department_id || req.user.departmentId || (Number.isInteger(Number(req.user.department)) ? Number(req.user.department) : null);
    if (req.user.role === 'department_head' && department_id && String(department_id) !== String(authenticatedDepartment) && String(department_id) !== String(req.user.department)) return res.status(403).json({ success: false, message: 'Department authorization required' });
    const record = await Approval.create({ type, assetId: asset_id || null, requestedBy: req.user.id, departmentId: authenticatedDepartment || department_id || null, item: item || '', quantity, priority, reason });
    res.status(201).json({ success: true, request: normalize(record) });
  } catch (error) { next(error); }
};

const decideApproval = async (req, res, next) => {
  try {
    if (!['admin', 'department_head', 'finance', 'store_manager'].includes(req.user.role)) return res.status(403).json({ success: false, message: 'Approval authorization required' });
    const status = String(req.body.status || '').toLowerCase();
    if (!['approved', 'rejected', 'cancelled'].includes(status)) return res.status(400).json({ success: false, message: 'Invalid approval status' });
    const record = await Approval.findByPk(req.params.id, { include });
    if (!record) return res.status(404).json({ success: false, message: 'Approval not found' });
    if (req.user.role === 'department_head' && record.Department?.name && record.Department.name !== req.user.department) return res.status(403).json({ success: false, message: 'Department authorization required' });
    await record.update({ status, reviewedBy: req.user.id, comment: req.body.comment || req.body.reason || '' });
    res.json({ success: true, request: normalize(record) });
  } catch (error) { next(error); }
};

module.exports = { listApprovals, createApproval, decideApproval };
