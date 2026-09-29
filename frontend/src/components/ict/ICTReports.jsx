import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  Filter,
  History,
  MapPin,
  Monitor,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  User,
  Wrench,
  X,
  CheckCircle2,
  Clock3,
  CircleDollarSign,
} from "lucide-react";

const API_BASE_URL =
  process.env.REACT_APP_API_URL || "/api";

const PAGE_SIZE = 10;

const STATUS_OPTIONS = [
  "Reported",
  "Diagnosed",
  "In Repair",
  "Waiting for Parts",
  "Completed",
  "Returned",
  "Cancelled",
];

const PRIORITY_OPTIONS = [
  "Low",
  "Medium",
  "High",
  "Critical",
];

const REPAIR_TYPES = [
  "Hardware Repair",
  "Software Repair",
  "Network Repair",
  "Printer Repair",
  "Peripheral Repair",
  "Electrical Repair",
  "Other",
];

const initialForm = {
  repairNumber: "",
  assetTag: "",
  assetName: "",
  assetCategory: "",
  serialNumber: "",
  repairType: "Hardware Repair",
  priority: "Medium",
  status: "Reported",
  reportedBy: "",
  assignedTechnician: "",
  department: "",
  location: "",
  vendor: "",
  dateReported: "",
  diagnosisDate: "",
  repairStartDate: "",
  completionDate: "",
  returnDate: "",
  estimatedCost: "",
  actualCost: "",
  downtimeHours: "",
  warrantyStatus: "Unknown",
  issueDescription: "",
  diagnosis: "",
  repairAction: "",
  partsReplaced: "",
  rootCause: "",
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
      message = error?.message || error?.error || message;
    } catch {
      // Ignore invalid response bodies.
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
  if (Array.isArray(data?.repairs)) return data.repairs;
  if (Array.isArray(data?.repairHistory))
    return data.repairHistory;
  if (Array.isArray(data?.repair_history))
    return data.repair_history;
  if (Array.isArray(data?.results)) return data.results;

  return [];
}

function normalizeRepair(item, index) {
  return {
    id:
      item.id ??
      item._id ??
      item.repairId ??
      item.repair_id ??
      `REP-${String(index + 1).padStart(5, "0")}`,

    repairNumber:
      item.repairNumber ??
      item.repair_number ??
      item.referenceNumber ??
      item.reference_number ??
      `REP-${String(index + 1).padStart(5, "0")}`,

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
      "",

    assetCategory:
      item.assetCategory ??
      item.asset_category ??
      item.asset?.category ??
      "",

    serialNumber:
      item.serialNumber ??
      item.serial_number ??
      item.asset?.serialNumber ??
      "",

    repairType:
      item.repairType ??
      item.repair_type ??
      item.type ??
      "Hardware Repair",

    priority: item.priority ?? "Medium",

    status: item.status ?? "Reported",

    reportedBy:
      item.reportedBy ??
      item.reported_by ??
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

    vendor:
      item.vendor ??
      item.vendorName ??
      item.vendor_name ??
      "",

    dateReported:
      item.dateReported ??
      item.date_reported ??
      item.reportedDate ??
      item.reported_date ??
      "",

    diagnosisDate:
      item.diagnosisDate ??
      item.diagnosis_date ??
      "",

    repairStartDate:
      item.repairStartDate ??
      item.repair_start_date ??
      item.startDate ??
      item.start_date ??
      "",

    completionDate:
      item.completionDate ??
      item.completion_date ??
      "",

    returnDate:
      item.returnDate ??
      item.return_date ??
      "",

    estimatedCost:
      item.estimatedCost ??
      item.estimated_cost ??
      0,

    actualCost:
      item.actualCost ??
      item.actual_cost ??
      0,

    downtimeHours:
      item.downtimeHours ??
      item.downtime_hours ??
      item.downtime ??
      0,

    warrantyStatus:
      item.warrantyStatus ??
      item.warranty_status ??
      "Unknown",

    issueDescription:
      item.issueDescription ??
      item.issue_description ??
      item.description ??
      "",

    diagnosis: item.diagnosis ?? "",

    repairAction:
      item.repairAction ??
      item.repair_action ??
      item.actionTaken ??
      item.action_taken ??
      "",

    partsReplaced:
      item.partsReplaced ??
      item.parts_replaced ??
      "",

    rootCause:
      item.rootCause ??
      item.root_cause ??
      "",

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

  if (!Number.isFinite(number)) {
    return "ETB 0.00";
  }

  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "ETB",
    minimumFractionDigits: 2,
  }).format(number);
}

function getStatusClasses(status) {
  switch (String(status).toLowerCase()) {
    case "reported":
      return "border-blue-200 bg-blue-50 text-blue-700";

    case "diagnosed":
      return "border-indigo-200 bg-indigo-50 text-indigo-700";

    case "in repair":
      return "border-violet-200 bg-violet-50 text-violet-700";

    case "waiting for parts":
      return "border-amber-200 bg-amber-50 text-amber-700";

    case "completed":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";

    case "returned":
      return "border-green-200 bg-green-50 text-green-700";

    case "cancelled":
      return "border-red-200 bg-red-50 text-red-700";

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
          <span className="ml-1 text-red-500">*</span>
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

export default function RepairHistory() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] =
    useState("All");
  const [typeFilter, setTypeFilter] = useState("All");

  const [page, setPage] = useState(1);

  const [showForm, setShowForm] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const [editingRecord, setEditingRecord] = useState(null);
  const [selectedRecord, setSelectedRecord] = useState(null);

  const [form, setForm] = useState(initialForm);

  const loadRepairs = async () => {
    setLoading(true);
    setError("");

    try {
      let data;

      try {
        data = await apiRequest("/repair-history");
      } catch {
        try {
          data = await apiRequest("/repairHistory");
        } catch {
          try {
            data = await apiRequest("/repairs");
          } catch {
            data = await apiRequest("/repair");
          }
        }
      }

      setRecords(
        extractArray(data).map(normalizeRepair)
      );
    } catch (err) {
      setError(
        err.message ||
          "Unable to load repair history."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRepairs();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [
    search,
    statusFilter,
    priorityFilter,
    typeFilter,
  ]);

  const statistics = useMemo(() => {
    const total = records.length;

    const active = records.filter(
      (item) =>
        [
          "Reported",
          "Diagnosed",
          "In Repair",
          "Waiting for Parts",
        ].includes(item.status)
    ).length;

    const completed = records.filter(
      (item) =>
        item.status === "Completed" ||
        item.status === "Returned"
    ).length;

    const critical = records.filter(
      (item) =>
        item.priority === "Critical"
    ).length;

    const totalCost = records.reduce(
      (sum, item) =>
        sum + Number(item.actualCost || 0),
      0
    );

    const totalDowntime = records.reduce(
      (sum, item) =>
        sum + Number(item.downtimeHours || 0),
      0
    );

    return {
      total,
      active,
      completed,
      critical,
      totalCost,
      totalDowntime,
    };
  }, [records]);

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();

    return records.filter((item) => {
      const searchable = [
        item.repairNumber,
        item.assetTag,
        item.assetName,
        item.assetCategory,
        item.serialNumber,
        item.repairType,
        item.priority,
        item.status,
        item.reportedBy,
        item.assignedTechnician,
        item.department,
        item.location,
        item.vendor,
        item.issueDescription,
        item.diagnosis,
        item.repairAction,
        item.partsReplaced,
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !query || searchable.includes(query);

      const matchesStatus =
        statusFilter === "All" ||
        item.status.toLowerCase() ===
          statusFilter.toLowerCase();

      const matchesPriority =
        priorityFilter === "All" ||
        item.priority.toLowerCase() ===
          priorityFilter.toLowerCase();

      const matchesType =
        typeFilter === "All" ||
        item.repairType.toLowerCase() ===
          typeFilter.toLowerCase();

      return (
        matchesSearch &&
        matchesStatus &&
        matchesPriority &&
        matchesType
      );
    });
  }, [
    records,
    search,
    statusFilter,
    priorityFilter,
    typeFilter,
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
      repairNumber: `REP-${Date.now()
        .toString()
        .slice(-8)}`,
      dateReported: new Date()
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
      repairNumber: record.repairNumber || "",
      assetTag: record.assetTag || "",
      assetName: record.assetName || "",
      assetCategory: record.assetCategory || "",
      serialNumber: record.serialNumber || "",
      repairType:
        record.repairType || "Hardware Repair",
      priority: record.priority || "Medium",
      status: record.status || "Reported",
      reportedBy: record.reportedBy || "",
      assignedTechnician:
        record.assignedTechnician || "",
      department: record.department || "",
      location: record.location || "",
      vendor: record.vendor || "",
      dateReported: dateOnly(record.dateReported),
      diagnosisDate: dateOnly(record.diagnosisDate),
      repairStartDate: dateOnly(
        record.repairStartDate
      ),
      completionDate: dateOnly(
        record.completionDate
      ),
      returnDate: dateOnly(record.returnDate),
      estimatedCost: record.estimatedCost ?? "",
      actualCost: record.actualCost ?? "",
      downtimeHours: record.downtimeHours ?? "",
      warrantyStatus:
        record.warrantyStatus || "Unknown",
      issueDescription:
        record.issueDescription || "",
      diagnosis: record.diagnosis || "",
      repairAction: record.repairAction || "",
      partsReplaced: record.partsReplaced || "",
      rootCause: record.rootCause || "",
      recommendations:
        record.recommendations || "",
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

  const saveRepair = async (event) => {
    event.preventDefault();

    if (!form.assetTag.trim()) {
      setError("Asset tag is required.");
      return;
    }

    if (!form.issueDescription.trim()) {
      setError(
        "Issue description is required."
      );
      return;
    }

    setSaving(true);
    setError("");

    const payload = {
      repairNumber: form.repairNumber,
      assetTag: form.assetTag,
      assetName: form.assetName,
      assetCategory: form.assetCategory,
      serialNumber: form.serialNumber,
      repairType: form.repairType,
      priority: form.priority,
      status: form.status,
      reportedBy: form.reportedBy,
      assignedTechnician:
        form.assignedTechnician,
      department: form.department,
      location: form.location,
      vendor: form.vendor,
      dateReported: form.dateReported,
      diagnosisDate: form.diagnosisDate,
      repairStartDate: form.repairStartDate,
      completionDate: form.completionDate,
      returnDate: form.returnDate,
      estimatedCost:
        Number(form.estimatedCost) || 0,
      actualCost:
        Number(form.actualCost) || 0,
      downtimeHours:
        Number(form.downtimeHours) || 0,
      warrantyStatus: form.warrantyStatus,
      issueDescription: form.issueDescription,
      diagnosis: form.diagnosis,
      repairAction: form.repairAction,
      partsReplaced: form.partsReplaced,
      rootCause: form.rootCause,
      recommendations: form.recommendations,
      notes: form.notes,
    };

    try {
      if (editingRecord) {
        let response;

        try {
          response = await apiRequest(
            `/repair-history/${editingRecord.id}`,
            {
              method: "PUT",
              body: JSON.stringify(payload),
            }
          );
        } catch {
          try {
            response = await apiRequest(
              `/repairHistory/${editingRecord.id}`,
              {
                method: "PUT",
                body: JSON.stringify(payload),
              }
            );
          } catch {
            response = await apiRequest(
              `/repairs/${editingRecord.id}`,
              {
                method: "PUT",
                body: JSON.stringify(payload),
              }
            );
          }
        }

        const updated = normalizeRepair(
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
            "/repair-history",
            {
              method: "POST",
              body: JSON.stringify(payload),
            }
          );
        } catch {
          try {
            response = await apiRequest(
              "/repairHistory",
              {
                method: "POST",
                body: JSON.stringify(payload),
              }
            );
          } catch {
            response = await apiRequest(
              "/repairs",
              {
                method: "POST",
                body: JSON.stringify(payload),
              }
            );
          }
        }

        const created = normalizeRepair(
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
          "Unable to save repair record."
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteRepair = async (record) => {
    const confirmed = window.confirm(
      `Delete repair record ${record.repairNumber}?`
    );

    if (!confirmed) return;

    setError("");

    try {
      try {
        await apiRequest(
          `/repair-history/${record.id}`,
          {
            method: "DELETE",
          }
        );
      } catch {
        try {
          await apiRequest(
            `/repairHistory/${record.id}`,
            {
              method: "DELETE",
            }
          );
        } catch {
          await apiRequest(
            `/repairs/${record.id}`,
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
          "Unable to delete repair record."
      );
    }
  };

  const exportCSV = () => {
    if (!filteredRecords.length) return;

    const headers = [
      "Repair Number",
      "Asset Tag",
      "Asset Name",
      "Asset Category",
      "Serial Number",
      "Repair Type",
      "Priority",
      "Status",
      "Reported By",
      "Assigned Technician",
      "Department",
      "Location",
      "Vendor",
      "Date Reported",
      "Diagnosis Date",
      "Repair Start Date",
      "Completion Date",
      "Return Date",
      "Estimated Cost",
      "Actual Cost",
      "Downtime Hours",
      "Warranty Status",
      "Issue Description",
      "Diagnosis",
      "Repair Action",
      "Parts Replaced",
      "Root Cause",
      "Recommendations",
    ];

    const rows = filteredRecords.map(
      (item) => [
        item.repairNumber,
        item.assetTag,
        item.assetName,
        item.assetCategory,
        item.serialNumber,
        item.repairType,
        item.priority,
        item.status,
        item.reportedBy,
        item.assignedTechnician,
        item.department,
        item.location,
        item.vendor,
        item.dateReported,
        item.diagnosisDate,
        item.repairStartDate,
        item.completionDate,
        item.returnDate,
        item.estimatedCost,
        item.actualCost,
        item.downtimeHours,
        item.warrantyStatus,
        item.issueDescription,
        item.diagnosis,
        item.repairAction,
        item.partsReplaced,
        item.rootCause,
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
    link.download = `repair-history-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 ict-module-theme ict-theme-reports">
      <div className="mx-auto max-w-[1600px] space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between ict-page-header">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
              <History size={16} />

              <span>ICT Operations</span>

              <span>/</span>

              <span className="text-slate-700">
                Repair History
              </span>
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl ict-page-title">
              Repair History
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Track ICT asset faults, diagnoses, repair
              activities, costs, downtime, and returns.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={loadRepairs}
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
              Record Repair
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <SummaryCard
            title="Total Repairs"
            value={statistics.total}
            icon={History}
            iconClass="bg-blue-50 text-blue-600"
          />

          <SummaryCard
            title="Active Repairs"
            value={statistics.active}
            icon={Wrench}
            iconClass="bg-violet-50 text-violet-600"
          />

          <SummaryCard
            title="Completed"
            value={statistics.completed}
            icon={CheckCircle2}
            iconClass="bg-emerald-50 text-emerald-600"
          />

          <SummaryCard
            title="Critical Cases"
            value={statistics.critical}
            icon={AlertTriangle}
            iconClass="bg-red-50 text-red-600"
          />

          <SummaryCard
            title="Total Cost"
            value={formatCurrency(
              statistics.totalCost
            )}
            icon={CircleDollarSign}
            iconClass="bg-amber-50 text-amber-600"
          />
        </div>

        {/* Downtime */}
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
                <Clock3 size={19} />
              </div>

              <div>
                <p className="text-sm font-medium text-slate-500">
                  Total Recorded Downtime
                </p>

                <p className="text-lg font-bold text-slate-900">
                  {statistics.totalDowntime} hours
                </p>
              </div>
            </div>

            <p className="text-sm text-slate-500">
              Across all repair history records
            </p>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {/* Filters */}
          <div className="border-b border-slate-200 p-4 ict-filter-panel">
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
                    setSearch(event.target.value)
                  }
                  placeholder="Search repair, asset, technician..."
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
                    className="h-10 min-w-[150px] appearance-none rounded-lg border border-slate-200 bg-white pl-9 pr-8 text-sm font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
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
                  className="h-10 min-w-[165px] rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="All">
                    All Repair Types
                  </option>

                  {REPAIR_TYPES.map(
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
                    Repair
                  </th>

                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Asset
                  </th>

                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Repair Type
                  </th>

                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Priority
                  </th>

                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Technician
                  </th>

                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Reported
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
                          <History size={27} />
                        </div>

                        <h3 className="text-base font-semibold text-slate-900">
                          No repair records found
                        </h3>

                        <p className="mt-1 text-sm text-slate-500">
                          Change your filters or add a
                          new repair record.
                        </p>

                        <button
                          type="button"
                          onClick={openCreate}
                          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                        >
                          <Plus size={16} />
                          Record Repair
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
                            {record.repairNumber}
                          </button>

                          <div className="mt-1 max-w-[230px] truncate text-sm font-medium text-slate-800">
                            {record.issueDescription ||
                              "Repair case"}
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
                            {record.repairType}
                          </div>

                          <div className="mt-1 text-xs text-slate-400">
                            {record.serialNumber ||
                              "No serial number"}
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
                              record.dateReported
                            )}
                          </div>

                          {record.completionDate && (
                            <div className="mt-1 text-xs text-slate-400">
                              Completed:{" "}
                              {formatDate(
                                record.completionDate
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
                            {record.downtimeHours ||
                              0}{" "}
                            hrs downtime
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
                              title="View repair"
                              onClick={() =>
                                openDetails(record)
                              }
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                            >
                              <Eye size={16} />
                            </button>

                            <button
                              type="button"
                              title="Edit repair"
                              onClick={() =>
                                openEdit(record)
                              }
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                            >
                              <Pencil size={16} />
                            </button>

                            <button
                              type="button"
                              title="Delete repair"
                              onClick={() =>
                                deleteRepair(record)
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
                  repair records
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

      {/* Add / Edit Modal */}
      {showForm && (
        <Modal
          title={
            editingRecord
              ? "Edit Repair Record"
              : "Record ICT Repair"
          }
          icon={editingRecord ? Pencil : Wrench}
          onClose={closeModals}
          large
        >
          <form onSubmit={saveRepair}>
            <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <InputField
                  label="Repair Number"
                  name="repairNumber"
                  value={form.repairNumber}
                  onChange={handleChange}
                  placeholder="REP-00001"
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
                  value={form.assetCategory}
                  onChange={handleChange}
                  placeholder="Computer / Network / Printer"
                />

                <InputField
                  label="Serial Number"
                  name="serialNumber"
                  value={form.serialNumber}
                  onChange={handleChange}
                  placeholder="Serial number"
                />

                <SelectField
                  label="Repair Type"
                  name="repairType"
                  value={form.repairType}
                  onChange={handleChange}
                  options={REPAIR_TYPES}
                />

                <SelectField
                  label="Priority"
                  name="priority"
                  value={form.priority}
                  onChange={handleChange}
                  options={PRIORITY_OPTIONS}
                />

                <SelectField
                  label="Status"
                  name="status"
                  value={form.status}
                  onChange={handleChange}
                  options={STATUS_OPTIONS}
                />

                <InputField
                  label="Reported By"
                  name="reportedBy"
                  value={form.reportedBy}
                  onChange={handleChange}
                  placeholder="Staff / department"
                />

                <InputField
                  label="Assigned Technician"
                  name="assignedTechnician"
                  value={
                    form.assignedTechnician
                  }
                  onChange={handleChange}
                  placeholder="Technician name"
                />

                <InputField
                  label="Department"
                  name="department"
                  value={form.department}
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
                  label="Vendor"
                  name="vendor"
                  value={form.vendor}
                  onChange={handleChange}
                  placeholder="Service provider"
                />

                <InputField
                  label="Warranty Status"
                  name="warrantyStatus"
                  value={form.warrantyStatus}
                  onChange={handleChange}
                  placeholder="Active / Expired / Unknown"
                />

                <InputField
                  label="Date Reported"
                  name="dateReported"
                  type="date"
                  value={form.dateReported}
                  onChange={handleChange}
                />

                <InputField
                  label="Diagnosis Date"
                  name="diagnosisDate"
                  type="date"
                  value={form.diagnosisDate}
                  onChange={handleChange}
                />

                <InputField
                  label="Repair Start Date"
                  name="repairStartDate"
                  type="date"
                  value={form.repairStartDate}
                  onChange={handleChange}
                />

                <InputField
                  label="Completion Date"
                  name="completionDate"
                  type="date"
                  value={form.completionDate}
                  onChange={handleChange}
                />

                <InputField
                  label="Return Date"
                  name="returnDate"
                  type="date"
                  value={form.returnDate}
                  onChange={handleChange}
                />

                <InputField
                  label="Estimated Cost"
                  name="estimatedCost"
                  type="number"
                  value={form.estimatedCost}
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
                  name="downtimeHours"
                  type="number"
                  value={form.downtimeHours}
                  onChange={handleChange}
                  placeholder="0"
                />

                <div className="md:col-span-2">
                  <TextAreaField
                    label="Issue Description"
                    name="issueDescription"
                    value={form.issueDescription}
                    onChange={handleChange}
                    placeholder="Describe the reported fault or problem..."
                    rows={4}
                  />
                </div>

                <div className="md:col-span-2">
                  <TextAreaField
                    label="Diagnosis"
                    name="diagnosis"
                    value={form.diagnosis}
                    onChange={handleChange}
                    placeholder="Describe the diagnosis and technical findings..."
                    rows={4}
                  />
                </div>

                <div className="md:col-span-2">
                  <TextAreaField
                    label="Repair Action"
                    name="repairAction"
                    value={form.repairAction}
                    onChange={handleChange}
                    placeholder="Describe the repair work performed..."
                    rows={4}
                  />
                </div>

                <div className="md:col-span-2">
                  <TextAreaField
                    label="Parts Replaced"
                    name="partsReplaced"
                    value={form.partsReplaced}
                    onChange={handleChange}
                    placeholder="List replaced components, parts, or materials..."
                  />
                </div>

                <div className="md:col-span-2">
                  <TextAreaField
                    label="Root Cause"
                    name="rootCause"
                    value={form.rootCause}
                    onChange={handleChange}
                    placeholder="Describe the identified root cause..."
                  />
                </div>

                <div className="md:col-span-2">
                  <TextAreaField
                    label="Recommendations"
                    name="recommendations"
                    value={form.recommendations}
                    onChange={handleChange}
                    placeholder="Recommended preventive actions or follow-up..."
                  />
                </div>

                <div className="md:col-span-2">
                  <TextAreaField
                    label="Notes"
                    name="notes"
                    value={form.notes}
                    onChange={handleChange}
                    placeholder="Additional repair notes..."
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
                  : "Record Repair"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Details Modal */}
      {showDetails && selectedRecord && (
        <Modal
          title="Repair Details"
          icon={History}
          onClose={closeModals}
          large
        >
          <div className="max-h-[78vh] overflow-y-auto">
            <div className="border-b border-slate-200 bg-slate-50 px-6 py-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    {selectedRecord.repairNumber}
                  </div>

                  <h2 className="mt-1 text-xl font-bold text-slate-900">
                    {selectedRecord.assetName ||
                      selectedRecord.assetTag ||
                      "ICT Asset Repair"}
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    {selectedRecord.repairType} •{" "}
                    {selectedRecord.assetTag}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span
                    className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-semibold ${getPriorityClasses(
                      selectedRecord.priority
                    )}`}
                  >
                    {selectedRecord.priority}
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
                  Asset Information
                </h3>

                <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 p-4 md:grid-cols-4">
                  <DetailItem
                    label="Asset Tag"
                    value={selectedRecord.assetTag}
                    icon={Monitor}
                  />

                  <DetailItem
                    label="Asset Name"
                    value={selectedRecord.assetName}
                    icon={Monitor}
                  />

                  <DetailItem
                    label="Category"
                    value={selectedRecord.assetCategory}
                  />

                  <DetailItem
                    label="Serial Number"
                    value={selectedRecord.serialNumber}
                  />

                  <DetailItem
                    label="Department"
                    value={selectedRecord.department}
                  />

                  <DetailItem
                    label="Location"
                    value={selectedRecord.location}
                    icon={MapPin}
                  />

                  <DetailItem
                    label="Vendor"
                    value={selectedRecord.vendor}
                  />

                  <DetailItem
                    label="Warranty"
                    value={selectedRecord.warrantyStatus}
                  />
                </div>
              </section>

              {/* People */}
              <section>
                <h3 className="mb-3 text-sm font-semibold text-slate-900">
                  Responsibility
                </h3>

                <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 p-4 md:grid-cols-3">
                  <DetailItem
                    label="Reported By"
                    value={selectedRecord.reportedBy}
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
                    label="Repair Type"
                    value={selectedRecord.repairType}
                    icon={History}
                  />
                </div>
              </section>

              {/* Timeline */}
              <section>
                <h3 className="mb-3 text-sm font-semibold text-slate-900">
                  Repair Timeline
                </h3>

                <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 p-4 md:grid-cols-5">
                  <DetailItem
                    label="Reported"
                    value={formatDate(
                      selectedRecord.dateReported
                    )}
                    icon={CalendarDays}
                  />

                  <DetailItem
                    label="Diagnosed"
                    value={formatDate(
                      selectedRecord.diagnosisDate
                    )}
                    icon={Search}
                  />

                  <DetailItem
                    label="Repair Started"
                    value={formatDate(
                      selectedRecord.repairStartDate
                    )}
                    icon={Wrench}
                  />

                  <DetailItem
                    label="Completed"
                    value={formatDate(
                      selectedRecord.completionDate
                    )}
                    icon={CheckCircle2}
                  />

                  <DetailItem
                    label="Returned"
                    value={formatDate(
                      selectedRecord.returnDate
                    )}
                    icon={Monitor}
                  />
                </div>
              </section>

              {/* Financial */}
              <section>
                <h3 className="mb-3 text-sm font-semibold text-slate-900">
                  Repair Cost & Downtime
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

                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                      Actual Cost
                    </div>

                    <div className="mt-1 text-lg font-bold text-slate-900">
                      {formatCurrency(
                        selectedRecord.actualCost
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-orange-600">
                      Downtime
                    </div>

                    <div className="mt-1 text-lg font-bold text-slate-900">
                      {selectedRecord.downtimeHours ||
                        0}{" "}
                      hours
                    </div>
                  </div>
                </div>
              </section>

              {/* Issue */}
              <section>
                <h3 className="mb-3 text-sm font-semibold text-slate-900">
                  Reported Issue
                </h3>

                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                    {selectedRecord.issueDescription ||
                      "No issue description recorded."}
                  </p>
                </div>
              </section>

              {/* Diagnosis */}
              <section>
                <h3 className="mb-3 text-sm font-semibold text-slate-900">
                  Diagnosis
                </h3>

                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                    {selectedRecord.diagnosis ||
                      "No diagnosis recorded."}
                  </p>
                </div>
              </section>

              {/* Repair action */}
              <section>
                <h3 className="mb-3 text-sm font-semibold text-slate-900">
                  Repair Action
                </h3>

                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                    {selectedRecord.repairAction ||
                      "No repair action recorded."}
                  </p>
                </div>
              </section>

              {/* Parts and root cause */}
              <section>
                <h3 className="mb-3 text-sm font-semibold text-slate-900">
                  Parts & Root Cause
                </h3>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 p-4">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Parts Replaced
                    </div>

                    <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                      {selectedRecord.partsReplaced ||
                        "No parts recorded."}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-4">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Root Cause
                    </div>

                    <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                      {selectedRecord.rootCause ||
                        "No root cause recorded."}
                    </p>
                  </div>
                </div>
              </section>

              {/* Recommendations */}
              <section>
                <h3 className="mb-3 text-sm font-semibold text-slate-900">
                  Recommendations
                </h3>

                <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4">
                  <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                    {selectedRecord.recommendations ||
                      "No recommendations recorded."}
                  </p>
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
                  openEdit(selectedRecord);
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <Pencil size={16} />
                Edit Repair
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