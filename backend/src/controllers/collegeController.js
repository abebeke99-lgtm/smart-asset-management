const { Op, fn, col, literal } = require('sequelize');
const { Asset, User, Department, Maintenance, Approval, Transfer, AuditLog, College, AssetReturn, VerificationSession, VerificationItem, Assignment, Category, AssetMovement, RFIDLog } = require('../models');

const collegeScope = (req) => String(req.user?.department || '').trim();
const normalizeStatus = (value) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const getDisplayName = (value, fallback = 'Unknown') => String(value || '').trim() || fallback;
const parseAssignmentNotes = (value) => {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch (error) { return {}; }
};

const listCollegeAssignments = async (req, res, next) => {
  try {
    const collegeId = Number(req.organizationScope?.collegeId);
    if (!collegeId) return res.status(403).json({ success: false, message: 'College scope is not configured for this account' });
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;
    const assetWhere = { collegeId };
    const assignmentWhere = {};
    const search = String(req.query.search || '').trim();
    const departmentId = req.query.departmentId ? Number(req.query.departmentId) : null;
    const assignedTo = req.query.assignedTo ? Number(req.query.assignedTo) : null;
    const status = String(req.query.status || '').trim();
    const location = String(req.query.location || '').trim();
    const category = String(req.query.category || '').trim();
    const departments = await Department.findAll({ where: { collegeId }, attributes: ['id', 'name', 'code'], order: [['name', 'ASC']] });
    const departmentIds = departments.map((department) => Number(department.id));
    if (departmentId) {
      if (!departmentIds.includes(departmentId)) return res.status(400).json({ success: false, message: 'Department is not part of your college' });
      assetWhere.departmentId = departmentId;
    }
    if (assignedTo) {
      const assignee = await User.findOne({ where: { id: assignedTo, collegeId }, attributes: ['id'] });
      if (!assignee) return res.status(400).json({ success: false, message: 'Assigned user is not part of your college' });
      assignmentWhere.assignedTo = assignedTo;
    }
    if (status) assignmentWhere.status = status;
    if (location) assetWhere.location = { [Op.like]: `%${location}%` };
    if (category) assetWhere.category = category;
    if (search) assignmentWhere[Op.or] = [
      ...(Number.isInteger(Number(search)) ? [{ id: Number(search) }] : []),
      { notes: { [Op.like]: `%${search}%` } },
      { '$Asset.assetCode$': { [Op.like]: `%${search}%` } },
      { '$Asset.name$': { [Op.like]: `%${search}%` } },
      { '$Asset.serialNumber$': { [Op.like]: `%${search}%` } },
      { '$Asset.department$': { [Op.like]: `%${search}%` } },
      { '$User.fullName$': { [Op.like]: `%${search}%` } },
      { '$User.username$': { [Op.like]: `%${search}%` } },
    ];
    const assetInclude = { model: Asset, where: assetWhere, required: true, attributes: ['id', 'assetCode', 'name', 'category', 'serialNumber', 'department', 'location', 'collegeId', 'departmentId'], include: [{ model: Department, as: 'DepartmentRecord', attributes: ['id', 'name', 'code'], required: false }] };
    const userInclude = { model: User, attributes: ['id', 'username', 'fullName', 'email', 'department', 'departmentId', 'collegeId'], required: false };
    const scopedOptions = { where: assignmentWhere, include: [assetInclude, userInclude], distinct: true };
    const [result, allScoped, staff] = await Promise.all([
      Assignment.findAndCountAll({ ...scopedOptions, limit, offset, order: [['createdAt', 'DESC']] }),
      Assignment.findAll({ ...scopedOptions, attributes: ['id', 'status'], order: [] }),
      User.findAll({ where: { collegeId, active: true }, attributes: ['id', 'username', 'fullName'], order: [['fullName', 'ASC']] }),
    ]);
    const statuses = [...new Set(allScoped.map((item) => item.status).filter(Boolean))].sort();
    const summary = { total: allScoped.length };
    statuses.forEach((value) => { summary[value] = allScoped.filter((item) => item.status === value).length; });
    const assignments = result.rows.map((assignment) => {
      const data = assignment.toJSON();
      const notes = parseAssignmentNotes(data.notes);
      return {
        id: data.id,
        assetId: data.assetId,
        asset: data.Asset ? { id: data.Asset.id, code: data.Asset.assetCode, name: data.Asset.name, category: data.Asset.category, serialNumber: data.Asset.serialNumber } : null,
        assignee: data.User ? { id: data.User.id, name: data.User.fullName || data.User.username, username: data.User.username } : null,
        department: data.Asset?.DepartmentRecord ? { id: data.Asset.DepartmentRecord.id, name: data.Asset.DepartmentRecord.name, code: data.Asset.DepartmentRecord.code } : (data.Asset?.department ? { name: data.Asset.department } : null),
        location: notes.location || data.Asset?.location || null,
        assignedDate: notes.assignedDate || data.createdAt,
        expectedReturnDate: notes.expectedReturnDate || null,
        status: data.status,
        notes: notes.notes || notes.remarks || null,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      };
    });
    const collegeAssets = await Asset.findAll({ where: { collegeId }, attributes: ['category', 'location'], raw: true });
    res.json({ success: true, data: { summary, assignments, pagination: { page, limit, total: result.count, totalPages: Math.ceil(result.count / limit), pages: Math.ceil(result.count / limit) || 1 }, filters: { departments, statuses, users: staff, categories: [...new Set(collegeAssets.map((asset) => asset.category).filter(Boolean))].sort(), locations: [...new Set(collegeAssets.map((asset) => asset.location).filter(Boolean))].sort() } } });
  } catch (error) { next(error); }
};

const normalizeMaintenanceStatus = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, '-');
const validMaintenanceStatuses = ['pending', 'approved', 'assigned', 'in-progress', 'waiting-for-parts', 'testing', 'completed', 'rejected', 'cancelled'];

const listCollegeMaintenance = async (req, res, next) => {
  try {
    const collegeId = Number(req.organizationScope?.collegeId);
    if (!collegeId) return res.status(403).json({ success: false, message: 'College scope is not configured for this account' });

    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 10));
    const offset = (page - 1) * limit;

    const search = String(req.query.search || '').trim();
    const departmentId = Number(req.query.departmentId || 0);
    const status = String(req.query.status || '').trim();
    const type = String(req.query.type || '').trim();
    const dateFrom = String(req.query.dateFrom || '').trim();
    const dateTo = String(req.query.dateTo || '').trim();

    const departments = await Department.findAll({ where: { collegeId }, attributes: ['id', 'name', 'code'], order: [['name', 'ASC']] });
    const departmentIds = departments.map((department) => Number(department.id));

    let assetWhere = { collegeId };
    if (departmentId && departmentIds.includes(departmentId)) {
      assetWhere.departmentId = departmentId;
    } else if (departmentId && !departmentIds.includes(departmentId)) {
      return res.status(400).json({ success: false, message: 'Department is not part of your college' });
    }

    const where = {};
    if (status) {
      const normalizedStatus = normalizeMaintenanceStatus(status);
      if (!validMaintenanceStatuses.includes(normalizedStatus)) {
        return res.status(400).json({ success: false, message: 'Maintenance status is invalid for this workflow' });
      }
      where.status = normalizedStatus;
    }

    if (dateFrom && Number.isNaN(Date.parse(dateFrom))) return res.status(400).json({ success: false, message: 'Date from is invalid' });
    if (dateTo && Number.isNaN(Date.parse(dateTo))) return res.status(400).json({ success: false, message: 'Date to is invalid' });
    if (dateFrom && dateTo && new Date(dateFrom) > new Date(dateTo)) return res.status(400).json({ success: false, message: 'Date from must be before date to' });

    if (search) {
      const contains = { [Op.like]: `%${search}%` };
      where[Op.or] = [
        { id: Number.isInteger(Number(search)) ? Number(search) : 0 },
        { title: contains },
        { description: contains },
        { '$Asset.assetCode$': contains },
        { '$Asset.name$': contains },
        { '$Asset.serialNumber$': contains },
        { '$Asset.department$': contains },
        { '$Technician.fullName$': contains },
        { '$Requester.fullName$': contains },
        { '$DepartmentRecord.name$': contains },
      ];
    }

    if (type) {
      where['$Asset.category$'] = type;
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt[Op.gte] = new Date(dateFrom);
      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        where.createdAt[Op.lte] = endDate;
      }
    }

    const [result, allScopedRows] = await Promise.all([
      Maintenance.findAndCountAll({
        where,
        include: [
          { model: Asset, where: assetWhere, required: true, attributes: ['id', 'name', 'assetCode', 'serialNumber', 'category', 'department', 'departmentId', 'collegeId', 'location', 'status', 'condition'] },
          { model: Department, as: 'DepartmentRecord', attributes: ['id', 'name', 'code'], required: false },
          { model: User, as: 'Requester', attributes: ['id', 'fullName', 'username', 'role'], required: false },
          { model: User, as: 'Technician', attributes: ['id', 'fullName', 'username', 'role'], required: false },
        ],
        order: [['createdAt', 'DESC']],
        limit,
        offset,
        distinct: true,
      }),
      Maintenance.findAll({
        include: [
          { model: Asset, where: assetWhere, required: true, attributes: ['id', 'name', 'assetCode', 'category', 'department', 'departmentId', 'location', 'status'] },
        ],
        attributes: ['id', 'status', 'priority', 'createdAt', 'updatedAt'],
      }),
    ]);

    const rows = result.rows.map((entry) => {
      const data = entry.toJSON();
      const asset = data.Asset || {};
      const department = asset.DepartmentRecord || { id: asset.departmentId, name: asset.department || 'Department' };
      return {
        id: data.id,
        title: data.title,
        description: data.description,
        status: data.status,
        priority: data.priority,
        type: asset.category || 'Maintenance',
        maintenanceType: asset.category || 'Maintenance',
        reportedDate: data.createdAt,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        assetId: data.assetId,
        asset: {
          id: asset.id,
          name: asset.name,
          assetCode: asset.assetCode,
          serialNumber: asset.serialNumber,
          category: asset.category,
          department: asset.department,
          departmentId: asset.departmentId,
          location: asset.location,
          status: asset.status,
          condition: asset.condition,
        },
        department: { id: department.id, name: department.name, code: department.code || '' },
        departmentName: department.name,
        departmentCode: department.code || '',
        location: asset.location,
        assetCode: asset.assetCode,
        assetName: asset.name,
        technician: data.Technician ? { id: data.Technician.id, fullName: data.Technician.fullName || data.Technician.username, username: data.Technician.username } : null,
        technicianName: data.Technician ? (data.Technician.fullName || data.Technician.username) : null,
        requester: data.Requester ? { id: data.Requester.id, fullName: data.Requester.fullName || data.Requester.username, username: data.Requester.username } : null,
        actualCost: null,
        estimatedCost: null,
        scheduledDate: null,
        completedDate: null,
      };
    });

    const types = [...new Set(allScopedRows.map((item) => item.Asset?.category).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    const statuses = [...new Set(allScopedRows.map((item) => item.status).filter(Boolean))].sort((a, b) => a.localeCompare(b));

    const summary = { total: allScopedRows.length, open: 0, inProgress: 0, completed: 0, overdue: 0, underMaintenance: 0 };
    for (const row of allScopedRows) {
      const normalized = normalizeMaintenanceStatus(row.status);
      if (['pending', 'approved', 'assigned'].includes(normalized)) summary.open += 1;
      if (['in-progress', 'waiting-for-parts', 'testing'].includes(normalized)) summary.inProgress += 1;
      if (normalized === 'completed') summary.completed += 1;
      if (row.Asset?.status && ['maintenance', 'under-maintenance', 'in-repair', 'repair'].includes(normalizeMaintenanceStatus(row.Asset.status))) summary.underMaintenance += 1;
    }

    const overdue = allScopedRows.filter((row) => {
      const status = normalizeMaintenanceStatus(row.status);
      if (['completed', 'cancelled', 'rejected'].includes(status)) return false;
      return false;
    });
    summary.overdue = overdue.length;

    res.json({
      success: true,
      data: rows,
      college: { id: collegeId, name: req.organizationScope.college?.collegeName || 'College', code: req.organizationScope.college?.collegeCode || '' },
      summary,
      filters: {
        departments: departments.map((department) => ({ id: department.id, name: department.name, code: department.code })),
        statuses: statuses.length ? statuses : validMaintenanceStatuses,
        types,
      },
      pagination: {
        page,
        limit,
        total: result.count,
        totalPages: Math.ceil(result.count / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

const getCollegeMaintenance = async (req, res, next) => {
  try {
    const collegeId = Number(req.organizationScope?.collegeId);
    if (!collegeId) return res.status(403).json({ success: false, message: 'College scope is not configured for this account' });

    const record = await Maintenance.findOne({
      where: { id: req.params.id },
      include: [
        { model: Asset, required: true, where: { collegeId }, attributes: ['id', 'name', 'assetCode', 'serialNumber', 'category', 'department', 'departmentId', 'collegeId', 'location', 'status', 'condition'] },
        { model: Department, as: 'DepartmentRecord', attributes: ['id', 'name', 'code'], required: false },
        { model: User, as: 'Requester', attributes: ['id', 'fullName', 'username', 'role'], required: false },
        { model: User, as: 'Technician', attributes: ['id', 'fullName', 'username', 'role'], required: false },
      ],
    });

    if (!record) return res.status(404).json({ success: false, message: 'Maintenance record not found in your college' });

    const data = record.toJSON();
    const asset = data.Asset || {};
    const department = asset.DepartmentRecord || { id: asset.departmentId, name: asset.department || 'Department' };
    return res.json({
      success: true,
      data: {
        id: data.id,
        title: data.title,
        description: data.description,
        status: data.status,
        priority: data.priority,
        type: asset.category || 'Maintenance',
        category: asset.category,
        reportedDate: data.createdAt,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        assetId: data.assetId,
        asset: {
          id: asset.id,
          name: asset.name,
          assetCode: asset.assetCode,
          serialNumber: asset.serialNumber,
          category: asset.category,
          department: asset.department,
          departmentId: asset.departmentId,
          collegeId: asset.collegeId,
          location: asset.location,
          status: asset.status,
          condition: asset.condition,
        },
        department: { id: department.id, name: department.name, code: department.code || '' },
        departmentName: department.name,
        college: { id: collegeId, name: req.organizationScope.college?.collegeName || 'College', code: req.organizationScope.college?.collegeCode || '' },
        location: asset.location,
        assetCode: asset.assetCode,
        assetName: asset.name,
        serialNumber: asset.serialNumber,
        technician: data.Technician ? { id: data.Technician.id, fullName: data.Technician.fullName || data.Technician.username, username: data.Technician.username } : null,
        technicianName: data.Technician ? (data.Technician.fullName || data.Technician.username) : null,
        requester: data.Requester ? { id: data.Requester.id, fullName: data.Requester.fullName || data.Requester.username, username: data.Requester.username } : null,
        estimatedCost: null,
        actualCost: null,
        notes: data.description || '',
        scheduledDate: null,
        startedDate: null,
        completedDate: null,
      },
    });
  } catch (error) {
    next(error);
  }
};

const getCollegeDashboard = async (req, res, next) => {
  try {
    const collegeId = Number(req.organizationScope?.collegeId);
    if (!collegeId) {
      return res.status(403).json({ success: false, message: 'College scope is not configured for this account' });
    }

    const [college, assets, departments, staff, pendingApprovals, assignmentRows, transferRows, returnRows, maintenanceRows, verificationItems] = await Promise.all([
      College.findByPk(collegeId),
      Asset.findAll({ where: { collegeId }, order: [['updatedAt', 'DESC']] }),
      Department.findAll({ where: { collegeId }, order: [['name', 'ASC']] }),
      User.findAll({ where: { collegeId }, attributes: ['id', 'fullName', 'username', 'role', 'department', 'departmentId'], order: [['fullName', 'ASC']] }),
      Approval.findAll({
        where: { status: 'pending' },
        include: [
          { model: Department, where: { collegeId }, required: true, attributes: ['id', 'name', 'code'] },
          { model: Asset, required: false, attributes: ['id', 'name', 'assetCode', 'category', 'departmentId'] },
          { model: User, as: 'Requester', required: false, attributes: ['id', 'fullName', 'username', 'role'] },
        ],
        order: [['updatedAt', 'DESC']],
        limit: 10,
      }),
      Assignment.findAll({
        include: [
          { model: Asset, where: { collegeId }, required: true, attributes: ['id', 'name', 'assetCode', 'departmentId', 'department'] },
          { model: User, required: false, attributes: ['id', 'fullName', 'username', 'role', 'department'] },
        ],
        order: [['updatedAt', 'DESC']],
        limit: 10,
      }),
      Transfer.findAll({
        include: [{ model: Asset, where: { collegeId }, required: true, attributes: ['id', 'name', 'assetCode'] }],
        order: [['updatedAt', 'DESC']],
        limit: 10,
      }),
      AssetReturn.findAll({
        include: [
          { model: Asset, where: { collegeId }, required: true, attributes: ['id', 'name', 'assetCode', 'departmentId', 'department'] },
          { model: User, as: 'Requester', required: false, attributes: ['id', 'fullName', 'username', 'role'] },
        ],
        order: [['updatedAt', 'DESC']],
        limit: 10,
      }),
      Maintenance.findAll({
        include: [{ model: Asset, where: { collegeId }, required: true, attributes: ['id', 'name', 'assetCode', 'departmentId', 'department'] }],
        order: [['updatedAt', 'DESC']],
        limit: 10,
      }),
      VerificationItem.findAll({
        include: [
          { model: VerificationSession, where: { collegeId }, required: true, attributes: ['id', 'name', 'status'] },
          { model: Asset, where: { collegeId }, required: true, attributes: ['id', 'name', 'assetCode'] },
        ],
        order: [['updatedAt', 'DESC']],
        limit: 20,
      }),
    ]);

    const userById = new Map(staff.map((user) => [Number(user.id), user]));
    const auditLogs = await AuditLog.findAll({
      where: { userId: staff.map((user) => user.id) },
      order: [['createdAt', 'DESC']],
      limit: 10,
    });

    const statusMap = new Map();
    for (const asset of assets) {
      const key = normalizeStatus(asset.status) || 'unknown';
      statusMap.set(key, (statusMap.get(key) || 0) + 1);
    }

    const assetStatus = Array.from(statusMap.entries()).map(([label, value]) => ({ label: label.replace(/-/g, ' '), value }));
    const departmentDistribution = departments.map((department) => {
      const rows = assets.filter((asset) => Number(asset.departmentId) === Number(department.id) || getDisplayName(asset.department) === getDisplayName(department.name));
      const summary = rows.reduce((result, asset) => {
        const status = normalizeStatus(asset.status);
        if (status === 'available') result.available += 1;
        if (['assigned', 'in-use', 'issued', 'allocated'].includes(status)) result.assigned += 1;
        if (['maintenance', 'under-maintenance', 'in-repair', 'repair'].includes(status)) result.maintenance += 1;
        if (['missing', 'lost'].includes(status)) result.missing += 1;
        result.totalValue += Number(asset.currentValue || 0);
        return result;
      }, { available: 0, assigned: 0, maintenance: 0, missing: 0, totalValue: 0 });

      return {
        id: department.id,
        name: department.name,
        totalAssets: rows.length,
        available: summary.available,
        assigned: summary.assigned,
        maintenance: summary.maintenance,
        missing: summary.missing,
        totalValue: summary.totalValue,
      };
    });

    const pendingRequests = pendingApprovals.map((request) => ({
      id: request.id,
      requestId: request.id,
      department: request.Department?.name || 'Unknown department',
      item: request.item || request.Asset?.name || 'Asset request',
      quantity: Number(request.quantity || 0),
      status: request.status,
      date: request.updatedAt || request.createdAt,
      priority: request.priority || 'medium',
      asset: request.Asset ? { id: request.Asset.id, name: request.Asset.name, assetCode: request.Asset.assetCode } : null,
    }));

    const recentAssignments = assignmentRows.map((assignment) => ({
      id: assignment.id,
      asset: assignment.Asset?.name || `Asset ${assignment.assetId}`,
      assignedTo: assignment.User?.fullName || assignment.User?.username || 'Unknown staff',
      department: assignment.Asset?.department || assignment.Asset?.DepartmentRecord?.name || 'Unknown department',
      date: assignment.updatedAt || assignment.createdAt,
      status: assignment.status || 'active',
    }));

    const recentTransfers = transferRows.map((transfer) => ({
      id: transfer.id,
      asset: transfer.Asset?.name || `Asset ${transfer.assetId}`,
      fromDepartment: transfer.sourceDepartment || 'Unknown',
      toDepartment: transfer.destinationDepartment || 'Unknown',
      date: transfer.transferDate || transfer.updatedAt || transfer.createdAt,
      status: transfer.status || 'Pending',
    }));

    const recentReturns = returnRows.map((returnRecord) => ({
      id: returnRecord.id,
      asset: returnRecord.Asset?.name || `Asset ${returnRecord.assetId}`,
      returnedBy: returnRecord.Requester?.fullName || returnRecord.Requester?.username || 'Unknown user',
      department: returnRecord.Asset?.department || 'Unknown department',
      date: returnRecord.requestedAt || returnRecord.updatedAt || returnRecord.createdAt,
      condition: returnRecord.condition || 'Good',
      status: returnRecord.status || 'Requested',
    }));

    const maintenanceSummary = {
      total: maintenanceRows.length,
      open: maintenanceRows.filter((record) => ['pending', 'in-progress', 'approved', 'scheduled', 'open'].includes(normalizeStatus(record.status))).length,
      completed: maintenanceRows.filter((record) => ['completed', 'resolved', 'closed'].includes(normalizeStatus(record.status))).length,
    };

    const verificationSummary = {
      total: verificationItems.length,
      pending: verificationItems.filter((item) => ['needs-review', 'needs_review', 'needsreview', 'pending'].includes(normalizeStatus(item.state))).length,
      verified: verificationItems.filter((item) => normalizeStatus(item.state) === 'verified').length,
    };

    const recentActivity = [
      ...auditLogs.map((item) => ({
        type: item.action || 'Audit activity',
        description: item.details || item.entity || 'College record updated',
        actor: userById.get(Number(item.userId)) ? (userById.get(Number(item.userId)).fullName || userById.get(Number(item.userId)).username) : 'System',
        timestamp: item.createdAt,
        status: 'recorded',
      })),
      ...pendingApprovals.map((item) => ({
        type: 'Request',
        description: `${item.item || 'Asset request'} is pending review`,
        actor: item.Requester?.fullName || item.Requester?.username || 'Unknown',
        timestamp: item.updatedAt || item.createdAt,
        status: item.status,
      })),
      ...maintenanceRows.map((item) => ({
        type: 'Maintenance',
        description: item.title || `Maintenance for ${item.Asset?.name || 'asset'}`,
        actor: 'College maintenance team',
        timestamp: item.updatedAt || item.createdAt,
        status: item.status,
      })),
      ...transferRows.map((item) => ({
        type: 'Transfer',
        description: `${item.Asset?.name || `Asset ${item.assetId}`} transferred to ${item.destinationDepartment || 'another department'}`,
        actor: 'Transfer workflow',
        timestamp: item.updatedAt || item.createdAt,
        status: item.status,
      })),
      ...returnRows.map((item) => ({
        type: 'Return',
        description: `${item.Asset?.name || `Asset ${item.assetId}`} return recorded`,
        actor: item.Requester?.fullName || item.Requester?.username || 'User',
        timestamp: item.updatedAt || item.createdAt,
        status: item.status,
      })),
    ].sort((left, right) => new Date(right.timestamp || 0) - new Date(left.timestamp || 0)).slice(0, 12);

    const totalAssignedAssets = new Set(assignmentRows.filter((record) => String(record.status || '').toLowerCase() !== 'cancelled').map((record) => Number(record.assetId)).filter(Boolean)).size;
    const availableAssets = assets.filter((asset) => ['available', 'ready', 'idle'].includes(normalizeStatus(asset.status))).length;
    const maintenanceAssets = assets.filter((asset) => ['maintenance', 'under-maintenance', 'in-repair', 'repair'].includes(normalizeStatus(asset.status))).length;
    const verificationRequired = verificationItems.filter((item) => ['needs-review', 'needs_review', 'needsreview', 'pending', 'missing', 'wrong-location', 'damaged', 'unidentified'].includes(normalizeStatus(item.state))).length;

    const responseData = {
      college: {
        id: college?.id || collegeId,
        name: college?.collegeName || 'College',
        code: college?.collegeCode || 'N/A',
        manager: college?.managerId ? (userById.get(Number(college.managerId))?.fullName || 'Not available') : 'Not available',
      },
      summary: {
        totalAssets: assets.length,
        availableAssets,
        assignedAssets: totalAssignedAssets,
        maintenanceAssets,
        departments: departments.length,
        staff: staff.length,
        pendingRequests: pendingRequests.length,
        verificationRequired,
      },
      assetStatus,
      departmentDistribution,
      pendingRequests,
      recentAssignments,
      recentTransfers,
      recentReturns,
      maintenance: maintenanceSummary,
      verification: verificationSummary,
      recentActivity,
    };

    res.json({ success: true, data: responseData });
  } catch (error) {
    next(error);
  }
};

const buildDateRangeWhere = (dateField, dateFrom, dateTo, baseWhere = {}) => {
  const where = { ...baseWhere };
  if (!dateFrom && !dateTo) return where;
  where[dateField] = {};
  if (dateFrom) where[dateField][Op.gte] = new Date(dateFrom);
  if (dateTo) {
    const endDate = new Date(dateTo);
    endDate.setHours(23, 59, 59, 999);
    where[dateField][Op.lte] = endDate;
  }
  return where;
};

const buildTrendSeries = async (model, where, dateField = 'createdAt', include = []) => {
  const rows = await model.findAll({
    where,
    include,
    attributes: [[literal(`DATE(${dateField})`), 'period'], [fn('COUNT', col('id')), 'count']],
    group: [literal(`DATE(${dateField})`)],
    order: [[literal(`DATE(${dateField})`), 'ASC']],
    raw: true,
  });
  return rows.map((row) => ({ period: row.period, count: Number(row.count || 0) }));
};

const getCollegeAssetAnalytics = async (req, res, next) => {
  try {
    const collegeId = Number(req.organizationScope?.collegeId);
    if (!collegeId) {
      return res.status(403).json({ success: false, message: 'College scope is not configured for this account' });
    }

    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;
    const search = String(req.query.search || '').trim();
    const departmentId = req.query.departmentId ? Number(req.query.departmentId) : null;
    const category = String(req.query.categoryId || req.query.category || '').trim();
    const status = String(req.query.status || '').trim();
    const condition = String(req.query.condition || '').trim();
    const location = String(req.query.locationId || req.query.location || '').trim();
    const dateFrom = String(req.query.dateFrom || '').trim();
    const dateTo = String(req.query.dateTo || '').trim();

    if (dateFrom && Number.isNaN(Date.parse(dateFrom))) {
      return res.status(422).json({ success: false, message: 'Date from is invalid' });
    }
    if (dateTo && Number.isNaN(Date.parse(dateTo))) {
      return res.status(422).json({ success: false, message: 'Date to is invalid' });
    }
    if (dateFrom && dateTo && new Date(dateFrom) > new Date(dateTo)) {
      return res.status(422).json({ success: false, message: 'Date from must be before date to' });
    }

    const departments = await Department.findAll({ where: { collegeId }, attributes: ['id', 'name', 'code'], order: [['name', 'ASC']], raw: true });
    const departmentIds = new Set(departments.map((department) => Number(department.id)));
    if (departmentId && !departmentIds.has(departmentId)) {
      return res.status(400).json({ success: false, message: 'Department is not part of your college' });
    }

    const assetWhere = { collegeId };
    if (departmentId) assetWhere.departmentId = departmentId;
    if (category) assetWhere.category = category;
    if (status) assetWhere.status = status;
    if (condition) assetWhere.condition = condition;
    if (location) assetWhere.location = { [Op.like]: `%${location}%` };
    if (search) {
      assetWhere[Op.or] = [
        { assetCode: { [Op.like]: `%${search}%` } },
        { name: { [Op.like]: `%${search}%` } },
        { serialNumber: { [Op.like]: `%${search}%` } },
        { category: { [Op.like]: `%${search}%` } },
        { department: { [Op.like]: `%${search}%` } },
        { location: { [Op.like]: `%${search}%` } },
      ];
    }
    if (dateFrom || dateTo) {
      assetWhere.createdAt = {};
      if (dateFrom) assetWhere.createdAt[Op.gte] = new Date(dateFrom);
      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        assetWhere.createdAt[Op.lte] = endDate;
      }
    }

    const [assets, totalAssets, statuses, conditions, assetCategoryRows, assetLocationRows, assetDepartmentRows, assignmentRows, activeAssignments, maintenanceRows, maintenanceByStatus, verificationRows, verificationByState, transferRows, returnRows, assetValue, assignmentTrend, maintenanceTrend, transferTrend, returnTrend, assetAdditionsTrend] = await Promise.all([
      Asset.findAll({
        where: assetWhere,
        include: [{ model: Department, as: 'DepartmentRecord', required: false, attributes: ['id', 'name', 'code'] }],
        order: [['updatedAt', 'DESC'], ['name', 'ASC']],
        raw: true,
      }),
      Asset.count({ where: assetWhere }),
      Asset.findAll({ where: assetWhere, attributes: ['status', [fn('COUNT', col('id')), 'count']], group: ['status'], raw: true }),
      Asset.findAll({ where: assetWhere, attributes: ['condition', [fn('COUNT', col('id')), 'count']], group: ['condition'], raw: true }),
      Asset.findAll({ where: assetWhere, attributes: ['category', [fn('COUNT', col('id')), 'count'], [fn('SUM', col('currentValue')), 'value']], group: ['category'], raw: true }),
      Asset.findAll({ where: assetWhere, attributes: ['location', [fn('COUNT', col('id')), 'count']], group: ['location'], raw: true }),
      Asset.findAll({ where: assetWhere, attributes: ['departmentId', 'department', [fn('COUNT', col('id')), 'count'], [fn('SUM', col('currentValue')), 'value']], group: ['departmentId', 'department'], raw: true }),
      Assignment.findAll({
        where: { status: { [Op.in]: ['active', 'assigned', 'in_use', 'issued'] } },
        include: [{ model: Asset, required: true, where: assetWhere, attributes: ['id'] }],
        attributes: ['id', 'assetId', 'status', 'assignedTo', 'updatedAt'],
        order: [['updatedAt', 'DESC']],
        raw: true,
      }),
      Assignment.count({
        where: { status: { [Op.in]: ['active', 'assigned', 'in_use', 'issued'] } },
        include: [{ model: Asset, required: true, where: assetWhere, attributes: [] }],
      }),
      Maintenance.findAll({
        include: [{ model: Asset, required: true, where: assetWhere, attributes: ['id'] }],
        attributes: ['id', 'status', 'assetId', 'createdAt'],
        raw: true,
      }),
      Maintenance.findAll({
        include: [{ model: Asset, required: true, where: assetWhere, attributes: ['id'] }],
        attributes: ['status', [fn('COUNT', col('id')), 'count']],
        group: ['status'],
        raw: true,
      }),
      VerificationItem.findAll({
        include: [{ model: Asset, required: true, where: assetWhere, attributes: ['id'] }],
        attributes: ['state', [fn('COUNT', col('id')), 'count']],
        group: ['state'],
        raw: true,
      }),
      VerificationItem.findAll({
        include: [{ model: Asset, required: true, where: assetWhere, attributes: ['id'] }],
        attributes: ['state', [fn('COUNT', col('id')), 'count']],
        group: ['state'],
        raw: true,
      }),
      Transfer.findAll({
        include: [{ model: Asset, required: true, where: assetWhere, attributes: ['id'] }],
        attributes: ['id', 'status', 'transferDate', 'createdAt', 'sourceDepartment', 'destinationDepartment'],
        raw: true,
      }),
      AssetReturn.findAll({
        where: { collegeId },
        include: [{ model: Asset, required: true, where: assetWhere, attributes: ['id'] }],
        attributes: ['id', 'status', 'requestedAt', 'createdAt', 'condition'],
        raw: true,
      }),
      Asset.sum('currentValue', { where: assetWhere }) || Asset.sum('purchasePrice', { where: assetWhere }) || 0,
      buildTrendSeries(Assignment, buildDateRangeWhere('createdAt', dateFrom, dateTo, { status: { [Op.in]: ['active', 'assigned', 'in_use', 'issued'] } }), 'createdAt', [{ model: Asset, required: true, where: assetWhere, attributes: [] }]),
      buildTrendSeries(Maintenance, buildDateRangeWhere('createdAt', dateFrom, dateTo), 'createdAt', [{ model: Asset, required: true, where: assetWhere, attributes: [] }]),
      buildTrendSeries(Transfer, buildDateRangeWhere('transferDate', dateFrom, dateTo), 'transferDate', [{ model: Asset, required: true, where: assetWhere, attributes: [] }]),
      buildTrendSeries(AssetReturn, buildDateRangeWhere('requestedAt', dateFrom, dateTo), 'requestedAt', [{ model: Asset, required: true, where: assetWhere, attributes: [] }]),
      buildTrendSeries(Asset, buildDateRangeWhere('createdAt', dateFrom, dateTo, assetWhere), 'createdAt'),
    ]);

    const assetIdSet = new Set(assets.map((asset) => Number(asset.id)));
    const assignedAssetIds = new Set(assignmentRows.filter((assignment) => assetIdSet.has(Number(assignment.assetId))).map((assignment) => Number(assignment.assetId)));
    const openMaintenanceIds = new Set(maintenanceRows.filter((row) => !['completed', 'resolved', 'closed'].includes(String(row.status || '').trim().toLowerCase())).map((row) => Number(row.assetId)).filter(Boolean));
    const damagedCount = assets.filter((asset) => ['damaged', 'poor', 'critical'].includes(String(asset.condition || '').trim().toLowerCase())).length;
    const missingCount = assets.filter((asset) => ['missing', 'lost', 'not found', 'not-found'].includes(String(asset.status || '').trim().toLowerCase())).length;
    const disposedCount = assets.filter((asset) => ['disposed', 'retired', 'decommissioned'].includes(String(asset.status || '').trim().toLowerCase())).length;
    const availableCount = assets.filter((asset) => ['available', 'ready', 'idle'].includes(String(asset.status || '').trim().toLowerCase())).length;
    const activeCount = assets.filter((asset) => !['disposed', 'retired', 'decommissioned'].includes(String(asset.status || '').trim().toLowerCase())).length;

    const statusRows = statuses.map((row) => ({
      status: row.status || 'Unknown',
      count: Number(row.count || 0),
      percentage: totalAssets ? Number(((Number(row.count || 0) / totalAssets) * 100).toFixed(2)) : 0,
    }));

    const departmentRows = assetDepartmentRows.map((row) => {
      const name = row.department || row['DepartmentRecord.name'] || 'Unassigned';
      const departmentIdValue = Number(row.departmentId || 0);
      const assetIdsForDepartment = assets.filter((asset) => Number(asset.departmentId || 0) === departmentIdValue || String(asset.department || '').trim() === String(name).trim()).map((asset) => Number(asset.id));
      const assigned = assetIdsForDepartment.filter((assetId) => assignedAssetIds.has(assetId)).length;
      const available = assetIdsForDepartment.filter((assetId) => {
        const asset = assets.find((item) => Number(item.id) === assetId);
        return asset && ['available', 'ready', 'idle'].includes(String(asset.status || '').trim().toLowerCase());
      }).length;
      const maintenance = assetIdsForDepartment.filter((assetId) => openMaintenanceIds.has(assetId)).length;
      const damaged = assetIdsForDepartment.filter((assetId) => {
        const asset = assets.find((item) => Number(item.id) === assetId);
        return asset && ['damaged', 'poor', 'critical'].includes(String(asset.condition || '').trim().toLowerCase());
      }).length;
      const missing = assetIdsForDepartment.filter((assetId) => {
        const asset = assets.find((item) => Number(item.id) === assetId);
        return asset && ['missing', 'lost', 'not found', 'not-found'].includes(String(asset.status || '').trim().toLowerCase());
      }).length;
      return {
        department: name,
        totalAssets: assetIdsForDepartment.length,
        assigned,
        available,
        maintenance,
        damaged,
        missing,
      };
    }).filter((row) => row.totalAssets > 0);

    const categoryRows = assetCategoryRows.map((row) => ({
      category: row.category || 'Uncategorized',
      count: Number(row.count || 0),
      assigned: assets.filter((asset) => String(asset.category || '').trim() === String(row.category || '').trim() && assignedAssetIds.has(Number(asset.id))).length,
      available: assets.filter((asset) => String(asset.category || '').trim() === String(row.category || '').trim() && ['available', 'ready', 'idle'].includes(String(asset.status || '').trim().toLowerCase())).length,
      maintenance: assets.filter((asset) => String(asset.category || '').trim() === String(row.category || '').trim() && openMaintenanceIds.has(Number(asset.id))).length,
    }));

    const locationRows = assetLocationRows.map((row) => ({
      location: row.location || 'Unassigned',
      count: Number(row.count || 0),
      assigned: assets.filter((asset) => String(asset.location || '').trim() === String(row.location || '').trim() && assignedAssetIds.has(Number(asset.id))).length,
      available: assets.filter((asset) => String(asset.location || '').trim() === String(row.location || '').trim() && ['available', 'ready', 'idle'].includes(String(asset.status || '').trim().toLowerCase())).length,
      maintenance: assets.filter((asset) => String(asset.location || '').trim() === String(row.location || '').trim() && openMaintenanceIds.has(Number(asset.id))).length,
    }));

    const conditionRows = conditions.map((row) => ({
      condition: row.condition || 'Unknown',
      count: Number(row.count || 0),
      percentage: totalAssets ? Number(((Number(row.count || 0) / totalAssets) * 100).toFixed(2)) : 0,
    }));

    const assignmentRowsSummary = [
      { label: 'Assigned', count: assignedAssetIds.size },
      { label: 'Available', count: availableCount },
      { label: 'Unassigned', count: Math.max(0, totalAssets - assignedAssetIds.size) },
      { label: 'Returned', count: returnRows.filter((row) => ['returned', 'received', 'completed'].includes(String(row.status || '').trim().toLowerCase())).length },
    ].map((row) => ({ ...row, percentage: totalAssets ? Number(((row.count / totalAssets) * 100).toFixed(2)) : 0 }));

    const maintenanceSummary = maintenanceByStatus.map((row) => ({ status: row.status || 'Unknown', count: Number(row.count || 0) }));
    const verificationSummary = (verificationRows || []).map((row) => ({ status: row.state || 'Unknown', count: Number(row.count || 0) }));

    const tableRows = assets.slice(offset, offset + limit).map((asset) => {
      const assignment = assignmentRows.find((row) => Number(row.assetId) === Number(asset.id) && assetIdSet.has(Number(row.assetId)));
      const maintenance = maintenanceRows.filter((row) => Number(row.assetId) === Number(asset.id)).sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0))[0];
      const latestVerification = verificationRows.filter((row) => row.Asset && Number(row.Asset.id) === Number(asset.id)).sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0))[0];
      return {
        id: asset.id,
        assetCode: asset.assetCode,
        assetName: asset.name,
        category: asset.category,
        department: asset.DepartmentRecord?.name || asset.department || 'Unassigned',
        location: asset.location,
        status: asset.status,
        condition: asset.condition,
        assignment: assignment ? 'Assigned' : 'Unassigned',
        purchaseDate: asset.purchaseDate,
        assetValue: Number(asset.currentValue || asset.purchasePrice || 0),
        lastUpdated: asset.updatedAt,
        assignedUser: assignment ? assignment.assignedTo : null,
        maintenanceStatus: maintenance ? maintenance.status : 'None',
        verificationStatus: latestVerification ? latestVerification.state : 'Not checked',
      };
    });

    const response = {
      success: true,
      data: {
        college: { id: collegeId, name: req.organizationScope.college?.collegeName || 'College' },
        filters: {
          departmentId: departmentId || '',
          categoryId: category || '',
          status: status || '',
          condition: condition || '',
          locationId: location || '',
          dateFrom: dateFrom || '',
          dateTo: dateTo || '',
          search: search || '',
        },
        summary: {
          totalAssets,
          activeAssets: activeCount,
          assignedAssets: assignedAssetIds.size,
          availableAssets: availableCount,
          underMaintenance: openMaintenanceIds.size,
          damagedAssets: damagedCount,
          missingAssets: missingCount,
          disposedAssets: disposedCount,
          totalAssetValue: Number(assetValue || 0),
        },
        distributions: {
          status: statusRows,
          departments: departmentRows,
          categories: categoryRows,
          locations: locationRows,
          conditions: conditionRows,
          assignment: assignmentRowsSummary,
          maintenance: maintenanceSummary,
          verification: verificationSummary,
        },
        trends: {
          assetsAddedOverTime: assetAdditionsTrend,
          assignmentsOverTime: assignmentTrend,
          maintenanceOverTime: maintenanceTrend,
          transfersOverTime: transferTrend,
          returnsOverTime: returnTrend,
        },
        table: {
          rows: tableRows,
          pagination: {
            page,
            limit,
            total: totalAssets,
            totalPages: Math.ceil(totalAssets / limit),
          },
        },
        departments,
      },
    };

    return res.json(response);
  } catch (error) {
    return next(error);
  }
};

const pagination = (query, defaultLimit = 25) => {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || defaultLimit));
  return { page, limit, offset: (page - 1) * limit };
};

const listCollegeVerification = async (req, res, next) => {
  try {
    const collegeId = Number(req.organizationScope?.collegeId);
    if (!collegeId) return res.status(403).json({ success: false, message: 'College scope is not configured for this account' });

    const { page, limit, offset } = pagination(req.query, 10);
    const search = String(req.query.search || '').trim();
    const departmentId = req.query.departmentId ? Number(req.query.departmentId) : null;
    const verificationStatus = String(req.query.status || '').trim();
    const assetStatus = String(req.query.assetStatus || '').trim();
    const location = String(req.query.locationId || req.query.location || '').trim();
    const departmentWhere = { collegeId };

    const departments = await Department.findAll({ where: departmentWhere, attributes: ['id', 'name', 'code'], order: [['name', 'ASC']], raw: true });
    const departmentIds = departments.map((department) => Number(department.id));
    if (departmentId && !departmentIds.includes(departmentId)) {
      return res.status(400).json({ success: false, message: 'Department is not part of your college' });
    }

    const sessionWhere = { collegeId };
    if (departmentId) sessionWhere.departmentId = departmentId;
    if (verificationStatus) sessionWhere.status = verificationStatus;
    if (search) {
      sessionWhere[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { '$Department.name$': { [Op.like]: `%${search}%` } },
        { '$Starter.fullName$': { [Op.like]: `%${search}%` } },
      ];
    }

    const assetWhere = { collegeId };
    if (assetStatus) assetWhere.status = assetStatus;
    if (location) assetWhere.location = { [Op.like]: `%${location}%` };
    if (search) {
      assetWhere[Op.or] = [
        { assetCode: { [Op.like]: `%${search}%` } },
        { name: { [Op.like]: `%${search}%` } },
        { serialNumber: { [Op.like]: `%${search}%` } },
        { rfidTag: { [Op.like]: `%${search}%` } },
      ];
    }

    const sessions = await VerificationSession.findAndCountAll({
      where: sessionWhere,
      include: [
        { model: Department, attributes: ['id', 'name', 'code'], required: false },
        { model: User, as: 'Starter', attributes: ['id', 'fullName', 'username'], required: false },
        {
          model: VerificationItem,
          required: false,
          include: [{ model: Asset, where: assetWhere, required: false, attributes: ['id', 'name', 'assetCode', 'serialNumber', 'rfidTag', 'status', 'condition', 'departmentId', 'location', 'collegeId'] }],
        },
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    const sessionRows = sessions.rows.map((session) => {
      const data = session.toJSON();
      const items = Array.isArray(data.VerificationItems) ? data.VerificationItems : [];
      const pendingCount = items.filter((item) => ['needs_review', 'pending'].includes(String(item.state || '').trim().toLowerCase())).length;
      const verifiedCount = items.filter((item) => String(item.state || '').trim().toLowerCase() === 'verified').length;
      const notFoundCount = items.filter((item) => String(item.state || '').trim().toLowerCase() === 'missing').length;
      const discrepancyCount = items.filter((item) => ['wrong_location', 'damaged', 'unidentified', 'missing', 'needs_review'].includes(String(item.state || '').trim().toLowerCase())).length;
      return {
        ...data,
        department: data.Department || null,
        startedBy: data.Starter || null,
        totalItems: items.length,
        verified: verifiedCount,
        pending: pendingCount,
        notFound: notFoundCount,
        discrepancies: discrepancyCount,
      };
    });

    const assets = sessionRows.flatMap((session) => (session.VerificationItems || []).map((item) => ({
      id: item.Asset?.id || item.assetId,
      sessionId: session.id,
      sessionName: session.name,
      sessionStatus: session.status,
      name: item.Asset?.name || '',
      assetCode: item.Asset?.assetCode || '',
      serialNumber: item.Asset?.serialNumber || '',
      rfidTag: item.Asset?.rfidTag || '',
      category: item.Asset?.category || '',
      departmentId: item.Asset?.departmentId || null,
      department: session.Department || null,
      location: item.Asset?.location || '',
      assetStatus: item.Asset?.status || '',
      condition: item.Asset?.condition || '',
      verificationStatus: item.state,
      notes: item.notes || '',
      verificationDate: item.updatedAt || item.createdAt || session.updatedAt || session.createdAt,
      verifiedBy: session.Starter || null,
    })));

    const allItems = await VerificationItem.findAll({
      include: [
        { model: VerificationSession, where: { collegeId }, required: true, attributes: ['id', 'status'] },
        { model: Asset, where: { collegeId }, required: true, attributes: ['id', 'status', 'location', 'condition'] },
      ],
      attributes: ['id', 'state'],
    });

    const totalAssets = await Asset.count({ where: { collegeId } });
    const summary = {
      totalAssets,
      verified: allItems.filter((item) => String(item.state || '').trim().toLowerCase() === 'verified').length,
      pending: allItems.filter((item) => ['needs_review', 'pending'].includes(String(item.state || '').trim().toLowerCase())).length,
      notFound: allItems.filter((item) => String(item.state || '').trim().toLowerCase() === 'missing').length,
      discrepancies: allItems.filter((item) => ['wrong_location', 'damaged', 'unidentified', 'missing', 'needs_review'].includes(String(item.state || '').trim().toLowerCase())).length,
      sessions: await VerificationSession.count({ where: { collegeId } }),
    };

    const filters = {
      departments,
      statuses: ['draft', 'in_progress', 'submitted', 'finalized'],
      locations: [...new Set((await Asset.findAll({ where: { collegeId, location: { [Op.ne]: '' } }, attributes: ['location'], raw: true })).map((row) => row.location).filter(Boolean))],
      assetStatuses: [...new Set((await Asset.findAll({ where: { collegeId }, attributes: ['status'], raw: true })).map((row) => row.status).filter(Boolean))],
    };

    res.json({
      success: true,
      data: {
        college: { id: collegeId, name: req.organizationScope.college?.collegeName || 'College' },
        summary,
        sessions: sessionRows,
        assets,
        filters,
        pagination: {
          page,
          limit,
          total: sessions.count,
          totalPages: Math.ceil(sessions.count / limit),
          pages: Math.ceil(sessions.count / limit) || 1,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

const getCollegeProfile = async (req, res, next) => {
  try {
    const college = req.organizationScope.college;
    const [departments, staff, assets, manager] = await Promise.all([
      Department.count({ where: { collegeId: college.id } }),
      User.count({ where: { collegeId: college.id } }),
      Asset.count({ where: { collegeId: college.id } }),
      college.managerId ? User.findByPk(college.managerId, { attributes: ['id', 'fullName', 'username', 'email', 'phone'] }) : null,
    ]);
    res.json({ success: true, data: { ...college.toJSON(), departments, staff, assets, manager: manager ? { id: manager.id, name: manager.fullName || manager.username, email: manager.email, phone: manager.phone } : null } });
  } catch (error) { next(error); }
};

const updateCollegeProfile = async (req, res, next) => {
  try {
    const college = await College.findByPk(req.organizationScope.collegeId);
    if (!college) return res.status(404).json({ success: false, message: 'College profile information is not available' });
    const name = String(req.body.collegeName ?? req.body.name ?? college.collegeName).trim();
    if (!name) return res.status(400).json({ success: false, message: 'College name is required' });
    const editableFields = {
      collegeName: name,
      description: String(req.body.description ?? college.description ?? '').trim(),
      location: String(req.body.location ?? college.location ?? '').trim(),
      phone: String(req.body.phone ?? college.phone ?? '').trim(),
      email: String(req.body.email ?? college.email ?? '').trim(),
    };
    const before = college.toJSON();
    await college.update(editableFields);
    await AuditLog.create({ userId: req.user.id, action: 'COLLEGE_PROFILE_UPDATED', entity: `college:${college.id}`, details: JSON.stringify({ before, after: college.toJSON() }) });
    res.json({ success: true, message: 'College profile updated successfully', data: college });
  } catch (error) { next(error); }
};

const listCollegeDepartments = async (req, res, next) => {
  try {
    const { page, limit, offset } = pagination(req.query);
    const collegeId = req.organizationScope.collegeId;
    const where = { collegeId };
    const search = String(req.query.search || '').trim();
    const status = String(req.query.status || '').trim().toLowerCase();
    if (search) where[Op.or] = [
      { name: { [Op.like]: `%${search}%` } },
      { code: { [Op.like]: `%${search}%` } },
      { description: { [Op.like]: `%${search}%` } },
      { '$Head.fullName$': { [Op.like]: `%${search}%` } },
      { '$Head.username$': { [Op.like]: `%${search}%` } },
    ];
    if (status && ['active', 'inactive'].includes(status)) where.status = status;

    const scopedWhere = { collegeId };
    const [result, total, active, inactive, staffCounts, assetCounts] = await Promise.all([
      Department.findAndCountAll({
        where,
        include: [{ model: User, as: 'Head', attributes: ['id', 'fullName', 'username', 'email'], required: false }],
        order: [['name', 'ASC']],
        limit,
        offset,
      }),
      Department.count({ where: scopedWhere }),
      Department.count({ where: { ...scopedWhere, status: 'active' } }),
      Department.count({ where: { ...scopedWhere, status: 'inactive' } }),
      User.findAll({ where: { collegeId, departmentId: { [Op.ne]: null } }, attributes: ['departmentId', [fn('COUNT', col('id')), 'count']], group: ['departmentId'], raw: true }),
      Asset.findAll({ where: { collegeId, departmentId: { [Op.ne]: null } }, attributes: ['departmentId', [fn('COUNT', col('id')), 'count']], group: ['departmentId'], raw: true }),
    ]);
    const countsByDepartment = (rows) => new Map(rows.map((row) => [String(row.departmentId), Number(row.count || 0)]));
    const staffByDepartment = countsByDepartment(staffCounts);
    const assetsByDepartment = countsByDepartment(assetCounts);
    const data = result.rows.map((row) => ({
      ...row.toJSON(),
      departmentHead: row.Head || null,
      staffCount: staffByDepartment.get(String(row.id)) || 0,
      assetCount: assetsByDepartment.get(String(row.id)) || 0,
    }));
    res.json({ success: true, data, summary: { total, active, inactive }, pagination: { page, limit, total: result.count, pages: Math.ceil(result.count / limit), totalPages: Math.ceil(result.count / limit) } });
  } catch (error) { next(error); }
};

const getCollegeDepartmentOverview = async (req, res, next) => {
  try {
    const collegeId = Number(req.organizationScope?.collegeId);
    if (!collegeId) return res.status(403).json({ success: false, message: 'College scope is not configured for this account' });

    const search = String(req.query.search || '').trim();
    const status = String(req.query.status || '').trim().toLowerCase();
    const departmentWhere = { collegeId };
    if (status) departmentWhere.status = status;
    if (search) departmentWhere[Op.or] = [
      { name: { [Op.like]: `%${search}%` } },
      { code: { [Op.like]: `%${search}%` } },
      { '$Head.fullName$': { [Op.like]: `%${search}%` } },
      { '$Head.username$': { [Op.like]: `%${search}%` } },
    ];

    const departments = await Department.findAll({
      where: departmentWhere,
      include: [{ model: User, as: 'Head', attributes: ['id', 'fullName', 'username'], required: false }],
      order: [['name', 'ASC']],
    });
    const departmentIds = departments.map((department) => department.id);
    const departmentScope = departmentIds.length ? { collegeId, departmentId: { [Op.in]: departmentIds } } : { collegeId, departmentId: { [Op.in]: [-1] } };
    const [staffRows, assetRows, college, activityRows] = await Promise.all([
      User.findAll({ where: departmentScope, attributes: ['departmentId', [fn('COUNT', col('id')), 'count']], group: ['departmentId'], raw: true }),
      Asset.findAll({ where: departmentScope, attributes: ['departmentId', 'status', 'currentValue', [fn('COUNT', col('id')), 'count']], group: ['departmentId', 'status', 'currentValue'], raw: true }),
      College.findByPk(collegeId, { attributes: ['id', 'collegeName', 'collegeCode'] }),
      departmentIds.length ? AuditLog.findAll({
        where: { entity: { [Op.in]: departmentIds.map((id) => `department:${id}`) }, action: { [Op.in]: ['DEPARTMENT_CREATED', 'DEPARTMENT_UPDATED', 'DEPARTMENT_ACTIVATED', 'DEPARTMENT_DEACTIVATED', 'DEPARTMENT_DELETED'] } },
        include: [{ model: User, attributes: ['id', 'fullName', 'username'], required: false }],
        order: [['createdAt', 'DESC']],
        limit: 10,
      }) : [],
    ]);

    const countMap = (rows) => new Map(rows.map((row) => [String(row.departmentId), Number(row.count || 0)]));
    const staffByDepartment = countMap(staffRows);
    const assetsByDepartment = new Map();
    const valueByDepartment = new Map();
    const assetStatusMap = new Map();
    for (const row of assetRows) {
      const departmentKey = String(row.departmentId);
      assetsByDepartment.set(departmentKey, (assetsByDepartment.get(departmentKey) || 0) + Number(row.count || 0));
      valueByDepartment.set(departmentKey, (valueByDepartment.get(departmentKey) || 0) + (Number(row.currentValue || 0) * Number(row.count || 0)));
      const statusKey = String(row.status || 'unknown').trim() || 'unknown';
      assetStatusMap.set(statusKey, (assetStatusMap.get(statusKey) || 0) + Number(row.count || 0));
    }
    const distribution = departments.map((department) => {
      const row = department.toJSON();
      return {
        id: department.id,
        name: department.name,
        code: department.code,
        description: department.description,
        status: department.status,
        head: row.Head || null,
        staffCount: staffByDepartment.get(String(department.id)) || 0,
        assetCount: assetsByDepartment.get(String(department.id)) || 0,
        assetValue: valueByDepartment.get(String(department.id)) || 0,
        createdAt: department.createdAt,
        updatedAt: department.updatedAt,
      };
    });
    const totalStaff = distribution.reduce((total, department) => total + department.staffCount, 0);
    const totalAssets = distribution.reduce((total, department) => total + department.assetCount, 0);
    const statusDistribution = distribution.reduce((result, department) => {
      result[department.status] = (result[department.status] || 0) + 1;
      return result;
    }, {});
    const assetDistribution = distribution.map(({ id, name, code, assetCount, assetValue }) => ({ id, name, code, count: assetCount, value: assetValue }));
    const staffDistribution = distribution.map(({ id, name, code, staffCount }) => ({ id, name, code, count: staffCount, percentage: totalStaff ? Number(((staffCount / totalStaff) * 100).toFixed(1)) : 0 }));
    const recentActivity = activityRows.map((item) => ({
      id: item.id,
      action: item.action,
      entity: item.entity,
      details: item.details,
      actor: item.User?.fullName || item.User?.username || 'System',
      timestamp: item.createdAt,
    }));

    res.json({
      success: true,
      data: {
        college: college ? { id: college.id, name: college.collegeName, code: college.collegeCode } : null,
        summary: {
          totalDepartments: departments.length,
          activeDepartments: distribution.filter((department) => department.status === 'active').length,
          inactiveDepartments: distribution.filter((department) => department.status === 'inactive').length,
          departmentsWithAssets: distribution.filter((department) => department.assetCount > 0).length,
          departmentsWithoutAssets: distribution.filter((department) => department.assetCount === 0).length,
          totalStaff,
          totalAssets,
        },
        departments: distribution,
        assetDistribution,
        staffDistribution,
        statusDistribution,
        recentActivity,
        assetStatuses: Array.from(assetStatusMap.entries()).map(([label, count]) => ({ label, count })),
      },
    });
  } catch (error) {
    next(error);
  }
};

const getCollegeDepartmentPerformance = async (req, res, next) => {
  try {
    const collegeId = Number(req.organizationScope?.collegeId);
    if (!collegeId) {
      return res.status(403).json({ success: false, message: 'College scope is not configured for this account' });
    }

    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 10));
    const offset = (page - 1) * limit;
    const search = String(req.query.search || '').trim();
    const rawQueryFilters = {
      departmentId: Number(req.query.departmentId),
      status: String(req.query.status || ''),
    };
    const departmentId = req.query.departmentId ? rawQueryFilters.departmentId : null;
    const status = String(rawQueryFilters.status || '').trim().toLowerCase();
    const sortBy = ['name', 'assetcount', 'requestcount', 'maintenancecount', 'lastactivity'].includes(String(req.query.sortBy || '').toLowerCase()) ? String(req.query.sortBy || '').toLowerCase() : 'name';
    const sortOrder = String(req.query.sortOrder || 'asc').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    const departmentWhere = { collegeId };
    if (status && ['active', 'inactive'].includes(status)) departmentWhere.status = status;
    if (departmentId) {
      const validDepartment = await Department.findOne({ where: { id: departmentId, collegeId }, attributes: ['id'] });
      if (!validDepartment) {
        return res.status(400).json({ success: false, message: 'Department is not part of your college' });
      }
      departmentWhere.id = departmentId;
    }
    if (search) {
      departmentWhere[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { code: { [Op.like]: `%${search}%` } },
        { '$Head.fullName$': { [Op.like]: `%${search}%` } },
        { '$Head.username$': { [Op.like]: `%${search}%` } },
      ];
    }

    const departments = await Department.findAll({
      where: departmentWhere,
      include: [{ model: User, as: 'Head', attributes: ['id', 'fullName', 'username'], required: false }],
      order: [['name', 'ASC']],
    });
    const departmentIds = departments.map((department) => Number(department.id));
    const scopedDepartmentIds = departmentIds.length ? departmentIds : [-1];

    const [staffRows, assetRows, approvalRows, transferRows, returnRows, maintenanceRows, verificationSessions, relatedAuditLogs] = await Promise.all([
      User.findAll({
        where: { collegeId, departmentId: { [Op.in]: scopedDepartmentIds } },
        attributes: ['departmentId', [fn('COUNT', col('id')), 'count']],
        group: ['departmentId'],
        raw: true,
      }),
      Asset.findAll({
        where: { collegeId, departmentId: { [Op.in]: scopedDepartmentIds } },
        attributes: ['id', 'departmentId', 'status', 'updatedAt'],
        raw: true,
      }),
      Approval.findAll({
        where: { departmentId: { [Op.in]: scopedDepartmentIds } },
        attributes: ['departmentId', 'status', 'updatedAt'],
        raw: true,
      }),
      Transfer.findAll({
        where: {
          [Op.or]: [
            { sourceDepartmentId: { [Op.in]: scopedDepartmentIds } },
            { destinationDepartmentId: { [Op.in]: scopedDepartmentIds } },
          ],
        },
        attributes: ['id', 'sourceDepartmentId', 'destinationDepartmentId', 'status', 'updatedAt'],
        raw: true,
      }),
      AssetReturn.findAll({
        where: { collegeId, departmentId: { [Op.in]: scopedDepartmentIds } },
        attributes: ['departmentId', 'status', 'updatedAt'],
        raw: true,
      }),
      Maintenance.findAll({
        include: [{ model: Asset, where: { collegeId }, required: true, attributes: ['id', 'departmentId'] }],
        attributes: ['id', 'status', 'updatedAt'],
        raw: true,
      }),
      VerificationSession.findAll({
        where: { collegeId, departmentId: { [Op.in]: scopedDepartmentIds } },
        attributes: ['departmentId', 'status', 'updatedAt'],
        raw: true,
      }),
      AuditLog.findAll({
        where: { entity: { [Op.like]: 'department:%' } },
        attributes: ['id', 'entity', 'action', 'details', 'createdAt', 'updatedAt'],
        order: [['createdAt', 'DESC']],
        raw: true,
      }),
    ]);

    const normalizeStatus = (value) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const staffByDepartment = new Map(staffRows.map((row) => [Number(row.departmentId), Number(row.count || 0)]));
    const allAssetCounts = new Map();
    const allAssetStatusCounts = new Map();
    for (const asset of assetRows) {
      const departmentKey = Number(asset.departmentId);
      if (!departmentKey) continue;
      allAssetCounts.set(departmentKey, (allAssetCounts.get(departmentKey) || 0) + 1);
      const statusKey = normalizeStatus(asset.status) || 'unknown';
      const statusCountMap = allAssetStatusCounts.get(departmentKey) || new Map();
      statusCountMap.set(statusKey, (statusCountMap.get(statusKey) || 0) + 1);
      allAssetStatusCounts.set(departmentKey, statusCountMap);
    }

    const departmentMetrics = departments.map((department) => {
      const departmentIdValue = Number(department.id);
      const departmentAssetRows = assetRows.filter((asset) => Number(asset.departmentId) === departmentIdValue);
      const departmentApprovals = approvalRows.filter((row) => Number(row.departmentId) === departmentIdValue);
      const departmentTransfers = transferRows.filter((row) => Number(row.sourceDepartmentId) === departmentIdValue || Number(row.destinationDepartmentId) === departmentIdValue);
      const departmentReturns = returnRows.filter((row) => Number(row.departmentId) === departmentIdValue);
      const departmentMaintenance = maintenanceRows.filter((row) => Number(row['Asset.departmentId']) === departmentIdValue);
      const departmentVerification = verificationSessions.filter((row) => Number(row.departmentId) === departmentIdValue);
      const departmentAudit = relatedAuditLogs.filter((row) => {
        const entity = String(row.entity || '').trim();
        const parsedDepartmentId = Number(entity.replace(/^department:/, ''));
        return parsedDepartmentId === departmentIdValue;
      });

      const totalAssets = departmentAssetRows.length;
      const assignedAssets = departmentAssetRows.filter((asset) => {
        const normalized = normalizeStatus(asset.status);
        return ['assigned', 'in-use', 'issued', 'allocated'].includes(normalized);
      }).length;
      const availableAssets = departmentAssetRows.filter((asset) => ['available', 'ready', 'idle'].includes(normalizeStatus(asset.status))).length;
      const maintenanceAssets = departmentAssetRows.filter((asset) => ['maintenance', 'under-maintenance', 'in-repair', 'repair'].includes(normalizeStatus(asset.status))).length;
      const damagedAssets = departmentAssetRows.filter((asset) => ['damaged', 'poor', 'failed'].includes(normalizeStatus(asset.status))).length;
      const missingAssets = departmentAssetRows.filter((asset) => ['missing', 'lost', 'stolen'].includes(normalizeStatus(asset.status))).length;
      const pendingRequests = departmentApprovals.filter((entry) => normalizeStatus(entry.status) === 'pending').length;
      const approvedRequests = departmentApprovals.filter((entry) => normalizeStatus(entry.status) === 'approved').length;
      const rejectedRequests = departmentApprovals.filter((entry) => normalizeStatus(entry.status) === 'rejected').length;
      const cancelledRequests = departmentApprovals.filter((entry) => normalizeStatus(entry.status) === 'cancelled').length;
      const transferCount = departmentTransfers.length;
      const returnCount = departmentReturns.length;
      const maintenanceCount = departmentMaintenance.length;
      const verificationCount = departmentVerification.length;
      const verifiedAssets = departmentVerification.filter((entry) => normalizeStatus(entry.status) === 'finalized').length;
      const latestAssetUpdated = departmentAssetRows.reduce((latest, asset) => {
        const timestamp = new Date(asset.updatedAt || 0).getTime();
        return timestamp > latest ? timestamp : latest;
      }, 0);
      const latestRequestUpdated = departmentApprovals.reduce((latest, request) => {
        const timestamp = new Date(request.updatedAt || 0).getTime();
        return timestamp > latest ? timestamp : latest;
      }, 0);
      const latestTransferUpdated = departmentTransfers.reduce((latest, transfer) => {
        const timestamp = new Date(transfer.updatedAt || 0).getTime();
        return timestamp > latest ? timestamp : latest;
      }, 0);
      const latestReturnUpdated = departmentReturns.reduce((latest, record) => {
        const timestamp = new Date(record.updatedAt || 0).getTime();
        return timestamp > latest ? timestamp : latest;
      }, 0);
      const latestMaintenanceUpdated = departmentMaintenance.reduce((latest, record) => {
        const timestamp = new Date(record.updatedAt || 0).getTime();
        return timestamp > latest ? timestamp : latest;
      }, 0);
      const latestVerificationUpdated = departmentVerification.reduce((latest, record) => {
        const timestamp = new Date(record.updatedAt || 0).getTime();
        return timestamp > latest ? timestamp : latest;
      }, 0);
      const latestAuditUpdated = departmentAudit.reduce((latest, record) => {
        const timestamp = new Date(record.updatedAt || record.createdAt || 0).getTime();
        return timestamp > latest ? timestamp : latest;
      }, 0);
      const lastActivityEpoch = [
        new Date(department.updatedAt || 0).getTime(),
        latestAssetUpdated,
        latestRequestUpdated,
        latestTransferUpdated,
        latestReturnUpdated,
        latestMaintenanceUpdated,
        latestVerificationUpdated,
        latestAuditUpdated,
      ].filter((value) => Number.isFinite(value) && value > 0).sort((left, right) => right - left)[0] || null;

      const metrics = {
        id: department.id,
        name: department.name,
        code: department.code,
        status: department.status,
        head: department.Head ? { id: department.Head.id, fullName: department.Head.fullName, username: department.Head.username } : null,
        staffCount: staffByDepartment.get(departmentIdValue) || 0,
        totalAssets,
        activeAssets: totalAssets,
        assignedAssets,
        availableAssets,
        maintenanceAssets,
        damagedAssets,
        missingAssets,
        requests: departmentApprovals.length,
        pendingRequests,
        approvedRequests,
        rejectedRequests,
        cancelledRequests,
        transfers: transferCount,
        returns: returnCount,
        verificationRecords: verificationCount,
        verifiedAssets,
        maintenanceCount,
        recentActivity: departmentAudit.length,
        lastActivity: lastActivityEpoch ? new Date(lastActivityEpoch).toISOString() : null,
        utilization: totalAssets ? Number(((assignedAssets / totalAssets) * 100).toFixed(1)) : 0,
      };
      return metrics;
    });

    const sortMetrics = [...departmentMetrics];
    sortMetrics.sort((left, right) => {
      const direction = sortOrder === 'DESC' ? -1 : 1;
      if (sortBy === 'assetcount') return (left.totalAssets - right.totalAssets) * direction;
      if (sortBy === 'requestcount') return (left.requests - right.requests) * direction;
      if (sortBy === 'maintenancecount') return (left.maintenanceCount - right.maintenanceCount) * direction;
      if (sortBy === 'lastactivity') return ((new Date(left.lastActivity || 0).getTime() || 0) - (new Date(right.lastActivity || 0).getTime() || 0)) * direction;
      return String(left.name || '').localeCompare(String(right.name || '')) * direction;
    });

    const total = sortMetrics.length;
    const sliced = sortMetrics.slice(offset, offset + limit);
    const summary = {
      totalDepartments: total,
      activeDepartments: sortMetrics.filter((department) => department.status === 'active').length,
      departmentsWithAssets: sortMetrics.filter((department) => department.totalAssets > 0).length,
      totalAssets: sortMetrics.reduce((totalValue, department) => totalValue + department.totalAssets, 0),
      assignedAssets: sortMetrics.reduce((totalValue, department) => totalValue + department.assignedAssets, 0),
      availableAssets: sortMetrics.reduce((totalValue, department) => totalValue + department.availableAssets, 0),
      maintenanceAssets: sortMetrics.reduce((totalValue, department) => totalValue + department.maintenanceAssets, 0),
      totalRequests: sortMetrics.reduce((totalValue, department) => totalValue + department.requests, 0),
      pendingRequests: sortMetrics.reduce((totalValue, department) => totalValue + department.pendingRequests, 0),
      verificationRecords: sortMetrics.reduce((totalValue, department) => totalValue + department.verificationRecords, 0),
    };

    res.json({
      success: true,
      data: sliced,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      summary,
      filters: {
        departments: departments.map((department) => ({ id: department.id, name: department.name, code: department.code, status: department.status })),
        statuses: ['active', 'inactive'],
      },
    });
  } catch (error) {
    next(error);
  }
};

const listCollegeStaff = async (req, res, next) => {
  try {
    const { page, limit, offset } = pagination(req.query);
    const collegeId = req.organizationScope.collegeId;
    const where = { collegeId };
    if (req.query.departmentId || req.query.department) where.departmentId = Number(req.query.departmentId || req.query.department);
    if (req.query.role) where.role = String(req.query.role);
    if (req.query.active !== undefined || req.query.status) where.active = String(req.query.active ?? req.query.status).toLowerCase() === 'active' || String(req.query.active ?? req.query.status).toLowerCase() === 'true';
    const search = String(req.query.search || '').trim();
    if (search) where[Op.or] = [{ username: { [Op.like]: `%${search}%` } }, { fullName: { [Op.like]: `%${search}%` } }, { email: { [Op.like]: `%${search}%` } }, { phone: { [Op.like]: `%${search}%` } }];
    const [result, totalStaff, activeStaff, staffWithDepartments] = await Promise.all([
      User.findAndCountAll({ where, attributes: { exclude: ['password'] }, include: [{ model: Department, as: 'DepartmentRecord', attributes: ['id', 'name', 'code'], required: false }], order: [['fullName', 'ASC'], ['id', 'ASC']], limit, offset }),
      User.count({ where: { collegeId } }),
      User.count({ where: { collegeId, active: true } }),
      User.count({ where: { collegeId, departmentId: { [Op.ne]: null } } }),
    ]);
    const data = result.rows.map((row) => ({ ...row.toJSON(), departmentRecord: row.DepartmentRecord || null }));
    res.json({ success: true, data, staff: data, summary: { total: totalStaff, active: activeStaff, inactive: totalStaff - activeStaff, withDepartments: staffWithDepartments }, pagination: { page, limit, total: result.count, pages: Math.ceil(result.count / limit), totalPages: Math.ceil(result.count / limit) } });
  } catch (error) { next(error); }
};

const listCollegeAssets = async (req, res, next) => {
  try {
    const { page, limit, offset } = pagination(req.query);
    const collegeId = req.organizationScope.collegeId;
    const where = { collegeId };
    for (const field of ['departmentId', 'category', 'status', 'location', 'condition']) if (req.query[field]) where[field] = req.query[field];
    const search = String(req.query.search || '').trim();
    if (search) where[Op.or] = [{ name: { [Op.like]: `%${search}%` } }, { assetCode: { [Op.like]: `%${search}%` } }, { serialNumber: { [Op.like]: `%${search}%` } }, { rfidTag: { [Op.like]: `%${search}%` } }, { manufacturer: { [Op.like]: `%${search}%` } }, { model: { [Op.like]: `%${search}%` } }, { department: { [Op.like]: `%${search}%` } }];
    const assignmentInclude = { model: Assignment, required: false, include: [{ model: User, required: false, attributes: ['id', 'fullName', 'username'] }] };
    if (req.query.assignmentStatus) { assignmentInclude.where = { status: req.query.assignmentStatus }; assignmentInclude.required = true; }
    const [result, allAssets, departments] = await Promise.all([
      Asset.findAndCountAll({ where, include: [{ model: Department, as: 'DepartmentRecord', required: false, attributes: ['id', 'name'] }, assignmentInclude], distinct: true, order: [['updatedAt', 'DESC']], limit, offset }),
      Asset.findAll({ where: { collegeId }, attributes: ['status', 'condition', 'category', 'location'], include: [{ model: Assignment, required: false, attributes: ['assetId', 'status'] }] }),
      Department.findAll({ where: { collegeId }, attributes: ['id', 'name'], order: [['name', 'ASC']] }),
    ]);
    const values = (field) => [...new Set(allAssets.map((asset) => String(asset[field] || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    const isCurrent = (assignment) => !['returned', 'cancelled', 'closed'].includes(String(assignment.status || '').toLowerCase());
    const activeAssignments = allAssets.filter((asset) => asset.Assignments?.some(isCurrent)).length;
    const normalized = (value) => String(value || '').toLowerCase().replace(/[_-]+/g, '-').replace(/\s+/g, '-');
    const countBy = (matches) => allAssets.filter((asset) => matches.includes(normalized(asset.status))).length;
    const data = result.rows.map((asset) => {
      const row = asset.toJSON();
      const currentAssignment = (row.Assignments || []).find(isCurrent);
      return { ...row, departmentName: row.DepartmentRecord?.name || row.department || '', assignedUser: currentAssignment?.User ? { id: currentAssignment.User.id, name: currentAssignment.User.fullName || currentAssignment.User.username } : null };
    });
    const summary = { total: allAssets.length, active: countBy(['active', 'available', 'in-use', 'assigned']), assigned: activeAssignments, available: countBy(['available', 'ready', 'idle']), maintenance: countBy(['maintenance', 'under-maintenance', 'in-repair', 'repair']), damagedMissing: countBy(['damaged', 'missing', 'lost']) };
    res.json({ success: true, data, college: { id: req.organizationScope.college.id, name: req.organizationScope.college.collegeName, code: req.organizationScope.college.collegeCode }, summary, filters: { categories: values('category'), statuses: values('status'), conditions: values('condition'), locations: values('location'), assignmentStatuses: [...new Set(allAssets.flatMap((asset) => (asset.Assignments || []).map((assignment) => assignment.status)).filter(Boolean))].sort(), departments }, pagination: { page, limit, total: result.count, pages: Math.ceil(result.count / limit), totalPages: Math.ceil(result.count / limit) } });
  } catch (error) { next(error); }
};

const getCollegeAsset = async (req, res, next) => {
  try {
    const asset = await Asset.findOne({ where: { id: req.params.id, collegeId: req.organizationScope.collegeId }, include: [{ model: Department, as: 'DepartmentRecord', required: false, attributes: ['id', 'name'] }, { model: Assignment, required: false, include: [{ model: User, required: false, attributes: ['id', 'fullName', 'username'] }] }] });
    if (!asset) return res.status(404).json({ success: false, message: 'Asset not found in your college' });
    return res.json({ success: true, data: asset });
  } catch (error) { return next(error); }
};

const getCollegeInventory = (req, res, next) => listCollegeAssets(req, res, next);

const listCollegeRFIDTracking = async (req, res, next) => {
  try {
    const collegeId = Number(req.organizationScope?.collegeId);
    if (!collegeId) {
      return res.status(403).json({ success: false, message: 'College scope is not configured for this account' });
    }

    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 25));
    const offset = (page - 1) * limit;
    const search = String(req.query.search || '').trim();
    const status = String(req.query.status || '').trim();
    const departmentId = req.query.departmentId ? Number(req.query.departmentId) : null;
    const location = String(req.query.location || '').trim();

    const departments = await Department.findAll({ where: { collegeId }, attributes: ['id', 'name', 'code'], order: [['name', 'ASC']], raw: true });
    const departmentIds = new Set(departments.map((department) => Number(department.id)));
    if (departmentId && !departmentIds.has(departmentId)) {
      return res.status(400).json({ success: false, message: 'Department is not part of your college' });
    }

    const assetWhere = { collegeId };
    if (departmentId) assetWhere.departmentId = departmentId;
    if (status) assetWhere.status = status;
    if (location) assetWhere.location = { [Op.like]: `%${location}%` };
    if (search) {
      assetWhere[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { assetCode: { [Op.like]: `%${search}%` } },
        { serialNumber: { [Op.like]: `%${search}%` } },
        { rfidTag: { [Op.like]: `%${search}%` } },
        { location: { [Op.like]: `%${search}%` } },
      ];
    }

    const [assets, totalTrackedAssets, recentLogs] = await Promise.all([
      Asset.findAll({
        where: assetWhere,
        include: [{ model: Department, as: 'DepartmentRecord', required: false, attributes: ['id', 'name', 'code'] }],
        order: [['updatedAt', 'DESC'], ['name', 'ASC']],
        limit,
        offset,
        raw: true,
      }),
      Asset.count({ where: assetWhere }),
      RFIDLog.findAll({
        include: [{ model: Asset, where: { collegeId }, required: true, attributes: ['id', 'name', 'assetCode', 'serialNumber', 'rfidTag', 'location', 'status', 'condition', 'departmentId'] }],
        order: [['createdAt', 'DESC']],
        limit: 20,
        raw: true,
      }),
    ]);

    const taggedAssets = assets.filter((asset) => String(asset.rfidTag || '').trim());
    const untaggedAssets = assets.filter((asset) => !String(asset.rfidTag || '').trim());
    const uniqueLocations = new Set(assets.map((asset) => String(asset.location || '').trim()).filter(Boolean)).size;
    const summary = {
      totalAssets: totalTrackedAssets,
      taggedAssets: taggedAssets.length,
      untaggedAssets: untaggedAssets.length,
      uniqueLocations,
      recentScans: recentLogs.length,
    };

    const serialisedAssets = assets.map((asset) => ({
      id: asset.id,
      assetCode: asset.assetCode,
      name: asset.name,
      serialNumber: asset.serialNumber,
      rfidTag: asset.rfidTag || '',
      category: asset.category,
      department: asset['DepartmentRecord.name'] || asset.department || 'Unassigned',
      departmentId: asset.departmentId,
      location: asset.location || 'Unknown',
      status: asset.status,
      condition: asset.condition,
      updatedAt: asset.updatedAt,
      createdAt: asset.createdAt,
    }));

    const serialisedLogs = recentLogs.map((log) => ({
      id: log.id,
      assetId: log.assetId,
      tag: log.tag,
      action: log.action,
      location: log.location || log['Asset.location'] || 'Unknown',
      notes: log.notes,
      createdAt: log.createdAt,
      asset: {
        id: log['Asset.id'],
        name: log['Asset.name'],
        assetCode: log['Asset.assetCode'],
        serialNumber: log['Asset.serialNumber'],
        rfidTag: log['Asset.rfidTag'],
        status: log['Asset.status'],
        condition: log['Asset.condition'],
      },
    }));

    return res.json({
      success: true,
      data: serialisedAssets,
      logs: serialisedLogs,
      summary,
      college: { id: collegeId, name: req.organizationScope.college?.collegeName || 'College' },
      filters: {
        departments: departments.map((department) => ({ id: department.id, name: department.name, code: department.code })),
        statuses: [...new Set(assets.map((asset) => String(asset.status || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
        locations: [...new Set(assets.map((asset) => String(asset.location || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
      },
      pagination: {
        page,
        limit,
        total: totalTrackedAssets,
        totalPages: Math.ceil(totalTrackedAssets / limit),
      },
    });
  } catch (error) {
    return next(error);
  }
};

const listCollegeLocations = async (req, res, next) => {
  try {
    const { page, limit } = pagination(req.query);
    const collegeId = req.organizationScope.collegeId;
    const where = { collegeId, location: { [Op.ne]: '' } };
    const search = String(req.query.search || '').trim();
    const filters = [];

    if (search) {
      filters.push({ [Op.or]: [
        { location: { [Op.like]: `%${search}%` } },
        { name: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
        { department: { [Op.like]: `%${search}%` } },
      ] });
    }

    if (req.query.departmentId) {
      const department = await Department.findOne({ where: { id: req.query.departmentId, collegeId }, attributes: ['id', 'name'] });
      if (!department) return res.status(400).json({ success: false, message: 'Department is not part of your college' });
      filters.push({ [Op.or]: [
        { departmentId: department.id },
        { department: department.name },
      ] });
    }

    if (filters.length) where[Op.and] = filters;

    const assets = await Asset.findAll({
      where,
      attributes: ['location', 'department', 'departmentId', 'createdAt', 'updatedAt'],
      order: [['location', 'ASC'], ['id', 'ASC']],
      raw: true,
    });
    const locationsByName = new Map();
    assets.forEach((asset) => {
      const name = String(asset.location || '').trim();
      if (!name) return;
      const current = locationsByName.get(name) || { name, assetCount: 0, departments: new Map(), createdAt: asset.createdAt, updatedAt: asset.updatedAt };
      current.assetCount += 1;
      if (asset.department || asset.departmentId) current.departments.set(String(asset.departmentId || asset.department), asset.department || `Department ${asset.departmentId}`);
      if (new Date(asset.createdAt || 0) < new Date(current.createdAt || 0)) current.createdAt = asset.createdAt;
      if (new Date(asset.updatedAt || 0) > new Date(current.updatedAt || 0)) current.updatedAt = asset.updatedAt;
      locationsByName.set(name, current);
    });

    const allLocations = Array.from(locationsByName.values()).map((location) => ({
      id: null,
      name: location.name,
      assetCount: location.assetCount,
      departments: Array.from(location.departments.values()),
      createdAt: location.createdAt,
      updatedAt: location.updatedAt,
    }));
    const total = allLocations.length;
    const rows = allLocations.slice((page - 1) * limit, page * limit);
    return res.json({
      success: true,
      data: rows,
      college: { id: req.organizationScope.college.id, name: req.organizationScope.college.collegeName, code: req.organizationScope.college.collegeCode },
      summary: { total, locationsWithAssets: total },
      pagination: { page, limit, total, pages: Math.ceil(total / limit), totalPages: Math.ceil(total / limit) },
    });
  } catch (error) { next(error); }
};

const getScopedDepartment = async (req, id) => Department.findOne({ where: { id, collegeId: req.organizationScope.collegeId } });

const validateDepartmentPayload = async (req, body, currentId = null) => {
  const name = String(body.department_name || body.name || '').trim();
  const code = String(body.department_code || body.code || '').trim().toUpperCase();
  if (name.length < 2) return { error: 'Department name must be at least 2 characters' };
  if (!code) return { error: 'Department code is required' };

  const duplicateName = await Department.findOne({
    where: {
      collegeId: req.organizationScope.collegeId,
      name,
      ...(currentId ? { id: { [Op.ne]: currentId } } : {}),
    },
  });
  if (duplicateName) return { error: 'Department name already exists in this college' };

  const duplicate = await Department.findOne({ where: { collegeId: req.organizationScope.collegeId, code, ...(currentId ? { id: { [Op.ne]: currentId } } : {}) } });
  if (duplicate) return { error: 'Department code already exists in this college' };
  let headId = body.head_user_id ?? body.headId ?? null;
  if (headId !== null && headId !== '') {
    const head = await User.findOne({ where: { id: headId, collegeId: req.organizationScope.collegeId, role: 'department_head', active: true } });
    if (!head) return { error: 'Department Head must be an active department_head in this college' };
    headId = head.id;
  } else {
    headId = null;
  }
  return { value: { name, code, description: String(body.description || '').trim(), headId, locationId: body.location_id || body.locationId || null, phone: String(body.phone || '').trim(), email: String(body.email || '').trim(), status: body.status === 'inactive' ? 'inactive' : 'active' } };
};

const createCollegeDepartment = async (req, res, next) => {
  try {
    const validation = await validateDepartmentPayload(req, req.body);
    if (validation.error) return res.status(400).json({ success: false, message: validation.error, errors: [validation.error] });
    const department = await Department.create({ ...validation.value, collegeId: req.organizationScope.collegeId });
    await AuditLog.create({ userId: req.user.id, action: 'DEPARTMENT_CREATED', entity: `department:${department.id}`, details: JSON.stringify({ after: department.toJSON() }) });
    res.status(201).json({ success: true, message: 'Department created successfully', data: department });
  } catch (error) { next(error); }
};

const updateCollegeDepartment = async (req, res, next) => {
  try {
    const department = await getScopedDepartment(req, req.params.id);
    if (!department) return res.status(404).json({ success: false, message: 'Department not found in your college' });
    const validation = await validateDepartmentPayload(req, req.body, department.id);
    if (validation.error) return res.status(400).json({ success: false, message: validation.error, errors: [validation.error] });
    const before = department.toJSON();
    await department.update({ ...validation.value, collegeId: department.collegeId });
    await AuditLog.create({ userId: req.user.id, action: 'DEPARTMENT_UPDATED', entity: `department:${department.id}`, details: JSON.stringify({ before, after: department.toJSON() }) });
    res.json({ success: true, message: 'Department updated successfully', data: department });
  } catch (error) { next(error); }
};

const updateCollegeDepartmentStatus = async (req, res, next) => {
  try {
    const department = await getScopedDepartment(req, req.params.id);
    if (!department) return res.status(404).json({ success: false, message: 'Department not found in your college' });
    if (!['active', 'inactive'].includes(req.body.status)) return res.status(400).json({ success: false, message: 'Status must be active or inactive' });
    const before = department.status;
    await department.update({ status: req.body.status });
    await AuditLog.create({ userId: req.user.id, action: req.body.status === 'active' ? 'DEPARTMENT_ACTIVATED' : 'DEPARTMENT_DEACTIVATED', entity: `department:${department.id}`, details: JSON.stringify({ before, after: department.status }) });
    res.json({ success: true, message: 'Department status updated successfully', data: department });
  } catch (error) { next(error); }
};

const deleteCollegeDepartment = async (req, res, next) => {
  try {
    const department = await getScopedDepartment(req, req.params.id);
    if (!department) return res.status(404).json({ success: false, message: 'Department not found in your college' });
    const [staffCount, assetCount] = await Promise.all([
      User.count({ where: { collegeId: req.organizationScope.collegeId, departmentId: department.id } }),
      Asset.count({ where: { collegeId: req.organizationScope.collegeId, departmentId: department.id } }),
    ]);
    if (staffCount || assetCount) return res.status(409).json({ success: false, message: 'Department cannot be deleted while it has staff or assets', details: { staffCount, assetCount } });
    const before = department.toJSON();
    await department.destroy();
    await AuditLog.create({ userId: req.user.id, action: 'DEPARTMENT_DELETED', entity: `department:${before.id}`, details: JSON.stringify({ before }) });
    res.json({ success: true, message: 'Department deleted successfully', data: { id: before.id } });
  } catch (error) { next(error); }
};

const getCollegeDepartmentDetails = async (req, res, next) => {
  try {
    const department = await Department.findOne({ where: { id: req.params.id, collegeId: req.organizationScope.collegeId }, include: [{ model: User, as: 'Head', attributes: ['id', 'username', 'fullName', 'role'] }] });
    if (!department) return res.status(404).json({ success: false, message: 'Department not found in your college' });
    const [staffCount, assetCount, assetValue, statusRows] = await Promise.all([
      User.count({ where: { departmentId: department.id } }),
      Asset.count({ where: { departmentId: department.id } }),
      Asset.sum('currentValue', { where: { departmentId: department.id } }),
      Asset.findAll({ where: { departmentId: department.id }, attributes: ['status', [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']], group: ['status'], raw: true }),
    ]);
    res.json({ success: true, data: { ...department.toJSON(), staffCount, assetCount, assetValue: Number(assetValue || 0), assetStatus: statusRows } });
  } catch (error) { next(error); }
};

const listCollegeDepartmentStaff = async (req, res, next) => {
  try {
    const department = await getScopedDepartment(req, req.params.id);
    if (!department) return res.status(404).json({ success: false, message: 'Department not found in your college' });
    const { page, limit, offset } = pagination(req.query);
    const { count, rows } = await User.findAndCountAll({ where: { collegeId: req.organizationScope.collegeId, departmentId: department.id }, attributes: { exclude: ['password'] }, order: [['fullName', 'ASC']], limit, offset });
    res.json({ success: true, data: rows, pagination: { page, limit, total: count, pages: Math.ceil(count / limit) } });
  } catch (error) { next(error); }
};

const listCollegeDepartmentAssets = async (req, res, next) => {
  try {
    const collegeId = Number(req.organizationScope?.collegeId);
    if (!collegeId) return res.status(403).json({ success: false, message: 'College scope is not configured for this account' });

    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 10));
    const offset = (page - 1) * limit;

    let requestedDepartmentId = null;
    if (req.params && req.params.id) {
      requestedDepartmentId = Number(req.params.id);
      const department = await getScopedDepartment(req, requestedDepartmentId);
      if (!department) return res.status(404).json({ success: false, message: 'Department not found in your college' });
    } else if (req.query.departmentId) {
      requestedDepartmentId = Number(req.query.departmentId);
      if (!Number.isInteger(requestedDepartmentId) || requestedDepartmentId <= 0) {
        return res.status(400).json({ success: false, message: 'Department ID is invalid' });
      }
      const department = await Department.findOne({ where: { id: requestedDepartmentId, collegeId } });
      if (!department) return res.status(400).json({ success: false, message: 'Department is not part of your college' });
    }

    const where = { collegeId };
    if (requestedDepartmentId) where.departmentId = requestedDepartmentId;

    const search = String(req.query.search || '').trim();
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { assetCode: { [Op.like]: `%${search}%` } },
        { serialNumber: { [Op.like]: `%${search}%` } },
        { rfidTag: { [Op.like]: `%${search}%` } },
        { category: { [Op.like]: `%${search}%` } },
        { department: { [Op.like]: `%${search}%` } },
        { '$DepartmentRecord.name$': { [Op.like]: `%${search}%` } },
      ];
    }

    const status = String(req.query.status || '').trim();
    if (status) where.status = status;

    const categoryValue = String(req.query.category || req.query.categoryId || '').trim();
    if (categoryValue) where.category = categoryValue;

    const locationValue = String(req.query.location || req.query.locationId || '').trim();
    if (locationValue) where.location = locationValue;

    const [result, allAssets, departments] = await Promise.all([
      Asset.findAndCountAll({
        where,
        include: [
          { model: Department, as: 'DepartmentRecord', attributes: ['id', 'name', 'code'], required: false },
          { model: Assignment, required: false, include: [{ model: User, required: false, attributes: ['id', 'fullName', 'username'] }] },
        ],
        distinct: true,
        order: [['updatedAt', 'DESC']],
        limit,
        offset,
      }),
      Asset.findAll({
        where,
        attributes: ['id', 'status', 'condition', 'category', 'location', 'departmentId', 'department'],
        include: [{ model: Assignment, required: false, attributes: ['id', 'status', 'assetId'] }],
      }),
      Department.findAll({
        where: { collegeId },
        attributes: ['id', 'name', 'code'],
        order: [['name', 'ASC']],
      }),
    ]);

    const normalizeStatus = (value) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const activeAssignmentCount = allAssets.filter((asset) => (asset.Assignments || []).some((assignment) => !['returned', 'cancelled', 'closed'].includes(String(assignment.status || '').toLowerCase()))).length;
    const summary = {
      totalAssets: allAssets.length,
      activeAssets: allAssets.filter((asset) => ['active', 'available', 'assigned', 'in-use', 'ready', 'idle'].includes(normalizeStatus(asset.status))).length,
      assignedAssets: activeAssignmentCount,
      availableAssets: allAssets.filter((asset) => ['available', 'ready', 'idle'].includes(normalizeStatus(asset.status))).length,
      maintenanceAssets: allAssets.filter((asset) => ['maintenance', 'under-maintenance', 'in-repair', 'repair'].includes(normalizeStatus(asset.status))).length,
      damagedAssets: allAssets.filter((asset) => ['damaged', 'poor', 'failed'].includes(normalizeStatus(asset.status))).length,
      missingAssets: allAssets.filter((asset) => ['missing', 'lost', 'stolen'].includes(normalizeStatus(asset.status))).length,
    };

    const data = result.rows.map((asset) => {
      const row = asset.toJSON();
      const currentAssignment = (row.Assignments || []).find((assignment) => !['returned', 'cancelled', 'closed'].includes(String(assignment.status || '').toLowerCase()));
      return {
        id: row.id,
        assetCode: row.assetCode,
        assetTag: row.rfidTag || row.assetCode,
        name: row.name,
        description: row.description,
        category: row.category,
        department: row.DepartmentRecord?.name || row.department || '',
        departmentId: row.departmentId,
        collegeId: row.collegeId,
        location: row.location,
        serialNumber: row.serialNumber,
        status: row.status,
        condition: row.condition,
        manufacturer: row.manufacturer,
        model: row.model,
        currentValue: row.currentValue,
        purchaseDate: row.purchaseDate,
        purchasePrice: row.purchasePrice,
        warrantyExpiry: row.warrantyExpiry,
        assignedUser: currentAssignment?.User ? { id: currentAssignment.User.id, name: currentAssignment.User.fullName || currentAssignment.User.username } : null,
        assignmentDate: currentAssignment?.createdAt || null,
        updatedAt: row.updatedAt,
        createdAt: row.createdAt,
      };
    });

    const rawCategories = [...new Set(allAssets.map((asset) => String(asset.category || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    const rawLocations = [...new Set(allAssets.map((asset) => String(asset.location || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));

    res.json({
      success: true,
      data,
      pagination: {
        page,
        limit,
        total: result.count,
        totalPages: Math.ceil(result.count / limit),
      },
      summary,
      filters: {
        departments: departments.map((department) => ({ id: department.id, name: department.name, code: department.code })),
        statuses: [...new Set(allAssets.map((asset) => String(asset.status || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
        categories: rawCategories,
        locations: rawLocations,
      },
    });
  } catch (error) { next(error); }
};

const getCollegeDepartmentReports = async (req, res, next) => {
  try {
    const collegeId = Number(req.organizationScope?.collegeId);
    if (!collegeId) {
      return res.status(403).json({ success: false, message: 'College scope is not configured for this account' });
    }

    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;
    const search = String(req.query.search || '').trim();
    const departmentId = req.query.departmentId ? Number(req.query.departmentId) : null;
    const status = String(req.query.status || '').trim().toLowerCase();
    const dateFrom = String(req.query.dateFrom || '').trim();
    const dateTo = String(req.query.dateTo || '').trim();

    if (departmentId) {
      const validDepartment = await Department.findOne({ where: { id: departmentId, collegeId }, attributes: ['id'] });
      if (!validDepartment) {
        return res.status(400).json({ success: false, message: 'Department is not part of your college' });
      }
    }

    if (dateFrom && Number.isNaN(Date.parse(dateFrom))) {
      return res.status(422).json({ success: false, message: 'Date from is invalid' });
    }
    if (dateTo && Number.isNaN(Date.parse(dateTo))) {
      return res.status(422).json({ success: false, message: 'Date to is invalid' });
    }
    if (dateFrom && dateTo && new Date(dateFrom) > new Date(dateTo)) {
      return res.status(422).json({ success: false, message: 'Date from must be before date to' });
    }

    const departmentWhere = { collegeId };
    if (status && ['active', 'inactive'].includes(status)) departmentWhere.status = status;
    if (departmentId) departmentWhere.id = departmentId;
    if (search) {
      departmentWhere[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { code: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
        { '$Head.fullName$': { [Op.like]: `%${search}%` } },
        { '$Head.username$': { [Op.like]: `%${search}%` } },
      ];
    }

    const [departmentRows, totalDepartments] = await Promise.all([
      Department.findAll({
        where: departmentWhere,
        include: [{ model: User, as: 'Head', attributes: ['id', 'fullName', 'username'], required: false }],
        order: [['name', 'ASC']],
        offset,
        limit,
      }),
      Department.count({ where: departmentWhere }),
    ]);

    const departmentIds = departmentRows.map((department) => Number(department.id));
    const scopeDepartmentIds = departmentIds.length ? departmentIds : [-1];
    const collegeAssetIds = await Asset.findAll({ where: { collegeId }, attributes: ['id'], raw: true });
    const assetIds = collegeAssetIds.map((asset) => Number(asset.id));

    const [staffRows, assetRows, requestRows, assignmentRows, transferRows, returnRows, maintenanceRows, verificationRows, auditRows] = await Promise.all([
      User.findAll({
        where: { collegeId, departmentId: { [Op.in]: scopeDepartmentIds } },
        attributes: ['departmentId', [fn('COUNT', col('id')), 'count']],
        group: ['departmentId'],
        raw: true,
      }),
      Asset.findAll({
        where: { collegeId, departmentId: { [Op.in]: scopeDepartmentIds } },
        attributes: ['departmentId', 'status', [fn('COUNT', col('id')), 'count']],
        group: ['departmentId', 'status'],
        raw: true,
      }),
      Approval.findAll({
        where: {
          [Op.or]: [
            { departmentId: { [Op.in]: scopeDepartmentIds } },
            { assetId: { [Op.in]: assetIds.length ? assetIds : [-1] } },
          ],
        },
        attributes: ['departmentId', 'status', [fn('COUNT', col('id')), 'count']],
        group: ['departmentId', 'status'],
        raw: true,
      }),
      Assignment.findAll({
        include: [{ model: Asset, where: { collegeId, departmentId: { [Op.in]: scopeDepartmentIds } }, required: true, attributes: ['id', 'departmentId'] }],
        attributes: ['status', 'assetId', 'updatedAt'],
        raw: true,
      }),
      Transfer.findAll({
        where: {
          [Op.or]: [
            { sourceDepartmentId: { [Op.in]: scopeDepartmentIds } },
            { destinationDepartmentId: { [Op.in]: scopeDepartmentIds } },
          ],
        },
        attributes: ['sourceDepartmentId', 'destinationDepartmentId', 'status', 'transferDate'],
        raw: true,
      }),
      AssetReturn.findAll({
        where: { collegeId, departmentId: { [Op.in]: scopeDepartmentIds } },
        attributes: ['departmentId', 'status', [fn('COUNT', col('id')), 'count']],
        group: ['departmentId', 'status'],
        raw: true,
      }),
      Maintenance.findAll({
        include: [{ model: Asset, where: { collegeId, departmentId: { [Op.in]: scopeDepartmentIds } }, required: true, attributes: ['id', 'departmentId'] }],
        attributes: ['status', [fn('COUNT', col('id')), 'count']],
        group: ['status'],
        raw: true,
      }),
      VerificationSession.findAll({
        where: { collegeId, departmentId: { [Op.in]: scopeDepartmentIds } },
        attributes: ['departmentId', 'status', [fn('COUNT', col('id')), 'count']],
        group: ['departmentId', 'status'],
        raw: true,
      }),
      AuditLog.findAll({
        where: { entity: { [Op.like]: 'department:%' } },
        include: [{ model: Department, where: { collegeId }, required: true, attributes: ['id', 'name', 'code'] }],
        attributes: ['id', 'entity', 'action', 'details', 'createdAt'],
        order: [['createdAt', 'DESC']],
        limit: 12,
        raw: true,
      }),
    ]);

    const staffByDepartment = new Map(staffRows.map((row) => [Number(row.departmentId), Number(row.count || 0)]));
    const assetStatusByDepartment = new Map();
    const assetCountByDepartment = new Map();
    for (const row of assetRows) {
      const departmentId = Number(row.departmentId);
      assetCountByDepartment.set(departmentId, (assetCountByDepartment.get(departmentId) || 0) + Number(row.count || 0));
      const departmentMap = assetStatusByDepartment.get(departmentId) || {};
      const statusKey = String(row.status || '').trim().toLowerCase();
      departmentMap[statusKey] = (departmentMap[statusKey] || 0) + Number(row.count || 0);
      assetStatusByDepartment.set(departmentId, departmentMap);
    }

    const requestByDepartment = new Map();
    for (const row of requestRows) {
      const departmentId = Number(row.departmentId || 0);
      const departmentMap = requestByDepartment.get(departmentId) || {};
      const statusKey = String(row.status || '').trim().toLowerCase();
      departmentMap[statusKey] = (departmentMap[statusKey] || 0) + Number(row.count || 0);
      requestByDepartment.set(departmentId, departmentMap);
    }

    const transferByDepartment = ({ incoming: 0, outgoing: 0, pending: 0, completed: 0 });
    const transferSummary = new Map();
    for (const row of transferRows) {
      const incomingDepartment = Number(row.destinationDepartmentId || 0);
      const outgoingDepartment = Number(row.sourceDepartmentId || 0);
      if (incomingDepartment) {
        const entry = transferSummary.get(incomingDepartment) || { ...transferByDepartment };
        entry.incoming += 1;
        if (String(row.status || '').trim().toLowerCase() === 'pending') entry.pending += 1;
        if (String(row.status || '').trim().toLowerCase() === 'completed') entry.completed += 1;
        transferSummary.set(incomingDepartment, entry);
      }
      if (outgoingDepartment) {
        const entry = transferSummary.get(outgoingDepartment) || { ...transferByDepartment };
        entry.outgoing += 1;
        if (String(row.status || '').trim().toLowerCase() === 'pending') entry.pending += 1;
        if (String(row.status || '').trim().toLowerCase() === 'completed') entry.completed += 1;
        transferSummary.set(outgoingDepartment, entry);
      }
    }

    const returnSummary = new Map();
    for (const row of returnRows) {
      const departmentId = Number(row.departmentId || 0);
      const entry = returnSummary.get(departmentId) || { total: 0, completed: 0, pending: 0 };
      entry.total += Number(row.count || 0);
      const statusKey = String(row.status || '').trim().toLowerCase();
      if (statusKey === 'completed') entry.completed += Number(row.count || 0);
      if (['requested', 'pending'].includes(statusKey)) entry.pending += Number(row.count || 0);
      returnSummary.set(departmentId, entry);
    }

    const verificationSummary = new Map();
    for (const row of verificationRows) {
      const departmentId = Number(row.departmentId || 0);
      const entry = verificationSummary.get(departmentId) || { total: 0, verified: 0, pending: 0, discrepancies: 0 };
      entry.total += Number(row.count || 0);
      const statusKey = String(row.status || '').trim().toLowerCase();
      if (statusKey === 'completed' || statusKey === 'finalized') entry.verified += Number(row.count || 0);
      if (['draft', 'in_progress', 'submitted', 'pending'].includes(statusKey)) entry.pending += Number(row.count || 0);
      if (['needs_review', 'discrepancy', 'review_required'].includes(statusKey)) entry.discrepancies += Number(row.count || 0);
      verificationSummary.set(departmentId, entry);
    }

    const statusCounts = {};
    for (const row of departmentRows) {
      statusCounts[row.status] = (statusCounts[row.status] || 0) + 1;
    }

    const reportRows = departmentRows.map((department) => {
      const departmentId = Number(department.id);
      const staffCount = staffByDepartment.get(departmentId) || 0;
      const totalAssets = assetCountByDepartment.get(departmentId) || 0;
      const assetMap = assetStatusByDepartment.get(departmentId) || {};
      const requests = requestByDepartment.get(departmentId) || {};
      const transfer = transferSummary.get(departmentId) || { incoming: 0, outgoing: 0, pending: 0, completed: 0 };
      const returns = returnSummary.get(departmentId) || { total: 0, completed: 0, pending: 0 };
      const verification = verificationSummary.get(departmentId) || { total: 0, verified: 0, pending: 0, discrepancies: 0 };
      const maintenanceRecords = maintenanceRows.filter((row) => Number(row.id ? null : 0) === 0).length;
      return {
        id: departmentId,
        department: department.name,
        departmentCode: department.code || '—',
        status: department.status,
        head: department.Head ? (department.Head.fullName || department.Head.username) : '—',
        staffCount,
        totalAssets,
        assignedAssets: Number(assetMap.assigned || assetMap['in-use'] || assetMap['issued'] || 0),
        availableAssets: Number(assetMap.available || assetMap.ready || 0),
        maintenanceAssets: Number(assetMap.maintenance || assetMap['under-maintenance'] || assetMap['in-repair'] || 0),
        pendingRequests: Number(requests.pending || 0) + Number(requests['in-review'] || 0),
        transfers: transfer.incoming + transfer.outgoing,
        returns: returns.total,
        verificationItems: verification.total,
        maintenanceRecords,
        lastActivity: department.updatedAt,
      };
    });

    const summary = {
      totalDepartments: totalDepartments,
      activeDepartments: statusCounts.active || 0,
      inactiveDepartments: statusCounts.inactive || 0,
      departmentsWithAssets: reportRows.filter((row) => row.totalAssets > 0).length,
      departmentsWithoutAssets: reportRows.filter((row) => row.totalAssets === 0).length,
      totalDepartmentStaff: reportRows.reduce((sum, row) => sum + Number(row.staffCount || 0), 0),
      totalDepartmentAssets: reportRows.reduce((sum, row) => sum + Number(row.totalAssets || 0), 0),
      pendingDepartmentRequests: reportRows.reduce((sum, row) => sum + Number(row.pendingRequests || 0), 0),
    };

    const assetDistribution = departmentRows.map((department) => ({
      department: department.name,
      totalAssets: assetCountByDepartment.get(Number(department.id)) || 0,
      assigned: Number((assetStatusByDepartment.get(Number(department.id)) || {}).assigned || (assetStatusByDepartment.get(Number(department.id)) || {})['in-use'] || 0),
      available: Number((assetStatusByDepartment.get(Number(department.id)) || {}).available || (assetStatusByDepartment.get(Number(department.id)) || {}).ready || 0),
      underMaintenance: Number((assetStatusByDepartment.get(Number(department.id)) || {}).maintenance || (assetStatusByDepartment.get(Number(department.id)) || {})['under-maintenance'] || 0),
    }));

    const staffDistribution = departmentRows.map((department) => ({
      department: department.name,
      totalStaff: staffByDepartment.get(Number(department.id)) || 0,
      activeStaff: Number((department.status === 'active' ? staffByDepartment.get(Number(department.id)) || 0 : 0)),
      inactiveStaff: Number((department.status === 'inactive' ? staffByDepartment.get(Number(department.id)) || 0 : 0)),
    }));

    const requestDistribution = departmentRows.map((department) => {
      const requestMap = requestByDepartment.get(Number(department.id)) || {};
      return {
        department: department.name,
        totalRequests: Object.values(requestMap).reduce((sum, value) => sum + Number(value || 0), 0),
        pending: Number(requestMap.pending || 0),
        approved: Number(requestMap.approved || 0),
        rejected: Number(requestMap.rejected || 0),
      };
    });

    const transferDistribution = departmentRows.map((department) => {
      const transfer = transferSummary.get(Number(department.id)) || { incoming: 0, outgoing: 0, pending: 0, completed: 0 };
      return {
        department: department.name,
        incomingTransfers: transfer.incoming,
        outgoingTransfers: transfer.outgoing,
        pendingTransfers: transfer.pending,
        completedTransfers: transfer.completed,
      };
    });

    const maintenanceDistribution = departmentRows.map((department) => ({
      department: department.name,
      maintenanceRecords: 0,
      open: 0,
      inProgress: 0,
      completed: 0,
    }));

    const verificationDistribution = departmentRows.map((department) => {
      const entry = verificationSummary.get(Number(department.id)) || { total: 0, verified: 0, pending: 0, discrepancies: 0 };
      return {
        department: department.name,
        totalVerificationItems: entry.total,
        verified: entry.verified,
        pending: entry.pending,
        discrepancies: entry.discrepancies,
      };
    });

    const activity = auditRows.map((entry) => ({
      id: entry.id,
      date: entry.createdAt,
      department: entry['Department.name'] || entry.entity?.replace(/^department:/, '') || 'Department',
      activity: entry.action || 'Department activity',
      user: 'System user',
      reference: entry.entity || 'Department',
      status: entry.details || 'Recorded',
    }));

    res.json({
      success: true,
      data: {
        summary,
        departments: reportRows,
        statusDistribution: Object.entries(statusCounts).map(([status, count]) => ({ status, count, percentage: totalDepartments ? Number(((count / totalDepartments) * 100).toFixed(1)) : 0 })),
        assetDistribution,
        staffDistribution,
        requestDistribution,
        transferDistribution,
        returnDistribution: departmentRows.map((department) => {
          const entry = returnSummary.get(Number(department.id)) || { total: 0, completed: 0, pending: 0 };
          return { department: department.name, totalReturns: entry.total, completedReturns: entry.completed, pendingReturns: entry.pending };
        }),
        maintenanceDistribution,
        verificationDistribution,
        activity,
        pagination: {
          page,
          limit,
          total: totalDepartments,
          totalPages: Math.max(1, Math.ceil(totalDepartments / limit)),
        },
      },
      college: { id: collegeId, name: req.organizationScope.college?.collegeName || 'College' },
    });
  } catch (error) {
    next(error);
  }
};

const getCollegeReports = async (req, res, next) => {
  try {
    const collegeId = Number(req.organizationScope?.collegeId);
    if (!collegeId) {
      return res.status(403).json({ success: false, message: 'College scope is not configured for this account' });
    }

    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;
    const reportType = String(req.query.reportType || 'inventory').trim().toLowerCase();
    const allowedReportTypes = ['inventory', 'status', 'departments', 'assignments', 'transfers', 'returns', 'maintenance', 'verification', 'requests', 'movement'];
    const normalizedReportType = allowedReportTypes.includes(reportType) ? reportType : 'inventory';
    const search = String(req.query.search || '').trim();
    const departmentId = req.query.departmentId ? Number(req.query.departmentId) : null;
    const categoryId = req.query.categoryId ? Number(req.query.categoryId) : null;
    const status = String(req.query.status || '').trim();
    const dateFrom = String(req.query.dateFrom || '').trim();
    const dateTo = String(req.query.dateTo || '').trim();

    if (departmentId) {
      const department = await Department.findOne({ where: { id: departmentId, collegeId }, attributes: ['id'] });
      if (!department) {
        return res.status(400).json({ success: false, message: 'Department is not part of your college' });
      }
    }

    const assetWhere = { collegeId };
    if (departmentId) assetWhere.departmentId = departmentId;

    const categoryName = categoryId ? (await Category.findByPk(categoryId, { attributes: ['id', 'name'] }))?.name || null : null;
    if (categoryId && !categoryName) {
      return res.status(400).json({ success: false, message: 'Category is not available for your college' });
    }
    if (categoryName) assetWhere.category = categoryName;
    if (status) assetWhere.status = status;

    if (dateFrom && Number.isNaN(Date.parse(dateFrom))) {
      return res.status(400).json({ success: false, message: 'Date from is invalid' });
    }
    if (dateTo && Number.isNaN(Date.parse(dateTo))) {
      return res.status(400).json({ success: false, message: 'Date to is invalid' });
    }
    if (dateFrom && dateTo && new Date(dateFrom) > new Date(dateTo)) {
      return res.status(400).json({ success: false, message: 'Date from must be before date to' });
    }

    const [departments, categories, assetStatusOptions] = await Promise.all([
      Department.findAll({ where: { collegeId }, attributes: ['id', 'name', 'code'], order: [['name', 'ASC']] }),
      Category.findAll({ where: { status: 'active' }, attributes: ['id', 'name'], order: [['name', 'ASC']] }),
      Asset.findAll({ where: { collegeId }, attributes: ['status'], raw: true }),
    ]);

    const validAssetStatuses = [...new Set(assetStatusOptions.map((item) => String(item.status || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    const departmentOptions = departments.map((department) => ({ id: department.id, name: department.name, code: department.code }));
    const categoryOptions = categories.map((category) => ({ id: category.id, name: category.name }));

    const buildSearchWhere = (fields, tableAlias = '') => {
      if (!search) return undefined;
      const pattern = { [Op.like]: `%${search}%` };
      const query = {};
      query[Op.or] = fields.map((field) => {
        const key = tableAlias ? `${tableAlias}.${field}` : field;
        return { [key]: pattern };
      });
      return query;
    };

    const computeAssetStatusSummary = (rows) => {
      const totals = { total: rows.length };
      const map = new Map();
      for (const row of rows) {
        const label = String(row.status || 'unknown').trim() || 'unknown';
        map.set(label, (map.get(label) || 0) + 1);
      }
      for (const [label, count] of Array.from(map.entries()).sort(([left], [right]) => left.localeCompare(right))) {
        totals[label] = count;
      }
      return totals;
    };

    let rows = [];
    let total = 0;
    let summary = {};
    let chartData = [];
    let filters = { departments: departmentOptions, categories: categoryOptions, statuses: validAssetStatuses };

    const commonAssetInclude = [
      { model: Department, as: 'DepartmentRecord', attributes: ['id', 'name', 'code'], required: false },
      { model: Assignment, required: false, include: [{ model: User, required: false, attributes: ['id', 'fullName', 'username'] }] },
    ];

    if (normalizedReportType === 'inventory') {
      const where = { ...assetWhere };
      if (status) where.status = status;
      if (dateFrom || dateTo) {
        where.updatedAt = {};
        if (dateFrom) where.updatedAt[Op.gte] = new Date(dateFrom);
        if (dateTo) {
          const endDate = new Date(dateTo);
          endDate.setHours(23, 59, 59, 999);
          where.updatedAt[Op.lte] = endDate;
        }
      }
      if (search) {
        where[Op.or] = [
          { name: { [Op.like]: `%${search}%` } },
          { assetCode: { [Op.like]: `%${search}%` } },
          { serialNumber: { [Op.like]: `%${search}%` } },
          { department: { [Op.like]: `%${search}%` } },
          { category: { [Op.like]: `%${search}%` } },
        ];
      }

      const result = await Asset.findAndCountAll({
        where,
        include: commonAssetInclude,
        order: [['updatedAt', 'DESC'], ['id', 'DESC']],
        limit,
        offset,
        distinct: true,
      });

      rows = result.rows.map((asset) => {
        const data = asset.toJSON();
        const assignment = (data.Assignments || []).find((entry) => !['returned', 'cancelled', 'closed'].includes(String(entry.status || '').toLowerCase())) || null;
        return {
          id: data.id,
          assetCode: data.assetCode,
          name: data.name,
          category: data.category,
          department: data.DepartmentRecord?.name || data.department || '—',
          location: data.location || '—',
          status: data.status || '—',
          condition: data.condition || '—',
          assignedTo: assignment?.User ? (assignment.User.fullName || assignment.User.username) : '—',
          purchaseDate: data.purchaseDate,
          assetValue: data.currentValue ?? data.purchasePrice ?? 0,
          lastUpdated: data.updatedAt,
          serialNumber: data.serialNumber,
          collegeId: data.collegeId,
        };
      });
      total = result.count;
      const allAssets = await Asset.findAll({ where: { collegeId }, attributes: ['status', 'id'], raw: true });
      summary = {
        totalAssets: allAssets.length,
        activeAssets: allAssets.filter((asset) => ['active', 'available', 'assigned', 'in-use', 'issued'].includes(String(asset.status || '').trim().toLowerCase())).length,
        assignedAssets: allAssets.filter((asset) => ['assigned', 'in-use', 'issued', 'allocated'].includes(String(asset.status || '').trim().toLowerCase())).length,
        availableAssets: allAssets.filter((asset) => ['available', 'ready', 'idle'].includes(String(asset.status || '').trim().toLowerCase())).length,
        underMaintenance: allAssets.filter((asset) => ['maintenance', 'under-maintenance', 'in-repair', 'repair'].includes(String(asset.status || '').trim().toLowerCase())).length,
      };
      chartData = Array.from(new Map(Object.entries(computeAssetStatusSummary(allAssets.map((asset) => ({ status: asset.status }))))).entries()).map(([label, value]) => ({ label, value }));
    } else if (normalizedReportType === 'status') {
      const allAssets = await Asset.findAll({ where: { collegeId }, attributes: ['status'], raw: true });
      const statusCounts = computeAssetStatusSummary(allAssets.map((asset) => ({ status: asset.status })));
      delete statusCounts.total;
      const totalAssets = allAssets.length;
      rows = Object.entries(statusCounts).map(([label, value]) => ({
        label,
        count: Number(value),
        percentage: totalAssets ? Number(((Number(value) / totalAssets) * 100).toFixed(1)) : 0,
      }));
      total = rows.length;
      summary = { totalAssets, totalStatuses: rows.length };
      chartData = rows.map((item) => ({ label: item.label, value: item.count }));
    } else if (normalizedReportType === 'departments') {
      const where = { collegeId };
      if (departmentId) where.id = departmentId;
      const departmentsData = await Department.findAll({
        where,
        include: [{ model: User, attributes: ['id'], required: false }, { model: Asset, attributes: ['id', 'status'], required: false }],
        order: [['name', 'ASC']],
      });
      rows = departmentsData.map((department) => {
        const departmentAssets = department.Assets || [];
        const assetStates = departmentAssets.map((asset) => String(asset.status || '').trim().toLowerCase());
        return {
          id: department.id,
          department: department.name,
          staffCount: (department.Users || []).length,
          totalAssets: departmentAssets.length,
          assigned: assetStates.filter((state) => ['assigned', 'in-use', 'issued', 'allocated'].includes(state)).length,
          available: assetStates.filter((state) => ['available', 'ready', 'idle'].includes(state)).length,
          underMaintenance: assetStates.filter((state) => ['maintenance', 'under-maintenance', 'in-repair', 'repair'].includes(state)).length,
          damaged: assetStates.filter((state) => ['damaged', 'broken', 'failed'].includes(state)).length,
          missing: assetStates.filter((state) => ['missing', 'lost', 'stolen'].includes(state)).length,
        };
      });
      total = rows.length;
      summary = {
        totalDepartments: departmentsData.length,
        totalAssets: rows.reduce((sum, row) => sum + Number(row.totalAssets || 0), 0),
        totalStaff: rows.reduce((sum, row) => sum + Number(row.staffCount || 0), 0),
      };
      chartData = rows.map((row) => ({ label: row.department, value: row.totalAssets }));
    } else if (normalizedReportType === 'assignments') {
      const where = {};
      if (status) where.status = status;
      if (search) {
        where[Op.or] = [
          { '$Asset.name$': { [Op.like]: `%${search}%` } },
          { '$Asset.assetCode$': { [Op.like]: `%${search}%` } },
          { '$User.fullName$': { [Op.like]: `%${search}%` } },
          { '$User.username$': { [Op.like]: `%${search}%` } },
        ];
      }
      if (dateFrom || dateTo) {
        where.createdAt = {};
        if (dateFrom) where.createdAt[Op.gte] = new Date(dateFrom);
        if (dateTo) {
          const endDate = new Date(dateTo);
          endDate.setHours(23, 59, 59, 999);
          where.createdAt[Op.lte] = endDate;
        }
      }
      const result = await Assignment.findAndCountAll({
        where,
        include: [
          { model: Asset, where: { collegeId, ...(departmentId ? { departmentId } : {}) }, required: true, attributes: ['id', 'name', 'assetCode', 'departmentId', 'department', 'location', 'status'], include: [{ model: Department, as: 'DepartmentRecord', attributes: ['id', 'name', 'code'], required: false }] },
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
        department: assignment.Asset?.DepartmentRecord?.name || assignment.Asset?.department || '—',
        assignmentDate: assignment.createdAt,
        status: assignment.status || 'active',
        location: assignment.Asset?.location || '—',
      }));
      total = result.count;
      summary = { totalAssignments: result.count, activeAssignments: result.rows.filter((row) => !['returned', 'cancelled', 'closed'].includes(String(row.status || '').toLowerCase())).length };
      chartData = [];
    } else if (normalizedReportType === 'transfers') {
      const where = {};
      if (status) where.status = status;
      if (search) {
        where[Op.or] = [
          { transferNumber: { [Op.like]: `%${search}%` } },
          { '$Asset.name$': { [Op.like]: `%${search}%` } },
          { sourceDepartment: { [Op.like]: `%${search}%` } },
          { destinationDepartment: { [Op.like]: `%${search}%` } },
        ];
      }
      if (dateFrom || dateTo) {
        where.transferDate = {};
        if (dateFrom) where.transferDate[Op.gte] = new Date(dateFrom);
        if (dateTo) {
          const endDate = new Date(dateTo);
          endDate.setHours(23, 59, 59, 999);
          where.transferDate[Op.lte] = endDate;
        }
      }
      const result = await Transfer.findAndCountAll({
        where,
        include: [
          { model: Asset, where: { collegeId, ...(departmentId ? { departmentId } : {}) }, required: true, attributes: ['id', 'name', 'assetCode'] },
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
    } else if (normalizedReportType === 'returns') {
      const where = { collegeId };
      if (departmentId) where.departmentId = departmentId;
      if (status) where.status = status;
      if (search) {
        where[Op.or] = [
          { '$Asset.name$': { [Op.like]: `%${search}%` } },
          { reason: { [Op.like]: `%${search}%` } },
          { condition: { [Op.like]: `%${search}%` } },
        ];
      }
      if (dateFrom || dateTo) {
        where.requestedAt = {};
        if (dateFrom) where.requestedAt[Op.gte] = new Date(dateFrom);
        if (dateTo) {
          const endDate = new Date(dateTo);
          endDate.setHours(23, 59, 59, 999);
          where.requestedAt[Op.lte] = endDate;
        }
      }
      const result = await AssetReturn.findAndCountAll({
        where,
        include: [
          { model: Asset, where: { collegeId, ...(departmentId ? { departmentId } : {}) }, required: true, attributes: ['id', 'name', 'assetCode', 'department', 'location'] },
          { model: User, as: 'Requester', required: false, attributes: ['id', 'fullName', 'username'] },
        ],
        order: [['requestedAt', 'DESC'], ['createdAt', 'DESC']],
        limit,
        offset,
      });
      rows = result.rows.map((record) => ({
        id: record.id,
        asset: record.Asset?.name || `Asset ${record.assetId}`,
        returnedBy: record.Requester ? (record.Requester.fullName || record.Requester.username) : '—',
        department: record.Asset?.department || '—',
        returnDate: record.requestedAt || record.createdAt,
        condition: record.condition || '—',
        status: record.status || 'Requested',
      }));
      total = result.count;
      summary = { totalReturns: result.count };
    } else if (normalizedReportType === 'maintenance') {
      const where = {};
      if (status) where.status = status;
      if (search) {
        where[Op.or] = [
          { title: { [Op.like]: `%${search}%` } },
          { description: { [Op.like]: `%${search}%` } },
          { '$Asset.name$': { [Op.like]: `%${search}%` } },
          { '$Asset.assetCode$': { [Op.like]: `%${search}%` } },
        ];
      }
      if (dateFrom || dateTo) {
        where.createdAt = {};
        if (dateFrom) where.createdAt[Op.gte] = new Date(dateFrom);
        if (dateTo) {
          const endDate = new Date(dateTo);
          endDate.setHours(23, 59, 59, 999);
          where.createdAt[Op.lte] = endDate;
        }
      }
      const result = await Maintenance.findAndCountAll({
        where,
        include: [
          { model: Asset, where: { collegeId, ...(departmentId ? { departmentId } : {}) }, required: true, attributes: ['id', 'name', 'assetCode', 'department', 'location', 'category'] },
          { model: User, as: 'Requester', required: false, attributes: ['id', 'fullName', 'username'] },
          { model: User, as: 'Technician', required: false, attributes: ['id', 'fullName', 'username'] },
        ],
        order: [['createdAt', 'DESC']],
        limit,
        offset,
      });
      rows = result.rows.map((record) => ({
        id: record.id,
        asset: record.Asset?.name || `Asset ${record.assetId}`,
        department: record.Asset?.department || '—',
        location: record.Asset?.location || '—',
        type: record.Asset?.category || 'Maintenance',
        priority: record.priority || 'medium',
        status: record.status || 'pending',
        reportedDate: record.createdAt,
        completedDate: record.updatedAt,
        technician: record.Technician ? (record.Technician.fullName || record.Technician.username) : '—',
      }));
      total = result.count;
      summary = { totalMaintenance: result.count };
    } else if (normalizedReportType === 'verification') {
      const where = { collegeId };
      if (departmentId) where.departmentId = departmentId;
      if (status) where.status = status;
      if (search) {
        where[Op.or] = [
          { name: { [Op.like]: `%${search}%` } },
          { '$Asset.name$': { [Op.like]: `%${search}%` } },
        ];
      }
      if (dateFrom || dateTo) {
        where.createdAt = {};
        if (dateFrom) where.createdAt[Op.gte] = new Date(dateFrom);
        if (dateTo) {
          const endDate = new Date(dateTo);
          endDate.setHours(23, 59, 59, 999);
          where.createdAt[Op.lte] = endDate;
        }
      }
      const result = await VerificationSession.findAndCountAll({
        where,
        include: [
          { model: Department, attributes: ['id', 'name', 'code'], required: false },
          { model: User, as: 'Starter', attributes: ['id', 'fullName', 'username'], required: false },
          { model: VerificationItem, required: false, include: [{ model: Asset, where: { collegeId, ...(departmentId ? { departmentId } : {}) }, required: false, attributes: ['id', 'name', 'assetCode', 'location'] }] },
        ],
        order: [['createdAt', 'DESC']],
        limit,
        offset,
      });
      rows = result.rows.map((session) => ({
        id: session.id,
        verificationSession: session.name,
        asset: (session.VerificationItems || [])[0]?.Asset?.name || '—',
        department: session.Department?.name || '—',
        location: (session.VerificationItems || [])[0]?.Asset?.location || '—',
        verificationStatus: session.status,
        verifiedBy: session.Starter ? (session.Starter.fullName || session.Starter.username) : '—',
        verificationDate: session.createdAt,
        discrepancy: (session.VerificationItems || []).filter((item) => String(item.state || '').trim().toLowerCase() !== 'verified').length ? 'Detected' : 'None',
      }));
      total = result.count;
      summary = { totalSessions: result.count };
    } else if (normalizedReportType === 'requests') {
      const where = { departmentId: { [Op.ne]: null } };
      if (departmentId) where.departmentId = departmentId;
      if (status) where.status = status;
      if (search) {
        where[Op.or] = [
          { item: { [Op.like]: `%${search}%` } },
          { type: { [Op.like]: `%${search}%` } },
          { '$Requester.fullName$': { [Op.like]: `%${search}%` } },
          { '$Department.name$': { [Op.like]: `%${search}%` } },
        ];
      }
      if (dateFrom || dateTo) {
        where.createdAt = {};
        if (dateFrom) where.createdAt[Op.gte] = new Date(dateFrom);
        if (dateTo) {
          const endDate = new Date(dateTo);
          endDate.setHours(23, 59, 59, 999);
          where.createdAt[Op.lte] = endDate;
        }
      }
      const result = await Approval.findAndCountAll({
        where,
        include: [
          { model: Department, attributes: ['id', 'name', 'code'], required: false },
          { model: User, as: 'Requester', required: false, attributes: ['id', 'fullName', 'username'] },
          { model: Asset, required: false, where: { collegeId }, attributes: ['id', 'name', 'category'] },
        ],
        order: [['createdAt', 'DESC']],
        limit,
        offset,
      });
      rows = result.rows.map((request) => ({
        id: request.id,
        requestDate: request.createdAt,
        department: request.Department?.name || '—',
        requester: request.Requester ? (request.Requester.fullName || request.Requester.username) : '—',
        requestedItem: request.item || request.Asset?.name || '—',
        category: request.Asset?.category || '—',
        quantity: request.quantity || 0,
        priority: request.priority || 'medium',
        status: request.status || 'pending',
        updatedDate: request.updatedAt,
      }));
      total = result.count;
      summary = { totalRequests: result.count };
    } else if (normalizedReportType === 'movement') {
      const where = {};
      if (search) {
        where[Op.or] = [
          { movementType: { [Op.like]: `%${search}%` } },
          { notes: { [Op.like]: `%${search}%` } },
          { '$Asset.name$': { [Op.like]: `%${search}%` } },
        ];
      }
      if (dateFrom || dateTo) {
        where.createdAt = {};
        if (dateFrom) where.createdAt[Op.gte] = new Date(dateFrom);
        if (dateTo) {
          const endDate = new Date(dateTo);
          endDate.setHours(23, 59, 59, 999);
          where.createdAt[Op.lte] = endDate;
        }
      }
      const result = await AssetMovement.findAndCountAll({
        where,
        include: [
          { model: Asset, where: { collegeId, ...(departmentId ? { departmentId } : {}) }, required: true, attributes: ['id', 'name', 'assetCode'] },
          { model: User, required: false, attributes: ['id', 'fullName', 'username'] },
        ],
        order: [['createdAt', 'DESC']],
        limit,
        offset,
      });
      rows = result.rows.map((movement) => ({
        id: movement.id,
        date: movement.createdAt,
        asset: movement.Asset?.name || `Asset ${movement.assetId}`,
        movementType: movement.movementType || 'Movement',
        from: movement.sourceId || '—',
        to: movement.destinationId || '—',
        user: movement.User ? (movement.User.fullName || movement.User.username) : '—',
        status: 'Recorded',
        reference: movement.referenceType || '—',
      }));
      total = result.count;
      summary = { totalMovements: result.count };
    }

    res.json({
      success: true,
      reportType: normalizedReportType,
      data: rows,
      summary,
      filters,
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
      charts: chartData,
      college: { id: collegeId, name: req.organizationScope.college?.collegeName || 'College' },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCollegeDashboard,
  getCollegeProfile,
  updateCollegeProfile,
  listCollegeDepartments,
  getCollegeDepartmentOverview,
  getCollegeDepartmentPerformance,
  getCollegeDepartmentReports,
  listCollegeStaff,
  listCollegeAssets,
  getCollegeInventory,
  getCollegeAsset,
  listCollegeRFIDTracking,
  listCollegeLocations,
  createCollegeDepartment,
  updateCollegeDepartment,
  updateCollegeDepartmentStatus,
  deleteCollegeDepartment,
  getCollegeDepartmentDetails,
  listCollegeDepartmentStaff,
  listCollegeDepartmentAssets,
  listCollegeAssignments,
  listCollegeMaintenance,
  getCollegeMaintenance,
  listCollegeVerification,
  getCollegeReports,
  getCollegeAssetAnalytics,
};
