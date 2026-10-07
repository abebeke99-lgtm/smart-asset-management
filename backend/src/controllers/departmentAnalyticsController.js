const service = require('../services/departmentAnalyticsService');

const departmentIdFor = (req, res) => {
  const departmentId = Number(req.organizationScope?.departmentId);
  if (Number.isSafeInteger(departmentId) && departmentId > 0) return departmentId;
  res.status(403).json({ success: false, message: 'Department scope is not configured for this account' });
  return null;
};

const getAnalytics = async (req, res, next) => {
  const departmentId = departmentIdFor(req, res);
  if (!departmentId) return;
  try {
    const data = await service.getAnalytics(departmentId, req.query);
    return res.json({ success: true, data });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
    return next(error);
  }
};

const getReport = (type) => async (req, res, next) => {
  const departmentId = departmentIdFor(req, res);
  if (!departmentId) return;
  try {
    const report = await service.getReport(departmentId, type, req.query);
    return res.json(report);
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
    return next(error);
  }
};

module.exports = { getAnalytics, getReport };
