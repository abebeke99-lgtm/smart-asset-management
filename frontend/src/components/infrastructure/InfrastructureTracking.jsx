import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import {
  Activity,
  AlertCircle,
  BarChart3,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Edit3,
  Eye,
  Filter,
  History,
  Loader2,
  MapPin,
  Plus,
  QrCode,
  Radio,
  RefreshCw,
  Search,
  Trash2,
  User,
  X,
  XCircle,
} from "lucide-react";

const INITIAL_FORM = {
  assetId: "",
  assetTag: "",
  assetName: "",
  tagType: "QR",
  tagCode: "",
  rfidUid: "",
  location: "",
  assignedTo: "",
  status: "Active",
  condition: "Good",
  lastScannedAt: "",
  lastScannedLocation: "",
  description: "",
  remarks: "",
};

const TAG_TYPES = ["QR", "RFID", "QR + RFID"];

const STATUS_OPTIONS = [
  "Active",
  "Inactive",
  "Lost",
  "Damaged",
  "Replaced",
];

const CONDITION_OPTIONS = [
  "Excellent",
  "Good",
  "Fair",
  "Poor",
  "Critical",
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
    meta?.limit ||
      meta?.pageSize ||
      meta?.perPage ||
      10
  );

  return {
    page: Number(meta?.page || 1),
    limit,
    total,
    totalPages: Number(
      meta?.totalPages ||
        Math.ceil(total / limit) ||
        1
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

function normalizeTracking(row) {
  return {
    id:
      row.id ??
      row._id ??
      row.tracking_id ??
      row.tag_id,

    assetId:
      firstValue(
        row.assetId,
        row.asset_id,
        row.assetID
      ) || "—",

    assetTag:
      firstValue(
        row.assetTag,
        row.asset_tag,
        row.tag,
        row.tagNumber,
        row.tag_number
      ) || "—",

    assetName:
      firstValue(
        row.assetName,
        row.asset_name,
        row.name,
        row.asset?.name
      ) || "Unnamed Asset",

    tagType:
      firstValue(
        row.tagType,
        row.tag_type,
        row.type
      ) || "QR",

    tagCode:
      firstValue(
        row.tagCode,
        row.tag_code,
        row.qrCode,
        row.qr_code,
        row.code
      ) || "—",

    rfidUid:
      firstValue(
        row.rfidUid,
        row.rfid_uid,
        row.rfidUID,
        row.uid
      ) || "—",

    location:
      firstValue(
        row.location,
        row.locationName,
        row.location_name,
        row.currentLocation,
        row.current_location
      ) || "—",

    assignedTo:
      firstValue(
        row.assignedTo,
        row.assigned_to,
        row.assignee,
        row.assigneeName,
        row.assignee_name
      ) || "Unassigned",

    status:
      firstValue(
        row.status,
        row.tagStatus,
        row.tag_status
      ) || "Active",

    condition:
      firstValue(
        row.condition,
        row.tagCondition,
        row.tag_condition
      ) || "Good",

    lastScannedAt:
      firstValue(
        row.lastScannedAt,
        row.last_scanned_at,
        row.lastScanAt,
        row.last_scan_at,
        row.scannedAt,
        row.scanned_at
      ) || "",

    lastScannedLocation:
      firstValue(
        row.lastScannedLocation,
        row.last_scanned_location,
        row.scanLocation,
        row.scan_location
      ) || "—",

    description:
      firstValue(
        row.description,
        row.details
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

function formatDateTime(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString();
}

function getStatusClass(status) {
  const value = String(status || "").toLowerCase();

  if (
    value.includes("lost") ||
    value.includes("damaged") ||
    value.includes("inactive")
  ) {
    return "danger";
  }

  if (value.includes("replaced")) {
    return "warning";
  }

  if (value.includes("active")) {
    return "success";
  }

  return "default";
}

function getConditionClass(condition) {
  const value = String(condition || "").toLowerCase();

  if (value.includes("critical")) return "danger";
  if (value.includes("poor")) return "warning";
  if (value.includes("fair")) return "warning";
  if (
    value.includes("excellent") ||
    value.includes("good")
  ) {
    return "success";
  }

  return "default";
}

export default function InfrastructureTracking() {
  const [records, setRecords] = useState([]);
  const [summaryFromApi, setSummaryFromApi] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [tagTypeFilter, setTagTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
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

  const [editingRecord, setEditingRecord] = useState(null);
  const [selectedRecord, setSelectedRecord] = useState(null);

  const [form, setForm] = useState(INITIAL_FORM);

  const fetchTracking = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get(
        "/infrastructure/tracking",
        {
          params: {
            page,
            limit,
            search: search.trim() || undefined,
            tagType:
              tagTypeFilter || undefined,
            type:
              tagTypeFilter || undefined,
            status:
              statusFilter || undefined,
            location:
              locationFilter || undefined,
          },
        }
      );

      const rows = extractRows(response).map(
        normalizeTracking
      );

      setRecords(rows);

      const serverPagination =
        extractPagination(response, rows.length);

      setPagination({
        page: serverPagination.page || page,
        limit: serverPagination.limit || limit,
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
        "Failed to load RFID/QR tracking:",
        err
      );

      setError(
        err?.response?.data?.message ||
          "Unable to load RFID/QR tracking records."
      );

      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [
    page,
    limit,
    search,
    tagTypeFilter,
    statusFilter,
    locationFilter,
  ]);

  useEffect(() => {
    fetchTracking();
  }, [fetchTracking]);

  useEffect(() => {
    if (!success) return;

    const timer = setTimeout(() => {
      setSuccess("");
    }, 3500);

    return () => clearTimeout(timer);
  }, [success]);

  const calculatedSummary = useMemo(() => {
    const total = Number(
      pagination.total || records.length
    );

    const active = records.filter(
      (item) =>
        String(item.status).toLowerCase() === "active"
    ).length;

    const qr = records.filter((item) =>
      String(item.tagType)
        .toLowerCase()
        .includes("qr")
    ).length;

    const rfid = records.filter((item) =>
      String(item.tagType)
        .toLowerCase()
        .includes("rfid")
    ).length;

    const lost = records.filter((item) =>
      String(item.status)
        .toLowerCase()
        .includes("lost")
    ).length;

    const damaged = records.filter((item) =>
      String(item.status)
        .toLowerCase()
        .includes("damaged")
    ).length;

    const critical = records.filter((item) =>
      String(item.condition)
        .toLowerCase()
        .includes("critical")
    ).length;

    return {
      total,
      active,
      qr,
      rfid,
      lost,
      damaged,
      critical,
    };
  }, [records, pagination.total]);

  const summary = {
    total: Number(
      firstValue(
        summaryFromApi?.total,
        summaryFromApi?.totalRecords,
        calculatedSummary.total
      )
    ),

    active: Number(
      firstValue(
        summaryFromApi?.active,
        summaryFromApi?.activeTags,
        calculatedSummary.active
      )
    ),

    qr: Number(
      firstValue(
        summaryFromApi?.qr,
        summaryFromApi?.qrTags,
        summaryFromApi?.qrCount,
        calculatedSummary.qr
      )
    ),

    rfid: Number(
      firstValue(
        summaryFromApi?.rfid,
        summaryFromApi?.rfidTags,
        summaryFromApi?.rfidCount,
        calculatedSummary.rfid
      )
    ),

    lost: Number(
      firstValue(
        summaryFromApi?.lost,
        summaryFromApi?.lostTags,
        calculatedSummary.lost
      )
    ),

    critical: Number(
      firstValue(
        summaryFromApi?.critical,
        summaryFromApi?.criticalCondition,
        calculatedSummary.critical
      )
    ),
  };

  const resetForm = () => {
    setForm(INITIAL_FORM);
    setEditingRecord(null);
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (record) => {
    setEditingRecord(record);

    setForm({
      assetId:
        record.assetId === "—"
          ? ""
          : record.assetId,

      assetTag:
        record.assetTag === "—"
          ? ""
          : record.assetTag,

      assetName:
        record.assetName === "Unnamed Asset"
          ? ""
          : record.assetName,

      tagType:
        record.tagType || "QR",

      tagCode:
        record.tagCode === "—"
          ? ""
          : record.tagCode,

      rfidUid:
        record.rfidUid === "—"
          ? ""
          : record.rfidUid,

      location:
        record.location === "—"
          ? ""
          : record.location,

      assignedTo:
        record.assignedTo === "Unassigned"
          ? ""
          : record.assignedTo,

      status:
        record.status || "Active",

      condition:
        record.condition || "Good",

      lastScannedAt:
        record.lastScannedAt || "",

      lastScannedLocation:
        record.lastScannedLocation === "—"
          ? ""
          : record.lastScannedLocation,

      description:
        record.description || "",

      remarks:
        record.remarks || "",
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

    if (!form.assetName.trim()) {
      setError("Asset name is required.");
      return;
    }

    if (
      !form.tagCode.trim() &&
      !form.rfidUid.trim()
    ) {
      setError(
        "Enter a QR/tag code or RFID UID."
      );
      return;
    }

    try {
      setSaving(true);
      setError("");

      const payload = {
        assetId:
          form.assetId.trim() || undefined,

        assetTag:
          form.assetTag.trim() || undefined,

        assetName:
          form.assetName.trim(),

        tagType:
          form.tagType,

        tagCode:
          form.tagCode.trim() || undefined,

        rfidUid:
          form.rfidUid.trim() || undefined,

        location:
          form.location.trim() || undefined,

        assignedTo:
          form.assignedTo.trim() || undefined,

        status:
          form.status,

        condition:
          form.condition,

        lastScannedAt:
          form.lastScannedAt || undefined,

        lastScannedLocation:
          form.lastScannedLocation.trim() ||
          undefined,

        description:
          form.description.trim() || undefined,

        remarks:
          form.remarks.trim() || undefined,
      };

      if (editingRecord?.id) {
        await api.put(
          `/infrastructure/tracking/${editingRecord.id}`,
          payload
        );

        setSuccess(
          "Tracking record updated successfully."
        );
      } else {
        await api.post(
          "/infrastructure/tracking",
          payload
        );

        setSuccess(
          "Tracking record created successfully."
        );
      }

      setShowModal(false);
      resetForm();

      await fetchTracking();
    } catch (err) {
      console.error(
        "Failed to save tracking record:",
        err
      );

      setError(
        err?.response?.data?.message ||
          "Unable to save the tracking record."
      );
    } finally {
      setSaving(false);
    }
  };

  const openDeleteDialog = (record) => {
    setSelectedRecord(record);
    setShowDelete(true);
  };

  const handleDelete = async () => {
    if (!selectedRecord?.id) return;

    try {
      setDeleting(true);
      setError("");

      await api.delete(
        `/infrastructure/tracking/${selectedRecord.id}`
      );

      setSuccess(
        "Tracking record deleted successfully."
      );

      setShowDelete(false);
      setSelectedRecord(null);

      if (records.length === 1 && page > 1) {
        setPage((current) => current - 1);
      } else {
        await fetchTracking();
      }
    } catch (err) {
      console.error(
        "Failed to delete tracking record:",
        err
      );

      setError(
        err?.response?.data?.message ||
          "Unable to delete the tracking record."
      );
    } finally {
      setDeleting(false);
    }
  };

  const openDetails = (record) => {
    setSelectedRecord(record);
    setShowDetails(true);
  };

  const clearFilters = () => {
    setSearch("");
    setTagTypeFilter("");
    setStatusFilter("");
    setLocationFilter("");
    setPage(1);
  };

  const canPrevious = page > 1;

  const canNext =
    page <
    Math.max(
      1,
      pagination.totalPages
    );

  return (
    <div className="tracking-page">
      <style>{`
        * {
          box-sizing: border-box;
        }

        .tracking-page {
          min-height: 100vh;
          background: #f8fafc;
          color: #0f172a;
          font-family: Inter, ui-sans-serif, system-ui,
            -apple-system, BlinkMacSystemFont, "Segoe UI",
            sans-serif;
          padding: 24px;
        }

        .tracking-container {
          max-width: 1600px;
          margin: 0 auto;
        }

        .page-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 24px;
        }

        .header-left {
          display: flex;
          gap: 14px;
          align-items: flex-start;
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
            rgba(37, 99, 235, 0.18);
        }

        .page-header h1 {
          margin: 0 0 5px;
          font-size: 27px;
          font-weight: 800;
          letter-spacing: -0.02em;
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
          white-space: nowrap;
          transition: 0.2s ease;
        }

        .btn:hover {
          transform: translateY(-1px);
        }

        .btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
          transform: none;
        }

        .btn-primary {
          background: #0ea5e9;
          color: white;
          box-shadow:
            0 8px 20px
            rgba(14, 165, 233, 0.2);
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

        .btn-danger {
          background: #dc2626;
          color: white;
        }

        .btn-danger:hover {
          background: #b91c1c;
        }

        .summary-grid {
          display: grid;
          grid-template-columns:
            repeat(5, minmax(0, 1fr));
          gap: 16px;
          margin-bottom: 20px;
        }

        .summary-card {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 15px;
          padding: 18px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          box-shadow:
            0 4px 18px
            rgba(15, 23, 42, 0.035);
        }

        .summary-label {
          color: #64748b;
          font-size: 11px;
          font-weight: 800;
          margin-bottom: 7px;
        }

        .summary-value {
          font-size: 25px;
          line-height: 1;
          font-weight: 800;
        }

        .summary-icon {
          width: 42px;
          height: 42px;
          border-radius: 12px;
          background: #eff6ff;
          color: #2563eb;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .summary-card.success
          .summary-icon {
          background: #f0fdf4;
          color: #16a34a;
        }

        .summary-card.warning
          .summary-icon {
          background: #fffbeb;
          color: #d97706;
        }

        .summary-card.danger
          .summary-icon {
          background: #fef2f2;
          color: #dc2626;
        }

        .summary-card.purple
          .summary-icon {
          background: #f5f3ff;
          color: #7c3aed;
        }

        .toolbar {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 15px;
          padding: 15px;
          margin-bottom: 18px;
          box-shadow:
            0 4px 18px
            rgba(15, 23, 42, 0.035);
        }

        .toolbar-row {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
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
          padding: 0 13px 0 39px;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          outline: none;
          font-size: 13px;
        }

        .filter-select {
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

        .search-box input:focus,
        .filter-select:focus,
        .form-input:focus,
        .form-select:focus,
        .form-textarea:focus {
          border-color: #0ea5e9;
          box-shadow:
            0 0 0 3px
            rgba(14, 165, 233, 0.1);
        }

        .table-card {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 15px;
          overflow: hidden;
          box-shadow:
            0 4px 18px
            rgba(15, 23, 42, 0.035);
        }

        .table-header {
          padding: 16px 18px;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }

        .table-title {
          font-size: 15px;
          font-weight: 800;
        }

        .table-subtitle {
          margin-top: 3px;
          font-size: 12px;
          color: #64748b;
        }

        .table-wrapper {
          overflow-x: auto;
        }

        table {
          width: 100%;
          min-width: 1300px;
          border-collapse: collapse;
        }

        th {
          padding: 13px 15px;
          text-align: left;
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
          color: #64748b;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.04em;
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

        .asset-cell {
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .asset-icon {
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

        .tag-icon {
          width: 31px;
          height: 31px;
          border-radius: 8px;
          background: #f0f9ff;
          color: #0284c7;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 25px;
          padding: 0 9px;
          border-radius: 999px;
          font-size: 11px;
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
          width: 34px;
          height: 34px;
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
          font-size: 12px;
          color: #64748b;
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
          color: #475569;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .page-btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .page-number {
          min-width: 42px;
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
          display: flex;
          align-items: center;
          justify-content: center;
          color: #64748b;
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
          background: rgba(15, 23, 42, 0.58);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .modal {
          width: min(920px, 100%);
          max-height: 92vh;
          overflow-y: auto;
          background: white;
          border-radius: 18px;
          box-shadow:
            0 25px 80px
            rgba(15, 23, 42, 0.25);
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
          gap: 12px;
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
          font-size: 12px;
          font-weight: 800;
          color: #334155;
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
          font-size: 10px;
          color: #64748b;
          font-weight: 800;
          margin-bottom: 5px;
        }

        .detail-value {
          font-size: 13px;
          color: #0f172a;
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

        .confirm-content strong {
          color: #334155;
        }

        .confirm-footer {
          justify-content: center;
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

        @media (max-width: 1200px) {
          .summary-grid {
            grid-template-columns:
              repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 800px) {
          .tracking-page {
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

          .search-box {
            min-width: 100%;
          }

          .filter-select,
          .toolbar-row .btn {
            width: 100%;
          }

          .page-header h1 {
            font-size: 23px;
          }
        }
      `}</style>

      <div className="tracking-container">
        <div className="page-header">
          <div className="header-left">
            <div className="header-icon">
              <Radio size={25} />
            </div>

            <div>
              <h1>RFID / QR Tracking</h1>
              <p>
                Register, monitor, search, and track
                infrastructure assets using RFID and
                QR identification.
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
              to="/infrastructure/assets"
              className="btn btn-secondary"
            >
              <ClipboardList size={16} />
              Assets
            </Link>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={fetchTracking}
              disabled={loading}
            >
              <RefreshCw
                size={16}
                className={
                  loading ? "loading-icon" : ""
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
              Register Tag
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
                TOTAL TAGS
              </div>
              <div className="summary-value">
                {summary.total}
              </div>
            </div>

            <div className="summary-icon">
              <Radio size={20} />
            </div>
          </div>

          <div className="summary-card success">
            <div>
              <div className="summary-label">
                ACTIVE
              </div>
              <div className="summary-value">
                {summary.active}
              </div>
            </div>

            <div className="summary-icon">
              <CheckCircle2 size={20} />
            </div>
          </div>

          <div className="summary-card">
            <div>
              <div className="summary-label">
                QR TAGS
              </div>
              <div className="summary-value">
                {summary.qr}
              </div>
            </div>

            <div className="summary-icon">
              <QrCode size={20} />
            </div>
          </div>

          <div className="summary-card purple">
            <div>
              <div className="summary-label">
                RFID TAGS
              </div>
              <div className="summary-value">
                {summary.rfid}
              </div>
            </div>

            <div className="summary-icon">
              <Radio size={20} />
            </div>
          </div>

          <div className="summary-card danger">
            <div>
              <div className="summary-label">
                CRITICAL
              </div>
              <div className="summary-value">
                {summary.critical}
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
                placeholder="Search asset, tag code, RFID UID, location..."
              />
            </div>

            <select
              className="filter-select"
              value={tagTypeFilter}
              onChange={(event) => {
                setTagTypeFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="">
                All Tag Types
              </option>

              {TAG_TYPES.map((type) => (
                <option
                  key={type}
                  value={type}
                >
                  {type}
                </option>
              ))}
            </select>

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

              {STATUS_OPTIONS.map((status) => (
                <option
                  key={status}
                  value={status}
                >
                  {status}
                </option>
              ))}
            </select>

            <input
              className="filter-select"
              value={locationFilter}
              onChange={(event) => {
                setLocationFilter(event.target.value);
                setPage(1);
              }}
              placeholder="Location"
            />

            {(search ||
              tagTypeFilter ||
              statusFilter ||
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
                Asset Tracking Registry
              </div>

              <div className="table-subtitle">
                RFID and QR identification records
                connected to infrastructure assets.
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
                Loading tracking records...
              </div>
            </div>
          ) : records.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                <Radio size={23} />
              </div>

              <div className="primary-text">
                No RFID / QR tracking records found
              </div>

              <div className="secondary-text">
                {search ||
                tagTypeFilter ||
                statusFilter ||
                locationFilter
                  ? "Try changing the search or filters."
                  : "Register the first asset tracking tag to get started."}
              </div>

              {!search &&
                !tagTypeFilter &&
                !statusFilter &&
                !locationFilter && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ marginTop: 16 }}
                    onClick={openCreateModal}
                  >
                    <Plus size={16} />
                    Register Tag
                  </button>
                )}
            </div>
          ) : (
            <>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Asset</th>
                      <th>Tag Type</th>
                      <th>Tag / RFID ID</th>
                      <th>Location</th>
                      <th>Assigned To</th>
                      <th>Last Scan</th>
                      <th>Scan Location</th>
                      <th>Status</th>
                      <th>Condition</th>
                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {records.map((record) => (
                      <tr key={record.id}>
                        <td>
                          <div className="asset-cell">
                            <div className="asset-icon">
                              {String(
                                record.tagType
                              )
                                .toLowerCase()
                                .includes("rfid") ? (
                                <Radio size={16} />
                              ) : (
                                <QrCode size={16} />
                              )}
                            </div>

                            <div>
                              <div className="primary-text">
                                {record.assetName}
                              </div>

                              <div className="secondary-text">
                                Asset:{" "}
                                {record.assetTag}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td>
                          <div className="tag-icon">
                            {String(
                              record.tagType
                            )
                              .toLowerCase()
                              .includes("rfid") ? (
                              <Radio size={15} />
                            ) : (
                              <QrCode size={15} />
                            )}
                          </div>

                          <div className="secondary-text">
                            {record.tagType}
                          </div>
                        </td>

                        <td>
                          <div className="primary-text">
                            {record.tagCode}
                          </div>

                          <div className="secondary-text">
                            RFID: {record.rfidUid}
                          </div>
                        </td>

                        <td>
                          <div className="asset-cell">
                            <MapPin
                              size={15}
                              color="#64748b"
                            />
                            <span>
                              {record.location}
                            </span>
                          </div>
                        </td>

                        <td>
                          <div className="asset-cell">
                            <User
                              size={15}
                              color="#64748b"
                            />
                            <span>
                              {record.assignedTo}
                            </span>
                          </div>
                        </td>

                        <td>
                          {formatDateTime(
                            record.lastScannedAt
                          )}
                        </td>

                        <td>
                          {record.lastScannedLocation}
                        </td>

                        <td>
                          <span
                            className={`badge ${getStatusClass(
                              record.status
                            )}`}
                          >
                            {record.status}
                          </span>
                        </td>

                        <td>
                          <span
                            className={`badge ${getConditionClass(
                              record.condition
                            )}`}
                          >
                            {record.condition}
                          </span>
                        </td>

                        <td>
                          <div className="action-buttons">
                            <button
                              type="button"
                              className="icon-btn"
                              title="View details"
                              onClick={() =>
                                openDetails(record)
                              }
                            >
                              <Eye size={16} />
                            </button>

                            <button
                              type="button"
                              className="icon-btn"
                              title="Edit"
                              onClick={() =>
                                openEditModal(record)
                              }
                            >
                              <Edit3 size={16} />
                            </button>

                            <button
                              type="button"
                              className="icon-btn delete"
                              title="Delete"
                              onClick={() =>
                                openDeleteDialog(record)
                              }
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="pagination">
                <div className="pagination-info">
                  Showing {records.length} of{" "}
                  {pagination.total} records
                </div>

                <div className="pagination-actions">
                  <button
                    type="button"
                    className="page-btn"
                    disabled={
                      !canPrevious || loading
                    }
                    onClick={() =>
                      setPage((current) =>
                        Math.max(
                          1,
                          current - 1
                        )
                      )
                    }
                  >
                    <ChevronLeft size={17} />
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
                      !canNext || loading
                    }
                    onClick={() =>
                      setPage((current) =>
                        Math.min(
                          pagination.totalPages,
                          current + 1
                        )
                      )
                    }
                  >
                    <ChevronRight size={17} />
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
            to="/infrastructure/verification"
            className="quick-link"
          >
            <CheckCircle2 size={15} />
            Asset Verification
          </Link>

          <Link
            to="/infrastructure/audit"
            className="quick-link"
          >
            <History size={15} />
            Audit & History
          </Link>
        </div>
      </div>

      {showModal && (
        <div
          className="modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
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
                  {editingRecord
                    ? "Edit Tracking Record"
                    : "Register RFID / QR Tag"}
                </h2>

                <p>
                  Connect an identification tag to an
                  infrastructure asset.
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

            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">
                      Asset ID
                    </label>

                    <input
                      className="form-input"
                      name="assetId"
                      value={form.assetId}
                      onChange={handleChange}
                      placeholder="Existing asset ID"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Asset Tag
                    </label>

                    <input
                      className="form-input"
                      name="assetTag"
                      value={form.assetTag}
                      onChange={handleChange}
                      placeholder="Asset tag number"
                    />
                  </div>

                  <div className="form-group full">
                    <label className="form-label">
                      Asset Name *
                    </label>

                    <input
                      className="form-input"
                      name="assetName"
                      value={form.assetName}
                      onChange={handleChange}
                      placeholder="Infrastructure asset name"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Tag Type
                    </label>

                    <select
                      className="form-select"
                      name="tagType"
                      value={form.tagType}
                      onChange={handleChange}
                    >
                      {TAG_TYPES.map(
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

                  <div className="form-group">
                    <label className="form-label">
                      QR / Tag Code
                    </label>

                    <input
                      className="form-input"
                      name="tagCode"
                      value={form.tagCode}
                      onChange={handleChange}
                      placeholder="Unique QR or tag code"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      RFID UID
                    </label>

                    <input
                      className="form-input"
                      name="rfidUid"
                      value={form.rfidUid}
                      onChange={handleChange}
                      placeholder="RFID unique identifier"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Location
                    </label>

                    <input
                      className="form-input"
                      name="location"
                      value={form.location}
                      onChange={handleChange}
                      placeholder="Current asset location"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Assigned To
                    </label>

                    <input
                      className="form-input"
                      name="assignedTo"
                      value={form.assignedTo}
                      onChange={handleChange}
                      placeholder="Responsible person"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Status
                    </label>

                    <select
                      className="form-select"
                      name="status"
                      value={form.status}
                      onChange={handleChange}
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
                      Condition
                    </label>

                    <select
                      className="form-select"
                      name="condition"
                      value={form.condition}
                      onChange={handleChange}
                    >
                      {CONDITION_OPTIONS.map(
                        (condition) => (
                          <option
                            key={condition}
                            value={condition}
                          >
                            {condition}
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Last Scanned At
                    </label>

                    <input
                      type="datetime-local"
                      className="form-input"
                      name="lastScannedAt"
                      value={form.lastScannedAt}
                      onChange={handleChange}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Last Scanned Location
                    </label>

                    <input
                      className="form-input"
                      name="lastScannedLocation"
                      value={
                        form.lastScannedLocation
                      }
                      onChange={handleChange}
                      placeholder="Location where tag was scanned"
                    />
                  </div>

                  <div className="form-group full">
                    <label className="form-label">
                      Description
                    </label>

                    <textarea
                      className="form-textarea"
                      name="description"
                      value={form.description}
                      onChange={handleChange}
                      placeholder="Tracking/tag description..."
                    />
                  </div>

                  <div className="form-group full">
                    <label className="form-label">
                      Remarks
                    </label>

                    <textarea
                      className="form-textarea"
                      name="remarks"
                      value={form.remarks}
                      onChange={handleChange}
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
                      <CheckCircle2 size={16} />
                      {editingRecord
                        ? "Update Record"
                        : "Register Tag"}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDetails && selectedRecord && (
        <div
          className="modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget
            ) {
              setShowDetails(false);
            }
          }}
        >
          <div className="modal">
            <div className="modal-header">
              <div>
                <h2>
                  Tracking Record Details
                </h2>

                <p>
                  {selectedRecord.assetName}
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
                <div className="detail-item">
                  <div className="detail-label">
                    ASSET NAME
                  </div>

                  <div className="detail-value">
                    {selectedRecord.assetName}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    ASSET ID
                  </div>

                  <div className="detail-value">
                    {selectedRecord.assetId}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    ASSET TAG
                  </div>

                  <div className="detail-value">
                    {selectedRecord.assetTag}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    TAG TYPE
                  </div>

                  <div className="detail-value">
                    {selectedRecord.tagType}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    QR / TAG CODE
                  </div>

                  <div className="detail-value">
                    {selectedRecord.tagCode}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    RFID UID
                  </div>

                  <div className="detail-value">
                    {selectedRecord.rfidUid}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    CURRENT LOCATION
                  </div>

                  <div className="detail-value">
                    {selectedRecord.location}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    ASSIGNED TO
                  </div>

                  <div className="detail-value">
                    {selectedRecord.assignedTo}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    LAST SCANNED
                  </div>

                  <div className="detail-value">
                    {formatDateTime(
                      selectedRecord.lastScannedAt
                    )}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    LAST SCAN LOCATION
                  </div>

                  <div className="detail-value">
                    {
                      selectedRecord.lastScannedLocation
                    }
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    STATUS
                  </div>

                  <div className="detail-value">
                    <span
                      className={`badge ${getStatusClass(
                        selectedRecord.status
                      )}`}
                    >
                      {selectedRecord.status}
                    </span>
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    CONDITION
                  </div>

                  <div className="detail-value">
                    <span
                      className={`badge ${getConditionClass(
                        selectedRecord.condition
                      )}`}
                    >
                      {selectedRecord.condition}
                    </span>
                  </div>
                </div>

                <div className="detail-item full">
                  <div className="detail-label">
                    DESCRIPTION
                  </div>

                  <div className="detail-value">
                    {selectedRecord.description ||
                      "—"}
                  </div>
                </div>

                <div className="detail-item full">
                  <div className="detail-label">
                    REMARKS
                  </div>

                  <div className="detail-value">
                    {selectedRecord.remarks ||
                      "—"}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    CREATED
                  </div>

                  <div className="detail-value">
                    {formatDateTime(
                      selectedRecord.createdAt
                    )}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    UPDATED
                  </div>

                  <div className="detail-value">
                    {formatDateTime(
                      selectedRecord.updatedAt
                    )}
                  </div>
                </div>
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
                  openEditModal(selectedRecord);
                }}
              >
                <Edit3 size={16} />
                Edit Record
              </button>
            </div>
          </div>
        </div>
      )}

      {showDelete && selectedRecord && (
        <div
          className="modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
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
                  Delete Tracking Record
                </h2>

                <p>
                  This action cannot be undone.
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
                  <XCircle size={25} />
                </div>

                <h3>
                  Are you sure?
                </h3>

                <p>
                  You are about to delete the
                  tracking record for{" "}
                  <strong>
                    {selectedRecord.assetName}
                  </strong>
                  . The asset itself will not be
                  deleted by this action.
                </p>
              </div>
            </div>

            <div className="modal-footer confirm-footer">
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
                    <Trash2 size={16} />
                    Delete Record
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