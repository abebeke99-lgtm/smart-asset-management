import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { apiClient, getApiErrorMessage } from '../utils/api';
import { sanitizeAuthToken } from '../utils/auth';

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
  const aliases = {
    'department head': 'department_head',
    'dept_head': 'department_head',
    'department-head': 'department_head',
    'department': 'department_head',
    'college manager': 'college_manager',
    'college-manager': 'college_manager',
    college_manager: 'college_manager',
    'infrastructure director': 'infrastructure',
    'infrastructure directorate': 'infrastructure',
    'infrastructure_directorate': 'infrastructure',
    'infrastructure-directorate': 'infrastructure',
    'infra': 'infrastructure'
  };
  return aliases[value] || value;
};

const normalizePermissionValue = (permission) => String(permission || '').trim().toLowerCase().replace(/\s+/g, '.').replace(/[_-]+/g, '.').replace(/\.+/g, '.').replace(/^\.|\.$/g, '');

const DEFAULT_ROLE_PERMISSIONS = {};

const normalizeUser = (userData) => {
  if (!userData || typeof userData !== 'object') {
    return userData;
  }

  const department = userData.department;
  const profilePhoto = userData.profilePhoto ?? userData.profile_photo ?? userData.avatar ?? userData.photo_url ?? userData.avatar_url ?? null;
  const role = normalizeRoleValue(userData.role);
  const permissionSource = Array.isArray(userData.permissions)
    ? userData.permissions
    : Array.isArray(userData.rolePermissions)
      ? userData.rolePermissions
      : DEFAULT_ROLE_PERMISSIONS[role] || [];
  const permissions = permissionSource.map(normalizePermissionValue).filter(Boolean);

  return {
    ...userData,
    role,
    permissions,
    department: department && typeof department === 'object'
      ? department.name || department.code || ''
      : department || '',
    profilePhoto: profilePhoto ? String(profilePhoto) : null,
    profile_photo: profilePhoto ? String(profilePhoto) : null,
  };
};

const isExpiredToken = (token) => {
  if (!token) return true;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return !payload.exp || payload.exp * 1000 <= Date.now();
  } catch (error) {
    return true;
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  axios.defaults.timeout = 30000;
  axios.defaults.withCredentials = true;
  axios.defaults.headers.common['Content-Type'] = 'application/json';
  installApiDiagnostics();

  const api = apiClient;

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onUnauthorized = () => {
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      delete axios.defaults.headers.common.Authorization;
      if (window.location.pathname !== '/login') {
        window.location.assign('/login');
      }
    };

    const interceptor = api.interceptors.response.use(
      response => response,
      error => {
        if (error.code === 'ECONNREFUSED' || error.message?.includes('ECONNREFUSED')) {
          const networkError = new Error('Unable to connect to server. Please try again.');
          networkError.code = 'NETWORK_ERROR';
          throw networkError;
        }
        if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
          const networkError = new Error('Unable to connect to server. Please try again.');
          networkError.code = 'NETWORK_ERROR';
          throw networkError;
        }
        if (error.response) {
          if (error.response.status === 401) {
            onUnauthorized();
          }
          const status = error.response.status ? ` (${error.response.status})` : '';
          const apiError = new Error(getApiErrorMessage(error, `Server error occurred${status}`));
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

    return () => api.interceptors.response.eject(interceptor);
  }, [api]);

  const login = async (username, password) => {
    try {
      const response = await api.post('/api/auth/login', { username, password });
      
      if (response.data.success && sanitizeAuthToken(response.data.token)) {
        const userData = normalizeUser(response.data.user);
        setUser(userData);
        localStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('token', sanitizeAuthToken(response.data.token));
        axios.defaults.headers.common.Authorization = `Bearer ${sanitizeAuthToken(response.data.token)}`;
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
              ? err.message || 'Account is deactivated.'
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
    clearStoredAuth();
  };

  const updateUser = (userData) => {
    const nextUser = normalizeUser({ ...user, ...userData });
    setUser(nextUser);
    localStorage.setItem('user', JSON.stringify(nextUser));
  };

  useEffect(() => {
    let mounted = true;
    const restoreSession = async () => {
      const token = sanitizeAuthToken(localStorage.getItem('token'));
      const storedUser = localStorage.getItem('user');

      if (!token || !storedUser || isExpiredToken(token)) {
        clearStoredAuth();
        if (mounted) setLoading(false);
        return;
      }

      try {
        axios.defaults.headers.common.Authorization = `Bearer ${token}`;
        const response = await api.get('/api/users/profile');
        const currentUser = response.data?.data || response.data?.user;
        if (!currentUser) throw new Error('Invalid session response');
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(normalizeUser(currentUser)));
        if (mounted) setUser(normalizeUser(currentUser));
      } catch (error) {
        clearStoredAuth();
        if (mounted) setUser(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    restoreSession();
    return () => { mounted = false; };
  }, [api]);

  useEffect(() => {
    if (!user?.id) return undefined;

    let active = true;
    let refreshing = false;
    const refreshAuthorization = async () => {
      if (refreshing) return;
      refreshing = true;
      try {
        const response = await api.get('/api/users/profile');
        const currentUser = response.data?.data || response.data?.user;
        if (!currentUser) throw new Error('Invalid profile refresh response');
        const normalizedUser = normalizeUser(currentUser);
        if (active) {
          setUser(normalizedUser);
          localStorage.setItem('user', JSON.stringify(normalizedUser));
        }
      } catch (error) {
        if (active && error.response?.status !== 401) {
          console.error('Authorization refresh failed:', error);
        }
      } finally {
        refreshing = false;
      }
    };

    const refreshWhenFocused = () => {
      if (document.visibilityState === 'visible') refreshAuthorization();
    };
    const interval = window.setInterval(refreshWhenFocused, 30000);
    window.addEventListener('focus', refreshWhenFocused);

    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshWhenFocused);
    };
  }, [api, user?.id]);

  const hasRole = (roleToCheck) => {
    const target = normalizeRoleValue(roleToCheck);
    return !!user && normalizeRoleValue(user.role) === target;
  };

  const hasPermission = (permission) => {
    if (!user) return false;
    const normalizedPermission = normalizePermissionValue(permission);
    const permissionSet = new Set((user.permissions || []).map(normalizePermissionValue));
    return permissionSet.has(normalizedPermission) || permissionSet.has('*');
  };

  const canAccessCollege = (collegeId) => {
    if (!user) return false;
    if (!collegeId) return true;
    return Number(user.collegeId) === Number(collegeId) || !user.collegeId || normalizeRoleValue(user.role) !== 'college_manager';
  };

  const value = {
    user,
    login,
    logout,
    updateUser,
    loading,
    isAuthenticated: !!user,
    hasRole,
    hasPermission,
    canAccessCollege,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

const clearStoredAuth = () => {
  localStorage.removeItem('user');
  localStorage.removeItem('token');
  localStorage.removeItem('authToken');
  delete axios.defaults.headers.common.Authorization;
};