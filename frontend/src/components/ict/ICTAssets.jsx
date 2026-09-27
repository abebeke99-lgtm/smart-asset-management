import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  Download,
  Eye,
  History,
  MapPinOff,
  MonitorSmartphone,
  MoreHorizontal,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  ScanLine,
  Search,
  SlidersHorizontal,
  Trash2,
  UserCheck,
  Wrench,
  X,
} from "lucide-react";
import { toast } from "react-toastify";
import apiClient from "../../services/apiClient";
import { useAuth } from "../../contexts/AuthContext";
import "./ICTAssets.css";

const emptyFilters = {
  search: "",
  category: "",
  status: "",
  condition: "",
  department: "",
  location: "",
  assignmentStatus: "",
  sortBy: "updatedAt",
  sortOrder: "DESC",
};
const valueOrDash = (value) =>
  value === null || value === undefined || value === "" ? "—" : value;
const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString() : "—";
const normalize = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[_ ]/g, "-");
const apiErrorMessage = (error) => {
  const status = error.response?.status;
  if (status === 401) return "Session expired. Please sign in again.";
  if (status === 403) return "You do not have permission to view ICT assets.";
  if (status === 404) return "The ICT assets endpoint was not found.";
  if (status === 409) return "The ICT asset request conflicts with existing data.";
  if (status === 422) return "The ICT asset request failed validation.";
  if (status >= 500) return "The server could not load ICT assets.";
  if (!error.response) return "The backend is unavailable. Check the connection and try again.";
  return error.response.data?.message || "Unable to load ICT assets.";
};

const statusClass = (status) => {
  const normalized = normalize(status);
  if (normalized === "available") return "status-available";
  if (normalized === "assigned" || normalized === "in-use")
    return "status-assigned";
  if (normalized === "maintenance" || normalized === "under-maintenance")
    return "status-maintenance";
  if (
    normalized === "missing" ||
    normalized === "faulty" ||
    normalized === "damaged"
  )
    return "status-danger";
  return "status-neutral";
};

const ICTAssets = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canEdit = ["admin", "ict_officer"].includes(
    String(user?.role || "").toLowerCase(),
  );
  const [assets, setAssets] = useState([]);
  const [filters, setFilters] = useState(emptyFilters);
  const [statusTab, setStatusTab] = useState("all");
  const [options, setOptions] = useState({
    categories: [],
    departments: [],
    statuses: [],
    conditions: [],
  });
  const [summary, setSummary] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 25,
    total: 0,
    pages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [openMenu, setOpenMenu] = useState(null);
  const [verifying, setVerifying] = useState(null);
  const [verificationForm, setVerificationForm] = useState({ state: "", notes: "" });
  const [transferTarget, setTransferTarget] = useState(null);
  const [transferForm, setTransferForm] = useState({ departmentId: "", location: "", reason: "" });

  const requestParams = useMemo(
    () =>
      Object.fromEntries(
        Object.entries({
          ...filters,
          statusTab: statusTab === "all" ? "" : statusTab,
          page: pagination.page,
          limit: pagination.limit,
        }).filter(([, value]) => value !== ""),
      ),
    [filters, pagination.page, pagination.limit, statusTab],
  );

  const visibleAssets = assets;
  const hasActiveFilters = statusTab !== "all" || [
    filters.search,
    filters.category,
    filters.status,
    filters.condition,
    filters.department,
    filters.location,
    filters.assignmentStatus,
  ].some(Boolean);

  const summaryCards = useMemo(() => {
    const value = (key) => summary ? Number(summary[key]) : "—";

    return [
      { label: "Total Assets", value: value("total"), icon: Package, tone: "blue" },
      { label: "Assigned", value: value("assigned"), icon: UserCheck, tone: "green" },
      { label: "Available", value: value("available"), icon: CheckCircle2, tone: "teal" },
      { label: "Maintenance", value: value("maintenance"), icon: Wrench, tone: "amber" },
      { label: "Missing", value: value("missing"), icon: AlertTriangle, tone: "red" },
    ];
  }, [summary]);

  const loadAssets = useCallback(async (signal) => {
    setLoading(true);
    setError("");
    try {
      const { data } = await apiClient.get("/api/ict/assets", {
        params: requestParams,
        signal,
      });
      const summaryFields = ["total", "assigned", "available", "maintenance", "missing"];
      const pageCount = data?.pagination?.totalPages ?? data?.pagination?.pages;
      if (
        data?.success !== true ||
        !Array.isArray(data.assets) ||
        !Number.isFinite(Number(data.total)) ||
        !data.summary ||
        !summaryFields.every((field) => Number.isFinite(Number(data.summary[field]))) ||
        !Number.isFinite(Number(data.pagination?.page)) ||
        !Number.isFinite(Number(data.pagination?.limit)) ||
        !Number.isFinite(Number(pageCount))
      ) {
        throw new Error("The ICT assets API returned an invalid response.");
      }
      setAssets(Array.isArray(data?.assets) ? data.assets : []);
      setSummary(data.summary);
      setPagination((current) => ({
        ...current,
        ...(data?.pagination || {}),
        total: Number(data.pagination.total ?? data.total),
        pages: Number(pageCount),
      }));
    } catch (requestError) {
      if (requestError.code === "ERR_CANCELED") return;
      const message = requestError.response
        ? apiErrorMessage(requestError)
        : requestError instanceof Error
          ? requestError.message
          : apiErrorMessage(requestError);
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [requestParams]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(
      () => loadAssets(controller.signal),
      filters.search ? 350 : 0,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [filters.search, loadAssets, requestParams]);

  useEffect(() => {
    apiClient
      .get("/api/ict/assets/options")
      .then(({ data }) =>
        setOptions({
          categories: Array.isArray(data?.categories) ? data.categories : [],
          departments: Array.isArray(data?.departments) ? data.departments : [],
          statuses: Array.isArray(data?.statuses) ? data.statuses : [],
          conditions: Array.isArray(data?.conditions) ? data.conditions : [],
        }),
      )
      .catch(() => toast.error("Unable to load asset filter options."));
  }, []);

  const updateFilter = (name, value) => {
    setFilters((current) => ({ ...current, [name]: value }));
    setPagination((current) => ({ ...current, page: 1 }));
  };

  const openDetails = async (asset) => {
    setOpenMenu(null);
    try {
      const { data } = await apiClient.get(`/api/ict/assets/${asset.id}`);
      setSelected(data?.asset ? {
        ...data.asset,
        maintenance: data.maintenance || [],
        history: data.history || [],
        assignmentHistory: data.assignmentHistory || [],
        transfers: data.transfers || [],
        verification: data.verification || [],
      } : null);
    } catch (requestError) {
      toast.error(
        requestError.response?.data?.message || "Unable to load asset details.",
      );
    }
  };

  const saveAsset = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await apiClient.patch(`/api/ict/assets/${editing.id}`, editing);
      toast.success("Asset updated successfully.");
      setEditing(null);
      await loadAssets();
    } catch (requestError) {
      toast.error(
        requestError.response?.data?.message || "Unable to update asset.",
      );
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (asset, status) => {
    setOpenMenu(null);
    try {
      await apiClient.patch(`/api/ict/assets/${asset.id}`, { status });
      toast.success(`Asset marked as ${status}.`);
      await loadAssets();
    } catch (requestError) {
      toast.error(
        requestError.response?.status === 403
          ? "You do not have permission to change this asset."
          : requestError.response?.data?.message || "Unable to update asset status.",
      );
    }
  };

  const returnAsset = async (asset) => {
    if (!canEdit || !asset.assignmentId) return;
    if (!window.confirm(`Confirm return of ${asset.name || "this asset"}?`)) return;
    setOpenMenu(null);
    try {
      await apiClient.post(`/api/assignments/${asset.assignmentId}/return`, {
        notes: "Returned from ICT asset register",
      });
      toast.success("Asset returned successfully.");
      await loadAssets();
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || "Unable to return this asset.");
    }
  };

  const requestMaintenance = async (asset) => {
    if (!canEdit) return;
    const description = window.prompt(`Describe the maintenance needed for ${asset.name || "this asset"}.`);
    if (description === null || !description.trim()) return;
    setOpenMenu(null);
    try {
      await apiClient.post(`/api/ict/assets/${asset.id}/maintenance`, {
        title: `ICT maintenance: ${asset.name || asset.assetCode || asset.id}`,
        description: description.trim(),
        priority: "medium",
      });
      toast.success("Maintenance request created.");
      await loadAssets();
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || "Unable to create maintenance request.");
    }
  };

  const submitVerification = async (event) => {
    event.preventDefault();
    if (!verifying || !verificationForm.state) return;
    setSaving(true);
    try {
      const sessionResponse = await apiClient.post("/api/ict/verification", {
        name: `Asset verification ${verifying.assetCode || verifying.id} ${new Date().toISOString()}`,
        department_id: verifying.departmentId || undefined,
      });
      const sessionId = sessionResponse.data?.data?.id;
      if (!sessionId) throw new Error("Verification session was not returned by the server.");
      await apiClient.post(`/api/ict/verification/${sessionId}/items`, {
        asset_id: verifying.id,
        state: verificationForm.state,
        notes: verificationForm.notes.trim(),
      });
      await apiClient.post(`/api/ict/verification/${sessionId}/submit`);
      await apiClient.post(`/api/ict/verification/${sessionId}/finalize`);
      toast.success("Asset verification recorded.");
      setVerifying(null);
      setVerificationForm({ state: "", notes: "" });
      await loadAssets();
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || requestError.message || "Unable to record verification.");
    } finally {
      setSaving(false);
    }
  };

  const submitTransfer = async (event) => {
    event.preventDefault();
    if (!transferTarget || !transferForm.departmentId || !transferForm.location.trim() || !transferForm.reason.trim()) return;
    setSaving(true);
    try {
      await apiClient.post("/api/transfers", {
        asset_id: transferTarget.id,
        destination_department_id: Number(transferForm.departmentId),
        new_location: transferForm.location.trim(),
        transfer_reason: transferForm.reason.trim(),
      });
      toast.success("Transfer request created.");
      setTransferTarget(null);
      setTransferForm({ departmentId: "", location: "", reason: "" });
      await loadAssets();
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || "Unable to create transfer request.");
    } finally {
      setSaving(false);
    }
  };

  const deleteAsset = async (asset) => {
    if (!canEdit || !window.confirm(`Retire ${asset.name || "this asset"}?`)) return;
    setOpenMenu(null);
    try {
      await apiClient.patch(`/api/ict/equipment/${asset.id}/retire`, { reason: "Retired from ICT asset register" });
      toast.success("Asset retired successfully.");
      await loadAssets();
    } catch (requestError) {
      toast.error(
        requestError.response?.status === 403
          ? "You do not have permission to dispose assets."
          : requestError.response?.data?.message || "Unable to dispose asset.",
      );
    }
  };

  const exportCsv = async () => {
    if (!pagination.total) {
      toast.info("There are no equipment records to export.");
      return;
    }
    const columns = ["assetCode", "name", "category", "serialNumber", "manufacturer", "model", "department", "location", "assignedTo", "condition", "status", "purchaseDate", "purchasePrice", "updatedAt"];
    const escape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    try {
      const exportAssets = [];
      let page = 1;
      let pageCount = 1;
      while (page <= pageCount) {
        const { data } = await apiClient.get("/api/ict/assets", {
          params: { ...requestParams, page, limit: 100 },
        });
        pageCount = Number(data?.pagination?.totalPages ?? data?.pagination?.pages);
        if (data?.success !== true || !Array.isArray(data.assets) || !Number.isFinite(pageCount)) {
          throw new Error("The ICT assets API returned an invalid export response.");
        }
        exportAssets.push(...data.assets);
        page += 1;
      }
      const rows = exportAssets.map((asset) => columns.map((column) => escape(asset[column])).join(","));
      const csv = [columns.map(escape).join(","), ...rows].join("\n");
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "ict-assets.csv";
      link.click();
      URL.revokeObjectURL(url);
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || "Unable to export ICT assets.");
    }
  };

  if (!user || !["ict_officer", "admin"].includes(user.role)) return null;

  return (
    <main className="ict-assets-page">
      <header className="ict-assets-header">
        <div className="page-heading">
          <div className="heading-icon">
            <MonitorSmartphone size={22} />
          </div>
          <div>
            <p className="eyebrow">ICT ASSETS</p>
            <h1>ICT Assets</h1>
            <p className="subtitle">
              Manage, track, assign, transfer, maintain, and verify university ICT assets.
            </p>
          </div>
        </div>
        <div className="header-actions">
          <button
            className="quiet-button"
            onClick={() => loadAssets()}
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? "spin" : ""} /> Refresh
          </button>
          <button className="quiet-button" onClick={exportCsv} disabled={loading || !assets.length}>
            <Download size={16} /> Export
          </button>
          {canEdit && (
            <button className="primary-button" onClick={() => navigate("/ict/assets/create")}>
              <Plus size={16} /> Add ICT Asset
            </button>
          )}
        </div>
      </header>

      <section className="summary-grid" aria-label="ICT asset summary">
        {summaryCards.map(({ label, value, icon: Icon, tone }) => (
          <article className={`summary-card summary-card--${tone}`} key={label}>
            <div className="summary-card__header">
              <span className="summary-card__icon">
                <Icon size={18} />
              </span>
              <span className="summary-card__label">{label}</span>
            </div>
            <strong className="summary-card__value">{value}</strong>
          </article>
        ))}
      </section>

      <section className="filter-panel">
        <div className="filter-title">
          <SlidersHorizontal size={17} /> Search and filters
        </div>
        <div className="filter-controls">
          <label className="search-field">
            <Search size={17} />
            <input
              value={filters.search}
              onChange={(event) => updateFilter("search", event.target.value)}
              placeholder="Search asset ID, tag, name, serial, brand, model..."
              aria-label="Search ICT assets"
            />
          </label>
          <select
            value={filters.category}
            onChange={(event) => updateFilter("category", event.target.value)}
          >
            <option value="">All categories</option>
            {options.categories.map((item) => (
              <option key={item.id} value={item.name}>
                {item.name}
              </option>
            ))}
          </select>
          <select
            value={filters.status}
            onChange={(event) => updateFilter("status", event.target.value)}
          >
            <option value="">All statuses</option>
            {options.statuses.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select
            value={filters.condition}
            onChange={(event) => updateFilter("condition", event.target.value)}
          >
            <option value="">All conditions</option>
            {options.conditions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select
            value={filters.department}
            onChange={(event) => updateFilter("department", event.target.value)}
          >
            <option value="">All departments</option>
            {options.departments.map((item) => (
              <option key={item.id} value={item.name}>
                {item.name}
              </option>
            ))}
          </select>
          <select
            value={filters.assignmentStatus}
            onChange={(event) =>
              updateFilter("assignmentStatus", event.target.value)
            }
          >
            <option value="">All assignments</option>
            <option value="assigned">Assigned</option>
            <option value="unassigned">Unassigned</option>
          </select>
          <select
            value={filters.sortBy}
            onChange={(event) => updateFilter("sortBy", event.target.value)}
            aria-label="Sort ICT assets by"
          >
            <option value="updatedAt">Sort: recent</option>
            <option value="name">Sort: name</option>
            <option value="assetCode">Sort: asset ID</option>
            <option value="category">Sort: category</option>
            <option value="department">Sort: department</option>
            <option value="location">Sort: location</option>
            <option value="purchaseDate">Sort: purchase date</option>
            <option value="cost">Sort: cost</option>
            <option value="status">Sort: status</option>
          </select>
          <select
            value={filters.sortOrder}
            onChange={(event) => updateFilter("sortOrder", event.target.value)}
            aria-label="Sort direction"
          >
            <option value="DESC">Descending</option>
            <option value="ASC">Ascending</option>
          </select>
          <input
            value={filters.location}
            onChange={(event) => updateFilter("location", event.target.value)}
            placeholder="Location"
            aria-label="Filter by location"
          />
          {Object.values(filters).some((value) => value !== "" && value !== "updatedAt" && value !== "DESC") && (
            <button
              className="link-button"
              onClick={() => {
                setFilters(emptyFilters);
                setPagination((current) => ({ ...current, page: 1 }));
              }}
            >
              Clear filters
            </button>
          )}
        </div>
      </section>

      <div className="asset-tabs" role="tablist" aria-label="Asset status quick filters">
        {[
          { value: "all", label: "All" },
          { value: "assigned", label: "Assigned" },
          { value: "available", label: "Available" },
          { value: "maintenance", label: "Maintenance" },
          { value: "missing", label: "Missing" },
        ].map((tab) => (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={statusTab === tab.value}
            className={`asset-tab${statusTab === tab.value ? " active" : ""}`}
            onClick={() => {
              setStatusTab(tab.value);
              setPagination((current) => ({ ...current, page: 1 }));
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="error-banner">
          <AlertCircle size={18} />
          <span>{error}</span>
          <button className="quiet-button" onClick={() => loadAssets()}>
            Retry
          </button>
        </div>
      )}

      <section className="table-panel">
        <div className="table-heading">
          <div>
            <h2>Asset register</h2>
            <span>{pagination.total} records in your authorized scope</span>
          </div>
          {loading && (
            <RefreshCw className="spin" size={18} aria-label="Loading" />
          )}
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Asset</th>
                <th>Category</th>
                <th>Serial number</th>
                <th>Department</th>
                <th>Location</th>
                <th>Custodian</th>
                <th>Condition</th>
                <th>Status</th>
                <th>Updated</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {loading && !assets.length ? (
                Array.from({ length: 5 }, (_, index) => (
                  <tr className="skeleton-row" key={index}>
                    <td colSpan="10">
                      <span />
                    </td>
                  </tr>
                ))
              ) : error && !assets.length ? (
                <tr>
                  <td colSpan="10" className="empty-cell">
                    The asset register could not be loaded.
                  </td>
                </tr>
              ) : visibleAssets.length > 0 ? (
                visibleAssets.map((asset) => (
                  <tr key={asset.id}>
                    <td>
                      <button
                        className="asset-identity"
                        onClick={() => openDetails(asset)}
                      >
                        <strong>{valueOrDash(asset.name)}</strong>
                        <span>
                          ID: {valueOrDash(asset.id)}
                        </span>
                        <span>Tag: {valueOrDash(asset.assetTag || asset.assetCode)}</span>
                      </button>
                    </td>
                    <td>{valueOrDash(asset.category)}</td>
                    <td>{valueOrDash(asset.serialNumber)}</td>
                    <td>{valueOrDash(asset.department)}</td>
                    <td>{valueOrDash(asset.location)}</td>
                    <td>
                      {asset.assignedTo ? (
                        <span className="person">
                          <CircleUserRound size={15} />
                          {asset.assignedTo}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>{valueOrDash(asset.condition)}</td>
                    <td>
                      <span
                        className={`status-badge ${statusClass(asset.status)}`}
                      >
                        <CheckCircle2 size={13} />
                        {valueOrDash(asset.status)}
                      </span>
                    </td>
                    <td>{formatDate(asset.updatedAt)}</td>
                    <td className="actions">
                      <button
                        className="icon-button"
                        title="More asset actions"
                        aria-label={`More actions for ${asset.name || "asset"}`}
                        onClick={() =>
                          setOpenMenu(openMenu === asset.id ? null : asset.id)
                        }
                      >
                        <MoreHorizontal size={18} />
                      </button>
                      {openMenu === asset.id && (
                        <div className="action-menu">
                          <button onClick={() => openDetails(asset)}>
                            <Eye size={15} /> View details
                          </button>
                          <button
                            disabled={!canEdit}
                            onClick={() => {
                              setOpenMenu(null);
                              setEditing({ ...asset });
                            }}
                          >
                            <Pencil size={15} /> Edit
                          </button>
                          <button
                            disabled={!canEdit}
                            onClick={() => navigate(`/ict/assignments?assetId=${asset.id}`)}
                          >
                            <UserCheck size={15} /> Assign
                          </button>
                          <button onClick={() => navigate("/ict/maintenance")}>
                            <Wrench size={15} /> Maintenance
                          </button>
                          <button
                            disabled={!canEdit}
                            onClick={() => requestMaintenance(asset)}
                          >
                            <Wrench size={15} /> Request maintenance
                          </button>
                          {asset.assignedTo && asset.assignmentId && <button
                            disabled={!canEdit}
                            onClick={() => returnAsset(asset)}
                          >
                            <Package size={15} /> Return asset
                          </button>}
                          <button
                            disabled={!canEdit}
                            onClick={() => {
                              setOpenMenu(null);
                              setVerificationForm({ state: "", notes: "" });
                              setVerifying(asset);
                            }}
                          >
                            <CheckCircle2 size={15} /> Verify asset
                          </button>
                          {normalize(asset.status) !== "lost" && <button
                            disabled={!canEdit}
                            onClick={() => updateStatus(asset, "lost")}
                          >
                            <MapPinOff size={15} /> Mark lost
                          </button>}
                          {canEdit && <button onClick={() => deleteAsset(asset)}>
                            <Trash2 size={15} /> Retire asset
                          </button>}
                          <button
                            onClick={() => navigate(`/ict/asset-history?assetId=${asset.id}`)}
                          >
                            <History size={15} /> View history
                          </button>
                          <button onClick={() => navigate("/ict/rfid")}>
                            <ScanLine size={15} /> RFID / QR
                          </button>
                          <button disabled={!canEdit} onClick={() => {
                            setOpenMenu(null);
                            setTransferForm({ departmentId: "", location: "", reason: "" });
                            setTransferTarget(asset);
                          }}>
                            <ArrowRightLeft size={15} /> Transfer
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="10" className="empty-cell">
                    <div className="empty-icon">
                      <MonitorSmartphone size={22} />
                    </div>
                    <strong>No ICT assets found</strong>
                    <span>
                      {hasActiveFilters
                        ? "Try changing your filters or search terms."
                        : "No ICT assets are available in your authorized scope."}
                    </span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <footer className="pagination">
          <span>
            {pagination.total
              ? `${(pagination.page - 1) * pagination.limit + 1}-${Math.min(pagination.page * pagination.limit, pagination.total)} of ${pagination.total}`
              : "0 records"}
          </span>
          <div className="pagination-controls">
            <label className="rows-per-page">
              <span>Rows per page</span>
              <select
                value={pagination.limit}
                onChange={(event) => {
                  const nextLimit = Number(event.target.value) || 25;
                  setPagination((current) => ({ ...current, limit: nextLimit, page: 1 }));
                }}
                aria-label="Rows per page"
              >
                {[10, 25, 50, 100].map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
            <button
              className="icon-button"
              disabled={pagination.page <= 1 || loading}
              onClick={() =>
                setPagination((current) => ({
                  ...current,
                  page: current.page - 1,
                }))
              }
              aria-label="Previous page"
            >
              <ChevronLeft size={17} />
            </button>
            <span>Page {pagination.page} of {pagination.pages}</span>
            <button
              className="icon-button"
              disabled={pagination.page >= pagination.pages || loading}
              onClick={() =>
                setPagination((current) => ({
                  ...current,
                  page: current.page + 1,
                }))
              }
              aria-label="Next page"
            >
              <ChevronRight size={17} />
            </button>
          </div>
        </footer>
      </section>

      {selected && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setSelected(null)}
        >
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-title">
              <div>
                <p className="eyebrow">ASSET DETAILS</p>
                <h2>{valueOrDash(selected.name)}</h2>
                <span>
                  {valueOrDash(selected.assetTag || selected.assetCode)}
                </span>
              </div>
              <button
                className="icon-button"
                onClick={() => setSelected(null)}
                aria-label="Close"
              >
                <X size={19} />
              </button>
            </div>
            <div className="detail-grid">
              {[
                ["Asset ID", selected.id],
                ["Asset tag", selected.assetTag || selected.assetCode],
                ["Category", selected.category],
                ["Manufacturer", selected.manufacturer],
                ["Model", selected.model],
                ["Serial number", selected.serialNumber],
                ["Status", selected.status],
                ["Condition", selected.condition],
                ["Assigned to", selected.assignedTo],
                ["Department", selected.department],
                ["Location", selected.location],
                ["Purchase date", formatDate(selected.purchaseDate)],
                ["Warranty expiry", formatDate(selected.warrantyExpiry)],
                ["Created", formatDate(selected.createdAt)],
                ["Purchase cost", selected.purchasePrice == null ? "—" : selected.purchasePrice],
                ["Supplier", selected.supplier],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{valueOrDash(value)}</dd>
                </div>
              ))}
            </div>
            <h3>Maintenance</h3>
            {selected.maintenance?.length ? (
              selected.maintenance.map((item) => (
                <p className="history-item" key={item.id}>
                  {valueOrDash(item.title)}{" "}
                  <span>
                    {valueOrDash(item.status)} · {formatDate(item.createdAt)}
                  </span>
                </p>
              ))
            ) : (
              <p className="muted">No maintenance records.</p>
            )}
            <h3>History</h3>
            {selected.history?.length ? (
              selected.history.map((item, index) => (
                <p
                  className="history-item"
                  key={`${item.createdAt || item.date}-${index}`}
                >
                  {valueOrDash(item.action)}{" "}
                  <span>{formatDate(item.createdAt || item.date)}</span>
                </p>
              ))
            ) : (
              <p className="muted">No audit history.</p>
            )}
            <h3>Assignment history</h3>
            {selected.assignmentHistory?.length ? selected.assignmentHistory.map((item) => (
              <p className="history-item" key={`assignment-${item.id}`}>
                {item.status === "returned" ? "Asset returned" : "Asset assigned"}
                <span>{item.User?.fullName || item.User?.username || "Assignment"} · {formatDate(item.updatedAt || item.createdAt)}</span>
              </p>
            )) : <p className="muted">No assignment records.</p>}
            <h3>Transfer history</h3>
            {selected.transfers?.length ? selected.transfers.map((item) => (
              <p className="history-item" key={`transfer-${item.id}`}>
                {valueOrDash(item.status)}: {valueOrDash(item.destinationDepartment)}
                <span>{valueOrDash(item.newLocation)} · {formatDate(item.createdAt)}</span>
              </p>
            )) : <p className="muted">No transfer records.</p>}
            <h3>Verification history</h3>
            {selected.verification?.length ? selected.verification.map((item) => (
              <p className="history-item" key={`verification-${item.id}`}>
                {valueOrDash(item.state)}
                <span>{valueOrDash(item.notes)} · {formatDate(item.updatedAt || item.createdAt)}</span>
              </p>
            )) : <p className="muted">No verification records.</p>}
          </div>
        </div>
      )}
      {editing && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setEditing(null)}
        >
          <form
            className="modal edit-modal"
            onSubmit={saveAsset}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-title">
              <div>
                <p className="eyebrow">ASSET UPDATE</p>
                <h2>Edit ICT asset</h2>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setEditing(null)}
                aria-label="Close"
              >
                <X size={19} />
              </button>
            </div>
            <label>
              Asset code
              <input
                required
                value={editing.assetCode || ""}
                onChange={(event) => setEditing({ ...editing, assetCode: event.target.value })}
              />
            </label>
            <label>
              Asset name
              <input
                required
                value={editing.name || ""}
                onChange={(event) =>
                  setEditing({ ...editing, name: event.target.value })
                }
              />
            </label>
            <label>
              Serial number
              <input
                value={editing.serialNumber || ""}
                onChange={(event) => setEditing({ ...editing, serialNumber: event.target.value })}
              />
            </label>
            <label>
              Category
              <select
                value={editing.category || ""}
                onChange={(event) => setEditing({ ...editing, category: event.target.value })}
              >
                {options.categories.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
              </select>
            </label>
            <label>
              Department
              <select
                value={editing.department || ""}
                onChange={(event) => setEditing({ ...editing, department: event.target.value })}
              >
                {options.departments.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
              </select>
            </label>
            <label>
              Status
              <select
                value={editing.status || ""}
                onChange={(event) =>
                  setEditing({ ...editing, status: event.target.value })
                }
              >
                {options.statuses.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Condition
              <select
                value={editing.condition || ""}
                onChange={(event) =>
                  setEditing({ ...editing, condition: event.target.value })
                }
              >
                {options.conditions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Location
              <input
                value={editing.location || ""}
                onChange={(event) =>
                  setEditing({ ...editing, location: event.target.value })
                }
              />
            </label>
            <label>
              Manufacturer
              <input value={editing.manufacturer || ""} onChange={(event) => setEditing({ ...editing, manufacturer: event.target.value })} />
            </label>
            <label>
              Model
              <input value={editing.model || ""} onChange={(event) => setEditing({ ...editing, model: event.target.value })} />
            </label>
            <label>
              Purchase date
              <input type="date" value={editing.purchaseDate ? String(editing.purchaseDate).slice(0, 10) : ""} onChange={(event) => setEditing({ ...editing, purchaseDate: event.target.value })} />
            </label>
            <label>
              Purchase cost
              <input type="number" min="0" step="0.01" value={editing.purchasePrice ?? ""} onChange={(event) => setEditing({ ...editing, purchasePrice: event.target.value })} />
            </label>
            <label>
              Description
              <textarea
                value={editing.description || ""}
                onChange={(event) =>
                  setEditing({ ...editing, description: event.target.value })
                }
              />
            </label>
            <div className="modal-actions">
              <button
                type="button"
                className="quiet-button"
                onClick={() => setEditing(null)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="primary-button"
                disabled={saving}
              >
                {saving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </form>
        </div>
      )}
      {verifying && (
        <div className="modal-backdrop" role="presentation" onClick={() => !saving && setVerifying(null)}>
          <form className="modal edit-modal" onSubmit={submitVerification} onClick={(event) => event.stopPropagation()}>
            <div className="modal-title">
              <div><p className="eyebrow">ASSET VERIFICATION</p><h2>{verifying.name}</h2></div>
              <button type="button" className="icon-button" onClick={() => setVerifying(null)} aria-label="Close verification"><X size={19} /></button>
            </div>
            <label>
              Verification result
              <select required value={verificationForm.state} onChange={(event) => setVerificationForm({ ...verificationForm, state: event.target.value })}>
                <option value="">Select a result</option>
                <option value="verified">Verified</option>
                <option value="missing">Missing</option>
                <option value="wrong_location">Wrong location</option>
                <option value="damaged">Damaged</option>
                <option value="unidentified">Unidentified</option>
                <option value="needs_review">Needs review</option>
              </select>
            </label>
            <label>
              Notes
              <textarea value={verificationForm.notes} onChange={(event) => setVerificationForm({ ...verificationForm, notes: event.target.value })} maxLength="1000" />
            </label>
            <div className="modal-actions">
              <button type="button" className="quiet-button" onClick={() => setVerifying(null)} disabled={saving}>Cancel</button>
              <button type="submit" className="primary-button" disabled={saving || !verificationForm.state}>{saving ? "Recording..." : "Record verification"}</button>
            </div>
          </form>
        </div>
      )}
      {transferTarget && (
        <div className="modal-backdrop" role="presentation" onClick={() => !saving && setTransferTarget(null)}>
          <form className="modal edit-modal" onSubmit={submitTransfer} onClick={(event) => event.stopPropagation()}>
            <div className="modal-title">
              <div><p className="eyebrow">ASSET TRANSFER</p><h2>{transferTarget.name}</h2></div>
              <button type="button" className="icon-button" onClick={() => setTransferTarget(null)} aria-label="Close transfer"><X size={19} /></button>
            </div>
            <label>
              Destination department
              <select required value={transferForm.departmentId} onChange={(event) => setTransferForm({ ...transferForm, departmentId: event.target.value })}>
                <option value="">Select department</option>
                {options.departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <label>
              Destination location
              <input required value={transferForm.location} onChange={(event) => setTransferForm({ ...transferForm, location: event.target.value })} />
            </label>
            <label>
              Transfer reason
              <textarea required value={transferForm.reason} onChange={(event) => setTransferForm({ ...transferForm, reason: event.target.value })} maxLength="1000" />
            </label>
            <div className="modal-actions">
              <button type="button" className="quiet-button" onClick={() => setTransferTarget(null)} disabled={saving}>Cancel</button>
              <button type="submit" className="primary-button" disabled={saving}>{saving ? "Submitting..." : "Submit transfer request"}</button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
};

export default ICTAssets;
