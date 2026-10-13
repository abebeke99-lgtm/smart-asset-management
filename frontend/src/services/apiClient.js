import axios from 'axios';
import { toast } from 'react-toastify';

const configuredApiUrl = [
  process.env.REACT_APP_API_URL,
  process.env.VITE_API_URL
].find((value) => typeof value === 'string' && value.trim()) || '';

const stripApiSuffix = (value) => value.replace(/(?:\/api)+(?:\/+)?$/i, '').replace(/\/+$/, '');

const normalizeApiBase = (value) => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';

  if (/^https?:\/\//i.test(trimmed)) {
    return stripApiSuffix(trimmed);
  }

  if (trimmed.startsWith('/')) {
    const basePath = stripApiSuffix(trimmed);
    const origin = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '';
    return `${origin}${basePath}`;
  }

  const normalized = stripApiSuffix(trimmed);
  return /^https?:\/\//i.test(normalized) ? normalized : `https://${normalized}`;
};

const productionApiUrl = 'https://smart-asset-management-3-production-9258.up.railway.app';
export const API_BASE_URL = normalizeApiBase(configuredApiUrl)
  || (process.env.NODE_ENV === 'production' ? productionApiUrl : '');
export const SESSION_EXPIRED_STORAGE_KEY = 'uams-session-expired';
export const SESSION_EXPIRED_EVENT = 'uams:session-expired';

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
  if (error.code === 'API_NON_JSON_RESPONSE') return 'The API returned an unexpected response. Please try again later.';
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
  const currentToken = localStorage.getItem('token')
    || localStorage.getItem('authToken')
    || localStorage.getItem('accessToken');

  return Boolean(requestToken && currentToken && requestToken === currentToken);
};

export const clearExpiredSession = (error) => {
  if (error?.response?.status !== 401 || !isCurrentAuthRequest(error)) return false;

  localStorage.removeItem('token');
  localStorage.removeItem('authToken');
  localStorage.removeItem('accessToken');
  localStorage.removeItem('user');
  if (typeof window !== 'undefined') {
    window.sessionStorage.setItem(SESSION_EXPIRED_STORAGE_KEY, 'true');
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  }
  delete apiClient.defaults.headers.common.Authorization;
  return true;
};

apiClient.defaults.baseURL = API_BASE_URL;
apiClient.defaults.timeout = Number(process.env.REACT_APP_API_TIMEOUT || process.env.VITE_API_TIMEOUT || 30000);
apiClient.defaults.withCredentials = true;
apiClient.defaults.headers.common['Content-Type'] = 'application/json';

apiClient.interceptors.request.use(
  (config) => {
    const requestUrl = typeof config.url === 'string' ? config.url : '';
    if (requestUrl.startsWith('/')) {
      config.url = requestUrl.startsWith('/api') ? requestUrl : `/api${requestUrl}`;
    }

    const token = localStorage.getItem('token')
      || localStorage.getItem('authToken')
      || localStorage.getItem('accessToken');
    const requestTarget = new URL(config.url || '', config.baseURL || API_BASE_URL || window.location.origin);
    const apiTarget = API_BASE_URL ? new URL(API_BASE_URL) : null;
    const isApiRequest = requestUrl.startsWith('/')
      || (apiTarget && requestTarget.origin === apiTarget.origin);
    if (token && isApiRequest) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => {
    if (response.config?.responseType === 'blob' || response.config?.responseType === 'arraybuffer') {
      return response;
    }
    const contentType = response.headers?.['content-type'] || '';
    const isHtml = /text\/html/i.test(contentType)
      || (typeof response.data === 'string' && /^\s*(?:<!doctype html|<html\b)/i.test(response.data));
    if (isHtml) {
      const error = new Error('The API returned an unexpected HTML response.');
      error.code = 'API_NON_JSON_RESPONSE';
      error.response = response;
      throw error;
    }
    return response;
  },
  (error) => {
    const isCancellation =
      error?.code === 'ERR_CANCELED' ||
      error?.code === 'ECONNABORTED' ||
      error?.name === 'CanceledError' ||
      axios.isCancel?.(error) ||
      error?.message === 'canceled' ||
      error?.message === 'Request aborted';

    if (!isCancellation && error.response?.status !== 401) {
      console.error('API Request Error:', {
        url: error.config?.baseURL ? `${error.config.baseURL}${error.config.url || ''}` : error.config?.url,
        method: error.config?.method?.toUpperCase(),
        status: error.response?.status || 0,
      });
    }

    if (clearExpiredSession(error)) {
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.assign('/login');
      }
    }
    if (error.response?.status === 403) {
      error.message = error.response?.data?.message
        || 'Access denied. You do not have permission to perform this action.';
      toast.error(error.message, { toastId: 'authorization-denied' });
    } else if (error.response) {
      error.status = error.response.status;
      error.message = getApiErrorMessage(error, `Server error occurred (${error.response.status})`);
    } else if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
      error.code = 'NETWORK_ERROR';
      error.message = 'Unable to connect to server. Please try again.';
    }

    return Promise.reject(error);
  }
);

export const apiFetch = async (url, options = {}) => {
  const response = await apiClient.request({
    url,
    method: options.method || 'GET',
    data: options.body,
    headers: options.headers,
    signal: options.signal,
    responseType: options.responseType,
    withCredentials: options.credentials === 'include' || apiClient.defaults.withCredentials,
  });
  const responseHeaders = {
    get: (name) => response.headers?.[String(name).toLowerCase()] || null,
  };
  const contentType = responseHeaders.get('content-type') || '';

  return {
    ok: response.status >= 200 && response.status < 300,
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
    json: async () => {
      if (!/application\/(?:[\w.+-]+\+)?json/i.test(contentType)) {
        const error = new Error('The API returned an unexpected non-JSON response.');
        error.code = 'API_NON_JSON_RESPONSE';
        throw error;
      }
      if (typeof response.data !== 'string') return response.data;
      try {
        return JSON.parse(response.data);
      } catch {
        const error = new Error('The API returned an invalid JSON response.');
        error.code = 'API_NON_JSON_RESPONSE';
        throw error;
      }
    },
    text: async () => typeof response.data === 'string' ? response.data : JSON.stringify(response.data),
    blob: async () => response.data,
  };
};

export const apiFetchStream = async (url, options = {}) => {
  const token = localStorage.getItem('token') || localStorage.getItem('authToken');
  const headers = new Headers(options.headers || {});
  const requestUrl = new URL(url, API_BASE_URL || window.location.origin);
  const apiOrigin = API_BASE_URL ? new URL(API_BASE_URL).origin : window.location.origin;
  const isApiRequest = String(url).startsWith('/') || requestUrl.origin === apiOrigin;
  if (token && isApiRequest) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(requestUrl.toString(), {
    ...options,
    headers,
    credentials: options.credentials || 'include',
  });

  if (response.status === 401) {
    const error = { response: { status: 401 }, config: { headers: { Authorization: headers.get('Authorization') } } };
    if (clearExpiredSession(error) && !window.location.pathname.startsWith('/login')) {
      window.location.assign('/login');
    }
    const unauthorized = new Error('Session expired. Please sign in again.');
    unauthorized.status = 401;
    throw unauthorized;
  }

  const contentType = response.headers.get('content-type') || '';
  if (response.ok && (/text\/html/i.test(contentType) || (contentType && !/text\/event-stream/i.test(contentType)))) {
    const error = new Error('The API returned an unexpected non-stream response.');
    error.code = 'API_NON_JSON_RESPONSE';
    throw error;
  }
  return response;
};

export default apiClient;
