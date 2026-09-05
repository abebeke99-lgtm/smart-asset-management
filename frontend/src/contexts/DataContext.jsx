import React, { createContext, useState, useContext, useCallback } from 'react';
import { toast } from 'react-toastify';
import { apiClient } from '../utils/api';

// Create Data Context
const DataContext = createContext();

// Data Provider Component
export const DataProvider = ({ children }) => {
  const [loading, setLoading] = useState(false);
  const [assets, setAssets] = useState([]);
  const [maintenanceRequests, setMaintenanceRequests] = useState([]);
  const [rfidLogs, setRfidLogs] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [users, setUsers] = useState([]);

  // ==========================================
  // API CALL WRAPPER
  // ==========================================
  
  const apiCall = useCallback(async (method, url, data = null, options = {}) => {
    setLoading(true);
    try {
      const config = { ...options };
      let response;
      switch (method.toLowerCase()) {
        case 'get':
          response = await apiClient.get(url, config);
          break;
        case 'post':
          response = await apiClient.post(url, data, config);
          break;
        case 'put':
          response = await apiClient.put(url, data, config);
          break;
        case 'delete':
          response = await apiClient.delete(url, config);
          break;
        default:
          throw new Error('Invalid method');
      }
      return { success: true, data: response.data };
    } catch (error) {
      const message = error.response?.data?.message || 'An error occurred';
      toast.error(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  }, []);

  // ==========================================
  // ASSET FUNCTIONS
  // ==========================================

  const getAssets = useCallback(async (params = {}) => {
    const result = await apiCall('get', '/api/assets', null, { params });
    if (result.success) {
      setAssets(result.data.assets || []);
    }
    return result;
  }, [apiCall]);

  const getAsset = useCallback(async (id) => {
    return await apiCall('get', `/api/assets/${id}`);
  }, [apiCall]);

  const createAsset = useCallback(async (data) => {
    const result = await apiCall('post', '/api/assets', data);
    if (result.success) {
      await getAssets();
      toast.success('Asset created successfully!');
    }
    return result;
  }, [apiCall, getAssets]);

  const updateAsset = useCallback(async (id, data) => {
    const result = await apiCall('put', `/api/assets/${id}`, data);
    if (result.success) {
      await getAssets();
      toast.success('Asset updated successfully!');
    }
    return result;
  }, [apiCall, getAssets]);

  const deleteAsset = useCallback(async (id) => {
    const result = await apiCall('delete', `/api/assets/${id}`);
    if (result.success) {
      await getAssets();
      toast.success('Asset deleted successfully!');
    }
    return result;
  }, [apiCall, getAssets]);

  const assignAsset = useCallback(async (id, data) => {
    const result = await apiCall('post', '/api/assignments', { ...data, asset_id: id });
    if (result.success) {
      await getAssets();
    }
    return result;
  }, [apiCall, getAssets]);

  const returnAsset = useCallback(async (id) => {
    const result = await apiCall('post', `/api/assets/${id}/return`);
    if (result.success) {
      await getAssets();
    }
    return result;
  }, [apiCall, getAssets]);

  // ==========================================
  // MAINTENANCE FUNCTIONS
  // ==========================================

  const getMaintenanceRequests = useCallback(async (params = {}) => {
    const result = await apiCall('get', '/api/maintenance', null, { params });
    if (result.success) {
      setMaintenanceRequests(result.data.requests || []);
    }
    return result;
  }, [apiCall]);

  const createMaintenanceRequest = useCallback(async (data) => {
    const result = await apiCall('post', '/api/maintenance', data);
    if (result.success) {
      await getMaintenanceRequests();
      toast.success('Maintenance request created!');
    }
    return result;
  }, [apiCall, getMaintenanceRequests]);

  const approveMaintenance = useCallback(async (id) => {
    const result = await apiCall('put', `/api/maintenance/${id}/approve`);
    if (result.success) {
      await getMaintenanceRequests();
      toast.success('Maintenance request approved!');
    }
    return result;
  }, [apiCall, getMaintenanceRequests]);

  const completeMaintenance = useCallback(async (id, data) => {
    const result = await apiCall('put', `/api/maintenance/${id}/complete`, data);
    if (result.success) {
      await getMaintenanceRequests();
      toast.success('Maintenance completed!');
    }
    return result;
  }, [apiCall, getMaintenanceRequests]);

  // ==========================================
  // RFID FUNCTIONS
  // ==========================================

  const getRFIDLogs = useCallback(async (params = {}) => {
    const result = await apiCall('get', '/api/rfid', null, { params });
    if (result.success) {
      setRfidLogs(result.data.logs || []);
    }
    return result;
  }, [apiCall]);

  const registerRFIDTag = useCallback(async (data) => {
    return await apiCall('post', '/api/rfid/register', data);
  }, [apiCall]);

  const logRFIDScan = useCallback(async (data) => {
    return await apiCall('post', '/api/rfid/scan', data);
  }, [apiCall]);

  // ==========================================
  // NOTIFICATION FUNCTIONS
  // ==========================================

  const getNotifications = useCallback(async () => {
    const result = await apiCall('get', '/api/notifications');
    if (result.success) {
      setNotifications(result.data.notifications || []);
    }
    return result;
  }, [apiCall]);

  const markNotificationRead = useCallback(async (id) => {
    const result = await apiCall('put', `/api/notifications/${id}/read`);
    if (result.success) {
      await getNotifications();
    }
    return result;
  }, [apiCall, getNotifications]);

  const markAllNotificationsRead = useCallback(async () => {
    const result = await apiCall('put', '/api/notifications/read-all');
    if (result.success) {
      await getNotifications();
      toast.success('All notifications marked as read');
    }
    return result;
  }, [apiCall, getNotifications]);

  // ==========================================
  // DEPARTMENT FUNCTIONS
  // ==========================================

  const getDepartments = useCallback(async () => {
    const result = await apiCall('get', '/api/departments');
    if (result.success) {
      setDepartments(result.data.departments || []);
    }
    return result;
  }, [apiCall]);

  const createDepartment = useCallback(async (data) => {
    const result = await apiCall('post', '/api/departments', data);
    if (result.success) {
      await getDepartments();
      toast.success('Department created!');
    }
    return result;
  }, [apiCall, getDepartments]);

  const deleteDepartment = useCallback(async (id) => {
    const result = await apiCall('delete', `/api/departments/${id}`);
    if (result.success) {
      await getDepartments();
      toast.success('Department deleted!');
    }
    return result;
  }, [apiCall, getDepartments]);

  // ==========================================
  // CATEGORY FUNCTIONS
  // ==========================================

  const getCategories = useCallback(async () => {
    const result = await apiCall('get', '/api/categories');
    if (result.success) {
      setCategories(result.data.categories || []);
    }
    return result;
  }, [apiCall]);

  // ==========================================
  // USER FUNCTIONS
  // ==========================================

  const getUsers = useCallback(async (params = {}) => {
    const result = await apiCall('get', '/api/users', null, { params });
    if (result.success) {
      setUsers(result.data.users || []);
    }
    return result;
  }, [apiCall]);

  const toggleUserActive = useCallback(async (id, isActive) => {
    const result = await apiCall('put', `/api/users/${id}/toggle-active`, { isActive });
    if (result.success) {
      await getUsers();
      toast.success('User status updated!');
    }
    return result;
  }, [apiCall, getUsers]);

  const deleteUser = useCallback(async (id) => {
    const result = await apiCall('delete', `/api/users/${id}`);
    if (result.success) {
      await getUsers();
      toast.success('User deleted!');
    }
    return result;
  }, [apiCall, getUsers]);

  // ==========================================
  // CONTEXT VALUE
  // ==========================================

  const value = {
    // State
    loading,
    assets,
    maintenanceRequests,
    rfidLogs,
    notifications,
    departments,
    categories,
    users,

    // Asset functions
    getAssets,
    getAsset,
    createAsset,
    updateAsset,
    deleteAsset,
    assignAsset,
    returnAsset,

    // Maintenance functions
    getMaintenanceRequests,
    createMaintenanceRequest,
    approveMaintenance,
    completeMaintenance,

    // RFID functions
    getRFIDLogs,
    registerRFIDTag,
    logRFIDScan,

    // Notification functions
    getNotifications,
    markNotificationRead,
    markAllNotificationsRead,

    // Department functions
    getDepartments,
    createDepartment,
    deleteDepartment,

    // Category functions
    getCategories,

    // User functions
    getUsers,
    toggleUserActive,
    deleteUser,

    // Utility
    apiCall
  };

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
};

// Custom hook to use Data Context
export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};

export default DataContext;