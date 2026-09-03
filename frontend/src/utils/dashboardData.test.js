import { normalizeListResponse } from './dashboardData';

describe('normalizeListResponse', () => {
  it('unwraps a direct array response', () => {
    expect(normalizeListResponse([{ id: 1 }, { id: 2 }], 'assets')).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('unwraps an object response with the expected key', () => {
    expect(normalizeListResponse({ assets: [{ id: 7 }] }, 'assets')).toEqual([{ id: 7 }]);
  });

  it('returns an empty list for missing data', () => {
    expect(normalizeListResponse(null, 'assets')).toEqual([]);
  });
});
