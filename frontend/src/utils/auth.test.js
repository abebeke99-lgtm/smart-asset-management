import { sanitizeAuthToken } from './auth';

describe('sanitizeAuthToken', () => {
  test('accepts a normal bearer token', () => {
    expect(sanitizeAuthToken('abc123.token.value')).toBe('abc123.token.value');
  });

  test('drops oversized tokens before they reach the Authorization header', () => {
    expect(sanitizeAuthToken('a'.repeat(5000))).toBe('');
  });

  test('drops malformed non-token values', () => {
    expect(sanitizeAuthToken('{"bad":"value"}')).toBe('');
  });
});
