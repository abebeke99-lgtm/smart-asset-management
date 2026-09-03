// ==============================================
// Infrastructure Routes
// ==============================================
const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middlewares/auth');
const {
  getAllInfrastructureAssets,
  getInfrastructureAsset,
  createInfrastructureAsset,
  updateInfrastructureAsset,
  deleteInfrastructureAsset
} = require('../controllers/infrastructureController');

// Middleware
router.use(requireAuth);

// Routes
// Get all infrastructure assets
router.get('/', getAllInfrastructureAssets);

// Get single infrastructure asset
router.get('/:id', getInfrastructureAsset);

// Create infrastructure asset (Admin and Infrastructure role only)
router.post('/', requireRole('admin', 'infrastructure'), createInfrastructureAsset);

// Update infrastructure asset (Admin and Infrastructure role only)
router.put('/:id', requireRole('admin', 'infrastructure'), updateInfrastructureAsset);

// Delete infrastructure asset (Admin and Infrastructure role only)
router.delete('/:id', requireRole('admin', 'infrastructure'), deleteInfrastructureAsset);

module.exports = router;
