import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import {
  AlertCircle,
  BarChart3,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock3,
  Edit3,
  Eye,
  Filter,
  Loader2,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Send,
  Trash2,
  User,
  X,
  XCircle,
} from "lucide-react";

const INITIAL_FORM = {
  requestNumber: "",
  title: "",
  requestType: "Asset Request",
  category: "",
  assetId: "",
  assetName: "",
  location: "",
  requestedBy: "",
  assignedTo: "",
  priority: "Normal",
  status: "Pending",
  requestDate: "",
  requiredDate: "",
  estimatedCost: "",
  description: "",
  justification: "",
  remarks: "",
};

const STATUS_OPTIONS = [
  "Pending",
  "Submitted",
  "Under Review",
  "Approved",
  "Rejected",
  "In Progress",
  "Completed",
  "Cancelled",
];

const PRIORITY_OPTIONS = [
  "Low",
  "Normal",
  "High",
  "Urgent",
  "Critical",
];

const REQUEST_TYPES = [
  "Asset Request",
  "Maintenance Request",
  "Transfer Request",
  "Repair Request",
  "Facility Request",
  "Material Request",
  "Service Request",
  "Other",
];

function extractRows(response) {
  const data = response?.data;

  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.records)) return data.records;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.rows)) return data.rows;

  return [];
}

function extractPagination(response, rowsLength) {
  const data = response?.data;
  const meta = data?.pagination || data?.meta || data;

  const total = Number(
    meta?.total ??
      meta?.totalCount ??
      meta?.count ??
      rowsLength
  );

  const limit = Number(
    meta?.limit ??
      meta?.pageSize ??
      meta?.perPage ??
      10
  );

  return {
    page: Number(meta?.page || 1),
    limit,
    total,
    totalPages: Number(
      meta?.totalPages ||
        Math.max(1, Math.ceil(total / limit))
    ),
  };
}

function firstValue(...values) {
  return values.find(
    (value) =>
      value !== undefined &&
      value !== null &&
      value !== ""
  );
}

function normalizeRequest(row) {
  return {
    id:
      row.id ??
      row._id ??
      row.request_id,

    requestNumber:
      firstValue(
        row.requestNumber,
        row.request_number,
        row.requestNo,
        row.request_no,
        row.number
      ) || "—",

    title:
      firstValue(
        row.title,
        row.name,
        row.requestTitle,
        row.request_title
      ) || "Untitled Request",

    requestType:
      firstValue(
        row.requestType,
        row.request_type,
        row.type
      ) || "Other",

    category:
      firstValue(
        row.category,
        row.requestCategory,
        row.request_category
      ) || "—",

    assetId:
      firstValue(
        row.assetId,
        row.asset_id
      ) || "—",

    assetName:
      firstValue(
        row.assetName,
        row.asset_name,
        row.asset?.name
      ) || "—",

    location:
      firstValue(
        row.location,
        row.locationName,
        row.location_name
      ) || "—",

    requestedBy:
      firstValue(
        row.requestedBy,
        row.requested_by,
        row.requester,
        row.requesterName,
        row.requester_name
      ) || "—",

    assignedTo:
      firstValue(
        row.assignedTo,
        row.assigned_to,
        row.assignee,
        row.assigneeName,
        row.assignee_name
      ) || "Unassigned",

    priority:
      firstValue(
        row.priority,
        row.requestPriority,
        row.request_priority
      ) || "Normal",

    status:
      firstValue(
        row.status,
        row.requestStatus,
        row.request_status
      ) || "Pending",

    requestDate:
      firstValue(
        row.requestDate,
        row.request_date,
        row.createdAt,
        row.created_at
      ) || "",

    requiredDate:
      firstValue(
        row.requiredDate,
        row.required_date,
        row.dueDate,
        row.due_date
      ) || "",

    estimatedCost:
      firstValue(
        row.estimatedCost,
        row.estimated_cost,
        row.cost
      ) ?? "",

    description:
      firstValue(
        row.description,
        row.details
      ) || "",

    justification:
      firstValue(
        row.justification,
        row.reason
      ) || "",

    remarks:
      firstValue(
        row.remarks,
        row.notes,
        row.note
      ) || "",

    createdAt:
      firstValue(
        row.createdAt,
        row.created_at
      ) || "",

    updatedAt:
      firstValue(
        row.updatedAt,
        row.updated_at
      ) || "",
  };
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString();
}

function formatDateTime(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString();
}

function formatMoney(value) {
  if (
    value === "" ||
    value === null ||
    value === undefined
  ) {
    return "—";
  }

  const number = Number(value);

  if (Number.isNaN(number)) {
    return String(value);
  }

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(number);
}

function statusClass(status) {
  const value = String(status || "").toLowerCase();

  if (
    value.includes("reject") ||
    value.includes("cancel")
  ) {
    return "danger";
  }

  if (
    value.includes("pending") ||
    value.includes("review")
  ) {
    return "warning";
  }

  if (
    value.includes("progress") ||
    value.includes("submitted")
  ) {
    return "info";
  }

  if (
    value.includes("approved") ||
    value.includes("completed")
  ) {
    return "success";
  }

  return "default";
}

function priorityClass(priority) {
  const value = String(priority || "").toLowerCase();

  if (
    value.includes("critical") ||
    value.includes("urgent")
  ) {
    return "danger";
  }

  if (value.includes("high")) {
    return "warning";
  }

  if (value.includes("normal")) {
    return "info";
  }

  return "default";
}

export default function InfrastructureRequests() {
  const [requests, setRequests] = useState([]);
  const [summaryFromApi, setSummaryFromApi] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");

  const [page, setPage] = useState(1);
  const [limit] = useState(10);

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });

  const [showModal, setShowModal] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const [editingRequest, setEditingRequest] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);

  const [form, setForm] = useState(INITIAL_FORM);

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get(
        "/infrastructure/requests",
        {
          params: {
            page,
            limit,
            search: search.trim() || undefined,
            status:
              statusFilter || undefined,
            priority:
              priorityFilter || undefined,
            requestType:
              typeFilter || undefined,
            type:
              typeFilter || undefined,
            location:
              locationFilter || undefined,
          },
        }
      );

      const rows = extractRows(response).map(
        normalizeRequest
      );

      setRequests(rows);

      const serverPagination =
        extractPagination(response, rows.length);

      setPagination({
        page: serverPagination.page || page,
        limit:
          serverPagination.limit || limit,
        total: serverPagination.total,
        totalPages: Math.max(
          1,
          serverPagination.totalPages
        ),
      });

      setSummaryFromApi(
        response?.data?.summary || null
      );
    } catch (err) {
      console.error(
        "Failed to load infrastructure requests:",
        err
      );

      setError(
        err?.response?.data?.message ||
          "Unable to load infrastructure requests."
      );

      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [
    page,
    limit,
    search,
    statusFilter,
    priorityFilter,
    typeFilter,
    locationFilter,
  ]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  useEffect(() => {
    if (!success) return;

    const timer = setTimeout(
      () => setSuccess(""),
      3500
    );

    return () => clearTimeout(timer);
  }, [success]);

  const calculatedSummary = useMemo(() => {
    return {
      total: pagination.total || requests.length,

      pending: requests.filter((item) =>
        ["pending", "submitted", "under review"].includes(
          String(item.status).toLowerCase()
        )
      ).length,

      approved: requests.filter((item) =>
        String(item.status)
          .toLowerCase()
          .includes("approved")
      ).length,

      inProgress: requests.filter((item) =>
        String(item.status)
          .toLowerCase()
          .includes("progress")
      ).length,

      completed: requests.filter((item) =>
        String(item.status)
          .toLowerCase()
          .includes("completed")
      ).length,

      urgent: requests.filter((item) =>
        ["urgent", "critical"].includes(
          String(item.priority).toLowerCase()
        )
      ).length,
    };
  }, [requests, pagination.total]);

  const summary = {
    total: Number(
      firstValue(
        summaryFromApi?.total,
        summaryFromApi?.totalRequests,
        calculatedSummary.total
      )
    ),

    pending: Number(
      firstValue(
        summaryFromApi?.pending,
        summaryFromApi?.pendingRequests,
        calculatedSummary.pending
      )
    ),

    approved: Number(
      firstValue(
        summaryFromApi?.approved,
        summaryFromApi?.approvedRequests,
        calculatedSummary.approved
      )
    ),

    inProgress: Number(
      firstValue(
        summaryFromApi?.inProgress,
        summaryFromApi?.in_progress,
        calculatedSummary.inProgress
      )
    ),

    completed: Number(
      firstValue(
        summaryFromApi?.completed,
        summaryFromApi?.completedRequests,
        calculatedSummary.completed
      )
    ),

    urgent: Number(
      firstValue(
        summaryFromApi?.urgent,
        summaryFromApi?.urgentRequests,
        calculatedSummary.urgent
      )
    ),
  };

  const resetForm = () => {
    setForm(INITIAL_FORM);
    setEditingRequest(null);
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (request) => {
    setEditingRequest(request);

    setForm({
      requestNumber:
        request.requestNumber === "—"
          ? ""
          : request.requestNumber,

      title:
        request.title || "",

      requestType:
        request.requestType ||
        "Asset Request",

      category:
        request.category === "—"
          ? ""
          : request.category,

      assetId:
        request.assetId === "—"
          ? ""
          : request.assetId,

      assetName:
        request.assetName === "—"
          ? ""
          : request.assetName,

      location:
        request.location === "—"
          ? ""
          : request.location,

      requestedBy:
        request.requestedBy === "—"
          ? ""
          : request.requestedBy,

      assignedTo:
        request.assignedTo === "Unassigned"
          ? ""
          : request.assignedTo,

      priority:
        request.priority || "Normal",

      status:
        request.status || "Pending",

      requestDate:
        request.requestDate || "",

      requiredDate:
        request.requiredDate || "",

      estimatedCost:
        request.estimatedCost ?? "",

      description:
        request.description || "",

      justification:
        request.justification || "",

      remarks:
        request.remarks || "",
    });

    setShowModal(true);
  };

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.title.trim()) {
      setError("Request title is required.");
      return;
    }

    if (!form.requestedBy.trim()) {
      setError("Requested by is required.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const payload = {
        requestNumber:
          form.requestNumber.trim() || undefined,

        title:
          form.title.trim(),

        requestType:
          form.requestType,

        category:
          form.category.trim() || undefined,

        assetId:
          form.assetId.trim() || undefined,

        assetName:
          form.assetName.trim() || undefined,

        location:
          form.location.trim() || undefined,

        requestedBy:
          form.requestedBy.trim(),

        assignedTo:
          form.assignedTo.trim() || undefined,

        priority:
          form.priority,

        status:
          form.status,

        requestDate:
          form.requestDate || undefined,

        requiredDate:
          form.requiredDate || undefined,

        estimatedCost:
          form.estimatedCost === ""
            ? undefined
            : Number(form.estimatedCost),

        description:
          form.description.trim() ||
          undefined,

        justification:
          form.justification.trim() ||
          undefined,

        remarks:
          form.remarks.trim() ||
          undefined,
      };

      if (editingRequest?.id) {
        await api.put(
          `/infrastructure/requests/${editingRequest.id}`,
          payload
        );

        setSuccess(
          "Infrastructure request updated successfully."
        );
      } else {
        await api.post(
          "/infrastructure/requests",
          payload
        );

        setSuccess(
          "Infrastructure request created successfully."
        );
      }

      setShowModal(false);
      resetForm();

      await fetchRequests();
    } catch (err) {
      console.error(
        "Failed to save infrastructure request:",
        err
      );

      setError(
        err?.response?.data?.message ||
          "Unable to save the infrastructure request."
      );
    } finally {
      setSaving(false);
    }
  };

  const performStatusAction = async (
    request,
    action
  ) => {
    if (!request?.id) return;

    try {
      setActionLoading(
        `${action}-${request.id}`
      );
      setError("");

      const endpointMap = {
        submit: `/infrastructure/requests/${request.id}/submit`,
        approve: `/infrastructure/requests/${request.id}/approve`,
        reject: `/infrastructure/requests/${request.id}/reject`,
        complete: `/infrastructure/requests/${request.id}/complete`,
        cancel: `/infrastructure/requests/${request.id}/cancel`,
      };

      const endpoint = endpointMap[action];

      if (!endpoint) return;

      await api.patch(endpoint);

      setSuccess(
        `Request ${action} action completed successfully.`
      );

      await fetchRequests();
    } catch (err) {
      console.error(
        `Failed to ${action} request:`,
        err
      );

      setError(
        err?.response?.data?.message ||
          `Unable to ${action} the request.`
      );
    } finally {
      setActionLoading(null);
    }
  };

  const openDeleteDialog = (request) => {
    setSelectedRequest(request);
    setShowDelete(true);
  };

  const handleDelete = async () => {
    if (!selectedRequest?.id) return;

    try {
      setDeleting(true);
      setError("");

      await api.delete(
        `/infrastructure/requests/${selectedRequest.id}`
      );

      setSuccess(
        "Infrastructure request deleted successfully."
      );

      setShowDelete(false);
      setSelectedRequest(null);

      if (
        requests.length === 1 &&
        page > 1
      ) {
        setPage((current) => current - 1);
      } else {
        await fetchRequests();
      }
    } catch (err) {
      console.error(
        "Failed to delete request:",
        err
      );

      setError(
        err?.response?.data?.message ||
          "Unable to delete the request."
      );
    } finally {
      setDeleting(false);
    }
  };

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("");
    setPriorityFilter("");
    setTypeFilter("");
    setLocationFilter("");
    setPage(1);
  };

  const openDetails = (request) => {
    setSelectedRequest(request);
    setShowDetails(true);
  };

  const canPrevious = page > 1;
  const canNext =
    page < Math.max(1, pagination.totalPages);

  return (
    <div className="requests-page">
      <style>{`
        * {
          box-sizing: border-box;
        }

        .requests-page {
          min-height: 100vh;
          background: #f8fafc;
          color: #0f172a;
          font-family: Inter, ui-sans-serif, system-ui,
            -apple-system, BlinkMacSystemFont, "Segoe UI",
            sans-serif;
          padding: 24px;
        }

        .requests-container {
          max-width: 1600px;
          margin: 0 auto;
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 20px;
          margin-bottom: 24px;
        }

        .header-left {
          display: flex;
          gap: 14px;
        }

        .header-icon {
          width: 50px;
          height: 50px;
          border-radius: 14px;
          background: linear-gradient(
            135deg,
            #0ea5e9,
            #2563eb
          );
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          box-shadow:
            0 10px 25px
            rgba(37, 99, 235, .18);
        }

        .page-header h1 {
          margin: 0 0 5px;
          font-size: 27px;
          font-weight: 800;
          letter-spacing: -.02em;
        }

        .page-header p {
          margin: 0;
          color: #64748b;
          font-size: 14px;
        }

        .header-actions {
          display: flex;
          gap: 9px;
          flex-wrap: wrap;
        }

        .btn {
          min-height: 42px;
          padding: 0 14px;
          border-radius: 10px;
          border: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-size: 13px;
          font-weight: 750;
          cursor: pointer;
          text-decoration: none;
          transition: .2s ease;
          white-space: nowrap;
        }

        .btn:hover {
          transform: translateY(-1px);
        }

        .btn:disabled {
          opacity: .55;
          cursor: not-allowed;
          transform: none;
        }

        .btn-primary {
          background: #0ea5e9;
          color: white;
          box-shadow:
            0 8px 20px
            rgba(14,165,233,.2);
        }

        .btn-primary:hover {
          background: #0284c7;
        }

        .btn-secondary {
          background: white;
          color: #334155;
          border: 1px solid #e2e8f0;
        }

        .btn-secondary:hover {
          background: #f8fafc;
          border-color: #cbd5e1;
        }

        .btn-success {
          background: #16a34a;
          color: white;
        }

        .btn-danger {
          background: #dc2626;
          color: white;
        }

        .summary-grid {
          display: grid;
          grid-template-columns:
            repeat(6, minmax(0, 1fr));
          gap: 15px;
          margin-bottom: 20px;
        }

        .summary-card {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 15px;
          padding: 17px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          box-shadow:
            0 4px 18px
            rgba(15,23,42,.035);
        }

        .summary-label {
          color: #64748b;
          font-size: 10px;
          font-weight: 800;
          margin-bottom: 7px;
        }

        .summary-value {
          font-size: 24px;
          line-height: 1;
          font-weight: 800;
        }

        .summary-icon {
          width: 40px;
          height: 40px;
          border-radius: 11px;
          background: #eff6ff;
          color: #2563eb;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .summary-card.warning
          .summary-icon {
          background: #fffbeb;
          color: #d97706;
        }

        .summary-card.success
          .summary-icon {
          background: #f0fdf4;
          color: #16a34a;
        }

        .summary-card.info
          .summary-icon {
          background: #f0f9ff;
          color: #0284c7;
        }

        .summary-card.danger
          .summary-icon {
          background: #fef2f2;
          color: #dc2626;
        }

        .toolbar {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 15px;
          padding: 15px;
          margin-bottom: 18px;
        }

        .toolbar-row {
          display: flex;
          gap: 9px;
          flex-wrap: wrap;
          align-items: center;
        }

        .search-box {
          flex: 1 1 300px;
          min-width: 240px;
          position: relative;
        }

        .search-box svg {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
        }

        .search-box input {
          width: 100%;
          height: 42px;
          padding: 0 12px 0 39px;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          outline: none;
          font-size: 13px;
        }

        .filter-select,
        .location-input {
          height: 42px;
          min-width: 145px;
          padding: 0 11px;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          background: white;
          color: #334155;
          outline: none;
          font-size: 13px;
        }

        .location-input {
          width: 160px;
        }

        .search-box input:focus,
        .filter-select:focus,
        .location-input:focus,
        .form-input:focus,
        .form-select:focus,
        .form-textarea:focus {
          border-color: #0ea5e9;
          box-shadow:
            0 0 0 3px
            rgba(14,165,233,.1);
        }

        .table-card {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 15px;
          overflow: hidden;
          box-shadow:
            0 4px 18px
            rgba(15,23,42,.035);
        }

        .table-header {
          padding: 16px 18px;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .table-title {
          font-size: 15px;
          font-weight: 800;
        }

        .table-subtitle {
          margin-top: 3px;
          color: #64748b;
          font-size: 12px;
        }

        .table-wrapper {
          overflow-x: auto;
        }

        table {
          width: 100%;
          min-width: 1450px;
          border-collapse: collapse;
        }

        th {
          padding: 13px 15px;
          text-align: left;
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
          color: #64748b;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: .04em;
          white-space: nowrap;
        }

        td {
          padding: 14px 15px;
          border-bottom: 1px solid #f1f5f9;
          font-size: 13px;
          vertical-align: middle;
        }

        tbody tr:hover {
          background: #f8fbff;
        }

        .primary-text {
          color: #0f172a;
          font-weight: 750;
        }

        .secondary-text {
          color: #64748b;
          font-size: 11px;
          margin-top: 3px;
        }

        .request-cell {
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .request-icon {
          width: 35px;
          height: 35px;
          border-radius: 9px;
          background: #eff6ff;
          color: #2563eb;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 25px;
          padding: 0 9px;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 800;
          white-space: nowrap;
        }

        .badge.success {
          background: #dcfce7;
          color: #166534;
        }

        .badge.warning {
          background: #fef3c7;
          color: #92400e;
        }

        .badge.danger {
          background: #fee2e2;
          color: #991b1b;
        }

        .badge.info {
          background: #dbeafe;
          color: #1d4ed8;
        }

        .badge.default {
          background: #f1f5f9;
          color: #475569;
        }

        .action-buttons {
          display: flex;
          gap: 5px;
        }

        .icon-btn {
          width: 33px;
          height: 33px;
          border: 1px solid #e2e8f0;
          background: white;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: #475569;
        }

        .icon-btn:hover {
          color: #0284c7;
          background: #f0f9ff;
          border-color: #bae6fd;
        }

        .icon-btn.delete:hover {
          color: #dc2626;
          background: #fef2f2;
          border-color: #fecaca;
        }

        .pagination {
          padding: 14px 18px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .pagination-info {
          color: #64748b;
          font-size: 12px;
        }

        .pagination-actions {
          display: flex;
          align-items: center;
          gap: 7px;
        }

        .page-btn {
          width: 35px;
          height: 35px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          background: white;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: #475569;
        }

        .page-btn:disabled {
          opacity: .45;
          cursor: not-allowed;
        }

        .page-number {
          min-width: 48px;
          height: 35px;
          padding: 0 8px;
          border-radius: 8px;
          background: #eff6ff;
          color: #2563eb;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 800;
        }

        .loading-state,
        .empty-state {
          padding: 60px 20px;
          text-align: center;
          color: #64748b;
        }

        .loading-icon {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .empty-icon {
          width: 50px;
          height: 50px;
          margin: 0 auto 12px;
          border-radius: 14px;
          background: #f1f5f9;
          color: #64748b;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .alert {
          padding: 12px 14px;
          border-radius: 11px;
          margin-bottom: 15px;
          display: flex;
          align-items: center;
          gap: 9px;
          font-size: 13px;
          font-weight: 650;
        }

        .alert-error {
          background: #fef2f2;
          color: #991b1b;
          border: 1px solid #fecaca;
        }

        .alert-success {
          background: #f0fdf4;
          color: #166534;
          border: 1px solid #bbf7d0;
        }

        .modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 1000;
          padding: 20px;
          background: rgba(15,23,42,.58);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .modal {
          width: min(950px, 100%);
          max-height: 92vh;
          overflow-y: auto;
          background: white;
          border-radius: 18px;
          box-shadow:
            0 25px 80px
            rgba(15,23,42,.25);
        }

        .modal.small {
          width: min(450px, 100%);
        }

        .modal-header {
          padding: 18px 20px;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          position: sticky;
          top: 0;
          background: white;
          z-index: 2;
        }

        .modal-header h2 {
          margin: 0;
          font-size: 18px;
          font-weight: 800;
        }

        .modal-header p {
          margin: 4px 0 0;
          color: #64748b;
          font-size: 12px;
        }

        .close-btn {
          width: 36px;
          height: 36px;
          border: 1px solid #e2e8f0;
          border-radius: 9px;
          background: white;
          color: #64748b;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .modal-body {
          padding: 20px;
        }

        .form-grid {
          display: grid;
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
          gap: 15px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .form-group.full {
          grid-column: 1 / -1;
        }

        .form-label {
          color: #334155;
          font-size: 12px;
          font-weight: 800;
        }

        .form-input,
        .form-select,
        .form-textarea {
          width: 100%;
          border: 1px solid #e2e8f0;
          border-radius: 9px;
          outline: none;
          color: #0f172a;
          background: white;
          font-size: 13px;
        }

        .form-input,
        .form-select {
          height: 42px;
          padding: 0 11px;
        }

        .form-textarea {
          min-height: 95px;
          padding: 10px 11px;
          resize: vertical;
        }

        .modal-footer {
          padding: 15px 20px;
          border-top: 1px solid #e2e8f0;
          display: flex;
          justify-content: flex-end;
          gap: 9px;
          position: sticky;
          bottom: 0;
          background: white;
        }

        .details-grid {
          display: grid;
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
          gap: 13px;
        }

        .detail-item {
          padding: 13px;
          border: 1px solid #e2e8f0;
          border-radius: 11px;
          background: #f8fafc;
        }

        .detail-item.full {
          grid-column: 1 / -1;
        }

        .detail-label {
          color: #64748b;
          font-size: 10px;
          font-weight: 800;
          margin-bottom: 5px;
        }

        .detail-value {
          color: #0f172a;
          font-size: 13px;
          font-weight: 650;
          word-break: break-word;
        }

        .confirm-content {
          text-align: center;
        }

        .confirm-icon {
          width: 52px;
          height: 52px;
          margin: 0 auto 14px;
          border-radius: 14px;
          background: #fef2f2;
          color: #dc2626;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .confirm-content h3 {
          margin: 0 0 7px;
          font-size: 18px;
        }

        .confirm-content p {
          margin: 0;
          color: #64748b;
          line-height: 1.6;
          font-size: 13px;
        }

        .quick-links {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 18px;
        }

        .quick-link {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 9px 12px;
          border: 1px solid #e2e8f0;
          border-radius: 9px;
          background: white;
          color: #334155;
          text-decoration: none;
          font-size: 12px;
          font-weight: 700;
        }

        .quick-link:hover {
          background: #f0f9ff;
          color: #0284c7;
          border-color: #bae6fd;
        }

        @media (max-width: 1250px) {
          .summary-grid {
            grid-template-columns:
              repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 800px) {
          .requests-page {
            padding: 14px;
          }

          .page-header {
            flex-direction: column;
          }

          .header-actions {
            width: 100%;
          }

          .header-actions .btn {
            flex: 1;
          }

          .summary-grid {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }

          .form-grid,
          .details-grid {
            grid-template-columns: 1fr;
          }

          .form-group.full,
          .detail-item.full {
            grid-column: auto;
          }
        }

        @media (max-width: 520px) {
          .summary-grid {
            grid-template-columns: 1fr;
          }

          .toolbar-row {
            flex-direction: column;
            align-items: stretch;
          }

          .search-box,
          .filter-select,
          .location-input,
          .toolbar-row .btn {
            width: 100%;
            min-width: 100%;
          }
        }
      `}</style>

      <div className="requests-container">
        <div className="page-header">
          <div className="header-left">
            <div className="header-icon">
              <ClipboardList size={25} />
            </div>

            <div>
              <h1>Infrastructure Requests</h1>

              <p>
                Create, review, approve, track, and
                manage infrastructure requests.
              </p>
            </div>
          </div>

          <div className="header-actions">
            <Link
              to="/infrastructure"
              className="btn btn-secondary"
            >
              <BarChart3 size={16} />
              Dashboard
            </Link>

            <Link
              to="/infrastructure/maintenance"
              className="btn btn-secondary"
            >
              <Clock3 size={16} />
              Maintenance
            </Link>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={fetchRequests}
              disabled={loading}
            >
              <RefreshCw
                size={16}
                className={
                  loading
                    ? "loading-icon"
                    : ""
                }
              />
              Refresh
            </button>

            <button
              type="button"
              className="btn btn-primary"
              onClick={openCreateModal}
            >
              <Plus size={17} />
              New Request
            </button>
          </div>
        </div>

        {error && (
          <div className="alert alert-error">
            <AlertCircle size={17} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="alert alert-success">
            <CheckCircle2 size={17} />
            <span>{success}</span>
          </div>
        )}

        <div className="summary-grid">
          <div className="summary-card">
            <div>
              <div className="summary-label">
                TOTAL REQUESTS
              </div>
              <div className="summary-value">
                {summary.total}
              </div>
            </div>

            <div className="summary-icon">
              <ClipboardList size={20} />
            </div>
          </div>

          <div className="summary-card warning">
            <div>
              <div className="summary-label">
                PENDING / REVIEW
              </div>
              <div className="summary-value">
                {summary.pending}
              </div>
            </div>

            <div className="summary-icon">
              <Clock3 size={20} />
            </div>
          </div>

          <div className="summary-card success">
            <div>
              <div className="summary-label">
                APPROVED
              </div>
              <div className="summary-value">
                {summary.approved}
              </div>
            </div>

            <div className="summary-icon">
              <Check size={20} />
            </div>
          </div>

          <div className="summary-card info">
            <div>
              <div className="summary-label">
                IN PROGRESS
              </div>
              <div className="summary-value">
                {summary.inProgress}
              </div>
            </div>

            <div className="summary-icon">
              <ActivityIcon />
            </div>
          </div>

          <div className="summary-card success">
            <div>
              <div className="summary-label">
                COMPLETED
              </div>
              <div className="summary-value">
                {summary.completed}
              </div>
            </div>

            <div className="summary-icon">
              <CheckCircle2 size={20} />
            </div>
          </div>

          <div className="summary-card danger">
            <div>
              <div className="summary-label">
                URGENT / CRITICAL
              </div>
              <div className="summary-value">
                {summary.urgent}
              </div>
            </div>

            <div className="summary-icon">
              <AlertCircle size={20} />
            </div>
          </div>
        </div>

        <div className="toolbar">
          <div className="toolbar-row">
            <div className="search-box">
              <Search size={17} />

              <input
                type="search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Search request, asset, requester..."
              />
            </div>

            <select
              className="filter-select"
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="">
                All Statuses
              </option>

              {STATUS_OPTIONS.map(
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
              className="filter-select"
              value={priorityFilter}
              onChange={(event) => {
                setPriorityFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="">
                All Priorities
              </option>

              {PRIORITY_OPTIONS.map(
                (priority) => (
                  <option
                    key={priority}
                    value={priority}
                  >
                    {priority}
                  </option>
                )
              )}
            </select>

            <select
              className="filter-select"
              value={typeFilter}
              onChange={(event) => {
                setTypeFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="">
                All Request Types
              </option>

              {REQUEST_TYPES.map(
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

            <input
              className="location-input"
              value={locationFilter}
              onChange={(event) => {
                setLocationFilter(
                  event.target.value
                );
                setPage(1);
              }}
              placeholder="Location"
            />

            {(search ||
              statusFilter ||
              priorityFilter ||
              typeFilter ||
              locationFilter) && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={clearFilters}
              >
                <X size={15} />
                Clear
              </button>
            )}
          </div>
        </div>

        <div className="table-card">
          <div className="table-header">
            <div>
              <div className="table-title">
                Infrastructure Request Registry
              </div>

              <div className="table-subtitle">
                Real requests and workflow status
                retrieved from the backend.
              </div>
            </div>

            <Filter
              size={18}
              color="#64748b"
            />
          </div>

          {loading ? (
            <div className="loading-state">
              <Loader2
                size={30}
                className="loading-icon"
              />

              <div>
                Loading infrastructure requests...
              </div>
            </div>
          ) : requests.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                <ClipboardList size={23} />
              </div>

              <div className="primary-text">
                No infrastructure requests found
              </div>

              <div className="secondary-text">
                {search ||
                statusFilter ||
                priorityFilter ||
                typeFilter ||
                locationFilter
                  ? "Try changing the search or filters."
                  : "Create the first infrastructure request to get started."}
              </div>

              {!search &&
                !statusFilter &&
                !priorityFilter &&
                !typeFilter &&
                !locationFilter && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{
                      marginTop: 16,
                    }}
                    onClick={
                      openCreateModal
                    }
                  >
                    <Plus size={16} />
                    New Request
                  </button>
                )}
            </div>
          ) : (
            <>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Request</th>
                      <th>Type</th>
                      <th>Asset</th>
                      <th>Location</th>
                      <th>Requested By</th>
                      <th>Priority</th>
                      <th>Status</th>
                      <th>Required Date</th>
                      <th>Estimated Cost</th>
                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {requests.map(
                      (request) => (
                        <tr
                          key={
                            request.id
                          }
                        >
                          <td>
                            <div className="request-cell">
                              <div className="request-icon">
                                <ClipboardList
                                  size={16}
                                />
                              </div>

                              <div>
                                <div className="primary-text">
                                  {
                                    request.title
                                  }
                                </div>

                                <div className="secondary-text">
                                  {
                                    request.requestNumber
                                  }
                                </div>
                              </div>
                            </div>
                          </td>

                          <td>
                            <div className="primary-text">
                              {
                                request.requestType
                              }
                            </div>

                            <div className="secondary-text">
                              {
                                request.category
                              }
                            </div>
                          </td>

                          <td>
                            <div className="primary-text">
                              {
                                request.assetName
                              }
                            </div>

                            <div className="secondary-text">
                              ID:{" "}
                              {
                                request.assetId
                              }
                            </div>
                          </td>

                          <td>
                            <div className="request-cell">
                              <MapPin
                                size={15}
                                color="#64748b"
                              />

                              <span>
                                {
                                  request.location
                                }
                              </span>
                            </div>
                          </td>

                          <td>
                            <div className="request-cell">
                              <User
                                size={15}
                                color="#64748b"
                              />

                              <span>
                                {
                                  request.requestedBy
                                }
                              </span>
                            </div>
                          </td>

                          <td>
                            <span
                              className={`badge ${priorityClass(
                                request.priority
                              )}`}
                            >
                              {
                                request.priority
                              }
                            </span>
                          </td>

                          <td>
                            <span
                              className={`badge ${statusClass(
                                request.status
                              )}`}
                            >
                              {
                                request.status
                              }
                            </span>
                          </td>

                          <td>
                            {formatDate(
                              request.requiredDate
                            )}
                          </td>

                          <td>
                            {formatMoney(
                              request.estimatedCost
                            )}
                          </td>

                          <td>
                            <div className="action-buttons">
                              <button
                                type="button"
                                className="icon-btn"
                                title="View details"
                                onClick={() =>
                                  openDetails(
                                    request
                                  )
                                }
                              >
                                <Eye
                                  size={16}
                                />
                              </button>

                              <button
                                type="button"
                                className="icon-btn"
                                title="Edit"
                                onClick={() =>
                                  openEditModal(
                                    request
                                  )
                                }
                              >
                                <Edit3
                                  size={16}
                                />
                              </button>

                              {[
                                "pending",
                                "draft",
                              ].includes(
                                String(
                                  request.status
                                ).toLowerCase()
                              ) && (
                                <button
                                  type="button"
                                  className="icon-btn"
                                  title="Submit"
                                  disabled={
                                    actionLoading ===
                                    `submit-${request.id}`
                                  }
                                  onClick={() =>
                                    performStatusAction(
                                      request,
                                      "submit"
                                    )
                                  }
                                >
                                  {actionLoading ===
                                  `submit-${request.id}` ? (
                                    <Loader2
                                      size={15}
                                      className="loading-icon"
                                    />
                                  ) : (
                                    <Send
                                      size={15}
                                    />
                                  )}
                                </button>
                              )}

                              {[
                                "submitted",
                                "under review",
                              ].includes(
                                String(
                                  request.status
                                ).toLowerCase()
                              ) && (
                                <button
                                  type="button"
                                  className="icon-btn"
                                  title="Approve"
                                  disabled={
                                    actionLoading ===
                                    `approve-${request.id}`
                                  }
                                  onClick={() =>
                                    performStatusAction(
                                      request,
                                      "approve"
                                    )
                                  }
                                >
                                  {actionLoading ===
                                  `approve-${request.id}` ? (
                                    <Loader2
                                      size={15}
                                      className="loading-icon"
                                    />
                                  ) : (
                                    <Check
                                      size={15}
                                    />
                                  )}
                                </button>
                              )}

                              <button
                                type="button"
                                className="icon-btn delete"
                                title="Delete"
                                onClick={() =>
                                  openDeleteDialog(
                                    request
                                  )
                                }
                              >
                                <Trash2
                                  size={16}
                                />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>

              <div className="pagination">
                <div className="pagination-info">
                  Showing{" "}
                  {requests.length} of{" "}
                  {pagination.total} requests
                </div>

                <div className="pagination-actions">
                  <button
                    type="button"
                    className="page-btn"
                    disabled={
                      !canPrevious ||
                      loading
                    }
                    onClick={() =>
                      setPage(
                        (current) =>
                          Math.max(
                            1,
                            current - 1
                          )
                      )
                    }
                  >
                    <ChevronLeft
                      size={17}
                    />
                  </button>

                  <div className="page-number">
                    {page} /{" "}
                    {Math.max(
                      1,
                      pagination.totalPages
                    )}
                  </div>

                  <button
                    type="button"
                    className="page-btn"
                    disabled={
                      !canNext ||
                      loading
                    }
                    onClick={() =>
                      setPage(
                        (current) =>
                          Math.min(
                            pagination.totalPages,
                            current + 1
                          )
                      )
                    }
                  >
                    <ChevronRight
                      size={17}
                    />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="quick-links">
          <Link
            to="/infrastructure"
            className="quick-link"
          >
            <BarChart3 size={15} />
            Infrastructure Dashboard
          </Link>

          <Link
            to="/infrastructure/assets"
            className="quick-link"
          >
            <ClipboardList size={15} />
            Infrastructure Assets
          </Link>

          <Link
            to="/infrastructure/work-orders"
            className="quick-link"
          >
            <Clock3 size={15} />
            Work Orders
          </Link>

          <Link
            to="/infrastructure/maintenance"
            className="quick-link"
          >
            <CheckCircle2 size={15} />
            Maintenance
          </Link>
        </div>
      </div>

      {showModal && (
        <div
          className="modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
                event.currentTarget &&
              !saving
            ) {
              setShowModal(false);
            }
          }}
        >
          <div className="modal">
            <div className="modal-header">
              <div>
                <h2>
                  {editingRequest
                    ? "Edit Infrastructure Request"
                    : "New Infrastructure Request"}
                </h2>

                <p>
                  Enter the request details and
                  workflow information.
                </p>
              </div>

              <button
                type="button"
                className="close-btn"
                onClick={() =>
                  !saving &&
                  setShowModal(false)
                }
              >
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={
                handleSubmit
              }
            >
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">
                      Request Number
                    </label>

                    <input
                      className="form-input"
                      name="requestNumber"
                      value={
                        form.requestNumber
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="Auto/generated if blank"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Request Type
                    </label>

                    <select
                      className="form-select"
                      name="requestType"
                      value={
                        form.requestType
                      }
                      onChange={
                        handleChange
                      }
                    >
                      {REQUEST_TYPES.map(
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

                  <div className="form-group full">
                    <label className="form-label">
                      Request Title *
                    </label>

                    <input
                      className="form-input"
                      name="title"
                      value={
                        form.title
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="Enter request title"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Category
                    </label>

                    <input
                      className="form-input"
                      name="category"
                      value={
                        form.category
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="Infrastructure category"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Asset ID
                    </label>

                    <input
                      className="form-input"
                      name="assetId"
                      value={
                        form.assetId
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="Related asset ID"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Asset Name
                    </label>

                    <input
                      className="form-input"
                      name="assetName"
                      value={
                        form.assetName
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="Related asset"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Location
                    </label>

                    <input
                      className="form-input"
                      name="location"
                      value={
                        form.location
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="Building / facility / location"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Requested By *
                    </label>

                    <input
                      className="form-input"
                      name="requestedBy"
                      value={
                        form.requestedBy
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="Requester name or ID"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Assigned To
                    </label>

                    <input
                      className="form-input"
                      name="assignedTo"
                      value={
                        form.assignedTo
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="Responsible officer/technician"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Priority
                    </label>

                    <select
                      className="form-select"
                      name="priority"
                      value={
                        form.priority
                      }
                      onChange={
                        handleChange
                      }
                    >
                      {PRIORITY_OPTIONS.map(
                        (priority) => (
                          <option
                            key={priority}
                            value={priority}
                          >
                            {priority}
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
                      className="form-select"
                      name="status"
                      value={
                        form.status
                      }
                      onChange={
                        handleChange
                      }
                    >
                      {STATUS_OPTIONS.map(
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
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Request Date
                    </label>

                    <input
                      type="date"
                      className="form-input"
                      name="requestDate"
                      value={
                        form.requestDate
                      }
                      onChange={
                        handleChange
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Required Date
                    </label>

                    <input
                      type="date"
                      className="form-input"
                      name="requiredDate"
                      value={
                        form.requiredDate
                      }
                      onChange={
                        handleChange
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Estimated Cost
                    </label>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="form-input"
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
                      className="form-textarea"
                      name="description"
                      value={
                        form.description
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="Describe the requested work, asset, material, or service..."
                    />
                  </div>

                  <div className="form-group full">
                    <label className="form-label">
                      Justification
                    </label>

                    <textarea
                      className="form-textarea"
                      name="justification"
                      value={
                        form.justification
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="Why is this request required?"
                    />
                  </div>

                  <div className="form-group full">
                    <label className="form-label">
                      Remarks
                    </label>

                    <textarea
                      className="form-textarea"
                      name="remarks"
                      value={
                        form.remarks
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="Additional remarks..."
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() =>
                    setShowModal(false)
                  }
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <Loader2
                        size={16}
                        className="loading-icon"
                      />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle2
                        size={16}
                      />
                      {editingRequest
                        ? "Update Request"
                        : "Create Request"}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDetails &&
        selectedRequest && (
          <div
            className="modal-overlay"
            onMouseDown={(event) => {
              if (
                event.target ===
                event.currentTarget
              ) {
                setShowDetails(false);
              }
            }}
          >
            <div className="modal">
              <div className="modal-header">
                <div>
                  <h2>
                    Request Details
                  </h2>

                  <p>
                    {
                      selectedRequest.title
                    }
                  </p>
                </div>

                <button
                  type="button"
                  className="close-btn"
                  onClick={() =>
                    setShowDetails(false)
                  }
                >
                  <X size={18} />
                </button>
              </div>

              <div className="modal-body">
                <div className="details-grid">
                  <Detail
                    label="REQUEST NUMBER"
                    value={
                      selectedRequest.requestNumber
                    }
                  />

                  <Detail
                    label="TITLE"
                    value={
                      selectedRequest.title
                    }
                  />

                  <Detail
                    label="REQUEST TYPE"
                    value={
                      selectedRequest.requestType
                    }
                  />

                  <Detail
                    label="CATEGORY"
                    value={
                      selectedRequest.category
                    }
                  />

                  <Detail
                    label="ASSET ID"
                    value={
                      selectedRequest.assetId
                    }
                  />

                  <Detail
                    label="ASSET NAME"
                    value={
                      selectedRequest.assetName
                    }
                  />

                  <Detail
                    label="LOCATION"
                    value={
                      selectedRequest.location
                    }
                  />

                  <Detail
                    label="REQUESTED BY"
                    value={
                      selectedRequest.requestedBy
                    }
                  />

                  <Detail
                    label="ASSIGNED TO"
                    value={
                      selectedRequest.assignedTo
                    }
                  />

                  <div className="detail-item">
                    <div className="detail-label">
                      PRIORITY
                    </div>

                    <div className="detail-value">
                      <span
                        className={`badge ${priorityClass(
                          selectedRequest.priority
                        )}`}
                      >
                        {
                          selectedRequest.priority
                        }
                      </span>
                    </div>
                  </div>

                  <div className="detail-item">
                    <div className="detail-label">
                      STATUS
                    </div>

                    <div className="detail-value">
                      <span
                        className={`badge ${statusClass(
                          selectedRequest.status
                        )}`}
                      >
                        {
                          selectedRequest.status
                        }
                      </span>
                    </div>
                  </div>

                  <Detail
                    label="REQUEST DATE"
                    value={formatDate(
                      selectedRequest.requestDate
                    )}
                  />

                  <Detail
                    label="REQUIRED DATE"
                    value={formatDate(
                      selectedRequest.requiredDate
                    )}
                  />

                  <Detail
                    label="ESTIMATED COST"
                    value={formatMoney(
                      selectedRequest.estimatedCost
                    )}
                  />

                  <Detail
                    label="CREATED"
                    value={formatDateTime(
                      selectedRequest.createdAt
                    )}
                  />

                  <Detail
                    label="UPDATED"
                    value={formatDateTime(
                      selectedRequest.updatedAt
                    )}
                  />

                  <Detail
                    label="DESCRIPTION"
                    value={
                      selectedRequest.description ||
                      "—"
                    }
                    full
                  />

                  <Detail
                    label="JUSTIFICATION"
                    value={
                      selectedRequest.justification ||
                      "—"
                    }
                    full
                  />

                  <Detail
                    label="REMARKS"
                    value={
                      selectedRequest.remarks ||
                      "—"
                    }
                    full
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() =>
                    setShowDetails(false)
                  }
                >
                  Close
                </button>

                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    setShowDetails(false);
                    openEditModal(
                      selectedRequest
                    );
                  }}
                >
                  <Edit3 size={16} />
                  Edit Request
                </button>
              </div>
            </div>
          </div>
        )}

      {showDelete &&
        selectedRequest && (
          <div
            className="modal-overlay"
            onMouseDown={(event) => {
              if (
                event.target ===
                  event.currentTarget &&
                !deleting
              ) {
                setShowDelete(false);
              }
            }}
          >
            <div className="modal small">
              <div className="modal-header">
                <div>
                  <h2>
                    Delete Request
                  </h2>

                  <p>
                    This action cannot be
                    undone.
                  </p>
                </div>

                <button
                  type="button"
                  className="close-btn"
                  onClick={() =>
                    !deleting &&
                    setShowDelete(false)
                  }
                >
                  <X size={18} />
                </button>
              </div>

              <div className="modal-body">
                <div className="confirm-content">
                  <div className="confirm-icon">
                    <XCircle
                      size={25}
                    />
                  </div>

                  <h3>
                    Are you sure?
                  </h3>

                  <p>
                    You are about to delete{" "}
                    <strong>
                      {
                        selectedRequest.title
                      }
                    </strong>
                    . This will remove the
                    request record from the
                    infrastructure request
                    registry.
                  </p>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() =>
                    setShowDelete(false)
                  }
                  disabled={deleting}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? (
                    <>
                      <Loader2
                        size={16}
                        className="loading-icon"
                      />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2
                        size={16}
                      />
                      Delete Request
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}

function Detail({
  label,
  value,
  full = false,
}) {
  return (
    <div
      className={`detail-item ${
        full ? "full" : ""
      }`}
    >
      <div className="detail-label">
        {label}
      </div>

      <div className="detail-value">
        {value}
      </div>
    </div>
  );
}

function ActivityIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}