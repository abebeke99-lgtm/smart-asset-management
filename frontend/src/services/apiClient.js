import axios from 'axios';

const configuredApiUrl = [
  process.env.REACT_APP_API_URL,
  process.env.VITE_API_URL,
  process.env.API_BASE_URL
].find((value) => typeof value === 'string' && value.trim()) || '';

const defaultApiOrigin = typeof window !== 'undefined' && window.location?.hostname
  ? `${window.location.protocol || 'http:'}//${window.location.hostname}:5000`
  : 'http://localhost:5000';

const normalizeApiBase = (value) => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return defaultApiOrigin;

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/\/api(?:\/)?$/i, '').replace(/\/+$/, '');
  }

  if (trimmed.startsWith('/')) {
    const origin = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : 'http://localhost:3000';
    return `${origin}${trimmed.replace(/\/api(?:\/)?$/i, '').replace(/\/+$/, '')}`;
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
  if (error.response?.status === 403) return 'You do not have permission to view this information.';
  if (error.response?.status >= 500) return 'Unable to load dashboard data. Please try again.';
  if (error.response?.data?.message) return error.response.data.message;
  if (error.response?.status === 404) return 'The requested resource was not found.';
  if (error.response?.status === 422) return 'The submitted data is invalid.';
  if (error.code === 'ERR_NETWORK' || error.message === 'Network Error' || error.code === 'ECONNABORTED') {
    return 'Unable to connect to the server. Please check that the backend is running.';
  }
  return fallback;
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
    console.error('API Request Error:', {
      url: error.config?.baseURL ? `${error.config.baseURL}${error.config.url || ''}` : error.config?.url,
      method: error.config?.method?.toUpperCase(),
      status: error.response?.status || 0,
    });

    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      delete axios.defaults.headers.common.Authorization;
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.assign('/login');
      }
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
