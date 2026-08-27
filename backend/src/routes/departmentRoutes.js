const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middlewares/auth');

// Department routes
router.get('/departments', requireAuth, (req, res) => {
  // Get all departments
  res.json({ message: 'Departments endpoint' });
});

router.post('/departments', requireAuth, requireRole('admin'), (req, res) => {
  // Create department
  res.json({ message: 'Create department' });
});

router.get('/departments/:id', requireAuth, (req, res) => {
  // Get department by ID
  res.json({ message: 'Get department' });
});

module.exports = router;
