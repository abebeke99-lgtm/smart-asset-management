const { Op } = require('sequelize');
const { Asset, Assignment, Transfer, Maintenance, User, Department, Campus, Building, Room } = require('../models');

const locationIncludes = [
  { model: Campus, as: 'CampusRecord', attributes: ['campusName'], required: false },
  { model: Building, as: 'BuildingRecord', attributes: ['buildingName'], required: false },
  { model: Room, as: 'RoomRecord', attributes: ['roomName', 'floor'], required: false },
];

const findAsset = (where) => Asset.findOne({ where, include: locationIncludes });

const serializeAsset = async (asset) => {
  const assignment = await Assignment.findOne({
    where: { assetId: asset.id, status: 'active' },
    include: [
      { model: User, attributes: ['fullName', 'username'], required: false },
      { model: Department, as: 'AssignedDepartment', attributes: ['id', 'name'], required: false },
      { model: Room, as: 'AssignedLaboratory', attributes: ['id', 'roomName'], required: false },
    ],
    order: [['createdAt', 'DESC']],
  });
  const assignedToType = String(assignment?.assignedToType || 'user').toLowerCase();
  const assignedTo = assignedToType === 'department'
    ? assignment?.AssignedDepartment?.name || null
    : assignedToType === 'laboratory'
      ? assignment?.AssignedLaboratory?.roomName || null
      : assignment?.User?.fullName || assignment?.User?.username || null;
  return {
    id: asset.id,
    assetCode: asset.assetCode,
    name: asset.name,
    category: asset.category,
    serialNumber: asset.serialNumber,
    qrCode: asset.digitalId,
    rfidTag: asset.rfidTag,
    status: asset.status,
    department: asset.department || '',
    assignedTo,
    assignedToType: assignment ? assignedToType : null,
    location: {
      campus: asset.CampusRecord?.campusName || null,
      building: asset.BuildingRecord?.buildingName || null,
      floor: asset.RoomRecord?.floor ?? null,
      room: asset.RoomRecord?.roomName || asset.location || null,
    },
    researchGrant: asset.fundingSource || null,
    warranty: asset.warrantyExpiry || null,
  };
};

const handleFailure = (res, message) => res.status(500).json({ success: false, message });

const lookupByCode = async (req, res) => {
  try {
    const code = String(req.params.code || '').trim();
    if (!code) return res.status(400).json({ success: false, message: 'A tracking code is required.' });
    const asset = await findAsset({ [Op.or]: [{ digitalId: code }, { rfidTag: code }] });
    if (!asset) return res.status(404).json({ success: false, message: 'Asset not found.' });
    return res.json({ success: true, data: { asset: await serializeAsset(asset) } });
  } catch {
    return handleFailure(res, 'Unable to look up the tracking code.');
  }
};

const lookupByAssetCode = async (req, res) => {
  try {
    const assetCode = String(req.params.assetId || '').trim();
    if (!assetCode) return res.status(400).json({ success: false, message: 'An asset ID is required.' });
    const asset = await findAsset({ assetCode });
    if (!asset) return res.status(404).json({ success: false, message: 'Asset not found.' });
    return res.json({ success: true, data: { asset: await serializeAsset(asset) } });
  } catch {
    return handleFailure(res, 'Unable to look up the asset.');
  }
};

const getLocation = async (req, res) => {
  try {
    const asset = await findAsset({ id: req.params.id });
    if (!asset) return res.status(404).json({ success: false, message: 'Asset not found.' });
    return res.json({
      success: true,
      data: {
        campus: asset.CampusRecord?.campusName || null,
        building: asset.BuildingRecord?.buildingName || null,
        floor: asset.RoomRecord?.floor ?? null,
        room: asset.RoomRecord?.roomName || asset.location || null,
      },
    });
  } catch {
    return handleFailure(res, 'Unable to load the asset location.');
  }
};

const getAssignments = async (req, res) => {
  try {
    const asset = await Asset.findByPk(req.params.id);
    if (!asset) return res.status(404).json({ success: false, message: 'Asset not found.' });
    const rows = await Assignment.findAll({
      where: { assetId: asset.id },
      include: [
        { model: User, attributes: ['fullName', 'username', 'department'], required: false },
        { model: Department, as: 'AssignedDepartment', attributes: ['id', 'name'], required: false },
        { model: Room, as: 'AssignedLaboratory', attributes: ['id', 'roomName'], required: false },
      ],
      order: [['createdAt', 'DESC']],
    });
    const history = rows.map((row) => {
      let assignmentNotes = {};
      try { assignmentNotes = JSON.parse(row.notes || '{}'); } catch { assignmentNotes = {}; }
      return {
        userName: row.assignedToType === 'department' ? row.AssignedDepartment?.name || null : row.assignedToType === 'laboratory' ? row.AssignedLaboratory?.roomName || null : row.User?.fullName || row.User?.username || null,
        assignedToType: row.assignedToType || 'user',
        department: assignmentNotes.departmentName || row.AssignedDepartment?.name || row.User?.department || null,
        assignedAt: row.assignedDate || row.createdAt,
        returnedAt: row.returnedAt || null,
        condition: row.conditionAtAssignment || assignmentNotes.condition || null,
        status: row.status,
        notes: row.notes || '',
      };
    });
    return res.json({ success: true, data: history });
  } catch {
    return handleFailure(res, 'Unable to load assignment history.');
  }
};

const getTransfers = async (req, res) => {
  try {
    const asset = await Asset.findByPk(req.params.id);
    if (!asset) return res.status(404).json({ success: false, message: 'Asset not found.' });
    const rows = await Transfer.findAll({
      where: { assetId: asset.id },
      include: [{ model: User, as: 'Creator', attributes: ['fullName', 'username'], required: false }],
      order: [['createdAt', 'DESC']],
    });
    const history = rows.map((row) => ({
      fromLocation: row.currentLocation || null,
      toLocation: row.newLocation || null,
      fromDepartment: row.sourceDepartment || null,
      toDepartment: row.destinationDepartment || null,
      transferredAt: row.transferDate || row.createdAt,
      reason: row.transferReason || '',
      transferredBy: row.Creator?.fullName || row.Creator?.username || null,
    }));
    return res.json({ success: true, data: history });
  } catch {
    return handleFailure(res, 'Unable to load transfer history.');
  }
};

const getMaintenance = async (req, res) => {
  try {
    const asset = await Asset.findByPk(req.params.id);
    if (!asset) return res.status(404).json({ success: false, message: 'Asset not found.' });
    const rows = await Maintenance.findAll({
      where: { assetId: asset.id },
      include: [{ model: User, as: 'Technician', attributes: ['fullName', 'username'], required: false }],
      order: [['createdAt', 'DESC']],
    });
    const history = rows.map((row) => ({
      requestedAt: row.createdAt,
      title: row.title,
      description: row.description || '',
      priority: row.priority,
      status: row.status,
      completedAt: row.completedAt || null,
      technicianName: row.Technician?.fullName || row.Technician?.username || null,
    }));
    return res.json({ success: true, data: history });
  } catch {
    return handleFailure(res, 'Unable to load maintenance history.');
  }
};

module.exports = { lookupByCode, lookupByAssetCode, getLocation, getAssignments, getTransfers, getMaintenance };