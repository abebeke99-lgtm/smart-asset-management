import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Eye,
  Filter,
  Loader2,
  MapPin,
  Package,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Tag,
  Truck,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../services/api";

const InfrastructureAssets = () => {
  const navigate = useNavigate();

  const [assets, setAssets] = useState([]);
  const [summary, setSummary] = useState(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("all");
  const [location, setLocation] = useState("all");

  const [showFilters, setShowFilters] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);

  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);

  const loadAssets = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");

        const response = await api.get("/infrastructure/", {
          params: {
            search: search.trim() || undefined,
            status: status !== "all" ? status : undefined,
            category: category !== "all" ? category : undefined,
            location: location !== "all" ? location : undefined,
            page,
            limit: pageSize,
          },
        });

        const responseData = response?.data?.data ?? response?.data ?? {};

        let rows = [];

        if (Array.isArray(responseData)) {
          rows = responseData;
        } else if (Array.isArray(responseData.assets)) {
          rows = responseData.assets;
        } else if (Array.isArray(responseData.rows)) {
          rows = responseData.rows;
        } else if (Array.isArray(response?.data?.assets)) {
          rows = response.data.assets;
        }

        setAssets(rows);

        setSummary({
          total:
            Number(
              responseData.total ??
                responseData.totalAssets ??
                response?.data?.total ??
                rows.length
            ) || 0,

          operational:
            Number(
              responseData.operational ??
                responseData.operationalAssets
            ) || 0,

          maintenance:
            Number(
              responseData.maintenance ??
                responseData.underMaintenance
            ) || 0,

          critical:
            Number(
              responseData.critical ??
                responseData.criticalAssets
            ) || 0,

          missing:
            Number(responseData.missing) || 0,
        });
      } catch (err) {
        console.error("Infrastructure assets error:", err);

        setError(
          err?.response?.data?.message ||
            err?.response?.data?.error ||
            "Unable to load infrastructure assets."
        );

        setAssets([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [search, status, category, location, page, pageSize]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      loadAssets();
    }, 300);

    return () => clearTimeout(timer);
  }, [loadAssets]);

  useEffect(() => {
    setPage(1);
  }, [search, status, category, location]);

  const getValue = (asset, fields, fallback = "") => {
    for (const field of fields) {
      if (
        asset?.[field] !== undefined &&
        asset?.[field] !== null &&
        asset?.[field] !== ""
      ) {
        return asset[field];
      }
    }

    return fallback;
  };

  const getAssetName = (asset) =>
    getValue(
      asset,
      ["name", "asset_name", "assetName", "description"],
      "Unnamed Asset"
    );

  const getAssetTag = (asset) =>
    getValue(
      asset,
      ["asset_tag", "assetTag", "tag", "asset_code", "assetCode"],
      "—"
    );

  const getCategory = (asset) =>
    getValue(
      asset,
      [
        "category",
        "asset_category",
        "assetCategory",
        "category_name",
        "categoryName",
        "type",
        "asset_type",
      ],
      "Uncategorized"
    );

  const getLocation = (asset) =>
    getValue(
      asset,
      [
        "location",
        "location_name",
        "locationName",
        "building",
        "facility",
        "room",
      ],
      "Not assigned"
    );

  const getStatus = (asset) =>
    getValue(asset, ["status", "asset_status", "assetStatus"], "Unknown");

  const getSerial = (asset) =>
    getValue(
      asset,
      ["serial_number", "serialNumber", "serial_no", "serialNo"],
      ""
    );

  const getAssignedTo = (asset) =>
    getValue(
      asset,
      [
        "assigned_to",
        "assignedTo",
        "assigned_name",
        "assignedName",
        "custodian",
      ],
      ""
    );

  const categories = useMemo(() => {
    const values = assets
      .map((asset) => getCategory(asset))
      .filter(Boolean);

    return [...new Set(values)].sort();
  }, [assets]);

  const locations = useMemo(() => {
    const values = assets
      .map((asset) => getLocation(asset))
      .filter((value) => value && value !== "Not assigned");

    return [...new Set(values)].sort();
  }, [assets]);

  const filteredAssets = useMemo(() => {
    let result = [...assets];

    const query = search.trim().toLowerCase();

    if (query) {
      result = result.filter((asset) => {
        const searchable = [
          getAssetName(asset),
          getAssetTag(asset),
          getCategory(asset),
          getLocation(asset),
          getStatus(asset),
          getSerial(asset),
          getAssignedTo(asset),
        ]
          .join(" ")
          .toLowerCase();

        return searchable.includes(query);
      });
    }

    if (status !== "all") {
      result = result.filter(
        (asset) =>
          String(getStatus(asset)).toLowerCase() ===
          status.toLowerCase()
      );
    }

    if (category !== "all") {
      result = result.filter(
        (asset) =>
          String(getCategory(asset)).toLowerCase() ===
          category.toLowerCase()
      );
    }

    if (location !== "all") {
      result = result.filter(
        (asset) =>
          String(getLocation(asset)).toLowerCase() ===
          location.toLowerCase()
      );
    }

    return result;
  }, [assets, search, status, category, location]);

  const stats = useMemo(() => {
    const total =
      Number(summary?.total) ||
      filteredAssets.length ||
      assets.length;

    const operational =
      Number(summary?.operational) ||
      assets.filter((asset) => {
        const value = String(getStatus(asset)).toLowerCase();
        return [
          "active",
          "operational",
          "available",
          "in_use",
          "in use",
          "good",
        ].includes(value);
      }).length;

    const maintenance =
      Number(summary?.maintenance) ||
      assets.filter((asset) => {
        const value = String(getStatus(asset)).toLowerCase();

        return [
          "maintenance",
          "under_maintenance",
          "under maintenance",
          "repair",
          "in_repair",
        ].includes(value);
      }).length;

    const critical =
      Number(summary?.critical) ||
      assets.filter((asset) => {
        const value = String(getStatus(asset)).toLowerCase();

        return [
          "critical",
          "damaged",
          "failed",
          "danger",
          "overdue",
        ].includes(value);
      }).length;

    const missing =
      Number(summary?.missing) ||
      assets.filter((asset) => {
        const value = String(getStatus(asset)).toLowerCase();
        return ["missing", "lost", "unaccounted"].includes(value);
      }).length;

    return {
      total,
      operational,
      maintenance,
      critical,
      missing,
    };
  }, [summary, assets, filteredAssets.length]);

  const getStatusClass = (value) => {
    const normalized = String(value || "")
      .toLowerCase()
      .replace(/-/g, "_")
      .replace(/\s+/g, "_");

    if (
      [
        "active",
        "operational",
        "available",
        "in_use",
        "good",
        "completed",
      ].includes(normalized)
    ) {
      return "success";
    }

    if (
      [
        "maintenance",
        "under_maintenance",
        "repair",
        "in_repair",
        "pending",
        "in_progress",
      ].includes(normalized)
    ) {
      return "warning";
    }

    if (
      [
        "critical",
        "damaged",
        "failed",
        "missing",
        "lost",
        "overdue",
      ].includes(normalized)
    ) {
      return "danger";
    }

    return "neutral";
  };

  const formatStatus = (value) => {
    if (!value) return "Unknown";

    return String(value)
      .replace(/_/g, " ")
      .replace(/-/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const formatDate = (value) => {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatCurrency = (value) => {
    if (
      value === undefined ||
      value === null ||
      value === ""
    ) {
      return "—";
    }

    const number = Number(value);

    if (Number.isNaN(number)) {
      return String(value);
    }

    return new Intl.NumberFormat(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(number);
  };

  const clearFilters = () => {
    setSearch("");
    setStatus("all");
    setCategory("all");
    setLocation("all");
    setPage(1);
  };

  const hasFilters =
    search ||
    status !== "all" ||
    category !== "all" ||
    location !== "all";

  const totalPages = Math.max(
    1,
    Math.ceil(
      (Number(summary?.total) || filteredAssets.length) /
        pageSize
    )
  );

  const displayedAssets = filteredAssets;

  if (loading) {
    return (
      <div style={styles.page}>
        <style>{css}</style>

        <div className="assets-loading">
          <div className="loading-card">
            <Loader2 className="loading-spin" size={38} />

            <h2>Loading Infrastructure Assets</h2>

            <p>
              Connecting to the university asset management
              system...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <style>{css}</style>

      {/* HEADER */}
      <header className="assets-header">
        <div>
          <div className="breadcrumb">
            <Link to="/infrastructure">
              Infrastructure
            </Link>

            <span>/</span>

            <span>Assets</span>
          </div>

          <div className="title-row">
            <div className="title-icon">
              <Package size={24} />
            </div>

            <div>
              <h1>Infrastructure Assets</h1>

              <p>
                View, monitor, and manage all registered
                infrastructure assets
              </p>
            </div>
          </div>
        </div>

        <div className="header-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={() => loadAssets(true)}
            disabled={refreshing}
          >
            <RefreshCw
              size={16}
              className={refreshing ? "loading-spin" : ""}
            />

            {refreshing ? "Refreshing..." : "Refresh"}
          </button>

          <Link
            to="/infrastructure/assets/register"
            className="primary-button"
          >
            <Plus size={17} />
            Register Asset
          </Link>
        </div>
      </header>

      {/* ERROR */}
      {error && (
        <div className="error-box">
          <div className="error-box-icon">
            <AlertTriangle size={20} />
          </div>

          <div className="error-box-content">
            <strong>Unable to load assets</strong>
            <span>{error}</span>
          </div>

          <button
            type="button"
            onClick={() => loadAssets()}
          >
            Retry
          </button>
        </div>
      )}

      {/* SUMMARY */}
      <section className="summary-grid">
        <div className="summary-card total">
          <div className="summary-icon">
            <Package size={21} />
          </div>

          <div>
            <span>Total Assets</span>
            <strong>{stats.total.toLocaleString()}</strong>
          </div>
        </div>

        <div className="summary-card operational">
          <div className="summary-icon">
            <CheckCircle2 size={21} />
          </div>

          <div>
            <span>Operational</span>
            <strong>{stats.operational.toLocaleString()}</strong>
          </div>
        </div>

        <div className="summary-card maintenance">
          <div className="summary-icon">
            <Wrench size={21} />
          </div>

          <div>
            <span>Maintenance</span>
            <strong>
              {stats.maintenance.toLocaleString()}
            </strong>
          </div>
        </div>

        <div className="summary-card critical">
          <div className="summary-icon">
            <AlertTriangle size={21} />
          </div>

          <div>
            <span>Critical</span>
            <strong>{stats.critical.toLocaleString()}</strong>
          </div>
        </div>

        <div className="summary-card missing">
          <div className="summary-icon">
            <ShieldCheck size={21} />
          </div>

          <div>
            <span>Missing</span>
            <strong>{stats.missing.toLocaleString()}</strong>
          </div>
        </div>
      </section>

      {/* TOOLBAR */}
      <section className="toolbar">
        <div className="search-container">
          <Search size={18} />

          <input
            type="text"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search asset name, tag, serial number, location..."
          />

          {search && (
            <button
              type="button"
              className="clear-search"
              onClick={() => setSearch("")}
            >
              <X size={15} />
            </button>
          )}
        </div>

        <div className="toolbar-actions">
          <button
            type="button"
            className={`filter-button ${
              showFilters ? "active" : ""
            }`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <SlidersHorizontal size={16} />
            Filters

            {hasFilters && (
              <span className="filter-count">
                {[
                  status !== "all",
                  category !== "all",
                  location !== "all",
                ].filter(Boolean).length}
              </span>
            )}
          </button>

          {hasFilters && (
            <button
              type="button"
              className="clear-filters"
              onClick={clearFilters}
            >
              Clear filters
            </button>
          )}
        </div>
      </section>

      {/* FILTERS */}
      {showFilters && (
        <section className="filter-panel">
          <div className="filter-header">
            <div>
              <Filter size={17} />

              <strong>Asset Filters</strong>
            </div>

            <button
              type="button"
              onClick={() => setShowFilters(false)}
            >
              <X size={17} />
            </button>
          </div>

          <div className="filter-grid">
            <div className="filter-field">
              <label>Status</label>

              <select
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value)
                }
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="operational">
                  Operational
                </option>
                <option value="available">
                  Available
                </option>
                <option value="maintenance">
                  Maintenance
                </option>
                <option value="damaged">Damaged</option>
                <option value="critical">Critical</option>
                <option value="missing">Missing</option>
              </select>
            </div>

            <div className="filter-field">
              <label>Category</label>

              <select
                value={category}
                onChange={(event) =>
                  setCategory(event.target.value)
                }
              >
                <option value="all">All categories</option>

                {categories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-field">
              <label>Location</label>

              <select
                value={location}
                onChange={(event) =>
                  setLocation(event.target.value)
                }
              >
                <option value="all">All locations</option>

                {locations.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>
      )}

      {/* RESULTS INFO */}
      <div className="results-bar">
        <div>
          <strong>
            {filteredAssets.length.toLocaleString()}
          </strong>{" "}
          asset
          {filteredAssets.length !== 1 ? "s" : ""} displayed
        </div>

        <div className="results-right">
          {hasFilters && (
            <span className="filtered-label">
              Filtered results
            </span>
          )}

          <span>
            Page {page} of {totalPages}
          </span>
        </div>
      </div>

      {/* TABLE */}
      <section className="asset-table-panel">
        {displayedAssets.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <Package size={38} />
            </div>

            <h2>
              {hasFilters
                ? "No matching infrastructure assets"
                : "No infrastructure assets found"}
            </h2>

            <p>
              {hasFilters
                ? "Try changing your search or filter criteria."
                : "Registered infrastructure assets will appear here."}
            </p>

            {hasFilters ? (
              <button
                type="button"
                className="primary-button"
                onClick={clearFilters}
              >
                Clear Filters
              </button>
            ) : (
              <Link
                to="/infrastructure/assets/register"
                className="primary-button"
              >
                <Plus size={16} />
                Register First Asset
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="table-wrapper">
              <table className="assets-table">
                <thead>
                  <tr>
                    <th>Asset</th>
                    <th>Asset Tag</th>
                    <th>Category</th>
                    <th>Location</th>
                    <th>Assigned To</th>
                    <th>Status</th>
                    <th>Registered</th>
                    <th></th>
                  </tr>
                </thead>

                <tbody>
                  {displayedAssets.map((asset, index) => {
                    const assetId =
                      asset.id ||
                      asset.asset_id ||
                      asset.assetId;

                    return (
                      <tr
                        key={assetId || index}
                        className="asset-row"
                      >
                        <td>
                          <div className="asset-main">
                            <div className="asset-image">
                              <Package size={18} />
                            </div>

                            <div className="asset-info">
                              <strong>
                                {getAssetName(asset)}
                              </strong>

                              {getSerial(asset) && (
                                <span>
                                  SN: {getSerial(asset)}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        <td>
                          <span className="asset-tag">
                            <Tag size={13} />

                            {getAssetTag(asset)}
                          </span>
                        </td>

                        <td>
                          <div className="category-cell">
                            {getCategory(asset)}
                          </div>
                        </td>

                        <td>
                          <div className="location-cell">
                            <MapPin size={14} />

                            <span>
                              {getLocation(asset)}
                            </span>
                          </div>
                        </td>

                        <td>
                          {getAssignedTo(asset) || (
                            <span className="muted">
                              Unassigned
                            </span>
                          )}
                        </td>

                        <td>
                          <span
                            className={`status-badge ${getStatusClass(
                              getStatus(asset)
                            )}`}
                          >
                            {formatStatus(
                              getStatus(asset)
                            )}
                          </span>
                        </td>

                        <td>
                          {formatDate(
                            getValue(asset, [
                              "created_at",
                              "createdAt",
                              "registration_date",
                              "registrationDate",
                            ])
                          )}
                        </td>

                        <td>
                          <button
                            type="button"
                            className="view-button"
                            onClick={() =>
                              setSelectedAsset(asset)
                            }
                            title="View asset"
                          >
                            <Eye size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* PAGINATION */}
            <div className="pagination">
              <div className="pagination-info">
                Showing{" "}
                <strong>
                  {displayedAssets.length}
                </strong>{" "}
                records
              </div>

              <div className="pagination-controls">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() =>
                    setPage((current) =>
                      Math.max(1, current - 1)
                    )
                  }
                >
                  <ChevronLeft size={16} />
                  Previous
                </button>

                <span className="page-number">
                  {page}
                </span>

                <button
                  type="button"
                  disabled={
                    page >= totalPages ||
                    displayedAssets.length < pageSize
                  }
                  onClick={() =>
                    setPage((current) =>
                      Math.min(
                        totalPages,
                        current + 1
                      )
                    )
                  }
                >
                  Next
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {/* QUICK NAVIGATION */}
      <section className="navigation-panel">
        <div className="navigation-title">
          <Activity size={18} />

          <div>
            <strong>Asset Operations</strong>

            <span>
              Continue with infrastructure asset
              management
            </span>
          </div>
        </div>

        <div className="navigation-links">
          <Link to="/infrastructure/assets/register">
            <Plus size={16} />
            Register
            <ArrowRight size={14} />
          </Link>

          <Link to="/infrastructure/assignment">
            <ClipboardCheck size={16} />
            Assignment
            <ArrowRight size={14} />
          </Link>

          <Link to="/infrastructure/transfer">
            <Truck size={16} />
            Transfer
            <ArrowRight size={14} />
          </Link>

          <Link to="/infrastructure/verification">
            <ShieldCheck size={16} />
            Verification
            <ArrowRight size={14} />
          </Link>
        </div>
      </section>

      {/* ASSET DETAILS MODAL */}
      {selectedAsset && (
        <div
          className="modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedAsset(null);
            }
          }}
        >
          <div className="asset-modal">
            <div className="modal-header">
              <div>
                <div className="modal-icon">
                  <Package size={21} />
                </div>

                <div>
                  <h2>
                    {getAssetName(selectedAsset)}
                  </h2>

                  <p>
                    {getAssetTag(selectedAsset)}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedAsset(null)
                }
              >
                <X size={19} />
              </button>
            </div>

            <div className="modal-status">
              <span
                className={`status-badge ${getStatusClass(
                  getStatus(selectedAsset)
                )}`}
              >
                {formatStatus(
                  getStatus(selectedAsset)
                )}
              </span>
            </div>

            <div className="details-grid">
              <div className="detail-item">
                <span>Asset Name</span>
                <strong>
                  {getAssetName(selectedAsset)}
                </strong>
              </div>

              <div className="detail-item">
                <span>Asset Tag</span>
                <strong>
                  {getAssetTag(selectedAsset)}
                </strong>
              </div>

              <div className="detail-item">
                <span>Category</span>
                <strong>
                  {getCategory(selectedAsset)}
                </strong>
              </div>

              <div className="detail-item">
                <span>Serial Number</span>
                <strong>
                  {getSerial(selectedAsset) || "—"}
                </strong>
              </div>

              <div className="detail-item">
                <span>Location</span>
                <strong>
                  {getLocation(selectedAsset)}
                </strong>
              </div>

              <div className="detail-item">
                <span>Assigned To</span>
                <strong>
                  {getAssignedTo(
                    selectedAsset
                  ) || "Unassigned"}
                </strong>
              </div>

              <div className="detail-item">
                <span>Purchase Date</span>
                <strong>
                  {formatDate(
                    getValue(selectedAsset, [
                      "purchase_date",
                      "purchaseDate",
                    ])
                  )}
                </strong>
              </div>

              <div className="detail-item">
                <span>Purchase Value</span>
                <strong>
                  {formatCurrency(
                    getValue(selectedAsset, [
                      "purchase_price",
                      "purchasePrice",
                      "purchase_value",
                      "purchaseValue",
                      "cost",
                    ])
                  )}
                </strong>
              </div>

              <div className="detail-item">
                <span>Registered</span>
                <strong>
                  {formatDate(
                    getValue(selectedAsset, [
                      "created_at",
                      "createdAt",
                      "registration_date",
                    ])
                  )}
                </strong>
              </div>

              <div className="detail-item">
                <span>Last Updated</span>
                <strong>
                  {formatDate(
                    getValue(selectedAsset, [
                      "updated_at",
                      "updatedAt",
                    ])
                  )}
                </strong>
              </div>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() =>
                  setSelectedAsset(null)
                }
              >
                Close
              </button>

              <button
                type="button"
                className="primary-button"
                onClick={() => {
                  const id =
                    selectedAsset.id ||
                    selectedAsset.asset_id ||
                    selectedAsset.assetId;

                  setSelectedAsset(null);

                  if (id) {
                    navigate(
                      `/infrastructure/assets/${id}`
                    );
                  }
                }}
              >
                <Eye size={16} />
                Open Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  page: {
    minHeight: "100%",
    background: "#F8FAFC",
    color: "#0F172A",
  },
};

const css = `
  * {
    box-sizing: border-box;
  }

  .assets-loading {
    min-height: 70vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px;
  }

  .loading-card {
    width: 100%;
    max-width: 400px;
    padding: 40px;
    text-align: center;
    border: 1px solid #e2e8f0;
    border-radius: 16px;
    background: #ffffff;
    box-shadow: 0 12px 35px rgba(15, 23, 42, 0.06);
  }

  .loading-card > svg {
    color: #0ea5e9;
  }

  .loading-card h2 {
    margin: 18px 0 6px;
    color: #0f172a;
    font-size: 19px;
  }

  .loading-card p {
    margin: 0;
    color: #64748b;
    font-size: 13px;
  }

  .loading-spin {
    animation: asset-spin 1s linear infinite;
  }

  @keyframes asset-spin {
    from {
      transform: rotate(0deg);
    }

    to {
      transform: rotate(360deg);
    }
  }

  .assets-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 25px;
    padding: 26px 30px 23px;
    background: #ffffff;
    border-bottom: 1px solid #e2e8f0;
  }

  .breadcrumb {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 11px;
    color: #94a3b8;
    font-size: 11px;
    font-weight: 700;
  }

  .breadcrumb a {
    color: #0284c7;
    text-decoration: none;
  }

  .title-row {
    display: flex;
    align-items: center;
    gap: 13px;
  }

  .title-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 12px;
    color: #0284c7;
    background: #e0f2fe;
  }

  .title-row h1 {
    margin: 0;
    color: #0f172a;
    font-size: 25px;
    line-height: 1.2;
    font-weight: 800;
    letter-spacing: -0.4px;
  }

  .title-row p {
    margin: 5px 0 0;
    color: #64748b;
    font-size: 13px;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 9px;
  }

  .primary-button,
  .secondary-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    min-height: 39px;
    padding: 0 14px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 800;
    text-decoration: none;
    cursor: pointer;
    transition: all 0.18s ease;
  }

  .primary-button {
    border: 1px solid #0284c7;
    color: #ffffff;
    background: #0ea5e9;
  }

  .primary-button:hover {
    background: #0284c7;
    border-color: #0284c7;
  }

  .secondary-button {
    border: 1px solid #cbd5e1;
    color: #334155;
    background: #ffffff;
  }

  .secondary-button:hover {
    border-color: #7dd3fc;
    color: #0284c7;
    background: #f0f9ff;
  }

  .secondary-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .error-box {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 20px 30px 0;
    padding: 13px 15px;
    border: 1px solid #fecaca;
    border-radius: 10px;
    background: #fff7f7;
  }

  .error-box-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 37px;
    height: 37px;
    border-radius: 8px;
    color: #dc2626;
    background: #fee2e2;
  }

  .error-box-content {
    display: flex;
    flex-direction: column;
    flex: 1;
    gap: 2px;
  }

  .error-box-content strong {
    color: #991b1b;
    font-size: 12px;
  }

  .error-box-content span {
    color: #b91c1c;
    font-size: 11px;
  }

  .error-box > button {
    border: 0;
    border-radius: 7px;
    padding: 8px 12px;
    color: #ffffff;
    background: #dc2626;
    font-size: 11px;
    font-weight: 800;
    cursor: pointer;
  }

  .summary-grid {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 14px;
    padding: 20px 30px 0;
  }

  .summary-card {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 82px;
    padding: 14px;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    background: #ffffff;
  }

  .summary-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    width: 42px;
    height: 42px;
    border-radius: 10px;
  }

  .summary-card span {
    display: block;
    color: #64748b;
    font-size: 10px;
    font-weight: 700;
  }

  .summary-card strong {
    display: block;
    margin-top: 3px;
    color: #0f172a;
    font-size: 22px;
    font-weight: 850;
  }

  .summary-card.total .summary-icon {
    color: #0284c7;
    background: #e0f2fe;
  }

  .summary-card.operational .summary-icon {
    color: #16a34a;
    background: #dcfce7;
  }

  .summary-card.maintenance .summary-icon {
    color: #d97706;
    background: #fef3c7;
  }

  .summary-card.critical .summary-icon {
    color: #dc2626;
    background: #fee2e2;
  }

  .summary-card.missing .summary-icon {
    color: #7c3aed;
    background: #ede9fe;
  }

  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 15px;
    margin: 20px 30px 0;
  }

  .search-container {
    display: flex;
    align-items: center;
    gap: 9px;
    flex: 1;
    max-width: 680px;
    min-height: 41px;
    padding: 0 12px;
    border: 1px solid #cbd5e1;
    border-radius: 9px;
    background: #ffffff;
  }

  .search-container > svg {
    flex: 0 0 auto;
    color: #94a3b8;
  }

  .search-container:focus-within {
    border-color: #38bdf8;
    box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.08);
  }

  .search-container input {
    width: 100%;
    border: 0;
    outline: 0;
    color: #334155;
    background: transparent;
    font-size: 12px;
  }

  .search-container input::placeholder {
    color: #94a3b8;
  }

  .clear-search {
    display: flex;
    align-items: center;
    justify-content: center;
    border: 0;
    color: #94a3b8;
    background: transparent;
    cursor: pointer;
  }

  .toolbar-actions {
    display: flex;
    align-items: center;
    gap: 9px;
  }

  .filter-button {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    min-height: 40px;
    padding: 0 13px;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    color: #475569;
    background: #ffffff;
    font-size: 11px;
    font-weight: 800;
    cursor: pointer;
  }

  .filter-button:hover,
  .filter-button.active {
    border-color: #7dd3fc;
    color: #0284c7;
    background: #f0f9ff;
  }

  .filter-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    border-radius: 20px;
    color: #ffffff;
    background: #0ea5e9;
    font-size: 9px;
  }

  .clear-filters {
    border: 0;
    color: #dc2626;
    background: transparent;
    font-size: 11px;
    font-weight: 800;
    cursor: pointer;
  }

  .filter-panel {
    margin: 12px 30px 0;
    padding: 16px;
    border: 1px solid #dbeafe;
    border-radius: 11px;
    background: #f8fdff;
  }

  .filter-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 14px;
  }

  .filter-header > div {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #334155;
    font-size: 12px;
  }

  .filter-header svg {
    color: #0284c7;
  }

  .filter-header button {
    display: flex;
    align-items: center;
    justify-content: center;
    border: 0;
    color: #94a3b8;
    background: transparent;
    cursor: pointer;
  }

  .filter-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
  }

  .filter-field label {
    display: block;
    margin-bottom: 6px;
    color: #475569;
    font-size: 10px;
    font-weight: 800;
  }

  .filter-field select {
    width: 100%;
    height: 38px;
    padding: 0 10px;
    border: 1px solid #cbd5e1;
    border-radius: 7px;
    outline: 0;
    color: #334155;
    background: #ffffff;
    font-size: 11px;
  }

  .filter-field select:focus {
    border-color: #38bdf8;
  }

  .results-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 15px;
    margin: 18px 30px 9px;
    color: #94a3b8;
    font-size: 10px;
  }

  .results-bar strong {
    color: #475569;
  }

  .results-right {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .filtered-label {
    color: #0284c7;
    font-weight: 800;
  }

  .asset-table-panel {
    margin: 0 30px;
    overflow: hidden;
    border: 1px solid #e2e8f0;
    border-radius: 13px;
    background: #ffffff;
  }

  .table-wrapper {
    width: 100%;
    overflow-x: auto;
  }

  .assets-table {
    width: 100%;
    min-width: 1100px;
    border-collapse: collapse;
  }

  .assets-table th {
    padding: 12px 16px;
    border-bottom: 1px solid #e2e8f0;
    color: #64748b;
    background: #f8fafc;
    font-size: 9px;
    font-weight: 850;
    text-align: left;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    white-space: nowrap;
  }

  .assets-table td {
    padding: 13px 16px;
    border-bottom: 1px solid #f1f5f9;
    color: #475569;
    font-size: 11px;
    vertical-align: middle;
  }

  .asset-row:hover {
    background: #f8fdff;
  }

  .asset-row:last-child td {
    border-bottom: 0;
  }

  .asset-main {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 190px;
  }

  .asset-image {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    width: 36px;
    height: 36px;
    border-radius: 8px;
    color: #0284c7;
    background: #e0f2fe;
  }

  .asset-info {
    min-width: 0;
  }

  .asset-info strong {
    display: block;
    max-width: 210px;
    overflow: hidden;
    color: #1e293b;
    font-size: 11px;
    font-weight: 800;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .asset-info span {
    display: block;
    margin-top: 3px;
    color: #94a3b8;
    font-size: 9px;
  }

  .asset-tag {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    color: #475569;
    font-size: 10px;
    font-weight: 700;
  }

  .asset-tag svg {
    color: #94a3b8;
  }

  .category-cell {
    max-width: 160px;
    overflow: hidden;
    color: #475569;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .location-cell {
    display: flex;
    align-items: center;
    gap: 5px;
    max-width: 160px;
  }

  .location-cell svg {
    flex: 0 0 auto;
    color: #94a3b8;
  }

  .location-cell span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .muted {
    color: #94a3b8;
  }

  .status-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 24px;
    padding: 0 8px;
    border-radius: 20px;
    font-size: 9px;
    font-weight: 850;
    white-space: nowrap;
  }

  .status-badge.success {
    color: #166534;
    background: #dcfce7;
  }

  .status-badge.warning {
    color: #92400e;
    background: #fef3c7;
  }

  .status-badge.danger {
    color: #991b1b;
    background: #fee2e2;
  }

  .status-badge.neutral {
    color: #475569;
    background: #f1f5f9;
  }

  .view-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 31px;
    height: 31px;
    border: 1px solid #e2e8f0;
    border-radius: 7px;
    color: #64748b;
    background: #ffffff;
    cursor: pointer;
  }

  .view-button:hover {
    border-color: #7dd3fc;
    color: #0284c7;
    background: #f0f9ff;
  }

  .pagination {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 15px;
    padding: 13px 16px;
    border-top: 1px solid #e2e8f0;
  }

  .pagination-info {
    color: #94a3b8;
    font-size: 10px;
  }

  .pagination-info strong {
    color: #475569;
  }

  .pagination-controls {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .pagination-controls button {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 31px;
    padding: 0 9px;
    border: 1px solid #cbd5e1;
    border-radius: 7px;
    color: #475569;
    background: #ffffff;
    font-size: 10px;
    font-weight: 800;
    cursor: pointer;
  }

  .pagination-controls button:hover:not(:disabled) {
    border-color: #7dd3fc;
    color: #0284c7;
    background: #f0f9ff;
  }

  .pagination-controls button:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .page-number {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 31px;
    height: 31px;
    border-radius: 7px;
    color: #ffffff;
    background: #0ea5e9;
    font-size: 10px;
    font-weight: 850;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 360px;
    padding: 40px 20px;
    text-align: center;
  }

  .empty-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 68px;
    height: 68px;
    border-radius: 17px;
    color: #0284c7;
    background: #e0f2fe;
  }

  .empty-state h2 {
    margin: 16px 0 6px;
    color: #334155;
    font-size: 16px;
  }

  .empty-state p {
    max-width: 420px;
    margin: 0 0 17px;
    color: #94a3b8;
    font-size: 11px;
  }

  .navigation-panel {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    margin: 18px 30px 25px;
    padding: 16px 18px;
    border: 1px solid #dbeafe;
    border-radius: 12px;
    background: #f8fdff;
  }

  .navigation-title {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .navigation-title > svg {
    color: #0284c7;
  }

  .navigation-title strong {
    display: block;
    color: #334155;
    font-size: 11px;
  }

  .navigation-title span {
    display: block;
    margin-top: 3px;
    color: #94a3b8;
    font-size: 9px;
  }

  .navigation-links {
    display: flex;
    align-items: center;
    gap: 7px;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .navigation-links a {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 33px;
    padding: 0 10px;
    border: 1px solid #dbeafe;
    border-radius: 7px;
    color: #0369a1;
    background: #ffffff;
    font-size: 9px;
    font-weight: 800;
    text-decoration: none;
  }

  .navigation-links a:hover {
    border-color: #7dd3fc;
    background: #f0f9ff;
  }

  .modal-overlay {
    position: fixed;
    z-index: 1000;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    background: rgba(15, 23, 42, 0.55);
  }

  .asset-modal {
    width: 100%;
    max-width: 700px;
    max-height: 90vh;
    overflow-y: auto;
    border-radius: 15px;
    background: #ffffff;
    box-shadow: 0 25px 70px rgba(15, 23, 42, 0.22);
  }

  .modal-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 20px;
    padding: 20px;
    border-bottom: 1px solid #e2e8f0;
  }

  .modal-header > div:first-child {
    display: flex;
    align-items: center;
    gap: 11px;
  }

  .modal-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 43px;
    height: 43px;
    border-radius: 10px;
    color: #0284c7;
    background: #e0f2fe;
  }

  .modal-header h2 {
    margin: 0;
    color: #0f172a;
    font-size: 17px;
  }

  .modal-header p {
    margin: 4px 0 0;
    color: #94a3b8;
    font-size: 10px;
  }

  .modal-header > button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 33px;
    height: 33px;
    border: 1px solid #e2e8f0;
    border-radius: 7px;
    color: #64748b;
    background: #ffffff;
    cursor: pointer;
  }

  .modal-header > button:hover {
    color: #dc2626;
    background: #fff7f7;
  }

  .modal-status {
    padding: 15px 20px 0;
  }

  .details-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1px;
    margin: 15px 20px;
    overflow: hidden;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    background: #e2e8f0;
  }

  .detail-item {
    min-height: 67px;
    padding: 12px;
    background: #ffffff;
  }

  .detail-item span {
    display: block;
    color: #94a3b8;
    font-size: 9px;
    font-weight: 700;
  }

  .detail-item strong {
    display: block;
    margin-top: 5px;
    color: #334155;
    font-size: 11px;
    word-break: break-word;
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 15px 20px 20px;
    border-top: 1px solid #e2e8f0;
  }

  @media (max-width: 1250px) {
    .summary-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  @media (max-width: 900px) {
    .assets-header {
      align-items: flex-start;
      flex-direction: column;
    }

    .header-actions {
      width: 100%;
    }

    .header-actions > * {
      flex: 1;
    }

    .toolbar {
      align-items: stretch;
      flex-direction: column;
    }

    .search-container {
      max-width: none;
    }

    .toolbar-actions {
      justify-content: flex-end;
    }

    .navigation-panel {
      align-items: flex-start;
      flex-direction: column;
    }

    .navigation-links {
      justify-content: flex-start;
    }
  }

  @media (max-width: 700px) {
    .assets-header {
      padding: 21px 18px;
    }

    .summary-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      padding-left: 18px;
      padding-right: 18px;
    }

    .toolbar,
    .results-bar,
    .filter-panel,
    .asset-table-panel,
    .navigation-panel {
      margin-left: 18px;
      margin-right: 18px;
    }

    .filter-grid {
      grid-template-columns: 1fr;
    }

    .pagination {
      align-items: flex-start;
      flex-direction: column;
    }

    .pagination-controls {
      width: 100%;
      justify-content: flex-end;
    }
  }

  @media (max-width: 480px) {
    .summary-grid {
      grid-template-columns: 1fr;
    }

    .title-row h1 {
      font-size: 21px;
    }

    .title-row p {
      font-size: 11px;
    }

    .header-actions {
      flex-direction: column;
    }

    .header-actions > * {
      width: 100%;
    }

    .toolbar-actions {
      justify-content: space-between;
    }

    .results-bar {
      align-items: flex-start;
      flex-direction: column;
    }

    .results-right {
      width: 100%;
      justify-content: space-between;
    }

    .details-grid {
      grid-template-columns: 1fr;
    }

    .modal-actions {
      flex-direction: column-reverse;
    }

    .modal-actions > * {
      width: 100%;
    }
  }
`;

export default InfrastructureAssets;