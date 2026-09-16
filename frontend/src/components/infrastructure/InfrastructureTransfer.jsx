import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  ArrowRightLeft,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Eye,
  Filter,
  MapPin,
  Package,
  Plus,
  RefreshCw,
  Search,
  UserRound,
  X,
  XCircle,
} from "lucide-react";

const PAGE_SIZE = 10;

const css = `
  .transfer-page {
    min-height: 100vh;
    background: #f8fafc;
    color: #0f172a;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system,
      BlinkMacSystemFont, "Segoe UI", sans-serif;
  }

  .transfer-container {
    max-width: 1600px;
    margin: 0 auto;
    padding: 28px;
  }

  .transfer-header {
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
    color: #fff;
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
    grid-template-columns: minmax(250px, 2fr) repeat(2, minmax(170px, 1fr));
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
  .filter-select,
  .form-input,
  .form-select {
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
    padding: 0 13px;
  }

  .form-textarea {
    min-height: 95px;
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

  .transfer-table {
    width: 100%;
    min-width: 1150px;
    border-collapse: collapse;
  }

  .transfer-table th {
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

  .transfer-table td {
    padding: 15px 16px;
    border-bottom: 1px solid #eef2f7;
    color: #334155;
    font-size: 13px;
    vertical-align: middle;
  }

  .transfer-table tbody tr:hover {
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

  .route-cell {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 250px;
  }

  .route-location {
    max-width: 125px;
  }

  .route-label {
    color: #94a3b8;
    font-size: 10px;
    text-transform: uppercase;
    font-weight: 800;
    margin-bottom: 3px;
  }

  .route-value {
    color: #334155;
    font-weight: 700;
    font-size: 12px;
    word-break: break-word;
  }

  .route-arrow {
    width: 30px;
    height: 30px;
    flex-shrink: 0;
    border-radius: 8px;
    background: #f0f9ff;
    color: #0284c7;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .person-cell {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .person-avatar {
    width: 32px;
    height: 32px;
    flex-shrink: 0;
    border-radius: 50%;
    background: #eff6ff;
    color: #2563eb;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .person-name {
    font-weight: 700;
    color: #334155;
  }

  .person-role {
    margin-top: 2px;
    color: #94a3b8;
    font-size: 10px;
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

  .status-approved,
  .status-completed,
  .status-active {
    background: #dcfce7;
    color: #166534;
  }

  .status-pending,
  .status-requested {
    background: #fef3c7;
    color: #92400e;
  }

  .status-rejected,
  .status-cancelled {
    background: #fee2e2;
    color: #b91c1c;
  }

  .status-in-transit {
    background: #dbeafe;
    color: #1d4ed8;
  }

  .status-unknown {
    background: #f1f5f9;
    color: #475569;
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
    margin-bottom: 15px;
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

  @media (max-width: 1200px) {
    .summary-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .filter-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 760px) {
    .transfer-container {
      padding: 18px 14px;
    }

    .transfer-header {
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
  getValue(item, ["id", "transfer_id", "transferId"], "");

const getAssetId = (item) =>
  getValue(item, ["asset_id", "assetId"], "");

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

const getFromLocation = (item) =>
  getValue(
    item,
    [
      "from_location_name",
      "fromLocationName",
      "from_location",
      "fromLocation",
      "source_location",
      "sourceLocation",
      "old_location",
      "oldLocation",
    ],
    "—"
  );

const getToLocation = (item) =>
  getValue(
    item,
    [
      "to_location_name",
      "toLocationName",
      "to_location",
      "toLocation",
      "destination_location",
      "destinationLocation",
      "new_location",
      "newLocation",
    ],
    "—"
  );

const getRequestedBy = (item) =>
  getValue(
    item,
    [
      "requested_by_name",
      "requestedByName",
      "requester_name",
      "requesterName",
      "requested_by",
      "requestedBy",
      "user_name",
      "userName",
    ],
    "—"
  );

const getApprovedBy = (item) =>
  getValue(
    item,
    [
      "approved_by_name",
      "approvedByName",
      "approver_name",
      "approverName",
      "approved_by",
      "approvedBy",
    ],
    "—"
  );

const getStatus = (item) =>
  getValue(
    item,
    ["transfer_status", "transferStatus", "status"],
    "Unknown"
  );

const getTransferDate = (item) =>
  getValue(
    item,
    [
      "transfer_date",
      "transferDate",
      "transferred_at",
      "transferredAt",
      "created_at",
      "createdAt",
    ],
    ""
  );

const getCompletedDate = (item) =>
  getValue(
    item,
    [
      "completed_at",
      "completedAt",
      "completion_date",
      "completionDate",
    ],
    ""
  );

const getReason = (item) =>
  getValue(
    item,
    ["reason", "transfer_reason", "transferReason", "notes", "remarks"],
    "—"
  );

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
    value.includes("approved") ||
    value.includes("completed") ||
    value.includes("active")
  ) {
    return "status-approved";
  }

  if (
    value.includes("pending") ||
    value.includes("requested")
  ) {
    return "status-pending";
  }

  if (value.includes("transit")) {
    return "status-in-transit";
  }

  if (
    value.includes("rejected") ||
    value.includes("cancelled")
  ) {
    return "status-rejected";
  }

  return "status-unknown";
};

const getStatusIcon = (status) => {
  const value = normalize(status);

  if (
    value.includes("approved") ||
    value.includes("completed") ||
    value.includes("active")
  ) {
    return <CheckCircle2 size={12} />;
  }

  if (
    value.includes("rejected") ||
    value.includes("cancelled")
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
      totalPages: Math.max(
        1,
        Math.ceil(data.length / PAGE_SIZE)
      ),
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
    data.transfers ||
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
      Math.max(
        1,
        Math.ceil(total / Math.max(limit, 1))
      )
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

  if (!data || typeof data !== "object") {
    return [];
  }

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

const InfrastructureTransfer = () => {
  const [transfers, setTransfers] = useState([]);
  const [assets, setAssets] = useState([]);
  const [locations, setLocations] = useState([]);

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

  const [selectedTransfer, setSelectedTransfer] =
    useState(null);

  const [showCreateModal, setShowCreateModal] =
    useState(false);

  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    assetId: "",
    fromLocationId: "",
    toLocationId: "",
    transferDate: new Date()
      .toISOString()
      .slice(0, 10),
    reason: "",
    notes: "",
  });

  const loadTransfers = useCallback(
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
          "/infrastructure/transfer",
          { params }
        );

        const parsed = extractData(response.data);

        setTransfers(parsed.items);
        setTotal(parsed.total);
        setTotalPages(parsed.totalPages);
        setSummary(parsed.summary);
      } catch (err) {
        console.error(
          "Infrastructure transfer loading error:",
          err
        );

        setTransfers([]);
        setTotal(0);
        setTotalPages(1);

        setError(
          err?.response?.data?.message ||
            err?.response?.data?.error ||
            err?.message ||
            "Unable to load infrastructure transfer records."
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
      const [assetsResponse, locationsResponse] =
        await Promise.all([
          api.get("/infrastructure/transfer/assets"),
          api.get("/infrastructure/transfer/locations"),
        ]);

      setAssets(
        extractList(assetsResponse.data, [
          "assets",
          "inventory",
        ])
      );

      setLocations(
        extractList(locationsResponse.data, [
          "locations",
          "buildings",
          "facilities",
        ])
      );

      setModalError("");
    } catch (err) {
      console.error(
        "Transfer form data loading error:",
        err
      );

      setModalError(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Unable to load available assets and locations."
      );
    }
  }, []);

  useEffect(() => {
    loadTransfers();
  }, [loadTransfers]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const calculatedSummary = useMemo(() => {
    let totalCount = total || transfers.length;
    let pending = 0;
    let approved = 0;
    let completed = 0;
    let rejected = 0;

    transfers.forEach((transfer) => {
      const status = normalize(
        getStatus(transfer)
      );

      if (
        status.includes("pending") ||
        status.includes("requested")
      ) {
        pending += 1;
      }

      if (status.includes("approved")) {
        approved += 1;
      }

      if (status.includes("completed")) {
        completed += 1;
      }

      if (
        status.includes("rejected") ||
        status.includes("cancelled")
      ) {
        rejected += 1;
      }
    });

    return {
      total: totalCount,
      pending,
      approved,
      completed,
      rejected,
    };
  }, [transfers, total]);

  const transferSummary = {
    total:
      summary?.total ??
      summary?.totalTransfers ??
      calculatedSummary.total,

    pending:
      summary?.pending ??
      summary?.pendingTransfers ??
      calculatedSummary.pending,

    approved:
      summary?.approved ??
      summary?.approvedTransfers ??
      calculatedSummary.approved,

    completed:
      summary?.completed ??
      summary?.completedTransfers ??
      calculatedSummary.completed,

    rejected:
      summary?.rejected ??
      summary?.cancelled ??
      calculatedSummary.rejected,
  };

  const statusOptions = useMemo(() => {
    return [
      ...new Set(
        transfers
          .map((item) => String(getStatus(item)))
          .filter(Boolean)
      ),
    ].sort();
  }, [transfers]);

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("");
    setPage(1);
  };

  const openCreateModal = async () => {
    setModalError("");

    setForm({
      assetId: "",
      fromLocationId: "",
      toLocationId: "",
      transferDate: new Date()
        .toISOString()
        .slice(0, 10),
      reason: "",
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

  const submitTransfer = async (event) => {
    event.preventDefault();

    if (
      !form.assetId ||
      !form.fromLocationId ||
      !form.toLocationId
    ) {
      setModalError(
        "Please select an asset, source location, and destination location."
      );
      return;
    }

    if (
      String(form.fromLocationId) ===
      String(form.toLocationId)
    ) {
      setModalError(
        "Source and destination locations must be different."
      );
      return;
    }

    try {
      setSubmitting(true);
      setModalError("");

      await api.post("/infrastructure/transfer", {
        assetId: form.assetId,
        fromLocationId: form.fromLocationId,
        toLocationId: form.toLocationId,
        transferDate: form.transferDate || null,
        reason: form.reason || null,
        notes: form.notes || null,
      });

      setShowCreateModal(false);

      await loadTransfers({ silent: true });
    } catch (err) {
      console.error(
        "Infrastructure transfer creation error:",
        err
      );

      setModalError(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Unable to create the asset transfer."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const cancelTransfer = async (transfer) => {
    const transferId = getId(transfer);

    if (!transferId) return;

    const confirmed = window.confirm(
      `Cancel the transfer for "${getAssetName(
        transfer
      )}"?`
    );

    if (!confirmed) return;

    try {
      await api.patch(
        `/infrastructure/transfer/${transferId}/cancel`
      );

      await loadTransfers({ silent: true });
      setSelectedTransfer(null);
    } catch (err) {
      console.error(
        "Transfer cancellation error:",
        err
      );

      window.alert(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Unable to cancel the transfer."
      );
    }
  };

  const approveTransfer = async (transfer) => {
    const transferId = getId(transfer);

    if (!transferId) return;

    const confirmed = window.confirm(
      `Approve transfer of "${getAssetName(
        transfer
      )}"?`
    );

    if (!confirmed) return;

    try {
      await api.patch(
        `/infrastructure/transfer/${transferId}/approve`
      );

      await loadTransfers({ silent: true });

      setSelectedTransfer(null);
    } catch (err) {
      console.error(
        "Transfer approval error:",
        err
      );

      window.alert(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Unable to approve the transfer."
      );
    }
  };

  const completeTransfer = async (transfer) => {
    const transferId = getId(transfer);

    if (!transferId) return;

    const confirmed = window.confirm(
      `Complete transfer of "${getAssetName(
        transfer
      )}" to the destination location?`
    );

    if (!confirmed) return;

    try {
      await api.patch(
        `/infrastructure/transfer/${transferId}/complete`
      );

      await loadTransfers({ silent: true });

      setSelectedTransfer(null);
    } catch (err) {
      console.error(
        "Transfer completion error:",
        err
      );

      window.alert(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Unable to complete the transfer."
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
    <div className="transfer-page">
      <style>{css}</style>

      <main className="transfer-container">
        <header className="transfer-header">
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
                Asset Transfer
              </h1>

              <p className="page-subtitle">
                Transfer infrastructure assets between
                university buildings, facilities, locations,
                and responsible operational areas.
              </p>
            </div>
          </div>

          <div className="header-actions">
            <button
              type="button"
              className="button button-secondary"
              onClick={() =>
                loadTransfers({ silent: true })
              }
              disabled={loading || refreshing}
            >
              <RefreshCw size={16} />
              {refreshing
                ? "Refreshing..."
                : "Refresh"}
            </button>

            <button
              type="button"
              className="button button-primary"
              onClick={openCreateModal}
            >
              <Plus size={16} />
              New Transfer
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
              onClick={() => loadTransfers()}
            >
              Retry
            </button>
          </div>
        )}

        <section className="summary-grid">
          <div className="summary-card">
            <div className="summary-icon">
              <ArrowRightLeft size={19} />
            </div>

            <div className="summary-value">
              {formatNumber(
                transferSummary.total
              )}
            </div>

            <div className="summary-label">
              Total Transfers
            </div>
          </div>

          <div className="summary-card warning">
            <div className="summary-icon">
              <AlertCircle size={19} />
            </div>

            <div className="summary-value">
              {formatNumber(
                transferSummary.pending
              )}
            </div>

            <div className="summary-label">
              Pending Transfers
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-icon">
              <CheckCircle2 size={19} />
            </div>

            <div className="summary-value">
              {formatNumber(
                transferSummary.approved
              )}
            </div>

            <div className="summary-label">
              Approved
            </div>
          </div>

          <div className="summary-card success">
            <div className="summary-icon">
              <Package size={19} />
            </div>

            <div className="summary-value">
              {formatNumber(
                transferSummary.completed
              )}
            </div>

            <div className="summary-label">
              Completed
            </div>
          </div>

          <div className="summary-card danger">
            <div className="summary-icon">
              <XCircle size={19} />
            </div>

            <div className="summary-value">
              {formatNumber(
                transferSummary.rejected
              )}
            </div>

            <div className="summary-label">
              Rejected / Cancelled
            </div>
          </div>
        </section>

        <section className="filter-card">
          <div className="filter-header">
            <div className="filter-title">
              <Filter size={17} />
              Transfer Filters
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
                placeholder="Search asset, tag, location, requester..."
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
                All Transfer Statuses
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
          </div>
        </section>

        <section className="table-card">
          <div className="table-header">
            <div className="table-title">
              <ArrowRightLeft
                size={18}
                color="#0284c7"
              />

              <h2>
                Infrastructure Asset Transfers
              </h2>

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
              Live transfer records
            </span>
          </div>

          {loading ? (
            <div className="loading-state">
              <div className="spinner" />

              <div>
                Loading infrastructure transfers...
              </div>
            </div>
          ) : transfers.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                <ArrowRightLeft size={28} />
              </div>

              <h3>
                {search || statusFilter
                  ? "No matching transfers"
                  : "No asset transfers found"}
              </h3>

              <p>
                {search || statusFilter
                  ? "Try changing the search or status filter."
                  : "There are currently no transfer records returned by the backend."}
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
                <table className="transfer-table">
                  <thead>
                    <tr>
                      <th>Asset</th>
                      <th>Transfer Route</th>
                      <th>Requested By</th>
                      <th>Status</th>
                      <th>Transfer Date</th>
                      <th>Completed</th>
                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {transfers.map(
                      (transfer, index) => {
                        const id = getId(transfer);

                        return (
                          <tr
                            key={
                              id ||
                              `${getAssetTag(
                                transfer
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
                                      transfer
                                    )}
                                  </div>

                                  <div className="asset-tag">
                                    {getAssetTag(
                                      transfer
                                    )}{" "}
                                    • Serial:{" "}
                                    {getSerial(
                                      transfer
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td>
                              <div className="route-cell">
                                <div className="route-location">
                                  <div className="route-label">
                                    From
                                  </div>

                                  <div className="route-value">
                                    {
                                      getFromLocation(
                                        transfer
                                      )
                                    }
                                  </div>
                                </div>

                                <div className="route-arrow">
                                  <ArrowRight size={15} />
                                </div>

                                <div className="route-location">
                                  <div className="route-label">
                                    To
                                  </div>

                                  <div className="route-value">
                                    {
                                      getToLocation(
                                        transfer
                                      )
                                    }
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td>
                              <div className="person-cell">
                                <div className="person-avatar">
                                  <UserRound size={15} />
                                </div>

                                <div>
                                  <div className="person-name">
                                    {getRequestedBy(
                                      transfer
                                    )}
                                  </div>

                                  <div className="person-role">
                                    Requester
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td>
                              <span
                                className={`status ${getStatusClass(
                                  getStatus(
                                    transfer
                                  )
                                )}`}
                              >
                                {getStatusIcon(
                                  getStatus(
                                    transfer
                                  )
                                )}

                                {getStatus(transfer)}
                              </span>
                            </td>

                            <td>
                              {formatDate(
                                getTransferDate(
                                  transfer
                                )
                              )}
                            </td>

                            <td>
                              {formatDate(
                                getCompletedDate(
                                  transfer
                                )
                              )}
                            </td>

                            <td>
                              <div className="action-cell">
                                <button
                                  type="button"
                                  className="icon-button"
                                  title="View transfer"
                                  onClick={() =>
                                    setSelectedTransfer(
                                      transfer
                                    )
                                  }
                                >
                                  <Eye size={16} />
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
                  <strong>
                    {formatNumber(total)}
                  </strong>
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

      {selectedTransfer && (
        <div
          className="modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setSelectedTransfer(null);
            }
          }}
        >
          <div className="modal">
            <div className="modal-header">
              <div className="modal-heading">
                <div className="modal-heading-icon">
                  <ArrowRightLeft size={19} />
                </div>

                <div>
                  <h3>
                    Transfer Details
                  </h3>

                  <p>
                    Infrastructure asset movement
                    record
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="close-button"
                onClick={() =>
                  setSelectedTransfer(null)
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
                      selectedTransfer
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
                      selectedTransfer
                    )}
                  </div>
                </div>

                <span
                  className={`status ${getStatusClass(
                    getStatus(
                      selectedTransfer
                    )
                  )}`}
                >
                  {getStatusIcon(
                    getStatus(
                      selectedTransfer
                    )
                  )}

                  {getStatus(selectedTransfer)}
                </span>
              </div>

              <div className="detail-grid">
                <div className="detail-item">
                  <span className="detail-label">
                    Transfer ID
                  </span>

                  <span className="detail-value">
                    {getId(
                      selectedTransfer
                    ) || "—"}
                  </span>
                </div>

                <div className="detail-item">
                  <span className="detail-label">
                    Asset ID
                  </span>

                  <span className="detail-value">
                    {getAssetId(
                      selectedTransfer
                    ) || "—"}
                  </span>
                </div>

                <div className="detail-item">
                  <span className="detail-label">
                    Asset Name
                  </span>

                  <span className="detail-value">
                    {getAssetName(
                      selectedTransfer
                    )}
                  </span>
                </div>

                <div className="detail-item">
                  <span className="detail-label">
                    Asset Tag
                  </span>

                  <span className="detail-value">
                    {getAssetTag(
                      selectedTransfer
                    )}
                  </span>
                </div>

                <div className="detail-item">
                  <span className="detail-label">
                    Serial Number
                  </span>

                  <span className="detail-value">
                    {getSerial(
                      selectedTransfer
                    )}
                  </span>
                </div>

                <div className="detail-item">
                  <span className="detail-label">
                    From Location
                  </span>

                  <span className="detail-value">
                    {getFromLocation(
                      selectedTransfer
                    )}
                  </span>
                </div>

                <div className="detail-item">
                  <span className="detail-label">
                    To Location
                  </span>

                  <span className="detail-value">
                    {getToLocation(
                      selectedTransfer
                    )}
                  </span>
                </div>

                <div className="detail-item">
                  <span className="detail-label">
                    Requested By
                  </span>

                  <span className="detail-value">
                    {getRequestedBy(
                      selectedTransfer
                    )}
                  </span>
                </div>

                <div className="detail-item">
                  <span className="detail-label">
                    Approved By
                  </span>

                  <span className="detail-value">
                    {getApprovedBy(
                      selectedTransfer
                    )}
                  </span>
                </div>

                <div className="detail-item">
                  <span className="detail-label">
                    Transfer Date
                  </span>

                  <span className="detail-value">
                    {formatDate(
                      getTransferDate(
                        selectedTransfer
                      )
                    )}
                  </span>
                </div>

                <div className="detail-item">
                  <span className="detail-label">
                    Completed Date
                  </span>

                  <span className="detail-value">
                    {formatDate(
                      getCompletedDate(
                        selectedTransfer
                      )
                    )}
                  </span>
                </div>

                <div className="detail-item">
                  <span className="detail-label">
                    Reason / Notes
                  </span>

                  <span className="detail-value">
                    {getReason(
                      selectedTransfer
                    )}
                  </span>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              {getId(selectedTransfer) && (
                <>
                  {normalize(
                    getStatus(
                      selectedTransfer
                    )
                  ).includes("pending") && (
                    <button
                      type="button"
                      className="button button-primary"
                      onClick={() =>
                        approveTransfer(
                          selectedTransfer
                        )
                      }
                    >
                      <CheckCircle2 size={15} />
                      Approve Transfer
                    </button>
                  )}

                  {normalize(
                    getStatus(
                      selectedTransfer
                    )
                  ).includes("approved") && (
                    <button
                      type="button"
                      className="button button-primary"
                      onClick={() =>
                        completeTransfer(
                          selectedTransfer
                        )
                      }
                    >
                      <Package size={15} />
                      Complete Transfer
                    </button>
                  )}

                  {![
                    "completed",
                    "rejected",
                    "cancelled",
                  ].some((value) =>
                    normalize(
                      getStatus(
                        selectedTransfer
                      )
                    ).includes(value)
                  ) && (
                    <button
                      type="button"
                      className="button button-danger"
                      onClick={() =>
                        cancelTransfer(
                          selectedTransfer
                        )
                      }
                    >
                      <XCircle size={15} />
                      Cancel
                    </button>
                  )}
                </>
              )}

              <button
                type="button"
                className="button button-secondary"
                onClick={() =>
                  setSelectedTransfer(null)
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
                    Create Asset Transfer
                  </h3>

                  <p>
                    Move an infrastructure asset to
                    another university location
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

            <form onSubmit={submitTransfer}>
              <div className="modal-body">
                {modalError && (
                  <div className="form-error">
                    <AlertCircle size={16} />
                    <span>{modalError}</span>
                  </div>
                )}

                <div className="form-grid">
                  <div className="form-group full">
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
                      Assets are loaded from the real
                      backend.
                    </span>
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      From Location{" "}
                      <span className="required">
                        *
                      </span>
                    </label>

                    <select
                      name="fromLocationId"
                      className="form-select"
                      value={form.fromLocationId}
                      onChange={handleFormChange}
                      disabled={submitting}
                      required
                    >
                      <option value="">
                        Select source location
                      </option>

                      {locations.map(
                        (location) => {
                          const id = getValue(
                            location,
                            [
                              "id",
                              "location_id",
                              "locationId",
                              "building_id",
                              "buildingId",
                            ],
                            ""
                          );

                          const name = getValue(
                            location,
                            [
                              "name",
                              "location_name",
                              "locationName",
                              "building_name",
                              "buildingName",
                            ],
                            "Unnamed Location"
                          );

                          return (
                            <option
                              key={id}
                              value={id}
                            >
                              {name}
                            </option>
                          );
                        }
                      )}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      To Location{" "}
                      <span className="required">
                        *
                      </span>
                    </label>

                    <select
                      name="toLocationId"
                      className="form-select"
                      value={form.toLocationId}
                      onChange={handleFormChange}
                      disabled={submitting}
                      required
                    >
                      <option value="">
                        Select destination
                      </option>

                      {locations.map(
                        (location) => {
                          const id = getValue(
                            location,
                            [
                              "id",
                              "location_id",
                              "locationId",
                              "building_id",
                              "buildingId",
                            ],
                            ""
                          );

                          const name = getValue(
                            location,
                            [
                              "name",
                              "location_name",
                              "locationName",
                              "building_name",
                              "buildingName",
                            ],
                            "Unnamed Location"
                          );

                          return (
                            <option
                              key={id}
                              value={id}
                            >
                              {name}
                            </option>
                          );
                        }
                      )}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Transfer Date
                    </label>

                    <input
                      type="date"
                      name="transferDate"
                      className="form-input"
                      value={form.transferDate}
                      onChange={handleFormChange}
                      disabled={submitting}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Transfer Reason
                    </label>

                    <input
                      type="text"
                      name="reason"
                      className="form-input"
                      placeholder="Reason for transfer"
                      value={form.reason}
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
                      placeholder="Additional transfer information..."
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
                      Creating...
                    </>
                  ) : (
                    <>
                      <ArrowRightLeft size={15} />
                      Create Transfer
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

export default InfrastructureTransfer;