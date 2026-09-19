const { Op } = require('sequelize');
const fs = require('fs');
const path = require('path');
const {
  sequelize,
  Asset,
  AssetDocument,
  AssetGrant,
  AssetCustody,
  User,
  Category,
  Campus,
  Building,
  Room,
  Assignment,
  Maintenance,
  Transfer,
  AuditLog,
  RFIDLog,
} = require('../models');

const ALLOWED_DOC_TYPES = ['application/pdf', 'application/msword', 'image/jpeg', 'image/png'];
const MAX_DOC_SIZE = 10 * 1024 * 1024;
const VALID_CONDITIONS = ['Good', 'Fair', 'Poor', 'Damaged'];
const VALID_STATUSES = ['available', 'in-use', 'under-maintenance', 'damaged', 'replaced', 'expired', 'disposed', 'testing'];
const SOFT_DELETE_RECOVERY_DAYS = 30;

const normalizeStatus = (value) => {
  const status = String(value || '').trim().toLowerCase().replace(/[_ ]+/g, '-');
  const aliases = { active: 'available', assigned: 'in-use', 'in-use': 'in-use', damage: 'damaged', damaged: 'damaged', 'under-maintenance': 'under-maintenance', maintenance: 'under-maintenance', replaced: 'replaced', expired: 'expired', disposed: 'disposed', retired: 'disposed', testing: 'testing' };
  return aliases[status] || 'available';
};

async function nextDigitalId(transaction) {
  const year = new Date().getFullYear();
  const prefix = `UAS-${year}-`;
  const last = await Asset.findOne({ where: { digitalId: { [Op.like]: `${prefix}%` } }, paranoid: false, order: [['id', 'DESC']], transaction });
  let sequence = 1;
  if (last?.digitalId) {
    const match = String(last.digitalId).match(/(\d+)$/);
    if (match) sequence = Number(match[1]) + 1;
  }
  return `${prefix}${String(sequence).padStart(6, '0')}`;
}

const ensureUploadDir = (subdir) => {
  const target = path.resolve(__dirname, '..', process.env.UPLOAD_DIR || 'uploads', subdir);
  fs.mkdirSync(target, { recursive: true });
  return target;
};

const saveDocument = ({ fileName = '', mimeType = '', data = '' }, subdir) => {
  const mime = String(mimeType || '').split(';')[0].trim();
  if (!ALLOWED_DOC_TYPES.includes(mime)) {
    const error = new Error(`Unsupported file type: ${mime || 'unknown'}. Allowed: PDF, JPG, PNG.`);
    error.statusCode = 400;
    throw error;
  }
  const buffer = Buffer.from(data, 'base64');
  if (!buffer.length || buffer.length > MAX_DOC_SIZE) {
    const error = new Error('File is empty or exceeds the 10 MB limit');
    error.statusCode = 400;
    throw error;
  }
  const ext = String(fileName).split('.').pop() || (mime === 'application/pdf' ? 'pdf' : mime.split('/')[1] || 'bin');
  const storedName = `${Date.now()}-${String(Math.floor(Math.random() * 100000)).padStart(5, '0')}.${ext}`;
  const dir = ensureUploadDir(subdir);
  fs.writeFileSync(path.join(dir, storedName), buffer);
  return { originalName: String(fileName || storedName), storedName, mimeType: mime, fileSize: buffer.length, filePath: path.posix.join('uploads', subdir, storedName) };
};

const serializedExtended = (asset, extra = {}) => {
  const data = asset.toJSON ? asset.toJSON() : asset;
  return {
    ...data,
    digital_id: data.digitalId,
    campus_id: data.campusId,
    building_id: data.buildingId,
    room_id: data.roomId,
    funding_source: data.fundingSource,
    specifications: data.specifications || {},
    ...extra,
  };
};

const generateDigitalId = async (req, res, next) => {
  try {
    const digitalId = await nextDigitalId();
    res.json({ success: true, digital_id: digitalId, asset_id: digitalId });
  } catch (error) { next(error); }
};

const lookupByQr = async (req, res, next) => {
  try {
    const identifier = String(req.params.identifier || req.query.identifier || '').trim();
    if (!identifier) return res.status(400).json({ success: false, message: 'Identifier is required' });
    const asset = await Asset.findOne({
      where: {
        [Op.or]: [
          { digitalId: identifier },
          { assetCode: identifier },
          { serialNumber: identifier },
          { rfidTag: identifier },
          { id: Number.isInteger(Number(identifier)) ? Number(identifier) : -1 },
        ],
      },
      include: [
        { model: Campus, as: 'CampusRecord', attributes: ['id', 'campusName', 'campusCode'] },
        { model: Building, as: 'BuildingRecord', attributes: ['id', 'buildingName', 'buildingCode'] },
        { model: Room, as: 'RoomRecord', attributes: ['id', 'roomName', 'roomCode'] },
      ],
    });
    if (!asset) return res.status(404).json({ success: false, message: 'Asset not found for identifier' });
    const [assignment, maintenance, documents, custody] = await Promise.all([
      Assignment.findOne({ where: { assetId: asset.id, status: 'active' }, include: [{ model: User, attributes: ['id', 'username', 'fullName', 'department'] }] }),
      Maintenance.findAll({ where: { assetId: asset.id }, order: [['createdAt', 'DESC']], limit: 10 }),
      AssetDocument.findAll({ where: { assetId: asset.id, status: 'active' } }),
      AssetCustody.findAll({ where: { assetId: asset.id, status: 'active' }, include: [{ model: User, as: 'Custodian', attributes: ['id', 'username', 'fullName'] }] }),
    ]);
    await RFIDLog.create({ assetId: asset.id, tag: identifier, action: 'qr-lookup', location: asset.location || '', notes: `QR lookup by user ${req.user.id}` });
    res.json({
      success: true,
      data: serializedExtended(asset, {
        assigned_to: assignment?.assignedTo || null,
        assigned_to_name: assignment?.User?.fullName || assignment?.User?.username || null,
        maintenance_history: maintenance,
        documents,
        custody,
      }),
      asset: serializedExtended(asset),
    });
  } catch (error) { next(error); }
};

const listDeletedAssets = async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 20));
    const { count, rows } = await Asset.findAndCountAll({ where: { deletedAt: { [Op.ne]: null } }, paranoid: false, order: [['deletedAt', 'DESC']], limit, offset: (page - 1) * limit });
    const data = rows.map((asset) => ({
      ...asset.toJSON(),
      deleted_at: asset.deletedAt,
      deleted_by: asset.deletedBy,
      days_remaining: SOFT_DELETE_RECOVERY_DAYS - Math.floor((Date.now() - new Date(asset.deletedAt).getTime()) / (24 * 60 * 60 * 1000)),
      recoverable: (Date.now() - new Date(asset.deletedAt).getTime()) < SOFT_DELETE_RECOVERY_DAYS * 24 * 60 * 60 * 1000,
    }));
    res.json({ success: true, data, assets: data, total: count, recovery_days: SOFT_DELETE_RECOVERY_DAYS, pagination: { page, limit, total: count, pages: Math.max(1, Math.ceil(count / limit)) } });
  } catch (error) { next(error); }
};

const softDeleteAsset = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const asset = await Asset.findByPk(req.params.id, { transaction });
    if (!asset) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Asset not found' }); }
    const previousValue = asset.toJSON();
    await asset.update({ deletedBy: req.user.id }, { transaction });
    await asset.destroy({ transaction });
    await AuditLog.create({ userId: req.user.id, action: 'DELETE_ASSET', entity: `asset:${asset.id}`, details: JSON.stringify({ assetId: asset.id, deletedAt: new Date(), previousValue }) }, { transaction });
    await transaction.commit();
    res.json({ success: true, message: 'Asset soft-deleted. It can be restored within 30 days.', data: serializedExtended(asset) });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

const restoreAsset = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const asset = await Asset.findByPk(req.params.id, { paranoid: false, transaction });
    if (!asset) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Asset not found' }); }
    if (!asset.deletedAt) { await transaction.rollback(); return res.status(409).json({ success: false, message: 'Asset is not deleted' }); }
    const deletedAt = new Date(asset.deletedAt);
    if ((Date.now() - deletedAt.getTime()) > SOFT_DELETE_RECOVERY_DAYS * 24 * 60 * 60 * 1000) {
      await transaction.rollback();
      return res.status(409).json({ success: false, message: 'The 30-day recovery period for this asset has passed. Permanent deletion is required.' });
    }
    const previousValue = asset.toJSON();
    const restored = await asset.restore({ transaction });
    await asset.update({ deletedBy: null }, { transaction });
    await AuditLog.create({ userId: req.user.id, action: 'RESTORE_ASSET', entity: `asset:${asset.id}`, details: JSON.stringify({ assetId: asset.id, deletedAt, previousValue, restoredAt: new Date() }) }, { transaction });
    await transaction.commit();
    res.json({ success: true, message: 'Asset restored', data: serializedExtended(restored || asset) });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

const permanentDeleteAsset = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const asset = await Asset.findByPk(req.params.id, { paranoid: false, transaction });
    if (!asset) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Asset not found' }); }
    if (!asset.deletedAt) { await transaction.rollback(); return res.status(409).json({ success: false, message: 'Use authorized removal flow for non-deleted assets' }); }
    const previousValue = asset.toJSON();
    await AssetDocument.destroy({ where: { assetId: asset.id }, transaction });
    await AssetGrant.destroy({ where: { assetId: asset.id }, transaction });
    await AssetCustody.destroy({ where: { assetId: asset.id }, transaction });
    await AuditLog.create({ userId: req.user.id, action: 'PERMANENT_DELETE_ASSET', entity: `asset:${asset.id}`, details: JSON.stringify({ assetId: asset.id, previousValue }) }, { transaction });
    await asset.destroy({ force: true, transaction });
    await transaction.commit();
    res.json({ success: true, message: 'Asset permanently deleted' });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

const listAssetDocuments = async (req, res, next) => {
  try {
    const documents = await AssetDocument.findAll({ where: { assetId: req.params.id, status: 'active' }, order: [['createdAt', 'DESC']] });
    res.json({ success: true, data: documents, documents });
  } catch (error) { next(error); }
};

const uploadAssetDocument = async (req, res, next) => {
  try {
    const asset = await Asset.findByPk(req.params.id);
    if (!asset) return res.status(404).json({ success: false, message: 'Asset not found' });
    const saved = saveDocument(req.body, 'assets');
    const document = await AssetDocument.create({
      assetId: asset.id,
      documentType: req.body.documentType || req.body.document_type || 'warranty',
      originalName: saved.originalName,
      storedName: saved.storedName,
      mimeType: saved.mimeType,
      fileSize: saved.fileSize,
      filePath: saved.filePath,
      description: req.body.description || '',
      uploadedBy: req.user.id,
    });
    await AuditLog.create({ userId: req.user.id, action: 'UPLOAD_ASSET_DOCUMENT', entity: `asset:${asset.id}`, details: JSON.stringify({ documentId: document.id, documentType: document.documentType, originalName: saved.originalName }) });
    res.status(201).json({ success: true, data: document });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
    next(error);
  }
};

const deleteAssetDocument = async (req, res, next) => {
  try {
    const document = await AssetDocument.findByPk(req.params.documentId);
    if (!document) return res.status(404).json({ success: false, message: 'Document not found' });
    await document.update({ status: 'removed' });
    res.json({ success: true, message: 'Document removed' });
  } catch (error) { next(error); }
};

const downloadAssetDocument = async (req, res, next) => {
  try {
    const document = await AssetDocument.findByPk(req.params.documentId);
    if (!document || String(document.assetId) !== String(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }
    const absolutePath = path.resolve(__dirname, '..', document.filePath || '');
    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ success: false, message: 'Document file is missing' });
    }
    res.sendFile(absolutePath);
  } catch (error) { next(error); }
};

const listAssetGrants = async (req, res, next) => {
  try {
    const grants = await AssetGrant.findAll({ where: { assetId: req.params.id }, order: [['createdAt', 'DESC']] });
    res.json({ success: true, data: grants, grants });
  } catch (error) { next(error); }
};

const createAssetGrant = async (req, res, next) => {
  try {
    const asset = await Asset.findByPk(req.params.id);
    if (!asset) return res.status(404).json({ success: false, message: 'Asset not found' });
    const grantNumber = String(req.body.grantNumber || req.body.grant_number || '').trim();
    const grantName = String(req.body.grantName || req.body.grant_name || '').trim();
    const fundingOrganization = String(req.body.fundingOrganization || req.body.funding_organization || '').trim();
    if (!grantNumber || !grantName || !fundingOrganization) return res.status(400).json({ success: false, message: 'Grant number, grant name, and funding organization are required' });
    if (req.body.fundingAmount !== undefined && req.body.fundingAmount !== null && req.body.fundingAmount !== '' && (!Number.isFinite(Number(req.body.fundingAmount)) || Number(req.body.fundingAmount) < 0)) {
      return res.status(400).json({ success: false, message: 'Funding amount must be a non-negative number' });
    }
    if (req.body.acquisitionDate && Number.isNaN(Date.parse(req.body.acquisitionDate))) return res.status(400).json({ success: false, message: 'Invalid acquisition date' });
    const grant = await AssetGrant.create({
      assetId: asset.id,
      grantNumber,
      grantName,
      fundingOrganization,
      principalInvestigator: req.body.principalInvestigator || req.body.principal_investigator || '',
      fundingAmount: req.body.fundingAmount || null,
      acquisitionDate: req.body.acquisitionDate || req.body.acquisition_date || null,
    });
    await asset.update({ fundingSource: fundingOrganization });
    await AuditLog.create({ userId: req.user.id, action: 'CREATE_ASSET_GRANT', entity: `asset:${asset.id}`, details: JSON.stringify({ grantId: grant.id, grantNumber }) });
    res.status(201).json({ success: true, data: grant });
  } catch (error) { next(error); }
};

const listCustody = async (req, res, next) => {
  try {
    const where = {};
    if (req.params.id) where.assetId = req.params.id;
    if (req.query.custodian_id) where.custodianId = req.query.custodian_id;
    if (req.query.status) where.status = req.query.status;
    const custody = await AssetCustody.findAll({ where, include: [{ model: User, as: 'Custodian', attributes: ['id', 'username', 'fullName', 'department'] }], order: [['receivedDate', 'DESC']], limit: 200 });
    res.json({ success: true, data: custody, custody });
  } catch (error) { next(error); }
};

const createAssetCustody = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const asset = await Asset.findByPk(req.params.id, { transaction });
    if (!asset) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Asset not found' }); }
    const custodianId = Number(req.body.custodianId || req.body.custodian_id || req.body.assigned_to);
    if (!Number.isInteger(custodianId)) { await transaction.rollback(); return res.status(400).json({ success: false, message: 'A valid custodian user id is required' }); }
    const custodian = await User.findByPk(custodianId, { transaction });
    if (!custodian || !custodian.active) { await transaction.rollback(); return res.status(400).json({ success: false, message: 'Custodian user not found or inactive' }); }
    await AssetCustody.update({ status: 'returned', returnedDate: new Date() }, { where: { assetId: asset.id, status: 'active' }, transaction });
    const custody = await AssetCustody.create({
      assetId: asset.id,
      custodianId,
      handedOverBy: req.user.id,
      receivedDate: req.body.receivedDate || req.body.received_date || new Date(),
      status: 'active',
      notes: req.body.notes || '',
    }, { transaction });
    await item_updateAsset(asset, { status: 'in-use' }, req.user.id, transaction);
    await AuditLog.create({ userId: req.user.id, action: 'CREATE_ASSET_CUSTODY', entity: `asset:${asset.id}`, details: JSON.stringify({ custodyId: custody.id, custodianId }) }, { transaction });
    await transaction.commit();
    res.status(201).json({ success: true, data: custody });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

const endCustody = async (req, res, next) => {
  try {
    const custody = await AssetCustody.findByPk(req.params.custodyId);
    if (!custody) return res.status(404).json({ success: false, message: 'Custody record not found' });
    if (custody.status !== 'active') return res.status(409).json({ success: false, message: 'Custody is already closed' });
    await custody.update({ status: 'returned', returnedDate: new Date() });
    res.json({ success: true, data: custody });
  } catch (error) { next(error); }
};

async function item_updateAsset(asset, updates, userId, transaction) {
  const previousValue = asset.toJSON();
  await asset.update(updates, { transaction: transaction || undefined });
  await AuditLog.create({ userId, action: 'UPDATE_ASSET', entity: `asset:${asset.id}`, details: JSON.stringify({ assetId: asset.id, previousValue, newValue: asset.toJSON() }) }, { transaction: transaction || undefined });
}

const bulkImportAssets = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const rows = Array.isArray(req.body.rows) ? req.body.rows : Array.isArray(req.body.data) ? req.body.data : [];
    if (!rows.length) { await transaction.rollback(); return res.status(400).json({ success: false, message: 'No asset rows provided' }); }
    const parsedRows = rows.map((row) => {
      const name = String(row.name || row['Asset Name'] || row['assetName'] || '').trim();
      const category = String(row.category || row['Category'] || '').trim();
      const serialNumber = String(row.serialNumber || row['Serial Number'] || row.serial_number || '').trim();
      const quantity = Number(row.quantity ?? row['Quantity'] ?? 1);
      const purchaseDate = row.purchaseDate || row['Purchase Date'] || row.purchase_date || null;
      return {
        name,
        category,
        serialNumber,
        quantity,
        assetCode: String(row.assetCode || row['Asset Code'] || row.asset_code || '').trim(),
        model: String(row.model || row['Model'] || '').trim(),
        manufacturer: String(row.manufacturer || row['Manufacturer'] || '').trim(),
        supplier: String(row.supplier || row['Supplier'] || '').trim(),
        purchasePrice: row.purchasePrice ?? row['Purchase Price'] ?? row.purchase_cost ?? (row.supplier ? undefined : 0),
        location: String(row.location || row['Location'] || '').trim(),
        condition: String(row.condition || row['Condition'] || 'Good').trim(),
        status: row.status || row['Status'] || 'available',
        fundingSource: String(row.fundingSource || row['Funding Source'] || row.funding_source || '').trim(),
        purchaseDate,
      };
    });

    const errors = [];
    const created = [];
    const seenSerialNumbers = new Set();
    const categoryNames = await Category.findAll({ attributes: ['name'], raw: true });
    const validCategories = new Set(categoryNames.map((category) => String(category.name).trim().toLowerCase()));

    for (let index = 0; index < parsedRows.length; index += 1) {
      const row = parsedRows[index];
      const rowNumber = index + 2;
      const rowErrors = [];
      if (!row.name) rowErrors.push('Missing required field: Asset Name');
      if (!row.category) rowErrors.push('Missing required field: Category');
      else if (validCategories.size && !validCategories.has(row.category.toLowerCase())) rowErrors.push(`Unknown category: ${row.category}`);
      if (row.serialNumber) {
        if (seenSerialNumbers.has(row.serialNumber.toLowerCase())) rowErrors.push(`Duplicate serial number within file: ${row.serialNumber}`);
        else seenSerialNumbers.add(row.serialNumber.toLowerCase());
        const existing = await Asset.findOne({ where: { serialNumber: row.serialNumber }, paranoid: false, transaction });
        if (existing) rowErrors.push(`Serial number already exists: ${row.serialNumber}`);
      }
      if (!Number.isFinite(row.quantity) || row.quantity < 1) rowErrors.push(`Invalid quantity: ${row.quantity}`);
      if (row.purchaseDate && Number.isNaN(Date.parse(row.purchaseDate))) rowErrors.push(`Invalid purchase date: ${row.purchaseDate}`);
      if (!VALID_CONDITIONS.map((condition) => condition.toLowerCase()).includes(row.condition.toLowerCase())) rowErrors.push(`Invalid condition: ${row.condition}`);
      if (!VALID_STATUSES.includes(normalizeStatus(row.status))) rowErrors.push(`Invalid status: ${row.status}`);
      if (!['Good', 'Fair', 'Poor', 'Damaged'].includes(row.condition)) row.condition = 'Good';

      if (rowErrors.length) {
        errors.push({ row: rowNumber, name: row.name || '(no name)', errors: rowErrors });
        continue;
      }

      try {
        const asset = await Asset.create({
          name: row.name,
          category: row.category,
          serialNumber: row.serialNumber,
          assetCode: row.assetCode || `IMP-${rowNumber}-${String(Date.now()).slice(-5)}`,
          digitalId: await nextDigitalId(transaction),
          quantity: row.quantity,
          model: row.model,
          manufacturer: row.manufacturer,
          supplier: row.supplier,
          purchasePrice: Number(row.purchasePrice || 0),
          purchaseDate: row.purchaseDate || null,
          location: row.location,
          condition: row.condition,
          status: normalizeStatus(row.status),
          fundingSource: row.fundingSource,
          createdBy: req.user.id,
        }, { transaction });
        created.push(asset);
      } catch (createError) {
        errors.push({ row: rowNumber, name: row.name || '(no name)', errors: [createError.message] });
      }
    }

    if (created.length) await AuditLog.create({ userId: req.user.id, action: 'BULK_IMPORT_ASSETS', entity: 'asset', details: JSON.stringify({ total: parsedRows.length, created: created.length, failed: errors.length }) }, { transaction });
    await transaction.commit();
    const validRows = parsedRows.length - errors.length;
    res.status(errors.length ? 207 : 201).json({
      success: true,
      data: { created: created.map((asset) => serializedExtended(asset)), errors, total: parsedRows.length, createdCount: created.length, errorCount: errors.length, validRows },
      message: errors.length ? `Imported ${created.length} of ${parsedRows.length} rows. ${errors.length} row(s) had validation errors.` : `Successfully imported ${created.length} assets.`,
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

const assetImportTemplate = async (req, res) => {
  const headers = ['Asset Name', 'Category', 'Serial Number', 'Quantity', 'Asset Code', 'Model', 'Manufacturer', 'Supplier', 'Purchase Date', 'Purchase Price', 'Location', 'Condition', 'Status', 'Funding Source'];
  res.json({ success: true, data: { headers, example: ['Microscope', 'Laboratory Equipment', 'MIC-0001', 1, '', 'BX-53', 'Olympus', 'UniCorp', '2026-01-15', 250000, 'Main Campus / Science Building / Lab 201', 'Good', 'available', 'Lab Budget'] } });
};

module.exports = {
  nextDigitalId,
  generateDigitalId,
  lookupByQr,
  listDeletedAssets,
  softDeleteAsset,
  restoreAsset,
  permanentDeleteAsset,
  listAssetDocuments,
  uploadAssetDocument,
  deleteAssetDocument,
  downloadAssetDocument,
  listAssetGrants,
  createAssetGrant,
  listCustody,
  createAssetCustody,
  endCustody,
  bulkImportAssets,
  assetImportTemplate,
  serializedExtended,
};