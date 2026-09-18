const express = require('express');
const {
  listValuation,
  updateValuation,
  valuationHistory,
  listAudit,
  getFinanceDashboard,
  getFinanceDashboardFilters,
  getFinanceReportFilters,
  listFinanceReports,
  generateFinanceReport,
  listBudgetReports,
  listDepreciationReports,
  listAssetValueReports,
} = require('../controllers/financeController');
const { listSuppliers, getSupplier, createSupplier, updateSupplier, deactivateSupplier } = require('../controllers/financeSupplierController');
const { listFinancePurchaseRequests, getFinancePurchaseRequest } = require('../controllers/financePurchaseRequestController');
const { listPurchaseOrders, getPurchaseOrder, createPurchaseOrder, updatePurchaseOrder, approvePurchaseOrder, cancelPurchaseOrder, deletePurchaseOrder } = require('../controllers/financePurchaseOrderController');
const { listPurchaseHistory, getPurchaseHistory } = require('../controllers/financePurchaseHistoryController');
const { listFinanceTransactions } = require('../controllers/financeTransactionController');
const { requireAuth, requireRole } = require('../middlewares/auth');

const router = express.Router();
const financeAccess = [requireAuth, requireRole('admin', 'finance')];
router.get('/dashboard', ...financeAccess, getFinanceDashboard);
router.get('/dashboard/filters', ...financeAccess, getFinanceDashboardFilters);
router.get('/financial-reports', ...financeAccess, listFinanceReports);
router.get('/financial-reports/filters', ...financeAccess, getFinanceReportFilters);
router.post('/financial-reports/generate', ...financeAccess, generateFinanceReport);
router.get('/budget-reports', ...financeAccess, listBudgetReports);
router.get('/budget-reports/filters', ...financeAccess, getFinanceReportFilters);
router.get('/depreciation-reports', ...financeAccess, listDepreciationReports);
router.get('/depreciation-reports/filters', ...financeAccess, getFinanceReportFilters);
router.get('/asset-value-reports', ...financeAccess, listAssetValueReports);
router.get('/asset-value-reports/filters', ...financeAccess, getFinanceReportFilters);
router.get('/purchase-requests', ...financeAccess, listFinancePurchaseRequests);
router.get('/purchase-requests/:id', ...financeAccess, getFinancePurchaseRequest);
router.get('/purchase-orders', ...financeAccess, listPurchaseOrders);
router.get('/purchase-orders/:id', ...financeAccess, getPurchaseOrder);
router.get('/purchase-history', ...financeAccess, listPurchaseHistory);
router.get('/purchase-history/:id', ...financeAccess, getPurchaseHistory);
router.get('/transactions', ...financeAccess, listFinanceTransactions);
router.post('/purchase-orders', ...financeAccess, createPurchaseOrder);
router.put('/purchase-orders/:id', ...financeAccess, updatePurchaseOrder);
router.patch('/purchase-orders/:id/approve', ...financeAccess, approvePurchaseOrder);
router.patch('/purchase-orders/:id/cancel', ...financeAccess, cancelPurchaseOrder);
router.delete('/purchase-orders/:id', ...financeAccess, deletePurchaseOrder);
router.get('/suppliers', ...financeAccess, listSuppliers);
router.get('/suppliers/:id', ...financeAccess, getSupplier);
router.post('/suppliers', ...financeAccess, createSupplier);
router.put('/suppliers/:id', ...financeAccess, updateSupplier);
router.delete('/suppliers/:id', ...financeAccess, deactivateSupplier);
router.get('/valuation', ...financeAccess, listValuation);
router.put('/valuation/:id', ...financeAccess, updateValuation);
router.put('/depreciation/:id', ...financeAccess, updateValuation);
router.get('/assets/:id/valuation-history', ...financeAccess, valuationHistory);
router.get('/audit', ...financeAccess, listAudit);
router.get('/audit/finance', ...financeAccess, listAudit);

module.exports = router;
