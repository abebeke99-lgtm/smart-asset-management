import axios from 'axios';
import { toast } from 'react-toastify';

const configuredApiUrl = [
  process.env.REACT_APP_API_URL,
  process.env.API_BASE_URL
].find((value) => typeof value === 'string' && value.trim()) || '';

const normalizeApiBase = (value) => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/\/api(?:\/)?$/i, '').replace(/\/+$/, '');
  }

  if (trimmed.startsWith('/')) {
    const basePath = trimmed.replace(/\/api(?:\/)?$/i, '').replace(/\/+$/, '');
    const origin = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '';
    return `${origin}${basePath}`;
  }

  return trimmed.replace(/\/api(?:\/)?$/i, '').replace(/\/+$/, '');
};

export const API_BASE_URL = normalizeApiBase(configuredApiUrl);

export const resolveAssetUrl = (value = '') => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  if (/^(https?:)?\/\//i.test(trimmed) || trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return trimmed;
  }
  const normalized = trimmed.replace(/\\/g, '/');
  const cleanPath = normalized.startsWith('/') ? normalized : `/${normalized.replace(/^\.\//, '').replace(/^uploads\//, 'uploads/')}`;
  return `${API_BASE_URL}${cleanPath}`;
};

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: Number(process.env.REACT_APP_API_TIMEOUT || process.env.VITE_API_TIMEOUT || 30000),
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

export const getApiErrorMessage = (error, fallback = 'Unable to connect to the server. Please try again.') => {
  if (!error) return fallback;
  if (error.response?.status === 401) return 'Session expired. Please sign in again.';
  if (error.response?.status === 403) {
    return error.response?.data?.message || 'Access denied. You do not have permission to perform this action.';
  }
  if (error.response?.status >= 500) return 'Unable to load dashboard data. Please try again.';
  if (error.response?.data?.message) return error.response.data.message;
  if (error.response?.status === 404) return 'The requested resource was not found.';
  if (error.response?.status === 422) return 'The submitted data is invalid.';
  if (error.code === 'ERR_NETWORK' || error.message === 'Network Error' || error.code === 'ECONNABORTED') {
    return 'Unable to connect to the server. Please check that the backend is running.';
  }
  return fallback;
};

export const isCurrentAuthRequest = (error) => {
  const headers = error?.config?.headers;
  const authorization = headers?.get?.('Authorization')
    || headers?.Authorization
    || headers?.authorization;
  const requestToken = typeof authorization === 'string'
    ? authorization.replace(/^Bearer\s+/i, '').trim()
    : '';
  const currentToken = localStorage.getItem('token') || localStorage.getItem('authToken');

  return Boolean(requestToken && currentToken && requestToken === currentToken);
};

apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token') || localStorage.getItem('authToken');
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }

    const requestUrl = typeof config.url === 'string' ? config.url : '';
    if (requestUrl.startsWith('/')) {
      config.url = requestUrl.startsWith('/api') ? requestUrl : `/api${requestUrl}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const isCancellation =
      error?.code === 'ERR_CANCELED' ||
      error?.code === 'ECONNABORTED' ||
      error?.name === 'CanceledError' ||
      axios.isCancel?.(error) ||
      error?.message === 'canceled' ||
      error?.message === 'Request aborted';

    if (!isCancellation) {
      console.error('API Request Error:', {
        url: error.config?.baseURL ? `${error.config.baseURL}${error.config.url || ''}` : error.config?.url,
        method: error.config?.method?.toUpperCase(),
        status: error.response?.status || 0,
      });
    }

    if (error.response?.status === 401 && isCurrentAuthRequest(error)) {
      localStorage.removeItem('token');
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      delete axios.defaults.headers.common.Authorization;
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.assign('/login');
      }
    }
    if (error.response?.status === 403) {
      error.message = error.response?.data?.message
        || 'Access denied. You do not have permission to perform this action.';
      toast.error(error.message, { toastId: 'authorization-denied' });
    }

    return Promise.reject(error);
  }
);

// Keep existing direct axios imports pointed at the same API origin while the
// application is migrated incrementally to apiClient.
axios.defaults.baseURL = API_BASE_URL;
axios.defaults.timeout = Number(process.env.REACT_APP_API_TIMEOUT || process.env.VITE_API_TIMEOUT || 30000);
axios.defaults.withCredentials = true;
axios.defaults.headers.common['Content-Type'] = 'application/json';

export default apiClient;
