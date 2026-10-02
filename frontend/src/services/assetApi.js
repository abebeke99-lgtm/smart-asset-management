import axios from 'axios';

const ASSET_PAGE_LIMIT = 50;

const getRows = (response) => {
  const rows = response?.data?.assets || response?.data?.data;
  if (!Array.isArray(rows)) throw new Error('The assets API returned an invalid response.');
  return rows;
};

export const getAllAssets = async (client = axios, params = {}) => {
  const firstResponse = await client.get('/api/assets', {
    params: { ...params, page: 1, limit: ASSET_PAGE_LIMIT },
  });
  const pageCount = Math.max(1, Number(firstResponse?.data?.pagination?.pages) || 1);
  const remainingResponses = await Promise.all(
    Array.from({ length: pageCount - 1 }, (_, index) => client.get('/api/assets', {
      params: { ...params, page: index + 2, limit: ASSET_PAGE_LIMIT },
    }))
  );

  return [firstResponse, ...remainingResponses].flatMap(getRows);
};