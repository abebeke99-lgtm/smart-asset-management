import axios from 'axios';

// Helper to resolve API base URL used across the app.
export function apiBase() {
  const configuredApiUrl = process.env.REACT_APP_API_URL;
  if (configuredApiUrl && configuredApiUrl.trim()) {
    return configuredApiUrl.trim().replace(/\/+$/, '').replace(/\/api$/, '');
  }
  // In development prefer relative URLs so CRA's `proxy` forwards requests to backend-next
  if (typeof window !== 'undefined' && window.location && window.location.hostname === 'localhost') {
    // Use same protocol as the page (avoid mixed-content blocks when frontend runs on https)
    const proto = (window.location.protocol || 'http:');
    return `${proto}//${window.location.hostname}:5000`;
  }
  return '';
}

export const apiClient = axios.create({
  baseURL: apiBase(),
  timeout: Number(process.env.REACT_APP_API_TIMEOUT) || 30000,
  headers: { 'Content-Type': 'application/json' }
});

// Request interceptor - add token to all requests
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor - handle auth errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      // Clear auth data and redirect to login
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);
