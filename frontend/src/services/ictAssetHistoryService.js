import apiClient from './apiClient';

export const getAssetHistory = (params = {}) => apiClient.get('/ict/asset-history', { params });

export const getAssetHistoryById = (id) => apiClient.get(`/ict/asset-history/${id}`);

export const getAssetHistoryByAsset = (assetId, params = {}) => apiClient.get(`/ict/asset-history/asset/${assetId}`, { params });