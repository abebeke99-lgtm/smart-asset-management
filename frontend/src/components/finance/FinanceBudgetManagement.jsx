import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  BarChart3,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Edit3,
  Eye,
  FileText,
  Filter,
  Loader2,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
  AlertCircle,
  Wallet,
  TrendingUp,
  TrendingDown,
  Building2,
} from "lucide-react";
import api from "../../services/api";

const emptyForm = {
  budgetCode: "",
  budgetName: "",
  fiscalYearId: "",
  fundSourceId: "",
  collegeId: "",
  departmentId: "",
  description: "",
  allocation: "",
  startDate: "",
  endDate: "",
  status: "DRAFT",
};

const firstValue = (...values) =>
  values.find((value) => value !== undefined && value !== null && value !== "");

const extractRows = (response) => {
  const data = response?.data ?? response;

  if (Array.isArray(data)) return data;

  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.records)) return data.records;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.rows)) return data.rows;

  return [];
};

const extractPagination = (response, fallbackLength, page, pageSize) => {
  const data = response?.data ?? response;
  const pagination =
    data?.pagination ||
    data?.meta ||
    data?.pageInfo ||
    response?.pagination ||
    {};

  return {
    page: Number(
      firstValue(
        pagination.page,
        pagination.currentPage,
        data?.page,
        page
      )
    ),
    pageSize: Number(
      firstValue(
        pagination.pageSize,
        pagination.limit,
        data?.pageSize,
        pageSize
      )
    ),
    total: Number(
      firstValue(
        pagination.total,
        pagination.totalItems,
        data?.total,
        data?.totalItems,
        fallbackLength
      )
    ),
    totalPages: Number(
      firstValue(
        pagination.totalPages,
        data?.totalPages,
        Math.max(
          1,
          Math.ceil(
            Number(
              firstValue(
                pagination.total,
                pagination.totalItems,
                data?.total,
                data?.totalItems,
                fallbackLength
              )
            ) / pageSize
          )
        )
      )
    ),
  };
};

const normalizeBudget = (row) => ({
  ...row,
  id: firstValue(row.id, row.budgetId, row._id),
  budgetCode: firstValue(row.budgetCode, row.budget_code, row.code, ""),
  budgetName: firstValue(row.budgetName, row.budget_name, row.name, ""),
  fiscalYearId: row.fiscalYearId,
  financialYear: firstValue(row.fiscalYear?.code, row.financialYear, row.financial_year, ""),
  fundSourceId: row.fundSourceId,
  fundSourceName: row.fundSource?.name || "",
  departmentId: row.departmentId,
  departmentName: row.department?.name || row.departmentName || "",
  collegeId: row.collegeId,
  description: firstValue(row.description, ""),
  allocatedAmount: Number(firstValue(row.allocation, 0)),
  revisedAmount: Number(firstValue(row.allocation, 0)),
  spentAmount: Number(firstValue(row.spent, 0)),
  committedAmount: Number(firstValue(row.committed, 0)),
  remainingAmount: Number(firstValue(row.available, 0)),
  currency: firstValue(row.currency, row.currency_code, "ETB"),
  startDate: firstValue(row.startDate, row.start_date),
  endDate: firstValue(row.endDate, row.end_date),
  status: firstValue(row.status, "DRAFT"),
  notes: firstValue(row.notes, ""),
  createdAt: firstValue(row.createdAt, row.created_at),
  updatedAt: firstValue(row.updatedAt, row.updated_at),
});

const money = (value, currency = "ETB") => {
  const amount = Number(value || 0);

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
};

const dateFormat = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString();
};

const statusClass = (status) => {
  const value = String(status || "").toLowerCase();

  if (
    ["approved", "active", "completed", "closed", "posted"].includes(value)
  ) {
    return "status success";
  }

  if (
    ["pending", "submitted", "review", "under review"].includes(value)
  ) {
    return "status warning";
  }

  if (
    ["rejected", "cancelled", "failed", "inactive"].includes(value)
  ) {
    return "status danger";
  }

  return "status neutral";
};

export default function FinanceBudgetManagement() {
  const [budgets, setBudgets] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [processingId, setProcessingId] = useState(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [backendSummary, setBackendSummary] = useState(null);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [financialYear, setFinancialYear] = useState("");
  const [department, setDepartment] = useState("");
  const [category, setCategory] = useState("");
  const [lookups, setLookups] = useState({ fiscalYears: [], fundSources: [], colleges: [], departments: [] });

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 1,
  });

  const [showForm, setShowForm] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const [editingBudget, setEditingBudget] = useState(null);
  const [selectedBudget, setSelectedBudget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [form, setForm] = useState(emptyForm);

  const loadBudgets = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const params = {
        page,
        limit: pageSize,
      };

      if (search.trim()) params.search = search.trim();
      if (status) params.status = status;
      if (financialYear) params.fiscalYearId = financialYear;
      if (department) params.departmentId = department;
      if (category) params.fundSourceId = category;

      const response = await api.get("/finance/budget-management", {
        params,
      });

      const rows = extractRows(response).map(normalizeBudget);
      const responseData = response?.data || {};
      setLookups(responseData.filters || { fiscalYears: [], fundSources: [], colleges: [], departments: [] });
      setBackendSummary(responseData.summary || null);

      setBudgets(rows);
      setPagination(
        extractPagination(response, rows.length, page, pageSize)
      );
    } catch (err) {
      console.error("Failed to load budgets:", err);
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to load budget records."
      );
      setBudgets([]);
    } finally {
      setLoading(false);
    }
  }, [
    page,
    pageSize,
    search,
    status,
    financialYear,
    department,
    category,
  ]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadBudgets();
    }, 300);

    return () => clearTimeout(timer);
  }, [loadBudgets]);

  useEffect(() => {
    setPage(1);
  }, [search, status, financialYear, department, category, pageSize]);

  const localSummary = useMemo(() => {
    return budgets.reduce(
      (acc, item) => {
        const allocated =
          Number(item.revisedAmount || item.allocatedAmount || 0);

        const spent = Number(item.spentAmount || 0);
        const committed = Number(item.committedAmount || 0);

        acc.totalBudgets += 1;
        acc.allocated += allocated;
        acc.spent += spent;
        acc.committed += committed;
        acc.remaining += Math.max(
          0,
          allocated - spent - committed
        );

        const normalizedStatus = String(
          item.status || ""
        ).toLowerCase();

        if (
          ["approved", "active", "posted"].includes(
            normalizedStatus
          )
        ) {
          acc.active += 1;
        }

        if (
          ["pending", "submitted", "under review"].includes(
            normalizedStatus
          )
        ) {
          acc.pending += 1;
        }

        if (
          ["closed", "completed"].includes(
            normalizedStatus
          )
        ) {
          acc.closed += 1;
        }

        return acc;
      },
      {
        totalBudgets: 0,
        active: 0,
        pending: 0,
        closed: 0,
        allocated: 0,
        spent: 0,
        committed: 0,
        remaining: 0,
      }
    );
  }, [budgets]);
  const summary = backendSummary || localSummary;

  const years = useMemo(() => {
    const values = budgets
      .map((item) => item.financialYear)
      .filter(Boolean);

    return [...new Set(values)];
  }, [budgets]);

  const departments = useMemo(() => {
    const values = budgets
      .map((item) => item.departmentName)
      .filter(Boolean);

    return [...new Set(values)];
  }, [budgets]);

  const categories = useMemo(() => {
    const values = budgets
      .map((item) => item.budgetCategory)
      .filter(Boolean);

    return [...new Set(values)];
  }, [budgets]);

  const updateForm = (field, value) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const openCreate = () => {
    setEditingBudget(null);

    setForm({ ...emptyForm });

    setError("");
    setSuccess("");
    setShowForm(true);
  };

  const openEdit = (budget) => {
    setEditingBudget(budget);

    setForm({
      budgetCode: budget.budgetCode || "",
      budgetName: budget.budgetName || "",
      fiscalYearId: budget.fiscalYearId || "",
      fundSourceId: budget.fundSourceId || "",
      collegeId: budget.collegeId || "",
      departmentId: budget.departmentId || "",
      description: budget.description || "",
      allocation: budget.allocatedAmount ?? "",
      startDate: budget.startDate
        ? String(budget.startDate).slice(0, 10)
        : "",
      endDate: budget.endDate
        ? String(budget.endDate).slice(0, 10)
        : "",
      status: budget.status || "DRAFT",
    });

    setError("");
    setSuccess("");
    setShowForm(true);
  };

  const submitForm = async (event) => {
    event.preventDefault();

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const payload = {
        budgetCode: form.budgetCode.trim(),
        budgetName: form.budgetName.trim(),
        fiscalYearId: form.fiscalYearId || null,
        fundSourceId: form.fundSourceId || null,
        collegeId: form.collegeId || null,
        departmentId: form.departmentId || null,
        description: form.description.trim(),
        allocation: form.allocation,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        status: form.status,
      };

      if (!payload.budgetCode || !payload.budgetName) {
        setError("Budget code and budget name are required.");
        return;
      }

      if (!payload.fiscalYearId || !payload.fundSourceId || !payload.allocation) {
        setError("Fiscal year, fund source, and allocation are required.");
        return;
      }

      if (editingBudget?.id) {
        await api.put(
          `/finance/budget-management/${editingBudget.id}`,
          payload
        );

        setSuccess("Budget updated successfully.");
      } else {
        await api.post("/finance/budget-management", payload);

        setSuccess("Budget created successfully.");
      }

      setShowForm(false);
      setEditingBudget(null);
      setForm(emptyForm);

      await loadBudgets();
    } catch (err) {
      console.error("Budget save failed:", err);

      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to save budget."
      );
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (budget, nextStatus) => {
    if (!budget?.id) return;

    try {
      setProcessingId(budget.id);
      setError("");
      setSuccess("");

      await api.put(
        `/finance/budget-management/${budget.id}`,
        {
          status: String(nextStatus).toUpperCase(),
        }
      );

      setSuccess(`Budget status changed to ${nextStatus}.`);

      await loadBudgets();
    } catch (err) {
      console.error("Budget status update failed:", err);

      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to update budget status."
      );
    } finally {
      setProcessingId(null);
    }
  };

  const deleteBudget = async () => {
    if (!deleteTarget?.id) return;

    try {
      setProcessingId(deleteTarget.id);
      setError("");
      setSuccess("");

      await api.delete(
        `/finance/budget-management/${deleteTarget.id}`
      );

      setSuccess("Budget deleted successfully.");
      setDeleteTarget(null);
      setShowDelete(false);

      await loadBudgets();
    } catch (err) {
      console.error("Budget delete failed:", err);

      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to delete budget."
      );
    } finally {
      setProcessingId(null);
    }
  };

  const printBudget = (budget) => {
    const popup = window.open("", "_blank", "width=900,height=700");

    if (!popup) return;

    popup.document.write(`
      <html>
        <head>
          <title>Budget ${budget.budgetCode || ""}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 40px;
              color: #0f172a;
            }
            h1 {
              margin-bottom: 4px;
            }
            .muted {
              color: #64748b;
            }
            .grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 14px;
              margin-top: 25px;
            }
            .box {
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              padding: 14px;
            }
            .label {
              font-size: 12px;
              color: #64748b;
              margin-bottom: 5px;
            }
            .value {
              font-weight: 600;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 25px;
            }
            th, td {
              border: 1px solid #e2e8f0;
              padding: 10px;
              text-align: left;
            }
            th {
              background: #f8fafc;
            }
          </style>
        </head>
        <body>
          <h1>${budget.budgetName || "Budget"}</h1>
          <div class="muted">
            ${budget.budgetCode || ""} · ${
      budget.financialYear || ""
    }
          </div>

          <div class="grid">
            <div class="box">
              <div class="label">Department</div>
              <div class="value">${
                budget.departmentName || "—"
              }</div>
            </div>

            <div class="box">
              <div class="label">Category</div>
              <div class="value">${
                budget.budgetCategory || "—"
              }</div>
            </div>

            <div class="box">
              <div class="label">Status</div>
              <div class="value">${
                budget.status || "—"
              }</div>
            </div>

            <div class="box">
              <div class="label">Account Code</div>
              <div class="value">${
                budget.accountCode || "—"
              }</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Allocated</th>
                <th>Revised</th>
                <th>Spent</th>
                <th>Committed</th>
                <th>Remaining</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${money(
                  budget.allocatedAmount,
                  budget.currency
                )}</td>
                <td>${money(
                  budget.revisedAmount,
                  budget.currency
                )}</td>
                <td>${money(
                  budget.spentAmount,
                  budget.currency
                )}</td>
                <td>${money(
                  budget.committedAmount,
                  budget.currency
                )}</td>
                <td>${money(
                  budget.remainingAmount,
                  budget.currency
                )}</td>
              </tr>
            </tbody>
          </table>

          <p style="margin-top:25px;">
            ${budget.description || ""}
          </p>

          <script>
            window.onload = function () {
              window.print();
            };
          </script>
        </body>
      </html>
    `);

    popup.document.close();
  };

  const openDetails = (budget) => {
    setSelectedBudget(budget);
    setShowDetails(true);
  };

  const clearFilters = () => {
    setSearch("");
    setStatus("");
    setFinancialYear("");
    setDepartment("");
    setCategory("");
    setPage(1);
  };

  const canApprove = (budget) => String(budget.status || "").toUpperCase() === "DRAFT";

  const canClose = (budget) => {
    const value = String(budget.status || "").toLowerCase();

    return ["ACTIVE", "SUSPENDED"].includes(value);
  };

  return (
    <div className="finance-budget-page">
      <style>{`
        * {
          box-sizing: border-box;
        }

        .finance-budget-page {
          min-height: 100vh;
          background: #f8fafc;
          color: #0f172a;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system,
            BlinkMacSystemFont, "Segoe UI", sans-serif;
          padding: 24px;
        }

        .budget-container {
          max-width: 1500px;
          margin: 0 auto;
        }

        .topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 24px;
        }

        .title-area {
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }

        .back-btn {
          width: 42px;
          height: 42px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          color: #0f172a;
          text-decoration: none;
        }

        .back-btn:hover {
          border-color: #0ea5e9;
          color: #0284c7;
        }

        .eyebrow {
          color: #0284c7;
          font-size: 12px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: .08em;
          margin-bottom: 5px;
        }

        h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 800;
          letter-spacing: -.03em;
        }

        .subtitle {
          margin: 5px 0 0;
          color: #64748b;
          font-size: 14px;
        }

        .primary-btn {
          border: 0;
          background: #0ea5e9;
          color: white;
          height: 42px;
          padding: 0 16px;
          border-radius: 10px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 5px 14px rgba(14, 165, 233, .18);
        }

        .primary-btn:hover {
          background: #0284c7;
        }

        .secondary-btn {
          border: 1px solid #e2e8f0;
          background: #fff;
          color: #334155;
          height: 42px;
          padding: 0 14px;
          border-radius: 10px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-weight: 700;
          cursor: pointer;
        }

        .secondary-btn:hover {
          border-color: #bae6fd;
          color: #0284c7;
        }

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 20px;
        }

        .summary-card {
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 17px;
          min-width: 0;
        }

        .summary-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .summary-icon {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          background: #e0f2fe;
          color: #0284c7;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .summary-label {
          color: #64748b;
          font-size: 12px;
          font-weight: 700;
          margin-top: 13px;
        }

        .summary-value {
          margin-top: 5px;
          font-size: 22px;
          font-weight: 800;
          letter-spacing: -.02em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .summary-sub {
          color: #94a3b8;
          font-size: 11px;
          margin-top: 4px;
        }

        .alerts {
          margin-bottom: 16px;
          display: grid;
          gap: 8px;
        }

        .alert {
          padding: 12px 14px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          gap: 9px;
          font-size: 13px;
          font-weight: 600;
        }

        .alert.error {
          background: #fef2f2;
          color: #b91c1c;
          border: 1px solid #fecaca;
        }

        .alert.success {
          background: #f0fdf4;
          color: #15803d;
          border: 1px solid #bbf7d0;
        }

        .toolbar {
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 14px;
          margin-bottom: 16px;
        }

        .toolbar-row {
          display: grid;
          grid-template-columns: minmax(240px, 1.7fr) repeat(4, minmax(130px, 1fr)) auto;
          gap: 10px;
          align-items: center;
        }

        .search-box {
          position: relative;
        }

        .search-box svg {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
        }

        input,
        select,
        textarea {
          width: 100%;
          border: 1px solid #dbe3ec;
          border-radius: 9px;
          background: #fff;
          color: #0f172a;
          outline: none;
          font: inherit;
        }

        input,
        select {
          height: 42px;
          padding: 0 12px;
        }

        .search-box input {
          padding-left: 38px;
        }

        textarea {
          padding: 10px 12px;
          resize: vertical;
          min-height: 90px;
        }

        input:focus,
        select:focus,
        textarea:focus {
          border-color: #38bdf8;
          box-shadow: 0 0 0 3px rgba(14, 165, 233, .10);
        }

        .filter-btn {
          height: 42px;
          padding: 0 12px;
          border: 1px solid #e2e8f0;
          border-radius: 9px;
          background: #fff;
          color: #475569;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          font-weight: 700;
          white-space: nowrap;
        }

        .table-card {
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          overflow: hidden;
        }

        .table-header {
          padding: 15px 17px;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .table-title {
          font-weight: 800;
          font-size: 15px;
        }

        .table-count {
          color: #64748b;
          font-size: 12px;
          margin-left: 7px;
        }

        .table-scroll {
          overflow-x: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          min-width: 1150px;
        }

        th {
          text-align: left;
          padding: 12px 14px;
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
          color: #64748b;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: .05em;
          white-space: nowrap;
        }

        td {
          padding: 13px 14px;
          border-bottom: 1px solid #eef2f7;
          vertical-align: middle;
          font-size: 13px;
        }

        tr:last-child td {
          border-bottom: 0;
        }

        .code {
          font-weight: 800;
          color: #0369a1;
        }

        .main-text {
          font-weight: 700;
          color: #0f172a;
        }

        .muted {
          color: #64748b;
          font-size: 12px;
          margin-top: 3px;
        }

        .amount {
          font-weight: 800;
          white-space: nowrap;
        }

        .status {
          display: inline-flex;
          align-items: center;
          padding: 5px 9px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 800;
          white-space: nowrap;
        }

        .status.success {
          background: #dcfce7;
          color: #166534;
        }

        .status.warning {
          background: #fef3c7;
          color: #92400e;
        }

        .status.danger {
          background: #fee2e2;
          color: #991b1b;
        }

        .status.neutral {
          background: #f1f5f9;
          color: #475569;
        }

        .actions {
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .icon-btn {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          background: #fff;
          color: #475569;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .icon-btn:hover {
          color: #0284c7;
          border-color: #bae6fd;
          background: #f0f9ff;
        }

        .icon-btn.danger:hover {
          color: #dc2626;
          border-color: #fecaca;
          background: #fef2f2;
        }

        .empty {
          padding: 55px 20px;
          text-align: center;
          color: #64748b;
        }

        .empty-icon {
          width: 52px;
          height: 52px;
          border-radius: 14px;
          background: #f1f5f9;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 12px;
          color: #94a3b8;
        }

        .empty strong {
          display: block;
          color: #334155;
          margin-bottom: 5px;
        }

        .loading {
          padding: 55px 20px;
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 9px;
          color: #64748b;
        }

        .pagination {
          padding: 13px 16px;
          border-top: 1px solid #e2e8f0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .pagination-info {
          color: #64748b;
          font-size: 12px;
        }

        .pagination-controls {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .page-btn {
          width: 34px;
          height: 34px;
          border: 1px solid #e2e8f0;
          background: #fff;
          border-radius: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .page-btn:disabled {
          opacity: .45;
          cursor: not-allowed;
        }

        .page-number {
          min-width: 34px;
          height: 34px;
          padding: 0 9px;
          border: 1px solid #bae6fd;
          background: #e0f2fe;
          color: #0369a1;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 800;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .modal-backdrop {
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
          width: min(900px, 100%);
          max-height: 92vh;
          overflow-y: auto;
          background: #fff;
          border-radius: 16px;
          box-shadow: 0 25px 70px rgba(15, 23, 42, .25);
        }

        .modal.small {
          width: min(450px, 100%);
        }

        .modal-header {
          padding: 17px 19px;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }

        .modal-title {
          font-size: 17px;
          font-weight: 800;
        }

        .close-btn {
          width: 34px;
          height: 34px;
          border: 0;
          background: #f1f5f9;
          border-radius: 8px;
          color: #475569;
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
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .field {
          min-width: 0;
        }

        .field.full {
          grid-column: 1 / -1;
        }

        .field label {
          display: block;
          margin-bottom: 6px;
          font-size: 12px;
          font-weight: 800;
          color: #334155;
        }

        .required {
          color: #dc2626;
        }

        .modal-footer {
          padding: 15px 20px;
          border-top: 1px solid #e2e8f0;
          display: flex;
          justify-content: flex-end;
          gap: 9px;
        }

        .details-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .detail-item {
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 12px;
        }

        .detail-label {
          font-size: 11px;
          color: #64748b;
          font-weight: 700;
          margin-bottom: 5px;
        }

        .detail-value {
          font-size: 14px;
          font-weight: 700;
          word-break: break-word;
        }

        .progress-wrap {
          margin-top: 18px;
        }

        .progress-header {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          font-size: 12px;
          font-weight: 700;
          margin-bottom: 7px;
        }

        .progress-track {
          height: 9px;
          background: #e2e8f0;
          border-radius: 999px;
          overflow: hidden;
        }

        .progress-bar {
          height: 100%;
          background: #0ea5e9;
          border-radius: inherit;
        }

        .quick-links {
          margin-top: 18px;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .quick-link {
          text-decoration: none;
          border: 1px solid #e2e8f0;
          color: #475569;
          background: #fff;
          border-radius: 9px;
          padding: 9px 11px;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          font-size: 12px;
          font-weight: 700;
        }

        .quick-link:hover {
          color: #0284c7;
          border-color: #bae6fd;
          background: #f0f9ff;
        }

        @media (max-width: 1200px) {
          .summary-grid {
            grid-template-columns: repeat(3, 1fr);
          }

          .toolbar-row {
            grid-template-columns: repeat(3, 1fr);
          }

          .search-box {
            grid-column: 1 / -1;
          }
        }

        @media (max-width: 800px) {
          .finance-budget-page {
            padding: 14px;
          }

          .topbar {
            align-items: flex-start;
            flex-direction: column;
          }

          .summary-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .toolbar-row {
            grid-template-columns: 1fr 1fr;
          }

          .form-grid,
          .details-grid {
            grid-template-columns: 1fr;
          }

          .field.full {
            grid-column: auto;
          }

          .pagination {
            align-items: flex-start;
            flex-direction: column;
          }
        }

        @media (max-width: 520px) {
          .summary-grid {
            grid-template-columns: 1fr;
          }

          .toolbar-row {
            grid-template-columns: 1fr;
          }

          h1 {
            font-size: 23px;
          }

          .title-area {
            width: 100%;
          }

          .primary-btn {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>

      <div className="budget-container">
        <div className="topbar">
          <div className="title-area">
            <Link className="back-btn" to="/finance">
              <ArrowLeft size={19} />
            </Link>

            <div>
              <div className="eyebrow">Finance</div>
              <h1>Budget Management</h1>
              <p className="subtitle">
                Manage financial allocations, commitments,
                expenditures and budget balances.
              </p>
            </div>
          </div>

          <button className="primary-btn" onClick={openCreate}>
            <Plus size={17} />
            New Budget
          </button>
        </div>

        {(error || success) && (
          <div className="alerts">
            {error && (
              <div className="alert error">
                <AlertCircle size={17} />
                {error}
              </div>
            )}

            {success && (
              <div className="alert success">
                <CheckCircle2 size={17} />
                {success}
              </div>
            )}
          </div>
        )}

        <div className="summary-grid">
          <div className="summary-card">
            <div className="summary-top">
              <div>
                <div className="summary-label">
                  Total Budgets
                </div>
                <div className="summary-value">
                  {summary.totalBudgets}
                </div>
              </div>

              <div className="summary-icon">
                <ClipboardList size={19} />
              </div>
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-top">
              <div>
                <div className="summary-label">
                  Allocated / Revised
                </div>
                <div className="summary-value">
                  {money(summary.allocated)}
                </div>
              </div>

              <div className="summary-icon">
                <Wallet size={19} />
              </div>
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-top">
              <div>
                <div className="summary-label">
                  Spent
                </div>
                <div className="summary-value">
                  {money(summary.spent)}
                </div>
              </div>

              <div className="summary-icon">
                <TrendingDown size={19} />
              </div>
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-top">
              <div>
                <div className="summary-label">
                  Committed
                </div>
                <div className="summary-value">
                  {money(summary.committed)}
                </div>
              </div>

              <div className="summary-icon">
                <TrendingUp size={19} />
              </div>
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-top">
              <div>
                <div className="summary-label">
                  Remaining
                </div>
                <div className="summary-value">
                  {money(summary.remaining)}
                </div>
              </div>

              <div className="summary-icon">
                <CircleDollarSign size={19} />
              </div>
            </div>
          </div>
        </div>

        <div className="toolbar">
          <div className="toolbar-row">
            <div className="search-box">
              <Search size={17} />

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search budget code, name, department..."
              />
            </div>

            <select
              value={financialYear}
              onChange={(e) =>
                setFinancialYear(e.target.value)
              }
            >
              <option value="">All financial years</option>

              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>

            <select
              value={department}
              onChange={(e) =>
                setDepartment(e.target.value)
              }
            >
              <option value="">All departments</option>

              {departments.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">All fund sources</option>
              {(lookups.fundSources || []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>

            <select
              value={status}
              onChange={(e) =>
                setStatus(e.target.value)
              }
            >
              <option value="">All statuses</option>
              {(lookups.statuses || ['DRAFT', 'ACTIVE', 'CLOSED', 'SUSPENDED', 'CANCELLED']).map((item) => <option key={item} value={item}>{item}</option>)}
            </select>

            <button
              className="filter-btn"
              onClick={clearFilters}
              title="Clear filters"
            >
              <Filter size={16} />
              Clear
            </button>
          </div>
        </div>

        <div className="table-card">
          <div className="table-header">
            <div>
              <span className="table-title">
                Budget Records
              </span>

              <span className="table-count">
                {pagination.total} records
              </span>
            </div>

            <button
              className="secondary-btn"
              onClick={loadBudgets}
              disabled={loading}
            >
              <RefreshCw
                size={15}
                className={loading ? "spin" : ""}
              />
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="loading">
              <Loader2 size={20} />
              Loading budget records...
            </div>
          ) : budgets.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">
                <BarChart3 size={24} />
              </div>

              <strong>No budget records found</strong>

              <div>
                No records match the current filters or
                there are no budgets in the database.
              </div>

              <button
                className="primary-btn"
                style={{ marginTop: 15 }}
                onClick={openCreate}
              >
                <Plus size={16} />
                Create Budget
              </button>
            </div>
          ) : (
            <>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Budget</th>
                      <th>Financial Year</th>
                      <th>Department</th>
                      <th>Category</th>
                      <th>Allocated</th>
                      <th>Spent</th>
                      <th>Committed</th>
                      <th>Remaining</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {budgets.map((budget) => {
                      const revised =
                        Number(
                          budget.revisedAmount ||
                            budget.allocatedAmount ||
                            0
                        );

                      const spent = Number(
                        budget.spentAmount || 0
                      );

                      const percentage =
                        revised > 0
                          ? Math.min(
                              100,
                              (spent / revised) * 100
                            )
                          : 0;

                      return (
                        <tr key={budget.id}>
                          <td>
                            <div className="code">
                              {budget.budgetCode || "—"}
                            </div>

                            <div className="main-text">
                              {budget.budgetName || "Unnamed Budget"}
                            </div>
                          </td>

                          <td>
                            {budget.financialYear || "—"}
                          </td>

                          <td>
                            {budget.departmentName || "—"}
                          </td>

                          <td>
                            {budget.budgetCategory || "—"}
                          </td>

                          <td className="amount">
                            {money(
                              revised,
                              budget.currency
                            )}
                          </td>

                          <td>
                            <div className="amount">
                              {money(
                                spent,
                                budget.currency
                              )}
                            </div>

                            <div className="muted">
                              {percentage.toFixed(1)}% used
                            </div>
                          </td>

                          <td className="amount">
                            {money(
                              budget.committedAmount,
                              budget.currency
                            )}
                          </td>

                          <td className="amount">
                            {money(
                              budget.remainingAmount,
                              budget.currency
                            )}
                          </td>

                          <td>
                            <span
                              className={statusClass(
                                budget.status
                              )}
                            >
                              {budget.status || "Unknown"}
                            </span>
                          </td>

                          <td>
                            <div className="actions">
                              <button
                                className="icon-btn"
                                onClick={() =>
                                  openDetails(budget)
                                }
                                title="View"
                              >
                                <Eye size={15} />
                              </button>

                              <button
                                className="icon-btn"
                                onClick={() =>
                                  openEdit(budget)
                                }
                                title="Edit"
                              >
                                <Edit3 size={15} />
                              </button>

                              {canApprove(budget) && (
                                <button
                                  className="icon-btn"
                                  onClick={() =>
                                    updateStatus(
                                      budget,
                                      "ACTIVE"
                                    )
                                  }
                                  disabled={
                                    processingId ===
                                    budget.id
                                  }
                                  title="Approve"
                                >
                                  {processingId ===
                                  budget.id ? (
                                    <Loader2
                                      size={15}
                                      className="spin"
                                    />
                                  ) : (
                                    <CheckCircle2
                                      size={15}
                                    />
                                  )}
                                </button>
                              )}

                              {canClose(budget) && (
                                <button
                                  className="icon-btn"
                                  onClick={() =>
                                    updateStatus(
                                      budget,
                                      "CLOSED"
                                    )
                                  }
                                  disabled={
                                    processingId ===
                                    budget.id
                                  }
                                  title="Close"
                                >
                                  <X size={15} />
                                </button>
                              )}

                              <button
                                className="icon-btn"
                                onClick={() =>
                                  printBudget(budget)
                                }
                                title="Print"
                              >
                                <FileText size={15} />
                              </button>

                              <button
                                className="icon-btn danger"
                                onClick={() => {
                                  setDeleteTarget(
                                    budget
                                  );
                                  setShowDelete(true);
                                }}
                                title="Delete"
                              >
                                <Trash2 size={15} />
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
                  Page {pagination.page || page} of{" "}
                  {pagination.totalPages || 1}
                  {" · "}
                  {pagination.total} total
                </div>

                <div className="pagination-controls">
                  <select
                    value={pageSize}
                    onChange={(e) =>
                      setPage(
                        1
                      ) ||
                      setPageSize(
                        Number(e.target.value)
                      )
                    }
                    style={{
                      width: 80,
                      height: 34,
                      fontSize: 12,
                    }}
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>

                  <button
                    className="page-btn"
                    disabled={page <= 1}
                    onClick={() =>
                      setPage((value) =>
                        Math.max(1, value - 1)
                      )
                    }
                  >
                    <ChevronLeft size={16} />
                  </button>

                  <div className="page-number">
                    {page}
                  </div>

                  <button
                    className="page-btn"
                    disabled={
                      page >=
                      (pagination.totalPages || 1)
                    }
                    onClick={() =>
                      setPage((value) =>
                        Math.min(
                          pagination.totalPages || 1,
                          value + 1
                        )
                      )
                    }
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="quick-links">
          <Link
            className="quick-link"
            to="/finance"
          >
            <BarChart3 size={15} />
            Finance Dashboard
          </Link>

          <Link
            className="quick-link"
            to="/finance/purchase-orders"
          >
            <ClipboardList size={15} />
            Purchase Orders
          </Link>

          <Link
            className="quick-link"
            to="/finance/invoices"
          >
            <FileText size={15} />
            Invoices
          </Link>

          <Link
            className="quick-link"
            to="/finance/payments"
          >
            <CircleDollarSign size={15} />
            Payments
          </Link>
        </div>
      </div>

      {showForm && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setShowForm(false);
            }
          }}
        >
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">
                {editingBudget
                  ? "Edit Budget"
                  : "Create Budget"}
              </div>

              <button
                className="close-btn"
                onClick={() =>
                  setShowForm(false)
                }
              >
                <X size={17} />
              </button>
            </div>

            <form onSubmit={submitForm}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="field">
                    <label>
                      Budget Code{" "}
                      <span className="required">
                        *
                      </span>
                    </label>

                    <input
                      value={form.budgetCode}
                      onChange={(e) =>
                        updateForm(
                          "budgetCode",
                          e.target.value
                        )
                      }
                      placeholder="e.g. BUD-2026-001"
                      required
                    />
                  </div>

                  <div className="field">
                    <label>
                      Budget Name{" "}
                      <span className="required">
                        *
                      </span>
                    </label>

                    <input
                      value={form.budgetName}
                      onChange={(e) =>
                        updateForm(
                          "budgetName",
                          e.target.value
                        )
                      }
                      placeholder="Budget name"
                      required
                    />
                  </div>

                  <div className="field">
                    <label>
                      Financial Year{" "}
                      <span className="required">
                        *
                      </span>
                    </label>

                    <select value={form.fiscalYearId} onChange={(e) => updateForm("fiscalYearId", e.target.value)} required>
                      <option value="">Select fiscal year</option>
                      {(lookups.fiscalYears || []).map((item) => <option key={item.id} value={item.id}>{item.code} {item.name ? `(${item.name})` : ""}</option>)}
                    </select>
                  </div>

                  <div className="field">
                    <label>Department</label>

                    <select value={form.departmentId} onChange={(e) => updateForm("departmentId", e.target.value)}>
                      <option value="">All departments</option>
                      {(lookups.departments || []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                  </div>

                  <div className="field">
                    <label>Department ID</label>

                    <select value={form.fundSourceId} onChange={(e) => updateForm("fundSourceId", e.target.value)} required>
                      <option value="">Select fund source</option>
                      {(lookups.fundSources || []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                  </div>

                  <div className="field">
                    <label>Allocation</label>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.allocation}
                      onChange={(e) => updateForm("allocation", e.target.value)}
                      required
                      placeholder="0.00"
                    />
                  </div>


                  <div className="field">
                    <label>Start Date</label>

                    <input
                      type="date"
                      value={form.startDate}
                      onChange={(e) =>
                        updateForm(
                          "startDate",
                          e.target.value
                        )
                      }
                    />
                  </div>

                  <div className="field">
                    <label>End Date</label>

                    <input
                      type="date"
                      value={form.endDate}
                      onChange={(e) =>
                        updateForm(
                          "endDate",
                          e.target.value
                        )
                      }
                    />
                  </div>

                  <div className="field">
                    <label>Status</label>

                    <select
                      value={form.status}
                      onChange={(e) =>
                        updateForm(
                          "status",
                          e.target.value
                        )
                      }
                    >
                      <option value="Draft">
                        Draft
                      </option>
                      <option value="Pending">
                        Pending
                      </option>
                      <option value="Submitted">
                        Submitted
                      </option>
                      <option value="Approved">
                        Approved
                      </option>
                      <option value="Active">
                        Active
                      </option>
                      <option value="Closed">
                        Closed
                      </option>
                      <option value="Rejected">
                        Rejected
                      </option>
                      <option value="Cancelled">
                        Cancelled
                      </option>
                    </select>
                  </div>

                  <div className="field full">
                    <label>Description</label>

                    <textarea
                      value={form.description}
                      onChange={(e) =>
                        updateForm(
                          "description",
                          e.target.value
                        )
                      }
                      placeholder="Budget description..."
                    />
                  </div>

                  <div className="field full">
                    <label>Notes</label>

                    <textarea
                      value={form.notes}
                      onChange={(e) =>
                        updateForm(
                          "notes",
                          e.target.value
                        )
                      }
                      placeholder="Additional financial notes..."
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() =>
                    setShowForm(false)
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-btn"
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <Loader2
                        size={16}
                        className="spin"
                      />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} />
                      {editingBudget
                        ? "Update Budget"
                        : "Create Budget"}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDetails && selectedBudget && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setShowDetails(false);
            }
          }}
        >
          <div className="modal">
            <div className="modal-header">
              <div>
                <div className="modal-title">
                  Budget Details
                </div>

                <div className="muted">
                  {selectedBudget.budgetCode || "—"}
                </div>
              </div>

              <button
                className="close-btn"
                onClick={() =>
                  setShowDetails(false)
                }
              >
                <X size={17} />
              </button>
            </div>

            <div className="modal-body">
              <div className="details-grid">
                <div className="detail-item">
                  <div className="detail-label">
                    Budget Name
                  </div>

                  <div className="detail-value">
                    {selectedBudget.budgetName || "—"}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    Status
                  </div>

                  <div className="detail-value">
                    <span
                      className={statusClass(
                        selectedBudget.status
                      )}
                    >
                      {selectedBudget.status ||
                        "Unknown"}
                    </span>
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    Financial Year
                  </div>

                  <div className="detail-value">
                    {selectedBudget.financialYear ||
                      "—"}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    Department
                  </div>

                  <div className="detail-value">
                    {selectedBudget.departmentName ||
                      "—"}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    Category
                  </div>

                  <div className="detail-value">
                    {selectedBudget.budgetCategory ||
                      "—"}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    Account Code
                  </div>

                  <div className="detail-value">
                    {selectedBudget.accountCode || "—"}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    Allocated Amount
                  </div>

                  <div className="detail-value">
                    {money(
                      selectedBudget.allocatedAmount,
                      selectedBudget.currency
                    )}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    Revised Amount
                  </div>

                  <div className="detail-value">
                    {money(
                      selectedBudget.revisedAmount,
                      selectedBudget.currency
                    )}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    Spent Amount
                  </div>

                  <div className="detail-value">
                    {money(
                      selectedBudget.spentAmount,
                      selectedBudget.currency
                    )}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    Committed Amount
                  </div>

                  <div className="detail-value">
                    {money(
                      selectedBudget.committedAmount,
                      selectedBudget.currency
                    )}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    Remaining Amount
                  </div>

                  <div className="detail-value">
                    {money(
                      selectedBudget.remainingAmount,
                      selectedBudget.currency
                    )}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    Period
                  </div>

                  <div className="detail-value">
                    {dateFormat(
                      selectedBudget.startDate
                    )}{" "}
                    —{" "}
                    {dateFormat(
                      selectedBudget.endDate
                    )}
                  </div>
                </div>
              </div>

              {(() => {
                const total = Number(
                  selectedBudget.revisedAmount ||
                    selectedBudget.allocatedAmount ||
                    0
                );

                const spent = Number(
                  selectedBudget.spentAmount || 0
                );

                const percentage =
                  total > 0
                    ? Math.min(
                        100,
                        (spent / total) * 100
                      )
                    : 0;

                return (
                  <div className="progress-wrap">
                    <div className="progress-header">
                      <span>Budget Utilization</span>
                      <span>
                        {percentage.toFixed(1)}%
                      </span>
                    </div>

                    <div className="progress-track">
                      <div
                        className="progress-bar"
                        style={{
                          width: `${percentage}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })()}

              {selectedBudget.description && (
                <div
                  style={{
                    marginTop: 18,
                    color: "#475569",
                    fontSize: 13,
                    lineHeight: 1.6,
                  }}
                >
                  <strong>Description</strong>
                  <div style={{ marginTop: 6 }}>
                    {selectedBudget.description}
                  </div>
                </div>
              )}

              {selectedBudget.notes && (
                <div
                  style={{
                    marginTop: 14,
                    color: "#475569",
                    fontSize: 13,
                    lineHeight: 1.6,
                  }}
                >
                  <strong>Notes</strong>
                  <div style={{ marginTop: 6 }}>
                    {selectedBudget.notes}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                className="secondary-btn"
                onClick={() =>
                  printBudget(selectedBudget)
                }
              >
                <FileText size={16} />
                Print
              </button>

              <button
                className="primary-btn"
                onClick={() => {
                  setShowDetails(false);
                  openEdit(selectedBudget);
                }}
              >
                <Edit3 size={16} />
                Edit
              </button>
            </div>
          </div>
        </div>
      )}

      {showDelete && deleteTarget && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setShowDelete(false);
            }
          }}
        >
          <div className="modal small">
            <div className="modal-header">
              <div className="modal-title">
                Delete Budget
              </div>

              <button
                className="close-btn"
                onClick={() =>
                  setShowDelete(false)
                }
              >
                <X size={17} />
              </button>
            </div>

            <div className="modal-body">
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  alignItems: "flex-start",
                }}
              >
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 10,
                    background: "#fef2f2",
                    color: "#dc2626",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Trash2 size={19} />
                </div>

                <div>
                  <div
                    style={{
                      fontWeight: 800,
                      marginBottom: 5,
                    }}
                  >
                    Are you sure?
                  </div>

                  <div
                    style={{
                      color: "#64748b",
                      fontSize: 13,
                      lineHeight: 1.5,
                    }}
                  >
                    This will permanently delete budget{" "}
                    <strong>
                      {deleteTarget.budgetCode ||
                        deleteTarget.budgetName}
                    </strong>{" "}
                    if the backend allows deletion.
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="secondary-btn"
                onClick={() =>
                  setShowDelete(false)
                }
              >
                Cancel
              </button>

              <button
                className="primary-btn"
                style={{
                  background: "#dc2626",
                }}
                onClick={deleteBudget}
                disabled={
                  processingId === deleteTarget.id
                }
              >
                {processingId === deleteTarget.id ? (
                  <>
                    <Loader2
                      size={16}
                      className="spin"
                    />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  );
}