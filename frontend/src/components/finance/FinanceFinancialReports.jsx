import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  BarChart3,
  Calendar,
  CheckCircle2,
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
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
  AlertCircle,
} from "lucide-react";

const API_URL = (
  process.env.REACT_APP_API_URL || "http://localhost:5000/api"
).replace(/\/$/, "");

const PAGE_SIZE = 10;

const EMPTY_FORM = {
  dateFrom: "",
  dateTo: "",
  department: "",
  category: "",
  status: "",
  financialYear: "",
  reportType: "comprehensive",
};

const REPORT_TYPES = [
  { value: "comprehensive", label: "Comprehensive Financial Report" },
  { value: "asset", label: "Asset Financial Report" },
  { value: "procurement", label: "Procurement Report" },
  { value: "payments", label: "Payments Report" },
  { value: "transactions", label: "Transactions Report" },
  { value: "valuation", label: "Asset Valuation Report" },
];

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
    payload.transactions,
    payload.assets,
  ];

  for (const value of candidates) {
    if (Array.isArray(value)) return value;
  }

  return [];
}

function extractObject(payload) {
  if (!payload || typeof payload !== "object") return {};
  if (payload.data && typeof payload.data === "object" && !Array.isArray(payload.data)) {
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
  const amount = Number(value) || 0;

  return `${currency} ${amount.toLocaleString(undefined, {
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
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString();
}

function normalizeReport(item) {
  const summary =
    item.summary && typeof item.summary === "object" ? item.summary : {};

  const department =
    item.department && typeof item.department === "object"
      ? item.department.name || item.department.department_name
      : firstValue(item.department_name, item.departmentName, item.department);

  const category =
    item.category && typeof item.category === "object"
      ? item.category.name || item.category.category_name
      : firstValue(item.category_name, item.categoryName, item.category);

  return {
    id: firstValue(item.id, item.report_id, item.reportId),

    reportNumber: textValue(
      item.report_number,
      item.reportNumber,
      item.reference_number,
      item.referenceNumber,
      item.id
    ),

    reportType: textValue(
      item.report_type,
      item.reportType,
      item.type,
      "Financial Report"
    ),

    reportDate: firstValue(
      item.report_date,
      item.reportDate,
      item.date,
      item.created_at,
      item.createdAt
    ),

    dateFrom: firstValue(
      item.date_from,
      item.dateFrom,
      item.period_start,
      item.periodStart
    ),

    dateTo: firstValue(
      item.date_to,
      item.dateTo,
      item.period_end,
      item.periodEnd
    ),

    financialYear: textValue(
      item.financial_year,
      item.financialYear,
      item.fiscal_year,
      item.fiscalYear
    ),

    department: textValue(department),

    category: textValue(category),

    status: textValue(
      item.status,
      item.report_status,
      item.reportStatus,
      "Generated"
    ),

    currency: textValue(item.currency, summary.currency, "ETB"),

    totalAssets: numberValue(
      item.total_assets,
      item.totalAssets,
      summary.total_assets,
      summary.totalAssets
    ),

    acquisitionCost: numberValue(
      item.acquisition_cost,
      item.acquisitionCost,
      item.total_asset_cost,
      item.totalAssetCost,
      summary.acquisition_cost,
      summary.acquisitionCost,
      summary.total_asset_cost,
      summary.totalAssetCost
    ),

    currentBookValue: numberValue(
      item.current_book_value,
      item.currentBookValue,
      item.book_value,
      item.bookValue,
      summary.current_book_value,
      summary.currentBookValue,
      summary.book_value,
      summary.bookValue
    ),

    accumulatedDepreciation: numberValue(
      item.accumulated_depreciation,
      item.accumulatedDepreciation,
      summary.accumulated_depreciation,
      summary.accumulatedDepreciation
    ),

    capitalAdditions: numberValue(
      item.capital_additions,
      item.capitalAdditions,
      summary.capital_additions,
      summary.capitalAdditions
    ),

    payments: numberValue(
      item.payments,
      item.total_payments,
      item.totalPayments,
      summary.payments,
      summary.total_payments,
      summary.totalPayments
    ),

    purchases: numberValue(
      item.purchases,
      item.total_purchases,
      item.totalPurchases,
      summary.purchases,
      summary.total_purchases,
      summary.totalPurchases
    ),

    transactions: numberValue(
      item.transactions,
      item.transaction_count,
      item.transactionCount,
      summary.transactions,
      summary.transaction_count,
      summary.transactionCount
    ),

    notes: textValue(item.notes, item.description),
  };
}

function getReportResponseSummary(payload) {
  const root = extractObject(payload);
  const summary =
    root.summary && typeof root.summary === "object"
      ? root.summary
      : root;

  return {
    totalAssets: numberValue(
      summary.total_assets,
      summary.totalAssets,
      summary.asset_count,
      summary.assetCount
    ),

    acquisitionCost: numberValue(
      summary.acquisition_cost,
      summary.acquisitionCost,
      summary.total_asset_cost,
      summary.totalAssetCost
    ),

    currentBookValue: numberValue(
      summary.current_book_value,
      summary.currentBookValue,
      summary.book_value,
      summary.bookValue
    ),

    accumulatedDepreciation: numberValue(
      summary.accumulated_depreciation,
      summary.accumulatedDepreciation
    ),

    capitalAdditions: numberValue(
      summary.capital_additions,
      summary.capitalAdditions
    ),

    payments: numberValue(
      summary.payments,
      summary.total_payments,
      summary.totalPayments
    ),

    purchases: numberValue(
      summary.purchases,
      summary.total_purchases,
      summary.totalPurchases
    ),

    transactions: numberValue(
      summary.transactions,
      summary.transaction_count,
      summary.transactionCount
    ),
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

    throw new Error(message || `Request failed with HTTP ${response.status}`);
  }

  return payload;
}

function buildQuery(form) {
  const params = new URLSearchParams();

  Object.entries(form).forEach(([key, value]) => {
    if (value) params.set(key, value);
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
    value.includes("completed") ||
    value.includes("generated") ||
    value.includes("posted")
  ) {
    return "status-success";
  }

  if (
    value.includes("pending") ||
    value.includes("draft") ||
    value.includes("processing")
  ) {
    return "status-warning";
  }

  if (
    value.includes("rejected") ||
    value.includes("failed") ||
    value.includes("cancelled")
  ) {
    return "status-danger";
  }

  return "status-info";
}

export default function FinanceFinancialReports() {
  const [reports, setReports] = useState([]);
  const [summary, setSummary] = useState({
    totalAssets: 0,
    acquisitionCost: 0,
    currentBookValue: 0,
    accumulatedDepreciation: 0,
    capitalAdditions: 0,
    payments: 0,
    purchases: 0,
    transactions: 0,
  });

  const [departments, setDepartments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [financialYears, setFinancialYears] = useState([]);

  const [filters, setFilters] = useState(EMPTY_FORM);
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FORM);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  const [loading, setLoading] = useState(true);
  const [loadingFilters, setLoadingFilters] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [selectedReport, setSelectedReport] = useState(null);
  const [showGenerate, setShowGenerate] = useState(false);

  const loadFilters = useCallback(async () => {
    setLoadingFilters(true);

    try {
      const payload = await request("/finance/financial-reports/filters");

      const root = extractObject(payload);

      setDepartments(
        extractArray(root.departments || payload.departments).map((item) => ({
          id: firstValue(item.id, item.department_id, item.departmentId),
          name: textValue(
            item.name,
            item.department_name,
            item.departmentName,
            item.title
          ),
        }))
      );

      setCategories(
        extractArray(root.categories || payload.categories).map((item) => ({
          id: firstValue(item.id, item.category_id, item.categoryId),
          name: textValue(
            item.name,
            item.category_name,
            item.categoryName,
            item.title
          ),
        }))
      );

      setFinancialYears(
        extractArray(root.financialYears || root.financial_years || payload.financialYears)
          .map((item) => {
            if (typeof item === "string" || typeof item === "number") {
              return String(item);
            }

            return textValue(
              item.year,
              item.financial_year,
              item.financialYear,
              item.name
            );
          })
          .filter(Boolean)
      );
    } catch (err) {
      // Filters are optional. The report itself remains usable.
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
        page,
        limit: PAGE_SIZE,
        ...(search.trim() ? { search: search.trim() } : {}),
      });

      const payload = await request(
        `/finance/financial-reports${query ? `?${query}` : ""}`
      );

      const root = extractObject(payload);
      const rows = extractArray(payload).map(normalizeReport);

      setReports(rows);
      setTotalRecords(Number(root.pagination?.total || rows.length));

      const serverSummary = getReportResponseSummary(payload);

      const hasServerSummary =
        Object.values(serverSummary).some((value) => Number(value) !== 0);

      if (hasServerSummary) {
        setSummary(serverSummary);
      } else {
        const calculated = rows.reduce(
          (acc, row) => ({
            totalAssets: acc.totalAssets + row.totalAssets,
            acquisitionCost: acc.acquisitionCost + row.acquisitionCost,
            currentBookValue: acc.currentBookValue + row.currentBookValue,
            accumulatedDepreciation:
              acc.accumulatedDepreciation + row.accumulatedDepreciation,
            capitalAdditions: acc.capitalAdditions + row.capitalAdditions,
            payments: acc.payments + row.payments,
            purchases: acc.purchases + row.purchases,
            transactions: acc.transactions + row.transactions,
          }),
          {
            totalAssets: 0,
            acquisitionCost: 0,
            currentBookValue: 0,
            accumulatedDepreciation: 0,
            capitalAdditions: 0,
            payments: 0,
            purchases: 0,
            transactions: 0,
          }
        );

        setSummary(calculated);
      }

      if (root.message && rows.length === 0) {
        setSuccess(root.message);
        setTimeout(() => setSuccess(""), 3000);
      }

      if (page !== 1 && rows.length === 0) setPage(1);
    } catch (err) {
      setReports([]);
      setSummary({
        totalAssets: 0,
        acquisitionCost: 0,
        currentBookValue: 0,
        accumulatedDepreciation: 0,
        capitalAdditions: 0,
        payments: 0,
        purchases: 0,
        transactions: 0,
      });
      setError(
        err.message ||
          "Unable to load Financial Reports. Check the backend API."
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

  const totalPages = Math.max(1, Math.ceil(totalRecords / PAGE_SIZE));
  const paginatedReports = filteredReports;

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const handleFilterChange = (event) => {
    const { name, value } = event.target;

    setFilters((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const applyFilters = (event) => {
    event.preventDefault();
    setAppliedFilters(filters);
  };

  const clearFilters = () => {
    setFilters(EMPTY_FORM);
    setAppliedFilters(EMPTY_FORM);
    setSearch("");
  };

  const handleGenerateReport = async () => {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const payload = {
        ...filters,
        reportType: filters.reportType || "comprehensive",
      };

      const result = await request("/finance/financial-reports/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const message =
        result?.message || "Financial report generated successfully.";

      setSuccess(message);
      setShowGenerate(false);

      await loadReports();
    } catch (err) {
      setError(
        err.message ||
          "Report generation failed. Verify the backend endpoint."
      );
    } finally {
      setLoading(false);
      setTimeout(() => setSuccess(""), 4000);
    }
  };

  const exportCsv = async () => {
    try {
      const query = buildQuery({ ...appliedFilters, search: search.trim(), export: "csv" });
      const response = await fetch(`${API_URL}/finance/financial-reports?${query}`, { headers: authHeaders() });
      if (!response.ok) throw new Error("Unable to export financial report");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `financial-reports-${new Date().toISOString().slice(0, 10)}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || "Unable to export financial report.");
    }
  };

  const printReport = () => {
    window.print();
  };

  return (
    <div className="finance-reports-page">
      <style>{`
        * {
          box-sizing: border-box;
        }

        .finance-reports-page {
          min-height: 100vh;
          background: #f8fafc;
          color: #0f172a;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system,
            BlinkMacSystemFont, "Segoe UI", sans-serif;
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
          font-size: 13px;
          color: #64748b;
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
          border: 1px solid #dbe3ee;
          background: #fff;
          color: #334155;
          min-height: 40px;
          padding: 0 13px;
          border-radius: 9px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          cursor: pointer;
          font-weight: 650;
          font-size: 13px;
          transition: 0.18s ease;
        }

        .btn:hover {
          border-color: #94a3b8;
          transform: translateY(-1px);
        }

        .btn-primary {
          background: #0ea5e9;
          color: #fff;
          border-color: #0ea5e9;
        }

        .btn-primary:hover {
          background: #0284c7;
          border-color: #0284c7;
        }

        .btn-dark {
          background: #0f172a;
          color: #fff;
          border-color: #0f172a;
        }

        .btn-danger {
          color: #b91c1c;
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
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 15px;
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
          font-size: 12px;
          font-weight: 700;
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
        }

        .summary-value {
          margin-top: 11px;
          font-size: 22px;
          font-weight: 760;
          letter-spacing: -0.02em;
          overflow-wrap: anywhere;
        }

        .summary-note {
          margin-top: 5px;
          color: #94a3b8;
          font-size: 12px;
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

        .field {
          min-width: 0;
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
          border: 1px solid #dbe3ee;
          border-radius: 8px;
          padding: 0 11px;
          color: #0f172a;
          background: #fff;
          outline: none;
        }

        .field input:focus,
        .field select:focus {
          border-color: #38bdf8;
          box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.12);
        }

        .filter-actions {
          display: flex;
          align-items: flex-end;
          gap: 8px;
        }

        .toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          margin-bottom: 14px;
          flex-wrap: wrap;
        }

        .search-box {
          position: relative;
          min-width: 300px;
          flex: 1;
          max-width: 480px;
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
          border: 1px solid #dbe3ee;
          border-radius: 9px;
          padding: 0 38px;
          outline: none;
          background: #fff;
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
          min-width: 1250px;
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
          font-weight: 700;
          color: #0f172a;
        }

        .secondary-cell {
          color: #64748b;
          font-size: 12px;
          margin-top: 3px;
        }

        .amount {
          font-weight: 700;
          white-space: nowrap;
        }

        .status {
          display: inline-flex;
          align-items: center;
          gap: 5px;
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
          border: 1px solid #dbe3ee;
          background: #fff;
          border-radius: 8px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: #475569;
        }

        .action-btn:hover {
          color: #0284c7;
          border-color: #7dd3fc;
          background: #f0f9ff;
        }

        .empty-state,
        .loading-state {
          padding: 60px 20px;
          text-align: center;
          color: #64748b;
        }

        .state-icon {
          width: 52px;
          height: 52px;
          border-radius: 14px;
          background: #f1f5f9;
          margin: 0 auto 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .empty-state strong,
        .loading-state strong {
          display: block;
          color: #334155;
          margin-bottom: 5px;
        }

        .pagination {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 13px 16px;
          gap: 10px;
          border-top: 1px solid #e2e8f0;
          color: #64748b;
          font-size: 12px;
        }

        .pagination-buttons {
          display: flex;
          gap: 7px;
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
          background: rgba(15, 23, 42, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          z-index: 1000;
        }

        .modal {
          width: min(720px, 100%);
          max-height: 90vh;
          overflow: auto;
          background: #fff;
          border-radius: 16px;
          box-shadow: 0 25px 70px rgba(15, 23, 42, 0.25);
        }

        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 18px 20px;
          border-bottom: 1px solid #e2e8f0;
          position: sticky;
          top: 0;
          background: #fff;
          z-index: 2;
        }

        .modal-title {
          font-size: 17px;
          font-weight: 760;
        }

        .close-btn {
          width: 34px;
          height: 34px;
          border: 0;
          background: #f1f5f9;
          border-radius: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #475569;
        }

        .modal-body {
          padding: 20px;
        }

        .modal-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .detail {
          padding: 12px;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          background: #f8fafc;
        }

        .detail-label {
          font-size: 11px;
          color: #64748b;
          font-weight: 750;
          text-transform: uppercase;
          margin-bottom: 5px;
        }

        .detail-value {
          color: #0f172a;
          font-size: 13px;
          font-weight: 650;
          overflow-wrap: anywhere;
        }

        .modal-footer {
          padding: 15px 20px;
          border-top: 1px solid #e2e8f0;
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }

        .generate-note {
          background: #f0f9ff;
          border: 1px solid #bae6fd;
          color: #075985;
          padding: 12px;
          border-radius: 9px;
          font-size: 12px;
          margin-bottom: 16px;
        }

        .spin {
          animation: spin 0.9s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 1200px) {
          .summary-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .filter-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 760px) {
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

          .toolbar {
            align-items: stretch;
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
          .finance-reports-page {
            background: #fff;
          }

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
              <span>Financial Reports</span>
            </div>

            <div className="title-row">
              <div className="title-icon">
                <FileBarChart2 size={25} />
              </div>

              <div>
                <h1>Financial Reports</h1>
                <p className="subtitle">
                  Monitor, generate and review university financial reports.
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
              <RefreshCw size={16} className={loading ? "spin" : ""} />
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
              onClick={() => setShowGenerate(true)}
            >
              <FileText size={16} />
              Generate Report
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
              <span className="summary-label">Total Assets</span>
              <span className="summary-icon">
                <BarChart3 size={18} />
              </span>
            </div>
            <div className="summary-value">
              {formatNumber(summary.totalAssets)}
            </div>
            <div className="summary-note">
              Assets included in the report
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-top">
              <span className="summary-label">Acquisition Cost</span>
              <span className="summary-icon">
                <Wallet size={18} />
              </span>
            </div>
            <div className="summary-value">
              {formatMoney(summary.acquisitionCost)}
            </div>
            <div className="summary-note">
              Original acquisition value
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-top">
              <span className="summary-label">Current Book Value</span>
              <span className="summary-icon">
                <TrendingUp size={18} />
              </span>
            </div>
            <div className="summary-value">
              {formatMoney(summary.currentBookValue)}
            </div>
            <div className="summary-note">
              Current financial carrying value
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
              {formatMoney(summary.accumulatedDepreciation)}
            </div>
            <div className="summary-note">
              Total depreciation recorded
            </div>
          </div>
        </section>

        <section className="filter-card">
          <div className="filter-title">
            <Filter size={17} />
            Report Filters
          </div>

          <form onSubmit={applyFilters}>
            <div className="filter-grid">
              <div className="field">
                <label htmlFor="dateFrom">Date From</label>
                <input
                  id="dateFrom"
                  name="dateFrom"
                  type="date"
                  value={filters.dateFrom}
                  onChange={handleFilterChange}
                />
              </div>

              <div className="field">
                <label htmlFor="dateTo">Date To</label>
                <input
                  id="dateTo"
                  name="dateTo"
                  type="date"
                  value={filters.dateTo}
                  onChange={handleFilterChange}
                />
              </div>

              <div className="field">
                <label htmlFor="department">Department</label>
                <select
                  id="department"
                  name="department"
                  value={filters.department}
                  onChange={handleFilterChange}
                >
                  <option value="">All Departments</option>
                  {departments.map((department) => (
                    <option
                      key={department.id || department.name}
                      value={department.id || department.name}
                    >
                      {department.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="category">Category</label>
                <select
                  id="category"
                  name="category"
                  value={filters.category}
                  onChange={handleFilterChange}
                >
                  <option value="">All Categories</option>
                  {categories.map((category) => (
                    <option
                      key={category.id || category.name}
                      value={category.id || category.name}
                    >
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="status">Status</label>
                <select
                  id="status"
                  name="status"
                  value={filters.status}
                  onChange={handleFilterChange}
                >
                  <option value="">All Statuses</option>
                  <option value="Generated">Generated</option>
                  <option value="Approved">Approved</option>
                  <option value="Posted">Posted</option>
                  <option value="Pending">Pending</option>
                  <option value="Draft">Draft</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>

              <div className="field">
                <label htmlFor="financialYear">Financial Year</label>
                <select
                  id="financialYear"
                  name="financialYear"
                  value={filters.financialYear}
                  onChange={handleFilterChange}
                  disabled={loadingFilters}
                >
                  <option value="">All Financial Years</option>

                  {financialYears.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
                marginTop: 13,
              }}
            >
              <button
                type="button"
                className="btn"
                onClick={clearFilters}
              >
                Clear
              </button>

              <button type="submit" className="btn btn-primary">
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
              placeholder="Search report number, department, category..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>

          <div className="toolbar-actions">
            <button
              type="button"
              className="btn"
              onClick={exportCsv}
              disabled={!filteredReports.length}
            >
              <Download size={15} />
              Export CSV
            </button>

            <Link to="/finance/valuation" className="btn">
              Asset Valuation
            </Link>

            <Link to="/finance/depreciation" className="btn">
              Depreciation
            </Link>
          </div>
        </div>

        <section className="table-card">
          {loading ? (
            <div className="loading-state">
              <div className="state-icon">
                <Loader2 size={24} className="spin" />
              </div>
              <strong>Loading financial reports...</strong>
              <span>Retrieving data from the finance backend.</span>
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="empty-state">
              <div className="state-icon">
                <Calendar size={24} />
              </div>

              <strong>No financial reports found</strong>

              <span>
                No records match the current filters or search criteria.
              </span>
            </div>
          ) : (
            <>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Report</th>
                      <th>Type</th>
                      <th>Date</th>
                      <th>Financial Year</th>
                      <th>Department</th>
                      <th>Total Assets</th>
                      <th>Acquisition Cost</th>
                      <th>Book Value</th>
                      <th>Depreciation</th>
                      <th>Status</th>
                      <th className="action-column">Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {paginatedReports.map((report, index) => (
                      <tr key={report.id || `${report.reportNumber}-${index}`}>
                        <td>
                          <div className="primary-cell">
                            {report.reportNumber || "—"}
                          </div>

                          <div className="secondary-cell">
                            {report.category || "All Categories"}
                          </div>
                        </td>

                        <td>
                          {report.reportType || "Financial Report"}
                        </td>

                        <td>
                          {formatDate(report.reportDate)}
                        </td>

                        <td>
                          {report.financialYear || "—"}
                        </td>

                        <td>
                          {report.department || "All Departments"}
                        </td>

                        <td className="amount">
                          {formatNumber(report.totalAssets)}
                        </td>

                        <td className="amount">
                          {formatMoney(
                            report.acquisitionCost,
                            report.currency
                          )}
                        </td>

                        <td className="amount">
                          {formatMoney(
                            report.currentBookValue,
                            report.currency
                          )}
                        </td>

                        <td className="amount">
                          {formatMoney(
                            report.accumulatedDepreciation,
                            report.currency
                          )}
                        </td>

                        <td>
                          <span
                            className={`status ${statusClass(
                              report.status
                            )}`}
                          >
                            {report.status || "Generated"}
                          </span>
                        </td>

                        <td className="action-column">
                          <button
                            type="button"
                            className="action-btn"
                            title="View report"
                            onClick={() =>
                              setSelectedReport(report)
                            }
                          >
                            <FileText size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="pagination">
                <span>
                  Showing{" "}
                  {filteredReports.length
                    ? (page - 1) * PAGE_SIZE + 1
                    : 0}{" "}
                  to{" "}
                  {Math.min(page * PAGE_SIZE, filteredReports.length)}{" "}
                  of {filteredReports.length} reports
                </span>

                <div className="pagination-buttons">
                  <button
                    type="button"
                    className="page-btn"
                    disabled={page <= 1}
                    onClick={() =>
                      setPage((current) => Math.max(1, current - 1))
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
                        Math.min(totalPages, current + 1)
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
            if (event.target === event.currentTarget) {
              setSelectedReport(null);
            }
          }}
        >
          <div className="modal">
            <div className="modal-header">
              <div>
                <div className="modal-title">
                  Financial Report Details
                </div>

                <div className="secondary-cell">
                  {selectedReport.reportNumber || "Report"}
                </div>
              </div>

              <button
                type="button"
                className="close-btn"
                onClick={() => setSelectedReport(null)}
              >
                <X size={17} />
              </button>
            </div>

            <div className="modal-body">
              <div className="modal-grid">
                <div className="detail">
                  <div className="detail-label">Report Number</div>
                  <div className="detail-value">
                    {selectedReport.reportNumber || "—"}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">Report Type</div>
                  <div className="detail-value">
                    {selectedReport.reportType || "—"}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">Report Date</div>
                  <div className="detail-value">
                    {formatDate(selectedReport.reportDate)}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">Financial Year</div>
                  <div className="detail-value">
                    {selectedReport.financialYear || "—"}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">Period</div>
                  <div className="detail-value">
                    {formatDate(selectedReport.dateFrom)} —{" "}
                    {formatDate(selectedReport.dateTo)}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">Department</div>
                  <div className="detail-value">
                    {selectedReport.department || "All Departments"}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">Category</div>
                  <div className="detail-value">
                    {selectedReport.category || "All Categories"}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">Status</div>
                  <div className="detail-value">
                    <span
                      className={`status ${statusClass(
                        selectedReport.status
                      )}`}
                    >
                      {selectedReport.status || "Generated"}
                    </span>
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">Total Assets</div>
                  <div className="detail-value">
                    {formatNumber(selectedReport.totalAssets)}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">Acquisition Cost</div>
                  <div className="detail-value">
                    {formatMoney(
                      selectedReport.acquisitionCost,
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
                      selectedReport.currentBookValue,
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
                  <div className="detail-label">Capital Additions</div>
                  <div className="detail-value">
                    {formatMoney(
                      selectedReport.capitalAdditions,
                      selectedReport.currency
                    )}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">Purchases</div>
                  <div className="detail-value">
                    {formatMoney(
                      selectedReport.purchases,
                      selectedReport.currency
                    )}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">Payments</div>
                  <div className="detail-value">
                    {formatMoney(
                      selectedReport.payments,
                      selectedReport.currency
                    )}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">Transactions</div>
                  <div className="detail-value">
                    {formatNumber(selectedReport.transactions)}
                  </div>
                </div>
              </div>

              {selectedReport.notes && (
                <div
                  className="detail"
                  style={{ marginTop: 14 }}
                >
                  <div className="detail-label">Notes</div>
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
                onClick={() => setSelectedReport(null)}
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

      {showGenerate && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowGenerate(false);
            }
          }}
        >
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">
                Generate Financial Report
              </div>

              <button
                type="button"
                className="close-btn"
                onClick={() => setShowGenerate(false)}
              >
                <X size={17} />
              </button>
            </div>

            <div className="modal-body">
              <div className="generate-note">
                The report will be generated using the selected filters
                and saved by the Finance backend.
              </div>

              <div className="field">
                <label htmlFor="reportType">Report Type</label>
                <select
                  id="reportType"
                  value={filters.reportType}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      reportType: event.target.value,
                    }))
                  }
                >
                  {REPORT_TYPES.map((type) => (
                    <option
                      key={type.value}
                      value={type.value}
                    >
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div
                className="modal-grid"
                style={{ marginTop: 14 }}
              >
                <div className="field">
                  <label htmlFor="generateDateFrom">
                    Date From
                  </label>
                  <input
                    id="generateDateFrom"
                    type="date"
                    value={filters.dateFrom}
                    onChange={(event) =>
                      setFilters((current) => ({
                        ...current,
                        dateFrom: event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="field">
                  <label htmlFor="generateDateTo">
                    Date To
                  </label>
                  <input
                    id="generateDateTo"
                    type="date"
                    value={filters.dateTo}
                    onChange={(event) =>
                      setFilters((current) => ({
                        ...current,
                        dateTo: event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="field">
                  <label htmlFor="generateDepartment">
                    Department
                  </label>
                  <select
                    id="generateDepartment"
                    value={filters.department}
                    onChange={(event) =>
                      setFilters((current) => ({
                        ...current,
                        department: event.target.value,
                      }))
                    }
                  >
                    <option value="">All Departments</option>
                    {departments.map((department) => (
                      <option
                        key={department.id || department.name}
                        value={department.id || department.name}
                      >
                        {department.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="generateCategory">
                    Category
                  </label>
                  <select
                    id="generateCategory"
                    value={filters.category}
                    onChange={(event) =>
                      setFilters((current) => ({
                        ...current,
                        category: event.target.value,
                      }))
                    }
                  >
                    <option value="">All Categories</option>
                    {categories.map((category) => (
                      <option
                        key={category.id || category.name}
                        value={category.id || category.name}
                      >
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn"
                onClick={() => setShowGenerate(false)}
              >
                Cancel
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={handleGenerateReport}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 size={15} className="spin" />
                ) : (
                  <FileBarChart2 size={15} />
                )}
                Generate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}