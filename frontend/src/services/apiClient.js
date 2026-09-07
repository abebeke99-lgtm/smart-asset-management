import axios from 'axios';

const configuredApiUrl = String(process.env.REACT_APP_API_URL || '').trim();
const normalizedConfiguredUrl = configuredApiUrl.replace(/\/+$/, '').replace(/\/api$/, '');
const defaultApiOrigin = typeof window !== 'undefined' && window.location?.hostname
  ? `${window.location.protocol || 'http:'}//${window.location.hostname}:5000`
  : 'http://localhost:5000';

export const API_BASE_URL = normalizedConfiguredUrl || defaultApiOrigin;

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: Number(process.env.REACT_APP_API_TIMEOUT) || 30000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token') || localStorage.getItem('authToken');
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
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
      responseData: error.response?.data,
      message: error.message
    });

    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('authToken');
    }

    return Promise.reject(error);
  }
);

// Keep existing direct axios imports pointed at the same API origin while the
// application is migrated incrementally to apiClient.
axios.defaults.baseURL = API_BASE_URL;
axios.defaults.timeout = Number(process.env.REACT_APP_API_TIMEOUT) || 30000;
axios.defaults.withCredentials = true;
axios.defaults.headers.common['Content-Type'] = 'application/json';

export default apiClient;
