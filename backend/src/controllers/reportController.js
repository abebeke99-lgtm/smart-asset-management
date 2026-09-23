const { Op } = require('sequelize');
const {
  Asset,
  User,
  Maintenance,
  Inventory,
  Assignment,
  Transfer,
  Department,
  PurchaseOrder,
  FinancialRecord,
  DisposalRequest,
  VerificationSession,
  AssetMovement,
} = require('../models');

const normalizeReportType = (value = 'assets') => {
  const type = String(value || 'assets').trim().toLowerCase();
  const allowedTypes = ['assets', 'inventory', 'assignments', 'transfers', 'maintenance', 'departments', 'users', 'rfid', 'procurement', 'financial', 'analytics'];
  return allowedTypes.includes(type) ? type : 'assets';
};

const toNumber = (value) => Number(value || 0);

const getDefaultPagination = (req) => {
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(200, Math.max(1, Number(req.query.limit || 20)));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
};

const buildDateFilter = (where, field, dateFrom, dateTo) => {
  if (!dateFrom && !dateTo) return;
  where[field] = {};
  if (dateFrom) where[field][Op.gte] = new Date(dateFrom);
  if (dateTo) {
    const endDate = new Date(dateTo);
    endDate.setHours(23, 59, 59, 999);
    where[field][Op.lte] = endDate;
  }
};

const getDashboardStats = async (req, res) => {
  try {
    const [totalAssets, totalUsers, activeMaintenance, inventory] = await Promise.all([
      Asset.count(),
      User.count(),
      Maintenance.count({ where: { status: ['pending', 'approved', 'assigned', 'in-progress'] } }),
      Inventory.findAll({ attributes: ['availableQuantity'], raw: true }),
    ]);
    res.json({
      success: true,
      data: {
        totalAssets,
        totalUsers,
        activeMaintenance,
        inventoryValue: inventory.reduce((sum, item) => sum + Number(item.availableQuantity || 0), 0),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getReportOptions = async () => {
  const [departments, categories, statuses, locations] = await Promise.all([
    Department.findAll({ attributes: ['id', 'name', 'code'], order: [['name', 'ASC']], raw: true }),
    Asset.findAll({ attributes: ['category'], raw: true }),
    Asset.findAll({ attributes: ['status'], raw: true }),
    Asset.findAll({ attributes: ['location'], raw: true }),
  ]);

  return {
    departments: departments.map((department) => ({ id: department.id, name: department.name, code: department.code })),
    categories: [...new Set(categories.map((item) => item.category).filter(Boolean))].sort((a, b) => a.localeCompare(b)).map((name) => ({ id: name, name })),
    statuses: [...new Set(statuses.map((item) => item.status).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    locations: [...new Set(locations.map((item) => item.location).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
  };
};

const buildAssetWhere = (req) => {
  const where = {};
  const departmentId = req.query.department_id || req.query.departmentId;
  const category = req.query.category || req.query.categoryName;
  const status = req.query.status || req.query.assetStatus;
  const location = req.query.location || req.query.locationName;
  const dateFrom = req.query.dateFrom || req.query.from || req.query.date_from;
  const dateTo = req.query.dateTo || req.query.to || req.query.date_to;
  const search = req.query.search || '';

  if (departmentId) where.departmentId = departmentId;
  if (category) where.category = category;
  if (status) where.status = status;
  if (location) where.location = location;
  buildDateFilter(where, 'updatedAt', dateFrom, dateTo);

  if (search) {
    where[Op.or] = [
      { name: { [Op.like]: `%${search}%` } },
      { assetCode: { [Op.like]: `%${search}%` } },
      { serialNumber: { [Op.like]: `%${search}%` } },
      { category: { [Op.like]: `%${search}%` } },
    ];
  }
  return where;
};

const buildReportResult = async (req) => {
  const reportType = normalizeReportType(req.query.reportType || req.query.type || 'assets');
  const { page, limit, offset } = getDefaultPagination(req);
  const filters = await getReportOptions();
  const departmentId = req.query.department_id || req.query.departmentId;
  const category = req.query.category || req.query.categoryName;
  const status = req.query.status || req.query.assetStatus;
  const location = req.query.location || req.query.locationName;
  const dateFrom = req.query.dateFrom || req.query.from || req.query.date_from;
  const dateTo = req.query.dateTo || req.query.to || req.query.date_to;
  const search = req.query.search || '';

  let rows = [];
  let total = 0;
  let summary = {};
  let charts = [];

  if (reportType === 'assets' || reportType === 'inventory') {
    const where = buildAssetWhere(req);
    const result = await Asset.findAndCountAll({
      where,
      include: [
        { model: Department, as: 'DepartmentRecord', attributes: ['id', 'name', 'code'], required: false },
        {
          model: Assignment,
          required: false,
          include: [{ model: User, required: false, attributes: ['id', 'fullName', 'username'] }],
        },
      ],
      order: [['updatedAt', 'DESC'], ['id', 'DESC']],
      limit,
      offset,
      distinct: true,
    });

    rows = result.rows.map((asset) => {
      const assignment = asset.Assignments?.find((entry) => !['returned', 'cancelled', 'closed'].includes(String(entry.status || '').toLowerCase())) || null;
      return {
        id: asset.id,
        assetCode: asset.assetCode,
        name: asset.name,
        category: asset.category,
        department: asset.DepartmentRecord?.name || asset.department || '—',
        location: asset.location || '—',
        status: asset.status || '—',
        condition: asset.condition || '—',
        assignedTo: assignment?.User ? (assignment.User.fullName || assignment.User.username) : '—',
        purchaseDate: asset.purchaseDate,
        assetValue: asset.currentValue ?? asset.purchasePrice ?? 0,
        lastUpdated: asset.updatedAt,
        serialNumber: asset.serialNumber,
      };
    });
    total = result.count;

    const allAssets = await Asset.findAll({ attributes: ['status', 'currentValue', 'purchasePrice'], raw: true });
    const byStatus = {};
    allAssets.forEach((item) => {
      const label = String(item.status || 'Unknown').trim() || 'Unknown';
      byStatus[label] = (byStatus[label] || 0) + 1;
    });
    summary = {
      totalAssets: allAssets.length,
      totalValue: allAssets.reduce((sum, item) => sum + toNumber(item.currentValue || item.purchasePrice), 0),
      available: allAssets.filter((item) => ['available', 'ready', 'idle'].includes(String(item.status || '').trim().toLowerCase())).length,
      assigned: allAssets.filter((item) => ['assigned', 'in-use', 'issued', 'allocated'].includes(String(item.status || '').trim().toLowerCase())).length,
      underMaintenance: allAssets.filter((item) => ['maintenance', 'under-maintenance', 'in-repair', 'repair'].includes(String(item.status || '').trim().toLowerCase())).length,
      byStatus,
    };
    charts = Object.entries(byStatus).map(([label, value]) => ({ label, value }));
  } else if (reportType === 'assignments') {
    const where = {};
    if (status) where.status = status;
    if (dateFrom || dateTo) buildDateFilter(where, 'createdAt', dateFrom, dateTo);
    if (search) {
      where[Op.or] = [
        { '$Asset.name$': { [Op.like]: `%${search}%` } },
        { '$Asset.assetCode$': { [Op.like]: `%${search}%` } },
        { '$User.fullName$': { [Op.like]: `%${search}%` } },
      ];
    }

    const result = await Assignment.findAndCountAll({
      where,
      include: [
        { model: Asset, where: departmentId ? { departmentId } : {}, required: true, attributes: ['id', 'name', 'assetCode', 'departmentId', 'department', 'location', 'status'] },
        { model: User, required: false, attributes: ['id', 'fullName', 'username'] },
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    rows = result.rows.map((assignment) => ({
      id: assignment.id,
      asset: assignment.Asset?.name || `Asset ${assignment.assetId}`,
      assetCode: assignment.Asset?.assetCode || '—',
      assignedTo: assignment.User ? (assignment.User.fullName || assignment.User.username) : '—',
      department: assignment.Asset?.department || '—',
      assignmentDate: assignment.createdAt,
      status: assignment.status || 'active',
      location: assignment.Asset?.location || '—',
    }));
    total = result.count;
    summary = { totalAssignments: result.count, activeAssignments: result.rows.filter((row) => !['returned', 'cancelled', 'closed'].includes(String(row.status || '').toLowerCase())).length };
  } else if (reportType === 'transfers') {
    const where = {};
    if (status) where.status = status;
    if (dateFrom || dateTo) buildDateFilter(where, 'transferDate', dateFrom, dateTo);
    if (search) {
      where[Op.or] = [
        { transferNumber: { [Op.like]: `%${search}%` } },
        { sourceDepartment: { [Op.like]: `%${search}%` } },
        { destinationDepartment: { [Op.like]: `%${search}%` } },
      ];
    }

    const result = await Transfer.findAndCountAll({
      where,
      include: [
        { model: Asset, where: departmentId ? { departmentId } : {}, required: true, attributes: ['id', 'name', 'assetCode'] },
        { model: User, as: 'Requester', required: false, attributes: ['id', 'fullName', 'username'] },
      ],
      order: [['transferDate', 'DESC'], ['createdAt', 'DESC']],
      limit,
      offset,
    });

    rows = result.rows.map((transfer) => ({
      id: transfer.id,
      asset: transfer.Asset?.name || `Asset ${transfer.assetId}`,
      fromDepartment: transfer.sourceDepartment || '—',
      toDepartment: transfer.destinationDepartment || '—',
      requestedBy: transfer.Requester ? (transfer.Requester.fullName || transfer.Requester.username) : '—',
      transferDate: transfer.transferDate || transfer.createdAt,
      status: transfer.status || 'Pending',
      completedDate: transfer.receivedAt || transfer.approvalDate || transfer.updatedAt,
    }));
    total = result.count;
    summary = { totalTransfers: result.count };
  } else if (reportType === 'maintenance') {
    const where = {};
    if (status) where.status = status;
    if (dateFrom || dateTo) buildDateFilter(where, 'createdAt', dateFrom, dateTo);
    if (search) {
      where[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
      ];
    }
    const result = await Maintenance.findAndCountAll({
      where,
      include: [
        { model: Asset, required: false, attributes: ['id', 'name', 'assetCode', 'location', 'department'] },
        { model: User, as: 'Technician', required: false, attributes: ['id', 'fullName', 'username'] },
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });
    rows = result.rows.map((maintenance) => ({
      id: maintenance.id,
      title: maintenance.title,
      asset: maintenance.Asset?.name || `Asset ${maintenance.assetId}`,
      department: maintenance.Asset?.department || '—',
      location: maintenance.Asset?.location || '—',
      status: maintenance.status || 'pending',
      priority: maintenance.priority || 'medium',
      reportedDate: maintenance.createdAt,
      technician: maintenance.Technician ? (maintenance.Technician.fullName || maintenance.Technician.username) : '—',
    }));
    total = result.count;
    summary = { totalMaintenance: result.count };
  } else if (reportType === 'departments') {
    const result = await Department.findAndCountAll({
      include: [{ model: Asset, required: false, attributes: ['id', 'status', 'currentValue'] }, { model: User, required: false, attributes: ['id'] }],
      order: [['name', 'ASC']],
      limit,
      offset,
    });
    rows = result.rows.map((department) => ({
      id: department.id,
      department: department.name,
      staffCount: department.Users?.length || 0,
      totalAssets: department.Assets?.length || 0,
      assigned: (department.Assets || []).filter((asset) => ['assigned', 'in-use', 'issued', 'allocated'].includes(String(asset.status || '').trim().toLowerCase())).length,
      available: (department.Assets || []).filter((asset) => ['available', 'ready', 'idle'].includes(String(asset.status || '').trim().toLowerCase())).length,
      underMaintenance: (department.Assets || []).filter((asset) => ['maintenance', 'under-maintenance', 'in-repair', 'repair'].includes(String(asset.status || '').trim().toLowerCase())).length,
    }));
    total = result.count;
    summary = { totalDepartments: result.count, totalAssets: rows.reduce((acc, row) => acc + Number(row.totalAssets || 0), 0) };
  } else if (reportType === 'users') {
    const result = await User.findAndCountAll({
      where: search ? { [Op.or]: [{ fullName: { [Op.like]: `%${search}%` } }, { username: { [Op.like]: `%${search}%` } }, { email: { [Op.like]: `%${search}%` } }] } : {},
      include: [{ model: Department, as: 'DepartmentRecord', required: false, attributes: ['id', 'name'] }],
      order: [['fullName', 'ASC']],
      limit,
      offset,
    });
    rows = result.rows.map((user) => ({ id: user.id, fullName: user.fullName || user.username, role: user.role || '—', department: user.DepartmentRecord?.name || '—', email: user.email || '—' }));
    total = result.count;
    summary = { totalUsers: result.count };
  } else {
    const allAssets = await Asset.count();
    const allAssignments = await Assignment.count();
    const allTransfers = await Transfer.count();
    const allMaintenance = await Maintenance.count();
    const allUsers = await User.count();
    rows = [{ totalAssets: allAssets, totalAssignments: allAssignments, totalTransfers: allTransfers, totalMaintenance: allMaintenance, totalUsers: allUsers }];
    total = 1;
    summary = { totalAssets: allAssets, totalAssignments: allAssignments, totalTransfers: allTransfers, totalMaintenance: allMaintenance, totalUsers: allUsers };
  }

  return {
    success: true,
    reportType,
    data: rows,
    summary,
    filters,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
    charts,
    generatedAt: new Date().toISOString(),
  };
};

const generateReport = async (req, res) => {
  try {
    const payload = await buildReportResult(req);
    return res.json(payload);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Failed to generate report.' });
  }
};

const exportReport = async (req, res) => {
  try {
    const payload = await buildReportResult(req);
    const rows = Array.isArray(payload.data) ? payload.data : [];
    if (!rows.length) {
      return res.type('text/csv').send('reportType,generatedAt\n' + `${payload.reportType},${payload.generatedAt}\n`);
    }

    const headers = Object.keys(rows[0]);
    const csvRows = [headers.join(',')];
    rows.forEach((row) => {
      const values = headers.map((header) => {
        const value = row[header] ?? '';
        const text = String(value).replace(/"/g, '""');
        return `"${text}"`;
      });
      csvRows.push(values.join(','));
    });

    const csv = csvRows.join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=${payload.reportType || 'report'}_report.csv`);
    return res.send(csv);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Failed to export report.' });
  }
};

module.exports = { getDashboardStats, generateReport, exportReport };
