const { Op, fn, col } = require('sequelize');
const {
  Asset,
  Assignment,
  Approval,
  DepartmentAssetVerification,
  Inventory,
  Maintenance,
  Room,
  ServiceRequest,
  Transfer,
  User,
} = require('../models');

const countBy = async (Model, field, where, options = {}) => {
  const rows = await Model.findAll({
    where,
    attributes: [field, [fn('COUNT', col('id')), 'count']],
    group: [field],
    raw: true,
    ...options,
  });
  return rows.map((row) => ({ label: String(row[field] || 'Unknown'), count: Number(row.count || 0) }));
};

const hasExceptions = (value) => {
  if (value == null || value === '') return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed) || (parsed && typeof parsed === 'object')) return hasExceptions(parsed);
    } catch {
      return true;
    }
    return value.trim().length > 0;
  }
  return Boolean(value);
};

const getDepartmentAnalytics = async (departmentId, dateRange = {}) => {
  const dateFilter = dateRange.from || dateRange.to
    ? { createdAt: { ...(dateRange.from ? { [Op.gte]: dateRange.from } : {}), ...(dateRange.to ? { [Op.lte]: dateRange.to } : {}) } }
    : {};
  const assetWhere = { departmentId };
  const requestWhere = { departmentId, ...dateFilter };
  const assignmentWhere = { departmentId, ...dateFilter };
  const transferWhere = {
    [Op.or]: [{ sourceDepartmentId: departmentId }, { destinationDepartmentId: departmentId }],
    ...dateFilter,
  };

  const [
    assetStatuses,
    assetConditions,
    assignmentStatuses,
    inventoryRows,
    approvalStatuses,
    serviceStatuses,
    serviceRequests,
    transferStatuses,
    maintenanceStatuses,
    verificationRows,
    laboratoryCount,
  ] = await Promise.all([
    countBy(Asset, 'status', assetWhere),
    countBy(Asset, 'condition', assetWhere),
    countBy(Assignment, 'status', assignmentWhere),
    Inventory.findAll({
      where: { departmentId },
      attributes: ['quantity', 'availableQuantity', 'reservedQuantity', 'damagedQuantity', 'minimumQuantity'],
      include: [{ model: Asset, where: assetWhere, attributes: [], required: true }],
      raw: true,
    }),
    countBy(Approval, 'status', requestWhere),
    countBy(ServiceRequest, 'status', requestWhere),
    ServiceRequest.findAll({
      where: requestWhere,
      attributes: ['createdAt', 'acknowledgedAt', 'status', 'escalated', 'dueDate'],
      raw: true,
    }),
    countBy(Transfer, 'status', transferWhere),
    Maintenance.findAll({
      where: dateFilter,
      attributes: ['status'],
      include: [{ model: Asset, where: assetWhere, attributes: [], required: true }],
      raw: true,
    }),
    DepartmentAssetVerification.findAll({
      where: dateRange.from || dateRange.to
        ? { departmentId, verificationDate: { ...(dateRange.from ? { [Op.gte]: dateRange.from } : {}), ...(dateRange.to ? { [Op.lte]: dateRange.to } : {}) } }
        : { departmentId },
      attributes: ['actualCondition', 'expectedCondition', 'actualLocation', 'expectedLocation', 'exceptions'],
      raw: true,
    }),
    Room.count({ where: { departmentId, roomType: { [Op.like]: '%lab%' } } }),
  ]);

  return {
    assetUtilization: {
      statuses: assetStatuses,
      total: assetStatuses.reduce((sum, row) => sum + row.count, 0),
      assignments: assignmentStatuses,
      activeAssignments: assignmentStatuses
        .filter((row) => ['active', 'assigned'].includes(row.label.toLowerCase()))
        .reduce((sum, row) => sum + row.count, 0),
    },
    assetCondition: {
      conditions: assetConditions,
      discrepancies: verificationRows.filter((row) => (
        String(row.actualCondition || '').toLowerCase() !== String(row.expectedCondition || '').toLowerCase()
        || String(row.actualLocation || '').toLowerCase() !== String(row.expectedLocation || '').toLowerCase()
        || hasExceptions(row.exceptions)
      )).length,
    },
    inventory: inventoryRows.reduce((summary, row) => {
      summary.totalItems += 1;
      summary.quantity += Number(row.quantity || 0);
      summary.available += Number(row.availableQuantity || 0);
      summary.reserved += Number(row.reservedQuantity || 0);
      summary.damaged += Number(row.damagedQuantity || 0);
      if (Number(row.availableQuantity || 0) <= Number(row.minimumQuantity || 0)) summary.lowStock += 1;
      return summary;
    }, { totalItems: 0, quantity: 0, available: 0, reserved: 0, damaged: 0, lowStock: 0 }),
    approvals: approvalStatuses,
    service: {
      statuses: serviceStatuses,
      maintenanceStatuses: maintenanceStatuses.reduce((summary, row) => {
        const status = String(row.status || 'Unknown');
        summary[status] = (summary[status] || 0) + 1;
        return summary;
      }, {}),
    },
    ticketAging: serviceRequests.reduce((summary, request) => {
      if (request.acknowledgedAt || ['completed', 'cancelled', 'closed'].includes(String(request.status || '').toLowerCase())) return summary;
      const createdAt = new Date(request.createdAt).getTime();
      if (!Number.isFinite(createdAt)) return summary;
      const now = Date.now();
      const ageHours = Math.max(0, (now - createdAt) / 3_600_000);
      if (ageHours < 24) summary.under24Hours += 1;
      else if (ageHours < 72) summary.from24To72Hours += 1;
      else summary.over72Hours += 1;
      if (request.escalated || String(request.status || '').toLowerCase() === 'escalated') summary.escalated += 1;
      const dueDate = request.dueDate ? new Date(request.dueDate).getTime() : NaN;
      if (Number.isFinite(dueDate) && dueDate < now) summary.overdue += 1;
      return summary;
    }, { under24Hours: 0, from24To72Hours: 0, over72Hours: 0, escalated: 0, overdue: 0 }),
    transfers: transferStatuses,
    laboratories: laboratoryCount,
  };
};

const getDepartmentReport = async (departmentId, type, { page, limit, search, status, from, to }) => {
  const dateWhere = from || to ? { createdAt: { ...(from ? { [Op.gte]: from } : {}), ...(to ? { [Op.lte]: to } : {}) } } : {};
  const like = (fields) => search ? { [Op.or]: fields.map((field) => ({ [field]: { [Op.like]: `%${search}%` } })) } : {};
  const options = { limit, offset: (page - 1) * limit, order: [['createdAt', 'DESC']], distinct: true };

  if (type === 'assignments') {
    const where = { departmentId, ...dateWhere, ...(status ? { status } : {}), ...like(['status', 'location', 'notes']) };
    return Assignment.findAndCountAll({
      ...options,
      where,
      include: [
        { model: Asset, where: { departmentId }, attributes: ['id', 'name', 'assetCode', 'category', 'status'], required: true },
        { model: User, attributes: ['id', 'fullName', 'username'], required: false },
      ],
    });
  }
  if (type === 'transfers') {
    const where = {
      [Op.and]: [
        { [Op.or]: [{ sourceDepartmentId: departmentId }, { destinationDepartmentId: departmentId }] },
        dateWhere,
        ...(status ? [{ status }] : []),
        ...(search ? [{ [Op.or]: ['transferNumber', 'sourceDepartment', 'destinationDepartment', 'newLocation'].map((field) => ({ [field]: { [Op.like]: `%${search}%` } })) }] : []),
      ],
    };
    return Transfer.findAndCountAll({
      ...options,
      where,
      include: [{ model: Asset, attributes: ['id', 'name', 'assetCode', 'departmentId'], required: false }],
    });
  }
  if (type === 'verification') {
    const where = {
      departmentId,
      ...(from || to ? { verificationDate: { ...(from ? { [Op.gte]: from } : {}), ...(to ? { [Op.lte]: to } : {}) } } : {}),
      ...(search ? { [Op.or]: ['assetName', 'assetCode', 'actualLocation', 'actualCondition', 'exceptions'].map((field) => ({ [field]: { [Op.like]: `%${search}%` } })) } : {}),
    };
    return DepartmentAssetVerification.findAndCountAll({
      ...options,
      where,
      order: [['verificationDate', 'DESC']],
      include: [
        { model: Asset, where: { departmentId }, attributes: ['id', 'name', 'assetCode'], required: true },
        { model: User, as: 'Verifier', attributes: ['id', 'fullName', 'username'], required: false },
      ],
    });
  }
  if (type === 'escalations') {
    const where = {
      departmentId,
      escalated: true,
      ...dateWhere,
      ...(status ? { status } : {}),
      ...like(['requestCode', 'title', 'category', 'escalationReason']),
    };
    return ServiceRequest.findAndCountAll({
      ...options,
      where,
      order: [['escalatedAt', 'DESC']],
      attributes: ['id', 'requestCode', 'title', 'category', 'priority', 'status', 'createdAt', 'acknowledgedAt', 'escalatedAt', 'escalatedTo', 'escalationReason'],
    });
  }
  if (type === 'inventory') {
    const where = { departmentId };
    return Inventory.findAndCountAll({
      ...options,
      where,
      include: [{
        model: Asset,
        where: { departmentId, ...(search ? { [Op.or]: ['name', 'assetCode', 'category', 'serialNumber'].map((field) => ({ [field]: { [Op.like]: `%${search}%` } })) } : {}), ...(status ? { status } : {}) },
        attributes: ['id', 'name', 'assetCode', 'category', 'serialNumber', 'status', 'condition'],
        required: true,
      }],
    });
  }
  return null;
};

module.exports = { getDepartmentAnalytics, getDepartmentReport };
