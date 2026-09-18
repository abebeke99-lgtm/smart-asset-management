// ==============================================
// Infrastructure Controller
// ==============================================
const { sequelize } = require('../config/database');
const { Infrastructure, InfrastructureInspection, MaintenanceWorkOrder, Maintenance, Asset, User, AuditLog } = require('../models');
const { Op } = require('sequelize');

const transformerStatuses = ['Operational', 'Under Maintenance', 'Inactive', 'Disposed'];
const transformerConditions = ['Excellent', 'Good', 'Fair', 'Poor', 'Critical'];
const transformerWhere = (query = {}) => {
  const where = { [Op.or]: [{ category: { [Op.like]: '%Transformer%' } }, { subcategory: { [Op.like]: '%Transformer%' } }, { type: { [Op.like]: '%Transformer%' } }, { name: { [Op.like]: '%Transformer%' } }] };
  const search = String(query.search || '').trim();
  if (search) where[Op.and] = [{ [Op.or]: ['name', 'assetCode', 'serialNumber', 'manufacturer', 'model', 'building', 'location'].map((field) => ({ [field]: { [Op.like]: `%${search}%` } })) }];
  if (query.status) where.status = query.status;
  if (query.condition) where.condition = query.condition;
  if (query.type) where.subcategory = query.type;
  if (query.location) where.location = query.location;
  return where;
};
const transformerResponse = (asset) => {
  const data = asset.toJSON ? asset.toJSON() : asset;
  const specifications = data.specifications && typeof data.specifications === 'object' ? data.specifications : {};
  return { ...data, transformerType: data.subcategory || data.type, ...specifications, specifications };
};
const transformerPayload = (body, existing = {}) => {
  const specifications = { ...(existing.specifications || {}) };
  ['capacity', 'primaryVoltage', 'secondaryVoltage', 'phase', 'frequency', 'coolingType', 'oilCapacity'].forEach((field) => {
    if (body[field] !== undefined) specifications[field] = body[field] === '' ? null : body[field];
  });
  return { name: String(body.name || '').trim(), assetCode: String(body.assetCode ?? body.code ?? '').trim() || undefined, type: 'Transformer', category: 'Transformer', subcategory: String(body.transformerType ?? body.subcategory ?? '').trim() || undefined, description: body.description === undefined ? existing.description : String(body.description || '').trim(), serialNumber: String(body.serialNumber || '').trim() || undefined, location: String(body.location || '').trim() || undefined, building: String(body.building || '').trim() || undefined, room: String(body.room || '').trim() || undefined, status: body.status || existing.status || 'Operational', condition: body.condition || existing.condition || 'Good', manufacturer: String(body.manufacturer || '').trim() || undefined, model: String(body.model || '').trim() || undefined, lastInspectionDate: body.lastInspectionDate || undefined, lastMaintenanceDate: body.lastMaintenanceDate || undefined, department: String(body.department || '').trim() || undefined, notes: body.notes, specifications };
};
const validateTransformerPayload = (payload) => {
  if (!payload.name) return 'Transformer name is required';
  if (!payload.subcategory) return 'Transformer type is required';
  if (!payload.location) return 'Location is required';
  if (!transformerStatuses.includes(payload.status)) return 'Invalid transformer status';
  if (!transformerConditions.includes(payload.condition)) return 'Invalid transformer condition';
  return null;
};
const getTransformers = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
    const where = transformerWhere(req.query);
    const [{ count, rows }, summaryRows, filterRows] = await Promise.all([Infrastructure.findAndCountAll({ where, order: [['createdAt', 'DESC']], limit, offset: (page - 1) * limit }), Infrastructure.findAll({ where: transformerWhere(), attributes: ['status', 'condition', 'location'], raw: true }), Promise.all(['subcategory', 'status', 'condition', 'location'].map((field) => Infrastructure.findAll({ where: transformerWhere(), attributes: [field], group: [field], order: [[field, 'ASC']], raw: true })))]);
    const summary = summaryRows.reduce((result, row) => { const status = String(row.status || '').toLowerCase(); const condition = String(row.condition || '').toLowerCase(); result.total += 1; if (status === 'operational') result.operational += 1; if (status === 'under maintenance') result.maintenance += 1; if (status === 'inactive') result.inactive += 1; if (status === 'disposed') result.disposed += 1; if (condition === 'critical') result.critical += 1; return result; }, { total: 0, operational: 0, maintenance: 0, inactive: 0, disposed: 0, critical: 0 });
    return res.json({ success: true, data: rows.map(transformerResponse), summary, filters: { types: filterRows[0].map((row) => row.subcategory).filter(Boolean), statuses: filterRows[1].map((row) => row.status).filter(Boolean), conditions: filterRows[2].map((row) => row.condition).filter(Boolean), locations: filterRows[3].map((row) => row.location).filter(Boolean) }, pagination: { page, limit, total: count, pages: Math.max(1, Math.ceil(count / limit)) } });
  } catch (error) { console.error('Error fetching transformers:', error); return res.status(500).json({ success: false, message: 'Failed to fetch transformers' }); }
};
const getTransformer = async (req, res) => { const asset = await Infrastructure.findOne({ where: { id: req.params.id, ...transformerWhere() } }); if (!asset) return res.status(404).json({ success: false, message: 'Transformer not found' }); return res.json({ success: true, data: transformerResponse(asset) }); };
const createTransformer = async (req, res) => {
  try { const payload = transformerPayload(req.body); const validationError = validateTransformerPayload(payload); if (validationError) return res.status(422).json({ success: false, message: validationError }); const identifiers = [{ assetCode: payload.assetCode }, { serialNumber: payload.serialNumber }].filter((item) => Object.values(item)[0]); if (identifiers.length && await Infrastructure.findOne({ where: { [Op.or]: identifiers } })) return res.status(409).json({ success: false, message: 'Transformer asset number or serial number already exists' }); const asset = await Infrastructure.create({ ...payload, createdBy: req.user.id }); await AuditLog.create({ userId: req.user.id, action: 'CREATE_TRANSFORMER', entity: `infrastructure_asset:${asset.id}`, details: JSON.stringify({ assetId: asset.id }) }); return res.status(201).json({ success: true, data: transformerResponse(asset), message: 'Transformer created successfully' }); } catch (error) { if (error.name === 'SequelizeUniqueConstraintError') return res.status(409).json({ success: false, message: 'Transformer asset number or serial number already exists' }); return res.status(500).json({ success: false, message: 'Failed to create transformer' }); }
};
const updateTransformer = async (req, res) => {
  try { const asset = await Infrastructure.findOne({ where: { id: req.params.id, ...transformerWhere() } }); if (!asset) return res.status(404).json({ success: false, message: 'Transformer not found' }); const payload = transformerPayload(req.body, asset.toJSON()); const validationError = validateTransformerPayload(payload); if (validationError) return res.status(422).json({ success: false, message: validationError }); const identifiers = [{ assetCode: payload.assetCode }, { serialNumber: payload.serialNumber }].filter((item) => Object.values(item)[0]); if (identifiers.length && await Infrastructure.findOne({ where: { id: { [Op.ne]: asset.id }, [Op.or]: identifiers } })) return res.status(409).json({ success: false, message: 'Transformer asset number or serial number already exists' }); await asset.update(payload); await AuditLog.create({ userId: req.user.id, action: 'UPDATE_TRANSFORMER', entity: `infrastructure_asset:${asset.id}`, details: JSON.stringify({ assetId: asset.id }) }); return res.json({ success: true, data: transformerResponse(asset), message: 'Transformer updated successfully' }); } catch (error) { return res.status(500).json({ success: false, message: 'Failed to update transformer' }); }
};
const deactivateTransformer = async (req, res) => { const asset = await Infrastructure.findOne({ where: { id: req.params.id, ...transformerWhere() } }); if (!asset) return res.status(404).json({ success: false, message: 'Transformer not found' }); await asset.update({ status: 'Inactive' }); await AuditLog.create({ userId: req.user.id, action: 'DEACTIVATE_TRANSFORMER', entity: `infrastructure_asset:${asset.id}`, details: JSON.stringify({ assetId: asset.id }) }); return res.json({ success: true, data: transformerResponse(asset), message: 'Transformer deactivated successfully' }); };

const buildingCategoryWhere = { [Op.or]: [{ category: { [Op.like]: 'Building' } }, { category: { [Op.like]: 'Facility' } }, { category: { [Op.like]: 'building' } }, { category: { [Op.like]: 'facility' } }] };
const buildingAttributes = ['id', 'name', 'type', 'category', 'description', 'assetCode', 'location', 'building', 'block', 'floor', 'room', 'status', 'condition', 'purchaseDate', 'createdAt', 'updatedAt', 'createdBy'];
const normalizeBuilding = (building, relatedAssets = []) => { const data = building.toJSON ? building.toJSON() : building; const names = [String(data.name || '').trim().toLowerCase(), String(data.assetCode || '').trim().toLowerCase()].filter(Boolean); const assets = relatedAssets.filter((asset) => names.includes(String(asset.building || '').trim().toLowerCase())); return { ...data, code: data.assetCode || null, floors: new Set(assets.map((asset) => String(asset.floor || '').trim()).filter(Boolean)).size, rooms: new Set(assets.map((asset) => String(asset.room || '').trim()).filter(Boolean)).size, assetCount: assets.length, associatedAssets: assets.map((asset) => ({ id: asset.id, name: asset.name, assetCode: asset.assetCode, category: asset.category, status: asset.status, condition: asset.condition, location: asset.location, room: asset.room })) }; };

const getInfrastructureBuildings = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1); const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10)); const search = String(req.query.search || '').trim(); const where = { ...buildingCategoryWhere };
    for (const field of ['status', 'condition', 'type', 'location']) if (String(req.query[field] || '').trim()) where[field] = String(req.query[field]).trim();
    if (search) where[Op.and] = [buildingCategoryWhere, { [Op.or]: ['name', 'assetCode', 'type', 'location', 'building'].map((field) => ({ [field]: { [Op.like]: `%${search}%` } })) }];
    const { count, rows } = await Infrastructure.findAndCountAll({ where, attributes: buildingAttributes, order: [['name', 'ASC'], ['id', 'ASC']], limit, offset: (page - 1) * limit }); const names = rows.flatMap((row) => [row.name, row.assetCode]).filter(Boolean); const relatedAssets = names.length ? await Infrastructure.findAll({ where: { building: { [Op.in]: names } }, attributes: ['id', 'name', 'assetCode', 'category', 'status', 'condition', 'location', 'building', 'floor', 'room'], raw: true }) : [];
    const allBuildings = await Infrastructure.findAll({ where: buildingCategoryWhere, attributes: ['status'], raw: true }); const summary = allBuildings.reduce((result, building) => { result.total += 1; const status = String(building.status || '').toLowerCase(); if (['active', 'operational'].includes(status)) result.active += 1; if (status.includes('maintenance')) result.maintenance += 1; if (['inactive', 'closed', 'demolished'].includes(status)) result.inactive += 1; return result; }, { total: 0, active: 0, maintenance: 0, inactive: 0 });
    return res.json({ success: true, data: rows.map((row) => normalizeBuilding(row, relatedAssets)), summary, filters: { statuses: [...new Set(allBuildings.map((row) => row.status).filter(Boolean))].sort() }, pagination: { page, limit, total: count, pages: Math.max(1, Math.ceil(count / limit)), totalPages: Math.max(1, Math.ceil(count / limit)) } });
  } catch (error) { console.error('Error fetching infrastructure buildings:', error); return res.status(500).json({ success: false, message: 'Failed to fetch buildings and facilities' }); }
};

const getInfrastructureBuilding = async (req, res) => {
  try { const building = await Infrastructure.findOne({ where: { id: req.params.id, ...buildingCategoryWhere }, attributes: buildingAttributes }); if (!building) return res.status(404).json({ success: false, message: 'Building not found' }); const data = building.toJSON(); const relatedAssets = await Infrastructure.findAll({ where: { building: { [Op.in]: [data.name, data.assetCode].filter(Boolean) } }, attributes: ['id', 'name', 'assetCode', 'category', 'status', 'condition', 'location', 'building', 'floor', 'room'], raw: true }); return res.json({ success: true, data: normalizeBuilding(building, relatedAssets) }); } catch (error) { console.error('Error fetching infrastructure building:', error); return res.status(500).json({ success: false, message: 'Failed to fetch building details' }); }
};

const saveInfrastructureBuilding = async (req, res) => {
  try { const body = req.body || {}; const payload = { name: String(body.name || '').trim(), type: String(body.type || 'Building').trim(), category: 'Building', description: String(body.description || '').trim(), assetCode: String(body.code || body.assetCode || '').trim() || null, location: String(body.location || '').trim(), status: String(body.status || 'active').trim().toLowerCase(), condition: String(body.condition || 'Good').trim() }; if (!payload.name || !payload.location) return res.status(422).json({ success: false, message: 'Building name and location are required' }); if (!['active', 'inactive', 'maintenance', 'closed'].includes(payload.status)) return res.status(422).json({ success: false, message: 'Invalid building status' }); if (payload.assetCode) { const duplicate = await Infrastructure.findOne({ where: { assetCode: payload.assetCode, ...(req.params.id ? { id: { [Op.ne]: req.params.id } } : {}) } }); if (duplicate) return res.status(409).json({ success: false, message: 'A building with this code already exists' }); } let building; if (req.params.id) { building = await Infrastructure.findOne({ where: { id: req.params.id, ...buildingCategoryWhere } }); if (!building) return res.status(404).json({ success: false, message: 'Building not found' }); await building.update(payload); } else building = await Infrastructure.create({ ...payload, createdBy: req.user.id }); await AuditLog.create({ userId: req.user.id, action: req.params.id ? 'UPDATE_INFRASTRUCTURE_BUILDING' : 'CREATE_INFRASTRUCTURE_BUILDING', entity: `infrastructure_building:${building.id}`, details: JSON.stringify({ buildingId: building.id, organizationScope: req.user.collegeId || null }) }); return res.status(req.params.id ? 200 : 201).json({ success: true, data: normalizeBuilding(building), message: req.params.id ? 'Building updated successfully' : 'Building created successfully' }); } catch (error) { console.error('Error saving infrastructure building:', error); if (error.name === 'SequelizeUniqueConstraintError') return res.status(409).json({ success: false, message: 'A building with this code already exists' }); return res.status(500).json({ success: false, message: 'Failed to save building' }); }
};

const deactivateInfrastructureBuilding = async (req, res) => {
  try { const building = await Infrastructure.findOne({ where: { id: req.params.id, ...buildingCategoryWhere } }); if (!building) return res.status(404).json({ success: false, message: 'Building not found' }); const relatedAssets = await Infrastructure.count({ where: { building: { [Op.in]: [building.name, building.assetCode].filter(Boolean) }, id: { [Op.ne]: building.id } } }); const inspections = await InfrastructureInspection.count({ where: { assetId: building.id } }); if (relatedAssets || inspections) return res.status(409).json({ success: false, message: 'Building cannot be deleted because it has related assets or inspection history. Deactivate it instead.' }); await building.update({ status: 'inactive' }); await AuditLog.create({ userId: req.user.id, action: 'DEACTIVATE_INFRASTRUCTURE_BUILDING', entity: `infrastructure_building:${building.id}`, details: JSON.stringify({ buildingId: building.id, organizationScope: req.user.collegeId || null }) }); return res.json({ success: true, data: normalizeBuilding(building), message: 'Building deactivated successfully' }); } catch (error) { console.error('Error deactivating infrastructure building:', error); return res.status(500).json({ success: false, message: 'Failed to deactivate building' }); }
};

const getInfrastructureDashboard = async (req, res) => {
  try {
    const assets = await Infrastructure.findAll({
      order: [['createdAt', 'DESC']],
      raw: true
    });

    const normalize = (value) => String(value || '').trim().toLowerCase();
    const includesAny = (asset, terms) => {
      const searchable = [asset.name, asset.type, asset.category, asset.subcategory]
        .map(normalize)
        .join(' ');
      return terms.some((term) => searchable.includes(term));
    };

    const infrastructureAssets = assets.filter((asset) => includesAny(asset, [
      'infrastructure', 'building', 'facility', 'electrical', 'generator',
      'transformer', 'ups', 'inverter', 'solar', 'water', 'pump', 'tank',
      'road', 'drainage'
    ]));
    const count = (items) => items.length;
    const buildings = infrastructureAssets.filter((asset) => includesAny(asset, ['building', 'facility']));
    const electricalSystems = infrastructureAssets.filter((asset) => includesAny(asset, ['electrical', 'power']));
    const underMaintenance = infrastructureAssets.filter((asset) => [
      'maintenance', 'in maintenance', 'under maintenance', 'repair', 'under repair'
    ].includes(normalize(asset.status)));
    const criticalAlerts = infrastructureAssets.filter((asset) => [
      'critical', 'damaged', 'failed', 'danger', 'unsafe', 'missing'
    ].includes(normalize(asset.status)));
    const operationalAssets = infrastructureAssets.filter((asset) => [
      'available', 'operational', 'active', 'working', 'assigned'
    ].includes(normalize(asset.status)));
    const generators = infrastructureAssets.filter((asset) => includesAny(asset, ['generator']));
    const transformers = infrastructureAssets.filter((asset) => includesAny(asset, ['transformer']));

    const statusBreakdown = infrastructureAssets.reduce((breakdown, asset) => {
      const status = normalize(asset.status) || 'unknown';
      breakdown[status] = (breakdown[status] || 0) + 1;
      return breakdown;
    }, {});

    let recentWorkOrders = [];
    let openWorkOrders = 0;
    try {
      const workOrders = await MaintenanceWorkOrder.findAll({
        where: { assetId: { [Op.in]: infrastructureAssets.map((asset) => asset.id) } },
        order: [['createdAt', 'DESC']],
        limit: 6,
        raw: true
      });
      recentWorkOrders = workOrders;
      openWorkOrders = workOrders.filter((workOrder) => !['completed', 'cancelled'].includes(normalize(workOrder.status))).length;
    } catch (error) {
      console.warn('Could not load infrastructure work orders:', error.message);
    }

    const criticalAlertCount = criticalAlerts.length;
    const summary = {
      totalInfrastructureAssets: count(infrastructureAssets),
      buildings: count(buildings),
      electricalSystems: count(electricalSystems),
      underMaintenance: count(underMaintenance),
      openWorkOrders,
      criticalAlerts: criticalAlertCount
    };
    const operational = {
      operationalAssets: count(operationalAssets),
      generators: count(generators),
      transformers: count(transformers)
    };

    return res.json({
      success: true,
      data: {
        ...summary,
        ...operational,
        summary,
        operational,
        statusBreakdown,
        recentAssets: infrastructureAssets.slice(0, 8),
        recentWorkOrders
      }
    });
  } catch (error) {
    console.error('Error loading infrastructure dashboard:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load Infrastructure Dashboard'
    });
  }
};

const infrastructureAssetWhere = (req) => {
  const where = {};
  if (req.user?.collegeId) where.collegeId = req.user.collegeId;
  const terms = ['infrastructure', 'building', 'facility', 'electrical', 'generator', 'transformer', 'ups', 'inverter', 'solar', 'water', 'pump', 'tank', 'road', 'drainage'];
  where[Op.or] = terms.flatMap((term) => [{ category: { [Op.like]: `%${term}%` } }, { name: { [Op.like]: `%${term}%` } }]);
  return where;
};

const energySystemTerms = ['electrical', 'generator', 'transformer', 'ups', 'inverter', 'solar', 'power'];
const energySystemWhere = (query = {}) => {
  const where = {
    [Op.or]: energySystemTerms.flatMap((term) => [
      { category: { [Op.like]: `%${term}%` } },
      { type: { [Op.like]: `%${term}%` } },
      { subcategory: { [Op.like]: `%${term}%` } },
      { name: { [Op.like]: `%${term}%` } },
    ]),
  };
  const search = String(query.search || '').trim();
  if (search) {
    where[Op.and] = [{
      [Op.or]: ['name', 'assetCode', 'category', 'type', 'subcategory', 'building', 'location'].map((field) => ({
        [field]: { [Op.like]: `%${search}%` },
      })),
    }];
  }
  for (const field of ['status', 'location', 'building']) {
    if (String(query[field] || '').trim()) where[field] = String(query[field]).trim();
  }
  if (String(query.energyType || '').trim()) {
    where[Op.and] = [...(where[Op.and] || []), {
      [Op.or]: ['category', 'type', 'subcategory'].map((field) => ({
        [field]: { [Op.like]: `%${String(query.energyType).trim()}%` },
      })),
    }];
  }
  return where;
};

const normalizeEnergySystem = (asset) => {
  const data = asset.toJSON ? asset.toJSON() : asset;
  const specifications = data.specifications && typeof data.specifications === 'object' ? data.specifications : {};
  return {
    id: data.id,
    name: data.name,
    assetCode: data.assetCode || null,
    type: data.subcategory || data.type || data.category || null,
    category: data.category || null,
    building: data.building || null,
    location: data.location || null,
    status: data.status || null,
    condition: data.condition || null,
    capacity: specifications.capacity ?? specifications.powerRating ?? null,
    capacityUnit: specifications.capacityUnit ?? specifications.powerUnit ?? null,
    meter: specifications.meter ?? specifications.meterNumber ?? null,
    lastMaintenanceDate: data.lastMaintenanceDate || null,
    lastInspectionDate: data.lastInspectionDate || null,
    specifications,
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null,
  };
};

const fuelValue = (...values) => values.find((value) => value !== undefined && value !== null && value !== '');
const fuelNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};
const fuelRecordFromInfrastructure = (asset) => {
  const data = asset.toJSON ? asset.toJSON() : asset;
  const specifications = data.specifications && typeof data.specifications === 'object' ? data.specifications : {};
  const item = { ...data, ...specifications, specifications };
  const fuelType = fuelValue(item.fuelType, item.fuel_type, item.subcategory, item.category, specifications.fuelType, specifications.fuel_type, 'Fuel');
  const location = fuelValue(item.location, item.building, item.room, specifications.location, '—');
  const tankNumber = fuelValue(item.tankNumber, item.tank_number, item.tankNo, specifications.tankNumber, specifications.tank_number, '—');
  const currentStock = fuelNumber(fuelValue(item.currentStock, item.current_stock, item.stock, item.availableStock, item.available_stock, specifications.currentStock, specifications.current_stock));
  const minimumStock = fuelNumber(fuelValue(item.minimumStock, item.minimum_stock, item.minStock, item.min_stock, specifications.minimumStock, specifications.minimum_stock));
  const maximumStock = fuelNumber(fuelValue(item.maximumStock, item.maximum_stock, item.maxStock, item.max_stock, specifications.maximumStock, specifications.maximum_stock));
  const unit = fuelValue(item.unit, item.measurementUnit, item.measurement_unit, specifications.unit, 'Liter');
  const supplier = fuelValue(item.supplier, specifications.supplier, item.vendor, '—');
  const responsiblePerson = fuelValue(item.responsiblePerson, item.assignedTo, specifications.responsiblePerson, 'Unassigned');
  const unitPrice = fuelNumber(fuelValue(item.unitPrice, item.unit_price, item.pricePerUnit, item.price_per_unit, specifications.unitPrice, specifications.unit_price));
  const totalValue = fuelNumber(fuelValue(item.totalValue, item.total_value, item.stockValue, item.stock_value, specifications.totalValue, specifications.total_value));
  const lastDeliveryDate = fuelValue(item.lastDeliveryDate, item.last_delivery_date, specifications.lastDeliveryDate, specifications.last_delivery_date, '');
  const nextDeliveryDate = fuelValue(item.nextDeliveryDate, item.next_delivery_date, specifications.nextDeliveryDate, specifications.next_delivery_date, '');
  const lastReading = fuelNumber(fuelValue(item.lastReading, item.last_reading, item.meterReading, item.meter_reading, specifications.lastReading, specifications.last_reading));
  return {
    id: item.id,
    name: item.name || 'Unnamed Fuel Record',
    code: item.assetCode || item.code || item.fuelCode || item.fuel_code || '—',
    fuelType: fuelType,
    storageType: fuelValue(item.storageType, item.storage_type, specifications.storageType, specifications.storage_type, '—'),
    location,
    tankNumber,
    tankCapacity: fuelNumber(fuelValue(item.tankCapacity, item.tank_capacity, item.capacity, specifications.tankCapacity, specifications.tank_capacity)),
    currentStock: currentStock ?? 0,
    minimumStock: minimumStock ?? 0,
    maximumStock: maximumStock ?? 0,
    unit,
    supplier,
    responsiblePerson,
    lastDeliveryDate,
    nextDeliveryDate,
    lastReading: lastReading ?? 0,
    status: item.status || 'Operational',
    condition: item.condition || 'Good',
    unitPrice: unitPrice ?? 0,
    totalValue: totalValue ?? 0,
    description: item.description || specifications.description || '',
    remarks: item.notes || specifications.remarks || item.remarks || '',
    createdAt: item.createdAt || null,
    updatedAt: item.updatedAt || null,
    category: item.category || 'Fuel',
    subcategory: item.subcategory || fuelType,
    specifications: { ...specifications },
  };
};

const fuelWhere = (query = {}) => {
  const where = {
    [Op.or]: [
      { category: { [Op.like]: '%Fuel%' } },
      { category: { [Op.like]: '%Diesel%' } },
      { category: { [Op.like]: '%Petrol%' } },
      { category: { [Op.like]: '%Gasoline%' } },
      { category: { [Op.like]: '%LPG%' } },
      { subcategory: { [Op.like]: '%Fuel%' } },
      { subcategory: { [Op.like]: '%Diesel%' } },
      { subcategory: { [Op.like]: '%Petrol%' } },
      { name: { [Op.like]: '%Diesel%' } },
      { name: { [Op.like]: '%Petrol%' } },
      { name: { [Op.like]: '%Fuel%' } },
      { description: { [Op.like]: '%Fuel%' } }
    ]
  };
  const search = String(query.search || '').trim();
  if (search) {
    where[Op.and] = [{ [Op.or]: ['name', 'assetCode', 'category', 'subcategory', 'location', 'building', 'supplier', 'notes', 'description', 'serialNumber'].map((field) => ({ [field]: { [Op.like]: `%${search}%` } })) }];
  }
  for (const field of ['status', 'location', 'building', 'supplier']) {
    if (String(query[field] || '').trim()) where[field] = String(query[field]).trim();
  }
  if (String(query.fuelType || query.type || '').trim()) {
    where[Op.and] = [...(where[Op.and] || []), {
      [Op.or]: ['category', 'subcategory', 'name', 'description'].map((field) => ({ [field]: { [Op.like]: `%${String(query.fuelType || query.type).trim()}%` } }))
    }];
  }
  return where;
};

const buildFuelPayload = (body = {}) => {
  const specifications = {};
  const entries = {
    fuelType: 'fuelType',
    storageType: 'storageType',
    tankNumber: 'tankNumber',
    tankCapacity: 'tankCapacity',
    currentStock: 'currentStock',
    minimumStock: 'minimumStock',
    maximumStock: 'maximumStock',
    unit: 'unit',
    supplier: 'supplier',
    responsiblePerson: 'responsiblePerson',
    lastDeliveryDate: 'lastDeliveryDate',
    nextDeliveryDate: 'nextDeliveryDate',
    lastReading: 'lastReading',
    unitPrice: 'unitPrice',
    totalValue: 'totalValue',
    description: 'description',
    remarks: 'remarks'
  };
  Object.entries(entries).forEach(([key, field]) => {
    if (body[field] !== undefined) {
      specifications[key] = body[field] === '' ? null : body[field];
    }
  });
  const name = String(body.name || '').trim();
  const fuelType = String(body.fuelType || body.fuel_type || body.type || specifications.fuelType || '').trim();
  const location = String(body.location || body.building || '').trim();
  const payload = {
    name,
    type: 'Fixed Asset',
    category: String(body.category || 'Fuel').trim() || 'Fuel',
    subcategory: fuelType || 'Fuel',
    description: String(body.description || specifications.description || '').trim() || null,
    assetCode: String(body.code || body.assetCode || '').trim() || null,
    location: location || null,
    building: String(body.building || location || '').trim() || null,
    room: String(body.room || '').trim() || null,
    status: String(body.status || 'Operational').trim() || 'Operational',
    condition: String(body.condition || 'Good').trim() || 'Good',
    supplier: String(body.supplier || specifications.supplier || '').trim() || null,
    notes: String(body.remarks || body.notes || specifications.remarks || '').trim() || null,
    purchasePrice: body.unitPrice !== undefined ? Number(body.unitPrice) || 0 : (Number(specifications.unitPrice) || 0),
    currentValue: body.totalValue !== undefined ? Number(body.totalValue) || 0 : (Number(specifications.totalValue) || 0),
    specifications: {
      ...specifications,
      fuelType: fuelType || specifications.fuelType || 'Fuel',
      storageType: String(body.storageType || specifications.storageType || '').trim() || null,
      tankNumber: String(body.tankNumber || specifications.tankNumber || '').trim() || null,
      tankCapacity: body.tankCapacity !== undefined ? Number(body.tankCapacity) : (specifications.tankCapacity !== undefined ? Number(specifications.tankCapacity) : null),
      currentStock: body.currentStock !== undefined ? Number(body.currentStock) : (specifications.currentStock !== undefined ? Number(specifications.currentStock) : null),
      minimumStock: body.minimumStock !== undefined ? Number(body.minimumStock) : (specifications.minimumStock !== undefined ? Number(specifications.minimumStock) : null),
      maximumStock: body.maximumStock !== undefined ? Number(body.maximumStock) : (specifications.maximumStock !== undefined ? Number(specifications.maximumStock) : null),
      unit: String(body.unit || specifications.unit || 'Liter').trim() || 'Liter',
      responsiblePerson: String(body.responsiblePerson || specifications.responsiblePerson || '').trim() || null,
      lastDeliveryDate: body.lastDeliveryDate || specifications.lastDeliveryDate || null,
      nextDeliveryDate: body.nextDeliveryDate || specifications.nextDeliveryDate || null,
      lastReading: body.lastReading !== undefined ? Number(body.lastReading) : (specifications.lastReading !== undefined ? Number(specifications.lastReading) : null),
      unitPrice: body.unitPrice !== undefined ? Number(body.unitPrice) : (specifications.unitPrice !== undefined ? Number(specifications.unitPrice) : null),
      totalValue: body.totalValue !== undefined ? Number(body.totalValue) : (specifications.totalValue !== undefined ? Number(specifications.totalValue) : null),
      remarks: String(body.remarks || specifications.remarks || '').trim() || null,
      description: String(body.description || specifications.description || '').trim() || null,
    }
  };
  if (payload.currentValue === 0 && payload.specifications.totalValue !== null && payload.specifications.totalValue !== undefined) payload.currentValue = Number(payload.specifications.totalValue);
  return payload;
};

const getInfrastructureFuel = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
    const fuelFilter = fuelWhere(req.query);
    const { count, rows } = await Infrastructure.findAndCountAll({
      where: fuelFilter,
      order: [['updatedAt', 'DESC'], ['createdAt', 'DESC'], ['id', 'DESC']],
      limit,
      offset: (page - 1) * limit,
      raw: true,
    });
    const data = rows.map(fuelRecordFromInfrastructure);
    const summary = await getInfrastructureFuelSummaryInternal(fuelFilter);
    return res.json({
      success: true,
      data,
      summary,
      pagination: { page, limit, total: count, pages: Math.max(1, Math.ceil(count / limit)) }
    });
  } catch (error) {
    console.error('Error fetching infrastructure fuel records:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch fuel records' });
  }
};

const getInfrastructureFuelSummaryInternal = async (where = fuelWhere()) => {
  const rows = await Infrastructure.findAll({ where, raw: true });
  const records = rows.map(fuelRecordFromInfrastructure);
  const summary = records.reduce((result, record) => {
    const fuelType = String(record.fuelType || '').trim();
    const current = fuelNumber(record.currentStock) ?? 0;
    const minimum = fuelNumber(record.minimumStock) ?? 0;
    const unitPrice = fuelNumber(record.unitPrice) ?? 0;
    const totalValue = fuelNumber(record.totalValue) ?? 0;
    const status = String(record.status || '').trim().toLowerCase();
    const condition = String(record.condition || '').trim().toLowerCase();
    result.total += 1;
    result.totalStock += current;
    result.totalCost += totalValue || (current * unitPrice);
    if (fuelType.toLowerCase().includes('diesel')) result.dieselStock += current;
    if (fuelType.toLowerCase().includes('petrol') || fuelType.toLowerCase().includes('gasoline')) result.petrolStock += current;
    if (['operational', 'active', 'working', 'available'].includes(status)) result.active += 1;
    if (status.includes('maintenance')) result.maintenance += 1;
    if (current <= minimum) result.lowStock += 1;
    if (condition.includes('critical') || status.includes('fault')) result.critical += 1;
    return result;
  }, { total: 0, active: 0, maintenance: 0, lowStock: 0, critical: 0, totalStock: 0, totalCost: 0, dieselStock: 0, petrolStock: 0 });
  return summary;
};

const getInfrastructureFuelSummary = async (req, res) => {
  try {
    const where = fuelWhere(req.query);
    const summary = await getInfrastructureFuelSummaryInternal(where);
    return res.json({
      success: true,
      data: summary,
      summary,
      pagination: { page: 1, limit: summary.total || 0, total: summary.total || 0, pages: 1 }
    });
  } catch (error) {
    console.error('Error fetching infrastructure fuel summary:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch fuel summary' });
  }
};

const getInfrastructureFuelById = async (req, res) => {
  try {
    const asset = await Infrastructure.findOne({ where: { id: req.params.id, [Op.or]: [{ category: { [Op.like]: '%Fuel%' } }, { subcategory: { [Op.like]: '%Fuel%' } }, { name: { [Op.like]: '%Fuel%' } }] } });
    if (!asset) return res.status(404).json({ success: false, message: 'Fuel record not found' });
    return res.json({ success: true, data: fuelRecordFromInfrastructure(asset) });
  } catch (error) { console.error('Error fetching fuel record:', error); return res.status(500).json({ success: false, message: 'Failed to fetch fuel record' }); }
};

const createInfrastructureFuel = async (req, res) => {
  try {
    const payload = buildFuelPayload(req.body || {});
    if (!payload.name || !String(payload.name).trim()) return res.status(422).json({ success: false, message: 'Fuel record name is required' });
    if (payload.specifications.currentStock !== null && payload.specifications.currentStock !== undefined && Number(payload.specifications.currentStock) < 0) return res.status(422).json({ success: false, message: 'Fuel quantity cannot be negative' });
    if (payload.specifications.minimumStock !== null && payload.specifications.minimumStock !== undefined && Number(payload.specifications.minimumStock) < 0) return res.status(422).json({ success: false, message: 'Minimum stock cannot be negative' });
    const normalized = { ...payload, createdBy: req.user?.id || 0 };
    const record = await Infrastructure.create(normalized);
    await AuditLog.create({ userId: req.user.id, action: 'CREATE_INFRASTRUCTURE_FUEL', entity: `infrastructure_fuel:${record.id}`, details: JSON.stringify({ fuelId: record.id, organizationScope: req.user.collegeId || null }) });
    return res.status(201).json({ success: true, data: fuelRecordFromInfrastructure(record), message: 'Fuel record created successfully' });
  } catch (error) {
    console.error('Error creating fuel record:', error);
    if (error.name === 'SequelizeUniqueConstraintError') return res.status(409).json({ success: false, message: 'A fuel record with this asset code already exists' });
    return res.status(500).json({ success: false, message: 'Failed to create fuel record' });
  }
};

const updateInfrastructureFuel = async (req, res) => {
  try {
    const asset = await Infrastructure.findByPk(req.params.id);
    if (!asset) return res.status(404).json({ success: false, message: 'Fuel record not found' });
    const payload = buildFuelPayload({ ...asset.toJSON ? asset.toJSON() : asset, ...(req.body || {}) });
    if (!payload.name || !String(payload.name).trim()) return res.status(422).json({ success: false, message: 'Fuel record name is required' });
    if (payload.specifications.currentStock !== null && payload.specifications.currentStock !== undefined && Number(payload.specifications.currentStock) < 0) return res.status(422).json({ success: false, message: 'Fuel quantity cannot be negative' });
    await asset.update(payload);
    await AuditLog.create({ userId: req.user.id, action: 'UPDATE_INFRASTRUCTURE_FUEL', entity: `infrastructure_fuel:${asset.id}`, details: JSON.stringify({ fuelId: asset.id }) });
    return res.json({ success: true, data: fuelRecordFromInfrastructure(asset), message: 'Fuel record updated successfully' });
  } catch (error) { console.error('Error updating fuel record:', error); return res.status(500).json({ success: false, message: 'Failed to update fuel record' }); }
};

const deactivateInfrastructureFuel = async (req, res) => {
  try {
    const asset = await Infrastructure.findByPk(req.params.id);
    if (!asset) return res.status(404).json({ success: false, message: 'Fuel record not found' });
    await asset.update({ status: 'Inactive' });
    await AuditLog.create({ userId: req.user.id, action: 'DEACTIVATE_INFRASTRUCTURE_FUEL', entity: `infrastructure_fuel:${asset.id}`, details: JSON.stringify({ fuelId: asset.id }) });
    return res.json({ success: true, data: fuelRecordFromInfrastructure(asset), message: 'Fuel record deactivated successfully' });
  } catch (error) { console.error('Error deactivating fuel record:', error); return res.status(500).json({ success: false, message: 'Failed to deactivate fuel record' }); }
};

const getInfrastructureEnergy = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
    const where = energySystemWhere(req.query);
    const [{ count, rows }, allRows] = await Promise.all([
      Infrastructure.findAndCountAll({ where, order: [['createdAt', 'DESC'], ['id', 'DESC']], limit, offset: (page - 1) * limit }),
      Infrastructure.findAll({ where: energySystemWhere(req.query), attributes: ['status'], raw: true }),
    ]);
    const summary = allRows.reduce((result, row) => {
      const status = String(row.status || '').trim().toLowerCase();
      result.total += 1;
      if (['operational', 'active', 'working'].includes(status)) result.operational += 1;
      if (status.includes('maintenance')) result.underMaintenance += 1;
      if (['fault', 'failed', 'critical', 'damaged'].includes(status)) result.faulty += 1;
      return result;
    }, { total: 0, operational: 0, underMaintenance: 0, faulty: 0 });
    return res.json({
      success: true,
      data: rows.map(normalizeEnergySystem),
      summary,
      measurements: { available: false, message: 'Energy readings are not available.' },
      pagination: { page, limit, total: count, pages: Math.max(1, Math.ceil(count / limit)) },
    });
  } catch (error) {
    console.error('Error fetching infrastructure energy systems:', error);
    return res.status(500).json({ success: false, message: 'Failed to load energy systems' });
  }
};

const workOrderIncludes = [
  { model: Asset, attributes: ['id', 'name', 'assetCode', 'category', 'location', 'department', 'collegeId', 'status', 'condition'] },
  { model: Maintenance, attributes: ['id', 'title', 'description', 'status', 'priority', 'requestedBy', 'assignedTo', 'createdAt'] },
  { model: User, as: 'Technician', attributes: ['id', 'username', 'fullName', 'role', 'department', 'collegeId'] },
];
const workOrderStatusTransitions = { pending: ['assigned', 'cancelled'], assigned: ['in-progress', 'cancelled'], 'in-progress': ['on-hold', 'completed', 'cancelled'], 'on-hold': ['in-progress', 'cancelled'], completed: [], cancelled: [] };
const workOrderStatuses = Object.keys(workOrderStatusTransitions);
const workOrderPriorities = ['low', 'medium', 'high', 'critical'];
const normalizeWorkOrderStatus = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, '-').replace(/_/g, '-');
const normalizeWorkOrder = (item) => {
  const data = item.toJSON();
  const asset = item.Asset || {};
  const maintenance = item.Maintenance || {};
  const technician = item.Technician || null;
  return { ...data, asset, assetName: asset.name || null, assetNumber: asset.assetCode || null, location: asset.location || null, maintenance, title: maintenance.title || null, description: data.problemDescription || maintenance.description || '', technician, technicianName: technician?.fullName || technician?.username || null };
};

const getInfrastructureWorkOrders = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
    const where = {};
    if (req.query.status) where.status = normalizeWorkOrderStatus(req.query.status);
    if (req.query.priority) where.priority = String(req.query.priority).trim().toLowerCase();
    if (req.query.technicianId) where.technicianId = Number(req.query.technicianId);
    if (req.query.assetId) where.assetId = Number(req.query.assetId);
    if (req.query.search) {
      const search = String(req.query.search).trim();
      if (search) where[Op.or] = [{ workOrderNumber: { [Op.like]: `%${search}%` } }, { problemDescription: { [Op.like]: `%${search}%` } }, { notes: { [Op.like]: `%${search}%` } }, { '$Asset.name$': { [Op.like]: `%${search}%` } }, { '$Asset.assetCode$': { [Op.like]: `%${search}%` } }];
    }
    const include = workOrderIncludes.map((item) => ({ ...item }));
    include[0].where = infrastructureAssetWhere(req);
    include[0].required = true;
    const { count, rows } = await MaintenanceWorkOrder.findAndCountAll({ where, include, order: [['createdAt', 'DESC'], ['id', 'DESC']], limit, offset: (page - 1) * limit, distinct: true });
    return res.json({ success: true, data: rows.map(normalizeWorkOrder), pagination: { page, limit, total: count, pages: Math.max(1, Math.ceil(count / limit)) } });
  } catch (error) { console.error('Error fetching infrastructure work orders:', error); return res.status(500).json({ success: false, message: 'Failed to fetch infrastructure work orders' }); }
};

const getInfrastructureWorkOrder = async (req, res) => {
  const item = await MaintenanceWorkOrder.findOne({ where: { id: req.params.id }, include: [{ ...workOrderIncludes[0], where: infrastructureAssetWhere(req), required: true }, workOrderIncludes[1], workOrderIncludes[2]] });
  if (!item) return res.status(404).json({ success: false, message: 'Infrastructure work order not found' });
  return res.json({ success: true, data: normalizeWorkOrder(item) });
};

const getInfrastructureWorkOrderOptions = async (req, res) => {
  try {
    const assets = await Asset.findAll({ where: infrastructureAssetWhere(req), attributes: ['id', 'name', 'assetCode', 'category', 'location', 'collegeId'], order: [['name', 'ASC']] });
    const assetIds = assets.map((asset) => asset.id);
    const [maintenances, technicians] = await Promise.all([
      assetIds.length ? Maintenance.findAll({ where: { assetId: { [Op.in]: assetIds }, status: { [Op.notIn]: ['completed', 'cancelled', 'rejected'] } }, attributes: ['id', 'assetId', 'title', 'status', 'priority'], order: [['id', 'DESC']] }) : [],
      User.findAll({ where: { role: 'maintenance', active: true, ...(req.user?.collegeId ? { collegeId: req.user.collegeId } : {}) }, attributes: ['id', 'username', 'fullName', 'department'], order: [['fullName', 'ASC'], ['username', 'ASC']] }),
    ]);
    return res.json({ success: true, data: { assets, maintenances, technicians } });
  } catch (error) { console.error('Error fetching infrastructure work-order options:', error); return res.status(500).json({ success: false, message: 'Failed to fetch work-order options' }); }
};

const validateWorkOrderReferences = async (req, body, transaction) => {
  const asset = await Asset.findOne({ where: { id: body.assetId, ...infrastructureAssetWhere(req) }, transaction });
  if (!asset) return { error: 'A valid infrastructure asset is required' };
  const maintenance = await Maintenance.findOne({ where: { id: body.maintenanceId, assetId: asset.id }, transaction });
  if (!maintenance) return { error: 'A maintenance record for the selected asset is required' };
  if (body.technicianId !== null && body.technicianId !== undefined && body.technicianId !== '') {
    const technician = await User.findOne({ where: { id: body.technicianId, role: 'maintenance', active: true, ...(req.user?.collegeId ? { collegeId: req.user.collegeId } : {}) }, transaction });
    if (!technician) return { error: 'A valid active maintenance technician is required' };
  }
  return { asset, maintenance };
};

const createInfrastructureWorkOrder = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const body = req.body || {};
    if (!String(body.workOrderNumber || '').trim() || !body.maintenanceId || !body.assetId) { await transaction.rollback(); return res.status(422).json({ success: false, message: 'Work order number, maintenance, and asset are required' }); }
    const priority = String(body.priority || 'medium').toLowerCase();
    if (!workOrderPriorities.includes(priority)) { await transaction.rollback(); return res.status(422).json({ success: false, message: 'Invalid work order priority' }); }
    if (body.expectedCompletionDate && Number.isNaN(Date.parse(body.expectedCompletionDate))) { await transaction.rollback(); return res.status(422).json({ success: false, message: 'Invalid expected completion date' }); }
    if (body.estimatedCost !== undefined && (!Number.isFinite(Number(body.estimatedCost)) || Number(body.estimatedCost) < 0)) { await transaction.rollback(); return res.status(422).json({ success: false, message: 'Estimated cost must be a non-negative number' }); }
    const references = await validateWorkOrderReferences(req, { ...body, technicianId: body.technicianId || null }, transaction);
    if (references.error) { await transaction.rollback(); return res.status(422).json({ success: false, message: references.error }); }
    const duplicate = await MaintenanceWorkOrder.findOne({ where: { workOrderNumber: String(body.workOrderNumber).trim() }, transaction });
    if (duplicate) { await transaction.rollback(); return res.status(409).json({ success: false, message: 'Work order number already exists' }); }
    const item = await MaintenanceWorkOrder.create({ maintenanceId: references.maintenance.id, assetId: references.asset.id, workOrderNumber: String(body.workOrderNumber).trim(), technicianId: body.technicianId || null, priority, problemDescription: String(body.problemDescription || '').trim(), requiredWork: String(body.requiredWork || '').trim(), expectedCompletionDate: body.expectedCompletionDate || null, estimatedCost: body.estimatedCost ?? 0, notes: String(body.notes || '').trim() }, { transaction });
    await AuditLog.create({ userId: req.user.id, action: 'CREATE_INFRASTRUCTURE_WORK_ORDER', entity: `maintenance_work_order:${item.id}`, details: JSON.stringify({ workOrderId: item.id, assetId: item.assetId }) }, { transaction });
    await transaction.commit();
    const created = await MaintenanceWorkOrder.findByPk(item.id, { include: workOrderIncludes });
    return res.status(201).json({ success: true, data: normalizeWorkOrder(created) });
  } catch (error) { await transaction.rollback(); console.error('Error creating infrastructure work order:', error); return res.status(500).json({ success: false, message: 'Failed to create infrastructure work order' }); }
};

const updateInfrastructureWorkOrder = async (req, res) => {
  try {
    const item = await MaintenanceWorkOrder.findOne({ where: { id: req.params.id }, include: [{ ...workOrderIncludes[0], where: infrastructureAssetWhere(req), required: true }, workOrderIncludes[1], workOrderIncludes[2]] });
    if (!item) return res.status(404).json({ success: false, message: 'Infrastructure work order not found' });
    const body = req.body || {};
    const priority = String(body.priority ?? item.priority).toLowerCase();
    if (!workOrderPriorities.includes(priority)) return res.status(422).json({ success: false, message: 'Invalid work order priority' });
    if (body.expectedCompletionDate && Number.isNaN(Date.parse(body.expectedCompletionDate))) return res.status(422).json({ success: false, message: 'Invalid expected completion date' });
    if (body.estimatedCost !== undefined && (!Number.isFinite(Number(body.estimatedCost)) || Number(body.estimatedCost) < 0)) return res.status(422).json({ success: false, message: 'Estimated cost must be a non-negative number' });
    if (body.technicianId !== undefined) {
      const references = await validateWorkOrderReferences(req, { assetId: item.assetId, maintenanceId: item.maintenanceId, technicianId: body.technicianId }, null);
      if (references.error) return res.status(422).json({ success: false, message: references.error });
    }
    await item.update({ technicianId: body.technicianId === undefined ? item.technicianId : (body.technicianId || null), priority, problemDescription: body.problemDescription ?? item.problemDescription, requiredWork: body.requiredWork ?? item.requiredWork, expectedCompletionDate: body.expectedCompletionDate ?? item.expectedCompletionDate, estimatedCost: body.estimatedCost ?? item.estimatedCost, notes: body.notes ?? item.notes });
    await AuditLog.create({ userId: req.user.id, action: 'UPDATE_INFRASTRUCTURE_WORK_ORDER', entity: `maintenance_work_order:${item.id}`, details: JSON.stringify({ workOrderId: item.id }) });
    return res.json({ success: true, data: normalizeWorkOrder(item) });
  } catch (error) { console.error('Error updating infrastructure work order:', error); return res.status(500).json({ success: false, message: 'Failed to update infrastructure work order' }); }
};

const transitionInfrastructureWorkOrder = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const item = await MaintenanceWorkOrder.findOne({ where: { id: req.params.id }, include: [{ ...workOrderIncludes[0], where: infrastructureAssetWhere(req), required: true }], transaction, lock: transaction.LOCK.UPDATE });
    if (!item) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Infrastructure work order not found' }); }
    const previousStatus = normalizeWorkOrderStatus(item.status);
    const nextStatus = normalizeWorkOrderStatus(req.body?.status);
    if (!workOrderStatuses.includes(nextStatus) || !workOrderStatusTransitions[previousStatus]?.includes(nextStatus)) { await transaction.rollback(); return res.status(409).json({ success: false, message: `Invalid status transition from ${previousStatus} to ${nextStatus}` }); }
    const updates = { status: nextStatus };
    if (nextStatus === 'in-progress') updates.startDate = new Date();
    if (nextStatus === 'completed') updates.actualCompletionDate = new Date();
    await item.update(updates, { transaction });
    await AuditLog.create({ userId: req.user.id, action: 'INFRASTRUCTURE_WORK_ORDER_STATUS_CHANGED', entity: `maintenance_work_order:${item.id}`, details: JSON.stringify({ workOrderId: item.id, previousStatus, newStatus: nextStatus }) }, { transaction });
    await transaction.commit();
    const updated = await MaintenanceWorkOrder.findByPk(item.id, { include: workOrderIncludes });
    return res.json({ success: true, data: normalizeWorkOrder(updated) });
  } catch (error) { await transaction.rollback(); console.error('Error transitioning infrastructure work order:', error); return res.status(500).json({ success: false, message: 'Failed to update work order status' }); }
};

const assignmentAssetAttributes = ['id', 'name', 'assetCode', 'serialNumber', 'rfidTag', 'qrCode', 'category', 'type', 'status', 'condition', 'location', 'building', 'room', 'assignedTo', 'notes', 'createdAt', 'updatedAt'];
const assignmentUserAttributes = ['id', 'username', 'fullName', 'email', 'role', 'department', 'active'];

const upsCategories = ['UPS', 'UPS/Inverter', 'Inverter'];
const upsStatuses = ['Operational', 'Under Maintenance', 'Inactive', 'Disposed'];
const upsConditions = ['Excellent', 'Good', 'Fair', 'Poor', 'Critical'];
const upsSpecificationFields = ['equipmentType', 'capacity', 'inputVoltage', 'outputVoltage', 'phase', 'frequency', 'batteryType', 'batteryCapacity', 'batteryCount', 'backupTime', 'installationDate', 'nextMaintenanceDate', 'description'];

const normalizeUpsAsset = (asset, openWorkOrders = 0) => {
  const data = asset.toJSON ? asset.toJSON() : asset;
  const specifications = data.specifications && typeof data.specifications === 'object' ? data.specifications : {};
  return {
    ...data,
    code: data.assetCode,
    equipmentType: specifications.equipmentType || data.subcategory || data.category,
    ...Object.fromEntries(upsSpecificationFields.filter((field) => field !== 'equipmentType').map((field) => [field, specifications[field] ?? null])),
    openWorkOrders
  };
};

const upsWhere = (req) => {
  const where = { category: { [Op.in]: upsCategories } };
  const { status, condition, type, location, manufacturer, building } = req.query;
  const statusValues = { operational: 'Operational', maintenance: 'Under Maintenance', inactive: 'Inactive', disposed: 'Disposed' };
  const conditionValues = { excellent: 'Excellent', good: 'Good', fair: 'Fair', poor: 'Poor', critical: 'Critical' };
  if (status) where.status = statusValues[String(status).toLowerCase()] || status;
  if (condition) where.condition = conditionValues[String(condition).toLowerCase()] || condition;
  if (type) where[Op.and] = [{ [Op.or]: [{ category: type }, { subcategory: type }] }];
  if (location) where.location = location;
  if (manufacturer) where.manufacturer = manufacturer;
  if (building) where.building = building;
  const search = String(req.query.search || '').trim();
  if (search) where[Op.or] = ['name', 'assetCode', 'serialNumber', 'manufacturer', 'model', 'building', 'location'].map((field) => ({ [field]: { [Op.like]: `%${search}%` } }));
  return where;
};

const getInfrastructureUps = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
    const where = upsWhere(req);
    const { count, rows } = await Infrastructure.findAndCountAll({ where, order: [['createdAt', 'DESC'], ['id', 'DESC']], limit, offset: (page - 1) * limit });
    const summaryRows = await Infrastructure.findAll({ where, attributes: ['status', 'condition', 'location', 'category', 'subcategory', 'manufacturer'], raw: true });
    const summary = summaryRows.reduce((result, row) => {
      result.total += 1;
      const status = String(row.status || '').toLowerCase();
      if (status === 'operational') result.operational += 1;
      if (status === 'under maintenance') result.maintenance += 1;
      if (status === 'inactive') result.inactive += 1;
      if (status === 'disposed') result.disposed += 1;
      if (['poor', 'critical'].includes(String(row.condition || '').toLowerCase())) result.critical += 1;
      return result;
    }, { total: 0, operational: 0, maintenance: 0, inactive: 0, disposed: 0, critical: 0 });
    return res.json({ success: true, data: rows.map((row) => normalizeUpsAsset(row)), summary, filters: { types: [...new Set(summaryRows.flatMap((row) => [row.category, row.subcategory]).filter(Boolean))].sort(), locations: [...new Set(summaryRows.map((row) => row.location).filter(Boolean))].sort(), manufacturers: [...new Set(summaryRows.map((row) => row.manufacturer).filter(Boolean))].sort(), statuses: upsStatuses, conditions: upsConditions }, pagination: { page, limit, total: count, pages: Math.max(1, Math.ceil(count / limit)), totalPages: Math.max(1, Math.ceil(count / limit)) } });
  } catch (error) {
    console.error('Error fetching UPS / inverter assets:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch UPS / inverter assets' });
  }
};

const getInfrastructureUpsById = async (req, res) => {
  const asset = await Infrastructure.findOne({ where: { id: req.params.id, category: { [Op.in]: upsCategories } } });
  if (!asset) return res.status(404).json({ success: false, message: 'UPS / inverter not found' });
  return res.json({ success: true, data: normalizeUpsAsset(asset) });
};

const validateUpsPayload = (body) => {
  const name = String(body.name || '').trim();
  const equipmentType = String(body.equipmentType || body.subcategory || '').trim();
  const status = String(body.status || 'Operational').trim();
  const condition = String(body.condition || 'Good').trim();
  if (!name || !equipmentType) return { error: 'Equipment name and type are required' };
  if (!upsStatuses.includes(status)) return { error: 'Invalid UPS / inverter status' };
  if (!upsConditions.includes(condition)) return { error: 'Invalid UPS / inverter condition' };
  if (body.installationDate && Number.isNaN(Date.parse(body.installationDate))) return { error: 'Invalid installation date' };
  return { name, equipmentType, status, condition };
};

const saveInfrastructureUps = async (req, res) => {
  try {
    const body = req.body || {};
    const validated = validateUpsPayload(body);
    if (validated.error) return res.status(422).json({ success: false, message: validated.error });
    const id = req.params.id;
    const asset = id ? await Infrastructure.findOne({ where: { id, category: { [Op.in]: upsCategories } } }) : null;
    if (id && !asset) return res.status(404).json({ success: false, message: 'UPS / inverter not found' });
    const assetCode = String(body.code || body.assetCode || '').trim() || null;
    const serialNumber = String(body.serialNumber || '').trim() || null;
    if (assetCode || serialNumber) {
      const identifierClauses = [assetCode ? { assetCode } : null, serialNumber ? { serialNumber } : null].filter(Boolean);
      const duplicate = await Infrastructure.findOne({ where: { [Op.or]: identifierClauses, ...(id ? { id: { [Op.ne]: id } } : {}) } });
      if (duplicate) return res.status(409).json({ success: false, message: 'Asset code or serial number already exists' });
    }
    const specifications = Object.fromEntries(upsSpecificationFields.map((field) => [field, body[field] === '' || body[field] === undefined ? null : body[field]]));
    const payload = { name: validated.name, category: 'UPS/Inverter', subcategory: validated.equipmentType, assetCode, serialNumber, location: String(body.location || '').trim() || null, building: String(body.building || '').trim() || null, room: String(body.room || '').trim() || null, status: validated.status, condition: validated.condition, manufacturer: String(body.manufacturer || '').trim() || null, model: String(body.model || '').trim() || null, specifications, description: String(body.description || '').trim() || null, lastInspectionDate: body.lastInspectionDate || null, createdBy: req.user.id };
    const saved = asset ? await asset.update(payload) : await Infrastructure.create(payload);
    await AuditLog.create({ userId: req.user.id, action: asset ? 'UPDATE_INFRASTRUCTURE_UPS' : 'CREATE_INFRASTRUCTURE_UPS', entity: `infrastructure_asset:${saved.id}`, details: JSON.stringify({ assetId: saved.id, organizationScope: req.user.collegeId || null }) });
    return res.status(asset ? 200 : 201).json({ success: true, data: normalizeUpsAsset(saved), message: asset ? 'UPS / inverter updated successfully' : 'UPS / inverter registered successfully' });
  } catch (error) {
    console.error('Error saving UPS / inverter:', error);
    if (error.name === 'SequelizeUniqueConstraintError') return res.status(409).json({ success: false, message: 'Asset code or serial number already exists' });
    return res.status(500).json({ success: false, message: 'Failed to save UPS / inverter' });
  }
};

const deactivateInfrastructureUps = async (req, res) => {
  try {
    const asset = await Infrastructure.findOne({ where: { id: req.params.id, category: { [Op.in]: upsCategories } } });
    if (!asset) return res.status(404).json({ success: false, message: 'UPS / inverter not found' });
    const inspections = await InfrastructureInspection.count({ where: { assetId: asset.id } });
    const workOrders = await MaintenanceWorkOrder.count({ where: { assetId: asset.id } });
    if (inspections || workOrders) return res.status(409).json({ success: false, message: 'Equipment has history and cannot be deleted. Deactivate it instead.' });
    await asset.update({ status: 'Inactive' });
    await AuditLog.create({ userId: req.user.id, action: 'DEACTIVATE_INFRASTRUCTURE_UPS', entity: `infrastructure_asset:${asset.id}`, details: JSON.stringify({ assetId: asset.id, organizationScope: req.user.collegeId || null }) });
    return res.json({ success: true, data: normalizeUpsAsset(asset), message: 'UPS / inverter deactivated successfully' });
  } catch (error) {
    console.error('Error deactivating UPS / inverter:', error);
    return res.status(500).json({ success: false, message: 'Failed to deactivate UPS / inverter' });
  }
};

const solarStatuses = ['Operational', 'Under Maintenance', 'Inactive', 'Disposed'];
const solarConditions = ['Excellent', 'Good', 'Fair', 'Poor', 'Critical'];
const solarSpecificationFields = ['panelCount', 'panelCapacity', 'totalCapacity', 'inverterCapacity', 'inverterCount', 'batteryType', 'batteryCapacity', 'batteryCount', 'voltage', 'phase', 'installationDate', 'nextMaintenanceDate'];
const solarWhere = (req = {}) => {
  const query = req.query || req;
  const where = { category: { [Op.like]: '%Solar%' } };
  const search = String(query.search || '').trim();
  if (search) where[Op.or] = ['name', 'assetCode', 'serialNumber', 'manufacturer', 'model', 'building', 'location'].map((field) => ({ [field]: { [Op.like]: `%${search}%` } }));
  if (query.status) where.status = String(query.status).trim();
  if (query.condition) where.condition = String(query.condition).trim();
  if (query.type) where.subcategory = String(query.type).trim();
  if (query.location) where.location = String(query.location).trim();
  if (query.building) where.building = String(query.building).trim();
  if (query.manufacturer) where.manufacturer = String(query.manufacturer).trim();
  return where;
};
const solarResponse = (asset, inspections = 0) => {
  const data = asset.toJSON ? asset.toJSON() : asset;
  const specifications = data.specifications && typeof data.specifications === 'object' ? data.specifications : {};
  return { ...data, code: data.assetCode, systemType: data.subcategory, ...Object.fromEntries(solarSpecificationFields.map((field) => [field, specifications[field] ?? null])), inspectionCount: inspections };
};
const solarPayload = (body, existing = {}) => {
  const specifications = { ...((existing.specifications && typeof existing.specifications === 'object') ? existing.specifications : {}) };
  for (const field of solarSpecificationFields) if (body[field] !== undefined) specifications[field] = body[field] === '' ? null : body[field];
  return { name: String(body.name || '').trim(), type: 'Fixed Asset', category: 'Solar', subcategory: String(body.systemType ?? body.subcategory ?? '').trim() || undefined, description: body.description === undefined ? existing.description : String(body.description || '').trim() || null, assetCode: String(body.assetCode ?? body.code ?? '').trim() || null, serialNumber: String(body.serialNumber || '').trim() || null, location: String(body.location || '').trim() || null, building: String(body.building || '').trim() || null, room: String(body.room || '').trim() || null, status: body.status || existing.status || 'Operational', condition: body.condition || existing.condition || 'Good', manufacturer: String(body.manufacturer || '').trim() || null, model: String(body.model || '').trim() || null, lastMaintenanceDate: body.lastMaintenanceDate || existing.lastMaintenanceDate || null, department: String(body.department || '').trim() || null, specifications };
};
const validateSolarPayload = (payload) => {
  if (!payload.name) return 'Solar system name is required';
  if (!payload.subcategory) return 'Solar system type is required';
  if (!payload.location) return 'Location is required';
  if (!solarStatuses.includes(payload.status)) return 'Invalid solar system status';
  if (!solarConditions.includes(payload.condition)) return 'Invalid solar system condition';
  if (payload.specifications.installationDate && Number.isNaN(Date.parse(payload.specifications.installationDate))) return 'Invalid installation date';
  if (payload.specifications.nextMaintenanceDate && Number.isNaN(Date.parse(payload.specifications.nextMaintenanceDate))) return 'Invalid next maintenance date';
  return null;
};
const getInfrastructureSolar = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1); const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10)); const where = solarWhere(req); const baseWhere = solarWhere();
    const [{ count, rows }, summaryRows, filterRows] = await Promise.all([Infrastructure.findAndCountAll({ where, order: [['createdAt', 'DESC'], ['id', 'DESC']], limit, offset: (page - 1) * limit }), Infrastructure.findAll({ where: baseWhere, attributes: ['status', 'condition'], raw: true }), Promise.all(['subcategory', 'status', 'condition', 'location', 'building', 'manufacturer'].map((field) => Infrastructure.findAll({ where: baseWhere, attributes: [field], group: [field], order: [[field, 'ASC']], raw: true })))]);
    const summary = summaryRows.reduce((result, row) => { result.total += 1; const status = String(row.status || '').toLowerCase(); if (status === 'operational') result.operational += 1; if (status === 'under maintenance') result.maintenance += 1; if (status === 'inactive') result.inactive += 1; if (status === 'disposed') result.disposed += 1; return result; }, { total: 0, operational: 0, maintenance: 0, inactive: 0, disposed: 0 });
    return res.json({ success: true, data: rows.map((row) => solarResponse(row)), summary, filters: { types: filterRows[0].map((row) => row.subcategory).filter(Boolean), statuses: solarStatuses, conditions: solarConditions, locations: filterRows[3].map((row) => row.location).filter(Boolean), buildings: filterRows[4].map((row) => row.building).filter(Boolean), manufacturers: filterRows[5].map((row) => row.manufacturer).filter(Boolean) }, pagination: { page, limit, total: count, pages: Math.max(1, Math.ceil(count / limit)), totalPages: Math.max(1, Math.ceil(count / limit)) } });
  } catch (error) { console.error('Error fetching solar systems:', error); return res.status(500).json({ success: false, message: 'Failed to fetch solar systems' }); }
};
const getInfrastructureSolarById = async (req, res) => {
  try { const asset = await Infrastructure.findOne({ where: { id: req.params.id, ...solarWhere() } }); if (!asset) return res.status(404).json({ success: false, message: 'Solar system not found' }); const inspectionCount = await InfrastructureInspection.count({ where: { assetId: asset.id } }); return res.json({ success: true, data: solarResponse(asset, inspectionCount) }); } catch (error) { return res.status(500).json({ success: false, message: 'Failed to fetch solar system details' }); }
};
const saveInfrastructureSolar = async (req, res) => {
  try { const id = req.params.id; const asset = id ? await Infrastructure.findOne({ where: { id, ...solarWhere() } }) : null; if (id && !asset) return res.status(404).json({ success: false, message: 'Solar system not found' }); const payload = solarPayload(req.body || {}, asset?.toJSON() || {}); const validationError = validateSolarPayload(payload); if (validationError) return res.status(422).json({ success: false, message: validationError }); const identifiers = [{ assetCode: payload.assetCode }, { serialNumber: payload.serialNumber }].filter((item) => Object.values(item)[0]); if (identifiers.length && await Infrastructure.findOne({ where: { [Op.or]: identifiers, ...(id ? { id: { [Op.ne]: id } } : {}) } })) return res.status(409).json({ success: false, message: 'Solar asset number or serial number already exists' }); const saved = asset ? await asset.update(payload) : await Infrastructure.create({ ...payload, createdBy: req.user.id }); await AuditLog.create({ userId: req.user.id, action: asset ? 'UPDATE_SOLAR_SYSTEM' : 'CREATE_SOLAR_SYSTEM', entity: `infrastructure_asset:${saved.id}`, details: JSON.stringify({ assetId: saved.id, organizationScope: req.user.collegeId || null }) }); return res.status(asset ? 200 : 201).json({ success: true, data: solarResponse(saved), message: asset ? 'Solar system updated successfully' : 'Solar system registered successfully' }); } catch (error) { console.error('Error saving solar system:', error); if (error.name === 'SequelizeUniqueConstraintError') return res.status(409).json({ success: false, message: 'Solar asset number or serial number already exists' }); return res.status(500).json({ success: false, message: 'Failed to save solar system' }); }
};
const deactivateInfrastructureSolar = async (req, res) => {
  try { const asset = await Infrastructure.findOne({ where: { id: req.params.id, ...solarWhere() } }); if (!asset) return res.status(404).json({ success: false, message: 'Solar system not found' }); await asset.update({ status: 'Inactive' }); await AuditLog.create({ userId: req.user.id, action: 'DEACTIVATE_SOLAR_SYSTEM', entity: `infrastructure_asset:${asset.id}`, details: JSON.stringify({ assetId: asset.id, organizationScope: req.user.collegeId || null }) }); return res.json({ success: true, data: solarResponse(asset), message: 'Solar system deactivated successfully' }); } catch (error) { return res.status(500).json({ success: false, message: 'Failed to deactivate solar system' }); }
};

const toInfrastructureAssignment = (asset, user, assignedBy) => {
  const data = asset.toJSON ? asset.toJSON() : asset;
  return {
    id: data.id, asset_id: data.id, asset_name: data.name, asset_tag: data.assetCode || '',
    asset_serial: data.serialNumber || '', asset_category: data.category || '', asset_type: data.type || '',
    asset_rfid: data.rfidTag || '', asset_qr: data.qrCode || '', assigned_to: data.assignedTo || null,
    assigned_to_id: data.assignedTo || null, assigned_to_name: user?.fullName || user?.username || '',
    assigned_to_role: user?.role || '', department_name: user?.department || data.department || '',
    location: data.location || '', building: data.building || '', room: data.room || '',
    status: String(data.status || '').toLowerCase() === 'assigned' ? 'active' : data.status,
    condition: data.condition || '', notes: data.notes || '', assigned_by: assignedBy || null,
    updated_at: data.updatedAt, created_at: data.createdAt
  };
};

const getInfrastructureAssignments = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
    const search = String(req.query.search || '').trim();
    const status = String(req.query.status || '').trim().toLowerCase();
    const where = { assignedTo: { [Op.ne]: null } };
    if (status === 'active' || status === 'assigned') where.status = { [Op.in]: ['assigned', 'Assigned'] };
    if (status && ['returned', 'cancelled'].includes(status)) return res.json({ success: true, assignments: [], data: [], total: 0, pagination: { page, limit, total: 0, pages: 1 }, summary: { total: 0, active: 0, returned: 0, pending: 0 } });
    if (search) {
      const matchingUsers = await User.findAll({ where: { [Op.or]: [{ fullName: { [Op.like]: `%${search}%` } }, { username: { [Op.like]: `%${search}%` } }] }, attributes: ['id'] });
      where[Op.or] = [{ name: { [Op.like]: `%${search}%` } }, { assetCode: { [Op.like]: `%${search}%` } }, { serialNumber: { [Op.like]: `%${search}%` } }, { location: { [Op.like]: `%${search}%` } }, { assignedTo: { [Op.in]: matchingUsers.map((user) => user.id) } }];
    }
    const { count, rows } = await Infrastructure.findAndCountAll({ where, attributes: assignmentAssetAttributes, order: [['updatedAt', 'DESC']], limit, offset: (page - 1) * limit });
    const users = await User.findAll({ where: { id: { [Op.in]: rows.map((asset) => asset.assignedTo).filter(Boolean) } }, attributes: assignmentUserAttributes, raw: true });
    const byId = new Map(users.map((user) => [user.id, user]));
    const assignments = rows.map((asset) => toInfrastructureAssignment(asset, byId.get(asset.assignedTo), asset.createdBy));
    return res.json({ success: true, assignments, data: assignments, total: count, pagination: { page, limit, total: count, pages: Math.max(1, Math.ceil(count / limit)) }, summary: { total: count, active: count, returned: 0, pending: 0 } });
  } catch (error) {
    console.error('Error fetching infrastructure assignments:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch infrastructure assignments' });
  }
};

const getAssignableInfrastructureAssets = async (req, res) => {
  try {
    const assets = await Infrastructure.findAll({ where: { assignedTo: null, status: { [Op.notIn]: ['Disposed', 'disposed', 'Missing', 'missing', 'Under Maintenance', 'under maintenance'] } }, attributes: assignmentAssetAttributes, order: [['name', 'ASC']] });
    return res.json({ success: true, assets, data: assets });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to load assignable infrastructure assets' });
  }
};

const getInfrastructureAssignmentUsers = async (req, res) => {
  try {
    const users = await User.findAll({ where: { active: true }, attributes: assignmentUserAttributes, order: [['fullName', 'ASC']] });
    return res.json({ success: true, users, data: users });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to load active users' });
  }
};

const updateInfrastructureAssignment = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const asset = await Infrastructure.findByPk(req.body.assetId ?? req.body.asset_id, { transaction, lock: transaction.LOCK.UPDATE });
    const user = await User.findByPk(req.body.userId ?? req.body.assigned_to, { transaction, lock: transaction.LOCK.UPDATE });
    if (!asset) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Infrastructure asset not found' }); }
    if (!user) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'User not found' }); }
    if (!user.active) { await transaction.rollback(); return res.status(409).json({ success: false, message: 'Cannot assign an asset to an inactive user' }); }
    if (asset.assignedTo) { await transaction.rollback(); return res.status(409).json({ success: false, message: 'Asset is already assigned' }); }
    const blocked = ['disposed', 'missing', 'under maintenance', 'under-maintenance', 'inactive'];
    if (blocked.includes(String(asset.status || '').trim().toLowerCase())) { await transaction.rollback(); return res.status(409).json({ success: false, message: `Asset cannot be assigned while its status is ${asset.status}` }); }
    await asset.update({ assignedTo: user.id, status: 'Assigned', ...(req.body.location ? { location: req.body.location } : {}) }, { transaction });
    await AuditLog.create({ userId: req.user.id, action: 'ASSIGN_INFRASTRUCTURE_ASSET', entity: `infrastructure_asset:${asset.id}`, details: JSON.stringify({ assetId: asset.id, assignedTo: user.id, location: req.body.location || asset.location || '' }) }, { transaction });
    await transaction.commit();
    return res.status(201).json({ success: true, message: 'Infrastructure asset assigned successfully', data: toInfrastructureAssignment(asset, user, req.user.id) });
  } catch (error) {
    await transaction.rollback();
    console.error('Error assigning infrastructure asset:', error);
    return res.status(500).json({ success: false, message: 'Unable to save infrastructure assignment' });
  }
};

const finishInfrastructureAssignment = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const asset = await Infrastructure.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!asset) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Assignment not found' }); }
    if (!asset.assignedTo) { await transaction.rollback(); return res.status(409).json({ success: false, message: 'Asset is not actively assigned' }); }
    const user = await User.findByPk(asset.assignedTo, { attributes: assignmentUserAttributes, transaction });
    await asset.update({ assignedTo: null, status: 'Operational' }, { transaction });
    await AuditLog.create({ userId: req.user.id, action: req.path.endsWith('/return') ? 'RETURN_INFRASTRUCTURE_ASSET' : 'CANCEL_INFRASTRUCTURE_ASSIGNMENT', entity: `infrastructure_asset:${asset.id}`, details: JSON.stringify({ assetId: asset.id, previousAssignee: user?.id || null }) }, { transaction });
    await transaction.commit();
    return res.json({ success: true, message: 'Infrastructure assignment closed successfully', data: toInfrastructureAssignment(asset, user, req.user.id) });
  } catch (error) {
    await transaction.rollback();
    return res.status(500).json({ success: false, message: 'Unable to close infrastructure assignment' });
  }
};

// Get all infrastructure assets
const getAllInfrastructureAssets = async (req, res) => {
  try {
    const { department, status, condition, type, search } = req.query;
    
    let where = {};
    
    // Apply filters
    if (department) where.department = department;
    if (status) where.status = status;
    if (condition) where.condition = condition;
    if (type) where.type = type;
    
    // Search
    if (search) {
      const { Op } = require('sequelize');
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { assetCode: { [Op.like]: `%${search}%` } },
        { serialNumber: { [Op.like]: `%${search}%` } },
        { location: { [Op.like]: `%${search}%` } }
      ];
    }
    
    const assets = await Infrastructure.findAll({
      where,
      order: [['createdAt', 'DESC']]
    });
    
    return res.json({
      success: true,
      data: assets
    });
  } catch (error) {
    console.error('Error fetching infrastructure assets:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch infrastructure assets'
    });
  }
};

const getInfrastructureInventory = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
    const where = {};
    const allowedSortFields = {
      name: 'name',
      assetCode: 'assetCode',
      purchaseDate: 'purchaseDate',
      purchasePrice: 'purchasePrice',
      status: 'status',
      createdAt: 'createdAt'
    };
    const sortBy = allowedSortFields[req.query.sortBy] || 'createdAt';
    const sortOrder = String(req.query.sortOrder || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    ['status', 'condition', 'category', 'location', 'department', 'type'].forEach((field) => {
      if (req.query[field]) where[field] = String(req.query[field]);
    });

    if (req.query.search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${req.query.search}%` } },
        { assetCode: { [Op.like]: `%${req.query.search}%` } },
        { category: { [Op.like]: `%${req.query.search}%` } },
        { type: { [Op.like]: `%${req.query.search}%` } },
        { location: { [Op.like]: `%${req.query.search}%` } },
        { rfidTag: { [Op.like]: `%${req.query.search}%` } },
        { serialNumber: { [Op.like]: `%${req.query.search}%` } }
      ];
    }

    const { count, rows } = await Infrastructure.findAndCountAll({
      where,
      order: [[sortBy, sortOrder]],
      limit,
      offset: (page - 1) * limit
    });

    const summaryRows = await Infrastructure.findAll({
      where,
      attributes: ['status'],
      raw: true
    });
    const summary = summaryRows.reduce((counts, asset) => {
      const status = String(asset.status || '').trim().toLowerCase();
      counts.total += 1;
      if (['available', 'operational', 'active', 'working'].includes(status)) counts.available += 1;
      if (['assigned', 'in use', 'in-use', 'issued'].includes(status)) counts.assigned += 1;
      if (status.includes('maintenance') || status.includes('repair')) counts.maintenance += 1;
      if (status.includes('missing') || status.includes('lost')) counts.missing += 1;
      if (status.includes('damaged') || status.includes('critical')) counts.damaged += 1;
      if (['disposed', 'retired'].includes(status)) counts.disposed += 1;
      return counts;
    }, { total: 0, available: 0, assigned: 0, maintenance: 0, missing: 0, damaged: 0, disposed: 0 });

    const [categoryRows, locationRows, conditionRows, statusRows] = await Promise.all([
      Infrastructure.findAll({ where, attributes: ['category'], group: ['category'], order: [['category', 'ASC']], raw: true }),
      Infrastructure.findAll({ where, attributes: ['location'], group: ['location'], order: [['location', 'ASC']], raw: true }),
      Infrastructure.findAll({ where, attributes: ['condition'], group: ['condition'], order: [['condition', 'ASC']], raw: true }),
      Infrastructure.findAll({ where, attributes: ['status'], group: ['status'], order: [['status', 'ASC']], raw: true })
    ]);

    return res.json({
      success: true,
      data: {
        assets: rows,
        summary,
        filters: {
          categories: categoryRows.map((row) => row.category).filter(Boolean),
          locations: locationRows.map((row) => row.location).filter(Boolean),
          conditions: conditionRows.map((row) => row.condition).filter(Boolean),
          statuses: statusRows.map((row) => row.status).filter(Boolean)
        }
      },
      pagination: { page, limit, total: count, pages: Math.max(1, Math.ceil(count / limit)) }
    });
  } catch (error) {
    console.error('Error fetching infrastructure inventory:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch infrastructure inventory' });
  }
};

const normalizeInfrastructureTrackingAsset = (asset) => {
  const data = asset.toJSON ? asset.toJSON() : asset;
  return {
    id: data.id,
    assetNumber: data.assetCode || data.asset_id || 'N/A',
    name: data.name || 'Unnamed infrastructure asset',
    category: data.category || data.type || 'Infrastructure',
    type: data.subcategory || data.type || data.category || 'Infrastructure',
    serialNumber: data.serialNumber || '',
    rfidTag: data.rfidTag || '',
    qrCode: data.qrCode || '',
    status: data.status || 'Operational',
    condition: data.condition || 'Good',
    building: data.building || '',
    room: data.room || '',
    location: data.location || '',
    department: data.department || '',
    assignedTo: data.assignedTo || null,
    lastInspectionDate: data.lastInspectionDate || null,
    lastMaintenanceDate: data.lastMaintenanceDate || null,
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null,
    notes: data.notes || '',
  };
};

const getInfrastructureTracking = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const search = String(req.query.search || '').trim();
    const status = String(req.query.status || '').trim();
    const location = String(req.query.location || '').trim();
    const tagType = String(req.query.tagType || '').trim().toLowerCase();

    const where = {};
    if (status) where.status = status;
    if (location) {
      where[Op.or] = [
        { location: { [Op.like]: `%${location}%` } },
        { building: { [Op.like]: `%${location}%` } },
        { room: { [Op.like]: `%${location}%` } }
      ];
    }
    if (tagType === 'rfid') where.rfidTag = { [Op.ne]: '' };
    if (tagType === 'qr') where.qrCode = { [Op.ne]: '' };
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { assetCode: { [Op.like]: `%${search}%` } },
        { serialNumber: { [Op.like]: `%${search}%` } },
        { rfidTag: { [Op.like]: `%${search}%` } },
        { qrCode: { [Op.like]: `%${search}%` } },
        { building: { [Op.like]: `%${search}%` } },
        { room: { [Op.like]: `%${search}%` } },
        { location: { [Op.like]: `%${search}%` } }
      ];
    }

    const { count, rows } = await Infrastructure.findAndCountAll({
      where,
      order: [['updatedAt', 'DESC'], ['id', 'DESC']],
      limit,
      offset: (page - 1) * limit,
      raw: true,
    });

    const data = rows.map(normalizeInfrastructureTrackingAsset);
    const summary = {
      total: count,
      active: rows.filter((row) => ['Operational', 'Available', 'Active', 'Working'].includes(String(row.status || '').trim())).length,
      rfid: rows.filter((row) => String(row.rfidTag || '').trim()).length,
      qr: rows.filter((row) => String(row.qrCode || '').trim()).length,
    };

    return res.json({
      success: true,
      data,
      summary,
      filters: {
        statuses: [...new Set(rows.map((row) => row.status).filter(Boolean))],
        locations: [...new Set(rows.flatMap((row) => [row.location, row.building, row.room]).filter(Boolean))],
      },
      pagination: {
        page,
        limit,
        total: count,
        pages: Math.max(1, Math.ceil(count / limit)),
        totalPages: Math.max(1, Math.ceil(count / limit)),
      },
    });
  } catch (error) {
    console.error('Error fetching infrastructure tracking records:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch infrastructure tracking records' });
  }
};

const scanInfrastructureTracking = async (req, res) => {
  try {
    const identifier = String(req.body?.identifier || req.body?.tag || req.body?.rfidTag || req.body?.qrCode || req.body?.search || '').trim();
    const scanType = String(req.body?.scanType || req.body?.type || 'manual').trim().toLowerCase();

    if (!identifier) {
      return res.status(422).json({ success: false, message: 'Scan value is required.' });
    }

    const where = {
      [Op.or]: [
        { rfidTag: identifier },
        { qrCode: identifier },
        { assetCode: identifier },
        { serialNumber: identifier },
        { name: identifier },
      ],
    };

    if (scanType === 'rfid') {
      where[Op.and] = [{ rfidTag: identifier }];
    }
    if (scanType === 'qr') {
      where[Op.and] = [{ qrCode: identifier }];
    }

    const asset = await Infrastructure.findOne({ where });
    if (!asset) {
      return res.status(404).json({ success: false, message: 'Asset not found.' });
    }

    const openWorkOrders = await MaintenanceWorkOrder.count({
      where: { assetId: asset.id, status: { [Op.notIn]: ['completed', 'cancelled'] } },
    });
    const recentAudit = await AuditLog.findAll({
      where: { entity: `infrastructure_asset:${asset.id}` },
      order: [['createdAt', 'DESC']],
      limit: 5,
      raw: true,
    });

    const payload = normalizeInfrastructureTrackingAsset(asset);
    return res.json({
      success: true,
      data: {
        ...payload,
        scanType,
        maintenance: {
          openWorkOrders,
        },
        history: recentAudit.map((entry) => ({
          id: entry.id,
          action: entry.action,
          details: entry.details,
          createdAt: entry.createdAt,
        })),
      },
      message: 'Asset found.',
    });
  } catch (error) {
    console.error('Infrastructure tracking scan failed:', error);
    return res.status(500).json({ success: false, message: 'Tracking service error.' });
  }
};

const roadStatuses = ['Operational', 'Under Maintenance', 'Inactive', 'Disposed'];
const roadConditions = ['Excellent', 'Good', 'Fair', 'Poor', 'Critical'];
const roadSpecificationFields = ['zone', 'roadType', 'surfaceType', 'length', 'width', 'area', 'drainageType', 'drainageLength', 'constructionDate', 'nextInspectionDate', 'contractor', 'lastInspectionDate'];
const roadWhere = (query = {}) => {
  const where = { [Op.or]: [
    { category: { [Op.like]: '%Road%' } }, { category: { [Op.like]: '%Drainage%' } },
    { subcategory: { [Op.like]: '%Road%' } }, { subcategory: { [Op.like]: '%Drainage%' } }
  ] };
  const search = String(query.search || '').trim();
  if (search) where[Op.and] = [{ [Op.or]: ['name', 'assetCode', 'location', 'building', 'category', 'subcategory'].map((field) => ({ [field]: { [Op.like]: `%${search}%` } })) }];
  const statusValues = { operational: 'Operational', maintenance: 'Under Maintenance', inactive: 'Inactive', disposed: 'Disposed' };
  const conditionValues = { excellent: 'Excellent', good: 'Good', fair: 'Fair', poor: 'Poor', critical: 'Critical' };
  if (query.status) where.status = statusValues[String(query.status).toLowerCase()] || String(query.status).trim();
  if (query.condition) where.condition = conditionValues[String(query.condition).toLowerCase()] || String(query.condition).trim();
  for (const field of ['location', 'building']) if (String(query[field] || '').trim()) where[field] = String(query[field]).trim();
  if (query.type) where.subcategory = String(query.type).trim();
  return where;
};
const roadResponse = (asset) => {
  const data = asset.toJSON ? asset.toJSON() : asset;
  const specifications = data.specifications && typeof data.specifications === 'object' ? data.specifications : {};
  return { ...data, infrastructureType: data.subcategory || data.category, ...specifications, specifications };
};
const roadPayload = (body, existing = {}) => {
  const currentSpecifications = existing.specifications && typeof existing.specifications === 'object' ? existing.specifications : {};
  const specifications = { ...currentSpecifications };
  for (const field of roadSpecificationFields) if (body[field] !== undefined) specifications[field] = body[field] === '' ? null : body[field];
  return {
    name: String(body.name || '').trim(), assetCode: String(body.assetCode ?? body.code ?? '').trim() || null,
    type: 'Fixed Asset', category: 'Roads & Drainage', subcategory: String(body.infrastructureType ?? body.subcategory ?? '').trim() || null,
    description: body.description === undefined ? existing.description : String(body.description || '').trim() || null,
    location: String(body.location || '').trim() || null, building: String(body.building || '').trim() || null,
    status: { operational: 'Operational', maintenance: 'Under Maintenance', inactive: 'Inactive', disposed: 'Disposed' }[String(body.status || existing.status || 'Operational').toLowerCase()] || body.status || existing.status || 'Operational',
    condition: { excellent: 'Excellent', good: 'Good', fair: 'Fair', poor: 'Poor', critical: 'Critical' }[String(body.condition || existing.condition || 'Good').toLowerCase()] || body.condition || existing.condition || 'Good',
    department: String(body.department || '').trim() || null, notes: body.notes === undefined ? existing.notes : String(body.notes || '').trim() || null,
    specifications
  };
};
const validateRoadPayload = (payload) => {
  if (!payload.name) return 'Road or drainage name is required';
  if (!payload.subcategory) return 'Infrastructure type is required';
  if (!payload.location) return 'Location is required';
  if (!roadStatuses.includes(payload.status)) return 'Invalid road or drainage status';
  if (!roadConditions.includes(payload.condition)) return 'Invalid road or drainage condition';
  for (const field of ['length', 'width', 'area', 'drainageLength']) { const value = payload.specifications[field]; if (value !== undefined && value !== null && value !== '' && (!Number.isFinite(Number(value)) || Number(value) < 0)) return `Invalid ${field}`; }
  for (const field of ['constructionDate', 'nextInspectionDate']) { const value = payload.specifications[field]; if (value && Number.isNaN(Date.parse(value))) return `Invalid ${field}`; }
  return null;
};
const getInfrastructureRoads = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1); const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10)); const where = roadWhere(req.query);
    const [{ count, rows }, summaryRows, filterRows] = await Promise.all([
      Infrastructure.findAndCountAll({ where, order: [['createdAt', 'DESC']], limit, offset: (page - 1) * limit }),
      Infrastructure.findAll({ where, attributes: ['status', 'condition'], raw: true }),
      Promise.all(['subcategory', 'status', 'condition', 'location', 'building'].map((field) => Infrastructure.findAll({ where: roadWhere(), attributes: [field], group: [field], order: [[field, 'ASC']], raw: true })))
    ]);
    const summary = summaryRows.reduce((result, row) => { result.total += 1; const status = String(row.status || '').toLowerCase(); const condition = String(row.condition || '').toLowerCase(); if (status === 'operational') result.operational += 1; if (status === 'under maintenance') result.maintenance += 1; if (status === 'inactive') result.inactive += 1; if (['critical', 'damaged'].includes(condition)) result.critical += 1; return result; }, { total: 0, operational: 0, maintenance: 0, inactive: 0, critical: 0 });
    return res.json({ success: true, data: rows.map(roadResponse), summary, filters: { types: filterRows[0].map((row) => row.subcategory).filter(Boolean), statuses: filterRows[1].map((row) => row.status).filter(Boolean), conditions: filterRows[2].map((row) => row.condition).filter(Boolean), locations: filterRows[3].map((row) => row.location).filter(Boolean), buildings: filterRows[4].map((row) => row.building).filter(Boolean) }, pagination: { page, limit, total: count, pages: Math.max(1, Math.ceil(count / limit)) } });
  } catch (error) { console.error('Error fetching roads and drainage:', error); return res.status(500).json({ success: false, message: 'Failed to fetch roads and drainage' }); }
};
const getInfrastructureRoad = async (req, res) => { const asset = await Infrastructure.findOne({ where: { id: req.params.id, ...roadWhere() } }); if (!asset) return res.status(404).json({ success: false, message: 'Road or drainage asset not found' }); return res.json({ success: true, data: roadResponse(asset) }); };
const saveInfrastructureRoad = async (req, res) => {
  try {
    const asset = req.params.id ? await Infrastructure.findOne({ where: { id: req.params.id, ...roadWhere() } }) : null;
    if (req.params.id && !asset) return res.status(404).json({ success: false, message: 'Road or drainage asset not found' });
    const payload = roadPayload(req.body || {}, asset ? asset.toJSON() : {}); const validationError = validateRoadPayload(payload); if (validationError) return res.status(422).json({ success: false, message: validationError });
    if (payload.assetCode) { const duplicate = await Infrastructure.findOne({ where: { assetCode: payload.assetCode, ...(asset ? { id: { [Op.ne]: asset.id } } : {}) } }); if (duplicate) return res.status(409).json({ success: false, message: 'Asset number already exists' }); }
    const saved = asset ? await asset.update(payload) : await Infrastructure.create({ ...payload, createdBy: req.user.id });
    await AuditLog.create({ userId: req.user.id, action: asset ? 'UPDATE_INFRASTRUCTURE_ROAD' : 'CREATE_INFRASTRUCTURE_ROAD', entity: `infrastructure_asset:${saved.id}`, details: JSON.stringify({ assetId: saved.id }) });
    return res.status(asset ? 200 : 201).json({ success: true, data: roadResponse(saved), message: asset ? 'Road or drainage asset updated successfully' : 'Road or drainage asset registered successfully' });
  } catch (error) { console.error('Error saving road or drainage asset:', error); if (error.name === 'SequelizeUniqueConstraintError') return res.status(409).json({ success: false, message: 'Asset number already exists' }); return res.status(500).json({ success: false, message: 'Failed to save road or drainage asset' }); }
};
const deactivateInfrastructureRoad = async (req, res) => {
  try { const asset = await Infrastructure.findOne({ where: { id: req.params.id, ...roadWhere() } }); if (!asset) return res.status(404).json({ success: false, message: 'Road or drainage asset not found' }); await asset.update({ status: 'Inactive' }); await AuditLog.create({ userId: req.user.id, action: 'DEACTIVATE_INFRASTRUCTURE_ROAD', entity: `infrastructure_asset:${asset.id}`, details: JSON.stringify({ assetId: asset.id }) }); return res.json({ success: true, data: roadResponse(asset), message: 'Road or drainage asset deactivated successfully' }); } catch (error) { console.error('Error deactivating road or drainage asset:', error); return res.status(500).json({ success: false, message: 'Failed to deactivate road or drainage asset' }); }
};

// Get single infrastructure asset
const getInfrastructureAsset = async (req, res) => {
  try {
    const { id } = req.params;
    
    const asset = await Infrastructure.findByPk(id);
    
    if (!asset) {
      return res.status(404).json({
        success: false,
        message: 'Infrastructure asset not found'
      });
    }
    
    return res.json({
      success: true,
      data: asset
    });
  } catch (error) {
    console.error('Error fetching infrastructure asset:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch infrastructure asset'
    });
  }
};

// Create infrastructure asset
const createInfrastructureAsset = async (req, res) => {
  try {
    const {
      name, type, category, subcategory, description,
      serialNumber, assetCode, rfidTag, qrCode,
      location, building, block, floor, room,
      status, condition, purchaseDate, purchasePrice,
      supplier, manufacturer, model, brand,
      warrantyExpiry, specifications, department, notes
    } = req.body;
    
    // Validate required fields
    if (!name || !category) {
      return res.status(400).json({
        success: false,
        message: 'Asset name and category are required'
      });
    }
    
    // Generate asset code if not provided
    let finalAssetCode = assetCode;
    if (!finalAssetCode) {
      const count = await Infrastructure.count();
      finalAssetCode = `INFRA-${Date.now()}-${count + 1}`;
    }
    
    const asset = await Infrastructure.create({
      name,
      type: type || 'Fixed Asset',
      category,
      subcategory,
      description,
      serialNumber,
      assetCode: finalAssetCode,
      rfidTag,
      qrCode,
      location,
      building,
      block,
      floor,
      room,
      status: status || 'Operational',
      condition: condition || 'Good',
      purchaseDate,
      purchasePrice: purchasePrice || 0,
      supplier,
      manufacturer,
      model,
      brand,
      warrantyExpiry,
      specifications: specifications || {},
      department,
      notes,
      createdBy: req.user?.id || 0
    });
    
    return res.status(201).json({
      success: true,
      data: asset,
      message: 'Infrastructure asset created successfully'
    });
  } catch (error) {
    console.error('Error creating infrastructure asset:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create infrastructure asset'
    });
  }
};

// Update infrastructure asset
const updateInfrastructureAsset = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedData = req.body;
    
    const asset = await Infrastructure.findByPk(id);
    
    if (!asset) {
      return res.status(404).json({
        success: false,
        message: 'Infrastructure asset not found'
      });
    }
    
    await asset.update(updatedData);
    
    return res.json({
      success: true,
      data: asset,
      message: 'Infrastructure asset updated successfully'
    });
  } catch (error) {
    console.error('Error updating infrastructure asset:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update infrastructure asset'
    });
  }
};

// Delete infrastructure asset
const deleteInfrastructureAsset = async (req, res) => {
  try {
    const { id } = req.params;
    
    const asset = await Infrastructure.findByPk(id);
    
    if (!asset) {
      return res.status(404).json({
        success: false,
        message: 'Infrastructure asset not found'
      });
    }
    
    await asset.destroy();
    
    return res.json({
      success: true,
      message: 'Infrastructure asset deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting infrastructure asset:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete infrastructure asset'
    });
  }
};

const inspectionFields = [
  'inspectionNumber', 'title', 'assetId', 'assetName', 'assetTag', 'category',
  'location', 'inspectionType', 'inspectionDate', 'nextInspectionDate',
  'inspector', 'condition', 'status', 'priority', 'safetyStatus',
  'operationalStatus', 'defects', 'findings', 'recommendations',
  'correctiveAction', 'estimatedCost', 'actualCost', 'photos', 'remarks'
];

const inspectionPayload = (body) => inspectionFields.reduce((payload, field) => {
  if (body[field] !== undefined) payload[field] = body[field] === '' ? null : body[field];
  return payload;
}, {});

const getInspectionAsset = async (assetId) => {
  if (assetId === undefined || assetId === null || assetId === '') return null;
  if (!/^\d+$/.test(String(assetId))) return null;
  return Infrastructure.findByPk(Number(assetId));
};

const inspectionSnapshot = (asset) => ({
  assetId: String(asset.id),
  assetName: asset.name,
  assetTag: asset.assetCode || null,
  category: asset.category || null,
  location: asset.location || asset.building || null
});

const authenticatedInspector = (user) => user?.fullName || user?.username || String(user?.id || '');

const getInfrastructureInspections = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
    const where = {};
    ['status', 'condition', 'priority', 'inspectionType', 'location'].forEach((field) => {
      if (req.query[field]) where[field] = req.query[field];
    });
    if (req.query.assetId) where.assetId = String(req.query.assetId);
    if (req.query.inspector) where.inspector = { [Op.like]: `%${String(req.query.inspector).trim()}%` };
    if (req.query.fromDate || req.query.toDate) {
      where.inspectionDate = {};
      if (req.query.fromDate) where.inspectionDate[Op.gte] = req.query.fromDate;
      if (req.query.toDate) where.inspectionDate[Op.lte] = req.query.toDate;
    }

    if (req.query.search) {
      where[Op.or] = [
        { inspectionNumber: { [Op.like]: `%${req.query.search}%` } },
        { title: { [Op.like]: `%${req.query.search}%` } },
        { assetName: { [Op.like]: `%${req.query.search}%` } },
        { assetTag: { [Op.like]: `%${req.query.search}%` } },
        { location: { [Op.like]: `%${req.query.search}%` } }
      ];
    }

    const { count, rows } = await InfrastructureInspection.findAndCountAll({
      where,
      order: [['inspectionDate', 'DESC'], ['createdAt', 'DESC']],
      limit,
      offset: (page - 1) * limit
    });

    return res.json({
      success: true,
      data: { inspections: rows, rows, total: count },
      pagination: { page, limit, total: count, pages: Math.ceil(count / limit) }
    });
  } catch (error) {
    console.error('Error fetching infrastructure inspections:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch infrastructure inspections' });
  }
};

const getInfrastructureInspectionAssets = async (req, res) => {
  try {
    const search = String(req.query.search || '').trim();
    const where = {};
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { assetCode: { [Op.like]: `%${search}%` } },
        { category: { [Op.like]: `%${search}%` } },
        { location: { [Op.like]: `%${search}%` } }
      ];
    }
    const assets = await Infrastructure.findAll({
      where,
      attributes: ['id', 'name', 'assetCode', 'category', 'location', 'building', 'condition', 'status'],
      order: [['name', 'ASC'], ['id', 'ASC']]
    });
    return res.json({ success: true, data: assets });
  } catch (error) {
    console.error('Error fetching inspection asset options:', error);
    return res.status(500).json({ success: false, message: 'Failed to load inspection asset options' });
  }
};

const createInfrastructureInspection = async (req, res) => {
  try {
    const payload = inspectionPayload(req.body);
    if (!payload.title || !payload.location || !payload.inspectionDate) {
      return res.status(400).json({ success: false, message: 'Title, location, and inspection date are required' });
    }

    const asset = await getInspectionAsset(payload.assetId);
    if (!asset) return res.status(422).json({ success: false, message: 'A valid infrastructure asset is required' });
    Object.assign(payload, inspectionSnapshot(asset), { inspector: authenticatedInspector(req.user) });

    const inspection = await InfrastructureInspection.create(payload);
    await AuditLog.create({ userId: req.user.id, action: 'CREATE_INFRASTRUCTURE_INSPECTION', entity: `infrastructure_inspection:${inspection.id}`, details: JSON.stringify({ inspectionId: inspection.id, assetId: asset.id }) });
    return res.status(201).json({ success: true, data: inspection, message: 'Infrastructure inspection created successfully' });
  } catch (error) {
    console.error('Error creating infrastructure inspection:', error);
    return res.status(500).json({ success: false, message: 'Failed to create infrastructure inspection' });
  }
};

const updateInfrastructureInspection = async (req, res) => {
  try {
    const inspection = await InfrastructureInspection.findByPk(req.params.id);
    if (!inspection) return res.status(404).json({ success: false, message: 'Infrastructure inspection not found' });

    if (String(inspection.status || '').toLowerCase() === 'completed') {
      return res.status(409).json({ success: false, message: 'Completed inspection records are official history and cannot be edited' });
    }

    const payload = inspectionPayload(req.body);
    if (payload.assetId !== undefined) {
      const asset = await getInspectionAsset(payload.assetId);
      if (!asset) return res.status(422).json({ success: false, message: 'A valid infrastructure asset is required' });
      Object.assign(payload, inspectionSnapshot(asset));
    }

    await inspection.update(payload);
    await AuditLog.create({ userId: req.user.id, action: 'UPDATE_INFRASTRUCTURE_INSPECTION', entity: `infrastructure_inspection:${inspection.id}`, details: JSON.stringify({ inspectionId: inspection.id }) });
    return res.json({ success: true, data: inspection, message: 'Infrastructure inspection updated successfully' });
  } catch (error) {
    console.error('Error updating infrastructure inspection:', error);
    return res.status(500).json({ success: false, message: 'Failed to update infrastructure inspection' });
  }
};

const deleteInfrastructureInspection = async (req, res) => {
  try {
    const inspection = await InfrastructureInspection.findByPk(req.params.id);
    if (!inspection) return res.status(404).json({ success: false, message: 'Infrastructure inspection not found' });

    if (String(inspection.status || '').toLowerCase() === 'completed') {
      return res.status(409).json({ success: false, message: 'Completed inspection records are official history and cannot be deleted' });
    }

    await inspection.destroy();
    await AuditLog.create({ userId: req.user.id, action: 'DELETE_INFRASTRUCTURE_INSPECTION', entity: `infrastructure_inspection:${inspection.id}`, details: JSON.stringify({ inspectionId: inspection.id }) });
    return res.json({ success: true, message: 'Infrastructure inspection deleted successfully' });
  } catch (error) {
    console.error('Error deleting infrastructure inspection:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete infrastructure inspection' });
  }
};

module.exports = {
  getInfrastructureSolar,
  getInfrastructureSolarById,
  saveInfrastructureSolar,
  deactivateInfrastructureSolar,
  getTransformers,
  getTransformer,
  createTransformer,
  updateTransformer,
  deactivateTransformer,
  getInfrastructureUps,
  getInfrastructureUpsById,
  saveInfrastructureUps,
  deactivateInfrastructureUps,
  getInfrastructureBuildings,
  getInfrastructureBuilding,
  createInfrastructureBuilding: saveInfrastructureBuilding,
  updateInfrastructureBuilding: saveInfrastructureBuilding,
  deactivateInfrastructureBuilding,
  getInfrastructureDashboard,
  getInfrastructureEnergy,
  getInfrastructureRoads,
  getInfrastructureRoad,
  saveInfrastructureRoad,
  deactivateInfrastructureRoad,
  getInfrastructureWorkOrders,
  getInfrastructureWorkOrder,
  getInfrastructureWorkOrderOptions,
  createInfrastructureWorkOrder,
  updateInfrastructureWorkOrder,
  transitionInfrastructureWorkOrder,
  getAllInfrastructureAssets,
  getInfrastructureInventory,
  getInfrastructureFuel,
  getInfrastructureFuelById,
  getInfrastructureFuelSummary,
  createInfrastructureFuel,
  updateInfrastructureFuel,
  deactivateInfrastructureFuel,
  getInfrastructureAsset,
  createInfrastructureAsset,
  updateInfrastructureAsset,
  deleteInfrastructureAsset,
  getInfrastructureInspections,
  getInfrastructureInspectionAssets,
  createInfrastructureInspection,
  updateInfrastructureInspection,
  deleteInfrastructureInspection,
  getInfrastructureAssignments,
  getAssignableInfrastructureAssets,
  getInfrastructureAssignmentUsers,
  updateInfrastructureAssignment,
  finishInfrastructureAssignment,
  getInfrastructureTracking,
  scanInfrastructureTracking
};
