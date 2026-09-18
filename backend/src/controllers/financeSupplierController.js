const { Op } = require('sequelize');
const { sequelize, Supplier, AuditLog } = require('../models');

const VALID_STATUSES = ['active', 'inactive'];
const fields = ['supplierCode', 'supplierName', 'contactPerson', 'phone', 'email', 'address', 'taxIdentificationNumber', 'paymentTerms', 'status'];

const financeAccess = (req, res) => {
  if (!['admin', 'finance'].includes(req.user.role)) {
    res.status(403).json({ success: false, message: 'Finance authorization required' });
    return false;
  }
  return true;
};

const clean = (value) => String(value ?? '').trim();
const normalize = (supplier) => supplier.toJSON();

const validate = (body, existing = null) => {
  const value = {};
  for (const field of fields) value[field] = body[field] === undefined ? (existing?.[field] || '') : clean(body[field]);
  if (!value.supplierCode) throw Object.assign(new Error('Supplier code is required'), { status: 422 });
  if (!value.supplierName) throw Object.assign(new Error('Supplier name is required'), { status: 422 });
  if (value.email && !/^\S+@\S+\.\S+$/.test(value.email)) throw Object.assign(new Error('Enter a valid email address'), { status: 422 });
  if (!VALID_STATUSES.includes(value.status)) throw Object.assign(new Error('Status must be active or inactive'), { status: 422 });
  return value;
};

const duplicateError = (error) => error?.name === 'SequelizeUniqueConstraintError';

const listSuppliers = async (req, res, next) => {
  try {
    if (!financeAccess(req, res)) return;
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const search = clean(req.query.search);
    const where = {};
    if (VALID_STATUSES.includes(req.query.status)) where.status = req.query.status;
    if (search) where[Op.or] = fields.slice(0, 7).map((field) => ({ [field]: { [Op.like]: `%${search}%` } }));
    const result = await Supplier.findAndCountAll({ where, limit, offset: (page - 1) * limit, order: [['supplierName', 'ASC'], ['id', 'ASC']] });
    const total = Number(result.count || 0);
    return res.json({ success: true, data: result.rows.map(normalize), pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) } });
  } catch (error) { return next(error); }
};

const getSupplier = async (req, res, next) => {
  try {
    if (!financeAccess(req, res)) return;
    const supplier = await Supplier.findByPk(req.params.id);
    if (!supplier) return res.status(404).json({ success: false, message: 'Supplier not found' });
    return res.json({ success: true, data: normalize(supplier) });
  } catch (error) { return next(error); }
};

const createSupplier = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    if (!financeAccess(req, res)) { await transaction.rollback(); return; }
    const value = validate(req.body);
    const supplier = await Supplier.create(value, { transaction });
    await AuditLog.create({ userId: req.user.id, action: 'SUPPLIER_CREATED', entity: `supplier:${supplier.id}`, details: JSON.stringify({ supplierId: supplier.id, supplierCode: supplier.supplierCode }) }, { transaction });
    await transaction.commit();
    return res.status(201).json({ success: true, data: normalize(supplier), message: 'Supplier created successfully' });
  } catch (error) { await transaction.rollback(); if (duplicateError(error)) return res.status(409).json({ success: false, message: 'Supplier code already exists' }); return next(error); }
};

const updateSupplier = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    if (!financeAccess(req, res)) { await transaction.rollback(); return; }
    const supplier = await Supplier.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!supplier) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Supplier not found' }); }
    const before = supplier.toJSON();
    await supplier.update(validate(req.body, supplier), { transaction });
    await AuditLog.create({ userId: req.user.id, action: 'SUPPLIER_UPDATED', entity: `supplier:${supplier.id}`, details: JSON.stringify({ before, after: supplier.toJSON() }) }, { transaction });
    await transaction.commit();
    return res.json({ success: true, data: normalize(supplier), message: 'Supplier updated successfully' });
  } catch (error) { await transaction.rollback(); if (duplicateError(error)) return res.status(409).json({ success: false, message: 'Supplier code already exists' }); return next(error); }
};

const deactivateSupplier = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    if (!financeAccess(req, res)) { await transaction.rollback(); return; }
    const supplier = await Supplier.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!supplier) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Supplier not found' }); }
    const previousStatus = supplier.status;
    await supplier.update({ status: 'inactive' }, { transaction });
    await AuditLog.create({ userId: req.user.id, action: 'SUPPLIER_DEACTIVATED', entity: `supplier:${supplier.id}`, details: JSON.stringify({ previousStatus, status: supplier.status }) }, { transaction });
    await transaction.commit();
    return res.json({ success: true, data: normalize(supplier), message: 'Supplier deactivated successfully' });
  } catch (error) { await transaction.rollback(); return next(error); }
};

module.exports = { listSuppliers, getSupplier, createSupplier, updateSupplier, deactivateSupplier };