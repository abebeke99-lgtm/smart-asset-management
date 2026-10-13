import apiClient, { API_BASE_URL, clearExpiredSession, getApiErrorMessage, isCurrentAuthRequest, resolveAssetUrl, SESSION_EXPIRED_STORAGE_KEY } from '../services/apiClient';

export const apiBase = () => API_BASE_URL;
export { apiClient, clearExpiredSession, getApiErrorMessage, isCurrentAuthRequest, resolveAssetUrl, SESSION_EXPIRED_STORAGE_KEY };
