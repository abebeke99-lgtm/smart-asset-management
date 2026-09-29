const { Op } = require('sequelize');
const {
  Asset,
  Budget,
  Building,
  Department,
  Incident,
  Infrastructure,
  Invoice,
  Maintenance,
  MaintenanceWorkOrder,
  Payment,
  ServiceRequest,
  SoftwareLicense,
  Supplier,
  User,
} = require('../models');

const roleGroups = {
  admin: ['assets', 'tickets', 'users'],
  college: ['assets', 'tickets', 'users'],
  department_head: ['assets', 'tickets', 'users'],
  store_manager: ['assets', 'suppliers'],
  ict_officer: ['assets', 'tickets', 'incidents', 'licenses', 'maintenance'],
  maintenance: ['assets', 'tickets', 'maintenance'],
  infrastructure: ['infrastructure', 'buildings', 'maintenance'],
  finance: ['assets', 'invoices', 'payments', 'budgets'],
};

const groupConfig = {
  assets: { model: Asset, fields: ['name', 'assetCode', 'serialNumber', 'rfidTag'], title: ['name', 'assetCode'], path: '/assets' },
  tickets: { model: ServiceRequest, fields: ['title', 'requestCode', 'description'], title: ['title', 'requestCode'], path: '/support' },
  users: { model: User, fields: ['fullName', 'username', 'email'], title: ['fullName', 'username'], path: '/users' },
  incidents: { model: Incident, fields: ['title', 'incidentNumber', 'description'], title: ['title', 'incidentNumber'], path: '/incidents' },
  licenses: { model: SoftwareLicense, fields: ['softwareName', 'vendor', 'licenseNumber'], title: ['softwareName', 'licenseNumber'], path: '/software-licenses' },
  maintenance: { model: MaintenanceWorkOrder, fields: ['workOrderNumber', 'problemDescription', 'requiredWork'], title: ['workOrderNumber', 'problemDescription'], path: '/maintenance' },
  infrastructure: { model: Infrastructure, fields: ['name', 'assetCode', 'serialNumber', 'type'], title: ['name', 'assetCode'], path: '/infrastructure/assets' },
  buildings: { model: Building, fields: ['name', 'buildingCode', 'location'], title: ['name', 'buildingCode'], path: '/infrastructure/buildings' },
  suppliers: { model: Supplier, fields: ['supplierName', 'supplierCode', 'legalName'], title: ['supplierName', 'supplierCode'], path: '/store/suppliers' },
  invoices: { model: Invoice, fields: ['invoiceNumber', 'supplierName', 'referenceNumber'], title: ['invoiceNumber', 'supplierName'], path: '/finance/invoices' },
  payments: { model: Payment, fields: ['paymentNumber', 'referenceNumber', 'bankName'], title: ['paymentNumber', 'referenceNumber'], path: '/finance/payments' },
  budgets: { model: Budget, fields: ['budgetCode', 'budgetName', 'description'], title: ['budgetName', 'budgetCode'], path: '/finance/budgets' },
};

const organizationWhere = (model, scope, role) => {
  if (role === 'admin') return {};
  const attributes = model.rawAttributes || {};
  const where = {};

  if (role === 'department_head') {
    if (!scope.departmentId || !attributes.departmentId) return null;
    where.departmentId = scope.departmentId;
    if (scope.collegeId && attributes.collegeId) where.collegeId = scope.collegeId;
    return where;
  }

  if (role === 'college' || role === 'ict_officer' || role === 'store_manager') {
    if (!scope.collegeId || !attributes.collegeId) return null;
    where.collegeId = scope.collegeId;
    return where;
  }

  if (scope.departmentId && attributes.departmentId) where.departmentId = scope.departmentId;
  if (scope.collegeId && attributes.collegeId) where.collegeId = scope.collegeId;
  if (Object.keys(where).length) return where;

  // Infrastructure records are institution-wide and have no college/department key.
  if (role === 'infrastructure' && ['Infrastructure', 'Building', 'MaintenanceWorkOrder'].includes(model.name)) return {};
  return null;
};

const toResult = (group, record) => {
  const config = groupConfig[group];
  const value = record.toJSON ? record.toJSON() : record;
  const title = config.title.map((field) => value[field]).find(Boolean) || `${group} #${value.id}`;
  return {
    id: value.id,
    group,
    title: String(title),
    subtitle: String(value.assetCode || value.serialNumber || value.requestCode || value.status || value.email || value.vendor || ''),
    status: value.status || null,
    path: config.path,
  };
};

const validateSearchQuery = (query) => {
  if (typeof query !== 'string') return 'Search query must be text.';
  const value = query.trim();
  if (value.length < 2) return 'Search query must contain at least 2 characters.';
  if (value.length > 80) return 'Search query must not exceed 80 characters.';
  if (/[\u0000-\u001f\u007f]/.test(value) || /(?:--|\/\*|\*\/|;\s*(?:select|insert|update|delete|drop)\b)/i.test(value)) {
    return 'Search query contains unsupported characters.';
  }
  return null;
};

const globalSearch = async (req, res) => {
  const query = req.query.q;
  const validationMessage = validateSearchQuery(query);
  if (validationMessage) return res.status(422).json({ success: false, message: validationMessage });

  const role = req.user.role;
  const allowedGroups = roleGroups[role];
  if (!allowedGroups) return res.status(403).json({ success: false, message: 'Search is not available for this role.' });

  const requestedType = req.query.type ? String(req.query.type) : null;
  if (requestedType && !allowedGroups.includes(requestedType)) {
    return res.status(400).json({ success: false, message: 'Search type is not available for this role.' });
  }

  const scope = req.organizationScope || {
    collegeId: req.user.collegeId ?? req.user.college_id ?? null,
    departmentId: req.user.departmentId ?? req.user.department_id ?? null,
  };
  const groups = requestedType ? [requestedType] : allowedGroups;
  const like = `%${query.trim().replace(/[\\%_]/g, '\\$&')}%`;

  try {
    const results = {};
    await Promise.all(groups.map(async (group) => {
      const config = groupConfig[group];
      const scopeWhere = organizationWhere(config.model, scope, role);
      if (!scopeWhere) {
        results[group] = [];
        return;
      }
      const searchableFields = config.fields.filter((field) => config.model.rawAttributes?.[field]);
      if (!searchableFields.length) {
        results[group] = [];
        return;
      }
      const where = { ...scopeWhere, [Op.or]: searchableFields.map((field) => ({ [field]: { [Op.like]: like } })) };
      if (group === 'tickets' && role === 'ict_officer') where.requestType = 'support';
      const rows = await config.model.findAll({
        where,
        attributes: ['id', ...searchableFields, 'status'].filter((field) => config.model.rawAttributes?.[field]),
        limit: 5,
        order: [['id', 'DESC']],
      });
      results[group] = rows.map((row) => toResult(group, row));
    }));
    return res.json({ success: true, data: results });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Unable to search right now. Please try again.' });
  }
};

module.exports = { globalSearch, organizationWhere, validateSearchQuery };