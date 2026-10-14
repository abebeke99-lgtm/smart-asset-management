const { Op } = require('sequelize');
const { SparePart, SparePartTransaction, User } = require('../models');

const listInfrastructureSpareParts = async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const search = String(req.query.search || '').trim();
    const where = {};

    if (search) {
      where[Op.or] = ['partName', 'partCode', 'category', 'supplier', 'location'].map((field) => ({
        [field]: { [Op.like]: `%${search}%` },
      }));
    }

    if (req.query.status) where.status = String(req.query.status);

    const { count, rows } = await SparePart.findAndCountAll({
      where,
      order: [['partName', 'ASC'], ['id', 'ASC']],
      limit,
      offset: (page - 1) * limit,
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

const listSparePartTransactions = async (req, res, next) => {
  try {
    const sparePart = await SparePart.findByPk(req.params.id, {
      attributes: ['id', 'partName', 'partCode'],
    });
    if (!sparePart) {
      return res.status(404).json({ success: false, message: 'Spare part not found' });
    }

    const transactions = await SparePartTransaction.findAll({
      where: { sparePartId: sparePart.id },
      include: [{
        model: User,
        attributes: ['id', 'fullName', 'username'],
        required: false,
      }],
      order: [['transactionDate', 'DESC'], ['id', 'DESC']],
      limit: 100,
    });

    return res.json({ success: true, data: transactions });
  } catch (error) {
    return next(error);
  }
};

module.exports = { listInfrastructureSpareParts, listSparePartTransactions };
