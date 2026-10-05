const express = require('express');
const {
  summary,
  listAssets,
  lookupAssetId,
  lookupCode,
  getTracking,
  scanLog,
  assignTags,
  regenerateQr,
} = require('../controllers/adminRfidController');
const { requireAuth, requireRole } = require('../middlewares/auth');

const router = express.Router();
const ensureErrorData = (_req, res, next) => {
  const sendJson = res.json;
  res.json = function sendConsistentJson(payload) {
    const body = payload?.success === false && !Object.prototype.hasOwnProperty.call(payload, 'data')
      ? { ...payload, data: null }
      : payload;
    return sendJson.call(this, body);
  };
  next();
};
const adminOnly = [ensureErrorData, requireAuth, requireRole('admin')];

router.get('/summary', ...adminOnly, summary);
router.get('/assets', ...adminOnly, listAssets);
router.get('/lookup/asset-id/:assetId', ...adminOnly, lookupAssetId);
router.get('/lookup/code/:code', ...adminOnly, lookupCode);
router.get('/assets/:id/tracking', ...adminOnly, getTracking);
router.post('/scan-log', ...adminOnly, scanLog);
router.post('/assets/:id/tags', ...adminOnly, assignTags);
router.post('/assets/:id/qr/regenerate', ...adminOnly, regenerateQr);

module.exports = router;
