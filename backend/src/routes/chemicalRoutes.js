const express = require('express');
const {
  listChemicals,
  getChemical,
  scanChemical,
  createChemical,
  updateChemical,
  consumeChemical,
  restockChemical,
  adjustChemical,
  transferChemical,
  listTransfers,
  quarantineChemical,
  listQuarantine,
  listHazardousWaste,
  createHazardousWaste,
  updateHazardousWaste,
  uploadChemicalDocument,
  listChemicalDocuments,
  listStockOrders,
  setStockOrderStatus,
} = require('../controllers/chemicalController');
const { requireAuth, requireRole } = require('../middlewares/auth');

const router = express.Router();

router.get('/', requireAuth, listChemicals);
router.get('/quarantine', requireAuth, listQuarantine);
router.get('/transfers', requireAuth, listTransfers);
router.get('/waste', requireAuth, listHazardousWaste);
router.get('/stock-orders', requireAuth, listStockOrders);
router.get('/scan/:identifier', requireAuth, scanChemical);
router.post('/waste', requireAuth, requireRole('admin', 'store_manager', 'maintenance'), createHazardousWaste);
router.put('/waste/:id', requireAuth, requireRole('admin', 'store_manager', 'maintenance'), updateHazardousWaste);
router.post('/stock-orders/:id/status', requireAuth, requireRole('admin', 'store_manager'), setStockOrderStatus);
router.post('/', requireAuth, requireRole('admin', 'store_manager', 'maintenance'), createChemical);
router.get('/:id', requireAuth, getChemical);
router.get('/:id/documents', requireAuth, listChemicalDocuments);
router.post('/:id/documents', requireAuth, requireRole('admin', 'store_manager', 'maintenance'), uploadChemicalDocument);
router.put('/:id', requireAuth, requireRole('admin', 'store_manager', 'maintenance'), updateChemical);
router.post('/:id/consume', requireAuth, requireRole('admin', 'store_manager', 'maintenance'), consumeChemical);
router.post('/:id/restock', requireAuth, requireRole('admin', 'store_manager', 'maintenance'), restockChemical);
router.post('/:id/adjust', requireAuth, requireRole('admin', 'store_manager', 'maintenance'), adjustChemical);
router.post('/:id/transfer', requireAuth, requireRole('admin', 'store_manager', 'maintenance'), transferChemical);
router.post('/:id/quarantine', requireAuth, requireRole('admin', 'store_manager', 'maintenance'), quarantineChemical);

module.exports = router;