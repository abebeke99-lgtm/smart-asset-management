const { Op } = require('sequelize');
const {
  Asset,
  Building,
  Department,
  Maintenance,
  Room,
  ServiceRequest,
  Transfer,
  User,
} = require('../models');

const laboratoryStatuses = new Set([
  'active',
  'temporarily closed',
  'under maintenance',
  'restricted',
  'inactive',
]);

const normalized = (value) => String(value || '').trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
const plain = (record) => (record && typeof record.get === 'function' ? record.get({ plain: true }) : record);
const displayName = (user) => user?.fullName || user?.username || null;

const departmentIdFor = (req) => {
  const id = Number(req.organizationScope?.departmentId);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

const laboratoryWhere = (departmentId, id) => ({
  ...(id ? { id } : {}),
  departmentId,
  roomType: { [Op.in]: ['laboratory', 'LABORATORY', 'Laboratory', 'lab', 'LAB', 'Lab'] },
});

const roomIncludes = (departmentId) => [
  { model: Building, attributes: ['id', 'buildingName', 'buildingCode'], required: false },
  { model: Department, as: 'DepartmentRecord', attributes: ['id', 'name', 'code'], required: false },
  {
    model: User,
    as: 'ResponsibleStaff',
    attributes: ['id', 'fullName', 'username'],
    where: { departmentId },
    required: false,
  },
];

const assetFunction = (asset) => {
  const status = normalized(asset.status);
  const condition = normalized(asset.condition);
  if (['damaged', 'broken', 'faulty'].some((value) => status.includes(value) || condition.includes(value))) return 'damaged';
  if (['maintenance', 'repair'].some((value) => status.includes(value) || condition.includes(value))) return 'maintenance';
  if (['disposed', 'retired', 'expired'].some((value) => status.includes(value))) return 'other';
  return 'functional';
};

const openRequest = (request) => !['completed', 'cancelled', 'canceled', 'closed', 'rejected'].includes(normalized(request.status));

const serializeLaboratory = (record, assets) => {
  const room = plain(record);
  const status = normalized(room.status);
  return {
    id: room.id,
    name: room.roomName,
    building: room.Building?.buildingName || null,
    buildingCode: room.Building?.buildingCode || null,
    room: room.roomName,
    roomCode: room.roomCode,
    capacity: room.capacity,
    responsibleStaff: displayName(room.ResponsibleStaff),
    department: room.DepartmentRecord?.name || null,
    departmentId: room.DepartmentRecord?.id || room.departmentId,
    assetCount: assets.length,
    condition: room.condition || 'Unknown',
    status: laboratoryStatuses.has(status) ? status.replace(/\b\w/g, (letter) => letter.toUpperCase()) : (room.status || 'Inactive'),
  };
};

const loadRoomAssets = (departmentId, roomIds) => {
  if (!roomIds.length) return Promise.resolve([]);
  return Asset.findAll({
    where: { departmentId, roomId: { [Op.in]: roomIds } },
    attributes: ['id', 'name', 'assetCode', 'category', 'status', 'condition', 'location', 'roomId', 'createdAt'],
    order: [['name', 'ASC']],
  });
};

const listLaboratories = async (req, res, next) => {
  const departmentId = departmentIdFor(req);
  if (!departmentId) return res.status(403).json({ success: false, message: 'Department scope is not configured for this account.' });

  try {
    const [department, roomRecords] = await Promise.all([
      Department.findByPk(departmentId, { attributes: ['id', 'name', 'code'] }),
      Room.findAll({
        where: laboratoryWhere(departmentId),
        attributes: ['id', 'buildingId', 'departmentId', 'roomCode', 'roomName', 'roomType', 'capacity', 'responsibleStaffId', 'condition', 'status'],
        include: roomIncludes(departmentId),
        order: [['roomName', 'ASC']],
      }),
    ]);
    const rooms = roomRecords.map(plain);
    const assets = await loadRoomAssets(departmentId, rooms.map((room) => room.id));
    const assetsByRoom = new Map(rooms.map((room) => [Number(room.id), []]));
    assets.forEach((record) => {
      const asset = plain(record);
      assetsByRoom.get(Number(asset.roomId))?.push(asset);
    });
    const data = rooms.map((room) => serializeLaboratory(room, assetsByRoom.get(Number(room.id)) || []));
    const summary = data.reduce((counts, laboratory) => {
      counts.total += 1;
      if (normalized(laboratory.status) === 'active') counts.active += 1;
      if (normalized(laboratory.status) === 'inactive') counts.inactive += 1;
      counts.assets += laboratory.assetCount;
      return counts;
    }, { total: 0, active: 0, inactive: 0, assets: 0 });
    return res.json({
      success: true,
      department: department ? { id: department.id, name: department.name, code: department.code } : null,
      summary,
      data,
    });
  } catch (error) {
    return next(error);
  }
};

const getLaboratoryDashboard = async (req, res, next) => {
  const departmentId = departmentIdFor(req);
  const laboratoryId = Number(req.params.id);
  if (!departmentId) return res.status(403).json({ success: false, message: 'Department scope is not configured for this account.' });
  if (!Number.isSafeInteger(laboratoryId) || laboratoryId < 1) {
    return res.status(400).json({ success: false, message: 'Laboratory ID is invalid.' });
  }

  try {
    const roomRecord = await Room.findOne({
      where: laboratoryWhere(departmentId, laboratoryId),
      attributes: ['id', 'buildingId', 'departmentId', 'roomCode', 'roomName', 'roomType', 'capacity', 'responsibleStaffId', 'condition', 'status'],
      include: roomIncludes(departmentId),
    });
    if (!roomRecord) return res.status(404).json({ success: false, message: 'Laboratory not found.' });

    const laboratory = plain(roomRecord);
    const inventory = (await loadRoomAssets(departmentId, [laboratoryId])).map(plain);
    const assetIds = inventory.map((asset) => asset.id);
    const [requests, maintenanceRecords, transferRecords] = await Promise.all([
      assetIds.length
        ? ServiceRequest.findAll({
          where: { assetId: { [Op.in]: assetIds } },
          attributes: ['id', 'requestCode', 'title', 'status', 'priority', 'createdAt'],
          order: [['createdAt', 'DESC']],
        })
        : Promise.resolve([]),
      assetIds.length
        ? Maintenance.findAll({
          where: { assetId: { [Op.in]: assetIds } },
          attributes: ['id', 'title', 'status', 'priority', 'createdAt', 'assetId'],
          include: [{ model: Asset, attributes: ['id', 'name', 'assetCode'], required: false }],
          order: [['createdAt', 'DESC']],
          limit: 6,
        })
        : Promise.resolve([]),
      Transfer.findAll({
        where: {
          [Op.or]: [{ sourceRoomId: laboratoryId }, { destinationRoomId: laboratoryId }],
        },
        attributes: ['id', 'transferNumber', 'assetId', 'sourceDepartment', 'destinationDepartment', 'transferDate', 'status', 'sourceRoomId', 'destinationRoomId'],
        include: [{ model: Asset, attributes: ['id', 'name', 'assetCode'], required: false }],
        order: [['transferDate', 'DESC']],
        limit: 6,
      }),
    ]);
    const classes = inventory.map(assetFunction);
    const requestsPlain = requests.map(plain);
    const maintenance = maintenanceRecords.map(plain);
    const transfers = transferRecords.map(plain);

    return res.json({
      success: true,
      laboratory: serializeLaboratory(laboratory, inventory),
      summary: {
        totalAssets: inventory.length,
        functionalAssets: classes.filter((value) => value === 'functional').length,
        damagedAssets: classes.filter((value) => value === 'damaged').length,
        assetsUnderMaintenance: classes.filter((value) => value === 'maintenance').length,
        openServiceRequests: requestsPlain.filter(openRequest).length,
      },
      inventory,
      recentMaintenance: maintenance.map((record) => ({
        id: record.id,
        title: record.title,
        status: record.status,
        priority: record.priority,
        createdAt: record.createdAt,
        asset: record.Asset ? { name: record.Asset.name, assetCode: record.Asset.assetCode } : null,
      })),
      recentTransfers: transfers.map((record) => ({
        id: record.id,
        transferNumber: record.transferNumber,
        sourceDepartment: record.sourceDepartment,
        destinationDepartment: record.destinationDepartment,
        transferDate: record.transferDate,
        status: record.status,
        direction: Number(record.sourceRoomId) === laboratoryId ? 'outgoing' : 'incoming',
        asset: record.Asset ? { name: record.Asset.name, assetCode: record.Asset.assetCode } : null,
      })),
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = { listLaboratories, getLaboratoryDashboard };
