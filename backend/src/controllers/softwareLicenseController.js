const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const {
  Asset,
  AuditLog,
  Department,
  Location,
  Supplier,
  SoftwareLicense,
  SoftwareLicenseAssignment,
  User,
} = require('../models');

const LICENSE_TYPES = ['Per User', 'Per Device', 'Subscription', 'Perpetual', 'Volume', 'Enterprise', 'Trial'];
const RENEWAL_TYPES = ['auto', 'manual', 'not_renewable'];
const STATUSES = ['Active', 'Expiring Soon', 'Expired', 'Suspended', 'Cancelled'];
const ASSIGNMENT_TYPES = ['user', 'employee', 'device', 'asset'];

const today = () => new Date().toISOString().slice(0, 10);
const dateValue = (value) => value ? String(value).slice(0, 10) : null;
const numeric = (value, fallback = 0) => {
  const result = Number(value);
  return Number.isFinite(result) ? result : fallback;
};
const scopeWhere = (req) => {
  if (req.user.role === 'admin') {
    return req.query.collegeId ? { collegeId: Number(req.query.collegeId) } : {};
  }
  return { collegeId: req.organizationScope.collegeId };
};
const canViewKey = (req) => req.user.role === 'admin' && String(req.query.includeKey || '') === 'true';

const calculateStatus = (license, requestedStatus) => {
  if (['Suspended', 'Cancelled'].includes(requestedStatus || license.status)) return requestedStatus || license.status;
  if (!license.expiryDate) return 'Active';
  const expiry = new Date(`${license.expiryDate}T23:59:59.999Z`);
  const now = new Date(`${today()}T00:00:00.000Z`);
  const days = Math.ceil((expiry.getTime() - now.getTime()) / 86400000);
  if (days < 0) return 'Expired';
  if (days <= 7) return 'Expiring Soon';
  return 'Active';
};

const maskKey = (value) => {
  const key = String(value || '');
  if (!key) return null;
  return `XXXX-XXXX-XXXX-${key.slice(-4)}`;
};

const serialize = (license, req, assignments = []) => {
  const data = license.toJSON ? license.toJSON() : { ...license };
  const status = calculateStatus(data);
  return {
    ...data,
    status,
    licenseKey: canViewKey(req) ? data.licenseKey : maskKey(data.licenseKey),
    availableQuantity: Math.max(0, Number(data.quantity || 0) - Number(data.usedQuantity || 0)),
    assignments: assignments.map((assignment) => ({
      ...assignment.toJSON(),
      user: assignment.User ? { id: assignment.User.id, name: assignment.User.fullName || assignment.User.username } : null,
      asset: assignment.Asset ? { id: assignment.Asset.id, name: assignment.Asset.name, assetCode: assignment.Asset.assetCode } : null,
    })),
  };
};

const includeRelations = [
  { model: Department, as: 'DepartmentRecord', attributes: ['id', 'name'] },
  { model: Location, as: 'LocationRecord', attributes: ['id', 'name'] },
  { model: Supplier, as: 'SupplierRecord', attributes: ['id', 'supplierName'] },
];

const writeAudit = (req, action, license, details = {}, transaction) => AuditLog.create({
  userId: req.user.id,
  action,
  entity: `software_license:${license.id}`,
  details: JSON.stringify({ softwareName: license.softwareName, ...details }),
}, transaction ? { transaction } : undefined);

const validationError = (errors) => {
  const error = new Error(Object.values(errors)[0]);
  error.status = 422;
  error.errors = errors;
  return error;
};

const validatePayload = (body, current = null) => {
  const errors = {};
  const softwareName = String(body.softwareName ?? current?.softwareName ?? '').trim();
  const vendor = String(body.vendor ?? current?.vendor ?? '').trim();
  const licenseType = String(body.licenseType ?? current?.licenseType ?? '').trim();
  const startDate = dateValue(body.startDate ?? current?.startDate);
  const expiryDate = dateValue(body.expiryDate ?? current?.expiryDate);
  const quantity = numeric(body.quantity ?? current?.quantity, NaN);
  const purchaseCost = numeric(body.purchaseCost ?? current?.purchaseCost, NaN);
  const renewalCost = numeric(body.renewalCost ?? current?.renewalCost, 0);
  if (!softwareName) errors.softwareName = 'Software name is required';
  if (!vendor) errors.vendor = 'Vendor is required';
  if (!LICENSE_TYPES.includes(licenseType)) errors.licenseType = 'A valid license type is required';
  if (!startDate || Number.isNaN(new Date(startDate).getTime())) errors.startDate = 'A valid start date is required';
  if (expiryDate && new Date(expiryDate) < new Date(startDate)) errors.expiryDate = 'Expiry date cannot be before start date';
  if (!Number.isInteger(quantity) || quantity < 1) errors.quantity = 'License quantity must be greater than zero';
  if (Number.isNaN(purchaseCost) || purchaseCost < 0) errors.purchaseCost = 'Purchase cost cannot be negative';
  if (Number.isNaN(renewalCost) || renewalCost < 0) errors.renewalCost = 'Renewal cost cannot be negative';
  const renewalType = String(body.renewalType ?? current?.renewalType ?? 'manual');
  if (!RENEWAL_TYPES.includes(renewalType)) errors.renewalType = 'A valid renewal type is required';
  if (body.status && !STATUSES.includes(String(body.status))) errors.status = 'A valid license status is required';
  if (errors.quantity === undefined && current && quantity < Number(current.usedQuantity)) errors.quantity = 'Quantity cannot be lower than used seats';
  if (Object.keys(errors).length) throw validationError(errors);
  return { softwareName, vendor, licenseType, startDate, expiryDate, quantity, purchaseCost, renewalCost, renewalType };
};

const findLicense = (req) => SoftwareLicense.findOne({ where: { id: req.params.id, ...scopeWhere(req) }, include: includeRelations });

const list = async (req, res, next) => {
  try {
    const where = { ...scopeWhere(req), archivedAt: null };
    const search = String(req.query.search || '').trim();
    if (search) where[Op.and] = [{ [Op.or]: ['softwareName', 'vendor', 'licenseNumber', 'licenseType', 'version'].map((field) => ({ [field]: { [Op.like]: `%${search}%` } })) }];
    if (req.query.status && ['Suspended', 'Cancelled'].includes(req.query.status)) where.status = req.query.status;
    if (req.query.status === 'Expired') where.expiryDate = { [Op.lt]: today() };
    if (req.query.status === 'Expiring Soon') where.expiryDate = { [Op.gte]: today(), [Op.lte]: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10) };
    if (req.query.status === 'Active') where[Op.and] = [...(where[Op.and] || []), { [Op.or]: [{ expiryDate: null }, { expiryDate: { [Op.gt]: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10) } }] }];
    if (req.query.licenseType) where.licenseType = req.query.licenseType;
    if (req.query.vendor) where.vendor = { [Op.like]: `%${String(req.query.vendor).trim()}%` };
    if (req.query.renewalType) where.renewalType = req.query.renewalType;
    if (req.query.expiry) {
      const now = new Date();
      const end = new Date(now);
      if (req.query.expiry === 'expired') where.expiryDate = { [Op.lt]: today() };
      else {
        const days = Number(String(req.query.expiry).replace('within_', '').replace('_days', ''));
        if (Number.isFinite(days)) {
          end.setDate(end.getDate() + days);
          where.expiryDate = { [Op.gte]: today(), [Op.lte]: end.toISOString().slice(0, 10) };
        } else if (req.query.expiry === 'more_than_90_days') {
          end.setDate(end.getDate() + 90);
          where.expiryDate = { [Op.gt]: end.toISOString().slice(0, 10) };
        }
      }
    }
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const fields = { softwareName: 'softwareName', vendor: 'vendor', purchaseDate: 'purchaseDate', expiryDate: 'expiryDate', purchaseCost: 'purchaseCost', quantity: 'quantity', usedQuantity: 'usedQuantity', status: 'status' };
    const orderField = fields[req.query.sortBy] || 'updatedAt';
    const order = String(req.query.sortOrder || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const result = await SoftwareLicense.findAndCountAll({ where, include: includeRelations, order: [[orderField, order]], limit, offset: (page - 1) * limit });
    const assignments = result.rows.length ? await SoftwareLicenseAssignment.findAll({ where: { softwareLicenseId: { [Op.in]: result.rows.map((row) => row.id) }, status: 'active' }, include: [{ model: User, as: 'User', attributes: ['id', 'username', 'fullName'] }, { model: Asset, as: 'Asset', attributes: ['id', 'name', 'assetCode'] }] }) : [];
    const grouped = new Map();
    assignments.forEach((assignment) => grouped.set(assignment.softwareLicenseId, [...(grouped.get(assignment.softwareLicenseId) || []), assignment]));
    return res.json({ success: true, licenses: result.rows.map((license) => serialize(license, req, grouped.get(license.id) || [])), total: result.count, pagination: { page, limit, pages: Math.max(1, Math.ceil(result.count / limit)) } });
  } catch (error) { return next(error); }
};

const statistics = async (req, res, next) => {
  try {
    const licenses = await SoftwareLicense.findAll({ where: { ...scopeWhere(req), archivedAt: null } });
    const stats = licenses.reduce((result, license) => {
      const status = calculateStatus(license);
      const quantity = Number(license.quantity || 0);
      const used = Number(license.usedQuantity || 0);
      result.totalLicenses += 1;
      result.totalSeats += quantity;
      result.usedSeats += used;
      result.totalLicenseCost += Number(license.purchaseCost || 0);
      return result;
    }, { totalLicenses: 0, activeLicenses: 0, expiringSoon: 0, expiredLicenses: 0, totalSeats: 0, usedSeats: 0, availableSeats: 0, totalLicenseCost: 0 });
    stats.availableSeats = stats.totalSeats - stats.usedSeats;
    licenses.forEach((license) => { const status = calculateStatus(license); if (status === 'Active') stats.activeLicenses += 1; if (status === 'Expiring Soon') stats.expiringSoon += 1; if (status === 'Expired') stats.expiredLicenses += 1; });
    return res.json({ success: true, statistics: stats });
  } catch (error) { return next(error); }
};

const details = async (req, res, next) => {
  try {
    const license = await findLicense(req);
    if (!license) return res.status(404).json({ success: false, message: 'Software license not found' });
    const assignments = await SoftwareLicenseAssignment.findAll({ where: { softwareLicenseId: license.id }, include: [{ model: User, as: 'User', attributes: ['id', 'username', 'fullName'] }, { model: Asset, as: 'Asset', attributes: ['id', 'name', 'assetCode'] }], order: [['createdAt', 'DESC']] });
    const history = await AuditLog.findAll({ where: { entity: `software_license:${license.id}` }, order: [['createdAt', 'DESC']], limit: 50 });
    return res.json({ success: true, license: serialize(license, req, assignments), assignments, history });
  } catch (error) { return next(error); }
};

const create = async (req, res, next) => {
  try {
    const values = validatePayload(req.body);
    const licenseNumber = String(req.body.licenseNumber || '').trim() || null;
    if (licenseNumber && await SoftwareLicense.findOne({ where: { licenseNumber } })) return res.status(409).json({ success: false, message: 'License number already exists', errors: { licenseNumber: 'License number already exists' } });
    const license = await SoftwareLicense.create({ ...req.body, ...values, licenseNumber, collegeId: req.user.role === 'admin' ? (req.body.collegeId || null) : req.organizationScope.collegeId, usedQuantity: 0, status: calculateStatus({ expiryDate: values.expiryDate, status: req.body.status }) || 'Active', createdBy: req.user.id, updatedBy: req.user.id });
    await writeAudit(req, 'SOFTWARE_LICENSE_CREATED', license);
    return res.status(201).json({ success: true, license: serialize(license, req) });
  } catch (error) { return next(error); }
};

const update = async (req, res, next) => {
  try {
    const license = await findLicense(req);
    if (!license) return res.status(404).json({ success: false, message: 'Software license not found' });
    const values = validatePayload(req.body, license);
    const licenseNumber = String(req.body.licenseNumber ?? license.licenseNumber ?? '').trim() || null;
    if (licenseNumber && await SoftwareLicense.findOne({ where: { licenseNumber, id: { [Op.ne]: license.id } } })) return res.status(409).json({ success: false, message: 'License number already exists', errors: { licenseNumber: 'License number already exists' } });
    const requestedStatus = req.body.status || license.status;
    const nextStatus = ['Suspended', 'Cancelled'].includes(requestedStatus) ? requestedStatus : calculateStatus({ expiryDate: values.expiryDate, status: requestedStatus });
    await license.update({ ...req.body, ...values, licenseNumber, status: nextStatus, updatedBy: req.user.id });
    await writeAudit(req, 'SOFTWARE_LICENSE_UPDATED', license);
    return res.json({ success: true, license: serialize(license, req) });
  } catch (error) { return next(error); }
};

const archive = async (req, res, next) => {
  try {
    const license = await findLicense(req);
    if (!license) return res.status(404).json({ success: false, message: 'Software license not found' });
    const activeAssignments = await SoftwareLicenseAssignment.count({ where: { softwareLicenseId: license.id, status: 'active' } });
    if (activeAssignments) return res.status(409).json({ success: false, message: 'Unassign active users or assets before archiving this license' });
    await license.update({ archivedAt: new Date(), status: 'Cancelled', updatedBy: req.user.id });
    await writeAudit(req, 'SOFTWARE_LICENSE_ARCHIVED', license);
    return res.json({ success: true, license: serialize(license, req) });
  } catch (error) { return next(error); }
};

const restore = async (req, res, next) => {
  try {
    const license = await SoftwareLicense.findOne({ where: { id: req.params.id, ...scopeWhere(req) } });
    if (!license) return res.status(404).json({ success: false, message: 'Software license not found' });
    await license.update({ archivedAt: null, status: calculateStatus(license), updatedBy: req.user.id });
    await writeAudit(req, 'SOFTWARE_LICENSE_RESTORED', license);
    return res.json({ success: true, license: serialize(license, req) });
  } catch (error) { return next(error); }
};

const listAssignments = async (req, res, next) => {
  try {
    const license = await findLicense(req);
    if (!license) return res.status(404).json({ success: false, message: 'Software license not found' });
    const assignments = await SoftwareLicenseAssignment.findAll({ where: { softwareLicenseId: license.id }, include: [{ model: User, as: 'User', attributes: ['id', 'username', 'fullName'] }, { model: Asset, as: 'Asset', attributes: ['id', 'name', 'assetCode'] }], order: [['createdAt', 'DESC']] });
    return res.json({ success: true, assignments });
  } catch (error) { return next(error); }
};

const assign = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const license = await SoftwareLicense.findOne({ where: { id: req.params.id, ...scopeWhere(req) }, transaction, lock: transaction.LOCK.UPDATE });
    if (!license) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Software license not found' }); }
    const assignmentType = String(req.body.assignmentType || '').trim().toLowerCase();
    const targetId = req.body.userId || req.body.employeeId || req.body.assetId;
    if (!ASSIGNMENT_TYPES.includes(assignmentType) || !targetId) throw validationError({ assignment: 'Assignment type and target are required' });
    const activeCount = await SoftwareLicenseAssignment.count({ where: { softwareLicenseId: license.id, status: 'active' }, transaction });
    if (activeCount >= Number(license.quantity)) throw validationError({ quantity: 'No available seats remain for this license' });
    const targetField = assignmentType === 'user' ? 'userId' : assignmentType === 'employee' ? 'employeeId' : 'assetId';
    const duplicate = await SoftwareLicenseAssignment.findOne({ where: { softwareLicenseId: license.id, [targetField]: targetId, status: 'active' }, transaction });
    if (duplicate) return await transaction.rollback().then(() => res.status(409).json({ success: false, message: 'This target is already assigned to the license' }));
    const assignment = await SoftwareLicenseAssignment.create({ softwareLicenseId: license.id, [targetField]: targetId, assignmentType, assignedDate: dateValue(req.body.assignedDate) || today(), expiryDate: dateValue(req.body.expiryDate), notes: req.body.notes || '', createdBy: req.user.id }, { transaction });
    await license.update({ usedQuantity: activeCount + 1, updatedBy: req.user.id }, { transaction });
    await writeAudit(req, 'SOFTWARE_LICENSE_ASSIGNED', license, { assignmentId: assignment.id, assignmentType, targetId }, transaction);
    await transaction.commit();
    return res.status(201).json({ success: true, assignment, usedQuantity: activeCount + 1, availableQuantity: Number(license.quantity) - activeCount - 1 });
  } catch (error) { if (!transaction.finished) await transaction.rollback(); return next(error); }
};

const unassign = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const license = await SoftwareLicense.findOne({ where: { id: req.params.id, ...scopeWhere(req) }, transaction, lock: transaction.LOCK.UPDATE });
    const assignment = await SoftwareLicenseAssignment.findOne({ where: { id: req.params.assignmentId, softwareLicenseId: req.params.id, status: 'active' }, transaction });
    if (!license || !assignment) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Active assignment not found' }); }
    await assignment.update({ status: 'inactive' }, { transaction });
    const usedQuantity = Math.max(0, Number(license.usedQuantity || 0) - 1);
    await license.update({ usedQuantity, updatedBy: req.user.id }, { transaction });
    await writeAudit(req, 'SOFTWARE_LICENSE_UNASSIGNED', license, { assignmentId: assignment.id }, transaction);
    await transaction.commit();
    return res.json({ success: true, usedQuantity, availableQuantity: Number(license.quantity) - usedQuantity });
  } catch (error) { if (!transaction.finished) await transaction.rollback(); return next(error); }
};

module.exports = { list, statistics, details, create, update, archive, restore, listAssignments, assign, unassign };
