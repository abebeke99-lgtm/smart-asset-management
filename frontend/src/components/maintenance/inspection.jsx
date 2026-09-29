import React, { useEffect, useMemo, useState } from "react";

const API_BASE = "/api";

const inspectionStatuses = [
  "pending",
  "in-progress",
  "completed",
  "approved",
  "rejected",
];

const conditionOptions = [
  "Excellent",
  "Good",
  "Fair",
  "Poor",
  "Critical",
];

const safetyRiskOptions = [
  "Low",
  "Medium",
  "High",
  "Critical",
];

const emptyForm = {
  assetId: "",
  requestId: "",
  inspectionDate: new Date().toISOString().slice(0, 10),
  assetCondition: "",
  rootCause: "",
  findings: "",
  requiredRepair: "",
  requiredParts: "",
  estimatedCost: "",
  estimatedDuration: "",
  safetyRisk: "Low",
  recommendation: "",
  status: "pending",
  notes: "",
};

function getAuthHeaders() {
  const token =
    localStorage.getItem("token") ||
    localStorage.getItem("accessToken") ||
    localStorage.getItem("authToken");

  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
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

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message =
      typeof data === "object"
        ? data.message || data.error || "Request failed"
        : data || "Request failed";

    throw new Error(message);
  }

  return data;
}

function normalizeList(data) {
  if (Array.isArray(data)) return data;

  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.inspections)) return data.inspections;
  if (Array.isArray(data?.assets)) return data.assets;
  if (Array.isArray(data?.requests)) return data.requests;

  return [];
}

function getInspectionId(item) {
  return item?.id ?? item?.inspectionId ?? item?.inspection_id;
}

function getAssetId(item) {
  return (
    item?.assetId ??
    item?.asset_id ??
    item?.AssetId ??
    item?.asset?.id ??
    ""
  );
}

function getRequestId(item) {
  return (
    item?.requestId ??
    item?.request_id ??
    item?.MaintenanceRequestId ??
    item?.request?.id ??
    ""
  );
}

function getAssetName(item) {
  return (
    item?.asset?.name ||
    item?.asset?.assetName ||
    item?.assetName ||
    item?.asset?.tagNumber ||
    item?.assetTag ||
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

function getStatus(item) {
  return String(
    item?.status ||
      item?.inspectionStatus ||
      item?.inspection_status ||
      "pending"
  ).toLowerCase();
}

function formatStatus(status) {
  if (!status) return "-";

  return String(status)
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString();
}

function formatCurrency(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) return "-";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "ETB",
    maximumFractionDigits: 2,
  }).format(number);
}

function getStatusClass(status) {
  const normalized = String(status || "").toLowerCase();

  if (normalized === "completed" || normalized === "approved") {
    return "status-success";
  }

  if (normalized === "rejected" || normalized === "critical") {
    return "status-danger";
  }

  if (normalized === "in-progress") {
    return "status-info";
  }

  return "status-warning";
}

export default function Inspection() {
  const [inspections, setInspections] = useState([]);
  const [assets, setAssets] = useState([]);
  const [requests, setRequests] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [conditionFilter, setConditionFilter] = useState("all");

  const [showModal, setShowModal] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const [editingInspection, setEditingInspection] = useState(null);
  const [selectedInspection, setSelectedInspection] = useState(null);

  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const results = await Promise.allSettled([
        apiRequest("/maintenance/inspections"),
        apiRequest("/assets"),
        apiRequest("/maintenance/requests"),
      ]);

      const inspectionResult = results[0];
      const assetResult = results[1];
      const requestResult = results[2];

      if (inspectionResult.status === "fulfilled") {
        setInspections(normalizeList(inspectionResult.value));
      } else {
        throw inspectionResult.reason;
      }

      if (assetResult.status === "fulfilled") {
        setAssets(normalizeList(assetResult.value));
      }

      if (requestResult.status === "fulfilled") {
        setRequests(normalizeList(requestResult.value));
      }
    } catch (err) {
      setError(err.message || "Failed to load inspection data.");
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setEditingInspection(null);
    setForm({
      ...emptyForm,
      inspectionDate: new Date().toISOString().slice(0, 10),
    });
    setError("");
    setSuccess("");
    setShowModal(true);
  }

  function openEditModal(inspection) {
    setEditingInspection(inspection);

    setForm({
      assetId: getAssetId(inspection),
      requestId: getRequestId(inspection),
      inspectionDate:
        inspection?.inspectionDate ||
        inspection?.inspection_date ||
        inspection?.date ||
        new Date().toISOString().slice(0, 10),
      assetCondition:
        inspection?.assetCondition ||
        inspection?.asset_condition ||
        inspection?.condition ||
        "",
      rootCause:
        inspection?.rootCause ||
        inspection?.root_cause ||
        "",
      findings: inspection?.findings || "",
      requiredRepair:
        inspection?.requiredRepair ||
        inspection?.required_repair ||
        "",
      requiredParts:
        inspection?.requiredParts ||
        inspection?.required_parts ||
        "",
      estimatedCost:
        inspection?.estimatedCost ??
        inspection?.estimated_cost ??
        "",
      estimatedDuration:
        inspection?.estimatedDuration ??
        inspection?.estimated_duration ??
        "",
      safetyRisk:
        inspection?.safetyRisk ||
        inspection?.safety_risk ||
        "Low",
      recommendation:
        inspection?.recommendation ||
        "",
      status: getStatus(inspection),
      notes: inspection?.notes || "",
    });

    setError("");
    setSuccess("");
    setShowModal(true);
  }

  function openDetails(inspection) {
    setSelectedInspection(inspection);
    setShowDetails(true);
  }

  function closeModal() {
    if (saving) return;

    setShowModal(false);
    setEditingInspection(null);
  }

  function closeDetails() {
    setShowDetails(false);
    setSelectedInspection(null);
  }

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setSaving(true);
    setError("");
    setSuccess("");

    if (!form.assetId) {
      setError("Please select an asset.");
      setSaving(false);
      return;
    }

    if (!form.assetCondition) {
      setError("Please select the asset condition.");
      setSaving(false);
      return;
    }

    const payload = {
      assetId: Number(form.assetId),
      requestId: form.requestId ? Number(form.requestId) : null,
      inspectionDate: form.inspectionDate || null,
      assetCondition: form.assetCondition,
      rootCause: form.rootCause.trim(),
      findings: form.findings.trim(),
      requiredRepair: form.requiredRepair.trim(),
      requiredParts: form.requiredParts.trim(),
      estimatedCost:
        form.estimatedCost === ""
          ? null
          : Number(form.estimatedCost),
      estimatedDuration: form.estimatedDuration.trim(),
      safetyRisk: form.safetyRisk,
      recommendation: form.recommendation.trim(),
      status: form.status,
      notes: form.notes.trim(),
    };

    try {
      if (editingInspection) {
        const id = getInspectionId(editingInspection);

        const response = await apiRequest(
          `/maintenance/inspections/${id}`,
          {
            method: "PUT",
            body: JSON.stringify(payload),
          }
        );

        const updated =
          response?.data ||
          response?.inspection ||
          response;

        setInspections((current) =>
          current.map((item) =>
            String(getInspectionId(item)) === String(id)
              ? updated
              : item
          )
        );

        setSuccess("Inspection updated successfully.");
      } else {
        const response = await apiRequest(
          "/maintenance/inspections",
          {
            method: "POST",
            body: JSON.stringify(payload),
          }
        );

        const created =
          response?.data ||
          response?.inspection ||
          response;

        setInspections((current) => [
          created,
          ...current,
        ]);

        setSuccess("Inspection created successfully.");
      }

      setShowModal(false);
      setEditingInspection(null);
      await loadData();
    } catch (err) {
      setError(err.message || "Failed to save inspection.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(inspection) {
    const id = getInspectionId(inspection);

    if (!id) return;

    const confirmed = window.confirm(
      `Delete inspection #${id}? This action cannot be undone.`
    );

    if (!confirmed) return;

    setError("");
    setSuccess("");

    try {
      await apiRequest(`/maintenance/inspections/${id}`, {
        method: "DELETE",
      });

      setInspections((current) =>
        current.filter(
          (item) =>
            String(getInspectionId(item)) !== String(id)
        )
      );

      setSuccess("Inspection deleted successfully.");
    } catch (err) {
      setError(err.message || "Failed to delete inspection.");
    }
  }

  async function updateStatus(inspection, status) {
    const id = getInspectionId(inspection);

    if (!id) return;

    setError("");
    setSuccess("");

    try {
      const response = await apiRequest(
        `/maintenance/inspections/${id}`,
        {
          method: "PUT",
          body: JSON.stringify({
            status,
          }),
        }
      );

      const updated =
        response?.data ||
        response?.inspection ||
        response;

      setInspections((current) =>
        current.map((item) =>
          String(getInspectionId(item)) === String(id)
            ? {
                ...item,
                ...updated,
                status,
              }
            : item
        )
      );

      setSelectedInspection((current) =>
        current &&
        String(getInspectionId(current)) === String(id)
          ? {
              ...current,
              ...updated,
              status,
            }
          : current
      );

      setSuccess(
        `Inspection status changed to ${formatStatus(status)}.`
      );
    } catch (err) {
      setError(err.message || "Failed to update inspection status.");
    }
  }

  const filteredInspections = useMemo(() => {
    const query = search.trim().toLowerCase();

    return inspections.filter((inspection) => {
      const status = getStatus(inspection);
      const condition = String(
        inspection?.assetCondition ||
          inspection?.asset_condition ||
          inspection?.condition ||
          ""
      ).toLowerCase();

      const matchesStatus =
        statusFilter === "all" || status === statusFilter;

      const matchesCondition =
        conditionFilter === "all" ||
        condition === conditionFilter.toLowerCase();

      if (!query) {
        return matchesStatus && matchesCondition;
      }

      const searchable = [
        getInspectionId(inspection),
        getAssetId(inspection),
        getAssetName(inspection),
        getAssetTag(inspection),
        getRequestId(inspection),
        inspection?.rootCause,
        inspection?.root_cause,
        inspection?.findings,
        inspection?.requiredRepair,
        inspection?.required_repair,
        inspection?.recommendation,
        inspection?.notes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return (
        matchesStatus &&
        matchesCondition &&
        searchable.includes(query)
      );
    });
  }, [
    inspections,
    search,
    statusFilter,
    conditionFilter,
  ]);

  const summary = useMemo(() => {
    const total = inspections.length;

    const pending = inspections.filter(
      (item) => getStatus(item) === "pending"
    ).length;

    const inProgress = inspections.filter(
      (item) => getStatus(item) === "in-progress"
    ).length;

    const completed = inspections.filter(
      (item) =>
        getStatus(item) === "completed" ||
        getStatus(item) === "approved"
    ).length;

    const highRisk = inspections.filter((item) => {
      const risk = String(
        item?.safetyRisk ||
          item?.safety_risk ||
          ""
      ).toLowerCase();

      return risk === "high" || risk === "critical";
    }).length;

    return {
      total,
      pending,
      inProgress,
      completed,
      highRisk,
    };
  }, [inspections]);

  return (
    <div className="inspection-page">
      <style>{`
        .inspection-page {
          min-height: 100%;
          padding: 24px;
          background: #f6f8fb;
          color: #1f2937;
          box-sizing: border-box;
        }

        .inspection-container {
          max-width: 1500px;
          margin: 0 auto;
        }

        .inspection-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 24px;
        }

        .inspection-title {
          margin: 0;
          font-size: 28px;
          font-weight: 700;
          color: #111827;
        }

        .inspection-subtitle {
          margin: 7px 0 0;
          color: #6b7280;
          font-size: 14px;
        }

        .primary-btn {
          border: 0;
          border-radius: 8px;
          padding: 11px 16px;
          background: #2563eb;
          color: white;
          font-weight: 600;
          cursor: pointer;
        }

        .primary-btn:hover {
          background: #1d4ed8;
        }

        .secondary-btn {
          border: 1px solid #d1d5db;
          border-radius: 8px;
          padding: 10px 14px;
          background: white;
          color: #374151;
          font-weight: 600;
          cursor: pointer;
        }

        .danger-btn {
          border: 1px solid #fecaca;
          border-radius: 8px;
          padding: 8px 11px;
          background: #fff;
          color: #dc2626;
          cursor: pointer;
          font-weight: 600;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 20px;
        }

        .stat-card {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 17px;
          box-shadow: 0 1px 2px rgba(0,0,0,0.03);
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
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 16px;
          display: grid;
          grid-template-columns: 1fr 200px 200px;
          gap: 12px;
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
          background: white;
          color: #111827;
          font-size: 14px;
          outline: none;
        }

        .input:focus,
        .select:focus,
        .textarea:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37,99,235,.1);
        }

        .textarea {
          min-height: 90px;
          resize: vertical;
          font-family: inherit;
        }

        .table-card {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          overflow: hidden;
        }

        .table-wrapper {
          width: 100%;
          overflow-x: auto;
        }

        .inspection-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 1100px;
        }

        .inspection-table th,
        .inspection-table td {
          padding: 13px 14px;
          border-bottom: 1px solid #eef0f3;
          text-align: left;
          vertical-align: middle;
          font-size: 13px;
        }

        .inspection-table th {
          background: #f9fafb;
          color: #6b7280;
          font-weight: 700;
          white-space: nowrap;
        }

        .inspection-table tr:last-child td {
          border-bottom: 0;
        }

        .asset-name {
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

        .status-warning {
          background: #fef3c7;
          color: #92400e;
        }

        .status-danger {
          background: #fee2e2;
          color: #991b1b;
        }

        .status-info {
          background: #dbeafe;
          color: #1d4ed8;
        }

        .risk-high {
          color: #b91c1c;
          font-weight: 700;
        }

        .risk-medium {
          color: #b45309;
          font-weight: 700;
        }

        .risk-low {
          color: #15803d;
          font-weight: 700;
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
          background: white;
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
          background: rgba(17,24,39,.48);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          z-index: 1000;
        }

        .modal {
          width: min(900px, 100%);
          max-height: 92vh;
          overflow-y: auto;
          background: white;
          border-radius: 14px;
          box-shadow: 0 20px 50px rgba(0,0,0,.2);
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 18px 20px;
          border-bottom: 1px solid #e5e7eb;
          position: sticky;
          top: 0;
          background: white;
          z-index: 2;
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
          cursor: pointer;
          line-height: 1;
        }

        .modal-body {
          padding: 20px;
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
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
          font-size: 13px;
          font-weight: 650;
          color: #374151;
        }

        .required {
          color: #dc2626;
        }

        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          padding: 16px 20px;
          border-top: 1px solid #e5e7eb;
          position: sticky;
          bottom: 0;
          background: white;
        }

        .details-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
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
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: .04em;
          color: #6b7280;
          margin-bottom: 6px;
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

        @media (max-width: 1100px) {
          .stats-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .toolbar {
            grid-template-columns: 1fr 1fr;
          }

          .toolbar > :first-child {
            grid-column: 1 / -1;
          }
        }

        @media (max-width: 720px) {
          .inspection-page {
            padding: 14px;
          }

          .inspection-header {
            flex-direction: column;
          }

          .primary-btn {
            width: 100%;
          }

          .stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .toolbar {
            grid-template-columns: 1fr;
          }

          .toolbar > :first-child {
            grid-column: auto;
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

      <div className="inspection-container">
        <div className="inspection-header">
          <div>
            <h1 className="inspection-title">
              Maintenance Inspection
            </h1>

            <p className="inspection-subtitle">
              Inspect maintenance assets, document findings,
              identify root causes, and recommend corrective action.
            </p>
          </div>

          <button
            type="button"
            className="primary-btn"
            onClick={openCreateModal}
          >
            + New Inspection
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
              Total Inspections
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
              High / Critical Risk
            </div>
            <div className="stat-value">
              {summary.highRisk}
            </div>
          </div>
        </div>

        <div className="toolbar">
          <input
            className="input"
            type="search"
            placeholder="Search asset, tag, request, findings, root cause..."
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
          />

          <select
            className="select"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value)
            }
          >
            <option value="all">All statuses</option>
            {inspectionStatuses.map((status) => (
              <option key={status} value={status}>
                {formatStatus(status)}
              </option>
            ))}
          </select>

          <select
            className="select"
            value={conditionFilter}
            onChange={(event) =>
              setConditionFilter(event.target.value)
            }
          >
            <option value="all">All conditions</option>
            {conditionOptions.map((condition) => (
              <option
                key={condition}
                value={condition}
              >
                {condition}
              </option>
            ))}
          </select>
        </div>

        <div className="table-card">
          {loading ? (
            <div className="loading-state">
              Loading inspections...
            </div>
          ) : filteredInspections.length === 0 ? (
            <div className="empty-state">
              No inspections found.
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="inspection-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Asset</th>
                    <th>Request</th>
                    <th>Date</th>
                    <th>Condition</th>
                    <th>Safety Risk</th>
                    <th>Estimated Cost</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredInspections.map((inspection) => {
                    const id = getInspectionId(inspection);

                    const condition =
                      inspection?.assetCondition ||
                      inspection?.asset_condition ||
                      inspection?.condition ||
                      "-";

                    const risk =
                      inspection?.safetyRisk ||
                      inspection?.safety_risk ||
                      "-";

                    const riskClass =
                      String(risk).toLowerCase() === "high" ||
                      String(risk).toLowerCase() === "critical"
                        ? "risk-high"
                        : String(risk).toLowerCase() ===
                          "medium"
                        ? "risk-medium"
                        : "risk-low";

                    return (
                      <tr key={id}>
                        <td>#{id}</td>

                        <td>
                          <div className="asset-name">
                            {getAssetName(inspection)}
                          </div>

                          <div className="muted">
                            Tag: {getAssetTag(inspection)}
                          </div>
                        </td>

                        <td>
                          {getRequestId(inspection)
                            ? `#${getRequestId(inspection)}`
                            : "-"}
                        </td>

                        <td>
                          {formatDate(
                            inspection?.inspectionDate ||
                              inspection?.inspection_date ||
                              inspection?.date
                          )}
                        </td>

                        <td>{condition}</td>

                        <td>
                          <span className={riskClass}>
                            {risk}
                          </span>
                        </td>

                        <td>
                          {formatCurrency(
                            inspection?.estimatedCost ??
                              inspection?.estimated_cost
                          )}
                        </td>

                        <td>
                          <span
                            className={`status ${getStatusClass(
                              getStatus(inspection)
                            )}`}
                          >
                            {formatStatus(
                              getStatus(inspection)
                            )}
                          </span>
                        </td>

                        <td>
                          <div className="actions">
                            <button
                              type="button"
                              className="action-btn"
                              onClick={() =>
                                openDetails(inspection)
                              }
                            >
                              View
                            </button>

                            <button
                              type="button"
                              className="action-btn"
                              onClick={() =>
                                openEditModal(inspection)
                              }
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              className="danger-btn"
                              onClick={() =>
                                handleDelete(inspection)
                              }
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
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
                {editingInspection
                  ? "Edit Inspection"
                  : "New Inspection"}
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

            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">
                      Asset <span className="required">*</span>
                    </label>

                    <select
                      className="select"
                      name="assetId"
                      value={form.assetId}
                      onChange={handleChange}
                      required
                    >
                      <option value="">
                        Select asset
                      </option>

                      {assets.map((asset) => (
                        <option
                          key={asset.id}
                          value={asset.id}
                        >
                          {asset.name ||
                            asset.assetName ||
                            `Asset #${asset.id}`}
                          {asset.tagNumber
                            ? ` — ${asset.tagNumber}`
                            : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Maintenance Request
                    </label>

                    <select
                      className="select"
                      name="requestId"
                      value={form.requestId}
                      onChange={handleChange}
                    >
                      <option value="">
                        Select request
                      </option>

                      {requests.map((request) => (
                        <option
                          key={
                            request.id ||
                            request.requestId
                          }
                          value={
                            request.id ||
                            request.requestId
                          }
                        >
                          Request #
                          {request.id ||
                            request.requestId}
                          {request.title
                            ? ` — ${request.title}`
                            : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Inspection Date
                    </label>

                    <input
                      className="input"
                      type="date"
                      name="inspectionDate"
                      value={form.inspectionDate}
                      onChange={handleChange}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Asset Condition{" "}
                      <span className="required">*</span>
                    </label>

                    <select
                      className="select"
                      name="assetCondition"
                      value={form.assetCondition}
                      onChange={handleChange}
                      required
                    >
                      <option value="">
                        Select condition
                      </option>

                      {conditionOptions.map((condition) => (
                        <option
                          key={condition}
                          value={condition}
                        >
                          {condition}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Safety Risk
                    </label>

                    <select
                      className="select"
                      name="safetyRisk"
                      value={form.safetyRisk}
                      onChange={handleChange}
                    >
                      {safetyRiskOptions.map((risk) => (
                        <option
                          key={risk}
                          value={risk}
                        >
                          {risk}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Inspection Status
                    </label>

                    <select
                      className="select"
                      name="status"
                      value={form.status}
                      onChange={handleChange}
                    >
                      {inspectionStatuses.map((status) => (
                        <option
                          key={status}
                          value={status}
                        >
                          {formatStatus(status)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group full">
                    <label className="form-label">
                      Root Cause
                    </label>

                    <textarea
                      className="textarea"
                      name="rootCause"
                      value={form.rootCause}
                      onChange={handleChange}
                      placeholder="Describe the identified root cause..."
                    />
                  </div>

                  <div className="form-group full">
                    <label className="form-label">
                      Findings
                    </label>

                    <textarea
                      className="textarea"
                      name="findings"
                      value={form.findings}
                      onChange={handleChange}
                      placeholder="Document inspection findings and observations..."
                    />
                  </div>

                  <div className="form-group full">
                    <label className="form-label">
                      Required Repair
                    </label>

                    <textarea
                      className="textarea"
                      name="requiredRepair"
                      value={form.requiredRepair}
                      onChange={handleChange}
                      placeholder="Describe the repair required..."
                    />
                  </div>

                  <div className="form-group full">
                    <label className="form-label">
                      Required Parts / Materials
                    </label>

                    <textarea
                      className="textarea"
                      name="requiredParts"
                      value={form.requiredParts}
                      onChange={handleChange}
                      placeholder="List required spare parts or materials..."
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
                      value={form.estimatedCost}
                      onChange={handleChange}
                      placeholder="0.00"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Estimated Duration
                    </label>

                    <input
                      className="input"
                      type="text"
                      name="estimatedDuration"
                      value={form.estimatedDuration}
                      onChange={handleChange}
                      placeholder="e.g. 2 days / 6 hours"
                    />
                  </div>

                  <div className="form-group full">
                    <label className="form-label">
                      Recommendation
                    </label>

                    <textarea
                      className="textarea"
                      name="recommendation"
                      value={form.recommendation}
                      onChange={handleChange}
                      placeholder="Provide recommended action..."
                    />
                  </div>

                  <div className="form-group full">
                    <label className="form-label">
                      Notes
                    </label>

                    <textarea
                      className="textarea"
                      name="notes"
                      value={form.notes}
                      onChange={handleChange}
                      placeholder="Additional inspection notes..."
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
                    : editingInspection
                    ? "Update Inspection"
                    : "Create Inspection"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDetails && selectedInspection && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">
                Inspection #{getInspectionId(selectedInspection)}
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
                    {getAssetName(selectedInspection)}
                  </div>
                </div>

                <div className="detail-card">
                  <div className="detail-label">
                    Asset Tag
                  </div>
                  <div className="detail-value">
                    {getAssetTag(selectedInspection)}
                  </div>
                </div>

                <div className="detail-card">
                  <div className="detail-label">
                    Maintenance Request
                  </div>
                  <div className="detail-value">
                    {getRequestId(selectedInspection)
                      ? `#${getRequestId(selectedInspection)}`
                      : "-"}
                  </div>
                </div>

                <div className="detail-card">
                  <div className="detail-label">
                    Inspection Date
                  </div>
                  <div className="detail-value">
                    {formatDate(
                      selectedInspection?.inspectionDate ||
                        selectedInspection?.inspection_date ||
                        selectedInspection?.date
                    )}
                  </div>
                </div>

                <div className="detail-card">
                  <div className="detail-label">
                    Asset Condition
                  </div>
                  <div className="detail-value">
                    {selectedInspection?.assetCondition ||
                      selectedInspection?.asset_condition ||
                      selectedInspection?.condition ||
                      "-"}
                  </div>
                </div>

                <div className="detail-card">
                  <div className="detail-label">
                    Safety Risk
                  </div>
                  <div className="detail-value">
                    {selectedInspection?.safetyRisk ||
                      selectedInspection?.safety_risk ||
                      "-"}
                  </div>
                </div>

                <div className="detail-card">
                  <div className="detail-label">
                    Status
                  </div>
                  <div className="detail-value">
                    <span
                      className={`status ${getStatusClass(
                        getStatus(selectedInspection)
                      )}`}
                    >
                      {formatStatus(
                        getStatus(selectedInspection)
                      )}
                    </span>
                  </div>
                </div>

                <div className="detail-card">
                  <div className="detail-label">
                    Estimated Cost
                  </div>
                  <div className="detail-value">
                    {formatCurrency(
                      selectedInspection?.estimatedCost ??
                        selectedInspection?.estimated_cost
                    )}
                  </div>
                </div>

                <div className="detail-card">
                  <div className="detail-label">
                    Estimated Duration
                  </div>
                  <div className="detail-value">
                    {selectedInspection?.estimatedDuration ||
                      selectedInspection?.estimated_duration ||
                      "-"}
                  </div>
                </div>

                <div className="detail-card full">
                  <div className="detail-label">
                    Root Cause
                  </div>
                  <div className="detail-value">
                    {selectedInspection?.rootCause ||
                      selectedInspection?.root_cause ||
                      "-"}
                  </div>
                </div>

                <div className="detail-card full">
                  <div className="detail-label">
                    Findings
                  </div>
                  <div className="detail-value">
                    {selectedInspection?.findings || "-"}
                  </div>
                </div>

                <div className="detail-card full">
                  <div className="detail-label">
                    Required Repair
                  </div>
                  <div className="detail-value">
                    {selectedInspection?.requiredRepair ||
                      selectedInspection?.required_repair ||
                      "-"}
                  </div>
                </div>

                <div className="detail-card full">
                  <div className="detail-label">
                    Required Parts / Materials
                  </div>
                  <div className="detail-value">
                    {selectedInspection?.requiredParts ||
                      selectedInspection?.required_parts ||
                      "-"}
                  </div>
                </div>

                <div className="detail-card full">
                  <div className="detail-label">
                    Recommendation
                  </div>
                  <div className="detail-value">
                    {selectedInspection?.recommendation ||
                      "-"}
                  </div>
                </div>

                <div className="detail-card full">
                  <div className="detail-label">
                    Notes
                  </div>
                  <div className="detail-value">
                    {selectedInspection?.notes || "-"}
                  </div>
                </div>
              </div>

              <div className="detail-actions">
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() =>
                    openEditModal(selectedInspection)
                  }
                >
                  Edit Inspection
                </button>

                <button
                  type="button"
                  className="action-btn"
                  onClick={() =>
                    updateStatus(
                      selectedInspection,
                      "in-progress"
                    )
                  }
                >
                  Mark In Progress
                </button>

                <button
                  type="button"
                  className="action-btn"
                  onClick={() =>
                    updateStatus(
                      selectedInspection,
                      "completed"
                    )
                  }
                >
                  Mark Completed
                </button>

                <button
                  type="button"
                  className="action-btn"
                  onClick={() =>
                    updateStatus(
                      selectedInspection,
                      "approved"
                    )
                  }
                >
                  Approve
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
