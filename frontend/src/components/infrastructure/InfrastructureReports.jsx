import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import {
  AlertCircle,
  BarChart3,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Download,
  FileText,
  Gauge,
  Loader2,
  RefreshCw,
  Search,
  Settings,
  TriangleAlert,
  Wrench,
  X,
  Zap,
} from "lucide-react";

const REPORT_TYPES = [
  { value: "overview", label: "Infrastructure Overview" },
  { value: "assets", label: "Infrastructure Assets" },
  { value: "maintenance", label: "Maintenance Report" },
  { value: "work-orders", label: "Work Orders Report" },
  { value: "inspection", label: "Inspection & Condition" },
  { value: "energy", label: "Energy Management" },
  { value: "requests", label: "Infrastructure Requests" },
];

const STATUS_OPTIONS = [
  "",
  "Operational",
  "Active",
  "Available",
  "Assigned",
  "Maintenance",
  "In Maintenance",
  "Damaged",
  "Critical",
  "Missing",
  "Completed",
  "Pending",
];

function firstValue(...values) {
  return values.find(
    (value) =>
      value !== undefined &&
      value !== null &&
      value !== ""
  );
}

function extractArray(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.records)) return value.records;
  if (Array.isArray(value?.results)) return value.results;
  if (Array.isArray(value?.rows)) return value.rows;
  return [];
}

function extractPayload(response) {
  return response?.data?.data ?? response?.data ?? {};
}

function formatNumber(value) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return "0";
  }

  const number = Number(value);

  if (Number.isNaN(number)) {
    return String(value);
  }

  return new Intl.NumberFormat("en-US").format(number);
}

function formatMoney(value) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return "0.00";
  }

  const number = Number(value);

  if (Number.isNaN(number)) {
    return String(value);
  }

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(number);
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString();
}

function getLabel(item) {
  return (
    firstValue(
      item?.label,
      item?.name,
      item?.category,
      item?.type,
      item?.status
    ) || "Unknown"
  );
}

function getValue(item) {
  return Number(
    firstValue(
      item?.value,
      item?.count,
      item?.total,
      item?.quantity,
      0
    )
  );
}

function normalizeSummary(payload) {
  const summary =
    payload?.summary ||
    payload?.overview ||
    payload?.statistics ||
    {};

  return {
    totalAssets: Number(
      firstValue(
        summary.totalAssets,
        summary.total_assets,
        summary.infrastructureAssets,
        payload.totalAssets,
        payload.total_assets,
        0
      )
    ),

    operational: Number(
      firstValue(
        summary.operational,
        summary.operationalAssets,
        summary.operational_assets,
        payload.operational,
        0
      )
    ),

    maintenance: Number(
      firstValue(
        summary.maintenance,
        summary.inMaintenance,
        summary.in_maintenance,
        payload.maintenance,
        0
      )
    ),

    critical: Number(
      firstValue(
        summary.critical,
        summary.criticalAssets,
        summary.critical_assets,
        payload.critical,
        0
      )
    ),

    damaged: Number(
      firstValue(
        summary.damaged,
        summary.damagedAssets,
        summary.damaged_assets,
        payload.damaged,
        0
      )
    ),

    missing: Number(
      firstValue(
        summary.missing,
        summary.missingAssets,
        summary.missing_assets,
        payload.missing,
        0
      )
    ),

    buildings: Number(
      firstValue(
        summary.buildings,
        summary.totalBuildings,
        payload.buildings,
        0
      )
    ),

    electrical: Number(
      firstValue(
        summary.electrical,
        summary.electricalSystems,
        summary.electrical_systems,
        payload.electrical,
        0
      )
    ),

    generators: Number(
      firstValue(
        summary.generators,
        payload.generators,
        0
      )
    ),

    transformers: Number(
      firstValue(
        summary.transformers,
        payload.transformers,
        0
      )
    ),

    workOrders: Number(
      firstValue(
        summary.workOrders,
        summary.work_orders,
        payload.workOrders,
        0
      )
    ),

    openWorkOrders: Number(
      firstValue(
        summary.openWorkOrders,
        summary.open_work_orders,
        payload.openWorkOrders,
        0
      )
    ),

    completedWorkOrders: Number(
      firstValue(
        summary.completedWorkOrders,
        summary.completed_work_orders,
        payload.completedWorkOrders,
        0
      )
    ),

    pendingRequests: Number(
      firstValue(
        summary.pendingRequests,
        summary.pending_requests,
        payload.pendingRequests,
        0
      )
    ),

    totalRequests: Number(
      firstValue(
        summary.totalRequests,
        summary.total_requests,
        payload.totalRequests,
        0
      )
    ),

    totalMaintenance: Number(
      firstValue(
        summary.totalMaintenance,
        summary.total_maintenance,
        payload.totalMaintenance,
        0
      )
    ),

    completedMaintenance: Number(
      firstValue(
        summary.completedMaintenance,
        summary.completed_maintenance,
        payload.completedMaintenance,
        0
      )
    ),

    maintenanceCost: Number(
      firstValue(
        summary.maintenanceCost,
        summary.maintenance_cost,
        payload.maintenanceCost,
        0
      )
    ),

    energyConsumption: Number(
      firstValue(
        summary.energyConsumption,
        summary.energy_consumption,
        payload.energyConsumption,
        0
      )
    ),

    energyCost: Number(
      firstValue(
        summary.energyCost,
        summary.energy_cost,
        payload.energyCost,
        0
      )
    ),
  };
}

function statusClass(status) {
  const value = String(status || "").toLowerCase();

  if (
    value.includes("critical") ||
    value.includes("damaged") ||
    value.includes("missing") ||
    value.includes("failed")
  ) {
    return "danger";
  }

  if (
    value.includes("maintenance") ||
    value.includes("pending")
  ) {
    return "warning";
  }

  if (
    value.includes("completed") ||
    value.includes("operational") ||
    value.includes("active")
  ) {
    return "success";
  }

  return "info";
}

function MetricCard({
  label,
  value,
  icon: Icon,
  tone = "blue",
  description,
}) {
  return (
    <div className={`metric-card ${tone}`}>
      <div>
        <div className="metric-label">{label}</div>
        <div className="metric-value">{value}</div>

        {description && (
          <div className="metric-description">
            {description}
          </div>
        )}
      </div>

      <div className="metric-icon">
        <Icon size={21} />
      </div>
    </div>
  );
}

export default function InfrastructureReports() {
  const [reportType, setReportType] = useState("overview");

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [status, setStatus] = useState("");
  const [location, setLocation] = useState("");
  const [search, setSearch] = useState("");

  const [payload, setPayload] = useState({});
  const [rows, setRows] = useState([]);

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showReportInfo, setShowReportInfo] = useState(false);

  const fetchReport = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get(
        "/infrastructure/reports",
        {
          params: {
            reportType,
            type: reportType,

            dateFrom:
              dateFrom || undefined,

            dateTo:
              dateTo || undefined,

            status:
              status || undefined,

            location:
              location.trim() || undefined,

            search:
              search.trim() || undefined,
          },
        }
      );

      const responsePayload =
        extractPayload(response);

      setPayload(responsePayload);

      const reportRows =
        extractArray(
          responsePayload?.rows ??
            responsePayload?.items ??
            responsePayload?.records ??
            responsePayload?.results ??
            responsePayload?.data
        );

      setRows(reportRows);
    } catch (err) {
      console.error(
        "Failed to load infrastructure report:",
        err
      );

      setError(
        err?.response?.data?.message ||
          "Unable to load the infrastructure report."
      );

      setPayload({});
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [
    reportType,
    dateFrom,
    dateTo,
    status,
    location,
    search,
  ]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  useEffect(() => {
    if (!success) return;

    const timer = setTimeout(
      () => setSuccess(""),
      3500
    );

    return () => clearTimeout(timer);
  }, [success]);

  const summary = useMemo(
    () => normalizeSummary(payload),
    [payload]
  );

  const categoryData = useMemo(() => {
    return extractArray(
      payload?.byCategory ??
        payload?.by_category ??
        payload?.categories ??
        payload?.categoryBreakdown
    );
  }, [payload]);

  const statusData = useMemo(() => {
    return extractArray(
      payload?.byStatus ??
        payload?.by_status ??
        payload?.statusBreakdown ??
        payload?.statuses
    );
  }, [payload]);

  const locationData = useMemo(() => {
    return extractArray(
      payload?.byLocation ??
        payload?.by_location ??
        payload?.locationBreakdown ??
        payload?.locations
    );
  }, [payload]);

  const monthlyData = useMemo(() => {
    return extractArray(
      payload?.monthly ??
        payload?.monthlyData ??
        payload?.monthly_data ??
        payload?.trend ??
        payload?.trends
    );
  }, [payload]);

  const clearFilters = () => {
    setDateFrom("");
    setDateTo("");
    setStatus("");
    setLocation("");
    setSearch("");
  };

  const handleExport = async (format = "csv") => {
    try {
      setExporting(true);
      setError("");

      const response = await api.get(
        "/infrastructure/reports/export",
        {
          params: {
            reportType,
            type: reportType,
            format,
            dateFrom:
              dateFrom || undefined,
            dateTo:
              dateTo || undefined,
            status:
              status || undefined,
            location:
              location.trim() || undefined,
            search:
              search.trim() || undefined,
          },
          responseType: "blob",
        }
      );

      const blob =
        response.data instanceof Blob
          ? response.data
          : new Blob([response.data]);

      const url =
        window.URL.createObjectURL(blob);

      const link =
        document.createElement("a");

      link.href = url;

      link.download =
        `infrastructure-${reportType}-${new Date()
          .toISOString()
          .slice(0, 10)}.${format}`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(url);

      setSuccess(
        "Report exported successfully."
      );
    } catch (err) {
      console.error(
        "Failed to export report:",
        err
      );

      setError(
        err?.response?.data?.message ||
          "Unable to export the report."
      );
    } finally {
      setExporting(false);
    }
  };

  const hasFilters =
    dateFrom ||
    dateTo ||
    status ||
    location ||
    search;

  return (
    <div className="reports-page">
      <style>{`
        * {
          box-sizing: border-box;
        }

        .reports-page {
          min-height: 100vh;
          padding: 24px;
          background: #f8fafc;
          color: #0f172a;
          font-family: Inter, ui-sans-serif, system-ui,
            -apple-system, BlinkMacSystemFont, "Segoe UI",
            sans-serif;
        }

        .reports-container {
          max-width: 1600px;
          margin: 0 auto;
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 20px;
          margin-bottom: 22px;
        }

        .header-left {
          display: flex;
          gap: 14px;
        }

        .header-icon {
          width: 51px;
          height: 51px;
          border-radius: 14px;
          background: linear-gradient(
            135deg,
            #0ea5e9,
            #2563eb
          );
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          box-shadow:
            0 10px 25px
            rgba(37,99,235,.18);
        }

        .page-header h1 {
          margin: 0 0 5px;
          font-size: 27px;
          font-weight: 800;
          letter-spacing: -.025em;
        }

        .page-header p {
          margin: 0;
          color: #64748b;
          font-size: 14px;
        }

        .header-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .btn {
          min-height: 41px;
          padding: 0 13px;
          border: 1px solid transparent;
          border-radius: 10px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          font-size: 12px;
          font-weight: 750;
          cursor: pointer;
          text-decoration: none;
          transition: .2s ease;
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
          background: #0ea5e9;
          color: white;
          box-shadow:
            0 7px 18px
            rgba(14,165,233,.18);
        }

        .btn-primary:hover {
          background: #0284c7;
        }

        .btn-secondary {
          background: white;
          color: #334155;
          border-color: #e2e8f0;
        }

        .btn-secondary:hover {
          background: #f8fafc;
        }

        .btn-success {
          background: #16a34a;
          color: white;
        }

        .alert {
          padding: 12px 14px;
          border-radius: 11px;
          margin-bottom: 15px;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
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

        .filter-card {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 15px;
          padding: 16px;
          margin-bottom: 18px;
          box-shadow:
            0 4px 18px
            rgba(15,23,42,.035);
        }

        .filter-title {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
          color: #334155;
          font-size: 13px;
          font-weight: 800;
        }

        .filter-grid {
          display: grid;
          grid-template-columns:
            1.5fr repeat(4, minmax(130px, 1fr))
            auto;
          gap: 9px;
        }

        .input-wrap {
          position: relative;
        }

        .input-wrap svg {
          position: absolute;
          left: 11px;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
        }

        .filter-input,
        .filter-select {
          width: 100%;
          height: 41px;
          padding: 0 10px;
          border: 1px solid #e2e8f0;
          border-radius: 9px;
          outline: none;
          background: white;
          color: #334155;
          font-size: 12px;
        }

        .input-wrap .filter-input {
          padding-left: 37px;
        }

        .filter-input:focus,
        .filter-select:focus {
          border-color: #0ea5e9;
          box-shadow:
            0 0 0 3px
            rgba(14,165,233,.1);
        }

        .metric-grid {
          display: grid;
          grid-template-columns:
            repeat(6, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 18px;
        }

        .metric-card {
          min-height: 125px;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 15px;
          padding: 16px;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
          box-shadow:
            0 4px 18px
            rgba(15,23,42,.035);
        }

        .metric-label {
          color: #64748b;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: .035em;
          margin-bottom: 8px;
        }

        .metric-value {
          font-size: 25px;
          font-weight: 850;
          line-height: 1;
        }

        .metric-description {
          margin-top: 8px;
          color: #94a3b8;
          font-size: 10px;
        }

        .metric-icon {
          width: 39px;
          height: 39px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .metric-card.blue .metric-icon {
          background: #eff6ff;
          color: #2563eb;
        }

        .metric-card.green .metric-icon {
          background: #f0fdf4;
          color: #16a34a;
        }

        .metric-card.orange .metric-icon {
          background: #fff7ed;
          color: #ea580c;
        }

        .metric-card.red .metric-icon {
          background: #fef2f2;
          color: #dc2626;
        }

        .metric-card.yellow .metric-icon {
          background: #fffbeb;
          color: #d97706;
        }

        .metric-card.cyan .metric-icon {
          background: #ecfeff;
          color: #0891b2;
        }

        .dashboard-grid {
          display: grid;
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
          gap: 18px;
          margin-bottom: 18px;
        }

        .panel {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 15px;
          overflow: hidden;
          box-shadow:
            0 4px 18px
            rgba(15,23,42,.035);
        }

        .panel-header {
          min-height: 58px;
          padding: 13px 17px;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }

        .panel-title {
          font-size: 14px;
          font-weight: 800;
        }

        .panel-subtitle {
          color: #64748b;
          font-size: 11px;
          margin-top: 3px;
        }

        .panel-body {
          padding: 17px;
        }

        .breakdown-list {
          display: flex;
          flex-direction: column;
          gap: 13px;
        }

        .breakdown-item {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .breakdown-label {
          width: 130px;
          color: #475569;
          font-size: 11px;
          font-weight: 650;
        }

        .breakdown-bar {
          flex: 1;
          height: 8px;
          border-radius: 999px;
          background: #e2e8f0;
          overflow: hidden;
        }

        .breakdown-fill {
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(
            90deg,
            #0ea5e9,
            #2563eb
          );
        }

        .breakdown-value {
          width: 60px;
          text-align: right;
          color: #0f172a;
          font-size: 11px;
          font-weight: 800;
        }

        .status-list {
          display: grid;
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .status-box {
          padding: 13px;
          border: 1px solid #e2e8f0;
          border-radius: 11px;
          background: #f8fafc;
        }

        .status-box-label {
          color: #64748b;
          font-size: 10px;
          font-weight: 750;
        }

        .status-box-value {
          margin-top: 5px;
          font-size: 20px;
          font-weight: 800;
        }

        .quick-grid {
          display: grid;
          grid-template-columns:
            repeat(4, minmax(0, 1fr));
          gap: 10px;
        }

        .quick-card {
          min-height: 94px;
          padding: 13px;
          border: 1px solid #e2e8f0;
          border-radius: 11px;
          text-decoration: none;
          color: #0f172a;
          transition: .2s ease;
        }

        .quick-card:hover {
          border-color: #bae6fd;
          background: #f0f9ff;
          transform: translateY(-1px);
        }

        .quick-card-icon {
          width: 32px;
          height: 32px;
          border-radius: 9px;
          background: #eff6ff;
          color: #2563eb;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 8px;
        }

        .quick-card-title {
          font-size: 11px;
          font-weight: 800;
        }

        .quick-card-text {
          margin-top: 3px;
          color: #64748b;
          font-size: 9px;
        }

        .table-panel {
          margin-bottom: 18px;
        }

        .table-wrapper {
          overflow-x: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          min-width: 850px;
        }

        th {
          padding: 12px 14px;
          text-align: left;
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
          color: #64748b;
          font-size: 9px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: .04em;
        }

        td {
          padding: 12px 14px;
          border-bottom: 1px solid #f1f5f9;
          color: #334155;
          font-size: 12px;
        }

        tbody tr:hover {
          background: #f8fbff;
        }

        .badge {
          display: inline-flex;
          align-items: center;
          min-height: 24px;
          padding: 0 8px;
          border-radius: 999px;
          font-size: 9px;
          font-weight: 800;
        }

        .badge.success {
          color: #166534;
          background: #dcfce7;
        }

        .badge.warning {
          color: #92400e;
          background: #fef3c7;
        }

        .badge.danger {
          color: #991b1b;
          background: #fee2e2;
        }

        .badge.info {
          color: #1d4ed8;
          background: #dbeafe;
        }

        .badge.default {
          color: #475569;
          background: #f1f5f9;
        }

        .empty-state {
          padding: 45px 20px;
          text-align: center;
          color: #64748b;
        }

        .empty-icon {
          width: 48px;
          height: 48px;
          margin: 0 auto 11px;
          border-radius: 13px;
          background: #f1f5f9;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .loading-state {
          padding: 55px 20px;
          text-align: center;
          color: #64748b;
        }

        .spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 1000;
          padding: 20px;
          background: rgba(15,23,42,.58);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .modal {
          width: min(620px, 100%);
          max-height: 90vh;
          overflow-y: auto;
          background: white;
          border-radius: 17px;
          box-shadow:
            0 25px 80px
            rgba(15,23,42,.25);
        }

        .modal-header {
          padding: 17px 19px;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .modal-header h2 {
          margin: 0;
          font-size: 17px;
          font-weight: 800;
        }

        .modal-header p {
          margin: 4px 0 0;
          color: #64748b;
          font-size: 11px;
        }

        .modal-body {
          padding: 19px;
        }

        .close-btn {
          width: 34px;
          height: 34px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          background: white;
          color: #64748b;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .info-grid {
          display: grid;
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .info-item {
          padding: 12px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
        }

        .info-label {
          color: #64748b;
          font-size: 9px;
          font-weight: 800;
        }

        .info-value {
          margin-top: 5px;
          color: #0f172a;
          font-size: 12px;
          font-weight: 700;
        }

        @media (max-width: 1350px) {
          .metric-grid {
            grid-template-columns:
              repeat(3, minmax(0, 1fr));
          }

          .filter-grid {
            grid-template-columns:
              repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 900px) {
          .reports-page {
            padding: 14px;
          }

          .page-header {
            flex-direction: column;
          }

          .dashboard-grid {
            grid-template-columns: 1fr;
          }

          .quick-grid {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 650px) {
          .metric-grid {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }

          .filter-grid {
            grid-template-columns: 1fr;
          }

          .status-list,
          .info-grid {
            grid-template-columns: 1fr;
          }

          .quick-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="reports-container">
        <div className="page-header">
          <div className="header-left">
            <div className="header-icon">
              <BarChart3 size={25} />
            </div>

            <div>
              <h1>Reports & Analytics</h1>

              <p>
                Monitor infrastructure performance,
                assets, maintenance, work orders,
                inspections, energy, and requests.
              </p>
            </div>
          </div>

          <div className="header-actions">
            <Link
              to="/infrastructure"
              className="btn btn-secondary"
            >
              <Gauge size={15} />
              Dashboard
            </Link>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={fetchReport}
              disabled={loading}
            >
              <RefreshCw
                size={15}
                className={
                  loading ? "spin" : ""
                }
              />
              Refresh
            </button>

            <button
              type="button"
              className="btn btn-primary"
              onClick={() =>
                handleExport("csv")
              }
              disabled={exporting}
            >
              {exporting ? (
                <Loader2
                  size={15}
                  className="spin"
                />
              ) : (
                <Download size={15} />
              )}
              Export CSV
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() =>
                setShowReportInfo(true)
              }
            >
              <FileText size={15} />
              Report Info
            </button>
          </div>
        </div>

        {error && (
          <div className="alert alert-error">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {success && (
          <div className="alert alert-success">
            <CheckCircle2 size={16} />
            {success}
          </div>
        )}

        <div className="filter-card">
          <div className="filter-title">
            <Settings size={15} />
            Report Filters
          </div>

          <div className="filter-grid">
            <select
              className="filter-select"
              value={reportType}
              onChange={(event) =>
                setReportType(
                  event.target.value
                )
              }
            >
              {REPORT_TYPES.map(
                (report) => (
                  <option
                    key={report.value}
                    value={report.value}
                  >
                    {report.label}
                  </option>
                )
              )}
            </select>

            <div className="input-wrap">
              <CalendarDays
                size={15}
              />

              <input
                type="date"
                className="filter-input"
                value={dateFrom}
                onChange={(event) =>
                  setDateFrom(
                    event.target.value
                  )
                }
              />
            </div>

            <div className="input-wrap">
              <CalendarDays
                size={15}
              />

              <input
                type="date"
                className="filter-input"
                value={dateTo}
                onChange={(event) =>
                  setDateTo(
                    event.target.value
                  )
                }
              />
            </div>

            <select
              className="filter-select"
              value={status}
              onChange={(event) =>
                setStatus(
                  event.target.value
                )
              }
            >
              <option value="">
                All Statuses
              </option>

              {STATUS_OPTIONS.filter(
                Boolean
              ).map((item) => (
                <option
                  key={item}
                  value={item}
                >
                  {item}
                </option>
              ))}
            </select>

            <input
              className="filter-input"
              value={location}
              onChange={(event) =>
                setLocation(
                  event.target.value
                )
              }
              placeholder="Location"
            />

            <div className="input-wrap">
              <Search size={15} />

              <input
                className="filter-input"
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Search..."
              />
            </div>

            {hasFilters && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={clearFilters}
              >
                <X size={14} />
                Clear
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="panel">
            <div className="loading-state">
              <Loader2
                size={31}
                className="spin"
              />

              <div>
                Loading infrastructure
                analytics...
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="metric-grid">
              <MetricCard
                label="Total Assets"
                value={formatNumber(
                  summary.totalAssets
                )}
                icon={ClipboardList}
                tone="blue"
                description="Infrastructure assets"
              />

              <MetricCard
                label="Operational"
                value={formatNumber(
                  summary.operational
                )}
                icon={CheckCircle2}
                tone="green"
                description="Currently operational"
              />

              <MetricCard
                label="Maintenance"
                value={formatNumber(
                  summary.maintenance
                )}
                icon={Wrench}
                tone="orange"
                description="Under maintenance"
              />

              <MetricCard
                label="Critical"
                value={formatNumber(
                  summary.critical
                )}
                icon={TriangleAlert}
                tone="red"
                description="Requires attention"
              />

              <MetricCard
                label="Work Orders"
                value={formatNumber(
                  summary.workOrders
                )}
                icon={Settings}
                tone="yellow"
                description="Registered work orders"
              />

              <MetricCard
                label="Requests"
                value={formatNumber(
                  summary.totalRequests
                )}
                icon={ClipboardList}
                tone="cyan"
                description="Infrastructure requests"
              />
            </div>

            <div className="dashboard-grid">
              <div className="panel">
                <div className="panel-header">
                  <div>
                    <div className="panel-title">
                      Infrastructure Status
                    </div>

                    <div className="panel-subtitle">
                      Current asset condition
                      and operational status.
                    </div>
                  </div>

                  <TriangleAlert
                    size={18}
                    color="#64748b"
                  />
                </div>

                <div className="panel-body">
                  <div className="status-list">
                    <div className="status-box">
                      <div className="status-box-label">
                        OPERATIONAL
                      </div>

                      <div className="status-box-value">
                        {formatNumber(
                          summary.operational
                        )}
                      </div>
                    </div>

                    <div className="status-box">
                      <div className="status-box-label">
                        MAINTENANCE
                      </div>

                      <div className="status-box-value">
                        {formatNumber(
                          summary.maintenance
                        )}
                      </div>
                    </div>

                    <div className="status-box">
                      <div className="status-box-label">
                        DAMAGED
                      </div>

                      <div className="status-box-value">
                        {formatNumber(
                          summary.damaged
                        )}
                      </div>
                    </div>

                    <div className="status-box">
                      <div className="status-box-label">
                        MISSING
                      </div>

                      <div className="status-box-value">
                        {formatNumber(
                          summary.missing
                        )}
                      </div>
                    </div>

                    <div className="status-box">
                      <div className="status-box-label">
                        CRITICAL
                      </div>

                      <div className="status-box-value">
                        {formatNumber(
                          summary.critical
                        )}
                      </div>
                    </div>

                    <div className="status-box">
                      <div className="status-box-label">
                        BUILDINGS
                      </div>

                      <div className="status-box-value">
                        {formatNumber(
                          summary.buildings
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="panel">
                <div className="panel-header">
                  <div>
                    <div className="panel-title">
                      Infrastructure Systems
                    </div>

                    <div className="panel-subtitle">
                      Major infrastructure
                      systems under management.
                    </div>
                  </div>

                  <Zap
                    size={18}
                    color="#64748b"
                  />
                </div>

                <div className="panel-body">
                  <div className="status-list">
                    <div className="status-box">
                      <div className="status-box-label">
                        ELECTRICAL SYSTEMS
                      </div>

                      <div className="status-box-value">
                        {formatNumber(
                          summary.electrical
                        )}
                      </div>
                    </div>

                    <div className="status-box">
                      <div className="status-box-label">
                        GENERATORS
                      </div>

                      <div className="status-box-value">
                        {formatNumber(
                          summary.generators
                        )}
                      </div>
                    </div>

                    <div className="status-box">
                      <div className="status-box-label">
                        TRANSFORMERS
                      </div>

                      <div className="status-box-value">
                        {formatNumber(
                          summary.transformers
                        )}
                      </div>
                    </div>

                    <div className="status-box">
                      <div className="status-box-label">
                        OPEN WORK ORDERS
                      </div>

                      <div className="status-box-value">
                        {formatNumber(
                          summary.openWorkOrders
                        )}
                      </div>
                    </div>

                    <div className="status-box">
                      <div className="status-box-label">
                        COMPLETED WORK ORDERS
                      </div>

                      <div className="status-box-value">
                        {formatNumber(
                          summary.completedWorkOrders
                        )}
                      </div>
                    </div>

                    <div className="status-box">
                      <div className="status-box-label">
                        PENDING REQUESTS
                      </div>

                      <div className="status-box-value">
                        {formatNumber(
                          summary.pendingRequests
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {(categoryData.length > 0 ||
              statusData.length > 0) && (
              <div className="dashboard-grid">
                {categoryData.length >
                  0 && (
                  <div className="panel">
                    <div className="panel-header">
                      <div>
                        <div className="panel-title">
                          Assets by Category
                        </div>

                        <div className="panel-subtitle">
                          Distribution returned
                          by the backend.
                        </div>
                      </div>

                      <Building2
                        size={18}
                        color="#64748b"
                      />
                    </div>

                    <div className="panel-body">
                      <div className="breakdown-list">
                        {categoryData.map(
                          (item, index) => {
                            const value =
                              getValue(
                                item
                              );

                            const max =
                              Math.max(
                                ...categoryData.map(
                                  getValue
                                ),
                                1
                              );

                            return (
                              <div
                                className="breakdown-item"
                                key={`${getLabel(
                                  item
                                )}-${index}`}
                              >
                                <div className="breakdown-label">
                                  {getLabel(
                                    item
                                  )}
                                </div>

                                <div className="breakdown-bar">
                                  <div
                                    className="breakdown-fill"
                                    style={{
                                      width: `${Math.min(
                                        100,
                                        (value /
                                          max) *
                                          100
                                      )}%`,
                                    }}
                                  />
                                </div>

                                <div className="breakdown-value">
                                  {formatNumber(
                                    value
                                  )}
                                </div>
                              </div>
                            );
                          }
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {statusData.length >
                  0 && (
                  <div className="panel">
                    <div className="panel-header">
                      <div>
                        <div className="panel-title">
                          Status Distribution
                        </div>

                        <div className="panel-subtitle">
                          Asset status
                          distribution from the
                          backend.
                        </div>
                      </div>

                      <CheckCircle2
                        size={18}
                        color="#64748b"
                      />
                    </div>

                    <div className="panel-body">
                      <div className="breakdown-list">
                        {statusData.map(
                          (item, index) => {
                            const value =
                              getValue(
                                item
                              );

                            const max =
                              Math.max(
                                ...statusData.map(
                                  getValue
                                ),
                                1
                              );

                            return (
                              <div
                                className="breakdown-item"
                                key={`${getLabel(
                                  item
                                )}-${index}`}
                              >
                                <div className="breakdown-label">
                                  {getLabel(
                                    item
                                  )}
                                </div>

                                <div className="breakdown-bar">
                                  <div
                                    className="breakdown-fill"
                                    style={{
                                      width: `${Math.min(
                                        100,
                                        (value /
                                          max) *
                                          100
                                      )}%`,
                                    }}
                                  />
                                </div>

                                <div className="breakdown-value">
                                  {formatNumber(
                                    value
                                  )}
                                </div>
                              </div>
                            );
                          }
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {monthlyData.length > 0 && (
              <div className="panel table-panel">
                <div className="panel-header">
                  <div>
                    <div className="panel-title">
                      Monthly Infrastructure Trend
                    </div>

                    <div className="panel-subtitle">
                      Monthly data supplied by
                      the reporting API.
                    </div>
                  </div>

                  <BarChart3
                    size={18}
                    color="#64748b"
                  />
                </div>

                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Period</th>
                        <th>Assets</th>
                        <th>Maintenance</th>
                        <th>Work Orders</th>
                        <th>Requests</th>
                        <th>Cost</th>
                      </tr>
                    </thead>

                    <tbody>
                      {monthlyData.map(
                        (item, index) => (
                          <tr
                            key={index}
                          >
                            <td>
                              {firstValue(
                                item.month,
                                item.period,
                                item.label,
                                "—"
                              )}
                            </td>

                            <td>
                              {formatNumber(
                                firstValue(
                                  item.assets,
                                  item.assetCount,
                                  item.asset_count,
                                  0
                                )
                              )}
                            </td>

                            <td>
                              {formatNumber(
                                firstValue(
                                  item.maintenance,
                                  item.maintenanceCount,
                                  0
                                )
                              )}
                            </td>

                            <td>
                              {formatNumber(
                                firstValue(
                                  item.workOrders,
                                  item.work_orders,
                                  0
                                )
                              )}
                            </td>

                            <td>
                              {formatNumber(
                                firstValue(
                                  item.requests,
                                  0
                                )
                              )}
                            </td>

                            <td>
                              {formatMoney(
                                firstValue(
                                  item.cost,
                                  item.totalCost,
                                  item.total_cost,
                                  0
                                )
                              )}
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {locationData.length > 0 && (
              <div className="panel table-panel">
                <div className="panel-header">
                  <div>
                    <div className="panel-title">
                      Assets by Location
                    </div>

                    <div className="panel-subtitle">
                      Infrastructure distribution
                      by location.
                    </div>
                  </div>
                </div>

                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Location</th>
                        <th>Total Assets</th>
                        <th>Operational</th>
                        <th>Maintenance</th>
                        <th>Critical</th>
                      </tr>
                    </thead>

                    <tbody>
                      {locationData.map(
                        (item, index) => (
                          <tr
                            key={index}
                          >
                            <td>
                              {getLabel(
                                item
                              )}
                            </td>

                            <td>
                              {formatNumber(
                                firstValue(
                                  item.total,
                                  item.count,
                                  item.value,
                                  0
                                )
                              )}
                            </td>

                            <td>
                              {formatNumber(
                                firstValue(
                                  item.operational,
                                  item.operationalAssets,
                                  0
                                )
                              )}
                            </td>

                            <td>
                              {formatNumber(
                                firstValue(
                                  item.maintenance,
                                  item.inMaintenance,
                                  0
                                )
                              )}
                            </td>

                            <td>
                              <span
                                className={`badge ${statusClass(
                                  "critical"
                                )}`}
                              >
                                {formatNumber(
                                  firstValue(
                                    item.critical,
                                    0
                                  )
                                )}
                              </span>
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {rows.length > 0 && (
              <div className="panel table-panel">
                <div className="panel-header">
                  <div>
                    <div className="panel-title">
                      Report Records
                    </div>

                    <div className="panel-subtitle">
                      Detailed records returned
                      for the selected report.
                    </div>
                  </div>
                </div>

                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Record</th>
                        <th>Category / Type</th>
                        <th>Location</th>
                        <th>Status</th>
                        <th>Date</th>
                        <th>Cost</th>
                      </tr>
                    </thead>

                    <tbody>
                      {rows.map(
                        (row, index) => {
                          const name =
                            firstValue(
                              row.name,
                              row.title,
                              row.assetName,
                              row.asset_name,
                              row.requestNumber,
                              row.request_number,
                              row.code,
                              row.id,
                              `Record ${index + 1}`
                            );

                          const type =
                            firstValue(
                              row.category,
                              row.type,
                              row.requestType,
                              row.request_type,
                              row.maintenanceType,
                              row.maintenance_type,
                              "—"
                            );

                          const rowStatus =
                            firstValue(
                              row.status,
                              row.condition,
                              "—"
                            );

                          const rowDate =
                            firstValue(
                              row.date,
                              row.requestDate,
                              row.request_date,
                              row.createdAt,
                              row.created_at,
                              row.updatedAt,
                              row.updated_at
                            );

                          const rowCost =
                            firstValue(
                              row.cost,
                              row.estimatedCost,
                              row.estimated_cost,
                              row.actualCost,
                              row.actual_cost,
                              row.totalCost,
                              row.total_cost,
                              ""
                            );

                          return (
                            <tr
                              key={
                                row.id ??
                                row._id ??
                                index
                              }
                            >
                              <td>
                                <strong>
                                  {name}
                                </strong>
                              </td>

                              <td>
                                {type}
                              </td>

                              <td>
                                {firstValue(
                                  row.location,
                                  row.locationName,
                                  row.location_name,
                                  "—"
                                )}
                              </td>

                              <td>
                                <span
                                  className={`badge ${statusClass(
                                    rowStatus
                                  )}`}
                                >
                                  {
                                    rowStatus
                                  }
                                </span>
                              </td>

                              <td>
                                {formatDate(
                                  rowDate
                                )}
                              </td>

                              <td>
                                {rowCost ===
                                ""
                                  ? "—"
                                  : formatMoney(
                                      rowCost
                                    )}
                              </td>
                            </tr>
                          );
                        }
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {categoryData.length === 0 &&
              statusData.length === 0 &&
              locationData.length === 0 &&
              monthlyData.length === 0 &&
              rows.length === 0 &&
              Object.keys(payload).length ===
                0 && (
                <div className="panel">
                  <div className="empty-state">
                    <div className="empty-icon">
                      <BarChart3
                        size={22}
                      />
                    </div>

                    <strong>
                      No report data returned
                    </strong>

                    <div
                      style={{
                        marginTop: 5,
                        fontSize: 11,
                      }}
                    >
                      Adjust the filters or
                      verify the infrastructure
                      reporting API.
                    </div>
                  </div>
                </div>
              )}

            <div className="panel">
              <div className="panel-header">
                <div>
                  <div className="panel-title">
                    Infrastructure Reporting
                    Shortcuts
                  </div>

                  <div className="panel-subtitle">
                    Open the operational module
                    associated with each report.
                  </div>
                </div>
              </div>

              <div className="panel-body">
                <div className="quick-grid">
                  <Link
                    to="/infrastructure/assets"
                    className="quick-card"
                  >
                    <div className="quick-card-icon">
                      <ClipboardList
                        size={16}
                      />
                    </div>

                    <div className="quick-card-title">
                      Infrastructure Assets
                    </div>

                    <div className="quick-card-text">
                      Asset registry and inventory.
                    </div>
                  </Link>

                  <Link
                    to="/infrastructure/maintenance"
                    className="quick-card"
                  >
                    <div className="quick-card-icon">
                      <Wrench size={16} />
                    </div>

                    <div className="quick-card-title">
                      Maintenance
                    </div>

                    <div className="quick-card-text">
                      Maintenance performance.
                    </div>
                  </Link>

                  <Link
                    to="/infrastructure/work-orders"
                    className="quick-card"
                  >
                    <div className="quick-card-icon">
                      <Settings
                        size={16}
                      />
                    </div>

                    <div className="quick-card-title">
                      Work Orders
                    </div>

                    <div className="quick-card-text">
                      Work order activity.
                    </div>
                  </Link>

                  <Link
                    to="/infrastructure/inspection"
                    className="quick-card"
                  >
                    <div className="quick-card-icon">
                      <TriangleAlert
                        size={16}
                      />
                    </div>

                    <div className="quick-card-title">
                      Inspections
                    </div>

                    <div className="quick-card-text">
                      Condition and inspection
                      results.
                    </div>
                  </Link>

                  <Link
                    to="/infrastructure/energy"
                    className="quick-card"
                  >
                    <div className="quick-card-icon">
                      <Zap size={16} />
                    </div>

                    <div className="quick-card-title">
                      Energy
                    </div>

                    <div className="quick-card-text">
                      Energy consumption and
                      cost.
                    </div>
                  </Link>

                  <Link
                    to="/infrastructure/requests"
                    className="quick-card"
                  >
                    <div className="quick-card-icon">
                      <FileText
                        size={16}
                      />
                    </div>

                    <div className="quick-card-title">
                      Requests
                    </div>

                    <div className="quick-card-text">
                      Infrastructure request
                      activity.
                    </div>
                  </Link>

                  <Link
                    to="/infrastructure/electrical"
                    className="quick-card"
                  >
                    <div className="quick-card-icon">
                      <Zap size={16} />
                    </div>

                    <div className="quick-card-title">
                      Electrical
                    </div>

                    <div className="quick-card-text">
                      Electrical system
                      reporting.
                    </div>
                  </Link>

                  <Link
                    to="/infrastructure/tracking"
                    className="quick-card"
                  >
                    <div className="quick-card-icon">
                      <Search size={16} />
                    </div>

                    <div className="quick-card-title">
                      RFID / QR
                    </div>

                    <div className="quick-card-text">
                      Asset tracking activity.
                    </div>
                  </Link>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {showReportInfo && (
        <div
          className="modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setShowReportInfo(false);
            }
          }}
        >
          <div className="modal">
            <div className="modal-header">
              <div>
                <h2>
                  Report Information
                </h2>

                <p>
                  Current report configuration.
                </p>
              </div>

              <button
                type="button"
                className="close-btn"
                onClick={() =>
                  setShowReportInfo(false)
                }
              >
                <X size={17} />
              </button>
            </div>

            <div className="modal-body">
              <div className="info-grid">
                <div className="info-item">
                  <div className="info-label">
                    REPORT
                  </div>

                  <div className="info-value">
                    {
                      REPORT_TYPES.find(
                        (item) =>
                          item.value ===
                          reportType
                      )?.label
                    }
                  </div>
                </div>

                <div className="info-item">
                  <div className="info-label">
                    STATUS FILTER
                  </div>

                  <div className="info-value">
                    {status || "All"}
                  </div>
                </div>

                <div className="info-item">
                  <div className="info-label">
                    DATE FROM
                  </div>

                  <div className="info-value">
                    {dateFrom || "All"}
                  </div>
                </div>

                <div className="info-item">
                  <div className="info-label">
                    DATE TO
                  </div>

                  <div className="info-value">
                    {dateTo || "All"}
                  </div>
                </div>

                <div className="info-item">
                  <div className="info-label">
                    LOCATION
                  </div>

                  <div className="info-value">
                    {location || "All"}
                  </div>
                </div>

                <div className="info-item">
                  <div className="info-label">
                    SEARCH
                  </div>

                  <div className="info-value">
                    {search || "None"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}