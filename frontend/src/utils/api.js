import apiClient, { API_BASE_URL, apiFetch, apiFetchStream, clearExpiredSession, getApiErrorMessage, isCurrentAuthRequest, resolveAssetUrl, SESSION_EXPIRED_EVENT, SESSION_EXPIRED_STORAGE_KEY } from '../services/apiClient';

export const apiBase = () => API_BASE_URL;
export { apiClient, apiFetch, apiFetchStream, clearExpiredSession, getApiErrorMessage, isCurrentAuthRequest, resolveAssetUrl, SESSION_EXPIRED_EVENT, SESSION_EXPIRED_STORAGE_KEY };
