import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiClient, getApiErrorMessage, isCurrentAuthRequest, SESSION_EXPIRED_EVENT, SESSION_EXPIRED_STORAGE_KEY } from '../utils/api';
import { sanitizeAuthToken } from '../utils/auth';

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

const decodeTokenPayload = (token) => {
  try {
    const encoded = token.split('.')[1];
    if (!encoded) return null;
    const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    return JSON.parse(atob(padded));
  } catch (error) {
    return null;
  }
};

const isExpiredToken = (token) => {
  const payload = token ? decodeTokenPayload(token) : null;
  return !payload?.exp || payload.exp * 1000 <= Date.now();
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [firstLoginUser, setFirstLoginUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const api = apiClient;

  useEffect(() => {
    if (!api?.interceptors?.response?.use) return undefined;

    const handleResponseError = (error) => {
      if (error?.response?.status === 401 && isCurrentAuthRequest(error)) {
        localStorage.removeItem('token');
        localStorage.removeItem('authToken');
        localStorage.removeItem('accessToken');
        localStorage.removeItem('user');
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(SESSION_EXPIRED_STORAGE_KEY, 'true');
          window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
        }
      }

      if (error?.response) {
        const fallbackMessage = `Server error occurred (${error.response.status})`;
        error.status = error.response.status;
        error.message = getApiErrorMessage(error, fallbackMessage) || fallbackMessage;
      }

      throw error;
    };

    const interceptorId = api.interceptors.response.use((response) => response, handleResponseError);

    return () => {
      if (interceptorId !== undefined && api.interceptors.response.eject) {
        api.interceptors.response.eject(interceptorId);
      }
    };
  }, [api]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onUnauthorized = () => {
      clearStoredAuth();
      setFirstLoginUser(null);
      setUser(null);
    };

    window.addEventListener(SESSION_EXPIRED_EVENT, onUnauthorized);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onUnauthorized);
  }, []);

  const login = async (username, password) => {
    try {
      const response = await api.post('/api/auth/login', { username, password });
      
      if (response.data.success && sanitizeAuthToken(response.data.token)) {
        const token = sanitizeAuthToken(response.data.token);
        const userData = normalizeUser(response.data.user);
        localStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('token', token);
        sessionStorage.removeItem(SESSION_EXPIRED_STORAGE_KEY);
        if (response.data.requiresFirstLogin) {
          setUser(null);
          setFirstLoginUser(userData);
          return { success: true, requiresFirstLogin: true, user: userData };
        }
        setFirstLoginUser(null);
        setUser(userData);
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
              : err.status >= 500
                ? 'Unable to complete login. Please try again later.'
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
    setFirstLoginUser(null);
    clearStoredAuth();
  };

  const completeFirstLogin = (session) => {
    const token = sanitizeAuthToken(session?.token);
    const userData = normalizeUser(session?.user);
    if (!token || !userData) throw new Error('The server returned an invalid session.');
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    sessionStorage.removeItem(SESSION_EXPIRED_STORAGE_KEY);
    setUser(userData);
    setFirstLoginUser(null);
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
        const claims = decodeTokenPayload(token);
        if (claims.scope === 'first_login') {
          const pendingUser = normalizeUser(JSON.parse(storedUser));
          if (mounted) {
            setUser(null);
            setFirstLoginUser(pendingUser);
          }
          return;
        }
        const response = await api.get('/api/users/profile');
        if (sanitizeAuthToken(localStorage.getItem('token')) !== token) return;
        const currentUser = response.data?.data || response.data?.user;
        if (!currentUser) throw new Error('Invalid session response');
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(normalizeUser(currentUser)));
        if (mounted) setUser(normalizeUser(currentUser));
      } catch (error) {
        const currentToken = sanitizeAuthToken(localStorage.getItem('token'));
        if (currentToken === token) {
          clearStoredAuth();
          if (mounted) {
            setUser(null);
            setFirstLoginUser(null);
          }
        }
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
    firstLoginUser,
    login,
    completeFirstLogin,
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
  localStorage.removeItem('accessToken');
};