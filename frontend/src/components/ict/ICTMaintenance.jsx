import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  Eye,
  Filter,
  MapPin,
  Monitor,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Trash2,
  User,
  Wrench,
  X,
} from "lucide-react";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

const PAGE_SIZE = 10;

const STATUS_OPTIONS = [
  "Scheduled",
  "Pending",
  "In Progress",
  "Completed",
  "Cancelled",
  "Overdue",
];

const MAINTENANCE_TYPES = [
  "Preventive",
  "Corrective",
  "Emergency",
  "Inspection",
  "Upgrade",
  "Calibration",
  "Cleaning",
  "Other",
];

const PRIORITY_OPTIONS = [
  "Low",
  "Medium",
  "High",
  "Critical",
];

const initialForm = {
  maintenanceNumber: "",
  assetTag: "",
  assetName: "",
  assetCategory: "",
  maintenanceType: "Preventive",
  priority: "Medium",
  status: "Scheduled",
  requestedBy: "",
  assignedTechnician: "",
  department: "",
  location: "",
  scheduledDate: "",
  startDate: "",
  completionDate: "",
  nextMaintenanceDate: "",
  estimatedCost: "",
  actualCost: "",
  downtime: "",
  issueDescription: "",
  workPerformed: "",
  partsUsed: "",
  findings: "",
  recommendations: "",
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
      // Ignore invalid error body.
    }

    throw new Error(message);
  }

  if (response.status === 204) return null;

  return response.json();
}

function extractArray(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.maintenance)) return data.maintenance;
  if (Array.isArray(data?.maintenances))
    return data.maintenances;
  if (Array.isArray(data?.results)) return data.results;

  return [];
}

function normalizeMaintenance(item, index) {
  return {
    id:
      item.id ??
      item._id ??
      item.maintenanceId ??
      item.maintenance_id ??
      `MNT-${String(index + 1).padStart(5, "0")}`,

    maintenanceNumber:
      item.maintenanceNumber ??
      item.maintenance_number ??
      item.referenceNumber ??
      item.reference_number ??
      `MNT-${String(index + 1).padStart(5, "0")}`,

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
      item.asset?.assetName ??
      "",

    assetCategory:
      item.assetCategory ??
      item.asset_category ??
      item.asset?.category ??
      "",

    maintenanceType:
      item.maintenanceType ??
      item.maintenance_type ??
      item.type ??
      "Preventive",

    priority: item.priority ?? "Medium",

    status: item.status ?? "Scheduled",

    requestedBy:
      item.requestedBy ??
      item.requested_by ??
      item.requester?.name ??
      "",

    assignedTechnician:
      item.assignedTechnician ??
      item.assigned_technician ??
      item.technicianName ??
      item.technician?.name ??
      "",

    department:
      item.department ??
      item.departmentName ??
      item.department_name ??
      "",

    location:
      item.location ??
      item.locationName ??
      "",

    scheduledDate:
      item.scheduledDate ??
      item.scheduled_date ??
      "",

    startDate:
      item.startDate ??
      item.start_date ??
      "",

    completionDate:
      item.completionDate ??
      item.completion_date ??
      item.completedAt ??
      "",

    nextMaintenanceDate:
      item.nextMaintenanceDate ??
      item.next_maintenance_date ??
      "",

    estimatedCost:
      item.estimatedCost ??
      item.estimated_cost ??
      0,

    actualCost:
      item.actualCost ??
      item.actual_cost ??
      0,

    downtime:
      item.downtime ??
      item.downtimeHours ??
      item.downtime_hours ??
      0,

    issueDescription:
      item.issueDescription ??
      item.issue_description ??
      item.description ??
      "",

    workPerformed:
      item.workPerformed ??
      item.work_performed ??
      "",

    partsUsed:
      item.partsUsed ??
      item.parts_used ??
      "",

    findings: item.findings ?? "",

    recommendations:
      item.recommendations ??
      "",

    notes: item.notes ?? "",

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

function formatCurrency(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) return "ETB 0.00";

  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "ETB",
    minimumFractionDigits: 2,
  }).format(number);
}

function getStatusClasses(status) {
  switch (String(status).toLowerCase()) {
    case "scheduled":
      return "border-blue-200 bg-blue-50 text-blue-700";

    case "pending":
      return "border-amber-200 bg-amber-50 text-amber-700";

    case "in progress":
      return "border-violet-200 bg-violet-50 text-violet-700";

    case "completed":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";

    case "cancelled":
      return "border-red-200 bg-red-50 text-red-700";

    case "overdue":
      return "border-orange-200 bg-orange-50 text-orange-700";

    default:
      return "border-slate-200 bg-slate-100 text-slate-600";
  }
}

function getPriorityClasses(priority) {
  switch (String(priority).toLowerCase()) {
    case "critical":
      return "border-red-200 bg-red-50 text-red-700";

    case "high":
      return "border-orange-200 bg-orange-50 text-orange-700";

    case "medium":
      return "border-amber-200 bg-amber-50 text-amber-700";

    case "low":
      return "border-slate-200 bg-slate-100 text-slate-600";

    default:
      return "border-slate-200 bg-slate-100 text-slate-600";
  }
}

function SummaryCard({
  title,
  value,
  icon: Icon,
  iconClass,
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">
            {title}
          </p>

          <p className="mt-2 text-2xl font-bold text-slate-900">
            {value}
          </p>
        </div>

        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl ${iconClass}`}
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
  required = false,
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}

        {required && (
          <span className="ml-1 text-red-500">
            *
          </span>
        )}
      </label>

      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
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
          <option
            key={option}
            value={option}
          >
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
  rows = 3,
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
        rows={rows}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
    </div>
  );
}

function DetailItem({
  label,
  value,
  icon: Icon,
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
        {Icon && <Icon size={13} />}
        {label}
      </div>

      <div className="mt-1 break-words text-sm font-medium text-slate-800">
        {value || "—"}
      </div>
    </div>
  );
}

export default function ICTMaintenance() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState("All");
  const [typeFilter, setTypeFilter] =
    useState("All");
  const [priorityFilter, setPriorityFilter] =
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

  const loadMaintenance = async () => {
    setLoading(true);
    setError("");

    try {
      let data;

      try {
        data = await apiRequest(
          "/ict-maintenance"
        );
      } catch {
        try {
          data = await apiRequest(
            "/ictMaintenance"
          );
        } catch {
          try {
            data = await apiRequest(
              "/maintenance"
            );
          } catch {
            data = await apiRequest(
              "/maintenance-records"
            );
          }
        }
      }

      setRecords(
        extractArray(data).map(
          normalizeMaintenance
        )
      );
    } catch (err) {
      setError(
        err.message ||
          "Unable to load ICT maintenance records."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMaintenance();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [
    search,
    statusFilter,
    typeFilter,
    priorityFilter,
  ]);

  const statistics = useMemo(() => {
    const total = records.length;

    const scheduled = records.filter(
      (item) =>
        item.status === "Scheduled"
    ).length;

    const inProgress = records.filter(
      (item) =>
        item.status === "In Progress"
    ).length;

    const completed = records.filter(
      (item) =>
        item.status === "Completed"
    ).length;

    const overdue = records.filter(
      (item) =>
        item.status === "Overdue"
    ).length;

    const totalCost = records.reduce(
      (sum, item) =>
        sum + Number(item.actualCost || 0),
      0
    );

    return {
      total,
      scheduled,
      inProgress,
      completed,
      overdue,
      totalCost,
    };
  }, [records]);

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();

    return records.filter((item) => {
      const searchable = [
        item.maintenanceNumber,
        item.assetTag,
        item.assetName,
        item.assetCategory,
        item.maintenanceType,
        item.priority,
        item.status,
        item.requestedBy,
        item.assignedTechnician,
        item.department,
        item.location,
        item.issueDescription,
        item.workPerformed,
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !query || searchable.includes(query);

      const matchesStatus =
        statusFilter === "All" ||
        item.status.toLowerCase() ===
          statusFilter.toLowerCase();

      const matchesType =
        typeFilter === "All" ||
        item.maintenanceType.toLowerCase() ===
          typeFilter.toLowerCase();

      const matchesPriority =
        priorityFilter === "All" ||
        item.priority.toLowerCase() ===
          priorityFilter.toLowerCase();

      return (
        matchesSearch &&
        matchesStatus &&
        matchesType &&
        matchesPriority
      );
    });
  }, [
    records,
    search,
    statusFilter,
    typeFilter,
    priorityFilter,
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
      maintenanceNumber: `MNT-${Date.now()
        .toString()
        .slice(-8)}`,
      scheduledDate: new Date()
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
      maintenanceNumber:
        record.maintenanceNumber || "",
      assetTag: record.assetTag || "",
      assetName: record.assetName || "",
      assetCategory:
        record.assetCategory || "",
      maintenanceType:
        record.maintenanceType ||
        "Preventive",
      priority:
        record.priority || "Medium",
      status:
        record.status || "Scheduled",
      requestedBy:
        record.requestedBy || "",
      assignedTechnician:
        record.assignedTechnician || "",
      department:
        record.department || "",
      location:
        record.location || "",
      scheduledDate: dateOnly(
        record.scheduledDate
      ),
      startDate: dateOnly(
        record.startDate
      ),
      completionDate: dateOnly(
        record.completionDate
      ),
      nextMaintenanceDate: dateOnly(
        record.nextMaintenanceDate
      ),
      estimatedCost:
        record.estimatedCost ?? "",
      actualCost:
        record.actualCost ?? "",
      downtime:
        record.downtime ?? "",
      issueDescription:
        record.issueDescription || "",
      workPerformed:
        record.workPerformed || "",
      partsUsed:
        record.partsUsed || "",
      findings:
        record.findings || "",
      recommendations:
        record.recommendations || "",
      notes:
        record.notes || "",
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

  const saveMaintenance = async (event) => {
    event.preventDefault();

    if (!form.assetTag.trim()) {
      setError("Asset tag is required.");
      return;
    }

    if (!form.assignedTechnician.trim()) {
      setError(
        "Assigned technician is required."
      );
      return;
    }

    setSaving(true);
    setError("");

    const payload = {
      maintenanceNumber:
        form.maintenanceNumber,
      assetTag: form.assetTag,
      assetName: form.assetName,
      assetCategory:
        form.assetCategory,
      maintenanceType:
        form.maintenanceType,
      priority: form.priority,
      status: form.status,
      requestedBy:
        form.requestedBy,
      assignedTechnician:
        form.assignedTechnician,
      department:
        form.department,
      location:
        form.location,
      scheduledDate:
        form.scheduledDate,
      startDate:
        form.startDate,
      completionDate:
        form.completionDate,
      nextMaintenanceDate:
        form.nextMaintenanceDate,
      estimatedCost:
        Number(form.estimatedCost) || 0,
      actualCost:
        Number(form.actualCost) || 0,
      downtime:
        Number(form.downtime) || 0,
      issueDescription:
        form.issueDescription,
      workPerformed:
        form.workPerformed,
      partsUsed:
        form.partsUsed,
      findings:
        form.findings,
      recommendations:
        form.recommendations,
      notes:
        form.notes,
    };

    try {
      if (editingRecord) {
        let response;

        try {
          response = await apiRequest(
            `/ict-maintenance/${editingRecord.id}`,
            {
              method: "PUT",
              body: JSON.stringify(payload),
            }
          );
        } catch {
          try {
            response = await apiRequest(
              `/ictMaintenance/${editingRecord.id}`,
              {
                method: "PUT",
                body: JSON.stringify(payload),
              }
            );
          } catch {
            response = await apiRequest(
              `/maintenance/${editingRecord.id}`,
              {
                method: "PUT",
                body: JSON.stringify(payload),
              }
            );
          }
        }

        const updated = normalizeMaintenance(
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
            "/ict-maintenance",
            {
              method: "POST",
              body: JSON.stringify(payload),
            }
          );
        } catch {
          try {
            response = await apiRequest(
              "/ictMaintenance",
              {
                method: "POST",
                body: JSON.stringify(payload),
              }
            );
          } catch {
            response = await apiRequest(
              "/maintenance",
              {
                method: "POST",
                body: JSON.stringify(payload),
              }
            );
          }
        }

        const created = normalizeMaintenance(
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

      setForm(initialForm);
      setEditingRecord(null);
      setShowForm(false);
    } catch (err) {
      setError(
        err.message ||
          "Unable to save maintenance record."
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteMaintenance = async (record) => {
    const confirmed = window.confirm(
      `Delete maintenance record ${record.maintenanceNumber}?`
    );

    if (!confirmed) return;

    setError("");

    try {
      try {
        await apiRequest(
          `/ict-maintenance/${record.id}`,
          {
            method: "DELETE",
          }
        );
      } catch {
        try {
          await apiRequest(
            `/ictMaintenance/${record.id}`,
            {
              method: "DELETE",
            }
          );
        } catch {
          await apiRequest(
            `/maintenance/${record.id}`,
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
          "Unable to delete maintenance record."
      );
    }
  };

  const exportCSV = () => {
    if (!filteredRecords.length) return;

    const headers = [
      "Maintenance Number",
      "Asset Tag",
      "Asset Name",
      "Asset Category",
      "Maintenance Type",
      "Priority",
      "Status",
      "Requested By",
      "Assigned Technician",
      "Department",
      "Location",
      "Scheduled Date",
      "Start Date",
      "Completion Date",
      "Next Maintenance Date",
      "Estimated Cost",
      "Actual Cost",
      "Downtime",
      "Issue Description",
      "Work Performed",
      "Parts Used",
      "Findings",
      "Recommendations",
    ];

    const rows = filteredRecords.map(
      (item) => [
        item.maintenanceNumber,
        item.assetTag,
        item.assetName,
        item.assetCategory,
        item.maintenanceType,
        item.priority,
        item.status,
        item.requestedBy,
        item.assignedTechnician,
        item.department,
        item.location,
        item.scheduledDate,
        item.startDate,
        item.completionDate,
        item.nextMaintenanceDate,
        item.estimatedCost,
        item.actualCost,
        item.downtime,
        item.issueDescription,
        item.workPerformed,
        item.partsUsed,
        item.findings,
        item.recommendations,
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
    link.download = `ict-maintenance-${new Date()
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
              <Settings size={16} />

              <span>ICT Operations</span>

              <span>/</span>

              <span className="text-slate-700">
                ICT Maintenance
              </span>
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
              ICT Maintenance
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Plan, assign, track, and document preventive
              and corrective maintenance for ICT assets.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={loadMaintenance}
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
              Schedule Maintenance
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <div className="flex gap-3">
              <AlertTriangle
                size={18}
                className="mt-0.5 shrink-0"
              />

              <div>
                <p className="font-semibold">
                  Operation failed
                </p>

                <p className="mt-0.5">
                  {error}
                </p>
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <SummaryCard
            title="Total Maintenance"
            value={statistics.total}
            icon={Wrench}
            iconClass="bg-blue-50 text-blue-600"
          />

          <SummaryCard
            title="Scheduled"
            value={statistics.scheduled}
            icon={CalendarDays}
            iconClass="bg-indigo-50 text-indigo-600"
          />

          <SummaryCard
            title="In Progress"
            value={statistics.inProgress}
            icon={Activity}
            iconClass="bg-violet-50 text-violet-600"
          />

          <SummaryCard
            title="Completed"
            value={statistics.completed}
            icon={CheckCircle2}
            iconClass="bg-emerald-50 text-emerald-600"
          />

          <SummaryCard
            title="Overdue"
            value={statistics.overdue}
            icon={AlertTriangle}
            iconClass="bg-orange-50 text-orange-600"
          />
        </div>

        {/* Cost Summary */}
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <Activity size={19} />
              </div>

              <div>
                <p className="text-sm font-medium text-slate-500">
                  Total Recorded Maintenance Cost
                </p>

                <p className="text-lg font-bold text-slate-900">
                  {formatCurrency(
                    statistics.totalCost
                  )}
                </p>
              </div>
            </div>

            <div className="text-sm text-slate-500">
              Based on{" "}
              <span className="font-semibold text-slate-700">
                {statistics.completed}
              </span>{" "}
              completed maintenance records
            </div>
          </div>
        </div>

        {/* Main Table */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {/* Filters */}
          <div className="border-b border-slate-200 p-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="relative w-full xl:max-w-md">
                <Search
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  type="text"
                  value={search}
                  onChange={(event) =>
                    setSearch(
                      event.target.value
                    )
                  }
                  placeholder="Search asset, technician, maintenance..."
                  className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm outline-none placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative">
                  <Filter
                    size={16}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <select
                    value={statusFilter}
                    onChange={(event) =>
                      setStatusFilter(
                        event.target.value
                      )
                    }
                    className="h-10 min-w-[145px] appearance-none rounded-lg border border-slate-200 bg-white pl-9 pr-8 text-sm font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="All">
                      All Statuses
                    </option>

                    {STATUS_OPTIONS.map(
                      (option) => (
                        <option
                          key={option}
                          value={option}
                        >
                          {option}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <select
                  value={typeFilter}
                  onChange={(event) =>
                    setTypeFilter(
                      event.target.value
                    )
                  }
                  className="h-10 min-w-[150px] rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="All">
                    All Types
                  </option>

                  {MAINTENANCE_TYPES.map(
                    (option) => (
                      <option
                        key={option}
                        value={option}
                      >
                        {option}
                      </option>
                    )
                  )}
                </select>

                <select
                  value={priorityFilter}
                  onChange={(event) =>
                    setPriorityFilter(
                      event.target.value
                    )
                  }
                  className="h-10 min-w-[140px] rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="All">
                    All Priorities
                  </option>

                  {PRIORITY_OPTIONS.map(
                    (option) => (
                      <option
                        key={option}
                        value={option}
                      >
                        {option}
                      </option>
                    )
                  )}
                </select>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1450px] text-left">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200">
                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Maintenance
                  </th>

                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Asset
                  </th>

                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Type
                  </th>

                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Priority
                  </th>

                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Technician
                  </th>

                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Scheduled
                  </th>

                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Cost
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
                          <Wrench size={27} />
                        </div>

                        <h3 className="text-base font-semibold text-slate-900">
                          No maintenance records found
                        </h3>

                        <p className="mt-1 text-sm text-slate-500">
                          Change your filters or
                          schedule a new maintenance task.
                        </p>

                        <button
                          type="button"
                          onClick={openCreate}
                          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                        >
                          <Plus size={16} />
                          Schedule Maintenance
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedRecords.map(
                    (record) => (
                      <tr
                        key={record.id}
                        className="group transition hover:bg-slate-50/80"
                      >
                        <td className="px-5 py-4">
                          <button
                            type="button"
                            onClick={() =>
                              openDetails(record)
                            }
                            className="font-semibold text-blue-600 hover:text-blue-700"
                          >
                            {
                              record.maintenanceNumber
                            }
                          </button>

                          <div className="mt-1 max-w-[230px] truncate text-sm font-medium text-slate-800">
                            {record.issueDescription ||
                              "Routine maintenance"}
                          </div>

                          <div className="mt-1 text-xs text-slate-400">
                            {record.department ||
                              "No department"}
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                              <Monitor size={15} />
                            </div>

                            <div>
                              <div className="text-sm font-semibold text-slate-800">
                                {record.assetTag ||
                                  "No asset tag"}
                              </div>

                              <div className="mt-0.5 max-w-[180px] truncate text-xs text-slate-400">
                                {record.assetName ||
                                  "ICT Asset"}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <div className="text-sm font-medium text-slate-700">
                            {
                              record.maintenanceType
                            }
                          </div>

                          <div className="mt-1 text-xs text-slate-400">
                            {record.assetCategory ||
                              "ICT equipment"}
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getPriorityClasses(
                              record.priority
                            )}`}
                          >
                            {record.priority}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2 text-sm text-slate-700">
                            <User
                              size={15}
                              className="text-slate-400"
                            />

                            {record.assignedTechnician ||
                              "Unassigned"}
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2 text-sm text-slate-700">
                            <CalendarDays
                              size={15}
                              className="text-slate-400"
                            />

                            {formatDate(
                              record.scheduledDate
                            )}
                          </div>

                          {record.nextMaintenanceDate && (
                            <div className="mt-1 text-xs text-slate-400">
                              Next:{" "}
                              {formatDate(
                                record.nextMaintenanceDate
                              )}
                            </div>
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <div className="text-sm font-semibold text-slate-700">
                            {formatCurrency(
                              record.actualCost
                            )}
                          </div>

                          <div className="mt-1 text-xs text-slate-400">
                            Est.{" "}
                            {formatCurrency(
                              record.estimatedCost
                            )}
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusClasses(
                              record.status
                            )}`}
                          >
                            {record.status}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              title="View maintenance"
                              onClick={() =>
                                openDetails(record)
                              }
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                            >
                              <Eye size={16} />
                            </button>

                            <button
                              type="button"
                              title="Edit maintenance"
                              onClick={() =>
                                openEdit(record)
                              }
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                            >
                              <Pencil size={16} />
                            </button>

                            <button
                              type="button"
                              title="Delete maintenance"
                              onClick={() =>
                                deleteMaintenance(
                                  record
                                )
                              }
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-red-500 hover:bg-red-50 hover:text-red-700"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
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
                    {(page - 1) *
                      PAGE_SIZE +
                      1}
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
                  maintenance records
                </p>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={page === 1}
                    onClick={() =>
                      setPage(
                        (current) =>
                          current - 1
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
                        (current) =>
                          current + 1
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
              ? "Edit Maintenance Record"
              : "Schedule ICT Maintenance"
          }
          icon={
            editingRecord
              ? Pencil
              : Wrench
          }
          onClose={closeModals}
          large
        >
          <form onSubmit={saveMaintenance}>
            <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <InputField
                  label="Maintenance Number"
                  name="maintenanceNumber"
                  value={
                    form.maintenanceNumber
                  }
                  onChange={handleChange}
                  placeholder="MNT-00001"
                />

                <InputField
                  label="Asset Tag"
                  name="assetTag"
                  value={form.assetTag}
                  onChange={handleChange}
                  placeholder="ICT-00001"
                  required
                />

                <InputField
                  label="Asset Name"
                  name="assetName"
                  value={form.assetName}
                  onChange={handleChange}
                  placeholder="Desktop Computer"
                />

                <InputField
                  label="Asset Category"
                  name="assetCategory"
                  value={
                    form.assetCategory
                  }
                  onChange={handleChange}
                  placeholder="Computer / Network / Printer"
                />

                <SelectField
                  label="Maintenance Type"
                  name="maintenanceType"
                  value={
                    form.maintenanceType
                  }
                  onChange={handleChange}
                  options={
                    MAINTENANCE_TYPES
                  }
                />

                <SelectField
                  label="Priority"
                  name="priority"
                  value={form.priority}
                  onChange={handleChange}
                  options={
                    PRIORITY_OPTIONS
                  }
                />

                <SelectField
                  label="Status"
                  name="status"
                  value={form.status}
                  onChange={handleChange}
                  options={
                    STATUS_OPTIONS
                  }
                />

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
                  label="Assigned Technician"
                  name="assignedTechnician"
                  value={
                    form.assignedTechnician
                  }
                  onChange={handleChange}
                  placeholder="Technician name"
                  required
                />

                <InputField
                  label="Department"
                  name="department"
                  value={
                    form.department
                  }
                  onChange={handleChange}
                  placeholder="Department / College"
                />

                <InputField
                  label="Location"
                  name="location"
                  value={form.location}
                  onChange={handleChange}
                  placeholder="Building / Room"
                />

                <InputField
                  label="Scheduled Date"
                  name="scheduledDate"
                  type="date"
                  value={
                    form.scheduledDate
                  }
                  onChange={handleChange}
                />

                <InputField
                  label="Start Date"
                  name="startDate"
                  type="date"
                  value={form.startDate}
                  onChange={handleChange}
                />

                <InputField
                  label="Completion Date"
                  name="completionDate"
                  type="date"
                  value={
                    form.completionDate
                  }
                  onChange={handleChange}
                />

                <InputField
                  label="Next Maintenance Date"
                  name="nextMaintenanceDate"
                  type="date"
                  value={
                    form.nextMaintenanceDate
                  }
                  onChange={handleChange}
                />

                <InputField
                  label="Estimated Cost"
                  name="estimatedCost"
                  type="number"
                  value={
                    form.estimatedCost
                  }
                  onChange={handleChange}
                  placeholder="0.00"
                />

                <InputField
                  label="Actual Cost"
                  name="actualCost"
                  type="number"
                  value={form.actualCost}
                  onChange={handleChange}
                  placeholder="0.00"
                />

                <InputField
                  label="Downtime (Hours)"
                  name="downtime"
                  type="number"
                  value={form.downtime}
                  onChange={handleChange}
                  placeholder="0"
                />

                <div className="md:col-span-2">
                  <TextAreaField
                    label="Issue / Maintenance Description"
                    name="issueDescription"
                    value={
                      form.issueDescription
                    }
                    onChange={handleChange}
                    placeholder="Describe the issue or preventive maintenance task..."
                    rows={4}
                  />
                </div>

                <div className="md:col-span-2">
                  <TextAreaField
                    label="Work Performed"
                    name="workPerformed"
                    value={
                      form.workPerformed
                    }
                    onChange={handleChange}
                    placeholder="Describe the maintenance activities performed..."
                    rows={4}
                  />
                </div>

                <div className="md:col-span-2">
                  <TextAreaField
                    label="Parts / Materials Used"
                    name="partsUsed"
                    value={form.partsUsed}
                    onChange={handleChange}
                    placeholder="List replaced parts, consumables, or materials..."
                  />
                </div>

                <div className="md:col-span-2">
                  <TextAreaField
                    label="Findings"
                    name="findings"
                    value={form.findings}
                    onChange={handleChange}
                    placeholder="Record inspection findings and technical observations..."
                  />
                </div>

                <div className="md:col-span-2">
                  <TextAreaField
                    label="Recommendations"
                    name="recommendations"
                    value={
                      form.recommendations
                    }
                    onChange={handleChange}
                    placeholder="Recommended follow-up, replacement, upgrade, or preventive actions..."
                  />
                </div>

                <div className="md:col-span-2">
                  <TextAreaField
                    label="Notes"
                    name="notes"
                    value={form.notes}
                    onChange={handleChange}
                    placeholder="Additional internal notes..."
                  />
                </div>
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
                  : "Schedule Maintenance"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Details Modal */}
      {showDetails &&
        selectedRecord && (
          <Modal
            title="Maintenance Details"
            icon={Wrench}
            onClose={closeModals}
            large
          >
            <div className="max-h-[78vh] overflow-y-auto">
              <div className="border-b border-slate-200 bg-slate-50 px-6 py-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      {
                        selectedRecord.maintenanceNumber
                      }
                    </div>

                    <h2 className="mt-1 text-xl font-bold text-slate-900">
                      {selectedRecord.assetName ||
                        selectedRecord.assetTag ||
                        "ICT Asset Maintenance"}
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      {
                        selectedRecord.maintenanceType
                      }{" "}
                      maintenance •{" "}
                      {
                        selectedRecord.assetTag
                      }
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span
                      className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-semibold ${getPriorityClasses(
                        selectedRecord.priority
                      )}`}
                    >
                      {
                        selectedRecord.priority
                      }
                    </span>

                    <span
                      className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-semibold ${getStatusClasses(
                        selectedRecord.status
                      )}`}
                    >
                      {selectedRecord.status}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-6 px-6 py-6">
                {/* Asset */}
                <section>
                  <h3 className="mb-3 text-sm font-semibold text-slate-900">
                    Asset & Location
                  </h3>

                  <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 p-4 md:grid-cols-4">
                    <DetailItem
                      label="Asset Tag"
                      value={
                        selectedRecord.assetTag
                      }
                      icon={Monitor}
                    />

                    <DetailItem
                      label="Asset Name"
                      value={
                        selectedRecord.assetName
                      }
                      icon={Monitor}
                    />

                    <DetailItem
                      label="Category"
                      value={
                        selectedRecord.assetCategory
                      }
                    />

                    <DetailItem
                      label="Location"
                      value={
                        selectedRecord.location
                      }
                      icon={MapPin}
                    />

                    <DetailItem
                      label="Department"
                      value={
                        selectedRecord.department
                      }
                    />

                    <DetailItem
                      label="Requested By"
                      value={
                        selectedRecord.requestedBy
                      }
                      icon={User}
                    />

                    <DetailItem
                      label="Assigned Technician"
                      value={
                        selectedRecord.assignedTechnician
                      }
                      icon={Wrench}
                    />

                    <DetailItem
                      label="Maintenance Type"
                      value={
                        selectedRecord.maintenanceType
                      }
                      icon={Settings}
                    />
                  </div>
                </section>

                {/* Schedule */}
                <section>
                  <h3 className="mb-3 text-sm font-semibold text-slate-900">
                    Maintenance Schedule
                  </h3>

                  <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 p-4 md:grid-cols-4">
                    <DetailItem
                      label="Scheduled"
                      value={formatDate(
                        selectedRecord.scheduledDate
                      )}
                      icon={CalendarDays}
                    />

                    <DetailItem
                      label="Started"
                      value={formatDate(
                        selectedRecord.startDate
                      )}
                      icon={Clock3}
                    />

                    <DetailItem
                      label="Completed"
                      value={formatDate(
                        selectedRecord.completionDate
                      )}
                      icon={CheckCircle2}
                    />

                    <DetailItem
                      label="Next Maintenance"
                      value={formatDate(
                        selectedRecord.nextMaintenanceDate
                      )}
                      icon={CalendarDays}
                    />
                  </div>
                </section>

                {/* Financial */}
                <section>
                  <h3 className="mb-3 text-sm font-semibold text-slate-900">
                    Cost & Downtime
                  </h3>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Estimated Cost
                      </div>

                      <div className="mt-1 text-lg font-bold text-slate-900">
                        {formatCurrency(
                          selectedRecord.estimatedCost
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-emerald-50 p-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                        Actual Cost
                      </div>

                      <div className="mt-1 text-lg font-bold text-slate-900">
                        {formatCurrency(
                          selectedRecord.actualCost
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-amber-50 p-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-amber-600">
                        Downtime
                      </div>

                      <div className="mt-1 text-lg font-bold text-slate-900">
                        {selectedRecord.downtime
                          ? `${selectedRecord.downtime} hours`
                          : "0 hours"}
                      </div>
                    </div>
                  </div>
                </section>

                {/* Issue */}
                <section>
                  <h3 className="mb-3 text-sm font-semibold text-slate-900">
                    Maintenance Description
                  </h3>

                  <div className="rounded-xl border border-slate-200 p-4">
                    <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                      {selectedRecord.issueDescription ||
                        "No maintenance description recorded."}
                    </p>
                  </div>
                </section>

                {/* Work */}
                <section>
                  <h3 className="mb-3 text-sm font-semibold text-slate-900">
                    Work Performed
                  </h3>

                  <div className="rounded-xl border border-slate-200 p-4">
                    <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                      {selectedRecord.workPerformed ||
                        "No work details recorded."}
                    </p>
                  </div>
                </section>

                {/* Parts */}
                <section>
                  <h3 className="mb-3 text-sm font-semibold text-slate-900">
                    Parts & Materials
                  </h3>

                  <div className="rounded-xl border border-slate-200 p-4">
                    <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                      {selectedRecord.partsUsed ||
                        "No parts or materials recorded."}
                    </p>
                  </div>
                </section>

                {/* Findings */}
                <section>
                  <h3 className="mb-3 text-sm font-semibold text-slate-900">
                    Findings & Recommendations
                  </h3>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 p-4">
                      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Findings
                      </div>

                      <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                        {selectedRecord.findings ||
                          "No findings recorded."}
                      </p>
                    </div>

                    <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4">
                      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-blue-600">
                        Recommendations
                      </div>

                      <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                        {selectedRecord.recommendations ||
                          "No recommendations recorded."}
                      </p>
                    </div>
                  </div>
                </section>

                {selectedRecord.notes && (
                  <section>
                    <h3 className="mb-3 text-sm font-semibold text-slate-900">
                      Notes
                    </h3>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                      {selectedRecord.notes}
                    </div>
                  </section>
                )}
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowDetails(false);
                    openEdit(
                      selectedRecord
                    );
                  }}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Pencil size={16} />
                  Edit Maintenance
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