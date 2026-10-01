const express = require('express');
const { getDashboard, getHistory, getInventory, getInventoryDetail, exportInventory, getLowStock, getAvailableAssets, getStockAdjustments, getReceipts } = require('../controllers/storeController');
const { createStockAdjustment, createReceipt } = require('../controllers/inventoryController');
const verification = require('../controllers/verificationController');
const { requireAuth, requireRole } = require('../middlewares/auth');
const { findCollegeScopeForUser } = require('../middlewares/organizationScope');
const College = require('../models/College');

const router = express.Router();

const ensureStoreScope = async (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Authentication required' });
  try {
    const scope = await findCollegeScopeForUser(req.user);
    let collegeId = Number(scope?.collegeId ?? req.user.collegeId ?? req.user.college_id ?? null);

    if (!Number.isSafeInteger(collegeId) || collegeId <= 0) {
      const colleges = await College.findAll({ attributes: ['id'], where: { status: 'active' }, order: [['id', 'ASC']] });
      if (colleges.length === 0) {
        return res.status(403).json({ success: false, message: 'Store Manager college scope is not configured' });
      }
      collegeId = Number(colleges[0].id);
    }

    if (!Number.isSafeInteger(collegeId) || collegeId <= 0) {
      return res.status(403).json({ success: false, message: 'Store Manager college scope is not configured' });
    }

    req.user.collegeId = collegeId;
    req.organizationScope = { collegeId, college: { id: collegeId }, departmentId: null, department: null };
    return next();
  } catch (error) {
    return next(error);
  }
};

router.get('/dashboard', requireAuth, requireRole('store_manager'), ensureStoreScope, getDashboard);
router.get('/history', requireAuth, requireRole('store_manager'), ensureStoreScope, getHistory);
router.get('/inventory/export', requireAuth, requireRole('store_manager'), ensureStoreScope, exportInventory);
router.get('/inventory', requireAuth, requireRole('store_manager'), ensureStoreScope, getInventory);
router.get('/inventory/:id', requireAuth, requireRole('store_manager'), ensureStoreScope, getInventoryDetail);
router.get('/available-assets', requireAuth, requireRole('store_manager'), ensureStoreScope, getAvailableAssets);
router.get('/low-stock', requireAuth, requireRole('store_manager'), ensureStoreScope, getLowStock);
router.get('/stock-adjustments', requireAuth, requireRole('store_manager'), ensureStoreScope, getStockAdjustments);
router.post('/stock-adjustments', requireAuth, requireRole('store_manager'), ensureStoreScope, createStockAdjustment);
router.get('/receive', requireAuth, requireRole('store_manager'), ensureStoreScope, getReceipts);
router.post('/receive', requireAuth, requireRole('store_manager'), ensureStoreScope, createReceipt);
router.get('/verification', requireAuth, requireRole('store_manager'), ensureStoreScope, verification.listSessions);
router.post('/verification', requireAuth, requireRole('store_manager'), ensureStoreScope, verification.createSession);
router.get('/verification/:id', requireAuth, requireRole('store_manager'), ensureStoreScope, verification.getSession);
router.post('/verification/:id/items', requireAuth, requireRole('store_manager'), ensureStoreScope, verification.addItem);
router.post('/verification/:id/submit', requireAuth, requireRole('store_manager'), ensureStoreScope, verification.submitSession);
router.post('/verification/:id/finalize', requireAuth, requireRole('store_manager'), ensureStoreScope, verification.finalizeSession);

module.exports = router;
