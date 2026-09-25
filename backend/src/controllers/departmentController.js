const { Op } = require('sequelize');
const { Asset, User, Department, Location, Approval, Assignment, Transfer, AssetReturn, Maintenance, VerificationSession, AssetMovement } = require('../models');

const pageValues = (query) => {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 25));
  return { page, limit, offset: (page - 1) * limit };
};

const getDepartmentDashboard = async (req, res, next) => {
  try {
    const { departmentId } = req.organizationScope;
    const assetWhere = { departmentId };
    const [assets, staff, approvals, assignments, transfers, returns, maintenanceRows, verificationSessions, recentMovements] = await Promise.all([
      Asset.findAll({ where: { departmentId }, attributes: ['status', 'category', 'location', 'condition', 'currentValue'], raw: true }),
      User.count({ where: { departmentId } }),
      Approval.findAll({ where: { departmentId }, attributes: ['id', 'status', 'type', 'item', 'createdAt'], order: [['createdAt', 'DESC']], limit: 20, raw: true }),
      Assignment.findAll({ where: { status: { [Op.notIn]: ['returned', 'cancelled', 'closed'] } }, include: [{ model: Asset, where: assetWhere, required: true, attributes: [] }], attributes: ['id', 'assignedTo', 'createdAt'], order: [['createdAt', 'DESC']], limit: 20, raw: true }),
      Transfer.findAll({ where: { [Op.or]: [{ sourceDepartmentId: departmentId }, { destinationDepartmentId: departmentId }] }, attributes: ['id', 'status', 'sourceDepartmentId', 'destinationDepartmentId', 'createdAt'], order: [['createdAt', 'DESC']], limit: 20, raw: true }),
      AssetReturn.findAll({ where: { departmentId }, attributes: ['id', 'status', 'createdAt'], order: [['createdAt', 'DESC']], limit: 20, raw: true }),
      Maintenance.findAll({ include: [{ model: Asset, where: assetWhere, required: true, attributes: [] }], attributes: ['id', 'status', 'title', 'createdAt'], order: [['createdAt', 'DESC']], limit: 20, raw: true }),
      VerificationSession.findAll({ where: { departmentId }, attributes: ['id', 'status', 'createdAt'], order: [['createdAt', 'DESC']], limit: 20, raw: true }),
      AssetMovement.findAll({ include: [{ model: Asset, where: assetWhere, required: true, attributes: ['name', 'assetCode'] }], attributes: ['id', 'movementType', 'createdAt'], order: [['createdAt', 'DESC']], limit: 10, raw: true }),
    ]);
    const normalized = (value) => String(value || '').toLowerCase().replace(/[_-]/g, ' ');
    const usable = assets.filter((asset) => !['disposed', 'retired'].includes(normalized(asset.status)));
    const assigned = usable.filter((asset) => ['assigned', 'in use'].includes(normalized(asset.status))).length;
    const groupBy = (key) => Object.entries(assets.reduce((result, item) => {
      const value = String(item[key] || 'Unknown');
      result[value] = (result[value] || 0) + 1;
      return result;
    }, {})).map(([label, value]) => ({ label, value }));
    const countByStatus = (rows) => rows.reduce((result, row) => {
      const status = String(row.status || 'unknown').trim().toLowerCase();
      result[status] = (result[status] || 0) + 1;
      return result;
    }, {});
    const approvalCounts = countByStatus(approvals);
    const transferCounts = countByStatus(transfers);
    const returnCounts = countByStatus(returns);
    const maintenanceCounts = countByStatus(maintenanceRows);
    const verificationCounts = countByStatus(verificationSessions);
    const assignedStaffIds = new Set(assignments.map((assignment) => assignment.assignedTo).filter(Boolean));
    const recentActivities = [
      ...assignments.map((item) => ({ type: 'assignment', title: 'Asset assignment', action: 'Recent assignment', time: item.createdAt })),
      ...transfers.map((item) => ({ type: 'transfer', title: 'Asset transfer', action: item.status || 'Transfer activity', time: item.createdAt })),
      ...returns.map((item) => ({ type: 'return', title: 'Asset return', action: item.status || 'Return activity', time: item.createdAt })),
      ...maintenanceRows.map((item) => ({ type: 'maintenance', title: item.title || 'Maintenance request', action: item.status || 'Maintenance activity', time: item.createdAt })),
      ...verificationSessions.map((item) => ({ type: 'verification', title: 'Verification session', action: item.status || 'Verification activity', time: item.createdAt })),
    ].sort((left, right) => new Date(right.time || 0) - new Date(left.time || 0)).slice(0, 10);
    res.json({ success: true, data: {
      department: req.organizationScope.department.toJSON(),
      totalAssets: assets.length,
      availableAssets: assets.filter((asset) => normalized(asset.status) === 'available').length,
      assignedAssets: assigned,
      underMaintenance: assets.filter((asset) => normalized(asset.status).includes('maintenance')).length,
      missingAssets: assets.filter((asset) => ['missing', 'lost'].includes(normalized(asset.status))).length,
      damagedAssets: assets.filter((asset) => normalized(asset.status) === 'damaged').length,
      staffCount: staff,
      assetValue: assets.reduce((total, asset) => total + Number(asset.currentValue || 0), 0),
      utilizationRate: usable.length ? assigned / usable.length : 0,
      assetByStatus: groupBy('status'),
      assetByCategory: groupBy('category'),
      assetByLocation: groupBy('location'),
      assetByCondition: groupBy('condition'),
      pendingRequests: approvalCounts.pending || 0,
      pendingTransfers: transferCounts.pending || 0,
      pendingReturns: returnCounts.requested || returnCounts.pending || 0,
      pendingActions: (approvalCounts.pending || 0) + (transferCounts.pending || 0) + (returnCounts.requested || returnCounts.pending || 0),
      staffWithAssignedAssets: assignedStaffIds.size,
      staffWithoutAssignedAssets: Math.max(0, staff - assignedStaffIds.size),
      maintenanceSummary: {
        open: (maintenanceCounts.pending || 0) + (maintenanceCounts.approved || 0),
        inProgress: maintenanceCounts['in-progress'] || maintenanceCounts.in_progress || 0,
        completed: maintenanceCounts.completed || 0,
        overdue: maintenanceRows.filter((row) => String(row.status || '').toLowerCase() === 'overdue').length,
      },
      verificationSummary: {
        verifiedAssets: verificationCounts.finalized || 0,
        pendingVerification: (verificationCounts.draft || 0) + (verificationCounts.in_progress || 0) + (verificationCounts.submitted || 0),
        verificationIssues: 0,
      },
      recentActivities,
    }});
  } catch (error) { next(error); }
};

const listDepartmentAssets = async (req, res, next) => {
  try {
    const { page, limit, offset } = pageValues(req.query);
    const where = { departmentId: req.organizationScope.departmentId };
    if (req.query.category) where.category = String(req.query.category);
    if (req.query.status) where.status = String(req.query.status);
    if (req.query.location) where.location = String(req.query.location);
    if (req.query.search) where[Op.or] = [{ name: { [Op.like]: `%${String(req.query.search).trim()}%` } }, { assetCode: { [Op.like]: `%${String(req.query.search).trim()}%` } }, { serialNumber: { [Op.like]: `%${String(req.query.search).trim()}%` } }, { rfidTag: { [Op.like]: `%${String(req.query.search).trim()}%` } }];
    const { count, rows } = await Asset.findAndCountAll({ where, order: [['updatedAt', 'DESC']], limit, offset });
    res.json({ success: true, data: rows, pagination: { page, limit, total: count, pages: Math.ceil(count / limit) } });
  } catch (error) { next(error); }
};

const listDepartmentStaff = async (req, res, next) => {
  try {
    const { page, limit, offset } = pageValues(req.query);
    const scope = { departmentId: req.organizationScope.departmentId };
    if (req.organizationScope.collegeId) scope.collegeId = req.organizationScope.collegeId;
    const where = { ...scope };
    const search = String(req.query.search || '').trim();
    if (search) {
      const searchFields = [
        { fullName: { [Op.like]: `%${search}%` } },
        { username: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { phone: { [Op.like]: `%${search}%` } },
        { role: { [Op.like]: `%${search}%` } },
      ];
      if (/^\d+$/.test(search)) searchFields.push({ id: Number(search) });
      where[Op.or] = searchFields;
    }
    if (req.query.role) where.role = String(req.query.role).trim();
    if (req.query.status === 'active') where.active = true;
    if (req.query.status === 'inactive') where.active = false;

    const [result, active, inactive, total] = await Promise.all([
      User.findAndCountAll({ where, attributes: { exclude: ['password'] }, order: [['fullName', 'ASC']], limit, offset }),
      User.count({ where: { ...scope, active: true } }),
      User.count({ where: { ...scope, active: false } }),
      User.count({ where: scope }),
    ]);
    res.json({ success: true, data: result.rows, summary: { total, active, inactive }, pagination: { page, limit, total: result.count, pages: Math.ceil(result.count / limit) } });
  } catch (error) { next(error); }
};

const listDepartmentLocations = async (req, res, next) => {
  try {
    const { departmentId } = req.organizationScope;
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 25));
    const search = String(req.query.search || '').trim().toLowerCase();
    const status = String(req.query.status || '').trim().toLowerCase();
    const [department, assets] = await Promise.all([
      Department.findByPk(departmentId, {
        include: [
          { model: Location, as: 'LocationRecord', required: false, attributes: ['id', 'name', 'code', 'description', 'status'] },
          { model: require('../models').College, required: false, attributes: ['id', 'collegeName', 'collegeCode'] },
        ],
      }),
      Asset.findAll({ where: { departmentId }, attributes: ['location'], raw: true }),
    ]);
    const assetLocationNames = [...new Set(assets.map((asset) => String(asset.location || '').trim()).filter(Boolean))];
    const locationRecords = assetLocationNames.length
      ? await Location.findAll({ where: { name: { [Op.in]: assetLocationNames } }, attributes: ['id', 'name', 'code', 'description', 'status'], raw: true })
      : [];
    const locationRecordsByName = new Map(locationRecords.map((location) => [location.name, location]));
    const locations = new Map();
    if (department?.LocationRecord?.name) {
      locations.set(department.LocationRecord.name, { ...department.LocationRecord.toJSON(), assetCount: 0 });
    }
    assets.forEach((asset) => {
      const name = String(asset.location || '').trim();
      if (!name) return;
      const current = locations.get(name) || { ...(locationRecordsByName.get(name) || {}), id: locationRecordsByName.get(name)?.id || null, name, assetCount: 0 };
      current.assetCount += 1;
      locations.set(name, current);
    });
    const allLocations = Array.from(locations.values()).sort((left, right) => left.name.localeCompare(right.name));
    const filteredLocations = allLocations.filter((location) => {
      const matchesStatus = !status || status === 'all' || String(location.status || '').toLowerCase() === status;
      const searchable = [location.id, location.name, location.code, location.description, location.status]
        .map((value) => String(value || '').toLowerCase());
      return matchesStatus && (!search || searchable.some((value) => value.includes(search)));
    });
    const total = filteredLocations.length;
    const rows = filteredLocations.slice((page - 1) * limit, page * limit);
    const summary = {
      total: allLocations.length,
      active: allLocations.filter((location) => location.status === 'active').length,
      inactive: allLocations.filter((location) => location.status === 'inactive').length,
      locationsWithAssets: allLocations.filter((location) => Number(location.assetCount || 0) > 0).length,
    };
    return res.json({
      success: true,
      data: rows,
      department: department ? { id: department.id, name: department.name, code: department.code, collegeId: department.collegeId } : null,
      college: department?.College ? { id: department.College.id, name: department.College.collegeName, code: department.College.collegeCode } : null,
      summary,
      pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)), totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (error) {
    return next(error);
  }
};

const getDepartmentReports = async (req, res, next) => {
  try {
    const departmentId = req.organizationScope.departmentId;
    const reportType = String(req.query.reportType || 'assets').trim().toLowerCase();
    const supportedReports = ['assets', 'utilization', 'maintenance', 'staff', 'approvals'];
    if (!supportedReports.includes(reportType)) {
      return res.status(422).json({ success: false, message: 'Unsupported department report type' });
    }

    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));
    const offset = (page - 1) * limit;
    const search = String(req.query.search || '').trim();
    const dateFrom = String(req.query.dateFrom || '').trim();
    const dateTo = String(req.query.dateTo || '').trim();
    if (dateFrom && Number.isNaN(Date.parse(dateFrom))) return res.status(422).json({ success: false, message: 'Date from is invalid' });
    if (dateTo && Number.isNaN(Date.parse(dateTo))) return res.status(422).json({ success: false, message: 'Date to is invalid' });
    if (dateFrom && dateTo && new Date(dateFrom) > new Date(dateTo)) return res.status(422).json({ success: false, message: 'Date from must be before date to' });

    const dateWhere = (field) => {
      if (!dateFrom && !dateTo) return {};
      const value = {};
      if (dateFrom) value[Op.gte] = new Date(dateFrom);
      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        value[Op.lte] = endDate;
      }
      return { [field]: value };
    };

    let rows;
    let total;
    let summary = {};
    if (reportType === 'assets' || reportType === 'utilization') {
      const where = { departmentId, ...dateWhere('purchaseDate') };
      if (req.query.category) where.category = String(req.query.category);
      if (req.query.location) where.location = String(req.query.location);
      if (req.query.status) where.status = String(req.query.status);
      if (search) where[Op.or] = [{ name: { [Op.like]: `%${search}%` } }, { assetCode: { [Op.like]: `%${search}%` } }, { serialNumber: { [Op.like]: `%${search}%` } }];
      const result = await Asset.findAndCountAll({
        where,
        include: [{ model: Assignment, required: false, include: [{ model: User, required: false, attributes: ['id', 'fullName', 'username'] }] }],
        order: [['updatedAt', 'DESC']],
        limit,
        offset,
        distinct: true,
      });
      rows = result.rows.map((asset) => {
        const activeAssignment = asset.Assignments?.find((assignment) => !['returned', 'cancelled', 'closed'].includes(String(assignment.status || '').toLowerCase()));
        return { ...asset.toJSON(), asset_tag: asset.assetCode, category_name: asset.category, current_value: asset.currentValue, purchase_cost: asset.purchasePrice, purchase_date: asset.purchaseDate, assigned_to_name: activeAssignment?.User?.fullName || activeAssignment?.User?.username || '' };
      });
      total = result.count;
      const allAssets = await Asset.findAll({ where, attributes: ['status', 'currentValue', 'purchasePrice', 'category', 'location'], raw: true });
      const normalize = (value) => String(value || '').trim().toLowerCase().replace(/[_-]/g, ' ');
      const usableAssets = allAssets.filter((asset) => !['disposed', 'retired'].includes(normalize(asset.status)));
      const assignedAssets = usableAssets.filter((asset) => ['assigned', 'in use', 'issued'].includes(normalize(asset.status))).length;
      summary = {
        totalAssets: allAssets.length,
        inUse: assignedAssets,
        available: allAssets.filter((asset) => ['available', 'ready', 'idle'].includes(normalize(asset.status))).length,
        underMaintenance: allAssets.filter((asset) => normalize(asset.status).includes('maintenance') || normalize(asset.status) === 'in repair').length,
        disposed: allAssets.filter((asset) => ['disposed', 'retired'].includes(normalize(asset.status))).length,
        totalValue: allAssets.reduce((sum, asset) => sum + Number(asset.currentValue || asset.purchasePrice || 0), 0),
        byCategory: allAssets.reduce((result, asset) => { const key = asset.category || 'Other'; result[key] = (result[key] || 0) + 1; return result; }, {}),
        byLocation: allAssets.reduce((result, asset) => { const key = asset.location || 'Unknown'; result[key] = (result[key] || 0) + 1; return result; }, {}),
        utilizationRate: usableAssets.length ? Number(((assignedAssets / usableAssets.length) * 100).toFixed(2)) : 0,
      };
    } else if (reportType === 'maintenance') {
      const where = { ...dateWhere('createdAt') };
      if (req.query.status) where.status = String(req.query.status);
      if (search) where[Op.or] = [{ title: { [Op.like]: `%${search}%` } }, { description: { [Op.like]: `%${search}%` } }];
      const result = await Maintenance.findAndCountAll({ where, include: [{ model: Asset, where: { departmentId }, required: true, attributes: ['name', 'assetCode', 'location'] }], order: [['createdAt', 'DESC']], limit, offset });
      rows = result.rows.map((maintenance) => ({ ...maintenance.toJSON(), request_number: maintenance.id, asset_name: maintenance.Asset?.name, created_at: maintenance.createdAt, completion_date: maintenance.completionDate }));
      total = result.count;
      summary = { totalMaintenance: total };
    } else if (reportType === 'staff') {
      const where = { departmentId };
      if (search) where[Op.or] = [{ fullName: { [Op.like]: `%${search}%` } }, { username: { [Op.like]: `%${search}%` } }, { email: { [Op.like]: `%${search}%` } }];
      const result = await User.findAndCountAll({ where, attributes: { exclude: ['password'] }, order: [['fullName', 'ASC']], limit, offset });
      const assignments = await Assignment.findAll({ where: { status: { [Op.notIn]: ['returned', 'cancelled', 'closed'] } }, include: [{ model: Asset, where: { departmentId }, required: true, attributes: [] }], attributes: ['assignedTo'], raw: true });
      const assignedCounts = assignments.reduce((counts, assignment) => { counts[assignment.assignedTo] = (counts[assignment.assignedTo] || 0) + 1; return counts; }, {});
      rows = result.rows.map((staff) => ({ ...staff.toJSON(), assigned_assets: assignedCounts[staff.id] || 0 }));
      total = result.count;
      summary = { totalStaff: total, staffWithAssets: rows.filter((staff) => staff.assigned_assets > 0).length };
    } else {
      const where = { departmentId, ...dateWhere('createdAt') };
      if (req.query.status) where.status = String(req.query.status);
      const result = await Approval.findAndCountAll({ where, order: [['createdAt', 'DESC']], limit, offset });
      rows = result.rows.map((approval) => ({ ...approval.toJSON(), request_id: approval.id, created_at: approval.createdAt }));
      total = result.count;
      summary = { totalApprovals: total, pendingApprovals: rows.filter((row) => String(row.status).toLowerCase() === 'pending').length };
    }

    return res.json({ success: true, reportType, data: rows, summary, pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } });
  } catch (error) {
    return next(error);
  }
};

module.exports = { getDepartmentDashboard, listDepartmentAssets, listDepartmentStaff, listDepartmentLocations, getDepartmentReports };
