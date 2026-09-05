export function sanitizeAuthToken(token) {
  if (typeof token !== 'string') return '';

  const trimmed = token.trim();
  if (!trimmed) return '';

  if (trimmed.length > 4096) return '';

  if (trimmed.includes(' ') || trimmed.includes('\n') || trimmed.includes('\r')) {
    return '';
  }

  if (!/^[A-Za-z0-9._~+/-]+=*$/.test(trimmed)) {
    return '';
  }

  return trimmed;
}
