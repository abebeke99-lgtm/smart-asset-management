const { Op, fn, col } = require('sequelize');
const { Asset, User, Department, Maintenance, Approval, Transfer, AuditLog, College, AssetReturn, VerificationSession, VerificationItem, Assignment } = require('../models');

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

module.exports = { getCollegeDashboard };

const pagination = (query, defaultLimit = 25) => {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || defaultLimit));
  return { page, limit, offset: (page - 1) * limit };
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
    const department = await getScopedDepartment(req, req.params.id);
    if (!department) return res.status(404).json({ success: false, message: 'Department not found in your college' });
    req.query.departmentId = department.id;
    return listCollegeAssets(req, res, next);
  } catch (error) { next(error); }
};

module.exports = { getCollegeDashboard, getCollegeProfile, updateCollegeProfile, listCollegeDepartments, getCollegeDepartmentOverview, listCollegeStaff, listCollegeAssets, getCollegeInventory, getCollegeAsset, listCollegeLocations, createCollegeDepartment, updateCollegeDepartment, updateCollegeDepartmentStatus, deleteCollegeDepartment, getCollegeDepartmentDetails, listCollegeDepartmentStaff, listCollegeDepartmentAssets, listCollegeAssignments };
