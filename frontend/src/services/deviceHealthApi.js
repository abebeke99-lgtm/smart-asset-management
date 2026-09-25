import apiClient from './apiClient';

export const getDeviceHealth = async (params = {}) => {
  const response = await apiClient.get('/ict/device-health', { params });
  return response.data || {};
};

export const getDeviceHealthDetails = async (id) => {
  const response = await apiClient.get(`/ict/device-health/${id}`);
  return response.data?.device;
};

export const createDeviceInspection = async (payload) => {
  const response = await apiClient.post('/ict/device-health', payload);
  return response.data;
};
