const express = require('express');
const { requireAuth, requireRole } = require('../middlewares/auth');
const { College, Department } = require('../models');
const { getRoles } = require('../controllers/userController');

const router = express.Router();
const adminOnly = [requireAuth, requireRole('admin')];

router.get('/roles', ...adminOnly, getRoles);

router.get('/colleges/:id/departments', ...adminOnly, async (req, res, next) => {
  try {
    const collegeId = Number(req.params.id);
    if (!Number.isSafeInteger(collegeId) || collegeId < 1) {
      return res.status(400).json({ success: false, message: 'College ID must be a positive integer' });
    }
    const college = await College.findByPk(collegeId, { attributes: ['id'] });
    if (!college) return res.status(404).json({ success: false, message: 'College not found' });
    const departments = await Department.findAll({
      where: { collegeId },
      attributes: ['id', 'name', 'code', 'collegeId'],
      order: [['name', 'ASC']],
    });
    return res.json({ success: true, data: departments, departments });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
