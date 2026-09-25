import { apiClient } from "../utils/api";

export const pad = (n) => String(Number(n) || 0).padStart(3, "0");
export const cap = (s) => (s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : "");
export const capPriority = (p) => cap(String(p || "").toLowerCase());
export const dateOnly = (iso) => (iso ? String(iso).slice(0, 10) : null);

export const getMaintenance = async (params = {}) => {
  const res = await apiClient.get("/maintenance", { params });
  const body = res.data || {};
  return (body.data || body.requests || []).map(normalizeItem);
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

export const getMaintenanceDashboard = async () => {
  const res = await apiClient.get("/maintenance/dashboard");
  return (res.data || {}).data || {};
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

export const removeMaintenance = async (id) => {
  const res = await apiClient.delete(`/maintenance/${id}`);
  return (res.data || {}).success;
};

export const getAssets = async (params = {}) => {
  const res = await apiClient.get("/assets", { params });
  const body = res.data || {};
  return body.assets || body.data || [];
};

export const getTechnicians = async () => {
  const res = await apiClient.get("/users", { params: { role: "maintenance", active: "true", limit: 100 } });
  const body = res.data || {};
  return body.data || body.users || [];
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

export const getInventory = async () => {
  const res = await apiClient.get("/inventory");
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