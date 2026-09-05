import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { apiClient } from '../utils/api';

let diagnosticsInstalled = false;

const installApiDiagnostics = () => {
  if (diagnosticsInstalled) return;
  diagnosticsInstalled = true;
  axios.interceptors.response.use(
    response => response,
    error => {
      console.error('API request failed', {
        url: error.config?.baseURL ? `${error.config.baseURL}${error.config.url || ''}` : error.config?.url,
        method: error.config?.method?.toUpperCase(),
        status: error.response?.status || 0,
        responseData: error.response?.data,
        message: error.message
      });
      return Promise.reject(error);
    }
  );
};

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);
const normalizeRoleValue = (role) => {
  if (!role) return '';
  const value = String(role).trim().toLowerCase();
  if (['department_head', 'department head', 'dept_head', 'department-head', 'department'].includes(value)) {
    return 'college';
  }
  return value;
};

const normalizeUser = (userData) => {
  if (!userData || typeof userData !== 'object') {
    return userData;
  }

  const department = userData.department;
  return {
    ...userData,
    role: normalizeRoleValue(userData.role),
    department: department && typeof department === 'object'
      ? department.name || department.code || ''
      : department || ''
  };
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  axios.defaults.timeout = 30000;
  axios.defaults.withCredentials = true;
  axios.defaults.headers.common['Content-Type'] = 'application/json';
  installApiDiagnostics();

  const api = apiClient;

  api.interceptors.response.use(
    response => response,
    error => {
      console.error('API Error Details:', {
        message: error.message,
        code: error.code,
        status: error.response?.status,
        data: error.response?.data
      });

      if (error.code === 'ECONNREFUSED' || error.message.includes('ECONNREFUSED')) {
        const networkError = new Error('Unable to connect to server. Please try again.');
        networkError.code = 'NETWORK_ERROR';
        throw networkError;
      }
      if (error.code === 'ERR_NETWORK') {
        const networkError = new Error('Unable to connect to server. Please try again.');
        networkError.code = 'NETWORK_ERROR';
        throw networkError;
      }
      if (error.response) {
        const status = error.response.status ? ` (${error.response.status})` : '';
        const apiError = new Error(error.response.data?.message || `Server error occurred${status}`);
        apiError.status = error.response.status;
        throw apiError;
      }
      if (error.request) {
        const networkError = new Error('Unable to connect to server. Please try again.');
        networkError.code = 'NETWORK_ERROR';
        throw networkError;
      }
      throw error;
    }
  );

  const login = async (username, password) => {
    try {
      const response = await api.post('/api/auth/login', { username, password });
      
      if (response.data.success) {
        const userData = normalizeUser(response.data.user);
        setUser(userData);
        localStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('token', response.data.token);
        axios.defaults.headers.common.Authorization = `Bearer ${response.data.token}`;
        return { success: true, user: userData };
      }
      return { success: false, error: response.data.message || 'Login failed' };
    } catch (err) {
      return { 
        success: false, 
        error: err.code === 'NETWORK_ERROR'
          ? 'Unable to connect to server. Please try again.'
          : err.status === 401
            ? 'Invalid email or password.'
            : err.status === 403
              ? 'This account is disabled.'
              : err.message || 'Unable to connect to server. Please try again.'
      };
    }
  };

  const logout = async () => {
    try {
      if (localStorage.getItem('token')) await api.post('/api/auth/logout');
    } catch (err) {
      console.error('Logout audit request failed:', err);
    }
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    delete axios.defaults.headers.common.Authorization;
  };

  const updateUser = (userData) => {
    const nextUser = normalizeUser({ ...user, ...userData });
    setUser(nextUser);
    localStorage.setItem('user', JSON.stringify(nextUser));
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    
    if (token && storedUser) {
      try {
        setUser(normalizeUser(JSON.parse(storedUser)));
        axios.defaults.headers.common.Authorization = `Bearer ${token}`;
      } catch (err) {
        console.error('Error parsing user data:', err);
        localStorage.removeItem('user');
        localStorage.removeItem('token');
      }
    }
    setLoading(false);
  }, []);

  const value = {
    user,
    login,
    logout,
    updateUser,
    loading,
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};