import React, { useEffect, useMemo, useState } from "react";
import {
  Search,
  Plus,
  Eye,
  Pencil,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock3,
  AlertTriangle,
  PackageCheck,
  Download,
  RefreshCw,
  X,
  FileText,
  User,
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Filter,
  ClipboardList,
  CircleDot,
} from "lucide-react";

const API_BASE_URL =
  process.env.REACT_APP_API_URL || "/api";

const PAGE_SIZE = 10;

const STATUS_OPTIONS = [
  "Pending",
  "Approved",
  "Rejected",
  "Fulfilled",
  "Cancelled",
];

const PRIORITY_OPTIONS = ["Low", "Medium", "High", "Urgent"];

const initialForm = {
  requestId: "",
  assetName: "",
  assetCategory: "",
  requesterName: "",
  employeeId: "",
  department: "",
  requestedDate: new Date().toISOString().slice(0, 10),
  neededDate: "",
  priority: "Medium",
  status: "Pending",
  purpose: "",
  notes: "",
};

function getArrayFromResponse(data) {
  if (Array.isArray(data)) return data;

  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.requests)) return data.requests;
  if (Array.isArray(data?.assetRequests)) return data.assetRequests;
  if (Array.isArray(data?.results)) return data.results;

  return [];
}

function normalizeRequest(item, index) {
  return {
    id:
      item.id ??
      item._id ??
      item.requestId ??
      item.request_id ??
      `REQ-${String(index + 1).padStart(4, "0")}`,

    requestId:
      item.requestId ??
      item.request_id ??
      item.code ??
      `REQ-${String(index + 1).padStart(4, "0")}`,

    assetName:
      item.assetName ??
      item.asset_name ??
      item.asset?.name ??
      item.itemName ??
      item.item_name ??
      "",

    assetCategory:
      item.assetCategory ??
      item.asset_category ??
      item.category ??
      item.asset?.category ??
      "",

    requesterName:
      item.requesterName ??
      item.requester_name ??
      item.requester?.name ??
      item.userName ??
      item.user?.name ??
      "",

    employeeId:
      item.employeeId ??
      item.employee_id ??
      item.requester?.employeeId ??
      item.user?.employeeId ??
      "",

    department:
      item.department ??
      item.departmentName ??
      item.department_name ??
      item.requester?.department ??
      "",

    requestedDate:
      item.requestedDate ??
      item.requested_date ??
      item.createdAt ??
      item.created_at ??
      "",

    neededDate: item.neededDate ?? item.needed_date ?? "",

    priority: item.priority ?? "Medium",

    status: item.status ?? "Pending",

    purpose: item.purpose ?? item.reason ?? "",

    notes: item.notes ?? item.description ?? "",

    createdAt: item.createdAt ?? item.created_at ?? "",
    updatedAt: item.updatedAt ?? item.updated_at ?? "",

    raw: item,
  };
}

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
      const errorData = await response.json();
      message =
        errorData?.message ||
        errorData?.error ||
        errorData?.detail ||
        message;
    } catch {
      // Ignore invalid error JSON.
    }

    throw new Error(message);
  }

  if (response.status === 204) return null;

  return response.json();
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

function statusClasses(status) {
  switch (String(status).toLowerCase()) {
    case "approved":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";

    case "rejected":
      return "bg-red-50 text-red-700 border-red-200";

    case "fulfilled":
      return "bg-blue-50 text-blue-700 border-blue-200";

    case "cancelled":
      return "bg-slate-100 text-slate-600 border-slate-200";

    case "pending":
    default:
      return "bg-amber-50 text-amber-700 border-amber-200";
  }
}

function priorityClasses(priority) {
  switch (String(priority).toLowerCase()) {
    case "urgent":
      return "bg-red-50 text-red-700 border-red-200";

    case "high":
      return "bg-orange-50 text-orange-700 border-orange-200";

    case "low":
      return "bg-slate-100 text-slate-600 border-slate-200";

    case "medium":
    default:
      return "bg-blue-50 text-blue-700 border-blue-200";
  }
}

function StatusIcon({ status }) {
  switch (String(status).toLowerCase()) {
    case "approved":
      return <CheckCircle2 size={14} />;

    case "rejected":
      return <XCircle size={14} />;

    case "fulfilled":
      return <PackageCheck size={14} />;

    case "cancelled":
      return <XCircle size={14} />;

    case "pending":
    default:
      return <Clock3 size={14} />;
  }
}

export default function AssetRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");

  const [page, setPage] = useState(1);

  const [showForm, setShowForm] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const [editingRequest, setEditingRequest] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);

  const [form, setForm] = useState(initialForm);

  const loadRequests = async () => {
    setLoading(true);
    setError("");

    try {
      let data;

      try {
        data = await request("/asset-requests");
      } catch {
        data = await request("/requests");
      }

      const normalized = getArrayFromResponse(data).map(normalizeRequest);

      setRequests(normalized);
    } catch (err) {
      setError(err.message || "Unable to load asset requests.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, priorityFilter]);

  const statistics = useMemo(() => {
    const total = requests.length;

    const pending = requests.filter(
      (item) => String(item.status).toLowerCase() === "pending"
    ).length;

    const approved = requests.filter(
      (item) => String(item.status).toLowerCase() === "approved"
    ).length;

    const urgent = requests.filter(
      (item) => String(item.priority).toLowerCase() === "urgent"
    ).length;

    const fulfilled = requests.filter(
      (item) => String(item.status).toLowerCase() === "fulfilled"
    ).length;

    return {
      total,
      pending,
      approved,
      urgent,
      fulfilled,
    };
  }, [requests]);

  const filteredRequests = useMemo(() => {
    const query = search.trim().toLowerCase();

    return requests.filter((item) => {
      const matchesSearch =
        !query ||
        [
          item.requestId,
          item.assetName,
          item.assetCategory,
          item.requesterName,
          item.employeeId,
          item.department,
          item.purpose,
        ].some((value) =>
          String(value || "")
            .toLowerCase()
            .includes(query)
        );

      const matchesStatus =
        statusFilter === "All" ||
        String(item.status).toLowerCase() === statusFilter.toLowerCase();

      const matchesPriority =
        priorityFilter === "All" ||
        String(item.priority).toLowerCase() === priorityFilter.toLowerCase();

      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [requests, search, statusFilter, priorityFilter]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredRequests.length / PAGE_SIZE)
  );

  const paginatedRequests = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;

    return filteredRequests.slice(start, start + PAGE_SIZE);
  }, [filteredRequests, page]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const openCreateModal = () => {
    setEditingRequest(null);
    setForm({
      ...initialForm,
      requestId: `REQ-${Date.now().toString().slice(-6)}`,
    });
    setShowForm(true);
  };

  const openEditModal = (item) => {
    setEditingRequest(item);

    setForm({
      requestId: item.requestId || "",
      assetName: item.assetName || "",
      assetCategory: item.assetCategory || "",
      requesterName: item.requesterName || "",
      employeeId: item.employeeId || "",
      department: item.department || "",
      requestedDate:
        item.requestedDate?.slice?.(0, 10) ||
        new Date().toISOString().slice(0, 10),
      neededDate: item.neededDate?.slice?.(0, 10) || "",
      priority: item.priority || "Medium",
      status: item.status || "Pending",
      purpose: item.purpose || "",
      notes: item.notes || "",
    });

    setShowForm(true);
  };

  const openDetailsModal = (item) => {
    setSelectedRequest(item);
    setShowDetails(true);
  };

  const closeModals = () => {
    if (!saving) {
      setShowForm(false);
      setShowDetails(false);
      setEditingRequest(null);
      setSelectedRequest(null);
    }
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const saveRequest = async (event) => {
    event.preventDefault();

    if (!form.assetName.trim()) {
      setError("Asset name is required.");
      return;
    }

    if (!form.requesterName.trim()) {
      setError("Requester name is required.");
      return;
    }

    setSaving(true);
    setError("");

    const payload = {
      requestId: form.requestId,
      assetName: form.assetName,
      assetCategory: form.assetCategory,
      requesterName: form.requesterName,
      employeeId: form.employeeId,
      department: form.department,
      requestedDate: form.requestedDate,
      neededDate: form.neededDate,
      priority: form.priority,
      status: form.status,
      purpose: form.purpose,
      notes: form.notes,
    };

    try {
      if (editingRequest) {
        let updated;

        try {
          updated = await request(`/asset-requests/${editingRequest.id}`, {
            method: "PUT",
            body: JSON.stringify(payload),
          });
        } catch {
          updated = await request(`/requests/${editingRequest.id}`, {
            method: "PUT",
            body: JSON.stringify(payload),
          });
        }

        const normalized = normalizeRequest(
          updated?.data || updated || payload,
          0
        );

        setRequests((current) =>
          current.map((item) =>
            String(item.id) === String(editingRequest.id)
              ? {
                  ...item,
                  ...normalized,
                  id: editingRequest.id,
                }
              : item
          )
        );
      } else {
        let created;

        try {
          created = await request("/asset-requests", {
            method: "POST",
            body: JSON.stringify(payload),
          });
        } catch {
          created = await request("/requests", {
            method: "POST",
            body: JSON.stringify(payload),
          });
        }

        const normalized = normalizeRequest(
          created?.data || created || payload,
          requests.length
        );

        setRequests((current) => [normalized, ...current]);
      }

      setShowForm(false);
      setEditingRequest(null);
      setForm(initialForm);
    } catch (err) {
      setError(err.message || "Unable to save asset request.");
    } finally {
      setSaving(false);
    }
  };

  const deleteRequest = async (item) => {
    const confirmed = window.confirm(
      `Delete asset request ${item.requestId}? This action cannot be undone.`
    );

    if (!confirmed) return;

    setError("");

    try {
      try {
        await request(`/asset-requests/${item.id}`, {
          method: "DELETE",
        });
      } catch {
        await request(`/requests/${item.id}`, {
          method: "DELETE",
        });
      }

      setRequests((current) =>
        current.filter((requestItem) => requestItem.id !== item.id)
      );

      if (selectedRequest?.id === item.id) {
        setShowDetails(false);
        setSelectedRequest(null);
      }
    } catch (err) {
      setError(err.message || "Unable to delete asset request.");
    }
  };

  const updateStatus = async (item, newStatus) => {
    setError("");

    try {
      const payload = {
        ...item.raw,
        status: newStatus,
      };

      let updated;

      try {
        updated = await request(`/asset-requests/${item.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } catch {
        updated = await request(`/requests/${item.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      }

      const normalized = normalizeRequest(
        updated?.data || updated || {
          ...item.raw,
          ...item,
          status: newStatus,
        },
        0
      );

      setRequests((current) =>
        current.map((requestItem) =>
          requestItem.id === item.id
            ? {
                ...requestItem,
                ...normalized,
                status: newStatus,
              }
            : requestItem
        )
      );

      if (selectedRequest?.id === item.id) {
        setSelectedRequest((current) => ({
          ...current,
          ...normalized,
          status: newStatus,
        }));
      }
    } catch (err) {
      setError(err.message || `Unable to change status to ${newStatus}.`);
    }
  };

  const exportCSV = () => {
    if (!filteredRequests.length) return;

    const headers = [
      "Request ID",
      "Asset Name",
      "Category",
      "Requester",
      "Employee ID",
      "Department",
      "Requested Date",
      "Needed Date",
      "Priority",
      "Status",
      "Purpose",
      "Notes",
    ];

    const rows = filteredRequests.map((item) => [
      item.requestId,
      item.assetName,
      item.assetCategory,
      item.requesterName,
      item.employeeId,
      item.department,
      item.requestedDate,
      item.neededDate,
      item.priority,
      item.status,
      item.purpose,
      item.notes,
    ]);

    const escapeCSV = (value) => {
      const stringValue = String(value ?? "");

      if (
        stringValue.includes(",") ||
        stringValue.includes('"') ||
        stringValue.includes("\n")
      ) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }

      return stringValue;
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
    link.download = `asset-requests-${new Date()
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
              <ClipboardList size={16} />
              <span>ICT Asset Management</span>
              <span>/</span>
              <span className="text-slate-700">Asset Requests</span>
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
              Asset Requests
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Manage equipment requests, approvals, priorities, and fulfillment
              across departments.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={loadRequests}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
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
              disabled={!filteredRequests.length}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download size={17} />
              Export
            </button>

            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              <Plus size={18} />
              New Request
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <div className="flex items-start gap-3">
              <AlertTriangle size={18} className="mt-0.5 shrink-0" />

              <div>
                <p className="font-semibold">Unable to complete operation</p>
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

        {/* Summary cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <SummaryCard
            title="Total Requests"
            value={statistics.total}
            icon={ClipboardList}
            iconClass="bg-blue-50 text-blue-600"
          />

          <SummaryCard
            title="Pending"
            value={statistics.pending}
            icon={Clock3}
            iconClass="bg-amber-50 text-amber-600"
          />

          <SummaryCard
            title="Approved"
            value={statistics.approved}
            icon={CheckCircle2}
            iconClass="bg-emerald-50 text-emerald-600"
          />

          <SummaryCard
            title="Urgent"
            value={statistics.urgent}
            icon={AlertTriangle}
            iconClass="bg-red-50 text-red-600"
          />

          <SummaryCard
            title="Fulfilled"
            value={statistics.fulfilled}
            icon={PackageCheck}
            iconClass="bg-indigo-50 text-indigo-600"
          />
        </div>

        {/* Main content */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {/* Toolbar */}
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
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search request, asset, requester..."
                  className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
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
                    className="h-10 w-full min-w-[160px] appearance-none rounded-lg border border-slate-200 bg-white pl-9 pr-9 text-sm font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="All">All Statuses</option>

                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>

                <select
                  value={priorityFilter}
                  onChange={(event) =>
                    setPriorityFilter(event.target.value)
                  }
                  className="h-10 min-w-[150px] rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="All">All Priorities</option>

                  {PRIORITY_OPTIONS.map((priority) => (
                    <option key={priority} value={priority}>
                      {priority}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] text-left">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200">
                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Request
                  </th>

                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Asset
                  </th>

                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Requester
                  </th>

                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Department
                  </th>

                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Needed
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
                  <LoadingRows />
                ) : paginatedRequests.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-16 text-center">
                      <div className="mx-auto flex max-w-sm flex-col items-center">
                        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                          <ClipboardList size={26} />
                        </div>

                        <h3 className="text-base font-semibold text-slate-900">
                          No asset requests found
                        </h3>

                        <p className="mt-1 text-sm text-slate-500">
                          Try changing your filters or create a new asset
                          request.
                        </p>

                        <button
                          type="button"
                          onClick={openCreateModal}
                          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                        >
                          <Plus size={16} />
                          New Request
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedRequests.map((item) => (
                    <tr
                      key={item.id}
                      className="group transition hover:bg-slate-50/80"
                    >
                      <td className="px-5 py-4">
                        <button
                          type="button"
                          onClick={() => openDetailsModal(item)}
                          className="text-left"
                        >
                          <div className="font-semibold text-blue-600 hover:text-blue-700">
                            {item.requestId || "—"}
                          </div>

                          <div className="mt-1 text-xs text-slate-500">
                            Requested {formatDate(item.requestedDate)}
                          </div>
                        </button>
                      </td>

                      <td className="px-5 py-4">
                        <div className="font-medium text-slate-900">
                          {item.assetName || "—"}
                        </div>

                        <div className="mt-1 text-xs text-slate-500">
                          {item.assetCategory || "Uncategorized"}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                            <User size={15} />
                          </div>

                          <div>
                            <div className="font-medium text-slate-800">
                              {item.requesterName || "—"}
                            </div>

                            <div className="text-xs text-slate-500">
                              {item.employeeId || "No employee ID"}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2 text-sm text-slate-700">
                          <Building2
                            size={15}
                            className="text-slate-400"
                          />
                          {item.department || "—"}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2 text-sm text-slate-700">
                          <CalendarDays
                            size={15}
                            className="text-slate-400"
                          />
                          {formatDate(item.neededDate)}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${priorityClasses(
                            item.priority
                          )}`}
                        >
                          {String(item.priority).toLowerCase() ===
                            "urgent" && <AlertTriangle size={13} />}

                          {item.priority}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClasses(
                            item.status
                          )}`}
                        >
                          <StatusIcon status={item.status} />
                          {item.status}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-1">
                          <ActionButton
                            title="View request"
                            onClick={() => openDetailsModal(item)}
                          >
                            <Eye size={16} />
                          </ActionButton>

                          <ActionButton
                            title="Edit request"
                            onClick={() => openEditModal(item)}
                          >
                            <Pencil size={16} />
                          </ActionButton>

                          {String(item.status).toLowerCase() ===
                            "pending" && (
                            <>
                              <ActionButton
                                title="Approve request"
                                onClick={() =>
                                  updateStatus(item, "Approved")
                                }
                                className="text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                              >
                                <CheckCircle2 size={16} />
                              </ActionButton>

                              <ActionButton
                                title="Reject request"
                                onClick={() =>
                                  updateStatus(item, "Rejected")
                                }
                                className="text-red-600 hover:bg-red-50 hover:text-red-700"
                              >
                                <XCircle size={16} />
                              </ActionButton>
                            </>
                          )}

                          <ActionButton
                            title="Delete request"
                            onClick={() => deleteRequest(item)}
                            className="text-red-500 hover:bg-red-50 hover:text-red-700"
                          >
                            <Trash2 size={16} />
                          </ActionButton>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!loading && filteredRequests.length > 0 && (
            <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-500">
                Showing{" "}
                <span className="font-medium text-slate-700">
                  {(page - 1) * PAGE_SIZE + 1}
                </span>{" "}
                to{" "}
                <span className="font-medium text-slate-700">
                  {Math.min(page * PAGE_SIZE, filteredRequests.length)}
                </span>{" "}
                of{" "}
                <span className="font-medium text-slate-700">
                  {filteredRequests.length}
                </span>{" "}
                requests
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page === 1}
                  onClick={() => setPage((current) => current - 1)}
                  className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
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
                  onClick={() => setPage((current) => current + 1)}
                  className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
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
          title={editingRequest ? "Edit Asset Request" : "New Asset Request"}
          icon={editingRequest ? Pencil : Plus}
          onClose={closeModals}
          size="large"
        >
          <form onSubmit={saveRequest}>
            <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <FormField
                  label="Request ID"
                  name="requestId"
                  value={form.requestId}
                  onChange={handleFormChange}
                  placeholder="REQ-0001"
                  required
                />

                <FormField
                  label="Asset Name"
                  name="assetName"
                  value={form.assetName}
                  onChange={handleFormChange}
                  placeholder="e.g. Dell Latitude 5440"
                  required
                />

                <FormField
                  label="Asset Category"
                  name="assetCategory"
                  value={form.assetCategory}
                  onChange={handleFormChange}
                  placeholder="e.g. Laptop, Monitor, Printer"
                />

                <FormField
                  label="Requester Name"
                  name="requesterName"
                  value={form.requesterName}
                  onChange={handleFormChange}
                  placeholder="Full name"
                  required
                />

                <FormField
                  label="Employee ID"
                  name="employeeId"
                  value={form.employeeId}
                  onChange={handleFormChange}
                  placeholder="Employee / staff ID"
                />

                <FormField
                  label="Department"
                  name="department"
                  value={form.department}
                  onChange={handleFormChange}
                  placeholder="Department or college"
                />

                <FormField
                  label="Requested Date"
                  name="requestedDate"
                  type="date"
                  value={form.requestedDate}
                  onChange={handleFormChange}
                />

                <FormField
                  label="Needed Date"
                  name="neededDate"
                  type="date"
                  value={form.neededDate}
                  onChange={handleFormChange}
                />

                <SelectField
                  label="Priority"
                  name="priority"
                  value={form.priority}
                  onChange={handleFormChange}
                  options={PRIORITY_OPTIONS}
                />

                <SelectField
                  label="Status"
                  name="status"
                  value={form.status}
                  onChange={handleFormChange}
                  options={STATUS_OPTIONS}
                />

                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Purpose
                  </label>

                  <textarea
                    name="purpose"
                    value={form.purpose}
                    onChange={handleFormChange}
                    rows={3}
                    placeholder="Explain why the asset is required..."
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Notes
                  </label>

                  <textarea
                    name="notes"
                    value={form.notes}
                    onChange={handleFormChange}
                    rows={3}
                    placeholder="Additional information..."
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
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
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving && (
                  <RefreshCw size={16} className="animate-spin" />
                )}

                {editingRequest ? "Save Changes" : "Create Request"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Details Modal */}
      {showDetails && selectedRequest && (
        <Modal
          title="Asset Request Details"
          icon={FileText}
          onClose={closeModals}
          size="large"
        >
          <div className="max-h-[75vh] overflow-y-auto">
            <div className="border-b border-slate-200 bg-slate-50 px-6 py-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Request ID
                  </div>

                  <h2 className="mt-1 text-xl font-bold text-slate-900">
                    {selectedRequest.requestId}
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Created {formatDate(selectedRequest.createdAt)}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${statusClasses(
                      selectedRequest.status
                    )}`}
                  >
                    <StatusIcon status={selectedRequest.status} />
                    {selectedRequest.status}
                  </span>

                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${priorityClasses(
                      selectedRequest.priority
                    )}`}
                  >
                    {selectedRequest.priority}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-6 px-6 py-6">
              <DetailSection title="Asset Information">
                <DetailItem
                  label="Asset Name"
                  value={selectedRequest.assetName}
                />

                <DetailItem
                  label="Category"
                  value={selectedRequest.assetCategory}
                />
              </DetailSection>

              <DetailSection title="Requester Information">
                <DetailItem
                  label="Requester"
                  value={selectedRequest.requesterName}
                />

                <DetailItem
                  label="Employee ID"
                  value={selectedRequest.employeeId}
                />

                <DetailItem
                  label="Department"
                  value={selectedRequest.department}
                />
              </DetailSection>

              <DetailSection title="Request Timeline">
                <DetailItem
                  label="Requested Date"
                  value={formatDate(selectedRequest.requestedDate)}
                />

                <DetailItem
                  label="Needed Date"
                  value={formatDate(selectedRequest.neededDate)}
                />
              </DetailSection>

              <DetailSection title="Request Description">
                <div className="md:col-span-2">
                  <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">
                    Purpose
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                    {selectedRequest.purpose || "No purpose provided."}
                  </div>
                </div>

                <div className="md:col-span-2">
                  <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">
                    Notes
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                    {selectedRequest.notes || "No additional notes."}
                  </div>
                </div>
              </DetailSection>

              {String(selectedRequest.status).toLowerCase() ===
                "pending" && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2 font-semibold text-amber-900">
                        <Clock3 size={17} />
                        Approval Required
                      </div>

                      <p className="mt-1 text-sm text-amber-800">
                        This request is waiting for an approval decision.
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          updateStatus(selectedRequest, "Rejected")
                        }
                        className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                      >
                        <XCircle size={16} />
                        Reject
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          updateStatus(selectedRequest, "Approved")
                        }
                        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                      >
                        <CheckCircle2 size={16} />
                        Approve
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
              <button
                type="button"
                onClick={() => {
                  setShowDetails(false);
                  openEditModal(selectedRequest);
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <Pencil size={16} />
                Edit
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

function SummaryCard({ title, value, icon: Icon, iconClass }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>

          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
            {value}
          </p>
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

function ActionButton({
  children,
  title,
  onClick,
  className = "",
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 ${className}`}
    >
      {children}
    </button>
  );
}

function LoadingRows() {
  return (
    <>
      {Array.from({ length: 7 }).map((_, index) => (
        <tr key={index}>
          {Array.from({ length: 8 }).map((__, cellIndex) => (
            <td key={cellIndex} className="px-5 py-5">
              <div className="h-4 animate-pulse rounded bg-slate-100" />
            </td>
          ))}
        </tr>
      ))}
    </>
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
        className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
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

function DetailSection({ title, children }) {
  return (
    <section>
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
        <CircleDot size={15} className="text-blue-600" />
        {title}
      </h3>

      <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 p-4 md:grid-cols-2">
        {children}
      </div>
    </section>
  );
}

function DetailItem({ label, value }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </div>

      <div className="mt-1 text-sm font-medium text-slate-800">
        {value || "—"}
      </div>
    </div>
  );
}

function Modal({
  title,
  icon: Icon,
  children,
  onClose,
  size = "medium",
}) {
  const width =
    size === "large"
      ? "max-w-4xl"
      : size === "small"
      ? "max-w-lg"
      : "max-w-2xl";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <div
        className={`relative flex max-h-[92vh] w-full ${width} flex-col overflow-hidden rounded-2xl bg-white shadow-2xl`}
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
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <X size={19} />
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}