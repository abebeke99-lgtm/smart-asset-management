import React, { useEffect, useMemo, useState } from "react";

const API_BASE = "/api";

const REPAIR_STATUSES = [
  "pending",
  "in-progress",
  "completed",
  "cancelled",
];

const emptyForm = {
  workOrderId: "",
  requestId: "",
  assetId: "",
  technicianId: "",
  repairType: "corrective",
  status: "pending",
  startedAt: "",
  completedAt: "",
  problemDescription: "",
  diagnosis: "",
  repairDescription: "",
  workPerformed: "",
  partsUsed: "",
  materialsUsed: "",
  laborHours: "",
  laborCost: "",
  partsCost: "",
  materialsCost: "",
  otherCost: "",
  notes: "",
};

function getAuthHeaders() {
  const token =
    localStorage.getItem("token") ||
    localStorage.getItem("accessToken") ||
    localStorage.getItem("authToken");

  return {
    "Content-Type": "application/json",
    ...(token
      ? { Authorization: `Bearer ${token}` }
      : {}),
  };
}

async function apiRequest(url, options = {}) {
  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...(options.headers || {}),
    },
  });

  const contentType =
    response.headers.get("content-type") || "";

  const data = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message =
      typeof data === "object"
        ? data?.message ||
          data?.error ||
          "Request failed."
        : data || "Request failed.";

    throw new Error(message);
  }

  return data;
}

function normalizeList(data) {
  if (Array.isArray(data)) return data;

  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.repairs)) return data.repairs;
  if (Array.isArray(data?.workOrders)) {
    return data.workOrders;
  }
  if (Array.isArray(data?.technicians)) {
    return data.technicians;
  }
  if (Array.isArray(data?.assets)) {
    return data.assets;
  }

  return [];
}

function getRepairId(item) {
  return (
    item?.id ??
    item?.repairId ??
    item?.repair_id
  );
}

function getWorkOrderId(item) {
  return (
    item?.workOrderId ??
    item?.work_order_id ??
    item?.workOrder?.id ??
    ""
  );
}

function getRequestId(item) {
  return (
    item?.requestId ??
    item?.request_id ??
    item?.maintenanceRequestId ??
    item?.request?.id ??
    ""
  );
}

function getAssetId(item) {
  return (
    item?.assetId ??
    item?.asset_id ??
    item?.asset?.id ??
    ""
  );
}

function getTechnicianId(item) {
  return (
    item?.technicianId ??
    item?.technician_id ??
    item?.technician?.id ??
    ""
  );
}

function getStatus(item) {
  return String(
    item?.status ||
      item?.repairStatus ||
      item?.repair_status ||
      "pending"
  ).toLowerCase();
}

function getAssetName(item) {
  return (
    item?.asset?.name ||
    item?.asset?.assetName ||
    item?.assetName ||
    `Asset #${getAssetId(item) || "-"}`
  );
}

function getAssetTag(item) {
  return (
    item?.asset?.tagNumber ||
    item?.asset?.assetTag ||
    item?.assetTag ||
    item?.tagNumber ||
    "-"
  );
}

function getTechnicianName(item) {
  const technician = item?.technician;

  if (technician) {
    return (
      technician.name ||
      technician.fullName ||
      [
        technician.firstName,
        technician.lastName,
      ]
        .filter(Boolean)
        .join(" ") ||
      `Technician #${technician.id}`
    );
  }

  return (
    item?.technicianName ||
    item?.assignedTechnicianName ||
    (getTechnicianId(item)
      ? `Technician #${getTechnicianId(item)}`
      : "Unassigned")
  );
}

function formatStatus(status) {
  return String(status || "")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}

function formatDateTime(value) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function formatCurrency(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "-";
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "-";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "ETB",
    maximumFractionDigits: 2,
  }).format(number);
}

function numericValue(value) {
  if (value === "" || value === null || value === undefined) {
    return 0;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : 0;
}

function statusClass(status) {
  switch (String(status).toLowerCase()) {
    case "completed":
      return "status-success";

    case "in-progress":
      return "status-info";

    case "cancelled":
      return "status-danger";

    default:
      return "status-warning";
  }
}

export default function Repairs() {
  const [repairs, setRepairs] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [assets, setAssets] = useState([]);
  const [technicians, setTechnicians] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState("all");

  const [showModal, setShowModal] =
    useState(false);

  const [showDetails, setShowDetails] =
    useState(false);

  const [editingRepair, setEditingRepair] =
    useState(null);

  const [selectedRepair, setSelectedRepair] =
    useState(null);

  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const results = await Promise.allSettled([
        apiRequest("/maintenance/repairs"),
        apiRequest("/maintenance/work-orders"),
        apiRequest("/assets"),
        apiRequest("/maintenance/technicians"),
      ]);

      if (results[0].status !== "fulfilled") {
        throw results[0].reason;
      }

      setRepairs(
        normalizeList(results[0].value)
      );

      if (results[1].status === "fulfilled") {
        setWorkOrders(
          normalizeList(results[1].value)
        );
      }

      if (results[2].status === "fulfilled") {
        setAssets(
          normalizeList(results[2].value)
        );
      }

      if (results[3].status === "fulfilled") {
        setTechnicians(
          normalizeList(results[3].value)
        );
      }
    } catch (err) {
      setError(
        err?.message ||
          "Failed to load repair records."
      );
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setForm({
      ...emptyForm,
    });
  }

  function openCreateModal() {
    setEditingRepair(null);
    resetForm();
    setError("");
    setSuccess("");
    setShowModal(true);
  }

  function openEditModal(repair) {
    setEditingRepair(repair);

    setForm({
      workOrderId: getWorkOrderId(repair),
      requestId: getRequestId(repair),
      assetId: getAssetId(repair),
      technicianId: getTechnicianId(repair),

      repairType:
        repair?.repairType ||
        repair?.repair_type ||
        "corrective",

      status: getStatus(repair),

      startedAt:
        repair?.startedAt ||
        repair?.started_at ||
        "",

      completedAt:
        repair?.completedAt ||
        repair?.completed_at ||
        "",

      problemDescription:
        repair?.problemDescription ||
        repair?.problem_description ||
        "",

      diagnosis:
        repair?.diagnosis ||
        "",

      repairDescription:
        repair?.repairDescription ||
        repair?.repair_description ||
        "",

      workPerformed:
        repair?.workPerformed ||
        repair?.work_performed ||
        "",

      partsUsed:
        repair?.partsUsed ||
        repair?.parts_used ||
        "",

      materialsUsed:
        repair?.materialsUsed ||
        repair?.materials_used ||
        "",

      laborHours:
        repair?.laborHours ??
        repair?.labor_hours ??
        "",

      laborCost:
        repair?.laborCost ??
        repair?.labor_cost ??
        "",

      partsCost:
        repair?.partsCost ??
        repair?.parts_cost ??
        "",

      materialsCost:
        repair?.materialsCost ??
        repair?.materials_cost ??
        "",

      otherCost:
        repair?.otherCost ??
        repair?.other_cost ??
        "",

      notes:
        repair?.notes || "",
    });

    setError("");
    setSuccess("");
    setShowModal(true);
  }

  function openDetails(repair) {
    setSelectedRepair(repair);
    setShowDetails(true);
  }

  function closeModal() {
    if (saving) return;

    setShowModal(false);
    setEditingRepair(null);
  }

  function closeDetails() {
    setShowDetails(false);
    setSelectedRepair(null);
  }

  function handleChange(event) {
    const {
      name,
      value,
    } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function handleWorkOrderChange(event) {
    const workOrderId = event.target.value;

    const workOrder = workOrders.find(
      (item) =>
        String(
          item?.id ??
            item?.workOrderId
        ) === String(workOrderId)
    );

    setForm((current) => ({
      ...current,

      workOrderId,

      assetId:
        workOrder?.assetId ??
        workOrder?.asset_id ??
        workOrder?.asset?.id ??
        current.assetId,

      technicianId:
        workOrder?.technicianId ??
        workOrder?.technician_id ??
        workOrder?.technician?.id ??
        current.technicianId,

      requestId:
        workOrder?.requestId ??
        workOrder?.request_id ??
        workOrder?.request?.id ??
        current.requestId,

      problemDescription:
        current.problemDescription ||
        workOrder?.description ||
        "",
    }));
  }

  const totalCost = useMemo(() => {
    return (
      numericValue(form.laborCost) +
      numericValue(form.partsCost) +
      numericValue(form.materialsCost) +
      numericValue(form.otherCost)
    );
  }, [
    form.laborCost,
    form.partsCost,
    form.materialsCost,
    form.otherCost,
  ]);

  function buildPayload() {
    return {
      workOrderId: form.workOrderId
        ? Number(form.workOrderId)
        : null,

      requestId: form.requestId
        ? Number(form.requestId)
        : null,

      assetId: form.assetId
        ? Number(form.assetId)
        : null,

      technicianId: form.technicianId
        ? Number(form.technicianId)
        : null,

      repairType:
        form.repairType,

      status:
        form.status,

      startedAt:
        form.startedAt || null,

      completedAt:
        form.completedAt || null,

      problemDescription:
        form.problemDescription.trim(),

      diagnosis:
        form.diagnosis.trim(),

      repairDescription:
        form.repairDescription.trim(),

      workPerformed:
        form.workPerformed.trim(),

      partsUsed:
        form.partsUsed.trim(),

      materialsUsed:
        form.materialsUsed.trim(),

      laborHours:
        form.laborHours === ""
          ? null
          : Number(form.laborHours),

      laborCost:
        form.laborCost === ""
          ? null
          : Number(form.laborCost),

      partsCost:
        form.partsCost === ""
          ? null
          : Number(form.partsCost),

      materialsCost:
        form.materialsCost === ""
          ? null
          : Number(form.materialsCost),

      otherCost:
        form.otherCost === ""
          ? null
          : Number(form.otherCost),

      notes:
        form.notes.trim(),
    };
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setSaving(true);
    setError("");
    setSuccess("");

    if (!form.workOrderId) {
      setError(
        "Please select a work order."
      );
      setSaving(false);
      return;
    }

    if (!form.assetId) {
      setError("Please select an asset.");
      setSaving(false);
      return;
    }

    const numericFields = [
      ["Labor hours", form.laborHours],
      ["Labor cost", form.laborCost],
      ["Parts cost", form.partsCost],
      ["Materials cost", form.materialsCost],
      ["Other cost", form.otherCost],
    ];

    for (const [label, value] of numericFields) {
      if (
        value !== "" &&
        (!Number.isFinite(Number(value)) ||
          Number(value) < 0)
      ) {
        setError(
          `${label} must be a valid non-negative number.`
        );
        setSaving(false);
        return;
      }
    }

    if (
      form.status === "completed" &&
      !form.completedAt
    ) {
      setError(
        "Please provide a completion date/time for a completed repair."
      );
      setSaving(false);
      return;
    }

    const payload = buildPayload();

    try {
      if (editingRepair) {
        const id =
          getRepairId(editingRepair);

        const response = await apiRequest(
          `/maintenance/repairs/${id}`,
          {
            method: "PUT",
            body: JSON.stringify(payload),
          }
        );

        const updated =
          response?.data ||
          response?.repair ||
          response;

        setRepairs((current) =>
          current.map((item) =>
            String(
              getRepairId(item)
            ) === String(id)
              ? {
                  ...item,
                  ...updated,
                }
              : item
          )
        );

        setSuccess(
          "Repair updated successfully."
        );
      } else {
        const response = await apiRequest(
          "/maintenance/repairs",
          {
            method: "POST",
            body: JSON.stringify(payload),
          }
        );

        const created =
          response?.data ||
          response?.repair ||
          response;

        setRepairs((current) => [
          created,
          ...current,
        ]);

        setSuccess(
          "Repair created successfully."
        );
      }

      setShowModal(false);
      setEditingRepair(null);

      await loadData();
    } catch (err) {
      setError(
        err?.message ||
          "Failed to save repair."
      );
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(
    repair,
    nextStatus
  ) {
    const id = getRepairId(repair);

    if (!id) return;

    setError("");
    setSuccess("");

    const body = {
      status: nextStatus,
    };

    if (
      nextStatus === "in-progress" &&
      !repair?.startedAt &&
      !repair?.started_at
    ) {
      body.startedAt =
        new Date().toISOString();
    }

    if (
      nextStatus === "completed" &&
      !repair?.completedAt &&
      !repair?.completed_at
    ) {
      body.completedAt =
        new Date().toISOString();
    }

    try {
      const response = await apiRequest(
        `/maintenance/repairs/${id}`,
        {
          method: "PUT",
          body: JSON.stringify(body),
        }
      );

      const updated =
        response?.data ||
        response?.repair ||
        response;

      setRepairs((current) =>
        current.map((item) =>
          String(
            getRepairId(item)
          ) === String(id)
            ? {
                ...item,
                ...updated,
                status: nextStatus,
                ...(body.startedAt
                  ? {
                      startedAt:
                        body.startedAt,
                    }
                  : {}),
                ...(body.completedAt
                  ? {
                      completedAt:
                        body.completedAt,
                    }
                  : {}),
              }
            : item
        )
      );

      setSelectedRepair((current) =>
        current &&
        String(
          getRepairId(current)
        ) === String(id)
          ? {
              ...current,
              ...updated,
              status: nextStatus,
              ...(body.startedAt
                ? {
                    startedAt:
                      body.startedAt,
                  }
                : {}),
              ...(body.completedAt
                ? {
                    completedAt:
                      body.completedAt,
                  }
                : {}),
            }
          : current
      );

      setSuccess(
        `Repair status changed to ${formatStatus(
          nextStatus
        )}.`
      );

      await loadData();
    } catch (err) {
      setError(
        err?.message ||
          "Failed to update repair status."
      );
    }
  }

  async function handleDelete(repair) {
    const id = getRepairId(repair);

    if (!id) return;

    if (
      getStatus(repair) ===
      "completed"
    ) {
      setError(
        "Completed repairs should not be deleted."
      );
      return;
    }

    const confirmed = window.confirm(
      `Delete repair #${id}?`
    );

    if (!confirmed) return;

    setError("");
    setSuccess("");

    try {
      await apiRequest(
        `/maintenance/repairs/${id}`,
        {
          method: "DELETE",
        }
      );

      setRepairs((current) =>
        current.filter(
          (item) =>
            String(
              getRepairId(item)
            ) !== String(id)
        )
      );

      setSuccess(
        "Repair deleted successfully."
      );
    } catch (err) {
      setError(
        err?.message ||
          "Failed to delete repair."
      );
    }
  }

  const filteredRepairs = useMemo(() => {
    const query =
      search.trim().toLowerCase();

    return repairs.filter((repair) => {
      const status =
        getStatus(repair);

      if (
        statusFilter !== "all" &&
        status !== statusFilter
      ) {
        return false;
      }

      if (!query) {
        return true;
      }

      const searchable = [
        getRepairId(repair),
        getWorkOrderId(repair),
        getRequestId(repair),
        getAssetId(repair),
        getAssetName(repair),
        getAssetTag(repair),
        getTechnicianName(repair),
        repair?.repairType,
        repair?.problemDescription,
        repair?.diagnosis,
        repair?.repairDescription,
        repair?.workPerformed,
        repair?.notes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    });
  }, [
    repairs,
    search,
    statusFilter,
  ]);

  const summary = useMemo(() => {
    const total = repairs.length;

    const pending =
      repairs.filter(
        (item) =>
          getStatus(item) ===
          "pending"
      ).length;

    const inProgress =
      repairs.filter(
        (item) =>
          getStatus(item) ===
          "in-progress"
      ).length;

    const completed =
      repairs.filter(
        (item) =>
          getStatus(item) ===
          "completed"
      ).length;

    const totalCost =
      repairs.reduce(
        (sum, repair) => {
          const storedTotal =
            repair?.totalCost ??
            repair?.total_cost;

          if (
            storedTotal !== undefined &&
            storedTotal !== null
          ) {
            return (
              sum +
              numericValue(
                storedTotal
              )
            );
          }

          return (
            sum +
            numericValue(
              repair?.laborCost ??
                repair?.labor_cost
            ) +
            numericValue(
              repair?.partsCost ??
                repair?.parts_cost
            ) +
            numericValue(
              repair?.materialsCost ??
                repair?.materials_cost
            ) +
            numericValue(
              repair?.otherCost ??
                repair?.other_cost
            )
          );
        },
        0
      );

    return {
      total,
      pending,
      inProgress,
      completed,
      totalCost,
    };
  }, [repairs]);

  return (
    <div className="repairs-page">
      <style>{`
        .repairs-page {
          min-height: 100%;
          padding: 24px;
          background: #f6f8fb;
          color: #1f2937;
          box-sizing: border-box;
        }

        .repairs-container {
          max-width: 1550px;
          margin: 0 auto;
        }

        .page-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 24px;
        }

        .page-title {
          margin: 0;
          font-size: 28px;
          font-weight: 700;
          color: #111827;
        }

        .page-subtitle {
          margin: 7px 0 0;
          color: #6b7280;
          font-size: 14px;
        }

        .primary-btn {
          border: 0;
          border-radius: 8px;
          padding: 11px 16px;
          background: #2563eb;
          color: #fff;
          font-weight: 650;
          cursor: pointer;
        }

        .primary-btn:hover {
          background: #1d4ed8;
        }

        .primary-btn:disabled {
          opacity: .6;
          cursor: not-allowed;
        }

        .secondary-btn {
          border: 1px solid #d1d5db;
          border-radius: 8px;
          padding: 10px 14px;
          background: #fff;
          color: #374151;
          font-weight: 600;
          cursor: pointer;
        }

        .danger-btn {
          border: 1px solid #fecaca;
          border-radius: 7px;
          padding: 7px 10px;
          background: #fff;
          color: #dc2626;
          cursor: pointer;
          font-size: 12px;
          font-weight: 600;
        }

        .stats-grid {
          display: grid;
          grid-template-columns:
            repeat(5, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 20px;
        }

        .stat-card {
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 17px;
          box-shadow:
            0 1px 2px rgba(0,0,0,.03);
        }

        .stat-label {
          color: #6b7280;
          font-size: 13px;
          margin-bottom: 8px;
        }

        .stat-value {
          color: #111827;
          font-size: 24px;
          font-weight: 700;
        }

        .alert {
          border-radius: 8px;
          padding: 12px 14px;
          margin-bottom: 16px;
          font-size: 14px;
        }

        .alert-error {
          color: #991b1b;
          background: #fef2f2;
          border: 1px solid #fecaca;
        }

        .alert-success {
          color: #166534;
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
        }

        .toolbar {
          display: grid;
          grid-template-columns:
            minmax(280px, 1fr)
            190px;
          gap: 12px;
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 16px;
        }

        .input,
        .select,
        .textarea {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          padding: 10px 11px;
          background: #fff;
          color: #111827;
          font-size: 14px;
          outline: none;
        }

        .input:focus,
        .select:focus,
        .textarea:focus {
          border-color: #2563eb;
          box-shadow:
            0 0 0 3px
            rgba(37,99,235,.1);
        }

        .textarea {
          min-height: 90px;
          resize: vertical;
          font-family: inherit;
        }

        .table-card {
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          overflow: hidden;
        }

        .table-wrapper {
          width: 100%;
          overflow-x: auto;
        }

        .repairs-table {
          width: 100%;
          min-width: 1200px;
          border-collapse: collapse;
        }

        .repairs-table th,
        .repairs-table td {
          padding: 13px 14px;
          border-bottom: 1px solid #eef0f3;
          text-align: left;
          vertical-align: middle;
          font-size: 13px;
        }

        .repairs-table th {
          background: #f9fafb;
          color: #6b7280;
          font-weight: 700;
          white-space: nowrap;
        }

        .repairs-table tr:last-child td {
          border-bottom: 0;
        }

        .primary-text {
          color: #111827;
          font-weight: 650;
        }

        .muted {
          color: #6b7280;
        }

        .status {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          padding: 5px 9px;
          font-size: 11px;
          font-weight: 700;
          white-space: nowrap;
        }

        .status-success {
          background: #dcfce7;
          color: #166534;
        }

        .status-info {
          background: #dbeafe;
          color: #1d4ed8;
        }

        .status-warning {
          background: #fef3c7;
          color: #92400e;
        }

        .status-danger {
          background: #fee2e2;
          color: #991b1b;
        }

        .actions {
          display: flex;
          gap: 7px;
          flex-wrap: wrap;
        }

        .action-btn {
          border: 1px solid #d1d5db;
          border-radius: 7px;
          padding: 7px 9px;
          background: #fff;
          color: #374151;
          cursor: pointer;
          font-size: 12px;
          font-weight: 600;
        }

        .action-btn:hover {
          background: #f9fafb;
        }

        .empty-state,
        .loading-state {
          padding: 55px 20px;
          text-align: center;
          color: #6b7280;
        }

        .modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: rgba(17,24,39,.48);
        }

        .modal {
          width: min(960px, 100%);
          max-height: 92vh;
          overflow-y: auto;
          background: #fff;
          border-radius: 14px;
          box-shadow:
            0 20px 50px
            rgba(0,0,0,.2);
        }

        .modal-header {
          position: sticky;
          top: 0;
          z-index: 2;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 18px 20px;
          background: #fff;
          border-bottom: 1px solid #e5e7eb;
        }

        .modal-title {
          margin: 0;
          font-size: 19px;
          font-weight: 700;
          color: #111827;
        }

        .close-btn {
          border: 0;
          background: transparent;
          color: #6b7280;
          font-size: 24px;
          line-height: 1;
          cursor: pointer;
        }

        .modal-body {
          padding: 20px;
        }

        .form-grid {
          display: grid;
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
          gap: 16px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .form-group.full {
          grid-column: 1 / -1;
        }

        .form-label {
          color: #374151;
          font-size: 13px;
          font-weight: 650;
        }

        .modal-footer {
          position: sticky;
          bottom: 0;
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          padding: 16px 20px;
          background: #fff;
          border-top: 1px solid #e5e7eb;
        }

        .cost-summary {
          display: grid;
          grid-template-columns:
            repeat(4, minmax(0, 1fr));
          gap: 10px;
          margin-top: 5px;
          padding: 14px;
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 9px;
        }

        .cost-item {
          padding: 8px;
        }

        .cost-label {
          color: #6b7280;
          font-size: 11px;
          margin-bottom: 5px;
        }

        .cost-value {
          color: #111827;
          font-size: 15px;
          font-weight: 700;
        }

        .total-cost {
          padding-top: 13px;
          margin-top: 10px;
          border-top: 1px solid #d1d5db;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .total-cost-label {
          font-weight: 700;
          color: #374151;
        }

        .total-cost-value {
          font-size: 20px;
          font-weight: 750;
          color: #111827;
        }

        .details-grid {
          display: grid;
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .detail-card {
          border: 1px solid #e5e7eb;
          border-radius: 9px;
          padding: 13px;
          background: #fafafa;
        }

        .detail-card.full {
          grid-column: 1 / -1;
        }

        .detail-label {
          margin-bottom: 6px;
          color: #6b7280;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: .04em;
        }

        .detail-value {
          color: #111827;
          font-size: 14px;
          line-height: 1.5;
          white-space: pre-wrap;
        }

        .detail-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 18px;
        }

        .section-title {
          margin: 22px 0 12px;
          font-size: 14px;
          font-weight: 700;
          color: #111827;
        }

        @media (max-width: 1100px) {
          .stats-grid {
            grid-template-columns:
              repeat(3, minmax(0, 1fr));
          }

          .cost-summary {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 720px) {
          .repairs-page {
            padding: 14px;
          }

          .page-header {
            flex-direction: column;
          }

          .primary-btn {
            width: 100%;
          }

          .stats-grid {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }

          .toolbar {
            grid-template-columns: 1fr;
          }

          .form-grid,
          .details-grid,
          .cost-summary {
            grid-template-columns: 1fr;
          }

          .form-group.full,
          .detail-card.full {
            grid-column: auto;
          }

          .modal-backdrop {
            padding: 8px;
          }

          .modal {
            max-height: 96vh;
          }
        }
      `}</style>

      <div className="repairs-container">
        <div className="page-header">
          <div>
            <h1 className="page-title">
              Repairs
            </h1>

            <p className="page-subtitle">
              Record repair activities, technician
              work, parts, materials and maintenance
              costs.
            </p>
          </div>

          <button
            type="button"
            className="primary-btn"
            onClick={openCreateModal}
          >
            + New Repair
          </button>
        </div>

        {error && (
          <div className="alert alert-error">
            {error}
          </div>
        )}

        {success && (
          <div className="alert alert-success">
            {success}
          </div>
        )}

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">
              Total Repairs
            </div>

            <div className="stat-value">
              {summary.total}
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Pending
            </div>

            <div className="stat-value">
              {summary.pending}
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              In Progress
            </div>

            <div className="stat-value">
              {summary.inProgress}
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Completed
            </div>

            <div className="stat-value">
              {summary.completed}
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Total Repair Cost
            </div>

            <div className="stat-value">
              {formatCurrency(
                summary.totalCost
              )}
            </div>
          </div>
        </div>

        <div className="toolbar">
          <input
            type="search"
            className="input"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search repair, work order, asset, technician..."
          />

          <select
            className="select"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value
              )
            }
          >
            <option value="all">
              All statuses
            </option>

            {REPAIR_STATUSES.map(
              (status) => (
                <option
                  key={status}
                  value={status}
                >
                  {formatStatus(status)}
                </option>
              )
            )}
          </select>
        </div>

        <div className="table-card">
          {loading ? (
            <div className="loading-state">
              Loading repairs...
            </div>
          ) : filteredRepairs.length === 0 ? (
            <div className="empty-state">
              No repair records found.
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="repairs-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Asset</th>
                    <th>Work Order</th>
                    <th>Technician</th>
                    <th>Repair Type</th>
                    <th>Status</th>
                    <th>Started</th>
                    <th>Total Cost</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredRepairs.map(
                    (repair) => {
                      const id =
                        getRepairId(
                          repair
                        );

                      const status =
                        getStatus(
                          repair
                        );

                      const total =
                        repair?.totalCost ??
                        repair?.total_cost;

                      const calculatedTotal =
                        numericValue(
                          repair?.laborCost ??
                            repair?.labor_cost
                        ) +
                        numericValue(
                          repair?.partsCost ??
                            repair?.parts_cost
                        ) +
                        numericValue(
                          repair?.materialsCost ??
                            repair?.materials_cost
                        ) +
                        numericValue(
                          repair?.otherCost ??
                            repair?.other_cost
                        );

                      return (
                        <tr key={id}>
                          <td>
                            #{id}
                          </td>

                          <td>
                            <div className="primary-text">
                              {getAssetName(
                                repair
                              )}
                            </div>

                            <div className="muted">
                              Tag:{" "}
                              {getAssetTag(
                                repair
                              )}
                            </div>
                          </td>

                          <td>
                            {getWorkOrderId(
                              repair
                            )
                              ? `#${getWorkOrderId(
                                  repair
                                )}`
                              : "-"}
                          </td>

                          <td>
                            {getTechnicianName(
                              repair
                            )}
                          </td>

                          <td>
                            {repair?.repairType ||
                              repair?.repair_type ||
                              "Corrective"}
                          </td>

                          <td>
                            <span
                              className={`status ${statusClass(
                                status
                              )}`}
                            >
                              {formatStatus(
                                status
                              )}
                            </span>
                          </td>

                          <td>
                            {formatDateTime(
                              repair?.startedAt ||
                                repair?.started_at
                            )}
                          </td>

                          <td>
                            {formatCurrency(
                              total ??
                                calculatedTotal
                            )}
                          </td>

                          <td>
                            <div className="actions">
                              <button
                                type="button"
                                className="action-btn"
                                onClick={() =>
                                  openDetails(
                                    repair
                                  )
                                }
                              >
                                View
                              </button>

                              <button
                                type="button"
                                className="action-btn"
                                onClick={() =>
                                  openEditModal(
                                    repair
                                  )
                                }
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                className="danger-btn"
                                onClick={() =>
                                  handleDelete(
                                    repair
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
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">
                {editingRepair
                  ? "Edit Repair"
                  : "New Repair"}
              </h2>

              <button
                type="button"
                className="close-btn"
                onClick={closeModal}
                disabled={saving}
              >
                ×
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
            >
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">
                      Work Order{" "}
                      <span style={{ color: "#dc2626" }}>
                        *
                      </span>
                    </label>

                    <select
                      className="select"
                      name="workOrderId"
                      value={
                        form.workOrderId
                      }
                      onChange={
                        handleWorkOrderChange
                      }
                      required
                    >
                      <option value="">
                        Select work order
                      </option>

                      {workOrders.map(
                        (workOrder) => {
                          const id =
                            workOrder?.id ??
                            workOrder?.workOrderId;

                          return (
                            <option
                              key={id}
                              value={id}
                            >
                              WO #{id}
                              {workOrder?.title
                                ? ` — ${workOrder.title}`
                                : ""}
                            </option>
                          );
                        }
                      )}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Asset{" "}
                      <span style={{ color: "#dc2626" }}>
                        *
                      </span>
                    </label>

                    <select
                      className="select"
                      name="assetId"
                      value={
                        form.assetId
                      }
                      onChange={
                        handleChange
                      }
                      required
                    >
                      <option value="">
                        Select asset
                      </option>

                      {assets.map(
                        (asset) => (
                          <option
                            key={
                              asset.id
                            }
                            value={
                              asset.id
                            }
                          >
                            {asset.name ||
                              asset.assetName ||
                              `Asset #${asset.id}`}
                            {asset.tagNumber
                              ? ` — ${asset.tagNumber}`
                              : ""}
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Technician
                    </label>

                    <select
                      className="select"
                      name="technicianId"
                      value={
                        form.technicianId
                      }
                      onChange={
                        handleChange
                      }
                    >
                      <option value="">
                        Unassigned
                      </option>

                      {technicians.map(
                        (technician) => (
                          <option
                            key={
                              technician.id
                            }
                            value={
                              technician.id
                            }
                          >
                            {technician.name ||
                              technician.fullName ||
                              [
                                technician.firstName,
                                technician.lastName,
                              ]
                                .filter(
                                  Boolean
                                )
                                .join(
                                  " "
                                ) ||
                              `Technician #${technician.id}`}
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Repair Type
                    </label>

                    <select
                      className="select"
                      name="repairType"
                      value={
                        form.repairType
                      }
                      onChange={
                        handleChange
                      }
                    >
                      <option value="corrective">
                        Corrective
                      </option>

                      <option value="preventive">
                        Preventive
                      </option>

                      <option value="emergency">
                        Emergency
                      </option>

                      <option value="overhaul">
                        Overhaul
                      </option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Status
                    </label>

                    <select
                      className="select"
                      name="status"
                      value={
                        form.status
                      }
                      onChange={
                        handleChange
                      }
                    >
                      {REPAIR_STATUSES.map(
                        (status) => (
                          <option
                            key={
                              status
                            }
                            value={
                              status
                            }
                          >
                            {formatStatus(
                              status
                            )}
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Started At
                    </label>

                    <input
                      className="input"
                      type="datetime-local"
                      name="startedAt"
                      value={
                        form.startedAt
                      }
                      onChange={
                        handleChange
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Completed At
                    </label>

                    <input
                      className="input"
                      type="datetime-local"
                      name="completedAt"
                      value={
                        form.completedAt
                      }
                      onChange={
                        handleChange
                      }
                    />
                  </div>

                  <div className="form-group full">
                    <label className="form-label">
                      Problem Description
                    </label>

                    <textarea
                      className="textarea"
                      name="problemDescription"
                      value={
                        form.problemDescription
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="Describe the reported problem..."
                    />
                  </div>

                  <div className="form-group full">
                    <label className="form-label">
                      Diagnosis
                    </label>

                    <textarea
                      className="textarea"
                      name="diagnosis"
                      value={
                        form.diagnosis
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="Describe the technical diagnosis..."
                    />
                  </div>

                  <div className="form-group full">
                    <label className="form-label">
                      Repair Description
                    </label>

                    <textarea
                      className="textarea"
                      name="repairDescription"
                      value={
                        form.repairDescription
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="Describe the repair required or performed..."
                    />
                  </div>

                  <div className="form-group full">
                    <label className="form-label">
                      Work Performed
                    </label>

                    <textarea
                      className="textarea"
                      name="workPerformed"
                      value={
                        form.workPerformed
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="Record the actual work performed by the technician..."
                    />
                  </div>

                  <div className="form-group full">
                    <label className="form-label">
                      Parts Used
                    </label>

                    <textarea
                      className="textarea"
                      name="partsUsed"
                      value={
                        form.partsUsed
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="List spare parts used..."
                    />
                  </div>

                  <div className="form-group full">
                    <label className="form-label">
                      Materials Used
                    </label>

                    <textarea
                      className="textarea"
                      name="materialsUsed"
                      value={
                        form.materialsUsed
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="List materials consumed..."
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Labor Hours
                    </label>

                    <input
                      className="input"
                      type="number"
                      min="0"
                      step="0.1"
                      name="laborHours"
                      value={
                        form.laborHours
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="0"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Labor Cost
                    </label>

                    <input
                      className="input"
                      type="number"
                      min="0"
                      step="0.01"
                      name="laborCost"
                      value={
                        form.laborCost
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="0.00"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Parts Cost
                    </label>

                    <input
                      className="input"
                      type="number"
                      min="0"
                      step="0.01"
                      name="partsCost"
                      value={
                        form.partsCost
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="0.00"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Materials Cost
                    </label>

                    <input
                      className="input"
                      type="number"
                      min="0"
                      step="0.01"
                      name="materialsCost"
                      value={
                        form.materialsCost
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="0.00"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Other Cost
                    </label>

                    <input
                      className="input"
                      type="number"
                      min="0"
                      step="0.01"
                      name="otherCost"
                      value={
                        form.otherCost
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="0.00"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Calculated Total
                    </label>

                    <input
                      className="input"
                      value={formatCurrency(
                        totalCost
                      )}
                      readOnly
                    />
                  </div>

                  <div className="form-group full">
                    <div className="cost-summary">
                      <div className="cost-item">
                        <div className="cost-label">
                          Labor
                        </div>

                        <div className="cost-value">
                          {formatCurrency(
                            form.laborCost
                          )}
                        </div>
                      </div>

                      <div className="cost-item">
                        <div className="cost-label">
                          Parts
                        </div>

                        <div className="cost-value">
                          {formatCurrency(
                            form.partsCost
                          )}
                        </div>
                      </div>

                      <div className="cost-item">
                        <div className="cost-label">
                          Materials
                        </div>

                        <div className="cost-value">
                          {formatCurrency(
                            form.materialsCost
                          )}
                        </div>
                      </div>

                      <div className="cost-item">
                        <div className="cost-label">
                          Other
                        </div>

                        <div className="cost-value">
                          {formatCurrency(
                            form.otherCost
                          )}
                        </div>
                      </div>

                      <div className="total-cost">
                        <span className="total-cost-label">
                          Total Repair Cost
                        </span>

                        <span className="total-cost-value">
                          {formatCurrency(
                            totalCost
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="form-group full">
                    <label className="form-label">
                      Notes
                    </label>

                    <textarea
                      className="textarea"
                      name="notes"
                      value={
                        form.notes
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="Additional repair notes..."
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-btn"
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : editingRepair
                    ? "Update Repair"
                    : "Create Repair"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDetails &&
        selectedRepair && (
          <div className="modal-backdrop">
            <div className="modal">
              <div className="modal-header">
                <h2 className="modal-title">
                  Repair #
                  {getRepairId(
                    selectedRepair
                  )}
                </h2>

                <button
                  type="button"
                  className="close-btn"
                  onClick={closeDetails}
                >
                  ×
                </button>
              </div>

              <div className="modal-body">
                <div className="details-grid">
                  <div className="detail-card">
                    <div className="detail-label">
                      Asset
                    </div>

                    <div className="detail-value">
                      {getAssetName(
                        selectedRepair
                      )}
                      <br />
                      <span className="muted">
                        Tag:{" "}
                        {getAssetTag(
                          selectedRepair
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="detail-card">
                    <div className="detail-label">
                      Work Order
                    </div>

                    <div className="detail-value">
                      {getWorkOrderId(
                        selectedRepair
                      )
                        ? `#${getWorkOrderId(
                            selectedRepair
                          )}`
                        : "-"}
                    </div>
                  </div>

                  <div className="detail-card">
                    <div className="detail-label">
                      Maintenance Request
                    </div>

                    <div className="detail-value">
                      {getRequestId(
                        selectedRepair
                      )
                        ? `#${getRequestId(
                            selectedRepair
                          )}`
                        : "-"}
                    </div>
                  </div>

                  <div className="detail-card">
                    <div className="detail-label">
                      Technician
                    </div>

                    <div className="detail-value">
                      {getTechnicianName(
                        selectedRepair
                      )}
                    </div>
                  </div>

                  <div className="detail-card">
                    <div className="detail-label">
                      Repair Type
                    </div>

                    <div className="detail-value">
                      {selectedRepair?.repairType ||
                        selectedRepair?.repair_type ||
                        "Corrective"}
                    </div>
                  </div>

                  <div className="detail-card">
                    <div className="detail-label">
                      Status
                    </div>

                    <div className="detail-value">
                      <span
                        className={`status ${statusClass(
                          getStatus(
                            selectedRepair
                          )
                        )}`}
                      >
                        {formatStatus(
                          getStatus(
                            selectedRepair
                          )
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="detail-card">
                    <div className="detail-label">
                      Started At
                    </div>

                    <div className="detail-value">
                      {formatDateTime(
                        selectedRepair?.startedAt ||
                          selectedRepair?.started_at
                      )}
                    </div>
                  </div>

                  <div className="detail-card">
                    <div className="detail-label">
                      Completed At
                    </div>

                    <div className="detail-value">
                      {formatDateTime(
                        selectedRepair?.completedAt ||
                          selectedRepair?.completed_at
                      )}
                    </div>
                  </div>

                  <div className="detail-card full">
                    <div className="detail-label">
                      Problem Description
                    </div>

                    <div className="detail-value">
                      {selectedRepair?.problemDescription ||
                        selectedRepair?.problem_description ||
                        "-"}
                    </div>
                  </div>

                  <div className="detail-card full">
                    <div className="detail-label">
                      Diagnosis
                    </div>

                    <div className="detail-value">
                      {selectedRepair?.diagnosis ||
                        "-"}
                    </div>
                  </div>

                  <div className="detail-card full">
                    <div className="detail-label">
                      Repair Description
                    </div>

                    <div className="detail-value">
                      {selectedRepair?.repairDescription ||
                        selectedRepair?.repair_description ||
                        "-"}
                    </div>
                  </div>

                  <div className="detail-card full">
                    <div className="detail-label">
                      Work Performed
                    </div>

                    <div className="detail-value">
                      {selectedRepair?.workPerformed ||
                        selectedRepair?.work_performed ||
                        "-"}
                    </div>
                  </div>

                  <div className="detail-card full">
                    <div className="detail-label">
                      Parts Used
                    </div>

                    <div className="detail-value">
                      {selectedRepair?.partsUsed ||
                        selectedRepair?.parts_used ||
                        "-"}
                    </div>
                  </div>

                  <div className="detail-card full">
                    <div className="detail-label">
                      Materials Used
                    </div>

                    <div className="detail-value">
                      {selectedRepair?.materialsUsed ||
                        selectedRepair?.materials_used ||
                        "-"}
                    </div>
                  </div>

                  <div className="detail-card">
                    <div className="detail-label">
                      Labor Hours
                    </div>

                    <div className="detail-value">
                      {selectedRepair?.laborHours ??
                        selectedRepair?.labor_hours ??
                        "-"}
                    </div>
                  </div>

                  <div className="detail-card">
                    <div className="detail-label">
                      Labor Cost
                    </div>

                    <div className="detail-value">
                      {formatCurrency(
                        selectedRepair?.laborCost ??
                          selectedRepair?.labor_cost
                      )}
                    </div>
                  </div>

                  <div className="detail-card">
                    <div className="detail-label">
                      Parts Cost
                    </div>

                    <div className="detail-value">
                      {formatCurrency(
                        selectedRepair?.partsCost ??
                          selectedRepair?.parts_cost
                      )}
                    </div>
                  </div>

                  <div className="detail-card">
                    <div className="detail-label">
                      Materials Cost
                    </div>

                    <div className="detail-value">
                      {formatCurrency(
                        selectedRepair?.materialsCost ??
                          selectedRepair?.materials_cost
                      )}
                    </div>
                  </div>

                  <div className="detail-card">
                    <div className="detail-label">
                      Other Cost
                    </div>

                    <div className="detail-value">
                      {formatCurrency(
                        selectedRepair?.otherCost ??
                          selectedRepair?.other_cost
                      )}
                    </div>
                  </div>

                  <div className="detail-card">
                    <div className="detail-label">
                      Total Cost
                    </div>

                    <div className="detail-value">
                      {formatCurrency(
                        selectedRepair?.totalCost ??
                          selectedRepair?.total_cost ??
                          (
                            numericValue(
                              selectedRepair?.laborCost ??
                                selectedRepair?.labor_cost
                            ) +
                            numericValue(
                              selectedRepair?.partsCost ??
                                selectedRepair?.parts_cost
                            ) +
                            numericValue(
                              selectedRepair?.materialsCost ??
                                selectedRepair?.materials_cost
                            ) +
                            numericValue(
                              selectedRepair?.otherCost ??
                                selectedRepair?.other_cost
                            )
                          )
                      )}
                    </div>
                  </div>

                  <div className="detail-card full">
                    <div className="detail-label">
                      Notes
                    </div>

                    <div className="detail-value">
                      {selectedRepair?.notes ||
                        "-"}
                    </div>
                  </div>
                </div>

                <div className="section-title">
                  Repair Actions
                </div>

                <div className="detail-actions">
                  <button
                    type="button"
                    className="action-btn"
                    onClick={() =>
                      updateStatus(
                        selectedRepair,
                        "in-progress"
                      )
                    }
                  >
                    Start Repair
                  </button>

                  <button
                    type="button"
                    className="action-btn"
                    onClick={() =>
                      updateStatus(
                        selectedRepair,
                        "completed"
                      )
                    }
                  >
                    Complete Repair
                  </button>

                  <button
                    type="button"
                    className="danger-btn"
                    onClick={() =>
                      updateStatus(
                        selectedRepair,
                        "cancelled"
                      )
                    }
                  >
                    Cancel Repair
                  </button>

                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={() =>
                      openEditModal(
                        selectedRepair
                      )
                    }
                  >
                    Edit Repair
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
