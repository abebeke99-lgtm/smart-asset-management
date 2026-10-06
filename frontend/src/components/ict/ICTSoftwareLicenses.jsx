/* eslint-disable no-unused-vars, no-dupe-keys, no-template-curly-in-string */
/* eslint-disable react-hooks/exhaustive-deps */
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
  FileKey2,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Ban,
  Building2,
  CalendarDays,
  User,
  Hash,
  Package,
  ChevronLeft,
  ChevronRight,
  Filter,
  Laptop,
  Users,
  KeyRound,
} from "lucide-react";

const API_BASE_URL =
  process.env.REACT_APP_API_URL || "/api";

const PAGE_SIZE = 10;

const STATUS_OPTIONS = [
  "Active",
  "Expiring Soon",
  "Expired",
  "Suspended",
  "Available",
];

const LICENSE_TYPES = [
  "Per User",
  "Per Device",
  "Volume",
  "Subscription",
  "Perpetual",
  "Site License",
  "Academic",
  "Other",
];

const initialForm = {
  licenseKey: "",
  softwareName: "",
  version: "",
  publisher: "",
  licenseType: "Per User",
  seatsPurchased: "",
  seatsUsed: "",
  department: "",
  assignedTo: "",
  purchaseDate: "",
  startDate: "",
  expiryDate: "",
  renewalDate: "",
  cost: "",
  vendor: "",
  status: "Active",
  notes: "",
};

async function request(url, options = {}) {
  const token = localStorage.getItem("token") || localStorage.getItem("authToken") || sessionStorage.getItem("token") || sessionStorage.getItem("authToken");
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(`${API_BASE_URL}${url}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;

    try {
      const error = await response.json();
      message = error?.message || error?.error || message;
    } catch {
      // Ignore invalid error response.
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
  if (Array.isArray(data?.licenses)) return data.licenses;
  if (Array.isArray(data?.softwareLicenses)) return data.softwareLicenses;
  if (Array.isArray(data?.results)) return data.results;

  return [];
}

function normalizeLicense(item, index) {
  return {
    id:
      item.id ??
      item._id ??
      item.licenseId ??
      `LIC-${String(index + 1).padStart(4, "0")}`,

    licenseKey:
      item.licenseKey ??
      item.license_key ??
      item.key ??
      item.licenseNumber ??
      "",

    softwareName:
      item.softwareName ??
      item.software_name ??
      item.name ??
      item.productName ??
      "",

    version:
      item.version ??
      item.softwareVersion ??
      "",

    publisher:
      item.publisher ??
      item.vendorName ??
      item.manufacturer ??
      "",

    licenseType:
      item.licenseType ??
      item.license_type ??
      item.type ??
      "Per User",

    seatsPurchased:
      item.seatsPurchased ??
      item.seats_purchased ??
      item.totalSeats ??
      item.quantity ??
      0,

    seatsUsed:
      item.seatsUsed ??
      item.seats_used ??
      item.usedSeats ??
      item.assignedSeats ??
      0,

    department:
      item.department ??
      item.departmentName ??
      item.department_name ??
      "",

    assignedTo:
      item.assignedTo ??
      item.assigned_to ??
      item.assignee?.name ??
      item.user?.name ??
      "",

    purchaseDate:
      item.purchaseDate ??
      item.purchase_date ??
      "",

    startDate:
      item.startDate ??
      item.start_date ??
      "",

    expiryDate:
      item.expiryDate ??
      item.expiry_date ??
      item.expirationDate ??
      item.expiration_date ??
      "",

    renewalDate:
      item.renewalDate ??
      item.renewal_date ??
      "",

    cost:
      item.cost ??
      item.price ??
      item.amount ??
      0,

    vendor:
      item.vendor ??
      item.supplier ??
      "",

    status: item.status ?? "Active",

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

function formatCurrency(value) {
  if (value === "" || value === null || value === undefined) {
    return "—";
  }

  const number = Number(value);

  if (Number.isNaN(number)) return String(value);

  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(number);
}

function getDaysUntilExpiry(expiryDate) {
  if (!expiryDate) return null;

  const expiry = new Date(expiryDate);
  const today = new Date();

  expiry.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  return Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
}

function getComputedStatus(item) {
  if (item.status === "Suspended") return "Suspended";
  if (item.status === "Available") return "Available";
  if (item.status === "Expired") return "Expired";

  const days = getDaysUntilExpiry(item.expiryDate);

  if (days !== null && days < 0) return "Expired";
  if (days !== null && days <= 30) return "Expiring Soon";

  return item.status || "Active";
}

function statusClasses(status) {
  switch (String(status).toLowerCase()) {
    case "active":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";

    case "expiring soon":
      return "border-amber-200 bg-amber-50 text-amber-700";

    case "expired":
      return "border-red-200 bg-red-50 text-red-700";

    case "suspended":
      return "border-slate-200 bg-slate-100 text-slate-600";

    case "available":
      return "border-blue-200 bg-blue-50 text-blue-700";

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
          <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
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

export default function SoftwareLicenses() {
  const [licenses, setLicenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");

  const [page, setPage] = useState(1);

  const [showForm, setShowForm] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const [editingLicense, setEditingLicense] = useState(null);
  const [selectedLicense, setSelectedLicense] = useState(null);

  const [form, setForm] = useState(initialForm);

  const loadLicenses = async () => {
    setLoading(true);
    setError("");

    try {
      let data;

      try {
        data = await request("/software-licenses");
      } catch {
        try {
          data = await request("/softwareLicenses");
        } catch {
          data = await request("/licenses");
        }
      }

      setLicenses(getArray(data).map(normalizeLicense));
    } catch (err) {
      setError(
        err.message || "Unable to load software licenses."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLicenses();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, typeFilter]);

  const statistics = useMemo(() => {
    const total = licenses.length;

    const active = licenses.filter(
      (item) => getComputedStatus(item) === "Active"
    ).length;

    const expiring = licenses.filter(
      (item) => getComputedStatus(item) === "Expiring Soon"
    ).length;

    const expired = licenses.filter(
      (item) => getComputedStatus(item) === "Expired"
    ).length;

    const availableSeats = licenses.reduce((sum, item) => {
      const purchased = Number(item.seatsPurchased) || 0;
      const used = Number(item.seatsUsed) || 0;

      return sum + Math.max(0, purchased - used);
    }, 0);

    return {
      total,
      active,
      expiring,
      expired,
      availableSeats,
    };
  }, [licenses]);

  const filteredLicenses = useMemo(() => {
    const query = search.trim().toLowerCase();

    return licenses.filter((item) => {
      const computedStatus = getComputedStatus(item);

      const matchesSearch =
        !query ||
        [
          item.licenseKey,
          item.softwareName,
          item.version,
          item.publisher,
          item.licenseType,
          item.department,
          item.assignedTo,
          item.vendor,
        ].some((value) =>
          String(value || "")
            .toLowerCase()
            .includes(query)
        );

      const matchesStatus =
        statusFilter === "All" ||
        computedStatus.toLowerCase() ===
          statusFilter.toLowerCase();

      const matchesType =
        typeFilter === "All" ||
        String(item.licenseType).toLowerCase() ===
          typeFilter.toLowerCase();

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [licenses, search, statusFilter, typeFilter]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredLicenses.length / PAGE_SIZE)
  );

  const paginatedLicenses = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;

    return filteredLicenses.slice(start, start + PAGE_SIZE);
  }, [filteredLicenses, page]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const openCreate = () => {
    setEditingLicense(null);

    setForm({
      ...initialForm,
      licenseKey: `LIC-${Date.now().toString().slice(-8)}`,
    });

    setShowForm(true);
  };

  const openEdit = (item) => {
    setEditingLicense(item);

    setForm({
      licenseKey: item.licenseKey || "",
      softwareName: item.softwareName || "",
      version: item.version || "",
      publisher: item.publisher || "",
      licenseType: item.licenseType || "Per User",
      seatsPurchased: item.seatsPurchased ?? "",
      seatsUsed: item.seatsUsed ?? "",
      department: item.department || "",
      assignedTo: item.assignedTo || "",
      purchaseDate: item.purchaseDate?.slice?.(0, 10) || "",
      startDate: item.startDate?.slice?.(0, 10) || "",
      expiryDate: item.expiryDate?.slice?.(0, 10) || "",
      renewalDate: item.renewalDate?.slice?.(0, 10) || "",
      cost: item.cost ?? "",
      vendor: item.vendor || "",
      status: item.status || "Active",
      notes: item.notes || "",
    });

    setShowForm(true);
  };

  const openDetails = (item) => {
    setSelectedLicense(item);
    setShowDetails(true);
  };

  const closeModals = () => {
    if (saving) return;

    setShowForm(false);
    setShowDetails(false);
    setEditingLicense(null);
    setSelectedLicense(null);
  };

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const saveLicense = async (event) => {
    event.preventDefault();

    if (!form.softwareName.trim()) {
      setError("Software name is required.");
      return;
    }

    if (!form.licenseKey.trim()) {
      setError("License key is required.");
      return;
    }

    setSaving(true);
    setError("");

    const payload = {
      licenseKey: form.licenseKey,
      softwareName: form.softwareName,
      version: form.version,
      publisher: form.publisher,
      licenseType: form.licenseType,
      seatsPurchased: Number(form.seatsPurchased) || 0,
      seatsUsed: Number(form.seatsUsed) || 0,
      department: form.department,
      assignedTo: form.assignedTo,
      purchaseDate: form.purchaseDate,
      startDate: form.startDate,
      expiryDate: form.expiryDate,
      renewalDate: form.renewalDate,
      cost: Number(form.cost) || 0,
      vendor: form.vendor,
      status: form.status,
      notes: form.notes,
    };

    try {
      if (editingLicense) {
        let response;

        try {
          response = await request(
            `/software-licenses/${editingLicense.id}`,
            {
              method: "PUT",
              body: JSON.stringify(payload),
            }
          );
        } catch {
          try {
            response = await request(
              `/softwareLicenses/${editingLicense.id}`,
              {
                method: "PUT",
                body: JSON.stringify(payload),
              }
            );
          } catch {
            response = await request(
              `/licenses/${editingLicense.id}`,
              {
                method: "PUT",
                body: JSON.stringify(payload),
              }
            );
          }
        }

        const updated = normalizeLicense(
          response?.data || response || payload,
          0
        );

        setLicenses((current) =>
          current.map((item) =>
            item.id === editingLicense.id
              ? {
                  ...item,
                  ...updated,
                  id: editingLicense.id,
                }
              : item
          )
        );
      } else {
        let response;

        try {
          response = await request("/software-licenses", {
            method: "POST",
            body: JSON.stringify(payload),
          });
        } catch {
          try {
            response = await request("/softwareLicenses", {
              method: "POST",
              body: JSON.stringify(payload),
            });
          } catch {
            response = await request("/licenses", {
              method: "POST",
              body: JSON.stringify(payload),
            });
          }
        }

        const created = normalizeLicense(
          response?.data || response || payload,
          licenses.length
        );

        setLicenses((current) => [created, ...current]);
      }

      setForm(initialForm);
      setEditingLicense(null);
      setShowForm(false);
    } catch (err) {
      setError(
        err.message || "Unable to save software license."
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteLicense = async (item) => {
    const confirmed = window.confirm(
      `Delete the ${item.softwareName} license? This action cannot be undone.`
    );

    if (!confirmed) return;

    setError("");

    try {
      try {
        await request(`/software-licenses/${item.id}`, {
          method: "DELETE",
        });
      } catch {
        try {
          await request(`/softwareLicenses/${item.id}`, {
            method: "DELETE",
          });
        } catch {
          await request(`/licenses/${item.id}`, {
            method: "DELETE",
          });
        }
      }

      setLicenses((current) =>
        current.filter((license) => license.id !== item.id)
      );

      if (selectedLicense?.id === item.id) {
        setSelectedLicense(null);
        setShowDetails(false);
      }
    } catch (err) {
      setError(
        err.message || "Unable to delete software license."
      );
    }
  };

  const exportCSV = () => {
    if (!filteredLicenses.length) return;

    const headers = [
      "License Key",
      "Software",
      "Version",
      "Publisher",
      "License Type",
      "Seats Purchased",
      "Seats Used",
      "Available Seats",
      "Department",
      "Assigned To",
      "Purchase Date",
      "Start Date",
      "Expiry Date",
      "Renewal Date",
      "Cost",
      "Vendor",
      "Status",
    ];

    const rows = filteredLicenses.map((item) => [
      item.licenseKey,
      item.softwareName,
      item.version,
      item.publisher,
      item.licenseType,
      item.seatsPurchased,
      item.seatsUsed,
      Math.max(
        0,
        Number(item.seatsPurchased || 0) -
          Number(item.seatsUsed || 0)
      ),
      item.department,
      item.assignedTo,
      item.purchaseDate,
      item.startDate,
      item.expiryDate,
      item.renewalDate,
      item.cost,
      item.vendor,
      getComputedStatus(item),
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
    link.download = `software-licenses-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 ict-module-theme ict-theme-software-licenses">
      <div className="mx-auto max-w-[1600px] space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between ict-page-header">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
              <FileKey2 size={16} />
              <span>ICT Asset Management</span>
              <span>/</span>
              <span className="text-slate-700">
                Software Licenses
              </span>
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl ict-page-title">
              Software Licenses
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Manage university software licenses, subscriptions,
              allocations, renewals, and compliance.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={loadLicenses}
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
              disabled={!filteredLicenses.length}
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
              Add License
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
            title="Total Licenses"
            value={statistics.total}
            icon={Package}
            iconClass="bg-blue-50 text-blue-600"
          />

          <SummaryCard
            title="Active"
            value={statistics.active}
            icon={CheckCircle2}
            iconClass="bg-emerald-50 text-emerald-600"
          />

          <SummaryCard
            title="Expiring Soon"
            value={statistics.expiring}
            icon={Clock3}
            iconClass="bg-amber-50 text-amber-600"
          />

          <SummaryCard
            title="Expired"
            value={statistics.expired}
            icon={Ban}
            iconClass="bg-red-50 text-red-600"
          />

          <SummaryCard
            title="Available Seats"
            value={statistics.availableSeats}
            icon={Users}
            iconClass="bg-indigo-50 text-indigo-600"
          />
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
                  placeholder="Search software, key, publisher..."
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
                    className="h-10 min-w-[165px] appearance-none rounded-lg border border-slate-200 bg-white pl-9 pr-8 text-sm font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
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
                  value={typeFilter}
                  onChange={(event) =>
                    setTypeFilter(event.target.value)
                  }
                  className="h-10 min-w-[155px] rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="All">All License Types</option>

                  {LICENSE_TYPES.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1350px] text-left">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200">
                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Software
                  </th>

                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    License
                  </th>

                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Allocation
                  </th>

                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Department
                  </th>

                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Expiry
                  </th>

                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Vendor
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
                      {Array.from({ length: 8 }).map(
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
                ) : paginatedLicenses.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-6 py-16 text-center"
                    >
                      <div className="mx-auto flex max-w-sm flex-col items-center">
                        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                          <FileKey2 size={27} />
                        </div>

                        <h3 className="text-base font-semibold text-slate-900">
                          No software licenses found
                        </h3>

                        <p className="mt-1 text-sm text-slate-500">
                          Change your filters or add a new software
                          license.
                        </p>

                        <button
                          type="button"
                          onClick={openCreate}
                          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                        >
                          <Plus size={16} />
                          Add License
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedLicenses.map((item) => {
                    const computedStatus = getComputedStatus(item);

                    const purchased =
                      Number(item.seatsPurchased) || 0;

                    const used =
                      Number(item.seatsUsed) || 0;

                    const available = Math.max(
                      0,
                      purchased - used
                    );

                    const usagePercent =
                      purchased > 0
                        ? Math.min(
                            100,
                            Math.round((used / purchased) * 100)
                          )
                        : 0;

                    return (
                      <tr
                        key={item.id}
                        className="group transition hover:bg-slate-50/80"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                              <Laptop size={19} />
                            </div>

                            <div>
                              <button
                                type="button"
                                onClick={() =>
                                  openDetails(item)
                                }
                                className="font-semibold text-blue-600 hover:text-blue-700"
                              >
                                {item.softwareName ||
                                  "Unnamed Software"}
                              </button>

                              <div className="mt-0.5 text-xs text-slate-500">
                                {item.publisher || "Unknown publisher"}
                                {item.version
                                  ? ` • v${item.version}`
                                  : ""}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <div className="font-mono text-sm text-slate-700">
                            {item.licenseKey || "—"}
                          </div>

                          <div className="mt-1 text-xs text-slate-500">
                            {item.licenseType}
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <span className="text-sm font-semibold text-slate-800">
                                {used}
                              </span>

                              <span className="text-sm text-slate-400">
                                {" "}
                                / {purchased}
                              </span>
                            </div>

                            <span className="text-xs font-medium text-emerald-600">
                              {available} free
                            </span>
                          </div>

                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-blue-600 transition-all"
                              style={{
                                width: `${usagePercent}%`,
                              }}
                            />
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

                          {item.assignedTo && (
                            <div className="mt-1 text-xs text-slate-400">
                              {item.assignedTo}
                            </div>
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2 text-sm text-slate-700">
                            <CalendarDays
                              size={15}
                              className="text-slate-400"
                            />

                            {formatDate(item.expiryDate)}
                          </div>

                          {(() => {
                            const days = getDaysUntilExpiry(
                              item.expiryDate
                            );

                            if (days === null) return null;

                            if (days < 0) {
                              return (
                                <div className="mt-1 text-xs font-medium text-red-600">
                                  Expired
                                </div>
                              );
                            }

                            if (days <= 30) {
                              return (
                                <div className="mt-1 text-xs font-medium text-amber-600">
                                  {days} days remaining
                                </div>
                              );
                            }

                            return (
                              <div className="mt-1 text-xs text-slate-400">
                                {days} days remaining
                              </div>
                            );
                          })()}
                        </td>

                        <td className="px-5 py-4">
                          <div className="text-sm font-medium text-slate-700">
                            {item.vendor || "—"}
                          </div>

                          {item.cost !== "" &&
                            item.cost !== null &&
                            item.cost !== undefined && (
                              <div className="mt-1 text-xs text-slate-400">
                                {formatCurrency(item.cost)}
                              </div>
                            )}
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClasses(
                              computedStatus
                            )}`}
                          >
                            {computedStatus}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-1">
                            <ActionButton
                              title="View license"
                              onClick={() =>
                                openDetails(item)
                              }
                            >
                              <Eye size={16} />
                            </ActionButton>

                            <ActionButton
                              title="Edit license"
                              onClick={() =>
                                openEdit(item)
                              }
                            >
                              <Pencil size={16} />
                            </ActionButton>

                            <ActionButton
                              title="Delete license"
                              onClick={() =>
                                deleteLicense(item)
                              }
                              className="text-red-500 hover:bg-red-50 hover:text-red-700"
                            >
                              <Trash2 size={16} />
                            </ActionButton>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!loading && filteredLicenses.length > 0 && (
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
                    filteredLicenses.length
                  )}
                </span>{" "}
                of{" "}
                <span className="font-medium text-slate-700">
                  {filteredLicenses.length}
                </span>{" "}
                licenses
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

      {/* Add / Edit Modal */}
      {showForm && (
        <Modal
          title={
            editingLicense
              ? "Edit Software License"
              : "Add Software License"
          }
          icon={editingLicense ? Pencil : Plus}
          onClose={closeModals}
          large
        >
          <form onSubmit={saveLicense}>
            <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <FormField
                  label="License Key"
                  name="licenseKey"
                  value={form.licenseKey}
                  onChange={handleChange}
                  placeholder="XXXX-XXXX-XXXX-XXXX"
                  required
                />

                <FormField
                  label="Software Name"
                  name="softwareName"
                  value={form.softwareName}
                  onChange={handleChange}
                  placeholder="Microsoft Office"
                  required
                />

                <FormField
                  label="Version"
                  name="version"
                  value={form.version}
                  onChange={handleChange}
                  placeholder="2024"
                />

                <FormField
                  label="Publisher"
                  name="publisher"
                  value={form.publisher}
                  onChange={handleChange}
                  placeholder="Microsoft"
                />

                <SelectField
                  label="License Type"
                  name="licenseType"
                  value={form.licenseType}
                  onChange={handleChange}
                  options={LICENSE_TYPES}
                />

                <FormField
                  label="Vendor"
                  name="vendor"
                  value={form.vendor}
                  onChange={handleChange}
                  placeholder="Authorized supplier"
                />

                <FormField
                  label="Seats Purchased"
                  name="seatsPurchased"
                  value={form.seatsPurchased}
                  onChange={handleChange}
                  placeholder="100"
                  type="number"
                />

                <FormField
                  label="Seats Used"
                  name="seatsUsed"
                  value={form.seatsUsed}
                  onChange={handleChange}
                  placeholder="50"
                  type="number"
                />

                <FormField
                  label="Department"
                  name="department"
                  value={form.department}
                  onChange={handleChange}
                  placeholder="Department / College"
                />

                <FormField
                  label="Assigned To"
                  name="assignedTo"
                  value={form.assignedTo}
                  onChange={handleChange}
                  placeholder="Responsible person"
                />

                <FormField
                  label="Purchase Date"
                  name="purchaseDate"
                  type="date"
                  value={form.purchaseDate}
                  onChange={handleChange}
                />

                <FormField
                  label="Start Date"
                  name="startDate"
                  type="date"
                  value={form.startDate}
                  onChange={handleChange}
                />

                <FormField
                  label="Expiry Date"
                  name="expiryDate"
                  type="date"
                  value={form.expiryDate}
                  onChange={handleChange}
                />

                <FormField
                  label="Renewal Date"
                  name="renewalDate"
                  type="date"
                  value={form.renewalDate}
                  onChange={handleChange}
                />

                <FormField
                  label="Cost"
                  name="cost"
                  value={form.cost}
                  onChange={handleChange}
                  placeholder="0.00"
                  type="number"
                />

                <SelectField
                  label="Status"
                  name="status"
                  value={form.status}
                  onChange={handleChange}
                  options={STATUS_OPTIONS}
                />

                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Notes
                  </label>

                  <textarea
                    name="notes"
                    value={form.notes}
                    onChange={handleChange}
                    rows={4}
                    placeholder="License terms, renewal information, restrictions, or additional notes..."
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

                {editingLicense
                  ? "Save Changes"
                  : "Add License"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Details Modal */}
      {showDetails && selectedLicense && (
        <Modal
          title="Software License Details"
          icon={FileKey2}
          onClose={closeModals}
          large
        >
          <div className="max-h-[78vh] overflow-y-auto">
            <div className="border-b border-slate-200 bg-slate-50 px-6 py-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">
                    <KeyRound size={27} />
                  </div>

                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      {selectedLicense.licenseKey ||
                        "No license key"}
                    </div>

                    <h2 className="mt-1 text-xl font-bold text-slate-900">
                      {selectedLicense.softwareName}
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      {selectedLicense.publisher ||
                        "Unknown publisher"}

                      {selectedLicense.version
                        ? ` • Version ${selectedLicense.version}`
                        : ""}
                    </p>
                  </div>
                </div>

                <span
                  className={`inline-flex w-fit rounded-full border px-3 py-1.5 text-xs font-semibold ${statusClasses(
                    getComputedStatus(selectedLicense)
                  )}`}
                >
                  {getComputedStatus(selectedLicense)}
                </span>
              </div>
            </div>

            <div className="space-y-6 px-6 py-6">
              {/* License Information */}
              <section>
                <h3 className="mb-3 text-sm font-semibold text-slate-900">
                  License Information
                </h3>

                <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 p-4 md:grid-cols-3">
                  <DetailItem
                    label="License Key"
                    value={selectedLicense.licenseKey}
                    icon={Hash}
                  />

                  <DetailItem
                    label="License Type"
                    value={selectedLicense.licenseType}
                    icon={FileKey2}
                  />

                  <DetailItem
                    label="Software"
                    value={selectedLicense.softwareName}
                    icon={Package}
                  />

                  <DetailItem
                    label="Version"
                    value={selectedLicense.version}
                  />

                  <DetailItem
                    label="Publisher"
                    value={selectedLicense.publisher}
                  />

                  <DetailItem
                    label="Vendor"
                    value={selectedLicense.vendor}
                  />
                </div>
              </section>

              {/* Allocation */}
              <section>
                <h3 className="mb-3 text-sm font-semibold text-slate-900">
                  License Allocation
                </h3>

                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                    <DetailItem
                      label="Seats Purchased"
                      value={selectedLicense.seatsPurchased}
                      icon={Users}
                    />

                    <DetailItem
                      label="Seats Used"
                      value={selectedLicense.seatsUsed}
                      icon={User}
                    />

                    <DetailItem
                      label="Available Seats"
                      value={Math.max(
                        0,
                        Number(
                          selectedLicense.seatsPurchased || 0
                        ) -
                          Number(
                            selectedLicense.seatsUsed || 0
                          )
                      )}
                      icon={CheckCircle2}
                    />

                    <DetailItem
                      label="Department"
                      value={selectedLicense.department}
                      icon={Building2}
                    />
                  </div>

                  {Number(selectedLicense.seatsPurchased) > 0 && (
                    <div className="mt-5">
                      <div className="mb-2 flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-500">
                          Seat utilization
                        </span>

                        <span className="font-semibold text-slate-700">
                          {Math.min(
                            100,
                            Math.round(
                              (Number(
                                selectedLicense.seatsUsed || 0
                              ) /
                                Number(
                                  selectedLicense.seatsPurchased
                                )) *
                                100
                            )
                          )}
                          %
                        </span>
                      </div>

                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-blue-600"
                          style={{
                            width: `${Math.min(
                              100,
                              Math.round(
                                (Number(
                                  selectedLicense.seatsUsed || 0
                                ) /
                                  Number(
                                    selectedLicense.seatsPurchased
                                  )) *
                                  100
                              )
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* Lifecycle */}
              <section>
                <h3 className="mb-3 text-sm font-semibold text-slate-900">
                  License Lifecycle
                </h3>

                <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 p-4 md:grid-cols-4">
                  <DetailItem
                    label="Purchase Date"
                    value={formatDate(
                      selectedLicense.purchaseDate
                    )}
                    icon={CalendarDays}
                  />

                  <DetailItem
                    label="Start Date"
                    value={formatDate(
                      selectedLicense.startDate
                    )}
                    icon={CalendarDays}
                  />

                  <DetailItem
                    label="Expiry Date"
                    value={formatDate(
                      selectedLicense.expiryDate
                    )}
                    icon={CalendarDays}
                  />

                  <DetailItem
                    label="Renewal Date"
                    value={formatDate(
                      selectedLicense.renewalDate
                    )}
                    icon={RefreshCw}
                  />
                </div>
              </section>

              {/* Financial */}
              <section>
                <h3 className="mb-3 text-sm font-semibold text-slate-900">
                  Financial Information
                </h3>

                <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 p-4 md:grid-cols-3">
                  <DetailItem
                    label="License Cost"
                    value={formatCurrency(
                      selectedLicense.cost
                    )}
                  />

                  <DetailItem
                    label="Vendor"
                    value={selectedLicense.vendor}
                  />

                  <DetailItem
                    label="Assigned To"
                    value={selectedLicense.assignedTo}
                    icon={User}
                  />
                </div>
              </section>

              {/* Notes */}
              <section>
                <h3 className="mb-3 text-sm font-semibold text-slate-900">
                  Notes
                </h3>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                  {selectedLicense.notes ||
                    "No additional notes have been recorded."}
                </div>
              </section>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
              <button
                type="button"
                onClick={() => {
                  setShowDetails(false);
                  openEdit(selectedLicense);
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <Pencil size={16} />
                Edit License
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