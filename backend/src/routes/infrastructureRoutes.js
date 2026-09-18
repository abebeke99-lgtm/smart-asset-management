// ==============================================
// Infrastructure Routes
// ==============================================
const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middlewares/auth');
const {
  getInfrastructureDashboard,
  getAllInfrastructureAssets,
  getInfrastructureInventory,
  getInfrastructureAsset,
  createInfrastructureAsset,
  updateInfrastructureAsset,
  deleteInfrastructureAsset,
  getInfrastructureInspections,
  getInfrastructureInspectionAssets,
  createInfrastructureInspection,
  updateInfrastructureInspection,
  deleteInfrastructureInspection,
  getInfrastructureAssignments,
  getAssignableInfrastructureAssets,
  getInfrastructureAssignmentUsers,
  updateInfrastructureAssignment,
  finishInfrastructureAssignment,
  getTransformers,
  getTransformer,
  createTransformer,
  updateTransformer,
  deactivateTransformer,
  getInfrastructureRoads,
  getInfrastructureRoad,
  saveInfrastructureRoad,
  deactivateInfrastructureRoad,
  getInfrastructureWorkOrders,
  getInfrastructureWorkOrder,
  getInfrastructureWorkOrderOptions,
  createInfrastructureWorkOrder,
  updateInfrastructureWorkOrder,
  transitionInfrastructureWorkOrder,
  getInfrastructureEnergy,
  getInfrastructureFuel,
  getInfrastructureFuelById,
  getInfrastructureFuelSummary,
  createInfrastructureFuel,
  updateInfrastructureFuel,
  deactivateInfrastructureFuel,
  getInfrastructureTracking,
  scanInfrastructureTracking
} = require('../controllers/infrastructureController');
const { getInfrastructureUps, getInfrastructureUpsById, saveInfrastructureUps, deactivateInfrastructureUps } = require('../controllers/infrastructureController');
const { getInfrastructureSolar, getInfrastructureSolarById, saveInfrastructureSolar, deactivateInfrastructureSolar } = require('../controllers/infrastructureController');
const { getInfrastructureBuildings, getInfrastructureBuilding, createInfrastructureBuilding, updateInfrastructureBuilding, deactivateInfrastructureBuilding } = require('../controllers/infrastructureController');
const infrastructureTransfer = require('../controllers/infrastructureTransferController');
const infrastructureVerification = require('../controllers/infrastructureVerificationController');
const electricalController = require('../controllers/infrastructureElectricalController');
const waterController = require('../controllers/infrastructureWaterController');
const { getInfrastructureMaintenance, getInfrastructureMaintenanceAssets, createMaintenance, updateMaintenance, removeMaintenance } = require('../controllers/maintenanceController');
const preventiveController = require('../controllers/infrastructurePreventiveController');
const infrastructureRequests = require('../controllers/infrastructureRequestController');
const infrastructureReports = require('../controllers/infrastructureReportController');

// Middleware
router.use(requireAuth);

router.get('/requests', requireRole('admin', 'infrastructure'), infrastructureRequests.listInfrastructureRequests);
router.post('/requests', requireRole('admin', 'infrastructure'), infrastructureRequests.createInfrastructureRequest);
router.patch('/requests/:id/decision', requireRole('admin', 'infrastructure'), infrastructureRequests.decideInfrastructureRequest);

router.get('/maintenance/assets', requireRole('admin', 'infrastructure'), getInfrastructureMaintenanceAssets);
router.get('/maintenance', requireRole('admin', 'infrastructure'), getInfrastructureMaintenance);
router.post('/maintenance', requireRole('admin', 'infrastructure'), (req, res, next) => { req.infrastructureScope = true; return createMaintenance(req, res, next); });
router.put('/maintenance/:id', requireRole('admin', 'infrastructure'), (req, res, next) => { req.infrastructureScope = true; return updateMaintenance(req, res, next); });
router.delete('/maintenance/:id', requireRole('admin', 'infrastructure'), (req, res, next) => { req.infrastructureScope = true; return removeMaintenance(req, res, next); });
router.get('/preventive', requireRole('admin', 'infrastructure'), preventiveController.getInfrastructurePreventive);
router.get('/preventive/:id', requireRole('admin', 'infrastructure'), preventiveController.getInfrastructurePreventiveById);
router.post('/preventive', requireRole('admin', 'infrastructure'), preventiveController.saveInfrastructurePreventive);
router.put('/preventive/:id', requireRole('admin', 'infrastructure'), preventiveController.saveInfrastructurePreventive);
router.delete('/preventive/:id', requireRole('admin', 'infrastructure'), preventiveController.deleteInfrastructurePreventive);

router.get('/transformers', requireRole('admin', 'infrastructure'), getTransformers);
router.get('/transformers/:id', requireRole('admin', 'infrastructure'), getTransformer);
router.post('/transformers', requireRole('admin', 'infrastructure'), createTransformer);
router.put('/transformers/:id', requireRole('admin', 'infrastructure'), updateTransformer);
router.delete('/transformers/:id', requireRole('admin', 'infrastructure'), deactivateTransformer);
router.get('/roads', requireRole('admin', 'infrastructure'), getInfrastructureRoads);
router.get('/roads/:id', requireRole('admin', 'infrastructure'), getInfrastructureRoad);
router.post('/roads', requireRole('admin', 'infrastructure'), saveInfrastructureRoad);
router.put('/roads/:id', requireRole('admin', 'infrastructure'), saveInfrastructureRoad);
router.delete('/roads/:id', requireRole('admin', 'infrastructure'), deactivateInfrastructureRoad);

// Routes
// Dashboard must be registered before the parameterized asset route.
router.get('/dashboard', requireRole('admin', 'infrastructure'), getInfrastructureDashboard);
router.get('/work-orders', requireRole('admin', 'infrastructure'), getInfrastructureWorkOrders);
router.get('/work-orders/options', requireRole('admin', 'infrastructure'), getInfrastructureWorkOrderOptions);
router.get('/work-orders/:id', requireRole('admin', 'infrastructure'), getInfrastructureWorkOrder);
router.post('/work-orders', requireRole('admin', 'infrastructure'), createInfrastructureWorkOrder);
router.put('/work-orders/:id', requireRole('admin', 'infrastructure'), updateInfrastructureWorkOrder);
router.patch('/work-orders/:id/status', requireRole('admin', 'infrastructure'), transitionInfrastructureWorkOrder);
router.get('/buildings', requireRole('admin', 'infrastructure'), getInfrastructureBuildings);
router.get('/buildings/:id', requireRole('admin', 'infrastructure'), getInfrastructureBuilding);
router.post('/buildings', requireRole('admin', 'infrastructure'), createInfrastructureBuilding);
router.put('/buildings/:id', requireRole('admin', 'infrastructure'), updateInfrastructureBuilding);
router.delete('/buildings/:id', requireRole('admin', 'infrastructure'), deactivateInfrastructureBuilding);
router.get('/inventory', requireRole('admin', 'infrastructure'), getInfrastructureInventory);
router.get('/assignment', requireRole('admin', 'infrastructure'), getInfrastructureAssignments);
router.get('/assignment/assets', requireRole('admin', 'infrastructure'), getAssignableInfrastructureAssets);
router.get('/assignment/users', requireRole('admin', 'infrastructure'), getInfrastructureAssignmentUsers);
router.post('/assignment', requireRole('admin', 'infrastructure'), updateInfrastructureAssignment);
router.patch('/assignment/:id/return', requireRole('admin', 'infrastructure'), finishInfrastructureAssignment);
router.patch('/assignment/:id/cancel', requireRole('admin', 'infrastructure'), finishInfrastructureAssignment);

router.get('/transfer', requireRole('admin', 'infrastructure'), infrastructureTransfer.getList);
router.get('/transfer/assets', requireRole('admin', 'infrastructure'), infrastructureTransfer.getFormData);
router.get('/transfer/locations', requireRole('admin', 'infrastructure'), infrastructureTransfer.getFormData);
router.get('/transfer/:id', requireRole('admin', 'infrastructure'), infrastructureTransfer.getOne);
router.post('/transfer', requireRole('admin', 'infrastructure'), infrastructureTransfer.create);
router.patch('/transfer/:id/approve', requireRole('admin', 'infrastructure'), infrastructureTransfer.approve);
router.patch('/transfer/:id/complete', requireRole('admin', 'infrastructure'), infrastructureTransfer.complete);
router.patch('/transfer/:id/cancel', requireRole('admin', 'infrastructure'), infrastructureTransfer.cancel);

// Infrastructure verification uses the shared verification_sessions and verification_items tables.
router.get('/verification', requireRole('admin', 'infrastructure'), infrastructureVerification.list);
router.get('/verification/assets', requireRole('admin', 'infrastructure'), infrastructureVerification.assets);
router.get('/verification/:id', requireRole('admin', 'infrastructure'), infrastructureVerification.getOne);
router.post('/verification', requireRole('admin', 'infrastructure'), infrastructureVerification.create);
router.put('/verification/:id', requireRole('admin', 'infrastructure'), infrastructureVerification.update);
router.patch('/verification/:id', requireRole('admin', 'infrastructure'), infrastructureVerification.update);
router.patch('/verification/:id/verify', requireRole('admin', 'infrastructure'), (req, res, next) => { req.body = { ...req.body, state: 'verified' }; return infrastructureVerification.update(req, res, next); });
router.patch('/verification/:id/missing', requireRole('admin', 'infrastructure'), (req, res, next) => { req.body = { ...req.body, state: 'missing' }; return infrastructureVerification.update(req, res, next); });
router.patch('/verification/:id/damaged', requireRole('admin', 'infrastructure'), (req, res, next) => { req.body = { ...req.body, state: 'damaged' }; return infrastructureVerification.update(req, res, next); });
router.patch('/verification/:id/review', requireRole('admin', 'infrastructure'), (req, res, next) => { req.body = { ...req.body, state: 'needs_review' }; return infrastructureVerification.update(req, res, next); });

// Infrastructure inspections must be registered before the parameterized asset route.
router.get('/inspection', requireRole('admin', 'infrastructure'), getInfrastructureInspections);
router.get('/inspection/assets', requireRole('admin', 'infrastructure'), getInfrastructureInspectionAssets);
router.post('/inspection', requireRole('admin', 'infrastructure'), createInfrastructureInspection);
router.put('/inspection/:id', requireRole('admin', 'infrastructure'), updateInfrastructureInspection);
router.delete('/inspection/:id', requireRole('admin', 'infrastructure'), deleteInfrastructureInspection);

router.get('/electrical', requireRole('admin', 'infrastructure'), electricalController.getElectricalSystems);
router.get('/electrical/:id', requireRole('admin', 'infrastructure'), electricalController.getElectricalSystem);
router.post('/electrical', requireRole('admin', 'infrastructure'), electricalController.createElectricalSystem);
router.put('/electrical/:id', requireRole('admin', 'infrastructure'), electricalController.updateElectricalSystem);
router.delete('/electrical/:id', requireRole('admin', 'infrastructure'), electricalController.deactivateElectricalSystem);
router.get('/water', requireRole('admin', 'infrastructure'), waterController.getWaterSystems);
router.get('/water/:id', requireRole('admin', 'infrastructure'), waterController.getWaterSystem);
router.post('/water', requireRole('admin', 'infrastructure'), waterController.createWaterSystem);
router.put('/water/:id', requireRole('admin', 'infrastructure'), waterController.updateWaterSystem);
router.delete('/water/:id', requireRole('admin', 'infrastructure'), waterController.deactivateWaterSystem);
router.get('/ups', requireRole('admin', 'infrastructure'), getInfrastructureUps);
router.get('/ups/:id', requireRole('admin', 'infrastructure'), getInfrastructureUpsById);
router.post('/ups', requireRole('admin', 'infrastructure'), saveInfrastructureUps);
router.put('/ups/:id', requireRole('admin', 'infrastructure'), saveInfrastructureUps);
router.delete('/ups/:id', requireRole('admin', 'infrastructure'), deactivateInfrastructureUps);
router.get('/solar', requireRole('admin', 'infrastructure'), getInfrastructureSolar);
router.get('/solar/:id', requireRole('admin', 'infrastructure'), getInfrastructureSolarById);
router.post('/solar', requireRole('admin', 'infrastructure'), saveInfrastructureSolar);
router.put('/solar/:id', requireRole('admin', 'infrastructure'), saveInfrastructureSolar);
router.delete('/solar/:id', requireRole('admin', 'infrastructure'), deactivateInfrastructureSolar);
router.get('/energy', requireRole('admin', 'infrastructure'), getInfrastructureEnergy);
router.get('/reports/export', requireRole('admin', 'infrastructure'), infrastructureReports.exportInfrastructureReport);
router.get('/reports', requireRole('admin', 'infrastructure'), infrastructureReports.getInfrastructureReport);
router.get('/fuel', requireRole('admin', 'infrastructure'), getInfrastructureFuel);
router.get('/fuel/summary', requireRole('admin', 'infrastructure'), getInfrastructureFuelSummary);
router.get('/fuel/:id', requireRole('admin', 'infrastructure'), getInfrastructureFuelById);
router.post('/fuel', requireRole('admin', 'infrastructure'), createInfrastructureFuel);
router.put('/fuel/:id', requireRole('admin', 'infrastructure'), updateInfrastructureFuel);
router.delete('/fuel/:id', requireRole('admin', 'infrastructure'), deactivateInfrastructureFuel);
router.get('/tracking', requireRole('admin', 'infrastructure'), getInfrastructureTracking);
router.post('/tracking/scan', requireRole('admin', 'infrastructure'), scanInfrastructureTracking);
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
