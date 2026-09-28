const { Op } = require('sequelize');
const { sequelize, Supplier, PurchaseOrder, Asset, Maintenance, MaintenanceWorkOrder, MaintenanceRepair, PreventiveMaintenance, AuditLog, User } = require('../models');

const VALID_STATUS = ['active', 'inactive', 'suspended'];
const VALID_TYPES = ['Spare Parts Supplier', 'Equipment Supplier', 'Maintenance Service Provider', 'Contractor', 'Technical Consultant', 'Other'];

const clean = (value) => (value === null || value === undefined ? '' : String(value).trim());

const normalizeSupplier = (record) => {
  const data = record && typeof record.toJSON === 'function' ? record.toJSON() : (record || {});
  return {
    id: data.id,
    supplierCode: data.supplierCode || data.supplier_code || '',
    supplierName: data.supplierName || data.supplier_name || '',
    legalName: data.legalName || data.legal_name || '',
    vendorType: data.vendorType || data.vendor_type || 'Other',
    registrationNumber: data.registrationNumber || data.registration_number || '',
    taxIdentificationNumber: data.taxIdentificationNumber || data.tax_identification_number || '',
    contactPerson: data.contactPerson || data.contact_person || '',
    phone: data.phone || '',
    email: data.email || '',
    website: data.website || '',
    address: data.address || '',
    city: data.city || '',
    country: data.country || '',
    paymentTerms: data.paymentTerms || data.payment_terms || '',
    notes: data.notes || '',
    status: data.status || 'active',
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
};

const validateSupplierPayload = (body, existing = null) => {
  const payload = {};
  payload.supplierCode = clean(body.supplierCode ?? existing?.supplierCode ?? existing?.supplier_code ?? '');
  payload.supplierName = clean(body.supplierName ?? existing?.supplierName ?? existing?.supplier_name ?? '');
  payload.legalName = clean(body.legalName ?? existing?.legalName ?? existing?.legal_name ?? '');
  payload.vendorType = clean(body.vendorType ?? existing?.vendorType ?? existing?.vendor_type ?? 'Other');
  payload.registrationNumber = clean(body.registrationNumber ?? existing?.registrationNumber ?? existing?.registration_number ?? '');
  payload.taxIdentificationNumber = clean(body.taxIdentificationNumber ?? existing?.taxIdentificationNumber ?? existing?.tax_identification_number ?? '');
  payload.contactPerson = clean(body.contactPerson ?? existing?.contactPerson ?? existing?.contact_person ?? '');
  payload.phone = clean(body.phone ?? existing?.phone ?? '');
  payload.email = clean(body.email ?? existing?.email ?? '');
  payload.website = clean(body.website ?? existing?.website ?? '');
  payload.address = clean(body.address ?? existing?.address ?? '');
  payload.city = clean(body.city ?? existing?.city ?? '');
  payload.country = clean(body.country ?? existing?.country ?? '');
  payload.paymentTerms = clean(body.paymentTerms ?? existing?.paymentTerms ?? existing?.payment_terms ?? '');
  payload.notes = clean(body.notes ?? existing?.notes ?? '');
  payload.status = clean(body.status ?? existing?.status ?? 'active').toLowerCase();

  if (!payload.supplierName) throw Object.assign(new Error('Supplier name is required'), { status: 422 });
  if (!payload.supplierCode) payload.supplierCode = `VND-${String(Date.now()).slice(-6)}`;
  if (!VALID_STATUS.includes(payload.status)) {
    payload.status = 'active';
  }
  if (payload.vendorType && !VALID_TYPES.includes(payload.vendorType)) {
    payload.vendorType = VALID_TYPES.includes(payload.vendorType) ? payload.vendorType : 'Other';
  }
  if (payload.email && !/^\S+@\S+\.\S+$/.test(payload.email)) {
    throw Object.assign(new Error('Enter a valid email address'), { status: 422 });
  }
  return payload;
};

const buildWhere = (query = {}) => {
  const where = {};
  const pageSearch = clean(query.search || query.q || '');
  const status = clean(query.status || '').toLowerCase();
  const vendorType = clean(query.vendorType || query.vendor_type || '');

  if (VALID_STATUS.includes(status)) where.status = status;
  if (vendorType) where.vendorType = vendorType;

  if (pageSearch) {
    where[Op.or] = [
      { supplierCode: { [Op.like]: `%${pageSearch}%` } },
      { supplierName: { [Op.like]: `%${pageSearch}%` } },
      { legalName: { [Op.like]: `%${pageSearch}%` } },
      { contactPerson: { [Op.like]: `%${pageSearch}%` } },
      { phone: { [Op.like]: `%${pageSearch}%` } },
      { email: { [Op.like]: `%${pageSearch}%` } },
      { registrationNumber: { [Op.like]: `%${pageSearch}%` } },
      { address: { [Op.like]: `%${pageSearch}%` } },
      { city: { [Op.like]: `%${pageSearch}%` } },
    ];
  }

  return where;
};

const listMaintenanceVendors = async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const where = buildWhere(req.query);

    const result = await Supplier.findAndCountAll({
      where,
      order: [['supplierName', 'ASC'], ['id', 'ASC']],
      limit,
      offset: (page - 1) * limit,
    });

    const total = Number(result.count || 0);
    const summary = {
      total: await Supplier.count(),
      active: await Supplier.count({ where: { status: 'active' } }),
      inactive: await Supplier.count({ where: { status: 'inactive' } }),
      suspended: await Supplier.count({ where: { status: 'suspended' } }),
    };

    return res.json({
      success: true,
      data: result.rows.map(normalizeSupplier),
      summary,
      pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (error) { return next(error); }
};

const getMaintenanceVendor = async (req, res, next) => {
  try {
    const supplier = await Supplier.findByPk(req.params.id);
    if (!supplier) return res.status(404).json({ success: false, message: 'Vendor not found' });

    const vendorName = supplier.supplierName || supplier.supplier_name || '';
    const [purchaseOrders, maintenanceRows, preventiveRows, assets] = await Promise.all([
      PurchaseOrder.findAll({
        where: vendorName ? { supplierName: { [Op.like]: `%${vendorName}%` } } : {},
        order: [['orderDate', 'DESC']],
        limit: 10,
        raw: true,
      }),
      Maintenance.findAll({
        where: vendorName ? { notes: { [Op.like]: `%${vendorName}%` } } : {},
        order: [['createdAt', 'DESC']],
        limit: 10,
        include: [{ model: Asset, attributes: ['id', 'name', 'assetCode', 'category'] }],
        raw: true,
        nest: true,
      }),
      PreventiveMaintenance.findAll({
        where: vendorName ? { notes: { [Op.like]: `%${vendorName}%` } } : {},
        order: [['scheduleDate', 'DESC']],
        limit: 10,
        include: [{ model: Asset, attributes: ['id', 'name', 'assetCode', 'category'] }],
        raw: true,
        nest: true,
      }),
      Asset.findAll({
        where: vendorName ? { supplier: { [Op.like]: `%${vendorName}%` } } : {},
        order: [['updatedAt', 'DESC']],
        limit: 10,
        attributes: ['id', 'name', 'assetCode', 'supplier', 'category', 'department', 'status'],
        raw: true,
      }),
    ]);

    return res.json({
      success: true,
      data: {
        vendor: normalizeSupplier(supplier),
        purchaseOrders,
        maintenance: maintenanceRows,
        preventiveMaintenance: preventiveRows,
        assets,
      },
    });
  } catch (error) { return next(error); }
};

const createMaintenanceVendor = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const payload = validateSupplierPayload(req.body || {});
    const vendor = await Supplier.create(payload, { transaction });
    await AuditLog.create({
      userId: req.user?.id || null,
      action: 'VENDOR_CREATED',
      entity: `supplier:${vendor.id}`,
      details: JSON.stringify({ vendorId: vendor.id, supplierName: vendor.supplierName, status: vendor.status }),
    }, { transaction });
    await transaction.commit();
    return res.status(201).json({ success: true, message: 'Vendor created successfully', data: normalizeSupplier(vendor) });
  } catch (error) {
    await transaction.rollback();
    if (error.name === 'SequelizeUniqueConstraintError') return res.status(409).json({ success: false, message: 'Vendor code already exists' });
    return next(error);
  }
};

const updateMaintenanceVendor = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const vendor = await Supplier.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!vendor) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }
    const before = normalizeSupplier(vendor);
    const payload = validateSupplierPayload(req.body || {}, vendor);
    await vendor.update(payload, { transaction });
    await AuditLog.create({
      userId: req.user?.id || null,
      action: 'VENDOR_UPDATED',
      entity: `supplier:${vendor.id}`,
      details: JSON.stringify({ before, after: normalizeSupplier(vendor) }),
    }, { transaction });
    await transaction.commit();
    return res.json({ success: true, message: 'Vendor updated successfully', data: normalizeSupplier(vendor) });
  } catch (error) {
    await transaction.rollback();
    return next(error);
  }
};

const setMaintenanceVendorStatus = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const vendor = await Supplier.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!vendor) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }
    const nextStatus = clean(req.body?.status || vendor.status).toLowerCase();
    const validStatus = VALID_STATUS.includes(nextStatus) ? nextStatus : vendor.status;
    const before = vendor.status;
    await vendor.update({ status: validStatus }, { transaction });
    await AuditLog.create({
      userId: req.user?.id || null,
      action: 'VENDOR_STATUS_CHANGED',
      entity: `supplier:${vendor.id}`,
      details: JSON.stringify({ previousStatus: before, newStatus: vendor.status }),
    }, { transaction });
    await transaction.commit();
    return res.json({ success: true, message: 'Vendor status updated successfully', data: normalizeSupplier(vendor) });
  } catch (error) {
    await transaction.rollback();
    return next(error);
  }
};

module.exports = {
  listMaintenanceVendors,
  getMaintenanceVendor,
  createMaintenanceVendor,
  updateMaintenanceVendor,
  setMaintenanceVendorStatus,
};
