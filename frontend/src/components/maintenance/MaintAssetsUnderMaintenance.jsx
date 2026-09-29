import React, { useEffect, useMemo, useState } from "react";
import { apiClient } from "../../utils/api";

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f5f7fb",
    padding: "24px",
    color: "#172033",
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  container: { maxWidth: "1500px", margin: "0 auto" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "20px", marginBottom: "24px", flexWrap: "wrap" },
  title: { margin: 0, fontSize: "28px", fontWeight: 800, color: "#172033" },
  subtitle: { margin: "7px 0 0", color: "#6b7280", fontSize: "14px" },
  refreshButton: { border: "1px solid #d8dee9", background: "#ffffff", color: "#374151", padding: "10px 16px", borderRadius: "9px", cursor: "pointer", fontWeight: 600 },
  cards: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "16px", marginBottom: "22px" },
  card: { background: "#ffffff", border: "1px solid #e5e9f0", borderRadius: "14px", padding: "18px", boxShadow: "0 3px 12px rgba(15, 23, 42, 0.04)" },
  cardLabel: { color: "#6b7280", fontSize: "13px", fontWeight: 600, marginBottom: "9px" },
  cardValue: { fontSize: "28px", fontWeight: 800, color: "#172033" },
  toolbar: { background: "#ffffff", border: "1px solid #e5e9f0", borderRadius: "14px", padding: "16px", marginBottom: "18px", display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" },
  search: { flex: "1 1 280px", minWidth: "240px", border: "1px solid #d9dee8", borderRadius: "9px", padding: "11px 13px", outline: "none", fontSize: "14px", background: "#fff" },
  select: { minWidth: "170px", border: "1px solid #d9dee8", borderRadius: "9px", padding: "11px 13px", outline: "none", fontSize: "14px", background: "#fff", color: "#374151" },
  tableCard: { background: "#ffffff", border: "1px solid #e5e9f0", borderRadius: "14px", overflow: "hidden", boxShadow: "0 3px 12px rgba(15, 23, 42, 0.04)" },
  tableHeader: { padding: "17px 18px", borderBottom: "1px solid #e9edf3", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" },
  tableTitle: { margin: 0, fontSize: "16px", fontWeight: 800 },
  tableWrapper: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", minWidth: "1050px" },
  th: { textAlign: "left", padding: "13px 15px", background: "#f8fafc", borderBottom: "1px solid #e5e9f0", color: "#667085", fontSize: "12px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.03em" },
  td: { padding: "14px 15px", borderBottom: "1px solid #eef1f5", fontSize: "13px", color: "#344054", verticalAlign: "middle" },
  assetName: { fontWeight: 700, color: "#172033" },
  secondary: { display: "block", marginTop: "3px", color: "#8a94a6", fontSize: "12px" },
  badge: { display: "inline-flex", alignItems: "center", padding: "5px 9px", borderRadius: "999px", fontSize: "11px", fontWeight: 800, whiteSpace: "nowrap" },
  actions: { display: "flex", gap: "7px", flexWrap: "wrap" },
  actionButton: { border: "1px solid #d9dee8", background: "#fff", color: "#344054", padding: "7px 10px", borderRadius: "7px", cursor: "pointer", fontSize: "12px", fontWeight: 700 },
  empty: { padding: "45px 20px", textAlign: "center", color: "#7b8494" },
  loading: { padding: "45px 20px", textAlign: "center", color: "#667085" },
  error: { background: "#fff1f2", color: "#b42318", border: "1px solid #fecdd3", borderRadius: "10px", padding: "12px 14px", marginBottom: "16px", fontSize: "13px" },
  modalOverlay: { position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.48)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", zIndex: 1000 },
  modal: { width: "100%", maxWidth: "760px", maxHeight: "90vh", overflowY: "auto", background: "#fff", borderRadius: "16px", boxShadow: "0 20px 60px rgba(15, 23, 42, 0.25)" },
  modalHeader: { padding: "18px 20px", borderBottom: "1px solid #e5e9f0", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" },
  modalTitle: { margin: 0, fontSize: "20px", fontWeight: 800 },
  modalBody: { padding: "20px" },
  detailGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "12px" },
  detail: { background: "#f8fafc", border: "1px solid #edf0f4", borderRadius: "10px", padding: "12px" },
  detailLabel: { display: "block", color: "#8a94a6", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" },
  detailValue: { display: "block", marginTop: "6px", color: "#172033", fontSize: "13px", fontWeight: 700 },
  section: { marginTop: "18px" },
  sectionTitle: { margin: "0 0 12px", fontSize: "16px", color: "#172033" },
  historyItem: { border: "1px solid #edf0f4", borderRadius: "10px", background: "#fafbfc", padding: "12px", marginBottom: "10px" },
  closeButton: { width: "32px", height: "32px", border: "none", borderRadius: "8px", background: "#f2f4f7", color: "#475467", fontSize: "18px", cursor: "pointer" },
};

const normalizeText = (value) => String(value ?? "").trim().toLowerCase();
const getArray = (payload, keys = []) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  for (const key of keys) {
    const value = key.includes(".") ? key.split(".").reduce((obj, part) => obj?.[part], payload) : payload?.[key];
    if (Array.isArray(value)) return value;
  }
  if (payload && typeof payload === "object") {
    const nested = Object.values(payload).find(Array.isArray);
    if (nested) return nested;
  }
  return [];
};
const firstValue = (obj, keys = [], fallback = "—") => {
  if (!obj || typeof obj !== "object") return fallback;
  for (const key of keys) {
    const value = key.includes(".") ? key.split(".").reduce((item, part) => item?.[part], obj) : obj[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return fallback;
};
const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString();
};
const normalizeStatus = (value) => normalizeText(value).replace(/\s+/g, "-");
const getStatusBadge = (status) => {
  const normalized = normalizeText(status);
  if (["completed", "approved", "closed", "resolved", "returned", "ready"].includes(normalized)) return { background: "#dcfce7", color: "#166534" };
  if (["rejected", "cancelled", "canceled", "failed"].includes(normalized)) return { background: "#fff1f3", color: "#c01048" };
  if (["inspection", "testing", "review", "in-progress", "in_progress", "assigned", "scheduled"].includes(normalized)) return { background: "#fffaeb", color: "#b54708" };
  return { background: "#eff8ff", color: "#175cd3" };
};

const normalizeAsset = (asset) => {
  const item = asset || {};
  const assetId = firstValue(item, ["id", "assetId", "asset_id"], "");
  const assetName = firstValue(item, ["name", "assetName", "asset_name"], "Unknown asset");
  const assetCode = firstValue(item, ["assetCode", "asset_code", "code"], "");
  const category = firstValue(item, ["category", "assetCategory", "asset_category"], "General");
  const location = firstValue(item, ["location", "currentLocation", "current_location"], "—");
  const department = firstValue(item, ["department", "departmentName", "department_name"], "—");
  const technician = firstValue(item, ["assignedToName", "assigned_to_name", "technician", "maintainer", "assignedTechnicianName"], "—");
  const status = firstValue(item, ["status", "maintenanceStatus", "maintenance_status"], "—");
  const priority = firstValue(item, ["priority", "maintenancePriority", "maintenance_priority"], "Normal");
  const startedAt = firstValue(item, ["startedAt", "started_at", "createdAt", "created_at", "updatedAt", "updated_at"], null);
  const requestId = firstValue(item, ["requestId", "request_id", "request.id", "maintenanceId", "maintenance_id"], "—");
  const workOrderId = firstValue(item, ["workOrderId", "work_order_id", "workOrder.id"], "—");
  const repairId = firstValue(item, ["repairId", "repair_id", "repair.id"], "—");

  return { ...item, assetId, assetName, assetCode, category, location, department, technician, status, priority, startedAt, requestId, workOrderId, repairId };
};

export default function AssetsUnderMaintenance() {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [selectedAsset, setSelectedAsset] = useState(null);

  const loadData = async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    setError("");

    try {
      const response = await apiClient.get("/maintenance/assets-under-maintenance");
      const rows = getArray(response.data, ["data", "assets", "maintenanceAssets", "assetsUnderMaintenance"]);
      setAssets(rows.map(normalizeAsset));
    } catch (requestError) {
      try {
        const fallback = await apiClient.get("/assets");
        const rows = getArray(fallback.data, ["assets", "data"]);
        setAssets(rows.map(normalizeAsset));
      } catch {
        setAssets([]);
        setError(requestError?.response?.data?.message || requestError?.message || "Unable to load maintenance asset data.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(true);
  }, []);

  const filteredAssets = useMemo(() => {
    const term = normalizeText(search);

    return assets.filter((asset) => {
      const searchable = [asset.assetName, asset.assetCode, asset.category, asset.location, asset.department, asset.technician, asset.status, asset.priority, asset.requestId, asset.workOrderId]
        .join(" ")
        .toLowerCase();

      const matchesSearch = !term || searchable.includes(term);
      const matchesStatus = statusFilter === "all" || normalizeStatus(asset.status) === normalizeStatus(statusFilter);
      const matchesPriority = priorityFilter === "all" || normalizeText(asset.priority) === normalizeText(priorityFilter);

      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [assets, search, statusFilter, priorityFilter]);

  const statusOptions = useMemo(() => [...new Set(assets.map((asset) => asset.status).filter(Boolean))], [assets]);
  const priorityOptions = useMemo(() => [...new Set(assets.map((asset) => asset.priority).filter(Boolean))], [assets]);

  const summary = useMemo(() => {
    const total = assets.length;
    const active = assets.filter((asset) => !["completed", "closed", "returned", "cancelled", "rejected"].includes(normalizeText(asset.status))).length;
    const highPriority = assets.filter((asset) => ["high", "urgent", "critical"].includes(normalizeText(asset.priority))).length;
    const withTechnician = assets.filter((asset) => asset.technician && asset.technician !== "—").length;

    return { total, active, highPriority, withTechnician };
  }, [assets]);

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setPriorityFilter("all");
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>Assets Under Maintenance</h1>
            <p style={styles.subtitle}>Monitor assets currently undergoing maintenance, repair, inspection, testing, or technical review.</p>
          </div>

          <button type="button" style={{ ...styles.refreshButton, opacity: loading ? 0.7 : 1 }} onClick={() => loadData(false)} disabled={loading}>
            {loading ? "Refreshing..." : "↻ Refresh"}
          </button>
        </div>

        {error && <div style={styles.error}>{error}</div>}

        <div style={styles.cards}>
          <div style={styles.card}><div style={styles.cardLabel}>Assets Under Maintenance</div><div style={styles.cardValue}>{summary.total}</div></div>
          <div style={styles.card}><div style={styles.cardLabel}>Active Maintenance</div><div style={styles.cardValue}>{summary.active}</div></div>
          <div style={styles.card}><div style={styles.cardLabel}>High Priority</div><div style={styles.cardValue}>{summary.highPriority}</div></div>
          <div style={styles.card}><div style={styles.cardLabel}>Technician Assigned</div><div style={styles.cardValue}>{summary.withTechnician}</div></div>
        </div>

        <div style={styles.toolbar}>
          <input type="text" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search asset, code, technician, location..." style={styles.search} />
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} style={styles.select}>
            <option value="all">All Statuses</option>
            {statusOptions.map((status) => (
              <option key={String(status)} value={status}>{status}</option>
            ))}
          </select>
          <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)} style={styles.select}>
            <option value="all">All Priorities</option>
            {priorityOptions.map((priority) => (
              <option key={String(priority)} value={priority}>{priority}</option>
            ))}
          </select>
          {(search || statusFilter !== "all" || priorityFilter !== "all") && (
            <button type="button" style={styles.actionButton} onClick={clearFilters}>Clear Filters</button>
          )}
        </div>

        <div style={styles.tableCard}>
          <div style={styles.tableHeader}>
            <h2 style={styles.tableTitle}>Maintenance Assets</h2>
            <span style={{ color: "#667085", fontSize: "13px" }}>Showing {filteredAssets.length} of {assets.length}</span>
          </div>

          {loading ? (
            <div style={styles.loading}>Loading maintenance assets...</div>
          ) : filteredAssets.length === 0 ? (
            <div style={styles.empty}>
              <div style={{ fontSize: "32px", marginBottom: "10px" }}>✓</div>
              <strong>No assets found</strong>
              <div style={{ marginTop: "6px", fontSize: "13px" }}>There are no assets matching the current filters.</div>
            </div>
          ) : (
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Asset</th>
                    <th style={styles.th}>Category</th>
                    <th style={styles.th}>Location</th>
                    <th style={styles.th}>Status</th>
                    <th style={styles.th}>Priority</th>
                    <th style={styles.th}>Technician</th>
                    <th style={styles.th}>Started</th>
                    <th style={styles.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAssets.map((asset, index) => {
                    const badge = getStatusBadge(asset.status);
                    return (
                      <tr key={`${asset.assetId || asset.id || index}`}>
                        <td style={styles.td}><span style={styles.assetName}>{asset.assetName}</span><span style={styles.secondary}>{asset.assetCode || "Unassigned code"}</span></td>
                        <td style={styles.td}>{asset.category}</td>
                        <td style={styles.td}><div>{asset.location}</div>{asset.department !== "—" && <span style={styles.secondary}>{asset.department}</span>}</td>
                        <td style={styles.td}><span style={{ ...styles.badge, background: badge.background, color: badge.color }}>{asset.status}</span></td>
                        <td style={styles.td}>{asset.priority}</td>
                        <td style={styles.td}>{asset.technician}</td>
                        <td style={styles.td}>{formatDate(asset.startedAt)}</td>
                        <td style={styles.td}><div style={styles.actions}><button type="button" style={styles.actionButton} onClick={() => setSelectedAsset(asset)}>View</button></div></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {selectedAsset && (
        <div style={styles.modalOverlay} onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedAsset(null); }}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.modalTitle}>{selectedAsset.assetName}</h2>
                <span style={styles.secondary}>{selectedAsset.assetCode}</span>
              </div>
              <button type="button" style={styles.closeButton} onClick={() => setSelectedAsset(null)}>×</button>
            </div>

            <div style={styles.modalBody}>
              <div style={styles.detailGrid}>
                <div style={styles.detail}><span style={styles.detailLabel}>Asset ID</span><span style={styles.detailValue}>{selectedAsset.assetId}</span></div>
                <div style={styles.detail}><span style={styles.detailLabel}>Asset Code</span><span style={styles.detailValue}>{selectedAsset.assetCode}</span></div>
                <div style={styles.detail}><span style={styles.detailLabel}>Category</span><span style={styles.detailValue}>{selectedAsset.category}</span></div>
                <div style={styles.detail}><span style={styles.detailLabel}>Department</span><span style={styles.detailValue}>{selectedAsset.department}</span></div>
                <div style={styles.detail}><span style={styles.detailLabel}>Location</span><span style={styles.detailValue}>{selectedAsset.location}</span></div>
                <div style={styles.detail}><span style={styles.detailLabel}>Status</span><span style={styles.detailValue}>{selectedAsset.status}</span></div>
                <div style={styles.detail}><span style={styles.detailLabel}>Priority</span><span style={styles.detailValue}>{selectedAsset.priority}</span></div>
                <div style={styles.detail}><span style={styles.detailLabel}>Technician</span><span style={styles.detailValue}>{selectedAsset.technician}</span></div>
                <div style={styles.detail}><span style={styles.detailLabel}>Maintenance Started</span><span style={styles.detailValue}>{formatDate(selectedAsset.startedAt)}</span></div>
                <div style={styles.detail}><span style={styles.detailLabel}>Request ID</span><span style={styles.detailValue}>{selectedAsset.requestId}</span></div>
                <div style={styles.detail}><span style={styles.detailLabel}>Work Order ID</span><span style={styles.detailValue}>{selectedAsset.workOrderId}</span></div>
                <div style={styles.detail}><span style={styles.detailLabel}>Repair ID</span><span style={styles.detailValue}>{selectedAsset.repairId}</span></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
