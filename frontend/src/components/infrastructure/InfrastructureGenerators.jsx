import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import {
  AlertCircle,
  ArrowLeft,
  BatteryCharging,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Edit3,
  Eye,
  Filter,
  Fuel,
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
  generatorType: "Diesel Generator",
  manufacturer: "",
  model: "",
  location: "",
  capacity: "",
  voltage: "",
  fuelType: "Diesel",
  fuelTankCapacity: "",
  runtimeHours: "",
  status: "operational",
  condition: "good",
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
  getValue(row, ["id", "generator_id", "generatorId"], "");

const getName = (row) =>
  getValue(
    row,
    ["name", "generator_name", "generatorName"],
    "Unnamed Generator"
  );

const getCode = (row) =>
  getValue(
    row,
    ["code", "generator_code", "generatorCode"],
    "—"
  );

const getType = (row) =>
  getValue(
    row,
    ["generator_type", "generatorType", "type"],
    "Generator"
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

const getVoltage = (row) =>
  getValue(
    row,
    ["voltage", "voltage_rating", "voltageRating"],
    "—"
  );

const getFuelType = (row) =>
  getValue(
    row,
    ["fuel_type", "fuelType"],
    "—"
  );

const getFuelTank = (row) =>
  getValue(
    row,
    [
      "fuel_tank_capacity",
      "fuelTankCapacity",
      "tank_capacity",
      "tankCapacity",
    ],
    "—"
  );

const getRuntime = (row) =>
  getValue(
    row,
    [
      "runtime_hours",
      "runtimeHours",
      "operating_hours",
      "operatingHours",
      "hours_run",
    ],
    "—"
  );

const getStatus = (row) =>
  normalize(
    getValue(
      row,
      ["status", "generator_status", "generatorStatus"],
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
  if (Array.isArray(data?.generators)) return data.generators;

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

export default function InfrastructureGenerators() {
  const [generators, setGenerators] = useState([]);

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

  const [selectedGenerator, setSelectedGenerator] =
    useState(null);

  const [showForm, setShowForm] = useState(false);
  const [editingGenerator, setEditingGenerator] =
    useState(null);

  const [form, setForm] = useState(EMPTY_FORM);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  const loadGenerators = useCallback(
    async ({ silent = false } = {}) => {
      try {
        if (silent) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");

        const response = await api.get(
          "/infrastructure/generators",
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

        setGenerators(rows);
        setPagination(
          extractPagination(response, page)
        );
      } catch (err) {
        console.error(
          "Generators load error:",
          err
        );

        setError(
          err?.response?.data?.message ||
            err?.response?.data?.error ||
            err?.message ||
            "Unable to load generators."
        );

        setGenerators([]);
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
    loadGenerators();
  }, [loadGenerators]);

  useEffect(() => {
    setPage(1);
  }, [
    search,
    status,
    condition,
    type,
    location,
  ]);

  const types = useMemo(
    () =>
      [
        ...new Set(
          generators
            .map((item) => getType(item))
            .filter(
              (item) =>
                item && item !== "—"
            )
        ),
      ].sort((a, b) =>
        String(a).localeCompare(String(b))
      ),
    [generators]
  );

  const locations = useMemo(
    () =>
      [
        ...new Set(
          generators
            .map((item) => getLocation(item))
            .filter(
              (item) =>
                item && item !== "—"
            )
        ),
      ].sort((a, b) =>
        String(a).localeCompare(String(b))
      ),
    [generators]
  );

  const summary = useMemo(() => {
    return {
      total: generators.length,

      operational: generators.filter((item) => {
        const value = getStatus(item);
        return (
          value === "operational" ||
          value === "active"
        );
      }).length,

      maintenance: generators.filter(
        (item) =>
          getStatus(item) === "maintenance"
      ).length,

      fault: generators.filter((item) => {
        const value = getStatus(item);
        return (
          value === "fault" ||
          value === "failed"
        );
      }).length,

      critical: generators.filter((item) => {
        const value = getCondition(item);
        return (
          value === "critical" ||
          value === "damaged"
        );
      }).length,

      locations: new Set(
        generators
          .map((item) => getLocation(item))
          .filter((item) => item !== "—")
      ).size,
    };
  }, [generators]);

  const openCreate = () => {
    setEditingGenerator(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setFormSuccess("");
    setShowForm(true);
  };

  const openEdit = (generator) => {
    setEditingGenerator(generator);

    setForm({
      name:
        getName(generator) ===
        "Unnamed Generator"
          ? ""
          : getName(generator),

      code:
        getCode(generator) === "—"
          ? ""
          : getCode(generator),

      generatorType: getType(generator),

      manufacturer:
        getManufacturer(generator) === "—"
          ? ""
          : getManufacturer(generator),

      model:
        getModel(generator) === "—"
          ? ""
          : getModel(generator),

      location:
        getLocation(generator) === "—"
          ? ""
          : getLocation(generator),

      capacity:
        getCapacity(generator) === "—"
          ? ""
          : getCapacity(generator),

      voltage:
        getVoltage(generator) === "—"
          ? ""
          : getVoltage(generator),

      fuelType:
        getFuelType(generator) === "—"
          ? "Diesel"
          : getFuelType(generator),

      fuelTankCapacity:
        getFuelTank(generator) === "—"
          ? ""
          : getFuelTank(generator),

      runtimeHours:
        getRuntime(generator) === "—"
          ? ""
          : getRuntime(generator),

      status:
        getStatus(generator) ||
        "operational",

      condition:
        getCondition(generator) ||
        "good",

      installationDate:
        getInstallationDate(generator)
          ? String(
              getInstallationDate(generator)
            ).slice(0, 10)
          : "",

      lastInspectionDate:
        getLastInspectionDate(generator)
          ? String(
              getLastInspectionDate(generator)
            ).slice(0, 10)
          : "",

      nextInspectionDate:
        getNextInspectionDate(generator)
          ? String(
              getNextInspectionDate(generator)
            ).slice(0, 10)
          : "",

      description:
        getDescription(generator),
    });

    setFormError("");
    setFormSuccess("");
    setShowForm(true);
  };

  const closeForm = () => {
    if (saving) return;

    setShowForm(false);
    setEditingGenerator(null);
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
      return "Generator name is required.";
    }

    if (!form.generatorType.trim()) {
      return "Generator type is required.";
    }

    if (!form.location.trim()) {
      return "Location is required.";
    }

    return "";
  };

  const saveGenerator = async (event) => {
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
        generatorType:
          form.generatorType.trim(),
        manufacturer:
          form.manufacturer.trim(),
        model: form.model.trim(),
        location:
          form.location.trim(),
        capacity:
          form.capacity.trim(),
        voltage:
          form.voltage.trim(),
        fuelType:
          form.fuelType.trim(),
        fuelTankCapacity:
          form.fuelTankCapacity.trim(),
        runtimeHours:
          form.runtimeHours.trim(),
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

      if (editingGenerator) {
        const id = getId(editingGenerator);

        if (!id) {
          throw new Error(
            "The selected generator does not have a valid ID."
          );
        }

        response = await api.put(
          `/infrastructure/generators/${id}`,
          payload
        );
      } else {
        response = await api.post(
          "/infrastructure/generators",
          payload
        );
      }

      setFormSuccess(
        response?.data?.message ||
          (editingGenerator
            ? "Generator updated successfully."
            : "Generator created successfully.")
      );

      await loadGenerators({
        silent: true,
      });

      setTimeout(() => {
        closeForm();
      }, 700);
    } catch (err) {
      console.error(
        "Generator save error:",
        err
      );

      setFormError(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Unable to save generator."
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteGenerator = async (generator) => {
    const id = getId(generator);

    if (!id) {
      setError(
        "The selected generator does not have a valid ID."
      );
      return;
    }

    const confirmed = window.confirm(
      `Delete "${getName(generator)}"? This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      setDeleting(true);
      setError("");

      await api.delete(
        `/infrastructure/generators/${id}`
      );

      setSelectedGenerator(null);

      await loadGenerators({
        silent: true,
      });
    } catch (err) {
      console.error(
        "Generator delete error:",
        err
      );

      setError(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Unable to delete generator."
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
    <div className="generators-page">
      <style>{`
        * {
          box-sizing: border-box;
        }

        .generators-page {
          min-height: 100vh;
          background: #f8fafc;
          color: #0f172a;
          padding: 24px;
          font-family: Inter, ui-sans-serif, system-ui,
            -apple-system, BlinkMacSystemFont,
            "Segoe UI", sans-serif;
        }

        .generators-container {
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
          min-width: 1350px;
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

        .generator-cell {
          display: flex;
          align-items: center;
          gap: 11px;
        }

        .generator-icon {
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

        .generator-name {
          font-weight: 800;
          color: #0f172a;
          margin-bottom: 3px;
        }

        .generator-code {
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
          width: min(900px, 100%);
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
          .generators-page {
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

      <div className="generators-container">
        <div className="page-header">
          <div className="header-left">
            <div className="header-icon">
              <Zap size={25} />
            </div>

            <div>
              <h1 className="page-title">
                Generators
              </h1>

              <p className="page-subtitle">
                Manage university backup generators,
                operational status, fuel information,
                inspections, and maintenance.
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
                loadGenerators({ silent: true })
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

            <button
              type="button"
              className="btn primary"
              onClick={openCreate}
            >
              <Plus size={17} />
              Add Generator
            </button>
          </div>
        </div>

        <div className="summary-grid">
          <div className="summary-card">
            <div className="summary-top">
              <span className="summary-label">
                Total Generators
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

        <div className="toolbar">
          <div className="search-box">
            <Search size={17} />

            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search generator, code, manufacturer, location..."
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
            <option value="operational">
              Operational
            </option>
            <option value="active">
              Active
            </option>
            <option value="maintenance">
              Maintenance
            </option>
            <option value="fault">
              Fault
            </option>
            <option value="failed">
              Failed
            </option>
            <option value="inactive">
              Inactive
            </option>
            <option value="shutdown">
              Shutdown
            </option>
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
            <option value="excellent">
              Excellent
            </option>
            <option value="good">
              Good
            </option>
            <option value="fair">
              Fair
            </option>
            <option value="poor">
              Poor
            </option>
            <option value="critical">
              Critical
            </option>
            <option value="damaged">
              Damaged
            </option>
          </select>

          <select
            className="select-control"
            value={type}
            onChange={(event) =>
              setType(event.target.value)
            }
          >
            <option value="all">
              All generator types
            </option>

            {types.map((item) => (
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

            {locations.map((item) => (
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
                Generator Inventory
              </h2>

              <div className="table-count">
                {pagination.total ||
                  generators.length}{" "}
                records
              </div>
            </div>

            <button
              type="button"
              className="btn"
              onClick={() =>
                loadGenerators({ silent: true })
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
                Loading generators...
              </p>
            </div>
          ) : generators.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                <Zap size={29} />
              </div>

              <h3>
                No generators found
              </h3>

              <p>
                No generator records match the
                current search and filters.
              </p>
            </div>
          ) : (
            <>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Generator</th>
                      <th>Type</th>
                      <th>Manufacturer</th>
                      <th>Location</th>
                      <th>Capacity</th>
                      <th>Fuel</th>
                      <th>Runtime</th>
                      <th>Status</th>
                      <th>Condition</th>
                      <th>Next Inspection</th>
                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {generators.map(
                      (generator) => {
                        const id =
                          getId(generator);

                        return (
                          <tr
                            key={
                              id ||
                              `${getCode(
                                generator
                              )}-${getName(
                                generator
                              )}`
                            }
                          >
                            <td>
                              <div className="generator-cell">
                                <div className="generator-icon">
                                  <Zap size={18} />
                                </div>

                                <div>
                                  <div className="generator-name">
                                    {getName(
                                      generator
                                    )}
                                  </div>

                                  <div className="generator-code">
                                    Code:{" "}
                                    {getCode(
                                      generator
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td>
                              {getType(
                                generator
                              )}
                            </td>

                            <td>
                              <strong>
                                {getManufacturer(
                                  generator
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
                                  generator
                                )}
                              </div>
                            </td>

                            <td>
                              <div className="location-cell">
                                <MapPin size={15} />
                                {getLocation(
                                  generator
                                )}
                              </div>
                            </td>

                            <td>
                              <span className="metric">
                                <Gauge size={15} />
                                {getCapacity(
                                  generator
                                )}
                              </span>
                            </td>

                            <td>
                              <span className="metric">
                                <Fuel size={15} />
                                {getFuelType(
                                  generator
                                )}
                              </span>
                            </td>

                            <td>
                              {getRuntime(
                                generator
                              ) === "—"
                                ? "—"
                                : `${getRuntime(
                                    generator
                                  )} hrs`}
                            </td>

                            <td>
                              <span
                                className={statusClass(
                                  getStatus(
                                    generator
                                  )
                                )}
                              >
                                {statusLabel(
                                  getStatus(
                                    generator
                                  )
                                )}
                              </span>
                            </td>

                            <td>
                              <span
                                className={conditionClass(
                                  getCondition(
                                    generator
                                  )
                                )}
                              >
                                {conditionLabel(
                                  getCondition(
                                    generator
                                  )
                                )}
                              </span>
                            </td>

                            <td>
                              {formatDate(
                                getNextInspectionDate(
                                  generator
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
                                    setSelectedGenerator(
                                      generator
                                    )
                                  }
                                >
                                  <Eye size={16} />
                                </button>

                                <button
                                  type="button"
                                  className="icon-btn"
                                  title="Edit generator"
                                  onClick={() =>
                                    openEdit(
                                      generator
                                    )
                                  }
                                >
                                  <Edit3 size={16} />
                                </button>

                                <button
                                  type="button"
                                  className="icon-btn danger"
                                  title="Delete generator"
                                  disabled={
                                    deleting
                                  }
                                  onClick={() =>
                                    deleteGenerator(
                                      generator
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

      {/* DETAILS MODAL */}
      {selectedGenerator && !showForm && (
        <div
          className="modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setSelectedGenerator(null);
            }
          }}
        >
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">
                Generator Details
              </h2>

              <button
                type="button"
                className="modal-close"
                onClick={() =>
                  setSelectedGenerator(null)
                }
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <div className="detail-grid">
                <div className="detail-card">
                  <div className="detail-label">
                    Generator Name
                  </div>
                  <div className="detail-value">
                    {getName(
                      selectedGenerator
                    )}
                  </div>
                </div>

                <div className="detail-card">
                  <div className="detail-label">
                    Generator Code
                  </div>
                  <div className="detail-value">
                    {getCode(
                      selectedGenerator
                    )}
                  </div>
                </div>

                <div className="detail-card">
                  <div className="detail-label">
                    Type
                  </div>
                  <div className="detail-value">
                    {getType(
                      selectedGenerator
                    )}
                  </div>
                </div>

                <div className="detail-card">
                  <div className="detail-label">
                    Manufacturer
                  </div>
                  <div className="detail-value">
                    {getManufacturer(
                      selectedGenerator
                    )}
                  </div>
                </div>

                <div className="detail-card">
                  <div className="detail-label">
                    Model
                  </div>
                  <div className="detail-value">
                    {getModel(
                      selectedGenerator
                    )}
                  </div>
                </div>

                <div className="detail-card">
                  <div className="detail-label">
                    Location
                  </div>
                  <div className="detail-value">
                    {getLocation(
                      selectedGenerator
                    )}
                  </div>
                </div>

                <div className="detail-card">
                  <div className="detail-label">
                    Capacity
                  </div>
                  <div className="detail-value">
                    {getCapacity(
                      selectedGenerator
                    )}
                  </div>
                </div>

                <div className="detail-card">
                  <div className="detail-label">
                    Voltage
                  </div>
                  <div className="detail-value">
                    {getVoltage(
                      selectedGenerator
                    )}
                  </div>
                </div>

                <div className="detail-card">
                  <div className="detail-label">
                    Fuel Type
                  </div>
                  <div className="detail-value">
                    {getFuelType(
                      selectedGenerator
                    )}
                  </div>
                </div>

                <div className="detail-card">
                  <div className="detail-label">
                    Fuel Tank Capacity
                  </div>
                  <div className="detail-value">
                    {getFuelTank(
                      selectedGenerator
                    )}
                  </div>
                </div>

                <div className="detail-card">
                  <div className="detail-label">
                    Runtime
                  </div>
                  <div className="detail-value">
                    {getRuntime(
                      selectedGenerator
                    ) === "—"
                      ? "—"
                      : `${getRuntime(
                          selectedGenerator
                        )} hours`}
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
                          selectedGenerator
                        )
                      )}
                    >
                      {statusLabel(
                        getStatus(
                          selectedGenerator
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
                          selectedGenerator
                        )
                      )}
                    >
                      {conditionLabel(
                        getCondition(
                          selectedGenerator
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
                        selectedGenerator
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
                        selectedGenerator
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
                        selectedGenerator
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
                    selectedGenerator
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
                    selectedGenerator
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
                  setSelectedGenerator(null)
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
                {editingGenerator
                  ? "Edit Generator"
                  : "Add Generator"}
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

            <form onSubmit={saveGenerator}>
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
                      Generator Name{" "}
                      <span className="required">
                        *
                      </span>
                    </label>

                    <input
                      className="form-control"
                      name="name"
                      value={form.name}
                      onChange={handleChange}
                      placeholder="e.g. Main Campus Generator"
                      disabled={saving}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Generator Code
                    </label>

                    <input
                      className="form-control"
                      name="code"
                      value={form.code}
                      onChange={handleChange}
                      placeholder="e.g. GEN-001"
                      disabled={saving}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Generator Type{" "}
                      <span className="required">
                        *
                      </span>
                    </label>

                    <select
                      className="form-control"
                      name="generatorType"
                      value={form.generatorType}
                      onChange={handleChange}
                      disabled={saving}
                    >
                      <option value="Diesel Generator">
                        Diesel Generator
                      </option>

                      <option value="Petrol Generator">
                        Petrol Generator
                      </option>

                      <option value="Natural Gas Generator">
                        Natural Gas Generator
                      </option>

                      <option value="Hybrid Generator">
                        Hybrid Generator
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
                      placeholder="Generator room / building"
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
                      Capacity
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
                      Voltage
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
                      Fuel Type
                    </label>

                    <select
                      className="form-control"
                      name="fuelType"
                      value={form.fuelType}
                      onChange={handleChange}
                      disabled={saving}
                    >
                      <option value="Diesel">
                        Diesel
                      </option>

                      <option value="Petrol">
                        Petrol
                      </option>

                      <option value="Natural Gas">
                        Natural Gas
                      </option>

                      <option value="Dual Fuel">
                        Dual Fuel
                      </option>

                      <option value="Other">
                        Other
                      </option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Fuel Tank Capacity
                    </label>

                    <input
                      className="form-control"
                      name="fuelTankCapacity"
                      value={form.fuelTankCapacity}
                      onChange={handleChange}
                      placeholder="e.g. 500 L"
                      disabled={saving}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Runtime Hours
                    </label>

                    <input
                      className="form-control"
                      type="number"
                      min="0"
                      step="0.1"
                      name="runtimeHours"
                      value={form.runtimeHours}
                      onChange={handleChange}
                      placeholder="Total operating hours"
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
                      <option value="operational">
                        Operational
                      </option>

                      <option value="active">
                        Active
                      </option>

                      <option value="maintenance">
                        Maintenance
                      </option>

                      <option value="fault">
                        Fault
                      </option>

                      <option value="failed">
                        Failed
                      </option>

                      <option value="inactive">
                        Inactive
                      </option>

                      <option value="shutdown">
                        Shutdown
                      </option>
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
                      <option value="excellent">
                        Excellent
                      </option>

                      <option value="good">
                        Good
                      </option>

                      <option value="fair">
                        Fair
                      </option>

                      <option value="poor">
                        Poor
                      </option>

                      <option value="critical">
                        Critical
                      </option>

                      <option value="damaged">
                        Damaged
                      </option>
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
                      {editingGenerator
                        ? "Update Generator"
                        : "Save Generator"}
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