import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import * as XLSX from "xlsx";
import {
  Activity,
  AlertCircle,
  BarChart3,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  FileSpreadsheet,
  Package,
  PieChart as PieChartIcon,
  RefreshCw,
  Search,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wrench,
  X,
} from "lucide-react";

const INITIAL_FILTERS = {
  dateFrom: "",
  dateTo: "",
  department: "",
  category: "",
  status: "",
  financialYear: "",
};

const STATUS_OPTIONS = [
  "Active",
  "Under Maintenance",
  "Inactive",
  "Disposed",
];

function firstValue(...values) {
  return values.find(
    (value) =>
      value !== undefined &&
      value !== null &&
      value !== ""
  );
}

function getPayload(response) {
  return (
    response?.data?.data ??
    response?.data ??
    {}
  );
}

function asArray(value) {
  if (Array.isArray(value)) return value;

  if (Array.isArray(value?.data))
    return value.data;

  if (Array.isArray(value?.items))
    return value.items;

  if (Array.isArray(value?.rows))
    return value.rows;

  if (Array.isArray(value?.records))
    return value.records;

  if (Array.isArray(value?.results))
    return value.results;

  return [];
}

function numberValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatETB(value) {
  return `${numberValue(value).toLocaleString(
    "en-US",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  )} ETB`;
}

function formatNumber(value) {
  return numberValue(value).toLocaleString(
    "en-US"
  );
}

function getLabel(item) {
  return String(
    firstValue(
      item?.name,
      item?.label,
      item?.department,
      item?.category,
      item?.status,
      item?.year,
      item?.financialYear,
      item?.financial_year,
      item?.month,
      item?.period,
      "Unknown"
    )
  );
}

function getValue(item) {
  return numberValue(
    firstValue(
      item?.value,
      item?.amount,
      item?.total,
      item?.count,
      item?.assetValue,
      item?.asset_value,
      item?.cost,
      0
    )
  );
}

function StatCard({
  icon: Icon,
  title,
  value,
  subtitle,
  tone,
}) {
  return (
    <div className="stat-card">
      <div className="stat-content">
        <div className="stat-title">
          {title}
        </div>

        <div className="stat-value">
          {value}
        </div>

        {subtitle && (
          <div className="stat-subtitle">
            {subtitle}
          </div>
        )}
      </div>

      <div className={`stat-icon ${tone}`}>
        <Icon size={21} />
      </div>
    </div>
  );
}

function EmptyChart({ message }) {
  return (
    <div className="chart-empty">
      <BarChart3 size={31} />
      <span>{message}</span>
    </div>
  );
}

function BarChart({ data }) {
  const rows = asArray(data);

  if (!rows.length) {
    return (
      <EmptyChart message="No department data available." />
    );
  }

  const normalized = rows
    .map((item) => ({
      label: getLabel(item),
      value: getValue(item),
    }))
    .filter((item) => item.value >= 0)
    .slice(0, 12);

  const maxValue = Math.max(
    ...normalized.map((item) => item.value),
    1
  );

  return (
    <div className="bar-chart">
      {normalized.map((item, index) => (
        <div
          className="bar-row"
          key={`${item.label}-${index}`}
        >
          <div className="bar-label">
            <span title={item.label}>
              {item.label}
            </span>

            <strong>
              {formatETB(item.value)}
            </strong>
          </div>

          <div className="bar-track">
            <div
              className="bar-fill"
              style={{
                width: `${Math.max(
                  2,
                  (item.value / maxValue) *
                    100
                )}%`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function DonutChart({ data }) {
  const rows = asArray(data);

  if (!rows.length) {
    return (
      <EmptyChart message="No category data available." />
    );
  }

  const normalized = rows
    .map((item) => ({
      label: getLabel(item),
      value: getValue(item),
    }))
    .filter((item) => item.value >= 0)
    .slice(0, 8);

  const total = normalized.reduce(
    (sum, item) => sum + item.value,
    0
  );

  if (total <= 0) {
    return (
      <EmptyChart message="No category values available." />
    );
  }

  let current = 0;

  const segments = normalized.map(
    (item, index) => {
      const start = current;
      const percentage =
        (item.value / total) * 100;

      current += percentage;

      return {
        ...item,
        start,
        end: current,
        index,
        percentage,
      };
    }
  );

  const gradient = segments
    .map(
      (item) =>
        `var(--chart-${item.index % 6}) ${item.start}% ${item.end}%`
    )
    .join(", ");

  return (
    <div className="donut-layout">
      <div
        className="donut"
        style={{
          background: `conic-gradient(${gradient})`,
        }}
      >
        <div className="donut-inner">
          <strong>
            {formatETB(total)}
          </strong>

          <span>Total Value</span>
        </div>
      </div>

      <div className="legend">
        {segments.map((item) => (
          <div
            className="legend-item"
            key={`${item.label}-${item.index}`}
          >
            <div className="legend-name">
              <span
                className="legend-dot"
                style={{
                  background:
                    `var(--chart-${item.index % 6})`,
                }}
              />

              <span title={item.label}>
                {item.label}
              </span>
            </div>

            <strong>
              {item.percentage.toFixed(1)}%
            </strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusChart({ data }) {
  const rows = asArray(data);

  if (!rows.length) {
    return (
      <EmptyChart message="No status data available." />
    );
  }

  const normalized = rows
    .map((item) => ({
      label: getLabel(item),
      value: getValue(item),
    }))
    .filter((item) => item.value >= 0)
    .slice(0, 8);

  const maxValue = Math.max(
    ...normalized.map((item) => item.value),
    1
  );

  return (
    <div className="status-chart">
      {normalized.map((item, index) => (
        <div
          className="status-column"
          key={`${item.label}-${index}`}
        >
          <div className="status-number">
            {formatNumber(item.value)}
          </div>

          <div className="status-bar-area">
            <div
              className="status-bar"
              style={{
                height: `${Math.max(
                  4,
                  (item.value / maxValue) *
                    100
                )}%`,
              }}
            />
          </div>

          <div
            className="status-label"
            title={item.label}
          >
            {item.label}
          </div>
        </div>
      ))}
    </div>
  );
}

function TrendChart({ data }) {
  const rows = asArray(data);

  if (!rows.length) {
    return (
      <EmptyChart message="No value trend data available." />
    );
  }

  const normalized = rows
    .map((item) => ({
      label: getLabel(item),
      value: getValue(item),
    }))
    .filter((item) => item.value >= 0)
    .slice(-12);

  if (!normalized.length) {
    return (
      <EmptyChart message="No value trend data available." />
    );
  }

  const maxValue = Math.max(
    ...normalized.map((item) => item.value),
    1
  );

  const width = 700;
  const height = 260;
  const paddingX = 34;
  const paddingY = 25;

  const usableWidth =
    width - paddingX * 2;

  const usableHeight =
    height - paddingY * 2;

  const points = normalized.map(
    (item, index) => {
      const x =
        normalized.length === 1
          ? width / 2
          : paddingX +
            (index /
              (normalized.length - 1)) *
              usableWidth;

      const y =
        paddingY +
        usableHeight -
        (item.value / maxValue) *
          usableHeight;

      return {
        ...item,
        x,
        y,
      };
    }
  );

  const path = points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`
    )
    .join(" ");

  return (
    <div className="trend-wrapper">
      <svg
        className="trend-svg"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
      >
        <line
          x1="34"
          y1="235"
          x2="666"
          y2="235"
          className="grid-line"
        />

        <line
          x1="34"
          y1="145"
          x2="666"
          y2="145"
          className="grid-line"
        />

        <line
          x1="34"
          y1="55"
          x2="666"
          y2="55"
          className="grid-line"
        />

        <path
          d={path}
          className="trend-line"
          fill="none"
        />

        {points.map((point, index) => (
          <circle
            key={index}
            cx={point.x}
            cy={point.y}
            r="4"
            className="trend-point"
          />
        ))}
      </svg>

      <div className="trend-labels">
        {normalized.map(
          (item, index) => (
            <div
              key={`${item.label}-${index}`}
              title={item.label}
            >
              {item.label}
            </div>
          )
        )}
      </div>
    </div>
  );
}

export default function FinanceDashboard() {
  const [filters, setFilters] =
    useState(INITIAL_FILTERS);

  const [dashboard, setDashboard] =
    useState({
      summary: {},
      byDepartment: [],
      byCategory: [],
      byStatus: [],
      valueTrend: [],
    });

  const [departments, setDepartments] =
    useState([]);

  const [categories, setCategories] =
    useState([]);

  const [financialYears, setFinancialYears] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [filterLoading, setFilterLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [showFilters, setShowFilters] =
    useState(true);

  const loadFilterOptions =
    useCallback(async () => {
      try {
        const response =
          await api.get(
            "/api/finance/dashboard/filters"
          );

        const payload =
          getPayload(response);

        setDepartments(
          asArray(
            firstValue(
              payload?.departments,
              payload?.departmentOptions,
              payload?.department_options
            )
          )
        );

        setCategories(
          asArray(
            firstValue(
              payload?.categories,
              payload?.categoryOptions,
              payload?.category_options
            )
          )
        );

        const years = asArray(
          firstValue(
            payload?.financialYears,
            payload?.financial_years,
            payload?.years
          )
        );

        setFinancialYears(
          years.length
            ? years
            : []
        );
      } catch (err) {
        console.error(
          "Finance filter endpoint unavailable:",
          err
        );
        if ([401, 403].includes(err?.response?.status)) {
          setError(
            err.response.status === 401
              ? "Your session has expired. Please sign in again."
              : "You are not authorized to view Finance Dashboard filters."
          );
        }
      }
    }, []);

  const loadDashboard =
    useCallback(async () => {
      try {
        setError("");

        if (!dashboard.summary) {
          setLoading(true);
        } else {
          setFilterLoading(true);
        }

        const response =
          await api.get(
            "/api/finance/dashboard",
            {
              params: {
                dateFrom:
                  filters.dateFrom ||
                  undefined,

                dateTo:
                  filters.dateTo ||
                  undefined,

                department:
                  filters.department ||
                  undefined,

                category:
                  filters.category ||
                  undefined,

                status:
                  filters.status ||
                  undefined,

                financialYear:
                  filters.financialYear ||
                  undefined,
              },
            }
          );

        const payload =
          getPayload(response);

        const summary =
          payload?.summary ||
          payload?.statistics ||
          payload?.stats ||
          {};

        setDashboard({
          summary,

          byDepartment: asArray(
            firstValue(
              payload?.byDepartment,
              payload?.by_department,
              payload?.assetsByDepartment,
              payload?.assets_by_department
            )
          ),

          byCategory: asArray(
            firstValue(
              payload?.byCategory,
              payload?.by_category,
              payload?.assetsByCategory,
              payload?.assets_by_category
            )
          ),

          byStatus: asArray(
            firstValue(
              payload?.byStatus,
              payload?.by_status,
              payload?.assetsByStatus,
              payload?.assets_by_status
            )
          ),

          valueTrend: asArray(
            firstValue(
              payload?.valueTrend,
              payload?.value_trend,
              payload?.assetValueTrend,
              payload?.asset_value_trend
            )
          ),
        });
      } catch (err) {
        console.error(
          "Finance dashboard error:",
          err
        );

        setError(
          err?.response?.data?.message ||
            "Unable to load Finance Dashboard data."
        );
      } finally {
        setLoading(false);
        setFilterLoading(false);
      }
    }, [filters]);

  useEffect(() => {
    loadFilterOptions();
  }, [loadFilterOptions]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    if (!success) return;

    const timer = setTimeout(
      () => setSuccess(""),
      3500
    );

    return () =>
      clearTimeout(timer);
  }, [success]);

  const summary = dashboard.summary || {};

  const stats = useMemo(
    () => ({
      totalAssetCost: firstValue(
        summary.totalAssetCost,
        summary.total_asset_cost,
        summary.totalCost,
        summary.total_cost,
        0
      ),

      currentBookValue: firstValue(
        summary.currentBookValue,
        summary.current_book_value,
        summary.bookValue,
        summary.book_value,
        0
      ),

      accumulatedDepreciation:
        firstValue(
          summary.accumulatedDepreciation,
          summary.accumulated_depreciation,
          summary.depreciation,
          0
        ),

      totalAssets: firstValue(
        summary.totalAssets,
        summary.total_assets,
        0
      ),

      activeAssets: firstValue(
        summary.activeAssets,
        summary.active_assets,
        0
      ),

      underMaintenance: firstValue(
        summary.underMaintenance,
        summary.under_maintenance,
        summary.maintenanceAssets,
        0
      ),

      disposed: firstValue(
        summary.disposed,
        summary.disposedAssets,
        summary.disposed_assets,
        0
      ),

      requiringValuation:
        firstValue(
          summary.requiringValuation,
          summary.requiring_valuation,
          summary.assetsRequiringValuation,
          0
        ),
    }),
    [summary]
  );

  const updateFilter = (
    field,
    value
  ) => {
    setFilters((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const clearFilters = () => {
    setFilters(INITIAL_FILTERS);
  };

  const exportExcel = async () => {
    try {
      setError("");
      const summaryRows = Object.entries(stats).map(([metric, value]) => ({
        Metric: metric,
        Value: numberValue(value),
      }));
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summaryRows), "Summary");
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(dashboard.byDepartment), "Departments");
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(dashboard.byCategory), "Categories");
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(dashboard.byStatus), "Statuses");
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(dashboard.valueTrend), "Value Trend");
      XLSX.writeFile(workbook, `finance-dashboard-${new Date().toISOString().slice(0, 10)}.xlsx`);

      setSuccess(
        "Finance dashboard exported successfully."
      );
    } catch (err) {
      console.error(
        "Finance dashboard export error:",
        err
      );

      setError(
        err?.response?.data?.message ||
          "Unable to export Finance Dashboard."
      );
    }
  };

  return (
    <div className="finance-dashboard">
      <style>{`
        :root {
          --finance-primary: #0ea5e9;
          --finance-blue: #2563eb;
          --finance-navy: #0f172a;
          --finance-bg: #f8fafc;
          --finance-border: #e2e8f0;
          --finance-muted: #64748b;

          --chart-0: #0ea5e9;
          --chart-1: #2563eb;
          --chart-2: #14b8a6;
          --chart-3: #8b5cf6;
          --chart-4: #f59e0b;
          --chart-5: #ef4444;
        }

        * {
          box-sizing: border-box;
        }

        .finance-dashboard {
          min-height: 100vh;
          background: var(--finance-bg);
          color: var(--finance-navy);
          font-family:
            Inter,
            ui-sans-serif,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
          padding: 24px;
        }

        .finance-container {
          max-width: 1500px;
          margin: 0 auto;
        }

        .dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 20px;
          margin-bottom: 22px;
        }

        .welcome-area {
          display: flex;
          gap: 14px;
          align-items: flex-start;
        }

        .finance-logo {
          width: 52px;
          height: 52px;
          border-radius: 15px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          background:
            linear-gradient(
              135deg,
              var(--finance-primary),
              var(--finance-blue)
            );
          box-shadow:
            0 12px 28px
            rgba(37, 99, 235, .18);
        }

        .welcome-area h1 {
          margin: 0;
          font-size: 27px;
          font-weight: 850;
          letter-spacing: -.03em;
        }

        .welcome-area p {
          margin: 5px 0 0;
          color: var(--finance-muted);
          font-size: 13px;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .btn {
          min-height: 40px;
          padding: 0 13px;
          border-radius: 9px;
          border: 1px solid transparent;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          font-size: 12px;
          font-weight: 750;
          cursor: pointer;
          transition: .2s ease;
          text-decoration: none;
          white-space: nowrap;
        }

        .btn:hover {
          transform: translateY(-1px);
        }

        .btn:disabled {
          opacity: .55;
          cursor: not-allowed;
          transform: none;
        }

        .btn-primary {
          color: white;
          background: var(--finance-primary);
        }

        .btn-primary:hover {
          background: #0284c7;
        }

        .btn-secondary {
          color: #334155;
          background: white;
          border-color: var(--finance-border);
        }

        .btn-secondary:hover {
          background: #f8fafc;
        }

        .btn-green {
          color: white;
          background: #16a34a;
        }

        .alert {
          margin-bottom: 15px;
          padding: 12px 14px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          font-weight: 650;
        }

        .alert-error {
          color: #991b1b;
          background: #fef2f2;
          border: 1px solid #fecaca;
        }

        .alert-success {
          color: #166534;
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
        }

        .filters-card {
          margin-bottom: 17px;
          padding: 15px;
          border: 1px solid var(--finance-border);
          border-radius: 14px;
          background: white;
          box-shadow:
            0 4px 18px
            rgba(15, 23, 42, .035);
        }

        .filters-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          margin-bottom: 12px;
        }

        .filters-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          font-weight: 850;
        }

        .filters-grid {
          display: grid;
          grid-template-columns:
            repeat(6, minmax(130px, 1fr));
          gap: 9px;
        }

        .field {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .field label {
          color: #64748b;
          font-size: 9px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: .04em;
        }

        .input,
        .select {
          width: 100%;
          height: 39px;
          padding: 0 10px;
          border: 1px solid var(--finance-border);
          border-radius: 8px;
          background: white;
          color: #334155;
          font-size: 11px;
          outline: none;
        }

        .input:focus,
        .select:focus {
          border-color: var(--finance-primary);
          box-shadow:
            0 0 0 3px
            rgba(14, 165, 233, .1);
        }

        .select-wrap {
          position: relative;
        }

        .select-wrap .select {
          appearance: none;
          padding-right: 28px;
        }

        .select-arrow {
          position: absolute;
          right: 9px;
          top: 50%;
          transform: translateY(-50%);
          pointer-events: none;
          color: #94a3b8;
        }

        .filter-buttons {
          display: flex;
          align-items: flex-end;
          gap: 7px;
        }

        .filter-buttons .btn {
          width: 100%;
        }

        .stats-grid {
          display: grid;
          grid-template-columns:
            repeat(4, minmax(0, 1fr));
          gap: 13px;
          margin-bottom: 13px;
        }

        .stats-grid.secondary {
          margin-bottom: 18px;
        }

        .stat-card {
          min-height: 116px;
          padding: 17px;
          border: 1px solid var(--finance-border);
          border-radius: 14px;
          background: white;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          box-shadow:
            0 4px 18px
            rgba(15, 23, 42, .035);
        }

        .stat-title {
          color: #64748b;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: .04em;
        }

        .stat-value {
          margin-top: 8px;
          font-size: 22px;
          font-weight: 850;
          letter-spacing: -.02em;
          word-break: break-word;
        }

        .stat-subtitle {
          margin-top: 5px;
          color: #94a3b8;
          font-size: 9px;
        }

        .stat-icon {
          width: 41px;
          height: 41px;
          border-radius: 11px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .stat-icon.blue {
          color: #2563eb;
          background: #eff6ff;
        }

        .stat-icon.cyan {
          color: #0891b2;
          background: #ecfeff;
        }

        .stat-icon.green {
          color: #16a34a;
          background: #f0fdf4;
        }

        .stat-icon.orange {
          color: #ea580c;
          background: #fff7ed;
        }

        .stat-icon.red {
          color: #dc2626;
          background: #fef2f2;
        }

        .stat-icon.purple {
          color: #7c3aed;
          background: #f5f3ff;
        }

        .chart-grid {
          display: grid;
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
          gap: 15px;
          margin-bottom: 15px;
        }

        .chart-card {
          min-height: 350px;
          padding: 17px;
          border: 1px solid var(--finance-border);
          border-radius: 14px;
          background: white;
          box-shadow:
            0 4px 18px
            rgba(15, 23, 42, .035);
        }

        .chart-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 17px;
        }

        .chart-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          font-weight: 850;
        }

        .chart-subtitle {
          margin-top: 3px;
          color: #94a3b8;
          font-size: 9px;
        }

        .chart-body {
          min-height: 265px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .chart-empty {
          min-height: 245px;
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 9px;
          color: #94a3b8;
          font-size: 11px;
        }

        .bar-chart {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .bar-row {
          width: 100%;
        }

        .bar-label {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 5px;
          font-size: 10px;
        }

        .bar-label span {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: #475569;
        }

        .bar-label strong {
          color: #0f172a;
          white-space: nowrap;
        }

        .bar-track {
          height: 9px;
          overflow: hidden;
          border-radius: 999px;
          background: #f1f5f9;
        }

        .bar-fill {
          height: 100%;
          min-width: 2px;
          border-radius: inherit;
          background:
            linear-gradient(
              90deg,
              var(--finance-primary),
              var(--finance-blue)
            );
          transition: width .35s ease;
        }

        .donut-layout {
          width: 100%;
          display: grid;
          grid-template-columns:
            minmax(170px, .9fr)
            minmax(180px, 1.1fr);
          align-items: center;
          gap: 20px;
        }

        .donut {
          width: 190px;
          height: 190px;
          margin: 0 auto;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .donut-inner {
          width: 116px;
          height: 116px;
          border-radius: 50%;
          background: white;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          box-shadow:
            inset 0 0 0 1px #f1f5f9;
        }

        .donut-inner strong {
          font-size: 12px;
          max-width: 100px;
          word-break: break-word;
        }

        .donut-inner span {
          margin-top: 4px;
          color: #94a3b8;
          font-size: 8px;
        }

        .legend {
          display: flex;
          flex-direction: column;
          gap: 9px;
        }

        .legend-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          font-size: 10px;
        }

        .legend-name {
          min-width: 0;
          display: flex;
          align-items: center;
          gap: 7px;
        }

        .legend-name span:last-child {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .legend-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .legend-item strong {
          white-space: nowrap;
        }

        .status-chart {
          width: 100%;
          height: 250px;
          padding: 10px 15px 0;
          display: flex;
          align-items: stretch;
          justify-content: center;
          gap: 18px;
          border-bottom: 1px solid #e2e8f0;
        }

        .status-column {
          flex: 1;
          min-width: 30px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-end;
        }

        .status-number {
          margin-bottom: 5px;
          color: #475569;
          font-size: 9px;
          font-weight: 800;
        }

        .status-bar-area {
          height: 185px;
          width: 100%;
          display: flex;
          align-items: flex-end;
          justify-content: center;
        }

        .status-bar {
          width: min(42px, 75%);
          min-height: 4px;
          border-radius: 7px 7px 0 0;
          background:
            linear-gradient(
              180deg,
              var(--finance-primary),
              var(--finance-blue)
            );
          transition: height .35s ease;
        }

        .status-label {
          width: 100%;
          margin-top: 8px;
          color: #64748b;
          font-size: 8px;
          text-align: center;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .trend-wrapper {
          width: 100%;
        }

        .trend-svg {
          width: 100%;
          height: 245px;
          overflow: visible;
        }

        .grid-line {
          stroke: #e2e8f0;
          stroke-width: 1;
          stroke-dasharray: 4 4;
        }

        .trend-line {
          stroke: var(--finance-primary);
          stroke-width: 4;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .trend-point {
          fill: white;
          stroke: var(--finance-blue);
          stroke-width: 3;
        }

        .trend-labels {
          display: flex;
          justify-content: space-between;
          gap: 6px;
          color: #94a3b8;
          font-size: 8px;
        }

        .trend-labels div {
          min-width: 0;
          max-width: 70px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          text-align: center;
        }

        .quick-links {
          display: grid;
          grid-template-columns:
            repeat(4, minmax(0, 1fr));
          gap: 11px;
          margin-top: 15px;
        }

        .quick-link {
          padding: 13px;
          border: 1px solid var(--finance-border);
          border-radius: 11px;
          background: white;
          color: #334155;
          text-decoration: none;
          display: flex;
          align-items: center;
          gap: 9px;
          font-size: 11px;
          font-weight: 750;
          transition: .2s ease;
        }

        .quick-link:hover {
          border-color: #bae6fd;
          background: #f0f9ff;
          color: #0369a1;
          transform: translateY(-1px);
        }

        .loading-overlay {
          position: fixed;
          inset: 0;
          z-index: 2000;
          background:
            rgba(248, 250, 252, .72);
          display: flex;
          align-items: center;
          justify-content: center;
          backdrop-filter: blur(2px);
        }

        .loading-box {
          padding: 18px 22px;
          border: 1px solid var(--finance-border);
          border-radius: 12px;
          background: white;
          box-shadow:
            0 15px 45px
            rgba(15, 23, 42, .12);
          display: flex;
          align-items: center;
          gap: 10px;
          color: #334155;
          font-size: 12px;
          font-weight: 700;
        }

        .spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 1200px) {
          .filters-grid {
            grid-template-columns:
              repeat(3, minmax(150px, 1fr));
          }

          .stats-grid {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }

          .quick-links {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 850px) {
          .finance-dashboard {
            padding: 15px;
          }

          .dashboard-header {
            flex-direction: column;
          }

          .filters-grid {
            grid-template-columns:
              repeat(2, minmax(140px, 1fr));
          }

          .chart-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 560px) {
          .welcome-area h1 {
            font-size: 22px;
          }

          .filters-grid {
            grid-template-columns: 1fr;
          }

          .stats-grid {
            grid-template-columns: 1fr;
          }

          .quick-links {
            grid-template-columns: 1fr;
          }

          .donut-layout {
            grid-template-columns: 1fr;
          }

          .donut {
            width: 165px;
            height: 165px;
          }

          .status-chart {
            gap: 7px;
            padding-left: 5px;
            padding-right: 5px;
          }
        }
      `}</style>

      <div className="finance-container">
        <div className="dashboard-header">
          <div className="welcome-area">
            <div className="finance-logo">
              <CircleDollarSign
                size={25}
              />
            </div>

            <div>
              <h1>
                Welcome, Finance Manager 👋
              </h1>

              <p>
                Monitor university asset
                financial performance,
                valuation, depreciation,
                and financial status.
              </p>
            </div>
          </div>

          <div className="header-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={loadDashboard}
              disabled={
                loading ||
                filterLoading
              }
            >
              <RefreshCw
                size={14}
                className={
                  loading ||
                  filterLoading
                    ? "spin"
                    : ""
                }
              />
              Refresh
            </button>

            <button
              type="button"
              className="btn btn-green"
              onClick={exportExcel}
            >
              <FileSpreadsheet size={14} />

              Export to Excel
            </button>
          </div>
        </div>

        {error && (
          <div className="alert alert-error">
            <AlertCircle size={16} />
            <span>{error}</span>

            <button
              type="button"
              className="btn btn-secondary"
              style={{
                marginLeft: "auto",
                minHeight: 30,
              }}
              onClick={loadDashboard}
            >
              <RefreshCw size={13} />
              Retry
            </button>
          </div>
        )}

        {success && (
          <div className="alert alert-success">
            <CheckCircle2 size={16} />
            <span>{success}</span>
          </div>
        )}

        <div className="filters-card">
          <div className="filters-header">
            <div className="filters-title">
              <Search size={15} />
              Dashboard Filters
            </div>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() =>
                setShowFilters(
                  (current) => !current
                )
              }
            >
              <ChevronDown
                size={14}
                style={{
                  transform: showFilters
                    ? "rotate(180deg)"
                    : "none",
                  transition: ".2s",
                }}
              />
              {showFilters
                ? "Hide"
                : "Show"}
            </button>
          </div>

          {showFilters && (
            <div className="filters-grid">
              <div className="field">
                <label>
                  Date From
                </label>

                <input
                  type="date"
                  className="input"
                  value={
                    filters.dateFrom
                  }
                  onChange={(event) =>
                    updateFilter(
                      "dateFrom",
                      event.target.value
                    )
                  }
                />
              </div>

              <div className="field">
                <label>
                  Date To
                </label>

                <input
                  type="date"
                  className="input"
                  value={
                    filters.dateTo
                  }
                  onChange={(event) =>
                    updateFilter(
                      "dateTo",
                      event.target.value
                    )
                  }
                />
              </div>

              <div className="field">
                <label>
                  Department
                </label>

                <div className="select-wrap">
                  <select
                    className="select"
                    value={
                      filters.department
                    }
                    onChange={(event) =>
                      updateFilter(
                        "department",
                        event.target.value
                      )
                    }
                  >
                    <option value="">
                      All Departments
                    </option>

                    {departments.map(
                      (department, index) => {
                        const value =
                          typeof department ===
                          "object"
                            ? firstValue(
                                department.id,
                                department.name,
                                department.label,
                                department.value
                              )
                            : department;

                        const label =
                          typeof department ===
                          "object"
                            ? firstValue(
                                department.name,
                                department.label,
                                department.value,
                                department.id
                              )
                            : department;

                        return (
                          <option
                            key={`${value}-${index}`}
                            value={value}
                          >
                            {label}
                          </option>
                        );
                      }
                    )}
                  </select>

                  <ChevronDown
                    className="select-arrow"
                    size={14}
                  />
                </div>
              </div>

              <div className="field">
                <label>
                  Category
                </label>

                <div className="select-wrap">
                  <select
                    className="select"
                    value={
                      filters.category
                    }
                    onChange={(event) =>
                      updateFilter(
                        "category",
                        event.target.value
                      )
                    }
                  >
                    <option value="">
                      All Categories
                    </option>

                    {categories.map(
                      (category, index) => {
                        const value =
                          typeof category ===
                          "object"
                            ? firstValue(
                                category.id,
                                category.name,
                                category.label,
                                category.value
                              )
                            : category;

                        const label =
                          typeof category ===
                          "object"
                            ? firstValue(
                                category.name,
                                category.label,
                                category.value,
                                category.id
                              )
                            : category;

                        return (
                          <option
                            key={`${value}-${index}`}
                            value={value}
                          >
                            {label}
                          </option>
                        );
                      }
                    )}
                  </select>

                  <ChevronDown
                    className="select-arrow"
                    size={14}
                  />
                </div>
              </div>

              <div className="field">
                <label>
                  Status
                </label>

                <div className="select-wrap">
                  <select
                    className="select"
                    value={
                      filters.status
                    }
                    onChange={(event) =>
                      updateFilter(
                        "status",
                        event.target.value
                      )
                    }
                  >
                    <option value="">
                      All Statuses
                    </option>

                    {STATUS_OPTIONS.map(
                      (item) => (
                        <option
                          key={item}
                          value={item}
                        >
                          {item}
                        </option>
                      )
                    )}
                  </select>

                  <ChevronDown
                    className="select-arrow"
                    size={14}
                  />
                </div>
              </div>

              <div className="field">
                <label>
                  Financial Year
                </label>

                <div className="select-wrap">
                  <select
                    className="select"
                    value={
                      filters.financialYear
                    }
                    onChange={(event) =>
                      updateFilter(
                        "financialYear",
                        event.target.value
                      )
                    }
                  >
                    <option value="">
                      All Years
                    </option>

                    {financialYears.map(
                      (year, index) => {
                        const value =
                          typeof year ===
                          "object"
                            ? firstValue(
                                year.id,
                                year.value,
                                year.year,
                                year.name
                              )
                            : year;

                        const label =
                          typeof year ===
                          "object"
                            ? firstValue(
                                year.label,
                                year.year,
                                year.name,
                                year.value
                              )
                            : year;

                        return (
                          <option
                            key={`${value}-${index}`}
                            value={value}
                          >
                            {label}
                          </option>
                        );
                      }
                    )}

                  </select>

                  <ChevronDown
                    className="select-arrow"
                    size={14}
                  />
                </div>
              </div>

              {(Object.values(
                filters
              ).some(Boolean)) && (
                <div className="filter-buttons">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={clearFilters}
                  >
                    <X size={13} />
                    Clear Filters
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="stats-grid">
          <StatCard
            icon={CircleDollarSign}
            title="Total Asset Cost"
            value={formatETB(
              stats.totalAssetCost
            )}
            subtitle="Original recorded cost"
            tone="blue"
          />

          <StatCard
            icon={TrendingUp}
            title="Current Book Value"
            value={formatETB(
              stats.currentBookValue
            )}
            subtitle="Current financial value"
            tone="green"
          />

          <StatCard
            icon={TrendingDown}
            title="Accumulated Depreciation"
            value={formatETB(
              stats.accumulatedDepreciation
            )}
            subtitle="Depreciation to date"
            tone="orange"
          />

          <StatCard
            icon={Package}
            title="Total Assets"
            value={formatNumber(
              stats.totalAssets
            )}
            subtitle="Financially tracked assets"
            tone="cyan"
          />
        </div>

        <div className="stats-grid secondary">
          <StatCard
            icon={CheckCircle2}
            title="Active Assets"
            value={formatNumber(
              stats.activeAssets
            )}
            subtitle="Currently active"
            tone="green"
          />

          <StatCard
            icon={Wrench}
            title="Under Maintenance"
            value={formatNumber(
              stats.underMaintenance
            )}
            subtitle="Currently under maintenance"
            tone="orange"
          />

          <StatCard
            icon={Trash2}
            title="Disposed"
            value={formatNumber(
              stats.disposed
            )}
            subtitle="Disposed assets"
            tone="red"
          />

          <StatCard
            icon={AlertCircle}
            title="Requiring Valuation"
            value={formatNumber(
              stats.requiringValuation
            )}
            subtitle="Needs financial valuation"
            tone="purple"
          />
        </div>

        <div className="chart-grid">
          <div className="chart-card">
            <div className="chart-header">
              <div>
                <div className="chart-title">
                  <Building2
                    size={16}
                    color="#2563eb"
                  />
                  Assets by Department
                </div>

                <div className="chart-subtitle">
                  Asset financial value by department
                </div>
              </div>
            </div>

            <div className="chart-body">
              <BarChart
                data={
                  dashboard.byDepartment
                }
              />
            </div>
          </div>

          <div className="chart-card">
            <div className="chart-header">
              <div>
                <div className="chart-title">
                  <PieChartIcon
                    size={16}
                    color="#0ea5e9"
                  />
                  Assets by Category
                </div>

                <div className="chart-subtitle">
                  Distribution of asset financial value
                </div>
              </div>
            </div>

            <div className="chart-body">
              <DonutChart
                data={
                  dashboard.byCategory
                }
              />
            </div>
          </div>

          <div className="chart-card">
            <div className="chart-header">
              <div>
                <div className="chart-title">
                  <Activity
                    size={16}
                    color="#16a34a"
                  />
                  Assets by Status
                </div>

                <div className="chart-subtitle">
                  Current financial asset status
                </div>
              </div>
            </div>

            <div className="chart-body">
              <StatusChart
                data={
                  dashboard.byStatus
                }
              />
            </div>
          </div>

          <div className="chart-card">
            <div className="chart-header">
              <div>
                <div className="chart-title">
                  <TrendingUp
                    size={16}
                    color="#2563eb"
                  />
                  Asset Value Trend
                </div>

                <div className="chart-subtitle">
                  Asset value over the selected period
                </div>
              </div>
            </div>

            <div className="chart-body">
              <TrendChart
                data={
                  dashboard.valueTrend
                }
              />
            </div>
          </div>
        </div>

        <div className="quick-links">
          <Link
            to="/finance/purchase-requests"
            className="quick-link"
          >
            <Package size={16} />
            Purchase Requests
          </Link>

          <Link
            to="/finance/invoices"
            className="quick-link"
          >
            <FileSpreadsheet size={16} />
            Invoices
          </Link>

          <Link
            to="/finance/valuation"
            className="quick-link"
          >
            <CircleDollarSign
              size={16}
            />
            Asset Valuation
          </Link>

          <Link
            to="/finance/depreciation"
            className="quick-link"
          >
            <TrendingDown size={16} />
            Depreciation
          </Link>

          <Link
            to="/finance/budget-management"
            className="quick-link"
          >
            <BarChart3 size={16} />
            Budget Management
          </Link>

          <Link
            to="/finance/transactions"
            className="quick-link"
          >
            <Activity size={16} />
            Transactions
          </Link>

          <Link
            to="/finance/financial-reports"
            className="quick-link"
          >
            <FileSpreadsheet
              size={16}
            />
            Financial Reports
          </Link>

          <Link
            to="/finance/audit"
            className="quick-link"
          >
            <CalendarDays size={16} />
            Audit Trail
          </Link>
        </div>
      </div>

      {(loading || filterLoading) && (
        <div className="loading-overlay">
          <div className="loading-box">
            <RefreshCw
              size={18}
              className="spin"
            />
            Loading Finance Dashboard...
          </div>
        </div>
      )}
    </div>
  );
}