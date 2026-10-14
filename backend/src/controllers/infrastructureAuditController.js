const { Op } = require('sequelize');
const { AuditLog, User } = require('../models');

const listInfrastructureAudit = async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const search = String(req.query.search || '').trim();
    const where = {
      [Op.or]: [
        { entity: { [Op.like]: 'infrastructure_%' } },
        { action: { [Op.like]: '%INFRASTRUCTURE%' } },
      ],
    };

    if (search) {
      where[Op.and] = [{
        [Op.or]: ['action', 'entity', 'details'].map((field) => ({
          [field]: { [Op.like]: `%${search}%` },
        })),
      }];
    }

    const { count, rows } = await AuditLog.findAndCountAll({
      where,
      include: [{
        model: User,
        attributes: ['id', 'fullName', 'username'],
        required: false,
      }],
      order: [['createdAt', 'DESC'], ['id', 'DESC']],
      limit,
      offset: (page - 1) * limit,
      distinct: true,
    });

    return res.json({
      success: true,
      data: rows,
      pagination: {
        page,
        limit,
        total: count,
        pages: Math.max(1, Math.ceil(count / limit)),
      },
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = { listInfrastructureAudit };
