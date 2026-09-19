const { Op } = require('sequelize');
const { CleaningSchedule, Room, User, AuditLog } = require('../models');
const { createBulkNotification } = require('../services/notificationService');

const VALID_STATUSES = ['scheduled', 'in-progress', 'completed', 'cancelled'];

const serializeSchedule = (item) => {
  const data = item.toJSON();
  return {
    ...data,
    room_name: item.Room?.roomName || null,
    room_code: item.Room?.roomCode || null,
    staff_name: item.Staff?.fullName || null,
  };
};

const listSchedules = async (req, res, next) => {
  try {
    const where = {};
    if (req.query.status) where.status = req.query.status;
    if (req.query.room_id) where.roomId = req.query.room_id;
    if (req.query.from) where.cleaningDate = { [Op.gte]: req.query.from };
    if (req.query.to) where.cleaningDate = { ...(where.cleaningDate || {}), [Op.lte]: req.query.to };
    if (req.query.assigned_to) where.assignedStaff = req.query.assigned_to;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 20));
    const { count, rows } = await CleaningSchedule.findAndCountAll({
      where,
      include: [
        { model: Room, attributes: ['id', 'roomName', 'roomCode', 'roomType'] },
        { model: User, as: 'Staff', attributes: ['id', 'username', 'fullName'] },
      ],
      order: [['cleaningDate', 'ASC']],
      limit,
      offset: (page - 1) * limit,
    });
    const data = rows.map(serializeSchedule);
    res.json({ success: true, data, schedules: data, total: count, pagination: { page, limit, total: count, pages: Math.max(1, Math.ceil(count / limit)) } });
  } catch (error) { next(error); }
};

const createSchedule = async (req, res, next) => {
  try {
    const laboratory = String(req.body.laboratory || req.body.lab || '').trim();
    if (!laboratory) return res.status(400).json({ success: false, message: 'Laboratory name is required' });
    const cleaningDate = String(req.body.cleaningDate || req.body.cleaning_date || '').trim();
    if (!cleaningDate || Number.isNaN(Date.parse(cleaningDate))) return res.status(400).json({ success: false, message: 'A valid cleaning date is required' });
    const schedule = await CleaningSchedule.create({
      roomId: req.body.roomId || req.body.room_id || null,
      laboratory,
      cleaningDate,
      assignedStaff: req.body.assignedStaff || req.body.assigned_staff || null,
      assignedByName: req.body.assignedByName || req.body.assigned_by_name || '',
      notes: req.body.notes || '',
      status: req.body.status || 'scheduled',
    });
    await AuditLog.create({ userId: req.user.id, action: 'CREATE_CLEANING_SCHEDULE', entity: `cleaning:${schedule.id}`, details: JSON.stringify({ laboratory, cleaningDate }) });
    if (schedule.assignedStaff) {
      try {
        await createBulkNotification({
          recipientType: 'users',
          userIds: [schedule.assignedStaff],
          title: 'Cleaning scheduled',
          message: `A cleaning schedule for ${laboratory} has been assigned to you on ${cleaningDate}.`,
          type: 'maintenance',
          priority: 'low',
          channel: 'in_app',
        }, req.user.id);
      } catch (notificationError) {
        console.error('Cleaning notification failed:', notificationError.message);
      }
    }
    res.status(201).json({ success: true, data: serializeSchedule(await CleaningSchedule.findByPk(schedule.id, { include: [{ model: Room }, { model: User, as: 'Staff', attributes: ['id', 'username', 'fullName'] }] })) });
  } catch (error) { next(error); }
};

const updateSchedule = async (req, res, next) => {
  try {
    const schedule = await CleaningSchedule.findByPk(req.params.id);
    if (!schedule) return res.status(404).json({ success: false, message: 'Cleaning schedule not found' });
    const status = String(req.body.status || schedule.status).toLowerCase();
    if (!VALID_STATUSES.includes(status)) return res.status(400).json({ success: false, message: 'Invalid schedule status' });
    const updates = {
      status,
      roomId: req.body.roomId ?? schedule.roomId,
      laboratory: req.body.laboratory ?? schedule.laboratory,
      cleaningDate: req.body.cleaningDate ?? schedule.cleaningDate,
      assignedStaff: req.body.assignedStaff !== undefined ? req.body.assignedStaff : schedule.assignedStaff,
      assignedByName: req.body.assignedByName !== undefined ? req.body.assignedByName : schedule.assignedByName,
      notes: req.body.notes !== undefined ? req.body.notes : schedule.notes,
    };
    await schedule.update(updates);
    await AuditLog.create({ userId: req.user.id, action: 'UPDATE_CLEANING_SCHEDULE', entity: `cleaning:${schedule.id}`, details: JSON.stringify({ status }) });
    res.json({ success: true, data: serializeSchedule(await CleaningSchedule.findByPk(schedule.id, { include: [{ model: Room }, { model: User, as: 'Staff', attributes: ['id', 'username', 'fullName'] }] })) });
  } catch (error) { next(error); }
};

const getSchedule = async (req, res, next) => {
  try {
    const schedule = await CleaningSchedule.findByPk(req.params.id, { include: [{ model: Room }, { model: User, as: 'Staff', attributes: ['id', 'username', 'fullName'] }] });
    if (!schedule) return res.status(404).json({ success: false, message: 'Cleaning schedule not found' });
    res.json({ success: true, data: serializeSchedule(schedule) });
  } catch (error) { next(error); }
};

const deleteSchedule = async (req, res, next) => {
  try {
    const schedule = await CleaningSchedule.findByPk(req.params.id);
    if (!schedule) return res.status(404).json({ success: false, message: 'Cleaning schedule not found' });
    await schedule.destroy();
    res.json({ success: true, message: 'Cleaning schedule deleted' });
  } catch (error) { next(error); }
};

const dashboard = async (req, res, next) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const [upcoming, completed, total] = await Promise.all([
      CleaningSchedule.count({ where: { cleaningDate: { [Op.gte]: today }, status: { [Op.ne]: 'completed' } } }),
      CleaningSchedule.count({ where: { status: 'completed' } }),
      CleaningSchedule.count(),
    ]);
    res.json({ success: true, data: { upcoming, completed, total, today } });
  } catch (error) { next(error); }
};

module.exports = { listSchedules, createSchedule, updateSchedule, getSchedule, deleteSchedule, dashboard };