import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import {
  AlertCircle,
  ArrowLeft,
  BadgeCheck,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Eye,
  Filter,
  MapPin,
  PackageCheck,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  X,
  XCircle,
  AlertTriangle,
  Clock3,
} from "lucide-react";

const PAGE_SIZE = 10;

const VERIFICATION_STATUSES = [
  "all",
  "pending",
  "verified",
  "missing",
  "damaged",
  "needs_review",
];

const normalize = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase();

const getValue = (obj, keys, fallback = "") => {
  if (!obj || typeof obj !== "object") return fallback;

  for (const key of keys) {
    if (
      obj[key] !== undefined &&
      obj[key] !== null &&
      String(obj[key]).trim() !== ""
    ) {
      return obj[key];
    }
  }

  return fallback;
};

const getId = (row) =>
  getValue(row, ["id", "verification_id", "verificationId"], "");

const getAssetId = (row) =>
  getValue(row, ["asset_id", "assetId", "assetID"], "");

const getAssetName = (row) =>
  getValue(
    row,
    ["asset_name", "assetName", "name", "asset", "equipment_name"],
    "Unnamed Asset"
  );

const getAssetTag = (row) =>
  getValue(
    row,
    ["asset_tag", "assetTag", "tag", "asset_code", "assetCode"],
    "—"
  );

const getSerial = (row) =>
  getValue(
    row,
    ["serial_number", "serialNumber", "serial", "serial_no"],
    "—"
  );

const getCategory = (row) =>
  getValue(row, ["category_name", "categoryName", "category"], "—");

const getLocation = (row) =>
  getValue(
    row,
    ["location_name", "locationName", "location", "current_location"],
    "—"
  );

const getVerifier = (row) =>
  getValue(
    row,
    [
      "verified_by_name",
      "verifiedByName",
      "verifier_name",
      "verifierName",
      "verified_by",
      "verifiedBy",
      "user_name",
    ],
    "—"
  );

const getStatus = (row) =>
  normalize(
    getValue(
      row,
      ["status", "verification_status", "verificationStatus"],
      "pending"
    )
  );

const getVerificationDate = (row) =>
  getValue(
    row,
    [
      "verification_date",
      "verificationDate",
      "verified_at",
      "verifiedAt",
      "created_at",
      "createdAt",
    ],
    ""
  );

const getNotes = (row) =>
  getValue(
    row,
    ["notes", "verification_notes", "verificationNotes", "remarks"],
    ""
  );

const getCondition = (row) =>
  getValue(
    row,
    ["condition", "asset_condition", "assetCondition"],
    "—"
  );

const getExpectedLocation = (row) =>
  getValue(
    row,
    ["expected_location", "expectedLocation", "registered_location"],
    "—"
  );

const formatDate = (value) => {
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
};

const formatDateTime = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const extractRows = (response) => {
  const data = response?.data;

  if (Array.isArray(data)) return data;

  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.verifications)) return data.verifications;
  if (Array.isArray(data?.verification)) return data.verification;
  if (Array.isArray(data?.assets)) return data.assets;

  return [];
};

const extractPagination = (response, currentPage) => {
  const data = response?.data;

  const pagination =
    data?.pagination ||
    data?.meta ||
    data?.pageInfo ||
    {};

  const total =
    Number(
      pagination.total ??
        data?.total ??
        data?.totalCount ??
        0
    ) || 0;

  const totalPages =
    Number(
      pagination.totalPages ??
        data?.totalPages ??
        Math.ceil(total / PAGE_SIZE)
    ) || 1;

  return {
    page:
      Number(
        pagination.page ??
          data?.page ??
          currentPage
      ) || currentPage,
    total,
    totalPages: Math.max(totalPages, 1),
  };
};

const getStatusLabel = (status) => {
  const labels = {
    pending: "Pending",
    verified: "Verified",
    missing: "Missing",
    damaged: "Damaged",
    needs_review: "Needs Review",
    "needs review": "Needs Review",
  };

  return labels[status] || status || "Pending";
};

const getStatusIcon = (status) => {
  switch (status) {
    case "verified":
      return <CheckCircle2 size={16} />;
    case "missing":
      return <XCircle size={16} />;
    case "damaged":
      return <AlertTriangle size={16} />;
    case "needs_review":
    case "needs review":
      return <AlertCircle size={16} />;
    default:
      return <Clock3 size={16} />;
  }
};

const getStatusClass = (status) => {
  switch (status) {
    case "verified":
      return "status verified";
    case "missing":
      return "status missing";
    case "damaged":
      return "status damaged";
    case "needs_review":
    case "needs review":
      return "status review";
    default:
      return "status pending";
  }
};

export default function InfrastructureVerification() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [location, setLocation] = useState("all");

  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    total: 0,
    totalPages: 1,
  });

  const [selectedVerification, setSelectedVerification] = useState(null);

  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  const [showActionModal, setShowActionModal] = useState(false);
  const [actionType, setActionType] = useState("");

  const [notes, setNotes] = useState("");
  const [condition, setCondition] = useState("");

  const loadVerification = useCallback(
    async ({ silent = false } = {}) => {
      try {
        if (silent) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");

        const response = await api.get("/infrastructure/verification", {
          params: {
            page,
            limit: PAGE_SIZE,
            search: search.trim(),
            status: status === "all" ? "" : status,
            location: location === "all" ? "" : location,
          },
        });

        const data = extractRows(response);
        const pageInfo = extractPagination(response, page);

        setRows(data);
        setPagination(pageInfo);
      } catch (err) {
        console.error("Infrastructure verification load error:", err);

        const message =
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Unable to load infrastructure verification data.";

        setError(message);
        setRows([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [page, search, status, location]
  );

  useEffect(() => {
    loadVerification();
  }, [loadVerification]);

  useEffect(() => {
    setPage(1);
  }, [search, status, location]);

  const locations = useMemo(() => {
    const values = rows
      .map((row) => getLocation(row))
      .filter((value) => value && value !== "—");

    return [...new Set(values)].sort((a, b) =>
      String(a).localeCompare(String(b))
    );
  }, [rows]);

  const summary = useMemo(() => {
    return {
      total: rows.length,
      verified: rows.filter(
        (row) => getStatus(row) === "verified"
      ).length,
      pending: rows.filter(
        (row) => getStatus(row) === "pending"
      ).length,
      missing: rows.filter(
        (row) => getStatus(row) === "missing"
      ).length,
      damaged: rows.filter(
        (row) => getStatus(row) === "damaged"
      ).length,
      review: rows.filter((row) => {
        const current = getStatus(row);
        return (
          current === "needs_review" ||
          current === "needs review"
        );
      }).length,
    };
  }, [rows]);

  const openAction = (row, type) => {
    setSelectedVerification(row);
    setActionType(type);
    setNotes(getNotes(row));
    setCondition(getCondition(row) === "—" ? "" : getCondition(row));
    setActionError("");
    setActionSuccess("");
    setShowActionModal(true);
  };

  const closeAction = () => {
    if (actionLoading) return;

    setShowActionModal(false);
    setActionType("");
    setSelectedVerification(null);
    setNotes("");
    setCondition("");
    setActionError("");
    setActionSuccess("");
  };

  const submitAction = async () => {
    if (!selectedVerification) return;

    const id = getId(selectedVerification);

    if (!id) {
      setActionError(
        "This verification record does not contain a valid ID."
      );
      return;
    }

    try {
      setActionLoading(true);
      setActionError("");
      setActionSuccess("");

      const payload = {
        notes: notes.trim(),
        condition: condition.trim(),
      };

      let response;

      if (actionType === "verify") {
        response = await api.patch(
          `/infrastructure/verification/${id}/verify`,
          payload
        );
      } else if (actionType === "missing") {
        response = await api.patch(
          `/infrastructure/verification/${id}/missing`,
          payload
        );
      } else if (actionType === "damaged") {
        response = await api.patch(
          `/infrastructure/verification/${id}/damaged`,
          payload
        );
      } else if (actionType === "review") {
        response = await api.patch(
          `/infrastructure/verification/${id}/review`,
          payload
        );
      } else {
        throw new Error("Unsupported verification action.");
      }

      if (response?.data) {
        setActionSuccess(
          response.data.message ||
            "Verification status updated successfully."
        );
      } else {
        setActionSuccess("Verification status updated successfully.");
      }

      await loadVerification({ silent: true });

      setTimeout(() => {
        closeAction();
      }, 600);
    } catch (err) {
      console.error("Verification action error:", err);

      setActionError(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Unable to update verification status."
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleRefresh = () => {
    loadVerification({ silent: true });
  };

  const goToPage = (nextPage) => {
    if (
      nextPage < 1 ||
      nextPage > pagination.totalPages ||
      nextPage === page
    ) {
      return;
    }

    setPage(nextPage);
  };

  const pageNumbers = useMemo(() => {
    const total = pagination.totalPages;
    const current = page;

    if (total <= 5) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }

    if (current <= 3) {
      return [1, 2, 3, 4, 5];
    }

    if (current >= total - 2) {
      return [
        total - 4,
        total - 3,
        total - 2,
        total - 1,
        total,
      ];
    }

    return [
      current - 2,
      current - 1,
      current,
      current + 1,
      current + 2,
    ];
  }, [page, pagination.totalPages]);

  return (
    <div className="infrastructure-verification-page">
      <style>{`
        * {
          box-sizing: border-box;
        }

        .infrastructure-verification-page {
          min-height: 100vh;
          background: #f8fafc;
          color: #0f172a;
          padding: 24px;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system,
            BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .verification-container {
          max-width: 1500px;
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
          align-items: flex-start;
          gap: 14px;
        }

        .header-icon {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #0ea5e9;
          color: white;
          flex-shrink: 0;
          box-shadow: 0 8px 20px rgba(14, 165, 233, 0.2);
        }

        .page-title {
          margin: 0;
          font-size: 28px;
          line-height: 1.2;
          font-weight: 800;
          color: #0f172a;
        }

        .page-subtitle {
          margin: 6px 0 0;
          color: #64748b;
          font-size: 14px;
        }

        .header-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .btn {
          border: 1px solid #e2e8f0;
          background: white;
          color: #334155;
          min-height: 42px;
          padding: 0 14px;
          border-radius: 10px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-weight: 700;
          font-size: 13px;
          cursor: pointer;
          text-decoration: none;
          transition: 0.2s ease;
        }

        .btn:hover {
          border-color: #bae6fd;
          background: #f0f9ff;
          color: #0369a1;
        }

        .btn.primary {
          background: #0ea5e9;
          color: white;
          border-color: #0ea5e9;
        }

        .btn.primary:hover {
          background: #0284c7;
          border-color: #0284c7;
          color: white;
        }

        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 22px;
        }

        .summary-card {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 17px;
          min-width: 0;
          box-shadow: 0 3px 12px rgba(15, 23, 42, 0.04);
        }

        .summary-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 12px;
        }

        .summary-label {
          font-size: 12px;
          color: #64748b;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .summary-icon {
          width: 34px;
          height: 34px;
          border-radius: 9px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .summary-icon.blue {
          background: #e0f2fe;
          color: #0284c7;
        }

        .summary-icon.green {
          background: #dcfce7;
          color: #15803d;
        }

        .summary-icon.orange {
          background: #ffedd5;
          color: #c2410c;
        }

        .summary-icon.red {
          background: #fee2e2;
          color: #dc2626;
        }

        .summary-icon.yellow {
          background: #fef9c3;
          color: #a16207;
        }

        .summary-icon.purple {
          background: #f3e8ff;
          color: #7e22ce;
        }

        .summary-number {
          font-size: 25px;
          line-height: 1;
          font-weight: 800;
          color: #0f172a;
        }

        .toolbar {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 15px;
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          margin-bottom: 16px;
          box-shadow: 0 3px 12px rgba(15, 23, 42, 0.03);
        }

        .search-box {
          position: relative;
          flex: 1;
          min-width: 250px;
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
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 0 14px 0 40px;
          outline: none;
          font-size: 13px;
          color: #0f172a;
          background: #fff;
        }

        .search-box input:focus,
        .select-control:focus {
          border-color: #38bdf8;
          box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.1);
        }

        .select-control {
          height: 42px;
          min-width: 160px;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 0 12px;
          background: white;
          color: #334155;
          outline: none;
          font-size: 13px;
          font-weight: 600;
        }

        .filter-label {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          color: #64748b;
          font-size: 13px;
          font-weight: 700;
        }

        .table-card {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          overflow: hidden;
          box-shadow: 0 3px 12px rgba(15, 23, 42, 0.04);
        }

        .table-header {
          padding: 17px 18px;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
        }

        .table-title {
          margin: 0;
          font-size: 16px;
          font-weight: 800;
        }

        .table-count {
          color: #64748b;
          font-size: 13px;
        }

        .table-wrapper {
          width: 100%;
          overflow-x: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          min-width: 1050px;
        }

        th {
          background: #f8fafc;
          color: #64748b;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          text-align: left;
          padding: 13px 15px;
          border-bottom: 1px solid #e2e8f0;
          white-space: nowrap;
        }

        td {
          padding: 14px 15px;
          border-bottom: 1px solid #f1f5f9;
          font-size: 13px;
          color: #334155;
          vertical-align: middle;
        }

        tbody tr:hover {
          background: #f8fafc;
        }

        .asset-cell {
          display: flex;
          align-items: center;
          gap: 11px;
        }

        .asset-icon {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #e0f2fe;
          color: #0284c7;
          flex-shrink: 0;
        }

        .asset-name {
          font-weight: 800;
          color: #0f172a;
          margin-bottom: 3px;
        }

        .asset-tag {
          font-size: 11px;
          color: #64748b;
        }

        .secondary-text {
          color: #64748b;
          font-size: 12px;
          margin-top: 3px;
        }

        .location-cell {
          display: flex;
          align-items: center;
          gap: 7px;
        }

        .location-cell svg {
          color: #0ea5e9;
          flex-shrink: 0;
        }

        .status {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border-radius: 999px;
          padding: 6px 9px;
          font-size: 11px;
          font-weight: 800;
          white-space: nowrap;
        }

        .status.verified {
          background: #dcfce7;
          color: #166534;
        }

        .status.pending {
          background: #fef3c7;
          color: #92400e;
        }

        .status.missing {
          background: #fee2e2;
          color: #991b1b;
        }

        .status.damaged {
          background: #ffedd5;
          color: #9a3412;
        }

        .status.review {
          background: #f3e8ff;
          color: #6b21a8;
        }

        .action-buttons {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .icon-btn {
          width: 34px;
          height: 34px;
          border: 1px solid #e2e8f0;
          background: white;
          border-radius: 9px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: #475569;
        }

        .icon-btn:hover {
          background: #f0f9ff;
          border-color: #bae6fd;
          color: #0284c7;
        }

        .icon-btn.success:hover {
          background: #f0fdf4;
          border-color: #bbf7d0;
          color: #15803d;
        }

        .icon-btn.danger:hover {
          background: #fef2f2;
          border-color: #fecaca;
          color: #dc2626;
        }

        .icon-btn.warning:hover {
          background: #fffbeb;
          border-color: #fde68a;
          color: #a16207;
        }

        .empty-state {
          padding: 55px 20px;
          text-align: center;
          color: #64748b;
        }

        .empty-icon {
          width: 58px;
          height: 58px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f1f5f9;
          margin: 0 auto 14px;
          color: #64748b;
        }

        .empty-state h3 {
          margin: 0 0 6px;
          color: #334155;
          font-size: 16px;
        }

        .empty-state p {
          margin: 0;
          font-size: 13px;
        }

        .error-box {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #991b1b;
          border-radius: 12px;
          padding: 13px 15px;
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 16px;
          font-size: 13px;
          font-weight: 600;
        }

        .loading-box {
          padding: 50px 20px;
          text-align: center;
          color: #64748b;
        }

        .spinner {
          animation: spin 0.9s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .pagination {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          padding: 14px 17px;
          border-top: 1px solid #e2e8f0;
        }

        .pagination-info {
          font-size: 12px;
          color: #64748b;
        }

        .pagination-buttons {
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .page-btn {
          min-width: 34px;
          height: 34px;
          border: 1px solid #e2e8f0;
          background: white;
          border-radius: 8px;
          color: #475569;
          cursor: pointer;
          font-weight: 700;
        }

        .page-btn:hover:not(:disabled) {
          border-color: #7dd3fc;
          background: #f0f9ff;
          color: #0284c7;
        }

        .page-btn.active {
          background: #0ea5e9;
          border-color: #0ea5e9;
          color: white;
        }

        .page-btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.55);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          z-index: 1000;
        }

        .modal {
          width: min(700px, 100%);
          max-height: calc(100vh - 40px);
          overflow-y: auto;
          background: white;
          border-radius: 16px;
          box-shadow: 0 24px 70px rgba(15, 23, 42, 0.25);
        }

        .modal-header {
          padding: 18px 20px;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
        }

        .modal-title {
          margin: 0;
          font-size: 17px;
          font-weight: 800;
          color: #0f172a;
        }

        .modal-close {
          width: 34px;
          height: 34px;
          border: none;
          background: #f1f5f9;
          color: #475569;
          border-radius: 9px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .modal-close:hover {
          background: #e2e8f0;
        }

        .modal-body {
          padding: 20px;
        }

        .detail-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 13px;
        }

        .detail-card {
          border: 1px solid #e2e8f0;
          border-radius: 11px;
          padding: 13px;
          background: #f8fafc;
        }

        .detail-label {
          color: #64748b;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin-bottom: 5px;
        }

        .detail-value {
          color: #0f172a;
          font-size: 13px;
          font-weight: 700;
          word-break: break-word;
        }

        .notes-box {
          margin-top: 15px;
          border: 1px solid #e2e8f0;
          border-radius: 11px;
          padding: 14px;
        }

        .notes-title {
          font-size: 12px;
          color: #64748b;
          font-weight: 800;
          text-transform: uppercase;
          margin-bottom: 7px;
        }

        .notes-content {
          color: #334155;
          font-size: 13px;
          line-height: 1.6;
          white-space: pre-wrap;
        }

        .modal-footer {
          padding: 15px 20px;
          border-top: 1px solid #e2e8f0;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 9px;
          flex-wrap: wrap;
        }

        .form-group {
          margin-bottom: 15px;
        }

        .form-label {
          display: block;
          margin-bottom: 7px;
          color: #334155;
          font-size: 12px;
          font-weight: 800;
        }

        .form-control {
          width: 100%;
          min-height: 42px;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 9px 12px;
          outline: none;
          color: #0f172a;
          font-size: 13px;
          font-family: inherit;
        }

        textarea.form-control {
          min-height: 100px;
          resize: vertical;
        }

        .form-control:focus {
          border-color: #38bdf8;
          box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.1);
        }

        .action-alert {
          border-radius: 10px;
          padding: 11px 12px;
          margin-bottom: 15px;
          display: flex;
          gap: 8px;
          align-items: flex-start;
          font-size: 12px;
          font-weight: 600;
        }

        .action-alert.error {
          background: #fef2f2;
          color: #991b1b;
          border: 1px solid #fecaca;
        }

        .action-alert.success {
          background: #f0fdf4;
          color: #166534;
          border: 1px solid #bbf7d0;
        }

        .verification-banner {
          display: flex;
          align-items: center;
          gap: 10px;
          background: #f0f9ff;
          color: #075985;
          border: 1px solid #bae6fd;
          border-radius: 11px;
          padding: 12px;
          margin-bottom: 16px;
          font-size: 13px;
          font-weight: 600;
        }

        @media (max-width: 1200px) {
          .summary-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 800px) {
          .infrastructure-verification-page {
            padding: 15px;
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
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .detail-grid {
            grid-template-columns: 1fr;
          }

          .pagination {
            flex-direction: column;
            align-items: flex-start;
          }
        }

        @media (max-width: 520px) {
          .summary-grid {
            grid-template-columns: 1fr;
          }

          .search-box {
            min-width: 100%;
          }

          .select-control {
            width: 100%;
          }

          .toolbar .btn {
            width: 100%;
          }

          .page-title {
            font-size: 23px;
          }
        }
      `}</style>

      <div className="verification-container">
        <div className="page-header">
          <div className="header-left">
            <div className="header-icon">
              <ShieldCheck size={25} />
            </div>

            <div>
              <h1 className="page-title">Asset Verification</h1>
              <p className="page-subtitle">
                Verify infrastructure assets, locations, condition, and
                operational status.
              </p>
            </div>
          </div>

          <div className="header-actions">
            <Link
              to="/infrastructure/assets"
              className="btn"
            >
              <ArrowLeft size={16} />
              Infrastructure Assets
            </Link>

            <button
              type="button"
              className="btn primary"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw
                size={16}
                className={refreshing ? "spinner" : ""}
              />
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        <div className="verification-banner">
          <ClipboardCheck size={18} />
          <span>
            Use verification actions to confirm whether each infrastructure
            asset exists at its registered location and is in acceptable
            condition.
          </span>
        </div>

        <div className="summary-grid">
          <div className="summary-card">
            <div className="summary-top">
              <span className="summary-label">Total</span>
              <span className="summary-icon blue">
                <PackageCheck size={18} />
              </span>
            </div>
            <div className="summary-number">
              {summary.total}
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-top">
              <span className="summary-label">Verified</span>
              <span className="summary-icon green">
                <BadgeCheck size={18} />
              </span>
            </div>
            <div className="summary-number">
              {summary.verified}
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-top">
              <span className="summary-label">Pending</span>
              <span className="summary-icon orange">
                <Clock3 size={18} />
              </span>
            </div>
            <div className="summary-number">
              {summary.pending}
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-top">
              <span className="summary-label">Missing</span>
              <span className="summary-icon red">
                <XCircle size={18} />
              </span>
            </div>
            <div className="summary-number">
              {summary.missing}
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-top">
              <span className="summary-label">Damaged</span>
              <span className="summary-icon orange">
                <AlertTriangle size={18} />
              </span>
            </div>
            <div className="summary-number">
              {summary.damaged}
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-top">
              <span className="summary-label">Needs Review</span>
              <span className="summary-icon purple">
                <AlertCircle size={18} />
              </span>
            </div>
            <div className="summary-number">
              {summary.review}
            </div>
          </div>
        </div>

        {error && (
          <div className="error-box">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <div className="toolbar">
          <div className="search-box">
            <Search size={17} />
            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search asset, tag, serial, category, location..."
            />
          </div>

          <label className="filter-label">
            <Filter size={15} />
            Status
          </label>

          <select
            className="select-control"
            value={status}
            onChange={(event) =>
              setStatus(event.target.value)
            }
          >
            {VERIFICATION_STATUSES.map((item) => (
              <option key={item} value={item}>
                {item === "all"
                  ? "All statuses"
                  : getStatusLabel(item)}
              </option>
            ))}
          </select>

          <select
            className="select-control"
            value={location}
            onChange={(event) =>
              setLocation(event.target.value)
            }
          >
            <option value="all">All locations</option>

            {locations.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="btn"
            onClick={() => {
              setSearch("");
              setStatus("all");
              setLocation("all");
            }}
          >
            Clear Filters
          </button>
        </div>

        <div className="table-card">
          <div className="table-header">
            <div>
              <h2 className="table-title">
                Verification Records
              </h2>
              <div className="table-count">
                {pagination.total || rows.length} records
              </div>
            </div>

            <button
              type="button"
              className="btn"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw
                size={15}
                className={refreshing ? "spinner" : ""}
              />
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="loading-box">
              <RefreshCw
                size={28}
                className="spinner"
              />
              <p>Loading verification records...</p>
            </div>
          ) : rows.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                <ClipboardCheck size={28} />
              </div>

              <h3>No verification records found</h3>

              <p>
                No infrastructure verification records match the
                current search and filters.
              </p>
            </div>
          ) : (
            <>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Asset</th>
                      <th>Category</th>
                      <th>Location</th>
                      <th>Condition</th>
                      <th>Verification Status</th>
                      <th>Verified By</th>
                      <th>Verification Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {rows.map((row) => {
                      const rowId = getId(row);
                      const currentStatus = getStatus(row);

                      return (
                        <tr key={rowId || `${getAssetTag(row)}-${getAssetName(row)}`}>
                          <td>
                            <div className="asset-cell">
                              <div className="asset-icon">
                                <Building2 size={18} />
                              </div>

                              <div>
                                <div className="asset-name">
                                  {getAssetName(row)}
                                </div>

                                <div className="asset-tag">
                                  Tag: {getAssetTag(row)}
                                </div>

                                <div className="secondary-text">
                                  Serial: {getSerial(row)}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td>
                            {getCategory(row)}
                          </td>

                          <td>
                            <div className="location-cell">
                              <MapPin size={15} />
                              <span>
                                {getLocation(row)}
                              </span>
                            </div>
                          </td>

                          <td>
                            {getCondition(row)}
                          </td>

                          <td>
                            <span
                              className={getStatusClass(
                                currentStatus
                              )}
                            >
                              {getStatusIcon(currentStatus)}
                              {getStatusLabel(
                                currentStatus
                              )}
                            </span>
                          </td>

                          <td>
                            <div className="location-cell">
                              <UserRound size={15} />
                              <span>
                                {getVerifier(row)}
                              </span>
                            </div>
                          </td>

                          <td>
                            {formatDate(
                              getVerificationDate(row)
                            )}
                          </td>

                          <td>
                            <div className="action-buttons">
                              <button
                                type="button"
                                className="icon-btn"
                                title="View details"
                                onClick={() =>
                                  setSelectedVerification(
                                    row
                                  )
                                }
                              >
                                <Eye size={16} />
                              </button>

                              {currentStatus !==
                                "verified" && (
                                <button
                                  type="button"
                                  className="icon-btn success"
                                  title="Mark verified"
                                  onClick={() =>
                                    openAction(
                                      row,
                                      "verify"
                                    )
                                  }
                                >
                                  <CheckCircle2 size={16} />
                                </button>
                              )}

                              {currentStatus !==
                                "missing" && (
                                <button
                                  type="button"
                                  className="icon-btn danger"
                                  title="Mark missing"
                                  onClick={() =>
                                    openAction(
                                      row,
                                      "missing"
                                    )
                                  }
                                >
                                  <XCircle size={16} />
                                </button>
                              )}

                              {currentStatus !==
                                "damaged" && (
                                <button
                                  type="button"
                                  className="icon-btn warning"
                                  title="Mark damaged"
                                  onClick={() =>
                                    openAction(
                                      row,
                                      "damaged"
                                    )
                                  }
                                >
                                  <AlertTriangle
                                    size={16}
                                  />
                                </button>
                              )}

                              {currentStatus !==
                                "needs_review" && (
                                <button
                                  type="button"
                                  className="icon-btn"
                                  title="Needs review"
                                  onClick={() =>
                                    openAction(
                                      row,
                                      "review"
                                    )
                                  }
                                >
                                  <AlertCircle size={16} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="pagination">
                <div className="pagination-info">
                  Page {page} of {pagination.totalPages}
                  {pagination.total
                    ? ` • ${pagination.total} total records`
                    : ""}
                </div>

                <div className="pagination-buttons">
                  <button
                    type="button"
                    className="page-btn"
                    disabled={page <= 1}
                    onClick={() =>
                      goToPage(page - 1)
                    }
                  >
                    <ChevronLeft size={16} />
                  </button>

                  {pageNumbers.map((pageNumber) => (
                    <button
                      key={pageNumber}
                      type="button"
                      className={`page-btn ${
                        pageNumber === page
                          ? "active"
                          : ""
                      }`}
                      onClick={() =>
                        goToPage(pageNumber)
                      }
                    >
                      {pageNumber}
                    </button>
                  ))}

                  <button
                    type="button"
                    className="page-btn"
                    disabled={
                      page >= pagination.totalPages
                    }
                    onClick={() =>
                      goToPage(page + 1)
                    }
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* DETAILS MODAL */}
      {selectedVerification &&
        !showActionModal && (
          <div
            className="modal-overlay"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setSelectedVerification(null);
              }
            }}
          >
            <div className="modal">
              <div className="modal-header">
                <h2 className="modal-title">
                  Verification Details
                </h2>

                <button
                  type="button"
                  className="modal-close"
                  onClick={() =>
                    setSelectedVerification(null)
                  }
                >
                  <X size={18} />
                </button>
              </div>

              <div className="modal-body">
                <div className="detail-grid">
                  <div className="detail-card">
                    <div className="detail-label">
                      Asset
                    </div>
                    <div className="detail-value">
                      {getAssetName(
                        selectedVerification
                      )}
                    </div>
                  </div>

                  <div className="detail-card">
                    <div className="detail-label">
                      Asset Tag
                    </div>
                    <div className="detail-value">
                      {getAssetTag(
                        selectedVerification
                      )}
                    </div>
                  </div>

                  <div className="detail-card">
                    <div className="detail-label">
                      Asset ID
                    </div>
                    <div className="detail-value">
                      {getAssetId(
                        selectedVerification
                      ) || "—"}
                    </div>
                  </div>

                  <div className="detail-card">
                    <div className="detail-label">
                      Serial Number
                    </div>
                    <div className="detail-value">
                      {getSerial(
                        selectedVerification
                      )}
                    </div>
                  </div>

                  <div className="detail-card">
                    <div className="detail-label">
                      Category
                    </div>
                    <div className="detail-value">
                      {getCategory(
                        selectedVerification
                      )}
                    </div>
                  </div>

                  <div className="detail-card">
                    <div className="detail-label">
                      Current Location
                    </div>
                    <div className="detail-value">
                      {getLocation(
                        selectedVerification
                      )}
                    </div>
                  </div>

                  <div className="detail-card">
                    <div className="detail-label">
                      Expected Location
                    </div>
                    <div className="detail-value">
                      {getExpectedLocation(
                        selectedVerification
                      )}
                    </div>
                  </div>

                  <div className="detail-card">
                    <div className="detail-label">
                      Condition
                    </div>
                    <div className="detail-value">
                      {getCondition(
                        selectedVerification
                      )}
                    </div>
                  </div>

                  <div className="detail-card">
                    <div className="detail-label">
                      Verification Status
                    </div>
                    <div className="detail-value">
                      <span
                        className={getStatusClass(
                          getStatus(
                            selectedVerification
                          )
                        )}
                      >
                        {getStatusIcon(
                          getStatus(
                            selectedVerification
                          )
                        )}
                        {getStatusLabel(
                          getStatus(
                            selectedVerification
                          )
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="detail-card">
                    <div className="detail-label">
                      Verified By
                    </div>
                    <div className="detail-value">
                      {getVerifier(
                        selectedVerification
                      )}
                    </div>
                  </div>

                  <div className="detail-card">
                    <div className="detail-label">
                      Verification Date
                    </div>
                    <div className="detail-value">
                      {formatDateTime(
                        getVerificationDate(
                          selectedVerification
                        )
                      )}
                    </div>
                  </div>
                </div>

                <div className="notes-box">
                  <div className="notes-title">
                    Verification Notes
                  </div>

                  <div className="notes-content">
                    {getNotes(
                      selectedVerification
                    ) || "No verification notes recorded."}
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                {getStatus(
                  selectedVerification
                ) !== "verified" && (
                  <button
                    type="button"
                    className="btn primary"
                    onClick={() =>
                      openAction(
                        selectedVerification,
                        "verify"
                      )
                    }
                  >
                    <CheckCircle2 size={16} />
                    Mark Verified
                  </button>
                )}

                <button
                  type="button"
                  className="btn"
                  onClick={() =>
                    setSelectedVerification(null)
                  }
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

      {/* ACTION MODAL */}
      {showActionModal &&
        selectedVerification && (
          <div
            className="modal-overlay"
            onMouseDown={(event) => {
              if (
                event.target === event.currentTarget &&
                !actionLoading
              ) {
                closeAction();
              }
            }}
          >
            <div className="modal">
              <div className="modal-header">
                <h2 className="modal-title">
                  {actionType === "verify" &&
                    "Verify Asset"}

                  {actionType === "missing" &&
                    "Report Missing Asset"}

                  {actionType === "damaged" &&
                    "Report Damaged Asset"}

                  {actionType === "review" &&
                    "Send for Review"}
                </h2>

                <button
                  type="button"
                  className="modal-close"
                  disabled={actionLoading}
                  onClick={closeAction}
                >
                  <X size={18} />
                </button>
              </div>

              <div className="modal-body">
                <div className="detail-card">
                  <div className="detail-label">
                    Asset
                  </div>

                  <div className="detail-value">
                    {getAssetName(
                      selectedVerification
                    )}
                  </div>

                  <div className="secondary-text">
                    Tag:{" "}
                    {getAssetTag(
                      selectedVerification
                    )}
                  </div>
                </div>

                {actionType === "verify" && (
                  <div
                    className="verification-banner"
                    style={{ marginTop: 15 }}
                  >
                    <CheckCircle2 size={18} />
                    Confirm that the asset was physically
                    verified at the recorded location.
                  </div>
                )}

                {actionType === "missing" && (
                  <div
                    className="action-alert error"
                    style={{ marginTop: 15 }}
                  >
                    <XCircle size={17} />
                    <span>
                      Mark this asset as missing only after
                      the physical verification process has
                      confirmed that it cannot be located.
                    </span>
                  </div>
                )}

                {actionType === "damaged" && (
                  <div
                    className="action-alert"
                    style={{
                      marginTop: 15,
                      background: "#fff7ed",
                      color: "#9a3412",
                      border: "1px solid #fed7aa",
                    }}
                  >
                    <AlertTriangle size={17} />
                    <span>
                      Record the asset as damaged and
                      provide condition details for
                      maintenance follow-up.
                    </span>
                  </div>
                )}

                {actionType === "review" && (
                  <div
                    className="action-alert"
                    style={{
                      marginTop: 15,
                      background: "#faf5ff",
                      color: "#6b21a8",
                      border: "1px solid #e9d5ff",
                    }}
                  >
                    <AlertCircle size={17} />
                    <span>
                      Send this asset for additional
                      inspection or administrative review.
                    </span>
                  </div>
                )}

                {actionError && (
                  <div className="action-alert error">
                    <AlertCircle size={17} />
                    <span>{actionError}</span>
                  </div>
                )}

                {actionSuccess && (
                  <div className="action-alert success">
                    <CheckCircle2 size={17} />
                    <span>{actionSuccess}</span>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">
                    Asset Condition
                  </label>

                  <select
                    className="form-control"
                    value={condition}
                    onChange={(event) =>
                      setCondition(
                        event.target.value
                      )
                    }
                    disabled={actionLoading}
                  >
                    <option value="">
                      Select condition
                    </option>
                    <option value="Good">Good</option>
                    <option value="Fair">Fair</option>
                    <option value="Poor">Poor</option>
                    <option value="Damaged">
                      Damaged
                    </option>
                    <option value="Critical">
                      Critical
                    </option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Verification Notes
                  </label>

                  <textarea
                    className="form-control"
                    value={notes}
                    onChange={(event) =>
                      setNotes(event.target.value)
                    }
                    placeholder="Enter verification findings, location confirmation, condition details, or other remarks..."
                    disabled={actionLoading}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn"
                  onClick={closeAction}
                  disabled={actionLoading}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="btn primary"
                  onClick={submitAction}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <>
                      <RefreshCw
                        size={16}
                        className="spinner"
                      />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} />
                      Confirm
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