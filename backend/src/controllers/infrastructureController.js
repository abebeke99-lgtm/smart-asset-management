// ==============================================
// Infrastructure Controller
// ==============================================
const { Infrastructure } = require('../models');

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
  getAllInfrastructureAssets,
  getInfrastructureAsset,
  createInfrastructureAsset,
  updateInfrastructureAsset,
  deleteInfrastructureAsset
};
