import apiClient from './apiClient';

export const getIctReports = (params, config = {}) => apiClient.get('/api/ict/reports', { ...config, params });

export const exportIctReport = (params) => apiClient.get('/api/ict/reports/export', {
  params,
  responseType: 'blob',
});