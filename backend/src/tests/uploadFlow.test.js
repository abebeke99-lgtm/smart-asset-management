const test = require('node:test');
const assert = require('node:assert/strict');
const { sanitizeFilename, getUploadCategoryByMimeType, validateUploadFile, validateProfilePhoto } = require('../utils/uploadUtils');

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

test('validateProfilePhoto rejects executable files and oversized images', () => {
  const valid = validateProfilePhoto({
    originalname: 'profile.jpg',
    mimetype: 'image/jpeg',
    size: 512 * 1024,
    buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]),
  });
  assert.equal(valid.valid, true);

  const badMime = validateProfilePhoto({
    originalname: 'profile.php',
    mimetype: 'application/x-php',
    size: 512,
    buffer: Buffer.from('<?php echo 1;'),
  });
  assert.equal(badMime.valid, false);
  assert.match(badMime.message, /unsupported|image/i);

  const tooLarge = validateProfilePhoto({
    originalname: 'profile.png',
    mimetype: 'image/png',
    size: 6 * 1024 * 1024,
    buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  }, { maxSize: 5 * 1024 * 1024 });
  assert.equal(tooLarge.valid, false);
  assert.match(tooLarge.message, /too large|maximum/i);
});
