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
  Headphones,
  CheckCircle2,
  Clock3,
  AlertTriangle,
  User,
  Building2,
  CalendarDays,
  Tag,
  Monitor,
  ChevronLeft,
  ChevronRight,
  Filter,
  MessageSquare,
  CircleDot,
  Wrench,
} from "lucide-react";

const API_BASE_URL =
  process.env.REACT_APP_API_URL || "/api";

const PAGE_SIZE = 10;

const STATUS_OPTIONS = [
  "Open",
  "In Progress",
  "Pending",
  "Resolved",
  "Closed",
  "Cancelled",
];

const PRIORITY_OPTIONS = ["Low", "Medium", "High", "Critical"];

const CATEGORY_OPTIONS = [
  "Hardware",
  "Software",
  "Network",
  "Account Access",
  "Printer",
  "Email",
  "Security",
  "Other",
];

const initialForm = {
 ticketNumber: "",
  requesterName: "",
  requesterId: "",
  department: "",
  contact: "",
  category: "Hardware",
  priority: "Medium",
  subject: "",
  description: "",
  assignedTo: "",
  status: "Open",
  assetTag: "",
  location: "",
  openedDate: "",
  dueDate: "",
  resolvedDate: "",
  resolution: "",
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
  if (Array.isArray(data?.tickets)) return data.tickets;
  if (Array.isArray(data?.supportTickets)) return data.supportTickets;
  if (Array.isArray(data?.results)) return data.results;

  return [];
}

function normalizeTicket(item, index) {
  return {
    id:
      item.id ??
      item._id ??
      item.ticketId ??
      item.supportTicketId ??
      `TKT-${String(index + 1).padStart(5, "0")}`,

    ticketNumber:
      item.ticketNumber ??
      item.ticket_number ??
      item.ticketNo ??
      item.referenceNumber ??
      `TKT-${String(index + 1).padStart(5, "0")}`,

    requesterName:
      item.requesterName ??
      item.requester_name ??
      item.requester?.name ??
      item.user?.name ??
      "",

    requesterId:
      item.requesterId ??
      item.requester_id ??
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

    category:
      item.category ??
      item.issueCategory ??
      item.issue_category ??
      "Other",

    priority: item.priority ?? "Medium",

    subject:
      item.subject ??
      item.title ??
      item.issueTitle ??
      "",

    description:
      item.description ??
      item.issueDescription ??
      item.issue_description ??
      "",

    assignedTo:
      item.assignedTo ??
      item.assigned_to ??
      item.technician?.name ??
      item.technicianName ??
      "",

    status: item.status ?? "Open",

    assetTag:
      item.assetTag ??
      item.asset_tag ??
      item.asset?.assetTag ??
      "",

    location:
      item.location ??
      item.locationName ??
      "",

    openedDate:
      item.openedDate ??
      item.opened_date ??
      item.createdAt ??
      item.created_at ??
      "",

    dueDate:
      item.dueDate ??
      item.due_date ??
      "",

    resolvedDate:
      item.resolvedDate ??
      item.resolved_date ??
      "",

    resolution:
      item.resolution ??
      item.resolutionDetails ??
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

function getDaysOpen(ticket) {
  if (!ticket.openedDate) return null;

  const start = new Date(ticket.openedDate);
  const end =
    ticket.resolvedDate
      ? new Date(ticket.resolvedDate)
      : new Date();

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return null;
  }

  return Math.max(
    0,
    Math.ceil((end - start) / (1000 * 60 * 60 * 24))
  );
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

function getStatusClasses(status) {
  switch (String(status).toLowerCase()) {
    case "open":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "in progress":
      return "border-indigo-200 bg-indigo-50 text-indigo-700";
    case "pending":
      return "border-amber-200 bg-amber-50 text-amber-700";
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

function SummaryCard({ title, value, icon: Icon, iconClass }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
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
        {required && <span className="ml-1 text-red-500">*</span>}
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

export default function TechnicalSupport() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");

  const [page, setPage] = useState(1);

  const [showForm, setShowForm] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const [editingTicket, setEditingTicket] = useState(null);
  const [selectedTicket, setSelectedTicket] = useState(null);

  const [form, setForm] = useState(initialForm);

  const loadTickets = async () => {
    setLoading(true);
    setError("");

    try {
      let data;

      try {
        data = await request("/technical-support");
      } catch {
        try {
          data = await request("/technicalSupport");
        } catch {
          try {
            data = await request("/support-tickets");
          } catch {
            data = await request("/supportTickets");
          }
        }
      }

      setTickets(getArray(data).map(normalizeTicket));
    } catch (err) {
      setError(
        err.message || "Unable to load technical support tickets."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, priorityFilter, categoryFilter]);

  const statistics = useMemo(() => {
    const total = tickets.length;

    const open = tickets.filter(
      (ticket) =>
        ticket.status === "Open" ||
        ticket.status === "In Progress"
    ).length;

    const pending = tickets.filter(
      (ticket) => ticket.status === "Pending"
    ).length;

    const resolved = tickets.filter(
      (ticket) =>
        ticket.status === "Resolved" ||
        ticket.status === "Closed"
    ).length;

    const critical = tickets.filter(
      (ticket) => ticket.priority === "Critical"
    ).length;

    return {
      total,
      open,
      pending,
      resolved,
      critical,
    };
  }, [tickets]);

  const filteredTickets = useMemo(() => {
    const query = search.trim().toLowerCase();

    return tickets.filter((ticket) => {
      const matchesSearch =
        !query ||
        [
          ticket.ticketNumber,
          ticket.requesterName,
          ticket.requesterId,
          ticket.department,
          ticket.category,
          ticket.priority,
          ticket.subject,
          ticket.description,
          ticket.assignedTo,
          ticket.assetTag,
          ticket.location,
        ].some((value) =>
          String(value || "")
            .toLowerCase()
            .includes(query)
        );

      const matchesStatus =
        statusFilter === "All" ||
        ticket.status.toLowerCase() ===
          statusFilter.toLowerCase();

      const matchesPriority =
        priorityFilter === "All" ||
        ticket.priority.toLowerCase() ===
          priorityFilter.toLowerCase();

      const matchesCategory =
        categoryFilter === "All" ||
        ticket.category.toLowerCase() ===
          categoryFilter.toLowerCase();

      return (
        matchesSearch &&
        matchesStatus &&
        matchesPriority &&
        matchesCategory
      );
    });
  }, [
    tickets,
    search,
    statusFilter,
    priorityFilter,
    categoryFilter,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredTickets.length / PAGE_SIZE)
  );

  const paginatedTickets = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;

    return filteredTickets.slice(start, start + PAGE_SIZE);
  }, [filteredTickets, page]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const openCreate = () => {
    setEditingTicket(null);

    setForm({
      ...initialForm,
      ticketNumber: `TKT-${Date.now()
        .toString()
        .slice(-8)}`,
      openedDate: new Date().toISOString().slice(0, 10),
    });

    setShowForm(true);
  };

  const openEdit = (ticket) => {
    setEditingTicket(ticket);

    setForm({
      ticketNumber: ticket.ticketNumber || "",
      requesterName: ticket.requesterName || "",
      requesterId: ticket.requesterId || "",
      department: ticket.department || "",
      contact: ticket.contact || "",
      category: ticket.category || "Hardware",
      priority: ticket.priority || "Medium",
      subject: ticket.subject || "",
      description: ticket.description || "",
      assignedTo: ticket.assignedTo || "",
      status: ticket.status || "Open",
      assetTag: ticket.assetTag || "",
      location: ticket.location || "",
      openedDate: ticket.openedDate?.slice?.(0, 10) || "",
      dueDate: ticket.dueDate?.slice?.(0, 10) || "",
      resolvedDate: ticket.resolvedDate?.slice?.(0, 10) || "",
      resolution: ticket.resolution || "",
      notes: ticket.notes || "",
    });

    setShowForm(true);
  };

  const openDetails = (ticket) => {
    setSelectedTicket(ticket);
    setShowDetails(true);
  };

  const closeModals = () => {
    if (saving) return;

    setShowForm(false);
    setShowDetails(false);
    setEditingTicket(null);
    setSelectedTicket(null);
  };

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const saveTicket = async (event) => {
    event.preventDefault();

    if (!form.requesterName.trim()) {
      setError("Requester name is required.");
      return;
    }

    if (!form.subject.trim()) {
      setError("Issue subject is required.");
      return;
    }

    setSaving(true);
    setError("");

    const payload = {
      ticketNumber: form.ticketNumber,
      requesterName: form.requesterName,
      requesterId: form.requesterId,
      department: form.department,
      contact: form.contact,
      category: form.category,
      priority: form.priority,
      subject: form.subject,
      description: form.description,
      assignedTo: form.assignedTo,
      status: form.status,
      assetTag: form.assetTag,
      location: form.location,
      openedDate: form.openedDate,
      dueDate: form.dueDate,
      resolvedDate: form.resolvedDate,
      resolution: form.resolution,
      notes: form.notes,
    };

    try {
      if (editingTicket) {
        let response;

        try {
          response = await request(
            `/technical-support/${editingTicket.id}`,
            {
              method: "PUT",
              body: JSON.stringify(payload),
            }
          );
        } catch {
          try {
            response = await request(
              `/technicalSupport/${editingTicket.id}`,
              {
                method: "PUT",
                body: JSON.stringify(payload),
              }
            );
          } catch {
            response = await request(
              `/support-tickets/${editingTicket.id}`,
              {
                method: "PUT",
                body: JSON.stringify(payload),
              }
            );
          }
        }

        const updated = normalizeTicket(
          response?.data || response || payload,
          0
        );

        setTickets((current) =>
          current.map((item) =>
            item.id === editingTicket.id
              ? {
                  ...item,
                  ...updated,
                  id: editingTicket.id,
                }
              : item
          )
        );
      } else {
        let response;

        try {
          response = await request("/technical-support", {
            method: "POST",
            body: JSON.stringify(payload),
          });
        } catch {
          try {
            response = await request("/technicalSupport", {
              method: "POST",
              body: JSON.stringify(payload),
            });
          } catch {
            response = await request("/support-tickets", {
              method: "POST",
              body: JSON.stringify(payload),
            });
          }
        }

        const created = normalizeTicket(
          response?.data || response || payload,
          tickets.length
        );

        setTickets((current) => [created, ...current]);
      }

      setForm(initialForm);
      setEditingTicket(null);
      setShowForm(false);
    } catch (err) {
      setError(
        err.message || "Unable to save technical support ticket."
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteTicket = async (ticket) => {
    const confirmed = window.confirm(
      `Delete support ticket ${ticket.ticketNumber}?`
    );

    if (!confirmed) return;

    setError("");

    try {
      try {
        await request(`/technical-support/${ticket.id}`, {
          method: "DELETE",
        });
      } catch {
        try {
          await request(`/technicalSupport/${ticket.id}`, {
            method: "DELETE",
          });
        } catch {
          await request(`/support-tickets/${ticket.id}`, {
            method: "DELETE",
          });
        }
      }

      setTickets((current) =>
        current.filter((item) => item.id !== ticket.id)
      );

      if (selectedTicket?.id === ticket.id) {
        setSelectedTicket(null);
        setShowDetails(false);
      }
    } catch (err) {
      setError(
        err.message || "Unable to delete support ticket."
      );
    }
  };

  const exportCSV = () => {
    if (!filteredTickets.length) return;

    const headers = [
      "Ticket Number",
      "Requester",
      "Requester ID",
      "Department",
      "Contact",
      "Category",
      "Priority",
      "Subject",
      "Assigned To",
      "Status",
      "Asset Tag",
      "Location",
      "Opened Date",
      "Due Date",
      "Resolved Date",
      "Resolution",
    ];

    const rows = filteredTickets.map((ticket) => [
      ticket.ticketNumber,
      ticket.requesterName,
      ticket.requesterId,
      ticket.department,
      ticket.contact,
      ticket.category,
      ticket.priority,
      ticket.subject,
      ticket.assignedTo,
      ticket.status,
      ticket.assetTag,
      ticket.location,
      ticket.openedDate,
      ticket.dueDate,
      ticket.resolvedDate,
      ticket.resolution,
    ]);

    const escapeCSV = (value) => {
      const text = String(value ?? "");

      if (
        text.includes(",") ||
        text.includes('"') ||
        text.includes("\n")
      ) {
        return `"${text.replace(/"/g, '""')}"`;
      }

      return text;
    };

    const csv = [headers, ...rows]
      .map((row) => row.map(escapeCSV).join(","))
      .join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `technical-support-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 ict-module-theme ict-theme-support">
      <div className="mx-auto max-w-[1600px] space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between ict-page-header">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
              <Headphones size={16} />
              <span>ICT Operations</span>
              <span>/</span>
              <span className="text-slate-700">
                Technical Support
              </span>
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl ict-page-title">
              Technical Support
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Manage ICT support requests, incidents, technicians,
              priorities, and service resolution.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={loadTickets}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw
                size={17}
                className={loading ? "animate-spin" : ""}
              />
              Refresh
            </button>

            <button
              type="button"
              onClick={exportCSV}
              disabled={!filteredTickets.length}
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
              New Ticket
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
                <p className="font-semibold">Operation failed</p>
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
            title="Total Tickets"
            value={statistics.total}
            icon={Headphones}
            iconClass="bg-blue-50 text-blue-600"
          />

          <SummaryCard
            title="Open / Active"
            value={statistics.open}
            icon={CircleDot}
            iconClass="bg-indigo-50 text-indigo-600"
          />

          <SummaryCard
            title="Pending"
            value={statistics.pending}
            icon={Clock3}
            iconClass="bg-amber-50 text-amber-600"
          />

          <SummaryCard
            title="Resolved"
            value={statistics.resolved}
            icon={CheckCircle2}
            iconClass="bg-emerald-50 text-emerald-600"
          />

          <SummaryCard
            title="Critical"
            value={statistics.critical}
            icon={AlertTriangle}
            iconClass="bg-red-50 text-red-600"
          />
        </div>

        {/* Main Table */}
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
                  placeholder="Search ticket, requester, issue..."
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
                      setStatusFilter(event.target.value)
                    }
                    className="h-10 min-w-[155px] appearance-none rounded-lg border border-slate-200 bg-white pl-9 pr-8 text-sm font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="All">All Statuses</option>

                    {STATUS_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <select
                  value={priorityFilter}
                  onChange={(event) =>
                    setPriorityFilter(event.target.value)
                  }
                  className="h-10 min-w-[145px] rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="All">All Priorities</option>

                  {PRIORITY_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>

                <select
                  value={categoryFilter}
                  onChange={(event) =>
                    setCategoryFilter(event.target.value)
                  }
                  className="h-10 min-w-[150px] rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="All">All Categories</option>

                  {CATEGORY_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1400px] text-left">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200">
                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Ticket
                  </th>

                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Requester
                  </th>

                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Issue
                  </th>

                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Category
                  </th>

                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Priority
                  </th>

                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Assigned To
                  </th>

                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Opened
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
                  Array.from({ length: 7 }).map((_, rowIndex) => (
                    <tr key={rowIndex}>
                      {Array.from({ length: 9 }).map(
                        (__, cellIndex) => (
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
                ) : paginatedTickets.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-6 py-16 text-center"
                    >
                      <div className="mx-auto flex max-w-sm flex-col items-center">
                        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                          <Headphones size={27} />
                        </div>

                        <h3 className="text-base font-semibold text-slate-900">
                          No support tickets found
                        </h3>

                        <p className="mt-1 text-sm text-slate-500">
                          Change your filters or create a new
                          support ticket.
                        </p>

                        <button
                          type="button"
                          onClick={openCreate}
                          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                        >
                          <Plus size={16} />
                          New Ticket
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedTickets.map((ticket) => (
                    <tr
                      key={ticket.id}
                      className="group transition hover:bg-slate-50/80"
                    >
                      <td className="px-5 py-4">
                        <button
                          type="button"
                          onClick={() => openDetails(ticket)}
                          className="font-semibold text-blue-600 hover:text-blue-700"
                        >
                          {ticket.ticketNumber}
                        </button>

                        <div className="mt-1 text-xs text-slate-400">
                          {ticket.assetTag
                            ? `Asset: ${ticket.assetTag}`
                            : "No asset linked"}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                            <User size={15} />
                          </div>

                          <div>
                            <div className="text-sm font-medium text-slate-800">
                              {ticket.requesterName || "—"}
                            </div>

                            <div className="mt-0.5 text-xs text-slate-400">
                              {ticket.department || "No department"}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="max-w-[280px] px-5 py-4">
                        <div className="truncate text-sm font-semibold text-slate-800">
                          {ticket.subject || "Untitled issue"}
                        </div>

                        <div className="mt-1 truncate text-xs text-slate-400">
                          {ticket.description ||
                            "No description provided"}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="inline-flex items-center gap-2 text-sm text-slate-700">
                          <Tag
                            size={15}
                            className="text-slate-400"
                          />
                          {ticket.category}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getPriorityClasses(
                            ticket.priority
                          )}`}
                        >
                          {ticket.priority}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2 text-sm text-slate-700">
                          <Wrench
                            size={15}
                            className="text-slate-400"
                          />
                          {ticket.assignedTo || "Unassigned"}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2 text-sm text-slate-700">
                          <CalendarDays
                            size={15}
                            className="text-slate-400"
                          />
                          {formatDate(ticket.openedDate)}
                        </div>

                        {getDaysOpen(ticket) !== null && (
                          <div className="mt-1 text-xs text-slate-400">
                            {getDaysOpen(ticket)} day
                            {getDaysOpen(ticket) === 1
                              ? ""
                              : "s"} open
                          </div>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusClasses(
                            ticket.status
                          )}`}
                        >
                          {ticket.status}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            title="View ticket"
                            onClick={() =>
                              openDetails(ticket)
                            }
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                          >
                            <Eye size={16} />
                          </button>

                          <button
                            type="button"
                            title="Edit ticket"
                            onClick={() =>
                              openEdit(ticket)
                            }
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                          >
                            <Pencil size={16} />
                          </button>

                          <button
                            type="button"
                            title="Delete ticket"
                            onClick={() =>
                              deleteTicket(ticket)
                            }
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-red-500 hover:bg-red-50 hover:text-red-700"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!loading && filteredTickets.length > 0 && (
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
                    filteredTickets.length
                  )}
                </span>{" "}
                of{" "}
                <span className="font-medium text-slate-700">
                  {filteredTickets.length}
                </span>{" "}
                tickets
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page === 1}
                  onClick={() =>
                    setPage((current) => current - 1)
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
                    setPage((current) => current + 1)
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
            editingTicket
              ? "Edit Support Ticket"
              : "Create Support Ticket"
          }
          icon={editingTicket ? Pencil : Plus}
          onClose={closeModals}
          large
        >
          <form onSubmit={saveTicket}>
            <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <FormField
                  label="Ticket Number"
                  name="ticketNumber"
                  value={form.ticketNumber}
                  onChange={handleChange}
                  placeholder="TKT-00001"
                />

                <FormField
                  label="Requester Name"
                  name="requesterName"
                  value={form.requesterName}
                  onChange={handleChange}
                  placeholder="Full name"
                  required
                />

                <FormField
                  label="Requester ID"
                  name="requesterId"
                  value={form.requesterId}
                  onChange={handleChange}
                  placeholder="Employee / Student ID"
                />

                <FormField
                  label="Contact"
                  name="contact"
                  value={form.contact}
                  onChange={handleChange}
                  placeholder="Phone or email"
                />

                <FormField
                  label="Department"
                  name="department"
                  value={form.department}
                  onChange={handleChange}
                  placeholder="Department / College"
                />

                <FormField
                  label="Location"
                  name="location"
                  value={form.location}
                  onChange={handleChange}
                  placeholder="Building / Office"
                />

                <SelectField
                  label="Category"
                  name="category"
                  value={form.category}
                  onChange={handleChange}
                  options={CATEGORY_OPTIONS}
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

                <FormField
                  label="Assigned Technician"
                  name="assignedTo"
                  value={form.assignedTo}
                  onChange={handleChange}
                  placeholder="Technician name"
                />

                <FormField
                  label="Asset Tag"
                  name="assetTag"
                  value={form.assetTag}
                  onChange={handleChange}
                  placeholder="ICT-00001"
                />

                <FormField
                  label="Opened Date"
                  name="openedDate"
                  type="date"
                  value={form.openedDate}
                  onChange={handleChange}
                />

                <FormField
                  label="Due Date"
                  name="dueDate"
                  type="date"
                  value={form.dueDate}
                  onChange={handleChange}
                />

                <FormField
                  label="Resolved Date"
                  name="resolvedDate"
                  type="date"
                  value={form.resolvedDate}
                  onChange={handleChange}
                />

                <div className="md:col-span-2">
                  <FormField
                    label="Issue Subject"
                    name="subject"
                    value={form.subject}
                    onChange={handleChange}
                    placeholder="Briefly describe the issue"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Description
                  </label>

                  <textarea
                    name="description"
                    value={form.description}
                    onChange={handleChange}
                    rows={4}
                    placeholder="Describe the technical problem, symptoms, and relevant details..."
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Resolution
                  </label>

                  <textarea
                    name="resolution"
                    value={form.resolution}
                    onChange={handleChange}
                    rows={3}
                    placeholder="Describe the solution or action taken..."
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
                    onChange={handleChange}
                    rows={3}
                    placeholder="Internal support notes..."
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
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

                {editingTicket
                  ? "Save Changes"
                  : "Create Ticket"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Details Modal */}
      {showDetails && selectedTicket && (
        <Modal
          title="Support Ticket Details"
          icon={Headphones}
          onClose={closeModals}
          large
        >
          <div className="max-h-[78vh] overflow-y-auto">
            <div className="border-b border-slate-200 bg-slate-50 px-6 py-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    {selectedTicket.ticketNumber}
                  </div>

                  <h2 className="mt-1 text-xl font-bold text-slate-900">
                    {selectedTicket.subject}
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    {selectedTicket.category} •{" "}
                    {selectedTicket.priority} priority
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span
                    className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-semibold ${getPriorityClasses(
                      selectedTicket.priority
                    )}`}
                  >
                    {selectedTicket.priority}
                  </span>

                  <span
                    className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-semibold ${getStatusClasses(
                      selectedTicket.status
                    )}`}
                  >
                    {selectedTicket.status}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-6 px-6 py-6">
              {/* Requester */}
              <section>
                <h3 className="mb-3 text-sm font-semibold text-slate-900">
                  Requester Information
                </h3>

                <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 p-4 md:grid-cols-4">
                  <DetailItem
                    label="Requester"
                    value={selectedTicket.requesterName}
                    icon={User}
                  />

                  <DetailItem
                    label="Requester ID"
                    value={selectedTicket.requesterId}
                  />

                  <DetailItem
                    label="Department"
                    value={selectedTicket.department}
                    icon={Building2}
                  />

                  <DetailItem
                    label="Contact"
                    value={selectedTicket.contact}
                  />
                </div>
              </section>

              {/* Issue */}
              <section>
                <h3 className="mb-3 text-sm font-semibold text-slate-900">
                  Issue Information
                </h3>

                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                    <DetailItem
                      label="Category"
                      value={selectedTicket.category}
                      icon={Tag}
                    />

                    <DetailItem
                      label="Priority"
                      value={selectedTicket.priority}
                    />

                    <DetailItem
                      label="Asset Tag"
                      value={selectedTicket.assetTag}
                      icon={Monitor}
                    />

                    <DetailItem
                      label="Location"
                      value={selectedTicket.location}
                    />
                  </div>

                  <div className="mt-5 border-t border-slate-100 pt-5">
                    <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      <MessageSquare size={14} />
                      Description
                    </div>

                    <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                      {selectedTicket.description ||
                        "No description provided."}
                    </p>
                  </div>
                </div>
              </section>

              {/* Assignment */}
              <section>
                <h3 className="mb-3 text-sm font-semibold text-slate-900">
                  Support Assignment
                </h3>

                <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 p-4 md:grid-cols-3">
                  <DetailItem
                    label="Assigned Technician"
                    value={
                      selectedTicket.assignedTo ||
                      "Unassigned"
                    }
                    icon={Wrench}
                  />

                  <DetailItem
                    label="Opened Date"
                    value={formatDate(
                      selectedTicket.openedDate
                    )}
                    icon={CalendarDays}
                  />

                  <DetailItem
                    label="Due Date"
                    value={formatDate(
                      selectedTicket.dueDate
                    )}
                    icon={CalendarDays}
                  />
                </div>
              </section>

              {/* Resolution */}
              <section>
                <h3 className="mb-3 text-sm font-semibold text-slate-900">
                  Resolution
                </h3>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    <CheckCircle2 size={14} />
                    Resolution Details
                  </div>

                  <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                    {selectedTicket.resolution ||
                      "No resolution has been recorded yet."}
                  </p>

                  {selectedTicket.resolvedDate && (
                    <div className="mt-4 border-t border-slate-200 pt-4 text-sm text-slate-500">
                      Resolved on{" "}
                      <span className="font-semibold text-slate-700">
                        {formatDate(
                          selectedTicket.resolvedDate
                        )}
                      </span>
                    </div>
                  )}
                </div>
              </section>

              {/* Notes */}
              {selectedTicket.notes && (
                <section>
                  <h3 className="mb-3 text-sm font-semibold text-slate-900">
                    Internal Notes
                  </h3>

                  <div className="rounded-xl border border-slate-200 p-4 text-sm leading-6 text-slate-700">
                    {selectedTicket.notes}
                  </div>
                </section>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
              <button
                type="button"
                onClick={() => {
                  setShowDetails(false);
                  openEdit(selectedTicket);
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <Pencil size={16} />
                Edit Ticket
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