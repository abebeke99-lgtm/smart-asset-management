import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRightLeft,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Eye,
  Filter,
  MapPin,
  PackageCheck,
  Plus,
  RefreshCw,
  Search,
  UserRound,
  Users,
  Wrench,
  X,
  XCircle,
} from "lucide-react";

const PAGE_SIZE = 10;

const css = `
  .infra-assignment-page {
    min-height: 100vh;
    background: #f8fafc;
    color: #0f172a;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
      "Segoe UI", sans-serif;
  }

  .assignment-container {
    max-width: 1600px;
    margin: 0 auto;
    padding: 28px;
  }

  .assignment-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 20px;
    margin-bottom: 24px;
  }

  .header-left {
    display: flex;
    align-items: flex-start;
    gap: 13px;
  }

  .back-button {
    width: 42px;
    height: 42px;
    border: 1px solid #e2e8f0;
    border-radius: 11px;
    background: #fff;
    color: #475569;
    display: flex;
    align-items: center;
    justify-content: center;
    text-decoration: none;
    transition: .2s ease;
  }

  .back-button:hover {
    border-color: #38bdf8;
    color: #0284c7;
    transform: translateX(-2px);
  }

  .page-title {
    margin: 0;
    font-size: 28px;
    line-height: 1.2;
    font-weight: 800;
    letter-spacing: -.5px;
  }

  .page-subtitle {
    margin: 7px 0 0;
    color: #64748b;
    font-size: 14px;
    line-height: 1.6;
  }

  .header-actions {
    display: flex;
    gap: 9px;
    flex-wrap: wrap;
  }

  .button {
    min-height: 42px;
    padding: 0 14px;
    border-radius: 10px;
    border: 1px solid transparent;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 750;
    text-decoration: none;
    cursor: pointer;
    transition: .2s ease;
  }

  .button-primary {
    background: #0ea5e9;
    color: white;
    box-shadow: 0 5px 14px rgba(14, 165, 233, .18);
  }

  .button-primary:hover {
    background: #0284c7;
    transform: translateY(-1px);
  }

  .button-secondary {
    background: #fff;
    color: #334155;
    border-color: #e2e8f0;
  }

  .button-secondary:hover {
    border-color: #7dd3fc;
    color: #0284c7;
  }

  .button-danger {
    background: #fff;
    color: #dc2626;
    border-color: #fecaca;
  }

  .button-danger:hover {
    background: #fef2f2;
  }

  .button:disabled {
    opacity: .55;
    cursor: not-allowed;
    transform: none;
  }

  .summary-grid {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 16px;
    margin-bottom: 22px;
  }

  .summary-card {
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    padding: 18px;
    min-height: 125px;
    box-shadow: 0 3px 12px rgba(15, 23, 42, .035);
  }

  .summary-icon {
    width: 40px;
    height: 40px;
    border-radius: 11px;
    background: #e0f2fe;
    color: #0284c7;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .summary-card.success .summary-icon {
    background: #dcfce7;
    color: #15803d;
  }

  .summary-card.warning .summary-icon {
    background: #fef3c7;
    color: #b45309;
  }

  .summary-card.danger .summary-icon {
    background: #fee2e2;
    color: #dc2626;
  }

  .summary-card.dark .summary-icon {
    background: #e2e8f0;
    color: #334155;
  }

  .summary-value {
    margin-top: 15px;
    font-size: 27px;
    font-weight: 800;
  }

  .summary-label {
    margin-top: 4px;
    color: #64748b;
    font-size: 12px;
    font-weight: 650;
  }

  .filter-card {
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    padding: 18px;
    margin-bottom: 18px;
    box-shadow: 0 3px 12px rgba(15, 23, 42, .035);
  }

  .filter-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 14px;
  }

  .filter-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 15px;
    font-weight: 800;
  }

  .clear-button {
    border: 0;
    background: transparent;
    color: #0284c7;
    font-size: 12px;
    font-weight: 750;
    cursor: pointer;
  }

  .filter-grid {
    display: grid;
    grid-template-columns: minmax(250px, 2fr) repeat(3, minmax(150px, 1fr));
    gap: 12px;
  }

  .input-wrap {
    position: relative;
  }

  .input-icon {
    position: absolute;
    left: 13px;
    top: 50%;
    transform: translateY(-50%);
    color: #94a3b8;
    pointer-events: none;
  }

  .filter-input,
  .filter-select,
  .form-input,
  .form-select,
  .form-textarea {
    width: 100%;
    border: 1px solid #dbe3ec;
    border-radius: 10px;
    background: #fff;
    color: #0f172a;
    outline: none;
    transition: .2s ease;
    font-size: 13px;
  }

  .filter-input,
  .filter-select {
    height: 44px;
  }

  .filter-input {
    padding: 0 13px 0 40px;
  }

  .filter-select,
  .form-select {
    padding: 0 13px;
  }

  .form-input {
    height: 43px;
    padding: 0 13px;
  }

  .form-textarea {
    min-height: 90px;
    padding: 12px 13px;
    resize: vertical;
  }

  .filter-input:focus,
  .filter-select:focus,
  .form-input:focus,
  .form-select:focus,
  .form-textarea:focus {
    border-color: #38bdf8;
    box-shadow: 0 0 0 3px rgba(14, 165, 233, .1);
  }

  .table-card {
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    overflow: hidden;
    box-shadow: 0 3px 12px rgba(15, 23, 42, .035);
  }

  .table-header {
    padding: 18px 20px;
    border-bottom: 1px solid #e2e8f0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 15px;
  }

  .table-title {
    display: flex;
    align-items: center;
    gap: 9px;
  }

  .table-title h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 800;
  }

  .count-badge {
    background: #f1f5f9;
    color: #475569;
    border-radius: 999px;
    padding: 4px 9px;
    font-size: 11px;
    font-weight: 800;
  }

  .table-wrapper {
    width: 100%;
    overflow-x: auto;
  }

  .assignment-table {
    width: 100%;
    min-width: 1100px;
    border-collapse: collapse;
  }

  .assignment-table th {
    padding: 13px 16px;
    background: #f8fafc;
    border-bottom: 1px solid #e2e8f0;
    color: #64748b;
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: .4px;
    text-align: left;
    white-space: nowrap;
  }

  .assignment-table td {
    padding: 15px 16px;
    border-bottom: 1px solid #eef2f7;
    color: #334155;
    font-size: 13px;
    vertical-align: middle;
  }

  .assignment-table tbody tr:hover {
    background: #f8fcff;
  }

  .asset-cell {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 220px;
  }

  .asset-icon {
    width: 38px;
    height: 38px;
    flex-shrink: 0;
    border-radius: 10px;
    background: #e0f2fe;
    color: #0284c7;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .asset-name {
    font-weight: 750;
    color: #0f172a;
  }

  .asset-tag {
    margin-top: 3px;
    color: #94a3b8;
    font-size: 11px;
  }

  .person-cell {
    display: flex;
    align-items: center;
    gap: 9px;
  }

  .person-avatar {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    background: #eff6ff;
    color: #2563eb;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .person-name {
    color: #334155;
    font-weight: 700;
  }

  .person-role {
    margin-top: 2px;
    color: #94a3b8;
    font-size: 11px;
  }

  .status {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 9px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 800;
    white-space: nowrap;
  }

  .status-active,
  .status-assigned,
  .status-approved {
    background: #dcfce7;
    color: #166534;
  }

  .status-pending {
    background: #fef3c7;
    color: #92400e;
  }

  .status-returned,
  .status-cancelled,
  .status-rejected {
    background: #fee2e2;
    color: #b91c1c;
  }

  .status-inactive,
  .status-unknown {
    background: #f1f5f9;
    color: #475569;
  }

  .location-cell {
    display: flex;
    align-items: center;
    gap: 6px;
    color: #64748b;
  }

  .action-cell {
    display: flex;
    gap: 6px;
  }

  .icon-button {
    width: 34px;
    height: 34px;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background: #fff;
    color: #475569;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: .2s ease;
  }

  .icon-button:hover {
    border-color: #7dd3fc;
    color: #0284c7;
    background: #f0f9ff;
  }

  .loading-state,
  .empty-state {
    padding: 60px 25px;
    text-align: center;
  }

  .spinner {
    width: 32px;
    height: 32px;
    margin: 0 auto 12px;
    border: 3px solid #e2e8f0;
    border-top-color: #0ea5e9;
    border-radius: 50%;
    animation: spin .8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .empty-icon {
    width: 58px;
    height: 58px;
    margin: 0 auto 14px;
    border-radius: 16px;
    background: #f1f5f9;
    color: #94a3b8;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .empty-state h3 {
    margin: 0;
    font-size: 16px;
    color: #334155;
  }

  .empty-state p {
    max-width: 480px;
    margin: 7px auto 0;
    color: #94a3b8;
    font-size: 13px;
    line-height: 1.6;
  }

  .error-box {
    margin-bottom: 18px;
    padding: 14px 16px;
    border: 1px solid #fecaca;
    background: #fff7f7;
    border-radius: 12px;
    color: #991b1b;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 15px;
    font-size: 13px;
  }

  .error-message {
    display: flex;
    align-items: center;
    gap: 9px;
  }

  .pagination {
    padding: 15px 18px;
    border-top: 1px solid #e2e8f0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 15px;
  }

  .pagination-info {
    color: #64748b;
    font-size: 12px;
  }

  .pagination-actions {
    display: flex;
    gap: 6px;
  }

  .page-button {
    min-width: 34px;
    height: 34px;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background: #fff;
    color: #475569;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 12px;
    font-weight: 750;
  }

  .page-button:hover:not(:disabled) {
    border-color: #7dd3fc;
    color: #0284c7;
  }

  .page-button.active {
    background: #0ea5e9;
    color: #fff;
    border-color: #0ea5e9;
  }

  .page-button:disabled {
    opacity: .45;
    cursor: not-allowed;
  }

  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, .52);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    z-index: 1000;
  }

  .modal {
    width: 100%;
    max-width: 760px;
    max-height: 90vh;
    overflow-y: auto;
    background: #fff;
    border-radius: 16px;
    box-shadow: 0 25px 70px rgba(15, 23, 42, .25);
  }

  .modal-header {
    padding: 18px 20px;
    border-bottom: 1px solid #e2e8f0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 15px;
    position: sticky;
    top: 0;
    background: #fff;
    z-index: 2;
  }

  .modal-heading {
    display: flex;
    align-items: center;
    gap: 11px;
  }

  .modal-heading-icon {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: #e0f2fe;
    color: #0284c7;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .modal-heading h3 {
    margin: 0;
    font-size: 17px;
    font-weight: 800;
  }

  .modal-heading p {
    margin: 3px 0 0;
    color: #94a3b8;
    font-size: 11px;
  }

  .close-button {
    width: 35px;
    height: 35px;
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
    padding: 20px;
  }

  .detail-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    overflow: hidden;
  }

  .detail-item {
    padding: 14px;
    border-bottom: 1px solid #e2e8f0;
  }

  .detail-item:nth-child(odd) {
    border-right: 1px solid #e2e8f0;
  }

  .detail-label {
    display: block;
    margin-bottom: 5px;
    color: #94a3b8;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: .5px;
    font-weight: 800;
  }

  .detail-value {
    color: #334155;
    font-size: 13px;
    font-weight: 650;
    word-break: break-word;
  }

  .modal-footer {
    padding: 15px 20px;
    border-top: 1px solid #e2e8f0;
    display: flex;
    justify-content: flex-end;
    gap: 9px;
    flex-wrap: wrap;
  }

  .form-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
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

  .required {
    color: #dc2626;
  }

  .form-help {
    color: #94a3b8;
    font-size: 11px;
  }

  .form-error {
    margin-top: 14px;
    padding: 11px 13px;
    border: 1px solid #fecaca;
    background: #fff7f7;
    color: #991b1b;
    border-radius: 9px;
    font-size: 12px;
    display: flex;
    gap: 8px;
    align-items: flex-start;
  }

  .modal-loading {
    padding: 35px;
    text-align: center;
    color: #64748b;
  }

  @media (max-width: 1200px) {
    .summary-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .filter-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 760px) {
    .assignment-container {
      padding: 18px 14px;
    }

    .assignment-header {
      flex-direction: column;
    }

    .header-actions {
      width: 100%;
    }

    .header-actions .button {
      flex: 1;
    }

    .summary-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .filter-grid,
    .form-grid {
      grid-template-columns: 1fr;
    }

    .form-group.full {
      grid-column: auto;
    }

    .table-header {
      flex-direction: column;
      align-items: flex-start;
    }

    .pagination {
      flex-direction: column;
      align-items: flex-start;
    }

    .detail-grid {
      grid-template-columns: 1fr;
    }

    .detail-item:nth-child(odd) {
      border-right: 0;
    }
  }

  @media (max-width: 480px) {
    .summary-grid {
      grid-template-columns: 1fr;
    }

    .page-title {
      font-size: 23px;
    }
  }
`;

const normalize = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase();

const getValue = (obj, keys, fallback = "") => {
  for (const key of keys) {
    if (
      obj &&
      Object.prototype.hasOwnProperty.call(obj, key) &&
      obj[key] !== null &&
      obj[key] !== undefined &&
      obj[key] !== ""
    ) {
      return obj[key];
    }
  }
  return fallback;
};

const getId = (item) =>
  getValue(item, ["id", "assignment_id", "assignmentId"], "");

const getAssetId = (item) =>
  getValue(item, ["asset_id", "assetId", "assetID"], "");

const getAssetName = (item) =>
  getValue(
    item,
    ["asset_name", "assetName", "name", "asset"],
    "Unknown Asset"
  );

const getAssetTag = (item) =>
  getValue(
    item,
    ["asset_tag", "assetTag", "tag", "asset_code", "assetCode"],
    "—"
  );

const getSerial = (item) =>
  getValue(
    item,
    ["serial_number", "serialNumber", "serial", "serial_no"],
    "—"
  );

const getAssigneeName = (item) =>
  getValue(
    item,
    [
      "assigned_to_name",
      "assignedToName",
      "assignee_name",
      "assigneeName",
      "user_name",
      "userName",
      "employee_name",
      "employeeName",
      "assigned_to",
      "assignedTo",
    ],
    "Unassigned"
  );

const getAssigneeId = (item) =>
  getValue(
    item,
    [
      "assigned_to_id",
      "assignedToId",
      "user_id",
      "userId",
      "employee_id",
      "employeeId",
    ],
    ""
  );

const getRole = (item) =>
  getValue(
    item,
    ["assigned_to_role", "assignedToRole", "role", "position"],
    "—"
  );

const getLocation = (item) =>
  getValue(
    item,
    [
      "location_name",
      "locationName",
      "location",
      "assigned_location",
      "assignedLocation",
      "building",
    ],
    "—"
  );

const getStatus = (item) =>
  getValue(
    item,
    ["assignment_status", "assignmentStatus", "status"],
    "Unknown"
  );

const getAssignmentDate = (item) =>
  getValue(
    item,
    [
      "assigned_at",
      "assignedAt",
      "assignment_date",
      "assignmentDate",
      "created_at",
      "createdAt",
    ],
    ""
  );

const getReturnDate = (item) =>
  getValue(
    item,
    ["returned_at", "returnedAt", "return_date", "returnDate"],
    ""
  );

const getNotes = (item) =>
  getValue(item, ["notes", "remarks", "description"], "—");

const formatDate = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
};

const formatNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number)
    ? new Intl.NumberFormat().format(number)
    : "0";
};

const getStatusClass = (status) => {
  const value = normalize(status);

  if (
    ["active", "assigned", "approved"].some((x) =>
      value.includes(x)
    )
  ) {
    return "status-active";
  }

  if (["pending"].some((x) => value.includes(x))) {
    return "status-pending";
  }

  if (
    ["returned", "cancelled", "rejected"].some((x) =>
      value.includes(x)
    )
  ) {
    return "status-returned";
  }

  return "status-unknown";
};

const getStatusIcon = (status) => {
  const value = normalize(status);

  if (
    ["active", "assigned", "approved"].some((x) =>
      value.includes(x)
    )
  ) {
    return <CheckCircle2 size={12} />;
  }

  if (value.includes("pending")) {
    return <AlertCircle size={12} />;
  }

  if (
    ["returned", "cancelled", "rejected"].some((x) =>
      value.includes(x)
    )
  ) {
    return <XCircle size={12} />;
  }

  return <AlertCircle size={12} />;
};

const extractData = (data) => {
  if (Array.isArray(data)) {
    return {
      items: data,
      total: data.length,
      totalPages: Math.max(1, Math.ceil(data.length / PAGE_SIZE)),
      summary: null,
    };
  }

  if (!data || typeof data !== "object") {
    return {
      items: [],
      total: 0,
      totalPages: 1,
      summary: null,
    };
  }

  const items =
    data.assignments ||
    data.data ||
    data.rows ||
    data.results ||
    data.items ||
    [];

  const pagination = data.pagination || {};

  const total = Number(
    pagination.total ??
      data.total ??
      data.totalCount ??
      data.count ??
      (Array.isArray(items) ? items.length : 0)
  );

  const limit = Number(
    pagination.limit ??
      data.limit ??
      data.pageSize ??
      PAGE_SIZE
  );

  const totalPages = Number(
    pagination.totalPages ??
      data.totalPages ??
      Math.max(1, Math.ceil(total / Math.max(limit, 1)))
  );

  return {
    items: Array.isArray(items) ? items : [],
    total: Number.isFinite(total) ? total : 0,
    totalPages:
      Number.isFinite(totalPages) && totalPages > 0
        ? totalPages
        : 1,
    summary:
      data.summary ||
      data.statistics ||
      data.stats ||
      null,
  };
};

const extractList = (data, keys = []) => {
  if (Array.isArray(data)) return data;

  if (!data || typeof data !== "object") return [];

  for (const key of keys) {
    if (Array.isArray(data[key])) {
      return data[key];
    }
  }

  if (Array.isArray(data.data)) {
    return data.data;
  }

  if (Array.isArray(data.results)) {
    return data.results;
  }

  return [];
};

const InfrastructureAssignment = () => {
  const [assignments, setAssignments] = useState([]);
  const [users, setUsers] = useState([]);
  const [assets, setAssets] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState("");
  const [modalError, setModalError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [summary, setSummary] = useState(null);

  const [selectedAssignment, setSelectedAssignment] =
    useState(null);

  const [showCreateModal, setShowCreateModal] =
    useState(false);

  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    assetId: "",
    userId: "",
    location: "",
    assignmentDate: new Date()
      .toISOString()
      .slice(0, 10),
    notes: "",
  });

  const loadAssignments = useCallback(
    async ({ silent = false } = {}) => {
      try {
        if (silent) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");

        const params = {
          page,
          limit: PAGE_SIZE,
        };

        if (search.trim()) {
          params.search = search.trim();
        }

        if (statusFilter) {
          params.status = statusFilter;
        }

        const response = await api.get(
          "/infrastructure/assignment",
          { params }
        );

        const parsed = extractData(response.data);

        setAssignments(parsed.items);
        setTotal(parsed.total);
        setTotalPages(parsed.totalPages);
        setSummary(parsed.summary);
      } catch (err) {
        console.error(
          "Infrastructure assignment loading error:",
          err
        );

        setAssignments([]);
        setTotal(0);
        setTotalPages(1);

        setError(
          err?.response?.data?.message ||
            err?.response?.data?.error ||
            err?.message ||
            "Unable to load asset assignments."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [page, search, statusFilter]
  );

  const loadFormData = useCallback(async () => {
    try {
      const [usersResponse, assetsResponse] =
        await Promise.all([
          api.get("/infrastructure/assignment/users"),
          api.get("/infrastructure/assignment/assets"),
        ]);

      setUsers(
        extractList(usersResponse.data, [
          "users",
          "employees",
          "staff",
        ])
      );

      setAssets(
        extractList(assetsResponse.data, [
          "assets",
          "inventory",
        ])
      );
    } catch (err) {
      /*
       * Do not create fallback/fake users or assets.
       * If these endpoints are unavailable, the assignment
       * form will display the real backend error.
       */
      console.error(
        "Assignment form data loading error:",
        err
      );

      setModalError(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Unable to load users and available assets."
      );
    }
  }, []);

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const calculatedSummary = useMemo(() => {
    let active = 0;
    let pending = 0;
    let returned = 0;
    let cancelled = 0;

    assignments.forEach((assignment) => {
      const status = normalize(getStatus(assignment));

      if (
        status.includes("active") ||
        status.includes("assigned") ||
        status.includes("approved")
      ) {
        active += 1;
      }

      if (status.includes("pending")) {
        pending += 1;
      }

      if (status.includes("returned")) {
        returned += 1;
      }

      if (
        status.includes("cancelled") ||
        status.includes("rejected")
      ) {
        cancelled += 1;
      }
    });

    return {
      total: total || assignments.length,
      active,
      pending,
      returned,
      cancelled,
    };
  }, [assignments, total]);

  const assignmentSummary = {
    total:
      summary?.total ??
      summary?.totalAssignments ??
      calculatedSummary.total,

    active:
      summary?.active ??
      summary?.activeAssignments ??
      summary?.assigned ??
      calculatedSummary.active,

    pending:
      summary?.pending ??
      summary?.pendingAssignments ??
      calculatedSummary.pending,

    returned:
      summary?.returned ??
      summary?.returnedAssignments ??
      calculatedSummary.returned,

    cancelled:
      summary?.cancelled ??
      summary?.cancelledAssignments ??
      calculatedSummary.cancelled,
  };

  const statusOptions = useMemo(() => {
    return [
      ...new Set(
        assignments
          .map((item) => String(getStatus(item)))
          .filter(Boolean)
      ),
    ].sort();
  }, [assignments]);

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("");
    setPage(1);
  };

  const openCreateModal = async () => {
    setModalError("");

    setForm({
      assetId: "",
      userId: "",
      location: "",
      assignmentDate: new Date()
        .toISOString()
        .slice(0, 10),
      notes: "",
    });

    setShowCreateModal(true);

    await loadFormData();
  };

  const closeCreateModal = () => {
    if (submitting) return;

    setShowCreateModal(false);
    setModalError("");
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const submitAssignment = async (event) => {
    event.preventDefault();

    if (!form.assetId || !form.userId) {
      setModalError(
        "Please select both an asset and an assignee."
      );
      return;
    }

    try {
      setSubmitting(true);
      setModalError("");

      await api.post("/infrastructure/assignment", {
        assetId: form.assetId,
        userId: form.userId,
        location: form.location || null,
        assignmentDate: form.assignmentDate || null,
        notes: form.notes || null,
      });

      setShowCreateModal(false);

      await loadAssignments({ silent: true });
    } catch (err) {
      console.error(
        "Infrastructure assignment creation error:",
        err
      );

      setModalError(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Unable to create the asset assignment."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const cancelAssignment = async (assignment) => {
    const assignmentId = getId(assignment);

    if (!assignmentId) {
      return;
    }

    const confirmed = window.confirm(
      `Cancel assignment for "${getAssetName(
        assignment
      )}"?`
    );

    if (!confirmed) {
      return;
    }

    try {
      await api.patch(
        `/infrastructure/assignment/${assignmentId}/cancel`
      );

      await loadAssignments({ silent: true });

      setSelectedAssignment(null);
    } catch (err) {
      console.error(
        "Assignment cancellation error:",
        err
      );

      window.alert(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Unable to cancel the assignment."
      );
    }
  };

  const returnAssignment = async (assignment) => {
    const assignmentId = getId(assignment);

    if (!assignmentId) {
      return;
    }

    const confirmed = window.confirm(
      `Mark "${getAssetName(
        assignment
      )}" as returned?`
    );

    if (!confirmed) {
      return;
    }

    try {
      await api.patch(
        `/infrastructure/assignment/${assignmentId}/return`
      );

      await loadAssignments({ silent: true });

      setSelectedAssignment(null);
    } catch (err) {
      console.error(
        "Assignment return error:",
        err
      );

      window.alert(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Unable to return the assignment."
      );
    }
  };

  const goToPage = (nextPage) => {
    if (
      nextPage < 1 ||
      nextPage > Math.max(1, totalPages)
    ) {
      return;
    }

    setPage(nextPage);
  };

  const pageNumbers = useMemo(() => {
    const pages = Math.max(1, totalPages);

    if (pages <= 5) {
      return Array.from(
        { length: pages },
        (_, index) => index + 1
      );
    }

    if (page <= 3) {
      return [1, 2, 3, 4, 5];
    }

    if (page >= pages - 2) {
      return [
        pages - 4,
        pages - 3,
        pages - 2,
        pages - 1,
        pages,
      ];
    }

    return [
      page - 2,
      page - 1,
      page,
      page + 1,
      page + 2,
    ];
  }, [page, totalPages]);

  const startRecord =
    total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;

  const endRecord =
    total === 0
      ? 0
      : Math.min(page * PAGE_SIZE, total);

  return (
    <div className="infra-assignment-page">
      <style>{css}</style>

      <main className="assignment-container">
        <header className="assignment-header">
          <div className="header-left">
            <Link
              to="/infrastructure"
              className="back-button"
              title="Back to Infrastructure"
            >
              <ArrowLeft size={18} />
            </Link>

            <div>
              <h1 className="page-title">
                Asset Assignment
              </h1>

              <p className="page-subtitle">
                Assign infrastructure assets to authorized
                university staff, departments, or responsible
                personnel and monitor current assignments.
              </p>
            </div>
          </div>

          <div className="header-actions">
            <button
              type="button"
              className="button button-secondary"
              onClick={() =>
                loadAssignments({ silent: true })
              }
              disabled={loading || refreshing}
            >
              <RefreshCw size={16} />
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>

            <button
              type="button"
              className="button button-primary"
              onClick={openCreateModal}
            >
              <Plus size={16} />
              New Assignment
            </button>
          </div>
        </header>

        {error && (
          <div className="error-box">
            <div className="error-message">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>

            <button
              type="button"
              className="button button-secondary"
              onClick={() => loadAssignments()}
            >
              Retry
            </button>
          </div>
        )}

        <section className="summary-grid">
          <div className="summary-card">
            <div className="summary-icon">
              <ClipboardList size={19} />
            </div>
            <div className="summary-value">
              {formatNumber(assignmentSummary.total)}
            </div>
            <div className="summary-label">
              Total Assignments
            </div>
          </div>

          <div className="summary-card success">
            <div className="summary-icon">
              <CheckCircle2 size={19} />
            </div>
            <div className="summary-value">
              {formatNumber(assignmentSummary.active)}
            </div>
            <div className="summary-label">
              Active Assignments
            </div>
          </div>

          <div className="summary-card warning">
            <div className="summary-icon">
              <AlertCircle size={19} />
            </div>
            <div className="summary-value">
              {formatNumber(assignmentSummary.pending)}
            </div>
            <div className="summary-label">
              Pending Assignments
            </div>
          </div>

          <div className="summary-card dark">
            <div className="summary-icon">
              <PackageCheck size={19} />
            </div>
            <div className="summary-value">
              {formatNumber(assignmentSummary.returned)}
            </div>
            <div className="summary-label">
              Returned
            </div>
          </div>

          <div className="summary-card danger">
            <div className="summary-icon">
              <XCircle size={19} />
            </div>
            <div className="summary-value">
              {formatNumber(assignmentSummary.cancelled)}
            </div>
            <div className="summary-label">
              Cancelled / Rejected
            </div>
          </div>
        </section>

        <section className="filter-card">
          <div className="filter-header">
            <div className="filter-title">
              <Filter size={17} />
              Assignment Filters
            </div>

            {(search.trim() || statusFilter) && (
              <button
                type="button"
                className="clear-button"
                onClick={clearFilters}
              >
                Clear filters
              </button>
            )}
          </div>

          <div className="filter-grid">
            <div className="input-wrap">
              <Search
                size={17}
                className="input-icon"
              />

              <input
                type="text"
                className="filter-input"
                placeholder="Search asset, tag, serial, assignee..."
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
              />
            </div>

            <select
              className="filter-select"
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value)
              }
            >
              <option value="">
                All Assignment Statuses
              </option>

              {statusOptions.map((status) => (
                <option
                  key={status}
                  value={status}
                >
                  {status}
                </option>
              ))}
            </select>

            <div />

            <div />
          </div>
        </section>

        <section className="table-card">
          <div className="table-header">
            <div className="table-title">
              <Users size={18} color="#0284c7" />
              <h2>Infrastructure Asset Assignments</h2>
              <span className="count-badge">
                {formatNumber(total)}
              </span>
            </div>

            <span
              style={{
                color: "#64748b",
                fontSize: 12,
              }}
            >
              Live assignment records
            </span>
          </div>

          {loading ? (
            <div className="loading-state">
              <div className="spinner" />
              <div>
                Loading infrastructure assignments...
              </div>
            </div>
          ) : assignments.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                <ClipboardList size={28} />
              </div>

              <h3>
                {search || statusFilter
                  ? "No matching assignments"
                  : "No asset assignments found"}
              </h3>

              <p>
                {search || statusFilter
                  ? "Try changing the search or status filter."
                  : "There are currently no assignment records returned by the backend."}
              </p>

              {(search || statusFilter) && (
                <button
                  type="button"
                  className="button button-secondary"
                  style={{ marginTop: 15 }}
                  onClick={clearFilters}
                >
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="table-wrapper">
                <table className="assignment-table">
                  <thead>
                    <tr>
                      <th>Asset</th>
                      <th>Assignee</th>
                      <th>Location</th>
                      <th>Status</th>
                      <th>Assignment Date</th>
                      <th>Return Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {assignments.map(
                      (assignment, index) => {
                        const id = getId(assignment);

                        return (
                          <tr
                            key={
                              id ||
                              `${getAssetTag(
                                assignment
                              )}-${index}`
                            }
                          >
                            <td>
                              <div className="asset-cell">
                                <div className="asset-icon">
                                  <Building2 size={18} />
                                </div>

                                <div>
                                  <div className="asset-name">
                                    {getAssetName(
                                      assignment
                                    )}
                                  </div>

                                  <div className="asset-tag">
                                    {getAssetTag(
                                      assignment
                                    )}{" "}
                                    • Serial:{" "}
                                    {getSerial(
                                      assignment
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td>
                              <div className="person-cell">
                                <div className="person-avatar">
                                  <UserRound size={16} />
                                </div>

                                <div>
                                  <div className="person-name">
                                    {getAssigneeName(
                                      assignment
                                    )}
                                  </div>

                                  <div className="person-role">
                                    {getRole(assignment)}
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td>
                              <div className="location-cell">
                                <MapPin size={14} />
                                {getLocation(
                                  assignment
                                )}
                              </div>
                            </td>

                            <td>
                              <span
                                className={`status ${getStatusClass(
                                  getStatus(
                                    assignment
                                  )
                                )}`}
                              >
                                {getStatusIcon(
                                  getStatus(
                                    assignment
                                  )
                                )}
                                {getStatus(assignment)}
                              </span>
                            </td>

                            <td>
                              {formatDate(
                                getAssignmentDate(
                                  assignment
                                )
                              )}
                            </td>

                            <td>
                              {formatDate(
                                getReturnDate(
                                  assignment
                                )
                              )}
                            </td>

                            <td>
                              <div className="action-cell">
                                <button
                                  type="button"
                                  className="icon-button"
                                  title="View assignment"
                                  onClick={() =>
                                    setSelectedAssignment(
                                      assignment
                                    )
                                  }
                                >
                                  <Eye size={16} />
                                </button>

                                {id &&
                                  ![
                                    "returned",
                                    "cancelled",
                                    "rejected",
                                  ].some((value) =>
                                    normalize(
                                      getStatus(
                                        assignment
                                      )
                                    ).includes(value)
                                  ) && (
                                    <button
                                      type="button"
                                      className="icon-button"
                                      title="Return asset"
                                      onClick={() =>
                                        returnAssignment(
                                          assignment
                                        )
                                      }
                                    >
                                      <PackageCheck
                                        size={16}
                                      />
                                    </button>
                                  )}

                                {id &&
                                  ![
                                    "returned",
                                    "cancelled",
                                    "rejected",
                                  ].some((value) =>
                                    normalize(
                                      getStatus(
                                        assignment
                                      )
                                    ).includes(value)
                                  ) && (
                                    <button
                                      type="button"
                                      className="icon-button"
                                      title="Cancel assignment"
                                      onClick={() =>
                                        cancelAssignment(
                                          assignment
                                        )
                                      }
                                    >
                                      <XCircle
                                        size={16}
                                      />
                                    </button>
                                  )}
                              </div>
                            </td>
                          </tr>
                        );
                      }
                    )}
                  </tbody>
                </table>
              </div>

              <div className="pagination">
                <div className="pagination-info">
                  Showing{" "}
                  <strong>
                    {formatNumber(startRecord)}
                  </strong>{" "}
                  –{" "}
                  <strong>
                    {formatNumber(endRecord)}
                  </strong>{" "}
                  of{" "}
                  <strong>{formatNumber(total)}</strong>
                </div>

                <div className="pagination-actions">
                  <button
                    type="button"
                    className="page-button"
                    disabled={page <= 1}
                    onClick={() =>
                      goToPage(page - 1)
                    }
                  >
                    <ChevronLeft size={16} />
                  </button>

                  {pageNumbers.map((pageNumber) => (
                    <button
                      type="button"
                      key={pageNumber}
                      className={`page-button ${
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
                    className="page-button"
                    disabled={
                      page >= totalPages
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
        </section>
      </main>

      {selectedAssignment && (
        <div
          className="modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setSelectedAssignment(null);
            }
          }}
        >
          <div className="modal">
            <div className="modal-header">
              <div className="modal-heading">
                <div className="modal-heading-icon">
                  <ClipboardList size={19} />
                </div>

                <div>
                  <h3>
                    Assignment Details
                  </h3>

                  <p>
                    Infrastructure asset assignment
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="close-button"
                onClick={() =>
                  setSelectedAssignment(null)
                }
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <div
                style={{
                  display: "flex",
                  justifyContent:
                    "space-between",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 18,
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <strong
                    style={{
                      fontSize: 16,
                      color: "#0f172a",
                    }}
                  >
                    {getAssetName(
                      selectedAssignment
                    )}
                  </strong>

                  <div
                    style={{
                      marginTop: 4,
                      color: "#94a3b8",
                      fontSize: 12,
                    }}
                  >
                    {getAssetTag(
                      selectedAssignment
                    )}
                  </div>
                </div>

                <span
                  className={`status ${getStatusClass(
                    getStatus(
                      selectedAssignment
                    )
                  )}`}
                >
                  {getStatusIcon(
                    getStatus(
                      selectedAssignment
                    )
                  )}
                  {getStatus(selectedAssignment)}
                </span>
              </div>

              <div className="detail-grid">
                <div className="detail-item">
                  <span className="detail-label">
                    Assignment ID
                  </span>
                  <span className="detail-value">
                    {getId(
                      selectedAssignment
                    ) || "—"}
                  </span>
                </div>

                <div className="detail-item">
                  <span className="detail-label">
                    Asset ID
                  </span>
                  <span className="detail-value">
                    {getAssetId(
                      selectedAssignment
                    ) || "—"}
                  </span>
                </div>

                <div className="detail-item">
                  <span className="detail-label">
                    Asset Name
                  </span>
                  <span className="detail-value">
                    {getAssetName(
                      selectedAssignment
                    )}
                  </span>
                </div>

                <div className="detail-item">
                  <span className="detail-label">
                    Asset Tag
                  </span>
                  <span className="detail-value">
                    {getAssetTag(
                      selectedAssignment
                    )}
                  </span>
                </div>

                <div className="detail-item">
                  <span className="detail-label">
                    Serial Number
                  </span>
                  <span className="detail-value">
                    {getSerial(
                      selectedAssignment
                    )}
                  </span>
                </div>

                <div className="detail-item">
                  <span className="detail-label">
                    Assignee
                  </span>
                  <span className="detail-value">
                    {getAssigneeName(
                      selectedAssignment
                    )}
                  </span>
                </div>

                <div className="detail-item">
                  <span className="detail-label">
                    Assignee ID
                  </span>
                  <span className="detail-value">
                    {getAssigneeId(
                      selectedAssignment
                    ) || "—"}
                  </span>
                </div>

                <div className="detail-item">
                  <span className="detail-label">
                    Role / Position
                  </span>
                  <span className="detail-value">
                    {getRole(
                      selectedAssignment
                    )}
                  </span>
                </div>

                <div className="detail-item">
                  <span className="detail-label">
                    Location
                  </span>
                  <span className="detail-value">
                    {getLocation(
                      selectedAssignment
                    )}
                  </span>
                </div>

                <div className="detail-item">
                  <span className="detail-label">
                    Assignment Date
                  </span>
                  <span className="detail-value">
                    {formatDate(
                      getAssignmentDate(
                        selectedAssignment
                      )
                    )}
                  </span>
                </div>

                <div className="detail-item">
                  <span className="detail-label">
                    Return Date
                  </span>
                  <span className="detail-value">
                    {formatDate(
                      getReturnDate(
                        selectedAssignment
                      )
                    )}
                  </span>
                </div>

                <div className="detail-item">
                  <span className="detail-label">
                    Notes
                  </span>
                  <span className="detail-value">
                    {getNotes(
                      selectedAssignment
                    )}
                  </span>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              {getId(selectedAssignment) &&
                ![
                  "returned",
                  "cancelled",
                  "rejected",
                ].some((value) =>
                  normalize(
                    getStatus(
                      selectedAssignment
                    )
                  ).includes(value)
                ) && (
                  <>
                    <button
                      type="button"
                      className="button button-secondary"
                      onClick={() =>
                        returnAssignment(
                          selectedAssignment
                        )
                      }
                    >
                      <PackageCheck size={15} />
                      Return Asset
                    </button>

                    <button
                      type="button"
                      className="button button-danger"
                      onClick={() =>
                        cancelAssignment(
                          selectedAssignment
                        )
                      }
                    >
                      <XCircle size={15} />
                      Cancel Assignment
                    </button>
                  </>
                )}

              <button
                type="button"
                className="button button-secondary"
                onClick={() =>
                  setSelectedAssignment(null)
                }
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <div className="modal-heading">
                <div className="modal-heading-icon">
                  <ArrowRightLeft size={19} />
                </div>

                <div>
                  <h3>
                    Create Asset Assignment
                  </h3>

                  <p>
                    Assign an infrastructure asset to a
                    responsible person
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="close-button"
                onClick={closeCreateModal}
                disabled={submitting}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={submitAssignment}>
              <div className="modal-body">
                {modalError && (
                  <div className="form-error">
                    <AlertCircle size={16} />
                    <span>{modalError}</span>
                  </div>
                )}

                <div
                  style={{
                    height: modalError ? 15 : 0,
                  }}
                />

                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">
                      Infrastructure Asset{" "}
                      <span className="required">
                        *
                      </span>
                    </label>

                    <select
                      name="assetId"
                      className="form-select"
                      value={form.assetId}
                      onChange={handleFormChange}
                      disabled={submitting}
                      required
                    >
                      <option value="">
                        Select asset
                      </option>

                      {assets.map((asset) => {
                        const id = getValue(
                          asset,
                          [
                            "id",
                            "asset_id",
                            "assetId",
                          ],
                          ""
                        );

                        return (
                          <option
                            key={id}
                            value={id}
                          >
                            {getAssetName(asset)} —{" "}
                            {getAssetTag(asset)}
                          </option>
                        );
                      })}
                    </select>

                    <span className="form-help">
                      Only assets returned by the backend
                      are shown.
                    </span>
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Assign To{" "}
                      <span className="required">
                        *
                      </span>
                    </label>

                    <select
                      name="userId"
                      className="form-select"
                      value={form.userId}
                      onChange={handleFormChange}
                      disabled={submitting}
                      required
                    >
                      <option value="">
                        Select staff member
                      </option>

                      {users.map((user) => {
                        const id = getValue(
                          user,
                          [
                            "id",
                            "user_id",
                            "userId",
                            "employee_id",
                            "employeeId",
                          ],
                          ""
                        );

                        const name = getValue(
                          user,
                          [
                            "name",
                            "full_name",
                            "fullName",
                            "username",
                            "email",
                          ],
                          "Unknown User"
                        );

                        const role = getValue(
                          user,
                          [
                            "role",
                            "position",
                            "job_title",
                          ],
                          ""
                        );

                        return (
                          <option
                            key={id}
                            value={id}
                          >
                            {name}
                            {role
                              ? ` — ${role}`
                              : ""}
                          </option>
                        );
                      })}
                    </select>

                    <span className="form-help">
                      Users are loaded from the real
                      backend.
                    </span>
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Assignment Date
                    </label>

                    <input
                      type="date"
                      name="assignmentDate"
                      className="form-input"
                      value={form.assignmentDate}
                      onChange={handleFormChange}
                      disabled={submitting}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Assignment Location
                    </label>

                    <input
                      type="text"
                      name="location"
                      className="form-input"
                      placeholder="Building, block, room..."
                      value={form.location}
                      onChange={handleFormChange}
                      disabled={submitting}
                    />
                  </div>

                  <div className="form-group full">
                    <label className="form-label">
                      Notes
                    </label>

                    <textarea
                      name="notes"
                      className="form-textarea"
                      placeholder="Assignment notes or responsibility details..."
                      value={form.notes}
                      onChange={handleFormChange}
                      disabled={submitting}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={closeCreateModal}
                  disabled={submitting}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="button button-primary"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <RefreshCw size={15} />
                      Assigning...
                    </>
                  ) : (
                    <>
                      <PackageCheck size={15} />
                      Create Assignment
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default InfrastructureAssignment;