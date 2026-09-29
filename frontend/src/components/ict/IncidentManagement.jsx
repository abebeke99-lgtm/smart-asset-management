import React, { useEffect, useMemo, useState } from "react";
import {
  Search,
  Plus,
  Eye,
  Pencil,
  Trash2,
  Download,
  RefreshCw,
  X,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  CircleDot,
  User,
  Building2,
  CalendarDays,
  Tag,
  MapPin,
  Monitor,
  Wrench,
  ChevronLeft,
  ChevronRight,
  Filter,
  MessageSquare,
  FileWarning,
  Activity,
} from "lucide-react";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

const PAGE_SIZE = 10;

const STATUS_OPTIONS = [
  "Reported",
  "Investigating",
  "In Progress",
  "Contained",
  "Resolved",
  "Closed",
  "Cancelled",
];

const SEVERITY_OPTIONS = [
  "Low",
  "Medium",
  "High",
  "Critical",
];

const INCIDENT_TYPES = [
  "Hardware Failure",
  "Software Failure",
  "Network Outage",
  "Security Incident",
  "Data Loss",
  "Unauthorized Access",
  "System Downtime",
  "Power Failure",
  "Service Interruption",
  "Other",
];

const IMPACT_OPTIONS = [
  "Individual User",
  "Department",
  "College",
  "Multiple Departments",
  "University-wide",
];

const initialForm = {
  incidentNumber: "",
  title: "",
  type: "Hardware Failure",
  severity: "Medium",
  impact: "Individual User",
  status: "Reported",
  reportedBy: "",
  reporterId: "",
  department: "",
  contact: "",
  assignedTo: "",
  location: "",
  assetTag: "",
  affectedSystem: "",
  reportedDate: "",
  startedDate: "",
  containedDate: "",
  resolvedDate: "",
  description: "",
  rootCause: "",
  correctiveAction: "",
  resolution: "",
  downtime: "",
  notes: "",
};

async function request(url, options = {}) {
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
      // Ignore invalid error responses.
    }

    throw new Error(message);
  }

  if (response.status === 204) return null;

  return response.json();
}

function getArray(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.incidents)) return data.incidents;
  if (Array.isArray(data?.incidentManagement)) {
    return data.incidentManagement;
  }
  if (Array.isArray(data?.results)) return data.results;

  return [];
}

function normalizeIncident(item, index) {
  return {
    id:
      item.id ??
      item._id ??
      item.incidentId ??
      item.incident_id ??
      `INC-${String(index + 1).padStart(5, "0")}`,

    incidentNumber:
      item.incidentNumber ??
      item.incident_number ??
      item.incidentNo ??
      item.referenceNumber ??
      `INC-${String(index + 1).padStart(5, "0")}`,

    title:
      item.title ??
      item.subject ??
      item.incidentTitle ??
      "",

    type:
      item.type ??
      item.incidentType ??
      item.incident_type ??
      "Other",

    severity: item.severity ?? "Medium",

    impact:
      item.impact ??
      item.impactLevel ??
      item.impact_level ??
      "Individual User",

    status: item.status ?? "Reported",

    reportedBy:
      item.reportedBy ??
      item.reported_by ??
      item.reporter?.name ??
      item.user?.name ??
      "",

    reporterId:
      item.reporterId ??
      item.reporter_id ??
      item.reporter?.id ??
      item.user?.id ??
      "",

    department:
      item.department ??
      item.departmentName ??
      item.department_name ??
      "",

    contact:
      item.contact ??
      item.phone ??
      item.email ??
      "",

    assignedTo:
      item.assignedTo ??
      item.assigned_to ??
      item.technician?.name ??
      item.technicianName ??
      "",

    location:
      item.location ??
      item.locationName ??
      "",

    assetTag:
      item.assetTag ??
      item.asset_tag ??
      item.asset?.assetTag ??
      "",

    affectedSystem:
      item.affectedSystem ??
      item.affected_system ??
      item.systemName ??
      "",

    reportedDate:
      item.reportedDate ??
      item.reported_date ??
      item.createdAt ??
      item.created_at ??
      "",

    startedDate:
      item.startedDate ??
      item.started_date ??
      "",

    containedDate:
      item.containedDate ??
      item.contained_date ??
      "",

    resolvedDate:
      item.resolvedDate ??
      item.resolved_date ??
      "",

    description:
      item.description ??
      item.incidentDescription ??
      item.incident_description ??
      "",

    rootCause:
      item.rootCause ??
      item.root_cause ??
      "",

    correctiveAction:
      item.correctiveAction ??
      item.corrective_action ??
      "",

    resolution:
      item.resolution ??
      item.resolutionDetails ??
      "",

    downtime:
      item.downtime ??
      item.downtimeMinutes ??
      item.downtime_minutes ??
      "",

    notes: item.notes ?? "",

    createdAt: item.createdAt ?? item.created_at ?? "",
    updatedAt: item.updatedAt ?? item.updated_at ?? "",

    raw: item,
  };
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getSeverityClasses(severity) {
  switch (String(severity).toLowerCase()) {
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

function getStatusClasses(status) {
  switch (String(status).toLowerCase()) {
    case "reported":
      return "border-blue-200 bg-blue-50 text-blue-700";

    case "investigating":
      return "border-violet-200 bg-violet-50 text-violet-700";

    case "in progress":
      return "border-indigo-200 bg-indigo-50 text-indigo-700";

    case "contained":
      return "border-cyan-200 bg-cyan-50 text-cyan-700";

    case "resolved":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";

    case "closed":
      return "border-slate-200 bg-slate-100 text-slate-600";

    case "cancelled":
      return "border-red-200 bg-red-50 text-red-700";

    default:
      return "border-slate-200 bg-slate-100 text-slate-600";
  }
}

function getDaysOpen(incident) {
  if (!incident.reportedDate) return null;

  const start = new Date(incident.reportedDate);

  const end = incident.resolvedDate
    ? new Date(incident.resolvedDate)
    : new Date();

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime())
  ) {
    return null;
  }

  return Math.max(
    0,
    Math.ceil((end - start) / (1000 * 60 * 60 * 24))
  );
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

function FormField({
  label,
  name,
  value,
  onChange,
  placeholder,
  type = "text",
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

function DetailItem({ label, value, icon: Icon }) {
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

export default function IncidentManagement() {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [severityFilter, setSeverityFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");

  const [page, setPage] = useState(1);

  const [showForm, setShowForm] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const [editingIncident, setEditingIncident] =
    useState(null);

  const [selectedIncident, setSelectedIncident] =
    useState(null);

  const [form, setForm] = useState(initialForm);

  const loadIncidents = async () => {
    setLoading(true);
    setError("");

    try {
      let data;

      try {
        data = await request("/incidents");
      } catch {
        try {
          data = await request("/incident-management");
        } catch {
          try {
            data = await request("/incidentManagement");
          } catch {
            data = await request("/incident-management/incidents");
          }
        }
      }

      setIncidents(
        getArray(data).map(normalizeIncident)
      );
    } catch (err) {
      setError(
        err.message ||
          "Unable to load incident management records."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIncidents();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [
    search,
    statusFilter,
    severityFilter,
    typeFilter,
  ]);

  const statistics = useMemo(() => {
    const total = incidents.length;

    const active = incidents.filter((incident) =>
      [
        "Reported",
        "Investigating",
        "In Progress",
        "Contained",
      ].includes(incident.status)
    ).length;

    const critical = incidents.filter(
      (incident) => incident.severity === "Critical"
    ).length;

    const resolved = incidents.filter(
      (incident) =>
        incident.status === "Resolved" ||
        incident.status === "Closed"
    ).length;

    const highImpact = incidents.filter(
      (incident) =>
        incident.impact === "University-wide" ||
        incident.impact === "Multiple Departments"
    ).length;

    return {
      total,
      active,
      critical,
      resolved,
      highImpact,
    };
  }, [incidents]);

  const filteredIncidents = useMemo(() => {
    const query = search.trim().toLowerCase();

    return incidents.filter((incident) => {
      const matchesSearch =
        !query ||
        [
          incident.incidentNumber,
          incident.title,
          incident.type,
          incident.severity,
          incident.impact,
          incident.status,
          incident.reportedBy,
          incident.reporterId,
          incident.department,
          incident.assignedTo,
          incident.location,
          incident.assetTag,
          incident.affectedSystem,
          incident.description,
        ].some((value) =>
          String(value || "")
            .toLowerCase()
            .includes(query)
        );

      const matchesStatus =
        statusFilter === "All" ||
        incident.status.toLowerCase() ===
          statusFilter.toLowerCase();

      const matchesSeverity =
        severityFilter === "All" ||
        incident.severity.toLowerCase() ===
          severityFilter.toLowerCase();

      const matchesType =
        typeFilter === "All" ||
        incident.type.toLowerCase() ===
          typeFilter.toLowerCase();

      return (
        matchesSearch &&
        matchesStatus &&
        matchesSeverity &&
        matchesType
      );
    });
  }, [
    incidents,
    search,
    statusFilter,
    severityFilter,
    typeFilter,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredIncidents.length / PAGE_SIZE)
  );

  const paginatedIncidents = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;

    return filteredIncidents.slice(
      start,
      start + PAGE_SIZE
    );
  }, [filteredIncidents, page]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const openCreate = () => {
    setEditingIncident(null);

    setForm({
      ...initialForm,
      incidentNumber: `INC-${Date.now()
        .toString()
        .slice(-8)}`,
      reportedDate: new Date()
        .toISOString()
        .slice(0, 10),
    });

    setShowForm(true);
  };

  const openEdit = (incident) => {
    setEditingIncident(incident);

    setForm({
      incidentNumber:
        incident.incidentNumber || "",
      title: incident.title || "",
      type: incident.type || "Hardware Failure",
      severity: incident.severity || "Medium",
      impact:
        incident.impact || "Individual User",
      status: incident.status || "Reported",
      reportedBy: incident.reportedBy || "",
      reporterId: incident.reporterId || "",
      department: incident.department || "",
      contact: incident.contact || "",
      assignedTo: incident.assignedTo || "",
      location: incident.location || "",
      assetTag: incident.assetTag || "",
      affectedSystem:
        incident.affectedSystem || "",
      reportedDate:
        incident.reportedDate?.slice?.(0, 10) || "",
      startedDate:
        incident.startedDate?.slice?.(0, 10) || "",
      containedDate:
        incident.containedDate?.slice?.(0, 10) || "",
      resolvedDate:
        incident.resolvedDate?.slice?.(0, 10) || "",
      description: incident.description || "",
      rootCause: incident.rootCause || "",
      correctiveAction:
        incident.correctiveAction || "",
      resolution: incident.resolution || "",
      downtime: incident.downtime ?? "",
      notes: incident.notes || "",
    });

    setShowForm(true);
  };

  const openDetails = (incident) => {
    setSelectedIncident(incident);
    setShowDetails(true);
  };

  const closeModals = () => {
    if (saving) return;

    setShowForm(false);
    setShowDetails(false);
    setEditingIncident(null);
    setSelectedIncident(null);
  };

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const saveIncident = async (event) => {
    event.preventDefault();

    if (!form.title.trim()) {
      setError("Incident title is required.");
      return;
    }

    if (!form.reportedBy.trim()) {
      setError("Reporter name is required.");
      return;
    }

    setSaving(true);
    setError("");

    const payload = {
      incidentNumber: form.incidentNumber,
      title: form.title,
      type: form.type,
      severity: form.severity,
      impact: form.impact,
      status: form.status,
      reportedBy: form.reportedBy,
      reporterId: form.reporterId,
      department: form.department,
      contact: form.contact,
      assignedTo: form.assignedTo,
      location: form.location,
      assetTag: form.assetTag,
      affectedSystem: form.affectedSystem,
      reportedDate: form.reportedDate,
      startedDate: form.startedDate,
      containedDate: form.containedDate,
      resolvedDate: form.resolvedDate,
      description: form.description,
      rootCause: form.rootCause,
      correctiveAction: form.correctiveAction,
      resolution: form.resolution,
      downtime: Number(form.downtime) || 0,
      notes: form.notes,
    };

    try {
      if (editingIncident) {
        let response;

        try {
          response = await request(
            `/incidents/${editingIncident.id}`,
            {
              method: "PUT",
              body: JSON.stringify(payload),
            }
          );
        } catch {
          try {
            response = await request(
              `/incident-management/${editingIncident.id}`,
              {
                method: "PUT",
                body: JSON.stringify(payload),
              }
            );
          } catch {
            response = await request(
              `/incidentManagement/${editingIncident.id}`,
              {
                method: "PUT",
                body: JSON.stringify(payload),
              }
            );
          }
        }

        const updated = normalizeIncident(
          response?.data ||
            response ||
            payload,
          0
        );

        setIncidents((current) =>
          current.map((item) =>
            item.id === editingIncident.id
              ? {
                  ...item,
                  ...updated,
                  id: editingIncident.id,
                }
              : item
          )
        );
      } else {
        let response;

        try {
          response = await request("/incidents", {
            method: "POST",
            body: JSON.stringify(payload),
          });
        } catch {
          try {
            response = await request(
              "/incident-management",
              {
                method: "POST",
                body: JSON.stringify(payload),
              }
            );
          } catch {
            response = await request(
              "/incidentManagement",
              {
                method: "POST",
                body: JSON.stringify(payload),
              }
            );
          }
        }

        const created = normalizeIncident(
          response?.data ||
            response ||
            payload,
          incidents.length
        );

        setIncidents((current) => [
          created,
          ...current,
        ]);
      }

      setForm(initialForm);
      setEditingIncident(null);
      setShowForm(false);
    } catch (err) {
      setError(
        err.message ||
          "Unable to save incident record."
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteIncident = async (incident) => {
    const confirmed = window.confirm(
      `Delete incident ${incident.incidentNumber}?`
    );

    if (!confirmed) return;

    setError("");

    try {
      try {
        await request(
          `/incidents/${incident.id}`,
          {
            method: "DELETE",
          }
        );
      } catch {
        try {
          await request(
            `/incident-management/${incident.id}`,
            {
              method: "DELETE",
            }
          );
        } catch {
          await request(
            `/incidentManagement/${incident.id}`,
            {
              method: "DELETE",
            }
          );
        }
      }

      setIncidents((current) =>
        current.filter(
          (item) => item.id !== incident.id
        )
      );

      if (
        selectedIncident?.id === incident.id
      ) {
        setSelectedIncident(null);
        setShowDetails(false);
      }
    } catch (err) {
      setError(
        err.message ||
          "Unable to delete incident."
      );
    }
  };

  const exportCSV = () => {
    if (!filteredIncidents.length) return;

    const headers = [
      "Incident Number",
      "Title",
      "Type",
      "Severity",
      "Impact",
      "Status",
      "Reported By",
      "Reporter ID",
      "Department",
      "Contact",
      "Assigned To",
      "Location",
      "Asset Tag",
      "Affected System",
      "Reported Date",
      "Started Date",
      "Contained Date",
      "Resolved Date",
      "Downtime",
      "Root Cause",
      "Corrective Action",
      "Resolution",
    ];

    const rows = filteredIncidents.map(
      (incident) => [
        incident.incidentNumber,
        incident.title,
        incident.type,
        incident.severity,
        incident.impact,
        incident.status,
        incident.reportedBy,
        incident.reporterId,
        incident.department,
        incident.contact,
        incident.assignedTo,
        incident.location,
        incident.assetTag,
        incident.affectedSystem,
        incident.reportedDate,
        incident.startedDate,
        incident.containedDate,
        incident.resolvedDate,
        incident.downtime,
        incident.rootCause,
        incident.correctiveAction,
        incident.resolution,
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
    link.download = `incident-management-${new Date()
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
              <ShieldAlert size={16} />

              <span>ICT Operations</span>

              <span>/</span>

              <span className="text-slate-700">
                Incident Management
              </span>
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
              Incident Management
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Record, investigate, contain, resolve, and
              monitor ICT incidents across the university.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={loadIncidents}
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
              disabled={
                !filteredIncidents.length
              }
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
              Report Incident
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
            title="Total Incidents"
            value={statistics.total}
            icon={ShieldAlert}
            iconClass="bg-blue-50 text-blue-600"
          />

          <SummaryCard
            title="Active Incidents"
            value={statistics.active}
            icon={Activity}
            iconClass="bg-indigo-50 text-indigo-600"
          />

          <SummaryCard
            title="Critical"
            value={statistics.critical}
            icon={AlertTriangle}
            iconClass="bg-red-50 text-red-600"
          />

          <SummaryCard
            title="Resolved / Closed"
            value={statistics.resolved}
            icon={CheckCircle2}
            iconClass="bg-emerald-50 text-emerald-600"
          />

          <SummaryCard
            title="High Impact"
            value={statistics.highImpact}
            icon={Building2}
            iconClass="bg-amber-50 text-amber-600"
          />
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
                  placeholder="Search incident, system, reporter..."
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
                  value={severityFilter}
                  onChange={(event) =>
                    setSeverityFilter(
                      event.target.value
                    )
                  }
                  className="h-10 min-w-[145px] rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="All">
                    All Severities
                  </option>

                  {SEVERITY_OPTIONS.map(
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
                  value={typeFilter}
                  onChange={(event) =>
                    setTypeFilter(
                      event.target.value
                    )
                  }
                  className="h-10 min-w-[175px] rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="All">
                    All Incident Types
                  </option>

                  {INCIDENT_TYPES.map(
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
            <table className="w-full min-w-[1500px] text-left">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200">
                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Incident
                  </th>

                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Reporter
                  </th>

                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Incident Type
                  </th>

                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Severity
                  </th>

                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Impact
                  </th>

                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Assigned To
                  </th>

                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Reported
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
                  Array.from({
                    length: 7,
                  }).map((_, rowIndex) => (
                    <tr key={rowIndex}>
                      {Array.from({
                        length: 9,
                      }).map(
                        (
                          __,
                          cellIndex
                        ) => (
                          <td
                            key={cellIndex}
                            className="px-5 py-5"
                          >
                            <div className="h-4 animate-pulse rounded bg-slate-100" />
                          </td>
                        )
                      )}
                    </tr>
                  ))
                ) : paginatedIncidents.length ===
                  0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-6 py-16 text-center"
                    >
                      <div className="mx-auto flex max-w-sm flex-col items-center">
                        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                          <ShieldAlert
                            size={27}
                          />
                        </div>

                        <h3 className="text-base font-semibold text-slate-900">
                          No incidents found
                        </h3>

                        <p className="mt-1 text-sm text-slate-500">
                          Change your filters or
                          report a new incident.
                        </p>

                        <button
                          type="button"
                          onClick={
                            openCreate
                          }
                          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                        >
                          <Plus
                            size={16}
                          />
                          Report Incident
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedIncidents.map(
                    (incident) => (
                      <tr
                        key={incident.id}
                        className="group transition hover:bg-slate-50/80"
                      >
                        <td className="px-5 py-4">
                          <button
                            type="button"
                            onClick={() =>
                              openDetails(
                                incident
                              )
                            }
                            className="font-semibold text-blue-600 hover:text-blue-700"
                          >
                            {
                              incident.incidentNumber
                            }
                          </button>

                          <div className="mt-1 max-w-[240px] truncate text-sm font-medium text-slate-800">
                            {incident.title ||
                              "Untitled incident"}
                          </div>

                          <div className="mt-1 text-xs text-slate-400">
                            {incident.affectedSystem ||
                              incident.assetTag ||
                              "No system linked"}
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                              <User
                                size={15}
                              />
                            </div>

                            <div>
                              <div className="text-sm font-medium text-slate-800">
                                {incident.reportedBy ||
                                  "—"}
                              </div>

                              <div className="mt-0.5 text-xs text-slate-400">
                                {incident.department ||
                                  "No department"}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2 text-sm text-slate-700">
                            <Tag
                              size={15}
                              className="text-slate-400"
                            />

                            {incident.type}
                          </div>

                          <div className="mt-1 text-xs text-slate-400">
                            {incident.location ||
                              "Location not specified"}
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getSeverityClasses(
                              incident.severity
                            )}`}
                          >
                            {
                              incident.severity
                            }
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <div className="text-sm font-medium text-slate-700">
                            {incident.impact}
                          </div>

                          {incident.assetTag && (
                            <div className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                              <Monitor
                                size={12}
                              />

                              {
                                incident.assetTag
                              }
                            </div>
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2 text-sm text-slate-700">
                            <Wrench
                              size={15}
                              className="text-slate-400"
                            />

                            {incident.assignedTo ||
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
                              incident.reportedDate
                            )}
                          </div>

                          {getDaysOpen(
                            incident
                          ) !== null && (
                            <div className="mt-1 text-xs text-slate-400">
                              {
                                getDaysOpen(
                                  incident
                                )
                              }{" "}
                              day
                              {getDaysOpen(
                                incident
                              ) === 1
                                ? ""
                                : "s"}{" "}
                              open
                            </div>
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusClasses(
                              incident.status
                            )}`}
                          >
                            {incident.status}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              title="View incident"
                              onClick={() =>
                                openDetails(
                                  incident
                                )
                              }
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                            >
                              <Eye
                                size={16}
                              />
                            </button>

                            <button
                              type="button"
                              title="Edit incident"
                              onClick={() =>
                                openEdit(
                                  incident
                                )
                              }
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                            >
                              <Pencil
                                size={16}
                              />
                            </button>

                            <button
                              type="button"
                              title="Delete incident"
                              onClick={() =>
                                deleteIncident(
                                  incident
                                )
                              }
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-red-500 hover:bg-red-50 hover:text-red-700"
                            >
                              <Trash2
                                size={16}
                              />
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
            filteredIncidents.length >
              0 && (
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
                      filteredIncidents.length
                    )}
                  </span>{" "}
                  of{" "}
                  <span className="font-medium text-slate-700">
                    {
                      filteredIncidents.length
                    }
                  </span>{" "}
                  incidents
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
                    <ChevronLeft
                      size={16}
                    />
                    Previous
                  </button>

                  <div className="flex h-9 min-w-9 items-center justify-center rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white">
                    {page}
                  </div>

                  <button
                    type="button"
                    disabled={
                      page >=
                      totalPages
                    }
                    onClick={() =>
                      setPage(
                        (current) =>
                          current + 1
                      )
                    }
                    className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                  >
                    Next
                    <ChevronRight
                      size={16}
                    />
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
            editingIncident
              ? "Edit Incident"
              : "Report New Incident"
          }
          icon={
            editingIncident
              ? Pencil
              : Plus
          }
          onClose={closeModals}
          large
        >
          <form onSubmit={saveIncident}>
            <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <FormField
                  label="Incident Number"
                  name="incidentNumber"
                  value={
                    form.incidentNumber
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="INC-00001"
                />

                <FormField
                  label="Incident Title"
                  name="title"
                  value={form.title}
                  onChange={
                    handleChange
                  }
                  placeholder="Describe the incident"
                  required
                />

                <SelectField
                  label="Incident Type"
                  name="type"
                  value={form.type}
                  onChange={
                    handleChange
                  }
                  options={
                    INCIDENT_TYPES
                  }
                />

                <SelectField
                  label="Severity"
                  name="severity"
                  value={
                    form.severity
                  }
                  onChange={
                    handleChange
                  }
                  options={
                    SEVERITY_OPTIONS
                  }
                />

                <SelectField
                  label="Impact"
                  name="impact"
                  value={form.impact}
                  onChange={
                    handleChange
                  }
                  options={
                    IMPACT_OPTIONS
                  }
                />

                <SelectField
                  label="Status"
                  name="status"
                  value={form.status}
                  onChange={
                    handleChange
                  }
                  options={
                    STATUS_OPTIONS
                  }
                />

                <FormField
                  label="Reported By"
                  name="reportedBy"
                  value={
                    form.reportedBy
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="Full name"
                  required
                />

                <FormField
                  label="Reporter ID"
                  name="reporterId"
                  value={
                    form.reporterId
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="Employee / Student ID"
                />

                <FormField
                  label="Department"
                  name="department"
                  value={
                    form.department
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="Department / College"
                />

                <FormField
                  label="Contact"
                  name="contact"
                  value={form.contact}
                  onChange={
                    handleChange
                  }
                  placeholder="Phone or email"
                />

                <FormField
                  label="Assigned Technician"
                  name="assignedTo"
                  value={
                    form.assignedTo
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="Technician name"
                />

                <FormField
                  label="Location"
                  name="location"
                  value={form.location}
                  onChange={
                    handleChange
                  }
                  placeholder="Building / office"
                />

                <FormField
                  label="Asset Tag"
                  name="assetTag"
                  value={
                    form.assetTag
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="ICT-00001"
                />

                <FormField
                  label="Affected System"
                  name="affectedSystem"
                  value={
                    form.affectedSystem
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="System / application / service"
                />

                <FormField
                  label="Reported Date"
                  name="reportedDate"
                  type="date"
                  value={
                    form.reportedDate
                  }
                  onChange={
                    handleChange
                  }
                />

                <FormField
                  label="Started Date"
                  name="startedDate"
                  type="date"
                  value={
                    form.startedDate
                  }
                  onChange={
                    handleChange
                  }
                />

                <FormField
                  label="Contained Date"
                  name="containedDate"
                  type="date"
                  value={
                    form.containedDate
                  }
                  onChange={
                    handleChange
                  }
                />

                <FormField
                  label="Resolved Date"
                  name="resolvedDate"
                  type="date"
                  value={
                    form.resolvedDate
                  }
                  onChange={
                    handleChange
                  }
                />

                <FormField
                  label="Downtime (Minutes)"
                  name="downtime"
                  type="number"
                  value={
                    form.downtime
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="0"
                />

                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Incident Description
                  </label>

                  <textarea
                    name="description"
                    value={
                      form.description
                    }
                    onChange={
                      handleChange
                    }
                    rows={4}
                    placeholder="Describe what happened, affected services, symptoms, and relevant details..."
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Root Cause
                  </label>

                  <textarea
                    name="rootCause"
                    value={
                      form.rootCause
                    }
                    onChange={
                      handleChange
                    }
                    rows={3}
                    placeholder="Identify the known or suspected root cause..."
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Corrective Action
                  </label>

                  <textarea
                    name="correctiveAction"
                    value={
                      form.correctiveAction
                    }
                    onChange={
                      handleChange
                    }
                    rows={3}
                    placeholder="Describe corrective and preventive actions..."
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Resolution
                  </label>

                  <textarea
                    name="resolution"
                    value={
                      form.resolution
                    }
                    onChange={
                      handleChange
                    }
                    rows={3}
                    placeholder="Describe how the incident was resolved..."
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Internal Notes
                  </label>

                  <textarea
                    name="notes"
                    value={form.notes}
                    onChange={
                      handleChange
                    }
                    rows={3}
                    placeholder="Additional internal notes..."
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
              <button
                type="button"
                onClick={
                  closeModals
                }
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

                {editingIncident
                  ? "Save Changes"
                  : "Report Incident"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Details Modal */}
      {showDetails &&
        selectedIncident && (
          <Modal
            title="Incident Details"
            icon={ShieldAlert}
            onClose={
              closeModals
            }
            large
          >
            <div className="max-h-[78vh] overflow-y-auto">
              <div className="border-b border-slate-200 bg-slate-50 px-6 py-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      {
                        selectedIncident.incidentNumber
                      }
                    </div>

                    <h2 className="mt-1 text-xl font-bold text-slate-900">
                      {
                        selectedIncident.title
                      }
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      {
                        selectedIncident.type
                      }{" "}
                      •{" "}
                      {
                        selectedIncident.impact
                      }
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span
                      className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-semibold ${getSeverityClasses(
                        selectedIncident.severity
                      )}`}
                    >
                      {
                        selectedIncident.severity
                      }
                    </span>

                    <span
                      className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-semibold ${getStatusClasses(
                        selectedIncident.status
                      )}`}
                    >
                      {
                        selectedIncident.status
                      }
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-6 px-6 py-6">
                {/* Incident Overview */}
                <section>
                  <h3 className="mb-3 text-sm font-semibold text-slate-900">
                    Incident Overview
                  </h3>

                  <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 p-4 md:grid-cols-4">
                    <DetailItem
                      label="Incident Number"
                      value={
                        selectedIncident.incidentNumber
                      }
                      icon={
                        FileWarning
                      }
                    />

                    <DetailItem
                      label="Type"
                      value={
                        selectedIncident.type
                      }
                      icon={Tag}
                    />

                    <DetailItem
                      label="Severity"
                      value={
                        selectedIncident.severity
                      }
                    />

                    <DetailItem
                      label="Impact"
                      value={
                        selectedIncident.impact
                      }
                    />

                    <DetailItem
                      label="Affected System"
                      value={
                        selectedIncident.affectedSystem
                      }
                      icon={Monitor}
                    />

                    <DetailItem
                      label="Asset Tag"
                      value={
                        selectedIncident.assetTag
                      }
                      icon={Monitor}
                    />

                    <DetailItem
                      label="Location"
                      value={
                        selectedIncident.location
                      }
                      icon={MapPin}
                    />

                    <DetailItem
                      label="Department"
                      value={
                        selectedIncident.department
                      }
                      icon={Building2}
                    />
                  </div>
                </section>

                {/* Reporter */}
                <section>
                  <h3 className="mb-3 text-sm font-semibold text-slate-900">
                    Reporter & Assignment
                  </h3>

                  <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 p-4 md:grid-cols-4">
                    <DetailItem
                      label="Reported By"
                      value={
                        selectedIncident.reportedBy
                      }
                      icon={User}
                    />

                    <DetailItem
                      label="Reporter ID"
                      value={
                        selectedIncident.reporterId
                      }
                    />

                    <DetailItem
                      label="Contact"
                      value={
                        selectedIncident.contact
                      }
                    />

                    <DetailItem
                      label="Assigned Technician"
                      value={
                        selectedIncident.assignedTo ||
                        "Unassigned"
                      }
                      icon={Wrench}
                    />
                  </div>
                </section>

                {/* Timeline */}
                <section>
                  <h3 className="mb-3 text-sm font-semibold text-slate-900">
                    Incident Timeline
                  </h3>

                  <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 p-4 md:grid-cols-4">
                    <DetailItem
                      label="Reported"
                      value={formatDateTime(
                        selectedIncident.reportedDate
                      )}
                      icon={
                        CalendarDays
                      }
                    />

                    <DetailItem
                      label="Started"
                      value={formatDateTime(
                        selectedIncident.startedDate
                      )}
                      icon={
                        Clock3
                      }
                    />

                    <DetailItem
                      label="Contained"
                      value={formatDateTime(
                        selectedIncident.containedDate
                      )}
                      icon={
                        CheckCircle2
                      }
                    />

                    <DetailItem
                      label="Resolved"
                      value={formatDateTime(
                        selectedIncident.resolvedDate
                      )}
                      icon={
                        CheckCircle2
                      }
                    />
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Duration
                      </div>

                      <div className="mt-1 text-lg font-bold text-slate-900">
                        {getDaysOpen(
                          selectedIncident
                        ) ?? "—"}{" "}
                        {getDaysOpen(
                          selectedIncident
                        ) === 1
                          ? "day"
                          : "days"}
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Downtime
                      </div>

                      <div className="mt-1 text-lg font-bold text-slate-900">
                        {selectedIncident.downtime
                          ? `${selectedIncident.downtime} minutes`
                          : "—"}
                      </div>
                    </div>
                  </div>
                </section>

                {/* Description */}
                <section>
                  <h3 className="mb-3 text-sm font-semibold text-slate-900">
                    Incident Description
                  </h3>

                  <div className="rounded-xl border border-slate-200 p-4">
                    <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      <MessageSquare
                        size={14}
                      />
                      Description
                    </div>

                    <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                      {selectedIncident.description ||
                        "No description provided."}
                    </p>
                  </div>
                </section>

                {/* Investigation */}
                <section>
                  <h3 className="mb-3 text-sm font-semibold text-slate-900">
                    Investigation & Resolution
                  </h3>

                  <div className="space-y-4">
                    <div className="rounded-xl border border-slate-200 p-4">
                      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Root Cause
                      </div>

                      <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                        {selectedIncident.rootCause ||
                          "Root cause has not been recorded."}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 p-4">
                      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Corrective Action
                      </div>

                      <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                        {selectedIncident.correctiveAction ||
                          "No corrective action has been recorded."}
                      </p>
                    </div>

                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
                      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-600">
                        <CheckCircle2
                          size={14}
                        />
                        Resolution
                      </div>

                      <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                        {selectedIncident.resolution ||
                          "No resolution has been recorded yet."}
                      </p>
                    </div>
                  </div>
                </section>

                {/* Notes */}
                {selectedIncident.notes && (
                  <section>
                    <h3 className="mb-3 text-sm font-semibold text-slate-900">
                      Internal Notes
                    </h3>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                      {
                        selectedIncident.notes
                      }
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
                      selectedIncident
                    );
                  }}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Pencil size={16} />
                  Edit Incident
                </button>

                <button
                  type="button"
                  onClick={
                    closeModals
                  }
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