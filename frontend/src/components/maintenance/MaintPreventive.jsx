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
    gridTemplateColumns:
      "repeat(auto-fit, minmax(210px, 1fr))",
    gap: "16px",
    marginBottom: "22px",
  },

  card: {
    background: "#fff",
    border: "1px solid #e5e9f0",
    borderRadius: "14px",
    padding: "18px",
    boxShadow:
      "0 3px 12px rgba(15, 23, 42, 0.04)",
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
    flex: "1 1 280px",
    minWidth: "240px",
    border: "1px solid #d9dee8",
    borderRadius: "9px",
    padding: "11px 13px",
    outline: "none",
    fontSize: "14px",
  },

  select: {
    minWidth: "165px",
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
    boxShadow:
      "0 3px 12px rgba(15, 23, 42, 0.04)",
  },

  tableHeader: {
    padding: "17px 18px",
    borderBottom: "1px solid #e9edf3",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
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
    minWidth: "1100px",
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
    alignItems: "center",
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

  loading: {
    padding: "45px 20px",
    textAlign: "center",
    color: "#667085",
  },

  empty: {
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

  success: {
    background: "#ecfdf3",
    border: "1px solid #abefc6",
    color: "#027a48",
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
    maxWidth: "760px",
    maxHeight: "92vh",
    overflowY: "auto",
    background: "#fff",
    borderRadius: "16px",
    boxShadow:
      "0 20px 60px rgba(15, 23, 42, 0.25)",
  },

  modalHeader: {
    padding: "18px 20px",
    borderBottom: "1px solid #e5e9f0",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
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
    gridTemplateColumns:
      "repeat(2, minmax(0, 1fr))",
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

  detailGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(190px, 1fr))",
    gap: "12px",
  },

  detailBox: {
    background: "#f8fafc",
    border: "1px solid #e8edf3",
    borderRadius: "10px",
    padding: "12px",
  },

  detailLabel: {
    display: "block",
    color: "#667085",
    fontSize: "11px",
    fontWeight: 800,
    textTransform: "uppercase",
    marginBottom: "5px",
  },

  detailValue: {
    color: "#172033",
    fontSize: "13px",
    fontWeight: 700,
    wordBreak: "break-word",
  },
};

const initialForm = {
  assetId: "",
  title: "",
  description: "",
  frequency: "Monthly",
  nextDueDate: "",
  lastServiceDate: "",
  maintenanceType: "Preventive",
  priority: "Normal",
  technicianId: "",
  estimatedDuration: "",
  estimatedCost: "",
  status: "Active",
  instructions: "",
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

function getValue(
  object,
  keys,
  fallback = ""
) {
  if (!object) return fallback;

  for (const key of keys) {
    if (
      object[key] !== undefined &&
      object[key] !== null &&
      object[key] !== ""
    ) {
      return object[key];
    }
  }

  return fallback;
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString();
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
    normalized.includes("complete") ||
    normalized.includes("completed")
  ) {
    return {
      background: "#ecfdf3",
      color: "#027a48",
    };
  }

  if (
    normalized.includes("inactive") ||
    normalized.includes("cancel")
  ) {
    return {
      background: "#f2f4f7",
      color: "#475467",
    };
  }

  if (
    normalized.includes("overdue") ||
    normalized.includes("due")
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

function isDue(item) {
  const status = normalizeStatus(
    getValue(item, ["status"], "Active")
  );

  if (
    status.includes("inactive") ||
    status.includes("cancel") ||
    status.includes("complete")
  ) {
    return false;
  }

  const date = getValue(item, [
    "nextDueDate",
    "next_due_date",
    "dueDate",
    "due_date",
    "scheduledDate",
    "scheduled_date",
  ]);

  if (!date) return false;

  const dueDate = new Date(date);
  const today = new Date();

  dueDate.setHours(23, 59, 59, 999);

  return dueDate <= today;
}

function daysUntil(dateValue) {
  if (!dateValue) return null;

  const target = new Date(dateValue);

  if (Number.isNaN(target.getTime())) {
    return null;
  }

  const today = new Date();

  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);

  return Math.ceil(
    (target.getTime() - today.getTime()) /
      (1000 * 60 * 60 * 24)
  );
}

export default function Preventive() {
  const [plans, setPlans] = useState([]);
  const [assets, setAssets] = useState([]);
  const [technicians, setTechnicians] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState("all");
  const [frequencyFilter, setFrequencyFilter] =
    useState("all");

  const [showForm, setShowForm] =
    useState(false);
  const [showDetails, setShowDetails] =
    useState(false);

  const [editingPlan, setEditingPlan] =
    useState(null);
  const [selectedPlan, setSelectedPlan] =
    useState(null);

  const [form, setForm] =
    useState(initialForm);

  async function request(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: withMaintenanceAuth({
        "Content-Type": "application/json",
        ...(options.headers || {}),
      }),
    });

    if (!response.ok) {
      let message =
        `${response.status} ${response.statusText}`;

      try {
        const body = await response.json();

        message =
          body?.message ||
          body?.error ||
          message;
      } catch {
        // Use default HTTP message.
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
      const results =
        await Promise.allSettled([
          request(
            `${API}/maintenance/preventive`
          ),
          request(`${API}/assets`),
          request(
            `${API}/maintenance/technicians`
          ),
        ]);

      const plansResult = results[0];
      const assetsResult = results[1];
      const techniciansResult = results[2];

      if (
        plansResult.status ===
        "fulfilled"
      ) {
        setPlans(
          getArray(
            plansResult.value,
            [
              "preventive",
              "preventivePlans",
              "plans",
              "maintenancePlans",
            ]
          )
        );
      } else {
        throw plansResult.reason;
      }

      if (
        assetsResult.status ===
        "fulfilled"
      ) {
        setAssets(
          getArray(
            assetsResult.value,
            ["assets"]
          )
        );
      } else {
        setAssets([]);
      }

      if (
        techniciansResult.status ===
        "fulfilled"
      ) {
        setTechnicians(
          getArray(
            techniciansResult.value,
            ["technicians"]
          )
        );
      } else {
        setTechnicians([]);
      }
    } catch (err) {
      setError(
        err.message ||
          "Failed to load preventive maintenance plans."
      );

      setPlans([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const normalizedPlans = useMemo(() => {
    return plans.map((plan) => {
      const assetId = getValue(
        plan,
        [
          "assetId",
          "asset_id",
          "asset?.id",
        ]
      );

      const technicianId = getValue(
        plan,
        [
          "technicianId",
          "technician_id",
          "assignedTechnicianId",
          "assigned_technician_id",
          "technician?.id",
        ]
      );

      const asset = assets.find(
        (item) =>
          String(
            getValue(item, ["id"])
          ) === String(assetId)
      );

      const technician =
        technicians.find(
          (item) =>
            String(
              getValue(item, ["id"])
            ) === String(technicianId)
        );

      const nextDueDate = getValue(
        plan,
        [
          "nextDueDate",
          "next_due_date",
          "dueDate",
          "due_date",
          "scheduledDate",
          "scheduled_date",
        ]
      );

      return {
        ...plan,

        id: getValue(plan, [
          "id",
          "planId",
          "plan_id",
        ]),

        assetId,

        assetName:
          getValue(plan, [
            "assetName",
            "asset_name",
            "asset?.name",
          ]) ||
          getValue(
            asset,
            [
              "name",
              "assetName",
              "asset_name",
            ],
            `Asset #${assetId || "—"}`
          ),

        assetCode:
          getValue(plan, [
            "assetCode",
            "asset_code",
            "asset?.assetCode",
          ]) ||
          getValue(
            asset,
            [
              "assetCode",
              "asset_code",
              "code",
            ],
            "—"
          ),

        title: getValue(
          plan,
          [
            "title",
            "name",
            "planName",
            "plan_name",
          ],
          "Preventive Maintenance"
        ),

        description: getValue(
          plan,
          ["description"],
          ""
        ),

        frequency: getValue(
          plan,
          ["frequency", "interval"],
          "Monthly"
        ),

        nextDueDate,

        lastServiceDate:
          getValue(plan, [
            "lastServiceDate",
            "last_service_date",
            "lastMaintenanceDate",
            "last_maintenance_date",
          ]),

        maintenanceType:
          getValue(
            plan,
            [
              "maintenanceType",
              "maintenance_type",
              "type",
            ],
            "Preventive"
          ),

        priority: getValue(
          plan,
          ["priority"],
          "Normal"
        ),

        technicianId,

        technicianName:
          getValue(plan, [
            "technicianName",
            "technician_name",
            "technician?.name",
            "assignedTechnician",
            "assigned_technician",
          ]) ||
          getValue(
            technician,
            [
              "name",
              "fullName",
              "full_name",
            ],
            "Unassigned"
          ),

        status: getValue(
          plan,
          ["status"],
          "Active"
        ),

        estimatedDuration:
          getValue(plan, [
            "estimatedDuration",
            "estimated_duration",
          ]),

        estimatedCost:
          getValue(plan, [
            "estimatedCost",
            "estimated_cost",
          ]),

        instructions:
          getValue(plan, [
            "instructions",
            "procedure",
            "maintenanceInstructions",
          ]),

        notes: getValue(
          plan,
          ["notes"],
          ""
        ),
      };
    });
  }, [
    plans,
    assets,
    technicians,
  ]);

  const filteredPlans = useMemo(() => {
    const term =
      search.trim().toLowerCase();

    return normalizedPlans
      .filter((plan) => {
        const searchable = [
          plan.title,
          plan.assetName,
          plan.assetCode,
          plan.technicianName,
          plan.frequency,
          plan.maintenanceType,
          plan.priority,
          plan.status,
        ]
          .join(" ")
          .toLowerCase();

        const matchesSearch =
          !term ||
          searchable.includes(term);

        const matchesStatus =
          statusFilter === "all" ||
          normalizeStatus(
            plan.status
          ) ===
            normalizeStatus(
              statusFilter
            );

        const matchesFrequency =
          frequencyFilter === "all" ||
          normalizeStatus(
            plan.frequency
          ) ===
            normalizeStatus(
              frequencyFilter
            );

        return (
          matchesSearch &&
          matchesStatus &&
          matchesFrequency
        );
      })
      .sort((a, b) => {
        const first =
          new Date(
            a.nextDueDate || 0
          ).getTime();

        const second =
          new Date(
            b.nextDueDate || 0
          ).getTime();

        return first - second;
      });
  }, [
    normalizedPlans,
    search,
    statusFilter,
    frequencyFilter,
  ]);

  const summary = useMemo(() => {
    const total =
      normalizedPlans.length;

    const active =
      normalizedPlans.filter(
        (plan) =>
          normalizeStatus(
            plan.status
          ) === "active"
      ).length;

    const due =
      normalizedPlans.filter(
        (plan) =>
          isDue(plan)
      ).length;

    const upcoming =
      normalizedPlans.filter(
        (plan) => {
          const days =
            daysUntil(
              plan.nextDueDate
            );

          return (
            days !== null &&
            days > 0 &&
            days <= 30 &&
            normalizeStatus(
              plan.status
            ) === "active"
          );
        }
      ).length;

    return {
      total,
      active,
      due,
      upcoming,
    };
  }, [normalizedPlans]);

  function openCreate() {
    setEditingPlan(null);
    setForm(initialForm);
    setError("");
    setSuccess("");
    setShowForm(true);
  }

  function openEdit(plan) {
    setEditingPlan(plan);

    setForm({
      assetId:
        plan.assetId || "",
      title:
        plan.title || "",
      description:
        plan.description || "",
      frequency:
        plan.frequency || "Monthly",
      nextDueDate:
        plan.nextDueDate
          ? String(
              plan.nextDueDate
            ).slice(0, 10)
          : "",
      lastServiceDate:
        plan.lastServiceDate
          ? String(
              plan.lastServiceDate
            ).slice(0, 10)
          : "",
      maintenanceType:
        plan.maintenanceType ||
        "Preventive",
      priority:
        plan.priority ||
        "Normal",
      technicianId:
        plan.technicianId || "",
      estimatedDuration:
        plan.estimatedDuration ||
        "",
      estimatedCost:
        plan.estimatedCost || "",
      status:
        plan.status || "Active",
      instructions:
        plan.instructions || "",
      notes:
        plan.notes || "",
    });

    setError("");
    setSuccess("");
    setShowForm(true);
  }

  function closeForm() {
    if (saving) return;

    setShowForm(false);
    setEditingPlan(null);
    setForm(initialForm);
  }

  function updateField(
    field,
    fieldValue
  ) {
    setForm((current) => ({
      ...current,
      [field]: fieldValue,
    }));
  }

  async function savePlan(event) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!form.assetId) {
      setError(
        "Please select an asset."
      );
      return;
    }

    if (!form.title.trim()) {
      setError(
        "Please enter a plan title."
      );
      return;
    }

    if (!form.nextDueDate) {
      setError(
        "Please select the next due date."
      );
      return;
    }

    setSaving(true);

    const payload = {
      assetId: Number(
        form.assetId
      ),

      title:
        form.title.trim(),

      description:
        form.description.trim(),

      frequency:
        form.frequency,

      nextDueDate:
        form.nextDueDate,

      lastServiceDate:
        form.lastServiceDate ||
        null,

      maintenanceType:
        form.maintenanceType,

      priority:
        form.priority,

      technicianId:
        form.technicianId
          ? Number(
              form.technicianId
            )
          : null,

      estimatedDuration:
        form.estimatedDuration
          ? Number(
              form.estimatedDuration
            )
          : null,

      estimatedCost:
        form.estimatedCost
          ? Number(
              form.estimatedCost
            )
          : null,

      status:
        form.status,

      instructions:
        form.instructions.trim(),

      notes:
        form.notes.trim(),
    };

    try {
      if (editingPlan) {
        await request(
          `${API}/maintenance/preventive/${editingPlan.id}`,
          {
            method: "PUT",
            body: JSON.stringify(
              payload
            ),
          }
        );

        setSuccess(
          "Preventive maintenance plan updated successfully."
        );
      } else {
        await request(
          `${API}/maintenance/preventive`,
          {
            method: "POST",
            body: JSON.stringify(
              payload
            ),
          }
        );

        setSuccess(
          "Preventive maintenance plan created successfully."
        );
      }

      closeForm();
      await loadData();
    } catch (err) {
      setError(
        err.message ||
          "Failed to save preventive maintenance plan."
      );
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(
    plan,
    status
  ) {
    if (!plan.id) return;

    setError("");
    setSuccess("");

    try {
      await request(
        `${API}/maintenance/preventive/${plan.id}`,
        {
          method: "PUT",
          body: JSON.stringify({
            status,
          }),
        }
      );

      setSuccess(
        `Plan status changed to ${status}.`
      );

      await loadData();
    } catch (err) {
      setError(
        err.message ||
          "Failed to update plan status."
      );
    }
  }

  async function deletePlan(plan) {
    if (!plan.id) return;

    const confirmed =
      window.confirm(
        `Delete "${plan.title}"?`
      );

    if (!confirmed) return;

    setError("");
    setSuccess("");

    try {
      await request(
        `${API}/maintenance/preventive/${plan.id}`,
        {
          method: "DELETE",
        }
      );

      setSuccess(
        "Preventive maintenance plan deleted successfully."
      );

      await loadData();
    } catch (err) {
      setError(
        err.message ||
          "Failed to delete preventive maintenance plan."
      );
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>
              Preventive Maintenance
            </h1>

            <p style={styles.subtitle}>
              Manage recurring maintenance plans,
              service intervals, due dates, and
              assigned technicians.
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
              + New Preventive Plan
            </button>
          </div>
        </div>

        {error && (
          <div style={styles.error}>
            {error}
          </div>
        )}

        {success && (
          <div style={styles.success}>
            {success}
          </div>
        )}

        <div style={styles.cards}>
          <div style={styles.card}>
            <div style={styles.cardLabel}>
              Total Plans
            </div>

            <div style={styles.cardValue}>
              {summary.total}
            </div>
          </div>

          <div style={styles.card}>
            <div style={styles.cardLabel}>
              Active Plans
            </div>

            <div style={styles.cardValue}>
              {summary.active}
            </div>
          </div>

          <div style={styles.card}>
            <div style={styles.cardLabel}>
              Due / Overdue
            </div>

            <div style={styles.cardValue}>
              {summary.due}
            </div>
          </div>

          <div style={styles.card}>
            <div style={styles.cardLabel}>
              Due Within 30 Days
            </div>

            <div style={styles.cardValue}>
              {summary.upcoming}
            </div>
          </div>
        </div>

        <div style={styles.toolbar}>
          <input
            type="text"
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
            placeholder="Search plan, asset, technician..."
            style={styles.input}
          />

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value
              )
            }
            style={styles.select}
          >
            <option value="all">
              All Statuses
            </option>

            <option value="Active">
              Active
            </option>

            <option value="Inactive">
              Inactive
            </option>

            <option value="Completed">
              Completed
            </option>

            <option value="Cancelled">
              Cancelled
            </option>
          </select>

          <select
            value={frequencyFilter}
            onChange={(event) =>
              setFrequencyFilter(
                event.target.value
              )
            }
            style={styles.select}
          >
            <option value="all">
              All Frequencies
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

          {(search ||
            statusFilter !== "all" ||
            frequencyFilter !==
              "all") && (
            <button
              type="button"
              style={
                styles.actionButton
              }
              onClick={() => {
                setSearch("");
                setStatusFilter(
                  "all"
                );
                setFrequencyFilter(
                  "all"
                );
              }}
            >
              Clear Filters
            </button>
          )}
        </div>

        <div style={styles.tableCard}>
          <div style={styles.tableHeader}>
            <h2 style={styles.tableTitle}>
              Preventive Maintenance Plans
            </h2>

            <span
              style={{
                color: "#667085",
                fontSize: "13px",
              }}
            >
              {filteredPlans.length} records
            </span>
          </div>

          {loading ? (
            <div style={styles.loading}>
              Loading preventive maintenance plans...
            </div>
          ) : filteredPlans.length ===
            0 ? (
            <div style={styles.empty}>
              <div
                style={{
                  fontSize: "32px",
                  marginBottom: "9px",
                }}
              >
                🛠️
              </div>

              <strong>
                No preventive maintenance plans found
              </strong>

              <div
                style={{
                  marginTop: "6px",
                  fontSize: "13px",
                }}
              >
                Create a preventive maintenance
                plan or change the filters.
              </div>
            </div>
          ) : (
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>
                      Plan
                    </th>

                    <th style={styles.th}>
                      Asset
                    </th>

                    <th style={styles.th}>
                      Frequency
                    </th>

                    <th style={styles.th}>
                      Last Service
                    </th>

                    <th style={styles.th}>
                      Next Due
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
                  {filteredPlans.map(
                    (plan, index) => {
                      const due =
                        isDue(plan);

                      const badge =
                        statusStyle(
                          due
                            ? "Overdue"
                            : plan.status
                        );

                      const days =
                        daysUntil(
                          plan.nextDueDate
                        );

                      return (
                        <tr
                          key={
                            plan.id ||
                            index
                          }
                        >
                          <td
                            style={
                              styles.td
                            }
                          >
                            <span
                              style={
                                styles.strong
                              }
                            >
                              {plan.title}
                            </span>

                            <span
                              style={
                                styles.secondary
                              }
                            >
                              {
                                plan.maintenanceType
                              }
                            </span>
                          </td>

                          <td
                            style={
                              styles.td
                            }
                          >
                            <span
                              style={
                                styles.strong
                              }
                            >
                              {
                                plan.assetName
                              }
                            </span>

                            <span
                              style={
                                styles.secondary
                              }
                            >
                              {
                                plan.assetCode
                              }
                            </span>
                          </td>

                          <td
                            style={
                              styles.td
                            }
                          >
                            {
                              plan.frequency
                            }
                          </td>

                          <td
                            style={
                              styles.td
                            }
                          >
                            {formatDate(
                              plan.lastServiceDate
                            )}
                          </td>

                          <td
                            style={
                              styles.td
                            }
                          >
                            <span
                              style={{
                                fontWeight:
                                  due
                                    ? 800
                                    : 600,
                                color:
                                  due
                                    ? "#b42318"
                                    : "#344054",
                              }}
                            >
                              {formatDate(
                                plan.nextDueDate
                              )}
                            </span>

                            {days !==
                              null && (
                              <span
                                style={
                                  styles.secondary
                                }
                              >
                                {days < 0
                                  ? `${Math.abs(
                                      days
                                    )} days overdue`
                                  : days ===
                                    0
                                  ? "Due today"
                                  : `${days} days remaining`}
                              </span>
                            )}
                          </td>

                          <td
                            style={
                              styles.td
                            }
                          >
                            {
                              plan.technicianName
                            }
                          </td>

                          <td
                            style={
                              styles.td
                            }
                          >
                            {
                              plan.priority
                            }
                          </td>

                          <td
                            style={
                              styles.td
                            }
                          >
                            <span
                              style={{
                                ...styles.badge,
                                background:
                                  badge.background,
                                color:
                                  badge.color,
                              }}
                            >
                              {due
                                ? "Overdue"
                                : plan.status}
                            </span>
                          </td>

                          <td
                            style={
                              styles.td
                            }
                          >
                            <div
                              style={
                                styles.actions
                              }
                            >
                              <button
                                type="button"
                                style={
                                  styles.actionButton
                                }
                                onClick={() => {
                                  setSelectedPlan(
                                    plan
                                  );
                                  setShowDetails(
                                    true
                                  );
                                }}
                              >
                                View
                              </button>

                              <button
                                type="button"
                                style={
                                  styles.actionButton
                                }
                                onClick={() =>
                                  openEdit(
                                    plan
                                  )
                                }
                              >
                                Edit
                              </button>

                              {normalizeStatus(
                                plan.status
                              ) ===
                                "active" && (
                                <button
                                  type="button"
                                  style={
                                    styles.actionButton
                                  }
                                  onClick={() =>
                                    updateStatus(
                                      plan,
                                      "Inactive"
                                    )
                                  }
                                >
                                  Pause
                                </button>
                              )}

                              {normalizeStatus(
                                plan.status
                              ) ===
                                "inactive" && (
                                <button
                                  type="button"
                                  style={
                                    styles.actionButton
                                  }
                                  onClick={() =>
                                    updateStatus(
                                      plan,
                                      "Active"
                                    )
                                  }
                                >
                                  Activate
                                </button>
                              )}

                              <button
                                type="button"
                                style={
                                  styles.dangerButton
                                }
                                onClick={() =>
                                  deletePlan(
                                    plan
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

      {showForm && (
        <div
          style={
            styles.modalOverlay
          }
          onMouseDown={(event) => {
            if (
              event.target ===
                event.currentTarget &&
              !saving
            ) {
              closeForm();
            }
          }}
        >
          <div style={styles.modal}>
            <div
              style={
                styles.modalHeader
              }
            >
              <div>
                <h2
                  style={
                    styles.modalTitle
                  }
                >
                  {editingPlan
                    ? "Edit Preventive Maintenance Plan"
                    : "Create Preventive Maintenance Plan"}
                </h2>

                <span
                  style={
                    styles.secondary
                  }
                >
                  Configure recurring maintenance
                  for an asset.
                </span>
              </div>

              <button
                type="button"
                style={
                  styles.closeButton
                }
                onClick={
                  closeForm
                }
                disabled={saving}
              >
                ×
              </button>
            </div>

            <form
              onSubmit={savePlan}
              style={styles.modalBody}
            >
              <div
                style={
                  styles.formGrid
                }
              >
                <div
                  style={{
                    ...styles.formGroup,
                    ...styles.full,
                  }}
                >
                  <label
                    style={
                      styles.label
                    }
                  >
                    Asset *
                  </label>

                  <select
                    value={
                      form.assetId
                    }
                    onChange={(
                      event
                    ) =>
                      updateField(
                        "assetId",
                        event.target
                          .value
                      )
                    }
                    style={
                      styles.field
                    }
                    required
                  >
                    <option value="">
                      Select asset
                    </option>

                    {assets.map(
                      (asset) => (
                        <option
                          key={getValue(
                            asset,
                            ["id"]
                          )}
                          value={getValue(
                            asset,
                            ["id"]
                          )}
                        >
                          {getValue(
                            asset,
                            [
                              "name",
                              "assetName",
                              "asset_name",
                            ],
                            `Asset #${getValue(
                              asset,
                              ["id"]
                            )}`
                          )}{" "}
                          —{" "}
                          {getValue(
                            asset,
                            [
                              "assetCode",
                              "asset_code",
                              "code",
                            ],
                            "—"
                          )}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div
                  style={
                    styles.formGroup
                  }
                >
                  <label
                    style={
                      styles.label
                    }
                  >
                    Plan Title *
                  </label>

                  <input
                    type="text"
                    value={
                      form.title
                    }
                    onChange={(
                      event
                    ) =>
                      updateField(
                        "title",
                        event.target
                          .value
                      )
                    }
                    style={
                      styles.field
                    }
                    placeholder="e.g. Monthly Generator Service"
                    required
                  />
                </div>

                <div
                  style={
                    styles.formGroup
                  }
                >
                  <label
                    style={
                      styles.label
                    }
                  >
                    Maintenance Type
                  </label>

                  <select
                    value={
                      form.maintenanceType
                    }
                    onChange={(
                      event
                    ) =>
                      updateField(
                        "maintenanceType",
                        event.target
                          .value
                      )
                    }
                    style={
                      styles.field
                    }
                  >
                    <option value="Preventive">
                      Preventive
                    </option>

                    <option value="Inspection">
                      Inspection
                    </option>

                    <option value="Calibration">
                      Calibration
                    </option>

                    <option value="Servicing">
                      Servicing
                    </option>
                  </select>
                </div>

                <div
                  style={
                    styles.formGroup
                  }
                >
                  <label
                    style={
                      styles.label
                    }
                  >
                    Frequency
                  </label>

                  <select
                    value={
                      form.frequency
                    }
                    onChange={(
                      event
                    ) =>
                      updateField(
                        "frequency",
                        event.target
                          .value
                      )
                    }
                    style={
                      styles.field
                    }
                  >
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

                <div
                  style={
                    styles.formGroup
                  }
                >
                  <label
                    style={
                      styles.label
                    }
                  >
                    Next Due Date *
                  </label>

                  <input
                    type="date"
                    value={
                      form.nextDueDate
                    }
                    onChange={(
                      event
                    ) =>
                      updateField(
                        "nextDueDate",
                        event.target
                          .value
                      )
                    }
                    style={
                      styles.field
                    }
                    required
                  />
                </div>

                <div
                  style={
                    styles.formGroup
                  }
                >
                  <label
                    style={
                      styles.label
                    }
                  >
                    Last Service Date
                  </label>

                  <input
                    type="date"
                    value={
                      form.lastServiceDate
                    }
                    onChange={(
                      event
                    ) =>
                      updateField(
                        "lastServiceDate",
                        event.target
                          .value
                      )
                    }
                    style={
                      styles.field
                    }
                  />
                </div>

                <div
                  style={
                    styles.formGroup
                  }
                >
                  <label
                    style={
                      styles.label
                    }
                  >
                    Priority
                  </label>

                  <select
                    value={
                      form.priority
                    }
                    onChange={(
                      event
                    ) =>
                      updateField(
                        "priority",
                        event.target
                          .value
                      )
                    }
                    style={
                      styles.field
                    }
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

                <div
                  style={
                    styles.formGroup
                  }
                >
                  <label
                    style={
                      styles.label
                    }
                  >
                    Assigned Technician
                  </label>

                  <select
                    value={
                      form.technicianId
                    }
                    onChange={(
                      event
                    ) =>
                      updateField(
                        "technicianId",
                        event.target
                          .value
                      )
                    }
                    style={
                      styles.field
                    }
                  >
                    <option value="">
                      Unassigned
                    </option>

                    {technicians.map(
                      (technician) => (
                        <option
                          key={getValue(
                            technician,
                            ["id"]
                          )}
                          value={getValue(
                            technician,
                            ["id"]
                          )}
                        >
                          {getValue(
                            technician,
                            [
                              "name",
                              "fullName",
                              "full_name",
                            ],
                            `Technician #${getValue(
                              technician,
                              ["id"]
                            )}`
                          )}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div
                  style={
                    styles.formGroup
                  }
                >
                  <label
                    style={
                      styles.label
                    }
                  >
                    Estimated Duration (hours)
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.25"
                    value={
                      form.estimatedDuration
                    }
                    onChange={(
                      event
                    ) =>
                      updateField(
                        "estimatedDuration",
                        event.target
                          .value
                      )
                    }
                    style={
                      styles.field
                    }
                    placeholder="e.g. 2"
                  />
                </div>

                <div
                  style={
                    styles.formGroup
                  }
                >
                  <label
                    style={
                      styles.label
                    }
                  >
                    Estimated Cost
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      form.estimatedCost
                    }
                    onChange={(
                      event
                    ) =>
                      updateField(
                        "estimatedCost",
                        event.target
                          .value
                      )
                    }
                    style={
                      styles.field
                    }
                    placeholder="0.00"
                  />
                </div>

                <div
                  style={
                    styles.formGroup
                  }
                >
                  <label
                    style={
                      styles.label
                    }
                  >
                    Status
                  </label>

                  <select
                    value={
                      form.status
                    }
                    onChange={(
                      event
                    ) =>
                      updateField(
                        "status",
                        event.target
                          .value
                      )
                    }
                    style={
                      styles.field
                    }
                  >
                    <option value="Active">
                      Active
                    </option>

                    <option value="Inactive">
                      Inactive
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
                  <label
                    style={
                      styles.label
                    }
                  >
                    Description
                  </label>

                  <textarea
                    value={
                      form.description
                    }
                    onChange={(
                      event
                    ) =>
                      updateField(
                        "description",
                        event.target
                          .value
                      )
                    }
                    style={
                      styles.textarea
                    }
                    placeholder="Describe the preventive maintenance activity..."
                  />
                </div>

                <div
                  style={{
                    ...styles.formGroup,
                    ...styles.full,
                  }}
                >
                  <label
                    style={
                      styles.label
                    }
                  >
                    Maintenance Instructions
                  </label>

                  <textarea
                    value={
                      form.instructions
                    }
                    onChange={(
                      event
                    ) =>
                      updateField(
                        "instructions",
                        event.target
                          .value
                      )
                    }
                    style={
                      styles.textarea
                    }
                    placeholder="Inspection steps, service procedure, safety instructions..."
                  />
                </div>

                <div
                  style={{
                    ...styles.formGroup,
                    ...styles.full,
                  }}
                >
                  <label
                    style={
                      styles.label
                    }
                  >
                    Notes
                  </label>

                  <textarea
                    value={
                      form.notes
                    }
                    onChange={(
                      event
                    ) =>
                      updateField(
                        "notes",
                        event.target
                          .value
                      )
                    }
                    style={
                      styles.textarea
                    }
                    placeholder="Additional notes..."
                  />
                </div>
              </div>

              <div
                style={
                  styles.modalFooter
                }
              >
                <button
                  type="button"
                  style={
                    styles.secondaryButton
                  }
                  onClick={
                    closeForm
                  }
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  style={{
                    ...styles.primaryButton,
                    opacity:
                      saving
                        ? 0.65
                        : 1,
                  }}
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : editingPlan
                    ? "Update Plan"
                    : "Create Plan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDetails &&
        selectedPlan && (
          <div
            style={
              styles.modalOverlay
            }
            onMouseDown={(
              event
            ) => {
              if (
                event.target ===
                event.currentTarget
              ) {
                setShowDetails(
                  false
                );
                setSelectedPlan(
                  null
                );
              }
            }}
          >
            <div
              style={styles.modal}
            >
              <div
                style={
                  styles.modalHeader
                }
              >
                <div>
                  <h2
                    style={
                      styles.modalTitle
                    }
                  >
                    Preventive Plan Details
                  </h2>

                  <span
                    style={
                      styles.secondary
                    }
                  >
                    {
                      selectedPlan.title
                    }
                  </span>
                </div>

                <button
                  type="button"
                  style={
                    styles.closeButton
                  }
                  onClick={() => {
                    setShowDetails(
                      false
                    );
                    setSelectedPlan(
                      null
                    );
                  }}
                >
                  ×
                </button>
              </div>

              <div
                style={
                  styles.modalBody
                }
              >
                <div
                  style={
                    styles.detailGrid
                  }
                >
                  <div
                    style={
                      styles.detailBox
                    }
                  >
                    <span
                      style={
                        styles.detailLabel
                      }
                    >
                      Asset
                    </span>

                    <span
                      style={
                        styles.detailValue
                      }
                    >
                      {
                        selectedPlan.assetName
                      }
                    </span>
                  </div>

                  <div
                    style={
                      styles.detailBox
                    }
                  >
                    <span
                      style={
                        styles.detailLabel
                      }
                    >
                      Asset Code
                    </span>

                    <span
                      style={
                        styles.detailValue
                      }
                    >
                      {
                        selectedPlan.assetCode
                      }
                    </span>
                  </div>

                  <div
                    style={
                      styles.detailBox
                    }
                  >
                    <span
                      style={
                        styles.detailLabel
                      }
                    >
                      Frequency
                    </span>

                    <span
                      style={
                        styles.detailValue
                      }
                    >
                      {
                        selectedPlan.frequency
                      }
                    </span>
                  </div>

                  <div
                    style={
                      styles.detailBox
                    }
                  >
                    <span
                      style={
                        styles.detailLabel
                      }
                    >
                      Next Due
                    </span>

                    <span
                      style={
                        styles.detailValue
                      }
                    >
                      {formatDate(
                        selectedPlan.nextDueDate
                      )}
                    </span>
                  </div>

                  <div
                    style={
                      styles.detailBox
                    }
                  >
                    <span
                      style={
                        styles.detailLabel
                      }
                    >
                      Last Service
                    </span>

                    <span
                      style={
                        styles.detailValue
                      }
                    >
                      {formatDate(
                        selectedPlan.lastServiceDate
                      )}
                    </span>
                  </div>

                  <div
                    style={
                      styles.detailBox
                    }
                  >
                    <span
                      style={
                        styles.detailLabel
                      }
                    >
                      Technician
                    </span>

                    <span
                      style={
                        styles.detailValue
                      }
                    >
                      {
                        selectedPlan.technicianName
                      }
                    </span>
                  </div>

                  <div
                    style={
                      styles.detailBox
                    }
                  >
                    <span
                      style={
                        styles.detailLabel
                      }
                    >
                      Priority
                    </span>

                    <span
                      style={
                        styles.detailValue
                      }
                    >
                      {
                        selectedPlan.priority
                      }
                    </span>
                  </div>

                  <div
                    style={
                      styles.detailBox
                    }
                  >
                    <span
                      style={
                        styles.detailLabel
                      }
                    >
                      Status
                    </span>

                    <span
                      style={
                        styles.detailValue
                      }
                    >
                      {isDue(
                        selectedPlan
                      )
                        ? "Overdue"
                        : selectedPlan.status}
                    </span>
                  </div>

                  <div
                    style={
                      styles.detailBox
                    }
                  >
                    <span
                      style={
                        styles.detailLabel
                      }
                    >
                      Estimated Duration
                    </span>

                    <span
                      style={
                        styles.detailValue
                      }
                    >
                      {selectedPlan.estimatedDuration
                        ? `${selectedPlan.estimatedDuration} hours`
                        : "—"}
                    </span>
                  </div>

                  <div
                    style={
                      styles.detailBox
                    }
                  >
                    <span
                      style={
                        styles.detailLabel
                      }
                    >
                      Estimated Cost
                    </span>

                    <span
                      style={
                        styles.detailValue
                      }
                    >
                      {selectedPlan.estimatedCost
                        ? Number(
                            selectedPlan.estimatedCost
                          ).toLocaleString()
                        : "—"}
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: "20px",
                  }}
                >
                  <span
                    style={
                      styles.detailLabel
                    }
                  >
                    Description
                  </span>

                  <div
                    style={{
                      fontSize:
                        "13px",
                      color:
                        "#344054",
                      lineHeight:
                        1.6,
                    }}
                  >
                    {selectedPlan.description ||
                      "No description provided."}
                  </div>
                </div>

                <div
                  style={{
                    marginTop: "18px",
                  }}
                >
                  <span
                    style={
                      styles.detailLabel
                    }
                  >
                    Instructions
                  </span>

                  <div
                    style={{
                      fontSize:
                        "13px",
                      color:
                        "#344054",
                      lineHeight:
                        1.6,
                      whiteSpace:
                        "pre-wrap",
                    }}
                  >
                    {selectedPlan.instructions ||
                      "No maintenance instructions provided."}
                  </div>
                </div>

                <div
                  style={{
                    marginTop: "18px",
                  }}
                >
                  <span
                    style={
                      styles.detailLabel
                    }
                  >
                    Notes
                  </span>

                  <div
                    style={{
                      fontSize:
                        "13px",
                      color:
                        "#344054",
                      lineHeight:
                        1.6,
                    }}
                  >
                    {selectedPlan.notes ||
                      "No notes."}
                  </div>
                </div>

                <div
                  style={{
                    display:
                      "flex",
                    justifyContent:
                      "flex-end",
                    gap: "9px",
                    marginTop:
                      "22px",
                  }}
                >
                  <button
                    type="button"
                    style={
                      styles.secondaryButton
                    }
                    onClick={() => {
                      setShowDetails(
                        false
                      );
                      openEdit(
                        selectedPlan
                      );
                    }}
                  >
                    Edit Plan
                  </button>

                  <button
                    type="button"
                    style={
                      styles.primaryButton
                    }
                    onClick={() => {
                      setShowDetails(
                        false
                      );
                      setSelectedPlan(
                        null
                      );
                    }}
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
