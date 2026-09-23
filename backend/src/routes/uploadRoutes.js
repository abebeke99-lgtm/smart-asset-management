const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { requireAuth } = require('../middlewares/auth');
const { sequelize, UploadRecord } = require('../models');
const { saveUploadedFile, validateUploadFile, buildPublicFileUrl, sanitizeFilename } = require('../utils/uploadUtils');

const router = express.Router();
const maxUploadSize = (() => {
  const raw = process.env.MAX_FILE_SIZE_BYTES || process.env.MAX_FILE_SIZE || '20mb';
  const value = Number(raw);
  if (Number.isFinite(value) && value > 0) return value;
  const match = String(raw).trim().toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)$/);
  if (!match) return 20 * 1024 * 1024;
  const amount = Number(match[1]);
  const multiplier = { b: 1, kb: 1024, mb: 1024 * 1024, gb: 1024 * 1024 * 1024 }[match[2]];
  return Math.round(amount * multiplier);
})();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxUploadSize },
  fileFilter: (req, file, cb) => {
    const category = getCategoryFromBody(req, file);
    const validation = validateUploadFile(file, { category });
    if (!validation.valid) {
      return cb(new Error(validation.message));
    }
    cb(null, true);
  },
});

const getCategoryFromBody = (req, file = null) => {
  const preferredCategory = String(req.body?.category || req.query?.category || '').toLowerCase();
  const mimeType = String(file?.mimetype || req.body?.mimeType || req.file?.mimetype || '').toLowerCase();
  const validPreferred = ['images', 'documents', 'files'].includes(preferredCategory) ? preferredCategory : null;
  const inferredCategory = mimeType.startsWith('image/') ? 'images' : (['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'text/plain', 'text/csv', 'application/rtf', 'application/vnd.oasis.opendocument.text', 'application/vnd.oasis.opendocument.spreadsheet', 'application/vnd.oasis.opendocument.presentation', 'application/json', 'application/xml', 'text/xml', 'application/zip', 'application/x-zip-compressed', 'application/octet-stream', 'application/x-rar-compressed'].includes(mimeType) ? 'documents' : 'files');
  if (validPreferred && mimeType && (mimeType.startsWith('image/') ? validPreferred === 'images' : validPreferred !== 'images')) return validPreferred;
  if (mimeType.startsWith('image/')) return 'images';
  if (validPreferred && validPreferred === 'documents') return 'documents';
  if (validPreferred && validPreferred === 'files') return 'files';
  return inferredCategory;
};

const parseUploadPayload = (req, file) => {
  const data = { ...req.body };
  const category = getCategoryFromBody(req, file);
  const fileBuffer = file && file.buffer ? Buffer.from(file.buffer) : null;
  return { data, category, fileBuffer };
};

router.post('/', requireAuth, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    const category = getCategoryFromBody(req, req.file);
    const validation = validateUploadFile(req.file, { category });
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: validation.message });
    }

    const saved = saveUploadedFile({
      buffer: Buffer.from(req.file.buffer),
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      category,
    }, { prefix: 'upload' });

    const uploadedRecord = await UploadRecord.create({
      originalName: saved.originalName,
      filename: saved.filename,
      mimeType: saved.mimeType,
      fileSize: saved.size,
      category,
      filePath: saved.filePath,
      url: saved.url,
      uploadedBy: req.user?.id || null,
      status: 'active',
    });

    return res.status(201).json({
      success: true,
      file: {
        id: uploadedRecord.id,
        originalName: uploadedRecord.originalName,
        filename: uploadedRecord.filename,
        mimeType: uploadedRecord.mimeType,
        size: uploadedRecord.fileSize,
        category: uploadedRecord.category,
        url: uploadedRecord.url,
        createdAt: uploadedRecord.createdAt,
      },
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    return next(error);
  }
});

router.post('/multiple', requireAuth, upload.array('files', 10), async (req, res, next) => {
  try {
    if (!req.files || !req.files.length) {
      return res.status(400).json({ success: false, message: 'No files uploaded.' });
    }

    const category = getCategoryFromBody(req, req.files?.[0]);
    const savedFiles = [];

    for (const file of req.files) {
      const validation = validateUploadFile(file, { category });
      if (!validation.valid) {
        return res.status(400).json({ success: false, message: `${file.originalname}: ${validation.message}` });
      }

      const saved = saveUploadedFile({
        buffer: Buffer.from(file.buffer),
        originalName: file.originalname,
        mimeType: file.mimetype,
        category,
      }, { prefix: 'upload' });

      const record = await UploadRecord.create({
        originalName: saved.originalName,
        filename: saved.filename,
        mimeType: saved.mimeType,
        fileSize: saved.size,
        category,
        filePath: saved.filePath,
        url: saved.url,
        uploadedBy: req.user?.id || null,
        status: 'active',
      });

      savedFiles.push({
        id: record.id,
        originalName: record.originalName,
        filename: record.filename,
        mimeType: record.mimeType,
        size: record.fileSize,
        category: record.category,
        url: record.url,
        createdAt: record.createdAt,
      });
    }

    return res.status(201).json({ success: true, files: savedFiles });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    return next(error);
  }
});

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const category = req.query.category ? String(req.query.category).toLowerCase() : null;
    const where = { status: 'active' };
    if (category && ['images', 'documents', 'files'].includes(category)) where.category = category;
    const uploads = await UploadRecord.findAll({ where, order: [['createdAt', 'DESC']], limit: 200 });
    res.json({ success: true, uploads: uploads.map((record) => ({
      id: record.id,
      originalName: record.originalName,
      filename: record.filename,
      mimeType: record.mimeType,
      size: record.fileSize,
      category: record.category,
      url: record.url,
      createdAt: record.createdAt,
    })) });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const record = await UploadRecord.findByPk(req.params.id);
    if (!record) return res.status(404).json({ success: false, message: 'Upload record not found.' });
    return res.json({ success: true, file: {
      id: record.id,
      originalName: record.originalName,
      filename: record.filename,
      mimeType: record.mimeType,
      size: record.fileSize,
      category: record.category,
      url: record.url,
      createdAt: record.createdAt,
    }});
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const record = await UploadRecord.findByPk(req.params.id);
    if (!record) return res.status(404).json({ success: false, message: 'Upload record not found.' });
    if (req.user.role !== 'admin' && Number(record.uploadedBy) !== Number(req.user.id)) {
      return res.status(403).json({ success: false, message: 'You are not allowed to delete this upload.' });
    }
    const filePath = path.resolve(__dirname, '..', record.filePath || '');
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await record.update({ status: 'deleted' });
    return res.json({ success: true, message: 'Upload deleted.' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
