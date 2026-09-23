const fs = require('fs');
const path = require('path');

const DEFAULT_UPLOAD_ROOT = process.env.UPLOAD_DIR || './uploads';
const IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'image/svg+xml'];
const DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'application/rtf',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.oasis.opendocument.presentation',
];
const FILE_MIME_TYPES = [...new Set([
  ...DOCUMENT_MIME_TYPES,
  'application/json',
  'application/xml',
  'text/xml',
  'application/zip',
  'application/x-zip-compressed',
  'application/octet-stream',
  'application/x-rar-compressed',
])];

const normalizeMimeType = (value = '') => String(value || '').split(';')[0].trim().toLowerCase();

const parseByteSize = (value) => {
  if (value === undefined || value === null || value === '') return 0;
  if (Number.isFinite(Number(value))) return Number(value);
  const match = String(value).trim().toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb|tb)$/i);
  if (!match) return 0;
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multiplier = { b: 1, kb: 1024, mb: 1024 * 1024, gb: 1024 * 1024 * 1024, tb: 1024 * 1024 * 1024 * 1024 }[unit];
  return Math.round(amount * multiplier);
};

const normalizeFileExtension = (value = '') => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const withoutQuery = raw.replace(/[?#].*$/, '');
  const ext = path.extname(withoutQuery).toLowerCase();
  return ext && /^[.][a-z0-9]{1,8}$/i.test(ext) ? ext : '';
};

const sanitizeFilename = (value = '') => {
  const raw = String(value || '').trim();
  const cleanedRaw = raw.replace(/[?#].*$/, '').split(/[\\/]/).pop() || raw || 'file';
  const extension = normalizeFileExtension(cleanedRaw);
  const baseName = path.basename(cleanedRaw, extension).replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '').replace(/^\.+/, '');
  const safeBase = (baseName || 'file').slice(0, 120);
  const safeExtension = extension || '';
  const sanitized = `${safeBase}${safeExtension}`;
  return sanitized.replace(/\.{2,}/g, '.').replace(/_\./g, '.').slice(0, 180) || 'file';
};

const getUploadCategoryByMimeType = (mimeType = '') => {
  const normalized = normalizeMimeType(mimeType);
  if (!normalized) return 'files';
  if (normalized.startsWith('image/')) return 'images';
  if (DOCUMENT_MIME_TYPES.includes(normalized)) return 'documents';
  return 'files';
};

const getAllowedMimeTypesForCategory = (category = 'files') => {
  switch (String(category).toLowerCase()) {
    case 'images':
      return IMAGE_MIME_TYPES;
    case 'documents':
      return DOCUMENT_MIME_TYPES;
    default:
      return FILE_MIME_TYPES;
  }
};

const getAllowedExtensionsForCategory = (category = 'files') => {
  const mimeTypes = getAllowedMimeTypesForCategory(category);
  const extensions = new Set();
  for (const mimeType of mimeTypes) {
    if (mimeType === 'image/png') extensions.add('.png');
    if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') { extensions.add('.jpg'); extensions.add('.jpeg'); }
    if (mimeType === 'image/webp') extensions.add('.webp');
    if (mimeType === 'image/gif') extensions.add('.gif');
    if (mimeType === 'image/svg+xml') extensions.add('.svg');
    if (mimeType === 'application/pdf') extensions.add('.pdf');
    if (mimeType === 'application/msword' || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') { extensions.add('.doc'); extensions.add('.docx'); }
    if (mimeType === 'application/vnd.ms-excel' || mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') { extensions.add('.xls'); extensions.add('.xlsx'); }
    if (mimeType === 'application/vnd.ms-powerpoint' || mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') { extensions.add('.ppt'); extensions.add('.pptx'); }
    if (mimeType === 'text/plain') extensions.add('.txt');
    if (mimeType === 'text/csv') extensions.add('.csv');
    if (mimeType === 'application/rtf') extensions.add('.rtf');
    if (mimeType === 'application/vnd.oasis.opendocument.text') extensions.add('.odt');
    if (mimeType === 'application/vnd.oasis.opendocument.spreadsheet') extensions.add('.ods');
    if (mimeType === 'application/vnd.oasis.opendocument.presentation') extensions.add('.odp');
  }
  return [...extensions];
};

const getLimitByCategory = (category = 'files') => {
  const normalized = String(category).toLowerCase();
  if (normalized === 'images') return parseByteSize(process.env.MAX_IMAGE_SIZE || (10 * 1024 * 1024));
  if (normalized === 'documents') return parseByteSize(process.env.MAX_DOCUMENT_SIZE || (25 * 1024 * 1024));
  return parseByteSize(process.env.MAX_FILE_SIZE_BYTES || process.env.MAX_FILE_SIZE || (20 * 1024 * 1024));
};

const validateUploadFile = (file = {}, options = {}) => {
  const originalName = String(file.originalname || file.originalName || file.name || 'upload').trim();
  const mimeType = normalizeMimeType(file.mimetype || file.mimeType || '');
  const size = Number(file.size || 0);
  const inferredCategory = getUploadCategoryByMimeType(mimeType);
  const requestedCategory = String(options.category || '').toLowerCase();
  const requestedIsValid = ['images', 'documents', 'files'].includes(requestedCategory);
  const requestedMatchesMime = requestedIsValid && getAllowedMimeTypesForCategory(requestedCategory).includes(mimeType);
  const effectiveCategory = requestedMatchesMime ? requestedCategory : inferredCategory;
  const allowedMimeTypes = getAllowedMimeTypesForCategory(effectiveCategory);
  const allowedExtensions = getAllowedExtensionsForCategory(effectiveCategory);
  const extension = normalizeFileExtension(originalName);

  if (!allowedMimeTypes.includes(mimeType)) {
    return {
      valid: false,
      category: effectiveCategory,
      message: `Unsupported file type: ${mimeType || 'unknown'}. Allowed: ${allowedMimeTypes.join(', ')}`,
    };
  }

  if (extension && !allowedExtensions.includes(extension.toLowerCase())) {
    return {
      valid: false,
      category: effectiveCategory,
      message: `Unsupported file extension: ${extension}. Allowed: ${allowedExtensions.join(', ')}`,
    };
  }

  const maxSize = Number.isFinite(Number(options.maxSize)) ? Number(options.maxSize) : getLimitByCategory(effectiveCategory);
  if (!maxSize || !size || size > maxSize) {
    return {
      valid: false,
      category: effectiveCategory,
      message: `File size exceeds the maximum allowed size of ${Math.round(maxSize / (1024 * 1024))} MB.`,
    };
  }

  return {
    valid: true,
    category: effectiveCategory,
    mimeType,
    extension,
    size,
  };
};

const ensureUploadDirectories = () => {
  const root = path.resolve(process.cwd(), DEFAULT_UPLOAD_ROOT.replace(/^\.\//, ''));
  const directories = ['images', 'documents', 'files', 'requests', 'assets'];
  for (const directory of directories) {
    fs.mkdirSync(path.join(root, directory), { recursive: true });
  }
  return root;
};

const resolveUploadDirectory = (category = 'files') => {
  const root = path.resolve(process.cwd(), DEFAULT_UPLOAD_ROOT.replace(/^\.\//, ''));
  const normalizedCategory = String(category || 'files').toLowerCase();
  const target = path.join(root, ['images', 'documents', 'files', 'requests', 'assets'].includes(normalizedCategory) ? normalizedCategory : 'files');
  fs.mkdirSync(target, { recursive: true });
  return target;
};

const buildPublicFileUrl = (filePath = '') => {
  const normalized = String(filePath || '').trim().replace(/\\/g, '/');
  if (!normalized) return '';
  if (/^https?:\/\//i.test(normalized) || /^data:/i.test(normalized) || /^blob:/i.test(normalized)) return normalized;
  const noLeading = normalized.replace(/^\.?\//, '');
  const publicPath = noLeading.startsWith('uploads/') ? noLeading : `uploads/${noLeading.replace(/^\//, '')}`;
  return `/${publicPath.replace(/^\/+/, '')}`;
};

const isSvgSafe = (buffer) => {
  const text = buffer.toString('utf8').toLowerCase();
  return !/(<script|javascript:|onload=|onerror=|on[a-z]+=|<iframe|<foreignobject)/i.test(text);
};

const saveUploadedFile = ({ buffer, originalName = '', mimeType = '', category = 'files', maxSize = null }, options = {}) => {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new Error('Uploaded file content is missing.');
  }
  const validation = validateUploadFile({
    originalname: originalName,
    mimetype: mimeType,
    size: buffer.length,
  }, { category, maxSize });

  if (!validation.valid) {
    const error = new Error(validation.message);
    error.statusCode = 400;
    throw error;
  }

  const effectiveCategory = String(validation.category || category || 'files').toLowerCase();
  const sanitizedName = sanitizeFilename(originalName || 'upload');
  const extension = normalizeFileExtension(sanitizedName)
    || normalizeFileExtension(originalName)
    || (validation.mimeType === 'image/png' ? '.png' : validation.mimeType === 'application/pdf' ? '.pdf' : '');
  const baseName = path.basename(sanitizedName, extension || '').replace(/\.[^.]+$/, '') || 'upload';
  const prefix = (options.prefix || '').trim();
  const safeBase = `${prefix ? `${prefix}-` : ''}${baseName}`.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 80) || 'upload';
  const uniquePart = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const storedName = `${safeBase}-${uniquePart}${extension || ''}`;

  if (validation.mimeType === 'image/svg+xml' && !isSvgSafe(buffer)) {
    const error = new Error('SVG upload contains active content and is not allowed.');
    error.statusCode = 400;
    throw error;
  }

  const directory = resolveUploadDirectory(effectiveCategory);
  const filePath = path.join(directory, storedName);
  fs.writeFileSync(filePath, buffer);

  const relativePath = path.posix.join('uploads', effectiveCategory, storedName);
  return {
    originalName: sanitizeFilename(originalName || 'upload'),
    filename: storedName,
    storedName,
    mimeType: validation.mimeType,
    size: buffer.length,
    category: effectiveCategory,
    filePath: relativePath,
    url: buildPublicFileUrl(relativePath),
  };
};

module.exports = {
  DEFAULT_UPLOAD_ROOT,
  normalizeMimeType,
  sanitizeFilename,
  getUploadCategoryByMimeType,
  validateUploadFile,
  ensureUploadDirectories,
  resolveUploadDirectory,
  buildPublicFileUrl,
  saveUploadedFile,
  isSvgSafe,
};
