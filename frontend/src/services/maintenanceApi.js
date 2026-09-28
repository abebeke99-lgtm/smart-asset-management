import { apiClient } from "../utils/api";

export const pad = (n) => String(Number(n) || 0).padStart(3, "0");
export const cap = (s) => (s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : "");
export const capPriority = (p) => cap(String(p || "").toLowerCase());
export const dateOnly = (iso) => (iso ? String(iso).slice(0, 10) : null);

export const getMaintenance = async (params = {}) => {
  const result = await getMaintenancePage(params);
  return result.items;
};

export const getMaintenanceTests = async (params = {}) => {
  const res = await apiClient.get('/maintenance/testing', { params });
  const body = res.data || {};
  return {
    items: body.data || [],
    summary: body.summary || { total: 0, pending: 0, inTesting: 0, passed: 0, failed: 0, retestRequired: 0, awaitingQualityControl: 0, returnedToService: 0, overdue: 0 },
    pagination: body.pagination || { page: 1, limit: 25, total: 0, pages: 1 },
  };
};

export const getMaintenanceTestOptions = async () => {
  const res = await apiClient.get('/maintenance/testing/options');
  return res.data?.data || { maintenance: [], testers: [] };
};

export const createMaintenanceTest = async (payload) => {
  const res = await apiClient.post('/maintenance/testing', payload);
  return res.data?.data || null;
};

export const startMaintenanceTest = async (id) => {
  const res = await apiClient.patch(`/maintenance/testing/${id}/start`);
  return res.data?.data || null;
};

export const completeMaintenanceTest = async (id, payload) => {
  const res = await apiClient.patch(`/maintenance/testing/${id}/complete`, payload);
  return res.data?.data || null;
};

export const sendMaintenanceTestToQC = async (id) => {
  const res = await apiClient.patch(`/maintenance/testing/${id}/send-to-qc`);
  return res.data?.data || null;
};

export const reviewMaintenanceTestQuality = async (id, payload) => {
  const res = await apiClient.patch(`/maintenance/testing/${id}/quality`, payload);
  return res.data?.data || null;
};

export const returnMaintenanceTestToService = async (id) => {
  const res = await apiClient.patch(`/maintenance/testing/${id}/return-to-service`);
  return res.data?.data || null;
};

export const getMaintenanceCalendar = async (params = {}) => {
  const res = await apiClient.get('/maintenance/calendar', { params });
  const body = res.data || {};
  return {
    items: body.data || [],
    summary: body.summary || { total: 0 },
  };
};

export const getMaintenancePage = async (params = {}) => {
  const res = await apiClient.get("/maintenance", { params });
  const body = res.data || {};
  return {
    items: (body.data || body.requests || []).map(normalizeItem),
    pagination: body.pagination || { page: 1, limit: 10, total: body.total || 0, pages: 1 },
  };
};

export const getRepairHistory = async (params = {}) => {
  const res = await apiClient.get('/maintenance/repairs', { params });
  return res.data || {};
};

export const getRepairDetails = async (id) => {
  const res = await apiClient.get(`/maintenance/repairs/${id}`);
  return res.data?.data;
};

export const createRepair = async (payload) => {
  const res = await apiClient.post('/maintenance/repairs', payload);
  return res.data?.data;
};

export const updateRepair = async (id, payload) => {
  const res = await apiClient.put(`/maintenance/repairs/${id}`, payload);
  return res.data?.data;
};

export const getMaintenanceDashboard = async (period) => {
  const res = await apiClient.get("/maintenance/dashboard", { params: period ? { period } : {} });
  if (!res.data?.success || !res.data.data) {
    throw new Error('Maintenance dashboard response was incomplete');
  }
  return res.data.data;
};

export const getMaintenanceReportsSummary = async (params = {}) => {
  const res = await apiClient.get('/maintenance/reports/summary', { params });
  const payload = res.data || {};
  return payload.data || { summary: {}, activity: [], workOrders: [], repairs: [], preventive: [], assets: [], technicians: [], vendors: [], testing: [], downtime: { totalDowntimeHours: 0, rows: [] } };
};

export const getAssetsUnderMaintenance = async (params = {}) => {
  const res = await apiClient.get('/maintenance/assets-under-maintenance', { params });
  const payload = res.data || {};
  return {
    items: payload.data || [],
    summary: payload.summary || {},
    pagination: payload.pagination || { page: 1, limit: 25, total: 0, pages: 1 },
  };
};

export const getAssetMaintenanceDetail = async (id) => {
  const res = await apiClient.get(`/maintenance/assets-under-maintenance/${id}`);
  return (res.data || {}).data || null;
};

export const getMaintenanceHistory = async (params = {}) => {
  const res = await apiClient.get('/maintenance/history', { params });
  const body = res.data || {};
  return { items: body.data || [], pagination: body.pagination || {} };
};

export const getQualityControlReviews = async (params = {}) => {
  const res = await apiClient.get('/maintenance/quality-control', { params });
  const body = res.data || {};
  return {
    items: body.data || [],
    summary: body.summary || { pending: 0, inReview: 0, approved: 0, rejected: 0, conditionalApproval: 0, retestRequired: 0, readyForReturn: 0, overdueReviews: 0 },
    pagination: body.pagination || { page: 1, limit: 25, total: 0, pages: 1 },
  };
};

export const getQualityControlReview = async (id) => {
  const res = await apiClient.get(`/maintenance/quality-control/${id}`);
  return res.data?.data || null;
};

export const startQualityControlReview = async (id) => {
  const res = await apiClient.patch(`/maintenance/quality-control/${id}/start`);
  return res.data?.data || null;
};

export const submitQualityControlDecision = async (id, payload) => {
  const res = await apiClient.patch(`/maintenance/quality-control/${id}/decision`, payload);
  return res.data?.data || null;
};

export const approveQualityControlReview = async (id) => {
  const res = await apiClient.patch(`/maintenance/quality-control/${id}/approve`);
  return res.data?.data || null;
};

export const rejectQualityControlReview = async (id, payload = {}) => {
  const res = await apiClient.patch(`/maintenance/quality-control/${id}/reject`, payload);
  return res.data?.data || null;
};

export const retestQualityControlReview = async (id, payload = {}) => {
  const res = await apiClient.patch(`/maintenance/quality-control/${id}/retest`, payload);
  return res.data?.data || null;
};

export const createMaintenance = async (payload) => {
  const res = await apiClient.post("/maintenance", payload);
  return (res.data || {}).data;
};

export const updateMaintenance = async (id, payload) => {
  const res = await apiClient.put(`/maintenance/${id}`, payload);
  return (res.data || {}).data;
};

export const setMaintenanceStatus = async (id, status, extra = {}) => {
  const res = await apiClient.patch(`/maintenance/${id}/status`, { status, ...extra });
  return (res.data || {}).data;
};

export const assignMaintenance = async (id, technicianId) => {
  const res = await apiClient.post(`/maintenance/${id}/reassign`, { technician_id: Number(technicianId) });
  return (res.data || {}).data;
};

export const removeMaintenance = async (id) => {
  const res = await apiClient.delete(`/maintenance/${id}`);
  return (res.data || {}).success;
};

export const getAssets = async (params = {}) => {
  const result = await getAssetsPage(params);
  return result.items;
};

export const getAssetsPage = async (params = {}) => {
  const res = await apiClient.get("/assets", { params });
  const body = res.data || {};
  return {
    items: body.assets || body.data || [],
    pagination: body.pagination || { page: 1, limit: 10, total: body.total || 0, pages: 1 },
  };
};

export const getInspectionsPage = async (params = {}) => {
  const res = await apiClient.get('/maintenance/inspections', { params });
  const body = res.data || {};
  return { items: body.data || [], summary: body.summary || {}, pagination: body.pagination || {} };
};

export const getInspection = async (id) => {
  const res = await apiClient.get(`/maintenance/inspections/${id}`);
  return { inspection: res.data?.data, history: res.data?.history || [] };
};

export const getInspectionOptions = async (params = {}) => {
  const res = await apiClient.get('/maintenance/inspections/options', { params });
  return res.data?.data || { assets: [], inspectors: [], maintenance: [], workOrders: [] };
};

export const createInspection = async (payload) => {
  const res = await apiClient.post('/maintenance/inspections', payload);
  return res.data?.data;
};

export const updateInspection = async (id, payload) => {
  const res = await apiClient.put(`/maintenance/inspections/${id}`, payload);
  return res.data?.data;
};

export const deleteInspection = async (id) => {
  const res = await apiClient.delete(`/maintenance/inspections/${id}`);
  return Boolean(res.data?.success);
};

export const getTechnicians = async () => {
  const res = await apiClient.get("/users", { params: { role: "maintenance", active: "true", limit: 100 } });
  const body = res.data || {};
  return body.data || body.users || [];
};

export const getTechnicianDirectory = async (params = {}) => {
  const res = await apiClient.get('/maintenance/technicians', { params });
  const body = res.data || {};
  return {
    summary: body.summary || { totalTechnicians: 0, available: 0, assigned: 0, onLeave: 0, overloaded: 0, activeWorkOrders: 0, overdueTasks: 0 },
    items: body.data || [],
    filters: body.filters || {},
    pagination: body.pagination || { page: 1, limit: 25, total: 0, pages: 1 },
  };
};

export const getNotifications = async () => {
  const res = await apiClient.get("/notifications");
  return (res.data || {}).notifications || [];
};

export const getUnreadCount = async () => {
  const res = await apiClient.get("/notifications");
  return (res.data || {}).unreadCount || 0;
};

export const markNotificationRead = async (id) => {
  await apiClient.put(`/notifications/${id}/read`);
};

export const markAllNotificationsRead = async () => {
  const res = await apiClient.put("/notifications/read-all");
  return (res.data || {}).unreadCount || 0;
};

export const deleteNotification = async (id) => {
  await apiClient.delete(`/notifications/${id}`);
};

export const getSpareParts = async (params = {}) => {
  const res = await apiClient.get('/maintenance/spare-parts', { params });
  const body = res.data || {};
  return {
    items: body.data || [],
    summary: body.summary || {},
    pagination: body.pagination || {},
  };
};

export const getSparePartDetail = async (id) => {
  const res = await apiClient.get(`/maintenance/spare-parts/${id}`);
  return (res.data || {}).data || null;
};

export const getInventory = async () => {
  const res = await apiClient.get('/maintenance/spare-parts');
  return (res.data || {}).data || [];
};

export const normalizeItem = (r) => ({
  id: r.id,
  assetId: r.asset_id,
  refId: `REQ-${pad(r.id)}`,
  woId: `WO-${pad(r.id)}`,
  repairId: `REP-${pad(r.id)}`,
  mntId: `MNT-${pad(r.id)}`,
  asset: r.asset_name || (r.asset && r.asset.name) || "—",
  assetTag: r.asset_tag || (r.asset && r.asset.assetCode) || "",
  department: (r.asset && r.asset.department) || "",
  requester: r.requested_by_name || "—",
  title: r.title || "",
  problem: r.description || r.title || "",
  priority: capPriority(r.priority),
  statusRaw: String(r.status || "").toLowerCase(),
  status: r.status || String(r.status || ""),
  technician: r.assigned_to_name || "",
  created: r.created_at || r.createdAt,
  updated: r.updated_at || r.updatedAt,
});

export const observe = (fn, setValue, setError) => {
  fn()
    .then(setValue)
    .catch((err) => {
      if (setError) setError(err && err.message ? err.message : "Request failed");
    });
};