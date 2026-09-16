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

const EMPTY_FILTERS = {
  dateFrom: "",
  dateTo: "",
  financialYear: "",
  department: "",
  budgetType: "",
  status: "",
};

const BUDGET_TYPES = [
  "Capital Budget",
  "Operating Budget",
  "Procurement Budget",
  "Asset Budget",
  "Maintenance Budget",
  "Other",
];

const STATUSES = [
  "Draft",
  "Pending",
  "Approved",
  "Active",
  "Closed",
  "Rejected",
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
    payload.budgets,
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

function normalizeBudgetReport(item) {
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

  const summary =
    item.summary && typeof item.summary === "object"
      ? item.summary
      : {};

  const budgetAmount = numberValue(
    item.budget_amount,
    item.budgetAmount,
    item.allocated_amount,
    item.allocatedAmount,
    item.total_budget,
    item.totalBudget,
    summary.budget_amount,
    summary.budgetAmount,
    summary.allocated_amount,
    summary.allocatedAmount
  );

  const actualAmount = numberValue(
    item.actual_amount,
    item.actualAmount,
    item.spent_amount,
    item.spentAmount,
    item.expenditure,
    summary.actual_amount,
    summary.actualAmount,
    summary.spent_amount,
    summary.spentAmount
  );

  const committedAmount = numberValue(
    item.committed_amount,
    item.committedAmount,
    item.commitments,
    summary.committed_amount,
    summary.committedAmount,
    summary.commitments
  );

  const remainingAmount = numberValue(
    item.remaining_amount,
    item.remainingAmount,
    item.available_amount,
    item.availableAmount,
    summary.remaining_amount,
    summary.remainingAmount,
    budgetAmount - actualAmount - committedAmount
  );

  return {
    id: firstValue(
      item.id,
      item.budget_report_id,
      item.budgetReportId,
      item.budget_id,
      item.budgetId
    ),

    reportNumber: textValue(
      item.report_number,
      item.reportNumber,
      item.reference_number,
      item.referenceNumber,
      item.id
    ),

    budgetCode: textValue(
      item.budget_code,
      item.budgetCode,
      item.code
    ),

    budgetName: textValue(
      item.budget_name,
      item.budgetName,
      item.name,
      item.description
    ),

    budgetType: textValue(
      item.budget_type,
      item.budgetType,
      item.type
    ),

    financialYear: textValue(
      item.financial_year,
      item.financialYear,
      item.fiscal_year,
      item.fiscalYear
    ),

    department: textValue(department),

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

    reportDate: firstValue(
      item.report_date,
      item.reportDate,
      item.date,
      item.created_at,
      item.createdAt
    ),

    budgetAmount,

    committedAmount,

    actualAmount,

    remainingAmount,

    utilization: numberValue(
      item.utilization,
      item.utilization_rate,
      item.utilizationRate,
      budgetAmount
        ? ((actualAmount + committedAmount) / budgetAmount) * 100
        : 0
    ),

    currency: textValue(
      item.currency,
      summary.currency,
      "ETB"
    ),

    status: textValue(
      item.status,
      item.budget_status,
      item.budgetStatus,
      "Active"
    ),

    notes: textValue(
      item.notes,
      item.description
    ),
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
      budgetAmount: acc.budgetAmount + row.budgetAmount,
      committedAmount:
        acc.committedAmount + row.committedAmount,
      actualAmount: acc.actualAmount + row.actualAmount,
      remainingAmount:
        acc.remainingAmount + row.remainingAmount,
      budgetCount: acc.budgetCount + 1,
    }),
    {
      budgetAmount: 0,
      committedAmount: 0,
      actualAmount: 0,
      remainingAmount: 0,
      budgetCount: 0,
    }
  );

  const hasServerValues = Object.keys(summary).length > 0;

  return {
    budgetCount: numberValue(
      summary.budget_count,
      summary.budgetCount,
      summary.total_budgets,
      summary.totalBudgets,
      calculated.budgetCount
    ),

    budgetAmount: numberValue(
      summary.budget_amount,
      summary.budgetAmount,
      summary.total_budget,
      summary.totalBudget,
      summary.allocated_amount,
      summary.allocatedAmount,
      calculated.budgetAmount
    ),

    committedAmount: numberValue(
      summary.committed_amount,
      summary.committedAmount,
      summary.commitments,
      calculated.committedAmount
    ),

    actualAmount: numberValue(
      summary.actual_amount,
      summary.actualAmount,
      summary.spent_amount,
      summary.spentAmount,
      summary.expenditure,
      calculated.actualAmount
    ),

    remainingAmount: numberValue(
      summary.remaining_amount,
      summary.remainingAmount,
      summary.available_amount,
      summary.availableAmount,
      hasServerValues
        ? undefined
        : calculated.remainingAmount
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
    value.includes("closed")
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

function utilizationClass(value) {
  const amount = Number(value) || 0;

  if (amount >= 100) return "util-danger";
  if (amount >= 80) return "util-warning";
  return "util-success";
}

export default function FinanceBudgetReports() {
  const [reports, setReports] = useState([]);

  const [summary, setSummary] = useState({
    budgetCount: 0,
    budgetAmount: 0,
    committedAmount: 0,
    actualAmount: 0,
    remainingAmount: 0,
  });

  const [departments, setDepartments] = useState([]);
  const [financialYears, setFinancialYears] = useState([]);

  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] =
    useState(EMPTY_FILTERS);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [loadingFilters, setLoadingFilters] =
    useState(true);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [selectedReport, setSelectedReport] =
    useState(null);

  const [showGenerate, setShowGenerate] =
    useState(false);

  const loadFilters = useCallback(async () => {
    setLoadingFilters(true);

    try {
      const payload = await request(
        "/finance/budget-reports/filters"
      );

      const root = extractObject(payload);

      const departmentRows = extractArray(
        root.departments || payload.departments
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
      setFinancialYears([]);
    } finally {
      setLoadingFilters(false);
    }
  }, []);

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const query = buildQuery(appliedFilters);

      const payload = await request(
        `/finance/budget-reports${
          query ? `?${query}` : ""
        }`
      );

      const rows = extractArray(payload).map(
        normalizeBudgetReport
      );

      setReports(rows);
      setSummary(normalizeSummary(payload, rows));
      setPage(1);
    } catch (err) {
      setReports([]);

      setSummary({
        budgetCount: 0,
        budgetAmount: 0,
        committedAmount: 0,
        actualAmount: 0,
        remainingAmount: 0,
      });

      setError(
        err.message ||
          "Unable to load Budget Reports. Check the Finance backend API."
      );
    } finally {
      setLoading(false);
    }
  }, [appliedFilters]);

  useEffect(() => {
    loadFilters();
  }, [loadFilters]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const filteredReports = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return reports;
    }

    return reports.filter((report) =>
      [
        report.reportNumber,
        report.budgetCode,
        report.budgetName,
        report.budgetType,
        report.financialYear,
        report.department,
        report.status,
        report.notes,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [reports, search]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredReports.length / PAGE_SIZE)
  );

  const paginatedReports = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;

    return filteredReports.slice(
      start,
      start + PAGE_SIZE
    );
  }, [filteredReports, page]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const utilization =
    summary.budgetAmount > 0
      ? ((summary.actualAmount +
          summary.committedAmount) /
          summary.budgetAmount) *
        100
      : 0;

  const actualUtilization =
    summary.budgetAmount > 0
      ? (summary.actualAmount /
          summary.budgetAmount) *
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
    setAppliedFilters(filters);
  };

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
    setSearch("");
  };

  const generateReport = async () => {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const payload = {
        ...filters,
      };

      const result = await request(
        "/finance/budget-reports/generate",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      setSuccess(
        result?.message ||
          "Budget report generated successfully."
      );

      setShowGenerate(false);

      await loadReports();

      setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      setError(
        err.message ||
          "Unable to generate the budget report."
      );
    } finally {
      setLoading(false);
    }
  };

  const exportCsv = () => {
    if (!filteredReports.length) {
      setError("There is no budget report data to export.");
      return;
    }

    const headers = [
      "Report Number",
      "Budget Code",
      "Budget Name",
      "Budget Type",
      "Financial Year",
      "Department",
      "Period From",
      "Period To",
      "Budget Amount",
      "Committed Amount",
      "Actual Amount",
      "Remaining Amount",
      "Utilization %",
      "Status",
      "Currency",
    ];

    const rows = filteredReports.map((report) => [
      report.reportNumber,
      report.budgetCode,
      report.budgetName,
      report.budgetType,
      report.financialYear,
      report.department,
      formatDate(report.periodFrom),
      formatDate(report.periodTo),
      report.budgetAmount,
      report.committedAmount,
      report.actualAmount,
      report.remainingAmount,
      report.utilization.toFixed(2),
      report.status,
      report.currency,
    ]);

    const csv = [
      headers.map(escapeCsv).join(","),
      ...rows.map((row) =>
        row.map(escapeCsv).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = `budget-reports-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    URL.revokeObjectURL(url);
  };

  const printReport = () => {
    window.print();
  };

  return (
    <div className="budget-reports-page">
      <style>{`
        * {
          box-sizing: border-box;
        }

        .budget-reports-page {
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
          font-size: 20px;
          font-weight: 760;
          letter-spacing: -0.02em;
          overflow-wrap: anywhere;
        }

        .summary-note {
          margin-top: 5px;
          color: #94a3b8;
          font-size: 11px;
        }

        .utilization-box {
          margin-top: 9px;
        }

        .progress-track {
          height: 7px;
          background: #e2e8f0;
          border-radius: 99px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          border-radius: inherit;
          background: #0ea5e9;
          transition: width 0.25s ease;
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
          min-width: 1400px;
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

        .utilization {
          font-weight: 750;
          white-space: nowrap;
        }

        .util-success {
          color: #15803d;
        }

        .util-warning {
          color: #b45309;
        }

        .util-danger {
          color: #dc2626;
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
          width: min(760px, 100%);
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

        .generate-note {
          margin-bottom: 16px;
          padding: 12px;
          border: 1px solid #bae6fd;
          border-radius: 9px;
          background: #f0f9ff;
          color: #075985;
          font-size: 12px;
        }

        .spin {
          animation: spin 0.9s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 1350px) {
          .summary-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .filter-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 900px) {
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
          .budget-reports-page {
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
              <span>Budget Reports</span>
            </div>

            <div className="title-row">
              <div className="title-icon">
                <FileBarChart2 size={25} />
              </div>

              <div>
                <h1>Budget Reports</h1>
                <p className="subtitle">
                  Monitor budget allocation, commitments,
                  expenditure and remaining funds.
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
              <span className="summary-label">
                Budget Records
              </span>

              <span className="summary-icon">
                <BarChart3 size={18} />
              </span>
            </div>

            <div className="summary-value">
              {formatNumber(summary.budgetCount)}
            </div>

            <div className="summary-note">
              Budget records in selected period
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-top">
              <span className="summary-label">
                Total Budget
              </span>

              <span className="summary-icon">
                <Wallet size={18} />
              </span>
            </div>

            <div className="summary-value">
              {formatMoney(summary.budgetAmount)}
            </div>

            <div className="summary-note">
              Approved / allocated budget
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-top">
              <span className="summary-label">
                Committed
              </span>

              <span className="summary-icon">
                <TrendingUp size={18} />
              </span>
            </div>

            <div className="summary-value">
              {formatMoney(summary.committedAmount)}
            </div>

            <div className="summary-note">
              Purchase and expenditure commitments
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-top">
              <span className="summary-label">
                Actual Expenditure
              </span>

              <span className="summary-icon">
                <TrendingDown size={18} />
              </span>
            </div>

            <div className="summary-value">
              {formatMoney(summary.actualAmount)}
            </div>

            <div className="summary-note">
              Recorded actual spending
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-top">
              <span className="summary-label">
                Remaining
              </span>

              <span className="summary-icon">
                <Wallet size={18} />
              </span>
            </div>

            <div className="summary-value">
              {formatMoney(summary.remainingAmount)}
            </div>

            <div className="summary-note">
              Available budget balance
            </div>

            <div className="utilization-box">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 10,
                  color: "#64748b",
                  marginBottom: 5,
                }}
              >
                <span>Utilization</span>
                <strong>
                  {utilization.toFixed(1)}%
                </strong>
              </div>

              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{
                    width: `${Math.min(
                      Math.max(utilization, 0),
                      100
                    )}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="filter-card">
          <div className="filter-title">
            <Filter size={17} />
            Budget Report Filters
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
                <label htmlFor="budgetType">
                  Budget Type
                </label>

                <select
                  id="budgetType"
                  name="budgetType"
                  value={filters.budgetType}
                  onChange={handleFilterChange}
                >
                  <option value="">
                    All Budget Types
                  </option>

                  {BUDGET_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
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

                  {STATUSES.map((status) => (
                    <option
                      key={status}
                      value={status}
                    >
                      {status}
                    </option>
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
              placeholder="Search budget code, name, department..."
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

            <Link
              to="/finance/budget-management"
              className="btn"
            >
              Budget Management
            </Link>

            <Link
              to="/finance/financial-reports"
              className="btn"
            >
              Financial Reports
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
                Loading budget reports...
              </strong>

              <span>
                Retrieving budget data from the Finance
                backend.
              </span>
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="empty-state">
              <div className="state-icon">
                <Calendar size={24} />
              </div>

              <strong>
                No budget reports found
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
                      <th>Budget</th>
                      <th>Type</th>
                      <th>Financial Year</th>
                      <th>Department</th>
                      <th>Budget Amount</th>
                      <th>Committed</th>
                      <th>Actual</th>
                      <th>Remaining</th>
                      <th>Utilization</th>
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
                                report.reportDate
                              )}
                            </div>
                          </td>

                          <td>
                            <div className="primary-cell">
                              {report.budgetName ||
                                "Unnamed Budget"}
                            </div>

                            <div className="secondary-cell">
                              {report.budgetCode ||
                                "No budget code"}
                            </div>
                          </td>

                          <td>
                            {report.budgetType || "—"}
                          </td>

                          <td>
                            {report.financialYear ||
                              "—"}
                          </td>

                          <td>
                            {report.department ||
                              "All Departments"}
                          </td>

                          <td className="amount">
                            {formatMoney(
                              report.budgetAmount,
                              report.currency
                            )}
                          </td>

                          <td className="amount">
                            {formatMoney(
                              report.committedAmount,
                              report.currency
                            )}
                          </td>

                          <td className="amount">
                            {formatMoney(
                              report.actualAmount,
                              report.currency
                            )}
                          </td>

                          <td className="amount">
                            {formatMoney(
                              report.remainingAmount,
                              report.currency
                            )}
                          </td>

                          <td>
                            <span
                              className={`utilization ${utilizationClass(
                                report.utilization
                              )}`}
                            >
                              {report.utilization.toFixed(
                                1
                              )}
                              %
                            </span>
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
                  Showing{" "}
                  {(page - 1) * PAGE_SIZE + 1} to{" "}
                  {Math.min(
                    page * PAGE_SIZE,
                    filteredReports.length
                  )}{" "}
                  of {filteredReports.length} reports
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
                  Budget Report Details
                </div>

                <div className="secondary-cell">
                  {selectedReport.reportNumber ||
                    "Budget Report"}
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
                    Budget Code
                  </div>

                  <div className="detail-value">
                    {selectedReport.budgetCode ||
                      "—"}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">
                    Budget Name
                  </div>

                  <div className="detail-value">
                    {selectedReport.budgetName ||
                      "—"}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">
                    Budget Type
                  </div>

                  <div className="detail-value">
                    {selectedReport.budgetType ||
                      "—"}
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
                    Department
                  </div>

                  <div className="detail-value">
                    {selectedReport.department ||
                      "All Departments"}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">
                    Period
                  </div>

                  <div className="detail-value">
                    {formatDate(
                      selectedReport.periodFrom
                    )}{" "}
                    —{" "}
                    {formatDate(
                      selectedReport.periodTo
                    )}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">
                    Report Date
                  </div>

                  <div className="detail-value">
                    {formatDate(
                      selectedReport.reportDate
                    )}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">
                    Budget Amount
                  </div>

                  <div className="detail-value">
                    {formatMoney(
                      selectedReport.budgetAmount,
                      selectedReport.currency
                    )}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">
                    Committed Amount
                  </div>

                  <div className="detail-value">
                    {formatMoney(
                      selectedReport.committedAmount,
                      selectedReport.currency
                    )}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">
                    Actual Expenditure
                  </div>

                  <div className="detail-value">
                    {formatMoney(
                      selectedReport.actualAmount,
                      selectedReport.currency
                    )}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">
                    Remaining Amount
                  </div>

                  <div className="detail-value">
                    {formatMoney(
                      selectedReport.remainingAmount,
                      selectedReport.currency
                    )}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">
                    Utilization
                  </div>

                  <div className="detail-value">
                    {selectedReport.utilization.toFixed(
                      2
                    )}
                    %
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

      {showGenerate && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget
            ) {
              setShowGenerate(false);
            }
          }}
        >
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">
                Generate Budget Report
              </div>

              <button
                type="button"
                className="close-btn"
                onClick={() =>
                  setShowGenerate(false)
                }
              >
                <X size={17} />
              </button>
            </div>

            <div className="modal-body">
              <div className="generate-note">
                The Finance backend will generate the
                report using the selected budget filters.
              </div>

              <div className="modal-grid">
                <div className="field">
                  <label htmlFor="generateFinancialYear">
                    Financial Year
                  </label>

                  <select
                    id="generateFinancialYear"
                    value={filters.financialYear}
                    onChange={(event) =>
                      setFilters((current) => ({
                        ...current,
                        financialYear:
                          event.target.value,
                      }))
                    }
                  >
                    <option value="">
                      All Financial Years
                    </option>

                    {financialYears.map((year) => (
                      <option
                        key={year}
                        value={year}
                      >
                        {year}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="generateBudgetType">
                    Budget Type
                  </label>

                  <select
                    id="generateBudgetType"
                    value={filters.budgetType}
                    onChange={(event) =>
                      setFilters((current) => ({
                        ...current,
                        budgetType:
                          event.target.value,
                      }))
                    }
                  >
                    <option value="">
                      All Budget Types
                    </option>

                    {BUDGET_TYPES.map((type) => (
                      <option
                        key={type}
                        value={type}
                      >
                        {type}
                      </option>
                    ))}
                  </select>
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
                        department:
                          event.target.value,
                      }))
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
                  <label htmlFor="generateStatus">
                    Status
                  </label>

                  <select
                    id="generateStatus"
                    value={filters.status}
                    onChange={(event) =>
                      setFilters((current) => ({
                        ...current,
                        status:
                          event.target.value,
                      }))
                    }
                  >
                    <option value="">
                      All Statuses
                    </option>

                    {STATUSES.map((status) => (
                      <option
                        key={status}
                        value={status}
                      >
                        {status}
                      </option>
                    ))}
                  </select>
                </div>

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
                        dateFrom:
                          event.target.value,
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
                        dateTo:
                          event.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn"
                onClick={() =>
                  setShowGenerate(false)
                }
              >
                Cancel
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={generateReport}
                disabled={loading}
              >
                {loading ? (
                  <Loader2
                    size={15}
                    className="spin"
                  />
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