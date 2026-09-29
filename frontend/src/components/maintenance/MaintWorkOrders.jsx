import React, { useEffect, useMemo, useState } from "react";

const API_BASE = "/api";

const WORK_ORDER_STATUSES = [
  "draft",
  "assigned",
  "in-progress",
  "on-hold",
  "completed",
  "cancelled",
];

const PRIORITIES = [
  "low",
  "medium",
  "high",
  "critical",
];

const emptyForm = {
  requestId: "",
  assetId: "",
  technicianId: "",
  title: "",
  description: "",
  priority: "medium",
  status: "draft",
  scheduledStart: "",
  scheduledEnd: "",
  estimatedHours: "",
  estimatedCost: "",
  instructions: "",
  safetyRequirements: "",
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
      ? {
          Authorization: `Bearer ${token}`,
        }
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
  if (Array.isArray(data?.workOrders)) {
    return data.workOrders;
  }
  if (Array.isArray(data?.requests)) {
    return data.requests;
  }
  if (Array.isArray(data?.technicians)) {
    return data.technicians;
  }
  if (Array.isArray(data?.assets)) {
    return data.assets;
  }

  return [];
}

function getId(item) {
  return item?.id ?? item?.workOrderId ?? item?.work_order_id;
}

function getRequestId(item) {
  return (
    item?.requestId ??
    item?.request_id ??
    item?.maintenanceRequestId ??
    item?.maintenance_request_id ??
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
      item?.workOrderStatus ||
      item?.work_order_status ||
      "draft"
  ).toLowerCase();
}

function getPriority(item) {
  return String(
    item?.priority || "medium"
  ).toLowerCase();
}

function getAssetName(item) {
  return (
    item?.asset?.name ||
    item?.asset?.assetName ||
    item?.assetName ||
    item?.asset?.description ||
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

function getRequestTitle(item) {
  return (
    item?.request?.title ||
    item?.request?.subject ||
    item?.requestTitle ||
    item?.title ||
    `Request #${getRequestId(item) || "-"}`
  );
}

function formatStatus(status) {
  return String(status || "")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}

function formatPriority(priority) {
  return String(priority || "")
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

function statusClass(status) {
  switch (String(status).toLowerCase()) {
    case "completed":
      return "status-success";

    case "in-progress":
      return "status-info";

    case "assigned":
      return "status-primary";

    case "on-hold":
      return "status-warning";

    case "cancelled":
      return "status-danger";

    default:
      return "status-neutral";
  }
}

function priorityClass(priority) {
  switch (String(priority).toLowerCase()) {
    case "critical":
      return "priority-critical";

    case "high":
      return "priority-high";

    case "medium":
      return "priority-medium";

    default:
      return "priority-low";
  }
}

export default function WorkOrders() {
  const [workOrders, setWorkOrders] = useState([]);
  const [requests, setRequests] = useState([]);
  const [assets, setAssets] = useState([]);
  const [technicians, setTechnicians] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState("all");
  const [priorityFilter, setPriorityFilter] =
    useState("all");
  const [technicianFilter, setTechnicianFilter] =
    useState("all");

  const [showModal, setShowModal] = useState(false);
  const [showDetails, setShowDetails] =
    useState(false);

  const [editingWorkOrder, setEditingWorkOrder] =
    useState(null);
  const [selectedWorkOrder, setSelectedWorkOrder] =
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
        apiRequest("/maintenance/work-orders"),
        apiRequest("/maintenance/requests"),
        apiRequest("/assets"),
        apiRequest("/maintenance/technicians"),
      ]);

      const workOrderResult = results[0];

      if (
        workOrderResult.status !== "fulfilled"
      ) {
        throw workOrderResult.reason;
      }

      setWorkOrders(
        normalizeList(workOrderResult.value)
      );

      if (results[1].status === "fulfilled") {
        setRequests(
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
          "Failed to load work orders."
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
    setEditingWorkOrder(null);
    resetForm();
    setError("");
    setSuccess("");
    setShowModal(true);
  }

  function openEditModal(workOrder) {
    setEditingWorkOrder(workOrder);

    setForm({
      requestId: getRequestId(workOrder),
      assetId: getAssetId(workOrder),
      technicianId: getTechnicianId(workOrder),

      title:
        workOrder?.title ||
        workOrder?.subject ||
        "",

      description:
        workOrder?.description ||
        workOrder?.problemDescription ||
        "",

      priority:
        getPriority(workOrder) || "medium",

      status:
        getStatus(workOrder) || "draft",

      scheduledStart:
        workOrder?.scheduledStart ||
        workOrder?.scheduled_start ||
        "",

      scheduledEnd:
        workOrder?.scheduledEnd ||
        workOrder?.scheduled_end ||
        "",

      estimatedHours:
        workOrder?.estimatedHours ??
        workOrder?.estimated_hours ??
        "",

      estimatedCost:
        workOrder?.estimatedCost ??
        workOrder?.estimated_cost ??
        "",

      instructions:
        workOrder?.instructions ||
        workOrder?.workInstructions ||
        "",

      safetyRequirements:
        workOrder?.safetyRequirements ||
        workOrder?.safety_requirements ||
        "",

      notes:
        workOrder?.notes ||
        "",
    });

    setError("");
    setSuccess("");
    setShowModal(true);
  }

  function openDetails(workOrder) {
    setSelectedWorkOrder(workOrder);
    setShowDetails(true);
  }

  function closeModal() {
    if (saving) return;

    setShowModal(false);
    setEditingWorkOrder(null);
  }

  function closeDetails() {
    setShowDetails(false);
    setSelectedWorkOrder(null);
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

  function handleRequestChange(event) {
    const requestId = event.target.value;

    const request = requests.find(
      (item) =>
        String(
          item?.id ??
            item?.requestId
        ) === String(requestId)
    );

    setForm((current) => ({
      ...current,
      requestId,
      assetId:
        request?.assetId ??
        request?.asset_id ??
        request?.asset?.id ??
        current.assetId,
      title:
        current.title ||
        request?.title ||
        request?.subject ||
        "",
      description:
        current.description ||
        request?.description ||
        "",
      priority:
        request?.priority ||
        current.priority,
    }));
  }

  function buildPayload() {
    return {
      requestId: form.requestId
        ? Number(form.requestId)
        : null,

      assetId: form.assetId
        ? Number(form.assetId)
        : null,

      technicianId: form.technicianId
        ? Number(form.technicianId)
        : null,

      title: form.title.trim(),

      description:
        form.description.trim(),

      priority: form.priority,

      status: form.status,

      scheduledStart:
        form.scheduledStart || null,

      scheduledEnd:
        form.scheduledEnd || null,

      estimatedHours:
        form.estimatedHours === ""
          ? null
          : Number(form.estimatedHours),

      estimatedCost:
        form.estimatedCost === ""
          ? null
          : Number(form.estimatedCost),

      instructions:
        form.instructions.trim(),

      safetyRequirements:
        form.safetyRequirements.trim(),

      notes:
        form.notes.trim(),
    };
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setSaving(true);
    setError("");
    setSuccess("");

    if (!form.requestId) {
      setError(
        "Please select a maintenance request."
      );
      setSaving(false);
      return;
    }

    if (!form.assetId) {
      setError("Please select an asset.");
      setSaving(false);
      return;
    }

    if (!form.title.trim()) {
      setError(
        "Please enter a work order title."
      );
      setSaving(false);
      return;
    }

    if (
      form.estimatedHours !== "" &&
      Number(form.estimatedHours) < 0
    ) {
      setError(
        "Estimated hours cannot be negative."
      );
      setSaving(false);
      return;
    }

    if (
      form.estimatedCost !== "" &&
      Number(form.estimatedCost) < 0
    ) {
      setError(
        "Estimated cost cannot be negative."
      );
      setSaving(false);
      return;
    }

    const payload = buildPayload();

    try {
      if (editingWorkOrder) {
        const id = getId(editingWorkOrder);

        const response = await apiRequest(
          `/maintenance/work-orders/${id}`,
          {
            method: "PUT",
            body: JSON.stringify(payload),
          }
        );

        const updated =
          response?.data ||
          response?.workOrder ||
          response;

        setWorkOrders((current) =>
          current.map((item) =>
            String(getId(item)) ===
            String(id)
              ? {
                  ...item,
                  ...updated,
                }
              : item
          )
        );

        setSuccess(
          "Work order updated successfully."
        );
      } else {
        const response = await apiRequest(
          "/maintenance/work-orders",
          {
            method: "POST",
            body: JSON.stringify(payload),
          }
        );

        const created =
          response?.data ||
          response?.workOrder ||
          response;

        setWorkOrders((current) => [
          created,
          ...current,
        ]);

        setSuccess(
          "Work order created successfully."
        );
      }

      setShowModal(false);
      setEditingWorkOrder(null);

      await loadData();
    } catch (err) {
      setError(
        err?.message ||
          "Failed to save work order."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(workOrder) {
    const id = getId(workOrder);

    if (!id) return;

    if (
      getStatus(workOrder) ===
        "completed"
    ) {
      setError(
        "Completed work orders should not be deleted."
      );
      return;
    }

    const confirmed = window.confirm(
      `Delete work order #${id}?`
    );

    if (!confirmed) return;

    setError("");
    setSuccess("");

    try {
      await apiRequest(
        `/maintenance/work-orders/${id}`,
        {
          method: "DELETE",
        }
      );

      setWorkOrders((current) =>
        current.filter(
          (item) =>
            String(getId(item)) !==
            String(id)
        )
      );

      setSuccess(
        "Work order deleted successfully."
      );
    } catch (err) {
      setError(
        err?.message ||
          "Failed to delete work order."
      );
    }
  }

  async function updateStatus(
    workOrder,
    nextStatus
  ) {
    const id = getId(workOrder);

    if (!id) return;

    setError("");
    setSuccess("");

    try {
      const response = await apiRequest(
        `/maintenance/work-orders/${id}`,
        {
          method: "PUT",
          body: JSON.stringify({
            status: nextStatus,
          }),
        }
      );

      const updated =
        response?.data ||
        response?.workOrder ||
        response;

      setWorkOrders((current) =>
        current.map((item) =>
          String(getId(item)) ===
          String(id)
            ? {
                ...item,
                ...updated,
                status: nextStatus,
              }
            : item
        )
      );

      setSelectedWorkOrder((current) =>
        current &&
        String(getId(current)) ===
          String(id)
          ? {
              ...current,
              ...updated,
              status: nextStatus,
            }
          : current
      );

      setSuccess(
        `Work order status changed to ${formatStatus(
          nextStatus
        )}.`
      );
    } catch (err) {
      setError(
        err?.message ||
          "Failed to update work order status."
      );
    }
  }

  async function assignTechnician(
    workOrder,
    technicianId
  ) {
    const id = getId(workOrder);

    if (!id) return;

    setError("");
    setSuccess("");

    try {
      const response = await apiRequest(
        `/maintenance/work-orders/${id}`,
        {
          method: "PUT",
          body: JSON.stringify({
            technicianId:
              technicianId
                ? Number(technicianId)
                : null,
          }),
        }
      );

      const updated =
        response?.data ||
        response?.workOrder ||
        response;

      setWorkOrders((current) =>
        current.map((item) =>
          String(getId(item)) ===
          String(id)
            ? {
                ...item,
                ...updated,
                technicianId:
                  technicianId
                    ? Number(technicianId)
                    : null,
              }
            : item
        )
      );

      setSuccess(
        technicianId
          ? "Technician assigned successfully."
          : "Technician assignment removed."
      );

      await loadData();
    } catch (err) {
      setError(
        err?.message ||
          "Failed to assign technician."
      );
    }
  }

  const filteredWorkOrders = useMemo(() => {
    const query =
      search.trim().toLowerCase();

    return workOrders.filter(
      (workOrder) => {
        const status =
          getStatus(workOrder);

        const priority =
          getPriority(workOrder);

        const technicianId =
          getTechnicianId(workOrder);

        const matchesStatus =
          statusFilter === "all" ||
          status === statusFilter;

        const matchesPriority =
          priorityFilter === "all" ||
          priority === priorityFilter;

        const matchesTechnician =
          technicianFilter === "all" ||
          String(technicianId) ===
            String(technicianFilter);

        if (!matchesStatus) return false;
        if (!matchesPriority) return false;
        if (!matchesTechnician) return false;

        if (!query) return true;

        const searchable = [
          getId(workOrder),
          getRequestId(workOrder),
          getAssetId(workOrder),
          getAssetName(workOrder),
          getAssetTag(workOrder),
          getTechnicianName(workOrder),
          getRequestTitle(workOrder),
          workOrder?.title,
          workOrder?.description,
          workOrder?.notes,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchable.includes(query);
      }
    );
  }, [
    workOrders,
    search,
    statusFilter,
    priorityFilter,
    technicianFilter,
  ]);

  const summary = useMemo(() => {
    const total =
      workOrders.length;

    const draft =
      workOrders.filter(
        (item) =>
          getStatus(item) ===
          "draft"
      ).length;

    const assigned =
      workOrders.filter(
        (item) =>
          getStatus(item) ===
          "assigned"
      ).length;

    const inProgress =
      workOrders.filter(
        (item) =>
          getStatus(item) ===
          "in-progress"
      ).length;

    const completed =
      workOrders.filter(
        (item) =>
          getStatus(item) ===
          "completed"
      ).length;

    return {
      total,
      draft,
      assigned,
      inProgress,
      completed,
    };
  }, [workOrders]);

  return (
    <div className="work-orders-page">
      <style>{`
        .work-orders-page {
          min-height: 100%;
          padding: 24px;
          background: #f6f8fb;
          color: #1f2937;
          box-sizing: border-box;
        }

        .work-orders-container {
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
          line-height: 1.2;
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

        .primary-btn:disabled,
        .secondary-btn:disabled {
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
          font-size: 25px;
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
            180px
            180px
            220px;
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

        .work-orders-table {
          width: 100%;
          min-width: 1250px;
          border-collapse: collapse;
        }

        .work-orders-table th,
        .work-orders-table td {
          padding: 13px 14px;
          border-bottom: 1px solid #eef0f3;
          text-align: left;
          vertical-align: middle;
          font-size: 13px;
        }

        .work-orders-table th {
          background: #f9fafb;
          color: #6b7280;
          font-weight: 700;
          white-space: nowrap;
        }

        .work-orders-table tr:last-child td {
          border-bottom: 0;
        }

        .wo-title {
          color: #111827;
          font-weight: 650;
          margin-bottom: 4px;
        }

        .muted {
          color: #6b7280;
        }

        .status,
        .priority {
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

        .status-primary {
          background: #e0e7ff;
          color: #3730a3;
        }

        .status-warning {
          background: #fef3c7;
          color: #92400e;
        }

        .status-danger {
          background: #fee2e2;
          color: #991b1b;
        }

        .status-neutral {
          background: #f3f4f6;
          color: #4b5563;
        }

        .priority-critical {
          background: #fee2e2;
          color: #991b1b;
        }

        .priority-high {
          background: #ffedd5;
          color: #9a3412;
        }

        .priority-medium {
          background: #fef3c7;
          color: #92400e;
        }

        .priority-low {
          background: #dcfce7;
          color: #166534;
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

        .inline-select {
          border: 1px solid #d1d5db;
          border-radius: 7px;
          padding: 7px 8px;
          background: #fff;
          color: #374151;
          font-size: 12px;
          max-width: 170px;
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
          width: min(920px, 100%);
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

        .required {
          color: #dc2626;
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

        @media (max-width: 1200px) {
          .stats-grid {
            grid-template-columns:
              repeat(3, minmax(0, 1fr));
          }

          .toolbar {
            grid-template-columns:
              1fr 1fr;
          }
        }

        @media (max-width: 720px) {
          .work-orders-page {
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
          .details-grid {
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

      <div className="work-orders-container">
        <div className="page-header">
          <div>
            <h1 className="page-title">
              Work Orders
            </h1>

            <p className="page-subtitle">
              Create, assign, schedule and track
              maintenance work orders.
            </p>
          </div>

          <button
            type="button"
            className="primary-btn"
            onClick={openCreateModal}
          >
            + New Work Order
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
              Total Work Orders
            </div>
            <div className="stat-value">
              {summary.total}
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Draft
            </div>
            <div className="stat-value">
              {summary.draft}
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Assigned
            </div>
            <div className="stat-value">
              {summary.assigned}
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
        </div>

        <div className="toolbar">
          <input
            type="search"
            className="input"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search work order, asset, request, technician..."
          />

          <select
            className="select"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value)
            }
          >
            <option value="all">
              All statuses
            </option>

            {WORK_ORDER_STATUSES.map(
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

          <select
            className="select"
            value={priorityFilter}
            onChange={(event) =>
              setPriorityFilter(event.target.value)
            }
          >
            <option value="all">
              All priorities
            </option>

            {PRIORITIES.map((priority) => (
              <option
                key={priority}
                value={priority}
              >
                {formatPriority(priority)}
              </option>
            ))}
          </select>

          <select
            className="select"
            value={technicianFilter}
            onChange={(event) =>
              setTechnicianFilter(event.target.value)
            }
          >
            <option value="all">
              All technicians
            </option>

            {technicians.map((technician) => (
              <option
                key={technician.id}
                value={technician.id}
              >
                {technician.name ||
                  technician.fullName ||
                  [
                    technician.firstName,
                    technician.lastName,
                  ]
                    .filter(Boolean)
                    .join(" ") ||
                  `Technician #${technician.id}`}
              </option>
            ))}
          </select>
        </div>

        <div className="table-card">
          {loading ? (
            <div className="loading-state">
              Loading work orders...
            </div>
          ) : filteredWorkOrders.length ===
            0 ? (
            <div className="empty-state">
              No work orders found.
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="work-orders-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Work Order</th>
                    <th>Asset</th>
                    <th>Request</th>
                    <th>Technician</th>
                    <th>Priority</th>
                    <th>Schedule</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredWorkOrders.map(
                    (workOrder) => {
                      const id =
                        getId(workOrder);

                      const status =
                        getStatus(
                          workOrder
                        );

                      const priority =
                        getPriority(
                          workOrder
                        );

                      return (
                        <tr key={id}>
                          <td>
                            #{id}
                          </td>

                          <td>
                            <div className="wo-title">
                              {workOrder?.title ||
                                workOrder?.subject ||
                                `Work Order #${id}`}
                            </div>

                            <div className="muted">
                              {workOrder?.description
                                ? String(
                                    workOrder.description
                                  ).slice(
                                    0,
                                    90
                                  )
                                : "No description"}
                            </div>
                          </td>

                          <td>
                            <div className="wo-title">
                              {getAssetName(
                                workOrder
                              )}
                            </div>

                            <div className="muted">
                              Tag:{" "}
                              {getAssetTag(
                                workOrder
                              )}
                            </div>
                          </td>

                          <td>
                            <div>
                              {getRequestId(
                                workOrder
                              )
                                ? `#${getRequestId(
                                    workOrder
                                  )}`
                                : "-"}
                            </div>

                            <div className="muted">
                              {getRequestTitle(
                                workOrder
                              )}
                            </div>
                          </td>

                          <td>
                            <div>
                              {getTechnicianName(
                                workOrder
                              )}
                            </div>

                            <select
                              className="inline-select"
                              value={
                                getTechnicianId(
                                  workOrder
                                ) || ""
                              }
                              onChange={(event) =>
                                assignTechnician(
                                  workOrder,
                                  event.target.value
                                )
                              }
                            >
                              <option value="">
                                Unassigned
                              </option>

                              {technicians.map(
                                (
                                  technician
                                ) => (
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
                          </td>

                          <td>
                            <span
                              className={`priority ${priorityClass(
                                priority
                              )}`}
                            >
                              {formatPriority(
                                priority
                              )}
                            </span>
                          </td>

                          <td>
                            {formatDateTime(
                              workOrder?.scheduledStart ||
                                workOrder?.scheduled_start
                            )}
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
                            <div className="actions">
                              <button
                                type="button"
                                className="action-btn"
                                onClick={() =>
                                  openDetails(
                                    workOrder
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
                                    workOrder
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
                                    workOrder
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
                {editingWorkOrder
                  ? "Edit Work Order"
                  : "New Work Order"}
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
                      Maintenance Request{" "}
                      <span className="required">
                        *
                      </span>
                    </label>

                    <select
                      className="select"
                      name="requestId"
                      value={form.requestId}
                      onChange={
                        handleRequestChange
                      }
                      required
                    >
                      <option value="">
                        Select request
                      </option>

                      {requests.map(
                        (request) => {
                          const requestId =
                            request?.id ??
                            request?.requestId;

                          return (
                            <option
                              key={
                                requestId
                              }
                              value={
                                requestId
                              }
                            >
                              Request #
                              {requestId}
                              {request?.title
                                ? ` — ${request.title}`
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
                      <span className="required">
                        *
                      </span>
                    </label>

                    <select
                      className="select"
                      name="assetId"
                      value={form.assetId}
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
                      Priority
                    </label>

                    <select
                      className="select"
                      name="priority"
                      value={
                        form.priority
                      }
                      onChange={
                        handleChange
                      }
                    >
                      {PRIORITIES.map(
                        (priority) => (
                          <option
                            key={
                              priority
                            }
                            value={
                              priority
                            }
                          >
                            {formatPriority(
                              priority
                            )}
                          </option>
                        )
                      )}
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
                      {WORK_ORDER_STATUSES.map(
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
                      Title{" "}
                      <span className="required">
                        *
                      </span>
                    </label>

                    <input
                      className="input"
                      name="title"
                      value={
                        form.title
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="Enter work order title"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Scheduled Start
                    </label>

                    <input
                      className="input"
                      type="datetime-local"
                      name="scheduledStart"
                      value={
                        form.scheduledStart
                      }
                      onChange={
                        handleChange
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Scheduled End
                    </label>

                    <input
                      className="input"
                      type="datetime-local"
                      name="scheduledEnd"
                      value={
                        form.scheduledEnd
                      }
                      onChange={
                        handleChange
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Estimated Hours
                    </label>

                    <input
                      className="input"
                      type="number"
                      min="0"
                      step="0.1"
                      name="estimatedHours"
                      value={
                        form.estimatedHours
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="0"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Estimated Cost
                    </label>

                    <input
                      className="input"
                      type="number"
                      min="0"
                      step="0.01"
                      name="estimatedCost"
                      value={
                        form.estimatedCost
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="0.00"
                    />
                  </div>

                  <div className="form-group full">
                    <label className="form-label">
                      Description
                    </label>

                    <textarea
                      className="textarea"
                      name="description"
                      value={
                        form.description
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="Describe the maintenance work..."
                    />
                  </div>

                  <div className="form-group full">
                    <label className="form-label">
                      Work Instructions
                    </label>

                    <textarea
                      className="textarea"
                      name="instructions"
                      value={
                        form.instructions
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="Provide instructions for the technician..."
                    />
                  </div>

                  <div className="form-group full">
                    <label className="form-label">
                      Safety Requirements
                    </label>

                    <textarea
                      className="textarea"
                      name="safetyRequirements"
                      value={
                        form.safetyRequirements
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="List safety requirements..."
                    />
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
                      placeholder="Additional notes..."
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={
                    closeModal
                  }
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
                    : editingWorkOrder
                    ? "Update Work Order"
                    : "Create Work Order"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDetails &&
        selectedWorkOrder && (
          <div className="modal-backdrop">
            <div className="modal">
              <div className="modal-header">
                <h2 className="modal-title">
                  Work Order #
                  {getId(
                    selectedWorkOrder
                  )}
                </h2>

                <button
                  type="button"
                  className="close-btn"
                  onClick={
                    closeDetails
                  }
                >
                  ×
                </button>
              </div>

              <div className="modal-body">
                <div className="details-grid">
                  <div className="detail-card">
                    <div className="detail-label">
                      Title
                    </div>

                    <div className="detail-value">
                      {selectedWorkOrder?.title ||
                        selectedWorkOrder?.subject ||
                        "-"}
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
                            selectedWorkOrder
                          )
                        )}`}
                      >
                        {formatStatus(
                          getStatus(
                            selectedWorkOrder
                          )
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="detail-card">
                    <div className="detail-label">
                      Asset
                    </div>

                    <div className="detail-value">
                      {getAssetName(
                        selectedWorkOrder
                      )}
                      <br />
                      <span className="muted">
                        Tag:{" "}
                        {getAssetTag(
                          selectedWorkOrder
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="detail-card">
                    <div className="detail-label">
                      Maintenance Request
                    </div>

                    <div className="detail-value">
                      {getRequestId(
                        selectedWorkOrder
                      )
                        ? `#${getRequestId(
                            selectedWorkOrder
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
                        selectedWorkOrder
                      )}
                    </div>
                  </div>

                  <div className="detail-card">
                    <div className="detail-label">
                      Priority
                    </div>

                    <div className="detail-value">
                      <span
                        className={`priority ${priorityClass(
                          getPriority(
                            selectedWorkOrder
                          )
                        )}`}
                      >
                        {formatPriority(
                          getPriority(
                            selectedWorkOrder
                          )
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="detail-card">
                    <div className="detail-label">
                      Scheduled Start
                    </div>

                    <div className="detail-value">
                      {formatDateTime(
                        selectedWorkOrder?.scheduledStart ||
                          selectedWorkOrder?.scheduled_start
                      )}
                    </div>
                  </div>

                  <div className="detail-card">
                    <div className="detail-label">
                      Scheduled End
                    </div>

                    <div className="detail-value">
                      {formatDateTime(
                        selectedWorkOrder?.scheduledEnd ||
                          selectedWorkOrder?.scheduled_end
                      )}
                    </div>
                  </div>

                  <div className="detail-card">
                    <div className="detail-label">
                      Estimated Hours
                    </div>

                    <div className="detail-value">
                      {selectedWorkOrder?.estimatedHours ??
                        selectedWorkOrder?.estimated_hours ??
                        "-"}
                    </div>
                  </div>

                  <div className="detail-card">
                    <div className="detail-label">
                      Estimated Cost
                    </div>

                    <div className="detail-value">
                      {formatCurrency(
                        selectedWorkOrder?.estimatedCost ??
                          selectedWorkOrder?.estimated_cost
                      )}
                    </div>
                  </div>

                  <div className="detail-card full">
                    <div className="detail-label">
                      Description
                    </div>

                    <div className="detail-value">
                      {selectedWorkOrder?.description ||
                        "-"}
                    </div>
                  </div>

                  <div className="detail-card full">
                    <div className="detail-label">
                      Work Instructions
                    </div>

                    <div className="detail-value">
                      {selectedWorkOrder?.instructions ||
                        selectedWorkOrder?.workInstructions ||
                        "-"}
                    </div>
                  </div>

                  <div className="detail-card full">
                    <div className="detail-label">
                      Safety Requirements
                    </div>

                    <div className="detail-value">
                      {selectedWorkOrder?.safetyRequirements ||
                        selectedWorkOrder?.safety_requirements ||
                        "-"}
                    </div>
                  </div>

                  <div className="detail-card full">
                    <div className="detail-label">
                      Notes
                    </div>

                    <div className="detail-value">
                      {selectedWorkOrder?.notes ||
                        "-"}
                    </div>
                  </div>
                </div>

                <div className="section-title">
                  Status Actions
                </div>

                <div className="detail-actions">
                  <button
                    type="button"
                    className="action-btn"
                    onClick={() =>
                      updateStatus(
                        selectedWorkOrder,
                        "assigned"
                      )
                    }
                  >
                    Assign
                  </button>

                  <button
                    type="button"
                    className="action-btn"
                    onClick={() =>
                      updateStatus(
                        selectedWorkOrder,
                        "in-progress"
                      )
                    }
                  >
                    Start Work
                  </button>

                  <button
                    type="button"
                    className="action-btn"
                    onClick={() =>
                      updateStatus(
                        selectedWorkOrder,
                        "on-hold"
                      )
                    }
                  >
                    Put On Hold
                  </button>

                  <button
                    type="button"
                    className="action-btn"
                    onClick={() =>
                      updateStatus(
                        selectedWorkOrder,
                        "completed"
                      )
                    }
                  >
                    Complete
                  </button>

                  <button
                    type="button"
                    className="danger-btn"
                    onClick={() =>
                      updateStatus(
                        selectedWorkOrder,
                        "cancelled"
                      )
                    }
                  >
                    Cancel Work Order
                  </button>
                </div>

                <div className="detail-actions">
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={() =>
                      openEditModal(
                        selectedWorkOrder
                      )
                    }
                  >
                    Edit Work Order
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
