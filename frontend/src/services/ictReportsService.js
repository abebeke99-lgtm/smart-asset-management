import apiClient from './apiClient';

export const getIctReports = (params) => apiClient.get('/api/ict/reports', { params });

export const exportIctReport = (params) => apiClient.get('/api/ict/reports/export', {
  params,
  responseType: 'blob',
});