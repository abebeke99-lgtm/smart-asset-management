import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import {
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
  Zap,
} from "lucide-react";

const PAGE_SIZE = 10;

const EMPTY_FORM = {
  name: "",
  code: "",
  transformerType: "Distribution Transformer",
  manufacturer: "",
  model: "",
  location: "",
  capacity: "",
  primaryVoltage: "",
  secondaryVoltage: "",
  phase: "Three Phase",
  frequency: "50 Hz",
  coolingType: "",
  oilCapacity: "",
  serialNumber: "",
  status: "Operational",
  condition: "Good",
  lastInspectionDate: "",
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
  getValue(row, ["id", "transformer_id", "transformerId"], "");

const getName = (row) =>
  getValue(
    row,
    ["name", "transformer_name", "transformerName"],
    "Unnamed Transformer"
  );

const getCode = (row) =>
  getValue(
    row,
    ["assetCode", "asset_code", "code", "transformer_code", "transformerCode"],
    "—"
  );

const getType = (row) =>
  getValue(
    row,
    ["transformer_type", "transformerType", "type"],
    "Transformer"
  );

const getManufacturer = (row) =>
  getValue(
    row,
    ["manufacturer", "brand", "make"],
    "—"
  );

const getModel = (row) =>
  getValue(
    row,
    ["model", "model_number", "modelNumber"],
    "—"
  );

const getLocation = (row) =>
  getValue(
    row,
    ["location", "location_name", "locationName", "site"],
    "—"
  );

const getCapacity = (row) =>
  getValue(
    row,
    ["capacity", "power_capacity", "powerCapacity", "rating"],
    "—"
  );

const getPrimaryVoltage = (row) =>
  getValue(
    row,
    [
      "primary_voltage",
      "primaryVoltage",
      "input_voltage",
      "inputVoltage",
      "hv_voltage",
      "hvVoltage",
    ],
    "—"
  );

const getSecondaryVoltage = (row) =>
  getValue(
    row,
    [
      "secondary_voltage",
      "secondaryVoltage",
      "output_voltage",
      "outputVoltage",
      "lv_voltage",
      "lvVoltage",
    ],
    "—"
  );

const getPhase = (row) =>
  getValue(
    row,
    ["phase", "phase_type", "phaseType"],
    "—"
  );

const getFrequency = (row) =>
  getValue(
    row,
    ["frequency", "frequency_rating", "frequencyRating"],
    "—"
  );

const getCoolingType = (row) =>
  getValue(
    row,
    ["cooling_type", "coolingType", "cooling"],
    "—"
  );

const getOilCapacity = (row) =>
  getValue(
    row,
    ["oil_capacity", "oilCapacity"],
    "—"
  );

const getSerialNumber = (row) =>
  getValue(
    row,
    ["serial_number", "serialNumber", "serial"],
    "—"
  );

const getStatus = (row) =>
  normalize(
    getValue(
      row,
      ["status", "transformer_status", "transformerStatus"],
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
  getValue(
    row,
    ["description", "notes", "remarks"],
    ""
  );

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
  if (Array.isArray(data?.transformers)) return data.transformers;

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
    fault: "Fault",
    failed: "Failed",
    inactive: "Inactive",
    shutdown: "Shutdown",
  };

  return labels[status] || status || "Operational";
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

  return labels[condition] || condition || "Good";
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

export default function InfrastructureTransformers() {
  const { user } = useAuth();
  const canManage = ["admin", "infrastructure"].includes(
    String(user?.role || "").toLowerCase()
  );
  const [transformers, setTransformers] = useState([]);
  const [filterOptions, setFilterOptions] = useState({
    types: [],
    statuses: [],
    conditions: [],
    locations: [],
  });
  const [summaryData, setSummaryData] = useState({
    total: 0,
    operational: 0,
    maintenance: 0,
    inactive: 0,
    critical: 0,
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

  const [selectedTransformer, setSelectedTransformer] =
    useState(null);

  const [showForm, setShowForm] = useState(false);
  const [editingTransformer, setEditingTransformer] =
    useState(null);

  const [form, setForm] = useState(EMPTY_FORM);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  const loadTransformers = useCallback(
    async ({ silent = false } = {}) => {
      try {
        if (silent) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");

        const response = await api.get(
          "/infrastructure/transformers",
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
        const responseData = response?.data || {};

        setTransformers(rows);
        setSummaryData(responseData.summary || {});
        setFilterOptions(responseData.filters || {});
        setPagination(
          extractPagination(response, page)
        );
      } catch (err) {
        console.error(
          "Transformers load error:",
          err
        );

        setError(
          err?.response?.data?.message ||
            err?.response?.data?.error ||
            err?.message ||
            "Unable to load transformers."
        );

        setTransformers([]);
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
    loadTransformers();
  }, [loadTransformers]);

  useEffect(() => {
    setPage(1);
  }, [
    search,
    status,
    condition,
    type,
    location,
  ]);

  const summary = useMemo(() => {
    return summaryData;
  }, [summaryData]);

  const openCreate = () => {
    setEditingTransformer(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setFormSuccess("");
    setShowForm(true);
  };

  const openEdit = (transformer) => {
    setEditingTransformer(transformer);

    setForm({
      name:
        getName(transformer) ===
        "Unnamed Transformer"
          ? ""
          : getName(transformer),

      code:
        getCode(transformer) === "—"
          ? ""
          : getCode(transformer),

      transformerType: getType(transformer),

      manufacturer:
        getManufacturer(transformer) === "—"
          ? ""
          : getManufacturer(transformer),

      model:
        getModel(transformer) === "—"
          ? ""
          : getModel(transformer),

      location:
        getLocation(transformer) === "—"
          ? ""
          : getLocation(transformer),

      capacity:
        getCapacity(transformer) === "—"
          ? ""
          : getCapacity(transformer),

      primaryVoltage:
        getPrimaryVoltage(transformer) === "—"
          ? ""
          : getPrimaryVoltage(transformer),

      secondaryVoltage:
        getSecondaryVoltage(transformer) === "—"
          ? ""
          : getSecondaryVoltage(transformer),

      phase:
        getPhase(transformer) === "—"
          ? "Three Phase"
          : getPhase(transformer),

      frequency:
        getFrequency(transformer) === "—"
          ? "50 Hz"
          : getFrequency(transformer),

      coolingType:
        getCoolingType(transformer) === "—"
          ? ""
          : getCoolingType(transformer),

      oilCapacity:
        getOilCapacity(transformer) === "—"
          ? ""
          : getOilCapacity(transformer),

      serialNumber:
        getSerialNumber(transformer) === "—"
          ? ""
          : getSerialNumber(transformer),

      status:
        getStatus(transformer) ||
        "operational",

      condition:
        getCondition(transformer) ||
        "good",

      lastInspectionDate:
        getLastInspectionDate(transformer)
          ? String(
              getLastInspectionDate(transformer)
            ).slice(0, 10)
          : "",

      description:
        getDescription(transformer),
    });

    setFormError("");
    setFormSuccess("");
    setShowForm(true);
  };

  const closeForm = () => {
    if (saving) return;

    setShowForm(false);
    setEditingTransformer(null);
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
      return "Transformer name is required.";
    }

    if (!form.transformerType.trim()) {
      return "Transformer type is required.";
    }

    if (!form.location.trim()) {
      return "Location is required.";
    }

    return "";
  };

  const saveTransformer = async (event) => {
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
        code: form.code.trim(),
        transformerType:
          form.transformerType.trim(),
        manufacturer:
          form.manufacturer.trim(),
        model: form.model.trim(),
        location:
          form.location.trim(),
        capacity:
          form.capacity.trim(),
        primaryVoltage:
          form.primaryVoltage.trim(),
        secondaryVoltage:
          form.secondaryVoltage.trim(),
        phase: form.phase,
        frequency: form.frequency,
        coolingType:
          form.coolingType.trim(),
        oilCapacity:
          form.oilCapacity.trim(),
        serialNumber:
          form.serialNumber.trim(),
        status: form.status,
        condition: form.condition,
        lastInspectionDate:
          form.lastInspectionDate || null,
        description:
          form.description.trim(),
      };

      let response;

      if (editingTransformer) {
        const id = getId(editingTransformer);

        if (!id) {
          throw new Error(
            "The selected transformer does not have a valid ID."
          );
        }

        response = await api.put(
          `/infrastructure/transformers/${id}`,
          payload
        );
      } else {
        response = await api.post(
          "/infrastructure/transformers",
          payload
        );
      }

      setFormSuccess(
        response?.data?.message ||
          (editingTransformer
            ? "Transformer updated successfully."
            : "Transformer created successfully.")
      );

      await loadTransformers({
        silent: true,
      });

      setTimeout(() => {
        closeForm();
      }, 700);
    } catch (err) {
      console.error(
        "Transformer save error:",
        err
      );

      setFormError(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Unable to save transformer."
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteTransformer = async (transformer) => {
    const id = getId(transformer);

    if (!id) {
      setError(
        "The selected transformer does not have a valid ID."
      );
      return;
    }

    const confirmed = window.confirm(
      `Delete "${getName(transformer)}"? This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      setDeleting(true);
      setError("");

      await api.delete(
        `/infrastructure/transformers/${id}`
      );

      setSelectedTransformer(null);

      await loadTransformers({
        silent: true,
      });
    } catch (err) {
      console.error(
        "Transformer delete error:",
        err
      );

      setError(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Unable to delete transformer."
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
    <div className="transformers-page">
      <style>{`
        * {
          box-sizing: border-box;
        }

        .transformers-page {
          min-height: 100vh;
          background: #f8fafc;
          color: #0f172a;
          padding: 24px;
          font-family: Inter, ui-sans-serif, system-ui,
            -apple-system, BlinkMacSystemFont,
            "Segoe UI", sans-serif;
        }

        .transformers-container {
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
          min-width: 1450px;
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

        .transformer-cell {
          display: flex;
          align-items: center;
          gap: 11px;
        }

        .transformer-icon {
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

        .transformer-name {
          font-weight: 800;
          color: #0f172a;
          margin-bottom: 3px;
        }

        .transformer-code {
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

        .voltage {
          font-weight: 700;
          white-space: nowrap;
        }

        .voltage small {
          display: block;
          color: #64748b;
          margin-top: 3px;
          font-size: 10px;
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
          width: min(920px, 100%);
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
          .transformers-page {
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

      <div className="transformers-container">
        <div className="page-header">
          <div className="header-left">
            <div className="header-icon">
              <Zap size={25} />
            </div>

            <div>
              <h1 className="page-title">
                Transformers
              </h1>

              <p className="page-subtitle">
                Manage electrical transformers,
                technical specifications, condition,
                inspections, and operational status.
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
                loadTransformers({
                  silent: true,
                })
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
              <button type="button" className="btn primary" onClick={openCreate}>
                <Plus size={17} />
                Register Transformer
              </button>
            )}
          </div>
        </div>

        <div className="summary-grid">
          <div className="summary-card">
            <div className="summary-top">
              <span className="summary-label">
                Total Transformers
              </span>

              <span className="summary-icon blue">
                <Zap size={18} />
              </span>
            </div>

            <div className="summary-number">
              {summary.total}
            </div>
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
                Inactive
              </span>

              <span className="summary-icon red">
                <CircleAlert size={18} />
              </span>
            </div>

            <div className="summary-number">
              {summary.inactive || 0}
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-top">
              <span className="summary-label">
                Critical
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
              {filterOptions.locations?.length || 0}
            </div>
          </div>
        </div>

        {error && (
          <div className="error-box">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <div className="toolbar">
          <div className="search-box">
            <Search size={17} />

            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search transformer, code, serial, manufacturer..."
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
            {filterOptions.statuses.map((item) => (
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
            {filterOptions.conditions.map((item) => (
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
              All transformer types
            </option>

            {filterOptions.types.map((item) => (
              <option key={item} value={item}>
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

            {filterOptions.locations.map((item) => (
              <option key={item} value={item}>
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

        <div className="table-card">
          <div className="table-header">
            <div>
              <h2 className="table-title">
                Transformer Inventory
              </h2>

              <div className="table-count">
                {pagination.total ||
                  transformers.length}{" "}
                records
              </div>
            </div>

            <button
              type="button"
              className="btn"
              onClick={() =>
                loadTransformers({
                  silent: true,
                })
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
                Loading transformers...
              </p>
            </div>
          ) : transformers.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                <Zap size={29} />
              </div>

              <h3>
                No transformers found
              </h3>

              <p>
                No transformer records match the
                current search and filters.
              </p>
            </div>
          ) : (
            <>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Transformer</th>
                      <th>Type</th>
                      <th>Manufacturer</th>
                      <th>Location</th>
                      <th>Capacity</th>
                      <th>Voltage</th>
                      <th>Phase</th>
                      <th>Status</th>
                      <th>Condition</th>
                      <th>Next Inspection</th>
                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {transformers.map(
                      (transformer) => {
                        const id =
                          getId(transformer);

                        return (
                          <tr
                            key={
                              id ||
                              `${getCode(
                                transformer
                              )}-${getName(
                                transformer
                              )}`
                            }
                          >
                            <td>
                              <div className="transformer-cell">
                                <div className="transformer-icon">
                                  <Zap size={18} />
                                </div>

                                <div>
                                  <div className="transformer-name">
                                    {getName(
                                      transformer
                                    )}
                                  </div>

                                  <div className="transformer-code">
                                    Code:{" "}
                                    {getCode(
                                      transformer
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td>
                              {getType(
                                transformer
                              )}
                            </td>

                            <td>
                              <strong>
                                {getManufacturer(
                                  transformer
                                )}
                              </strong>

                              <div
                                style={{
                                  marginTop: 3,
                                  color: "#64748b",
                                  fontSize: 11,
                                }}
                              >
                                {getModel(
                                  transformer
                                )}
                              </div>
                            </td>

                            <td>
                              <div className="location-cell">
                                <MapPin size={15} />

                                {getLocation(
                                  transformer
                                )}
                              </div>
                            </td>

                            <td>
                              <strong>
                                {getCapacity(
                                  transformer
                                )}
                              </strong>
                            </td>

                            <td>
                              <div className="voltage">
                                {getPrimaryVoltage(
                                  transformer
                                )}

                                <small>
                                  ↓{" "}
                                  {getSecondaryVoltage(
                                    transformer
                                  )}
                                </small>
                              </div>
                            </td>

                            <td>
                              {getPhase(
                                transformer
                              )}
                            </td>

                            <td>
                              <span
                                className={statusClass(
                                  getStatus(
                                    transformer
                                  )
                                )}
                              >
                                {statusLabel(
                                  getStatus(
                                    transformer
                                  )
                                )}
                              </span>
                            </td>

                            <td>
                              <span
                                className={conditionClass(
                                  getCondition(
                                    transformer
                                  )
                                )}
                              >
                                {conditionLabel(
                                  getCondition(
                                    transformer
                                  )
                                )}
                              </span>
                            </td>

                            <td>
                              {formatDate(
                                getNextInspectionDate(
                                  transformer
                                )
                              )}
                            </td>

                            <td>
                              <div className="action-buttons">
                                {canManage && <button
                                  type="button"
                                  className="icon-btn"
                                  title="View details"
                                  onClick={() =>
                                    setSelectedTransformer(
                                      transformer
                                    )
                                  }
                                >
                                  <Eye size={16} />
                                </button>}

                                {canManage && <button
                                  type="button"
                                  className="icon-btn"
                                  title="Edit transformer"
                                  onClick={() =>
                                    openEdit(
                                      transformer
                                    )
                                  }
                                >
                                  <Edit3 size={16} />
                                </button>}

                                <button
                                  type="button"
                                  className="icon-btn danger"
                                  title="Delete transformer"
                                  disabled={
                                    deleting
                                  }
                                  onClick={() =>
                                    deleteTransformer(
                                      transformer
                                    )
                                  }
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      }
                    )}
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

      {selectedTransformer && !showForm && (
        <div
          className="modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setSelectedTransformer(null);
            }
          }}
        >
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">
                Transformer Details
              </h2>

              <button
                type="button"
                className="modal-close"
                onClick={() =>
                  setSelectedTransformer(null)
                }
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <div className="detail-grid">
                <div className="detail-card">
                  <div className="detail-label">
                    Transformer Name
                  </div>

                  <div className="detail-value">
                    {getName(
                      selectedTransformer
                    )}
                  </div>
                </div>

                <div className="detail-card">
                  <div className="detail-label">
                    Transformer Code
                  </div>

                  <div className="detail-value">
                    {getCode(
                      selectedTransformer
                    )}
                  </div>
                </div>

                <div className="detail-card">
                  <div className="detail-label">
                    Type
                  </div>

                  <div className="detail-value">
                    {getType(
                      selectedTransformer
                    )}
                  </div>
                </div>

                <div className="detail-card">
                  <div className="detail-label">
                    Manufacturer
                  </div>

                  <div className="detail-value">
                    {getManufacturer(
                      selectedTransformer
                    )}
                  </div>
                </div>

                <div className="detail-card">
                  <div className="detail-label">
                    Model
                  </div>

                  <div className="detail-value">
                    {getModel(
                      selectedTransformer
                    )}
                  </div>
                </div>

                <div className="detail-card">
                  <div className="detail-label">
                    Serial Number
                  </div>

                  <div className="detail-value">
                    {getSerialNumber(
                      selectedTransformer
                    )}
                  </div>
                </div>

                <div className="detail-card">
                  <div className="detail-label">
                    Location
                  </div>

                  <div className="detail-value">
                    {getLocation(
                      selectedTransformer
                    )}
                  </div>
                </div>

                <div className="detail-card">
                  <div className="detail-label">
                    Capacity
                  </div>

                  <div className="detail-value">
                    {getCapacity(
                      selectedTransformer
                    )}
                  </div>
                </div>

                <div className="detail-card">
                  <div className="detail-label">
                    Primary Voltage
                  </div>

                  <div className="detail-value">
                    {getPrimaryVoltage(
                      selectedTransformer
                    )}
                  </div>
                </div>

                <div className="detail-card">
                  <div className="detail-label">
                    Secondary Voltage
                  </div>

                  <div className="detail-value">
                    {getSecondaryVoltage(
                      selectedTransformer
                    )}
                  </div>
                </div>

                <div className="detail-card">
                  <div className="detail-label">
                    Phase
                  </div>

                  <div className="detail-value">
                    {getPhase(
                      selectedTransformer
                    )}
                  </div>
                </div>

                <div className="detail-card">
                  <div className="detail-label">
                    Frequency
                  </div>

                  <div className="detail-value">
                    {getFrequency(
                      selectedTransformer
                    )}
                  </div>
                </div>

                <div className="detail-card">
                  <div className="detail-label">
                    Cooling Type
                  </div>

                  <div className="detail-value">
                    {getCoolingType(
                      selectedTransformer
                    )}
                  </div>
                </div>

                <div className="detail-card">
                  <div className="detail-label">
                    Oil Capacity
                  </div>

                  <div className="detail-value">
                    {getOilCapacity(
                      selectedTransformer
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
                          selectedTransformer
                        )
                      )}
                    >
                      {statusLabel(
                        getStatus(
                          selectedTransformer
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
                          selectedTransformer
                        )
                      )}
                    >
                      {conditionLabel(
                        getCondition(
                          selectedTransformer
                        )
                      )}
                    </span>
                  </div>
                </div>

                <div className="detail-card">
                  <div className="detail-label">
                    Last Inspection
                  </div>

                  <div className="detail-value">
                    {formatDate(
                      getLastInspectionDate(
                        selectedTransformer
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
                    selectedTransformer
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
                  openEdit(
                    selectedTransformer
                  )
                }
              >
                <Edit3 size={16} />
                Edit
              </button>

              <button
                type="button"
                className="btn"
                onClick={() =>
                  setSelectedTransformer(null)
                }
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

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
                {editingTransformer
                  ? "Edit Transformer"
                  : "Add Transformer"}
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

            <form onSubmit={saveTransformer}>
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
                      Transformer Name{" "}
                      <span className="required">
                        *
                      </span>
                    </label>

                    <input
                      className="form-control"
                      name="name"
                      value={form.name}
                      onChange={handleChange}
                      placeholder="e.g. Main Campus Transformer"
                      disabled={saving}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Transformer Code
                    </label>

                    <input
                      className="form-control"
                      name="code"
                      value={form.code}
                      onChange={handleChange}
                      placeholder="e.g. TR-001"
                      disabled={saving}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Transformer Type{" "}
                      <span className="required">
                        *
                      </span>
                    </label>

                    <select
                      className="form-control"
                      name="transformerType"
                      value={form.transformerType}
                      onChange={handleChange}
                      disabled={saving}
                    >
                      <option value="Distribution Transformer">
                        Distribution Transformer
                      </option>

                      <option value="Power Transformer">
                        Power Transformer
                      </option>

                      <option value="Step-Up Transformer">
                        Step-Up Transformer
                      </option>

                      <option value="Step-Down Transformer">
                        Step-Down Transformer
                      </option>

                      <option value="Isolation Transformer">
                        Isolation Transformer
                      </option>

                      <option value="Other">
                        Other
                      </option>
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
                      placeholder="Substation / building / site"
                      disabled={saving}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Manufacturer
                    </label>

                    <input
                      className="form-control"
                      name="manufacturer"
                      value={form.manufacturer}
                      onChange={handleChange}
                      placeholder="Manufacturer"
                      disabled={saving}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Model
                    </label>

                    <input
                      className="form-control"
                      name="model"
                      value={form.model}
                      onChange={handleChange}
                      placeholder="Model number"
                      disabled={saving}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Serial Number
                    </label>

                    <input
                      className="form-control"
                      name="serialNumber"
                      value={form.serialNumber}
                      onChange={handleChange}
                      placeholder="Serial number"
                      disabled={saving}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Capacity
                    </label>

                    <input
                      className="form-control"
                      name="capacity"
                      value={form.capacity}
                      onChange={handleChange}
                      placeholder="e.g. 1000 kVA"
                      disabled={saving}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Primary Voltage
                    </label>

                    <input
                      className="form-control"
                      name="primaryVoltage"
                      value={form.primaryVoltage}
                      onChange={handleChange}
                      placeholder="e.g. 15 kV"
                      disabled={saving}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Secondary Voltage
                    </label>

                    <input
                      className="form-control"
                      name="secondaryVoltage"
                      value={form.secondaryVoltage}
                      onChange={handleChange}
                      placeholder="e.g. 400 V"
                      disabled={saving}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Phase
                    </label>

                    <select
                      className="form-control"
                      name="phase"
                      value={form.phase}
                      onChange={handleChange}
                      disabled={saving}
                    >
                      <option value="Single Phase">
                        Single Phase
                      </option>

                      <option value="Three Phase">
                        Three Phase
                      </option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Frequency
                    </label>

                    <select
                      className="form-control"
                      name="frequency"
                      value={form.frequency}
                      onChange={handleChange}
                      disabled={saving}
                    >
                      <option value="50 Hz">
                        50 Hz
                      </option>

                      <option value="60 Hz">
                        60 Hz
                      </option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Cooling Type
                    </label>

                    <input
                      className="form-control"
                      name="coolingType"
                      value={form.coolingType}
                      onChange={handleChange}
                      placeholder="e.g. ONAN"
                      disabled={saving}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Oil Capacity
                    </label>

                    <input
                      className="form-control"
                      name="oilCapacity"
                      value={form.oilCapacity}
                      onChange={handleChange}
                      placeholder="e.g. 450 L"
                      disabled={saving}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Status
                    </label>

                    <select
                      className="form-control"
                      name="status"
                      value={form.status}
                      onChange={handleChange}
                      disabled={saving}
                    >
                      <option value="Operational">Operational</option>
                      <option value="Under Maintenance">Under Maintenance</option>
                      <option value="Inactive">Inactive</option>
                      <option value="Disposed">Disposed</option>
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
                      <option value="Excellent">Excellent</option>
                      <option value="Good">Good</option>
                      <option value="Fair">Fair</option>
                      <option value="Poor">Poor</option>
                      <option value="Critical">Critical</option>
                    </select>
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

                  <div className="form-group full">
                    <label className="form-label">
                      Description
                    </label>

                    <textarea
                      className="form-control"
                      name="description"
                      value={form.description}
                      onChange={handleChange}
                      placeholder="Technical specifications, maintenance notes, or other information..."
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
                  {saving ? (
                    <>
                      <RefreshCw
                        size={16}
                        className="spinner"
                      />
                      Saving...
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={16} />
                      {editingTransformer
                        ? "Update Transformer"
                        : "Save Transformer"}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}