// ==============================================
// Infrastructure Asset Model
// ==============================================
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Infrastructure = sequelize.define('Infrastructure', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    type: {
      type: DataTypes.STRING(100),
      // Fixed Asset Types: Building, Electrical Equipment, Generator, Transformer, UPS, Solar, Water Pump, Water Tank, etc.
      // Non-Fixed Types: Spare Parts, Materials, Fuel, etc.
      defaultValue: 'Fixed Asset'
    },
    category: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    subcategory: {
      type: DataTypes.STRING(255)
    },
    description: {
      type: DataTypes.TEXT
    },
    serialNumber: {
      type: DataTypes.STRING(255),
      unique: true,
      sparse: true
    },
    assetCode: {
      type: DataTypes.STRING(255),
      unique: true,
      sparse: true
    },
    rfidTag: {
      type: DataTypes.STRING(255),
      unique: true,
      sparse: true
    },
    qrCode: {
      type: DataTypes.STRING(255),
      unique: true,
      sparse: true
    },
    
    // Location Information
    location: {
      type: DataTypes.STRING(255)
    },
    building: {
      type: DataTypes.STRING(255)
    },
    block: {
      type: DataTypes.STRING(100)
    },
    floor: {
      type: DataTypes.STRING(100)
    },
    room: {
      type: DataTypes.STRING(100)
    },
    
    // Asset Details
    status: {
      type: DataTypes.STRING(100),
      defaultValue: 'Operational'
      // Operational, Under Maintenance, Inactive, Disposed
    },
    condition: {
      type: DataTypes.STRING(100),
      defaultValue: 'Good'
      // Excellent, Good, Fair, Poor, Critical
    },
    
    // Purchase Information
    purchaseDate: {
      type: DataTypes.DATE
    },
    purchasePrice: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0
    },
    currentValue: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0
    },
    supplier: {
      type: DataTypes.STRING(255)
    },
    manufacturer: {
      type: DataTypes.STRING(255)
    },
    model: {
      type: DataTypes.STRING(255)
    },
    brand: {
      type: DataTypes.STRING(255)
    },
    
    // Warranty
    warrantyExpiry: {
      type: DataTypes.DATE
    },
    
    // Technical Specifications (flexible JSON for different asset types)
    specifications: {
      type: DataTypes.JSON,
      defaultValue: {}
      // Can store capacity, power rating, dimensions, etc.
    },
    
    // Operational Data
    lastInspectionDate: {
      type: DataTypes.DATE
    },
    lastMaintenanceDate: {
      type: DataTypes.DATE
    },
    healthScore: {
      type: DataTypes.INTEGER,
      defaultValue: 100
    },
    operatingHours: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0
    },
    
    // Management
    department: {
      type: DataTypes.STRING(255)
    },
    assignedTo: {
      type: DataTypes.INTEGER
      // User ID
    },
    notes: {
      type: DataTypes.TEXT
    },
    createdBy: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    }
  }, {
    tableName: 'infrastructure_assets',
    timestamps: true,
    underscored: true
  });

  return Infrastructure;
};
