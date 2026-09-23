import { normalizeRole } from './App';

describe('normalizeRole', () => {
  test('maps infrastructure director titles to the infrastructure role', () => {
    expect(normalizeRole('Infrastructure Directorate')).toBe('infrastructure');
    expect(normalizeRole('Infrastructure Director')).toBe('infrastructure');
    expect(normalizeRole('infrastructure_directorate')).toBe('infrastructure');
  });
});
