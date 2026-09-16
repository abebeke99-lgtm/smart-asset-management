import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  FilePlus2,
  Filter,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Send,
  Trash2,
  User,
  X,
  XCircle,
} from "lucide-react";

const EMPTY_FORM = {
  requestNumber: "",
  department: "",
  requestedBy: "",
  requestDate: "",
  requiredDate: "",
  priority: "Normal",
  status: "Draft",
  purpose: "",
  justification: "",
  notes: "",
  items: [
    {
      itemName: "",
      description: "",
      quantity: 1,
      unit: "pcs",
      estimatedUnitCost: "",
      category: "",
    },
  ],
};

const STATUS_OPTIONS = [
  "Draft",
  "Pending",
  "Submitted",
  "Under Review",
  "Approved",
  "Rejected",
  "Cancelled",
  "Completed",
];

const PRIORITY_OPTIONS = [
  "Low",
  "Normal",
  "High",
  "Urgent",
];

function firstValue(...values) {
  return values.find(
    (value) =>
      value !== undefined &&
      value !== null &&
      value !== ""
  );
}

function payloadOf(response) {
  return response?.data?.data ?? response?.data ?? {};
}

function rowsOf(value) {
  if (Array.isArray(value)) return value;

  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.rows)) return value.rows;
  if (Array.isArray(value?.records)) return value.records;
  if (Array.isArray(value?.results)) return value.results;
  if (Array.isArray(value?.data)) return value.data;

  return [];
}

function paginationOf(payload) {
  const pagination =
    payload?.pagination ||
    payload?.meta ||
    payload?.pageInfo ||
    {};

  return {
    page: Number(
      firstValue(
        pagination.page,
        pagination.currentPage,
        pagination.current_page,
        payload?.page,
        1
      )
    ),
    pages: Number(
      firstValue(
        pagination.pages,
        pagination.totalPages,
        pagination.total_pages,
        payload?.pages,
        1
      )
    ),
    total: Number(
      firstValue(
        pagination.total,
        pagination.totalCount,
        pagination.total_records,
        payload?.total,
        0
      )
    ),
    limit: Number(
      firstValue(
        pagination.limit,
        pagination.pageSize,
        pagination.page_size,
        payload?.limit,
        10
      )
    ),
  };
}

function money(value) {
  const n = Number(value);
  return `${Number.isFinite(n) ? n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) : "0.00"} ETB`;
}

function dateValue(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value).slice(0, 10);
  }

  return date.toISOString().slice(0, 10);
}

function dateDisplay(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value).slice(0, 10);
  }

  return date.toLocaleDateString("en-GB");
}

function statusClass(status) {
  const value = String(status || "").toLowerCase();

  if (value.includes("approved") || value.includes("completed")) {
    return "approved";
  }

  if (
    value.includes("pending") ||
    value.includes("submitted") ||
    value.includes("review")
  ) {
    return "pending";
  }

  if (
    value.includes("reject") ||
    value.includes("cancel")
  ) {
    return "rejected";
  }

  return "draft";
}

function priorityClass(priority) {
  const value = String(priority || "").toLowerCase();

  if (value === "urgent") return "urgent";
  if (value === "high") return "high";
  if (value === "low") return "low";

  return "normal";
}

function normalizeRequest(item) {
  const rawItems = firstValue(
    item?.items,
    item?.requestItems,
    item?.request_items,
    []
  );

  const items = rowsOf(rawItems).map((row) => ({
    itemName: firstValue(
      row?.itemName,
      row?.item_name,
      row?.name,
      ""
    ),
    description: firstValue(
      row?.description,
      row?.details,
      ""
    ),
    quantity: firstValue(
      row?.quantity,
      row?.qty,
      1
    ),
    unit: firstValue(
      row?.unit,
      row?.unitName,
      "pcs"
    ),
    estimatedUnitCost: firstValue(
      row?.estimatedUnitCost,
      row?.estimated_unit_cost,
      row?.unitCost,
      row?.unit_cost,
      ""
    ),
    category: firstValue(
      row?.category,
      row?.categoryName,
      row?.category_name,
      ""
    ),
  }));

  const totalAmount = firstValue(
    item?.totalAmount,
    item?.total_amount,
    item?.estimatedTotal,
    item?.estimated_total,
    item?.amount,
    item?.total,
    items.reduce(
      (sum, row) =>
        sum +
        Number(row.quantity || 0) *
          Number(row.estimatedUnitCost || 0),
      0
    )
  );

  return {
    id: firstValue(item?.id, item?.requestId, item?.request_id),
    requestNumber: firstValue(
      item?.requestNumber,
      item?.request_number,
      item?.number,
      item?.code,
      `PR-${item?.id || ""}`
    ),
    department: firstValue(
      item?.department,
      item?.departmentName,
      item?.department_name,
      "—"
    ),
    requestedBy: firstValue(
      item?.requestedBy,
      item?.requested_by,
      item?.requester,
      item?.requesterName,
      item?.requester_name,
      "—"
    ),
    requestDate: firstValue(
      item?.requestDate,
      item?.request_date,
      item?.createdAt,
      item?.created_at
    ),
    requiredDate: firstValue(
      item?.requiredDate,
      item?.required_date,
      item?.neededBy,
      item?.needed_by
    ),
    priority: firstValue(
      item?.priority,
      "Normal"
    ),
    status: firstValue(
      item?.status,
      "Draft"
    ),
    purpose: firstValue(
      item?.purpose,
      item?.reason,
      ""
    ),
    justification: firstValue(
      item?.justification,
      item?.description,
      ""
    ),
    notes: firstValue(
      item?.notes,
      item?.remarks,
      ""
    ),
    totalAmount,
    items,
    raw: item,
  };
}

function SummaryCard({
  icon: Icon,
  title,
  value,
  tone,
}) {
  return (
    <div className="summary-card">
      <div>
        <div className="summary-title">{title}</div>
        <div className="summary-value">{value}</div>
      </div>

      <div className={`summary-icon ${tone}`}>
        <Icon size={20} />
      </div>
    </div>
  );
}

export default function FinancePurchaseRequests() {
  const [requests, setRequests] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [categories, setCategories] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [department, setDepartment] = useState("");

  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [pagination, setPagination] = useState({
    page: 1,
    pages: 1,
    total: 0,
    limit: 10,
  });

  const [modal, setModal] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);

  const [form, setForm] = useState(EMPTY_FORM);

  const loadRequests = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get(
        "/finance/purchase-requests",
        {
          params: {
            page,
            limit,
            search: search || undefined,
            status: status || undefined,
            priority: priority || undefined,
            department: department || undefined,
          },
        }
      );

      const payload = payloadOf(response);

      const rawRows = firstValue(
        payload?.requests,
        payload?.purchaseRequests,
        payload?.purchase_requests,
        payload?.items,
        payload?.rows,
        payload?.records,
        payload?.results,
        Array.isArray(payload) ? payload : []
      );

      const normalized = rowsOf(rawRows).map(
        normalizeRequest
      );

      setRequests(normalized);
      setPagination(paginationOf(payload));
    } catch (err) {
      console.error(err);

      setError(
        err?.response?.data?.message ||
          "Unable to load purchase requests."
      );

      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [
    page,
    limit,
    search,
    status,
    priority,
    department,
  ]);

  const loadOptions = useCallback(async () => {
    try {
      const response = await api.get(
        "/finance/purchase-requests/options"
      );

      const payload = payloadOf(response);

      setDepartments(
        rowsOf(
          firstValue(
            payload?.departments,
            payload?.departmentOptions,
            payload?.department_options
          )
        )
      );

      setCategories(
        rowsOf(
          firstValue(
            payload?.categories,
            payload?.categoryOptions,
            payload?.category_options
          )
        )
      );
    } catch (err) {
      console.warn(
        "Purchase request options endpoint unavailable:",
        err
      );
    }
  }, []);

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  useEffect(() => {
    if (!success) return;

    const timer = setTimeout(
      () => setSuccess(""),
      3500
    );

    return () => clearTimeout(timer);
  }, [success]);

  const summary = useMemo(() => {
    const backendSummary =
      requests?.summary ||
      null;

    if (backendSummary) return backendSummary;

    return {
      total: pagination.total || requests.length,
      pending: requests.filter((r) =>
        [
          "pending",
          "submitted",
          "under review",
        ].includes(
          String(r.status).toLowerCase()
        )
      ).length,
      approved: requests.filter(
        (r) =>
          String(r.status).toLowerCase() ===
          "approved"
      ).length,
      rejected: requests.filter((r) =>
        ["rejected", "cancelled"].includes(
          String(r.status).toLowerCase()
        )
      ).length,
    };
  }, [requests, pagination.total]);

  const updateForm = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const updateItem = (
    index,
    field,
    value
  ) => {
    setForm((current) => {
      const items = [...current.items];

      items[index] = {
        ...items[index],
        [field]: value,
      };

      return {
        ...current,
        items,
      };
    });
  };

  const addItem = () => {
    setForm((current) => ({
      ...current,
      items: [
        ...current.items,
        {
          itemName: "",
          description: "",
          quantity: 1,
          unit: "pcs",
          estimatedUnitCost: "",
          category: "",
        },
      ],
    }));
  };

  const removeItem = (index) => {
    setForm((current) => {
      if (current.items.length === 1) {
        return current;
      }

      return {
        ...current,
        items: current.items.filter(
          (_, itemIndex) =>
            itemIndex !== index
        ),
      };
    });
  };

  const calculatedTotal = useMemo(
    () =>
      form.items.reduce(
        (sum, item) =>
          sum +
          Number(item.quantity || 0) *
            Number(
              item.estimatedUnitCost || 0
            ),
        0
      ),
    [form.items]
  );

  const openCreate = () => {
    setSelectedRequest(null);

    setForm({
      ...EMPTY_FORM,
      requestDate: new Date()
        .toISOString()
        .slice(0, 10),
    });

    setModal("form");
  };

  const openEdit = (request) => {
    setSelectedRequest(request);

    setForm({
      requestNumber:
        request.requestNumber === "PR-"
          ? ""
          : request.requestNumber,
      department:
        request.department === "—"
          ? ""
          : request.department,
      requestedBy:
        request.requestedBy === "—"
          ? ""
          : request.requestedBy,
      requestDate:
        dateValue(request.requestDate),
      requiredDate:
        dateValue(request.requiredDate),
      priority:
        request.priority || "Normal",
      status:
        request.status || "Draft",
      purpose:
        request.purpose || "",
      justification:
        request.justification || "",
      notes:
        request.notes || "",
      items:
        request.items.length
          ? request.items
          : EMPTY_FORM.items,
    });

    setModal("form");
  };

  const openDetails = (request) => {
    setSelectedRequest(request);
    setModal("details");
  };

  const openDelete = (request) => {
    setSelectedRequest(request);
    setModal("delete");
  };

  const saveRequest = async (event) => {
    event.preventDefault();

    if (!form.department.trim()) {
      setError("Department is required.");
      return;
    }

    if (!form.requestedBy.trim()) {
      setError("Requested By is required.");
      return;
    }

    if (!form.requestDate) {
      setError("Request Date is required.");
      return;
    }

    const validItems = form.items.filter(
      (item) =>
        String(item.itemName || "").trim()
    );

    if (!validItems.length) {
      setError(
        "At least one purchase item is required."
      );
      return;
    }

    try {
      setSaving(true);
      setError("");

      const body = {
        requestNumber:
          form.requestNumber || undefined,
        department: form.department,
        requestedBy: form.requestedBy,
        requestDate: form.requestDate,
        requiredDate:
          form.requiredDate || undefined,
        priority: form.priority,
        status: form.status,
        purpose: form.purpose,
        justification: form.justification,
        notes: form.notes,
        items: validItems.map(
          (item) => ({
            itemName:
              item.itemName,
            description:
              item.description,
            quantity:
              Number(item.quantity || 0),
            unit:
              item.unit,
            estimatedUnitCost:
              Number(
                item.estimatedUnitCost || 0
              ),
            category:
              item.category,
          })
        ),
        totalAmount:
          calculatedTotal,
      };

      if (selectedRequest?.id) {
        await api.put(
          `/finance/purchase-requests/${selectedRequest.id}`,
          body
        );

        setSuccess(
          "Purchase request updated successfully."
        );
      } else {
        await api.post(
          "/finance/purchase-requests",
          body
        );

        setSuccess(
          "Purchase request created successfully."
        );
      }

      setModal(null);
      setSelectedRequest(null);
      setForm(EMPTY_FORM);

      await loadRequests();
    } catch (err) {
      console.error(err);

      setError(
        err?.response?.data?.message ||
          "Unable to save purchase request."
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteRequest = async () => {
    if (!selectedRequest?.id) return;

    try {
      setActionLoading(
        `delete-${selectedRequest.id}`
      );

      setError("");

      await api.delete(
        `/finance/purchase-requests/${selectedRequest.id}`
      );

      setSuccess(
        "Purchase request deleted successfully."
      );

      setModal(null);
      setSelectedRequest(null);

      await loadRequests();
    } catch (err) {
      console.error(err);

      setError(
        err?.response?.data?.message ||
          "Unable to delete purchase request."
      );
    } finally {
      setActionLoading(null);
    }
  };

  const updateStatus = async (
    request,
    nextStatus
  ) => {
    if (!request?.id) return;

    try {
      setActionLoading(
        `${nextStatus}-${request.id}`
      );

      setError("");

      if (
        nextStatus === "Approved"
      ) {
        await api.patch(
          `/finance/purchase-requests/${request.id}/approve`
        );
      } else if (
        nextStatus === "Rejected"
      ) {
        await api.patch(
          `/finance/purchase-requests/${request.id}/reject`
        );
      } else {
        await api.patch(
          `/finance/purchase-requests/${request.id}/status`,
          {
            status: nextStatus,
          }
        );
      }

      setSuccess(
        `Purchase request ${nextStatus.toLowerCase()} successfully.`
      );

      await loadRequests();
    } catch (err) {
      console.error(err);

      setError(
        err?.response?.data?.message ||
          `Unable to change request status to ${nextStatus}.`
      );
    } finally {
      setActionLoading(null);
    }
  };

  const clearFilters = () => {
    setSearch("");
    setStatus("");
    setPriority("");
    setDepartment("");
    setPage(1);
  };

  const hasFilters =
    search ||
    status ||
    priority ||
    department;

  return (
    <div className="purchase-page">
      <style>{`
        * {
          box-sizing: border-box;
        }

        .purchase-page {
          min-height: 100vh;
          padding: 24px;
          background: #f8fafc;
          color: #0f172a;
          font-family:
            Inter,
            ui-sans-serif,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
        }

        .page-container {
          max-width: 1500px;
          margin: 0 auto;
        }

        .page-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 18px;
          margin-bottom: 20px;
        }

        .title-area {
          display: flex;
          gap: 13px;
          align-items: flex-start;
        }

        .title-icon {
          width: 50px;
          height: 50px;
          border-radius: 14px;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          background:
            linear-gradient(
              135deg,
              #0ea5e9,
              #2563eb
            );
          box-shadow:
            0 12px 25px
            rgba(37, 99, 235, .17);
        }

        h1 {
          margin: 0;
          font-size: 27px;
          font-weight: 850;
          letter-spacing: -.03em;
        }

        .subtitle {
          margin: 5px 0 0;
          color: #64748b;
          font-size: 13px;
        }

        .actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .btn {
          min-height: 40px;
          border: 1px solid transparent;
          border-radius: 9px;
          padding: 0 13px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          font-size: 11px;
          font-weight: 800;
          cursor: pointer;
          transition: .2s ease;
          text-decoration: none;
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

        .primary {
          color: white;
          background: #0ea5e9;
        }

        .primary:hover {
          background: #0284c7;
        }

        .secondary {
          color: #334155;
          background: white;
          border-color: #e2e8f0;
        }

        .secondary:hover {
          background: #f8fafc;
        }

        .green {
          color: white;
          background: #16a34a;
        }

        .danger {
          color: white;
          background: #dc2626;
        }

        .alert {
          margin-bottom: 14px;
          padding: 12px 14px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          font-weight: 650;
        }

        .error {
          color: #991b1b;
          background: #fef2f2;
          border: 1px solid #fecaca;
        }

        .success {
          color: #166534;
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
        }

        .summary-grid {
          display: grid;
          grid-template-columns:
            repeat(4, minmax(0, 1fr));
          gap: 13px;
          margin-bottom: 15px;
        }

        .summary-card {
          min-height: 105px;
          padding: 16px;
          border: 1px solid #e2e8f0;
          border-radius: 13px;
          background: white;
          display: flex;
          justify-content: space-between;
          gap: 10px;
          box-shadow:
            0 4px 16px
            rgba(15, 23, 42, .035);
        }

        .summary-title {
          color: #64748b;
          font-size: 9px;
          font-weight: 850;
          text-transform: uppercase;
          letter-spacing: .05em;
        }

        .summary-value {
          margin-top: 8px;
          font-size: 23px;
          font-weight: 850;
        }

        .summary-icon {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .summary-icon.blue {
          color: #2563eb;
          background: #eff6ff;
        }

        .summary-icon.orange {
          color: #ea580c;
          background: #fff7ed;
        }

        .summary-icon.green {
          color: #16a34a;
          background: #f0fdf4;
        }

        .summary-icon.red {
          color: #dc2626;
          background: #fef2f2;
        }

        .filter-card {
          margin-bottom: 15px;
          padding: 14px;
          border: 1px solid #e2e8f0;
          border-radius: 13px;
          background: white;
          box-shadow:
            0 4px 16px
            rgba(15, 23, 42, .035);
        }

        .filter-grid {
          display: grid;
          grid-template-columns:
            2fr repeat(3, 1fr) auto;
          gap: 9px;
          align-items: end;
        }

        .field {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .field label {
          color: #64748b;
          font-size: 9px;
          font-weight: 850;
          text-transform: uppercase;
        }

        .input,
        .select,
        .textarea {
          width: 100%;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          background: white;
          color: #334155;
          font-size: 11px;
          outline: none;
        }

        .input,
        .select {
          height: 39px;
          padding: 0 10px;
        }

        .textarea {
          min-height: 85px;
          padding: 9px 10px;
          resize: vertical;
        }

        .input:focus,
        .select:focus,
        .textarea:focus {
          border-color: #0ea5e9;
          box-shadow:
            0 0 0 3px
            rgba(14, 165, 233, .1);
        }

        .search-wrap {
          position: relative;
        }

        .search-wrap svg {
          position: absolute;
          left: 10px;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
        }

        .search-wrap input {
          padding-left: 34px;
        }

        .table-card {
          border: 1px solid #e2e8f0;
          border-radius: 13px;
          background: white;
          overflow: hidden;
          box-shadow:
            0 4px 16px
            rgba(15, 23, 42, .035);
        }

        .table-top {
          padding: 14px 16px;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .table-title {
          font-size: 13px;
          font-weight: 850;
        }

        .table-info {
          color: #94a3b8;
          font-size: 10px;
        }

        .table-scroll {
          width: 100%;
          overflow-x: auto;
        }

        table {
          width: 100%;
          min-width: 1050px;
          border-collapse: collapse;
        }

        th {
          padding: 11px 13px;
          color: #64748b;
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
          font-size: 9px;
          font-weight: 850;
          text-align: left;
          text-transform: uppercase;
          letter-spacing: .04em;
          white-space: nowrap;
        }

        td {
          padding: 13px;
          border-bottom: 1px solid #f1f5f9;
          color: #334155;
          font-size: 10px;
          vertical-align: middle;
        }

        tbody tr:hover {
          background: #f8fafc;
        }

        .request-number {
          color: #0369a1;
          font-weight: 850;
        }

        .main-text {
          color: #0f172a;
          font-weight: 750;
        }

        .muted {
          margin-top: 3px;
          color: #94a3b8;
          font-size: 9px;
        }

        .badge {
          display: inline-flex;
          align-items: center;
          min-height: 23px;
          padding: 0 8px;
          border-radius: 999px;
          font-size: 8px;
          font-weight: 850;
          white-space: nowrap;
        }

        .badge.approved {
          color: #166534;
          background: #dcfce7;
        }

        .badge.pending {
          color: #92400e;
          background: #fef3c7;
        }

        .badge.rejected {
          color: #991b1b;
          background: #fee2e2;
        }

        .badge.draft {
          color: #475569;
          background: #f1f5f9;
        }

        .badge.urgent {
          color: #991b1b;
          background: #fee2e2;
        }

        .badge.high {
          color: #9a3412;
          background: #ffedd5;
        }

        .badge.normal {
          color: #0369a1;
          background: #e0f2fe;
        }

        .badge.low {
          color: #166534;
          background: #dcfce7;
        }

        .row-actions {
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .icon-btn {
          width: 31px;
          height: 31px;
          border: 1px solid #e2e8f0;
          border-radius: 7px;
          background: white;
          color: #475569;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .icon-btn:hover {
          border-color: #bae6fd;
          color: #0284c7;
          background: #f0f9ff;
        }

        .icon-btn.delete:hover {
          border-color: #fecaca;
          color: #dc2626;
          background: #fef2f2;
        }

        .pagination {
          padding: 13px 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          border-top: 1px solid #e2e8f0;
        }

        .page-text {
          color: #64748b;
          font-size: 10px;
        }

        .page-buttons {
          display: flex;
          gap: 5px;
        }

        .empty {
          padding: 65px 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: #94a3b8;
          text-align: center;
        }

        .empty strong {
          margin-top: 10px;
          color: #475569;
          font-size: 13px;
        }

        .empty span {
          margin-top: 5px;
          font-size: 10px;
        }

        .modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 1000;
          padding: 25px;
          background: rgba(15, 23, 42, .52);
          display: flex;
          align-items: center;
          justify-content: center;
          backdrop-filter: blur(2px);
        }

        .modal {
          width: min(850px, 100%);
          max-height: 92vh;
          overflow-y: auto;
          border-radius: 15px;
          background: white;
          box-shadow:
            0 25px 70px
            rgba(15, 23, 42, .24);
        }

        .modal.small {
          width: min(450px, 100%);
        }

        .modal-header {
          position: sticky;
          top: 0;
          z-index: 2;
          padding: 16px 18px;
          border-bottom: 1px solid #e2e8f0;
          background: white;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .modal-header h2 {
          margin: 0;
          font-size: 16px;
          font-weight: 850;
        }

        .close-btn {
          width: 32px;
          height: 32px;
          border: 0;
          border-radius: 8px;
          background: #f1f5f9;
          color: #64748b;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .modal-body {
          padding: 18px;
        }

        .form-grid {
          display: grid;
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .full {
          grid-column: 1 / -1;
        }

        .items-header {
          margin: 20px 0 10px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .items-header strong {
          font-size: 12px;
        }

        .item-card {
          margin-bottom: 10px;
          padding: 12px;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          background: #f8fafc;
        }

        .item-grid {
          display: grid;
          grid-template-columns:
            2fr 1.3fr .7fr .8fr 1fr 1fr auto;
          gap: 8px;
          align-items: end;
        }

        .item-remove {
          width: 34px;
          height: 39px;
          border: 1px solid #fecaca;
          border-radius: 8px;
          color: #dc2626;
          background: #fff;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .total-box {
          margin-top: 13px;
          padding: 13px;
          border-radius: 9px;
          background: #eff6ff;
          display: flex;
          justify-content: space-between;
          align-items: center;
          color: #1e3a8a;
          font-size: 11px;
          font-weight: 800;
        }

        .total-box strong {
          font-size: 15px;
        }

        .modal-footer {
          padding: 14px 18px;
          border-top: 1px solid #e2e8f0;
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }

        .details-grid {
          display: grid;
          grid-template-columns:
            repeat(2, 1fr);
          gap: 12px;
        }

        .detail {
          padding: 11px;
          border: 1px solid #e2e8f0;
          border-radius: 9px;
        }

        .detail-label {
          color: #94a3b8;
          font-size: 8px;
          font-weight: 850;
          text-transform: uppercase;
        }

        .detail-value {
          margin-top: 5px;
          color: #334155;
          font-size: 11px;
          font-weight: 700;
          word-break: break-word;
        }

        .details-items {
          margin-top: 17px;
        }

        .details-items h3 {
          margin: 0 0 9px;
          font-size: 12px;
        }

        .item-table {
          width: 100%;
          min-width: 0;
        }

        .confirm-icon {
          width: 52px;
          height: 52px;
          margin: 2px auto 12px;
          border-radius: 50%;
          color: #dc2626;
          background: #fef2f2;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .confirm-content {
          padding: 22px;
          text-align: center;
        }

        .confirm-content h3 {
          margin: 0;
          font-size: 17px;
        }

        .confirm-content p {
          margin: 8px 0 0;
          color: #64748b;
          font-size: 11px;
          line-height: 1.6;
        }

        .spinner {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 1100px) {
          .summary-grid {
            grid-template-columns:
              repeat(2, 1fr);
          }

          .filter-grid {
            grid-template-columns:
              repeat(2, 1fr);
          }

          .item-grid {
            grid-template-columns:
              repeat(2, 1fr);
          }
        }

        @media (max-width: 720px) {
          .purchase-page {
            padding: 14px;
          }

          .page-header {
            flex-direction: column;
          }

          .summary-grid {
            grid-template-columns: 1fr;
          }

          .filter-grid {
            grid-template-columns: 1fr;
          }

          .form-grid,
          .details-grid {
            grid-template-columns: 1fr;
          }

          .full {
            grid-column: auto;
          }

          .modal-backdrop {
            padding: 10px;
          }

          .pagination {
            align-items: flex-start;
            flex-direction: column;
          }
        }
      `}</style>

      <div className="page-container">
        <div className="page-header">
          <div className="title-area">
            <div className="title-icon">
              <FilePlus2 size={25} />
            </div>

            <div>
              <h1>Purchase Requests</h1>

              <p className="subtitle">
                Create, review, approve, and manage
                university procurement requests.
              </p>
            </div>
          </div>

          <div className="actions">
            <Link
              to="/finance"
              className="btn secondary"
            >
              Dashboard
            </Link>

            <Link
              to="/finance/purchase-orders"
              className="btn secondary"
            >
              Purchase Orders
            </Link>

            <button
              className="btn secondary"
              onClick={loadRequests}
              disabled={loading}
            >
              <RefreshCw
                size={14}
                className={
                  loading
                    ? "spinner"
                    : ""
                }
              />
              Refresh
            </button>

            <button
              className="btn primary"
              onClick={openCreate}
            >
              <Plus size={15} />
              New Purchase Request
            </button>
          </div>
        </div>

        {error && (
          <div className="alert error">
            <AlertCircle size={16} />
            <span>{error}</span>

            <button
              className="icon-btn"
              style={{
                marginLeft: "auto",
              }}
              onClick={() =>
                setError("")
              }
            >
              <X size={13} />
            </button>
          </div>
        )}

        {success && (
          <div className="alert success">
            <CheckCircle2 size={16} />
            <span>{success}</span>
          </div>
        )}

        <div className="summary-grid">
          <SummaryCard
            icon={Package}
            title="Total Requests"
            value={summary.total || 0}
            tone="blue"
          />

          <SummaryCard
            icon={Clock3}
            title="Pending Review"
            value={summary.pending || 0}
            tone="orange"
          />

          <SummaryCard
            icon={CheckCircle2}
            title="Approved"
            value={summary.approved || 0}
            tone="green"
          />

          <SummaryCard
            icon={XCircle}
            title="Rejected / Cancelled"
            value={summary.rejected || 0}
            tone="red"
          />
        </div>

        <div className="filter-card">
          <div className="filter-grid">
            <div className="field">
              <label>Search</label>

              <div className="search-wrap">
                <Search size={14} />

                <input
                  className="input"
                  placeholder="Request number, requester, department..."
                  value={search}
                  onChange={(event) => {
                    setSearch(
                      event.target.value
                    );
                    setPage(1);
                  }}
                />
              </div>
            </div>

            <div className="field">
              <label>Status</label>

              <select
                className="select"
                value={status}
                onChange={(event) => {
                  setStatus(
                    event.target.value
                  );
                  setPage(1);
                }}
              >
                <option value="">
                  All Statuses
                </option>

                {STATUS_OPTIONS.map(
                  (item) => (
                    <option
                      key={item}
                      value={item}
                    >
                      {item}
                    </option>
                  )
                )}
              </select>
            </div>

            <div className="field">
              <label>Priority</label>

              <select
                className="select"
                value={priority}
                onChange={(event) => {
                  setPriority(
                    event.target.value
                  );
                  setPage(1);
                }}
              >
                <option value="">
                  All Priorities
                </option>

                {PRIORITY_OPTIONS.map(
                  (item) => (
                    <option
                      key={item}
                      value={item}
                    >
                      {item}
                    </option>
                  )
                )}
              </select>
            </div>

            <div className="field">
              <label>Department</label>

              <select
                className="select"
                value={department}
                onChange={(event) => {
                  setDepartment(
                    event.target.value
                  );
                  setPage(1);
                }}
              >
                <option value="">
                  All Departments
                </option>

                {departments.map(
                  (item, index) => {
                    const value =
                      typeof item === "object"
                        ? firstValue(
                            item.id,
                            item.name,
                            item.value
                          )
                        : item;

                    const label =
                      typeof item === "object"
                        ? firstValue(
                            item.name,
                            item.label,
                            item.value,
                            item.id
                          )
                        : item;

                    return (
                      <option
                        key={`${value}-${index}`}
                        value={value}
                      >
                        {label}
                      </option>
                    );
                  }
                )}
              </select>
            </div>

            <button
              className="btn secondary"
              onClick={clearFilters}
              disabled={!hasFilters}
            >
              <Filter size={14} />
              Clear
            </button>
          </div>
        </div>

        <div className="table-card">
          <div className="table-top">
            <div>
              <div className="table-title">
                Purchase Request Register
              </div>

              <div className="table-info">
                {pagination.total || requests.length} records
              </div>
            </div>
          </div>

          {loading ? (
            <div className="empty">
              <RefreshCw
                size={27}
                className="spinner"
              />
              <strong>
                Loading purchase requests...
              </strong>
            </div>
          ) : requests.length === 0 ? (
            <div className="empty">
              <Package size={34} />
              <strong>
                No purchase requests found
              </strong>
              <span>
                Create a purchase request or
                change the filters.
              </span>

              <button
                className="btn primary"
                style={{
                  marginTop: 13,
                }}
                onClick={openCreate}
              >
                <Plus size={14} />
                Create Request
              </button>
            </div>
          ) : (
            <>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Request</th>
                      <th>Department</th>
                      <th>Requested By</th>
                      <th>Request Date</th>
                      <th>Required Date</th>
                      <th>Priority</th>
                      <th>Items</th>
                      <th>Estimated Amount</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {requests.map(
                      (request) => (
                        <tr
                          key={
                            request.id ||
                            request.requestNumber
                          }
                        >
                          <td>
                            <div className="request-number">
                              {request.requestNumber}
                            </div>
                          </td>

                          <td>
                            <div className="main-text">
                              {request.department}
                            </div>
                          </td>

                          <td>
                            <div
                              style={{
                                display: "flex",
                                alignItems:
                                  "center",
                                gap: 5,
                              }}
                            >
                              <User
                                size={12}
                                color="#94a3b8"
                              />
                              {request.requestedBy}
                            </div>
                          </td>

                          <td>
                            {dateDisplay(
                              request.requestDate
                            )}
                          </td>

                          <td>
                            {dateDisplay(
                              request.requiredDate
                            )}
                          </td>

                          <td>
                            <span
                              className={`badge ${priorityClass(
                                request.priority
                              )}`}
                            >
                              {request.priority}
                            </span>
                          </td>

                          <td>
                            {request.items.length}
                          </td>

                          <td>
                            <strong>
                              {money(
                                request.totalAmount
                              )}
                            </strong>
                          </td>

                          <td>
                            <span
                              className={`badge ${statusClass(
                                request.status
                              )}`}
                            >
                              {request.status}
                            </span>
                          </td>

                          <td>
                            <div className="row-actions">
                              <button
                                className="icon-btn"
                                title="View"
                                onClick={() =>
                                  openDetails(
                                    request
                                  )
                                }
                              >
                                <Eye
                                  size={14}
                                />
                              </button>

                              <button
                                className="icon-btn"
                                title="Edit"
                                onClick={() =>
                                  openEdit(
                                    request
                                  )
                                }
                              >
                                <Pencil
                                  size={14}
                                />
                              </button>

                              {String(
                                request.status
                              ).toLowerCase() !==
                                "approved" && (
                                <button
                                  className="icon-btn"
                                  title="Approve"
                                  disabled={
                                    actionLoading ===
                                    `Approved-${request.id}`
                                  }
                                  onClick={() =>
                                    updateStatus(
                                      request,
                                      "Approved"
                                    )
                                  }
                                >
                                  {actionLoading ===
                                  `Approved-${request.id}` ? (
                                    <RefreshCw
                                      size={13}
                                      className="spinner"
                                    />
                                  ) : (
                                    <CheckCircle2
                                      size={14}
                                    />
                                  )}
                                </button>
                              )}

                              {[
                                "pending",
                                "submitted",
                                "under review",
                              ].includes(
                                String(
                                  request.status
                                ).toLowerCase()
                              ) && (
                                <button
                                  className="icon-btn"
                                  title="Reject"
                                  disabled={
                                    actionLoading ===
                                    `Rejected-${request.id}`
                                  }
                                  onClick={() =>
                                    updateStatus(
                                      request,
                                      "Rejected"
                                    )
                                  }
                                >
                                  <XCircle
                                    size={14}
                                  />
                                </button>
                              )}

                              <button
                                className="icon-btn delete"
                                title="Delete"
                                onClick={() =>
                                  openDelete(
                                    request
                                  )
                                }
                              >
                                <Trash2
                                  size={14}
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
                <div className="page-text">
                  Page{" "}
                  {pagination.page || page}{" "}
                  of{" "}
                  {Math.max(
                    1,
                    pagination.pages || 1
                  )}
                </div>

                <div className="page-buttons">
                  <button
                    className="icon-btn"
                    disabled={
                      page <= 1 ||
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
                      size={15}
                    />
                  </button>

                  <button
                    className="icon-btn"
                    disabled={
                      page >=
                        Math.max(
                          1,
                          pagination.pages ||
                            1
                        ) ||
                      loading
                    }
                    onClick={() =>
                      setPage(
                        (current) =>
                          current + 1
                      )
                    }
                  >
                    <ChevronRight
                      size={15}
                    />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {modal === "form" && (
        <div className="modal-backdrop">
          <div className="modal">
            <form onSubmit={saveRequest}>
              <div className="modal-header">
                <h2>
                  {selectedRequest
                    ? "Edit Purchase Request"
                    : "New Purchase Request"}
                </h2>

                <button
                  type="button"
                  className="close-btn"
                  onClick={() =>
                    setModal(null)
                  }
                >
                  <X size={16} />
                </button>
              </div>

              <div className="modal-body">
                <div className="form-grid">
                  <div className="field">
                    <label>
                      Request Number
                    </label>

                    <input
                      className="input"
                      value={
                        form.requestNumber
                      }
                      onChange={(event) =>
                        updateForm(
                          "requestNumber",
                          event.target.value
                        )
                      }
                      placeholder="Auto generated if empty"
                    />
                  </div>

                  <div className="field">
                    <label>
                      Department *
                    </label>

                    <select
                      className="select"
                      value={
                        form.department
                      }
                      onChange={(event) =>
                        updateForm(
                          "department",
                          event.target.value
                        )
                      }
                    >
                      <option value="">
                        Select Department
                      </option>

                      {departments.map(
                        (item, index) => {
                          const value =
                            typeof item ===
                            "object"
                              ? firstValue(
                                  item.id,
                                  item.name,
                                  item.value
                                )
                              : item;

                          const label =
                            typeof item ===
                            "object"
                              ? firstValue(
                                  item.name,
                                  item.label,
                                  item.value,
                                  item.id
                                )
                              : item;

                          return (
                            <option
                              key={`${value}-${index}`}
                              value={value}
                            >
                              {label}
                            </option>
                          );
                        }
                      )}
                    </select>
                  </div>

                  <div className="field">
                    <label>
                      Requested By *
                    </label>

                    <input
                      className="input"
                      value={
                        form.requestedBy
                      }
                      onChange={(event) =>
                        updateForm(
                          "requestedBy",
                          event.target.value
                        )
                      }
                      placeholder="Requester name or user ID"
                    />
                  </div>

                  <div className="field">
                    <label>
                      Request Date *
                    </label>

                    <input
                      type="date"
                      className="input"
                      value={
                        form.requestDate
                      }
                      onChange={(event) =>
                        updateForm(
                          "requestDate",
                          event.target.value
                        )
                      }
                    />
                  </div>

                  <div className="field">
                    <label>
                      Required Date
                    </label>

                    <input
                      type="date"
                      className="input"
                      value={
                        form.requiredDate
                      }
                      onChange={(event) =>
                        updateForm(
                          "requiredDate",
                          event.target.value
                        )
                      }
                    />
                  </div>

                  <div className="field">
                    <label>
                      Priority
                    </label>

                    <select
                      className="select"
                      value={
                        form.priority
                      }
                      onChange={(event) =>
                        updateForm(
                          "priority",
                          event.target.value
                        )
                      }
                    >
                      {PRIORITY_OPTIONS.map(
                        (item) => (
                          <option
                            key={item}
                            value={item}
                          >
                            {item}
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  <div className="field">
                    <label>
                      Status
                    </label>

                    <select
                      className="select"
                      value={
                        form.status
                      }
                      onChange={(event) =>
                        updateForm(
                          "status",
                          event.target.value
                        )
                      }
                    >
                      {STATUS_OPTIONS.map(
                        (item) => (
                          <option
                            key={item}
                            value={item}
                          >
                            {item}
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  <div className="field full">
                    <label>
                      Purpose
                    </label>

                    <input
                      className="input"
                      value={
                        form.purpose
                      }
                      onChange={(event) =>
                        updateForm(
                          "purpose",
                          event.target.value
                        )
                      }
                      placeholder="Purpose of the purchase"
                    />
                  </div>

                  <div className="field full">
                    <label>
                      Justification
                    </label>

                    <textarea
                      className="textarea"
                      value={
                        form.justification
                      }
                      onChange={(event) =>
                        updateForm(
                          "justification",
                          event.target.value
                        )
                      }
                      placeholder="Explain why this purchase is required..."
                    />
                  </div>
                </div>

                <div className="items-header">
                  <strong>
                    Requested Items
                  </strong>

                  <button
                    type="button"
                    className="btn secondary"
                    onClick={addItem}
                  >
                    <Plus size={13} />
                    Add Item
                  </button>
                </div>

                {form.items.map(
                  (item, index) => (
                    <div
                      className="item-card"
                      key={index}
                    >
                      <div className="item-grid">
                        <div className="field">
                          <label>
                            Item Name *
                          </label>

                          <input
                            className="input"
                            value={
                              item.itemName
                            }
                            onChange={(
                              event
                            ) =>
                              updateItem(
                                index,
                                "itemName",
                                event.target
                                  .value
                              )
                            }
                            placeholder="Item"
                          />
                        </div>

                        <div className="field">
                          <label>
                            Category
                          </label>

                          <select
                            className="select"
                            value={
                              item.category
                            }
                            onChange={(
                              event
                            ) =>
                              updateItem(
                                index,
                                "category",
                                event.target
                                  .value
                              )
                            }
                          >
                            <option value="">
                              Select
                            </option>

                            {categories.map(
                              (
                                category,
                                categoryIndex
                              ) => {
                                const value =
                                  typeof category ===
                                  "object"
                                    ? firstValue(
                                        category.id,
                                        category.name,
                                        category.value
                                      )
                                    : category;

                                const label =
                                  typeof category ===
                                  "object"
                                    ? firstValue(
                                        category.name,
                                        category.label,
                                        category.value
                                      )
                                    : category;

                                return (
                                  <option
                                    key={`${value}-${categoryIndex}`}
                                    value={
                                      value
                                    }
                                  >
                                    {label}
                                  </option>
                                );
                              }
                            )}
                          </select>
                        </div>

                        <div className="field">
                          <label>
                            Quantity
                          </label>

                          <input
                            type="number"
                            min="0"
                            className="input"
                            value={
                              item.quantity
                            }
                            onChange={(
                              event
                            ) =>
                              updateItem(
                                index,
                                "quantity",
                                event.target
                                  .value
                              )
                            }
                          />
                        </div>

                        <div className="field">
                          <label>
                            Unit
                          </label>

                          <input
                            className="input"
                            value={
                              item.unit
                            }
                            onChange={(
                              event
                            ) =>
                              updateItem(
                                index,
                                "unit",
                                event.target
                                  .value
                              )
                            }
                            placeholder="pcs"
                          />
                        </div>

                        <div className="field">
                          <label>
                            Unit Cost
                          </label>

                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="input"
                            value={
                              item.estimatedUnitCost
                            }
                            onChange={(
                              event
                            ) =>
                              updateItem(
                                index,
                                "estimatedUnitCost",
                                event.target
                                  .value
                              )
                            }
                            placeholder="0.00"
                          />
                        </div>

                        <div className="field">
                          <label>
                            Description
                          </label>

                          <input
                            className="input"
                            value={
                              item.description
                            }
                            onChange={(
                              event
                            ) =>
                              updateItem(
                                index,
                                "description",
                                event.target
                                  .value
                              )
                            }
                            placeholder="Details"
                          />
                        </div>

                        <button
                          type="button"
                          className="item-remove"
                          onClick={() =>
                            removeItem(
                              index
                            )
                          }
                          disabled={
                            form.items
                              .length === 1
                          }
                        >
                          <Trash2
                            size={14}
                          />
                        </button>
                      </div>
                    </div>
                  )
                )}

                <div className="total-box">
                  <span>
                    Estimated Request Total
                  </span>

                  <strong>
                    {money(
                      calculatedTotal
                    )}
                  </strong>
                </div>

                <div
                  className="field"
                  style={{
                    marginTop: 13,
                  }}
                >
                  <label>
                    Notes
                  </label>

                  <textarea
                    className="textarea"
                    value={form.notes}
                    onChange={(event) =>
                      updateForm(
                        "notes",
                        event.target.value
                      )
                    }
                    placeholder="Additional notes..."
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() =>
                    setModal(null)
                  }
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="btn primary"
                  disabled={saving}
                >
                  {saving ? (
                    <RefreshCw
                      size={14}
                      className="spinner"
                    />
                  ) : (
                    <Send size={14} />
                  )}

                  {selectedRequest
                    ? "Update Request"
                    : "Save Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal === "details" &&
        selectedRequest && (
          <div className="modal-backdrop">
            <div className="modal">
              <div className="modal-header">
                <h2>
                  Purchase Request Details
                </h2>

                <button
                  className="close-btn"
                  onClick={() =>
                    setModal(null)
                  }
                >
                  <X size={16} />
                </button>
              </div>

              <div className="modal-body">
                <div className="details-grid">
                  <div className="detail">
                    <div className="detail-label">
                      Request Number
                    </div>

                    <div className="detail-value">
                      {
                        selectedRequest.requestNumber
                      }
                    </div>
                  </div>

                  <div className="detail">
                    <div className="detail-label">
                      Status
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

                  <div className="detail">
                    <div className="detail-label">
                      Department
                    </div>

                    <div className="detail-value">
                      {
                        selectedRequest.department
                      }
                    </div>
                  </div>

                  <div className="detail">
                    <div className="detail-label">
                      Requested By
                    </div>

                    <div className="detail-value">
                      {
                        selectedRequest.requestedBy
                      }
                    </div>
                  </div>

                  <div className="detail">
                    <div className="detail-label">
                      Request Date
                    </div>

                    <div className="detail-value">
                      {dateDisplay(
                        selectedRequest.requestDate
                      )}
                    </div>
                  </div>

                  <div className="detail">
                    <div className="detail-label">
                      Required Date
                    </div>

                    <div className="detail-value">
                      {dateDisplay(
                        selectedRequest.requiredDate
                      )}
                    </div>
                  </div>

                  <div className="detail">
                    <div className="detail-label">
                      Priority
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

                  <div className="detail">
                    <div className="detail-label">
                      Estimated Total
                    </div>

                    <div className="detail-value">
                      {money(
                        selectedRequest.totalAmount
                      )}
                    </div>
                  </div>

                  <div className="detail full">
                    <div className="detail-label">
                      Purpose
                    </div>

                    <div className="detail-value">
                      {selectedRequest.purpose ||
                        "—"}
                    </div>
                  </div>

                  <div className="detail full">
                    <div className="detail-label">
                      Justification
                    </div>

                    <div className="detail-value">
                      {
                        selectedRequest.justification ||
                        "—"
                      }
                    </div>
                  </div>

                  <div className="detail full">
                    <div className="detail-label">
                      Notes
                    </div>

                    <div className="detail-value">
                      {selectedRequest.notes ||
                        "—"}
                    </div>
                  </div>
                </div>

                <div className="details-items">
                  <h3>
                    Requested Items
                  </h3>

                  {selectedRequest.items.length ? (
                    <div className="table-scroll">
                      <table className="item-table">
                        <thead>
                          <tr>
                            <th>
                              Item
                            </th>
                            <th>
                              Category
                            </th>
                            <th>
                              Quantity
                            </th>
                            <th>
                              Unit
                            </th>
                            <th>
                              Unit Cost
                            </th>
                            <th>
                              Total
                            </th>
                          </tr>
                        </thead>

                        <tbody>
                          {selectedRequest.items.map(
                            (item, index) => (
                              <tr
                                key={index}
                              >
                                <td>
                                  {
                                    item.itemName
                                  }
                                </td>
                                <td>
                                  {
                                    item.category ||
                                    "—"
                                  }
                                </td>
                                <td>
                                  {
                                    item.quantity
                                  }
                                </td>
                                <td>
                                  {
                                    item.unit
                                  }
                                </td>
                                <td>
                                  {money(
                                    item.estimatedUnitCost
                                  )}
                                </td>
                                <td>
                                  {money(
                                    Number(
                                      item.quantity ||
                                        0
                                    ) *
                                      Number(
                                        item.estimatedUnitCost ||
                                          0
                                      )
                                  )}
                                </td>
                              </tr>
                            )
                          )}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="empty">
                      <Package size={26} />
                      <span>
                        No item details available.
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="modal-footer">
                <button
                  className="btn secondary"
                  onClick={() =>
                    setModal(null)
                  }
                >
                  Close
                </button>

                <button
                  className="btn primary"
                  onClick={() =>
                    openEdit(
                      selectedRequest
                    )
                  }
                >
                  <Pencil size={13} />
                  Edit
                </button>
              </div>
            </div>
          </div>
        )}

      {modal === "delete" &&
        selectedRequest && (
          <div className="modal-backdrop">
            <div className="modal small">
              <div className="confirm-content">
                <div className="confirm-icon">
                  <Trash2 size={22} />
                </div>

                <h3>
                  Delete Purchase Request?
                </h3>

                <p>
                  This will permanently delete request{" "}
                  <strong>
                    {
                      selectedRequest.requestNumber
                    }
                  </strong>
                  . This action cannot be undone.
                </p>
              </div>

              <div className="modal-footer">
                <button
                  className="btn secondary"
                  onClick={() =>
                    setModal(null)
                  }
                  disabled={Boolean(
                    actionLoading
                  )}
                >
                  Cancel
                </button>

                <button
                  className="btn danger"
                  onClick={deleteRequest}
                  disabled={Boolean(
                    actionLoading
                  )}
                >
                  {actionLoading ? (
                    <RefreshCw
                      size={14}
                      className="spinner"
                    />
                  ) : (
                    <Trash2 size={14} />
                  )}

                  Delete Request
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
