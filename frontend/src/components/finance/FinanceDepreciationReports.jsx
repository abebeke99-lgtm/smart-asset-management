import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  BarChart3,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileBarChart2,
  FileText,
  Filter,
  Loader2,
  Printer,
  RefreshCw,
  Search,
  TrendingDown,
  Wallet,
  X,
} from "lucide-react";
import { apiBase } from "../../utils/api";

const API_URL = (
  `${apiBase()}/api`
).replace(/\/$/, "");

const PAGE_SIZE = 10;

const EMPTY_FILTERS = {
  dateFrom: "",
  dateTo: "",
  financialYear: "",
  department: "",
  category: "",
  status: "",
  depreciationMethod: "",
};

function authHeaders() {
  const token =
    localStorage.getItem("token") ||
    localStorage.getItem("accessToken") ||
    "";

  return {
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...authHeaders(),
      ...(options.headers || {}),
    },
  });

  const contentType = response.headers.get("content-type") || "";

  let payload;

  if (contentType.includes("application/json")) {
    payload = await response.json();
  } else {
    payload = await response.text();
  }

  if (!response.ok) {
    const message =
      typeof payload === "object"
        ? payload.message || payload.error
        : payload;

    throw new Error(
      message || `Request failed with HTTP ${response.status}`
    );
  }

  return payload;
}

function extractArray(payload) {
  if (Array.isArray(payload)) return payload;

  if (!payload || typeof payload !== "object") return [];

  const candidates = [
    payload.data,
    payload.records,
    payload.items,
    payload.rows,
    payload.results,
    payload.reports,
    payload.depreciationReports,
    payload.depreciation_reports,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }

  return [];
}

function extractObject(payload) {
  if (!payload || typeof payload !== "object") return {};

  if (
    payload.data &&
    typeof payload.data === "object" &&
    !Array.isArray(payload.data)
  ) {
    return payload.data;
  }

  return payload;
}

function firstValue(...values) {
  return values.find(
    (value) => value !== undefined && value !== null && value !== ""
  );
}

function numberValue(...values) {
  const value = firstValue(...values);
  const number = Number(value);

  return Number.isFinite(number) ? number : 0;
}

function textValue(...values) {
  const value = firstValue(...values);
  return value === undefined || value === null ? "" : String(value);
}

function formatMoney(value, currency = "ETB") {
  return `${currency} ${(Number(value) || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatNumber(value) {
  return (Number(value) || 0).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString();
}

function normalizeReport(item) {
  const asset =
    item.asset && typeof item.asset === "object"
      ? item.asset
      : {};

  const department =
    item.department && typeof item.department === "object"
      ? firstValue(
          item.department.name,
          item.department.department_name,
          item.department.departmentName
        )
      : firstValue(
          item.department_name,
          item.departmentName,
          item.department
        );

  const category =
    item.category && typeof item.category === "object"
      ? firstValue(
          item.category.name,
          item.category.category_name,
          item.category.categoryName
        )
      : firstValue(
          item.category_name,
          item.categoryName,
          item.category
        );

  const acquisitionCost = numberValue(
    item.acquisition_cost,
    item.acquisitionCost,
    item.purchase_cost,
    item.purchaseCost,
    item.original_cost,
    item.originalCost,
    item.asset_cost,
    item.assetCost,
    asset.acquisition_cost,
    asset.acquisitionCost,
    asset.purchase_price,
    asset.purchasePrice
  );

  const accumulatedDepreciation = numberValue(
    item.accumulated_depreciation,
    item.accumulatedDepreciation,
    item.total_depreciation,
    item.totalDepreciation,
    item.depreciation_to_date,
    item.depreciationToDate
  );

  const currentDepreciation = numberValue(
    item.current_depreciation,
    item.currentDepreciation,
    item.period_depreciation,
    item.periodDepreciation,
    item.depreciation_expense,
    item.depreciationExpense,
    item.depreciation_amount,
    item.depreciationAmount
  );

  const bookValue = numberValue(
    item.book_value,
    item.bookValue,
    item.net_book_value,
    item.netBookValue,
    acquisitionCost - accumulatedDepreciation
  );

  const residualValue = numberValue(
    item.residual_value,
    item.residualValue,
    item.salvage_value,
    item.salvageValue
  );

  const usefulLife = numberValue(
    item.useful_life,
    item.usefulLife,
    item.useful_life_years,
    item.usefulLifeYears
  );

  const remainingLife = numberValue(
    item.remaining_life,
    item.remainingLife,
    item.remaining_life_years,
    item.remainingLifeYears
  );

  const depreciationRate = numberValue(
    item.depreciation_rate,
    item.depreciationRate,
    item.rate
  );

  return {
    id: firstValue(
      item.id,
      item.depreciation_report_id,
      item.depreciationReportId,
      item.depreciation_id,
      item.depreciationId
    ),

    reportNumber: textValue(
      item.report_number,
      item.reportNumber,
      item.reference_number,
      item.referenceNumber,
      item.id
    ),

    assetId: firstValue(
      item.asset_id,
      item.assetId,
      asset.id
    ),

    assetCode: textValue(
      item.asset_code,
      item.assetCode,
      item.asset_tag,
      item.assetTag,
      item.tag_number,
      item.tagNumber,
      asset.asset_tag,
      asset.assetTag,
      asset.code
    ),

    assetName: textValue(
      item.asset_name,
      item.assetName,
      item.name,
      item.description,
      asset.name,
      asset.description
    ),

    category: textValue(category),

    department: textValue(department),

    depreciationDate: firstValue(
      item.depreciation_date,
      item.depreciationDate,
      item.period_date,
      item.periodDate,
      item.date,
      item.created_at,
      item.createdAt
    ),

    periodFrom: firstValue(
      item.period_from,
      item.periodFrom,
      item.date_from,
      item.dateFrom,
      item.start_date,
      item.startDate
    ),

    periodTo: firstValue(
      item.period_to,
      item.periodTo,
      item.date_to,
      item.dateTo,
      item.end_date,
      item.endDate
    ),

    financialYear: textValue(
      item.financial_year,
      item.financialYear,
      item.fiscal_year,
      item.fiscalYear
    ),

    depreciationMethod: textValue(
      item.depreciation_method,
      item.depreciationMethod,
      item.method
    ),

    acquisitionCost,

    residualValue,

    usefulLife,

    remainingLife,

    depreciationRate,

    currentDepreciation,

    accumulatedDepreciation,

    bookValue,

    currency: textValue(
      item.currency,
      "ETB"
    ),

    status: textValue(
      item.status,
      item.depreciation_status,
      item.depreciationStatus,
      "Active"
    ),

    notes: textValue(item.notes),
  };
}

function normalizeSummary(payload, rows) {
  const root = extractObject(payload);

  const summary =
    root.summary && typeof root.summary === "object"
      ? root.summary
      : {};

  const calculated = rows.reduce(
    (acc, row) => ({
      assets: acc.assets + 1,
      acquisitionCost:
        acc.acquisitionCost + row.acquisitionCost,
      currentDepreciation:
        acc.currentDepreciation +
        row.currentDepreciation,
      accumulatedDepreciation:
        acc.accumulatedDepreciation +
        row.accumulatedDepreciation,
      bookValue: acc.bookValue + row.bookValue,
    }),
    {
      assets: 0,
      acquisitionCost: 0,
      currentDepreciation: 0,
      accumulatedDepreciation: 0,
      bookValue: 0,
    }
  );

  return {
    assets: numberValue(
      summary.assets,
      summary.total_assets,
      summary.totalAssets,
      summary.asset_count,
      summary.assetCount,
      calculated.assets
    ),

    acquisitionCost: numberValue(
      summary.acquisition_cost,
      summary.acquisitionCost,
      summary.total_acquisition_cost,
      summary.totalAcquisitionCost,
      calculated.acquisitionCost
    ),

    currentDepreciation: numberValue(
      summary.current_depreciation,
      summary.currentDepreciation,
      summary.period_depreciation,
      summary.periodDepreciation,
      summary.depreciation_expense,
      summary.depreciationExpense,
      calculated.currentDepreciation
    ),

    accumulatedDepreciation: numberValue(
      summary.accumulated_depreciation,
      summary.accumulatedDepreciation,
      summary.total_depreciation,
      summary.totalDepreciation,
      calculated.accumulatedDepreciation
    ),

    bookValue: numberValue(
      summary.currentBookValue,
      summary.book_value,
      summary.bookValue,
      summary.net_book_value,
      summary.netBookValue,
      calculated.bookValue
    ),
  };
}

function buildQuery(filters) {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });

  return params.toString();
}

function escapeCsv(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function statusClass(status) {
  const value = String(status || "").toLowerCase();

  if (
    value.includes("approved") ||
    value.includes("active") ||
    value.includes("completed")
  ) {
    return "status-success";
  }

  if (
    value.includes("pending") ||
    value.includes("draft")
  ) {
    return "status-warning";
  }

  if (
    value.includes("rejected") ||
    value.includes("failed")
  ) {
    return "status-danger";
  }

  return "status-info";
}

export default function FinanceDepreciationReports() {
  const [reports, setReports] = useState([]);

  const [summary, setSummary] = useState({
    assets: 0,
    acquisitionCost: 0,
    currentDepreciation: 0,
    accumulatedDepreciation: 0,
    bookValue: 0,
  });

  const [departments, setDepartments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [financialYears, setFinancialYears] = useState([]);

  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] =
    useState(EMPTY_FILTERS);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: PAGE_SIZE, total: 0, pages: 1 });

  const [loading, setLoading] = useState(true);
  const [loadingFilters, setLoadingFilters] =
    useState(true);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [selectedReport, setSelectedReport] =
    useState(null);

  const loadFilters = useCallback(async () => {
    setLoadingFilters(true);

    try {
      const payload = await request(
        "/finance/depreciation-reports/filters"
      );

      const root = extractObject(payload);

      const departmentRows = extractArray(
        root.departments || payload.departments
      );

      const categoryRows = extractArray(
        root.categories || payload.categories
      );

      const yearRows = extractArray(
        root.financialYears ||
          root.financial_years ||
          payload.financialYears ||
          payload.financial_years
      );

      setDepartments(
        departmentRows
          .map((item) => ({
            id: firstValue(
              item.id,
              item.department_id,
              item.departmentId
            ),
            name: textValue(
              item.name,
              item.department_name,
              item.departmentName,
              item.title
            ),
          }))
          .filter((item) => item.name)
      );

      setCategories(
        categoryRows
          .map((item) => ({
            id: firstValue(
              item.id,
              item.category_id,
              item.categoryId
            ),
            name: textValue(
              item.name,
              item.category_name,
              item.categoryName,
              item.title
            ),
          }))
          .filter((item) => item.name)
      );

      setFinancialYears(
        yearRows
          .map((item) => {
            if (
              typeof item === "string" ||
              typeof item === "number"
            ) {
              return String(item);
            }

            return textValue(
              item.year,
              item.financial_year,
              item.financialYear,
              item.fiscal_year,
              item.fiscalYear,
              item.name
            );
          })
          .filter(Boolean)
      );
    } catch {
      setDepartments([]);
      setCategories([]);
      setFinancialYears([]);
    } finally {
      setLoadingFilters(false);
    }
  }, []);

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const query = buildQuery({
        ...appliedFilters,
        search: search.trim(),
        page,
        limit: PAGE_SIZE,
      });

      const payload = await request(
        `/finance/depreciation-reports${
          query ? `?${query}` : ""
        }`
      );

      const rows = extractArray(payload).map(
        normalizeReport
      );

      setReports(rows);
      setSummary(normalizeSummary(payload, rows));
      setPagination(payload.pagination || { page, limit: PAGE_SIZE, total: rows.length, pages: 1 });
    } catch (err) {
      setReports([]);

      setSummary({
        assets: 0,
        acquisitionCost: 0,
        currentDepreciation: 0,
        accumulatedDepreciation: 0,
        bookValue: 0,
      });

      setError(
        err.message ||
          "Unable to load Depreciation Reports. Check the Finance backend API."
      );
    } finally {
      setLoading(false);
    }
  }, [appliedFilters, page, search]);

  useEffect(() => {
    loadFilters();
  }, [loadFilters]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const filteredReports = reports;
  const totalPages = Math.max(1, pagination.pages || 1);
  const paginatedReports = reports;

  const depreciationPercentage =
    summary.acquisitionCost > 0
      ? (summary.accumulatedDepreciation /
          summary.acquisitionCost) *
        100
      : 0;

  const handleFilterChange = (event) => {
    const { name, value } = event.target;

    setFilters((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const applyFilters = (event) => {
    event.preventDefault();
    setPage(1);
    setAppliedFilters(filters);
  };

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
    setSearch("");
    setPage(1);
  };

  const printReport = () => {
    window.print();
  };

  return (
    <div className="depreciation-reports-page">
      <style>{`
        * {
          box-sizing: border-box;
        }

        .depreciation-reports-page {
          min-height: 100vh;
          background: #f8fafc;
          color: #0f172a;
          font-family: Inter, ui-sans-serif, system-ui,
            -apple-system, BlinkMacSystemFont, "Segoe UI",
            sans-serif;
        }

        .reports-container {
          max-width: 1600px;
          margin: 0 auto;
          padding: 28px;
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 20px;
          margin-bottom: 24px;
        }

        .breadcrumb {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #64748b;
          font-size: 13px;
          margin-bottom: 10px;
        }

        .breadcrumb a {
          color: #2563eb;
          text-decoration: none;
        }

        .title-row {
          display: flex;
          align-items: center;
          gap: 13px;
        }

        .title-icon {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #e0f2fe;
          color: #0284c7;
        }

        h1 {
          margin: 0;
          font-size: 27px;
          line-height: 1.2;
          font-weight: 750;
          letter-spacing: -0.02em;
        }

        .subtitle {
          margin: 5px 0 0;
          color: #64748b;
          font-size: 14px;
        }

        .header-actions {
          display: flex;
          gap: 9px;
          flex-wrap: wrap;
        }

        button,
        select,
        input {
          font: inherit;
        }

        .btn {
          min-height: 40px;
          padding: 0 13px;
          border-radius: 9px;
          border: 1px solid #dbe3ee;
          background: #fff;
          color: #334155;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 650;
          text-decoration: none;
          transition: 0.18s ease;
        }

        .btn:hover {
          border-color: #94a3b8;
          transform: translateY(-1px);
        }

        .btn-primary {
          background: #0ea5e9;
          border-color: #0ea5e9;
          color: #fff;
        }

        .btn-primary:hover {
          background: #0284c7;
          border-color: #0284c7;
        }

        .btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
          transform: none;
        }

        .alert {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 15px;
          border-radius: 10px;
          margin-bottom: 18px;
          font-size: 13px;
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

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 22px;
        }

        .summary-card {
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 18px;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
        }

        .summary-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .summary-label {
          color: #64748b;
          font-size: 11px;
          font-weight: 750;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .summary-icon {
          width: 35px;
          height: 35px;
          border-radius: 9px;
          background: #f0f9ff;
          color: #0284c7;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .summary-value {
          margin-top: 11px;
          font-size: 19px;
          font-weight: 760;
          letter-spacing: -0.02em;
          overflow-wrap: anywhere;
        }

        .summary-note {
          margin-top: 5px;
          color: #94a3b8;
          font-size: 11px;
        }

        .progress-box {
          margin-top: 10px;
        }

        .progress-label {
          display: flex;
          justify-content: space-between;
          margin-bottom: 5px;
          color: #64748b;
          font-size: 10px;
        }

        .progress-track {
          height: 7px;
          background: #e2e8f0;
          border-radius: 99px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: #0ea5e9;
          border-radius: inherit;
        }

        .filter-card {
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 18px;
          margin-bottom: 18px;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.035);
        }

        .filter-title {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 14px;
          font-size: 14px;
          font-weight: 750;
        }

        .filter-grid {
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          gap: 12px;
        }

        .field label {
          display: block;
          margin-bottom: 6px;
          color: #475569;
          font-size: 12px;
          font-weight: 700;
        }

        .field input,
        .field select {
          width: 100%;
          height: 40px;
          padding: 0 11px;
          border: 1px solid #dbe3ee;
          border-radius: 8px;
          background: #fff;
          color: #0f172a;
          outline: none;
        }

        .field input:focus,
        .field select:focus {
          border-color: #38bdf8;
          box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.12);
        }

        .filter-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          margin-top: 13px;
        }

        .toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          flex-wrap: wrap;
          margin-bottom: 14px;
        }

        .search-box {
          position: relative;
          flex: 1;
          min-width: 300px;
          max-width: 500px;
        }

        .search-box svg {
          position: absolute;
          left: 11px;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
        }

        .search-box input {
          width: 100%;
          height: 40px;
          padding: 0 38px;
          border: 1px solid #dbe3ee;
          border-radius: 9px;
          background: #fff;
          outline: none;
        }

        .search-box input:focus {
          border-color: #38bdf8;
          box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.12);
        }

        .toolbar-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .table-card {
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.035);
        }

        .table-wrapper {
          width: 100%;
          overflow-x: auto;
        }

        table {
          width: 100%;
          min-width: 1600px;
          border-collapse: collapse;
        }

        th {
          background: #f8fafc;
          color: #64748b;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          font-weight: 750;
          text-align: left;
          padding: 13px 14px;
          border-bottom: 1px solid #e2e8f0;
          white-space: nowrap;
        }

        td {
          padding: 14px;
          border-bottom: 1px solid #eef2f7;
          font-size: 13px;
          vertical-align: middle;
        }

        tbody tr:hover {
          background: #f8fafc;
        }

        .primary-cell {
          color: #0f172a;
          font-weight: 700;
        }

        .secondary-cell {
          margin-top: 3px;
          color: #64748b;
          font-size: 11px;
        }

        .amount {
          font-weight: 700;
          white-space: nowrap;
        }

        .status {
          display: inline-flex;
          align-items: center;
          padding: 5px 9px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 750;
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
          background: #e0f2fe;
          color: #075985;
        }

        .action-btn {
          width: 34px;
          height: 34px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #dbe3ee;
          border-radius: 8px;
          background: #fff;
          color: #475569;
          cursor: pointer;
        }

        .action-btn:hover {
          color: #0284c7;
          border-color: #7dd3fc;
          background: #f0f9ff;
        }

        .loading-state,
        .empty-state {
          padding: 60px 20px;
          text-align: center;
          color: #64748b;
        }

        .state-icon {
          width: 52px;
          height: 52px;
          border-radius: 14px;
          background: #f1f5f9;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 12px;
        }

        .loading-state strong,
        .empty-state strong {
          display: block;
          margin-bottom: 5px;
          color: #334155;
        }

        .pagination {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 13px 16px;
          border-top: 1px solid #e2e8f0;
          color: #64748b;
          font-size: 12px;
        }

        .pagination-buttons {
          display: flex;
          gap: 7px;
          align-items: center;
        }

        .page-btn {
          width: 34px;
          height: 34px;
          border: 1px solid #dbe3ee;
          background: #fff;
          border-radius: 8px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .page-btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 1000;
          padding: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(15, 23, 42, 0.5);
        }

        .modal {
          width: min(820px, 100%);
          max-height: 90vh;
          overflow: auto;
          background: #fff;
          border-radius: 16px;
          box-shadow: 0 25px 70px rgba(15, 23, 42, 0.25);
        }

        .modal-header {
          position: sticky;
          top: 0;
          z-index: 2;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 18px 20px;
          border-bottom: 1px solid #e2e8f0;
          background: #fff;
        }

        .modal-title {
          font-size: 17px;
          font-weight: 760;
        }

        .close-btn {
          width: 34px;
          height: 34px;
          border: 0;
          border-radius: 8px;
          background: #f1f5f9;
          color: #475569;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .modal-body {
          padding: 20px;
        }

        .modal-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 13px;
        }

        .detail {
          padding: 12px;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          background: #f8fafc;
        }

        .detail-label {
          margin-bottom: 5px;
          color: #64748b;
          font-size: 10px;
          font-weight: 750;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .detail-value {
          color: #0f172a;
          font-size: 13px;
          font-weight: 650;
          overflow-wrap: anywhere;
        }

        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          padding: 15px 20px;
          border-top: 1px solid #e2e8f0;
        }

        .spin {
          animation: spin 0.9s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 1450px) {
          .summary-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .filter-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
        }

        @media (max-width: 950px) {
          .summary-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .filter-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 650px) {
          .reports-container {
            padding: 17px;
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
            grid-template-columns: 1fr;
          }

          .filter-grid {
            grid-template-columns: 1fr;
          }

          .search-box {
            min-width: 100%;
            max-width: none;
          }

          .toolbar-actions {
            width: 100%;
          }

          .toolbar-actions .btn {
            flex: 1;
          }

          .modal-grid {
            grid-template-columns: 1fr;
          }

          .pagination {
            flex-direction: column;
            align-items: stretch;
          }

          .pagination-buttons {
            justify-content: flex-end;
          }
        }

        @media print {
          .header-actions,
          .filter-card,
          .toolbar,
          .pagination,
          .action-column {
            display: none !important;
          }

          .reports-container {
            max-width: none;
            padding: 0;
          }

          .table-card {
            border: 0;
            box-shadow: none;
          }

          table {
            min-width: 0;
          }
        }
      `}</style>

      <main className="reports-container">
        <header className="page-header">
          <div>
            <div className="breadcrumb">
              <Link to="/finance">Finance</Link>
              <span>/</span>
              <span>Depreciation Reports</span>
            </div>

            <div className="title-row">
              <div className="title-icon">
                <FileBarChart2 size={25} />
              </div>

              <div>
                <h1>Depreciation Reports</h1>
                <p className="subtitle">
                  Monitor asset depreciation, accumulated
                  depreciation and current book values.
                </p>
              </div>
            </div>
          </div>

          <div className="header-actions">
            <button
              type="button"
              className="btn"
              onClick={loadReports}
              disabled={loading}
            >
              <RefreshCw
                size={16}
                className={loading ? "spin" : ""}
              />
              Refresh
            </button>

            <button
              type="button"
              className="btn"
              onClick={printReport}
            >
              <Printer size={16} />
              Print
            </button>

          </div>
        </header>

        {error && (
          <div className="alert alert-error">
            <AlertCircle size={17} />
            <span>{error}</span>

            <button
              type="button"
              className="close-btn"
              style={{
                marginLeft: "auto",
                background: "transparent",
              }}
              onClick={() => setError("")}
            >
              <X size={15} />
            </button>
          </div>
        )}

        {success && (
          <div className="alert alert-success">
            <CheckCircle2 size={17} />
            <span>{success}</span>
          </div>
        )}

        <section className="summary-grid">
          <div className="summary-card">
            <div className="summary-top">
              <span className="summary-label">
                Depreciated Assets
              </span>

              <span className="summary-icon">
                <BarChart3 size={18} />
              </span>
            </div>

            <div className="summary-value">
              {formatNumber(summary.assets)}
            </div>

            <div className="summary-note">
              Assets included in the report
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-top">
              <span className="summary-label">
                Acquisition Cost
              </span>

              <span className="summary-icon">
                <Wallet size={18} />
              </span>
            </div>

            <div className="summary-value">
              {formatMoney(summary.acquisitionCost)}
            </div>

            <div className="summary-note">
              Original recorded asset cost
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-top">
              <span className="summary-label">
                Current Depreciation
              </span>

              <span className="summary-icon">
                <TrendingDown size={18} />
              </span>
            </div>

            <div className="summary-value">
              {formatMoney(
                summary.currentDepreciation
              )}
            </div>

            <div className="summary-note">
              Depreciation for selected period
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-top">
              <span className="summary-label">
                Accumulated Depreciation
              </span>

              <span className="summary-icon">
                <TrendingDown size={18} />
              </span>
            </div>

            <div className="summary-value">
              {formatMoney(
                summary.accumulatedDepreciation
              )}
            </div>

            <div className="summary-note">
              Depreciation accumulated to date
            </div>

            <div className="progress-box">
              <div className="progress-label">
                <span>Depreciation ratio</span>

                <strong>
                  {depreciationPercentage.toFixed(1)}%
                </strong>
              </div>

              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{
                    width: `${Math.min(
                      Math.max(
                        depreciationPercentage,
                        0
                      ),
                      100
                    )}%`,
                  }}
                />
              </div>
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-top">
              <span className="summary-label">
                Current Book Value
              </span>

              <span className="summary-icon">
                <Wallet size={18} />
              </span>
            </div>

            <div className="summary-value">
              {formatMoney(summary.bookValue)}
            </div>

            <div className="summary-note">
              Net carrying value after depreciation
            </div>
          </div>
        </section>

        <section className="filter-card">
          <div className="filter-title">
            <Filter size={17} />
            Depreciation Report Filters
          </div>

          <form onSubmit={applyFilters}>
            <div className="filter-grid">
              <div className="field">
                <label htmlFor="dateFrom">
                  Date From
                </label>

                <input
                  id="dateFrom"
                  name="dateFrom"
                  type="date"
                  value={filters.dateFrom}
                  onChange={handleFilterChange}
                />
              </div>

              <div className="field">
                <label htmlFor="dateTo">
                  Date To
                </label>

                <input
                  id="dateTo"
                  name="dateTo"
                  type="date"
                  value={filters.dateTo}
                  onChange={handleFilterChange}
                />
              </div>

              <div className="field">
                <label htmlFor="financialYear">
                  Financial Year
                </label>

                <select
                  id="financialYear"
                  name="financialYear"
                  value={filters.financialYear}
                  onChange={handleFilterChange}
                  disabled={loadingFilters}
                >
                  <option value="">
                    All Financial Years
                  </option>

                  {financialYears.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="department">
                  Department
                </label>

                <select
                  id="department"
                  name="department"
                  value={filters.department}
                  onChange={handleFilterChange}
                >
                  <option value="">
                    All Departments
                  </option>

                  {departments.map((department) => (
                    <option
                      key={
                        department.id ||
                        department.name
                      }
                      value={
                        department.id ||
                        department.name
                      }
                    >
                      {department.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="category">
                  Category
                </label>

                <select
                  id="category"
                  name="category"
                  value={filters.category}
                  onChange={handleFilterChange}
                >
                  <option value="">
                    All Categories
                  </option>

                  {categories.map((category) => (
                    <option
                      key={
                        category.id ||
                        category.name
                      }
                      value={
                        category.id ||
                        category.name
                      }
                    >
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="depreciationMethod">
                  Method
                </label>

                <select
                  id="depreciationMethod"
                  name="depreciationMethod"
                  value={
                    filters.depreciationMethod
                  }
                  onChange={handleFilterChange}
                >
                  <option value="">
                    All Methods
                  </option>

                  {[...new Set(reports.map((report) => report.depreciationMethod).filter(Boolean))].map((method) => (
                    <option key={method} value={method}>{method}</option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="status">
                  Status
                </label>

                <select
                  id="status"
                  name="status"
                  value={filters.status}
                  onChange={handleFilterChange}
                >
                  <option value="">
                    All Statuses
                  </option>

                  {[...new Set(reports.map((report) => report.status).filter(Boolean))].map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="filter-actions">
              <button
                type="button"
                className="btn"
                onClick={clearFilters}
              >
                Clear
              </button>

              <button
                type="submit"
                className="btn btn-primary"
              >
                <Filter size={15} />
                Apply Filters
              </button>
            </div>
          </form>
        </section>

        <div className="toolbar">
          <div className="search-box">
            <Search size={17} />

            <input
              type="search"
              placeholder="Search asset, code, category, department..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>

          <div className="toolbar-actions">
            <Link
              to="/finance/depreciation"
              className="btn"
            >
              Depreciation
            </Link>

            <Link
              to="/finance/valuation"
              className="btn"
            >
              Asset Valuation
            </Link>
          </div>
        </div>

        <section className="table-card">
          {loading ? (
            <div className="loading-state">
              <div className="state-icon">
                <Loader2
                  size={24}
                  className="spin"
                />
              </div>

              <strong>
                Loading depreciation reports...
              </strong>

              <span>
                Retrieving depreciation data from the
                Finance backend.
              </span>
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="empty-state">
              <div className="state-icon">
                <Calendar size={24} />
              </div>

              <strong>
                No depreciation reports found
              </strong>

              <span>
                No records match the current filters or
                search criteria.
              </span>
            </div>
          ) : (
            <>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Report</th>
                      <th>Asset</th>
                      <th>Category</th>
                      <th>Department</th>
                      <th>Financial Year</th>
                      <th>Method</th>
                      <th>Acquisition Cost</th>
                      <th>Current Dep.</th>
                      <th>Accumulated Dep.</th>
                      <th>Book Value</th>
                      <th>Status</th>
                      <th className="action-column">
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {paginatedReports.map(
                      (report, index) => (
                        <tr
                          key={
                            report.id ||
                            `${report.reportNumber}-${index}`
                          }
                        >
                          <td>
                            <div className="primary-cell">
                              {report.reportNumber ||
                                "—"}
                            </div>

                            <div className="secondary-cell">
                              {formatDate(
                                report.depreciationDate
                              )}
                            </div>
                          </td>

                          <td>
                            <div className="primary-cell">
                              {report.assetName ||
                                "Unnamed Asset"}
                            </div>

                            <div className="secondary-cell">
                              {report.assetCode ||
                                "No asset code"}
                            </div>
                          </td>

                          <td>
                            {report.category || "—"}
                          </td>

                          <td>
                            {report.department ||
                              "All Departments"}
                          </td>

                          <td>
                            {report.financialYear ||
                              "—"}
                          </td>

                          <td>
                            {report.depreciationMethod ||
                              "—"}
                          </td>

                          <td className="amount">
                            {formatMoney(
                              report.acquisitionCost,
                              report.currency
                            )}
                          </td>

                          <td className="amount">
                            {formatMoney(
                              report.currentDepreciation,
                              report.currency
                            )}
                          </td>

                          <td className="amount">
                            {formatMoney(
                              report.accumulatedDepreciation,
                              report.currency
                            )}
                          </td>

                          <td className="amount">
                            {formatMoney(
                              report.bookValue,
                              report.currency
                            )}
                          </td>

                          <td>
                            <span
                              className={`status ${statusClass(
                                report.status
                              )}`}
                            >
                              {report.status ||
                                "Active"}
                            </span>
                          </td>

                          <td className="action-column">
                            <button
                              type="button"
                              className="action-btn"
                              title="View report"
                              onClick={() =>
                                setSelectedReport(
                                  report
                                )
                              }
                            >
                              <FileText size={16} />
                            </button>
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>

              <div className="pagination">
                <span>
                    Showing {pagination.total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1} to{" "}
                    {Math.min(page * PAGE_SIZE, pagination.total)} of {pagination.total} reports
                </span>

                <div className="pagination-buttons">
                  <button
                    type="button"
                    className="page-btn"
                    disabled={page <= 1}
                    onClick={() =>
                      setPage((current) =>
                        Math.max(1, current - 1)
                      )
                    }
                  >
                    <ChevronLeft size={17} />
                  </button>

                  <span
                    style={{
                      minWidth: 75,
                      height: 34,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: "1px solid #dbe3ee",
                      borderRadius: 8,
                      background: "#fff",
                      fontWeight: 700,
                    }}
                  >
                    {page} / {totalPages}
                  </span>

                  <button
                    type="button"
                    className="page-btn"
                    disabled={page >= totalPages}
                    onClick={() =>
                      setPage((current) =>
                        Math.min(
                          totalPages,
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
        </section>
      </main>

      {selectedReport && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget
            ) {
              setSelectedReport(null);
            }
          }}
        >
          <div className="modal">
            <div className="modal-header">
              <div>
                <div className="modal-title">
                  Depreciation Report Details
                </div>

                <div className="secondary-cell">
                  {selectedReport.reportNumber ||
                    "Depreciation Report"}
                </div>
              </div>

              <button
                type="button"
                className="close-btn"
                onClick={() =>
                  setSelectedReport(null)
                }
              >
                <X size={17} />
              </button>
            </div>

            <div className="modal-body">
              <div className="modal-grid">
                <div className="detail">
                  <div className="detail-label">
                    Report Number
                  </div>
                  <div className="detail-value">
                    {selectedReport.reportNumber ||
                      "—"}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">
                    Asset Code
                  </div>
                  <div className="detail-value">
                    {selectedReport.assetCode || "—"}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">
                    Asset Name
                  </div>
                  <div className="detail-value">
                    {selectedReport.assetName || "—"}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">
                    Category
                  </div>
                  <div className="detail-value">
                    {selectedReport.category || "—"}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">
                    Department
                  </div>
                  <div className="detail-value">
                    {selectedReport.department ||
                      "All Departments"}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">
                    Financial Year
                  </div>
                  <div className="detail-value">
                    {selectedReport.financialYear ||
                      "—"}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">
                    Depreciation Date
                  </div>
                  <div className="detail-value">
                    {formatDate(
                      selectedReport.depreciationDate
                    )}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">
                    Depreciation Method
                  </div>
                  <div className="detail-value">
                    {selectedReport.depreciationMethod ||
                      "—"}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">
                    Acquisition Cost
                  </div>
                  <div className="detail-value">
                    {formatMoney(
                      selectedReport.acquisitionCost,
                      selectedReport.currency
                    )}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">
                    Residual Value
                  </div>
                  <div className="detail-value">
                    {formatMoney(
                      selectedReport.residualValue,
                      selectedReport.currency
                    )}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">
                    Useful Life
                  </div>
                  <div className="detail-value">
                    {selectedReport.usefulLife
                      ? `${selectedReport.usefulLife} years`
                      : "—"}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">
                    Remaining Life
                  </div>
                  <div className="detail-value">
                    {selectedReport.remainingLife
                      ? `${selectedReport.remainingLife} years`
                      : "—"}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">
                    Depreciation Rate
                  </div>
                  <div className="detail-value">
                    {selectedReport.depreciationRate
                      ? `${selectedReport.depreciationRate}%`
                      : "—"}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">
                    Current Depreciation
                  </div>
                  <div className="detail-value">
                    {formatMoney(
                      selectedReport.currentDepreciation,
                      selectedReport.currency
                    )}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">
                    Accumulated Depreciation
                  </div>
                  <div className="detail-value">
                    {formatMoney(
                      selectedReport.accumulatedDepreciation,
                      selectedReport.currency
                    )}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">
                    Current Book Value
                  </div>
                  <div className="detail-value">
                    {formatMoney(
                      selectedReport.bookValue,
                      selectedReport.currency
                    )}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">
                    Status
                  </div>
                  <div className="detail-value">
                    <span
                      className={`status ${statusClass(
                        selectedReport.status
                      )}`}
                    >
                      {selectedReport.status ||
                        "Active"}
                    </span>
                  </div>
                </div>
              </div>

              {selectedReport.notes && (
                <div
                  className="detail"
                  style={{ marginTop: 14 }}
                >
                  <div className="detail-label">
                    Notes
                  </div>

                  <div className="detail-value">
                    {selectedReport.notes}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn"
                onClick={() =>
                  setSelectedReport(null)
                }
              >
                Close
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={printReport}
              >
                <Printer size={15} />
                Print
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}