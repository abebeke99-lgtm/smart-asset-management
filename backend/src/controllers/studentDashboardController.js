const { Op, fn, col } = require('sequelize');
const { Assignment, Asset, ServiceRequest } = require('../models');

const openRequestStatuses = new Set(['submitted', 'pending', 'open', 'scheduled', 'assigned', 'in progress', 'in-progress']);
const normalizeStatus = (status) => String(status || '').trim().toLowerCase().replace(/[_-]+/g, ' ');

const getStudentDashboard = async (req, res, next) => {
  const studentId = Number(req.user?.id);
  if (!Number.isSafeInteger(studentId) || studentId < 1) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }

  const assignmentWhere = {
    assignedToType: 'user',
    status: 'active',
    [Op.or]: [{ assignedTo: studentId }, { assignedToId: studentId }],
  };
  const requestWhere = { reportedBy: studentId };

  try {
    const [assignedAssetsCount, assignments, requestStatusRows, requests] = await Promise.all([
      Assignment.count({ where: assignmentWhere }),
      Assignment.findAll({
        where: assignmentWhere,
        include: [{ model: Asset, attributes: ['id', 'assetCode', 'name', 'category', 'status', 'condition', 'location'], required: true }],
        order: [['assignedDate', 'DESC']],
        limit: 25,
      }),
      ServiceRequest.findAll({
        where: requestWhere,
        attributes: ['status', [fn('COUNT', col('id')), 'count']],
        group: ['status'],
        raw: true,
      }),
      ServiceRequest.findAll({
        where: requestWhere,
        attributes: ['id', 'requestCode', 'title', 'requestType', 'status', 'priority', 'createdAt', 'updatedAt'],
        order: [['createdAt', 'DESC']],
        limit: 25,
        raw: true,
      }),
    ]);

    const totalRequests = requestStatusRows.reduce((total, row) => total + Number(row.count || 0), 0);
    const openRequests = requestStatusRows.reduce((total, row) => (
      openRequestStatuses.has(normalizeStatus(row.status)) ? total + Number(row.count || 0) : total
    ), 0);
    const assets = assignments.map((assignment) => {
      const record = typeof assignment.toJSON === 'function' ? assignment.toJSON() : assignment;
      const asset = record.Asset || record.asset || {};
      return {
        id: record.id,
        assignedDate: record.assignedDate,
        expectedReturnDate: record.expectedReturnDate,
        status: record.status,
        asset: {
          id: asset.id,
          assetCode: asset.assetCode,
          name: asset.name,
          category: asset.category,
          status: asset.status,
          condition: asset.condition,
          location: asset.location,
        },
      };
    });

    return res.json({
      success: true,
      data: {
        summary: {
          assignedAssets: Number(assignedAssetsCount),
          totalRequests,
          openRequests,
        },
        assets,
        requests,
      },
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = { getStudentDashboard };
