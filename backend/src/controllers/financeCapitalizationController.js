const capitalizationService = require('../services/capitalizationService');

const ensureFinance = (req, res) => {
  if (!['admin', 'finance'].includes(req.user.role)) {
    res.status(403).json({ success: false, message: 'Finance authorization required' });
    return false;
  }
  return true;
};

const listCapitalization = async (req, res, next) => {
  try {
    if (!ensureFinance(req, res)) return;
    const result = await capitalizationService.list({ query: req.query });
    res.json({
      success: true,
      data: result.records,
      candidates: result.candidates,
      summary: {
        eligible: result.candidates.filter((item) => item.eligible).length,
        pendingVerification: result.candidates.filter((item) => item.reasons.some((reason) => reason.includes('verified'))).length,
        pendingCapitalization: result.candidates.filter((item) => item.eligible).length,
        capitalizedAssets: result.records.filter((item) => item.status === 'CAPITALIZED').length,
        totalCapitalizedValue: result.records.reduce((sum, item) => sum + Number(item.capitalizedAmount || 0), 0),
      },
    });
  } catch (error) { next(error); }
};

const createCapitalization = async (req, res, next) => {
  try {
    if (!ensureFinance(req, res)) return;
    const result = await capitalizationService.capitalize({ ...req.body, invoiceId: Number(req.body.invoiceId), userId: req.user.id });
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    next(error);
  }
};

const getCapitalization = async (req, res, next) => {
  try {
    if (!ensureFinance(req, res)) return;
    const result = await capitalizationService.list({ query: {} });
    const record = result.records.find((item) => String(item.id) === String(req.params.id));
    if (!record) return res.status(404).json({ success: false, message: 'Capitalization record not found.' });
    res.json({ success: true, data: record });
  } catch (error) { next(error); }
};

module.exports = { listCapitalization, createCapitalization, getCapitalization };
