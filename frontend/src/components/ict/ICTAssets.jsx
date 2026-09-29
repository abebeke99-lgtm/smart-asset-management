import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRightLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  Edit3,
  Eye,
  FileText,
  Filter,
  History,
  Loader2,
  MoreHorizontal,
  Package,
  Plus,
  QrCode,
  RefreshCw,
  Search,
  Trash2,
  UserPlus,
  Wrench,
  X,
} from "lucide-react";

/*
|--------------------------------------------------------------------------
| ICT Assets
|--------------------------------------------------------------------------
| Route:
|   /ict/assets
|
| Main permission:
|   ict.assets.view
|
| Related permissions:
|   ict.assets.create
|   ict.assets.update
|   ict.assets.assign
|   ict.assets.transfer
|   ict.assets.qr
|   ict.assets.rfid
|   ict.assets.export
|   ict.assets.retire
|   ict.assets.delete
|   ict.assets.restore
|
| API:
|   /api/ict/assets
|--------------------------------------------------------------------------
*/

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

const API_URL = `${API_BASE_URL}/ict/assets`;

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const STATUS_OPTIONS = [
  "Available",
  "Assigned",
  "Under Maintenance",
  "In Transit",
  "Retired",
  "Disposed",
];

const CONDITION_OPTIONS = [
  "Functional",
  "Needs Repair",
  "Damaged",
  "Missing",
  "Expired",
  "Replaced",
];

const CATEGORY_OPTIONS = [
  "Desktop Computer",
  "Laptop",
  "Workstation",
  "Server",
  "Tablet",
  "Router",
  "Switch",
  "Access Point",
  "Firewall",
  "Network Controller",
  "Printer",
  "Scanner",
  "Photocopier",
  "Projector",
  "Monitor",
  "Interactive Display",
  "UPS",
  "Inverter",
  "Power Backup",
  "NAS",
  "External Storage",
  "Storage Server",
  "IP Phone",
  "Telephone Equipment",
  "Video Conferencing Equipment",
];

const EMPTY_FORM = {
  assetId: "",
  digitalId: "",
  assetName: "",
  category: "",
  subcategory: "",
  serialNumber: "",
  quantity: 1,
  qrCode: "",
  rfid: "",

  purchaseDate: "",
  purchaseCost: "",
  supplier: "",
  warrantyStart: "",
  warrantyExpiry: "",
  researchGrant: "",
  warrantyDocument: "",
  manual: "",

  status: "Available",
  condition: "Functional",

  campus: "",
  college: "",
  department: "",
  laboratory: "",
  building: "",
  room: "",
  custodian: "",
  assignedUser: "",

  cpu: "",
  ram: "",
  storage: "",
  storageType: "",
  operatingSystem: "",
  gpu: "",
  macAddress: "",
  ipAddress: "",
  hostname: "",
};

function normalize(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function formatNumber(value) {
  return new Intl.NumberFormat().format(Number(value || 0));
}

function formatCurrency(value) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function statusClass(value) {
  switch (normalize(value)) {
    case "available":
    case "functional":
      return "success";

    case "assigned":
    case "in_transit":
      return "info";

    case "under_maintenance":
    case "needs_repair":
      return "warning";

    case "damaged":
    case "missing":
      return "danger";

    case "retired":
    case "disposed":
    case "expired":
    case "replaced":
      return "neutral";

    default:
      return "neutral";
  }
}

function StatusBadge({ value }) {
  return (
    <span className={`status-badge ${statusClass(value)}`}>
      {value || "Unknown"}
    </span>
  );
}

function Modal({ open, title, children, onClose, width = "760px" }) {
  if (!open) return null;

  return (
    <div className="modal-overlay">
      <div
        className="modal-container"
        style={{ maxWidth: width }}
      >
        <div className="modal-header">
          <div>
            <h2>{title}</h2>
          </div>

          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={19} />
          </button>
        </div>

        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

function FormField({
  label,
  children,
  required = false,
  hint,
  className = "",
}) {
  return (
    <div className={`form-field ${className}`}>
      <label>
        {label}
        {required && <span className="required">*</span>}
      </label>

      {children}

      {hint && <small className="field-hint">{hint}</small>}
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div className="empty-state">
      <Package size={38} />
      <p>{text}</p>
    </div>
  );
}

export default function ICTAssets() {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");

  const [filtersOpen, setFiltersOpen] = useState(false);

  const [filters, setFilters] = useState({
    category: "",
    status: "",
    condition: "",
    campus: "",
    college: "",
    department: "",
    laboratory: "",
    building: "",
    room: "",
    assignedUser: "",
    rfid: "",
    purchaseDateFrom: "",
    purchaseDateTo: "",
    warrantyStatus: "",
  });

  const [sort, setSort] = useState({
    field: "createdAt",
    direction: "desc",
  });

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [total, setTotal] = useState(0);

  const [selectedAsset, setSelectedAsset] = useState(null);

  const [modal, setModal] = useState(null);

  const [form, setForm] = useState(EMPTY_FORM);

  const [saving, setSaving] = useState(false);

  const [actionLoading, setActionLoading] = useState(false);

  const token =
    localStorage.getItem("token") ||
    localStorage.getItem("accessToken");

  const authHeaders = useMemo(
    () => ({
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(token
        ? {
            Authorization: `Bearer ${token}`,
          }
        : {}),
    }),
    [token]
  );

  const fetchAssets = async ({
    initial = false,
    customPage = page,
  } = {}) => {
    try {
      if (initial) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      setError("");

      const params = new URLSearchParams();

      params.set("page", customPage);
      params.set("limit", pageSize);

      if (search.trim()) {
        params.set("search", search.trim());
      }

      Object.entries(filters).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== "") {
          params.set(key, value);
        }
      });

      if (sort.field) {
        params.set("sortBy", sort.field);
        params.set("sortOrder", sort.direction);
      }

      const response = await fetch(
        `${API_URL}?${params.toString()}`,
        {
          headers: authHeaders,
        }
      );

      if (response.status === 401) {
        throw new Error(
          "Your session has expired. Please log in again."
        );
      }

      if (response.status === 403) {
        throw new Error(
          "You do not have permission to view ICT assets."
        );
      }

      if (!response.ok) {
        throw new Error("Unable to load ICT assets.");
      }

      const result = await response.json();

      const data = result?.data || result;

      const rows =
        data?.items ||
        data?.assets ||
        data?.rows ||
        [];

      setAssets(Array.isArray(rows) ? rows : []);

      setTotal(
        Number(
          data?.total ??
            data?.pagination?.total ??
            rows.length
        )
      );
    } catch (err) {
      console.error(err);

      setError(
        err?.message ||
          "Unable to load ICT assets. Please try again."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAssets({ initial: true });
  }, [
    page,
    pageSize,
    search,
    filters,
    sort.field,
    sort.direction,
  ]);

  useEffect(() => {
    if (!success) return;

    const timeout = setTimeout(() => {
      setSuccess("");
    }, 3500);

    return () => clearTimeout(timeout);
  }, [success]);

  const totalPages = Math.max(
    1,
    Math.ceil(total / pageSize)
  );

  const firstRow =
    total === 0 ? 0 : (page - 1) * pageSize + 1;

  const lastRow = Math.min(
    page * pageSize,
    total
  );

  const updateFilter = (name, value) => {
    setPage(1);

    setFilters((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const clearFilters = () => {
    setPage(1);

    setFilters({
      category: "",
      status: "",
      condition: "",
      campus: "",
      college: "",
      department: "",
      laboratory: "",
      building: "",
      room: "",
      assignedUser: "",
      rfid: "",
      purchaseDateFrom: "",
      purchaseDateTo: "",
      warrantyStatus: "",
    });
  };

  const openCreate = () => {
    setForm({
      ...EMPTY_FORM,
      quantity: 1,
      status: "Available",
      condition: "Functional",
    });

    setModal("create");
  };

  const openEdit = (asset) => {
    setSelectedAsset(asset);

    setForm({
      ...EMPTY_FORM,
      ...asset,
      assetId: asset.assetId || asset.id || "",
      quantity: asset.quantity || 1,
    });

    setModal("edit");
  };

  const openView = (asset) => {
    setSelectedAsset(asset);
    setModal("view");
  };

  const openAssign = (asset) => {
    setSelectedAsset(asset);

    setModal("assign");
  };

  const openTransfer = (asset) => {
    setSelectedAsset(asset);

    setModal("transfer");
  };

  const openMaintenance = (asset) => {
    setSelectedAsset(asset);

    setModal("maintenance");
  };

  const openHistory = (asset) => {
    setSelectedAsset(asset);

    setModal("history");
  };

  const openQR = (asset) => {
    setSelectedAsset(asset);

    setModal("qr");
  };

  const openDelete = (asset) => {
    setSelectedAsset(asset);

    setModal("delete");
  };

  const updateForm = (name, value) => {
    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const saveAsset = async (event) => {
    event.preventDefault();

    try {
      setSaving(true);
      setError("");

      const isEdit = modal === "edit";

      const endpoint = isEdit
        ? `${API_URL}/${selectedAsset?.id || selectedAsset?.assetId}`
        : API_URL;

      const response = await fetch(endpoint, {
        method: isEdit ? "PUT" : "POST",
        headers: authHeaders,
        body: JSON.stringify(form),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          result?.message ||
            `Unable to ${isEdit ? "update" : "create"} asset.`
        );
      }

      setModal(null);

      setSuccess(
        isEdit
          ? "Asset updated successfully."
          : "Asset registered successfully."
      );

      await fetchAssets();
    } catch (err) {
      console.error(err);

      setError(
        err?.message ||
          "Unable to save ICT asset."
      );
    } finally {
      setSaving(false);
    }
  };

  const assignAsset = async (event) => {
    event.preventDefault();

    if (!selectedAsset) return;

    try {
      setActionLoading(true);
      setError("");

      const formData = new FormData(event.currentTarget);

      const payload = {
        assignedTo: formData.get("assignedTo"),
        department: formData.get("department"),
        location: formData.get("location"),
        assignmentDate: formData.get("assignmentDate"),
        expectedReturnDate: formData.get(
          "expectedReturnDate"
        ),
        condition: formData.get("condition"),
        notes: formData.get("notes"),
      };

      const id =
        selectedAsset.id ||
        selectedAsset.assetId;

      const response = await fetch(
        `${API_URL}/${id}/assign`,
        {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify(payload),
        }
      );

      const result = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          result?.message ||
            "Unable to assign asset."
        );
      }

      setModal(null);

      setSuccess(
        "Asset assigned successfully."
      );

      await fetchAssets();
    } catch (err) {
      setError(
        err?.message ||
          "Unable to assign asset."
      );
    } finally {
      setActionLoading(false);
    }
  };

  const transferAsset = async (event) => {
    event.preventDefault();

    if (!selectedAsset) return;

    try {
      setActionLoading(true);
      setError("");

      const formData = new FormData(event.currentTarget);

      const payload = {
        fromLocation:
          selectedAsset.room ||
          selectedAsset.location ||
          "",
        toCampus: formData.get("toCampus"),
        toCollege: formData.get("toCollege"),
        toDepartment: formData.get(
          "toDepartment"
        ),
        toLaboratory: formData.get(
          "toLaboratory"
        ),
        toBuilding: formData.get(
          "toBuilding"
        ),
        toRoom: formData.get("toRoom"),
        requestedBy: formData.get(
          "requestedBy"
        ),
        reason: formData.get("reason"),
        receivingOfficer: formData.get(
          "receivingOfficer"
        ),
      };

      const id =
        selectedAsset.id ||
        selectedAsset.assetId;

      const response = await fetch(
        `${API_URL}/${id}/transfer`,
        {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify(payload),
        }
      );

      const result = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          result?.message ||
            "Unable to transfer asset."
        );
      }

      setModal(null);

      setSuccess(
        "Asset transfer request created successfully."
      );

      await fetchAssets();
    } catch (err) {
      setError(
        err?.message ||
          "Unable to transfer asset."
      );
    } finally {
      setActionLoading(false);
    }
  };

  const sendToMaintenance = async () => {
    if (!selectedAsset) return;

    try {
      setActionLoading(true);
      setError("");

      const id =
        selectedAsset.id ||
        selectedAsset.assetId;

      const response = await fetch(
        `${API_URL}/${id}/maintenance`,
        {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            reason:
              document.getElementById(
                "maintenanceReason"
              )?.value || "",
          }),
        }
      );

      const result = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          result?.message ||
            "Unable to send asset to maintenance."
        );
      }

      setModal(null);

      setSuccess(
        "Asset sent to maintenance successfully."
      );

      await fetchAssets();
    } catch (err) {
      setError(
        err?.message ||
          "Unable to update maintenance status."
      );
    } finally {
      setActionLoading(false);
    }
  };

  const deleteAsset = async () => {
    if (!selectedAsset) return;

    try {
      setActionLoading(true);
      setError("");

      const id =
        selectedAsset.id ||
        selectedAsset.assetId;

      const response = await fetch(
        `${API_URL}/${id}`,
        {
          method: "DELETE",
          headers: authHeaders,
          body: JSON.stringify({
            reason:
              document.getElementById(
                "deleteReason"
              )?.value || "",
          }),
        }
      );

      const result = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          result?.message ||
            "Unable to delete asset."
        );
      }

      setModal(null);

      setSuccess(
        "Asset deleted successfully."
      );

      await fetchAssets();
    } catch (err) {
      setError(
        err?.message ||
          "Unable to delete asset."
      );
    } finally {
      setActionLoading(false);
    }
  };

  const exportAssets = async () => {
    try {
      setActionLoading(true);
      setError("");

      const params = new URLSearchParams();

      if (search.trim()) {
        params.set("search", search.trim());
      }

      Object.entries(filters).forEach(
        ([key, value]) => {
          if (value) {
            params.set(key, value);
          }
        }
      );

      const response = await fetch(
        `${API_URL}/export?${params.toString()}`,
        {
          headers: {
            Accept: "application/octet-stream",
            ...(token
              ? {
                  Authorization: `Bearer ${token}`,
                }
              : {}),
          },
        }
      );

      if (!response.ok) {
        throw new Error(
          "Unable to export ICT assets."
        );
      }

      const blob = await response.blob();

      const url = URL.createObjectURL(blob);

      const anchor = document.createElement("a");

      anchor.href = url;

      anchor.download =
        `ict-assets-${new Date()
          .toISOString()
          .slice(0, 10)}.xlsx`;

      document.body.appendChild(anchor);

      anchor.click();

      anchor.remove();

      URL.revokeObjectURL(url);

      setSuccess(
        "ICT assets exported successfully."
      );
    } catch (err) {
      setError(
        err?.message ||
          "Unable to export ICT assets."
      );
    } finally {
      setActionLoading(false);
    }
  };

  const toggleSort = (field) => {
    setPage(1);

    setSort((previous) => ({
      field,
      direction:
        previous.field === field &&
        previous.direction === "asc"
          ? "desc"
          : "asc",
    }));
  };

  return (
    <div className="ict-assets-page">
      {/* -------------------------------------------------------------- */}
      {/* Header                                                          */}
      {/* -------------------------------------------------------------- */}

      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <span>ICT Officer</span>
            <span>/</span>
            <strong>ICT Assets</strong>
          </div>

          <h1>ICT Assets</h1>

          <p>
            Register, search, assign, transfer and manage
            ICT assets throughout their lifecycle.
          </p>
        </div>

        <div className="header-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={() =>
              fetchAssets({ initial: false })
            }
            disabled={refreshing}
          >
            <RefreshCw
              size={16}
              className={
                refreshing ? "spin" : ""
              }
            />
            Refresh
          </button>

          <button
            type="button"
            className="secondary-button"
            onClick={exportAssets}
            disabled={actionLoading}
          >
            <Download size={16} />
            Export
          </button>

          <button
            type="button"
            className="primary-button"
            onClick={openCreate}
          >
            <Plus size={17} />
            Register Asset
          </button>
        </div>
      </div>

      {/* -------------------------------------------------------------- */}
      {/* Alerts                                                           */}
      {/* -------------------------------------------------------------- */}

      {error && (
        <div className="alert alert-error">
          <AlertTriangle size={18} />

          <span>{error}</span>

          <button
            type="button"
            onClick={() => setError("")}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {success && (
        <div className="alert alert-success">
          <span>{success}</span>

          <button
            type="button"
            onClick={() => setSuccess("")}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* -------------------------------------------------------------- */}
      {/* Search + Filters                                                 */}
      {/* -------------------------------------------------------------- */}

      <section className="toolbar-card">
        <div className="search-wrapper">
          <Search size={18} />

          <input
            type="search"
            placeholder="Search Asset ID, serial number, asset name..."
            value={search}
            onChange={(event) => {
              setPage(1);
              setSearch(event.target.value);
            }}
          />

          {search && (
            <button
              type="button"
              className="clear-search"
              onClick={() => {
                setPage(1);
                setSearch("");
              }}
            >
              <X size={16} />
            </button>
          )}
        </div>

        <button
          type="button"
          className={`filter-button ${
            filtersOpen ? "active" : ""
          }`}
          onClick={() =>
            setFiltersOpen((value) => !value)
          }
        >
          <Filter size={17} />
          Filters

          {Object.values(filters).filter(Boolean)
            .length > 0 && (
            <span className="filter-count">
              {
                Object.values(filters).filter(
                  Boolean
                ).length
              }
            </span>
          )}
        </button>

        {Object.values(filters).filter(Boolean)
          .length > 0 && (
          <button
            type="button"
            className="clear-filter-button"
            onClick={clearFilters}
          >
            Clear Filters
          </button>
        )}
      </section>

      {filtersOpen && (
        <section className="filter-panel">
          <div className="filter-grid">
            <FormField label="Category">
              <select
                value={filters.category}
                onChange={(event) =>
                  updateFilter(
                    "category",
                    event.target.value
                  )
                }
              >
                <option value="">
                  All Categories
                </option>

                {CATEGORY_OPTIONS.map(
                  (category) => (
                    <option
                      value={category}
                      key={category}
                    >
                      {category}
                    </option>
                  )
                )}
              </select>
            </FormField>

            <FormField label="Status">
              <select
                value={filters.status}
                onChange={(event) =>
                  updateFilter(
                    "status",
                    event.target.value
                  )
                }
              >
                <option value="">
                  All Statuses
                </option>

                {STATUS_OPTIONS.map(
                  (status) => (
                    <option
                      value={status}
                      key={status}
                    >
                      {status}
                    </option>
                  )
                )}
              </select>
            </FormField>

            <FormField label="Condition">
              <select
                value={filters.condition}
                onChange={(event) =>
                  updateFilter(
                    "condition",
                    event.target.value
                  )
                }
              >
                <option value="">
                  All Conditions
                </option>

                {CONDITION_OPTIONS.map(
                  (condition) => (
                    <option
                      value={condition}
                      key={condition}
                    >
                      {condition}
                    </option>
                  )
                )}
              </select>
            </FormField>

            <FormField label="Campus">
              <input
                value={filters.campus}
                onChange={(event) =>
                  updateFilter(
                    "campus",
                    event.target.value
                  )
                }
                placeholder="Campus"
              />
            </FormField>

            <FormField label="College">
              <input
                value={filters.college}
                onChange={(event) =>
                  updateFilter(
                    "college",
                    event.target.value
                  )
                }
                placeholder="College"
              />
            </FormField>

            <FormField label="Department">
              <input
                value={filters.department}
                onChange={(event) =>
                  updateFilter(
                    "department",
                    event.target.value
                  )
                }
                placeholder="Department"
              />
            </FormField>

            <FormField label="Laboratory">
              <input
                value={filters.laboratory}
                onChange={(event) =>
                  updateFilter(
                    "laboratory",
                    event.target.value
                  )
                }
                placeholder="Laboratory"
              />
            </FormField>

            <FormField label="Building">
              <input
                value={filters.building}
                onChange={(event) =>
                  updateFilter(
                    "building",
                    event.target.value
                  )
                }
                placeholder="Building"
              />
            </FormField>

            <FormField label="Room">
              <input
                value={filters.room}
                onChange={(event) =>
                  updateFilter(
                    "room",
                    event.target.value
                  )
                }
                placeholder="Room"
              />
            </FormField>

            <FormField label="Assigned User">
              <input
                value={filters.assignedUser}
                onChange={(event) =>
                  updateFilter(
                    "assignedUser",
                    event.target.value
                  )
                }
                placeholder="Assigned user"
              />
            </FormField>

            <FormField label="RFID">
              <input
                value={filters.rfid}
                onChange={(event) =>
                  updateFilter(
                    "rfid",
                    event.target.value
                  )
                }
                placeholder="RFID identifier"
              />
            </FormField>

            <FormField label="Warranty">
              <select
                value={filters.warrantyStatus}
                onChange={(event) =>
                  updateFilter(
                    "warrantyStatus",
                    event.target.value
                  )
                }
              >
                <option value="">
                  All Warranty Statuses
                </option>

                <option value="active">
                  Active
                </option>

                <option value="expiring">
                  Expiring Soon
                </option>

                <option value="expired">
                  Expired
                </option>
              </select>
            </FormField>

            <FormField label="Purchase Date From">
              <input
                type="date"
                value={filters.purchaseDateFrom}
                onChange={(event) =>
                  updateFilter(
                    "purchaseDateFrom",
                    event.target.value
                  )
                }
              />
            </FormField>

            <FormField label="Purchase Date To">
              <input
                type="date"
                value={filters.purchaseDateTo}
                onChange={(event) =>
                  updateFilter(
                    "purchaseDateTo",
                    event.target.value
                  )
                }
              />
            </FormField>
          </div>
        </section>
      )}

      {/* -------------------------------------------------------------- */}
      {/* Table                                                           */}
      {/* -------------------------------------------------------------- */}

      <section className="table-card">
        <div className="table-header">
          <div>
            <h2>Registered ICT Assets</h2>

            <p>
              {formatNumber(total)} assets found
            </p>
          </div>

          <div className="page-size">
            <span>Rows:</span>

            <select
              value={pageSize}
              onChange={(event) => {
                setPage(1);
                setPageSize(
                  Number(event.target.value)
                );
              }}
            >
              {PAGE_SIZE_OPTIONS.map(
                (size) => (
                  <option
                    value={size}
                    key={size}
                  >
                    {size}
                  </option>
                )
              )}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="loading-state">
            <Loader2
              size={36}
              className="spin"
            />

            <p>Loading ICT assets...</p>
          </div>
        ) : assets.length === 0 ? (
          <EmptyState text="No ICT assets found." />
        ) : (
          <div className="table-wrapper">
            <table className="assets-table">
              <thead>
                <tr>
                  <th
                    onClick={() =>
                      toggleSort("assetId")
                    }
                  >
                    Asset ID
                    <SortIndicator
                      field="assetId"
                      sort={sort}
                    />
                  </th>

                  <th>Asset</th>

                  <th>Category</th>

                  <th>Serial Number</th>

                  <th
                    onClick={() =>
                      toggleSort("status")
                    }
                  >
                    Status
                    <SortIndicator
                      field="status"
                      sort={sort}
                    />
                  </th>

                  <th>Condition</th>

                  <th>Location</th>

                  <th>Assigned To</th>

                  <th
                    onClick={() =>
                      toggleSort("purchaseDate")
                    }
                  >
                    Purchase Date
                    <SortIndicator
                      field="purchaseDate"
                      sort={sort}
                    />
                  </th>

                  <th className="actions-column">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {assets.map((asset) => (
                  <AssetRow
                    key={
                      asset.id ||
                      asset.assetId
                    }
                    asset={asset}
                    onView={() =>
                      openView(asset)
                    }
                    onEdit={() =>
                      openEdit(asset)
                    }
                    onAssign={() =>
                      openAssign(asset)
                    }
                    onTransfer={() =>
                      openTransfer(asset)
                    }
                    onMaintenance={() =>
                      openMaintenance(asset)
                    }
                    onQR={() =>
                      openQR(asset)
                    }
                    onHistory={() =>
                      openHistory(asset)
                    }
                    onDelete={() =>
                      openDelete(asset)
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && assets.length > 0 && (
          <div className="pagination">
            <div className="pagination-info">
              Showing{" "}
              <strong>{firstRow}</strong>–
              <strong>{lastRow}</strong> of{" "}
              <strong>{formatNumber(total)}</strong>
            </div>

            <div className="pagination-controls">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() =>
                  setPage((value) =>
                    Math.max(1, value - 1)
                  )
                }
              >
                <ChevronLeft size={17} />
              </button>

              <span>
                Page <strong>{page}</strong> of{" "}
                <strong>{totalPages}</strong>
              </span>

              <button
                type="button"
                disabled={
                  page >= totalPages
                }
                onClick={() =>
                  setPage((value) =>
                    Math.min(
                      totalPages,
                      value + 1
                    )
                  )
                }
              >
                <ChevronRight size={17} />
              </button>
            </div>
          </div>
        )}
      </section>

      {/* -------------------------------------------------------------- */}
      {/* View Modal                                                       */}
      {/* -------------------------------------------------------------- */}

      <Modal
        open={modal === "view"}
        title="Asset Details"
        onClose={() => setModal(null)}
        width="900px"
      >
        {selectedAsset && (
          <AssetDetails
            asset={selectedAsset}
            onEdit={() =>
              openEdit(selectedAsset)
            }
            onClose={() => setModal(null)}
          />
        )}
      </Modal>

      {/* -------------------------------------------------------------- */}
      {/* Create / Edit                                                    */}
      {/* -------------------------------------------------------------- */}

      <Modal
        open={
          modal === "create" ||
          modal === "edit"
        }
        title={
          modal === "edit"
            ? "Edit ICT Asset"
            : "Register ICT Asset"
        }
        onClose={() => setModal(null)}
        width="1000px"
      >
        <AssetForm
          form={form}
          updateForm={updateForm}
          onSubmit={saveAsset}
          saving={saving}
          editing={modal === "edit"}
          onCancel={() => setModal(null)}
        />
      </Modal>

      {/* -------------------------------------------------------------- */}
      {/* Assign                                                           */}
      {/* -------------------------------------------------------------- */}

      <Modal
        open={modal === "assign"}
        title="Assign ICT Asset"
        onClose={() => setModal(null)}
      >
        {selectedAsset && (
          <AssignmentForm
            asset={selectedAsset}
            onSubmit={assignAsset}
            loading={actionLoading}
            onCancel={() => setModal(null)}
          />
        )}
      </Modal>

      {/* -------------------------------------------------------------- */}
      {/* Transfer                                                         */}
      {/* -------------------------------------------------------------- */}

      <Modal
        open={modal === "transfer"}
        title="Transfer ICT Asset"
        onClose={() => setModal(null)}
      >
        {selectedAsset && (
          <TransferForm
            asset={selectedAsset}
            onSubmit={transferAsset}
            loading={actionLoading}
            onCancel={() => setModal(null)}
          />
        )}
      </Modal>

      {/* -------------------------------------------------------------- */}
      {/* Maintenance                                                      */}
      {/* -------------------------------------------------------------- */}

      <Modal
        open={modal === "maintenance"}
        title="Send Asset to Maintenance"
        onClose={() => setModal(null)}
      >
        {selectedAsset && (
          <div>
            <div className="confirmation-box">
              <Wrench size={25} />

              <div>
                <strong>
                  {selectedAsset.assetName ||
                    selectedAsset.name}
                </strong>

                <p>
                  {selectedAsset.assetId ||
                    selectedAsset.id}
                </p>
              </div>
            </div>

            <FormField label="Reason">
              <textarea
                id="maintenanceReason"
                rows={4}
                placeholder="Describe the maintenance reason..."
              />
            </FormField>

            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() =>
                  setModal(null)
                }
              >
                Cancel
              </button>

              <button
                type="button"
                className="primary-button"
                onClick={sendToMaintenance}
                disabled={actionLoading}
              >
                {actionLoading && (
                  <Loader2
                    size={16}
                    className="spin"
                  />
                )}

                Send to Maintenance
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* -------------------------------------------------------------- */}
      {/* QR                                                               */}
      {/* -------------------------------------------------------------- */}

      <Modal
        open={modal === "qr"}
        title="Asset QR Code"
        onClose={() => setModal(null)}
      >
        {selectedAsset && (
          <QRCodePanel asset={selectedAsset} />
        )}
      </Modal>

      {/* -------------------------------------------------------------- */}
      {/* History                                                          */}
      {/* -------------------------------------------------------------- */}

      <Modal
        open={modal === "history"}
        title="Asset History"
        onClose={() => setModal(null)}
        width="900px"
      >
        {selectedAsset && (
          <AssetHistory
            asset={selectedAsset}
            token={token}
          />
        )}
      </Modal>

      {/* -------------------------------------------------------------- */}
      {/* Delete                                                           */}
      {/* -------------------------------------------------------------- */}

      <Modal
        open={modal === "delete"}
        title="Delete ICT Asset"
        onClose={() => setModal(null)}
      >
        {selectedAsset && (
          <div>
            <div className="danger-confirmation">
              <Trash2 size={25} />

              <div>
                <strong>
                  Delete this asset?
                </strong>

                <p>
                  {selectedAsset.assetName ||
                    selectedAsset.name}
                  {" — "}
                  {selectedAsset.assetId ||
                    selectedAsset.id}
                </p>

                <small>
                  Important asset records use
                  soft deletion according to
                  the system policy.
                </small>
              </div>
            </div>

            <FormField label="Deletion Reason">
              <textarea
                id="deleteReason"
                rows={4}
                placeholder="Enter the reason for deletion..."
              />
            </FormField>

            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() =>
                  setModal(null)
                }
              >
                Cancel
              </button>

              <button
                type="button"
                className="danger-button"
                onClick={deleteAsset}
                disabled={actionLoading}
              >
                {actionLoading && (
                  <Loader2
                    size={16}
                    className="spin"
                  />
                )}

                Delete Asset
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* -------------------------------------------------------------- */}
      {/* Styles                                                           */}
      {/* -------------------------------------------------------------- */}

      <style>{`
        .ict-assets-page {
          min-height: 100%;
          padding: 24px;
          background: #F3F6F9;
          color: #111827;
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 20px;
          margin-bottom: 20px;
        }

        .breadcrumb {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #6B7280;
          font-size: 13px;
          margin-bottom: 7px;
        }

        .breadcrumb strong {
          color: #2563EB;
        }

        .page-header h1 {
          margin: 0;
          font-size: 27px;
          font-weight: 700;
        }

        .page-header p {
          margin: 7px 0 0;
          color: #6B7280;
          font-size: 14px;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 9px;
          flex-wrap: wrap;
        }

        button {
          font-family: inherit;
        }

        .primary-button,
        .secondary-button,
        .danger-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          min-height: 38px;
          padding: 8px 13px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 600;
          border: 1px solid transparent;
        }

        .primary-button {
          color: #FFFFFF;
          background: #2563EB;
          border-color: #2563EB;
        }

        .primary-button:hover {
          background: #1D4ED8;
        }

        .secondary-button {
          color: #374151;
          background: #FFFFFF;
          border-color: #D1D5DB;
        }

        .secondary-button:hover {
          color: #2563EB;
          border-color: #2563EB;
        }

        .danger-button {
          color: #FFFFFF;
          background: #DC2626;
          border-color: #DC2626;
        }

        .danger-button:hover {
          background: #B91C1C;
        }

        button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .alert {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 14px;
          border-radius: 9px;
          margin-bottom: 15px;
          font-size: 13px;
        }

        .alert span {
          flex: 1;
        }

        .alert button {
          border: 0;
          background: transparent;
          cursor: pointer;
          display: flex;
        }

        .alert-error {
          color: #991B1B;
          background: #FEF2F2;
          border: 1px solid #FECACA;
        }

        .alert-success {
          color: #166534;
          background: #F0FDF4;
          border: 1px solid #BBF7D0;
        }

        .toolbar-card,
        .filter-panel,
        .table-card {
          background: #FFFFFF;
          border: 1px solid #E5E7EB;
          border-radius: 11px;
          box-shadow: 0 1px 2px rgba(17, 24, 39, 0.04);
        }

        .toolbar-card {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 13px;
          margin-bottom: 10px;
        }

        .search-wrapper {
          flex: 1;
          min-width: 250px;
          display: flex;
          align-items: center;
          gap: 9px;
          border: 1px solid #D1D5DB;
          border-radius: 8px;
          padding: 0 11px;
          height: 40px;
          color: #9CA3AF;
        }

        .search-wrapper:focus-within {
          border-color: #2563EB;
          box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.08);
        }

        .search-wrapper input {
          width: 100%;
          height: 100%;
          border: 0;
          outline: 0;
          color: #111827;
          font-size: 13px;
          background: transparent;
        }

        .clear-search {
          border: 0;
          background: transparent;
          color: #9CA3AF;
          cursor: pointer;
          display: flex;
        }

        .filter-button,
        .clear-filter-button {
          height: 40px;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 0 12px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 600;
        }

        .filter-button {
          border: 1px solid #D1D5DB;
          color: #374151;
          background: #FFFFFF;
        }

        .filter-button.active {
          border-color: #2563EB;
          color: #2563EB;
          background: #EFF6FF;
        }

        .filter-count {
          min-width: 19px;
          height: 19px;
          padding: 0 5px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: #2563EB;
          color: #FFFFFF;
          font-size: 10px;
        }

        .clear-filter-button {
          border: 0;
          color: #DC2626;
          background: #FEF2F2;
        }

        .filter-panel {
          padding: 16px;
          margin-bottom: 15px;
        }

        .filter-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 13px;
        }

        .form-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-bottom: 14px;
        }

        .form-field label {
          color: #374151;
          font-size: 12px;
          font-weight: 600;
        }

        .required {
          color: #DC2626;
          margin-left: 3px;
        }

        .form-field input,
        .form-field select,
        .form-field textarea {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #D1D5DB;
          border-radius: 7px;
          background: #FFFFFF;
          color: #111827;
          padding: 9px 10px;
          outline: none;
          font-size: 13px;
          font-family: inherit;
        }

        .form-field textarea {
          resize: vertical;
        }

        .form-field input:focus,
        .form-field select:focus,
        .form-field textarea:focus {
          border-color: #2563EB;
          box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.08);
        }

        .field-hint {
          color: #9CA3AF;
          font-size: 10px;
        }

        .table-card {
          overflow: hidden;
        }

        .table-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          padding: 17px 18px;
          border-bottom: 1px solid #E5E7EB;
        }

        .table-header h2 {
          margin: 0;
          font-size: 16px;
        }

        .table-header p {
          margin: 4px 0 0;
          color: #9CA3AF;
          font-size: 11px;
        }

        .page-size {
          display: flex;
          align-items: center;
          gap: 7px;
          color: #6B7280;
          font-size: 12px;
        }

        .page-size select {
          border: 1px solid #D1D5DB;
          border-radius: 6px;
          padding: 5px 7px;
          background: #FFFFFF;
        }

        .table-wrapper {
          width: 100%;
          overflow-x: auto;
        }

        .assets-table {
          width: 100%;
          min-width: 1350px;
          border-collapse: collapse;
        }

        .assets-table th {
          padding: 11px 12px;
          text-align: left;
          white-space: nowrap;
          background: #F9FAFB;
          border-bottom: 1px solid #E5E7EB;
          color: #6B7280;
          font-size: 10px;
          font-weight: 700;
          cursor: pointer;
          user-select: none;
        }

        .assets-table th.actions-column {
          cursor: default;
          text-align: right;
        }

        .assets-table td {
          padding: 12px;
          border-bottom: 1px solid #F3F4F6;
          color: #4B5563;
          font-size: 12px;
          vertical-align: middle;
        }

        .assets-table tbody tr:hover {
          background: #F9FAFB;
        }

        .asset-id {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .asset-id strong {
          color: #2563EB;
          font-size: 12px;
        }

        .asset-id small {
          color: #9CA3AF;
          font-size: 9px;
        }

        .asset-name {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 170px;
        }

        .asset-icon {
          width: 30px;
          height: 30px;
          flex: 0 0 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 7px;
          background: #EFF6FF;
          color: #2563EB;
        }

        .asset-name strong {
          display: block;
          color: #111827;
          font-size: 12px;
        }

        .asset-name small {
          display: block;
          margin-top: 2px;
          color: #9CA3AF;
          font-size: 9px;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          padding: 4px 8px;
          border-radius: 999px;
          font-size: 9px;
          font-weight: 700;
          white-space: nowrap;
        }

        .status-badge.success {
          color: #166534;
          background: #DCFCE7;
        }

        .status-badge.info {
          color: #1D4ED8;
          background: #DBEAFE;
        }

        .status-badge.warning {
          color: #92400E;
          background: #FEF3C7;
        }

        .status-badge.danger {
          color: #991B1B;
          background: #FEE2E2;
        }

        .status-badge.neutral {
          color: #4B5563;
          background: #F3F4F6;
        }

        .location-cell {
          min-width: 130px;
        }

        .location-cell strong {
          display: block;
          color: #374151;
          font-size: 11px;
        }

        .location-cell small {
          display: block;
          color: #9CA3AF;
          margin-top: 2px;
          font-size: 9px;
        }

        .actions-column-cell {
          text-align: right;
        }

        .row-actions {
          display: inline-flex;
          align-items: center;
          gap: 3px;
        }

        .row-action {
          width: 29px;
          height: 29px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 0;
          border-radius: 6px;
          background: transparent;
          color: #6B7280;
          cursor: pointer;
        }

        .row-action:hover {
          color: #2563EB;
          background: #EFF6FF;
        }

        .row-action.danger:hover {
          color: #DC2626;
          background: #FEF2F2;
        }

        .action-menu {
          position: relative;
        }

        .action-dropdown {
          position: absolute;
          z-index: 20;
          right: 0;
          top: 34px;
          width: 185px;
          padding: 5px;
          background: #FFFFFF;
          border: 1px solid #E5E7EB;
          border-radius: 8px;
          box-shadow: 0 10px 25px rgba(17, 24, 39, 0.12);
        }

        .action-dropdown button {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 8px;
          border: 0;
          background: transparent;
          color: #374151;
          padding: 8px;
          border-radius: 6px;
          text-align: left;
          font-size: 11px;
          cursor: pointer;
        }

        .action-dropdown button:hover {
          background: #F3F4F6;
        }

        .action-dropdown button.danger {
          color: #DC2626;
        }

        .loading-state {
          min-height: 360px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 10px;
          color: #6B7280;
        }

        .loading-state p {
          margin: 0;
          font-size: 13px;
        }

        .empty-state {
          min-height: 300px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: #9CA3AF;
          gap: 9px;
        }

        .empty-state p {
          margin: 0;
          font-size: 13px;
        }

        .pagination {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          padding: 13px 17px;
          border-top: 1px solid #E5E7EB;
        }

        .pagination-info {
          color: #6B7280;
          font-size: 11px;
        }

        .pagination-info strong {
          color: #374151;
        }

        .pagination-controls {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #6B7280;
          font-size: 11px;
        }

        .pagination-controls button {
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #D1D5DB;
          background: #FFFFFF;
          border-radius: 6px;
          cursor: pointer;
          color: #374151;
        }

        .pagination-controls button:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .pagination-controls button:not(:disabled):hover {
          color: #2563EB;
          border-color: #2563EB;
        }

        .modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: rgba(17, 24, 39, 0.55);
          overflow-y: auto;
        }

        .modal-container {
          width: 100%;
          max-height: calc(100vh - 40px);
          background: #FFFFFF;
          border-radius: 12px;
          box-shadow: 0 25px 60px rgba(17, 24, 39, 0.22);
          overflow: hidden;
        }

        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 17px 20px;
          border-bottom: 1px solid #E5E7EB;
        }

        .modal-header h2 {
          margin: 0;
          font-size: 17px;
        }

        .icon-button {
          width: 34px;
          height: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 0;
          border-radius: 7px;
          background: transparent;
          color: #6B7280;
          cursor: pointer;
        }

        .icon-button:hover {
          background: #F3F4F6;
          color: #111827;
        }

        .modal-body {
          max-height: calc(100vh - 115px);
          overflow-y: auto;
          padding: 20px;
        }

        .asset-form-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 3px 14px;
        }

        .form-section-title {
          grid-column: 1 / -1;
          margin: 15px 0 9px;
          padding-bottom: 7px;
          border-bottom: 1px solid #E5E7EB;
          color: #111827;
          font-size: 13px;
          font-weight: 700;
        }

        .form-section-title:first-child {
          margin-top: 0;
        }

        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 9px;
          margin-top: 10px;
          padding-top: 15px;
          border-top: 1px solid #E5E7EB;
        }

        .confirmation-box,
        .danger-confirmation {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 14px;
          margin-bottom: 17px;
          border-radius: 9px;
        }

        .confirmation-box {
          background: #EFF6FF;
          color: #2563EB;
          border: 1px solid #BFDBFE;
        }

        .danger-confirmation {
          background: #FEF2F2;
          color: #DC2626;
          border: 1px solid #FECACA;
        }

        .confirmation-box strong,
        .danger-confirmation strong {
          display: block;
          color: #111827;
          font-size: 13px;
        }

        .confirmation-box p,
        .danger-confirmation p {
          margin: 4px 0;
          color: #6B7280;
          font-size: 11px;
        }

        .danger-confirmation small {
          color: #9CA3AF;
          font-size: 10px;
        }

        .details-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 13px;
        }

        .detail-item {
          padding: 11px;
          border: 1px solid #E5E7EB;
          border-radius: 8px;
          background: #F9FAFB;
        }

        .detail-item label {
          display: block;
          color: #9CA3AF;
          font-size: 10px;
          margin-bottom: 5px;
        }

        .detail-item strong {
          color: #374151;
          font-size: 12px;
          word-break: break-word;
        }

        .detail-full {
          grid-column: 1 / -1;
        }

        .qr-panel {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 13px;
        }

        .qr-placeholder {
          width: 220px;
          height: 220px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px dashed #D1D5DB;
          border-radius: 10px;
          color: #9CA3AF;
          background:
            linear-gradient(45deg, #F9FAFB 25%, transparent 25%),
            linear-gradient(-45deg, #F9FAFB 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, #F9FAFB 75%),
            linear-gradient(-45deg, transparent 75%, #F9FAFB 75%);
          background-size: 18px 18px;
          background-position:
            0 0,
            0 9px,
            9px -9px,
            -9px 0;
        }

        .qr-panel strong {
          color: #111827;
          font-size: 14px;
        }

        .qr-panel p {
          margin: 0;
          color: #6B7280;
          font-size: 12px;
        }

        .history-list {
          display: flex;
          flex-direction: column;
          gap: 0;
        }

        .history-item {
          display: grid;
          grid-template-columns: 125px 1fr;
          gap: 16px;
          padding: 14px 0;
          border-bottom: 1px solid #E5E7EB;
        }

        .history-item:last-child {
          border-bottom: 0;
        }

        .history-date {
          color: #6B7280;
          font-size: 10px;
        }

        .history-content strong {
          display: block;
          color: #111827;
          font-size: 12px;
        }

        .history-content p {
          margin: 4px 0 0;
          color: #6B7280;
          font-size: 11px;
        }

        .spin {
          animation: spin 0.9s linear infinite;
        }

        @keyframes spin {
          from {
            transform: rotate(0deg);
          }

          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 1200px) {
          .filter-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .asset-form-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .details-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 800px) {
          .ict-assets-page {
            padding: 15px;
          }

          .page-header {
            flex-direction: column;
          }

          .header-actions {
            width: 100%;
          }

          .header-actions button {
            flex: 1;
          }

          .toolbar-card {
            flex-wrap: wrap;
          }

          .search-wrapper {
            width: 100%;
            flex-basis: 100%;
          }

          .filter-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .details-grid {
            grid-template-columns: 1fr;
          }

          .detail-full {
            grid-column: auto;
          }

          .pagination {
            flex-direction: column;
            align-items: flex-start;
          }
        }

        @media (max-width: 560px) {
          .filter-grid,
          .asset-form-grid {
            grid-template-columns: 1fr;
          }

          .header-actions {
            flex-direction: column;
          }

          .header-actions button {
            width: 100%;
          }

          .modal-overlay {
            padding: 8px;
          }

          .modal-container {
            max-height: calc(100vh - 16px);
          }

          .modal-body {
            padding: 14px;
          }
        }
      `}</style>
    </div>
  );
}

/* ====================================================================== */
/* Asset Row                                                              */
/* ====================================================================== */

function AssetRow({
  asset,
  onView,
  onEdit,
  onAssign,
  onTransfer,
  onMaintenance,
  onQR,
  onHistory,
  onDelete,
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  const assetId =
    asset.assetId ||
    asset.id ||
    "—";

  const assetName =
    asset.assetName ||
    asset.name ||
    "Unnamed Asset";

  const category =
    asset.category ||
    asset.subcategory ||
    "—";

  const serial =
    asset.serialNumber ||
    "—";

  const location =
    asset.room ||
    asset.building ||
    asset.department ||
    asset.campus ||
    "—";

  const assigned =
    asset.assignedUser ||
    asset.assignedTo ||
    asset.custodian ||
    "Unassigned";

  return (
    <tr>
      <td>
        <div className="asset-id">
          <strong>{assetId}</strong>

          {asset.digitalId &&
            asset.digitalId !== assetId && (
              <small>
                Digital: {asset.digitalId}
              </small>
            )}
        </div>
      </td>

      <td>
        <div className="asset-name">
          <div className="asset-icon">
            <Package size={16} />
          </div>

          <div>
            <strong>{assetName}</strong>

            {asset.hostname && (
              <small>
                {asset.hostname}
              </small>
            )}
          </div>
        </div>
      </td>

      <td>{category}</td>

      <td>{serial}</td>

      <td>
        <StatusBadge
          value={
            asset.status || "Unknown"
          }
        />
      </td>

      <td>
        <StatusBadge
          value={
            asset.condition || "Unknown"
          }
        />
      </td>

      <td>
        <div className="location-cell">
          <strong>{location}</strong>

          {asset.campus &&
            location !== asset.campus && (
              <small>
                {asset.campus}
              </small>
            )}
        </div>
      </td>

      <td>{assigned}</td>

      <td>
        {formatDate(asset.purchaseDate)}
      </td>

      <td className="actions-column-cell">
        <div className="row-actions">
          <button
            type="button"
            className="row-action"
            title="View"
            onClick={onView}
          >
            <Eye size={15} />
          </button>

          <button
            type="button"
            className="row-action"
            title="Edit"
            onClick={onEdit}
          >
            <Edit3 size={15} />
          </button>

          <div className="action-menu">
            <button
              type="button"
              className="row-action"
              title="More actions"
              onClick={() =>
                setMenuOpen(
                  (value) => !value
                )
              }
            >
              <MoreHorizontal
                size={16}
              />
            </button>

            {menuOpen && (
              <div className="action-dropdown">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onAssign();
                  }}
                >
                  <UserPlus size={14} />
                  Assign Asset
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onTransfer();
                  }}
                >
                  <ArrowRightLeft
                    size={14}
                  />
                  Transfer Asset
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onMaintenance();
                  }}
                >
                  <Wrench size={14} />
                  Send to Maintenance
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onQR();
                  }}
                >
                  <QrCode size={14} />
                  QR Code
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onHistory();
                  }}
                >
                  <History size={14} />
                  Asset History
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete();
                  }}
                  className="danger"
                >
                  <Trash2 size={14} />
                  Delete Asset
                </button>
              </div>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}

/* ====================================================================== */
/* Sort Indicator                                                         */
/* ====================================================================== */

function SortIndicator({ field, sort }) {
  if (sort.field !== field) {
    return (
      <span
        style={{
          marginLeft: 5,
          opacity: 0.35,
        }}
      >
        ↕
      </span>
    );
  }

  return (
    <span
      style={{
        marginLeft: 5,
        color: "#2563EB",
      }}
    >
      {sort.direction === "asc"
        ? "↑"
        : "↓"}
    </span>
  );
}

/* ====================================================================== */
/* Asset Form                                                             */
/* ====================================================================== */

function AssetForm({
  form,
  updateForm,
  onSubmit,
  saving,
  editing,
  onCancel,
}) {
  return (
    <form onSubmit={onSubmit}>
      <div className="asset-form-grid">
        <div className="form-section-title">
          Asset Identity
        </div>

        <FormField label="Asset ID">
          <input
            value={form.assetId}
            onChange={(event) =>
              updateForm(
                "assetId",
                event.target.value
              )
            }
            placeholder="ICT-2026-000001"
            disabled={editing}
            hint="Leave blank if generated by backend."
          />
        </FormField>

        <FormField label="Digital ID">
          <input
            value={form.digitalId}
            onChange={(event) =>
              updateForm(
                "digitalId",
                event.target.value
              )
            }
            placeholder="Digital label ID"
          />
        </FormField>

        <FormField
          label="Asset Name"
          required
        >
          <input
            value={form.assetName}
            onChange={(event) =>
              updateForm(
                "assetName",
                event.target.value
              )
            }
            placeholder="Laptop Dell Latitude"
            required
          />
        </FormField>

        <FormField
          label="Category"
          required
        >
          <select
            value={form.category}
            onChange={(event) =>
              updateForm(
                "category",
                event.target.value
              )
            }
            required
          >
            <option value="">
              Select category
            </option>

            {CATEGORY_OPTIONS.map(
              (category) => (
                <option
                  key={category}
                  value={category}
                >
                  {category}
                </option>
              )
            )}
          </select>
        </FormField>

        <FormField label="Subcategory">
          <input
            value={form.subcategory}
            onChange={(event) =>
              updateForm(
                "subcategory",
                event.target.value
              )
            }
            placeholder="Subcategory"
          />
        </FormField>

        <FormField label="Serial Number">
          <input
            value={form.serialNumber}
            onChange={(event) =>
              updateForm(
                "serialNumber",
                event.target.value
              )
            }
            placeholder="Serial number"
          />
        </FormField>

        <FormField label="Quantity">
          <input
            type="number"
            min="1"
            value={form.quantity}
            onChange={(event) =>
              updateForm(
                "quantity",
                Number(event.target.value)
              )
            }
          />
        </FormField>

        <FormField label="QR Code">
          <input
            value={form.qrCode}
            onChange={(event) =>
              updateForm(
                "qrCode",
                event.target.value
              )
            }
            placeholder="Generated QR identifier"
          />
        </FormField>

        <FormField label="RFID">
          <input
            value={form.rfid}
            onChange={(event) =>
              updateForm(
                "rfid",
                event.target.value
              )
            }
            placeholder="RFID identifier"
          />
        </FormField>

        <div className="form-section-title">
          Purchase & Warranty
        </div>

        <FormField label="Purchase Date">
          <input
            type="date"
            value={form.purchaseDate}
            onChange={(event) =>
              updateForm(
                "purchaseDate",
                event.target.value
              )
            }
          />
        </FormField>

        <FormField label="Purchase Cost">
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.purchaseCost}
            onChange={(event) =>
              updateForm(
                "purchaseCost",
                event.target.value
              )
            }
            placeholder="0.00"
          />
        </FormField>

        <FormField label="Supplier">
          <input
            value={form.supplier}
            onChange={(event) =>
              updateForm(
                "supplier",
                event.target.value
              )
            }
            placeholder="Supplier"
          />
        </FormField>

        <FormField label="Warranty Start">
          <input
            type="date"
            value={form.warrantyStart}
            onChange={(event) =>
              updateForm(
                "warrantyStart",
                event.target.value
              )
            }
          />
        </FormField>

        <FormField label="Warranty Expiry">
          <input
            type="date"
            value={form.warrantyExpiry}
            onChange={(event) =>
              updateForm(
                "warrantyExpiry",
                event.target.value
              )
            }
          />
        </FormField>

        <FormField label="Research Grant">
          <input
            value={form.researchGrant}
            onChange={(event) =>
              updateForm(
                "researchGrant",
                event.target.value
              )
            }
            placeholder="Research grant reference"
          />
        </FormField>

        <FormField label="Warranty Document">
          <input
            value={form.warrantyDocument}
            onChange={(event) =>
              updateForm(
                "warrantyDocument",
                event.target.value
              )
            }
            placeholder="Document reference"
          />
        </FormField>

        <FormField label="Manual">
          <input
            value={form.manual}
            onChange={(event) =>
              updateForm(
                "manual",
                event.target.value
              )
            }
            placeholder="Manual document reference"
          />
        </FormField>

        <div className="form-section-title">
          State
        </div>

        <FormField label="Status">
          <select
            value={form.status}
            onChange={(event) =>
              updateForm(
                "status",
                event.target.value
              )
            }
          >
            {STATUS_OPTIONS.map(
              (status) => (
                <option
                  value={status}
                  key={status}
                >
                  {status}
                </option>
              )
            )}
          </select>
        </FormField>

        <FormField label="Condition">
          <select
            value={form.condition}
            onChange={(event) =>
              updateForm(
                "condition",
                event.target.value
              )
            }
          >
            {CONDITION_OPTIONS.map(
              (condition) => (
                <option
                  value={condition}
                  key={condition}
                >
                  {condition}
                </option>
              )
            )}
          </select>
        </FormField>

        <div className="form-section-title">
          Location & Custody
        </div>

        <FormField label="Campus">
          <input
            value={form.campus}
            onChange={(event) =>
              updateForm(
                "campus",
                event.target.value
              )
            }
            placeholder="Campus"
          />
        </FormField>

        <FormField label="College">
          <input
            value={form.college}
            onChange={(event) =>
              updateForm(
                "college",
                event.target.value
              )
            }
            placeholder="College"
          />
        </FormField>

        <FormField label="Department">
          <input
            value={form.department}
            onChange={(event) =>
              updateForm(
                "department",
                event.target.value
              )
            }
            placeholder="Department"
          />
        </FormField>

        <FormField label="Laboratory">
          <input
            value={form.laboratory}
            onChange={(event) =>
              updateForm(
                "laboratory",
                event.target.value
              )
            }
            placeholder="Laboratory"
          />
        </FormField>

        <FormField label="Building">
          <input
            value={form.building}
            onChange={(event) =>
              updateForm(
                "building",
                event.target.value
              )
            }
            placeholder="Building"
          />
        </FormField>

        <FormField label="Room">
          <input
            value={form.room}
            onChange={(event) =>
              updateForm(
                "room",
                event.target.value
              )
            }
            placeholder="Room"
          />
        </FormField>

        <FormField label="Custodian">
          <input
            value={form.custodian}
            onChange={(event) =>
              updateForm(
                "custodian",
                event.target.value
              )
            }
            placeholder="Custodian"
          />
        </FormField>

        <FormField label="Assigned User">
          <input
            value={form.assignedUser}
            onChange={(event) =>
              updateForm(
                "assignedUser",
                event.target.value
              )
            }
            placeholder="Assigned user"
          />
        </FormField>

        <div className="form-section-title">
          Technical Information
        </div>

        <FormField label="CPU">
          <input
            value={form.cpu}
            onChange={(event) =>
              updateForm(
                "cpu",
                event.target.value
              )
            }
            placeholder="Intel Core i7"
          />
        </FormField>

        <FormField label="RAM">
          <input
            value={form.ram}
            onChange={(event) =>
              updateForm(
                "ram",
                event.target.value
              )
            }
            placeholder="16 GB"
          />
        </FormField>

        <FormField label="Storage">
          <input
            value={form.storage}
            onChange={(event) =>
              updateForm(
                "storage",
                event.target.value
              )
            }
            placeholder="512 GB"
          />
        </FormField>

        <FormField label="Storage Type">
          <input
            value={form.storageType}
            onChange={(event) =>
              updateForm(
                "storageType",
                event.target.value
              )
            }
            placeholder="SSD / HDD"
          />
        </FormField>

        <FormField label="Operating System">
          <input
            value={form.operatingSystem}
            onChange={(event) =>
              updateForm(
                "operatingSystem",
                event.target.value
              )
            }
            placeholder="Windows 11"
          />
        </FormField>

        <FormField label="GPU">
          <input
            value={form.gpu}
            onChange={(event) =>
              updateForm(
                "gpu",
                event.target.value
              )
            }
            placeholder="Graphics processor"
          />
        </FormField>

        <FormField label="MAC Address">
          <input
            value={form.macAddress}
            onChange={(event) =>
              updateForm(
                "macAddress",
                event.target.value
              )
            }
            placeholder="00:00:00:00:00:00"
          />
        </FormField>

        <FormField label="IP Address">
          <input
            value={form.ipAddress}
            onChange={(event) =>
              updateForm(
                "ipAddress",
                event.target.value
              )
            }
            placeholder="192.168.1.10"
          />
        </FormField>

        <FormField label="Hostname">
          <input
            value={form.hostname}
            onChange={(event) =>
              updateForm(
                "hostname",
                event.target.value
              )
            }
            placeholder="ICT-PC-001"
          />
        </FormField>
      </div>

      <div className="modal-actions">
        <button
          type="button"
          className="secondary-button"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </button>

        <button
          type="submit"
          className="primary-button"
          disabled={saving}
        >
          {saving && (
            <Loader2
              size={16}
              className="spin"
            />
          )}

          {editing
            ? "Update Asset"
            : "Register Asset"}
        </button>
      </div>
    </form>
  );
}

/* ====================================================================== */
/* Assignment Form                                                        */
/* ====================================================================== */

function AssignmentForm({
  asset,
  onSubmit,
  loading,
  onCancel,
}) {
  return (
    <form onSubmit={onSubmit}>
      <div className="confirmation-box">
        <UserPlus size={23} />

        <div>
          <strong>
            {asset.assetName ||
              asset.name}
          </strong>

          <p>
            {asset.assetId ||
              asset.id}
          </p>
        </div>
      </div>

      <FormField
        label="Assigned To"
        required
      >
        <input
          name="assignedTo"
          required
          placeholder="Staff member / authorized user"
        />
      </FormField>

      <FormField label="Department">
        <input
          name="department"
          placeholder="Department"
        />
      </FormField>

      <FormField label="Location">
        <input
          name="location"
          placeholder="Office / laboratory / workstation"
        />
      </FormField>

      <FormField
        label="Assignment Date"
        required
      >
        <input
          name="assignmentDate"
          type="date"
          required
          defaultValue={
            new Date()
              .toISOString()
              .split("T")[0]
          }
        />
      </FormField>

      <FormField label="Expected Return Date">
        <input
          name="expectedReturnDate"
          type="date"
        />
      </FormField>

      <FormField label="Condition">
        <select
          name="condition"
          defaultValue={
            asset.condition ||
            "Functional"
          }
        >
          {CONDITION_OPTIONS.map(
            (condition) => (
              <option
                key={condition}
                value={condition}
              >
                {condition}
              </option>
            )
          )}
        </select>
      </FormField>

      <FormField label="Notes">
        <textarea
          name="notes"
          rows={4}
          placeholder="Assignment notes..."
        />
      </FormField>

      <div className="modal-actions">
        <button
          type="button"
          className="secondary-button"
          onClick={onCancel}
        >
          Cancel
        </button>

        <button
          type="submit"
          className="primary-button"
          disabled={loading}
        >
          {loading && (
            <Loader2
              size={16}
              className="spin"
            />
          )}

          Assign Asset
        </button>
      </div>
    </form>
  );
}

/* ====================================================================== */
/* Transfer Form                                                          */
/* ====================================================================== */

function TransferForm({
  asset,
  onSubmit,
  loading,
  onCancel,
}) {
  return (
    <form onSubmit={onSubmit}>
      <div className="confirmation-box">
        <ArrowRightLeft size={23} />

        <div>
          <strong>
            {asset.assetName ||
              asset.name}
          </strong>

          <p>
            Current location:{" "}
            {asset.room ||
              asset.building ||
              asset.department ||
              asset.campus ||
              "Not specified"}
          </p>
        </div>
      </div>

      <FormField label="To Campus">
        <input
          name="toCampus"
          placeholder="Destination campus"
        />
      </FormField>

      <FormField label="To College">
        <input
          name="toCollege"
          placeholder="Destination college"
        />
      </FormField>

      <FormField label="To Department">
        <input
          name="toDepartment"
          placeholder="Destination department"
        />
      </FormField>

      <FormField label="To Laboratory">
        <input
          name="toLaboratory"
          placeholder="Destination laboratory"
        />
      </FormField>

      <FormField label="To Building">
        <input
          name="toBuilding"
          placeholder="Destination building"
        />
      </FormField>

      <FormField label="To Room">
        <input
          name="toRoom"
          placeholder="Destination room"
        />
      </FormField>

      <FormField label="Requested By">
        <input
          name="requestedBy"
          placeholder="Requester"
        />
      </FormField>

      <FormField label="Receiving Officer">
        <input
          name="receivingOfficer"
          placeholder="Receiving officer"
        />
      </FormField>

      <FormField label="Reason" required>
        <textarea
          name="reason"
          rows={4}
          required
          placeholder="Reason for transfer..."
        />
      </FormField>

      <div className="modal-actions">
        <button
          type="button"
          className="secondary-button"
          onClick={onCancel}
        >
          Cancel
        </button>

        <button
          type="submit"
          className="primary-button"
          disabled={loading}
        >
          {loading && (
            <Loader2
              size={16}
              className="spin"
            />
          )}

          Create Transfer
        </button>
      </div>
    </form>
  );
}

/* ====================================================================== */
/* Asset Details                                                          */
/* ====================================================================== */

function AssetDetails({
  asset,
  onEdit,
  onClose,
}) {
  const details = [
    ["Asset ID", asset.assetId || asset.id],
    ["Digital ID", asset.digitalId],
    ["Asset Name", asset.assetName || asset.name],
    ["Category", asset.category],
    ["Subcategory", asset.subcategory],
    ["Serial Number", asset.serialNumber],
    ["Quantity", asset.quantity],
    ["QR Code", asset.qrCode],
    ["RFID", asset.rfid],
    ["Purchase Date", formatDate(asset.purchaseDate)],
    [
      "Purchase Cost",
      formatCurrency(asset.purchaseCost),
    ],
    ["Supplier", asset.supplier],
    [
      "Warranty Start",
      formatDate(asset.warrantyStart),
    ],
    [
      "Warranty Expiry",
      formatDate(asset.warrantyExpiry),
    ],
    ["Campus", asset.campus],
    ["College", asset.college],
    ["Department", asset.department],
    ["Laboratory", asset.laboratory],
    ["Building", asset.building],
    ["Room", asset.room],
    ["Custodian", asset.custodian],
    ["Assigned User", asset.assignedUser],
    ["CPU", asset.cpu],
    ["RAM", asset.ram],
    ["Storage", asset.storage],
    ["Storage Type", asset.storageType],
    [
      "Operating System",
      asset.operatingSystem,
    ],
    ["GPU", asset.gpu],
    ["MAC Address", asset.macAddress],
    ["IP Address", asset.ipAddress],
    ["Hostname", asset.hostname],
  ];

  return (
    <div>
      <div className="details-grid">
        <div className="detail-item">
          <label>Status</label>

          <StatusBadge
            value={
              asset.status || "Unknown"
            }
          />
        </div>

        <div className="detail-item">
          <label>Condition</label>

          <StatusBadge
            value={
              asset.condition || "Unknown"
            }
          />
        </div>

        {details.map(
          ([label, value]) => (
            <div
              className="detail-item"
              key={label}
            >
              <label>{label}</label>

              <strong>
                {value === null ||
                value === undefined ||
                value === ""
                  ? "—"
                  : String(value)}
              </strong>
            </div>
          )
        )}
      </div>

      <div className="modal-actions">
        <button
          type="button"
          className="secondary-button"
          onClick={onClose}
        >
          Close
        </button>

        <button
          type="button"
          className="primary-button"
          onClick={onEdit}
        >
          <Edit3 size={16} />
          Edit Asset
        </button>
      </div>
    </div>
  );
}

/* ====================================================================== */
/* QR Panel                                                               */
/* ====================================================================== */

function QRCodePanel({ asset }) {
  const value =
    asset.qrCode ||
    asset.digitalId ||
    asset.assetId ||
    asset.id;

  return (
    <div className="qr-panel">
      <div className="qr-placeholder">
        <QrCode size={80} />
      </div>

      <strong>{value}</strong>

      <p>
        QR generation should use the backend
        asset QR endpoint:
        <br />
        <code>
          /api/ict/assets/:id/qr
        </code>
      </p>

      <div className="modal-actions">
        <button
          type="button"
          className="primary-button"
          onClick={() =>
            window.open(
              `${API_URL}/${
                asset.id ||
                asset.assetId
              }/qr`,
              "_blank"
            )
          }
        >
          <QrCode size={16} />
          Generate QR
        </button>
      </div>
    </div>
  );
}

/* ====================================================================== */
/* Asset History                                                          */
/* ====================================================================== */

function AssetHistory({
  asset,
  token,
}) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] =
    useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadHistory = async () => {
      try {
        setLoading(true);

        const id =
          asset.id ||
          asset.assetId;

        const response = await fetch(
          `${API_URL}/${id}/history`,
          {
            headers: {
              Accept:
                "application/json",
              ...(token
                ? {
                    Authorization: `Bearer ${token}`,
                  }
                : {}),
            },
          }
        );

        if (!response.ok) {
          throw new Error(
            "Unable to load asset history."
          );
        }

        const result =
          await response.json();

        const data =
          result?.data ||
          result;

        setHistory(
          Array.isArray(data)
            ? data
            : data?.history || []
        );
      } catch (err) {
        setError(
          err?.message ||
            "Unable to load asset history."
        );
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, [asset, token]);

  if (loading) {
    return (
      <div className="loading-state">
        <Loader2
          size={32}
          className="spin"
        />
        <p>
          Loading asset history...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-error">
        <AlertTriangle size={17} />
        <span>{error}</span>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <EmptyState text="No asset history found." />
    );
  }

  return (
    <div className="history-list">
      {history.map((item, index) => (
        <div
          className="history-item"
          key={
            item.id ||
            `history-${index}`
          }
        >
          <div className="history-date">
            {formatDate(
              item.timestamp ||
                item.createdAt ||
                item.date
            )}
          </div>

          <div className="history-content">
            <strong>
              {item.action ||
                "Asset Updated"}
            </strong>

            <p>
              User:{" "}
              {item.userName ||
                item.user ||
                "—"}
            </p>

            {item.reason && (
              <p>
                Reason: {item.reason}
              </p>
            )}

            {item.oldValue !==
              undefined && (
              <p>
                Old value:{" "}
                {String(
                  item.oldValue
                )}
              </p>
            )}

            {item.newValue !==
              undefined && (
              <p>
                New value:{" "}
                {String(
                  item.newValue
                )}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}