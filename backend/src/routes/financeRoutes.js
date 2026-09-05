const express = require('express');
const { listValuation, updateValuation, valuationHistory, listAudit } = require('../controllers/financeController');
const { requireAuth, requireRole } = require('../middlewares/auth');

const router = express.Router();
const financeAccess = [requireAuth, requireRole('admin', 'finance')];
router.get('/valuation', ...financeAccess, listValuation);
router.put('/valuation/:id', ...financeAccess, updateValuation);
router.put('/depreciation/:id', ...financeAccess, updateValuation);
router.get('/assets/:id/valuation-history', ...financeAccess, valuationHistory);
router.get('/audit', ...financeAccess, listAudit);
router.get('/audit/finance', ...financeAccess, listAudit);

module.exports = router;
