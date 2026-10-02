import { getAllAssets } from './assetApi';

describe('getAllAssets', () => {
  test('requests every backend-supported page and preserves filters', async () => {
    const client = {
      get: jest.fn()
        .mockResolvedValueOnce({ data: { assets: [{ id: 1 }], pagination: { pages: 2 } } })
        .mockResolvedValueOnce({ data: { data: [{ id: 2 }], pagination: { pages: 2 } } }),
    };

    await expect(getAllAssets(client, { status: 'Available' })).resolves.toEqual([{ id: 1 }, { id: 2 }]);
    expect(client.get).toHaveBeenNthCalledWith(1, '/api/assets', { params: { status: 'Available', page: 1, limit: 50 } });
    expect(client.get).toHaveBeenNthCalledWith(2, '/api/assets', { params: { status: 'Available', page: 2, limit: 50 } });
  });

  test('returns an empty list for a successful empty response', async () => {
    const client = {
      get: jest.fn().mockResolvedValue({ data: { assets: [], pagination: { pages: 0 } } }),
    };

    await expect(getAllAssets(client)).resolves.toEqual([]);
    expect(client.get).toHaveBeenCalledTimes(1);
  });

  test('propagates API errors to the caller', async () => {
    const apiError = new Error('Request failed with status code 400');
    const client = { get: jest.fn().mockRejectedValue(apiError) };

    await expect(getAllAssets(client)).rejects.toBe(apiError);
  });
});