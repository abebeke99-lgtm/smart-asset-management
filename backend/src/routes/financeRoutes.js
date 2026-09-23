const express = require('express');
const {
  listValuation,
  getAssetValuationDetail,
  getAssetDepreciationDetail,
  updateValuation,
  valuationHistory,
  listAudit,
  getFinanceDashboard,
  getFinanceDashboardFilters,
  getFinanceReportFilters,
  listFinanceReports,
  generateFinanceReport,
  listBudgetReports,
  listDepreciation,
  getDepreciationAsset,
  calculateDepreciation,
  postDepreciation,
  listDepreciationReports,
  listAssetValueReports,
} = require('../controllers/financeController');
const { listSuppliers, getSupplier, createSupplier, updateSupplier, deactivateSupplier } = require('../controllers/financeSupplierController');
const { listFinancePurchaseRequests, getFinancePurchaseRequest } = require('../controllers/financePurchaseRequestController');
const { listPurchaseOrders, getPurchaseOrder, createPurchaseOrder, updatePurchaseOrder, approvePurchaseOrder, cancelPurchaseOrder, deletePurchaseOrder } = require('../controllers/financePurchaseOrderController');
const { listPurchaseHistory, getPurchaseHistory } = require('../controllers/financePurchaseHistoryController');
const { listFinanceTransactions } = require('../controllers/financeTransactionController');
const { listCapitalization, createCapitalization, getCapitalization } = require('../controllers/financeCapitalizationController');
const { listDisposalFinancialRecords, listDisposalCandidates, createDisposalFinancialRecord, updateDisposalFinancialRecord } = require('../controllers/financeDisposalController');
const { listInvoices, getInvoice, listInvoicePayments, createInvoice, updateInvoice, deleteInvoice, matchInvoice, verifyInvoice, approveInvoice } = require('../controllers/financeInvoiceController');
const { listPayments, getPayment, createPaymentRequest, approvePayment, rejectPayment, processPayment, cancelPayment } = require('../controllers/financePaymentController');
const { listBudgets, getBudget, createBudget, updateBudget, deleteBudget } = require('../controllers/financeBudgetController');
const { listFinanceNotifications } = require('../controllers/financeNotificationController');
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
router.get('/budget-management', ...financeAccess, listBudgets);
router.get('/budget-management/:id', ...financeAccess, getBudget);
router.post('/budget-management', ...financeAccess, createBudget);
router.put('/budget-management/:id', ...financeAccess, updateBudget);
router.delete('/budget-management/:id', ...financeAccess, deleteBudget);
router.get('/depreciation-reports', ...financeAccess, listDepreciationReports);
router.get('/depreciation-reports/filters', ...financeAccess, getFinanceReportFilters);
router.get('/capitalization', ...financeAccess, listCapitalization);
router.get('/capitalization/:id', ...financeAccess, getCapitalization);
router.post('/capitalization', ...financeAccess, createCapitalization);
router.get('/disposal-financial-records', ...financeAccess, listDisposalFinancialRecords);
router.get('/disposal-financial-records/candidates', ...financeAccess, listDisposalCandidates);
router.post('/disposal-financial-records', ...financeAccess, createDisposalFinancialRecord);
router.put('/disposal-financial-records/:id', ...financeAccess, updateDisposalFinancialRecord);
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
router.get('/valuation/:id', ...financeAccess, getAssetValuationDetail);
router.get('/valuation/:id/depreciation', ...financeAccess, getAssetDepreciationDetail);
router.get('/depreciation', ...financeAccess, listDepreciation);
router.get('/depreciation/:id', ...financeAccess, getDepreciationAsset);
router.post('/depreciation/calculate', ...financeAccess, calculateDepreciation);
router.post('/depreciation/post', ...financeAccess, postDepreciation);
router.put('/valuation/:id', ...financeAccess, updateValuation);
router.put('/depreciation/:id', ...financeAccess, updateValuation);
router.get('/assets/:id/valuation-history', ...financeAccess, valuationHistory);
router.get('/audit', ...financeAccess, listAudit);
router.get('/audit/finance', ...financeAccess, listAudit);
router.get('/notifications', ...financeAccess, listFinanceNotifications);
router.get('/invoices', ...financeAccess, listInvoices);
router.get('/invoices/:id', ...financeAccess, getInvoice);
router.get('/invoices/:id/payments', ...financeAccess, listInvoicePayments);
router.get('/invoices/:id/match', ...financeAccess, matchInvoice);
router.post('/invoices', ...financeAccess, createInvoice);
router.put('/invoices/:id', ...financeAccess, updateInvoice);
router.post('/invoices/:id/verify', ...financeAccess, verifyInvoice);
router.post('/invoices/:id/approve', ...financeAccess, approveInvoice);
router.delete('/invoices/:id', ...financeAccess, deleteInvoice);
router.get('/payments', ...financeAccess, listPayments);
router.get('/payments/:id', ...financeAccess, getPayment);
router.post('/payment-requests', ...financeAccess, createPaymentRequest);
router.post('/payments/:id/approve', ...financeAccess, approvePayment);
router.post('/payments/:id/reject', ...financeAccess, rejectPayment);
router.post('/payments/:id/process', ...financeAccess, processPayment);
router.post('/payments/:id/cancel', ...financeAccess, cancelPayment);

module.exports = router;
