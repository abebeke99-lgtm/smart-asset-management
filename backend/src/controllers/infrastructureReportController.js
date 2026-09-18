const { Op } = require('sequelize');
const {
  Infrastructure,
  Asset,
  Maintenance,
  MaintenanceWorkOrder,
  InfrastructureInspection,
  PreventiveMaintenance,
  Approval,
} = require('../models');

const INFRASTRUCTURE_TERMS = ['infrastructure', 'building', 'facility', 'electrical', 'generator', 'transformer', 'ups', 'inverter', 'solar', 'water', 'pump', 'tank', 'road', 'drainage'];
const CLOSED_STATUSES = ['completed', 'cancelled', 'rejected', 'disposed', 'inactive'];
const text = (value) => String(value || '').trim().toLowerCase();
const isInfrastructure = (row) => INFRASTRUCTURE_TERMS.some((term) => [row.name, row.type, row.category, row.subcategory].map(text).join(' ').includes(term));
const inDateRange = (value, from, to) => {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return (!from || date >= from) && (!to || date <= to);
};
const matches = (row, query, dateField = 'createdAt') => {
  const search = text(query.search);
  const location = text(query.location);
  const status = text(query.status);
  const from = query.dateFrom ? new Date(`${query.dateFrom}T00:00:00`) : null;
  const to = query.dateTo ? new Date(`${query.dateTo}T23:59:59.999`) : null;
  return (!status || text(row.status || row.condition || row.operationalStatus) === status)
    && (!location || [row.location, row.building].map(text).some((value) => value.includes(location)))
    && (!search || Object.values(row).some((value) => text(value).includes(search)))
    && (!from || inDateRange(row[dateField], from, to));
};
const countBy = (rows, field, fallback = 'Unknown') => Object.entries(rows.reduce((result, row) => {
  const key = String(row[field] || fallback);
  result[key] = (result[key] || 0) + 1;
  return result;
}, {})).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
const amount = (rows, field) => rows.reduce((total, row) => total + (Number(row[field]) || 0), 0);
const normalizeType = (value) => {
  const type = text(value);
  if (type === 'assets' || type === 'overview') return 'assets';
  if (type === 'work-orders') return 'work-orders';
  if (type === 'inspection') return 'inspection';
  if (type === 'energy') return 'energy';
  if (type === 'requests') return 'requests';
  return type === 'maintenance' ? 'maintenance' : 'assets';
};
const reportRows = (type, data) => ({
  assets: data.assets,
  maintenance: data.maintenance,
  'work-orders': data.workOrders,
  inspection: data.inspections,
  energy: data.energyAssets,
  requests: data.requests,
}[type] || data.assets);

const getInfrastructureReport = async (req, res) => {
  try {
    const [infrastructureAssets, assets, maintenance, workOrders, inspections, preventive, requests] = await Promise.all([
      Infrastructure.findAll({ raw: true, order: [['createdAt', 'DESC']] }),
      Asset.findAll({ raw: true, order: [['createdAt', 'DESC']] }),
      Maintenance.findAll({ raw: true, order: [['createdAt', 'DESC']] }),
      MaintenanceWorkOrder.findAll({ raw: true, order: [['createdAt', 'DESC']] }),
      InfrastructureInspection.findAll({ raw: true, order: [['inspectionDate', 'DESC']] }),
      PreventiveMaintenance.findAll({ raw: true, order: [['createdAt', 'DESC']] }),
      Approval.findAll({ raw: true, order: [['createdAt', 'DESC']] }),
    ]);
    const assetsInScope = infrastructureAssets.filter((row) => isInfrastructure(row));
    const assetIds = new Set(assets.filter((row) => isInfrastructure(row)).map((row) => row.id));
    const scoped = {
      assets: assetsInScope.filter((row) => matches(row, req.query)),
      maintenance: maintenance.filter((row) => assetIds.has(row.assetId) && matches(row, req.query)),
      workOrders: workOrders.filter((row) => assetIds.has(row.assetId) && matches(row, req.query)),
      inspections: inspections.filter((row) => matches(row, req.query, 'inspectionDate')),
      preventive: preventive.filter((row) => assetIds.has(row.assetId) && matches(row, req.query)),
      requests: requests.filter((row) => matches(row, req.query)),
    };
    const reportType = normalizeType(req.query.reportType || req.query.type);
    const rows = reportRows(reportType, { ...scoped, energyAssets: scoped.assets.filter((row) => ['electrical', 'generator', 'transformer', 'ups', 'inverter', 'solar', 'power'].some((term) => [row.category, row.type, row.subcategory, row.name].map(text).join(' ').includes(term))) });
    const allAssets = scoped.assets;
    const statusCounts = countBy(allAssets, 'status');
    const categoryCounts = countBy(allAssets, 'category');
    const locationCounts = countBy(allAssets, 'location');
    const openWorkOrders = scoped.workOrders.filter((row) => !CLOSED_STATUSES.includes(text(row.status))).length;
    const completedWorkOrders = scoped.workOrders.filter((row) => text(row.status) === 'completed').length;
    const pendingRequests = scoped.requests.filter((row) => text(row.status) === 'pending').length;
    const monthly = {};
    [...scoped.maintenance, ...scoped.workOrders, ...scoped.requests].forEach((row) => {
      const date = new Date(row.createdAt);
      if (Number.isNaN(date.getTime())) return;
      const month = date.toISOString().slice(0, 7);
      monthly[month] = monthly[month] || { month, maintenance: 0, workOrders: 0, requests: 0, cost: 0 };
      if (scoped.maintenance.includes(row)) monthly[month].maintenance += 1;
      if (scoped.workOrders.includes(row)) { monthly[month].workOrders += 1; monthly[month].cost += Number(row.actualCost || row.estimatedCost || 0); }
      if (scoped.requests.includes(row)) monthly[month].requests += 1;
    });
    res.json({
      success: true,
      data: {
        reportType,
        summary: {
          totalAssets: allAssets.length,
          operational: allAssets.filter((row) => ['operational', 'active', 'available', 'working', 'assigned'].includes(text(row.status))).length,
          maintenance: allAssets.filter((row) => text(row.status).includes('maintenance')).length,
          critical: allAssets.filter((row) => ['critical', 'failed', 'damaged', 'missing'].includes(text(row.status)) || ['critical', 'poor'].includes(text(row.condition))).length,
          damaged: allAssets.filter((row) => text(row.status) === 'damaged' || text(row.condition) === 'damaged').length,
          missing: allAssets.filter((row) => text(row.status) === 'missing').length,
          buildings: allAssets.filter((row) => ['building', 'facility'].some((term) => [row.name, row.category, row.type].map(text).join(' ').includes(term))).length,
          electrical: allAssets.filter((row) => ['electrical', 'power'].some((term) => [row.name, row.category, row.type].map(text).join(' ').includes(term))).length,
          generators: allAssets.filter((row) => text(row.category).includes('generator') || text(row.name).includes('generator')).length,
          transformers: allAssets.filter((row) => text(row.category).includes('transformer') || text(row.name).includes('transformer')).length,
          workOrders: scoped.workOrders.length,
          openWorkOrders,
          completedWorkOrders,
          totalRequests: scoped.requests.length,
          pendingRequests,
          totalMaintenance: scoped.maintenance.length,
          completedMaintenance: scoped.maintenance.filter((row) => text(row.status) === 'completed').length,
          maintenanceCost: amount(scoped.maintenance, 'actualCost') + amount(scoped.maintenance, 'estimatedCost'),
          workOrderCost: amount(scoped.workOrders, 'actualCost') + amount(scoped.workOrders, 'estimatedCost'),
        },
        byStatus: statusCounts,
        byCategory: categoryCounts,
        byLocation: locationCounts,
        monthly: Object.values(monthly).sort((a, b) => a.month.localeCompare(b.month)),
        rows,
        preventiveMaintenance: scoped.preventive,
        dataAvailability: { energyMeasurements: false, fuelMeasurements: false, message: 'No energy or fuel measurement records are available in the existing database schema.' },
      },
    });
  } catch (error) {
    console.error('Error generating infrastructure report:', error);
    res.status(500).json({ success: false, message: 'Failed to generate infrastructure report' });
  }
};

const exportInfrastructureReport = async (req, res) => {
  req.query = { ...req.query, reportType: req.query.reportType || req.query.type };
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    const rows = body?.data?.rows || [];
    const headers = ['id', 'name', 'title', 'category', 'location', 'status', 'condition', 'createdAt', 'estimatedCost', 'actualCost'];
    const csv = [headers.join(','), ...rows.map((row) => headers.map((header) => JSON.stringify(row[header] ?? '')).join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="infrastructure-${req.query.reportType || 'overview'}.csv"`);
    return res.send(csv);
  };
  return getInfrastructureReport(req, res);
};

module.exports = { getInfrastructureReport, exportInfrastructureReport };
