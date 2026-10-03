const fs = require('fs');
const path = require('path');

const ALLOWED_DOC_TYPES = ['application/pdf', 'application/msword', 'image/jpeg', 'image/png'];
const MAX_DOC_SIZE = 10 * 1024 * 1024;

const saveAssetDocument = ({ fileName = '', mimeType = '', data = '' }, subdir = 'assets') => {
  const mime = String(mimeType || '').split(';')[0].trim();
  if (!ALLOWED_DOC_TYPES.includes(mime)) {
    const error = new Error(`Unsupported file type: ${mime || 'unknown'}. Allowed: PDF, JPG, PNG.`);
    error.statusCode = 400;
    throw error;
  }

  const buffer = Buffer.from(String(data).replace(/^data:[^,]*;base64,/, ''), 'base64');
  if (!buffer.length || buffer.length > MAX_DOC_SIZE) {
    const error = new Error('File is empty or exceeds the 10 MB limit');
    error.statusCode = 400;
    throw error;
  }

  const extension = { 'application/pdf': 'pdf', 'application/msword': 'doc', 'image/jpeg': 'jpg', 'image/png': 'png' }[mime];
  const storedName = `${Date.now()}-${require('crypto').randomBytes(6).toString('hex')}.${extension}`;
  const uploadDirectory = path.resolve(__dirname, '..', process.env.UPLOAD_DIR || 'uploads', subdir);
  fs.mkdirSync(uploadDirectory, { recursive: true });
  fs.writeFileSync(path.join(uploadDirectory, storedName), buffer, { flag: 'wx' });
  return {
    originalName: String(fileName || storedName),
    storedName,
    mimeType: mime,
    fileSize: buffer.length,
    filePath: path.posix.join('uploads', subdir, storedName),
    absolutePath: path.join(uploadDirectory, storedName),
  };
};

const removeStoredAssetDocument = async (absolutePath) => {
  if (!absolutePath) return;
  await fs.promises.unlink(absolutePath);
};

module.exports = { saveAssetDocument, removeStoredAssetDocument };
