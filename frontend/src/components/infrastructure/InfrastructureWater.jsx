import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Droplets,
  Edit3,
  Eye,
  Filter,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Waves,
  X,
} from "lucide-react";

const PAGE_SIZE = 10;

const EMPTY_FORM = {
  name: "",
  code: "",
  systemType: "",
  location: "",
  building: "",
  zone: "",
  source: "",
  capacity: "",
  flowRate: "",
  pressure: "",
  tankCapacity: "",
  pipeLength: "",
  pumpCount: "",
  manufacturer: "",
  model: "",
  serialNumber: "",
  installationDate: "",
  lastInspectionDate: "",
  nextInspectionDate: "",
  status: "operational",
  condition: "good",
  description: "",
};

const normalize = (value) => String(value ?? "").trim().toLowerCase();

const getValue = (row, keys, fallback = "") => {
  for (const key of keys) {
    if (
      row?.[key] !== undefined &&
      row?.[key] !== null &&
      row?.[key] !== ""
    ) {
      return row[key];
    }
  }
  return fallback;
};

const getId = (row) =>
  getValue(row, ["id", "water_id", "system_id", "waterSystemId"]);

const getName = (row) =>
  getValue(row, ["name", "system_name", "water_system_name"], "Unnamed");

const getCode = (row) =>
  getValue(row, ["code", "system_code", "water_code"], "—");

const getType = (row) =>
  getValue(row, ["systemType", "system_type", "type"], "—");

const getLocation = (row) =>
  getValue(row, ["location", "location_name", "site"], "—");

const getBuilding = (row) =>
  getValue(row, ["building", "building_name"], "—");

const getZone = (row) =>
  getValue(row, ["zone", "zone_name", "area"], "—");

const getSource = (row) =>
  getValue(row, ["source", "water_source"], "—");

const getCapacity = (row) =>
  getValue(row, ["capacity", "capacity_liters", "capacity_m3"], "—");

const getFlowRate = (row) =>
  getValue(row, ["flowRate", "flow_rate"], "—");

const getPressure = (row) =>
  getValue(row, ["pressure", "pressure_bar"], "—");

const getTankCapacity = (row) =>
  getValue(row, ["tankCapacity", "tank_capacity"], "—");

const getPipeLength = (row) =>
  getValue(row, ["pipeLength", "pipe_length"], "—");

const getPumpCount = (row) =>
  getValue(row, ["pumpCount", "pump_count"], "—");

const getManufacturer = (row) =>
  getValue(row, ["manufacturer", "make"], "—");

const getModel = (row) =>
  getValue(row, ["model"], "—");

const getSerialNumber = (row) =>
  getValue(row, ["serialNumber", "serial_number"], "—");

const getStatus = (row) =>
  normalize(
    getValue(row, ["status", "operational_status"], "operational")
  );

const getCondition = (row) =>
  normalize(
    getValue(row, ["condition", "asset_condition"], "good")
  );

const getInstallationDate = (row) =>
  getValue(row, ["installationDate", "installation_date"]);

const getLastInspectionDate = (row) =>
  getValue(row, ["lastInspectionDate", "last_inspection_date"]);

const getNextInspectionDate = (row) =>
  getValue(row, ["nextInspectionDate", "next_inspection_date"]);

const getDescription = (row) =>
  getValue(row, ["description", "notes"], "");

const formatDate = (value) => {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString();
};

const extractRows = (data) => {
  if (Array.isArray(data)) return data;

  return (
    data?.rows ||
    data?.items ||
    data?.data?.rows ||
    data?.data?.items ||
    data?.data ||
    []
  );
};

const extractPagination = (data, currentPage, fallbackTotal) => {
  const source = data?.pagination || data?.meta || data?.data?.pagination || {};

  const total =
    Number(
      source.total ??
        data?.total ??
        data?.data?.total ??
        fallbackTotal
    ) || 0;

  const pages =
    Number(
      source.pages ??
        source.totalPages ??
        data?.totalPages ??
        data?.data?.totalPages
    ) || Math.max(1, Math.ceil(total / PAGE_SIZE));

  return {
    page:
      Number(source.page ?? data?.page ?? data?.data?.page) || currentPage,
    total,
    pages,
  };
};

const statusLabel = (status) => {
  const labels = {
    operational: "Operational",
    active: "Active",
    maintenance: "Maintenance",
    inactive: "Inactive",
    failed: "Failed",
    fault: "Fault",
    damaged: "Damaged",
    decommissioned: "Decommissioned",
  };

  return (
    labels[normalize(status)] ||
    String(status || "Unknown")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase())
  );
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

  return (
    labels[normalize(condition)] ||
    String(condition || "Unknown")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase())
  );
};

const statusClass = (status) => {
  const value = normalize(status);

  if (["operational", "active"].includes(value)) return "status-success";
  if (["maintenance"].includes(value)) return "status-warning";
  if (["failed", "fault", "damaged"].includes(value)) return "status-danger";

  return "status-neutral";
};

const conditionClass = (condition) => {
  const value = normalize(condition);

  if (["excellent", "good"].includes(value)) return "condition-good";
  if (value === "fair") return "condition-fair";
  if (["poor", "critical", "damaged"].includes(value))
    return "condition-danger";

  return "condition-neutral";
};

export default function InfrastructureWater() {
  const [rows, setRows] = useState([]);
  const [locations, setLocations] = useState([]);
  const [buildings, setBuildings] = useState([]);
  const [types, setTypes] = useState([]);
  const [summary, setSummary] = useState({
    total: 0,
    operational: 0,
    maintenance: 0,
    failed: 0,
    critical: 0,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [condition, setCondition] = useState("");
  const [type, setType] = useState("");
  const [location, setLocation] = useState("");
  const [building, setBuilding] = useState("");

  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    total: 0,
    pages: 1,
  });

  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showDelete, setShowDelete] = useState(null);

  const [form, setForm] = useState(EMPTY_FORM);

  const loadWaterSystems = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/infrastructure/water", {
        params: {
          page,
          limit: PAGE_SIZE,
          search: search.trim() || undefined,
          status: status || undefined,
          condition: condition || undefined,
          type: type || undefined,
          location: location || undefined,
          building: building || undefined,
        },
      });

      const data = response.data;
      const extracted = extractRows(data);

      setRows(extracted);
      setSummary(
        data?.summary || {
          total: 0,
          operational: 0,
          maintenance: 0,
          failed: 0,
          critical: 0,
        }
      );

      setPagination(
        extractPagination(data, page, extracted.length)
      );

      setTypes(data?.filters?.types || []);
      setLocations(data?.filters?.locations || []);
      setBuildings(data?.filters?.buildings || []);
    } catch (err) {
      setRows([]);
      setPagination({
        page: 1,
        total: 0,
        pages: 1,
      });
      setSummary({
        total: 0,
        operational: 0,
        maintenance: 0,
        failed: 0,
        critical: 0,
      });

      setError(
        err?.response?.data?.message ||
          "Unable to load water systems from the backend."
      );
    } finally {
      setLoading(false);
    }
  }, [page, search, status, condition, type, location, building]);

  useEffect(() => {
    loadWaterSystems();
  }, [loadWaterSystems]);

  useEffect(() => {
    if (!success) return;

    const timer = setTimeout(() => {
      setSuccess("");
    }, 3500);

    return () => clearTimeout(timer);
  }, [success]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError("");
    setShowForm(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setError("");

    setForm({
      name: getName(item) === "Unnamed" ? "" : getName(item),
      code: getCode(item) === "—" ? "" : getCode(item),
      systemType: getType(item) === "—" ? "" : getType(item),
      location: getLocation(item) === "—" ? "" : getLocation(item),
      building: getBuilding(item) === "—" ? "" : getBuilding(item),
      zone: getZone(item) === "—" ? "" : getZone(item),
      source: getSource(item) === "—" ? "" : getSource(item),
      capacity: getCapacity(item) === "—" ? "" : getCapacity(item),
      flowRate: getFlowRate(item) === "—" ? "" : getFlowRate(item),
      pressure: getPressure(item) === "—" ? "" : getPressure(item),
      tankCapacity:
        getTankCapacity(item) === "—" ? "" : getTankCapacity(item),
      pipeLength:
        getPipeLength(item) === "—" ? "" : getPipeLength(item),
      pumpCount:
        getPumpCount(item) === "—" ? "" : getPumpCount(item),
      manufacturer:
        getManufacturer(item) === "—" ? "" : getManufacturer(item),
      model: getModel(item) === "—" ? "" : getModel(item),
      serialNumber:
        getSerialNumber(item) === "—" ? "" : getSerialNumber(item),
      installationDate: getInstallationDate(item)
        ? String(getInstallationDate(item)).slice(0, 10)
        : "",
      lastInspectionDate: getLastInspectionDate(item)
        ? String(getLastInspectionDate(item)).slice(0, 10)
        : "",
      nextInspectionDate: getNextInspectionDate(item)
        ? String(getNextInspectionDate(item)).slice(0, 10)
        : "",
      status: getStatus(item) || "operational",
      condition: getCondition(item) || "good",
      description: getDescription(item),
    });

    setShowForm(true);
  };

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const saveWaterSystem = async (event) => {
    event.preventDefault();

    if (!form.name.trim()) {
      setError("Water system name is required.");
      return;
    }

    if (!form.systemType.trim()) {
      setError("System type is required.");
      return;
    }

    if (!form.location.trim()) {
      setError("Location is required.");
      return;
    }

    setSaving(true);
    setError("");

    const payload = {
      name: form.name.trim(),
      code: form.code.trim() || null,
      systemType: form.systemType.trim(),
      location: form.location.trim(),
      building: form.building.trim() || null,
      zone: form.zone.trim() || null,
      source: form.source.trim() || null,
      capacity: form.capacity || null,
      flowRate: form.flowRate || null,
      pressure: form.pressure || null,
      tankCapacity: form.tankCapacity || null,
      pipeLength: form.pipeLength || null,
      pumpCount: form.pumpCount || null,
      manufacturer: form.manufacturer.trim() || null,
      model: form.model.trim() || null,
      serialNumber: form.serialNumber.trim() || null,
      installationDate: form.installationDate || null,
      lastInspectionDate: form.lastInspectionDate || null,
      nextInspectionDate: form.nextInspectionDate || null,
      status: form.status,
      condition: form.condition,
      description: form.description.trim() || null,
    };

    try {
      if (editing) {
        const id = getId(editing);

        if (!id) {
          throw new Error("The selected water system has no valid ID.");
        }

        await api.put(`/infrastructure/water/${id}`, payload);
        setSuccess("Water system updated successfully.");
      } else {
        await api.post("/infrastructure/water", payload);
        setSuccess("Water system registered successfully.");
      }

      setShowForm(false);
      setEditing(null);
      setForm(EMPTY_FORM);

      await loadWaterSystems();
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Unable to save the water system."
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteWaterSystem = async () => {
    const id = getId(showDelete);

    if (!id) {
      setError("The selected water system has no valid ID.");
      return;
    }

    setDeleting(true);
    setError("");

    try {
      await api.delete(`/infrastructure/water/${id}`);

      setSuccess("Water system deleted successfully.");
      setShowDelete(null);

      if (rows.length === 1 && page > 1) {
        setPage((current) => current - 1);
      } else {
        await loadWaterSystems();
      }
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          "Unable to delete the water system."
      );
    } finally {
      setDeleting(false);
    }
  };

  const clearFilters = () => {
    setSearch("");
    setStatus("");
    setCondition("");
    setType("");
    setLocation("");
    setBuilding("");
    setPage(1);
  };

  const hasFilters =
    search || status || condition || type || location || building;

  return (
    <div className="water-page">
      <style>{`
        * {
          box-sizing: border-box;
        }

        .water-page {
          min-height: 100vh;
          background: #f8fafc;
          color: #0f172a;
          padding: 24px;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system,
            BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .water-container {
          max-width: 1600px;
          margin: 0 auto;
        }

        .water-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 24px;
        }

        .water-title-wrap {
          display: flex;
          gap: 14px;
          align-items: flex-start;
        }

        .water-title-icon {
          width: 52px;
          height: 52px;
          border-radius: 14px;
          display: grid;
          place-items: center;
          background: linear-gradient(135deg, #0ea5e9, #2563eb);
          color: white;
          box-shadow: 0 10px 25px rgba(37, 99, 235, 0.2);
          flex-shrink: 0;
        }

        .water-title {
          margin: 0;
          font-size: 28px;
          font-weight: 800;
          letter-spacing: -0.5px;
        }

        .water-subtitle {
          margin: 6px 0 0;
          color: #64748b;
          font-size: 14px;
        }

        .water-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .btn {
          border: 0;
          border-radius: 10px;
          min-height: 42px;
          padding: 0 15px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-weight: 700;
          font-size: 13px;
          cursor: pointer;
          text-decoration: none;
          transition: 0.2s ease;
          white-space: nowrap;
        }

        .btn:hover {
          transform: translateY(-1px);
        }

        .btn-primary {
          background: #0ea5e9;
          color: white;
          box-shadow: 0 6px 16px rgba(14, 165, 233, 0.22);
        }

        .btn-primary:hover {
          background: #0284c7;
        }

        .btn-secondary {
          background: white;
          color: #334155;
          border: 1px solid #dbe3ee;
        }

        .btn-secondary:hover {
          border-color: #94a3b8;
          background: #f8fafc;
        }

        .btn-danger {
          background: #dc2626;
          color: white;
        }

        .btn-success {
          background: #16a34a;
          color: white;
        }

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 16px;
          margin-bottom: 22px;
        }

        .summary-card {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 18px;
          box-shadow: 0 4px 16px rgba(15, 23, 42, 0.04);
        }

        .summary-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .summary-label {
          color: #64748b;
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .summary-value {
          margin-top: 9px;
          font-size: 26px;
          font-weight: 800;
        }

        .summary-icon {
          width: 40px;
          height: 40px;
          display: grid;
          place-items: center;
          border-radius: 11px;
          background: #eff6ff;
          color: #2563eb;
        }

        .summary-card.warning .summary-icon {
          background: #fff7ed;
          color: #ea580c;
        }

        .summary-card.danger .summary-icon {
          background: #fef2f2;
          color: #dc2626;
        }

        .filters {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 16px;
          margin-bottom: 18px;
          box-shadow: 0 4px 16px rgba(15, 23, 42, 0.04);
        }

        .filters-row {
          display: grid;
          grid-template-columns: minmax(240px, 2fr) repeat(4, minmax(150px, 1fr)) auto;
          gap: 10px;
          align-items: center;
        }

        .search-box {
          position: relative;
        }

        .search-box svg {
          position: absolute;
          left: 13px;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
        }

        .input,
        .select,
        .textarea {
          width: 100%;
          border: 1px solid #dbe3ee;
          border-radius: 10px;
          background: white;
          color: #0f172a;
          outline: none;
          font-size: 13px;
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .input,
        .select {
          height: 42px;
          padding: 0 12px;
        }

        .search-box .input {
          padding-left: 40px;
        }

        .textarea {
          min-height: 90px;
          padding: 11px 12px;
          resize: vertical;
        }

        .input:focus,
        .select:focus,
        .textarea:focus {
          border-color: #0ea5e9;
          box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.1);
        }

        .table-card {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 4px 16px rgba(15, 23, 42, 0.04);
        }

        .table-header {
          padding: 17px 18px;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
        }

        .table-title {
          margin: 0;
          font-size: 16px;
          font-weight: 800;
        }

        .table-count {
          color: #64748b;
          font-size: 13px;
        }

        .table-scroll {
          overflow-x: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          min-width: 1250px;
        }

        th {
          background: #f8fafc;
          color: #64748b;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          font-weight: 800;
          padding: 13px 14px;
          text-align: left;
          white-space: nowrap;
        }

        td {
          padding: 14px;
          border-top: 1px solid #eef2f7;
          font-size: 13px;
          vertical-align: middle;
        }

        tbody tr:hover {
          background: #f8fbff;
        }

        .system-cell {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 220px;
        }

        .system-icon {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          background: #ecfeff;
          color: #0891b2;
          display: grid;
          place-items: center;
          flex-shrink: 0;
        }

        .system-name {
          font-weight: 800;
          color: #0f172a;
        }

        .system-code {
          color: #64748b;
          font-size: 11px;
          margin-top: 2px;
        }

        .muted {
          color: #64748b;
        }

        .status,
        .condition {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          border-radius: 999px;
          padding: 5px 9px;
          font-size: 11px;
          font-weight: 800;
          white-space: nowrap;
        }

        .status-success {
          background: #ecfdf5;
          color: #15803d;
        }

        .status-warning {
          background: #fff7ed;
          color: #c2410c;
        }

        .status-danger {
          background: #fef2f2;
          color: #b91c1c;
        }

        .status-neutral {
          background: #f1f5f9;
          color: #475569;
        }

        .condition-good {
          background: #eff6ff;
          color: #1d4ed8;
        }

        .condition-fair {
          background: #fffbeb;
          color: #a16207;
        }

        .condition-danger {
          background: #fef2f2;
          color: #b91c1c;
        }

        .condition-neutral {
          background: #f1f5f9;
          color: #475569;
        }

        .row-actions {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .icon-btn {
          width: 34px;
          height: 34px;
          border: 1px solid #e2e8f0;
          background: white;
          border-radius: 9px;
          display: grid;
          place-items: center;
          color: #475569;
          cursor: pointer;
        }

        .icon-btn:hover {
          background: #f8fafc;
          border-color: #cbd5e1;
        }

        .icon-btn.danger:hover {
          color: #dc2626;
          border-color: #fecaca;
          background: #fef2f2;
        }

        .empty-state,
        .loading-state,
        .error-state {
          min-height: 260px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 30px;
        }

        .empty-icon {
          width: 58px;
          height: 58px;
          border-radius: 15px;
          background: #eff6ff;
          color: #2563eb;
          display: grid;
          place-items: center;
          margin-bottom: 13px;
        }

        .empty-state h3,
        .loading-state h3,
        .error-state h3 {
          margin: 0 0 6px;
          font-size: 16px;
        }

        .empty-state p,
        .loading-state p,
        .error-state p {
          margin: 0;
          color: #64748b;
          max-width: 520px;
          font-size: 13px;
        }

        .spinner {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .pagination {
          padding: 14px 18px;
          border-top: 1px solid #e2e8f0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }

        .pagination-info {
          color: #64748b;
          font-size: 12px;
        }

        .pagination-buttons {
          display: flex;
          gap: 6px;
        }

        .page-btn {
          min-width: 36px;
          height: 36px;
          border: 1px solid #dbe3ee;
          background: white;
          color: #334155;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 700;
        }

        .page-btn:hover:not(:disabled) {
          background: #f8fafc;
        }

        .page-btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .alert {
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 12px 14px;
          border-radius: 10px;
          margin-bottom: 16px;
          font-size: 13px;
          font-weight: 600;
        }

        .alert-error {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #991b1b;
        }

        .alert-success {
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          color: #166534;
        }

        .modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.58);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          z-index: 1000;
        }

        .modal {
          width: min(950px, 100%);
          max-height: 92vh;
          overflow-y: auto;
          background: white;
          border-radius: 18px;
          box-shadow: 0 25px 70px rgba(15, 23, 42, 0.25);
        }

        .modal.small {
          width: min(480px, 100%);
        }

        .modal-header {
          padding: 18px 20px;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          position: sticky;
          top: 0;
          background: white;
          z-index: 2;
        }

        .modal-title {
          margin: 0;
          font-size: 18px;
          font-weight: 800;
        }

        .close-btn {
          width: 36px;
          height: 36px;
          border: 1px solid #e2e8f0;
          border-radius: 9px;
          background: white;
          display: grid;
          place-items: center;
          cursor: pointer;
          color: #475569;
        }

        .modal-body {
          padding: 20px;
        }

        .details-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
        }

        .detail {
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          border-radius: 11px;
          padding: 12px;
        }

        .detail-label {
          color: #64748b;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          font-weight: 800;
          margin-bottom: 5px;
        }

        .detail-value {
          font-size: 13px;
          font-weight: 700;
          word-break: break-word;
        }

        .description-box {
          margin-top: 14px;
          border: 1px solid #e2e8f0;
          border-radius: 11px;
          padding: 13px;
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
        }

        .field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .field.full {
          grid-column: 1 / -1;
        }

        .field label {
          font-size: 12px;
          color: #334155;
          font-weight: 800;
        }

        .required {
          color: #dc2626;
        }

        .modal-footer {
          padding: 16px 20px;
          border-top: 1px solid #e2e8f0;
          display: flex;
          justify-content: flex-end;
          gap: 9px;
          position: sticky;
          bottom: 0;
          background: white;
        }

        @media (max-width: 1250px) {
          .summary-grid {
            grid-template-columns: repeat(3, 1fr);
          }

          .filters-row {
            grid-template-columns: repeat(3, 1fr);
          }
        }

        @media (max-width: 800px) {
          .water-page {
            padding: 14px;
          }

          .water-header {
            flex-direction: column;
          }

          .water-actions {
            width: 100%;
          }

          .water-actions .btn {
            flex: 1;
          }

          .summary-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .filters-row {
            grid-template-columns: 1fr;
          }

          .details-grid,
          .form-grid {
            grid-template-columns: 1fr;
          }

          .field.full {
            grid-column: auto;
          }

          .pagination {
            flex-direction: column;
            align-items: stretch;
          }

          .pagination-buttons {
            justify-content: center;
          }
        }

        @media (max-width: 500px) {
          .summary-grid {
            grid-template-columns: 1fr;
          }

          .water-title {
            font-size: 23px;
          }
        }
      `}</style>

      <div className="water-container">
        <header className="water-header">
          <div className="water-title-wrap">
            <div className="water-title-icon">
              <Droplets size={25} />
            </div>

            <div>
              <h1 className="water-title">Water Systems</h1>
              <p className="water-subtitle">
                Manage university water sources, pumps, tanks,
                pipelines, capacity, inspections, and operational status.
              </p>
            </div>
          </div>

          <div className="water-actions">
            <Link to="/infrastructure" className="btn btn-secondary">
              Dashboard
            </Link>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={loadWaterSystems}
              disabled={loading}
            >
              <RefreshCw
                size={16}
                className={loading ? "spinner" : ""}
              />
              Refresh
            </button>

            <button
              type="button"
              className="btn btn-primary"
              onClick={openCreate}
            >
              <Plus size={17} />
              Add Water System
            </button>
          </div>
        </header>

        {error && (
          <div className="alert alert-error">
            <AlertCircle size={17} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="alert alert-success">
            <CheckCircle2 size={17} />
            <span>{success}</span>
          </div>
        )}

        <section className="summary-grid">
          <div className="summary-card">
            <div className="summary-top">
              <div>
                <div className="summary-label">Total Systems</div>
                <div className="summary-value">{summary.total}</div>
              </div>
              <div className="summary-icon">
                <Waves size={20} />
              </div>
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-top">
              <div>
                <div className="summary-label">Operational</div>
                <div className="summary-value">
                  {summary.operational}
                </div>
              </div>
              <div className="summary-icon">
                <CheckCircle2 size={20} />
              </div>
            </div>
          </div>

          <div className="summary-card warning">
            <div className="summary-top">
              <div>
                <div className="summary-label">Maintenance</div>
                <div className="summary-value">
                  {summary.maintenance}
                </div>
              </div>
              <div className="summary-icon">
                <RefreshCw size={20} />
              </div>
            </div>
          </div>

          <div className="summary-card danger">
            <div className="summary-top">
              <div>
                <div className="summary-label">Fault / Failed</div>
                <div className="summary-value">
                  {summary.failed}
                </div>
              </div>
              <div className="summary-icon">
                <CircleAlert size={20} />
              </div>
            </div>
          </div>

          <div className="summary-card danger">
            <div className="summary-top">
              <div>
                <div className="summary-label">Critical</div>
                <div className="summary-value">
                  {summary.critical}
                </div>
              </div>
              <div className="summary-icon">
                <AlertCircle size={20} />
              </div>
            </div>
          </div>
        </section>

        <section className="filters">
          <div className="filters-row">
            <div className="search-box">
              <Search size={17} />
              <input
                className="input"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Search water systems..."
              />
            </div>

            <select
              className="select"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All Statuses</option>
              <option value="operational">Operational</option>
              <option value="maintenance">Maintenance</option>
              <option value="inactive">Inactive</option>
              <option value="failed">Failed</option>
              <option value="fault">Fault</option>
            </select>

            <select
              className="select"
              value={condition}
              onChange={(event) => {
                setCondition(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All Conditions</option>
              <option value="excellent">Excellent</option>
              <option value="good">Good</option>
              <option value="fair">Fair</option>
              <option value="poor">Poor</option>
              <option value="critical">Critical</option>
              <option value="damaged">Damaged</option>
            </select>

            <select
              className="select"
              value={type}
              onChange={(event) => {
                setType(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All Types</option>

              {types.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            <select
              className="select"
              value={location}
              onChange={(event) => {
                setLocation(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All Locations</option>

              {locations.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            <select
              className="select"
              value={building}
              onChange={(event) => {
                setBuilding(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All Buildings</option>

              {buildings.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={clearFilters}
              disabled={!hasFilters}
            >
              <Filter size={16} />
              Clear
            </button>
          </div>
        </section>

        <section className="table-card">
          <div className="table-header">
            <div>
              <h2 className="table-title">
                Water System Inventory
              </h2>
              <div className="table-count">
                {pagination.total} registered water system
                {pagination.total === 1 ? "" : "s"}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="loading-state">
              <RefreshCw size={30} className="spinner" />
              <h3>Loading water systems</h3>
              <p>
                Fetching current water system information from
                the backend.
              </p>
            </div>
          ) : rows.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                <Droplets size={28} />
              </div>

              <h3>No water systems found</h3>

              <p>
                No water systems match the current search and
                filters, or there are currently no registered
                water systems.
              </p>

              {hasFilters && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ marginTop: 15 }}
                  onClick={clearFilters}
                >
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Water System</th>
                      <th>Type</th>
                      <th>Location</th>
                      <th>Source</th>
                      <th>Capacity</th>
                      <th>Pumps</th>
                      <th>Status</th>
                      <th>Condition</th>
                      <th>Next Inspection</th>
                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {rows.map((item) => {
                      const id = getId(item);
                      const itemStatus = getStatus(item);
                      const itemCondition = getCondition(item);

                      return (
                        <tr key={id || `${getName(item)}-${getCode(item)}`}>
                          <td>
                            <div className="system-cell">
                              <div className="system-icon">
                                <Droplets size={18} />
                              </div>

                              <div>
                                <div className="system-name">
                                  {getName(item)}
                                </div>

                                <div className="system-code">
                                  {getCode(item)}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td>{getType(item)}</td>

                          <td>
                            <div>
                              {getLocation(item)}
                            </div>

                            {getBuilding(item) !== "—" && (
                              <div className="muted">
                                {getBuilding(item)}
                              </div>
                            )}
                          </td>

                          <td>{getSource(item)}</td>

                          <td>{getCapacity(item)}</td>

                          <td>{getPumpCount(item)}</td>

                          <td>
                            <span
                              className={`status ${statusClass(
                                itemStatus
                              )}`}
                            >
                              {statusLabel(itemStatus)}
                            </span>
                          </td>

                          <td>
                            <span
                              className={`condition ${conditionClass(
                                itemCondition
                              )}`}
                            >
                              {conditionLabel(itemCondition)}
                            </span>
                          </td>

                          <td>
                            {formatDate(
                              getNextInspectionDate(item)
                            )}
                          </td>

                          <td>
                            <div className="row-actions">
                              <button
                                type="button"
                                className="icon-btn"
                                title="View"
                                onClick={() => setSelected(item)}
                              >
                                <Eye size={16} />
                              </button>

                              <button
                                type="button"
                                className="icon-btn"
                                title="Edit"
                                onClick={() => openEdit(item)}
                              >
                                <Edit3 size={16} />
                              </button>

                              <button
                                type="button"
                                className="icon-btn danger"
                                title="Delete"
                                onClick={() =>
                                  setShowDelete(item)
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
                  Page {pagination.page} of {pagination.pages}
                  {" • "}
                  {pagination.total} total
                </div>

                <div className="pagination-buttons">
                  <button
                    type="button"
                    className="page-btn"
                    disabled={page <= 1}
                    onClick={() =>
                      setPage((current) =>
                        Math.max(1, current - 1)
                      )
                    }
                  >
                    <ChevronLeft size={16} />
                  </button>

                  <button
                    type="button"
                    className="page-btn"
                    disabled={page >= pagination.pages}
                    onClick={() =>
                      setPage((current) =>
                        Math.min(
                          pagination.pages,
                          current + 1
                        )
                      )
                    }
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      {selected && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelected(null);
            }
          }}
        >
          <div className="modal">
            <div className="modal-header">
              <div>
                <h2 className="modal-title">
                  Water System Details
                </h2>
              </div>

              <button
                type="button"
                className="close-btn"
                onClick={() => setSelected(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <div className="details-grid">
                <div className="detail">
                  <div className="detail-label">Name</div>
                  <div className="detail-value">
                    {getName(selected)}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">Code</div>
                  <div className="detail-value">
                    {getCode(selected)}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">System Type</div>
                  <div className="detail-value">
                    {getType(selected)}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">Location</div>
                  <div className="detail-value">
                    {getLocation(selected)}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">Building</div>
                  <div className="detail-value">
                    {getBuilding(selected)}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">Zone / Area</div>
                  <div className="detail-value">
                    {getZone(selected)}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">Water Source</div>
                  <div className="detail-value">
                    {getSource(selected)}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">Capacity</div>
                  <div className="detail-value">
                    {getCapacity(selected)}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">Flow Rate</div>
                  <div className="detail-value">
                    {getFlowRate(selected)}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">Pressure</div>
                  <div className="detail-value">
                    {getPressure(selected)}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">Tank Capacity</div>
                  <div className="detail-value">
                    {getTankCapacity(selected)}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">Pipe Length</div>
                  <div className="detail-value">
                    {getPipeLength(selected)}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">Pump Count</div>
                  <div className="detail-value">
                    {getPumpCount(selected)}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">Manufacturer</div>
                  <div className="detail-value">
                    {getManufacturer(selected)}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">Model</div>
                  <div className="detail-value">
                    {getModel(selected)}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">Serial Number</div>
                  <div className="detail-value">
                    {getSerialNumber(selected)}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">Status</div>
                  <div className="detail-value">
                    {statusLabel(getStatus(selected))}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">Condition</div>
                  <div className="detail-value">
                    {conditionLabel(getCondition(selected))}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">
                    Installation Date
                  </div>
                  <div className="detail-value">
                    {formatDate(
                      getInstallationDate(selected)
                    )}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">
                    Last Inspection
                  </div>
                  <div className="detail-value">
                    {formatDate(
                      getLastInspectionDate(selected)
                    )}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">
                    Next Inspection
                  </div>
                  <div className="detail-value">
                    {formatDate(
                      getNextInspectionDate(selected)
                    )}
                  </div>
                </div>
              </div>

              {getDescription(selected) && (
                <div className="description-box">
                  <div className="detail-label">Description</div>
                  <div className="detail-value">
                    {getDescription(selected)}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowForm(false);
            }
          }}
        >
          <form className="modal" onSubmit={saveWaterSystem}>
            <div className="modal-header">
              <h2 className="modal-title">
                {editing
                  ? "Edit Water System"
                  : "Register Water System"}
              </h2>

              <button
                type="button"
                className="close-btn"
                onClick={() => setShowForm(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <div className="form-grid">
                <div className="field">
                  <label>
                    System Name <span className="required">*</span>
                  </label>

                  <input
                    className="input"
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="e.g. Main Campus Water Supply"
                    required
                  />
                </div>

                <div className="field">
                  <label>System Code</label>

                  <input
                    className="input"
                    name="code"
                    value={form.code}
                    onChange={handleChange}
                    placeholder="e.g. WTR-001"
                  />
                </div>

                <div className="field">
                  <label>
                    System Type <span className="required">*</span>
                  </label>

                  <input
                    className="input"
                    name="systemType"
                    value={form.systemType}
                    onChange={handleChange}
                    placeholder="Pump / Tank / Pipeline..."
                    required
                  />
                </div>

                <div className="field">
                  <label>
                    Location <span className="required">*</span>
                  </label>

                  <input
                    className="input"
                    name="location"
                    value={form.location}
                    onChange={handleChange}
                    placeholder="Campus / site"
                    required
                  />
                </div>

                <div className="field">
                  <label>Building</label>

                  <input
                    className="input"
                    name="building"
                    value={form.building}
                    onChange={handleChange}
                    placeholder="Building name"
                  />
                </div>

                <div className="field">
                  <label>Zone / Area</label>

                  <input
                    className="input"
                    name="zone"
                    value={form.zone}
                    onChange={handleChange}
                    placeholder="Zone or area"
                  />
                </div>

                <div className="field">
                  <label>Water Source</label>

                  <input
                    className="input"
                    name="source"
                    value={form.source}
                    onChange={handleChange}
                    placeholder="Borehole / Municipal / Well..."
                  />
                </div>

                <div className="field">
                  <label>Capacity</label>

                  <input
                    className="input"
                    name="capacity"
                    value={form.capacity}
                    onChange={handleChange}
                    placeholder="e.g. 10000 L"
                  />
                </div>

                <div className="field">
                  <label>Flow Rate</label>

                  <input
                    className="input"
                    name="flowRate"
                    value={form.flowRate}
                    onChange={handleChange}
                    placeholder="e.g. 20 L/min"
                  />
                </div>

                <div className="field">
                  <label>Pressure</label>

                  <input
                    className="input"
                    name="pressure"
                    value={form.pressure}
                    onChange={handleChange}
                    placeholder="e.g. 4 bar"
                  />
                </div>

                <div className="field">
                  <label>Tank Capacity</label>

                  <input
                    className="input"
                    name="tankCapacity"
                    value={form.tankCapacity}
                    onChange={handleChange}
                    placeholder="e.g. 50000 L"
                  />
                </div>

                <div className="field">
                  <label>Pipe Length</label>

                  <input
                    className="input"
                    name="pipeLength"
                    value={form.pipeLength}
                    onChange={handleChange}
                    placeholder="e.g. 1.5 km"
                  />
                </div>

                <div className="field">
                  <label>Pump Count</label>

                  <input
                    className="input"
                    type="number"
                    min="0"
                    name="pumpCount"
                    value={form.pumpCount}
                    onChange={handleChange}
                    placeholder="0"
                  />
                </div>

                <div className="field">
                  <label>Manufacturer</label>

                  <input
                    className="input"
                    name="manufacturer"
                    value={form.manufacturer}
                    onChange={handleChange}
                    placeholder="Manufacturer"
                  />
                </div>

                <div className="field">
                  <label>Model</label>

                  <input
                    className="input"
                    name="model"
                    value={form.model}
                    onChange={handleChange}
                    placeholder="Model"
                  />
                </div>

                <div className="field">
                  <label>Serial Number</label>

                  <input
                    className="input"
                    name="serialNumber"
                    value={form.serialNumber}
                    onChange={handleChange}
                    placeholder="Serial number"
                  />
                </div>

                <div className="field">
                  <label>Installation Date</label>

                  <input
                    className="input"
                    type="date"
                    name="installationDate"
                    value={form.installationDate}
                    onChange={handleChange}
                  />
                </div>

                <div className="field">
                  <label>Last Inspection</label>

                  <input
                    className="input"
                    type="date"
                    name="lastInspectionDate"
                    value={form.lastInspectionDate}
                    onChange={handleChange}
                  />
                </div>

                <div className="field">
                  <label>Next Inspection</label>

                  <input
                    className="input"
                    type="date"
                    name="nextInspectionDate"
                    value={form.nextInspectionDate}
                    onChange={handleChange}
                  />
                </div>

                <div className="field">
                  <label>Status</label>

                  <select
                    className="select"
                    name="status"
                    value={form.status}
                    onChange={handleChange}
                  >
                    <option value="operational">
                      Operational
                    </option>
                    <option value="maintenance">
                      Maintenance
                    </option>
                    <option value="inactive">Inactive</option>
                    <option value="failed">Failed</option>
                    <option value="fault">Fault</option>
                  </select>
                </div>

                <div className="field">
                  <label>Condition</label>

                  <select
                    className="select"
                    name="condition"
                    value={form.condition}
                    onChange={handleChange}
                  >
                    <option value="excellent">Excellent</option>
                    <option value="good">Good</option>
                    <option value="fair">Fair</option>
                    <option value="poor">Poor</option>
                    <option value="critical">Critical</option>
                    <option value="damaged">Damaged</option>
                  </select>
                </div>

                <div className="field full">
                  <label>Description</label>

                  <textarea
                    className="textarea"
                    name="description"
                    value={form.description}
                    onChange={handleChange}
                    placeholder="Additional technical information..."
                  />
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowForm(false)}
                disabled={saving}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving}
              >
                {saving ? (
                  <>
                    <RefreshCw size={16} className="spinner" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} />
                    {editing
                      ? "Update System"
                      : "Register System"}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {showDelete && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowDelete(null);
            }
          }}
        >
          <div className="modal small">
            <div className="modal-header">
              <h2 className="modal-title">
                Deactivate Water System
              </h2>

              <button
                type="button"
                className="close-btn"
                onClick={() => setShowDelete(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 14,
                  background: "#fef2f2",
                  color: "#dc2626",
                  display: "grid",
                  placeItems: "center",
                  marginBottom: 15,
                }}
              >
                <Trash2 size={24} />
              </div>

              <h3 style={{ margin: "0 0 7px" }}>
                Are you sure?
              </h3>

              <p
                style={{
                  margin: 0,
                  color: "#64748b",
                  lineHeight: 1.6,
                  fontSize: 13,
                }}
              >
                You are about to deactivate{" "}
                <strong>{getName(showDelete)}</strong>. This
                keeps the infrastructure history while marking it
                inactive.
              </p>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowDelete(null)}
                disabled={deleting}
              >
                Cancel
              </button>

              <button
                type="button"
                className="btn btn-danger"
                onClick={deleteWaterSystem}
                disabled={deleting}
              >
                {deleting ? (
                  <>
                    <RefreshCw size={16} className="spinner" />
                    Deactivating...
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    Deactivate
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}