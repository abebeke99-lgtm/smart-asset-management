const { Op } = require('sequelize');
const { Asset, DepartmentAssetVerification, User } = require('../models');

const getDepartmentId = (req) => {
  const departmentId = Number(req.organizationScope?.departmentId);
  return Number.isSafeInteger(departmentId) && departmentId > 0 ? departmentId : null;
};

const parseVerificationDate = (value) => {
  if (value === undefined || value === null || value === '') {
    return new Date().toISOString().slice(0, 10);
  }
  const date = String(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date ? null : date;
};

const listVerifications = async (req, res, next) => {
  try {
    const departmentId = getDepartmentId(req);
    if (!departmentId) {
      return res.status(403).json({ success: false, message: 'Department scope is not configured for this account.' });
    }
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));
    const { count, rows } = await DepartmentAssetVerification.findAndCountAll({
      where: { departmentId },
      include: [
        { model: Asset, attributes: ['id', 'assetCode', 'name', 'qrCode'] },
        { model: User, as: 'Verifier', attributes: ['id', 'fullName', 'username'] },
      ],
      order: [['verificationDate', 'DESC'], ['createdAt', 'DESC']],
      limit,
      offset: (page - 1) * limit,
    });
    return res.json({
      success: true,
      data: rows,
      pagination: { page, limit, total: count, pages: Math.ceil(count / limit) },
    });
  } catch (error) {
    return next(error);
  }
};

const createVerification = async (req, res, next) => {
  try {
    const departmentId = getDepartmentId(req);
    if (!departmentId) {
      return res.status(403).json({ success: false, message: 'Department scope is not configured for this account.' });
    }

    const assetId = req.body.asset_id ?? req.body.assetId;
    const qrCode = String(req.body.qr_code ?? req.body.qrCode ?? '').trim().toUpperCase();
    const hasAssetId = assetId !== undefined && assetId !== null && String(assetId).trim() !== '';
    const hasQrCode = qrCode.length > 0;
    if (hasAssetId === hasQrCode) {
      return res.status(400).json({ success: false, message: 'Provide either an asset ID or a QR code.' });
    }
    if (hasAssetId && (!/^\d+$/.test(String(assetId)) || Number(assetId) < 1)) {
      return res.status(400).json({ success: false, message: 'A valid asset ID is required.' });
    }
    if (hasQrCode && qrCode.length > 100) {
      return res.status(400).json({ success: false, message: 'QR code must be 100 characters or fewer.' });
    }

    const expectedAssetWhere = hasQrCode
      ? { [Op.or]: [{ qrCode }, { digitalId: qrCode }] }
      : { id: Number(assetId) };
    const asset = await Asset.findOne({
      where: { ...expectedAssetWhere, departmentId },
    });
    if (!asset) {
      return res.status(404).json({ success: false, message: 'Asset was not found in your department.' });
    }

    const actualLocation = String(req.body.actual_location ?? req.body.actualLocation ?? '').trim();
    const actualCondition = String(req.body.actual_condition ?? req.body.actualCondition ?? '').trim();
    if (!actualLocation || actualLocation.length > 255) {
      return res.status(400).json({ success: false, message: 'Actual location is required and must be 255 characters or fewer.' });
    }
    if (!actualCondition || actualCondition.length > 100) {
      return res.status(400).json({ success: false, message: 'Condition is required and must be 100 characters or fewer.' });
    }

    const verificationDate = parseVerificationDate(req.body.verification_date ?? req.body.verificationDate);
    if (!verificationDate) {
      return res.status(400).json({ success: false, message: 'Verification date must be a valid date in YYYY-MM-DD format.' });
    }

    const expectedLocation = String(asset.location || '').trim();
    const expectedCondition = String(asset.condition || 'Unknown').trim();
    const exceptions = [];
    if (expectedLocation && expectedLocation.toLocaleLowerCase() !== actualLocation.toLocaleLowerCase()) {
      exceptions.push(`Location mismatch: expected "${expectedLocation}", found "${actualLocation}".`);
    }
    if (expectedCondition.toLocaleLowerCase() !== actualCondition.toLocaleLowerCase()) {
      exceptions.push(`Condition mismatch: expected "${expectedCondition}", found "${actualCondition}".`);
    }
    const notes = String(req.body.exceptions ?? '').trim();
    if (notes) exceptions.push(notes);

    const verification = await DepartmentAssetVerification.create({
      departmentId,
      assetId: asset.id,
      assetCode: asset.assetCode || '',
      assetName: asset.name,
      expectedLocation,
      actualLocation,
      expectedCondition,
      actualCondition,
      verificationDate,
      verifiedBy: req.user.id,
      scannedQrCode: hasQrCode ? qrCode : null,
      exceptions: exceptions.join('\n'),
    });

    return res.status(201).json({ success: true, message: 'Physical verification recorded.', data: verification });
  } catch (error) {
    return next(error);
  }
};

module.exports = { listVerifications, createVerification };
