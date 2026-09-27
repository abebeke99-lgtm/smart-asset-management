const { Op } = require('sequelize');
const { Asset, Assignment, Department, Incident, IncidentHistory, Maintenance, RFIDLog, ServiceRequest, SoftwareLicense, SoftwareLicenseAssignment, User } = require('../models');
const { equipmentPredicate, networkPredicate } = require('../utils/ictAssetFilters');
const { calculateSoftwareLicenseStatus } = require('../utils/softwareLicenseStatus');

const REPORT_TYPES = ['inventory', 'equipment', 'network', 'software-licenses', 'support', 'incidents', 'assignments', 'maintenance', 'rfid', 'status'];
const SORT_FIELDS = {
  assetCode: 'assetCode',
  name: 'name',
  softwareName: 'softwareName',
  vendor: 'vendor',
  expiryDate: 'expiryDate',
  requestCode: 'requestCode',
  incidentNumber: 'incidentNumber',
  priority: 'priority',
  title: 'title',
  reportedAt: 'reportedAt',
  resolvedAt: 'resolvedAt',
  completedAt: 'completedAt',
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
    priority: String(req.query.priority || '').trim(),
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

const assetWhere = (filters, assetType = null) => {
  const where = { collegeId: filters.collegeId };
  const predicate = assetType === 'equipment' ? equipmentPredicate() : assetType === 'network' ? networkPredicate() : null;
  const andFilters = predicate ? [predicate] : [];
  if (filters.category) where.category = filters.category;
  if (filters.status) where.status = filters.status;
  if (filters.condition) where.condition = filters.condition;
  if (filters.location) where.location = { [Op.like]: `%${filters.location}%` };
  if (filters.departmentId) where.departmentId = filters.departmentId;
  if (filters.search) {
    const searchFields = ['name', 'assetCode', 'serialNumber', 'category', 'department', 'location', 'manufacturer', 'model'];
    if (assetType === 'network') searchFields.push('specifications');
    andFilters.push({ [Op.or]: searchFields.map((field) => ({ [field]: { [Op.like]: `%${filters.search}%` } })) });
  }
  if (andFilters.length) where[Op.and] = andFilters;
  return where;
};

const dateWhere = (field, filters) => {
  if (!filters.dateFrom && !filters.dateTo) return {};
  return { [field]: { ...(filters.dateFrom ? { [Op.gte]: filters.dateFrom } : {}), ...(filters.dateTo ? { [Op.lte]: endOfDay(filters.dateTo) } : {}) } };
};

const personName = (person) => person ? (person.fullName || person.username || '—') : '—';

const incidentScopeWhere = (collegeId) => ({ [Op.or]: [
  { '$Reporter.collegeId$': collegeId },
  { '$Asset.collegeId$': collegeId },
  { '$DepartmentRecord.collegeId$': collegeId },
] });

const incidentScopeIncludes = () => [
  { model: User, as: 'Reporter', attributes: ['id', 'fullName', 'username', 'collegeId'], required: false },
  { model: User, as: 'Technician', attributes: ['id', 'fullName', 'username'], required: false },
  { model: Asset, attributes: ['id', 'name', 'assetCode', 'serialNumber', 'collegeId'], required: false },
  { model: Department, as: 'DepartmentRecord', attributes: ['id', 'name', 'collegeId'], required: false },
];

const fetchReport = async (filters, { paginate = true } = {}) => {
  const { reportType } = filters;
  const allowedSortFields = reportType === 'software-licenses'
    ? ['softwareName', 'vendor', 'expiryDate', 'status', 'quantity', 'usedQuantity', 'updatedAt', 'createdAt']
    : reportType === 'support'
      ? ['requestCode', 'title', 'status', 'priority', 'createdAt', 'updatedAt', 'completedAt']
      : reportType === 'incidents'
        ? ['incidentNumber', 'status', 'priority', 'reportedAt', 'createdAt', 'resolvedAt', 'updatedAt']
    : Object.values(SORT_FIELDS);
  const options = {
    limit: paginate ? filters.limit : undefined,
    offset: paginate ? filters.offset : undefined,
    order: [[allowedSortFields.includes(filters.sortBy) ? filters.sortBy : 'updatedAt', filters.sortOrder]],
  };

  if (reportType === 'software-licenses') {
    const where = { collegeId: filters.collegeId, archivedAt: null };
    if (filters.search) {
      where[Op.or] = ['softwareName', 'vendor', 'licenseNumber', 'licenseType', 'version']
        .map((field) => ({ [field]: { [Op.like]: `%${filters.search}%` } }));
    }
    const today = new Date().toISOString().slice(0, 10);
    const inSevenDays = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    const licenseFilters = [];
    if (['Expired', 'Expiring Soon', 'Active'].includes(filters.status)) where.status = { [Op.notIn]: ['Suspended', 'Cancelled'] };
    if (filters.status === 'Expired') licenseFilters.push({ expiryDate: { [Op.lt]: today } });
    else if (filters.status === 'Expiring Soon') licenseFilters.push({ expiryDate: { [Op.gte]: today, [Op.lte]: inSevenDays } });
    else if (filters.status === 'Active') licenseFilters.push({ [Op.or]: [{ expiryDate: null }, { expiryDate: { [Op.gt]: inSevenDays } }] });
    else if (filters.status) where.status = filters.status;
    if (filters.dateFrom || filters.dateTo) {
      licenseFilters.push({ expiryDate: {
        ...(filters.dateFrom ? { [Op.gte]: filters.dateFrom } : {}),
        ...(filters.dateTo ? { [Op.lte]: endOfDay(filters.dateTo) } : {}),
      } });
    }
    if (licenseFilters.length) where[Op.and] = licenseFilters;
    const attributes = ['id', 'softwareName', 'vendor', 'version', 'licenseType', 'expiryDate', 'status', 'quantity', 'usedQuantity', 'createdAt', 'updatedAt'];
    const [result, allLicenses] = await Promise.all([
      SoftwareLicense.findAndCountAll({ where, ...options, attributes }),
      SoftwareLicense.findAll({ where, attributes: ['softwareName', 'expiryDate', 'status'], raw: true }),
    ]);
    const assignments = result.rows.length ? await SoftwareLicenseAssignment.findAll({
      where: { softwareLicenseId: { [Op.in]: result.rows.map((license) => license.id) }, status: 'active' },
      include: [
        { model: User, as: 'User', attributes: ['id', 'fullName', 'username'] },
        { model: Asset, as: 'Asset', attributes: ['id', 'name', 'assetCode'] },
      ],
    }) : [];
    const grouped = new Map();
    assignments.forEach((assignment) => grouped.set(assignment.softwareLicenseId, [...(grouped.get(assignment.softwareLicenseId) || []), assignment]));
    const rows = result.rows.map((license) => {
      const data = typeof license.toJSON === 'function' ? license.toJSON() : license;
      const activeAssignments = grouped.get(data.id) || [];
      return {
        id: data.id,
        softwareName: data.softwareName,
        vendor: data.vendor,
        version: data.version || '—',
        licenseType: data.licenseType,
        status: calculateSoftwareLicenseStatus(data),
        expiryDate: data.expiryDate || '—',
        quantity: data.quantity,
        usedQuantity: data.usedQuantity,
        assignedDevices: activeAssignments.map((item) => item.Asset ? `${item.Asset.assetCode || item.Asset.name}` : '').filter(Boolean).join('; ') || '—',
        assignedUsers: activeAssignments.map((item) => personName(item.User)).filter((name) => name !== '—').join('; ') || '—',
      };
    });
    const byStatus = allLicenses.reduce((counts, license) => {
      const status = calculateSoftwareLicenseStatus(license);
      counts[status] = (counts[status] || 0) + 1;
      return counts;
    }, {});
    return {
      rows,
      total: result.count,
      summary: {
        totalLicenses: allLicenses.length,
        active: byStatus.Active || 0,
        expiringSoon: byStatus['Expiring Soon'] || 0,
        expired: byStatus.Expired || 0,
        byStatus,
      },
    };
  }

  if (reportType === 'support') {
    const where = { collegeId: filters.collegeId, requestType: 'support', ...dateWhere('createdAt', filters) };
    if (filters.status) where.status = filters.status;
    if (filters.priority) where.priority = filters.priority;
    if (filters.category) where.category = filters.category;
    if (filters.departmentId) where.departmentId = filters.departmentId;
    if (filters.search) {
      where[Op.and] = [{ [Op.or]: [
        { requestCode: { [Op.like]: `%${filters.search}%` } },
        { title: { [Op.like]: `%${filters.search}%` } },
        { description: { [Op.like]: `%${filters.search}%` } },
        { category: { [Op.like]: `%${filters.search}%` } },
        { '$Reporter.fullName$': { [Op.like]: `%${filters.search}%` } },
        { '$Reporter.username$': { [Op.like]: `%${filters.search}%` } },
        { '$Assignee.fullName$': { [Op.like]: `%${filters.search}%` } },
      ] }];
    }
    const include = [
      { model: User, as: 'Reporter', attributes: ['id', 'fullName', 'username'], required: false },
      { model: User, as: 'Assignee', attributes: ['id', 'fullName', 'username'], required: false },
      { model: Asset, attributes: ['id', 'name', 'assetCode'], required: false },
      { model: Department, as: 'DepartmentRecord', attributes: ['id', 'name'], required: false },
    ];
    const [result, allRequests] = await Promise.all([
      ServiceRequest.findAndCountAll({ where, ...options, include, distinct: true }),
      ServiceRequest.findAll({ where, attributes: ['status'], raw: true }),
    ]);
    const rows = result.rows.map((request) => ({
      id: request.id,
      ticketNumber: request.requestCode,
      title: request.title,
      category: request.category || '—',
      priority: request.priority || '—',
      status: request.status || '—',
      requester: personName(request.Reporter),
      assignedTo: personName(request.Assignee),
      asset: request.Asset?.name || '—',
      department: request.DepartmentRecord?.name || '—',
      createdAt: request.createdAt,
      completedAt: request.completedAt,
      resolution: request.resolutionSummary || request.resolution || '—',
    }));
    const byStatus = allRequests.reduce((counts, request) => {
      const status = request.status || 'unknown';
      counts[status] = (counts[status] || 0) + 1;
      return counts;
    }, {});
    return {
      rows,
      total: result.count,
      summary: {
        totalRequests: allRequests.length,
        active: allRequests.filter((request) => ['open', 'assigned', 'in-progress', 'pending-user', 'pending-parts'].includes(String(request.status).toLowerCase())).length,
        resolved: byStatus.resolved || 0,
        closed: byStatus.closed || 0,
        byStatus,
      },
    };
  }

  if (reportType === 'incidents') {
    const where = { ...incidentScopeWhere(filters.collegeId), ...dateWhere('reportedAt', filters) };
    if (filters.status) where.status = filters.status;
    if (filters.category) where.category = filters.category;
    if (filters.departmentId) where.departmentId = filters.departmentId;
    if (filters.search) {
      where[Op.and] = [{ [Op.or]: [
        { incidentNumber: { [Op.like]: `%${filters.search}%` } },
        { title: { [Op.like]: `%${filters.search}%` } },
        { description: { [Op.like]: `%${filters.search}%` } },
        { '$Reporter.fullName$': { [Op.like]: `%${filters.search}%` } },
        { '$Reporter.username$': { [Op.like]: `%${filters.search}%` } },
        { '$Technician.fullName$': { [Op.like]: `%${filters.search}%` } },
        { '$Asset.assetCode$': { [Op.like]: `%${filters.search}%` } },
        { '$Asset.serialNumber$': { [Op.like]: `%${filters.search}%` } },
      ] }];
    }
    if (filters.priority) where.priority = filters.priority;
    const include = [
      ...incidentScopeIncludes(),
      { model: IncidentHistory, separate: true, order: [['createdAt', 'DESC']], include: [{ model: User, as: 'Actor', attributes: ['id', 'fullName', 'username'] }] },
    ];
    const [result, allIncidents] = await Promise.all([
      Incident.findAndCountAll({ where, ...options, include, distinct: true }),
      Incident.findAll({ where, include: incidentScopeIncludes(), attributes: ['status', 'priority', 'resolvedAt'], raw: true }),
    ]);
    const rows = result.rows.map((incident) => ({
      id: incident.id,
      incidentNumber: incident.incidentNumber,
      title: incident.title,
      category: incident.category || '—',
      status: incident.status || '—',
      priority: incident.priority || '—',
      reporter: personName(incident.Reporter),
      assignedTo: personName(incident.Technician),
      asset: incident.Asset?.assetCode || incident.Asset?.name || '—',
      department: incident.DepartmentRecord?.name || '—',
      reportedAt: incident.reportedAt,
      resolvedAt: incident.resolvedAt,
      resolution: incident.resolutionSummary || '—',
      history: (incident.IncidentHistories || []).map((entry) => {
        const change = [entry.oldValue, entry.newValue].filter(Boolean).join(' -> ');
        const actor = personName(entry.Actor);
        return [entry.action, change, actor, entry.createdAt ? new Date(entry.createdAt).toLocaleString() : ''].filter(Boolean).join(': ');
      }).join(' | ') || '—',
    }));
    const byStatus = allIncidents.reduce((counts, incident) => { const status = incident.status || 'unknown'; counts[status] = (counts[status] || 0) + 1; return counts; }, {});
    const byPriority = allIncidents.reduce((counts, incident) => { const priority = incident.priority || 'unknown'; counts[priority] = (counts[priority] || 0) + 1; return counts; }, {});
    return {
      rows,
      total: result.count,
      summary: {
        totalIncidents: allIncidents.length,
        open: allIncidents.filter((incident) => ['new', 'assigned', 'investigating', 'in_progress', 'pending', 'escalated'].includes(String(incident.status).toLowerCase())).length,
        resolved: byStatus.resolved || 0,
        critical: byPriority.critical || 0,
        byStatus,
        byPriority,
      },
    };
  }

  if (reportType === 'inventory' || reportType === 'equipment' || reportType === 'network' || reportType === 'status') {
    const where = { ...assetWhere(filters, reportType), ...dateWhere('updatedAt', filters) };
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
        manufacturer: data.manufacturer || '—',
        model: data.model || '—',
        specifications: data.specifications || '—',
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
        totalEquipment: allAssets.length,
        totalNetworkEquipment: allAssets.length,
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

const getOptions = async (collegeId, reportType) => {
  if (reportType === 'software-licenses') {
    const licenses = await SoftwareLicense.findAll({ where: { collegeId, archivedAt: null }, attributes: ['status', 'expiryDate'], raw: true });
    return { statuses: [...new Set(licenses.map((license) => calculateSoftwareLicenseStatus(license)))].sort(), categories: [], conditions: [], locations: [], departments: [] };
  }
  if (reportType === 'support') {
    const [requests, departments] = await Promise.all([
      ServiceRequest.findAll({ where: { collegeId, requestType: 'support' }, attributes: ['status', 'category', 'priority'], raw: true }),
      Department.findAll({ where: { collegeId }, attributes: ['id', 'name'], order: [['name', 'ASC']] }),
    ]);
    return {
      statuses: [...new Set(requests.map((request) => request.status).filter(Boolean))].sort(),
      categories: [...new Set(requests.map((request) => request.category).filter(Boolean))].sort(),
      priorities: [...new Set(requests.map((request) => request.priority).filter(Boolean))].sort(),
      conditions: [], locations: [],
      departments: departments.map((department) => ({ id: department.id, name: department.name })),
    };
  }
  if (reportType === 'incidents') {
    const [incidents, departments] = await Promise.all([
      Incident.findAll({ where: incidentScopeWhere(collegeId), include: incidentScopeIncludes(), attributes: ['status', 'priority', 'category'], raw: true }),
      Department.findAll({ where: { collegeId }, attributes: ['id', 'name'], order: [['name', 'ASC']] }),
    ]);
    return {
      statuses: [...new Set(incidents.map((incident) => incident.status).filter(Boolean))].sort(),
      priorities: [...new Set(incidents.map((incident) => incident.priority).filter(Boolean))].sort(),
      categories: [...new Set(incidents.map((incident) => incident.category).filter(Boolean))].sort(),
      conditions: [],
      locations: [],
      departments: departments.map((department) => ({ id: department.id, name: department.name })),
    };
  }
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
    const [report, options] = await Promise.all([fetchReport(filters), getOptions(collegeId, filters.reportType)]);
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
    const escape = (value) => {
      const printable = value && typeof value === 'object' ? JSON.stringify(value) : value;
      return `"${String(printable ?? '').replace(/"/g, '""')}"`;
    };
    const csv = [headers.join(','), ...rows.map((row) => headers.map((header) => escape(row[header])).join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="ict-${filters.reportType}-report.csv"`);
    return res.send(csv);
  } catch (error) {
    return next(error);
  }
};

module.exports = { getIctReports, exportIctReport };