import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  Battery,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Download,
  Eye,
  HardDrive,
  Info,
  Monitor,
  Network,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  Trash2,
  Wifi,
  X,
} from "lucide-react";

const API_BASE_URL =
  process.env.REACT_APP_API_URL || "/api";

const PAGE_SIZE = 10;

const HEALTH_STATUSES = [
  "Healthy",
  "Good",
  "Warning",
  "Critical",
  "Offline",
  "Unknown",
];

const DEVICE_TYPES = [
  "Desktop",
  "Laptop",
  "Server",
  "Network Device",
  "Printer",
  "Projector",
  "Mobile Device",
  "Other",
];

const initialForm = {
  assetTag: "",
  assetName: "",
  deviceType: "Desktop",
  serialNumber: "",
  ipAddress: "",
  macAddress: "",
  operatingSystem: "",
  osVersion: "",
  processor: "",
  ram: "",
  storage: "",
  uptime: "",
  cpuUsage: "",
  memoryUsage: "",
  diskUsage: "",
  temperature: "",
  batteryHealth: "",
  networkStatus: "Connected",
  antivirusStatus: "Active",
  lastScan: "",
  healthStatus: "Healthy",
  lastChecked: "",
  checkedBy: "",
  department: "",
  location: "",
  notes: "",
};

async function apiRequest(url, options = {}) {
  const token =
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    sessionStorage.getItem("token") ||
    sessionStorage.getItem("authToken");
  const response = await fetch(`${API_BASE_URL}${url}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    credentials: "include",
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
  if (Array.isArray(data?.devices)) return data.devices;
  if (Array.isArray(data?.deviceHealth))
    return data.deviceHealth;
  if (Array.isArray(data?.device_health))
    return data.device_health;
  if (Array.isArray(data?.results)) return data.results;

  return [];
}

function normalizeDevice(item, index) {
  return {
    id:
      item.id ??
      item._id ??
      item.deviceId ??
      item.device_id ??
      `HEALTH-${String(index + 1).padStart(5, "0")}`,

    assetTag:
      item.assetTag ??
      item.asset_tag ??
      item.assetCode ??
      item.asset?.assetTag ??
      item.asset?.assetCode ??
      item.asset?.asset_tag ??
      "",

    assetName:
      item.assetName ??
      item.asset_name ??
      item.asset?.name ??
      item.name ??
      "",

    deviceType:
      item.deviceType ??
      item.device_type ??
      item.type ??
      item.category ??
      item.asset?.category ??
      "Desktop",

    serialNumber:
      item.serialNumber ??
      item.serial_number ??
      item.asset?.serialNumber ??
      "",

    ipAddress:
      item.ipAddress ??
      item.ip_address ??
      item.network?.ipAddress ??
      "",

    macAddress:
      item.macAddress ??
      item.mac_address ??
      item.network?.macAddress ??
      "",

    operatingSystem:
      item.operatingSystem ??
      item.operating_system ??
      item.os ??
      "",

    osVersion:
      item.osVersion ??
      item.os_version ??
      "",

    processor:
      item.processor ??
      item.cpu ??
      "",

    ram:
      item.ram ??
      item.memory ??
      "",

    storage:
      item.storage ??
      item.disk ??
      "",

    uptime:
      item.uptime ??
      item.uptimeHours ??
      item.uptime_hours ??
      "",

    cpuUsage:
      item.cpuUsage ??
      item.cpu_usage ??
      item.metrics?.cpuUsage ??
      "",

    memoryUsage:
      item.memoryUsage ??
      item.memory_usage ??
      item.metrics?.memoryUsage ??
      "",

    diskUsage:
      item.diskUsage ??
      item.disk_usage ??
      item.metrics?.diskUsage ??
      "",

    temperature:
      item.temperature ??
      item.temperatureC ??
      item.temperature_c ??
      "",

    batteryHealth:
      item.batteryHealth ??
      item.battery_health ??
      item.battery?.health ??
      "",

    networkStatus:
      item.networkStatus ??
      item.network_status ??
      item.technicalHealth?.networkStatus ??
      item.network?.status ??
      "Connected",

    antivirusStatus:
      item.antivirusStatus ??
      item.antivirus_status ??
      item.security?.antivirusStatus ??
      "Active",

    lastScan:
      item.lastScan ??
      item.last_scan ??
      item.security?.lastScan ??
      "",

    healthStatus:
      item.healthStatus ??
      item.health_status ??
      item.status ??
      "Unknown",

    lastChecked:
      item.lastChecked ??
      item.last_checked ??
      item.lastInspection ??
      item.checkedAt ??
      item.checked_at ??
      "",

    checkedBy:
      item.checkedBy ??
      item.checked_by ??
      "",

    department:
      item.department ??
      item.departmentName ??
      item.department_name ??
      item.asset?.department ??
      "",

    location:
      item.location ??
      item.locationName ??
      item.asset?.location ??
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

function getHealthClasses(status) {
  switch (String(status).toLowerCase()) {
    case "healthy":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";

    case "good":
      return "border-green-200 bg-green-50 text-green-700";

    case "warning":
      return "border-amber-200 bg-amber-50 text-amber-700";

    case "critical":
      return "border-red-200 bg-red-50 text-red-700";

    case "offline":
      return "border-slate-300 bg-slate-100 text-slate-600";

    default:
      return "border-slate-200 bg-slate-100 text-slate-600";
  }
}

function getMetricColor(value, type = "normal") {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "text-slate-700";
  }

  if (type === "temperature") {
    if (number >= 80) return "text-red-600";
    if (number >= 65) return "text-amber-600";
    return "text-emerald-600";
  }

  if (number >= 90) return "text-red-600";
  if (number >= 75) return "text-amber-600";

  return "text-emerald-600";
}

function getProgressClasses(value, type = "normal") {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "bg-slate-200";
  }

  if (type === "temperature") {
    if (number >= 80) return "bg-red-500";
    if (number >= 65) return "bg-amber-500";
    return "bg-emerald-500";
  }

  if (number >= 90) return "bg-red-500";
  if (number >= 75) return "bg-amber-500";

  return "bg-emerald-500";
}

function getDeviceIcon(type) {
  switch (String(type).toLowerCase()) {
    case "server":
      return Server;

    case "network device":
      return Network;

    case "printer":
      return Activity;

    case "mobile device":
      return Wifi;

    default:
      return Monitor;
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

function MetricBar({ label, value, suffix = "%" }) {
  const number = Number(value);

  const safeValue = Number.isFinite(number)
    ? Math.max(0, Math.min(100, number))
    : 0;

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500">
          {label}
        </span>

        <span
          className={`text-xs font-semibold ${getMetricColor(
            number
          )}`}
        >
          {Number.isFinite(number)
            ? `${number}${suffix}`
            : "—"}
        </span>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all ${getProgressClasses(
            number
          )}`}
          style={{ width: `${safeValue}%` }}
        />
      </div>
    </div>
  );
}

export default function DeviceHealth() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [healthFilter, setHealthFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");

  const [page, setPage] = useState(1);

  const [showForm, setShowForm] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const [editingDevice, setEditingDevice] =
    useState(null);
  const [selectedDevice, setSelectedDevice] =
    useState(null);

  const [form, setForm] = useState(initialForm);

  const loadDevices = async () => {
    setLoading(true);
    setError("");

    try {
      const data = await apiRequest("/ict/device-health?limit=50");
      setDevices(
        extractArray(data).map(normalizeDevice)
      );
    } catch (err) {
      setError(
        err.message ||
          "Unable to load device health data."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDevices();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, healthFilter, typeFilter]);

  const statistics = useMemo(() => {
    const total = devices.length;

    const healthy = devices.filter(
      (item) =>
        item.healthStatus === "Healthy" ||
        item.healthStatus === "Good"
    ).length;

    const warning = devices.filter(
      (item) =>
        item.healthStatus === "Warning"
    ).length;

    const critical = devices.filter(
      (item) =>
        item.healthStatus === "Critical"
    ).length;

    const offline = devices.filter(
      (item) =>
        item.healthStatus === "Offline"
    ).length;

    const connected = devices.filter(
      (item) =>
        String(item.networkStatus).toLowerCase() ===
        "connected"
    ).length;

    return {
      total,
      healthy,
      warning,
      critical,
      offline,
      connected,
    };
  }, [devices]);

  const filteredDevices = useMemo(() => {
    const query = search.trim().toLowerCase();

    return devices.filter((device) => {
      const searchable = [
        device.assetTag,
        device.assetName,
        device.deviceType,
        device.serialNumber,
        device.ipAddress,
        device.macAddress,
        device.operatingSystem,
        device.processor,
        device.department,
        device.location,
        device.checkedBy,
        device.healthStatus,
        device.networkStatus,
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !query || searchable.includes(query);

      const matchesHealth =
        healthFilter === "All" ||
        device.healthStatus.toLowerCase() ===
          healthFilter.toLowerCase();

      const matchesType =
        typeFilter === "All" ||
        device.deviceType.toLowerCase() ===
          typeFilter.toLowerCase();

      return (
        matchesSearch &&
        matchesHealth &&
        matchesType
      );
    });
  }, [
    devices,
    search,
    healthFilter,
    typeFilter,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(
      filteredDevices.length / PAGE_SIZE
    )
  );

  const paginatedDevices = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;

    return filteredDevices.slice(
      start,
      start + PAGE_SIZE
    );
  }, [filteredDevices, page]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const openCreate = () => {
    setEditingDevice(null);

    setForm({
      ...initialForm,
      lastChecked: new Date()
        .toISOString()
        .slice(0, 10),
    });

    setShowForm(true);
  };

  const openEdit = (device) => {
    setEditingDevice(device);

    const dateOnly = (value) =>
      value?.slice?.(0, 10) || "";

    setForm({
      assetTag: device.assetTag || "",
      assetName: device.assetName || "",
      deviceType:
        device.deviceType || "Desktop",
      serialNumber:
        device.serialNumber || "",
      ipAddress: device.ipAddress || "",
      macAddress: device.macAddress || "",
      operatingSystem:
        device.operatingSystem || "",
      osVersion: device.osVersion || "",
      processor: device.processor || "",
      ram: device.ram || "",
      storage: device.storage || "",
      uptime: device.uptime || "",
      cpuUsage: device.cpuUsage ?? "",
      memoryUsage: device.memoryUsage ?? "",
      diskUsage: device.diskUsage ?? "",
      temperature: device.temperature ?? "",
      batteryHealth:
        device.batteryHealth ?? "",
      networkStatus:
        device.networkStatus || "Connected",
      antivirusStatus:
        device.antivirusStatus || "Active",
      lastScan: dateOnly(device.lastScan),
      healthStatus:
        device.healthStatus || "Healthy",
      lastChecked: dateOnly(
        device.lastChecked
      ),
      checkedBy: device.checkedBy || "",
      department: device.department || "",
      location: device.location || "",
      notes: device.notes || "",
    });

    setShowForm(true);
  };

  const openDetails = (device) => {
    setSelectedDevice(device);
    setShowDetails(true);
  };

  const closeModals = () => {
    if (saving) return;

    setShowForm(false);
    setShowDetails(false);
    setEditingDevice(null);
    setSelectedDevice(null);
  };

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const saveDevice = async (event) => {
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
      deviceType: form.deviceType,
      serialNumber: form.serialNumber,
      ipAddress: form.ipAddress,
      macAddress: form.macAddress,
      operatingSystem: form.operatingSystem,
      osVersion: form.osVersion,
      processor: form.processor,
      ram: form.ram,
      storage: form.storage,
      uptime: Number(form.uptime) || 0,
      cpuUsage: Number(form.cpuUsage) || 0,
      memoryUsage:
        Number(form.memoryUsage) || 0,
      diskUsage:
        Number(form.diskUsage) || 0,
      temperature:
        Number(form.temperature) || 0,
      batteryHealth:
        Number(form.batteryHealth) || 0,
      networkStatus: form.networkStatus,
      antivirusStatus:
        form.antivirusStatus,
      lastScan: form.lastScan,
      healthStatus: form.healthStatus,
      lastChecked: form.lastChecked,
      checkedBy: form.checkedBy,
      department: form.department,
      location: form.location,
      notes: form.notes,
    };

    try {
      if (editingDevice) {
        let response;

        try {
          response = await apiRequest(
            `/device-health/${editingDevice.id}`,
            {
              method: "PUT",
              body: JSON.stringify(payload),
            }
          );
        } catch {
          try {
            response = await apiRequest(
              `/deviceHealth/${editingDevice.id}`,
              {
                method: "PUT",
                body: JSON.stringify(payload),
              }
            );
          } catch {
            response = await apiRequest(
              `/devices/health/${editingDevice.id}`,
              {
                method: "PUT",
                body: JSON.stringify(payload),
              }
            );
          }
        }

        const updated = normalizeDevice(
          response?.data ||
            response ||
            payload,
          0
        );

        setDevices((current) =>
          current.map((item) =>
            item.id === editingDevice.id
              ? {
                  ...item,
                  ...updated,
                  id: editingDevice.id,
                }
              : item
          )
        );
      } else {
        let response;

        try {
          response = await apiRequest(
            "/device-health",
            {
              method: "POST",
              body: JSON.stringify(payload),
            }
          );
        } catch {
          try {
            response = await apiRequest(
              "/deviceHealth",
              {
                method: "POST",
                body: JSON.stringify(payload),
              }
            );
          } catch {
            response = await apiRequest(
              "/devices/health",
              {
                method: "POST",
                body: JSON.stringify(payload),
              }
            );
          }
        }

        const created = normalizeDevice(
          response?.data ||
            response ||
            payload,
          devices.length
        );

        setDevices((current) => [
          created,
          ...current,
        ]);
      }

      setForm(initialForm);
      setEditingDevice(null);
      setShowForm(false);
    } catch (err) {
      setError(
        err.message ||
          "Unable to save device health record."
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteDevice = async (device) => {
    const confirmed = window.confirm(
      `Delete health record for ${device.assetTag}?`
    );

    if (!confirmed) return;

    setError("");

    try {
      try {
        await apiRequest(
          `/device-health/${device.id}`,
          {
            method: "DELETE",
          }
        );
      } catch {
        try {
          await apiRequest(
            `/deviceHealth/${device.id}`,
            {
              method: "DELETE",
            }
          );
        } catch {
          await apiRequest(
            `/devices/health/${device.id}`,
            {
              method: "DELETE",
            }
          );
        }
      }

      setDevices((current) =>
        current.filter(
          (item) => item.id !== device.id
        )
      );

      if (
        selectedDevice?.id === device.id
      ) {
        setSelectedDevice(null);
        setShowDetails(false);
      }
    } catch (err) {
      setError(
        err.message ||
          "Unable to delete health record."
      );
    }
  };

  const exportCSV = () => {
    if (!filteredDevices.length) return;

    const headers = [
      "Asset Tag",
      "Asset Name",
      "Device Type",
      "Serial Number",
      "IP Address",
      "MAC Address",
      "Operating System",
      "OS Version",
      "Processor",
      "RAM",
      "Storage",
      "Uptime",
      "CPU Usage",
      "Memory Usage",
      "Disk Usage",
      "Temperature",
      "Battery Health",
      "Network Status",
      "Antivirus Status",
      "Last Scan",
      "Health Status",
      "Last Checked",
      "Checked By",
      "Department",
      "Location",
      "Notes",
    ];

    const rows = filteredDevices.map(
      (device) => [
        device.assetTag,
        device.assetName,
        device.deviceType,
        device.serialNumber,
        device.ipAddress,
        device.macAddress,
        device.operatingSystem,
        device.osVersion,
        device.processor,
        device.ram,
        device.storage,
        device.uptime,
        device.cpuUsage,
        device.memoryUsage,
        device.diskUsage,
        device.temperature,
        device.batteryHealth,
        device.networkStatus,
        device.antivirusStatus,
        device.lastScan,
        device.healthStatus,
        device.lastChecked,
        device.checkedBy,
        device.department,
        device.location,
        device.notes,
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
    link.download = `device-health-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 ict-module-theme ict-theme-device-health">
      <div className="mx-auto max-w-[1600px] space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between ict-page-header">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
              <Activity size={16} />

              <span>ICT Operations</span>

              <span>/</span>

              <span className="text-slate-700">
                Device Health
              </span>
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl ict-page-title">
              Device Health
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Monitor ICT device condition, performance,
              connectivity, security, and system health.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={loadDevices}
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
              disabled={!filteredDevices.length}
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
              Add Health Record
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <SummaryCard
            title="Total Devices"
            value={statistics.total}
            subtitle="Tracked health records"
            icon={Monitor}
            iconClass="bg-blue-50 text-blue-600"
          />

          <SummaryCard
            title="Healthy"
            value={statistics.healthy}
            subtitle="Healthy or good"
            icon={CheckCircle2}
            iconClass="bg-emerald-50 text-emerald-600"
          />

          <SummaryCard
            title="Warnings"
            value={statistics.warning}
            subtitle="Needs attention"
            icon={AlertCircle}
            iconClass="bg-amber-50 text-amber-600"
          />

          <SummaryCard
            title="Critical"
            value={statistics.critical}
            subtitle="Immediate attention"
            icon={Activity}
            iconClass="bg-red-50 text-red-600"
          />

          <SummaryCard
            title="Offline"
            value={statistics.offline}
            subtitle={`${statistics.connected} connected`}
            icon={Wifi}
            iconClass="bg-slate-100 text-slate-600"
          />
        </div>

        {/* Main table */}
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
                  placeholder="Search asset, IP, serial, OS, location..."
                  className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm outline-none placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <select
                  value={healthFilter}
                  onChange={(event) =>
                    setHealthFilter(
                      event.target.value
                    )
                  }
                  className="h-10 min-w-[145px] rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="All">
                    All Health Status
                  </option>

                  {HEALTH_STATUSES.map(
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
                  value={typeFilter}
                  onChange={(event) =>
                    setTypeFilter(
                      event.target.value
                    )
                  }
                  className="h-10 min-w-[155px] rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="All">
                    All Device Types
                  </option>

                  {DEVICE_TYPES.map(
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
                    Device
                  </th>

                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Network
                  </th>

                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    CPU
                  </th>

                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Memory
                  </th>

                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Disk
                  </th>

                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Temperature
                  </th>

                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Security
                  </th>

                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Health
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
                ) : paginatedDevices.length ===
                  0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-6 py-16 text-center"
                    >
                      <div className="mx-auto flex max-w-sm flex-col items-center">
                        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                          <Activity size={27} />
                        </div>

                        <h3 className="text-base font-semibold text-slate-900">
                          No device health records
                        </h3>

                        <p className="mt-1 text-sm text-slate-500">
                          Change your filters or add a
                          new health record.
                        </p>

                        <button
                          type="button"
                          onClick={openCreate}
                          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                        >
                          <Plus size={16} />
                          Add Health Record
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedDevices.map(
                    (device) => {
                      const DeviceIcon =
                        getDeviceIcon(
                          device.deviceType
                        );

                      return (
                        <tr
                          key={device.id}
                          className="group transition hover:bg-slate-50/80"
                        >
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                                <DeviceIcon
                                  size={17}
                                />
                              </div>

                              <div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    openDetails(
                                      device
                                    )
                                  }
                                  className="font-semibold text-blue-600 hover:text-blue-700"
                                >
                                  {device.assetTag ||
                                    "No asset tag"}
                                </button>

                                <div className="mt-0.5 max-w-[210px] truncate text-sm font-medium text-slate-700">
                                  {device.assetName ||
                                    "ICT Device"}
                                </div>

                                <div className="mt-0.5 text-xs text-slate-400">
                                  {device.deviceType}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2">
                              <div
                                className={`h-2.5 w-2.5 rounded-full ${
                                  String(
                                    device.networkStatus
                                  ).toLowerCase() ===
                                  "connected"
                                    ? "bg-emerald-500"
                                    : "bg-red-500"
                                }`}
                              />

                              <div>
                                <div className="text-sm font-medium text-slate-700">
                                  {device.networkStatus ||
                                    "Unknown"}
                                </div>

                                <div className="mt-0.5 text-xs text-slate-400">
                                  {device.ipAddress ||
                                    "No IP"}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="w-[150px] px-5 py-4">
                            <MetricBar
                              label="Usage"
                              value={
                                device.cpuUsage
                              }
                            />
                          </td>

                          <td className="w-[150px] px-5 py-4">
                            <MetricBar
                              label="Usage"
                              value={
                                device.memoryUsage
                              }
                            />
                          </td>

                          <td className="w-[150px] px-5 py-4">
                            <MetricBar
                              label="Usage"
                              value={
                                device.diskUsage
                              }
                            />
                          </td>

                          <td className="px-5 py-4">
                            <div
                              className={`text-sm font-semibold ${getMetricColor(
                                device.temperature,
                                "temperature"
                              )}`}
                            >
                              {device.temperature !==
                              "" &&
                              device.temperature !==
                                null
                                ? `${device.temperature}°C`
                                : "—"}
                            </div>

                            <div className="mt-1 text-xs text-slate-400">
                              System temperature
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2">
                              <ShieldCheck
                                size={16}
                                className={
                                  String(
                                    device.antivirusStatus
                                  ).toLowerCase() ===
                                  "active"
                                    ? "text-emerald-500"
                                    : "text-red-500"
                                }
                              />

                              <div>
                                <div className="text-sm font-medium text-slate-700">
                                  {device.antivirusStatus ||
                                    "Unknown"}
                                </div>

                                <div className="mt-0.5 text-xs text-slate-400">
                                  Last scan:{" "}
                                  {formatDate(
                                    device.lastScan
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            <span
                              className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getHealthClasses(
                                device.healthStatus
                              )}`}
                            >
                              {device.healthStatus}
                            </span>

                            <div className="mt-1 text-xs text-slate-400">
                              {formatDate(
                                device.lastChecked
                              )}
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex justify-end gap-1">
                              <button
                                type="button"
                                title="View health"
                                onClick={() =>
                                  openDetails(
                                    device
                                  )
                                }
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                              >
                                <Eye size={16} />
                              </button>

                              <button
                                type="button"
                                title="Edit health"
                                onClick={() =>
                                  openEdit(device)
                                }
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                              >
                                <Pencil
                                  size={16}
                                />
                              </button>

                              <button
                                type="button"
                                title="Delete health record"
                                onClick={() =>
                                  deleteDevice(
                                    device
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
                      );
                    }
                  )
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!loading &&
            filteredDevices.length > 0 && (
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
                      filteredDevices.length
                    )}
                  </span>{" "}
                  of{" "}
                  <span className="font-medium text-slate-700">
                    {filteredDevices.length}
                  </span>{" "}
                  devices
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
            editingDevice
              ? "Edit Device Health"
              : "Add Device Health"
          }
          icon={editingDevice ? Pencil : Activity}
          onClose={closeModals}
          large
        >
          <form onSubmit={saveDevice}>
            <div className="max-h-[72vh] overflow-y-auto px-6 py-5">
              <div className="space-y-7">
                {/* Device Information */}
                <section>
                  <div className="mb-4 flex items-center gap-2">
                    <Monitor
                      size={18}
                      className="text-blue-600"
                    />

                    <h3 className="text-sm font-semibold text-slate-900">
                      Device Information
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
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
                      placeholder="Desktop Computer"
                    />

                    <SelectField
                      label="Device Type"
                      name="deviceType"
                      value={form.deviceType}
                      onChange={handleChange}
                      options={DEVICE_TYPES}
                    />

                    <InputField
                      label="Serial Number"
                      name="serialNumber"
                      value={form.serialNumber}
                      onChange={handleChange}
                      placeholder="Serial number"
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
                  </div>
                </section>

                {/* Network */}
                <section>
                  <div className="mb-4 flex items-center gap-2">
                    <Network
                      size={18}
                      className="text-blue-600"
                    />

                    <h3 className="text-sm font-semibold text-slate-900">
                      Network Information
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                    <InputField
                      label="IP Address"
                      name="ipAddress"
                      value={form.ipAddress}
                      onChange={handleChange}
                      placeholder="192.168.1.100"
                    />

                    <InputField
                      label="MAC Address"
                      name="macAddress"
                      value={form.macAddress}
                      onChange={handleChange}
                      placeholder="00:00:00:00:00:00"
                    />

                    <SelectField
                      label="Network Status"
                      name="networkStatus"
                      value={form.networkStatus}
                      onChange={handleChange}
                      options={[
                        "Connected",
                        "Disconnected",
                        "Limited",
                        "Unknown",
                      ]}
                    />
                  </div>
                </section>

                {/* System */}
                <section>
                  <div className="mb-4 flex items-center gap-2">
                    <Cpu
                      size={18}
                      className="text-blue-600"
                    />

                    <h3 className="text-sm font-semibold text-slate-900">
                      System Configuration
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <InputField
                      label="Operating System"
                      name="operatingSystem"
                      value={
                        form.operatingSystem
                      }
                      onChange={handleChange}
                      placeholder="Windows / Linux / macOS"
                    />

                    <InputField
                      label="OS Version"
                      name="osVersion"
                      value={form.osVersion}
                      onChange={handleChange}
                      placeholder="Version"
                    />

                    <InputField
                      label="Processor"
                      name="processor"
                      value={form.processor}
                      onChange={handleChange}
                      placeholder="Intel Core i5"
                    />

                    <InputField
                      label="RAM"
                      name="ram"
                      value={form.ram}
                      onChange={handleChange}
                      placeholder="16 GB"
                    />

                    <InputField
                      label="Storage"
                      name="storage"
                      value={form.storage}
                      onChange={handleChange}
                      placeholder="512 GB SSD"
                    />

                    <InputField
                      label="Uptime (Hours)"
                      name="uptime"
                      type="number"
                      value={form.uptime}
                      onChange={handleChange}
                      placeholder="0"
                    />
                  </div>
                </section>

                {/* Performance */}
                <section>
                  <div className="mb-4 flex items-center gap-2">
                    <Activity
                      size={18}
                      className="text-blue-600"
                    />

                    <h3 className="text-sm font-semibold text-slate-900">
                      Performance Metrics
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-5">
                    <InputField
                      label="CPU Usage (%)"
                      name="cpuUsage"
                      type="number"
                      value={form.cpuUsage}
                      onChange={handleChange}
                      placeholder="0"
                    />

                    <InputField
                      label="Memory Usage (%)"
                      name="memoryUsage"
                      type="number"
                      value={form.memoryUsage}
                      onChange={handleChange}
                      placeholder="0"
                    />

                    <InputField
                      label="Disk Usage (%)"
                      name="diskUsage"
                      type="number"
                      value={form.diskUsage}
                      onChange={handleChange}
                      placeholder="0"
                    />

                    <InputField
                      label="Temperature (°C)"
                      name="temperature"
                      type="number"
                      value={form.temperature}
                      onChange={handleChange}
                      placeholder="0"
                    />

                    <InputField
                      label="Battery Health (%)"
                      name="batteryHealth"
                      type="number"
                      value={
                        form.batteryHealth
                      }
                      onChange={handleChange}
                      placeholder="100"
                    />
                  </div>
                </section>

                {/* Security */}
                <section>
                  <div className="mb-4 flex items-center gap-2">
                    <ShieldCheck
                      size={18}
                      className="text-blue-600"
                    />

                    <h3 className="text-sm font-semibold text-slate-900">
                      Security
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                    <SelectField
                      label="Antivirus Status"
                      name="antivirusStatus"
                      value={
                        form.antivirusStatus
                      }
                      onChange={handleChange}
                      options={[
                        "Active",
                        "Inactive",
                        "Expired",
                        "Not Installed",
                        "Unknown",
                      ]}
                    />

                    <InputField
                      label="Last Security Scan"
                      name="lastScan"
                      type="date"
                      value={form.lastScan}
                      onChange={handleChange}
                    />

                    <SelectField
                      label="Health Status"
                      name="healthStatus"
                      value={form.healthStatus}
                      onChange={handleChange}
                      options={HEALTH_STATUSES}
                    />
                  </div>
                </section>

                {/* Verification */}
                <section>
                  <div className="mb-4 flex items-center gap-2">
                    <CheckCircle2
                      size={18}
                      className="text-blue-600"
                    />

                    <h3 className="text-sm font-semibold text-slate-900">
                      Health Verification
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <InputField
                      label="Last Checked"
                      name="lastChecked"
                      type="date"
                      value={form.lastChecked}
                      onChange={handleChange}
                    />

                    <InputField
                      label="Checked By"
                      name="checkedBy"
                      value={form.checkedBy}
                      onChange={handleChange}
                      placeholder="ICT technician"
                    />
                  </div>
                </section>

                <TextAreaField
                  label="Notes"
                  name="notes"
                  value={form.notes}
                  onChange={handleChange}
                  placeholder="Additional device health observations..."
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

                {editingDevice
                  ? "Save Changes"
                  : "Add Health Record"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Details Modal */}
      {showDetails && selectedDevice && (
        <Modal
          title="Device Health Details"
          icon={Activity}
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
                      getDeviceIcon(
                        selectedDevice.deviceType
                      ),
                      { size: 24 }
                    )}
                  </div>

                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      {selectedDevice.assetTag ||
                        "No asset tag"}
                    </div>

                    <h2 className="mt-1 text-xl font-bold text-slate-900">
                      {selectedDevice.assetName ||
                        "ICT Device"}
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      {selectedDevice.deviceType}
                      {selectedDevice.serialNumber
                        ? ` • ${selectedDevice.serialNumber}`
                        : ""}
                    </p>
                  </div>
                </div>

                <span
                  className={`inline-flex w-fit rounded-full border px-3 py-1.5 text-xs font-semibold ${getHealthClasses(
                    selectedDevice.healthStatus
                  )}`}
                >
                  {selectedDevice.healthStatus}
                </span>
              </div>
            </div>

            <div className="space-y-6 px-6 py-6">
              {/* Performance overview */}
              <section>
                <h3 className="mb-3 text-sm font-semibold text-slate-900">
                  Performance Overview
                </h3>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="rounded-xl border border-slate-200 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Cpu
                          size={17}
                          className="text-blue-600"
                        />

                        <span className="text-sm font-medium text-slate-700">
                          CPU
                        </span>
                      </div>

                      <span
                        className={`text-sm font-bold ${getMetricColor(
                          selectedDevice.cpuUsage
                        )}`}
                      >
                        {selectedDevice.cpuUsage !==
                        ""
                          ? `${selectedDevice.cpuUsage}%`
                          : "—"}
                      </span>
                    </div>

                    <MetricBar
                      label="Current usage"
                      value={
                        selectedDevice.cpuUsage
                      }
                    />
                  </div>

                  <div className="rounded-xl border border-slate-200 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Activity
                          size={17}
                          className="text-blue-600"
                        />

                        <span className="text-sm font-medium text-slate-700">
                          Memory
                        </span>
                      </div>

                      <span
                        className={`text-sm font-bold ${getMetricColor(
                          selectedDevice.memoryUsage
                        )}`}
                      >
                        {selectedDevice.memoryUsage !==
                        ""
                          ? `${selectedDevice.memoryUsage}%`
                          : "—"}
                      </span>
                    </div>

                    <MetricBar
                      label="Current usage"
                      value={
                        selectedDevice.memoryUsage
                      }
                    />
                  </div>

                  <div className="rounded-xl border border-slate-200 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <HardDrive
                          size={17}
                          className="text-blue-600"
                        />

                        <span className="text-sm font-medium text-slate-700">
                          Disk
                        </span>
                      </div>

                      <span
                        className={`text-sm font-bold ${getMetricColor(
                          selectedDevice.diskUsage
                        )}`}
                      >
                        {selectedDevice.diskUsage !==
                        ""
                          ? `${selectedDevice.diskUsage}%`
                          : "—"}
                      </span>
                    </div>

                    <MetricBar
                      label="Used capacity"
                      value={
                        selectedDevice.diskUsage
                      }
                    />
                  </div>
                </div>
              </section>

              {/* Device information */}
              <section>
                <h3 className="mb-3 text-sm font-semibold text-slate-900">
                  Device Information
                </h3>

                <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 p-4 md:grid-cols-4">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      Asset Tag
                    </p>

                    <p className="mt-1 text-sm font-semibold text-slate-800">
                      {selectedDevice.assetTag ||
                        "—"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      Serial Number
                    </p>

                    <p className="mt-1 text-sm font-semibold text-slate-800">
                      {selectedDevice.serialNumber ||
                        "—"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      Operating System
                    </p>

                    <p className="mt-1 text-sm font-semibold text-slate-800">
                      {selectedDevice.operatingSystem ||
                        "—"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      OS Version
                    </p>

                    <p className="mt-1 text-sm font-semibold text-slate-800">
                      {selectedDevice.osVersion ||
                        "—"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      Processor
                    </p>

                    <p className="mt-1 text-sm font-semibold text-slate-800">
                      {selectedDevice.processor ||
                        "—"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      RAM
                    </p>

                    <p className="mt-1 text-sm font-semibold text-slate-800">
                      {selectedDevice.ram ||
                        "—"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      Storage
                    </p>

                    <p className="mt-1 text-sm font-semibold text-slate-800">
                      {selectedDevice.storage ||
                        "—"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      Uptime
                    </p>

                    <p className="mt-1 text-sm font-semibold text-slate-800">
                      {selectedDevice.uptime
                        ? `${selectedDevice.uptime} hours`
                        : "—"}
                    </p>
                  </div>
                </div>
              </section>

              {/* Network */}
              <section>
                <h3 className="mb-3 text-sm font-semibold text-slate-900">
                  Network
                </h3>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                  <div className="rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center gap-2">
                      <Wifi
                        size={17}
                        className="text-blue-600"
                      />

                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Status
                      </span>
                    </div>

                    <p className="mt-2 text-sm font-semibold text-slate-800">
                      {selectedDevice.networkStatus ||
                        "Unknown"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-4">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      IP Address
                    </span>

                    <p className="mt-2 text-sm font-semibold text-slate-800">
                      {selectedDevice.ipAddress ||
                        "—"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-4">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      MAC Address
                    </span>

                    <p className="mt-2 break-all text-sm font-semibold text-slate-800">
                      {selectedDevice.macAddress ||
                        "—"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-4">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Location
                    </span>

                    <p className="mt-2 text-sm font-semibold text-slate-800">
                      {selectedDevice.location ||
                        "—"}
                    </p>
                  </div>
                </div>
              </section>

              {/* Health indicators */}
              <section>
                <h3 className="mb-3 text-sm font-semibold text-slate-900">
                  Health Indicators
                </h3>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Activity
                          size={17}
                          className="text-blue-600"
                        />

                        <span className="text-sm font-medium text-slate-700">
                          Temperature
                        </span>
                      </div>

                      <span
                        className={`text-lg font-bold ${getMetricColor(
                          selectedDevice.temperature,
                          "temperature"
                        )}`}
                      >
                        {selectedDevice.temperature !==
                        ""
                          ? `${selectedDevice.temperature}°C`
                          : "—"}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Battery
                          size={17}
                          className="text-blue-600"
                        />

                        <span className="text-sm font-medium text-slate-700">
                          Battery
                        </span>
                      </div>

                      <span
                        className={`text-lg font-bold ${getMetricColor(
                          selectedDevice.batteryHealth
                        )}`}
                      >
                        {selectedDevice.batteryHealth !==
                        ""
                          ? `${selectedDevice.batteryHealth}%`
                          : "—"}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ShieldCheck
                          size={17}
                          className="text-blue-600"
                        />

                        <span className="text-sm font-medium text-slate-700">
                          Antivirus
                        </span>
                      </div>

                      <span className="text-sm font-bold text-slate-800">
                        {selectedDevice.antivirusStatus ||
                          "Unknown"}
                      </span>
                    </div>

                    <p className="mt-2 text-xs text-slate-400">
                      Last scan:{" "}
                      {formatDate(
                        selectedDevice.lastScan
                      )}
                    </p>
                  </div>
                </div>
              </section>

              {/* Verification */}
              <section>
                <h3 className="mb-3 text-sm font-semibold text-slate-900">
                  Health Verification
                </h3>

                <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 p-4 md:grid-cols-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Health Status
                    </p>

                    <span
                      className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getHealthClasses(
                        selectedDevice.healthStatus
                      )}`}
                    >
                      {selectedDevice.healthStatus}
                    </span>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Last Checked
                    </p>

                    <p className="mt-2 text-sm font-semibold text-slate-800">
                      {formatDate(
                        selectedDevice.lastChecked
                      )}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Checked By
                    </p>

                    <p className="mt-2 text-sm font-semibold text-slate-800">
                      {selectedDevice.checkedBy ||
                        "—"}
                    </p>
                  </div>
                </div>
              </section>

              {/* Notes */}
              {selectedDevice.notes && (
                <section>
                  <h3 className="mb-3 text-sm font-semibold text-slate-900">
                    Notes
                  </h3>

                  <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4">
                    <div className="flex gap-3">
                      <Info
                        size={18}
                        className="mt-0.5 shrink-0 text-blue-600"
                      />

                      <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                        {selectedDevice.notes}
                      </p>
                    </div>
                  </div>
                </section>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
              <button
                type="button"
                onClick={() => {
                  setShowDetails(false);
                  openEdit(selectedDevice);
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <Pencil size={16} />
                Edit Health
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