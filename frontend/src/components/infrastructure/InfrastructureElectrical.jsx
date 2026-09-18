import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Edit3,
  Eye,
  Filter,
  Gauge,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  X,
  XCircle,
  Zap,
} from "lucide-react";

const PAGE_SIZE = 10;

const EMPTY_FORM = {
  name: "",
  code: "",
  systemType: "Electrical Equipment",
  location: "",
  voltage: "",
  capacity: "",
  status: "",
  condition: "",
  installationDate: "",
  lastInspectionDate: "",
  nextInspectionDate: "",
  description: "",
};

const normalize = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase();

const getValue = (obj, keys, fallback = "") => {
  if (!obj || typeof obj !== "object") return fallback;

  for (const key of keys) {
    if (
      obj[key] !== undefined &&
      obj[key] !== null &&
      String(obj[key]).trim() !== ""
    ) {
      return obj[key];
    }
  }

  return fallback;
};

const getId = (row) =>
  getValue(row, ["id", "electrical_id", "electricalId"], "");

const getName = (row) =>
  getValue(
    row,
    ["name", "system_name", "systemName", "equipment_name"],
    "Unnamed Electrical System"
  );

const getCode = (row) =>
  getValue(
    row,
    ["code", "system_code", "systemCode", "equipment_code"],
    "—"
  );

const getType = (row) =>
  getValue(
    row,
    [
      "system_type",
      "systemType",
      "type",
      "electrical_type",
      "equipment_type",
    ],
    "Electrical System"
  );

const getLocation = (row) =>
  getValue(
    row,
    ["location", "location_name", "locationName", "site"],
    "—"
  );

const getVoltage = (row) =>
  getValue(
    row,
    ["voltage", "voltage_rating", "voltageRating"],
    "—"
  );

const getCapacity = (row) =>
  getValue(
    row,
    ["capacity", "power_capacity", "powerCapacity", "rating"],
    "—"
  );

const getStatus = (row) =>
  normalize(
    getValue(
      row,
      ["status", "system_status", "systemStatus"],
      "operational"
    )
  );

const getCondition = (row) =>
  normalize(
    getValue(
      row,
      ["condition", "condition_status", "conditionStatus"],
      "good"
    )
  );

const getInstallationDate = (row) =>
  getValue(
    row,
    ["installation_date", "installationDate"],
    ""
  );

const getLastInspectionDate = (row) =>
  getValue(
    row,
    ["last_inspection_date", "lastInspectionDate"],
    ""
  );

const getNextInspectionDate = (row) =>
  getValue(
    row,
    ["next_inspection_date", "nextInspectionDate"],
    ""
  );

const getDescription = (row) =>
  getValue(row, ["description", "notes", "remarks"], "");

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

const extractRows = (response) => {
  const data = response?.data;

  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.systems)) return data.systems;
  if (Array.isArray(data?.electricalSystems)) {
    return data.electricalSystems;
  }

  return [];
};

const extractPagination = (response, currentPage) => {
  const data = response?.data || {};
  const meta =
    data.pagination ||
    data.meta ||
    data.pageInfo ||
    {};

  const total =
    Number(
      meta.total ??
        data.total ??
        data.totalCount ??
        0
    ) || 0;

  const totalPages =
    Number(
      meta.totalPages ??
        data.totalPages ??
        Math.ceil(total / PAGE_SIZE)
    ) || 1;

  return {
    total,
    totalPages: Math.max(1, totalPages),
    page:
      Number(meta.page ?? data.page ?? currentPage) ||
      currentPage,
  };
};

const statusLabel = (status) => {
  const labels = {
    operational: "Operational",
    active: "Active",
    maintenance: "Maintenance",
    inactive: "Inactive",
    fault: "Fault",
    failed: "Failed",
    shutdown: "Shutdown",
  };

  return labels[status] || status || "—";
};

const conditionLabel = (condition) => {
  const labels = {
    excellent: "Excellent",
    good: "Good",
    fair: "Fair",
    poor: "Poor",
    critical: "Critical",
    damaged: "Damaged",
  };

  return labels[condition] || condition || "—";
};

const statusClass = (status) => {
  switch (status) {
    case "operational":
    case "active":
      return "status operational";

    case "maintenance":
      return "status maintenance";

    case "fault":
    case "failed":
      return "status danger";

    case "inactive":
    case "shutdown":
      return "status inactive";

    default:
      return "status inactive";
  }
};

const conditionClass = (condition) => {
  switch (condition) {
    case "excellent":
    case "good":
      return "condition good";

    case "fair":
      return "condition fair";

    case "poor":
      return "condition poor";

    case "critical":
    case "damaged":
      return "condition critical";

    default:
      return "condition fair";
  }
};

export default function InfrastructureElectrical() {
  const { user } = useAuth();
  const canManage = ["admin", "infrastructure"].includes(
    String(user?.role || "").toLowerCase()
  );
  const [systems, setSystems] = useState([]);
  const [filterOptions, setFilterOptions] = useState({
    types: [],
    buildings: [],
    locations: [],
    statuses: [],
    conditions: [],
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [condition, setCondition] = useState("all");
  const [type, setType] = useState("all");
  const [location, setLocation] = useState("all");

  const [page, setPage] = useState(1);

  const [pagination, setPagination] = useState({
    total: 0,
    totalPages: 1,
    page: 1,
  });

  const [selectedSystem, setSelectedSystem] =
    useState(null);

  const [showForm, setShowForm] = useState(false);
  const [editingSystem, setEditingSystem] =
    useState(null);

  const [form, setForm] = useState(EMPTY_FORM);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  const loadSystems = useCallback(
    async ({ silent = false } = {}) => {
      try {
        if (silent) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");

        const response = await api.get(
          "/api/infrastructure/electrical",
          {
            params: {
              page,
              limit: PAGE_SIZE,
              search: search.trim(),
              status:
                status === "all" ? "" : status,
              condition:
                condition === "all"
                  ? ""
                  : condition,
              type:
                type === "all" ? "" : type,
              location:
                location === "all"
                  ? ""
                  : location,
            },
          }
        );

        const rows = extractRows(response);

        setSystems(rows);
        setFilterOptions(response?.data?.filters || {
          types: [],
          buildings: [],
          locations: [],
          statuses: [],
          conditions: [],
        });
        setPagination(
          extractPagination(response, page)
        );
      } catch (err) {
        console.error(
          "Electrical systems load error:",
          err
        );

        setError(
          err?.response?.data?.message ||
            err?.response?.data?.error ||
            err?.message ||
            "Unable to load electrical systems."
        );

        setSystems([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      page,
      search,
      status,
      condition,
      type,
      location,
    ]
  );

  useEffect(() => {
    loadSystems();
  }, [loadSystems]);

  useEffect(() => {
    setPage(1);
  }, [
    search,
    status,
    condition,
    type,
    location,
  ]);

  const types = filterOptions.types || [];
  const locations = filterOptions.locations || [];

  const summary = useMemo(() => {
    return {
      total: pagination.total,

      operational: systems.filter((item) => {
        const current = getStatus(item);
        return (
          current === "operational" ||
          current === "active"
        );
      }).length,

      maintenance: systems.filter(
        (item) =>
          getStatus(item) === "maintenance"
      ).length,

      fault: systems.filter((item) => {
        const current = getStatus(item);
        return (
          current === "fault" ||
          current === "failed"
        );
      }).length,

      critical: systems.filter((item) => {
        const current = getCondition(item);
        return (
          current === "critical" ||
          current === "damaged"
        );
      }).length,

      locations: new Set(
        systems
          .map((item) => getLocation(item))
          .filter((item) => item !== "—")
      ).size,
    };
  }, [systems]);

  const openCreate = () => {
    setEditingSystem(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setFormSuccess("");
    setShowForm(true);
  };

  const openEdit = (system) => {
    setEditingSystem(system);

    setForm({
      name:
        getName(system) ===
        "Unnamed Electrical System"
          ? ""
          : getName(system),

      code:
        getCode(system) === "—"
          ? ""
          : getCode(system),

      systemType: getType(system),

      location:
        getLocation(system) === "—"
          ? ""
          : getLocation(system),

      voltage:
        getVoltage(system) === "—"
          ? ""
          : getVoltage(system),

      capacity:
        getCapacity(system) === "—"
          ? ""
          : getCapacity(system),

      status:
        getStatus(system) ||
        "operational",

      condition:
        getCondition(system) ||
        "good",

      installationDate:
        getInstallationDate(system)
          ? String(
              getInstallationDate(system)
            ).slice(0, 10)
          : "",

      lastInspectionDate:
        getLastInspectionDate(system)
          ? String(
              getLastInspectionDate(system)
            ).slice(0, 10)
          : "",

      nextInspectionDate:
        getNextInspectionDate(system)
          ? String(
              getNextInspectionDate(system)
            ).slice(0, 10)
          : "",

      description:
        getDescription(system),
    });

    setFormError("");
    setFormSuccess("");
    setShowForm(true);
  };

  const closeForm = () => {
    if (saving) return;

    setShowForm(false);
    setEditingSystem(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setFormSuccess("");
  };

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const validateForm = () => {
    if (!form.name.trim()) {
      return "Electrical system name is required.";
    }

    if (!form.systemType.trim()) {
      return "System type is required.";
    }

    if (!form.location.trim()) {
      return "Location is required.";
    }

    return "";
  };

  const saveSystem = async (event) => {
    event.preventDefault();

    const validationError =
      validateForm();

    if (validationError) {
      setFormError(validationError);
      return;
    }

    try {
      setSaving(true);
      setFormError("");
      setFormSuccess("");

      const payload = {
        name: form.name.trim(),
        assetCode: form.code.trim(),
        type: form.systemType.trim(),
        category: "Electrical Equipment",
        location:
          form.location.trim(),
        voltage:
          form.voltage.trim(),
        capacity:
          form.capacity.trim(),
        status: form.status,
        condition: form.condition,
        installationDate:
          form.installationDate || null,
        lastInspectionDate:
          form.lastInspectionDate || null,
        nextInspectionDate:
          form.nextInspectionDate || null,
        description:
          form.description.trim(),
      };

      let response;

      if (editingSystem) {
        const id = getId(editingSystem);

        if (!id) {
          throw new Error(
            "The selected electrical system does not have a valid ID."
          );
        }

        response = await api.put(
          `/api/infrastructure/electrical/${id}`,
          payload
        );
      } else {
        response = await api.post(
          "/api/infrastructure/electrical",
          payload
        );
      }

      setFormSuccess(
        response?.data?.message ||
          (editingSystem
            ? "Electrical system updated successfully."
            : "Electrical system created successfully.")
      );

      await loadSystems({
        silent: true,
      });

      setTimeout(() => {
        closeForm();
      }, 700);
    } catch (err) {
      console.error(
        "Electrical system save error:",
        err
      );

      setFormError(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Unable to save electrical system."
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteSystem = async (system) => {
    const id = getId(system);

    if (!id) {
      setError(
        "The selected electrical system does not have a valid ID."
      );
      return;
    }

    const confirmed = window.confirm(
      `Delete "${getName(system)}"? This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      setDeleting(true);
      setError("");

      await api.delete(
        `/api/infrastructure/electrical/${id}`
      );

      setSelectedSystem(null);

      await loadSystems({
        silent: true,
      });
    } catch (err) {
      console.error(
        "Electrical system delete error:",
        err
      );

      setError(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Unable to delete electrical system."
      );
    } finally {
      setDeleting(false);
    }
  };

  const pageNumbers = useMemo(() => {
    const total = pagination.totalPages;

    if (total <= 5) {
      return Array.from(
        { length: total },
        (_, index) => index + 1
      );
    }

    if (page <= 3) {
      return [1, 2, 3, 4, 5];
    }

    if (page >= total - 2) {
      return [
        total - 4,
        total - 3,
        total - 2,
        total - 1,
        total,
      ];
    }

    return [
      page - 2,
      page - 1,
      page,
      page + 1,
      page + 2,
    ];
  }, [page, pagination.totalPages]);

  return (
    <div className="electrical-page">
      <style>{`
        * {
          box-sizing: border-box;
        }

        .electrical-page {
          min-height: 100vh;
          background: #f8fafc;
          color: #0f172a;
          padding: 24px;
          font-family: Inter, ui-sans-serif, system-ui,
            -apple-system, BlinkMacSystemFont,
            "Segoe UI", sans-serif;
        }

        .electrical-container {
          max-width: 1500px;
          margin: 0 auto;
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 20px;
          margin-bottom: 24px;
        }

        .header-left {
          display: flex;
          align-items: flex-start;
          gap: 14px;
        }

        .header-icon {
          width: 50px;
          height: 50px;
          border-radius: 14px;
          background: #0ea5e9;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          box-shadow: 0 8px 20px rgba(14, 165, 233, 0.2);
        }

        .page-title {
          margin: 0;
          font-size: 28px;
          line-height: 1.2;
          font-weight: 800;
          color: #0f172a;
        }

        .page-subtitle {
          margin: 6px 0 0;
          color: #64748b;
          font-size: 14px;
        }

        .header-actions {
          display: flex;
          gap: 9px;
          flex-wrap: wrap;
        }

        .btn {
          min-height: 42px;
          padding: 0 14px;
          border-radius: 10px;
          border: 1px solid #e2e8f0;
          background: white;
          color: #334155;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          text-decoration: none;
          transition: 0.2s ease;
        }

        .btn:hover {
          border-color: #bae6fd;
          background: #f0f9ff;
          color: #0369a1;
        }

        .btn.primary {
          background: #0ea5e9;
          border-color: #0ea5e9;
          color: white;
        }

        .btn.primary:hover {
          background: #0284c7;
          border-color: #0284c7;
          color: white;
        }

        .btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 22px;
        }

        .summary-card {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 17px;
          box-shadow: 0 3px 12px rgba(15, 23, 42, 0.04);
        }

        .summary-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 13px;
        }

        .summary-label {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          font-weight: 800;
          color: #64748b;
        }

        .summary-icon {
          width: 35px;
          height: 35px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .blue {
          background: #e0f2fe;
          color: #0284c7;
        }

        .green {
          background: #dcfce7;
          color: #15803d;
        }

        .orange {
          background: #ffedd5;
          color: #c2410c;
        }

        .red {
          background: #fee2e2;
          color: #dc2626;
        }

        .purple {
          background: #f3e8ff;
          color: #7e22ce;
        }

        .summary-number {
          font-size: 25px;
          line-height: 1;
          font-weight: 800;
          color: #0f172a;
        }

        .toolbar {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 15px;
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          margin-bottom: 16px;
          box-shadow: 0 3px 12px rgba(15, 23, 42, 0.03);
        }

        .search-box {
          position: relative;
          flex: 1;
          min-width: 260px;
        }

        .search-box svg {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
        }

        .search-box input {
          width: 100%;
          height: 42px;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 0 13px 0 40px;
          outline: none;
          font-size: 13px;
          color: #0f172a;
        }

        .search-box input:focus,
        .select-control:focus,
        .form-control:focus {
          border-color: #38bdf8;
          box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.1);
        }

        .select-control {
          min-width: 145px;
          height: 42px;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          background: white;
          padding: 0 12px;
          outline: none;
          color: #334155;
          font-size: 13px;
          font-weight: 600;
        }

        .filter-label {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          color: #64748b;
          font-size: 13px;
          font-weight: 700;
        }

        .table-card {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          overflow: hidden;
          box-shadow: 0 3px 12px rgba(15, 23, 42, 0.04);
        }

        .table-header {
          padding: 17px 18px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 15px;
          border-bottom: 1px solid #e2e8f0;
        }

        .table-title {
          margin: 0;
          font-size: 16px;
          font-weight: 800;
        }

        .table-count {
          color: #64748b;
          font-size: 12px;
          margin-top: 4px;
        }

        .table-wrapper {
          overflow-x: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          min-width: 1250px;
        }

        th {
          padding: 13px 15px;
          text-align: left;
          background: #f8fafc;
          color: #64748b;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          border-bottom: 1px solid #e2e8f0;
          white-space: nowrap;
        }

        td {
          padding: 14px 15px;
          border-bottom: 1px solid #f1f5f9;
          color: #334155;
          font-size: 13px;
          vertical-align: middle;
        }

        tbody tr:hover {
          background: #f8fafc;
        }

        .system-cell {
          display: flex;
          align-items: center;
          gap: 11px;
        }

        .system-icon {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          background: #e0f2fe;
          color: #0284c7;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .system-name {
          font-weight: 800;
          color: #0f172a;
          margin-bottom: 3px;
        }

        .system-code {
          color: #64748b;
          font-size: 11px;
        }

        .location-cell {
          display: flex;
          align-items: center;
          gap: 7px;
        }

        .location-cell svg {
          color: #0ea5e9;
          flex-shrink: 0;
        }

        .metric {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-weight: 700;
        }

        .metric svg {
          color: #64748b;
        }

        .status,
        .condition {
          display: inline-flex;
          align-items: center;
          padding: 6px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 800;
        }

        .status.operational {
          background: #dcfce7;
          color: #166534;
        }

        .status.maintenance {
          background: #ffedd5;
          color: #9a3412;
        }

        .status.danger {
          background: #fee2e2;
          color: #991b1b;
        }

        .status.inactive {
          background: #f1f5f9;
          color: #475569;
        }

        .condition.good {
          background: #dcfce7;
          color: #166534;
        }

        .condition.fair {
          background: #fef9c3;
          color: #854d0e;
        }

        .condition.poor {
          background: #ffedd5;
          color: #9a3412;
        }

        .condition.critical {
          background: #fee2e2;
          color: #991b1b;
        }

        .action-buttons {
          display: flex;
          gap: 6px;
        }

        .icon-btn {
          width: 34px;
          height: 34px;
          border-radius: 9px;
          border: 1px solid #e2e8f0;
          background: white;
          color: #475569;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .icon-btn:hover {
          background: #f0f9ff;
          border-color: #bae6fd;
          color: #0284c7;
        }

        .icon-btn.danger:hover {
          background: #fef2f2;
          border-color: #fecaca;
          color: #dc2626;
        }

        .empty-state,
        .loading-state {
          padding: 55px 20px;
          text-align: center;
          color: #64748b;
        }

        .empty-icon {
          width: 60px;
          height: 60px;
          margin: 0 auto 14px;
          border-radius: 16px;
          background: #f1f5f9;
          color: #64748b;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .empty-state h3 {
          margin: 0 0 6px;
          color: #334155;
          font-size: 16px;
        }

        .empty-state p {
          margin: 0;
          font-size: 13px;
        }

        .loading-state svg {
          animation: spin 0.9s linear infinite;
        }

        .error-box {
          margin-bottom: 16px;
          background: #fef2f2;
          color: #991b1b;
          border: 1px solid #fecaca;
          border-radius: 11px;
          padding: 12px 14px;
          display: flex;
          align-items: center;
          gap: 9px;
          font-size: 13px;
          font-weight: 600;
        }

        .pagination {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          padding: 14px 17px;
          border-top: 1px solid #e2e8f0;
        }

        .pagination-info {
          color: #64748b;
          font-size: 12px;
        }

        .pagination-buttons {
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .page-btn {
          min-width: 34px;
          height: 34px;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          background: white;
          color: #475569;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
        }

        .page-btn:hover:not(:disabled) {
          background: #f0f9ff;
          border-color: #bae6fd;
          color: #0284c7;
        }

        .page-btn.active {
          background: #0ea5e9;
          border-color: #0ea5e9;
          color: white;
        }

        .page-btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 1000;
          background: rgba(15, 23, 42, 0.55);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }

        .modal {
          width: min(820px, 100%);
          max-height: calc(100vh - 40px);
          overflow-y: auto;
          background: white;
          border-radius: 16px;
          box-shadow: 0 24px 70px rgba(15, 23, 42, 0.25);
        }

        .modal-header {
          padding: 18px 20px;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
        }

        .modal-title {
          margin: 0;
          font-size: 18px;
          font-weight: 800;
          color: #0f172a;
        }

        .modal-close {
          width: 34px;
          height: 34px;
          border: none;
          border-radius: 9px;
          background: #f1f5f9;
          color: #475569;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .modal-body {
          padding: 20px;
        }

        .detail-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 13px;
        }

        .detail-card {
          padding: 13px;
          border-radius: 11px;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
        }

        .detail-label {
          color: #64748b;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          font-weight: 800;
          margin-bottom: 5px;
        }

        .detail-value {
          color: #0f172a;
          font-size: 13px;
          font-weight: 700;
          word-break: break-word;
        }

        .description-box {
          margin-top: 14px;
          border: 1px solid #e2e8f0;
          border-radius: 11px;
          padding: 14px;
        }

        .description-text {
          color: #475569;
          font-size: 13px;
          line-height: 1.6;
          white-space: pre-wrap;
        }

        .modal-footer {
          padding: 15px 20px;
          border-top: 1px solid #e2e8f0;
          display: flex;
          justify-content: flex-end;
          gap: 9px;
          flex-wrap: wrap;
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .form-group {
          margin-bottom: 2px;
        }

        .form-group.full {
          grid-column: 1 / -1;
        }

        .form-label {
          display: block;
          color: #334155;
          font-size: 12px;
          font-weight: 800;
          margin-bottom: 7px;
        }

        .required {
          color: #dc2626;
        }

        .form-control {
          width: 100%;
          min-height: 42px;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 9px 12px;
          outline: none;
          color: #0f172a;
          background: white;
          font-size: 13px;
          font-family: inherit;
        }

        textarea.form-control {
          min-height: 100px;
          resize: vertical;
        }

        .form-alert {
          margin-bottom: 15px;
          border-radius: 10px;
          padding: 11px 12px;
          display: flex;
          gap: 8px;
          align-items: flex-start;
          font-size: 12px;
          font-weight: 600;
        }

        .form-alert.error {
          background: #fef2f2;
          color: #991b1b;
          border: 1px solid #fecaca;
        }

        .form-alert.success {
          background: #f0fdf4;
          color: #166534;
          border: 1px solid #bbf7d0;
        }

        .spinner {
          animation: spin 0.9s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 1250px) {
          .summary-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 800px) {
          .electrical-page {
            padding: 15px;
          }

          .page-header {
            flex-direction: column;
          }

          .header-actions {
            width: 100%;
          }

          .header-actions .btn {
            flex: 1;
          }

          .summary-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .detail-grid,
          .form-grid {
            grid-template-columns: 1fr;
          }

          .form-group.full {
            grid-column: auto;
          }

          .pagination {
            flex-direction: column;
            align-items: flex-start;
          }
        }

        @media (max-width: 520px) {
          .summary-grid {
            grid-template-columns: 1fr;
          }

          .search-box {
            min-width: 100%;
          }

          .select-control {
            width: 100%;
          }

          .toolbar .btn {
            width: 100%;
          }

          .page-title {
            font-size: 23px;
          }
        }
      `}</style>

      <div className="electrical-container">
        {/* HEADER */}
        <div className="page-header">
          <div className="header-left">
            <div className="header-icon">
              <Zap size={25} />
            </div>

            <div>
              <h1 className="page-title">
                Electrical Systems
              </h1>

              <p className="page-subtitle">
                Manage, monitor, inspect, and maintain
                university electrical infrastructure.
              </p>
            </div>
          </div>

          <div className="header-actions">
            <Link
              to="/infrastructure"
              className="btn"
            >
              <ArrowLeft size={16} />
              Dashboard
            </Link>

            <button
              type="button"
              className="btn"
              onClick={() =>
                loadSystems({ silent: true })
              }
              disabled={refreshing}
            >
              <RefreshCw
                size={16}
                className={
                  refreshing ? "spinner" : ""
                }
              />
              Refresh
            </button>

            {canManage && (
              <button
                type="button"
                className="btn primary"
                onClick={openCreate}
              >
                <Plus size={17} />
                Add Electrical System
              </button>
            )}
          </div>
        </div>

        {/* SUMMARY */}
        <div className="summary-grid">
          <div className="summary-card">
            <div className="summary-top">
              <span className="summary-label">
                Total Systems
              </span>

              <span className="summary-icon blue">
                <Zap size={18} />
              </span>
            </div>

            <div className="summary-number">{summary.total}</div>
          </div>

          <div className="summary-card">
            <div className="summary-top">
              <span className="summary-label">
                Operational
              </span>

              <span className="summary-icon green">
                <CheckCircle2 size={18} />
              </span>
            </div>

            <div className="summary-number">
              {summary.operational}
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-top">
              <span className="summary-label">
                Maintenance
              </span>

              <span className="summary-icon orange">
                <RefreshCw size={18} />
              </span>
            </div>

            <div className="summary-number">
              {summary.maintenance}
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-top">
              <span className="summary-label">
                Fault / Failed
              </span>

              <span className="summary-icon red">
                <CircleAlert size={18} />
              </span>
            </div>

            <div className="summary-number">
              {summary.fault}
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-top">
              <span className="summary-label">
                Critical Condition
              </span>

              <span className="summary-icon red">
                <AlertCircle size={18} />
              </span>
            </div>

            <div className="summary-number">
              {summary.critical}
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-top">
              <span className="summary-label">
                Locations
              </span>

              <span className="summary-icon purple">
                <MapPin size={18} />
              </span>
            </div>

            <div className="summary-number">
              {summary.locations}
            </div>
          </div>
        </div>

        {error && (
          <div className="error-box">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {/* FILTERS */}
        <div className="toolbar">
          <div className="search-box">
            <Search size={17} />

            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search system, code, location..."
            />
          </div>

          <span className="filter-label">
            <Filter size={15} />
            Filters
          </span>

          <select
            className="select-control"
            value={status}
            onChange={(event) =>
              setStatus(event.target.value)
            }
          >
            <option value="all">
              All statuses
            </option>

            {(filterOptions.statuses || []).map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>

          <select
            className="select-control"
            value={condition}
            onChange={(event) =>
              setCondition(event.target.value)
            }
          >
            <option value="all">
              All conditions
            </option>

            {(filterOptions.conditions || []).map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>

          <select
            className="select-control"
            value={type}
            onChange={(event) =>
              setType(event.target.value)
            }
          >
            <option value="all">
              All system types
            </option>

            {types.map((item) => (
              <option
                key={item}
                value={item}
              >
                {item}
              </option>
            ))}
          </select>

          <select
            className="select-control"
            value={location}
            onChange={(event) =>
              setLocation(event.target.value)
            }
          >
            <option value="all">
              All locations
            </option>

            {locations.map((item) => (
              <option
                key={item}
                value={item}
              >
                {item}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="btn"
            onClick={() => {
              setSearch("");
              setStatus("all");
              setCondition("all");
              setType("all");
              setLocation("all");
            }}
          >
            Clear
          </button>
        </div>

        {/* TABLE */}
        <div className="table-card">
          <div className="table-header">
            <div>
              <h2 className="table-title">
                Electrical Infrastructure
              </h2>

              <div className="table-count">
                {pagination.total ||
                  systems.length}{" "}
                records
              </div>
            </div>

            <button
              type="button"
              className="btn"
              onClick={() =>
                loadSystems({ silent: true })
              }
              disabled={refreshing}
            >
              <RefreshCw
                size={15}
                className={
                  refreshing ? "spinner" : ""
                }
              />
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="loading-state">
              <RefreshCw size={28} />
              <p>
                Loading electrical systems...
              </p>
            </div>
          ) : systems.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                <Zap size={29} />
              </div>

              <h3>
                No electrical systems found
              </h3>

              <p>
                No records match the current
                search and filter settings.
              </p>
            </div>
          ) : (
            <>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Electrical System</th>
                      <th>Type</th>
                      <th>Location</th>
                      <th>Voltage</th>
                      <th>Capacity</th>
                      <th>Status</th>
                      <th>Condition</th>
                      <th>Next Inspection</th>
                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {systems.map((system) => {
                      const id = getId(system);

                      return (
                        <tr
                          key={
                            id ||
                            `${getCode(
                              system
                            )}-${getName(system)}`
                          }
                        >
                          <td>
                            <div className="system-cell">
                              <div className="system-icon">
                                <Zap size={18} />
                              </div>

                              <div>
                                <div className="system-name">
                                  {getName(system)}
                                </div>

                                <div className="system-code">
                                  Code:{" "}
                                  {getCode(system)}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td>
                            {getType(system)}
                          </td>

                          <td>
                            <div className="location-cell">
                              <MapPin size={15} />
                              {getLocation(system)}
                            </div>
                          </td>

                          <td>
                            <span className="metric">
                              <Gauge size={15} />
                              {getVoltage(system)}
                            </span>
                          </td>

                          <td>
                            {getCapacity(system)}
                          </td>

                          <td>
                            <span
                              className={statusClass(
                                getStatus(system)
                              )}
                            >
                              {statusLabel(
                                getStatus(system)
                              )}
                            </span>
                          </td>

                          <td>
                            <span
                              className={conditionClass(
                                getCondition(system)
                              )}
                            >
                              {conditionLabel(
                                getCondition(system)
                              )}
                            </span>
                          </td>

                          <td>
                            {formatDate(
                              getNextInspectionDate(
                                system
                              )
                            )}
                          </td>

                          <td>
                            <div className="action-buttons">
                              <button
                                type="button"
                                className="icon-btn"
                                title="View details"
                                onClick={() =>
                                  setSelectedSystem(
                                    system
                                  )
                                }
                              >
                                <Eye size={16} />
                              </button>

                              <button
                                type="button"
                                className="icon-btn"
                                title="Edit system"
                                onClick={() =>
                                  openEdit(system)
                                }
                              >
                                <Edit3 size={16} />
                              </button>

                              <button
                                type="button"
                                className="icon-btn danger"
                                title="Delete system"
                                disabled={deleting}
                                onClick={() =>
                                  deleteSystem(system)
                                }
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="pagination">
                <div className="pagination-info">
                  Page {page} of{" "}
                  {pagination.totalPages}

                  {pagination.total
                    ? ` • ${pagination.total} total records`
                    : ""}
                </div>

                <div className="pagination-buttons">
                  <button
                    type="button"
                    className="page-btn"
                    disabled={page <= 1}
                    onClick={() =>
                      setPage(page - 1)
                    }
                  >
                    <ChevronLeft size={16} />
                  </button>

                  {pageNumbers.map(
                    (pageNumber) => (
                      <button
                        key={pageNumber}
                        type="button"
                        className={`page-btn ${
                          pageNumber === page
                            ? "active"
                            : ""
                        }`}
                        onClick={() =>
                          setPage(pageNumber)
                        }
                      >
                        {pageNumber}
                      </button>
                    )
                  )}

                  <button
                    type="button"
                    className="page-btn"
                    disabled={
                      page >=
                      pagination.totalPages
                    }
                    onClick={() =>
                      setPage(page + 1)
                    }
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* DETAILS MODAL */}
      {selectedSystem && !showForm && (
        <div
          className="modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setSelectedSystem(null);
            }
          }}
        >
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">
                Electrical System Details
              </h2>

              <button
                type="button"
                className="modal-close"
                onClick={() =>
                  setSelectedSystem(null)
                }
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <div className="detail-grid">
                <div className="detail-card">
                  <div className="detail-label">
                    System Name
                  </div>

                  <div className="detail-value">
                    {getName(
                      selectedSystem
                    )}
                  </div>
                </div>

                <div className="detail-card">
                  <div className="detail-label">
                    System Code
                  </div>

                  <div className="detail-value">
                    {getCode(
                      selectedSystem
                    )}
                  </div>
                </div>

                <div className="detail-card">
                  <div className="detail-label">
                    System Type
                  </div>

                  <div className="detail-value">
                    {getType(
                      selectedSystem
                    )}
                  </div>
                </div>

                <div className="detail-card">
                  <div className="detail-label">
                    Location
                  </div>

                  <div className="detail-value">
                    {getLocation(
                      selectedSystem
                    )}
                  </div>
                </div>

                <div className="detail-card">
                  <div className="detail-label">
                    Voltage
                  </div>

                  <div className="detail-value">
                    {getVoltage(
                      selectedSystem
                    )}
                  </div>
                </div>

                <div className="detail-card">
                  <div className="detail-label">
                    Capacity
                  </div>

                  <div className="detail-value">
                    {getCapacity(
                      selectedSystem
                    )}
                  </div>
                </div>

                <div className="detail-card">
                  <div className="detail-label">
                    Status
                  </div>

                  <div className="detail-value">
                    <span
                      className={statusClass(
                        getStatus(
                          selectedSystem
                        )
                      )}
                    >
                      {statusLabel(
                        getStatus(
                          selectedSystem
                        )
                      )}
                    </span>
                  </div>
                </div>

                <div className="detail-card">
                  <div className="detail-label">
                    Condition
                  </div>

                  <div className="detail-value">
                    <span
                      className={conditionClass(
                        getCondition(
                          selectedSystem
                        )
                      )}
                    >
                      {conditionLabel(
                        getCondition(
                          selectedSystem
                        )
                      )}
                    </span>
                  </div>
                </div>

                <div className="detail-card">
                  <div className="detail-label">
                    Installation Date
                  </div>

                  <div className="detail-value">
                    {formatDate(
                      getInstallationDate(
                        selectedSystem
                      )
                    )}
                  </div>
                </div>

                <div className="detail-card">
                  <div className="detail-label">
                    Last Inspection
                  </div>

                  <div className="detail-value">
                    {formatDate(
                      getLastInspectionDate(
                        selectedSystem
                      )
                    )}
                  </div>
                </div>

                <div className="detail-card">
                  <div className="detail-label">
                    Next Inspection
                  </div>

                  <div className="detail-value">
                    {formatDate(
                      getNextInspectionDate(
                        selectedSystem
                      )
                    )}
                  </div>
                </div>
              </div>

              <div className="description-box">
                <div className="detail-label">
                  Description
                </div>

                <div className="description-text">
                  {getDescription(
                    selectedSystem
                  ) ||
                    "No description has been recorded."}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn"
                onClick={() =>
                  openEdit(selectedSystem)
                }
              >
                <Edit3 size={16} />
                Edit
              </button>

              <button
                type="button"
                className="btn"
                onClick={() =>
                  setSelectedSystem(null)
                }
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {showForm && (
        <div
          className="modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
                event.currentTarget &&
              !saving
            ) {
              closeForm();
            }
          }}
        >
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">
                {editingSystem
                  ? "Edit Electrical System"
                  : "Add Electrical System"}
              </h2>

              <button
                type="button"
                className="modal-close"
                disabled={saving}
                onClick={closeForm}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={saveSystem}>
              <div className="modal-body">
                {formError && (
                  <div className="form-alert error">
                    <AlertCircle size={17} />
                    <span>{formError}</span>
                  </div>
                )}

                {formSuccess && (
                  <div className="form-alert success">
                    <CheckCircle2 size={17} />
                    <span>{formSuccess}</span>
                  </div>
                )}

                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">
                      System Name{" "}
                      <span className="required">
                        *
                      </span>
                    </label>

                    <input
                      className="form-control"
                      name="name"
                      value={form.name}
                      onChange={handleChange}
                      placeholder="e.g. Main Distribution System"
                      disabled={saving}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      System Code
                    </label>

                    <input
                      className="form-control"
                      name="code"
                      value={form.code}
                      onChange={handleChange}
                      placeholder="e.g. ELEC-SYS-001"
                      disabled={saving}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      System Type{" "}
                      <span className="required">
                        *
                      </span>
                    </label>

                    <select
                      className="form-control"
                      name="systemType"
                      value={form.systemType}
                      onChange={handleChange}
                      disabled={saving}
                    >
                      {types.map((item) => (
                        <option key={item} value={item}>{item}</option>
                      ))}
                      {!types.includes(form.systemType) && form.systemType && (
                        <option value={form.systemType}>{form.systemType}</option>
                      )}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Location{" "}
                      <span className="required">
                        *
                      </span>
                    </label>

                    <input
                      className="form-control"
                      name="location"
                      value={form.location}
                      onChange={handleChange}
                      placeholder="Building / block / area"
                      disabled={saving}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Voltage Rating
                    </label>

                    <input
                      className="form-control"
                      name="voltage"
                      value={form.voltage}
                      onChange={handleChange}
                      placeholder="e.g. 400V"
                      disabled={saving}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Capacity / Rating
                    </label>

                    <input
                      className="form-control"
                      name="capacity"
                      value={form.capacity}
                      onChange={handleChange}
                      placeholder="e.g. 500 kVA"
                      disabled={saving}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Operational Status
                    </label>

                    <select
                      className="form-control"
                      name="status"
                      value={form.status}
                      onChange={handleChange}
                      disabled={saving}
                    >
                      {(filterOptions.statuses || []).map((item) => (
                        <option key={item} value={item}>{item}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Condition
                    </label>

                    <select
                      className="form-control"
                      name="condition"
                      value={form.condition}
                      onChange={handleChange}
                      disabled={saving}
                    >
                      {(filterOptions.conditions || []).map((item) => (
                        <option key={item} value={item}>{item}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Installation Date
                    </label>

                    <input
                      className="form-control"
                      type="date"
                      name="installationDate"
                      value={form.installationDate}
                      onChange={handleChange}
                      disabled={saving}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Last Inspection Date
                    </label>

                    <input
                      className="form-control"
                      type="date"
                      name="lastInspectionDate"
                      value={form.lastInspectionDate}
                      onChange={handleChange}
                      disabled={saving}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Next Inspection Date
                    </label>

                    <input
                      className="form-control"
                      type="date"
                      name="nextInspectionDate"
                      value={form.nextInspectionDate}
                      onChange={handleChange}
                      disabled={saving}
                    />
                  </div>

                  <div className="form-group full">
                    <label className="form-label">
                      Description
                    </label>

                    <textarea
                      className="form-control"
                      name="description"
                      value={form.description}
                      onChange={handleChange}
                      placeholder="Technical description, equipment information, or important notes..."
                      disabled={saving}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn"
                  onClick={closeForm}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="btn primary"
                  disabled={saving}
                >
                  {saving ? "Saving..." : editingSystem ? "Update System" : "Save System"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}