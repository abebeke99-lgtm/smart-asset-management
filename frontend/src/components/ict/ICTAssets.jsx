import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowRightLeft,
  Boxes,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  Eye,
  History,
  MapPinOff,
  MonitorSmartphone,
  MoreHorizontal,
  PackageCheck,
  Pencil,
  PlusCircle,
  RefreshCw,
  ScanLine,
  Search,
  SlidersHorizontal,
  TriangleAlert,
  UserCheck,
  Wrench,
  X,
  Download,
  Trash2,
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
};
const valueOrDash = (value) =>
  value === null || value === undefined || value === "" ? "—" : value;
const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString() : "—";
const normalize = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[_ ]/g, "-");

const summaryCards = [
  ["total", "Total Equipment", Boxes, "blue"],
  ["available", "Available", PackageCheck, "green"],
  ["assigned", "Assigned", UserCheck, "indigo"],
  ["maintenance", "Maintenance", Wrench, "orange"],
  ["damaged", "Faulty / Damaged", TriangleAlert, "red"],
  ["missing", "Missing", MapPinOff, "red"],
];

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
  const canEdit = ["admin", "ict_officer", "store_manager"].includes(
    String(user?.role || "").toLowerCase(),
  );
  const canDelete = String(user?.role || "").toLowerCase() === "admin";
  const [assets, setAssets] = useState([]);
  const [filters, setFilters] = useState(emptyFilters);
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

  const requestParams = useMemo(
    () =>
      Object.fromEntries(
        Object.entries({
          ...filters,
          page: pagination.page,
          limit: pagination.limit,
        }).filter(([, value]) => value !== ""),
      ),
    [filters, pagination.page, pagination.limit],
  );

  const loadAssets = async (signal) => {
    setLoading(true);
    setError("");
    try {
      const { data } = await apiClient.get("/api/ict/assets", {
        params: requestParams,
        signal,
      });
      setAssets(Array.isArray(data?.assets) ? data.assets : []);
      setSummary(data?.summary || { total: 0 });
      setPagination((current) => ({
        ...current,
        ...(data?.pagination || {}),
        total: Number(data?.total || 0),
      }));
    } catch (requestError) {
      if (requestError.code === "ERR_CANCELED") return;
      const message =
        requestError.response?.data?.message ||
        (requestError.response?.status === 403
          ? "You do not have access to ICT assets in this organization."
          : "Unable to load ICT assets.");
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

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
  }, [requestParams]);

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
      setSelected(data?.asset ? data : null);
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

  const deleteAsset = async (asset) => {
    if (!canDelete || !window.confirm(`Dispose ${asset.name || "this asset"}?`)) return;
    setOpenMenu(null);
    try {
      await apiClient.delete(`/api/assets/${asset.id}`);
      toast.success("Asset disposed successfully.");
      await loadAssets();
    } catch (requestError) {
      toast.error(
        requestError.response?.status === 403
          ? "You do not have permission to dispose assets."
          : requestError.response?.data?.message || "Unable to dispose asset.",
      );
    }
  };

  const exportCsv = () => {
    if (!assets.length) {
      toast.info("There are no equipment records to export.");
      return;
    }
    const columns = ["name", "assetTag", "category", "manufacturer", "model", "serialNumber", "department", "location", "assignedTo", "condition", "status"];
    const escape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const rows = assets.map((asset) => columns.map((column) => escape(asset[column])).join(","));
    const csv = [columns.map(escape).join(","), ...rows].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "ict-equipment.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!user || user.role !== "ict_officer") return null;

  return (
    <main className="ict-assets-page">
      <header className="ict-assets-header">
        <div className="page-heading">
          <div className="heading-icon">
            <MonitorSmartphone size={22} />
          </div>
          <div>
            <p className="eyebrow">ICT OPERATIONS / IT ASSET MANAGEMENT</p>
            <h1>IT Equipment</h1>
            <p className="subtitle">
              Manage ICT computers, peripherals, servers, assignments, locations,
              maintenance, and asset history.
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
            <Download size={16} /> Export CSV
          </button>
          {canEdit && <button
            className="primary-button"
            onClick={() => navigate("/ict/assets/create")}
          >
            <PlusCircle size={17} /> Create Asset
          </button>}
        </div>
      </header>

      <section className="summary-grid" aria-label="ICT asset summary">
        {summaryCards.map(([key, label, Icon, tone]) => (
          <article className={`summary-card ${tone}`} key={key}>
            <div className="summary-card-top">
              <span>{label}</span>
              <span className="summary-icon">
                <Icon size={19} />
              </span>
            </div>
            <strong className={summary ? "" : "skeleton-value"}>
              {summary ? Number(summary[key] || 0) : ""}
            </strong>
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
              placeholder="Search asset number, name, serial, model, user..."
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
          <input
            value={filters.location}
            onChange={(event) => updateFilter("location", event.target.value)}
            placeholder="Location"
            aria-label="Filter by location"
          />
          {Object.values(filters).some(Boolean) && (
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
              ) : assets.length > 0 ? (
                assets.map((asset) => (
                  <tr key={asset.id}>
                    <td>
                      <button
                        className="asset-identity"
                        onClick={() => openDetails(asset)}
                      >
                        <strong>{valueOrDash(asset.name)}</strong>
                        <span>
                          {valueOrDash(asset.assetTag || asset.assetCode)}
                        </span>
                        <small>SN: {valueOrDash(asset.serialNumber)}</small>
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
                            onClick={() => navigate("/ict/assets/assign")}
                          >
                            <UserCheck size={15} /> Assign
                          </button>
                          <button onClick={() => navigate("/ict/maintenance")}>
                            <Wrench size={15} /> Maintenance
                          </button>
                          <button
                            disabled={!canEdit}
                            onClick={() => updateStatus(asset, "maintenance")}
                          >
                            <Wrench size={15} /> Send to maintenance
                          </button>
                          {asset.status !== "lost" && <button
                            disabled={!canEdit}
                            onClick={() => updateStatus(asset, "lost")}
                          >
                            <MapPinOff size={15} /> Mark lost
                          </button>}
                          {canDelete && <button onClick={() => deleteAsset(asset)}>
                            <Trash2 size={15} /> Dispose
                          </button>}
                          <button
                            onClick={() =>
                              navigate(`/ict/assets/${asset.id}/history`)
                            }
                          >
                            <History size={15} /> View history
                          </button>
                          <button onClick={() => navigate("/ict/rfid")}>
                            <ScanLine size={15} /> RFID / QR
                          </button>
                          <button
                            onClick={() => navigate("/ict/assets/assign")}
                          >
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
                      {Object.values(filters).some(Boolean)
                        ? "Try clearing the current filters or search."
                        : "Create your first ICT asset to begin asset management."}
                    </span>
                    {!Object.values(filters).some(Boolean) && (
                      <button
                        className="primary-button"
                        onClick={() => navigate("/ict/assets/create")}
                      >
                        <PlusCircle size={16} /> Create Asset
                      </button>
                    )}
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
          <div>
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
            <span>
              Page {pagination.page} of {Math.max(1, pagination.pages || 1)}
            </span>
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
    </main>
  );
};

export default ICTAssets;
