import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import {
  Activity,
  AlertCircle,
  BarChart3,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Eye,
  Filter,
  Gauge,
  Loader2,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Trash2,
  TrendingDown,
  TrendingUp,
  User,
  X,
  XCircle,
  Zap,
} from "lucide-react";

const INITIAL_FORM = {
  name: "",
  code: "",
  energyType: "Electricity",
  source: "",
  location: "",
  meterNumber: "",
  meterType: "",
  capacity: "",
  currentReading: "",
  previousReading: "",
  consumption: "",
  unit: "kWh",
  cost: "",
  readingDate: "",
  billingPeriod: "",
  status: "Active",
  condition: "Good",
  responsiblePerson: "",
  supplier: "",
  description: "",
  remarks: "",
};

const STATUS_OPTIONS = [
  "Active",
  "Inactive",
  "Monitoring",
  "Maintenance",
  "Fault",
  "Suspended",
];

const CONDITION_OPTIONS = [
  "Excellent",
  "Good",
  "Fair",
  "Poor",
  "Critical",
];

const ENERGY_TYPES = [
  "Electricity",
  "Solar",
  "Generator",
  "Fuel",
  "Water",
  "Other",
];

const UNIT_OPTIONS = ["kWh", "MWh", "Liter", "m³", "GJ", "Other"];

function extractRows(response) {
  const data = response?.data;

  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.records)) return data.records;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.rows)) return data.rows;

  return [];
}

function extractPagination(response, rowsLength) {
  const data = response?.data;
  const meta = data?.pagination || data?.meta || data;

  const total = Number(
    meta?.total ??
      meta?.totalCount ??
      meta?.count ??
      rowsLength
  );

  const pageSize = Number(
    meta?.limit ||
      meta?.pageSize ||
      meta?.perPage ||
      10
  );

  return {
    page: Number(meta?.page || 1),
    limit: pageSize,
    total,
    totalPages: Number(
      meta?.totalPages || Math.ceil(total / pageSize) || 1
    ),
  };
}

function firstValue(...values) {
  return values.find(
    (value) =>
      value !== undefined &&
      value !== null &&
      value !== ""
  );
}

function normalizeEnergy(row) {
  return {
    id: row.id ?? row._id ?? row.energy_id,

    name:
      firstValue(
        row.name,
        row.energyName,
        row.energy_name,
        row.systemName,
        row.system_name
      ) || "Unnamed Energy Record",

    code:
      firstValue(
        row.code,
        row.energyCode,
        row.energy_code,
        row.systemCode,
        row.system_code
      ) || "—",

    energyType:
      firstValue(
        row.energyType,
        row.energy_type,
        row.type,
        row.systemType,
        row.system_type
      ) || "Electricity",

    source:
      firstValue(
        row.source,
        row.energySource,
        row.energy_source
      ) || "—",

    location:
      firstValue(
        row.location,
        row.locationName,
        row.location_name
      ) || "—",

    meterNumber:
      firstValue(
        row.meterNumber,
        row.meter_number,
        row.meterNo,
        row.meter_no
      ) || "—",

    meterType:
      firstValue(
        row.meterType,
        row.meter_type
      ) || "—",

    capacity:
      firstValue(
        row.capacity,
        row.capacityValue,
        row.capacity_value
      ) ?? "",

    currentReading:
      firstValue(
        row.currentReading,
        row.current_reading,
        row.currentMeterReading,
        row.current_meter_reading
      ) ?? "",

    previousReading:
      firstValue(
        row.previousReading,
        row.previous_reading,
        row.previousMeterReading,
        row.previous_meter_reading
      ) ?? "",

    consumption:
      firstValue(
        row.consumption,
        row.energyConsumption,
        row.energy_consumption,
        row.usage
      ) ?? "",

    unit:
      firstValue(
        row.unit,
        row.measurementUnit,
        row.measurement_unit
      ) || "kWh",

    cost:
      firstValue(
        row.cost,
        row.energyCost,
        row.energy_cost,
        row.totalCost,
        row.total_cost
      ) ?? "",

    readingDate:
      firstValue(
        row.readingDate,
        row.reading_date,
        row.date
      ) || "",

    billingPeriod:
      firstValue(
        row.billingPeriod,
        row.billing_period,
        row.period
      ) || "",

    status:
      firstValue(
        row.status,
        row.energyStatus,
        row.energy_status
      ) || "Active",

    condition:
      firstValue(
        row.condition,
        row.assetCondition,
        row.asset_condition
      ) || "Good",

    responsiblePerson:
      firstValue(
        row.responsiblePerson,
        row.responsible_person,
        row.assignedTo,
        row.assigned_to
      ) || "Unassigned",

    supplier:
      firstValue(
        row.supplier,
        row.provider,
        row.vendor
      ) || "—",

    description:
      firstValue(
        row.description,
        row.details
      ) || "",

    remarks:
      firstValue(
        row.remarks,
        row.notes,
        row.note
      ) || "",

    createdAt:
      firstValue(
        row.createdAt,
        row.created_at
      ) || "",

    updatedAt:
      firstValue(
        row.updatedAt,
        row.updated_at
      ) || "",
  };
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString();
}

function formatDateTime(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString();
}

function formatNumber(value) {
  if (value === "" || value === null || value === undefined) {
    return "—";
  }

  const number = Number(value);

  if (Number.isNaN(number)) {
    return String(value);
  }

  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
  }).format(number);
}

function formatMoney(value) {
  if (value === "" || value === null || value === undefined) {
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
}

function getStatusClass(status) {
  const value = String(status || "").toLowerCase();

  if (
    value.includes("fault") ||
    value.includes("inactive") ||
    value.includes("suspend")
  ) {
    return "danger";
  }

  if (value.includes("maintenance")) {
    return "warning";
  }

  if (
    value.includes("active") ||
    value.includes("monitor")
  ) {
    return "success";
  }

  return "default";
}

function getConditionClass(condition) {
  const value = String(condition || "").toLowerCase();

  if (value.includes("critical")) return "danger";
  if (value.includes("poor")) return "warning";
  if (value.includes("fair")) return "warning";
  if (value.includes("excellent")) return "success";
  if (value.includes("good")) return "success";

  return "default";
}

export default function InfrastructureEnergy() {
  const [records, setRecords] = useState([]);
  const [summaryFromApi, setSummaryFromApi] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");

  const [page, setPage] = useState(1);
  const [limit] = useState(10);

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });

  const [showModal, setShowModal] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const [editingRecord, setEditingRecord] = useState(null);
  const [selectedRecord, setSelectedRecord] = useState(null);

  const [form, setForm] = useState(INITIAL_FORM);

  const fetchEnergy = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get(
        "/infrastructure/energy",
        {
          params: {
            page,
            limit,
            search: search.trim() || undefined,
            status: statusFilter || undefined,
            energyType: typeFilter || undefined,
            type: typeFilter || undefined,
            location: locationFilter || undefined,
          },
        }
      );

      const rows = extractRows(response).map(normalizeEnergy);

      setRecords(rows);

      const serverPagination = extractPagination(
        response,
        rows.length
      );

      setPagination({
        page: serverPagination.page || page,
        limit: serverPagination.limit || limit,
        total: serverPagination.total,
        totalPages: Math.max(
          1,
          serverPagination.totalPages
        ),
      });

      if (response?.data?.summary) {
        setSummaryFromApi(response.data.summary);
      } else {
        setSummaryFromApi(null);
      }
    } catch (err) {
      console.error(
        "Failed to load energy management records:",
        err
      );

      setError(
        err?.response?.data?.message ||
          "Unable to load energy management records."
      );

      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [
    page,
    limit,
    search,
    statusFilter,
    typeFilter,
    locationFilter,
  ]);

  useEffect(() => {
    fetchEnergy();
  }, [fetchEnergy]);

  useEffect(() => {
    if (!success) return;

    const timer = setTimeout(() => {
      setSuccess("");
    }, 3500);

    return () => clearTimeout(timer);
  }, [success]);

  const calculatedSummary = useMemo(() => {
    const total = Number(
      pagination.total || records.length
    );

    const active = records.filter(
      (item) =>
        String(item.status).toLowerCase() === "active"
    ).length;

    const maintenance = records.filter((item) =>
      String(item.status)
        .toLowerCase()
        .includes("maintenance")
    ).length;

    const fault = records.filter((item) =>
      String(item.status)
        .toLowerCase()
        .includes("fault")
    ).length;

    const critical = records.filter((item) =>
      String(item.condition)
        .toLowerCase()
        .includes("critical")
    ).length;

    const totalConsumption = records.reduce(
      (sum, item) => {
        const value = Number(item.consumption);

        return Number.isFinite(value)
          ? sum + value
          : sum;
      },
      0
    );

    return {
      total,
      active,
      maintenance,
      fault,
      critical,
      totalConsumption,
    };
  }, [records, pagination.total]);

  const summary = {
    total: Number(
      firstValue(
        summaryFromApi?.total,
        summaryFromApi?.totalRecords,
        summaryFromApi?.totalSystems,
        calculatedSummary.total
      )
    ),

    active: Number(
      firstValue(
        summaryFromApi?.active,
        summaryFromApi?.activeSystems,
        calculatedSummary.active
      )
    ),

    maintenance: Number(
      firstValue(
        summaryFromApi?.maintenance,
        summaryFromApi?.underMaintenance,
        calculatedSummary.maintenance
      )
    ),

    fault: Number(
      firstValue(
        summaryFromApi?.fault,
        summaryFromApi?.faulty,
        summaryFromApi?.failed,
        calculatedSummary.fault
      )
    ),

    critical: Number(
      firstValue(
        summaryFromApi?.critical,
        summaryFromApi?.criticalCondition,
        calculatedSummary.critical
      )
    ),

    consumption: firstValue(
      summaryFromApi?.consumption,
      summaryFromApi?.totalConsumption,
      summaryFromApi?.total_consumption,
      calculatedSummary.totalConsumption
    ),
  };

  const resetForm = () => {
    setForm(INITIAL_FORM);
    setEditingRecord(null);
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (record) => {
    setEditingRecord(record);

    setForm({
      name:
        record.name === "Unnamed Energy Record"
          ? ""
          : record.name,

      code:
        record.code === "—"
          ? ""
          : record.code,

      energyType:
        record.energyType || "Electricity",

      source:
        record.source === "—"
          ? ""
          : record.source,

      location:
        record.location === "—"
          ? ""
          : record.location,

      meterNumber:
        record.meterNumber === "—"
          ? ""
          : record.meterNumber,

      meterType:
        record.meterType === "—"
          ? ""
          : record.meterType,

      capacity: record.capacity ?? "",

      currentReading:
        record.currentReading ?? "",

      previousReading:
        record.previousReading ?? "",

      consumption:
        record.consumption ?? "",

      unit:
        record.unit || "kWh",

      cost:
        record.cost ?? "",

      readingDate: record.readingDate
        ? String(record.readingDate).slice(0, 10)
        : "",

      billingPeriod:
        record.billingPeriod || "",

      status:
        record.status || "Active",

      condition:
        record.condition || "Good",

      responsiblePerson:
        record.responsiblePerson === "Unassigned"
          ? ""
          : record.responsiblePerson,

      supplier:
        record.supplier === "—"
          ? ""
          : record.supplier,

      description:
        record.description || "",

      remarks:
        record.remarks || "",
    });

    setShowModal(true);
  };

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.name.trim()) {
      setError("Energy management record name is required.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const payload = {
        name: form.name.trim(),
        code: form.code.trim() || undefined,
        energyType: form.energyType,
        source: form.source.trim() || undefined,
        location: form.location.trim() || undefined,
        meterNumber:
          form.meterNumber.trim() || undefined,
        meterType:
          form.meterType.trim() || undefined,

        capacity:
          form.capacity === ""
            ? undefined
            : Number(form.capacity),

        currentReading:
          form.currentReading === ""
            ? undefined
            : Number(form.currentReading),

        previousReading:
          form.previousReading === ""
            ? undefined
            : Number(form.previousReading),

        consumption:
          form.consumption === ""
            ? undefined
            : Number(form.consumption),

        unit: form.unit,

        cost:
          form.cost === ""
            ? undefined
            : Number(form.cost),

        readingDate:
          form.readingDate || undefined,

        billingPeriod:
          form.billingPeriod.trim() || undefined,

        status: form.status,
        condition: form.condition,

        responsiblePerson:
          form.responsiblePerson.trim() || undefined,

        supplier:
          form.supplier.trim() || undefined,

        description:
          form.description.trim() || undefined,

        remarks:
          form.remarks.trim() || undefined,
      };

      if (editingRecord?.id) {
        await api.put(
          `/infrastructure/energy/${editingRecord.id}`,
          payload
        );

        setSuccess(
          "Energy management record updated successfully."
        );
      } else {
        await api.post(
          "/infrastructure/energy",
          payload
        );

        setSuccess(
          "Energy management record created successfully."
        );
      }

      setShowModal(false);
      resetForm();

      await fetchEnergy();
    } catch (err) {
      console.error(
        "Failed to save energy record:",
        err
      );

      setError(
        err?.response?.data?.message ||
          "Unable to save the energy management record."
      );
    } finally {
      setSaving(false);
    }
  };

  const openDeleteDialog = (record) => {
    setSelectedRecord(record);
    setShowDelete(true);
  };

  const handleDelete = async () => {
    if (!selectedRecord?.id) return;

    try {
      setDeleting(true);
      setError("");

      await api.delete(
        `/infrastructure/energy/${selectedRecord.id}`
      );

      setSuccess(
        "Energy management record deleted successfully."
      );

      setShowDelete(false);
      setSelectedRecord(null);

      if (records.length === 1 && page > 1) {
        setPage((current) => current - 1);
      } else {
        await fetchEnergy();
      }
    } catch (err) {
      console.error(
        "Failed to delete energy record:",
        err
      );

      setError(
        err?.response?.data?.message ||
          "Unable to delete the energy management record."
      );
    } finally {
      setDeleting(false);
    }
  };

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("");
    setTypeFilter("");
    setLocationFilter("");
    setPage(1);
  };

  const openDetails = (record) => {
    setSelectedRecord(record);
    setShowDetails(true);
  };

  const canPrevious = page > 1;

  const canNext =
    page < Math.max(1, pagination.totalPages);

  return (
    <div className="energy-page">
      <style>{`
        * {
          box-sizing: border-box;
        }

        .energy-page {
          min-height: 100vh;
          background: #f8fafc;
          color: #0f172a;
          font-family: Inter, ui-sans-serif, system-ui,
            -apple-system, BlinkMacSystemFont, "Segoe UI",
            sans-serif;
          padding: 24px;
        }

        .energy-container {
          max-width: 1600px;
          margin: 0 auto;
        }

        .page-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 24px;
        }

        .header-left {
          display: flex;
          align-items: flex-start;
          gap: 14px;
        }

        .header-icon {
          width: 49px;
          height: 49px;
          border-radius: 14px;
          background: linear-gradient(
            135deg,
            #0ea5e9,
            #2563eb
          );
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          box-shadow:
            0 10px 25px
            rgba(37, 99, 235, 0.18);
        }

        .page-header h1 {
          margin: 0 0 5px;
          font-size: 27px;
          font-weight: 800;
          letter-spacing: -0.02em;
        }

        .page-header p {
          margin: 0;
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
          border-radius: 10px;
          padding: 0 14px;
          border: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-size: 13px;
          font-weight: 750;
          cursor: pointer;
          text-decoration: none;
          white-space: nowrap;
          transition: 0.2s ease;
        }

        .btn:hover {
          transform: translateY(-1px);
        }

        .btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
          transform: none;
        }

        .btn-primary {
          background: #0ea5e9;
          color: white;
          box-shadow:
            0 8px 20px
            rgba(14, 165, 233, 0.2);
        }

        .btn-primary:hover {
          background: #0284c7;
        }

        .btn-secondary {
          background: white;
          color: #334155;
          border: 1px solid #e2e8f0;
        }

        .btn-secondary:hover {
          background: #f8fafc;
          border-color: #cbd5e1;
        }

        .btn-danger {
          background: #dc2626;
          color: white;
        }

        .btn-danger:hover {
          background: #b91c1c;
        }

        .summary-grid {
          display: grid;
          grid-template-columns:
            repeat(5, minmax(0, 1fr));
          gap: 16px;
          margin-bottom: 20px;
        }

        .summary-card {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 15px;
          padding: 18px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          box-shadow:
            0 4px 18px
            rgba(15, 23, 42, 0.035);
        }

        .summary-label {
          color: #64748b;
          font-size: 11px;
          font-weight: 800;
          margin-bottom: 7px;
        }

        .summary-value {
          font-size: 25px;
          line-height: 1;
          font-weight: 800;
        }

        .summary-icon {
          width: 42px;
          height: 42px;
          border-radius: 12px;
          background: #eff6ff;
          color: #2563eb;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .summary-card.success
          .summary-icon {
          background: #f0fdf4;
          color: #16a34a;
        }

        .summary-card.warning
          .summary-icon {
          background: #fffbeb;
          color: #d97706;
        }

        .summary-card.danger
          .summary-icon {
          background: #fef2f2;
          color: #dc2626;
        }

        .summary-card.purple
          .summary-icon {
          background: #f5f3ff;
          color: #7c3aed;
        }

        .toolbar {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 15px;
          padding: 15px;
          margin-bottom: 18px;
          box-shadow:
            0 4px 18px
            rgba(15, 23, 42, 0.035);
        }

        .toolbar-row {
          display: flex;
          gap: 10px;
          align-items: center;
          flex-wrap: wrap;
        }

        .search-box {
          position: relative;
          flex: 1 1 300px;
          min-width: 240px;
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
          padding:
            0 13px 0 39px;
          border:
            1px solid #e2e8f0;
          border-radius: 10px;
          outline: none;
          font-size: 13px;
          color: #0f172a;
        }

        .filter-select {
          height: 42px;
          min-width: 145px;
          padding: 0 30px 0 11px;
          border:
            1px solid #e2e8f0;
          border-radius: 10px;
          background: white;
          color: #334155;
          outline: none;
          font-size: 13px;
        }

        .search-box input:focus,
        .filter-select:focus,
        .form-input:focus,
        .form-select:focus,
        .form-textarea:focus {
          border-color: #0ea5e9;
          box-shadow:
            0 0 0 3px
            rgba(14, 165, 233, 0.1);
        }

        .table-card {
          background: white;
          border:
            1px solid #e2e8f0;
          border-radius: 15px;
          overflow: hidden;
          box-shadow:
            0 4px 18px
            rgba(15, 23, 42, 0.035);
        }

        .table-header {
          padding: 16px 18px;
          border-bottom:
            1px solid #e2e8f0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .table-title {
          font-size: 15px;
          font-weight: 800;
        }

        .table-subtitle {
          margin-top: 3px;
          font-size: 12px;
          color: #64748b;
        }

        .table-wrapper {
          overflow-x: auto;
        }

        table {
          width: 100%;
          min-width: 1200px;
          border-collapse: collapse;
        }

        th {
          background: #f8fafc;
          padding: 13px 15px;
          text-align: left;
          font-size: 11px;
          color: #64748b;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          border-bottom:
            1px solid #e2e8f0;
          white-space: nowrap;
        }

        td {
          padding: 14px 15px;
          border-bottom:
            1px solid #f1f5f9;
          font-size: 13px;
          vertical-align: middle;
        }

        tbody tr:hover {
          background: #f8fbff;
        }

        .primary-text {
          color: #0f172a;
          font-weight: 750;
        }

        .secondary-text {
          color: #64748b;
          font-size: 11px;
          margin-top: 3px;
        }

        .energy-cell {
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .energy-icon {
          width: 35px;
          height: 35px;
          border-radius: 9px;
          background: #eff6ff;
          color: #2563eb;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 25px;
          padding: 0 9px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 800;
          white-space: nowrap;
        }

        .badge.success {
          background: #dcfce7;
          color: #166534;
        }

        .badge.warning {
          background: #fef3c7;
          color: #92400e;
        }

        .badge.danger {
          background: #fee2e2;
          color: #991b1b;
        }

        .badge.info {
          background: #dbeafe;
          color: #1d4ed8;
        }

        .badge.default {
          background: #f1f5f9;
          color: #475569;
        }

        .action-buttons {
          display: flex;
          gap: 5px;
        }

        .icon-btn {
          width: 34px;
          height: 34px;
          border:
            1px solid #e2e8f0;
          background: white;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: #475569;
          transition: 0.2s ease;
        }

        .icon-btn:hover {
          color: #0284c7;
          background: #f0f9ff;
          border-color: #bae6fd;
        }

        .icon-btn.delete:hover {
          color: #dc2626;
          background: #fef2f2;
          border-color: #fecaca;
        }

        .pagination {
          padding: 14px 18px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .pagination-info {
          font-size: 12px;
          color: #64748b;
        }

        .pagination-actions {
          display: flex;
          align-items: center;
          gap: 7px;
        }

        .page-btn {
          width: 35px;
          height: 35px;
          border:
            1px solid #e2e8f0;
          border-radius: 8px;
          background: white;
          color: #475569;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .page-btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .page-number {
          min-width: 42px;
          height: 35px;
          padding: 0 8px;
          border-radius: 8px;
          background: #eff6ff;
          color: #2563eb;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 800;
        }

        .loading-state,
        .empty-state {
          padding: 60px 20px;
          text-align: center;
          color: #64748b;
        }

        .loading-icon {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .empty-icon {
          width: 50px;
          height: 50px;
          margin: 0 auto 12px;
          border-radius: 14px;
          background: #f1f5f9;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #64748b;
        }

        .alert {
          padding: 12px 14px;
          border-radius: 11px;
          margin-bottom: 15px;
          display: flex;
          align-items: center;
          gap: 9px;
          font-size: 13px;
          font-weight: 650;
        }

        .alert-error {
          background: #fef2f2;
          color: #991b1b;
          border:
            1px solid #fecaca;
        }

        .alert-success {
          background: #f0fdf4;
          color: #166534;
          border:
            1px solid #bbf7d0;
        }

        .modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 1000;
          padding: 20px;
          background:
            rgba(15, 23, 42, 0.58);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .modal {
          width: min(920px, 100%);
          max-height: 92vh;
          overflow-y: auto;
          background: white;
          border-radius: 18px;
          box-shadow:
            0 25px 80px
            rgba(15, 23, 42, 0.25);
        }

        .modal.small {
          width: min(460px, 100%);
        }

        .modal-header {
          padding: 18px 20px;
          border-bottom:
            1px solid #e2e8f0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          position: sticky;
          top: 0;
          background: white;
          z-index: 2;
        }

        .modal-header h2 {
          margin: 0;
          font-size: 18px;
          font-weight: 800;
        }

        .modal-header p {
          margin: 4px 0 0;
          color: #64748b;
          font-size: 12px;
        }

        .close-btn {
          width: 36px;
          height: 36px;
          border:
            1px solid #e2e8f0;
          border-radius: 9px;
          background: white;
          color: #64748b;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .modal-body {
          padding: 20px;
        }

        .form-grid {
          display: grid;
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
          gap: 15px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .form-group.full {
          grid-column: 1 / -1;
        }

        .form-label {
          font-size: 12px;
          font-weight: 800;
          color: #334155;
        }

        .form-input,
        .form-select,
        .form-textarea {
          width: 100%;
          border:
            1px solid #e2e8f0;
          border-radius: 9px;
          outline: none;
          color: #0f172a;
          background: white;
          font-size: 13px;
        }

        .form-input,
        .form-select {
          height: 42px;
          padding: 0 11px;
        }

        .form-textarea {
          min-height: 95px;
          padding: 10px 11px;
          resize: vertical;
        }

        .modal-footer {
          padding: 15px 20px;
          border-top:
            1px solid #e2e8f0;
          display: flex;
          justify-content: flex-end;
          gap: 9px;
          position: sticky;
          bottom: 0;
          background: white;
        }

        .details-grid {
          display: grid;
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
          gap: 13px;
        }

        .detail-item {
          padding: 13px;
          border:
            1px solid #e2e8f0;
          border-radius: 11px;
          background: #f8fafc;
        }

        .detail-item.full {
          grid-column: 1 / -1;
        }

        .detail-label {
          font-size: 10px;
          color: #64748b;
          font-weight: 800;
          margin-bottom: 5px;
        }

        .detail-value {
          font-size: 13px;
          color: #0f172a;
          font-weight: 650;
          word-break: break-word;
        }

        .confirm-content {
          text-align: center;
        }

        .confirm-icon {
          width: 52px;
          height: 52px;
          margin: 0 auto 14px;
          border-radius: 14px;
          background: #fef2f2;
          color: #dc2626;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .confirm-content h3 {
          margin: 0 0 7px;
          font-size: 18px;
        }

        .confirm-content p {
          margin: 0;
          color: #64748b;
          line-height: 1.6;
          font-size: 13px;
        }

        .confirm-content strong {
          color: #334155;
        }

        .confirm-footer {
          justify-content: center;
        }

        .quick-links {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 18px;
        }

        .quick-link {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 9px 12px;
          border:
            1px solid #e2e8f0;
          border-radius: 9px;
          background: white;
          color: #334155;
          text-decoration: none;
          font-size: 12px;
          font-weight: 700;
        }

        .quick-link:hover {
          background: #f0f9ff;
          color: #0284c7;
          border-color: #bae6fd;
        }

        @media (max-width: 1200px) {
          .summary-grid {
            grid-template-columns:
              repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 800px) {
          .energy-page {
            padding: 14px;
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
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }

          .form-grid,
          .details-grid {
            grid-template-columns: 1fr;
          }

          .form-group.full,
          .detail-item.full {
            grid-column: auto;
          }
        }

        @media (max-width: 520px) {
          .summary-grid {
            grid-template-columns: 1fr;
          }

          .toolbar-row {
            flex-direction: column;
            align-items: stretch;
          }

          .search-box {
            min-width: 100%;
          }

          .filter-select,
          .toolbar-row .btn {
            width: 100%;
          }

          .page-header h1 {
            font-size: 23px;
          }
        }
      `}</style>

      <div className="energy-container">
        <div className="page-header">
          <div className="header-left">
            <div className="header-icon">
              <Zap size={25} />
            </div>

            <div>
              <h1>Energy Management</h1>
              <p>
                Monitor energy sources, meters, consumption,
                costs, and infrastructure energy performance.
              </p>
            </div>
          </div>

          <div className="header-actions">
            <Link
              to="/infrastructure"
              className="btn btn-secondary"
            >
              <BarChart3 size={16} />
              Dashboard
            </Link>

            <Link
              to="/infrastructure/solar"
              className="btn btn-secondary"
            >
              <TrendingUp size={16} />
              Solar Energy
            </Link>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={fetchEnergy}
              disabled={loading}
            >
              <RefreshCw
                size={16}
                className={
                  loading ? "loading-icon" : ""
                }
              />
              Refresh
            </button>

            <button
              type="button"
              className="btn btn-primary"
              onClick={openCreateModal}
            >
              <Plus size={17} />
              Add Energy Record
            </button>
          </div>
        </div>

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

        <div className="summary-grid">
          <div className="summary-card">
            <div>
              <div className="summary-label">
                TOTAL RECORDS
              </div>
              <div className="summary-value">
                {summary.total}
              </div>
            </div>

            <div className="summary-icon">
              <Gauge size={20} />
            </div>
          </div>

          <div className="summary-card success">
            <div>
              <div className="summary-label">
                ACTIVE
              </div>
              <div className="summary-value">
                {summary.active}
              </div>
            </div>

            <div className="summary-icon">
              <CheckCircle2 size={20} />
            </div>
          </div>

          <div className="summary-card warning">
            <div>
              <div className="summary-label">
                MAINTENANCE
              </div>
              <div className="summary-value">
                {summary.maintenance}
              </div>
            </div>

            <div className="summary-icon">
              <Settings size={20} />
            </div>
          </div>

          <div className="summary-card danger">
            <div>
              <div className="summary-label">
                FAULT / FAILED
              </div>
              <div className="summary-value">
                {summary.fault}
              </div>
            </div>

            <div className="summary-icon">
              <AlertCircle size={20} />
            </div>
          </div>

          <div className="summary-card purple">
            <div>
              <div className="summary-label">
                CRITICAL CONDITION
              </div>
              <div className="summary-value">
                {summary.critical}
              </div>
            </div>

            <div className="summary-icon">
              <Activity size={20} />
            </div>
          </div>
        </div>

        <div className="toolbar">
          <div className="toolbar-row">
            <div className="search-box">
              <Search size={17} />

              <input
                type="search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Search energy records, meters, locations..."
              />
            </div>

            <select
              className="filter-select"
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="">
                All Statuses
              </option>

              {STATUS_OPTIONS.map((status) => (
                <option
                  key={status}
                  value={status}
                >
                  {status}
                </option>
              ))}
            </select>

            <select
              className="filter-select"
              value={typeFilter}
              onChange={(event) => {
                setTypeFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="">
                All Energy Types
              </option>

              {ENERGY_TYPES.map((type) => (
                <option
                  key={type}
                  value={type}
                >
                  {type}
                </option>
              ))}
            </select>

            <input
              className="filter-select"
              value={locationFilter}
              onChange={(event) => {
                setLocationFilter(event.target.value);
                setPage(1);
              }}
              placeholder="Location"
            />

            {(search ||
              statusFilter ||
              typeFilter ||
              locationFilter) && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={clearFilters}
              >
                <X size={15} />
                Clear
              </button>
            )}
          </div>
        </div>

        <div className="table-card">
          <div className="table-header">
            <div>
              <div className="table-title">
                Energy Management Records
              </div>

              <div className="table-subtitle">
                Real energy infrastructure data returned
                from the backend.
              </div>
            </div>

            <Filter
              size={18}
              color="#64748b"
            />
          </div>

          {loading ? (
            <div className="loading-state">
              <Loader2
                size={30}
                className="loading-icon"
              />

              <div>
                Loading energy management records...
              </div>
            </div>
          ) : records.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                <Zap size={23} />
              </div>

              <div className="primary-text">
                No energy management records found
              </div>

              <div className="secondary-text">
                {search ||
                statusFilter ||
                typeFilter ||
                locationFilter
                  ? "Try changing the search or filters."
                  : "Create the first energy management record to get started."}
              </div>

              {!search &&
                !statusFilter &&
                !typeFilter &&
                !locationFilter && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ marginTop: 16 }}
                    onClick={openCreateModal}
                  >
                    <Plus size={16} />
                    Add Energy Record
                  </button>
                )}
            </div>
          ) : (
            <>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>
                        Energy Record
                      </th>
                      <th>
                        Type / Source
                      </th>
                      <th>
                        Location
                      </th>
                      <th>
                        Meter
                      </th>
                      <th>
                        Consumption
                      </th>
                      <th>
                        Cost
                      </th>
                      <th>
                        Reading Date
                      </th>
                      <th>
                        Status
                      </th>
                      <th>
                        Condition
                      </th>
                      <th>
                        Responsible
                      </th>
                      <th>
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {records.map((record) => (
                      <tr key={record.id}>
                        <td>
                          <div className="energy-cell">
                            <div className="energy-icon">
                              <Zap size={16} />
                            </div>

                            <div>
                              <div className="primary-text">
                                {record.name}
                              </div>

                              <div className="secondary-text">
                                {record.code}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td>
                          <div className="primary-text">
                            {record.energyType}
                          </div>

                          <div className="secondary-text">
                            {record.source}
                          </div>
                        </td>

                        <td>
                          <div className="energy-cell">
                            <MapPin
                              size={15}
                              color="#64748b"
                            />
                            <span>
                              {record.location}
                            </span>
                          </div>
                        </td>

                        <td>
                          <div className="primary-text">
                            {record.meterNumber}
                          </div>

                          <div className="secondary-text">
                            {record.meterType}
                          </div>
                        </td>

                        <td>
                          <div className="primary-text">
                            {formatNumber(
                              record.consumption
                            )}
                          </div>

                          <div className="secondary-text">
                            {record.unit}
                          </div>
                        </td>

                        <td>
                          {formatMoney(record.cost)}
                        </td>

                        <td>
                          {formatDate(
                            record.readingDate
                          )}
                        </td>

                        <td>
                          <span
                            className={`badge ${getStatusClass(
                              record.status
                            )}`}
                          >
                            {record.status}
                          </span>
                        </td>

                        <td>
                          <span
                            className={`badge ${getConditionClass(
                              record.condition
                            )}`}
                          >
                            {record.condition}
                          </span>
                        </td>

                        <td>
                          <div className="energy-cell">
                            <User
                              size={15}
                              color="#64748b"
                            />
                            <span>
                              {record.responsiblePerson}
                            </span>
                          </div>
                        </td>

                        <td>
                          <div className="action-buttons">
                            <button
                              type="button"
                              className="icon-btn"
                              title="View details"
                              onClick={() =>
                                openDetails(record)
                              }
                            >
                              <Eye size={16} />
                            </button>

                            <button
                              type="button"
                              className="icon-btn"
                              title="Edit"
                              onClick={() =>
                                openEditModal(record)
                              }
                            >
                              <Edit3 size={16} />
                            </button>

                            <button
                              type="button"
                              className="icon-btn delete"
                              title="Delete"
                              onClick={() =>
                                openDeleteDialog(record)
                              }
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="pagination">
                <div className="pagination-info">
                  Showing {records.length} of{" "}
                  {pagination.total} records
                </div>

                <div className="pagination-actions">
                  <button
                    type="button"
                    className="page-btn"
                    disabled={
                      !canPrevious || loading
                    }
                    onClick={() =>
                      setPage((current) =>
                        Math.max(1, current - 1)
                      )
                    }
                  >
                    <ChevronLeft size={17} />
                  </button>

                  <div className="page-number">
                    {page} /{" "}
                    {Math.max(
                      1,
                      pagination.totalPages
                    )}
                  </div>

                  <button
                    type="button"
                    className="page-btn"
                    disabled={
                      !canNext || loading
                    }
                    onClick={() =>
                      setPage((current) =>
                        Math.min(
                          pagination.totalPages,
                          current + 1
                        )
                      )
                    }
                  >
                    <ChevronRight size={17} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="quick-links">
          <Link
            to="/infrastructure"
            className="quick-link"
          >
            <BarChart3 size={15} />
            Infrastructure Dashboard
          </Link>

          <Link
            to="/infrastructure/solar"
            className="quick-link"
          >
            <TrendingUp size={15} />
            Solar Energy
          </Link>

          <Link
            to="/infrastructure/generators"
            className="quick-link"
          >
            <Zap size={15} />
            Generators
          </Link>

          <Link
            to="/infrastructure/transformers"
            className="quick-link"
          >
            <Activity size={15} />
            Transformers
          </Link>
        </div>
      </div>

      {showModal && (
        <div
          className="modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !saving
            ) {
              setShowModal(false);
            }
          }}
        >
          <div className="modal">
            <div className="modal-header">
              <div>
                <h2>
                  {editingRecord
                    ? "Edit Energy Management Record"
                    : "Add Energy Management Record"}
                </h2>

                <p>
                  Enter actual infrastructure energy
                  information.
                </p>
              </div>

              <button
                type="button"
                className="close-btn"
                onClick={() =>
                  !saving && setShowModal(false)
                }
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">
                      Energy Record Name *
                    </label>

                    <input
                      className="form-input"
                      name="name"
                      value={form.name}
                      onChange={handleChange}
                      placeholder="e.g. Main Campus Electricity"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Code
                    </label>

                    <input
                      className="form-input"
                      name="code"
                      value={form.code}
                      onChange={handleChange}
                      placeholder="ENERGY-001"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Energy Type
                    </label>

                    <select
                      className="form-select"
                      name="energyType"
                      value={form.energyType}
                      onChange={handleChange}
                    >
                      {ENERGY_TYPES.map(
                        (type) => (
                          <option
                            key={type}
                            value={type}
                          >
                            {type}
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Energy Source
                    </label>

                    <input
                      className="form-input"
                      name="source"
                      value={form.source}
                      onChange={handleChange}
                      placeholder="Grid, Solar, Generator..."
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Location
                    </label>

                    <input
                      className="form-input"
                      name="location"
                      value={form.location}
                      onChange={handleChange}
                      placeholder="Building / facility / area"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Meter Number
                    </label>

                    <input
                      className="form-input"
                      name="meterNumber"
                      value={form.meterNumber}
                      onChange={handleChange}
                      placeholder="Meter identification number"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Meter Type
                    </label>

                    <input
                      className="form-input"
                      name="meterType"
                      value={form.meterType}
                      onChange={handleChange}
                      placeholder="Digital, Smart, Analog..."
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Capacity
                    </label>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="form-input"
                      name="capacity"
                      value={form.capacity}
                      onChange={handleChange}
                      placeholder="Capacity"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Previous Reading
                    </label>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="form-input"
                      name="previousReading"
                      value={form.previousReading}
                      onChange={handleChange}
                      placeholder="Previous meter reading"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Current Reading
                    </label>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="form-input"
                      name="currentReading"
                      value={form.currentReading}
                      onChange={handleChange}
                      placeholder="Current meter reading"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Consumption
                    </label>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="form-input"
                      name="consumption"
                      value={form.consumption}
                      onChange={handleChange}
                      placeholder="Energy consumed"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Measurement Unit
                    </label>

                    <select
                      className="form-select"
                      name="unit"
                      value={form.unit}
                      onChange={handleChange}
                    >
                      {UNIT_OPTIONS.map(
                        (unit) => (
                          <option
                            key={unit}
                            value={unit}
                          >
                            {unit}
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Energy Cost
                    </label>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="form-input"
                      name="cost"
                      value={form.cost}
                      onChange={handleChange}
                      placeholder="0.00"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Reading Date
                    </label>

                    <input
                      type="date"
                      className="form-input"
                      name="readingDate"
                      value={form.readingDate}
                      onChange={handleChange}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Billing Period
                    </label>

                    <input
                      className="form-input"
                      name="billingPeriod"
                      value={form.billingPeriod}
                      onChange={handleChange}
                      placeholder="e.g. September 2026"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Status
                    </label>

                    <select
                      className="form-select"
                      name="status"
                      value={form.status}
                      onChange={handleChange}
                    >
                      {STATUS_OPTIONS.map(
                        (status) => (
                          <option
                            key={status}
                            value={status}
                          >
                            {status}
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Condition
                    </label>

                    <select
                      className="form-select"
                      name="condition"
                      value={form.condition}
                      onChange={handleChange}
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
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Responsible Person
                    </label>

                    <input
                      className="form-input"
                      name="responsiblePerson"
                      value={
                        form.responsiblePerson
                      }
                      onChange={handleChange}
                      placeholder="Responsible officer"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Supplier / Provider
                    </label>

                    <input
                      className="form-input"
                      name="supplier"
                      value={form.supplier}
                      onChange={handleChange}
                      placeholder="Utility or energy provider"
                    />
                  </div>

                  <div className="form-group full">
                    <label className="form-label">
                      Description
                    </label>

                    <textarea
                      className="form-textarea"
                      name="description"
                      value={form.description}
                      onChange={handleChange}
                      placeholder="Energy system description..."
                    />
                  </div>

                  <div className="form-group full">
                    <label className="form-label">
                      Remarks
                    </label>

                    <textarea
                      className="form-textarea"
                      name="remarks"
                      value={form.remarks}
                      onChange={handleChange}
                      placeholder="Additional notes..."
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() =>
                    setShowModal(false)
                  }
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
                      <Loader2
                        size={16}
                        className="loading-icon"
                      />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} />
                      {editingRecord
                        ? "Update Record"
                        : "Create Record"}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDetails && selectedRecord && (
        <div
          className="modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget
            ) {
              setShowDetails(false);
            }
          }}
        >
          <div className="modal">
            <div className="modal-header">
              <div>
                <h2>
                  Energy Management Details
                </h2>

                <p>
                  {selectedRecord.code}
                </p>
              </div>

              <button
                type="button"
                className="close-btn"
                onClick={() =>
                  setShowDetails(false)
                }
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <div className="details-grid">
                <div className="detail-item">
                  <div className="detail-label">
                    NAME
                  </div>

                  <div className="detail-value">
                    {selectedRecord.name}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    CODE
                  </div>

                  <div className="detail-value">
                    {selectedRecord.code}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    ENERGY TYPE
                  </div>

                  <div className="detail-value">
                    {selectedRecord.energyType}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    SOURCE
                  </div>

                  <div className="detail-value">
                    {selectedRecord.source}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    LOCATION
                  </div>

                  <div className="detail-value">
                    {selectedRecord.location}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    METER NUMBER
                  </div>

                  <div className="detail-value">
                    {selectedRecord.meterNumber}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    METER TYPE
                  </div>

                  <div className="detail-value">
                    {selectedRecord.meterType}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    CAPACITY
                  </div>

                  <div className="detail-value">
                    {formatNumber(
                      selectedRecord.capacity
                    )}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    PREVIOUS READING
                  </div>

                  <div className="detail-value">
                    {formatNumber(
                      selectedRecord.previousReading
                    )}{" "}
                    {selectedRecord.unit}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    CURRENT READING
                  </div>

                  <div className="detail-value">
                    {formatNumber(
                      selectedRecord.currentReading
                    )}{" "}
                    {selectedRecord.unit}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    CONSUMPTION
                  </div>

                  <div className="detail-value">
                    {formatNumber(
                      selectedRecord.consumption
                    )}{" "}
                    {selectedRecord.unit}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    COST
                  </div>

                  <div className="detail-value">
                    {formatMoney(
                      selectedRecord.cost
                    )}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    READING DATE
                  </div>

                  <div className="detail-value">
                    {formatDate(
                      selectedRecord.readingDate
                    )}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    BILLING PERIOD
                  </div>

                  <div className="detail-value">
                    {selectedRecord.billingPeriod ||
                      "—"}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    STATUS
                  </div>

                  <div className="detail-value">
                    <span
                      className={`badge ${getStatusClass(
                        selectedRecord.status
                      )}`}
                    >
                      {selectedRecord.status}
                    </span>
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    CONDITION
                  </div>

                  <div className="detail-value">
                    <span
                      className={`badge ${getConditionClass(
                        selectedRecord.condition
                      )}`}
                    >
                      {selectedRecord.condition}
                    </span>
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    RESPONSIBLE PERSON
                  </div>

                  <div className="detail-value">
                    {selectedRecord.responsiblePerson}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    SUPPLIER
                  </div>

                  <div className="detail-value">
                    {selectedRecord.supplier}
                  </div>
                </div>

                <div className="detail-item full">
                  <div className="detail-label">
                    DESCRIPTION
                  </div>

                  <div className="detail-value">
                    {selectedRecord.description ||
                      "—"}
                  </div>
                </div>

                <div className="detail-item full">
                  <div className="detail-label">
                    REMARKS
                  </div>

                  <div className="detail-value">
                    {selectedRecord.remarks ||
                      "—"}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    CREATED
                  </div>

                  <div className="detail-value">
                    {formatDateTime(
                      selectedRecord.createdAt
                    )}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    UPDATED
                  </div>

                  <div className="detail-value">
                    {formatDateTime(
                      selectedRecord.updatedAt
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() =>
                  setShowDetails(false)
                }
              >
                Close
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setShowDetails(false);
                  openEditModal(selectedRecord);
                }}
              >
                <Edit3 size={16} />
                Edit Record
              </button>
            </div>
          </div>
        </div>
      )}

      {showDelete && selectedRecord && (
        <div
          className="modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !deleting
            ) {
              setShowDelete(false);
            }
          }}
        >
          <div className="modal small">
            <div className="modal-header">
              <div>
                <h2>
                  Delete Energy Record
                </h2>

                <p>
                  This action cannot be undone.
                </p>
              </div>

              <button
                type="button"
                className="close-btn"
                onClick={() =>
                  !deleting &&
                  setShowDelete(false)
                }
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <div className="confirm-content">
                <div className="confirm-icon">
                  <XCircle size={25} />
                </div>

                <h3>
                  Are you sure?
                </h3>

                <p>
                  You are about to delete{" "}
                  <strong>
                    {selectedRecord.name}
                  </strong>
                  . The record will be removed from
                  the energy management system.
                </p>
              </div>
            </div>

            <div className="modal-footer confirm-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() =>
                  setShowDelete(false)
                }
                disabled={deleting}
              >
                Cancel
              </button>

              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? (
                  <>
                    <Loader2
                      size={16}
                      className="loading-icon"
                    />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    Delete Record
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