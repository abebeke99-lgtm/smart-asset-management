/* eslint-disable no-unused-vars, no-dupe-keys, no-template-curly-in-string */
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useMemo, useState } from "react";
import { withMaintenanceAuth } from "./maintenanceAuth";

const API = "/api";

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f5f7fb",
    padding: "24px",
    color: "#172033",
    fontFamily:
      "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },

  container: {
    maxWidth: "1500px",
    margin: "0 auto",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "20px",
    marginBottom: "24px",
    flexWrap: "wrap",
  },

  title: {
    margin: 0,
    fontSize: "28px",
    fontWeight: 800,
  },

  subtitle: {
    margin: "7px 0 0",
    color: "#667085",
    fontSize: "14px",
  },

  primaryButton: {
    border: "none",
    background: "#175cd3",
    color: "#fff",
    padding: "11px 17px",
    borderRadius: "9px",
    cursor: "pointer",
    fontWeight: 700,
  },

  secondaryButton: {
    border: "1px solid #d9dee8",
    background: "#fff",
    color: "#344054",
    padding: "10px 15px",
    borderRadius: "9px",
    cursor: "pointer",
    fontWeight: 650,
  },

  cards: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
    gap: "16px",
    marginBottom: "22px",
  },

  card: {
    background: "#fff",
    border: "1px solid #e5e9f0",
    borderRadius: "14px",
    padding: "18px",
    boxShadow: "0 3px 12px rgba(15, 23, 42, 0.04)",
  },

  cardLabel: {
    color: "#667085",
    fontSize: "13px",
    fontWeight: 650,
    marginBottom: "8px",
  },

  cardValue: {
    fontSize: "28px",
    fontWeight: 800,
  },

  toolbar: {
    background: "#fff",
    border: "1px solid #e5e9f0",
    borderRadius: "14px",
    padding: "16px",
    marginBottom: "18px",
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
  },

  input: {
    flex: "1 1 270px",
    minWidth: "230px",
    border: "1px solid #d9dee8",
    borderRadius: "9px",
    padding: "11px 13px",
    outline: "none",
    fontSize: "14px",
  },

  select: {
    minWidth: "160px",
    border: "1px solid #d9dee8",
    borderRadius: "9px",
    padding: "11px 13px",
    outline: "none",
    fontSize: "14px",
    background: "#fff",
  },

  tableCard: {
    background: "#fff",
    border: "1px solid #e5e9f0",
    borderRadius: "14px",
    overflow: "hidden",
    boxShadow: "0 3px 12px rgba(15, 23, 42, 0.04)",
  },

  tableHeader: {
    padding: "17px 18px",
    borderBottom: "1px solid #e9edf3",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "12px",
  },

  tableTitle: {
    margin: 0,
    fontSize: "16px",
    fontWeight: 800,
  },

  tableWrapper: {
    overflowX: "auto",
  },

  table: {
    width: "100%",
    minWidth: "1050px",
    borderCollapse: "collapse",
  },

  th: {
    textAlign: "left",
    padding: "13px 15px",
    background: "#f8fafc",
    borderBottom: "1px solid #e5e9f0",
    color: "#667085",
    fontSize: "12px",
    fontWeight: 800,
    textTransform: "uppercase",
  },

  td: {
    padding: "14px 15px",
    borderBottom: "1px solid #eef1f5",
    fontSize: "13px",
    color: "#344054",
    verticalAlign: "middle",
  },

  strong: {
    fontWeight: 750,
    color: "#172033",
  },

  secondary: {
    display: "block",
    marginTop: "3px",
    color: "#8a94a6",
    fontSize: "12px",
  },

  badge: {
    display: "inline-flex",
    padding: "5px 9px",
    borderRadius: "999px",
    fontSize: "11px",
    fontWeight: 800,
    whiteSpace: "nowrap",
  },

  actions: {
    display: "flex",
    gap: "7px",
    flexWrap: "wrap",
  },

  actionButton: {
    border: "1px solid #d9dee8",
    background: "#fff",
    color: "#344054",
    padding: "7px 10px",
    borderRadius: "7px",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: 700,
  },

  dangerButton: {
    border: "1px solid #fda4af",
    background: "#fff",
    color: "#b42318",
    padding: "7px 10px",
    borderRadius: "7px",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: 700,
  },

  empty: {
    padding: "45px 20px",
    textAlign: "center",
    color: "#667085",
  },

  loading: {
    padding: "45px 20px",
    textAlign: "center",
    color: "#667085",
  },

  error: {
    background: "#fff1f2",
    border: "1px solid #fecdd3",
    color: "#b42318",
    borderRadius: "10px",
    padding: "12px 14px",
    marginBottom: "16px",
    fontSize: "13px",
  },

  modalOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 1000,
    background: "rgba(15, 23, 42, 0.48)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
  },

  modal: {
    width: "100%",
    maxWidth: "720px",
    maxHeight: "92vh",
    overflowY: "auto",
    background: "#fff",
    borderRadius: "16px",
    boxShadow: "0 20px 60px rgba(15, 23, 42, 0.25)",
  },

  modalHeader: {
    padding: "18px 20px",
    borderBottom: "1px solid #e5e9f0",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },

  modalTitle: {
    margin: 0,
    fontSize: "18px",
    fontWeight: 800,
  },

  closeButton: {
    width: "34px",
    height: "34px",
    border: "none",
    borderRadius: "50%",
    background: "#f2f4f7",
    cursor: "pointer",
    fontSize: "19px",
    color: "#475467",
  },

  modalBody: {
    padding: "20px",
  },

  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "15px",
  },

  formGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },

  full: {
    gridColumn: "1 / -1",
  },

  label: {
    fontSize: "12px",
    fontWeight: 750,
    color: "#344054",
  },

  field: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #d9dee8",
    borderRadius: "9px",
    padding: "10px 12px",
    fontSize: "14px",
    outline: "none",
    background: "#fff",
  },

  textarea: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #d9dee8",
    borderRadius: "9px",
    padding: "10px 12px",
    fontSize: "14px",
    outline: "none",
    minHeight: "90px",
    resize: "vertical",
    fontFamily: "inherit",
  },

  modalFooter: {
    marginTop: "20px",
    paddingTop: "16px",
    borderTop: "1px solid #e5e9f0",
    display: "flex",
    justifyContent: "flex-end",
    gap: "10px",
  },

  scheduleInfo: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "12px",
    marginTop: "18px",
  },

  infoBox: {
    background: "#f8fafc",
    border: "1px solid #e8edf3",
    borderRadius: "10px",
    padding: "12px",
  },

  infoLabel: {
    display: "block",
    color: "#667085",
    fontSize: "11px",
    fontWeight: 800,
    textTransform: "uppercase",
    marginBottom: "5px",
  },

  infoValue: {
    color: "#172033",
    fontSize: "13px",
    fontWeight: 700,
  },
};

const emptyForm = {
  assetId: "",
  maintenanceType: "Preventive",
  title: "",
  description: "",
  frequency: "Monthly",
  scheduledDate: "",
  startTime: "",
  endTime: "",
  priority: "Normal",
  assignedTechnicianId: "",
  status: "Scheduled",
  notes: "",
};

function getArray(payload, keys = []) {
  if (Array.isArray(payload)) return payload;

  for (const key of keys) {
    if (Array.isArray(payload?.[key])) {
      return payload[key];
    }
  }

  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  return [];
}

function value(obj, keys, fallback = "") {
  if (!obj) return fallback;

  for (const key of keys) {
    if (
      obj[key] !== undefined &&
      obj[key] !== null &&
      obj[key] !== ""
    ) {
      return obj[key];
    }
  }

  return fallback;
}

function formatDate(date) {
  if (!date) return "—";

  const d = new Date(date);

  if (Number.isNaN(d.getTime())) {
    return String(date);
  }

  return d.toLocaleDateString();
}

function formatDateTime(date) {
  if (!date) return "—";

  const d = new Date(date);

  if (Number.isNaN(d.getTime())) {
    return String(date);
  }

  return d.toLocaleString();
}

function normalizeStatus(status) {
  return String(status || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]/g, " ");
}

function statusStyle(status) {
  const normalized = normalizeStatus(status);

  if (
    normalized.includes("completed") ||
    normalized.includes("complete")
  ) {
    return {
      background: "#ecfdf3",
      color: "#027a48",
    };
  }

  if (
    normalized.includes("cancel") ||
    normalized.includes("failed")
  ) {
    return {
      background: "#fff1f3",
      color: "#c01048",
    };
  }

  if (
    normalized.includes("overdue") ||
    normalized.includes("urgent")
  ) {
    return {
      background: "#fff1f2",
      color: "#b42318",
    };
  }

  if (
    normalized.includes("progress") ||
    normalized.includes("active")
  ) {
    return {
      background: "#eff8ff",
      color: "#175cd3",
    };
  }

  return {
    background: "#fffaeb",
    color: "#b54708",
  };
}

function isOverdue(schedule) {
  const status = normalizeStatus(
    value(schedule, ["status"], "Scheduled")
  );

  if (
    status.includes("completed") ||
    status.includes("complete") ||
    status.includes("cancel")
  ) {
    return false;
  }

  const date = value(schedule, [
    "scheduledDate",
    "scheduled_date",
    "date",
    "startDate",
    "start_date",
  ]);

  if (!date) return false;

  const target = new Date(date);
  const now = new Date();

  target.setHours(23, 59, 59, 999);

  return target < now;
}

function getScheduleAssetId(schedule) {
  return value(schedule, [
    "assetId",
    "asset_id",
    "asset?.id",
  ]);
}

function getAssetName(asset) {
  return value(asset, [
    "name",
    "assetName",
    "asset_name",
  ], `Asset #${value(asset, ["id"], "—")}`);
}

function getAssetCode(asset) {
  return value(asset, [
    "assetCode",
    "asset_code",
    "code",
  ], "—");
}

function getTechnicianId(technician) {
  return value(technician, [
    "id",
    "technicianId",
    "technician_id",
  ]);
}

function getTechnicianName(technician) {
  return value(technician, [
    "name",
    "fullName",
    "full_name",
    "technicianName",
    "technician_name",
  ], `Technician #${getTechnicianId(technician)}`);
}

export default function Schedule() {
  const [schedules, setSchedules] = useState([]);
  const [assets, setAssets] = useState([]);
  const [technicians, setTechnicians] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const [showModal, setShowModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [selectedSchedule, setSelectedSchedule] = useState(null);

  const [form, setForm] = useState(emptyForm);

  async function request(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: withMaintenanceAuth({
        "Content-Type": "application/json",
        ...(options.headers || {}),
      }),
    });

    if (!response.ok) {
      let message = `${response.status} ${response.statusText}`;

      try {
        const body = await response.json();

        message =
          body?.message ||
          body?.error ||
          message;
      } catch {
        // Keep default HTTP error.
      }

      throw new Error(message);
    }

    if (response.status === 204) {
      return null;
    }

    return response.json();
  }

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const results = await Promise.allSettled([
        request(`${API}/maintenance/schedules`),
        request(`${API}/assets`),
        request(`${API}/maintenance/technicians`),
      ]);

      const scheduleResult = results[0];
      const assetResult = results[1];
      const technicianResult = results[2];

      if (scheduleResult.status === "fulfilled") {
        setSchedules(
          getArray(scheduleResult.value, [
            "schedules",
            "maintenanceSchedules",
          ])
        );
      } else {
        throw scheduleResult.reason;
      }

      if (assetResult.status === "fulfilled") {
        setAssets(
          getArray(assetResult.value, ["assets"])
        );
      } else {
        setAssets([]);
      }

      if (technicianResult.status === "fulfilled") {
        setTechnicians(
          getArray(technicianResult.value, [
            "technicians",
          ])
        );
      } else {
        setTechnicians([]);
      }
    } catch (err) {
      setError(
        err.message ||
          "Failed to load maintenance schedules."
      );

      setSchedules([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const normalizedSchedules = useMemo(() => {
    return schedules.map((schedule) => {
      const assetId = getScheduleAssetId(schedule);

      const asset = assets.find(
        (item) =>
          String(value(item, ["id"])) ===
          String(assetId)
      );

      const technicianId = value(schedule, [
        "assignedTechnicianId",
        "assigned_technician_id",
        "technicianId",
        "technician_id",
        "technician?.id",
      ]);

      const technician = technicians.find(
        (item) =>
          String(getTechnicianId(item)) ===
          String(technicianId)
      );

      return {
        ...schedule,
        assetId,
        assetName:
          value(schedule, [
            "assetName",
            "asset_name",
            "asset?.name",
          ]) ||
          (asset
            ? getAssetName(asset)
            : `Asset #${assetId || "—"}`),

        assetCode:
          value(schedule, [
            "assetCode",
            "asset_code",
            "asset?.assetCode",
          ]) ||
          (asset
            ? getAssetCode(asset)
            : "—"),

        technicianId,

        technicianName:
          value(schedule, [
            "technicianName",
            "technician_name",
            "assignedTechnician",
            "assigned_technician",
            "technician?.name",
          ]) ||
          (technician
            ? getTechnicianName(technician)
            : "Unassigned"),

        title: value(
          schedule,
          ["title", "name", "scheduleName"],
          "Maintenance Schedule"
        ),

        type: value(
          schedule,
          [
            "maintenanceType",
            "maintenance_type",
            "type",
          ],
          "Preventive"
        ),

        status: value(
          schedule,
          ["status"],
          "Scheduled"
        ),

        priority: value(
          schedule,
          ["priority"],
          "Normal"
        ),

        scheduledDate: value(
          schedule,
          [
            "scheduledDate",
            "scheduled_date",
            "date",
            "startDate",
            "start_date",
          ]
        ),

        frequency: value(
          schedule,
          ["frequency", "interval"],
          "—"
        ),
      };
    });
  }, [schedules, assets, technicians]);

  const filteredSchedules = useMemo(() => {
    const term = search.trim().toLowerCase();

    return normalizedSchedules
      .filter((schedule) => {
        const searchable = [
          schedule.title,
          schedule.assetName,
          schedule.assetCode,
          schedule.technicianName,
          schedule.type,
          schedule.status,
          schedule.priority,
          schedule.frequency,
        ]
          .join(" ")
          .toLowerCase();

        const matchesSearch =
          !term || searchable.includes(term);

        const matchesStatus =
          statusFilter === "all" ||
          normalizeStatus(schedule.status) ===
            normalizeStatus(statusFilter);

        const matchesType =
          typeFilter === "all" ||
          normalizeStatus(schedule.type) ===
            normalizeStatus(typeFilter);

        return (
          matchesSearch &&
          matchesStatus &&
          matchesType
        );
      })
      .sort((a, b) => {
        const first = new Date(
          a.scheduledDate || 0
        ).getTime();

        const second = new Date(
          b.scheduledDate || 0
        ).getTime();

        return first - second;
      });
  }, [
    normalizedSchedules,
    search,
    statusFilter,
    typeFilter,
  ]);

  const summary = useMemo(() => {
    const total = normalizedSchedules.length;

    const upcoming = normalizedSchedules.filter(
      (schedule) =>
        !isOverdue(schedule) &&
        !normalizeStatus(schedule.status).includes(
          "complete"
        ) &&
        !normalizeStatus(schedule.status).includes(
          "cancel"
        )
    ).length;

    const overdue = normalizedSchedules.filter(
      (schedule) => isOverdue(schedule)
    ).length;

    const completed = normalizedSchedules.filter(
      (schedule) =>
        normalizeStatus(schedule.status).includes(
          "complete"
        )
    ).length;

    return {
      total,
      upcoming,
      overdue,
      completed,
    };
  }, [normalizedSchedules]);

  function openCreate() {
    setEditingSchedule(null);
    setForm(emptyForm);
    setShowModal(true);
  }

  function openEdit(schedule) {
    setEditingSchedule(schedule);

    setForm({
      assetId:
        schedule.assetId || "",
      maintenanceType:
        schedule.type || "Preventive",
      title:
        schedule.title || "",
      description:
        value(schedule, [
          "description",
        ], ""),
      frequency:
        schedule.frequency || "Monthly",
      scheduledDate:
        schedule.scheduledDate
          ? String(
              schedule.scheduledDate
            ).slice(0, 10)
          : "",
      startTime:
        value(schedule, [
          "startTime",
          "start_time",
        ], ""),
      endTime:
        value(schedule, [
          "endTime",
          "end_time",
        ], ""),
      priority:
        schedule.priority || "Normal",
      assignedTechnicianId:
        schedule.technicianId || "",
      status:
        schedule.status || "Scheduled",
      notes:
        value(schedule, ["notes"], ""),
    });

    setShowModal(true);
  }

  function closeModal() {
    if (saving) return;

    setShowModal(false);
    setEditingSchedule(null);
    setForm(emptyForm);
  }

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function saveSchedule(event) {
    event.preventDefault();

    if (!form.assetId) {
      setError("Please select an asset.");
      return;
    }

    if (!form.title.trim()) {
      setError("Please enter a schedule title.");
      return;
    }

    if (!form.scheduledDate) {
      setError("Please select a scheduled date.");
      return;
    }

    setSaving(true);
    setError("");

    const payload = {
      assetId: Number(form.assetId),
      maintenanceType: form.maintenanceType,
      title: form.title.trim(),
      description: form.description.trim(),
      frequency: form.frequency,
      scheduledDate: form.scheduledDate,
      startTime: form.startTime || null,
      endTime: form.endTime || null,
      priority: form.priority,
      assignedTechnicianId:
        form.assignedTechnicianId
          ? Number(form.assignedTechnicianId)
          : null,
      status: form.status,
      notes: form.notes.trim(),
    };

    try {
      if (editingSchedule) {
        const id = value(editingSchedule, [
          "id",
          "scheduleId",
          "schedule_id",
        ]);

        await request(
          `${API}/maintenance/schedules/${id}`,
          {
            method: "PUT",
            body: JSON.stringify(payload),
          }
        );
      } else {
        await request(
          `${API}/maintenance/schedules`,
          {
            method: "POST",
            body: JSON.stringify(payload),
          }
        );
      }

      closeModal();
      await loadData();
    } catch (err) {
      setError(
        err.message ||
          "Failed to save maintenance schedule."
      );
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(schedule, status) {
    const id = value(schedule, [
      "id",
      "scheduleId",
      "schedule_id",
    ]);

    if (!id) return;

    setError("");

    try {
      await request(
        `${API}/maintenance/schedules/${id}`,
        {
          method: "PUT",
          body: JSON.stringify({
            status,
          }),
        }
      );

      await loadData();
    } catch (err) {
      setError(
        err.message ||
          "Failed to update schedule status."
      );
    }
  }

  async function deleteSchedule(schedule) {
    const id = value(schedule, [
      "id",
      "scheduleId",
      "schedule_id",
    ]);

    if (!id) return;

    const confirmed = window.confirm(
      `Delete "${schedule.title}"?`
    );

    if (!confirmed) return;

    setError("");

    try {
      await request(
        `${API}/maintenance/schedules/${id}`,
        {
          method: "DELETE",
        }
      );

      await loadData();
    } catch (err) {
      setError(
        err.message ||
          "Failed to delete maintenance schedule."
      );
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>
              Maintenance Schedule
            </h1>

            <p style={styles.subtitle}>
              Plan, assign, monitor, and manage scheduled
              maintenance activities.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              gap: "9px",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              style={styles.secondaryButton}
              onClick={loadData}
            >
              ↻ Refresh
            </button>

            <button
              type="button"
              style={styles.primaryButton}
              onClick={openCreate}
            >
              + New Schedule
            </button>
          </div>
        </div>

        {error && (
          <div style={styles.error}>
            {error}
          </div>
        )}

        <div style={styles.cards}>
          <div style={styles.card}>
            <div style={styles.cardLabel}>
              Total Schedules
            </div>

            <div style={styles.cardValue}>
              {summary.total}
            </div>
          </div>

          <div style={styles.card}>
            <div style={styles.cardLabel}>
              Upcoming
            </div>

            <div style={styles.cardValue}>
              {summary.upcoming}
            </div>
          </div>

          <div style={styles.card}>
            <div style={styles.cardLabel}>
              Overdue
            </div>

            <div style={styles.cardValue}>
              {summary.overdue}
            </div>
          </div>

          <div style={styles.card}>
            <div style={styles.cardLabel}>
              Completed
            </div>

            <div style={styles.cardValue}>
              {summary.completed}
            </div>
          </div>
        </div>

        <div style={styles.toolbar}>
          <input
            type="text"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search schedule, asset, technician..."
            style={styles.input}
          />

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value)
            }
            style={styles.select}
          >
            <option value="all">
              All Statuses
            </option>

            <option value="Scheduled">
              Scheduled
            </option>

            <option value="In Progress">
              In Progress
            </option>

            <option value="Completed">
              Completed
            </option>

            <option value="Cancelled">
              Cancelled
            </option>
          </select>

          <select
            value={typeFilter}
            onChange={(event) =>
              setTypeFilter(event.target.value)
            }
            style={styles.select}
          >
            <option value="all">
              All Types
            </option>

            <option value="Preventive">
              Preventive
            </option>

            <option value="Corrective">
              Corrective
            </option>

            <option value="Inspection">
              Inspection
            </option>

            <option value="Calibration">
              Calibration
            </option>
          </select>

          {(search ||
            statusFilter !== "all" ||
            typeFilter !== "all") && (
            <button
              type="button"
              style={styles.actionButton}
              onClick={() => {
                setSearch("");
                setStatusFilter("all");
                setTypeFilter("all");
              }}
            >
              Clear Filters
            </button>
          )}
        </div>

        <div style={styles.tableCard}>
          <div style={styles.tableHeader}>
            <h2 style={styles.tableTitle}>
              Scheduled Maintenance
            </h2>

            <span
              style={{
                color: "#667085",
                fontSize: "13px",
              }}
            >
              {filteredSchedules.length} records
            </span>
          </div>

          {loading ? (
            <div style={styles.loading}>
              Loading schedules...
            </div>
          ) : filteredSchedules.length === 0 ? (
            <div style={styles.empty}>
              <div
                style={{
                  fontSize: "30px",
                  marginBottom: "8px",
                }}
              >
                📅
              </div>

              <strong>
                No maintenance schedules found
              </strong>

              <div
                style={{
                  marginTop: "6px",
                  fontSize: "13px",
                }}
              >
                Create a new schedule or change the
                current filters.
              </div>
            </div>
          ) : (
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>
                      Schedule
                    </th>

                    <th style={styles.th}>
                      Asset
                    </th>

                    <th style={styles.th}>
                      Type
                    </th>

                    <th style={styles.th}>
                      Scheduled Date
                    </th>

                    <th style={styles.th}>
                      Frequency
                    </th>

                    <th style={styles.th}>
                      Technician
                    </th>

                    <th style={styles.th}>
                      Priority
                    </th>

                    <th style={styles.th}>
                      Status
                    </th>

                    <th style={styles.th}>
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredSchedules.map(
                    (schedule, index) => {
                      const badge = statusStyle(
                        isOverdue(schedule)
                          ? "Overdue"
                          : schedule.status
                      );

                      return (
                        <tr
                          key={
                            value(schedule, [
                              "id",
                              "scheduleId",
                              "schedule_id",
                            ]) || index
                          }
                        >
                          <td style={styles.td}>
                            <span style={styles.strong}>
                              {schedule.title}
                            </span>

                            <span style={styles.secondary}>
                              {value(
                                schedule,
                                ["description"],
                                "No description"
                              )}
                            </span>
                          </td>

                          <td style={styles.td}>
                            <span style={styles.strong}>
                              {schedule.assetName}
                            </span>

                            <span style={styles.secondary}>
                              {schedule.assetCode}
                            </span>
                          </td>

                          <td style={styles.td}>
                            {schedule.type}
                          </td>

                          <td style={styles.td}>
                            <span
                              style={{
                                fontWeight: isOverdue(
                                  schedule
                                )
                                  ? 750
                                  : 500,
                              }}
                            >
                              {formatDate(
                                schedule.scheduledDate
                              )}
                            </span>

                            {schedule.startTime && (
                              <span
                                style={
                                  styles.secondary
                                }
                              >
                                {schedule.startTime}
                                {schedule.endTime
                                  ? ` - ${schedule.endTime}`
                                  : ""}
                              </span>
                            )}
                          </td>

                          <td style={styles.td}>
                            {schedule.frequency}
                          </td>

                          <td style={styles.td}>
                            {schedule.technicianName}
                          </td>

                          <td style={styles.td}>
                            {schedule.priority}
                          </td>

                          <td style={styles.td}>
                            <span
                              style={{
                                ...styles.badge,
                                background:
                                  badge.background,
                                color: badge.color,
                              }}
                            >
                              {isOverdue(schedule)
                                ? "Overdue"
                                : schedule.status}
                            </span>
                          </td>

                          <td style={styles.td}>
                            <div
                              style={styles.actions}
                            >
                              <button
                                type="button"
                                style={
                                  styles.actionButton
                                }
                                onClick={() =>
                                  setSelectedSchedule(
                                    schedule
                                  )
                                }
                              >
                                View
                              </button>

                              <button
                                type="button"
                                style={
                                  styles.actionButton
                                }
                                onClick={() =>
                                  openEdit(schedule)
                                }
                              >
                                Edit
                              </button>

                              {normalizeStatus(
                                schedule.status
                              ) === "scheduled" && (
                                <button
                                  type="button"
                                  style={
                                    styles.actionButton
                                  }
                                  onClick={() =>
                                    updateStatus(
                                      schedule,
                                      "In Progress"
                                    )
                                  }
                                >
                                  Start
                                </button>
                              )}

                              {normalizeStatus(
                                schedule.status
                              ) ===
                                "in progress" && (
                                <button
                                  type="button"
                                  style={
                                    styles.actionButton
                                  }
                                  onClick={() =>
                                    updateStatus(
                                      schedule,
                                      "Completed"
                                    )
                                  }
                                >
                                  Complete
                                </button>
                              )}

                              <button
                                type="button"
                                style={
                                  styles.dangerButton
                                }
                                onClick={() =>
                                  deleteSchedule(
                                    schedule
                                  )
                                }
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div
          style={styles.modalOverlay}
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !saving
            ) {
              closeModal();
            }
          }}
        >
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.modalTitle}>
                  {editingSchedule
                    ? "Edit Maintenance Schedule"
                    : "Create Maintenance Schedule"}
                </h2>

                <span style={styles.secondary}>
                  {editingSchedule
                    ? "Update the scheduled maintenance activity."
                    : "Create a new scheduled maintenance activity."}
                </span>
              </div>

              <button
                type="button"
                style={styles.closeButton}
                onClick={closeModal}
                disabled={saving}
              >
                ×
              </button>
            </div>

            <form
              onSubmit={saveSchedule}
              style={styles.modalBody}
            >
              <div style={styles.formGrid}>
                <div
                  style={{
                    ...styles.formGroup,
                    ...styles.full,
                  }}
                >
                  <label style={styles.label}>
                    Asset *
                  </label>

                  <select
                    value={form.assetId}
                    onChange={(event) =>
                      updateField(
                        "assetId",
                        event.target.value
                      )
                    }
                    style={styles.field}
                    required
                  >
                    <option value="">
                      Select asset
                    </option>

                    {assets.map((asset) => (
                      <option
                        key={value(
                          asset,
                          ["id"]
                        )}
                        value={value(
                          asset,
                          ["id"]
                        )}
                      >
                        {getAssetName(asset)} —{" "}
                        {getAssetCode(asset)}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    Schedule Title *
                  </label>

                  <input
                    type="text"
                    value={form.title}
                    onChange={(event) =>
                      updateField(
                        "title",
                        event.target.value
                      )
                    }
                    style={styles.field}
                    placeholder="e.g. Monthly Generator Service"
                    required
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    Maintenance Type
                  </label>

                  <select
                    value={form.maintenanceType}
                    onChange={(event) =>
                      updateField(
                        "maintenanceType",
                        event.target.value
                      )
                    }
                    style={styles.field}
                  >
                    <option value="Preventive">
                      Preventive
                    </option>

                    <option value="Corrective">
                      Corrective
                    </option>

                    <option value="Inspection">
                      Inspection
                    </option>

                    <option value="Calibration">
                      Calibration
                    </option>
                  </select>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    Frequency
                  </label>

                  <select
                    value={form.frequency}
                    onChange={(event) =>
                      updateField(
                        "frequency",
                        event.target.value
                      )
                    }
                    style={styles.field}
                  >
                    <option value="One Time">
                      One Time
                    </option>

                    <option value="Daily">
                      Daily
                    </option>

                    <option value="Weekly">
                      Weekly
                    </option>

                    <option value="Monthly">
                      Monthly
                    </option>

                    <option value="Quarterly">
                      Quarterly
                    </option>

                    <option value="Semi-Annual">
                      Semi-Annual
                    </option>

                    <option value="Annual">
                      Annual
                    </option>
                  </select>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    Scheduled Date *
                  </label>

                  <input
                    type="date"
                    value={form.scheduledDate}
                    onChange={(event) =>
                      updateField(
                        "scheduledDate",
                        event.target.value
                      )
                    }
                    style={styles.field}
                    required
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    Start Time
                  </label>

                  <input
                    type="time"
                    value={form.startTime}
                    onChange={(event) =>
                      updateField(
                        "startTime",
                        event.target.value
                      )
                    }
                    style={styles.field}
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    End Time
                  </label>

                  <input
                    type="time"
                    value={form.endTime}
                    onChange={(event) =>
                      updateField(
                        "endTime",
                        event.target.value
                      )
                    }
                    style={styles.field}
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    Priority
                  </label>

                  <select
                    value={form.priority}
                    onChange={(event) =>
                      updateField(
                        "priority",
                        event.target.value
                      )
                    }
                    style={styles.field}
                  >
                    <option value="Low">
                      Low
                    </option>

                    <option value="Normal">
                      Normal
                    </option>

                    <option value="High">
                      High
                    </option>

                    <option value="Urgent">
                      Urgent
                    </option>
                  </select>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    Assigned Technician
                  </label>

                  <select
                    value={
                      form.assignedTechnicianId
                    }
                    onChange={(event) =>
                      updateField(
                        "assignedTechnicianId",
                        event.target.value
                      )
                    }
                    style={styles.field}
                  >
                    <option value="">
                      Unassigned
                    </option>

                    {technicians.map(
                      (technician) => (
                        <option
                          key={getTechnicianId(
                            technician
                          )}
                          value={getTechnicianId(
                            technician
                          )}
                        >
                          {getTechnicianName(
                            technician
                          )}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    Status
                  </label>

                  <select
                    value={form.status}
                    onChange={(event) =>
                      updateField(
                        "status",
                        event.target.value
                      )
                    }
                    style={styles.field}
                  >
                    <option value="Scheduled">
                      Scheduled
                    </option>

                    <option value="In Progress">
                      In Progress
                    </option>

                    <option value="Completed">
                      Completed
                    </option>

                    <option value="Cancelled">
                      Cancelled
                    </option>
                  </select>
                </div>

                <div
                  style={{
                    ...styles.formGroup,
                    ...styles.full,
                  }}
                >
                  <label style={styles.label}>
                    Description
                  </label>

                  <textarea
                    value={form.description}
                    onChange={(event) =>
                      updateField(
                        "description",
                        event.target.value
                      )
                    }
                    style={styles.textarea}
                    placeholder="Describe the maintenance activity..."
                  />
                </div>

                <div
                  style={{
                    ...styles.formGroup,
                    ...styles.full,
                  }}
                >
                  <label style={styles.label}>
                    Notes
                  </label>

                  <textarea
                    value={form.notes}
                    onChange={(event) =>
                      updateField(
                        "notes",
                        event.target.value
                      )
                    }
                    style={styles.textarea}
                    placeholder="Additional notes..."
                  />
                </div>
              </div>

              <div style={styles.modalFooter}>
                <button
                  type="button"
                  style={styles.secondaryButton}
                  onClick={closeModal}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  style={{
                    ...styles.primaryButton,
                    opacity: saving ? 0.65 : 1,
                  }}
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : editingSchedule
                    ? "Update Schedule"
                    : "Create Schedule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedSchedule && (
        <div
          style={styles.modalOverlay}
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget
            ) {
              setSelectedSchedule(null);
            }
          }}
        >
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.modalTitle}>
                  Schedule Details
                </h2>

                <span style={styles.secondary}>
                  {selectedSchedule.title}
                </span>
              </div>

              <button
                type="button"
                style={styles.closeButton}
                onClick={() =>
                  setSelectedSchedule(null)
                }
              >
                ×
              </button>
            </div>

            <div style={styles.modalBody}>
              <div style={styles.scheduleInfo}>
                <div style={styles.infoBox}>
                  <span style={styles.infoLabel}>
                    Asset
                  </span>

                  <span style={styles.infoValue}>
                    {selectedSchedule.assetName}
                  </span>
                </div>

                <div style={styles.infoBox}>
                  <span style={styles.infoLabel}>
                    Asset Code
                  </span>

                  <span style={styles.infoValue}>
                    {selectedSchedule.assetCode}
                  </span>
                </div>

                <div style={styles.infoBox}>
                  <span style={styles.infoLabel}>
                    Maintenance Type
                  </span>

                  <span style={styles.infoValue}>
                    {selectedSchedule.type}
                  </span>
                </div>

                <div style={styles.infoBox}>
                  <span style={styles.infoLabel}>
                    Frequency
                  </span>

                  <span style={styles.infoValue}>
                    {selectedSchedule.frequency}
                  </span>
                </div>

                <div style={styles.infoBox}>
                  <span style={styles.infoLabel}>
                    Scheduled Date
                  </span>

                  <span style={styles.infoValue}>
                    {formatDate(
                      selectedSchedule.scheduledDate
                    )}
                  </span>
                </div>

                <div style={styles.infoBox}>
                  <span style={styles.infoLabel}>
                    Technician
                  </span>

                  <span style={styles.infoValue}>
                    {
                      selectedSchedule.technicianName
                    }
                  </span>
                </div>

                <div style={styles.infoBox}>
                  <span style={styles.infoLabel}>
                    Priority
                  </span>

                  <span style={styles.infoValue}>
                    {selectedSchedule.priority}
                  </span>
                </div>

                <div style={styles.infoBox}>
                  <span style={styles.infoLabel}>
                    Status
                  </span>

                  <span style={styles.infoValue}>
                    {isOverdue(
                      selectedSchedule
                    )
                      ? "Overdue"
                      : selectedSchedule.status}
                  </span>
                </div>
              </div>

              <div
                style={{
                  marginTop: "18px",
                }}
              >
                <span style={styles.infoLabel}>
                  Description
                </span>

                <div
                  style={{
                    color: "#344054",
                    fontSize: "13px",
                    lineHeight: 1.6,
                  }}
                >
                  {value(
                    selectedSchedule,
                    ["description"],
                    "No description provided."
                  )}
                </div>
              </div>

              <div
                style={{
                  marginTop: "18px",
                }}
              >
                <span style={styles.infoLabel}>
                  Notes
                </span>

                <div
                  style={{
                    color: "#344054",
                    fontSize: "13px",
                    lineHeight: 1.6,
                  }}
                >
                  {value(
                    selectedSchedule,
                    ["notes"],
                    "No notes."
                  )}
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "9px",
                  marginTop: "22px",
                }}
              >
                <button
                  type="button"
                  style={styles.secondaryButton}
                  onClick={() => {
                    setSelectedSchedule(null);
                    openEdit(selectedSchedule);
                  }}
                >
                  Edit Schedule
                </button>

                <button
                  type="button"
                  style={styles.primaryButton}
                  onClick={() =>
                    setSelectedSchedule(null)
                  }
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
