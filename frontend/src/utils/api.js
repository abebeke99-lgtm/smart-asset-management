import apiClient, { API_BASE_URL, getApiErrorMessage, isCurrentAuthRequest, resolveAssetUrl } from '../services/apiClient';

export const apiBase = () => API_BASE_URL;
export { apiClient, getApiErrorMessage, isCurrentAuthRequest, resolveAssetUrl };
