import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import {
  AlertCircle,
  BarChart3,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Droplets,
  Edit3,
  Eye,
  Filter,
  Fuel,
  Gauge,
  Loader2,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Trash2,
  User,
  X,
  XCircle,
} from "lucide-react";

const INITIAL_FORM = {
  name: "",
  code: "",
  fuelType: "Diesel",
  storageType: "",
  location: "",
  tankNumber: "",
  tankCapacity: "",
  currentStock: "",
  minimumStock: "",
  maximumStock: "",
  unit: "Liter",
  supplier: "",
  responsiblePerson: "",
  lastDeliveryDate: "",
  nextDeliveryDate: "",
  lastReading: "",
  status: "Active",
  condition: "Good",
  unitPrice: "",
  totalValue: "",
  description: "",
  remarks: "",
};

const STATUS_OPTIONS = [
  "Active",
  "Inactive",
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

const FUEL_TYPES = [
  "Diesel",
  "Petrol",
  "Kerosene",
  "Gasoline",
  "LPG",
  "Other",
];

const STORAGE_TYPES = [
  "Above Ground Tank",
  "Underground Tank",
  "Mobile Tank",
  "Container",
  "Other",
];

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

  const limit = Number(
    meta?.limit ||
      meta?.pageSize ||
      meta?.perPage ||
      10
  );

  return {
    page: Number(meta?.page || 1),
    limit,
    total,
    totalPages: Number(
      meta?.totalPages ||
        Math.ceil(total / limit) ||
        1
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

function normalizeFuel(row) {
  return {
    id:
      row.id ??
      row._id ??
      row.fuel_id,

    name:
      firstValue(
        row.name,
        row.fuelName,
        row.fuel_name,
        row.systemName,
        row.system_name
      ) || "Unnamed Fuel Record",

    code:
      firstValue(
        row.code,
        row.fuelCode,
        row.fuel_code,
        row.systemCode,
        row.system_code
      ) || "—",

    fuelType:
      firstValue(
        row.fuelType,
        row.fuel_type,
        row.type
      ) || "Diesel",

    storageType:
      firstValue(
        row.storageType,
        row.storage_type
      ) || "—",

    location:
      firstValue(
        row.location,
        row.locationName,
        row.location_name
      ) || "—",

    tankNumber:
      firstValue(
        row.tankNumber,
        row.tank_number,
        row.tankNo,
        row.tank_no
      ) || "—",

    tankCapacity:
      firstValue(
        row.tankCapacity,
        row.tank_capacity,
        row.capacity
      ) ?? "",

    currentStock:
      firstValue(
        row.currentStock,
        row.current_stock,
        row.stock,
        row.availableStock,
        row.available_stock
      ) ?? "",

    minimumStock:
      firstValue(
        row.minimumStock,
        row.minimum_stock,
        row.minStock,
        row.min_stock
      ) ?? "",

    maximumStock:
      firstValue(
        row.maximumStock,
        row.maximum_stock,
        row.maxStock,
        row.max_stock
      ) ?? "",

    unit:
      firstValue(
        row.unit,
        row.measurementUnit,
        row.measurement_unit
      ) || "Liter",

    supplier:
      firstValue(
        row.supplier,
        row.provider,
        row.vendor
      ) || "—",

    responsiblePerson:
      firstValue(
        row.responsiblePerson,
        row.responsible_person,
        row.assignedTo,
        row.assigned_to
      ) || "Unassigned",

    lastDeliveryDate:
      firstValue(
        row.lastDeliveryDate,
        row.last_delivery_date
      ) || "",

    nextDeliveryDate:
      firstValue(
        row.nextDeliveryDate,
        row.next_delivery_date
      ) || "",

    lastReading:
      firstValue(
        row.lastReading,
        row.last_reading,
        row.meterReading,
        row.meter_reading
      ) ?? "",

    status:
      firstValue(
        row.status,
        row.fuelStatus,
        row.fuel_status
      ) || "Active",

    condition:
      firstValue(
        row.condition,
        row.assetCondition,
        row.asset_condition
      ) || "Good",

    unitPrice:
      firstValue(
        row.unitPrice,
        row.unit_price,
        row.pricePerUnit,
        row.price_per_unit
      ) ?? "",

    totalValue:
      firstValue(
        row.totalValue,
        row.total_value,
        row.stockValue,
        row.stock_value
      ) ?? "",

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
  if (
    value === "" ||
    value === null ||
    value === undefined
  ) {
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
  if (
    value === "" ||
    value === null ||
    value === undefined
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

  if (value.includes("active")) {
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

function getStockClass(record) {
  const current = Number(record.currentStock);
  const minimum = Number(record.minimumStock);

  if (
    Number.isFinite(current) &&
    Number.isFinite(minimum) &&
    current <= minimum
  ) {
    return "danger";
  }

  return "success";
}

export default function InfrastructureFuel() {
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

  const fetchFuel = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get(
        "/infrastructure/fuel",
        {
          params: {
            page,
            limit,
            search: search.trim() || undefined,
            status: statusFilter || undefined,
            fuelType: typeFilter || undefined,
            type: typeFilter || undefined,
            location: locationFilter || undefined,
          },
        }
      );

      const rows = extractRows(response).map(
        normalizeFuel
      );

      setRecords(rows);

      const serverPagination =
        extractPagination(response, rows.length);

      setPagination({
        page: serverPagination.page || page,
        limit: serverPagination.limit || limit,
        total: serverPagination.total,
        totalPages: Math.max(
          1,
          serverPagination.totalPages
        ),
      });

      setSummaryFromApi(
        response?.data?.summary || null
      );
    } catch (err) {
      console.error(
        "Failed to load fuel management records:",
        err
      );

      setError(
        err?.response?.data?.message ||
          "Unable to load fuel management records."
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
    fetchFuel();
  }, [fetchFuel]);

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

    const lowStock = records.filter((item) => {
      const current = Number(item.currentStock);
      const minimum = Number(item.minimumStock);

      return (
        Number.isFinite(current) &&
        Number.isFinite(minimum) &&
        current <= minimum
      );
    }).length;

    const totalStock = records.reduce(
      (sum, item) => {
        const value = Number(item.currentStock);

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
      lowStock,
      totalStock,
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
        summaryFromApi?.activeTanks,
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

    lowStock: Number(
      firstValue(
        summaryFromApi?.lowStock,
        summaryFromApi?.low_stock,
        calculatedSummary.lowStock
      )
    ),

    critical: Number(
      firstValue(
        summaryFromApi?.critical,
        summaryFromApi?.criticalCondition,
        calculatedSummary.critical
      )
    ),

    totalStock: firstValue(
      summaryFromApi?.totalStock,
      summaryFromApi?.total_stock,
      calculatedSummary.totalStock
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
        record.name === "Unnamed Fuel Record"
          ? ""
          : record.name,

      code:
        record.code === "—"
          ? ""
          : record.code,

      fuelType:
        record.fuelType || "Diesel",

      storageType:
        record.storageType === "—"
          ? ""
          : record.storageType,

      location:
        record.location === "—"
          ? ""
          : record.location,

      tankNumber:
        record.tankNumber === "—"
          ? ""
          : record.tankNumber,

      tankCapacity:
        record.tankCapacity ?? "",

      currentStock:
        record.currentStock ?? "",

      minimumStock:
        record.minimumStock ?? "",

      maximumStock:
        record.maximumStock ?? "",

      unit:
        record.unit || "Liter",

      supplier:
        record.supplier === "—"
          ? ""
          : record.supplier,

      responsiblePerson:
        record.responsiblePerson === "Unassigned"
          ? ""
          : record.responsiblePerson,

      lastDeliveryDate: record.lastDeliveryDate
        ? String(record.lastDeliveryDate).slice(
            0,
            10
          )
        : "",

      nextDeliveryDate: record.nextDeliveryDate
        ? String(record.nextDeliveryDate).slice(
            0,
            10
          )
        : "",

      lastReading:
        record.lastReading ?? "",

      status:
        record.status || "Active",

      condition:
        record.condition || "Good",

      unitPrice:
        record.unitPrice ?? "",

      totalValue:
        record.totalValue ?? "",

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
      setError("Fuel management record name is required.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const payload = {
        name: form.name.trim(),
        code: form.code.trim() || undefined,

        fuelType: form.fuelType,

        storageType:
          form.storageType.trim() || undefined,

        location:
          form.location.trim() || undefined,

        tankNumber:
          form.tankNumber.trim() || undefined,

        tankCapacity:
          form.tankCapacity === ""
            ? undefined
            : Number(form.tankCapacity),

        currentStock:
          form.currentStock === ""
            ? undefined
            : Number(form.currentStock),

        minimumStock:
          form.minimumStock === ""
            ? undefined
            : Number(form.minimumStock),

        maximumStock:
          form.maximumStock === ""
            ? undefined
            : Number(form.maximumStock),

        unit: form.unit,

        supplier:
          form.supplier.trim() || undefined,

        responsiblePerson:
          form.responsiblePerson.trim() ||
          undefined,

        lastDeliveryDate:
          form.lastDeliveryDate || undefined,

        nextDeliveryDate:
          form.nextDeliveryDate || undefined,

        lastReading:
          form.lastReading === ""
            ? undefined
            : Number(form.lastReading),

        status: form.status,
        condition: form.condition,

        unitPrice:
          form.unitPrice === ""
            ? undefined
            : Number(form.unitPrice),

        totalValue:
          form.totalValue === ""
            ? undefined
            : Number(form.totalValue),

        description:
          form.description.trim() || undefined,

        remarks:
          form.remarks.trim() || undefined,
      };

      if (editingRecord?.id) {
        await api.put(
          `/infrastructure/fuel/${editingRecord.id}`,
          payload
        );

        setSuccess(
          "Fuel management record updated successfully."
        );
      } else {
        await api.post(
          "/infrastructure/fuel",
          payload
        );

        setSuccess(
          "Fuel management record created successfully."
        );
      }

      setShowModal(false);
      resetForm();

      await fetchFuel();
    } catch (err) {
      console.error(
        "Failed to save fuel record:",
        err
      );

      setError(
        err?.response?.data?.message ||
          "Unable to save the fuel management record."
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
        `/infrastructure/fuel/${selectedRecord.id}`
      );

      setSuccess(
        "Fuel management record deleted successfully."
      );

      setShowDelete(false);
      setSelectedRecord(null);

      if (records.length === 1 && page > 1) {
        setPage((current) => current - 1);
      } else {
        await fetchFuel();
      }
    } catch (err) {
      console.error(
        "Failed to delete fuel record:",
        err
      );

      setError(
        err?.response?.data?.message ||
          "Unable to delete the fuel management record."
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
    page < Math.max(
      1,
      pagination.totalPages
    );

  return (
    <div className="fuel-page">
      <style>{`
        * {
          box-sizing: border-box;
        }

        .fuel-page {
          min-height: 100vh;
          background: #f8fafc;
          color: #0f172a;
          font-family: Inter, ui-sans-serif, system-ui,
            -apple-system, BlinkMacSystemFont, "Segoe UI",
            sans-serif;
          padding: 24px;
        }

        .fuel-container {
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
          padding: 0 11px;
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
          border: 1px solid #e2e8f0;
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
          min-width: 1250px;
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

        .fuel-cell {
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .fuel-icon {
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

        .stock-low {
          color: #dc2626;
          font-weight: 800;
        }

        .stock-good {
          color: #15803d;
          font-weight: 750;
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
          width: min(950px, 100%);
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
          .fuel-page {
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

      <div className="fuel-container">
        <div className="page-header">
          <div className="header-left">
            <div className="header-icon">
              <Fuel size={25} />
            </div>

            <div>
              <h1>Fuel Management</h1>
              <p>
                Manage fuel storage, stock levels,
                suppliers, deliveries, consumption,
                and fuel infrastructure.
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
              to="/infrastructure/generators"
              className="btn btn-secondary"
            >
              <Settings size={16} />
              Generators
            </Link>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={fetchFuel}
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
              Add Fuel Record
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
              <Fuel size={20} />
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
                LOW STOCK
              </div>
              <div className="summary-value">
                {summary.lowStock}
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
              <Gauge size={20} />
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
                placeholder="Search fuel records, tanks, suppliers..."
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
                All Fuel Types
              </option>

              {FUEL_TYPES.map((type) => (
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
                Fuel Management Records
              </div>

              <div className="table-subtitle">
                Real fuel infrastructure data returned
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
                Loading fuel management records...
              </div>
            </div>
          ) : records.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                <Fuel size={23} />
              </div>

              <div className="primary-text">
                No fuel management records found
              </div>

              <div className="secondary-text">
                {search ||
                statusFilter ||
                typeFilter ||
                locationFilter
                  ? "Try changing the search or filters."
                  : "Create the first fuel management record to get started."}
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
                    Add Fuel Record
                  </button>
                )}
            </div>
          ) : (
            <>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Fuel Record</th>
                      <th>Type / Storage</th>
                      <th>Location</th>
                      <th>Tank</th>
                      <th>Current Stock</th>
                      <th>Supplier</th>
                      <th>Last Delivery</th>
                      <th>Status</th>
                      <th>Condition</th>
                      <th>Responsible</th>
                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {records.map((record) => (
                      <tr key={record.id}>
                        <td>
                          <div className="fuel-cell">
                            <div className="fuel-icon">
                              <Fuel size={16} />
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
                            {record.fuelType}
                          </div>

                          <div className="secondary-text">
                            {record.storageType}
                          </div>
                        </td>

                        <td>
                          <div className="fuel-cell">
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
                            {record.tankNumber}
                          </div>

                          <div className="secondary-text">
                            Capacity:{" "}
                            {formatNumber(
                              record.tankCapacity
                            )}{" "}
                            {record.unit}
                          </div>
                        </td>

                        <td>
                          <div
                            className={
                              getStockClass(record) ===
                              "danger"
                                ? "stock-low"
                                : "stock-good"
                            }
                          >
                            {formatNumber(
                              record.currentStock
                            )}{" "}
                            {record.unit}
                          </div>

                          <div className="secondary-text">
                            Min:{" "}
                            {formatNumber(
                              record.minimumStock
                            )}
                          </div>
                        </td>

                        <td>
                          {record.supplier}
                        </td>

                        <td>
                          {formatDate(
                            record.lastDeliveryDate
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
                          <div className="fuel-cell">
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
                        Math.max(
                          1,
                          current - 1
                        )
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
            to="/infrastructure/generators"
            className="quick-link"
          >
            <Settings size={15} />
            Generators
          </Link>

          <Link
            to="/infrastructure/energy"
            className="quick-link"
          >
            <Gauge size={15} />
            Energy Management
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
                    ? "Edit Fuel Management Record"
                    : "Add Fuel Management Record"}
                </h2>

                <p>
                  Enter actual fuel storage and
                  management information.
                </p>
              </div>

              <button
                type="button"
                className="close-btn"
                onClick={() =>
                  !saving &&
                  setShowModal(false)
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
                      Fuel Record Name *
                    </label>

                    <input
                      className="form-input"
                      name="name"
                      value={form.name}
                      onChange={handleChange}
                      placeholder="e.g. Main Generator Fuel Tank"
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
                      placeholder="FUEL-001"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Fuel Type
                    </label>

                    <select
                      className="form-select"
                      name="fuelType"
                      value={form.fuelType}
                      onChange={handleChange}
                    >
                      {FUEL_TYPES.map(
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
                      Storage Type
                    </label>

                    <select
                      className="form-select"
                      name="storageType"
                      value={form.storageType}
                      onChange={handleChange}
                    >
                      <option value="">
                        Select storage type
                      </option>

                      {STORAGE_TYPES.map(
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
                      Location
                    </label>

                    <input
                      className="form-input"
                      name="location"
                      value={form.location}
                      onChange={handleChange}
                      placeholder="Fuel station / facility"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Tank Number
                    </label>

                    <input
                      className="form-input"
                      name="tankNumber"
                      value={form.tankNumber}
                      onChange={handleChange}
                      placeholder="Tank identification"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Tank Capacity
                    </label>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="form-input"
                      name="tankCapacity"
                      value={form.tankCapacity}
                      onChange={handleChange}
                      placeholder="Tank capacity"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Unit
                    </label>

                    <select
                      className="form-select"
                      name="unit"
                      value={form.unit}
                      onChange={handleChange}
                    >
                      <option value="Liter">
                        Liter
                      </option>
                      <option value="m³">
                        m³
                      </option>
                      <option value="Gallon">
                        Gallon
                      </option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Current Stock
                    </label>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="form-input"
                      name="currentStock"
                      value={form.currentStock}
                      onChange={handleChange}
                      placeholder="Current fuel quantity"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Minimum Stock
                    </label>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="form-input"
                      name="minimumStock"
                      value={form.minimumStock}
                      onChange={handleChange}
                      placeholder="Reorder threshold"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Maximum Stock
                    </label>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="form-input"
                      name="maximumStock"
                      value={form.maximumStock}
                      onChange={handleChange}
                      placeholder="Maximum storage level"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Supplier
                    </label>

                    <input
                      className="form-input"
                      name="supplier"
                      value={form.supplier}
                      onChange={handleChange}
                      placeholder="Fuel supplier"
                    />
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
                      Last Delivery Date
                    </label>

                    <input
                      type="date"
                      className="form-input"
                      name="lastDeliveryDate"
                      value={
                        form.lastDeliveryDate
                      }
                      onChange={handleChange}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Next Delivery Date
                    </label>

                    <input
                      type="date"
                      className="form-input"
                      name="nextDeliveryDate"
                      value={
                        form.nextDeliveryDate
                      }
                      onChange={handleChange}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Last Reading
                    </label>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="form-input"
                      name="lastReading"
                      value={form.lastReading}
                      onChange={handleChange}
                      placeholder="Last meter/stock reading"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Unit Price
                    </label>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="form-input"
                      name="unitPrice"
                      value={form.unitPrice}
                      onChange={handleChange}
                      placeholder="Price per unit"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Total Value
                    </label>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="form-input"
                      name="totalValue"
                      value={form.totalValue}
                      onChange={handleChange}
                      placeholder="Total stock value"
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

                  <div className="form-group full">
                    <label className="form-label">
                      Description
                    </label>

                    <textarea
                      className="form-textarea"
                      name="description"
                      value={form.description}
                      onChange={handleChange}
                      placeholder="Fuel system description..."
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
                  Fuel Management Details
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
                    FUEL TYPE
                  </div>

                  <div className="detail-value">
                    {selectedRecord.fuelType}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    STORAGE TYPE
                  </div>

                  <div className="detail-value">
                    {selectedRecord.storageType}
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
                    TANK NUMBER
                  </div>

                  <div className="detail-value">
                    {selectedRecord.tankNumber}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    TANK CAPACITY
                  </div>

                  <div className="detail-value">
                    {formatNumber(
                      selectedRecord.tankCapacity
                    )}{" "}
                    {selectedRecord.unit}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    CURRENT STOCK
                  </div>

                  <div className="detail-value">
                    {formatNumber(
                      selectedRecord.currentStock
                    )}{" "}
                    {selectedRecord.unit}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    MINIMUM STOCK
                  </div>

                  <div className="detail-value">
                    {formatNumber(
                      selectedRecord.minimumStock
                    )}{" "}
                    {selectedRecord.unit}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    MAXIMUM STOCK
                  </div>

                  <div className="detail-value">
                    {formatNumber(
                      selectedRecord.maximumStock
                    )}{" "}
                    {selectedRecord.unit}
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
                    LAST DELIVERY
                  </div>

                  <div className="detail-value">
                    {formatDate(
                      selectedRecord.lastDeliveryDate
                    )}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    NEXT DELIVERY
                  </div>

                  <div className="detail-value">
                    {formatDate(
                      selectedRecord.nextDeliveryDate
                    )}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    LAST READING
                  </div>

                  <div className="detail-value">
                    {formatNumber(
                      selectedRecord.lastReading
                    )}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    UNIT PRICE
                  </div>

                  <div className="detail-value">
                    {formatMoney(
                      selectedRecord.unitPrice
                    )}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    TOTAL VALUE
                  </div>

                  <div className="detail-value">
                    {formatMoney(
                      selectedRecord.totalValue
                    )}
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
                  Delete Fuel Record
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
                  the fuel management system.
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