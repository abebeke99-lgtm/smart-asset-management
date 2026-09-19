const { Campus, Building, Room, AuditLog, sequelize } = require('../models');
const { Op } = require('sequelize');

const uniqueCode = (prefix) => `${prefix}-${String(Date.now()).slice(-8)}${String(Math.floor(Math.random() * 100)).padStart(2, '0')}`;

const serializeCampus = (campus, buildingCount = 0) => ({ ...campus.toJSON(), buildingCount });
const serializeBuilding = (building, roomCount = 0) => ({ ...building.toJSON(), roomCount });
const serializeRoom = (room) => ({ ...room.toJSON() });

const listCampuses = async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 100));
    const where = {};
    if (req.query.status) where.status = req.query.status;
    if (req.query.search) {
      const search = String(req.query.search).trim();
      where[Op.or] = [{ campusName: { [Op.like]: `%${search}%` } }, { campusCode: { [Op.like]: `%${search}%` } }];
    }
    const { count, rows } = await Campus.findAndCountAll({ where, order: [['campusName', 'ASC']], limit, offset: (page - 1) * limit });
    const buildingCounts = await Building.findAll({ attributes: ['campusId', [sequelize.fn('COUNT', sequelize.col('id')), 'count']], group: ['campusId'], raw: true });
    const countsMap = Object.fromEntries(buildingCounts.map((row) => [row.campusId, Number(row.count)]));
    const data = rows.map((campus) => serializeCampus(campus, countsMap[campus.id] || 0));
    res.json({ success: true, data, campuses: data, total: count, pagination: { page, limit, total: count, pages: Math.max(1, Math.ceil(count / limit)) } });
  } catch (error) { next(error); }
};

const getCampus = async (req, res, next) => {
  try {
    const campus = await Campus.findByPk(req.params.id);
    if (!campus) return res.status(404).json({ success: false, message: 'Campus not found' });
    const buildings = await Building.findAll({ where: { campusId: campus.id }, order: [['buildingName', 'ASC']] });
    const rooms = await Room.findAll({ where: { campusId: campus.id }, order: [['roomName', 'ASC']], limit: 500 });
    res.json({ success: true, data: { ...serializeCampus(campus, buildings.length), buildings, rooms } });
  } catch (error) { next(error); }
};

const createCampus = async (req, res, next) => {
  try {
    const campusName = String(req.body.campusName || req.body.name || '').trim();
    if (!campusName) return res.status(400).json({ success: false, message: 'Campus name is required' });
    const campusCode = String(req.body.campusCode || req.body.code || '').trim().toUpperCase() || uniqueCode('CMP');
    const duplicate = await Campus.findOne({ where: { [Op.or]: [{ campusCode }, { campusName }] } });
    if (duplicate) return res.status(409).json({ success: false, message: 'Campus code or name already exists' });
    const campus = await Campus.create({ campusCode, campusName, address: req.body.address || '', city: req.body.city || '', phone: req.body.phone || '', email: req.body.email || '', description: req.body.description || '', status: req.body.status || 'active' });
    await AuditLog.create({ userId: req.user.id, action: 'CREATE_CAMPUS', entity: `campus:${campus.id}`, details: JSON.stringify({ campusCode, campusName }) });
    res.status(201).json({ success: true, data: serializeCampus(campus) });
  } catch (error) { next(error); }
};

const updateCampus = async (req, res, next) => {
  try {
    const campus = await Campus.findByPk(req.params.id);
    if (!campus) return res.status(404).json({ success: false, message: 'Campus not found' });
    const previousValue = campus.toJSON();
    const updates = {};
    if (req.body.campusName || req.body.name) updates.campusName = String(req.body.campusName || req.body.name).trim();
    if (req.body.campusCode || req.body.code) updates.campusCode = String(req.body.campusCode || req.body.code).trim().toUpperCase();
    if (req.body.address !== undefined) updates.address = req.body.address;
    if (req.body.city !== undefined) updates.city = req.body.city;
    if (req.body.phone !== undefined) updates.phone = req.body.phone;
    if (req.body.email !== undefined) updates.email = req.body.email;
    if (req.body.description !== undefined) updates.description = req.body.description;
    if (req.body.status !== undefined) updates.status = req.body.status;
    await campus.update(updates);
    await AuditLog.create({ userId: req.user.id, action: 'UPDATE_CAMPUS', entity: `campus:${campus.id}`, details: JSON.stringify({ previousValue, newValue: campus.toJSON() }) });
    res.json({ success: true, data: serializeCampus(campus) });
  } catch (error) { next(error); }
};

const deleteCampus = async (req, res, next) => {
  try {
    const campus = await Campus.findByPk(req.params.id);
    if (!campus) return res.status(404).json({ success: false, message: 'Campus not found' });
    const buildingCount = await Building.count({ where: { campusId: campus.id } });
    if (buildingCount > 0) return res.status(409).json({ success: false, message: 'Campus has buildings and cannot be deleted' });
    const previousValue = campus.toJSON();
    await campus.destroy();
    await AuditLog.create({ userId: req.user.id, action: 'DELETE_CAMPUS', entity: `campus:${campus.id}`, details: JSON.stringify({ previousValue }) });
    res.json({ success: true, message: 'Campus deleted' });
  } catch (error) { next(error); }
};

const listBuildings = async (req, res, next) => {
  try {
    const where = {};
    if (req.query.campus_id || req.query.campusId) where.campusId = Number(req.query.campus_id || req.query.campusId);
    if (req.query.status) where.status = req.query.status;
    if (req.query.search) {
      const search = String(req.query.search).trim();
      where[Op.or] = [{ buildingName: { [Op.like]: `%${search}%` } }, { buildingCode: { [Op.like]: `%${search}%` } }];
    }
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 100));
    const { count, rows } = await Building.findAndCountAll({ where, order: [['buildingName', 'ASC']], limit, offset: (page - 1) * limit });
    const roomCounts = await Room.findAll({ attributes: ['buildingId', [sequelize.fn('COUNT', sequelize.col('id')), 'count']], group: ['buildingId'], raw: true });
    const countsMap = Object.fromEntries(roomCounts.map((row) => [row.buildingId, Number(row.count)]));
    const data = rows.map((building) => serializeBuilding(building, countsMap[building.id] || 0));
    res.json({ success: true, data, buildings: data, total: count, pagination: { page, limit, total: count, pages: Math.max(1, Math.ceil(count / limit)) } });
  } catch (error) { next(error); }
};

const getBuilding = async (req, res, next) => {
  try {
    const building = await Building.findByPk(req.params.id);
    if (!building) return res.status(404).json({ success: false, message: 'Building not found' });
    const rooms = await Room.findAll({ where: { buildingId: building.id }, order: [['roomName', 'ASC']] });
    res.json({ success: true, data: { ...serializeBuilding(building, rooms.length), rooms } });
  } catch (error) { next(error); }
};

const createBuilding = async (req, res, next) => {
  try {
    const campusId = Number(req.body.campusId || req.body.campus_id);
    if (!Number.isInteger(campusId)) return res.status(400).json({ success: false, message: 'A valid campus is required' });
    const campus = await Campus.findByPk(campusId);
    if (!campus) return res.status(400).json({ success: false, message: 'Campus not found' });
    const buildingName = String(req.body.buildingName || req.body.name || '').trim();
    if (!buildingName) return res.status(400).json({ success: false, message: 'Building name is required' });
    const buildingCode = String(req.body.buildingCode || req.body.code || '').trim().toUpperCase() || uniqueCode('BLD');
    const duplicate = await Building.findOne({ where: { [Op.or]: [{ buildingCode }, { buildingName }] } });
    if (duplicate) return res.status(409).json({ success: false, message: 'Building code or name already exists' });
    const building = await Building.create({ campusId, buildingCode, buildingName, floorCount: Number(req.body.floorCount || req.body.floors || 1), description: req.body.description || '', status: req.body.status || 'active' });
    await AuditLog.create({ userId: req.user.id, action: 'CREATE_BUILDING', entity: `building:${building.id}`, details: JSON.stringify({ campusId, buildingCode, buildingName }) });
    res.status(201).json({ success: true, data: serializeBuilding(building) });
  } catch (error) { next(error); }
};

const updateBuilding = async (req, res, next) => {
  try {
    const building = await Building.findByPk(req.params.id);
    if (!building) return res.status(404).json({ success: false, message: 'Building not found' });
    const previousValue = building.toJSON();
    const updates = {};
    if (req.body.campusId || req.body.campus_id) {
      const campus = await Campus.findByPk(Number(req.body.campusId || req.body.campus_id));
      if (!campus) return res.status(400).json({ success: false, message: 'Campus not found' });
      updates.campusId = campus.id;
    }
    if (req.body.buildingName || req.body.name) updates.buildingName = String(req.body.buildingName || req.body.name).trim();
    if (req.body.buildingCode || req.body.code) updates.buildingCode = String(req.body.buildingCode || req.body.code).trim().toUpperCase();
    if (req.body.floorCount !== undefined) updates.floorCount = Number(req.body.floorCount);
    if (req.body.description !== undefined) updates.description = req.body.description;
    if (req.body.status !== undefined) updates.status = req.body.status;
    await building.update(updates);
    await AuditLog.create({ userId: req.user.id, action: 'UPDATE_BUILDING', entity: `building:${building.id}`, details: JSON.stringify({ previousValue, newValue: building.toJSON() }) });
    res.json({ success: true, data: serializeBuilding(building) });
  } catch (error) { next(error); }
};

const deleteBuilding = async (req, res, next) => {
  try {
    const building = await Building.findByPk(req.params.id);
    if (!building) return res.status(404).json({ success: false, message: 'Building not found' });
    const roomCount = await Room.count({ where: { buildingId: building.id } });
    if (roomCount > 0) return res.status(409).json({ success: false, message: 'Building has rooms and cannot be deleted' });
    const previousValue = building.toJSON();
    await building.destroy();
    await AuditLog.create({ userId: req.user.id, action: 'DELETE_BUILDING', entity: `building:${building.id}`, details: JSON.stringify({ previousValue }) });
    res.json({ success: true, message: 'Building deleted' });
  } catch (error) { next(error); }
};

const listRooms = async (req, res, next) => {
  try {
    const where = {};
    if (req.query.building_id || req.query.buildingId) where.buildingId = Number(req.query.building_id || req.query.buildingId);
    if (req.query.campus_id || req.query.campusId) where.campusId = Number(req.query.campus_id || req.query.campusId);
    if (req.query.room_type || req.query.roomType) where.roomType = req.query.room_type || req.query.roomType;
    if (req.query.status) where.status = req.query.status;
    if (req.query.search) {
      const search = String(req.query.search).trim();
      where[Op.or] = [{ roomName: { [Op.like]: `%${search}%` } }, { roomCode: { [Op.like]: `%${search}%` } }];
    }
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 100));
    const { count, rows } = await Room.findAndCountAll({ where, order: [['roomName', 'ASC']], limit, offset: (page - 1) * limit });
    const data = rows.map(serializeRoom);
    res.json({ success: true, data, rooms: data, total: count, pagination: { page, limit, total: count, pages: Math.max(1, Math.ceil(count / limit)) } });
  } catch (error) { next(error); }
};

const getRoom = async (req, res, next) => {
  try {
    const room = await Room.findByPk(req.params.id);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
    res.json({ success: true, data: serializeRoom(room) });
  } catch (error) { next(error); }
};

const createRoom = async (req, res, next) => {
  try {
    const buildingId = Number(req.body.buildingId || req.body.building_id);
    if (!Number.isInteger(buildingId)) return res.status(400).json({ success: false, message: 'A valid building is required' });
    const building = await Building.findByPk(buildingId);
    if (!building) return res.status(400).json({ success: false, message: 'Building not found' });
    const roomName = String(req.body.roomName || req.body.name || '').trim();
    if (!roomName) return res.status(400).json({ success: false, message: 'Room name is required' });
    const roomCode = String(req.body.roomCode || req.body.code || '').trim().toUpperCase() || uniqueCode('RM');
    const duplicate = await Room.findOne({ where: { [Op.or]: [{ roomCode }, { roomName }] } });
    if (duplicate) return res.status(409).json({ success: false, message: 'Room code or name already exists' });
    const room = await Room.create({
      buildingId,
      campusId: building.campusId,
      roomCode,
      roomName,
      roomType: req.body.roomType || req.body.room_type || 'laboratory',
      floor: Number(req.body.floor) || null,
      capacity: Number(req.body.capacity) || null,
      description: req.body.description || '',
      status: req.body.status || 'active',
    });
    await AuditLog.create({ userId: req.user.id, action: 'CREATE_ROOM', entity: `room:${room.id}`, details: JSON.stringify({ buildingId, roomCode, roomName }) });
    res.status(201).json({ success: true, data: serializeRoom(room) });
  } catch (error) { next(error); }
};

const updateRoom = async (req, res, next) => {
  try {
    const room = await Room.findByPk(req.params.id);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
    const previousValue = room.toJSON();
    const updates = {};
    if (req.body.buildingId || req.body.building_id) {
      const building = await Building.findByPk(Number(req.body.buildingId || req.body.building_id));
      if (!building) return res.status(400).json({ success: false, message: 'Building not found' });
      updates.buildingId = building.id;
      updates.campusId = building.campusId;
    }
    if (req.body.roomName || req.body.name) updates.roomName = String(req.body.roomName || req.body.name).trim();
    if (req.body.roomCode || req.body.code) updates.roomCode = String(req.body.roomCode || req.body.code).trim().toUpperCase();
    if (req.body.roomType !== undefined) updates.roomType = req.body.roomType;
    if (req.body.floor !== undefined) updates.floor = Number(req.body.floor) || null;
    if (req.body.capacity !== undefined) updates.capacity = Number(req.body.capacity) || null;
    if (req.body.description !== undefined) updates.description = req.body.description;
    if (req.body.status !== undefined) updates.status = req.body.status;
    await room.update(updates);
    await AuditLog.create({ userId: req.user.id, action: 'UPDATE_ROOM', entity: `room:${room.id}`, details: JSON.stringify({ previousValue, newValue: room.toJSON() }) });
    res.json({ success: true, data: serializeRoom(room) });
  } catch (error) { next(error); }
};

const deleteRoom = async (req, res, next) => {
  try {
    const room = await Room.findByPk(req.params.id);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
    const previousValue = room.toJSON();
    await room.destroy();
    await AuditLog.create({ userId: req.user.id, action: 'DELETE_ROOM', entity: `room:${room.id}`, details: JSON.stringify({ previousValue }) });
    res.json({ success: true, message: 'Room deleted' });
  } catch (error) { next(error); }
};

module.exports = { listCampuses, getCampus, createCampus, updateCampus, deleteCampus, listBuildings, getBuilding, createBuilding, updateBuilding, deleteBuilding, listRooms, getRoom, createRoom, updateRoom, deleteRoom };