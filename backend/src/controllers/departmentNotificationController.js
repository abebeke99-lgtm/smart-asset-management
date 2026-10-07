const { Op } = require('sequelize');
const { User } = require('../models');
const notificationService = require('../services/notificationService');

const createDepartmentNotification = async (req, res, next) => {
  const departmentId = Number(req.organizationScope?.departmentId);
  if (!Number.isSafeInteger(departmentId) || departmentId < 1) {
    return res.status(403).json({ success: false, message: 'Department scope is not configured for this account' });
  }

  const title = String(req.body.title || '').trim();
  const message = String(req.body.message || '').trim();
  if (!title || title.length > 255 || !message || message.length > 5000) {
    return res.status(400).json({ success: false, message: 'A title of at most 255 characters and a message of at most 5000 characters are required' });
  }

  try {
    let userIds;
    if (req.body.userIds !== undefined && !Array.isArray(req.body.userIds)) {
      return res.status(400).json({ success: false, message: 'userIds must be an array of department staff IDs' });
    }
    const requestedIds = Array.isArray(req.body.userIds) ? [...new Set(req.body.userIds.map(Number))] : [];
    if (requestedIds.length) {
      if (requestedIds.some((id) => !Number.isSafeInteger(id) || id < 1)) {
        return res.status(400).json({ success: false, message: 'Recipient IDs must be positive integers' });
      }
      const recipients = await User.findAll({
        where: { id: { [Op.in]: requestedIds }, departmentId, active: true },
        attributes: ['id'],
      });
      userIds = recipients.map((recipient) => Number(recipient.id));
      if (userIds.length !== requestedIds.length) {
        return res.status(400).json({ success: false, message: 'All recipients must be active members of your department' });
      }
    } else {
      const recipients = await User.findAll({ where: { departmentId, active: true }, attributes: ['id'] });
      userIds = recipients.map((recipient) => Number(recipient.id));
    }
    if (!userIds.length) {
      return res.status(409).json({ success: false, message: 'There are no active notification recipients in your department' });
    }

    const result = await notificationService.createBulkNotification({
      recipientType: 'users',
      userIds,
      title,
      message,
      departmentId,
      type: String(req.body.type || 'department'),
      priority: String(req.body.priority || 'medium'),
      channel: 'in_app',
      scope: 'DEPARTMENT',
    }, req.user.id, req.user.role);
    return res.status(201).json({
      success: true,
      data: result.notifications,
      recipientCount: result.recipientCount,
    });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
    return next(error);
  }
};

module.exports = { createDepartmentNotification };
