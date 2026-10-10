const { Op, Sequelize } = require('sequelize');
const { sequelize, Asset, Inventory, InventoryTransaction, User, Department, Maintenance, Approval, AssetReturn, Transfer, AssetMovement, VerificationSession, VerificationItem, AuditLog, Assignment } = require('../models');
const { normalizeInventory } = require('./inventoryController');

const inventoryAssetAttributes = ['id', 'assetCode', 'digitalId', 'name', 'category', 'subcategory', 'unit', 'serialNumber', 'rfidTag', 'status', 'condition', 'location', 'collegeId', 'description', 'purchaseDate', 'purchasePrice', 'supplier', 'warrantyExpiry', 'expiryDate', 'batchLot', 'campusId', 'buildingId', 'roomId', 'currentValue'];
const inventorySortFields = {
  id: ['id'], itemId: ['id'], assetId: [Asset, 'assetCode'], name: [Asset, 'name'], category: [Asset, 'category'],
  subcategory: [Asset, 'subcategory'], serialNumber: [Asset, 'serialNumber'], quantity: ['quantity'], unit: [Asset, 'unit'],
  purchaseDate: [Asset, 'purchaseDate'], purchaseCost: [Asset, 'purchasePrice'], supplier: [Asset, 'supplier'],
  status: [Asset, 'status'], condition: [Asset, 'condition'], location: ['location'], campus: [Asset, 'campusId'],
  building: [Asset, 'buildingId'], room: [Asset, 'roomId'], warranty: [Asset, 'warrantyExpiry'], expiryDate: [Asset, 'expiryDate'],
  qrCode: [Asset, 'digitalId'], rfid: [Asset, 'rfidTag'], batchLot: [Asset, 'batchLot'], createdAt: ['createdAt'], updatedAt: ['updatedAt'],
};

const storeScope = (req) => {
  const collegeId = Number(req.organizationScope?.collegeId ?? req.user?.collegeId ?? req.user?.college_id);
  if (!Number.isSafeInteger(collegeId) || collegeId <= 0) {
    const error = new Error('Store Manager college scope is not configured');
    error.statusCode = 403;
    throw error;
  }
  return { collegeId };
};

const assetInclude = (scope) => ({ model: Asset, attributes: ['id', 'assetCode', 'name', 'status', 'condition', 'location', 'category', 'collegeId'], required: true, where: scope });
const dateStart = () => { const value = new Date(); value.setHours(0, 0, 0, 0); return value; };
const label = (value) => String(value || '').replace(/[-_]/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());

const getStoreDashboard = async (req, res, next) => {
  try {
    const scope = storeScope(req);
    const { collegeId } = scope;
    const today = dateStart();
    const yearStart = new Date(new Date().getFullYear(), 0, 1);
    const pendingRequests = { status: 'pending' };
    const lowStockWhere = Sequelize.where(Sequelize.col('available_quantity'), Op.lte, Sequelize.col('minimum_quantity'));
    const [inventoryRows, requestCount, receiptCount, issueCount, returnCount, transferCount, maintenanceCount, readyForReturn, verificationScans, todayTransactions, recentTransactions, recentMovements, lowStockCount, lowStockAlerts, latestVerification, stockMovementRows, monthlyMovementRows] = await Promise.all([
      Inventory.findAll({ include: [assetInclude(scope)], attributes: ['id', 'assetId', 'quantity', 'availableQuantity', 'reservedQuantity', 'damagedQuantity', 'minimumQuantity', 'status'] }),
      Approval.count({ where: pendingRequests, include: [assetInclude(scope)] }),
      Approval.count({ where: { ...pendingRequests, type: { [Op.in]: ['receive', 'receiving', 'procurement', 'purchase'] } }, include: [assetInclude(scope)] }),
      Approval.count({ where: { status: 'approved', type: { [Op.in]: ['issue', 'asset_issue', 'request'] } }, include: [assetInclude(scope)] }),
      AssetReturn.count({ where: { status: { [Op.in]: ['Requested', 'Approved', 'Ready for Return'] } }, include: [assetInclude(scope)] }),
      Transfer.count({ where: { status: { [Op.in]: ['Requested', 'Approved', 'Ready', 'In Transit'] } }, include: [assetInclude(scope)] }),
      Maintenance.count({ where: { status: { [Op.in]: ['pending', 'approved', 'assigned', 'in-progress', 'under maintenance'] } }, include: [assetInclude(scope)] }),
      Maintenance.count({ where: { status: { [Op.in]: ['completed', 'ready for return'] } }, include: [assetInclude(scope)] }),
      VerificationItem.count({ where: { createdAt: { [Op.gte]: today } }, include: [{ model: VerificationSession, required: true, where: scope.collegeId ? { collegeId: scope.collegeId } : {} }] }),
      InventoryTransaction.findAll({ where: { createdAt: { [Op.gte]: today } }, include: [assetInclude(scope)], attributes: ['id', 'assetId', 'type', 'quantity', 'createdAt'], order: [['createdAt', 'DESC']] }),
      InventoryTransaction.findAll({ include: [assetInclude(scope), { model: User, attributes: ['fullName', 'username'] }], attributes: ['id', 'assetId', 'type', 'quantity', 'fromLocation', 'toLocation', 'createdAt'], order: [['createdAt', 'DESC']], limit: 8 }),
      AssetMovement.findAll({ include: [assetInclude(scope), { model: User, attributes: ['fullName', 'username'] }], order: [['createdAt', 'DESC']], limit: 8 }),
      Inventory.count({ where: lowStockWhere, include: [assetInclude(scope)], distinct: true }),
      Inventory.findAll({ where: lowStockWhere, include: [assetInclude(scope)], attributes: ['id', 'assetId', 'availableQuantity', 'minimumQuantity'], order: [['availableQuantity', 'ASC']], limit: 8 }),
      VerificationSession.findOne({ where: { collegeId }, include: [{ model: VerificationItem, attributes: ['state'] }], order: [['createdAt', 'DESC']] }),
      InventoryTransaction.findAll({ attributes: ['type', [Sequelize.fn('SUM', Sequelize.col('InventoryTransaction.quantity')), 'quantity']], include: [{ model: Asset, attributes: [], required: true, where: scope }], group: ['InventoryTransaction.type'], raw: true }),
      InventoryTransaction.findAll({ where: { createdAt: { [Op.gte]: yearStart } }, attributes: ['type', [Sequelize.fn('DATE_FORMAT', Sequelize.col('InventoryTransaction.created_at'), '%Y-%m'), 'month'], [Sequelize.fn('SUM', Sequelize.col('InventoryTransaction.quantity')), 'quantity']], include: [{ model: Asset, attributes: [], required: true, where: scope }], group: ['InventoryTransaction.type', Sequelize.fn('DATE_FORMAT', Sequelize.col('InventoryTransaction.created_at'), '%Y-%m')], raw: true }),
    ]);

    const activeInventory = inventoryRows.filter((row) => !['disposed', 'deleted', 'archived'].includes(String(row.Asset?.status || '').toLowerCase()));
    const inventoryByStatus = { available: 0, reserved: 0, assigned: 0, issued: 0, damaged: 0, underMaintenance: 0, missing: 0, retired: 0, disposed: 0 };
    inventoryRows.forEach((row) => {
      const status = String(row.Asset?.status || row.status || '').toLowerCase().replace(/[-_]+/g, ' ');
      const quantity = Number(row.quantity || 0);
      const damaged = Number(row.damagedQuantity || 0);
      if (status === 'disposed') inventoryByStatus.disposed += quantity;
      else if (['deleted', 'archived'].includes(status)) return;
      else if (status === 'retired') inventoryByStatus.retired += quantity;
      else if (['missing', 'lost'].includes(status)) inventoryByStatus.missing += quantity;
      else if (status.includes('maintenance')) inventoryByStatus.underMaintenance += quantity;
      else if (status === 'issued') inventoryByStatus.issued += Math.max(quantity - damaged, 0);
      else if (['assigned', 'in use'].includes(status)) inventoryByStatus.assigned += Math.max(quantity - damaged, 0);
      else if (status === 'damaged') inventoryByStatus.damaged += damaged || quantity;
      else if (status === 'reserved') inventoryByStatus.reserved += Number(row.reservedQuantity || quantity);
      else {
        inventoryByStatus.available += Number(row.availableQuantity || 0);
        inventoryByStatus.reserved += Number(row.reservedQuantity || 0);
        inventoryByStatus.damaged += damaged;
      }
    });
    const todayCounts = todayTransactions.reduce((counts, item) => ({ ...counts, [item.type]: (counts[item.type] || 0) + Number(item.quantity || 1) }), {});
    const categories = inventoryRows.reduce((counts, row) => {
      const category = row.Asset?.category || 'Uncategorized';
      counts[category] = (counts[category] || 0) + Number(row.quantity || 0);
      return counts;
    }, {});
    const movementKeys = { receive: 'received', received: 'received', issue: 'issued', issued: 'issued', return: 'returned', returned: 'returned', transfer: 'transferred', transferred: 'transferred', adjustment: 'adjusted', adjusted: 'adjusted', stock_adjustment: 'adjusted', consume: 'consumed', consumed: 'consumed', dispose: 'disposed', disposed: 'disposed' };
    const stockMovement = { received: 0, issued: 0, returned: 0, transferred: 0, adjusted: 0, consumed: 0, disposed: 0 };
    stockMovementRows.forEach((row) => { const key = movementKeys[String(row.type || '').toLowerCase()]; if (key) stockMovement[key] += Number(row.quantity || 0); });
    const monthlyMovements = Array.from({ length: 12 }, (_, index) => ({ month: `${new Date().getFullYear()}-${String(index + 1).padStart(2, '0')}`, received: 0, issued: 0, returned: 0, transferred: 0, adjusted: 0, consumed: 0, disposed: 0 }));
    const monthlyByKey = new Map(monthlyMovements.map((row) => [row.month, row]));
    monthlyMovementRows.forEach((row) => {
      const key = movementKeys[String(row.type || '').toLowerCase()];
      const month = monthlyByKey.get(row.month);
      if (key && month) month[key] += Number(row.quantity || 0);
    });
    const recent = recentTransactions.map((item) => ({ id: item.id, asset: item.Asset?.name || item.Asset?.assetCode || 'Asset', assetCode: item.Asset?.assetCode, type: label(item.type), date: item.createdAt, status: 'Recorded' }));
    const transactionIds = new Set(recentTransactions.map((item) => item.id));
    const activities = [
      ...recentTransactions.map((item) => ({ id: `transaction-${item.id}`, date: item.createdAt, user: item.User?.fullName || item.User?.username || 'Store', action: label(item.type), asset: item.Asset?.name || item.Asset?.assetCode || 'Asset', assetCode: item.Asset?.assetCode, quantity: Number(item.quantity || 0), location: item.toLocation || item.fromLocation || item.Asset?.location || '-', status: 'Recorded' })),
      ...recentMovements.filter((item) => item.referenceType !== 'inventory_transaction' || !transactionIds.has(Number(item.referenceId))).map((item) => ({ id: `movement-${item.id}`, date: item.createdAt, user: item.User?.fullName || item.User?.username || 'Store', action: label(item.movementType), asset: item.Asset?.name || item.Asset?.assetCode || 'Asset', assetCode: item.Asset?.assetCode, quantity: item.quantity ?? null, location: item.Asset?.location || item.destinationType || '-', status: 'Recorded' })),
    ].sort((first, second) => new Date(second.date) - new Date(first.date)).slice(0, 8);
    const movements = recentMovements.map((item) => ({ id: item.id, asset: item.Asset?.name || item.Asset?.assetCode || 'Asset', assetCode: item.Asset?.assetCode, type: label(item.movementType), from: item.sourceType || 'Store', to: item.destinationType || 'Store', performedBy: item.User?.fullName || item.User?.username || 'Store', date: item.createdAt, status: 'Recorded' }));
    const items = latestVerification?.VerificationItems || [];
    const verification = latestVerification ? { lastVerification: latestVerification.updatedAt || latestVerification.createdAt, verified: items.filter((item) => item.state === 'verified').length, missing: items.filter((item) => item.state === 'missing').length, damaged: items.filter((item) => item.state === 'damaged').length, unverified: items.filter((item) => item.state === 'needs_review').length, discrepancies: items.filter((item) => ['missing', 'damaged', 'wrong_location', 'unidentified'].includes(item.state)).length } : { lastVerification: null, verified: 0, missing: 0, damaged: 0, unverified: 0, discrepancies: 0 };
    const assignedAssets = inventoryByStatus.assigned + inventoryByStatus.issued;
    const damagedItems = inventoryByStatus.damaged;
    const inventoryHealth = { available: inventoryByStatus.available, assigned: assignedAssets, maintenance: inventoryByStatus.underMaintenance, missing: inventoryByStatus.missing, damaged: damagedItems };
    return res.json({ success: true, data: { kpis: { totalInventory: activeInventory.reduce((sum, row) => sum + Number(row.quantity || 0), 0), totalAssets: activeInventory.reduce((sum, row) => sum + Number(row.quantity || 0), 0), availableAssets: inventoryHealth.available, assignedAssets, damagedItems, pendingRequests: requestCount, pendingReceipts: receiptCount, pendingIssues: issueCount, pendingReturns: returnCount, pendingTransfers: transferCount, lowStock: lowStockCount }, status: { inMaintenance: maintenanceCount, awaitingVerification: verification.unverified, verificationDiscrepancies: verification.discrepancies }, today: { receipts: todayCounts.receive || 0, issues: todayCounts.issue || 0, returns: todayCounts.return || 0, transfers: todayCounts.transfer || 0, adjustments: todayCounts.adjustment || 0, verificationScans }, inventoryByStatus, categories, stockMovement, monthlyMovements, pendingTransactions: [{ type: 'Request', count: requestCount, route: '/store/requests' }, { type: 'Receipt', count: receiptCount, route: '/store/receive' }, { type: 'Issue', count: issueCount, route: '/store/issue' }, { type: 'Return', count: returnCount, route: '/store/returns' }, { type: 'Transfer', count: transferCount, route: '/store/transfers' }], recentActivities: activities, recentMovements: movements, recentTransactions: recent, lowStockAlerts: lowStockAlerts.map((row) => ({ id: row.id, item: row.Asset?.name || row.Asset?.assetCode || 'Inventory item', currentQuantity: row.availableQuantity, reorderLevel: row.minimumQuantity, severity: Number(row.availableQuantity) <= 0 ? 'Critical' : 'Low' })), verification, maintenance: { sentToMaintenance: maintenanceCount, underMaintenance: maintenanceCount, readyForReturn, returnedToStore: todayCounts.return || 0 }, health: { api: 'online', database: 'connected' } } });
  } catch (error) { return next(error); }
};

const normalizeMovementType = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return 'Movement';
  const key = raw.toLowerCase().replace(/[-\s]+/g, '_');
  const map = {
    received: 'Received',
    receive: 'Received',
    stock_added: 'Received',
    issue: 'Issue',
    issued: 'Issue',
    assign: 'Assigned',
    assigned: 'Assigned',
    assignment: 'Assigned',
    transfer: 'Transfer',
    transferred: 'Transfer',
    return: 'Return',
    returned: 'Return',
    maintenance: 'Maintenance',
    moved: 'Moved',
    location_change: 'Location Change',
    disposed: 'Disposed',
    stock_adjustment: 'Stock Adjustment',
    adjustment: 'Stock Adjustment',
    inspection: 'Inspection',
  };
  return map[key] || raw.replace(/[_-]/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
};

const getHistory = async (req, res, next) => {
  try {
    const scope = storeScope(req);
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(req.query.pageSize || req.query.limit, 10) || 25));
    const offset = (page - 1) * pageSize;

    const assetWhere = { ...scope };
    const search = String(req.query.search || '').trim();
    const movementWhere = {};
    const requestedAssetId = req.query.assetId ?? req.query.asset_id;
    if (requestedAssetId !== undefined) {
      const assetId = Number(requestedAssetId);
      if (!Number.isSafeInteger(assetId) || assetId <= 0) return res.status(400).json({ success: false, message: 'A valid asset ID is required' });
      assetWhere.id = assetId;
    }
    if (req.query.movementType) movementWhere.movementType = String(req.query.movementType);
    if (req.query.dateFrom || req.query.dateTo) {
      movementWhere.createdAt = {
        ...(req.query.dateFrom ? { [Op.gte]: new Date(req.query.dateFrom) } : {}),
        ...(req.query.dateTo ? { [Op.lte]: new Date(`${req.query.dateTo}T23:59:59.999Z`) } : {}),
      };
    }
    if (req.query.userId) movementWhere.performedBy = Number(req.query.userId);
    if (req.query.department) assetWhere.departmentId = Number(req.query.department);
    if (req.query.location) assetWhere.location = String(req.query.location);
    if (search) {
      assetWhere[Op.or] = ['assetCode', 'name', 'serialNumber', 'category', 'location'].map((field) => ({ [field]: { [Op.like]: `%${search}%` } }));
    }

    const include = [
      { model: Asset, attributes: ['id', 'name', 'assetCode', 'serialNumber', 'category', 'status', 'location', 'collegeId', 'departmentId'], required: true, where: assetWhere },
      { model: User, attributes: ['id', 'username', 'fullName', 'role'] },
    ];

    const { count, rows } = await AssetMovement.findAndCountAll({
      where: movementWhere,
      include,
      order: [['createdAt', 'DESC'], ['id', 'DESC']],
      limit: pageSize,
      offset,
      distinct: true,
    });

    const departmentIds = [...new Set(rows.flatMap((row) => [row.sourceId, row.destinationId]).filter((id) => Number.isInteger(id) && id > 0))];
    let departmentMap = new Map();
    if (departmentIds.length) {
      const departments = await Department.findAll({
        where: { id: { [Op.in]: departmentIds } },
        attributes: ['id', 'name', 'code'],
        raw: true,
      });
      departmentMap = new Map(departments.map((item) => [item.id, item.name || item.code || `Department ${item.id}`]));
    }

    const referenceTypes = [...new Set(rows.map((row) => row.referenceType).filter(Boolean))];
    const referenceMap = new Map();
    if (referenceTypes.includes('transfer')) {
      const transfers = await Transfer.findAll({ where: { id: { [Op.in]: rows.filter((row) => row.referenceType === 'transfer').map((row) => row.referenceId) } }, attributes: ['id', 'transferNumber', 'status', 'transferReason'], raw: true });
      transfers.forEach((row) => referenceMap.set(`transfer:${row.id}`, row));
    }
    if (referenceTypes.includes('return')) {
      const returns = await AssetReturn.findAll({ where: { id: { [Op.in]: rows.filter((row) => row.referenceType === 'return').map((row) => row.referenceId) } }, attributes: ['id', 'returnNumber', 'status', 'reason'], raw: true });
      returns.forEach((row) => referenceMap.set(`return:${row.id}`, row));
    }

    const items = rows.map((row) => {
      const asset = row.Asset || {};
      const sourceLabel = row.sourceType === 'department' && row.sourceId ? departmentMap.get(row.sourceId) || `Department ${row.sourceId}` : row.sourceType === 'user' ? 'User' : row.sourceType === 'store' ? 'Store' : row.sourceType || 'System';
      const destinationLabel = row.destinationType === 'department' && row.destinationId ? departmentMap.get(row.destinationId) || `Department ${row.destinationId}` : row.destinationType === 'user' ? 'User' : row.destinationType === 'store' ? 'Store' : row.destinationType || 'System';
      const referenceEntry = row.referenceType ? referenceMap.get(`${row.referenceType}:${row.referenceId}`) : null;
      const referenceNumber = referenceEntry?.transferNumber || referenceEntry?.returnNumber || null;
      const movementStatus = referenceEntry?.status || (row.referenceType === 'transfer' ? 'Completed' : row.referenceType === 'return' ? 'Closed' : 'Recorded');
      return {
        id: row.id,
        assetId: asset.id,
        assetName: asset.name,
        assetCode: asset.assetCode,
        serialNumber: asset.serialNumber,
        category: asset.category,
        currentLocation: asset.location,
        departmentId: asset.departmentId,
        movementType: row.movementType,
        movementLabel: normalizeMovementType(row.movementType),
        sourceType: row.sourceType,
        destinationType: row.destinationType,
        from: sourceLabel,
        to: destinationLabel,
        performedBy: row.performedBy,
        performedByName: row.User?.fullName || row.User?.username || 'System',
        referenceType: row.referenceType,
        referenceId: row.referenceId,
        referenceNumber,
        status: movementStatus,
        notes: row.notes || '',
        createdAt: row.createdAt,
      };
    });

    const [summaryData, typeRows, locationRows, departmentRows] = await Promise.all([
      AssetMovement.findAll({
        where: { ...scope, ...(req.user?.collegeId ? { createdAt: { [Op.gte]: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } } : {}) },
        attributes: ['id', 'movementType', 'createdAt', 'referenceType'],
        include: [{ model: Asset, attributes: ['id', 'collegeId'], required: true, where: scope }],
      }),
      AssetMovement.findAll({ where: { ...(scope.assetId ? {} : {}) }, attributes: ['movementType'], group: ['movementType'], raw: true, include: [{ model: Asset, attributes: [], required: true, where: scope }] }),
      Asset.findAll({ where: scope, attributes: ['location'], group: ['location'], raw: true }),
      Department.findAll({ where: scope.collegeId ? { collegeId: scope.collegeId } : {}, attributes: ['id', 'name', 'code'], raw: true }),
    ]);

    const summary = {
      totalMovements: summaryData.length,
      today: summaryData.filter((entry) => {
        const createdAt = new Date(entry.createdAt);
        const now = new Date();
        return createdAt >= new Date(now.getFullYear(), now.getMonth(), now.getDate());
      }).length,
      thisMonth: summaryData.filter((entry) => {
        const createdAt = new Date(entry.createdAt);
        const now = new Date();
        return createdAt.getMonth() === now.getMonth() && createdAt.getFullYear() === now.getFullYear();
      }).length,
      transfers: summaryData.filter((entry) => String(entry.movementType).toLowerCase() === 'transfer').length,
      issues: summaryData.filter((entry) => ['issue', 'issued', 'assignment'].includes(String(entry.movementType).toLowerCase())).length,
      returns: summaryData.filter((entry) => ['return', 'returned'].includes(String(entry.movementType).toLowerCase())).length,
    };

    const movementTypes = typeRows.map((row) => normalizeMovementType(row.movementType)).filter(Boolean);
    const locations = locationRows.map((row) => row.location).filter(Boolean);
    const departments = departmentRows.map((row) => ({ id: row.id, name: row.name || row.code || `Department ${row.id}` }));

    return res.json({
      success: true,
      data: {
        items,
        total: count,
        page,
        pageSize,
        totalPages: Math.ceil(count / pageSize),
        summary,
        filters: {
          movementTypes: [...new Set(movementTypes)],
          locations: [...new Set(locations)],
          departments,
        },
      },
    });
  } catch (error) {
    return next(error);
  }
};

const getDashboard = getStoreDashboard;

const getInventory = async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(req.query.pageSize || req.query.limit, 10) || 20));
    const { inventoryWhere, assetWhere, order } = buildInventoryQuery(req);
    const result = await Inventory.findAndCountAll({ where: inventoryWhere, include: inventoryIncludes(assetWhere), order, limit: pageSize, offset: (page - 1) * pageSize, distinct: true });
    const items = result.rows.map(normalizeInventory);
    const allScopeRows = await Inventory.findAll({ where: inventoryWhere, include: [{ model: Asset, attributes: ['status', 'collegeId', 'category', 'condition', 'location'], required: true, where: assetWhere }], attributes: ['quantity', 'availableQuantity', 'reservedQuantity', 'damagedQuantity', 'minimumQuantity', 'location'] });
    const summary = allScopeRows.reduce((stats, item) => {
      const status = String(item.Asset?.status || item.status || '').toLowerCase();
      const availableQuantity = Number(item.availableQuantity || 0);
      const minimumQuantity = Number(item.minimumQuantity || 0);
      stats.total += Number(item.quantity || 0);
      stats.available += ['available', 'in_store'].includes(status) ? availableQuantity : 0;
      stats.reserved += Number(item.reservedQuantity || 0);
      stats.assigned += ['assigned', 'issued'].includes(status) ? Math.max(0, Number(item.quantity || 0) - Number(item.availableQuantity || 0)) : 0;
      stats.damaged += Number(item.damagedQuantity || 0) + (status === 'damaged' ? Number(item.quantity || 0) : 0);
      stats.missing += ['missing', 'lost'].includes(status) ? Number(item.quantity || 0) : 0;
      stats.lowStock += availableQuantity <= minimumQuantity ? 1 : 0;
      stats.normalStock += availableQuantity > minimumQuantity ? 1 : 0;
      stats.criticalStock += availableQuantity <= 0 ? 1 : 0;
      return stats;
    }, { total: 0, available: 0, reserved: 0, assigned: 0, damaged: 0, missing: 0, lowStock: 0, normalStock: 0, criticalStock: 0 });
    return res.json({
      success: true,
      data: items,
      summary,
      filters: {
        categories: [...new Set(allScopeRows.map((row) => row.Asset?.category).filter(Boolean))].sort(),
        locations: [...new Set(allScopeRows.map((row) => row.location || row.Asset?.location).filter(Boolean))].sort(),
        conditions: [...new Set(allScopeRows.map((row) => row.Asset?.condition).filter(Boolean))].sort(),
      },
      pagination: { page, pageSize, limit: pageSize, total: result.count, totalPages: Math.ceil(result.count / pageSize) },
    });
  } catch (error) { return next(error); }
};

const buildInventoryQuery = (req) => {
  const inventoryWhere = {};
  const assetWhere = { ...storeScope(req) };
  const search = String(req.query.search || '').trim();
  const clauses = [];
  if (req.query.status) assetWhere.status = String(req.query.status).toLowerCase();
  if (req.query.category) assetWhere.category = String(req.query.category);
  if (req.query.condition) assetWhere.condition = String(req.query.condition);
  if (req.query.location) {
    const location = String(req.query.location);
    inventoryWhere[Op.or] = [
      { location },
      Sequelize.where(Sequelize.col('Asset.location'), Op.eq, location),
    ];
  }
  const inventoryIdSearch = search.match(/^INV-(\d+)$/i);
  if (inventoryIdSearch) inventoryWhere.id = Number(inventoryIdSearch[1]);
  else if (search) assetWhere[Op.or] = ['assetCode', 'name', 'category', 'subcategory', 'serialNumber', 'rfidTag', 'digitalId', 'supplier', 'batchLot'].map((field) => ({ [field]: { [Op.like]: `%${search}%` } }));
  if (String(req.query.lowStockOnly).toLowerCase() === 'true') clauses.push(Sequelize.where(Sequelize.col('available_quantity'), Op.lte, Sequelize.col('minimum_quantity')));
  if (clauses.length) inventoryWhere[Op.and] = clauses;
  const sortField = inventorySortFields[req.query.sortBy] || inventorySortFields.id;
  const direction = String(req.query.sortOrder).toLowerCase() === 'desc' ? 'DESC' : 'ASC';
  const order = [[...sortField, direction]];
  if (req.query.sortBy !== 'id' && req.query.sortBy !== 'itemId') order.push(['id', 'ASC']);
  return { inventoryWhere, assetWhere, order };
};

const inventoryIncludes = (assetWhere) => [
  {
    model: Asset,
    attributes: inventoryAssetAttributes,
    required: true,
    where: assetWhere,
    include: [
      { model: require('../models/Campus'), as: 'CampusRecord', attributes: ['campusName'] },
      { model: require('../models/Building'), as: 'BuildingRecord', attributes: ['buildingName'] },
      { model: require('../models/Room'), as: 'RoomRecord', attributes: ['roomName'] },
    ],
  },
  { model: Department, attributes: ['id', 'name'] },
];

const getInventoryDetail = async (req, res, next) => {
  try {
    const inventoryId = Number(req.params.id);
    if (!Number.isSafeInteger(inventoryId) || inventoryId <= 0) return res.status(404).json({ success: false, message: 'Inventory item not found' });
    const item = await Inventory.findOne({ where: { id: inventoryId }, include: inventoryIncludes(storeScope(req)) });
    if (!item) return res.status(404).json({ success: false, message: 'Inventory item not found' });
    return res.json({ success: true, data: normalizeInventory(item) });
  } catch (error) { return next(error); }
};

const exportInventory = async (req, res, next) => {
  try {
    const { inventoryWhere, assetWhere, order } = buildInventoryQuery(req);
    const items = await Inventory.findAll({ where: inventoryWhere, include: inventoryIncludes(assetWhere), order, distinct: true });
    await AuditLog.create({
      userId: req.user.id,
      action: 'Inventory Exported',
      entity: 'inventory:export',
      details: JSON.stringify({ count: items.length, filters: { search: req.query.search || '', status: req.query.status || '', category: req.query.category || '', location: req.query.location || '', condition: req.query.condition || '', lowStockOnly: String(req.query.lowStockOnly).toLowerCase() === 'true' } }),
    });
    return res.json({ success: true, data: items.map(normalizeInventory), total: items.length });
  } catch (error) { return next(error); }
};

const getLowStock = async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(req.query.pageSize || req.query.limit, 10) || 25));
    const scope = storeScope(req);
    const inventoryWhere = { [Op.and]: [Sequelize.where(Sequelize.col('available_quantity'), Op.lte, Sequelize.col('minimum_quantity'))] };
    const assetWhere = { ...scope, status: { [Op.notIn]: ['disposed', 'deleted', 'archived', 'missing', 'lost', 'retired', 'inactive'] } };
    const search = String(req.query.search || '').trim();
    if (req.query.category) assetWhere.category = String(req.query.category);
    if (req.query.location) assetWhere.location = String(req.query.location);
    if (search) assetWhere[Op.or] = ['assetCode', 'name', 'category', 'location', 'serialNumber', 'rfidTag'].map((field) => ({ [field]: { [Op.like]: `%${search}%` } }));
    const severity = String(req.query.severity || '').toLowerCase();
    if (!['', 'low', 'critical', 'out_of_stock'].includes(severity)) return res.status(400).json({ success: false, message: 'Invalid severity filter' });
    if (severity === 'out_of_stock') inventoryWhere[Op.and].push({ availableQuantity: { [Op.lte]: 0 } });
    if (severity === 'critical') inventoryWhere[Op.and].push(Sequelize.where(Sequelize.col('available_quantity'), Op.lte, Sequelize.literal('minimum_quantity / 2')));
    if (severity === 'low') inventoryWhere[Op.and].push({ availableQuantity: { [Op.gt]: 0 } });
    const include = [{ model: Asset, attributes: ['id', 'assetCode', 'name', 'category', 'status', 'condition', 'location', 'serialNumber', 'rfidTag', 'collegeId'], required: true, where: assetWhere }, { model: Department, attributes: ['id', 'name'] }];
    const sortFields = { severity: Sequelize.literal('available_quantity ASC'), currentStock: ['availableQuantity', 'ASC'], shortage: Sequelize.literal('(minimum_quantity - available_quantity) DESC'), reorderLevel: ['minimumQuantity', 'DESC'], lastUpdated: ['updatedAt', 'DESC'], name: [Asset, 'name', 'ASC'] };
    const sortBy = sortFields[req.query.sortBy] ? String(req.query.sortBy) : 'shortage';
    const sortOrder = String(req.query.sortOrder || '').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    const order = sortBy === 'severity' || sortBy === 'shortage' ? [[sortFields[sortBy]]] : [[...(Array.isArray(sortFields[sortBy]) ? sortFields[sortBy] : ['updatedAt', sortOrder])]];
    const result = await Inventory.findAndCountAll({ where: inventoryWhere, include, order, limit: pageSize, offset: (page - 1) * pageSize, distinct: true });
    const items = result.rows.map((item) => {
      const current = Number(item.availableQuantity || 0);
      const reorder = Number(item.minimumQuantity || 0);
      const itemSeverity = current <= 0 ? 'OUT_OF_STOCK' : current <= reorder / 2 ? 'CRITICAL' : 'LOW';
      return { id: item.id, assetId: item.assetId, item: item.Asset?.name || 'Inventory Item', assetCode: item.Asset?.assetCode || '', category: item.Asset?.category || '', condition: item.Asset?.condition || '', location: item.Asset?.location || item.location || '', currentStock: Number(item.quantity || 0), available: current, reserved: Number(item.reservedQuantity || 0), assigned: Math.max(0, Number(item.quantity || 0) - current - Number(item.reservedQuantity || 0) - Number(item.damagedQuantity || 0)), reorderLevel: reorder, shortage: Math.max(reorder - current, 0), severity: itemSeverity, lastUpdated: item.updatedAt, serialNumber: item.Asset?.serialNumber || '', rfidTag: item.Asset?.rfidTag || '' };
    });
    const summaryRows = await Inventory.findAll({ where: inventoryWhere, include: [{ model: Asset, attributes: ['category', 'location'], required: true, where: assetWhere }], attributes: ['availableQuantity', 'minimumQuantity'], raw: true });
    const summary = summaryRows.reduce((resultValue, row) => { const current = Number(row.availableQuantity || 0); const reorder = Number(row.minimumQuantity || 0); resultValue.lowStock += 1; resultValue.critical += current > 0 && current <= reorder / 2 ? 1 : 0; resultValue.outOfStock += current <= 0 ? 1 : 0; resultValue.totalShortage += Math.max(reorder - current, 0); return resultValue; }, { lowStock: 0, critical: 0, outOfStock: 0, totalShortage: 0 });
    summary.categoriesAffected = new Set(summaryRows.map((row) => row['Asset.category']).filter(Boolean)).size;
    summary.locationsAffected = new Set(summaryRows.map((row) => row['Asset.location']).filter(Boolean)).size;
    return res.json({ success: true, data: { items, total: result.count, summary, pagination: { page, pageSize, total: result.count, totalPages: Math.ceil(result.count / pageSize) } } });
  } catch (error) {
    return next(error);
  }
};

const getAvailableAssets = async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(req.query.pageSize || req.query.limit, 10) || 20));
    const scope = storeScope(req);
    const search = String(req.query.search || '').trim();
    const assetWhere = { ...scope, status: { [Op.in]: ['available', 'in_store', 'active'] }, condition: { [Op.notIn]: ['damaged', 'broken', 'unusable'] } };
    if (req.query.category) assetWhere.category = String(req.query.category);
    if (req.query.location) assetWhere.location = String(req.query.location);
    if (req.query.condition) assetWhere.condition = String(req.query.condition);
    if (req.query.department) {
      const departmentId = Number(req.query.department);
      if (!Number.isSafeInteger(departmentId) || departmentId <= 0) return res.status(400).json({ success: false, message: 'A valid department filter is required' });
      assetWhere.departmentId = departmentId;
    }
    const assetType = String(req.query.assetType || '').toLowerCase();
    if (assetType === 'serialized') assetWhere.serialNumber = { [Op.ne]: '' };
    else if (assetType === 'bulk') assetWhere.serialNumber = { [Op.or]: [{ [Op.is]: null }, { [Op.eq]: '' }] };
    else if (assetType) return res.status(400).json({ success: false, message: 'Asset type must be serialized or bulk' });
    const numericSearch = search.match(/^\d+$/);
    if (numericSearch) assetWhere.id = Number(numericSearch);
    else if (search) assetWhere[Op.or] = ['assetCode', 'name', 'category', 'location', 'serialNumber', 'rfidTag', 'digitalId'].map((field) => ({ [field]: { [Op.like]: `%${search}%` } }));

    const [assigned, transferred, maintained] = await Promise.all([
      Assignment.findAll({ where: { status: 'active' }, include: [{ model: Asset, required: true, attributes: [], where: scope }], attributes: ['assetId'], raw: true }),
      Transfer.findAll({ where: { status: { [Op.in]: ['Requested', 'Approved', 'Ready', 'In Progress', 'In Transit'] } }, include: [{ model: Asset, required: true, attributes: [], where: scope }], attributes: ['assetId'], raw: true }),
      Maintenance.findAll({ where: { status: { [Op.in]: ['pending', 'approved', 'assigned', 'in-progress', 'under maintenance'] } }, include: [{ model: Asset, required: true, attributes: [], where: scope }], attributes: ['assetId'], raw: true }),
    ]);
    const blockedAssetIds = [...new Set([...assigned, ...transferred, ...maintained].map((row) => row.assetId).filter(Boolean))];
    const inventoryWhere = { availableQuantity: { [Op.gt]: 0 } };
    const availability = String(req.query.availability || 'in_stock').toLowerCase();
    if (availability === 'reserved') inventoryWhere.reservedQuantity = { [Op.gt]: 0 };
    else if (availability !== 'in_stock') return res.status(400).json({ success: false, message: 'Availability must be in_stock or reserved' });
    if (blockedAssetIds.length) inventoryWhere.assetId = { [Op.notIn]: blockedAssetIds };
    const sortFields = new Set(['assetCode', 'name', 'category', 'location', 'condition', 'updatedAt', 'quantity', 'availableQuantity']);
    const sortBy = sortFields.has(req.query.sortBy) ? req.query.sortBy : 'name';
    const sortOrder = String(req.query.sortOrder || 'asc').toLowerCase() === 'desc' ? 'DESC' : 'ASC';
    const order = sortBy === 'updatedAt' ? [['updatedAt', sortOrder]] : [[Asset, sortBy, sortOrder]];
    const include = [{ model: Asset, attributes: ['id', 'assetCode', 'name', 'category', 'status', 'condition', 'location', 'serialNumber', 'digitalId', 'rfidTag', 'collegeId', 'departmentId', 'unit'], required: true, where: assetWhere }];
    const scopeInclude = [{ model: Asset, attributes: ['id', 'category', 'condition', 'location', 'serialNumber', 'departmentId', 'unit'], required: true, where: scope }];
    const [scopeRows, result] = await Promise.all([
      Inventory.findAll({ where: { availableQuantity: { [Op.gt]: 0 } }, include: scopeInclude, attributes: ['id', 'availableQuantity', 'location'] }),
      Inventory.findAndCountAll({ where: inventoryWhere, include, order, limit: pageSize, offset: (page - 1) * pageSize, distinct: true }),
    ]);
    const departmentIds = [...new Set(scopeRows.map((row) => row.Asset?.departmentId || row.departmentId).filter(Number.isInteger).filter((id) => id > 0))];
    const departmentRows = departmentIds.length ? await Department.findAll({ where: { id: { [Op.in]: departmentIds } }, attributes: ['id', 'name', 'code'], raw: true }) : [];
    const filters = {
      categories: [...new Set(scopeRows.map((row) => row.Asset?.category).filter(Boolean))].sort(),
      locations: [...new Set(scopeRows.map((row) => row.Asset?.location || row.location).filter(Boolean))].sort(),
      conditions: [...new Set(scopeRows.map((row) => row.Asset?.condition).filter(Boolean))].sort(),
      departments: departmentRows.map((department) => ({ id: department.id, name: department.name || department.code || `Department ${department.id}` })),
      assetTypes: [...new Set(scopeRows.map((row) => (String(row.Asset?.serialNumber || '').trim() ? 'serialized' : 'bulk')))],
    };
    const itemAssetType = (asset) => (String(asset?.serialNumber || '').trim() ? 'serialized' : 'bulk');
    const items = result.rows.map((row) => ({ id: row.assetId, assetId: row.assetId, assetCode: row.Asset?.assetCode, name: row.Asset?.name, category: row.Asset?.category, status: 'Available', condition: row.Asset?.condition, location: row.Asset?.location || row.location, serialNumber: row.Asset?.serialNumber, rfidTag: row.Asset?.rfidTag, availableQuantity: Number(row.availableQuantity || 0), reservedQuantity: Number(row.reservedQuantity || 0), damagedQuantity: Number(row.damagedQuantity || 0), quantity: Number(row.quantity || 0), unit: row.Asset?.unit || 'unit', departmentId: row.Asset?.departmentId || row.departmentId || null, assetType: itemAssetType(row.Asset), inventoryStatus: row.status }));
    const today = dateStart();
    const [availableToday, awaitingIssue, lowStock] = await Promise.all([
      InventoryTransaction.count({ where: { type: 'receive', createdAt: { [Op.gte]: today } }, include }),
      Approval.count({ where: { status: 'approved', type: { [Op.in]: ['issue', 'asset_issue', 'request'] } }, include }),
      Inventory.count({ where: Sequelize.where(Sequelize.col('available_quantity'), Op.lte, Sequelize.col('minimum_quantity')), include }),
    ]);
    const summary = { totalAvailable: scopeRows.reduce((sum, row) => sum + Number(row.availableQuantity || 0), 0), availableToday, awaitingIssue, lowStock };
    return res.json({ success: true, data: { items, total: result.count, summary, filters, pagination: { page, pageSize, total: result.count, totalPages: Math.ceil(result.count / pageSize) } } });
  } catch (error) {
    return next(error);
  }
};

const getStockAdjustments = async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(req.query.pageSize || req.query.limit, 10) || 25));
    const scope = storeScope(req);
    const where = { type: 'adjustment' };
    if (req.query.dateFrom || req.query.dateTo) where.createdAt = { ...(req.query.dateFrom ? { [Op.gte]: new Date(req.query.dateFrom) } : {}), ...(req.query.dateTo ? { [Op.lte]: new Date(`${req.query.dateTo}T23:59:59.999Z`) } : {}) };
    if (req.query.reason) where.reason = String(req.query.reason);
    const assetWhere = { ...scope };
    const search = String(req.query.search || '').trim();
    if (search) assetWhere[Op.or] = ['assetCode', 'name', 'category', 'serialNumber'].map((field) => ({ [field]: { [Op.like]: `%${search}%` } }));
    const include = [{ model: Asset, attributes: ['id', 'assetCode', 'name', 'category', 'location', 'serialNumber', 'collegeId'], required: true, where: assetWhere }, { model: User, attributes: ['id', 'fullName', 'username', 'role'] }];
    const order = String(req.query.sortOrder || '').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    const result = await InventoryTransaction.findAndCountAll({ where, include, order: [['createdAt', order]], limit: pageSize, offset: (page - 1) * pageSize, distinct: true });
    const rows = result.rows.map((row) => {
      let details = {}; try { details = JSON.parse(row.notes || '{}'); } catch { details = {}; }
      const adjustment = details.adjustmentType === 'decrease' ? -Number(row.quantity || 0) : Number(row.quantity || 0);
      return { id: row.id, adjustmentId: `ADJ-${String(row.id).padStart(6, '0')}`, date: row.createdAt, item: row.Asset?.name || 'Inventory Item', assetId: row.assetId, assetCode: row.Asset?.assetCode || '', category: row.Asset?.category || '', location: row.toLocation || row.Asset?.location || '', previousQuantity: details.previousQuantity ?? null, adjustment, newQuantity: details.newQuantity ?? null, direction: adjustment < 0 ? 'decrease' : 'increase', reason: row.reason || '', notes: details.notes || '', reference: details.reference || '', performedBy: row.User?.fullName || row.User?.username || 'Store Manager', status: 'Completed', movementId: row.id };
    });
    const allRows = await InventoryTransaction.findAll({ where, include: [{ model: Asset, attributes: [], required: true, where: assetWhere }], attributes: ['quantity', 'notes', 'createdAt'], raw: true });
    const summary = allRows.reduce((value, row) => { let details = {}; try { details = JSON.parse(row.notes || '{}'); } catch { details = {}; } const amount = Number(row.quantity || 0); if (details.adjustmentType === 'decrease') value.decreased += amount; else value.increased += amount; if (new Date(row.createdAt) >= dateStart()) value.today += 1; return value; }, { today: 0, increased: 0, decreased: 0 });
    summary.net = summary.increased - summary.decreased;
    return res.json({ success: true, data: { items: rows, total: result.count, summary, pagination: { page, pageSize, total: result.count, totalPages: Math.ceil(result.count / pageSize) } } });
  } catch (error) { return next(error); }
};

const getReceipts = async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(req.query.pageSize || req.query.limit, 10) || 25));
    const scope = storeScope(req);
    const where = { type: 'receive' };
    const assetWhere = { ...scope };
    const search = String(req.query.search || '').trim();
    if (search) where[Op.or] = [
      { notes: { [Op.like]: `%${search}%` } },
      ...['assetCode', 'name', 'category', 'serialNumber'].map((field) => ({ [`$Asset.${field}$`]: { [Op.like]: `%${search}%` } })),
    ];
    if (req.query.dateFrom || req.query.dateTo) where.createdAt = { ...(req.query.dateFrom ? { [Op.gte]: new Date(req.query.dateFrom) } : {}), ...(req.query.dateTo ? { [Op.lte]: new Date(`${req.query.dateTo}T23:59:59.999Z`) } : {}) };
    const include = [{ model: Asset, attributes: ['id', 'assetCode', 'name', 'category', 'unit', 'location', 'serialNumber', 'collegeId'], required: true, where: assetWhere }, { model: User, attributes: ['id', 'fullName', 'username'] }];
    const result = await InventoryTransaction.findAndCountAll({ where, include, order: [['createdAt', 'DESC']], limit: pageSize, offset: (page - 1) * pageSize, distinct: true });
    const rows = result.rows.map((row) => { let details = {}; try { details = JSON.parse(row.notes || '{}'); } catch { details = { notes: row.notes || '' }; } return { id: row.id, receiptNumber: details.reference || `RCV-${String(row.id).padStart(6, '0')}`, date: details.receivedDate || row.createdAt, asset: row.Asset?.name || 'Inventory Item', assetId: row.assetId, assetCode: row.Asset?.assetCode || '', category: details.category || row.Asset?.category || '', unit: details.unit || row.Asset?.unit || 'unit', quantity: Number(row.quantity || 0), location: row.toLocation || row.Asset?.location || '', condition: details.condition || '', supplier: details.supplier || row.Asset?.supplier || '', purchaseOrder: details.purchaseOrder || '', invoice: details.invoice || '', deliveryNote: details.deliveryNote || '', unitPrice: details.unitPrice ?? null, totalCost: details.totalCost ?? null, batchNumber: details.batchNumber || '', expiryDate: details.expiryDate || null, notes: details.notes || '', receivedBy: row.User?.fullName || row.User?.username || 'Store Manager', status: 'Received' }; });
    const today = dateStart(); const month = new Date(); month.setDate(1); month.setHours(0, 0, 0, 0);
    let todayQuantity; let monthQuantity;
    try {
      const scopedAssetInclude = [include[0]];
      [todayQuantity, monthQuantity] = await Promise.all([
        InventoryTransaction.sum('quantity', { where: { type: 'receive', createdAt: { [Op.gte]: today } }, include: scopedAssetInclude }),
        InventoryTransaction.sum('quantity', { where: { type: 'receive', createdAt: { [Op.gte]: month } }, include: scopedAssetInclude }),
      ]);
    } catch (summaryError) {
      console.error('Store receipt summary query failed:', summaryError.name);
    }
    return res.json({ success: true, data: { items: rows, total: result.count, summary: { receivedToday: todayQuantity === undefined ? null : Number(todayQuantity || 0), receivedThisMonth: monthQuantity === undefined ? null : Number(monthQuantity || 0), pendingInspection: null }, pagination: { page, pageSize, total: result.count, totalPages: Math.ceil(result.count / pageSize) } } });
  } catch (error) { return next(error); }
};

module.exports = {
  getDashboard,
  getHistory,
  getInventory,
  getInventoryDetail,
  exportInventory,
  getLowStock,
  getAvailableAssets,
  getStockAdjustments,
  getReceipts,
};
