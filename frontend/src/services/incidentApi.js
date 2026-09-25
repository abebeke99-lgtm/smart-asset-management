import apiClient from './apiClient';

const body = (response) => response.data || {};
export const getIncidents = (params) => apiClient.get('/incidents', { params }).then(body);
export const getIncidentStatistics = () => apiClient.get('/incidents/statistics').then(body);
export const getIncident = (id) => apiClient.get(`/incidents/${id}`).then(body);
export const createIncident = (payload) => apiClient.post('/incidents', payload).then(body);
export const updateIncident = (id, payload) => apiClient.put(`/incidents/${id}`, payload).then(body);
export const setIncidentStatus = (id, status, payload = {}) => apiClient.patch(`/incidents/${id}/status`, { ...payload, status }).then(body);
export const assignIncident = (id, payload) => apiClient.patch(`/incidents/${id}/assign`, payload).then(body);
export const escalateIncident = (id, payload) => apiClient.patch(`/incidents/${id}/escalate`, payload).then(body);
export const addIncidentComment = (id, payload) => apiClient.post(`/incidents/${id}/comments`, payload).then(body);
