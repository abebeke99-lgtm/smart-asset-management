const test = require('node:test');
const assert = require('node:assert/strict');
const { sanitizeFilename, getUploadCategoryByMimeType, validateUploadFile } = require('../utils/uploadUtils');

test('sanitizeFilename strips traversal and invalid characters', () => {
  const result = sanitizeFilename('../../evil.jsp?x=1');
  assert.equal(result.endsWith('.jsp'), true);
  assert.equal(result.includes('..'), false);
  assert.equal(result.includes('/'), false);
  assert.equal(result.includes('\\'), false);
});

test('validateUploadFile enforces safe extensions and size limits', () => {
  const ok = validateUploadFile({
    originalname: 'photo.png',
    mimetype: 'image/png',
    size: 1024,
  });
  assert.equal(ok.valid, true);

  const badMime = validateUploadFile({
    originalname: 'bad.exe',
    mimetype: 'application/x-msdownload',
    size: 1024,
  });
  assert.equal(badMime.valid, false);
  assert.match(badMime.message, /Unsupported file type/i);

  const tooLarge = validateUploadFile({
    originalname: 'big.pdf',
    mimetype: 'application/pdf',
    size: 25 * 1024 * 1024,
  }, { maxSize: 20 * 1024 * 1024 });
  assert.equal(tooLarge.valid, false);
  assert.match(tooLarge.message, /maximum/i);
});

test('getUploadCategoryByMimeType groups images and docs correctly', () => {
  assert.equal(getUploadCategoryByMimeType('image/png'), 'images');
  assert.equal(getUploadCategoryByMimeType('application/pdf'), 'documents');
  assert.equal(getUploadCategoryByMimeType('text/plain'), 'documents');
});
