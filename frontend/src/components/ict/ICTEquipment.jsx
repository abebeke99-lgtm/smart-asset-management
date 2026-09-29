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
  Router,
  Wifi,
  Server,
  Network,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Wrench,
  Package,
  ChevronLeft,
  ChevronRight,
  Filter,
  Building2,
  MapPin,
  CalendarDays,
  Hash,
  Cable,
  Activity,
} from "lucide-react";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

const PAGE_SIZE = 10;

const STATUS_OPTIONS = [
  "Active",
  "Available",
  "Assigned",
  "Maintenance",
  "Faulty",
  "Retired",
];

const CONDITION_OPTIONS = [
  "Excellent",
  "Good",
  "Fair",
  "Poor",
  "Damaged",
];

const TYPE_OPTIONS = [
  "Router",
  "Switch",
  "Access Point",
  "Firewall",
  "Server",
  "Modem",
  "Network Controller",
  "Rack",
  "Other",
];

const initialForm = {
 assetTag: "",
  serialNumber: "",
  equipmentName: "",
  equipmentType: "Switch",
  manufacturer: "",
  model: "",
  ipAddress: "",
  macAddress: "",
  portCount: "",
  networkRole: "",
  department: "",
  location: "",
  assignedTo: "",
  purchaseDate: "",
  warrantyExpiry: "",
  condition: "Good",
  status: "Active",
  specifications: "",
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
  if (Array.isArray(data?.equipment)) return data.equipment;
  if (Array.isArray(data?.networkEquipment)) return data.networkEquipment;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

function normalizeEquipment(item, index) {
  return {
    id:
      item.id ??
      item._id ??
      item.assetId ??
      item.asset_id ??
      `NET-${String(index + 1).padStart(4, "0")}`,

    assetTag:
      item.assetTag ??
      item.asset_tag ??
      item.assetNumber ??
      item.tagNumber ??
      `NET-${String(index + 1).padStart(4, "0")}`,

    serialNumber:
      item.serialNumber ??
      item.serial_number ??
      item.serial ??
      "",

    equipmentName:
      item.equipmentName ??
      item.equipment_name ??
      item.name ??
      item.assetName ??
      "",

    equipmentType:
      item.equipmentType ??
      item.equipment_type ??
      item.type ??
      item.category ??
      "Other",

    manufacturer:
      item.manufacturer ??
      item.brand ??
      "",

    model:
      item.model ??
      item.modelNumber ??
      item.model_number ??
      "",

    ipAddress:
      item.ipAddress ??
      item.ip_address ??
      item.ip ??
      "",

    macAddress:
      item.macAddress ??
      item.mac_address ??
      item.mac ??
      "",

    portCount:
      item.portCount ??
      item.port_count ??
      item.ports ??
      "",

    networkRole:
      item.networkRole ??
      item.network_role ??
      item.role ??
      "",

    department:
      item.department ??
      item.departmentName ??
      item.department_name ??
      "",

    location:
      item.location ??
      item.room ??
      item.locationName ??
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

    warrantyExpiry:
      item.warrantyExpiry ??
      item.warranty_expiry ??
      item.warrantyEndDate ??
      "",

    condition: item.condition ?? "Good",

    status: item.status ?? "Active",

    specifications:
      item.specifications ??
      item.specs ??
      item.description ??
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

function statusClasses(status) {
  switch (String(status).toLowerCase()) {
    case "active":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";

    case "available":
      return "bg-blue-50 text-blue-700 border-blue-200";

    case "assigned":
      return "bg-indigo-50 text-indigo-700 border-indigo-200";

    case "maintenance":
      return "bg-amber-50 text-amber-700 border-amber-200";

    case "faulty":
      return "bg-red-50 text-red-700 border-red-200";

    case "retired":
      return "bg-slate-100 text-slate-600 border-slate-200";

    default:
      return "bg-slate-100 text-slate-600 border-slate-200";
  }
}

function conditionClasses(condition) {
  switch (String(condition).toLowerCase()) {
    case "excellent":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";

    case "good":
      return "bg-blue-50 text-blue-700 border-blue-200";

    case "fair":
      return "bg-amber-50 text-amber-700 border-amber-200";

    case "poor":
      return "bg-orange-50 text-orange-700 border-orange-200";

    case "damaged":
      return "bg-red-50 text-red-700 border-red-200";

    default:
      return "bg-slate-100 text-slate-600 border-slate-200";
  }
}

function EquipmentIcon({ type, size = 19 }) {
  const value = String(type).toLowerCase();

  if (value.includes("router")) return <Router size={size} />;
  if (value.includes("switch")) return <Network size={size} />;
  if (value.includes("access")) return <Wifi size={size} />;
  if (value.includes("firewall")) return <ShieldCheck size={size} />;
  if (value.includes("server")) return <Server size={size} />;
  if (value.includes("modem")) return <Cable size={size} />;

  return <Router size={size} />;
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

function ActionButton({ children, title, onClick, className = "" }) {
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

function SelectField({ label, name, value, onChange, options }) {
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

function DetailItem({ label, value, icon: Icon }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
        {Icon && <Icon size={13} />}
        {label}
      </div>

      <div className="mt-1 text-sm font-medium text-slate-800">
        {value || "—"}
      </div>
    </div>
  );
}

function Modal({ title, icon: Icon, children, onClose, large = false }) {
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

            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
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

export default function NetworkEquipment() {
  const [equipment, setEquipment] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [conditionFilter, setConditionFilter] = useState("All");

  const [page, setPage] = useState(1);

  const [showForm, setShowForm] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const [editingItem, setEditingItem] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);

  const [form, setForm] = useState(initialForm);

  const loadEquipment = async () => {
    setLoading(true);
    setError("");

    try {
      let data;

      try {
        data = await request("/network-equipment");
      } catch {
        try {
          data = await request("/networkEquipment");
        } catch {
          data = await request("/assets?category=Network");
        }
      }

      setEquipment(getArray(data).map(normalizeEquipment));
    } catch (err) {
      setError(err.message || "Unable to load network equipment.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEquipment();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, typeFilter, conditionFilter]);

  const statistics = useMemo(() => {
    return {
      total: equipment.length,

      active: equipment.filter(
        (item) => String(item.status).toLowerCase() === "active"
      ).length,

      available: equipment.filter(
        (item) => String(item.status).toLowerCase() === "available"
      ).length,

      maintenance: equipment.filter(
        (item) => String(item.status).toLowerCase() === "maintenance"
      ).length,

      faulty: equipment.filter(
        (item) => String(item.status).toLowerCase() === "faulty"
      ).length,
    };
  }, [equipment]);

  const filteredEquipment = useMemo(() => {
    const query = search.trim().toLowerCase();

    return equipment.filter((item) => {
      const matchesSearch =
        !query ||
        [
          item.assetTag,
          item.serialNumber,
          item.equipmentName,
          item.equipmentType,
          item.manufacturer,
          item.model,
          item.ipAddress,
          item.macAddress,
          item.networkRole,
          item.department,
          item.location,
          item.assignedTo,
        ].some((value) =>
          String(value || "")
            .toLowerCase()
            .includes(query)
        );

      const matchesStatus =
        statusFilter === "All" ||
        String(item.status).toLowerCase() === statusFilter.toLowerCase();

      const matchesType =
        typeFilter === "All" ||
        String(item.equipmentType).toLowerCase() === typeFilter.toLowerCase();

      const matchesCondition =
        conditionFilter === "All" ||
        String(item.condition).toLowerCase() ===
          conditionFilter.toLowerCase();

      return (
        matchesSearch &&
        matchesStatus &&
        matchesType &&
        matchesCondition
      );
    });
  }, [
    equipment,
    search,
    statusFilter,
    typeFilter,
    conditionFilter,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredEquipment.length / PAGE_SIZE)
  );

  const paginatedEquipment = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredEquipment.slice(start, start + PAGE_SIZE);
  }, [filteredEquipment, page]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const openCreate = () => {
    setEditingItem(null);

    setForm({
      ...initialForm,
      assetTag: `NET-${Date.now().toString().slice(-6)}`,
    });

    setShowForm(true);
  };

  const openEdit = (item) => {
    setEditingItem(item);

    setForm({
      assetTag: item.assetTag || "",
      serialNumber: item.serialNumber || "",
      equipmentName: item.equipmentName || "",
      equipmentType: item.equipmentType || "Switch",
      manufacturer: item.manufacturer || "",
      model: item.model || "",
      ipAddress: item.ipAddress || "",
      macAddress: item.macAddress || "",
      portCount: item.portCount || "",
      networkRole: item.networkRole || "",
      department: item.department || "",
      location: item.location || "",
      assignedTo: item.assignedTo || "",
      purchaseDate: item.purchaseDate?.slice?.(0, 10) || "",
      warrantyExpiry: item.warrantyExpiry?.slice?.(0, 10) || "",
      condition: item.condition || "Good",
      status: item.status || "Active",
      specifications: item.specifications || "",
      notes: item.notes || "",
    });

    setShowForm(true);
  };

  const openDetails = (item) => {
    setSelectedItem(item);
    setShowDetails(true);
  };

  const closeAll = () => {
    if (!saving) {
      setShowForm(false);
      setShowDetails(false);
      setEditingItem(null);
      setSelectedItem(null);
    }
  };

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const saveEquipment = async (event) => {
    event.preventDefault();

    if (!form.assetTag.trim()) {
      setError("Asset tag is required.");
      return;
    }

    if (!form.equipmentName.trim()) {
      setError("Equipment name is required.");
      return;
    }

    setSaving(true);
    setError("");

    const payload = {
      assetTag: form.assetTag,
      serialNumber: form.serialNumber,
      equipmentName: form.equipmentName,
      equipmentType: form.equipmentType,
      manufacturer: form.manufacturer,
      model: form.model,
      ipAddress: form.ipAddress,
      macAddress: form.macAddress,
      portCount: form.portCount,
      networkRole: form.networkRole,
      department: form.department,
      location: form.location,
      assignedTo: form.assignedTo,
      purchaseDate: form.purchaseDate,
      warrantyExpiry: form.warrantyExpiry,
      condition: form.condition,
      status: form.status,
      specifications: form.specifications,
      notes: form.notes,
    };

    try {
      if (editingItem) {
        let response;

        try {
          response = await request(
            `/network-equipment/${editingItem.id}`,
            {
              method: "PUT",
              body: JSON.stringify(payload),
            }
          );
        } catch {
          response = await request(`/networkEquipment/${editingItem.id}`, {
            method: "PUT",
            body: JSON.stringify(payload),
          });
        }

        const updated = normalizeEquipment(
          response?.data || response || payload,
          0
        );

        setEquipment((current) =>
          current.map((item) =>
            item.id === editingItem.id
              ? {
                  ...item,
                  ...updated,
                  id: editingItem.id,
                }
              : item
          )
        );
      } else {
        let response;

        try {
          response = await request("/network-equipment", {
            method: "POST",
            body: JSON.stringify(payload),
          });
        } catch {
          response = await request("/networkEquipment", {
            method: "POST",
            body: JSON.stringify(payload),
          });
        }

        const created = normalizeEquipment(
          response?.data || response || payload,
          equipment.length
        );

        setEquipment((current) => [created, ...current]);
      }

      setShowForm(false);
      setEditingItem(null);
      setForm(initialForm);
    } catch (err) {
      setError(err.message || "Unable to save network equipment.");
    } finally {
      setSaving(false);
    }
  };

  const deleteEquipment = async (item) => {
    const confirmed = window.confirm(
      `Delete ${item.assetTag} - ${item.equipmentName}? This action cannot be undone.`
    );

    if (!confirmed) return;

    setError("");

    try {
      try {
        await request(`/network-equipment/${item.id}`, {
          method: "DELETE",
        });
      } catch {
        await request(`/networkEquipment/${item.id}`, {
          method: "DELETE",
        });
      }

      setEquipment((current) =>
        current.filter((equipmentItem) => equipmentItem.id !== item.id)
      );

      if (selectedItem?.id === item.id) {
        setSelectedItem(null);
        setShowDetails(false);
      }
    } catch (err) {
      setError(err.message || "Unable to delete network equipment.");
    }
  };

  const exportCSV = () => {
    if (!filteredEquipment.length) return;

    const headers = [
      "Asset Tag",
      "Serial Number",
      "Equipment Name",
      "Type",
      "Manufacturer",
      "Model",
      "IP Address",
      "MAC Address",
      "Port Count",
      "Network Role",
      "Department",
      "Location",
      "Assigned To",
      "Purchase Date",
      "Warranty Expiry",
      "Condition",
      "Status",
    ];

    const rows = filteredEquipment.map((item) => [
      item.assetTag,
      item.serialNumber,
      item.equipmentName,
      item.equipmentType,
      item.manufacturer,
      item.model,
      item.ipAddress,
      item.macAddress,
      item.portCount,
      item.networkRole,
      item.department,
      item.location,
      item.assignedTo,
      item.purchaseDate,
      item.warrantyExpiry,
      item.condition,
      item.status,
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
    link.download = `network-equipment-${new Date()
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
              <Network size={16} />
              <span>ICT Asset Management</span>
              <span>/</span>
              <span className="text-slate-700">
                Network Equipment
              </span>
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
              Network Equipment
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Manage routers, switches, access points, firewalls, and other
              university network infrastructure.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={loadEquipment}
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
              disabled={!filteredEquipment.length}
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
              Add Equipment
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <div className="flex gap-3">
              <AlertTriangle size={18} className="mt-0.5 shrink-0" />

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
            title="Total Equipment"
            value={statistics.total}
            icon={Package}
            iconClass="bg-blue-50 text-blue-600"
          />

          <SummaryCard
            title="Active"
            value={statistics.active}
            icon={Activity}
            iconClass="bg-emerald-50 text-emerald-600"
          />

          <SummaryCard
            title="Available"
            value={statistics.available}
            icon={CheckCircle2}
            iconClass="bg-indigo-50 text-indigo-600"
          />

          <SummaryCard
            title="Maintenance"
            value={statistics.maintenance}
            icon={Wrench}
            iconClass="bg-amber-50 text-amber-600"
          />

          <SummaryCard
            title="Faulty"
            value={statistics.faulty}
            icon={AlertTriangle}
            iconClass="bg-red-50 text-red-600"
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
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search tag, serial, IP, equipment..."
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
                    className="h-10 min-w-[150px] appearance-none rounded-lg border border-slate-200 bg-white pl-9 pr-8 text-sm font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
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
                  className="h-10 min-w-[145px] rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="All">All Types</option>

                  {TYPE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>

                <select
                  value={conditionFilter}
                  onChange={(event) =>
                    setConditionFilter(event.target.value)
                  }
                  className="h-10 min-w-[145px] rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="All">All Conditions</option>

                  {CONDITION_OPTIONS.map((option) => (
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
                    Equipment
                  </th>

                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Network
                  </th>

                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Manufacturer / Model
                  </th>

                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Department
                  </th>

                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Location
                  </th>

                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Condition
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
                      {Array.from({ length: 8 }).map((__, cellIndex) => (
                        <td key={cellIndex} className="px-5 py-5">
                          <div className="h-4 animate-pulse rounded bg-slate-100" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : paginatedEquipment.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-16 text-center">
                      <div className="mx-auto flex max-w-sm flex-col items-center">
                        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                          <Router size={27} />
                        </div>

                        <h3 className="text-base font-semibold text-slate-900">
                          No network equipment found
                        </h3>

                        <p className="mt-1 text-sm text-slate-500">
                          Change your filters or add new network equipment.
                        </p>

                        <button
                          type="button"
                          onClick={openCreate}
                          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                        >
                          <Plus size={16} />
                          Add Equipment
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedEquipment.map((item) => (
                    <tr
                      key={item.id}
                      className="group transition hover:bg-slate-50/80"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                            <EquipmentIcon
                              type={item.equipmentType}
                              size={19}
                            />
                          </div>

                          <div>
                            <button
                              type="button"
                              onClick={() => openDetails(item)}
                              className="font-semibold text-blue-600 hover:text-blue-700"
                            >
                              {item.assetTag}
                            </button>

                            <div className="mt-0.5 max-w-[220px] truncate text-sm text-slate-700">
                              {item.equipmentName || "Unnamed equipment"}
                            </div>

                            <div className="mt-0.5 text-xs text-slate-400">
                              {item.equipmentType}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="font-mono text-sm text-slate-700">
                          {item.ipAddress || "No IP"}
                        </div>

                        <div className="mt-1 text-xs text-slate-500">
                          {item.macAddress || "No MAC"}
                        </div>

                        {item.portCount && (
                          <div className="mt-1 text-xs text-slate-400">
                            {item.portCount} ports
                          </div>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <div className="text-sm font-medium text-slate-800">
                          {item.manufacturer || "—"}
                        </div>

                        <div className="mt-1 text-xs text-slate-500">
                          {item.model || "No model"}
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
                          <MapPin size={15} className="text-slate-400" />
                          {item.location || "—"}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${conditionClasses(
                            item.condition
                          )}`}
                        >
                          {item.condition}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClasses(
                            item.status
                          )}`}
                        >
                          {item.status}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-1">
                          <ActionButton
                            title="View equipment"
                            onClick={() => openDetails(item)}
                          >
                            <Eye size={16} />
                          </ActionButton>

                          <ActionButton
                            title="Edit equipment"
                            onClick={() => openEdit(item)}
                          >
                            <Pencil size={16} />
                          </ActionButton>

                          <ActionButton
                            title="Delete equipment"
                            onClick={() => deleteEquipment(item)}
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
          {!loading && filteredEquipment.length > 0 && (
            <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-500">
                Showing{" "}
                <span className="font-medium text-slate-700">
                  {(page - 1) * PAGE_SIZE + 1}
                </span>{" "}
                to{" "}
                <span className="font-medium text-slate-700">
                  {Math.min(page * PAGE_SIZE, filteredEquipment.length)}
                </span>{" "}
                of{" "}
                <span className="font-medium text-slate-700">
                  {filteredEquipment.length}
                </span>{" "}
                equipment records
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page === 1}
                  onClick={() => setPage((current) => current - 1)}
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
                  onClick={() => setPage((current) => current + 1)}
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
            editingItem
              ? "Edit Network Equipment"
              : "Add Network Equipment"
          }
          icon={editingItem ? Pencil : Plus}
          onClose={closeAll}
          large
        >
          <form onSubmit={saveEquipment}>
            <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <FormField
                  label="Asset Tag"
                  name="assetTag"
                  value={form.assetTag}
                  onChange={handleChange}
                  placeholder="NET-0001"
                  required
                />

                <FormField
                  label="Serial Number"
                  name="serialNumber"
                  value={form.serialNumber}
                  onChange={handleChange}
                  placeholder="Serial number"
                />

                <FormField
                  label="Equipment Name"
                  name="equipmentName"
                  value={form.equipmentName}
                  onChange={handleChange}
                  placeholder="e.g. Cisco Catalyst Switch"
                  required
                />

                <SelectField
                  label="Equipment Type"
                  name="equipmentType"
                  value={form.equipmentType}
                  onChange={handleChange}
                  options={TYPE_OPTIONS}
                />

                <FormField
                  label="Manufacturer"
                  name="manufacturer"
                  value={form.manufacturer}
                  onChange={handleChange}
                  placeholder="e.g. Cisco"
                />

                <FormField
                  label="Model"
                  name="model"
                  value={form.model}
                  onChange={handleChange}
                  placeholder="e.g. Catalyst 2960"
                />

                <FormField
                  label="IP Address"
                  name="ipAddress"
                  value={form.ipAddress}
                  onChange={handleChange}
                  placeholder="192.168.1.1"
                />

                <FormField
                  label="MAC Address"
                  name="macAddress"
                  value={form.macAddress}
                  onChange={handleChange}
                  placeholder="00:1A:2B:3C:4D:5E"
                />

                <FormField
                  label="Port Count"
                  name="portCount"
                  value={form.portCount}
                  onChange={handleChange}
                  placeholder="24"
                  type="number"
                />

                <FormField
                  label="Network Role"
                  name="networkRole"
                  value={form.networkRole}
                  onChange={handleChange}
                  placeholder="Core / Distribution / Access"
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
                  placeholder="Building / Server Room"
                />

                <FormField
                  label="Assigned To"
                  name="assignedTo"
                  value={form.assignedTo}
                  onChange={handleChange}
                  placeholder="Responsible staff"
                />

                <FormField
                  label="Purchase Date"
                  name="purchaseDate"
                  type="date"
                  value={form.purchaseDate}
                  onChange={handleChange}
                />

                <FormField
                  label="Warranty Expiry"
                  name="warrantyExpiry"
                  type="date"
                  value={form.warrantyExpiry}
                  onChange={handleChange}
                />

                <SelectField
                  label="Condition"
                  name="condition"
                  value={form.condition}
                  onChange={handleChange}
                  options={CONDITION_OPTIONS}
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
                    Specifications
                  </label>

                  <textarea
                    name="specifications"
                    value={form.specifications}
                    onChange={handleChange}
                    rows={4}
                    placeholder="Bandwidth, VLAN support, firmware version, interfaces, routing protocols, etc."
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Notes
                  </label>

                  <textarea
                    name="notes"
                    value={form.notes}
                    onChange={handleChange}
                    rows={3}
                    placeholder="Additional information..."
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
              <button
                type="button"
                onClick={closeAll}
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
                  <RefreshCw size={16} className="animate-spin" />
                )}

                {editingItem ? "Save Changes" : "Add Equipment"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Details Modal */}
      {showDetails && selectedItem && (
        <Modal
          title="Network Equipment Details"
          icon={Router}
          onClose={closeAll}
          large
        >
          <div className="max-h-[78vh] overflow-y-auto">
            <div className="border-b border-slate-200 bg-slate-50 px-6 py-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">
                    <EquipmentIcon
                      type={selectedItem.equipmentType}
                      size={27}
                    />
                  </div>

                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      {selectedItem.assetTag}
                    </div>

                    <h2 className="mt-1 text-xl font-bold text-slate-900">
                      {selectedItem.equipmentName}
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      {selectedItem.manufacturer || "Unknown manufacturer"}{" "}
                      {selectedItem.model
                        ? `• ${selectedItem.model}`
                        : ""}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${statusClasses(
                      selectedItem.status
                    )}`}
                  >
                    {selectedItem.status}
                  </span>

                  <span
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${conditionClasses(
                      selectedItem.condition
                    )}`}
                  >
                    {selectedItem.condition}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-6 px-6 py-6">
              <section>
                <h3 className="mb-3 text-sm font-semibold text-slate-900">
                  Equipment Identification
                </h3>

                <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 p-4 md:grid-cols-3">
                  <DetailItem
                    label="Asset Tag"
                    value={selectedItem.assetTag}
                    icon={Hash}
                  />

                  <DetailItem
                    label="Serial Number"
                    value={selectedItem.serialNumber}
                    icon={Hash}
                  />

                  <DetailItem
                    label="Equipment Type"
                    value={selectedItem.equipmentType}
                    icon={Router}
                  />

                  <DetailItem
                    label="Manufacturer"
                    value={selectedItem.manufacturer}
                  />

                  <DetailItem
                    label="Model"
                    value={selectedItem.model}
                  />

                  <DetailItem
                    label="Network Role"
                    value={selectedItem.networkRole}
                    icon={Network}
                  />
                </div>
              </section>

              <section>
                <h3 className="mb-3 text-sm font-semibold text-slate-900">
                  Network Configuration
                </h3>

                <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 p-4 md:grid-cols-3">
                  <DetailItem
                    label="IP Address"
                    value={selectedItem.ipAddress}
                    icon={Activity}
                  />

                  <DetailItem
                    label="MAC Address"
                    value={selectedItem.macAddress}
                    icon={Hash}
                  />

                  <DetailItem
                    label="Port Count"
                    value={selectedItem.portCount}
                    icon={Cable}
                  />
                </div>
              </section>

              <section>
                <h3 className="mb-3 text-sm font-semibold text-slate-900">
                  Assignment & Location
                </h3>

                <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 p-4 md:grid-cols-3">
                  <DetailItem
                    label="Department"
                    value={selectedItem.department}
                    icon={Building2}
                  />

                  <DetailItem
                    label="Location"
                    value={selectedItem.location}
                    icon={MapPin}
                  />

                  <DetailItem
                    label="Assigned To"
                    value={selectedItem.assignedTo}
                  />
                </div>
              </section>

              <section>
                <h3 className="mb-3 text-sm font-semibold text-slate-900">
                  Lifecycle Information
                </h3>

                <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 p-4 md:grid-cols-3">
                  <DetailItem
                    label="Purchase Date"
                    value={formatDate(selectedItem.purchaseDate)}
                    icon={CalendarDays}
                  />

                  <DetailItem
                    label="Warranty Expiry"
                    value={formatDate(selectedItem.warrantyExpiry)}
                    icon={CalendarDays}
                  />

                  <DetailItem
                    label="Condition"
                    value={selectedItem.condition}
                  />

                  <DetailItem
                    label="Status"
                    value={selectedItem.status}
                  />
                </div>
              </section>

              <section>
                <h3 className="mb-3 text-sm font-semibold text-slate-900">
                  Specifications
                </h3>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                  {selectedItem.specifications ||
                    "No specifications have been recorded."}
                </div>
              </section>

              <section>
                <h3 className="mb-3 text-sm font-semibold text-slate-900">
                  Notes
                </h3>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                  {selectedItem.notes || "No additional notes."}
                </div>
              </section>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
              <button
                type="button"
                onClick={() => {
                  setShowDetails(false);
                  openEdit(selectedItem);
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <Pencil size={16} />
                Edit Equipment
              </button>

              <button
                type="button"
                onClick={closeAll}
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