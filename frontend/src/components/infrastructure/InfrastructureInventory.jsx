import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import {
  Archive,
  ArrowLeftRight,
  BadgeAlert,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Eye,
  Filter,
  Layers3,
  MapPin,
  PackageSearch,
  RefreshCw,
  Search,
  ShieldCheck,
  TriangleAlert,
  UserRound,
  Wrench,
  X,
} from "lucide-react";

const PAGE_SIZE = 10;

const css = `
  * {
    box-sizing: border-box;
  }

  .infra-inventory-page {
    min-height: 100vh;
    background: #f8fafc;
    color: #0f172a;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
      "Segoe UI", sans-serif;
  }

  .inventory-container {
    width: 100%;
    max-width: 1600px;
    margin: 0 auto;
    padding: 28px;
  }

  .inventory-header {
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

  .back-button {
    width: 42px;
    height: 42px;
    border: 1px solid #e2e8f0;
    border-radius: 11px;
    background: #ffffff;
    color: #334155;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    text-decoration: none;
    transition: all 0.2s ease;
    flex-shrink: 0;
  }

  .back-button:hover {
    border-color: #0ea5e9;
    color: #0284c7;
    transform: translateX(-2px);
  }

  .page-title {
    margin: 0;
    font-size: 28px;
    line-height: 1.2;
    font-weight: 800;
    letter-spacing: -0.5px;
    color: #0f172a;
  }

  .page-subtitle {
    margin: 7px 0 0;
    color: #64748b;
    font-size: 14px;
    line-height: 1.6;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .action-button {
    min-height: 42px;
    border-radius: 10px;
    padding: 0 14px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    text-decoration: none;
    transition: all 0.2s ease;
    border: 1px solid transparent;
    white-space: nowrap;
  }

  .action-button.primary {
    background: #0ea5e9;
    color: #ffffff;
    box-shadow: 0 5px 14px rgba(14, 165, 233, 0.18);
  }

  .action-button.primary:hover {
    background: #0284c7;
    transform: translateY(-1px);
  }

  .action-button.secondary {
    background: #ffffff;
    color: #334155;
    border-color: #e2e8f0;
  }

  .action-button.secondary:hover {
    border-color: #0ea5e9;
    color: #0284c7;
  }

  .action-button:disabled {
    opacity: 0.6;
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
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    padding: 18px;
    min-height: 128px;
    box-shadow: 0 3px 12px rgba(15, 23, 42, 0.035);
    position: relative;
    overflow: hidden;
  }

  .summary-card::after {
    content: "";
    position: absolute;
    right: -24px;
    bottom: -30px;
    width: 90px;
    height: 90px;
    border-radius: 50%;
    background: rgba(14, 165, 233, 0.055);
  }

  .summary-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .summary-icon {
    width: 40px;
    height: 40px;
    border-radius: 11px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: #e0f2fe;
    color: #0284c7;
  }

  .summary-value {
    margin-top: 16px;
    font-size: 27px;
    font-weight: 800;
    color: #0f172a;
  }

  .summary-label {
    margin-top: 4px;
    color: #64748b;
    font-size: 13px;
    font-weight: 600;
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

  .filters-card {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    padding: 18px;
    margin-bottom: 18px;
    box-shadow: 0 3px 12px rgba(15, 23, 42, 0.035);
  }

  .filters-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 14px;
  }

  .filters-title {
    display: flex;
    align-items: center;
    gap: 9px;
    font-size: 15px;
    font-weight: 800;
    color: #0f172a;
  }

  .clear-filters {
    border: 0;
    background: transparent;
    color: #0284c7;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
  }

  .filter-grid {
    display: grid;
    grid-template-columns: minmax(260px, 2fr) repeat(3, minmax(150px, 1fr));
    gap: 12px;
  }

  .input-wrapper {
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
  .filter-select {
    width: 100%;
    height: 44px;
    border: 1px solid #dbe3ec;
    border-radius: 10px;
    background: #ffffff;
    color: #0f172a;
    font-size: 13px;
    outline: none;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }

  .filter-input {
    padding: 0 13px 0 40px;
  }

  .filter-select {
    padding: 0 34px 0 13px;
  }

  .filter-input:focus,
  .filter-select:focus {
    border-color: #38bdf8;
    box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.1);
  }

  .table-card {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    overflow: hidden;
    box-shadow: 0 3px 12px rgba(15, 23, 42, 0.035);
  }

  .table-header {
    padding: 18px 20px;
    border-bottom: 1px solid #e2e8f0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
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
    color: #0f172a;
  }

  .record-count {
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

  .inventory-table {
    width: 100%;
    min-width: 1050px;
    border-collapse: collapse;
  }

  .inventory-table th {
    background: #f8fafc;
    color: #64748b;
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    text-align: left;
    padding: 13px 16px;
    border-bottom: 1px solid #e2e8f0;
    white-space: nowrap;
  }

  .inventory-table td {
    padding: 15px 16px;
    border-bottom: 1px solid #eef2f7;
    vertical-align: middle;
    font-size: 13px;
    color: #334155;
  }

  .inventory-table tbody tr {
    transition: background 0.15s ease;
  }

  .inventory-table tbody tr:hover {
    background: #f8fcff;
  }

  .asset-main {
    display: flex;
    align-items: center;
    gap: 11px;
    min-width: 220px;
  }

  .asset-icon {
    width: 38px;
    height: 38px;
    border-radius: 10px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: #e0f2fe;
    color: #0284c7;
    flex-shrink: 0;
  }

  .asset-name {
    font-weight: 750;
    color: #0f172a;
    max-width: 250px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .asset-tag {
    margin-top: 3px;
    color: #94a3b8;
    font-size: 11px;
  }

  .muted {
    color: #94a3b8;
  }

  .status-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 9px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 800;
    white-space: nowrap;
  }

  .status-operational,
  .status-active,
  .status-available,
  .status-good {
    background: #dcfce7;
    color: #166534;
  }

  .status-assigned,
  .status-in-use {
    background: #dbeafe;
    color: #1d4ed8;
  }

  .status-maintenance,
  .status-pending {
    background: #fef3c7;
    color: #92400e;
  }

  .status-damaged,
  .status-critical,
  .status-missing,
  .status-lost,
  .status-retired {
    background: #fee2e2;
    color: #b91c1c;
  }

  .status-inactive,
  .status-unknown {
    background: #f1f5f9;
    color: #475569;
  }

  .location-cell,
  .person-cell {
    display: flex;
    align-items: center;
    gap: 7px;
    color: #475569;
  }

  .action-cell {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .icon-button {
    width: 34px;
    height: 34px;
    border: 1px solid #e2e8f0;
    background: #ffffff;
    color: #475569;
    border-radius: 8px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .icon-button:hover {
    color: #0284c7;
    border-color: #7dd3fc;
    background: #f0f9ff;
  }

  .empty-state {
    padding: 60px 24px;
    text-align: center;
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
    color: #334155;
    font-size: 16px;
  }

  .empty-state p {
    max-width: 470px;
    margin: 7px auto 0;
    color: #94a3b8;
    font-size: 13px;
    line-height: 1.6;
  }

  .loading-state {
    padding: 55px 20px;
    text-align: center;
    color: #64748b;
  }

  .spinner {
    width: 32px;
    height: 32px;
    margin: 0 auto 12px;
    border-radius: 50%;
    border: 3px solid #e2e8f0;
    border-top-color: #0ea5e9;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .error-box {
    margin-bottom: 18px;
    padding: 14px 16px;
    border: 1px solid #fecaca;
    border-radius: 12px;
    background: #fff7f7;
    color: #991b1b;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    font-size: 13px;
  }

  .error-content {
    display: flex;
    align-items: center;
    gap: 9px;
  }

  .pagination {
    padding: 15px 18px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 15px;
    border-top: 1px solid #e2e8f0;
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

  .page-button {
    min-width: 34px;
    height: 34px;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background: #ffffff;
    color: #475569;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 12px;
    font-weight: 700;
  }

  .page-button:hover:not(:disabled) {
    border-color: #7dd3fc;
    color: #0284c7;
  }

  .page-button.active {
    background: #0ea5e9;
    border-color: #0ea5e9;
    color: #ffffff;
  }

  .page-button:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.5);
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
    background: #ffffff;
    border-radius: 16px;
    box-shadow: 0 25px 70px rgba(15, 23, 42, 0.25);
  }

  .modal-header {
    padding: 19px 20px;
    border-bottom: 1px solid #e2e8f0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 15px;
    position: sticky;
    top: 0;
    background: #ffffff;
    z-index: 2;
  }

  .modal-title {
    display: flex;
    align-items: center;
    gap: 11px;
  }

  .modal-title-icon {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: #e0f2fe;
    color: #0284c7;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .modal-title h3 {
    margin: 0;
    font-size: 17px;
    font-weight: 800;
  }

  .modal-title p {
    margin: 3px 0 0;
    color: #94a3b8;
    font-size: 11px;
  }

  .modal-close {
    width: 35px;
    height: 35px;
    border: 0;
    border-radius: 8px;
    background: #f1f5f9;
    color: #64748b;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }

  .modal-close:hover {
    background: #e2e8f0;
    color: #0f172a;
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
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.5px;
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

  .quick-links {
    margin-top: 18px;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
  }

  .quick-link {
    text-decoration: none;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 11px;
    display: flex;
    align-items: center;
    gap: 9px;
    color: #475569;
    font-size: 12px;
    font-weight: 750;
    transition: all 0.2s ease;
  }

  .quick-link:hover {
    border-color: #7dd3fc;
    background: #f0f9ff;
    color: #0284c7;
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
    .inventory-container {
      padding: 18px 14px;
    }

    .inventory-header {
      flex-direction: column;
    }

    .header-actions {
      width: 100%;
    }

    .header-actions .action-button {
      flex: 1;
    }

    .summary-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .filter-grid {
      grid-template-columns: 1fr;
    }

    .table-header {
      align-items: flex-start;
      flex-direction: column;
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

    .quick-links {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 480px) {
    .summary-grid {
      grid-template-columns: 1fr;
    }

    .page-title {
      font-size: 23px;
    }

    .header-left {
      width: 100%;
    }
  }
`;

const normalize = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase();

const getValue = (item, keys, fallback = "") => {
  for (const key of keys) {
    if (
      item &&
      Object.prototype.hasOwnProperty.call(item, key) &&
      item[key] !== null &&
      item[key] !== undefined &&
      item[key] !== ""
    ) {
      return item[key];
    }
  }

  return fallback;
};

const getAssetName = (asset) =>
  getValue(asset, ["name", "asset_name", "assetName", "title"], "Unnamed Asset");

const getAssetTag = (asset) =>
  getValue(
    asset,
    ["asset_tag", "assetTag", "tag", "asset_code", "assetCode", "code"],
    "—"
  );

const getSerial = (asset) =>
  getValue(asset, ["serial_number", "serialNumber", "serial", "serial_no"], "—");

const getCategory = (asset) =>
  getValue(
    asset,
    ["category", "category_name", "categoryName", "asset_category"],
    "Uncategorized"
  );

const getStatus = (asset) =>
  getValue(asset, ["status", "asset_status", "condition"], "Unknown");

const getLocation = (asset) =>
  getValue(
    asset,
    ["location", "location_name", "locationName", "building", "site"],
    "Unassigned"
  );

const getAssignedTo = (asset) =>
  getValue(
    asset,
    [
      "assigned_to",
      "assignedTo",
      "assigned_user",
      "assignedUser",
      "custodian",
      "responsible_person",
      "responsiblePerson",
    ],
    "Unassigned"
  );

const getId = (asset) =>
  getValue(asset, ["id", "asset_id", "assetId"], "");

const getPurchaseDate = (asset) =>
  getValue(asset, ["purchase_date", "purchaseDate", "acquisition_date"], "—");

const getCreatedAt = (asset) =>
  getValue(asset, ["created_at", "createdAt"], "—");

const getPurchasePrice = (asset) =>
  getValue(
    asset,
    ["purchase_price", "purchasePrice", "cost", "acquisition_cost"],
    ""
  );

const getDescription = (asset) =>
  getValue(asset, ["description", "details", "remarks", "notes"], "—");

const formatNumber = (value) => {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "0";
  }

  return new Intl.NumberFormat().format(number);
};

const formatCurrency = (value) => {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "—";
  }

  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(number);
};

const formatDate = (value) => {
  if (!value || value === "—") {
    return "—";
  }

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

const getStatusClass = (status) => {
  const value = normalize(status);

  if (
    ["operational", "active", "available", "good", "working", "functional"].some(
      (item) => value.includes(item)
    )
  ) {
    return "status-operational";
  }

  if (
    ["assigned", "in use", "in-use", "issued"].some((item) =>
      value.includes(item)
    )
  ) {
    return "status-assigned";
  }

  if (
    ["maintenance", "repair", "pending"].some((item) =>
      value.includes(item)
    )
  ) {
    return "status-maintenance";
  }

  if (
    ["damaged", "critical", "missing", "lost", "retired", "disposed"].some(
      (item) => value.includes(item)
    )
  ) {
    return "status-damaged";
  }

  if (["inactive"].some((item) => value.includes(item))) {
    return "status-inactive";
  }

  return "status-unknown";
};

const getStatusIcon = (status) => {
  const value = normalize(status);

  if (
    ["operational", "active", "available", "good", "working", "functional"].some(
      (item) => value.includes(item)
    )
  ) {
    return <CheckCircle2 size={12} />;
  }

  if (
    ["maintenance", "repair", "pending"].some((item) =>
      value.includes(item)
    )
  ) {
    return <Wrench size={12} />;
  }

  if (
    ["damaged", "critical", "missing", "lost", "retired", "disposed"].some(
      (item) => value.includes(item)
    )
  ) {
    return <TriangleAlert size={12} />;
  }

  return <CircleAlert size={12} />;
};

const extractInventoryData = (responseData) => {
  if (Array.isArray(responseData)) {
    return {
      items: responseData,
      total: responseData.length,
      page: 1,
      limit: PAGE_SIZE,
      totalPages: Math.max(1, Math.ceil(responseData.length / PAGE_SIZE)),
      summary: null,
    };
  }

  if (!responseData || typeof responseData !== "object") {
    return {
      items: [],
      total: 0,
      page: 1,
      limit: PAGE_SIZE,
      totalPages: 1,
      summary: null,
    };
  }

  const items =
    responseData.inventory ||
    responseData.assets ||
    responseData.rows ||
    responseData.data ||
    responseData.results ||
    [];

  const pagination = responseData.pagination || {};

  const total = Number(
    pagination.total ??
      responseData.total ??
      responseData.totalCount ??
      responseData.count ??
      (Array.isArray(items) ? items.length : 0)
  );

  const page = Number(
    pagination.page ?? responseData.page ?? responseData.currentPage ?? 1
  );

  const limit = Number(
    pagination.limit ??
      responseData.limit ??
      responseData.pageSize ??
      PAGE_SIZE
  );

  const totalPages = Number(
    pagination.totalPages ??
      responseData.totalPages ??
      Math.max(1, Math.ceil(total / Math.max(limit, 1)))
  );

  return {
    items: Array.isArray(items) ? items : [],
    total: Number.isFinite(total) ? total : 0,
    page: Number.isFinite(page) ? page : 1,
    limit: Number.isFinite(limit) && limit > 0 ? limit : PAGE_SIZE,
    totalPages:
      Number.isFinite(totalPages) && totalPages > 0 ? totalPages : 1,
    summary:
      responseData.summary ||
      responseData.statistics ||
      responseData.stats ||
      null,
  };
};

const InfrastructureInventory = () => {
  const [inventory, setInventory] = useState([]);
  const [serverSummary, setServerSummary] = useState(null);
  const [filterOptions, setFilterOptions] = useState({ categories: [], locations: [], conditions: [], statuses: [] });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");

  const [page, setPage] = useState(1);
  const [serverTotal, setServerTotal] = useState(0);
  const [serverTotalPages, setServerTotalPages] = useState(1);

  const [selectedAsset, setSelectedAsset] = useState(null);

  const loadInventory = useCallback(
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

        if (categoryFilter) {
          params.category = categoryFilter;
        }

        if (locationFilter) {
          params.location = locationFilter;
        }

        const response = await api.get("/api/infrastructure/inventory", {
          params,
        });

        const responseData = response.data?.data || {};
        const parsed = extractInventoryData({
          ...responseData,
          pagination: response.data?.pagination
        });

        setInventory(parsed.items);
        setServerSummary(parsed.summary);
        setFilterOptions(responseData.filters || { categories: [], locations: [], conditions: [], statuses: [] });
        setServerTotal(parsed.total);
        setServerTotalPages(parsed.totalPages);
      } catch (err) {
        console.error("Infrastructure inventory loading error:", err);

        const status = err?.response?.status;
        const message = status === 401
          ? "Authentication required. Please sign in again."
          : status === 403
            ? "Access denied for infrastructure inventory."
            : status === 404
              ? "Infrastructure inventory endpoint was not found."
              : status === 429
                ? "Too many requests. Please wait and try again."
                : err?.code === "ERR_NETWORK" || err?.code === "NETWORK_ERROR"
                  ? "Unable to connect to server."
                  : status >= 500
                    ? "Server error while loading infrastructure inventory."
                    : err?.response?.data?.message || "Unable to load infrastructure inventory.";

        setError(message);
        setInventory([]);
        setServerTotal(0);
        setServerTotalPages(1);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [page, search, statusFilter, categoryFilter, locationFilter]
  );

  useEffect(() => {
    const timer = setTimeout(() => loadInventory(), 300);
    return () => clearTimeout(timer);
  }, [loadInventory]);

  const summary = serverSummary || {
    total: 0,
    available: 0,
    assigned: 0,
    maintenance: 0,
    damaged: 0,
    missing: 0,
    disposed: 0,
  };

  const categories = useMemo(() => {
    return filterOptions.categories || [];
  }, [filterOptions.categories]);

  const locations = useMemo(() => {
    return filterOptions.locations || [];
  }, [filterOptions.locations]);

  const statuses = useMemo(() => {
    return filterOptions.statuses || [];
  }, [filterOptions.statuses]);

  const visibleInventory = inventory;

  const effectiveTotalPages = Math.max(
    1,
    serverTotalPages ||
      Math.ceil(Math.max(serverTotal, visibleInventory.length) / PAGE_SIZE)
  );

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("");
    setCategoryFilter("");
    setLocationFilter("");
    setPage(1);
  };

  const hasFilters =
    Boolean(search.trim()) ||
    Boolean(statusFilter) ||
    Boolean(categoryFilter) ||
    Boolean(locationFilter);

  const goToPage = (nextPage) => {
    if (nextPage < 1 || nextPage > effectiveTotalPages) {
      return;
    }

    setPage(nextPage);
  };

  const getPageNumbers = () => {
    const total = effectiveTotalPages;

    if (total <= 5) {
      return Array.from({ length: total }, (_, index) => index + 1);
    }

    if (page <= 3) {
      return [1, 2, 3, 4, 5];
    }

    if (page >= total - 2) {
      return [total - 4, total - 3, total - 2, total - 1, total];
    }

    return [page - 2, page - 1, page, page + 1, page + 2];
  };

  const startRecord =
    serverTotal === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;

  const endRecord =
    serverTotal === 0
      ? 0
      : Math.min(page * PAGE_SIZE, serverTotal);

  return (
    <div className="infra-inventory-page">
      <style>{css}</style>

      <main className="inventory-container">
        <header className="inventory-header">
          <div className="header-left">
            <Link
              to="/infrastructure"
              className="back-button"
              title="Back to Infrastructure Dashboard"
            >
              <ArrowLeftRight size={18} />
            </Link>

            <div>
              <h1 className="page-title">Asset Inventory</h1>
              <p className="page-subtitle">
                View, search, filter, and monitor all infrastructure assets
                registered in the university system.
              </p>
            </div>
          </div>

          <div className="header-actions">
            <button
              type="button"
              className="action-button secondary"
              onClick={() => loadInventory({ silent: true })}
              disabled={loading || refreshing}
            >
              <RefreshCw
                size={16}
                className={refreshing ? "spin" : ""}
              />
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>

            <Link
              to="/infrastructure/assets/register"
              className="action-button primary"
            >
              <Archive size={16} />
              Register Asset
            </Link>
          </div>
        </header>

        {error && (
          <div className="error-box">
            <div className="error-content">
              <BadgeAlert size={18} />
              <span>{error}</span>
            </div>

            <button
              type="button"
              className="action-button secondary"
              onClick={() => loadInventory()}
            >
              Retry
            </button>
          </div>
        )}

        <section className="summary-grid">
          <div className="summary-card">
            <div className="summary-top">
              <div className="summary-icon">
                <PackageSearch size={19} />
              </div>
            </div>
            <div className="summary-value">
              {formatNumber(summary.total)}
            </div>
            <div className="summary-label">Total Inventory</div>
          </div>

          <div className="summary-card success">
            <div className="summary-top">
              <div className="summary-icon">
                <CheckCircle2 size={19} />
              </div>
            </div>
            <div className="summary-value">
              {formatNumber(summary.available)}
            </div>
            <div className="summary-label">Available / Operational</div>
          </div>

          <div className="summary-card">
            <div className="summary-top">
              <div className="summary-icon">
                <UserRound size={19} />
              </div>
            </div>
            <div className="summary-value">
              {formatNumber(summary.assigned)}
            </div>
            <div className="summary-label">Assigned / In Use</div>
          </div>

          <div className="summary-card warning">
            <div className="summary-top">
              <div className="summary-icon">
                <Wrench size={19} />
              </div>
            </div>
            <div className="summary-value">
              {formatNumber(summary.maintenance)}
            </div>
            <div className="summary-label">Under Maintenance</div>
          </div>

          <div className="summary-card danger">
            <div className="summary-top">
              <div className="summary-icon">
                <TriangleAlert size={19} />
              </div>
            </div>
            <div className="summary-value">
              {formatNumber(
                Number(summary.damaged || 0) + Number(summary.missing || 0)
              )}
            </div>
            <div className="summary-label">Damaged / Missing</div>
          </div>
        </section>

        <section className="filters-card">
          <div className="filters-header">
            <div className="filters-title">
              <Filter size={17} />
              Inventory Filters
            </div>

            {hasFilters && (
              <button
                type="button"
                className="clear-filters"
                onClick={clearFilters}
              >
                Clear filters
              </button>
            )}
          </div>

          <div className="filter-grid">
            <div className="input-wrapper">
              <Search size={17} className="input-icon" />
              <input
                type="text"
                className="filter-input"
                placeholder="Search asset, tag, serial, category, location..."
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
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
              <option value="">All Statuses</option>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>

            <select
              className="filter-select"
              value={categoryFilter}
              onChange={(event) => {
                setCategoryFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All Categories</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>

            <select
              className="filter-select"
              value={locationFilter}
              onChange={(event) => {
                setLocationFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All Locations</option>
              {locations.map((location) => (
                <option key={location} value={location}>
                  {location}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className="table-card">
          <div className="table-header">
            <div className="table-title">
              <Layers3 size={18} color="#0284c7" />
              <h2>Infrastructure Asset Inventory</h2>
              <span className="record-count">
                {formatNumber(serverTotal)}
              </span>
            </div>

            <div className="muted">
              {hasFilters
                ? `${visibleInventory.length} visible`
                : "Live inventory records"}
            </div>
          </div>

          {loading ? (
            <div className="loading-state">
              <div className="spinner" />
              <div>Loading infrastructure inventory...</div>
            </div>
          ) : visibleInventory.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                <PackageSearch size={28} />
              </div>

              <h3>
                {hasFilters
                  ? "No matching inventory records"
                  : "No infrastructure assets found"}
              </h3>

              <p>
                {hasFilters
                  ? "Try changing your search or filters to find infrastructure assets."
                  : "No infrastructure asset records are currently available from the backend."}
              </p>

              {hasFilters && (
                <button
                  type="button"
                  className="action-button secondary"
                  onClick={clearFilters}
                  style={{ marginTop: 15 }}
                >
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="table-wrapper">
                <table className="inventory-table">
                  <thead>
                    <tr>
                      <th>Asset</th>
                      <th>Category</th>
                      <th>Serial Number</th>
                      <th>Status</th>
                      <th>Location</th>
                      <th>Assigned To</th>
                      <th>Purchase Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {visibleInventory.map((asset, index) => {
                      const id = getId(asset);
                      const name = getAssetName(asset);
                      const tag = getAssetTag(asset);
                      const serial = getSerial(asset);
                      const category = getCategory(asset);
                      const status = getStatus(asset);
                      const location = getLocation(asset);
                      const assignedTo = getAssignedTo(asset);
                      const purchaseDate = getPurchaseDate(asset);

                      return (
                        <tr
                          key={id || `${tag}-${index}`}
                        >
                          <td>
                            <div className="asset-main">
                              <div className="asset-icon">
                                <Building2 size={18} />
                              </div>

                              <div>
                                <div
                                  className="asset-name"
                                  title={name}
                                >
                                  {name}
                                </div>

                                <div className="asset-tag">
                                  {tag}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td>{category}</td>

                          <td>
                            <span
                              className={
                                serial === "—"
                                  ? "muted"
                                  : undefined
                              }
                            >
                              {serial}
                            </span>
                          </td>

                          <td>
                            <span
                              className={`status-badge ${getStatusClass(
                                status
                              )}`}
                            >
                              {getStatusIcon(status)}
                              {status}
                            </span>
                          </td>

                          <td>
                            <div className="location-cell">
                              <MapPin size={14} />
                              <span>{location}</span>
                            </div>
                          </td>

                          <td>
                            <div className="person-cell">
                              <UserRound size={14} />
                              <span>{assignedTo}</span>
                            </div>
                          </td>

                          <td>
                            {formatDate(purchaseDate)}
                          </td>

                          <td>
                            <div className="action-cell">
                              <button
                                type="button"
                                className="icon-button"
                                title="View asset details"
                                onClick={() =>
                                  setSelectedAsset(asset)
                                }
                              >
                                <Eye size={16} />
                              </button>

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
                  Showing{" "}
                  <strong>{formatNumber(startRecord)}</strong>–
                  <strong>{formatNumber(endRecord)}</strong> of{" "}
                  <strong>{formatNumber(serverTotal)}</strong> records
                </div>

                <div className="pagination-actions">
                  <button
                    type="button"
                    className="page-button"
                    disabled={page <= 1}
                    onClick={() => goToPage(page - 1)}
                    title="Previous page"
                  >
                    <ChevronLeft size={16} />
                  </button>

                  {getPageNumbers().map((pageNumber) => (
                    <button
                      type="button"
                      key={pageNumber}
                      className={`page-button ${
                        pageNumber === page ? "active" : ""
                      }`}
                      onClick={() => goToPage(pageNumber)}
                    >
                      {pageNumber}
                    </button>
                  ))}

                  <button
                    type="button"
                    className="page-button"
                    disabled={page >= effectiveTotalPages}
                    onClick={() => goToPage(page + 1)}
                    title="Next page"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </main>

      {selectedAsset && (
        <div
          className="modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedAsset(null);
            }
          }}
        >
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="inventory-asset-details"
          >
            <div className="modal-header">
              <div className="modal-title">
                <div className="modal-title-icon">
                  <Building2 size={19} />
                </div>

                <div>
                  <h3 id="inventory-asset-details">
                    {getAssetName(selectedAsset)}
                  </h3>

                  <p>
                    Infrastructure asset details
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="modal-close"
                onClick={() => setSelectedAsset(null)}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  marginBottom: 18,
                  flexWrap: "wrap",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 9,
                  }}
                >
                  <ShieldCheck
                    size={17}
                    color="#0284c7"
                  />
                  <strong
                    style={{
                      fontSize: 13,
                      color: "#334155",
                    }}
                  >
                    Current Inventory Record
                  </strong>
                </div>

                <span
                  className={`status-badge ${getStatusClass(
                    getStatus(selectedAsset)
                  )}`}
                >
                  {getStatusIcon(getStatus(selectedAsset))}
                  {getStatus(selectedAsset)}
                </span>
              </div>

              <div className="detail-grid">
                <div className="detail-item">
                  <span className="detail-label">
                    Asset ID
                  </span>
                  <span className="detail-value">
                    {getId(selectedAsset) || "—"}
                  </span>
                </div>

                <div className="detail-item">
                  <span className="detail-label">
                    Asset Tag
                  </span>
                  <span className="detail-value">
                    {getAssetTag(selectedAsset)}
                  </span>
                </div>

                <div className="detail-item">
                  <span className="detail-label">
                    Asset Name
                  </span>
                  <span className="detail-value">
                    {getAssetName(selectedAsset)}
                  </span>
                </div>

                <div className="detail-item">
                  <span className="detail-label">
                    Category
                  </span>
                  <span className="detail-value">
                    {getCategory(selectedAsset)}
                  </span>
                </div>

                <div className="detail-item">
                  <span className="detail-label">
                    Serial Number
                  </span>
                  <span className="detail-value">
                    {getSerial(selectedAsset)}
                  </span>
                </div>

                <div className="detail-item">
                  <span className="detail-label">
                    Status
                  </span>
                  <span className="detail-value">
                    {getStatus(selectedAsset)}
                  </span>
                </div>

                <div className="detail-item">
                  <span className="detail-label">
                    Location
                  </span>
                  <span className="detail-value">
                    {getLocation(selectedAsset)}
                  </span>
                </div>

                <div className="detail-item">
                  <span className="detail-label">
                    Assigned To
                  </span>
                  <span className="detail-value">
                    {getAssignedTo(selectedAsset)}
                  </span>
                </div>

                <div className="detail-item">
                  <span className="detail-label">
                    Purchase Date
                  </span>
                  <span className="detail-value">
                    {formatDate(getPurchaseDate(selectedAsset))}
                  </span>
                </div>

                <div className="detail-item">
                  <span className="detail-label">
                    Purchase Price
                  </span>
                  <span className="detail-value">
                    {getPurchasePrice(selectedAsset) !== ""
                      ? formatCurrency(
                          getPurchasePrice(selectedAsset)
                        )
                      : "—"}
                  </span>
                </div>

                <div className="detail-item">
                  <span className="detail-label">
                    Created
                  </span>
                  <span className="detail-value">
                    {formatDate(getCreatedAt(selectedAsset))}
                  </span>
                </div>

                <div className="detail-item">
                  <span className="detail-label">
                    Description
                  </span>
                  <span className="detail-value">
                    {getDescription(selectedAsset)}
                  </span>
                </div>
              </div>

            </div>

            <div className="modal-footer">
              {getId(selectedAsset) && (
                <Link
                  to={`/infrastructure/assets/${getId(
                    selectedAsset
                  )}`}
                  className="action-button primary"
                  onClick={() => setSelectedAsset(null)}
                >
                  <Eye size={15} />
                  Open Asset
                </Link>
              )}

              <button
                type="button"
                className="action-button secondary"
                onClick={() => setSelectedAsset(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InfrastructureInventory;