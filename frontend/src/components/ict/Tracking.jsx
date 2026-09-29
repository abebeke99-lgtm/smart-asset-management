import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  Eye,
  Filter,
  History,
  MapPin,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Truck,
  User,
  Wifi,
  X,
} from "lucide-react";

const API_BASE_URL =
  process.env.REACT_APP_API_URL || "/api";

const PAGE_SIZE = 10;

const TRACKING_STATUSES = [
  "In Transit",
  "At Location",
  "Assigned",
  "Delivered",
  "Pending",
  "Delayed",
  "Lost",
  "Returned",
];

const MOVEMENT_TYPES = [
  "Transfer",
  "Assignment",
  "Delivery",
  "Return",
  "Relocation",
  "Verification",
  "Maintenance",
  "Other",
];

const initialForm = {
  assetTag: "",
  assetName: "",
  movementType: "Transfer",
  trackingNumber: "",
  status: "In Transit",
  fromLocation: "",
  toLocation: "",
  currentLocation: "",
  fromDepartment: "",
  toDepartment: "",
  requestedBy: "",
  assignedTo: "",
  handledBy: "",
  transportMethod: "Internal Transport",
  dispatchDate: "",
  expectedDate: "",
  actualDate: "",
  latitude: "",
  longitude: "",
  condition: "Good",
  priority: "Medium",
  notes: "",
};

async function apiRequest(url, options = {}) {
  const response = await fetch(`${API_BASE_URL}${url}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;

    try {
      const error = await response.json();
      message =
        error?.message ||
        error?.error ||
        message;
    } catch {
      // Ignore invalid response body.
    }

    throw new Error(message);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

function extractArray(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.tracking)) return data.tracking;
  if (Array.isArray(data?.trackings)) return data.trackings;
  if (Array.isArray(data?.results)) return data.results;

  return [];
}

function normalizeTracking(item, index) {
  return {
    id:
      item.id ??
      item._id ??
      item.trackingId ??
      item.tracking_id ??
      `TRACK-${String(index + 1).padStart(5, "0")}`,

    assetTag:
      item.assetTag ??
      item.asset_tag ??
      item.asset?.assetTag ??
      item.asset?.asset_tag ??
      "",

    assetName:
      item.assetName ??
      item.asset_name ??
      item.asset?.name ??
      item.name ??
      "",

    movementType:
      item.movementType ??
      item.movement_type ??
      item.type ??
      "Transfer",

    trackingNumber:
      item.trackingNumber ??
      item.tracking_number ??
      item.referenceNumber ??
      item.reference_number ??
      "",

    status:
      item.status ??
      item.trackingStatus ??
      item.tracking_status ??
      "Pending",

    fromLocation:
      item.fromLocation ??
      item.from_location ??
      item.origin ??
      "",

    toLocation:
      item.toLocation ??
      item.to_location ??
      item.destination ??
      "",

    currentLocation:
      item.currentLocation ??
      item.current_location ??
      item.location ??
      "",

    fromDepartment:
      item.fromDepartment ??
      item.from_department ??
      "",

    toDepartment:
      item.toDepartment ??
      item.to_department ??
      "",

    requestedBy:
      item.requestedBy ??
      item.requested_by ??
      "",

    assignedTo:
      item.assignedTo ??
      item.assigned_to ??
      "",

    handledBy:
      item.handledBy ??
      item.handled_by ??
      "",

    transportMethod:
      item.transportMethod ??
      item.transport_method ??
      "",

    dispatchDate:
      item.dispatchDate ??
      item.dispatch_date ??
      "",

    expectedDate:
      item.expectedDate ??
      item.expected_date ??
      "",

    actualDate:
      item.actualDate ??
      item.actual_date ??
      item.deliveredDate ??
      item.delivered_date ??
      "",

    latitude:
      item.latitude ??
      item.lat ??
      item.location?.latitude ??
      "",

    longitude:
      item.longitude ??
      item.lng ??
      item.location?.longitude ??
      "",

    condition:
      item.condition ??
      item.assetCondition ??
      item.asset_condition ??
      "Good",

    priority:
      item.priority ??
      "Medium",

    notes:
      item.notes ??
      item.description ??
      "",

    createdAt:
      item.createdAt ??
      item.created_at ??
      "",

    updatedAt:
      item.updatedAt ??
      item.updated_at ??
      "",

    raw: item,
  };
}

function formatDate(value) {
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
}

function formatDateTime(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStatusClasses(status) {
  switch (String(status).toLowerCase()) {
    case "in transit":
      return "border-blue-200 bg-blue-50 text-blue-700";

    case "at location":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";

    case "assigned":
      return "border-indigo-200 bg-indigo-50 text-indigo-700";

    case "delivered":
      return "border-green-200 bg-green-50 text-green-700";

    case "pending":
      return "border-slate-200 bg-slate-100 text-slate-600";

    case "delayed":
      return "border-amber-200 bg-amber-50 text-amber-700";

    case "lost":
      return "border-red-200 bg-red-50 text-red-700";

    case "returned":
      return "border-purple-200 bg-purple-50 text-purple-700";

    default:
      return "border-slate-200 bg-slate-100 text-slate-600";
  }
}

function getPriorityClasses(priority) {
  switch (String(priority).toLowerCase()) {
    case "critical":
      return "text-red-600";

    case "high":
      return "text-orange-600";

    case "medium":
      return "text-amber-600";

    case "low":
      return "text-slate-500";

    default:
      return "text-slate-500";
  }
}

function getMovementIcon(type) {
  switch (String(type).toLowerCase()) {
    case "transfer":
      return Truck;

    case "assignment":
      return User;

    case "delivery":
      return Package;

    case "return":
      return ArrowDown;

    case "relocation":
      return MapPin;

    case "verification":
      return CheckCircle2;

    case "maintenance":
      return Activity;

    default:
      return History;
  }
}

function SummaryCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconClass,
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">
            {title}
          </p>

          <p className="mt-2 text-2xl font-bold text-slate-900">
            {value}
          </p>

          {subtitle && (
            <p className="mt-1 text-xs text-slate-400">
              {subtitle}
            </p>
          )}
        </div>

        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconClass}`}
        >
          <Icon size={21} />
        </div>
      </div>
    </div>
  );
}

function Modal({
  title,
  icon: Icon,
  children,
  onClose,
  large = false,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <div
        className={`relative flex max-h-[92vh] w-full ${
          large ? "max-w-5xl" : "max-w-2xl"
        } flex-col overflow-hidden rounded-2xl bg-white shadow-2xl`}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <Icon size={18} />
            </div>

            <h2 className="text-lg font-semibold text-slate-900">
              {title}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={19} />
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}

function InputField({
  label,
  name,
  value,
  onChange,
  type = "text",
  placeholder,
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </label>

      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
    </div>
  );
}

function SelectField({
  label,
  name,
  value,
  onChange,
  options,
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </label>

      <select
        name={name}
        value={value}
        onChange={onChange}
        className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

function TextAreaField({
  label,
  name,
  value,
  onChange,
  placeholder,
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </label>

      <textarea
        name={name}
        value={value}
        onChange={onChange}
        rows={3}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
    </div>
  );
}

export default function Tracking() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [movementFilter, setMovementFilter] =
    useState("All");

  const [page, setPage] = useState(1);

  const [showForm, setShowForm] = useState(false);
  const [showDetails, setShowDetails] =
    useState(false);

  const [editingRecord, setEditingRecord] =
    useState(null);
  const [selectedRecord, setSelectedRecord] =
    useState(null);

  const [form, setForm] = useState(initialForm);

  const loadTracking = async () => {
    setLoading(true);
    setError("");

    try {
      let data;

      try {
        data = await apiRequest("/tracking");
      } catch {
        try {
          data = await apiRequest("/asset-tracking");
        } catch {
          try {
            data = await apiRequest("/assetTracking");
          } catch {
            data = await apiRequest("/trackings");
          }
        }
      }

      setRecords(
        extractArray(data).map(normalizeTracking)
      );
    } catch (err) {
      setError(
        err.message ||
          "Unable to load tracking records."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTracking();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [
    search,
    statusFilter,
    movementFilter,
  ]);

  const statistics = useMemo(() => {
    const total = records.length;

    const inTransit = records.filter(
      (item) =>
        item.status.toLowerCase() ===
        "in transit"
    ).length;

    const delivered = records.filter(
      (item) =>
        item.status.toLowerCase() ===
        "delivered"
    ).length;

    const delayed = records.filter(
      (item) =>
        item.status.toLowerCase() ===
        "delayed"
    ).length;

    const active = records.filter((item) =>
      [
        "in transit",
        "assigned",
        "pending",
      ].includes(
        item.status.toLowerCase()
      )
    ).length;

    const lost = records.filter(
      (item) =>
        item.status.toLowerCase() === "lost"
    ).length;

    return {
      total,
      inTransit,
      delivered,
      delayed,
      active,
      lost,
    };
  }, [records]);

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();

    return records.filter((record) => {
      const searchable = [
        record.assetTag,
        record.assetName,
        record.movementType,
        record.trackingNumber,
        record.status,
        record.fromLocation,
        record.toLocation,
        record.currentLocation,
        record.fromDepartment,
        record.toDepartment,
        record.requestedBy,
        record.assignedTo,
        record.handledBy,
        record.transportMethod,
        record.condition,
        record.priority,
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !query || searchable.includes(query);

      const matchesStatus =
        statusFilter === "All" ||
        record.status.toLowerCase() ===
          statusFilter.toLowerCase();

      const matchesMovement =
        movementFilter === "All" ||
        record.movementType.toLowerCase() ===
          movementFilter.toLowerCase();

      return (
        matchesSearch &&
        matchesStatus &&
        matchesMovement
      );
    });
  }, [
    records,
    search,
    statusFilter,
    movementFilter,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(
      filteredRecords.length / PAGE_SIZE
    )
  );

  const paginatedRecords = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;

    return filteredRecords.slice(
      start,
      start + PAGE_SIZE
    );
  }, [filteredRecords, page]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const openCreate = () => {
    setEditingRecord(null);

    setForm({
      ...initialForm,
      dispatchDate: new Date()
        .toISOString()
        .slice(0, 10),
    });

    setShowForm(true);
  };

  const openEdit = (record) => {
    setEditingRecord(record);

    const dateOnly = (value) =>
      value?.slice?.(0, 10) || "";

    setForm({
      assetTag: record.assetTag || "",
      assetName: record.assetName || "",
      movementType:
        record.movementType || "Transfer",
      trackingNumber:
        record.trackingNumber || "",
      status: record.status || "Pending",
      fromLocation:
        record.fromLocation || "",
      toLocation: record.toLocation || "",
      currentLocation:
        record.currentLocation || "",
      fromDepartment:
        record.fromDepartment || "",
      toDepartment:
        record.toDepartment || "",
      requestedBy:
        record.requestedBy || "",
      assignedTo:
        record.assignedTo || "",
      handledBy:
        record.handledBy || "",
      transportMethod:
        record.transportMethod ||
        "Internal Transport",
      dispatchDate: dateOnly(
        record.dispatchDate
      ),
      expectedDate: dateOnly(
        record.expectedDate
      ),
      actualDate: dateOnly(
        record.actualDate
      ),
      latitude: record.latitude ?? "",
      longitude: record.longitude ?? "",
      condition:
        record.condition || "Good",
      priority:
        record.priority || "Medium",
      notes: record.notes || "",
    });

    setShowForm(true);
  };

  const openDetails = (record) => {
    setSelectedRecord(record);
    setShowDetails(true);
  };

  const closeModals = () => {
    if (saving) return;

    setShowForm(false);
    setShowDetails(false);
    setEditingRecord(null);
    setSelectedRecord(null);
  };

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const saveTracking = async (event) => {
    event.preventDefault();

    if (!form.assetTag.trim()) {
      setError("Asset tag is required.");
      return;
    }

    if (!form.assetName.trim()) {
      setError("Asset name is required.");
      return;
    }

    setSaving(true);
    setError("");

    const payload = {
      assetTag: form.assetTag,
      assetName: form.assetName,
      movementType: form.movementType,
      trackingNumber: form.trackingNumber,
      status: form.status,
      fromLocation: form.fromLocation,
      toLocation: form.toLocation,
      currentLocation: form.currentLocation,
      fromDepartment: form.fromDepartment,
      toDepartment: form.toDepartment,
      requestedBy: form.requestedBy,
      assignedTo: form.assignedTo,
      handledBy: form.handledBy,
      transportMethod: form.transportMethod,
      dispatchDate: form.dispatchDate,
      expectedDate: form.expectedDate,
      actualDate: form.actualDate,
      latitude:
        form.latitude === ""
          ? null
          : Number(form.latitude),
      longitude:
        form.longitude === ""
          ? null
          : Number(form.longitude),
      condition: form.condition,
      priority: form.priority,
      notes: form.notes,
    };

    try {
      if (editingRecord) {
        let response;

        try {
          response = await apiRequest(
            `/tracking/${editingRecord.id}`,
            {
              method: "PUT",
              body: JSON.stringify(payload),
            }
          );
        } catch {
          try {
            response = await apiRequest(
              `/asset-tracking/${editingRecord.id}`,
              {
                method: "PUT",
                body: JSON.stringify(payload),
              }
            );
          } catch {
            response = await apiRequest(
              `/trackings/${editingRecord.id}`,
              {
                method: "PUT",
                body: JSON.stringify(payload),
              }
            );
          }
        }

        const updated = normalizeTracking(
          response?.data ||
            response ||
            payload,
          0
        );

        setRecords((current) =>
          current.map((item) =>
            item.id === editingRecord.id
              ? {
                  ...item,
                  ...updated,
                  id: editingRecord.id,
                }
              : item
          )
        );
      } else {
        let response;

        try {
          response = await apiRequest(
            "/tracking",
            {
              method: "POST",
              body: JSON.stringify(payload),
            }
          );
        } catch {
          try {
            response = await apiRequest(
              "/asset-tracking",
              {
                method: "POST",
                body: JSON.stringify(payload),
              }
            );
          } catch {
            response = await apiRequest(
              "/trackings",
              {
                method: "POST",
                body: JSON.stringify(payload),
              }
            );
          }
        }

        const created = normalizeTracking(
          response?.data ||
            response ||
            payload,
          records.length
        );

        setRecords((current) => [
          created,
          ...current,
        ]);
      }

      setShowForm(false);
      setEditingRecord(null);
      setForm(initialForm);
    } catch (err) {
      setError(
        err.message ||
          "Unable to save tracking record."
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteTracking = async (record) => {
    const confirmed = window.confirm(
      `Delete tracking record for ${record.assetTag}?`
    );

    if (!confirmed) return;

    setError("");

    try {
      try {
        await apiRequest(
          `/tracking/${record.id}`,
          {
            method: "DELETE",
          }
        );
      } catch {
        try {
          await apiRequest(
            `/asset-tracking/${record.id}`,
            {
              method: "DELETE",
            }
          );
        } catch {
          await apiRequest(
            `/trackings/${record.id}`,
            {
              method: "DELETE",
            }
          );
        }
      }

      setRecords((current) =>
        current.filter(
          (item) => item.id !== record.id
        )
      );

      if (
        selectedRecord?.id === record.id
      ) {
        setSelectedRecord(null);
        setShowDetails(false);
      }
    } catch (err) {
      setError(
        err.message ||
          "Unable to delete tracking record."
      );
    }
  };

  const exportCSV = () => {
    if (!filteredRecords.length) return;

    const headers = [
      "Asset Tag",
      "Asset Name",
      "Movement Type",
      "Tracking Number",
      "Status",
      "From Location",
      "To Location",
      "Current Location",
      "From Department",
      "To Department",
      "Requested By",
      "Assigned To",
      "Handled By",
      "Transport Method",
      "Dispatch Date",
      "Expected Date",
      "Actual Date",
      "Latitude",
      "Longitude",
      "Condition",
      "Priority",
      "Notes",
    ];

    const rows = filteredRecords.map(
      (record) => [
        record.assetTag,
        record.assetName,
        record.movementType,
        record.trackingNumber,
        record.status,
        record.fromLocation,
        record.toLocation,
        record.currentLocation,
        record.fromDepartment,
        record.toDepartment,
        record.requestedBy,
        record.assignedTo,
        record.handledBy,
        record.transportMethod,
        record.dispatchDate,
        record.expectedDate,
        record.actualDate,
        record.latitude,
        record.longitude,
        record.condition,
        record.priority,
        record.notes,
      ]
    );

    const escapeCSV = (value) => {
      const text = String(value ?? "");

      if (
        text.includes(",") ||
        text.includes('"') ||
        text.includes("\n")
      ) {
        return `"${text.replace(
          /"/g,
          '""'
        )}"`;
      }

      return text;
    };

    const csv = [headers, ...rows]
      .map((row) =>
        row.map(escapeCSV).join(",")
      )
      .join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `asset-tracking-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-[1600px] space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
              <History size={16} />

              <span>ICT Operations</span>

              <span>/</span>

              <span className="text-slate-700">
                Tracking
              </span>
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
              Asset Tracking
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Track asset movement, transfers, locations,
              deliveries, and custody across the university.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={loadTracking}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw
                size={17}
                className={
                  loading
                    ? "animate-spin"
                    : ""
                }
              />
              Refresh
            </button>

            <button
              type="button"
              onClick={exportCSV}
              disabled={!filteredRecords.length}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
            >
              <Download size={17} />
              Export
            </button>

            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              <Plus size={18} />
              Add Tracking
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <div className="flex gap-3">
              <AlertCircle
                size={18}
                className="mt-0.5 shrink-0"
              />

              <div>
                <p className="font-semibold">
                  Operation failed
                </p>

                <p className="mt-0.5">{error}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setError("")}
              className="rounded-md p-1 hover:bg-red-100"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Summary */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <SummaryCard
            title="Total Records"
            value={statistics.total}
            subtitle="Tracking records"
            icon={History}
            iconClass="bg-blue-50 text-blue-600"
          />

          <SummaryCard
            title="In Transit"
            value={statistics.inTransit}
            subtitle="Currently moving"
            icon={Truck}
            iconClass="bg-indigo-50 text-indigo-600"
          />

          <SummaryCard
            title="Active"
            value={statistics.active}
            subtitle="Pending or assigned"
            icon={Activity}
            iconClass="bg-cyan-50 text-cyan-600"
          />

          <SummaryCard
            title="Delivered"
            value={statistics.delivered}
            subtitle="Successfully delivered"
            icon={CheckCircle2}
            iconClass="bg-emerald-50 text-emerald-600"
          />

          <SummaryCard
            title="Delayed"
            value={statistics.delayed}
            subtitle="Requires follow-up"
            icon={Clock3}
            iconClass="bg-amber-50 text-amber-600"
          />

          <SummaryCard
            title="Lost"
            value={statistics.lost}
            subtitle="Requires investigation"
            icon={AlertCircle}
            iconClass="bg-red-50 text-red-600"
          />
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {/* Filters */}
          <div className="border-b border-slate-200 p-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="relative w-full xl:max-w-lg">
                <Search
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  type="text"
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="Search asset, tracking number, location..."
                  className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm outline-none placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <Filter size={16} />
                  Filters
                </div>

                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(
                      event.target.value
                    )
                  }
                  className="h-10 min-w-[145px] rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="All">
                    All Statuses
                  </option>

                  {TRACKING_STATUSES.map(
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

                <select
                  value={movementFilter}
                  onChange={(event) =>
                    setMovementFilter(
                      event.target.value
                    )
                  }
                  className="h-10 min-w-[145px] rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="All">
                    All Movements
                  </option>

                  {MOVEMENT_TYPES.map(
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
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1500px] text-left">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200">
                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Asset
                  </th>

                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Movement
                  </th>

                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Route
                  </th>

                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Current Location
                  </th>

                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Responsible
                  </th>

                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Schedule
                  </th>

                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Priority
                  </th>

                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Status
                  </th>

                  <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  Array.from({ length: 7 }).map(
                    (_, rowIndex) => (
                      <tr key={rowIndex}>
                        {Array.from({
                          length: 9,
                        }).map(
                          (_, cellIndex) => (
                            <td
                              key={cellIndex}
                              className="px-5 py-5"
                            >
                              <div className="h-4 animate-pulse rounded bg-slate-100" />
                            </td>
                          )
                        )}
                      </tr>
                    )
                  )
                ) : paginatedRecords.length ===
                  0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-6 py-16 text-center"
                    >
                      <div className="mx-auto flex max-w-sm flex-col items-center">
                        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                          <History size={27} />
                        </div>

                        <h3 className="text-base font-semibold text-slate-900">
                          No tracking records
                        </h3>

                        <p className="mt-1 text-sm text-slate-500">
                          Change your filters or create a
                          new tracking record.
                        </p>

                        <button
                          type="button"
                          onClick={openCreate}
                          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                        >
                          <Plus size={16} />
                          Add Tracking
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedRecords.map(
                    (record) => {
                      const MovementIcon =
                        getMovementIcon(
                          record.movementType
                        );

                      return (
                        <tr
                          key={record.id}
                          className="group transition hover:bg-slate-50/80"
                        >
                          {/* Asset */}
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                                <Package
                                  size={17}
                                />
                              </div>

                              <div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    openDetails(
                                      record
                                    )
                                  }
                                  className="font-semibold text-blue-600 hover:text-blue-700"
                                >
                                  {record.assetTag ||
                                    "No asset tag"}
                                </button>

                                <div className="mt-0.5 max-w-[180px] truncate text-sm font-medium text-slate-700">
                                  {record.assetName ||
                                    "ICT Asset"}
                                </div>

                                {record.trackingNumber && (
                                  <div className="mt-0.5 text-xs text-slate-400">
                                    #
                                    {
                                      record.trackingNumber
                                    }
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Movement */}
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2.5">
                              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                                <MovementIcon
                                  size={16}
                                />
                              </div>

                              <div>
                                <div className="text-sm font-medium text-slate-700">
                                  {record.movementType}
                                </div>

                                <div className="mt-0.5 text-xs text-slate-400">
                                  {record.transportMethod ||
                                    "—"}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Route */}
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2">
                              <div className="flex flex-col items-center">
                                <ArrowUp
                                  size={13}
                                  className="text-slate-400"
                                />

                                <div className="my-0.5 h-3 border-l border-dashed border-slate-300" />

                                <ArrowDown
                                  size={13}
                                  className="text-slate-400"
                                />
                              </div>

                              <div className="max-w-[220px]">
                                <div className="truncate text-sm font-medium text-slate-700">
                                  {record.fromLocation ||
                                    "Origin not specified"}
                                </div>

                                <div className="truncate text-sm text-slate-500">
                                  {record.toLocation ||
                                    "Destination not specified"}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Current location */}
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2">
                              <MapPin
                                size={16}
                                className="shrink-0 text-blue-500"
                              />

                              <div>
                                <div className="max-w-[180px] truncate text-sm font-medium text-slate-700">
                                  {record.currentLocation ||
                                    "Unknown"}
                                </div>

                                {record.latitude !==
                                  "" &&
                                  record.longitude !==
                                    "" && (
                                    <div className="mt-0.5 text-xs text-slate-400">
                                      {record.latitude},{" "}
                                      {
                                        record.longitude
                                      }
                                    </div>
                                  )}
                              </div>
                            </div>
                          </td>

                          {/* Responsible */}
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2">
                              <User
                                size={16}
                                className="text-slate-400"
                              />

                              <div>
                                <div className="text-sm font-medium text-slate-700">
                                  {record.assignedTo ||
                                    record.handledBy ||
                                    "Unassigned"}
                                </div>

                                <div className="mt-0.5 text-xs text-slate-400">
                                  {record.toDepartment ||
                                    record.fromDepartment ||
                                    "—"}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Schedule */}
                          <td className="px-5 py-4">
                            <div className="text-sm font-medium text-slate-700">
                              {record.expectedDate
                                ? formatDate(
                                    record.expectedDate
                                  )
                                : "No target date"}
                            </div>

                            <div className="mt-0.5 text-xs text-slate-400">
                              Dispatch:{" "}
                              {formatDate(
                                record.dispatchDate
                              )}
                            </div>
                          </td>

                          {/* Priority */}
                          <td className="px-5 py-4">
                            <span
                              className={`text-sm font-semibold ${getPriorityClasses(
                                record.priority
                              )}`}
                            >
                              {record.priority}
                            </span>

                            <div className="mt-0.5 text-xs text-slate-400">
                              {record.condition}
                            </div>
                          </td>

                          {/* Status */}
                          <td className="px-5 py-4">
                            <span
                              className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusClasses(
                                record.status
                              )}`}
                            >
                              {record.status}
                            </span>

                            {record.actualDate && (
                              <div className="mt-1 text-xs text-slate-400">
                                {formatDate(
                                  record.actualDate
                                )}
                              </div>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="px-5 py-4">
                            <div className="flex justify-end gap-1">
                              <button
                                type="button"
                                title="View tracking"
                                onClick={() =>
                                  openDetails(
                                    record
                                  )
                                }
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                              >
                                <Eye size={16} />
                              </button>

                              <button
                                type="button"
                                title="Edit tracking"
                                onClick={() =>
                                  openEdit(record)
                                }
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                              >
                                <Pencil
                                  size={16}
                                />
                              </button>

                              <button
                                type="button"
                                title="Delete tracking"
                                onClick={() =>
                                  deleteTracking(
                                    record
                                  )
                                }
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-red-500 hover:bg-red-50 hover:text-red-700"
                              >
                                <X size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    }
                  )
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!loading &&
            filteredRecords.length > 0 && (
              <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-500">
                  Showing{" "}
                  <span className="font-medium text-slate-700">
                    {(page - 1) * PAGE_SIZE + 1}
                  </span>{" "}
                  to{" "}
                  <span className="font-medium text-slate-700">
                    {Math.min(
                      page * PAGE_SIZE,
                      filteredRecords.length
                    )}
                  </span>{" "}
                  of{" "}
                  <span className="font-medium text-slate-700">
                    {filteredRecords.length}
                  </span>{" "}
                  records
                </p>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={page === 1}
                    onClick={() =>
                      setPage(
                        (current) => current - 1
                      )
                    }
                    className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                  >
                    <ChevronLeft size={16} />
                    Previous
                  </button>

                  <div className="flex h-9 min-w-9 items-center justify-center rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white">
                    {page}
                  </div>

                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() =>
                      setPage(
                        (current) => current + 1
                      )
                    }
                    className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                  >
                    Next
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
        </div>
      </div>

      {/* Create / Edit Modal */}
      {showForm && (
        <Modal
          title={
            editingRecord
              ? "Edit Tracking Record"
              : "Add Tracking Record"
          }
          icon={editingRecord ? Pencil : History}
          onClose={closeModals}
          large
        >
          <form onSubmit={saveTracking}>
            <div className="max-h-[72vh] overflow-y-auto px-6 py-5">
              <div className="space-y-7">
                {/* Asset */}
                <section>
                  <div className="mb-4 flex items-center gap-2">
                    <Package
                      size={18}
                      className="text-blue-600"
                    />

                    <h3 className="text-sm font-semibold text-slate-900">
                      Asset & Tracking Information
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
                    <InputField
                      label="Asset Tag"
                      name="assetTag"
                      value={form.assetTag}
                      onChange={handleChange}
                      placeholder="ICT-00001"
                    />

                    <InputField
                      label="Asset Name"
                      name="assetName"
                      value={form.assetName}
                      onChange={handleChange}
                      placeholder="Laptop Computer"
                    />

                    <SelectField
                      label="Movement Type"
                      name="movementType"
                      value={form.movementType}
                      onChange={handleChange}
                      options={MOVEMENT_TYPES}
                    />

                    <InputField
                      label="Tracking Number"
                      name="trackingNumber"
                      value={
                        form.trackingNumber
                      }
                      onChange={handleChange}
                      placeholder="TRK-2026-0001"
                    />
                  </div>
                </section>

                {/* Status */}
                <section>
                  <div className="mb-4 flex items-center gap-2">
                    <Activity
                      size={18}
                      className="text-blue-600"
                    />

                    <h3 className="text-sm font-semibold text-slate-900">
                      Tracking Status
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                    <SelectField
                      label="Status"
                      name="status"
                      value={form.status}
                      onChange={handleChange}
                      options={TRACKING_STATUSES}
                    />

                    <SelectField
                      label="Priority"
                      name="priority"
                      value={form.priority}
                      onChange={handleChange}
                      options={[
                        "Low",
                        "Medium",
                        "High",
                        "Critical",
                      ]}
                    />

                    <SelectField
                      label="Condition"
                      name="condition"
                      value={form.condition}
                      onChange={handleChange}
                      options={[
                        "Excellent",
                        "Good",
                        "Fair",
                        "Damaged",
                        "Needs Inspection",
                      ]}
                    />
                  </div>
                </section>

                {/* Route */}
                <section>
                  <div className="mb-4 flex items-center gap-2">
                    <MapPin
                      size={18}
                      className="text-blue-600"
                    />

                    <h3 className="text-sm font-semibold text-slate-900">
                      Movement Route
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                    <InputField
                      label="From Location"
                      name="fromLocation"
                      value={
                        form.fromLocation
                      }
                      onChange={handleChange}
                      placeholder="Main Store"
                    />

                    <InputField
                      label="To Location"
                      name="toLocation"
                      value={form.toLocation}
                      onChange={handleChange}
                      placeholder="College / Office"
                    />

                    <InputField
                      label="Current Location"
                      name="currentLocation"
                      value={
                        form.currentLocation
                      }
                      onChange={handleChange}
                      placeholder="Current location"
                    />

                    <InputField
                      label="From Department"
                      name="fromDepartment"
                      value={
                        form.fromDepartment
                      }
                      onChange={handleChange}
                      placeholder="ICT Directorate"
                    />

                    <InputField
                      label="To Department"
                      name="toDepartment"
                      value={form.toDepartment}
                      onChange={handleChange}
                      placeholder="Computer Science"
                    />

                    <SelectField
                      label="Transport Method"
                      name="transportMethod"
                      value={
                        form.transportMethod
                      }
                      onChange={handleChange}
                      options={[
                        "Internal Transport",
                        "Courier",
                        "Hand Delivery",
                        "Vehicle",
                        "External Logistics",
                        "Other",
                      ]}
                    />
                  </div>
                </section>

                {/* Responsibility */}
                <section>
                  <div className="mb-4 flex items-center gap-2">
                    <User
                      size={18}
                      className="text-blue-600"
                    />

                    <h3 className="text-sm font-semibold text-slate-900">
                      Responsibility
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                    <InputField
                      label="Requested By"
                      name="requestedBy"
                      value={
                        form.requestedBy
                      }
                      onChange={handleChange}
                      placeholder="Requester name"
                    />

                    <InputField
                      label="Assigned To"
                      name="assignedTo"
                      value={form.assignedTo}
                      onChange={handleChange}
                      placeholder="Responsible person"
                    />

                    <InputField
                      label="Handled By"
                      name="handledBy"
                      value={form.handledBy}
                      onChange={handleChange}
                      placeholder="ICT / logistics officer"
                    />
                  </div>
                </section>

                {/* Dates */}
                <section>
                  <div className="mb-4 flex items-center gap-2">
                    <Clock3
                      size={18}
                      className="text-blue-600"
                    />

                    <h3 className="text-sm font-semibold text-slate-900">
                      Schedule
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                    <InputField
                      label="Dispatch Date"
                      name="dispatchDate"
                      type="date"
                      value={
                        form.dispatchDate
                      }
                      onChange={handleChange}
                    />

                    <InputField
                      label="Expected Date"
                      name="expectedDate"
                      type="date"
                      value={
                        form.expectedDate
                      }
                      onChange={handleChange}
                    />

                    <InputField
                      label="Actual Date"
                      name="actualDate"
                      type="date"
                      value={form.actualDate}
                      onChange={handleChange}
                    />
                  </div>
                </section>

                {/* GPS */}
                <section>
                  <div className="mb-4 flex items-center gap-2">
                    <Wifi
                      size={18}
                      className="text-blue-600"
                    />

                    <h3 className="text-sm font-semibold text-slate-900">
                      Location Coordinates
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <InputField
                      label="Latitude"
                      name="latitude"
                      type="number"
                      value={form.latitude}
                      onChange={handleChange}
                      placeholder="9.000000"
                    />

                    <InputField
                      label="Longitude"
                      name="longitude"
                      type="number"
                      value={form.longitude}
                      onChange={handleChange}
                      placeholder="38.000000"
                    />
                  </div>
                </section>

                <TextAreaField
                  label="Notes"
                  name="notes"
                  value={form.notes}
                  onChange={handleChange}
                  placeholder="Additional tracking information..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
              <button
                type="button"
                onClick={closeModals}
                disabled={saving}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {saving && (
                  <RefreshCw
                    size={16}
                    className="animate-spin"
                  />
                )}

                {editingRecord
                  ? "Save Changes"
                  : "Add Tracking"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Details Modal */}
      {showDetails && selectedRecord && (
        <Modal
          title="Tracking Details"
          icon={History}
          onClose={closeModals}
          large
        >
          <div className="max-h-[78vh] overflow-y-auto">
            {/* Header */}
            <div className="border-b border-slate-200 bg-slate-50 px-6 py-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                    {React.createElement(
                      getMovementIcon(
                        selectedRecord.movementType
                      ),
                      { size: 24 }
                    )}
                  </div>

                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      {selectedRecord.trackingNumber ||
                        "No tracking number"}
                    </div>

                    <h2 className="mt-1 text-xl font-bold text-slate-900">
                      {selectedRecord.assetName ||
                        "ICT Asset"}
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      {selectedRecord.assetTag ||
                        "No asset tag"}{" "}
                      •{" "}
                      {selectedRecord.movementType}
                    </p>
                  </div>
                </div>

                <span
                  className={`inline-flex w-fit rounded-full border px-3 py-1.5 text-xs font-semibold ${getStatusClasses(
                    selectedRecord.status
                  )}`}
                >
                  {selectedRecord.status}
                </span>
              </div>
            </div>

            <div className="space-y-6 px-6 py-6">
              {/* Route timeline */}
              <section>
                <h3 className="mb-3 text-sm font-semibold text-slate-900">
                  Movement Route
                </h3>

                <div className="rounded-xl border border-slate-200 p-5">
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                    <div>
                      <div className="mb-2 flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                          <ArrowUp
                            size={15}
                          />
                        </div>

                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Origin
                        </span>
                      </div>

                      <p className="text-sm font-semibold text-slate-800">
                        {selectedRecord.fromLocation ||
                          "Not specified"}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {selectedRecord.fromDepartment ||
                          "No department"}
                      </p>
                    </div>

                    <div className="relative">
                      <div className="hidden absolute left-0 right-0 top-4 border-t border-dashed border-slate-300 md:block" />

                      <div className="relative flex flex-col items-center">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                          <Truck
                            size={15}
                          />
                        </div>

                        <span className="mt-2 text-xs font-semibold text-blue-600">
                          {selectedRecord.movementType}
                        </span>
                      </div>
                    </div>

                    <div>
                      <div className="mb-2 flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                          <ArrowDown
                            size={15}
                          />
                        </div>

                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Destination
                        </span>
                      </div>

                      <p className="text-sm font-semibold text-slate-800">
                        {selectedRecord.toLocation ||
                          "Not specified"}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {selectedRecord.toDepartment ||
                          "No department"}
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Current position */}
              <section>
                <h3 className="mb-3 text-sm font-semibold text-slate-900">
                  Current Position
                </h3>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                  <div className="rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center gap-2">
                      <MapPin
                        size={17}
                        className="text-blue-600"
                      />

                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Current Location
                      </span>
                    </div>

                    <p className="mt-2 text-sm font-semibold text-slate-800">
                      {selectedRecord.currentLocation ||
                        "Unknown"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-4">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Latitude
                    </span>

                    <p className="mt-2 text-sm font-semibold text-slate-800">
                      {selectedRecord.latitude ||
                        "—"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-4">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Longitude
                    </span>

                    <p className="mt-2 text-sm font-semibold text-slate-800">
                      {selectedRecord.longitude ||
                        "—"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-4">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Condition
                    </span>

                    <p className="mt-2 text-sm font-semibold text-slate-800">
                      {selectedRecord.condition ||
                        "—"}
                    </p>
                  </div>
                </div>
              </section>

              {/* Schedule */}
              <section>
                <h3 className="mb-3 text-sm font-semibold text-slate-900">
                  Movement Schedule
                </h3>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="rounded-xl border border-slate-200 p-4">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Dispatch Date
                    </span>

                    <p className="mt-2 text-sm font-semibold text-slate-800">
                      {formatDate(
                        selectedRecord.dispatchDate
                      )}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-4">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Expected Date
                    </span>

                    <p className="mt-2 text-sm font-semibold text-slate-800">
                      {formatDate(
                        selectedRecord.expectedDate
                      )}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-4">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Actual Date
                    </span>

                    <p className="mt-2 text-sm font-semibold text-slate-800">
                      {formatDate(
                        selectedRecord.actualDate
                      )}
                    </p>
                  </div>
                </div>
              </section>

              {/* Responsibility */}
              <section>
                <h3 className="mb-3 text-sm font-semibold text-slate-900">
                  Responsibility
                </h3>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                  <div className="rounded-xl border border-slate-200 p-4">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Requested By
                    </span>

                    <p className="mt-2 text-sm font-semibold text-slate-800">
                      {selectedRecord.requestedBy ||
                        "—"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-4">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Assigned To
                    </span>

                    <p className="mt-2 text-sm font-semibold text-slate-800">
                      {selectedRecord.assignedTo ||
                        "—"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-4">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Handled By
                    </span>

                    <p className="mt-2 text-sm font-semibold text-slate-800">
                      {selectedRecord.handledBy ||
                        "—"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-4">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Transport
                    </span>

                    <p className="mt-2 text-sm font-semibold text-slate-800">
                      {selectedRecord.transportMethod ||
                        "—"}
                    </p>
                  </div>
                </div>
              </section>

              {/* Tracking status */}
              <section>
                <h3 className="mb-3 text-sm font-semibold text-slate-900">
                  Tracking Status
                </h3>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="rounded-xl border border-slate-200 p-4">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Status
                    </span>

                    <div className="mt-2">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusClasses(
                          selectedRecord.status
                        )}`}
                      >
                        {selectedRecord.status}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-4">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Priority
                    </span>

                    <p
                      className={`mt-2 text-sm font-bold ${getPriorityClasses(
                        selectedRecord.priority
                      )}`}
                    >
                      {selectedRecord.priority}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-4">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Tracking Number
                    </span>

                    <p className="mt-2 text-sm font-semibold text-slate-800">
                      {selectedRecord.trackingNumber ||
                        "—"}
                    </p>
                  </div>
                </div>
              </section>

              {/* Notes */}
              {selectedRecord.notes && (
                <section>
                  <h3 className="mb-3 text-sm font-semibold text-slate-900">
                    Notes
                  </h3>

                  <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4">
                    <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                      {selectedRecord.notes}
                    </p>
                  </div>
                </section>
              )}

              <div className="text-xs text-slate-400">
                Last updated:{" "}
                {formatDateTime(
                  selectedRecord.updatedAt
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
              <button
                type="button"
                onClick={() => {
                  setShowDetails(false);
                  openEdit(selectedRecord);
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <Pencil size={16} />
                Edit Tracking
              </button>

              <button
                type="button"
                onClick={closeModals}
                className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}