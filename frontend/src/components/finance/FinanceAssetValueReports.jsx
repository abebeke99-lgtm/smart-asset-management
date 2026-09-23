import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Download,
  FileBarChart2,
  FileText,
  Filter,
  Loader2,
  Printer,
  RefreshCw,
  Search,
  TrendingUp,
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
  location: "",
};

function authHeaders() {
  const token =
    localStorage.getItem("token") ||
    localStorage.getItem("accessToken") ||
    "";

  return {
    Accept: "application/json",
    ...(token
      ? { Authorization: `Bearer ${token}` }
      : {}),
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

  const contentType =
    response.headers.get("content-type") || "";

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
      message ||
        `Request failed with HTTP ${response.status}`
    );
  }

  return payload;
}

function extractArray(payload) {
  if (Array.isArray(payload)) return payload;

  if (!payload || typeof payload !== "object") {
    return [];
  }

  const candidates = [
    payload.data,
    payload.records,
    payload.items,
    payload.rows,
    payload.results,
    payload.assets,
    payload.reports,
    payload.assetValueReports,
    payload.asset_value_reports,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  return [];
}

function extractObject(payload) {
  if (!payload || typeof payload !== "object") {
    return {};
  }

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
    (value) =>
      value !== undefined &&
      value !== null &&
      value !== ""
  );
}

function numberValue(...values) {
  const value = firstValue(...values);
  const number = Number(value);

  return Number.isFinite(number) ? number : 0;
}

function textValue(...values) {
  const value = firstValue(...values);

  return value === undefined || value === null
    ? ""
    : String(value);
}

function formatMoney(value, currency) {
  if (value === null || value === undefined || value === "") {
    return "Not Available";
  }

  return `${currency ? `${currency} ` : ""}${(
    Number(value) || 0
  ).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatNumber(value) {
  return (Number(value) || 0).toLocaleString(
    undefined,
    {
      maximumFractionDigits: 2,
    }
  );
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
    item.asset &&
    typeof item.asset === "object"
      ? item.asset
      : {};

  const department =
    item.department &&
    typeof item.department === "object"
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
    item.category &&
    typeof item.category === "object"
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
    item.purchase_price,
    item.purchasePrice,
    asset.acquisition_cost,
    asset.acquisitionCost,
    asset.purchase_price,
    asset.purchasePrice
  );

  const accumulatedDepreciation = firstValue(
    item.accumulated_depreciation,
    item.accumulatedDepreciation
  );

  const capitalizedValue = firstValue(
    item.capitalized_value,
    item.capitalizedValue
  );

  const netBookValue = firstValue(
    item.net_book_value,
    item.netBookValue,
    item.book_value,
    item.bookValue
  );

  const currentValuation = firstValue(
    item.current_valuation,
    item.currentValuation
  );

  return {
    id: firstValue(
      item.id,
      item.asset_value_report_id,
      item.assetValueReportId
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
      item.asset_tag,
      item.assetTag,
      item.asset_code,
      item.assetCode,
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
      asset.name
    ),

    category: textValue(category),

    department: textValue(department),

    valuationDate: firstValue(
      item.valuation_date,
      item.valuationDate,
      item.report_date,
      item.reportDate,
      item.date,
      item.created_at,
      item.createdAt
    ),

    financialYear: textValue(
      item.financial_year,
      item.financialYear,
      item.fiscal_year,
      item.fiscalYear
    ),

    acquisitionCost,

    capitalizedValue: capitalizedValue === undefined ? null : numberValue(capitalizedValue),

    accumulatedDepreciation: accumulatedDepreciation === undefined ? null : numberValue(accumulatedDepreciation),

    bookValue: netBookValue === undefined ? null : numberValue(netBookValue),

    fairValue: currentValuation === undefined ? null : numberValue(currentValuation),

    replacementValue: null,

    residualValue: null,

    currency: textValue(
      item.currency,
      asset.currency
    ),

    status: textValue(
      item.status,
      asset.status,
      "Active"
    ),

    notes: textValue(item.notes),
  };
}

function normalizeSummary(payload, rows) {
  const root = extractObject(payload);

  const summary =
    root.summary &&
    typeof root.summary === "object"
      ? root.summary
      : {};

  return {
    assets: firstValue(
      summary.assets,
      summary.total_assets,
      summary.totalAssets,
      summary.asset_count,
      summary.assetCount
    ),

    acquisitionCost: firstValue(
      summary.acquisition_cost,
      summary.acquisitionCost,
      summary.total_acquisition_cost,
      summary.totalAcquisitionCost
    ),

    capitalizedValue: firstValue(
      summary.capitalized_value,
      summary.capitalizedValue
    ),

    accumulatedDepreciation: firstValue(
      summary.accumulated_depreciation,
      summary.accumulatedDepreciation,
      summary.total_depreciation,
      summary.totalDepreciation
    ),

    netBookValue: firstValue(
      summary.net_book_value,
      summary.netBookValue,
      summary.book_value,
      summary.current_book_value,
      summary.currentBookValue
    ),

    currentValuation: firstValue(
      summary.current_valuation,
      summary.currentValuation,
      summary.fair_value,
      summary.currentValuation,
      summary.total_fair_value,
      summary.totalFairValue
    ),

  };
}

function buildQuery(filters) {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(
    ([key, value]) => {
      if (value) {
        params.set(key, value);
      }
    }
  );

  return params.toString();
}

function escapeCsv(value) {
  return `"${String(value ?? "").replace(
    /"/g,
    '""'
  )}"`;
}

function statusClass(status) {
  const value = String(status || "").toLowerCase();

  if (
    value.includes("active") ||
    value.includes("available")
  ) {
    return "status-success";
  }

  if (
    value.includes("maintenance") ||
    value.includes("pending")
  ) {
    return "status-warning";
  }

  if (
    value.includes("disposed") ||
    value.includes("missing") ||
    value.includes("damaged")
  ) {
    return "status-danger";
  }

  return "status-info";
}

export default function FinanceAssetValueReports() {
  const [reports, setReports] = useState([]);

  const [summary, setSummary] = useState({
    assets: 0,
    acquisitionCost: 0,
    capitalizedValue: 0,
    accumulatedDepreciation: 0,
    netBookValue: null,
    currentValuation: 0,
  });

  const [departments, setDepartments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [financialYears, setFinancialYears] =
    useState([]);
  const [statuses, setStatuses] = useState([]);

  const [filters, setFilters] =
    useState(EMPTY_FILTERS);

  const [appliedFilters, setAppliedFilters] =
    useState(EMPTY_FILTERS);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });

  const [loading, setLoading] = useState(true);
  const [loadingFilters, setLoadingFilters] =
    useState(true);

  const [error, setError] = useState("");
  const [selectedReport, setSelectedReport] =
    useState(null);

  const loadFilters = useCallback(async () => {
    setLoadingFilters(true);

    try {
      const payload = await request(
        "/finance/asset-value-reports/filters"
      );

      const root = extractObject(payload);

      const departmentRows = extractArray(
        root.departments ||
          payload.departments
      );

      const categoryRows = extractArray(
        root.categories ||
          payload.categories
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
        search,
        page,
        limit: PAGE_SIZE,
      });

      const payload = await request(
        `/finance/asset-value-reports${
          query ? `?${query}` : ""
        }`
      );

      const rows = extractArray(payload).map(
        normalizeReport
      );

      setReports(rows);
      setSummary(
        normalizeSummary(payload, rows)
      );
      setPagination(payload.pagination || { total: rows.length, pages: 1 });
      const filterData = payload.filters || extractObject(payload).filters || {};
      setStatuses(filterData.statuses || []);
      setCategories((filterData.categories || []).map((item) => typeof item === "string" ? { name: item } : item));
      setFinancialYears(filterData.financialYears || []);
    } catch (err) {
      setReports([]);

      setSummary({ assets: null, acquisitionCost: null, capitalizedValue: null, accumulatedDepreciation: null, netBookValue: null, currentValuation: null });

      setError(
        err.message ||
          "Unable to load Asset Value Reports. Check the Finance backend API."
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

  const totalPages = Math.max(1, Number(pagination.pages || 1));

  const bookValuePercentage =
    Number(summary.acquisitionCost) > 0 && summary.netBookValue !== null
        ? (summary.netBookValue /
          summary.acquisitionCost) *
        100
      : null;

  const handleFilterChange = (event) => {
    const { name, value } =
      event.target;

    setFilters((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const applyFilters = (event) => {
    event.preventDefault();

    setAppliedFilters(filters);
    setPage(1);
  };

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
    setSearch("");
  };

  const exportCsv = () => {
    if (!pagination.total) {
      setError(
        "There is no asset value report data to export."
      );
      return;
    }

    const query = buildQuery({ ...appliedFilters, search, export: "csv" });
    fetch(`${API_URL}/finance/asset-value-reports?${query}`, { headers: authHeaders() })
      .then((response) => response.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `asset-value-reports-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
      })
      .catch((err) => setError(err.message || "Unable to export asset value reports."));
  };

  const printReport = () => {
    window.print();
  };

  return (
    <div className="asset-value-page">
      <style>{`
        * {
          box-sizing: border-box;
        }

        .asset-value-page {
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
          font-size: 18px;
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
          grid-template-columns: repeat(6, minmax(0, 1fr));
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
          min-width: 1500px;
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
          width: min(850px, 100%);
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
            grid-template-columns: repeat(3, minmax(0, 1fr));
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
              <Link to="/finance">
                Finance
              </Link>
              <span>/</span>
              <span>
                Asset Value Reports
              </span>
            </div>

            <div className="title-row">
              <div className="title-icon">
                <FileBarChart2 size={25} />
              </div>

              <div>
                <h1>
                  Asset Value Reports
                </h1>

                <p className="subtitle">
                  Analyze acquisition cost, current
                  book value and financial value of
                  university assets.
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
                className={
                  loading ? "spin" : ""
                }
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

            <button
              type="button"
              className="btn btn-primary"
              onClick={exportCsv}
              disabled={
                !pagination.total
              }
            >
              <Download size={16} />
              Export CSV
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

        <section className="summary-grid">
          <div className="summary-card">
            <div className="summary-top">
              <span className="summary-label">
                Total Assets
              </span>

              <span className="summary-icon">
                <BarChart3 size={18} />
              </span>
            </div>

            <div className="summary-value">
              {formatNumber(summary.assets)}
            </div>

            <div className="summary-note">
              Assets included in report
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
              {formatMoney(
                summary.acquisitionCost
              )}
            </div>

            <div className="summary-note">
              Original recorded asset cost
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-top">
              <span className="summary-label">
                Accumulated Depreciation
              </span>

              <span className="summary-icon">
                <TrendingUp size={18} />
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
              {formatMoney(
                summary.netBookValue
              )}
            </div>

            <div className="summary-note">
              Net carrying value
            </div>

            <div className="progress-box">
              <div className="progress-label">
                <span>
                  Book value ratio
                </span>

                <strong>
                  {bookValuePercentage === null
                    ? "Not Available"
                    : `${bookValuePercentage.toFixed(1)}%`}
                </strong>
              </div>

              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{
                    width: `${Math.min(
                      Math.max(bookValuePercentage || 0, 0),
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
                Fair Value
              </span>

              <span className="summary-icon">
                <TrendingUp size={18} />
              </span>
            </div>

            <div className="summary-value">
              {formatMoney(
                summary.currentValuation
              )}
            </div>

            <div className="summary-note">
              Current assessed fair value
            </div>
          </div>
        </section>

        <section className="filter-card">
          <div className="filter-title">
            <Filter size={17} />
            Asset Value Report Filters
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
                  onChange={
                    handleFilterChange
                  }
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
                  onChange={
                    handleFilterChange
                  }
                />
              </div>

              <div className="field">
                <label htmlFor="financialYear">
                  Financial Year
                </label>

                <select
                  id="financialYear"
                  name="financialYear"
                  value={
                    filters.financialYear
                  }
                  onChange={
                    handleFilterChange
                  }
                  disabled={
                    loadingFilters
                  }
                >
                  <option value="">
                    All Financial Years
                  </option>

                  {financialYears.map(
                    (year) => (
                      <option
                        key={year}
                        value={year}
                      >
                        {year}
                      </option>
                    )
                  )}
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
                  onChange={
                    handleFilterChange
                  }
                >
                  <option value="">
                    All Departments
                  </option>

                  {departments.map(
                    (department) => (
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
                    )
                  )}
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
                  onChange={
                    handleFilterChange
                  }
                >
                  <option value="">
                    All Categories
                  </option>

                  {categories.map(
                    (category) => (
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
                    )
                  )}
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
                  onChange={
                    handleFilterChange
                  }
                >
                  <option value="">
                    All Statuses
                  </option>

                  {statuses.map(
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
                setSearch(
                  event.target.value
                );
                setPage(1);
              }}
            />
          </div>

          <div className="toolbar-actions">
            <button
              type="button"
              className="btn"
              onClick={exportCsv}
              disabled={
                !pagination.total
              }
            >
              <Download size={15} />
              Export CSV
            </button>

            <Link
              to="/finance/valuation"
              className="btn"
            >
              Asset Valuation
            </Link>

            <Link
              to="/finance/depreciation-reports"
              className="btn"
            >
              Depreciation Reports
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
                Loading asset value reports...
              </strong>

              <span>
                Retrieving asset valuation data
                from the Finance backend.
              </span>
            </div>
          ) : reports.length ===
            0 ? (
            <div className="empty-state">
              <div className="state-icon">
                <CalendarIcon />
              </div>

              <strong>
                No asset value reports found
              </strong>

              <span>
                No records match the current
                filters or search criteria.
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
                      <th>Acquisition Cost</th>
                      <th>Capitalized Value</th>
                      <th>Accumulated Dep.</th>
                      <th>Net Book Value</th>
                      <th>Current Valuation</th>
                      <th>Status</th>
                      <th className="action-column">
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {reports.map(
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
                                report.valuationDate
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
                            {report.category ||
                              "—"}
                          </td>

                          <td>
                            {report.department ||
                              "All Departments"}
                          </td>

                          <td>
                            {report.financialYear ||
                              "—"}
                          </td>

                          <td className="amount">
                            {formatMoney(
                              report.capitalizedValue,
                              report.currency
                            )}
                          </td>

                          <td className="amount">
                            {formatMoney(
                              report.acquisitionCost,
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

                          <td className="amount">
                            {formatMoney(
                              report.fairValue,
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
                              <FileText
                                size={16}
                              />
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
                  Showing{" "}
                  {(page - 1) *
                    PAGE_SIZE +
                    1}{" "}
                  to{" "}
                  {Math.min(
                    page * PAGE_SIZE,
                    pagination.total
                  )}{" "}
                  of{" "}
                  {pagination.total}{" "}
                  reports
                </span>

                <div className="pagination-buttons">
                  <button
                    type="button"
                    className="page-btn"
                    disabled={page <= 1}
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
                    disabled={
                      page >= totalPages
                    }
                    onClick={() =>
                      setPage(
                        (current) =>
                          Math.min(
                            totalPages,
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
        </section>
      </main>

      {selectedReport && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setSelectedReport(null);
            }
          }}
        >
          <div className="modal">
            <div className="modal-header">
              <div>
                <div className="modal-title">
                  Asset Value Report Details
                </div>

                <div className="secondary-cell">
                  {selectedReport.reportNumber ||
                    "Asset Value Report"}
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
                <Detail
                  label="Report Number"
                  value={
                    selectedReport.reportNumber
                  }
                />

                <Detail
                  label="Asset Code"
                  value={
                    selectedReport.assetCode
                  }
                />

                <Detail
                  label="Asset Name"
                  value={
                    selectedReport.assetName
                  }
                />

                <Detail
                  label="Category"
                  value={
                    selectedReport.category
                  }
                />

                <Detail
                  label="Department"
                  value={
                    selectedReport.department
                  }
                />

                <Detail
                  label="Financial Year"
                  value={
                    selectedReport.financialYear
                  }
                />

                <Detail
                  label="Valuation Date"
                  value={formatDate(
                    selectedReport.valuationDate
                  )}
                />

                <Detail
                  label="Acquisition Cost"
                  value={formatMoney(
                    selectedReport.acquisitionCost,
                    selectedReport.currency
                  )}
                />

                <Detail
                  label="Accumulated Depreciation"
                  value={formatMoney(
                    selectedReport.accumulatedDepreciation,
                    selectedReport.currency
                  )}
                />

                <Detail
                  label="Current Book Value"
                  value={formatMoney(
                    selectedReport.bookValue,
                    selectedReport.currency
                  )}
                />

                <Detail
                  label="Fair Value"
                  value={formatMoney(
                    selectedReport.fairValue,
                    selectedReport.currency
                  )}
                />

                <Detail
                  label="Replacement Value"
                  value={formatMoney(
                    selectedReport.replacementValue,
                    selectedReport.currency
                  )}
                />

                <Detail
                  label="Residual Value"
                  value={formatMoney(
                    selectedReport.residualValue,
                    selectedReport.currency
                  )}
                />

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
                  style={{
                    marginTop: 14,
                  }}
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

function Detail({ label, value }) {
  return (
    <div className="detail">
      <div className="detail-label">
        {label}
      </div>

      <div className="detail-value">
        {value || "—"}
      </div>
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect
        width="18"
        height="18"
        x="3"
        y="4"
        rx="2"
      />
      <line
        x1="16"
        x2="16"
        y1="2"
        y2="6"
      />
      <line
        x1="8"
        x2="8"
        y1="2"
        y2="6"
      />
      <line
        x1="3"
        x2="21"
        y1="10"
        y2="10"
      />
    </svg>
  );
}