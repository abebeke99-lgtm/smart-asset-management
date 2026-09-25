const { Op } = require('sequelize');
const { Asset, Assignment, Department, Maintenance, RFIDLog, User } = require('../models');

const REPORT_TYPES = ['inventory', 'assignments', 'maintenance', 'rfid', 'status'];
const SORT_FIELDS = {
  assetCode: 'assetCode',
  name: 'name',
  category: 'category',
  status: 'status',
  condition: 'condition',
  location: 'location',
  updatedAt: 'updatedAt',
  createdAt: 'createdAt',
};

const parseDate = (value, label) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    const error = new Error(`${label} is invalid`);
    error.status = 422;
    throw error;
  }
  return date;
};

const endOfDay = (date) => {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
};

const parseFilters = async (req, collegeId) => {
  const reportType = String(req.query.type || req.query.reportType || 'inventory').trim().toLowerCase();
  if (!REPORT_TYPES.includes(reportType)) {
    const error = new Error(`Unsupported report type: ${reportType}`);
    error.status = 422;
    throw error;
  }

  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 25));
  const dateFrom = parseDate(req.query.dateFrom, 'dateFrom');
  const dateTo = parseDate(req.query.dateTo, 'dateTo');
  if (dateFrom && dateTo && dateFrom > dateTo) {
    const error = new Error('dateFrom cannot be after dateTo');
    error.status = 422;
    throw error;
  }

  const departmentId = req.query.departmentId ? Number(req.query.departmentId) : null;
  if (departmentId !== null && (!Number.isInteger(departmentId) || departmentId <= 0)) {
    const error = new Error('departmentId must be a valid id');
    error.status = 422;
    throw error;
  }
  if (departmentId) {
    const department = await Department.findOne({ where: { id: departmentId, collegeId }, attributes: ['id'] });
    if (!department) {
      const error = new Error('Department is not part of your college');
      error.status = 422;
      throw error;
    }
  }

  const sortBy = SORT_FIELDS[String(req.query.sortBy || 'updatedAt')] || SORT_FIELDS.updatedAt;
  const sortOrder = String(req.query.sortOrder || 'DESC').toUpperCase();
  const filters = {
    reportType,
    page,
    limit,
    offset: (page - 1) * limit,
    search: String(req.query.search || '').trim(),
    category: String(req.query.category || '').trim(),
    status: String(req.query.status || '').trim(),
    condition: String(req.query.condition || '').trim(),
    location: String(req.query.location || '').trim(),
    departmentId,
    dateFrom,
    dateTo,
    sortBy,
    sortOrder: ['ASC', 'DESC'].includes(sortOrder) ? sortOrder : 'DESC',
  };
  return { collegeId, ...filters };
};

const assetWhere = (filters) => {
  const where = { collegeId: filters.collegeId };
  if (filters.category) where.category = filters.category;
  if (filters.status) where.status = filters.status;
  if (filters.condition) where.condition = filters.condition;
  if (filters.location) where.location = { [Op.like]: `%${filters.location}%` };
  if (filters.departmentId) where.departmentId = filters.departmentId;
  if (filters.search) {
    where[Op.or] = ['name', 'assetCode', 'serialNumber', 'category', 'department', 'location']
      .map((field) => ({ [field]: { [Op.like]: `%${filters.search}%` } }));
  }
  return where;
};

const dateWhere = (field, filters) => {
  if (!filters.dateFrom && !filters.dateTo) return {};
  return { [field]: { ...(filters.dateFrom ? { [Op.gte]: filters.dateFrom } : {}), ...(filters.dateTo ? { [Op.lte]: endOfDay(filters.dateTo) } : {}) } };
};

const personName = (person) => person ? (person.fullName || person.username || '—') : '—';

const fetchReport = async (filters, { paginate = true } = {}) => {
  const { reportType } = filters;
  const options = {
    limit: paginate ? filters.limit : undefined,
    offset: paginate ? filters.offset : undefined,
    order: [[filters.sortBy, filters.sortOrder]],
  };

  if (reportType === 'inventory' || reportType === 'status') {
    const where = { ...assetWhere(filters), ...dateWhere('updatedAt', filters) };
    const result = reportType === 'status'
      ? { rows: await Asset.findAll({ where, attributes: ['status'], raw: true }), count: 0 }
      : await Asset.findAndCountAll({
        where,
        ...options,
        include: [
          { model: Department, as: 'DepartmentRecord', attributes: ['id', 'name'], required: false },
          { model: Assignment, required: false, where: { status: { [Op.notIn]: ['returned', 'cancelled', 'closed'] } }, include: [{ model: User, attributes: ['id', 'fullName', 'username'] }] },
        ],
        distinct: true,
      });
    const rows = result.rows.map((asset) => {
      const data = typeof asset.toJSON === 'function' ? asset.toJSON() : asset;
      const assignment = (data.Assignments || [])[0];
      return {
        id: data.id,
        assetTag: data.assetCode,
        name: data.name,
        category: data.category || '—',
        serialNumber: data.serialNumber || '—',
        status: data.status || '—',
        condition: data.condition || '—',
        department: data.DepartmentRecord?.name || data.department || '—',
        location: data.location || '—',
        assignedTo: personName(assignment?.User),
        purchaseDate: data.purchaseDate,
        lastUpdated: data.updatedAt,
      };
    });
    if (reportType === 'status') {
      const counts = rows.reduce((map, row) => { map[row.status] = (map[row.status] || 0) + 1; return map; }, {});
      const statusRows = Object.entries(counts).map(([status, count]) => ({ status, count }));
      return { rows: statusRows, total: statusRows.length, summary: { totalAssets: rows.length, statuses: counts } };
    }
    const allAssets = await Asset.findAll({ where, attributes: ['status'], raw: true });
    const statuses = allAssets.reduce((map, asset) => { const key = asset.status || 'unknown'; map[key] = (map[key] || 0) + 1; return map; }, {});
    return {
      rows,
      total: result.count,
      summary: {
        totalAssets: allAssets.length,
        assigned: allAssets.filter((asset) => ['assigned', 'in-use', 'issued', 'allocated'].includes(String(asset.status).toLowerCase())).length,
        available: allAssets.filter((asset) => ['available', 'ready', 'idle'].includes(String(asset.status).toLowerCase())).length,
        underMaintenance: allAssets.filter((asset) => ['maintenance', 'under-maintenance', 'in-repair', 'repair'].includes(String(asset.status).toLowerCase())).length,
        statuses,
      },
    };
  }

  if (reportType === 'assignments') {
    const where = { ...dateWhere('createdAt', filters) };
    if (filters.status) where.status = filters.status;
    const result = await Assignment.findAndCountAll({
      where,
      ...options,
      include: [
        { model: Asset, required: true, where: assetWhere(filters), attributes: ['id', 'assetCode', 'name', 'department', 'location'], include: [{ model: Department, as: 'DepartmentRecord', attributes: ['id', 'name'], required: false }] },
        { model: User, attributes: ['id', 'fullName', 'username'] },
      ],
    });
    const rows = result.rows.map((record) => ({ id: record.id, assetTag: record.Asset?.assetCode || '—', asset: record.Asset?.name || '—', assignedTo: personName(record.User), department: record.Asset?.DepartmentRecord?.name || record.Asset?.department || '—', assignedDate: record.createdAt, status: record.status || 'active', location: record.Asset?.location || '—' }));
    const all = await Assignment.findAll({ where, include: [{ model: Asset, required: true, where: assetWhere(filters), attributes: [] }], attributes: ['status'], raw: true });
    return { rows, total: result.count, summary: { totalAssignments: all.length, active: all.filter((item) => !['returned', 'cancelled', 'closed'].includes(String(item.status).toLowerCase())).length, returned: all.filter((item) => ['returned', 'cancelled', 'closed'].includes(String(item.status).toLowerCase())).length } };
  }

  if (reportType === 'maintenance') {
    const where = { ...dateWhere('createdAt', filters) };
    if (filters.status) where.status = filters.status;
    const result = await Maintenance.findAndCountAll({
      where,
      ...options,
      include: [
        { model: Asset, required: true, where: assetWhere(filters), attributes: ['id', 'assetCode', 'name', 'department', 'location', 'category'] },
        { model: User, as: 'Technician', attributes: ['id', 'fullName', 'username'], required: false },
      ],
    });
    const rows = result.rows.map((record) => ({ id: record.id, assetTag: record.Asset?.assetCode || '—', asset: record.Asset?.name || '—', type: record.Asset?.category || 'Maintenance', status: record.status || 'pending', priority: record.priority || 'medium', reportedDate: record.createdAt, completedDate: record.updatedAt, technician: personName(record.Technician), location: record.Asset?.location || '—', title: record.title }));
    const all = await Maintenance.findAll({ where, include: [{ model: Asset, required: true, where: assetWhere(filters), attributes: [] }], attributes: ['status'], raw: true });
    return { rows, total: result.count, summary: { totalMaintenance: all.length, open: all.filter((item) => !['completed', 'closed', 'cancelled'].includes(String(item.status).toLowerCase())).length, completed: all.filter((item) => ['completed', 'closed'].includes(String(item.status).toLowerCase())).length } };
  }

  const where = { ...dateWhere('createdAt', filters) };
  const result = await RFIDLog.findAndCountAll({ where, ...options, include: [{ model: Asset, required: true, where: assetWhere(filters), attributes: ['id', 'assetCode', 'name', 'location'] }] });
  const rows = result.rows.map((record) => ({ id: record.id, assetTag: record.Asset?.assetCode || '—', asset: record.Asset?.name || '—', tag: record.tag, action: record.action || 'scan', location: record.location || record.Asset?.location || '—', readerId: record.readerId || '—', detectedAt: record.createdAt }));
  return { rows, total: result.count, summary: { totalScans: result.count, uniqueAssets: new Set(rows.map((row) => row.assetTag)).size } };
};

const getOptions = async (collegeId) => {
  const [assets, departments] = await Promise.all([
    Asset.findAll({ where: { collegeId }, attributes: ['category', 'status', 'condition', 'location'], raw: true }),
    Department.findAll({ where: { collegeId }, attributes: ['id', 'name'], order: [['name', 'ASC']] }),
  ]);
  const unique = (field) => [...new Set(assets.map((asset) => asset[field]).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
  return { categories: unique('category'), statuses: unique('status'), conditions: unique('condition'), locations: unique('location'), departments: departments.map((department) => ({ id: department.id, name: department.name })) };
};

const getIctReports = async (req, res, next) => {
  try {
    const collegeId = Number(req.organizationScope?.collegeId);
    if (!collegeId) return res.status(403).json({ success: false, message: 'College scope is not configured for this account' });
    const filters = await parseFilters(req, collegeId);
    const [report, options] = await Promise.all([fetchReport(filters), getOptions(collegeId)]);
    return res.json({ success: true, reportType: filters.reportType, data: report.rows, summary: report.summary, filters: options, pagination: { page: filters.page, limit: filters.limit, total: report.total, totalPages: Math.ceil(report.total / filters.limit) }, generatedAt: new Date().toISOString(), scope: { collegeId, collegeName: req.organizationScope.college?.collegeName || 'Authorized college' } });
  } catch (error) {
    return next(error);
  }
};

const exportIctReport = async (req, res, next) => {
  try {
    const collegeId = Number(req.organizationScope?.collegeId);
    if (!collegeId) return res.status(403).json({ success: false, message: 'College scope is not configured for this account' });
    const filters = await parseFilters({ ...req, query: { ...req.query, page: 1, limit: 5000 } }, collegeId);
    const report = await fetchReport(filters, { paginate: false });
    const rows = report.rows;
    const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
    const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const csv = [headers.join(','), ...rows.map((row) => headers.map((header) => escape(row[header])).join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="ict-${filters.reportType}-report.csv"`);
    return res.send(csv);
  } catch (error) {
    return next(error);
  }
};

module.exports = { getIctReports, exportIctReport };