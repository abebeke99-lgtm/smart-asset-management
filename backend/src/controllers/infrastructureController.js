// ==============================================
// Infrastructure Controller
// ==============================================
const { Infrastructure, MaintenanceWorkOrder } = require('../models');
const { Op } = require('sequelize');

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

module.exports = {
  getInfrastructureDashboard,
  getAllInfrastructureAssets,
  getInfrastructureAsset,
  createInfrastructureAsset,
  updateInfrastructureAsset,
  deleteInfrastructureAsset
};
