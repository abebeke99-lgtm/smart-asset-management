import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Edit3,
  Eye,
  Filter,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserRound,
  Wrench,
  X,
} from "lucide-react";

const PAGE_SIZE = 10;

const EMPTY_FORM = {
  planNumber: "",
  title: "",
  maintenanceType: "Preventive",
  category: "",
  assetId: "",
  assetName: "",
  location: "",
  frequency: "monthly",
  intervalValue: "1",
  intervalUnit: "month",
  assignedTo: "",
  contractor: "",
  priority: "medium",
  status: "pending",
  lastMaintenanceDate: "",
  nextMaintenanceDate: "",
  startDate: "",
  endDate: "",
  estimatedCost: "",
  actualCost: "",
  description: "",
  checklist: "",
  remarks: "",
};

const valueOf = (row, keys, fallback = "") => {
  for (const key of keys) {
    if (
      row?.[key] !== undefined &&
      row?.[key] !== null &&
      row?.[key] !== ""
    ) {
      return row[key];
    }
  }
  return fallback;
};

const idOf = (row) =>
  valueOf(row, [
    "id",
    "planId",
    "plan_id",
    "preventiveMaintenanceId",
    "preventive_maintenance_id",
  ]);

const planNumberOf = (row) =>
  valueOf(
    row,
    ["planNumber", "plan_number", "maintenancePlanNumber", "reference"],
    "—"
  );

const titleOf = (row) =>
  valueOf(
    row,
    ["title", "name", "planTitle", "maintenancePlan"],
    "Untitled Maintenance Plan"
  );

const typeOf = (row) =>
  valueOf(
    row,
    ["maintenanceType", "maintenance_type", "type"],
    "Preventive"
  );

const categoryOf = (row) =>
  valueOf(row, ["category", "maintenance_category"], "—");

const assetIdOf = (row) =>
  valueOf(row, ["assetId", "asset_id"], "");

const assetNameOf = (row) =>
  valueOf(
    row,
    ["assetName", "asset_name", "asset", "equipmentName", "equipment_name"],
    "—"
  );

const locationOf = (row) =>
  valueOf(row, ["location", "location_name", "site"], "—");

const frequencyOf = (row) =>
  valueOf(
    row,
    ["frequency", "maintenanceFrequency", "maintenance_frequency"],
    "—"
  );

const intervalValueOf = (row) =>
  valueOf(row, ["intervalValue", "interval_value"], "");

const intervalUnitOf = (row) =>
  valueOf(row, ["intervalUnit", "interval_unit"], "");

const assignedToOf = (row) =>
  valueOf(
    row,
    ["assignedTo", "assigned_to", "technician", "technicianName"],
    "—"
  );

const contractorOf = (row) =>
  valueOf(row, ["contractor", "contractor_name"], "—");

const priorityOf = (row) =>
  String(valueOf(row, ["priority"], "")).toLowerCase();

const statusOf = (row) =>
  String(valueOf(row, ["status", "plan_status"], "pending")).toLowerCase();

const lastDateOf = (row) =>
  valueOf(
    row,
    [
      "lastMaintenanceDate",
      "last_maintenance_date",
      "lastServiceDate",
      "last_service_date",
    ]
  );

const nextDateOf = (row) =>
  valueOf(
    row,
    [
      "nextMaintenanceDate",
      "next_maintenance_date",
      "nextServiceDate",
      "next_service_date",
      "nextDueDate",
      "next_due_date",
    ]
  );

const startDateOf = (row) =>
  valueOf(row, ["startDate", "start_date"]);

const endDateOf = (row) =>
  valueOf(row, ["endDate", "end_date"]);

const estimatedCostOf = (row) =>
  valueOf(row, ["estimatedCost", "estimated_cost"], "");

const actualCostOf = (row) =>
  valueOf(row, ["actualCost", "actual_cost"], "");

const descriptionOf = (row) =>
  valueOf(row, ["description", "details"], "");

const checklistOf = (row) =>
  valueOf(row, ["checklist", "maintenanceChecklist", "maintenance_checklist"], "");

const remarksOf = (row) =>
  valueOf(row, ["remarks", "notes"], "");

const formatDate = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString();
};

const formatMoney = (value) => {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  const number = Number(value);

  if (Number.isNaN(number)) {
    return String(value);
  }

  return number.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const extractRows = (data) => {
  if (Array.isArray(data)) return data;

  return (
    data?.rows ||
    data?.items ||
    data?.records ||
    data?.results ||
    data?.data?.rows ||
    data?.data?.items ||
    data?.data?.records ||
    data?.data?.results ||
    data?.data ||
    []
  );
};

const extractPagination = (data, page, fallbackTotal) => {
  const meta =
    data?.pagination ||
    data?.meta ||
    data?.data?.pagination ||
    {};

  const total =
    Number(
      meta.total ??
        data?.total ??
        data?.data?.total ??
        fallbackTotal
    ) || 0;

  const pages =
    Number(
      meta.pages ??
        meta.totalPages ??
        data?.totalPages ??
        data?.data?.totalPages
    ) || Math.max(1, Math.ceil(total / PAGE_SIZE));

  return {
    page:
      Number(meta.page ?? data?.page ?? data?.data?.page) || page,
    total,
    pages,
  };
};

const statusText = (status) => {
  const labels = {
    active: "Active",
    inactive: "Inactive",
    paused: "Paused",
    completed: "Completed",
    overdue: "Overdue",
    scheduled: "Scheduled",
    cancelled: "Cancelled",
    draft: "Draft",
  };

  return (
    labels[status] ||
    String(status || "Unknown")
      .replace(/_/g, " ")
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
  );
};

const statusClass = (status) => {
  if (["active", "scheduled"].includes(status)) return "success";
  if (["paused", "draft"].includes(status)) return "warning";
  if (["overdue", "cancelled"].includes(status)) return "danger";
  if (status === "completed") return "info";
  return "neutral";
};

const priorityText = (priority) => {
  const labels = {
    low: "Low",
    medium: "Medium",
    high: "High",
    critical: "Critical",
    urgent: "Urgent",
  };

  return labels[priority] || priority || "—";
};

const priorityClass = (priority) => {
  if (["critical", "urgent"].includes(priority)) return "critical";
  if (priority === "high") return "high";
  if (priority === "medium") return "medium";
  return "low";
};

const normalizeFrequency = (value) => {
  const frequency = String(value || "").toLowerCase();

  if (frequency.includes("day")) return "daily";
  if (frequency.includes("week")) return "weekly";
  if (frequency.includes("month")) return "monthly";
  if (frequency.includes("quarter")) return "quarterly";
  if (frequency.includes("year") || frequency.includes("annual")) {
    return "yearly";
  }

  return frequency || "monthly";
};

export default function InfrastructurePreventive() {
  const [rows, setRows] = useState([]);

  const [types, setTypes] = useState([]);
  const [categories, setCategories] = useState([]);
  const [locations, setLocations] = useState([]);
  const [assets, setAssets] = useState([]);
  const [technicians, setTechnicians] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [frequency, setFrequency] = useState("");
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");

  const [page, setPage] = useState(1);

  const [pagination, setPagination] = useState({
    page: 1,
    total: 0,
    pages: 1,
  });

  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showDelete, setShowDelete] = useState(null);

  const [form, setForm] = useState(EMPTY_FORM);

  const loadPlans = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get(
        "/infrastructure/preventive",
        {
          params: {
            page,
            limit: PAGE_SIZE,
            search: search.trim() || undefined,
            status: status || undefined,
            priority: priority || undefined,
            frequency: frequency || undefined,
            category: category || undefined,
            location: location || undefined,
          },
        }
      );

      const data = response.data;
      const extracted = extractRows(data);

      setRows(extracted);

      setPagination(
        extractPagination(data, page, extracted.length)
      );

      setTypes([
        ...new Set(
          extracted
            .map(typeOf)
            .filter((item) => item && item !== "—")
        ),
      ]);

      setCategories([
        ...new Set(
          extracted
            .map(categoryOf)
            .filter((item) => item && item !== "—")
        ),
      ]);

      setLocations([
        ...new Set(
          extracted
            .map(locationOf)
            .filter((item) => item && item !== "—")
        ),
      ]);

      setAssets(data?.filters?.assets || []);
      setTechnicians(data?.filters?.technicians || []);
    } catch (err) {
      setRows([]);

      setPagination({
        page: 1,
        total: 0,
        pages: 1,
      });

      setError(
        err?.response?.data?.message ||
          "Unable to load preventive maintenance plans from the backend."
      );
    } finally {
      setLoading(false);
    }
  }, [
    page,
    search,
    status,
    priority,
    frequency,
    category,
    location,
  ]);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  useEffect(() => {
    if (!success) return;

    const timer = setTimeout(
      () => setSuccess(""),
      3500
    );

    return () => clearTimeout(timer);
  }, [success]);

  const summary = useMemo(() => {
    const active = rows.filter(
      (row) => statusOf(row) === "active"
    ).length;

    const paused = rows.filter(
      (row) => statusOf(row) === "paused"
    ).length;

    const completed = rows.filter(
      (row) => statusOf(row) === "completed"
    ).length;

    const critical = rows.filter((row) =>
      ["critical", "urgent"].includes(priorityOf(row))
    ).length;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const overdue = rows.filter((row) => {
      const next = nextDateOf(row);

      if (!next) return false;

      const date = new Date(next);

      if (Number.isNaN(date.getTime())) return false;

      return (
        date < today &&
        !["completed", "cancelled"].includes(
          statusOf(row)
        )
      );
    }).length;

    const dueSoon = rows.filter((row) => {
      const next = nextDateOf(row);

      if (!next) return false;

      const date = new Date(next);

      if (Number.isNaN(date.getTime())) return false;

      const difference =
        date.getTime() - today.getTime();

      const days =
        difference / (1000 * 60 * 60 * 24);

      return days >= 0 && days <= 30;
    }).length;

    return {
      total: pagination.total || rows.length,
      active,
      paused,
      completed,
      critical,
      overdue,
      dueSoon,
    };
  }, [rows, pagination.total]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError("");
    setShowForm(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setError("");

    setForm({
      planNumber:
        planNumberOf(row) === "—"
          ? ""
          : planNumberOf(row),

      title:
        titleOf(row) === "Untitled Maintenance Plan"
          ? ""
          : titleOf(row),

      maintenanceType:
        typeOf(row) || "Preventive",

      category:
        categoryOf(row) === "—"
          ? ""
          : categoryOf(row),

      assetId: assetIdOf(row),

      assetName:
        assetNameOf(row) === "—"
          ? ""
          : assetNameOf(row),

      location:
        locationOf(row) === "—"
          ? ""
          : locationOf(row),

      frequency:
        normalizeFrequency(frequencyOf(row)),

      intervalValue:
        intervalValueOf(row) || "1",

      intervalUnit:
        intervalUnitOf(row) || "month",

      assignedTo:
        assignedToOf(row) === "—"
          ? ""
          : assignedToOf(row),

      contractor:
        contractorOf(row) === "—"
          ? ""
          : contractorOf(row),

      priority:
        priorityOf(row) || "medium",

      status:
        statusOf(row) || "active",

      lastMaintenanceDate: lastDateOf(row)
        ? String(lastDateOf(row)).slice(0, 10)
        : "",

      nextMaintenanceDate: nextDateOf(row)
        ? String(nextDateOf(row)).slice(0, 10)
        : "",

      startDate: startDateOf(row)
        ? String(startDateOf(row)).slice(0, 10)
        : "",

      endDate: endDateOf(row)
        ? String(endDateOf(row)).slice(0, 10)
        : "",

      estimatedCost: estimatedCostOf(row),
      actualCost: actualCostOf(row),

      description: descriptionOf(row),
      checklist: checklistOf(row),
      remarks: remarksOf(row),
    });

    setShowForm(true);
  };

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const savePlan = async (event) => {
    event.preventDefault();

    if (!form.maintenanceType.trim()) {
      setError("Maintenance type is required.");
      return;
    }

    if (!form.assetId.trim()) {
      setError("Select an infrastructure asset.");
      return;
    }

    if (!form.nextMaintenanceDate) {
      setError(
        "Next maintenance date is required."
      );
      return;
    }

    setSaving(true);
    setError("");

    const payload = {
      maintenanceType:
        form.maintenanceType.trim() ||
        "Preventive",

      assetId: Number(form.assetId),

      technicianId: form.assignedTo ? Number(form.assignedTo) : null,

      scheduleDate: form.nextMaintenanceDate || null,

      frequency:
        form.frequency,

      status: form.status,

      lastMaintenanceDate:
        form.lastMaintenanceDate || null,

      nextMaintenanceDate:
        form.nextMaintenanceDate || null,

      startDate:
        form.startDate || null,

      endDate:
        form.endDate || null,

      estimatedCost:
        form.estimatedCost || null,

      description:
        form.description.trim() || null,

      checklist:
        form.checklist.trim() || null,

      remarks:
        form.remarks.trim() || null,
    };

    try {
      if (editing) {
        const id = idOf(editing);

        if (!id) {
          throw new Error(
            "The selected maintenance plan has no valid ID."
          );
        }

        await api.put(
          `/infrastructure/preventive/${id}`,
          payload
        );

        setSuccess(
          "Preventive maintenance plan updated successfully."
        );
      } else {
        await api.post(
          "/infrastructure/preventive",
          payload
        );

        setSuccess(
          "Preventive maintenance plan created successfully."
        );
      }

      setShowForm(false);
      setEditing(null);
      setForm(EMPTY_FORM);

      await loadPlans();
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Unable to save the preventive maintenance plan."
      );
    } finally {
      setSaving(false);
    }
  };

  const deletePlan = async () => {
    const id = idOf(showDelete);

    if (!id) {
      setError(
        "The selected maintenance plan has no valid ID."
      );
      return;
    }

    setDeleting(true);
    setError("");

    try {
      await api.delete(
        `/infrastructure/preventive/${id}`
      );

      setSuccess(
        "Preventive maintenance plan deleted successfully."
      );

      setShowDelete(null);

      if (rows.length === 1 && page > 1) {
        setPage((current) => current - 1);
      } else {
        await loadPlans();
      }
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          "Unable to delete the preventive maintenance plan."
      );
    } finally {
      setDeleting(false);
    }
  };

  const clearFilters = () => {
    setSearch("");
    setStatus("");
    setPriority("");
    setFrequency("");
    setCategory("");
    setLocation("");
    setPage(1);
  };

  const hasFilters =
    search ||
    status ||
    priority ||
    frequency ||
    category ||
    location;

  return (
    <div className="preventive-page">
      <style>{`
        * {
          box-sizing: border-box;
        }

        .preventive-page {
          min-height: 100vh;
          background: #f8fafc;
          color: #0f172a;
          padding: 24px;
          font-family: Inter, ui-sans-serif, system-ui,
            -apple-system, BlinkMacSystemFont, "Segoe UI",
            sans-serif;
        }

        .preventive-container {
          max-width: 1600px;
          margin: 0 auto;
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 20px;
          margin-bottom: 24px;
        }

        .title-wrap {
          display: flex;
          gap: 14px;
          align-items: flex-start;
        }

        .title-icon {
          width: 52px;
          height: 52px;
          display: grid;
          place-items: center;
          border-radius: 14px;
          color: white;
          background: linear-gradient(135deg, #0ea5e9, #2563eb);
          box-shadow: 0 10px 25px rgba(37, 99, 235, 0.2);
          flex-shrink: 0;
        }

        .page-title {
          margin: 0;
          font-size: 28px;
          font-weight: 800;
          letter-spacing: -0.5px;
        }

        .page-subtitle {
          margin: 6px 0 0;
          color: #64748b;
          font-size: 14px;
          line-height: 1.5;
        }

        .header-actions {
          display: flex;
          gap: 9px;
          flex-wrap: wrap;
        }

        .btn {
          min-height: 42px;
          border: 0;
          border-radius: 10px;
          padding: 0 15px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          text-decoration: none;
          white-space: nowrap;
          transition: 0.2s ease;
        }

        .btn:hover:not(:disabled) {
          transform: translateY(-1px);
        }

        .btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .btn-primary {
          color: white;
          background: #0ea5e9;
          box-shadow: 0 6px 16px rgba(14, 165, 233, 0.2);
        }

        .btn-primary:hover:not(:disabled) {
          background: #0284c7;
        }

        .btn-secondary {
          color: #334155;
          background: white;
          border: 1px solid #dbe3ee;
        }

        .btn-secondary:hover:not(:disabled) {
          background: #f8fafc;
          border-color: #94a3b8;
        }

        .btn-danger {
          color: white;
          background: #dc2626;
        }

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 22px;
        }

        .summary-card {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 17px;
          box-shadow: 0 4px 16px rgba(15, 23, 42, 0.04);
        }

        .summary-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
        }

        .summary-label {
          color: #64748b;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .summary-value {
          margin-top: 8px;
          font-size: 25px;
          font-weight: 800;
        }

        .summary-icon {
          width: 39px;
          height: 39px;
          display: grid;
          place-items: center;
          border-radius: 11px;
          color: #2563eb;
          background: #eff6ff;
        }

        .summary-card.warning .summary-icon {
          color: #c2410c;
          background: #fff7ed;
        }

        .summary-card.danger .summary-icon {
          color: #dc2626;
          background: #fef2f2;
        }

        .filters {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 16px;
          margin-bottom: 18px;
          box-shadow: 0 4px 16px rgba(15, 23, 42, 0.04);
        }

        .filters-row {
          display: grid;
          grid-template-columns:
            minmax(230px, 2fr)
            repeat(5, minmax(130px, 1fr))
            auto;
          gap: 9px;
        }

        .search-box {
          position: relative;
        }

        .search-box svg {
          position: absolute;
          left: 13px;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
        }

        .input,
        .select,
        .textarea {
          width: 100%;
          border: 1px solid #dbe3ee;
          border-radius: 10px;
          background: white;
          color: #0f172a;
          outline: none;
          font-size: 13px;
        }

        .input,
        .select {
          height: 42px;
          padding: 0 12px;
        }

        .search-box .input {
          padding-left: 40px;
        }

        .textarea {
          min-height: 90px;
          padding: 11px 12px;
          resize: vertical;
        }

        .input:focus,
        .select:focus,
        .textarea:focus {
          border-color: #0ea5e9;
          box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.1);
        }

        .table-card {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 4px 16px rgba(15, 23, 42, 0.04);
        }

        .table-header {
          padding: 17px 18px;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .table-title {
          margin: 0;
          font-size: 16px;
          font-weight: 800;
        }

        .table-count {
          margin-top: 3px;
          color: #64748b;
          font-size: 12px;
        }

        .table-scroll {
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
          padding: 13px 14px;
          text-align: left;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          font-weight: 800;
          white-space: nowrap;
        }

        td {
          padding: 14px;
          border-top: 1px solid #eef2f7;
          font-size: 13px;
          vertical-align: middle;
        }

        tbody tr:hover {
          background: #f8fbff;
        }

        .plan-cell {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 250px;
        }

        .plan-icon {
          width: 38px;
          height: 38px;
          display: grid;
          place-items: center;
          border-radius: 10px;
          color: #2563eb;
          background: #eff6ff;
          flex-shrink: 0;
        }

        .plan-title {
          font-weight: 800;
        }

        .plan-number {
          color: #64748b;
          font-size: 11px;
          margin-top: 2px;
        }

        .muted {
          color: #64748b;
        }

        .badge,
        .priority {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          padding: 5px 9px;
          font-size: 11px;
          font-weight: 800;
          white-space: nowrap;
        }

        .badge.success {
          color: #15803d;
          background: #ecfdf5;
        }

        .badge.info {
          color: #1d4ed8;
          background: #eff6ff;
        }

        .badge.warning {
          color: #c2410c;
          background: #fff7ed;
        }

        .badge.danger {
          color: #b91c1c;
          background: #fef2f2;
        }

        .badge.neutral {
          color: #475569;
          background: #f1f5f9;
        }

        .priority.low {
          color: #475569;
          background: #f1f5f9;
        }

        .priority.medium {
          color: #a16207;
          background: #fffbeb;
        }

        .priority.high {
          color: #c2410c;
          background: #fff7ed;
        }

        .priority.critical {
          color: #b91c1c;
          background: #fef2f2;
        }

        .date-normal {
          color: #334155;
          font-weight: 600;
        }

        .date-overdue {
          color: #dc2626;
          font-weight: 800;
        }

        .date-soon {
          color: #c2410c;
          font-weight: 800;
        }

        .actions {
          display: flex;
          gap: 6px;
        }

        .icon-btn {
          width: 34px;
          height: 34px;
          border: 1px solid #e2e8f0;
          background: white;
          border-radius: 9px;
          display: grid;
          place-items: center;
          color: #475569;
          cursor: pointer;
        }

        .icon-btn:hover {
          background: #f8fafc;
          border-color: #cbd5e1;
        }

        .icon-btn.danger:hover {
          color: #dc2626;
          background: #fef2f2;
          border-color: #fecaca;
        }

        .alert {
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 12px 14px;
          border-radius: 10px;
          margin-bottom: 16px;
          font-size: 13px;
          font-weight: 600;
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

        .empty,
        .loading {
          min-height: 270px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 30px;
        }

        .empty-icon {
          width: 58px;
          height: 58px;
          border-radius: 15px;
          display: grid;
          place-items: center;
          background: #eff6ff;
          color: #2563eb;
          margin-bottom: 13px;
        }

        .empty h3,
        .loading h3 {
          margin: 0 0 6px;
          font-size: 16px;
        }

        .empty p,
        .loading p {
          margin: 0;
          color: #64748b;
          font-size: 13px;
          max-width: 540px;
        }

        .spinner {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .pagination {
          padding: 14px 18px;
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

        .pagination-buttons {
          display: flex;
          gap: 6px;
        }

        .page-btn {
          width: 36px;
          height: 36px;
          border: 1px solid #dbe3ee;
          background: white;
          border-radius: 8px;
          display: grid;
          place-items: center;
          cursor: pointer;
          color: #334155;
        }

        .page-btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 1000;
          background: rgba(15, 23, 42, 0.58);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }

        .modal {
          width: min(1080px, 100%);
          max-height: 92vh;
          overflow-y: auto;
          background: white;
          border-radius: 18px;
          box-shadow: 0 25px 70px rgba(15, 23, 42, 0.25);
        }

        .modal.small {
          width: min(470px, 100%);
        }

        .modal-header {
          position: sticky;
          top: 0;
          z-index: 2;
          background: white;
          padding: 18px 20px;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }

        .modal-title {
          margin: 0;
          font-size: 18px;
          font-weight: 800;
        }

        .close-btn {
          width: 36px;
          height: 36px;
          border: 1px solid #e2e8f0;
          background: white;
          border-radius: 9px;
          display: grid;
          place-items: center;
          cursor: pointer;
          color: #475569;
        }

        .modal-body {
          padding: 20px;
        }

        .form-grid,
        .details-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
        }

        .field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .field.full {
          grid-column: 1 / -1;
        }

        .field label {
          font-size: 12px;
          font-weight: 800;
          color: #334155;
        }

        .required {
          color: #dc2626;
        }

        .detail {
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          border-radius: 11px;
          padding: 12px;
        }

        .detail-label {
          color: #64748b;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          margin-bottom: 5px;
        }

        .detail-value {
          font-size: 13px;
          font-weight: 700;
          word-break: break-word;
        }

        .description-box {
          margin-top: 14px;
          border: 1px solid #e2e8f0;
          border-radius: 11px;
          padding: 13px;
        }

        .modal-footer {
          position: sticky;
          bottom: 0;
          background: white;
          padding: 16px 20px;
          border-top: 1px solid #e2e8f0;
          display: flex;
          justify-content: flex-end;
          gap: 9px;
        }

        @media (max-width: 1500px) {
          .summary-grid {
            grid-template-columns: repeat(4, 1fr);
          }

          .filters-row {
            grid-template-columns: repeat(4, 1fr);
          }
        }

        @media (max-width: 900px) {
          .summary-grid,
          .form-grid,
          .details-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .filters-row {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 650px) {
          .preventive-page {
            padding: 14px;
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

          .summary-grid,
          .form-grid,
          .details-grid,
          .filters-row {
            grid-template-columns: 1fr;
          }

          .field.full {
            grid-column: auto;
          }

          .pagination {
            flex-direction: column;
            align-items: stretch;
          }

          .pagination-buttons {
            justify-content: center;
          }

          .page-title {
            font-size: 23px;
          }
        }
      `}</style>

      <div className="preventive-container">
        <header className="page-header">
          <div className="title-wrap">
            <div className="title-icon">
              <CalendarClock size={25} />
            </div>

            <div>
              <h1 className="page-title">
                Preventive Maintenance
              </h1>

              <p className="page-subtitle">
                Plan recurring maintenance activities,
                track schedules, monitor due dates, and
                keep infrastructure equipment operating
                reliably.
              </p>
            </div>
          </div>

          <div className="header-actions">
            <Link
              to="/infrastructure"
              className="btn btn-secondary"
            >
              Dashboard
            </Link>

            <Link
              to="/infrastructure/maintenance"
              className="btn btn-secondary"
            >
              Facility Maintenance
            </Link>

            <Link
              to="/infrastructure/work-orders"
              className="btn btn-secondary"
            >
              Work Orders
            </Link>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={loadPlans}
              disabled={loading}
            >
              <RefreshCw
                size={16}
                className={loading ? "spinner" : ""}
              />
              Refresh
            </button>

            <button
              type="button"
              className="btn btn-primary"
              onClick={openCreate}
            >
              <Plus size={17} />
              New Maintenance Plan
            </button>
          </div>
        </header>

        {error && (
          <div className="alert alert-error">
            <AlertCircle size={17} />
            <span>{error}</span>
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
              <div>
                <div className="summary-label">
                  Total Plans
                </div>
                <div className="summary-value">
                  {summary.total}
                </div>
              </div>

              <div className="summary-icon">
                <CalendarClock size={20} />
              </div>
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-top">
              <div>
                <div className="summary-label">
                  Active
                </div>
                <div className="summary-value">
                  {summary.active}
                </div>
              </div>

              <div className="summary-icon">
                <CheckCircle2 size={20} />
              </div>
            </div>
          </div>

          <div className="summary-card warning">
            <div className="summary-top">
              <div>
                <div className="summary-label">
                  Due ≤ 30 Days
                </div>
                <div className="summary-value">
                  {summary.dueSoon}
                </div>
              </div>

              <div className="summary-icon">
                <Clock3 size={20} />
              </div>
            </div>
          </div>

          <div className="summary-card danger">
            <div className="summary-top">
              <div>
                <div className="summary-label">
                  Overdue
                </div>
                <div className="summary-value">
                  {summary.overdue}
                </div>
              </div>

              <div className="summary-icon">
                <AlertCircle size={20} />
              </div>
            </div>
          </div>

          <div className="summary-card danger">
            <div className="summary-top">
              <div>
                <div className="summary-label">
                  Critical / Urgent
                </div>
                <div className="summary-value">
                  {summary.critical}
                </div>
              </div>

              <div className="summary-icon">
                <AlertCircle size={20} />
              </div>
            </div>
          </div>

          <div className="summary-card warning">
            <div className="summary-top">
              <div>
                <div className="summary-label">
                  Paused
                </div>
                <div className="summary-value">
                  {summary.paused}
                </div>
              </div>

              <div className="summary-icon">
                <Clock3 size={20} />
              </div>
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-top">
              <div>
                <div className="summary-label">
                  Completed
                </div>
                <div className="summary-value">
                  {summary.completed}
                </div>
              </div>

              <div className="summary-icon">
                <CheckCircle2 size={20} />
              </div>
            </div>
          </div>
        </section>

        <section className="filters">
          <div className="filters-row">
            <div className="search-box">
              <Search size={17} />

              <input
                className="input"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Search plan, asset, technician..."
              />
            </div>

            <select
              className="select"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="due">Due</option>
              <option value="overdue">Overdue</option>
              <option value="completed">Completed</option>
              <option value="skipped">Skipped</option>
              <option value="cancelled">Cancelled</option>
            </select>

            <select
              className="select"
              value={priority}
              onChange={(event) => {
                setPriority(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All Priorities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
              <option value="urgent">Urgent</option>
            </select>

            <select
              className="select"
              value={frequency}
              onChange={(event) => {
                setFrequency(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All Frequencies</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
            </select>

            <select
              className="select"
              value={category}
              onChange={(event) => {
                setCategory(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All Categories</option>

              {categories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            <select
              className="select"
              value={location}
              onChange={(event) => {
                setLocation(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All Locations</option>

              {locations.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={clearFilters}
              disabled={!hasFilters}
            >
              <Filter size={16} />
              Clear
            </button>
          </div>
        </section>

        <section className="table-card">
          <div className="table-header">
            <div>
              <h2 className="table-title">
                Preventive Maintenance Plans
              </h2>

              <div className="table-count">
                {pagination.total} maintenance plan
                {pagination.total === 1 ? "" : "s"}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="loading">
              <RefreshCw
                size={30}
                className="spinner"
              />

              <h3>Loading maintenance plans</h3>

              <p>
                Fetching current preventive maintenance
                information from the backend.
              </p>
            </div>
          ) : rows.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">
                <CalendarClock size={28} />
              </div>

              <h3>No preventive maintenance plans found</h3>

              <p>
                No maintenance plans match the selected
                filters, or no preventive maintenance plan
                has been registered yet.
              </p>

              {hasFilters ? (
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ marginTop: 15 }}
                  onClick={clearFilters}
                >
                  Clear Filters
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ marginTop: 15 }}
                  onClick={openCreate}
                >
                  <Plus size={16} />
                  Create First Plan
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Maintenance Plan</th>
                      <th>Asset</th>
                      <th>Location</th>
                      <th>Frequency</th>
                      <th>Priority</th>
                      <th>Status</th>
                      <th>Assigned To</th>
                      <th>Last Service</th>
                      <th>Next Due</th>
                      <th>Est. Cost</th>
                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {rows.map((row) => {
                      const id = idOf(row);
                      const nextDate = nextDateOf(row);

                      let nextClass = "date-normal";

                      if (nextDate) {
                        const next = new Date(nextDate);
                        const today = new Date();

                        today.setHours(0, 0, 0, 0);

                        if (
                          !Number.isNaN(next.getTime())
                        ) {
                          const days =
                            (next.getTime() -
                              today.getTime()) /
                            (1000 * 60 * 60 * 24);

                          if (
                            days < 0 &&
                            ![
                              "completed",
                              "cancelled",
                            ].includes(statusOf(row))
                          ) {
                            nextClass = "date-overdue";
                          } else if (days <= 30) {
                            nextClass = "date-soon";
                          }
                        }
                      }

                      return (
                        <tr
                          key={
                            id ||
                            `${titleOf(row)}-${planNumberOf(
                              row
                            )}`
                          }
                        >
                          <td>
                            <div className="plan-cell">
                              <div className="plan-icon">
                                <CalendarClock size={18} />
                              </div>

                              <div>
                                <div className="plan-title">
                                  {titleOf(row)}
                                </div>

                                <div className="plan-number">
                                  {planNumberOf(row)}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td>
                            <strong>
                              {assetNameOf(row)}
                            </strong>

                            {assetIdOf(row) && (
                              <div className="muted">
                                ID: {assetIdOf(row)}
                              </div>
                            )}
                          </td>

                          <td>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 5,
                              }}
                            >
                              <MapPin
                                size={13}
                                color="#64748b"
                              />
                              {locationOf(row)}
                            </div>
                          </td>

                          <td>
                            <strong>
                              {frequencyOf(row)}
                            </strong>

                            {intervalValueOf(row) &&
                              intervalUnitOf(row) && (
                                <div className="muted">
                                  Every{" "}
                                  {intervalValueOf(row)}{" "}
                                  {intervalUnitOf(row)}
                                </div>
                              )}
                          </td>

                          <td>
                            <span
                              className={`priority ${priorityClass(
                                priorityOf(row)
                              )}`}
                            >
                              {priorityText(
                                priorityOf(row)
                              )}
                            </span>
                          </td>

                          <td>
                            <span
                              className={`badge ${statusClass(
                                statusOf(row)
                              )}`}
                            >
                              {statusText(
                                statusOf(row)
                              )}
                            </span>
                          </td>

                          <td>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 5,
                              }}
                            >
                              <UserRound
                                size={13}
                                color="#64748b"
                              />
                              {assignedToOf(row)}
                            </div>
                          </td>

                          <td>
                            {formatDate(
                              lastDateOf(row)
                            )}
                          </td>

                          <td>
                            <span
                              className={nextClass}
                            >
                              {formatDate(nextDate)}
                            </span>
                          </td>

                          <td>
                            {formatMoney(
                              estimatedCostOf(row)
                            )}
                          </td>

                          <td>
                            <div className="actions">
                              <button
                                type="button"
                                className="icon-btn"
                                title="View"
                                onClick={() =>
                                  setSelected(row)
                                }
                              >
                                <Eye size={16} />
                              </button>

                              <button
                                type="button"
                                className="icon-btn"
                                title="Edit"
                                onClick={() =>
                                  openEdit(row)
                                }
                              >
                                <Edit3 size={16} />
                              </button>

                              <button
                                type="button"
                                className="icon-btn danger"
                                title="Delete"
                                onClick={() =>
                                  setShowDelete(row)
                                }
                              >
                                <Trash2 size={16} />
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
                  Page {pagination.page} of{" "}
                  {pagination.pages}
                  {" • "}
                  {pagination.total} total
                </div>

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
                    <ChevronLeft size={16} />
                  </button>

                  <button
                    type="button"
                    className="page-btn"
                    disabled={
                      page >= pagination.pages
                    }
                    onClick={() =>
                      setPage((current) =>
                        Math.min(
                          pagination.pages,
                          current + 1
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
        </section>
      </div>

      {selected && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelected(null);
            }
          }}
        >
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">
                Preventive Maintenance Details
              </h2>

              <button
                type="button"
                className="close-btn"
                onClick={() => setSelected(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <div className="details-grid">
                <div className="detail">
                  <div className="detail-label">
                    Plan Title
                  </div>

                  <div className="detail-value">
                    {titleOf(selected)}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">
                    Plan Number
                  </div>

                  <div className="detail-value">
                    {planNumberOf(selected)}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">
                    Maintenance Type
                  </div>

                  <div className="detail-value">
                    {typeOf(selected)}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">
                    Category
                  </div>

                  <div className="detail-value">
                    {categoryOf(selected)}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">
                    Asset
                  </div>

                  <div className="detail-value">
                    {assetNameOf(selected)}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">
                    Asset ID
                  </div>

                  <div className="detail-value">
                    {assetIdOf(selected) || "—"}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">
                    Location
                  </div>

                  <div className="detail-value">
                    {locationOf(selected)}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">
                    Frequency
                  </div>

                  <div className="detail-value">
                    {frequencyOf(selected)}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">
                    Interval
                  </div>

                  <div className="detail-value">
                    {intervalValueOf(selected) &&
                    intervalUnitOf(selected)
                      ? `Every ${intervalValueOf(
                          selected
                        )} ${intervalUnitOf(selected)}`
                      : "—"}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">
                    Assigned To
                  </div>

                  <div className="detail-value">
                    {assignedToOf(selected)}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">
                    Contractor
                  </div>

                  <div className="detail-value">
                    {contractorOf(selected)}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">
                    Priority
                  </div>

                  <div className="detail-value">
                    {priorityText(
                      priorityOf(selected)
                    )}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">
                    Status
                  </div>

                  <div className="detail-value">
                    {statusText(
                      statusOf(selected)
                    )}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">
                    Last Maintenance
                  </div>

                  <div className="detail-value">
                    {formatDate(
                      lastDateOf(selected)
                    )}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">
                    Next Maintenance
                  </div>

                  <div className="detail-value">
                    {formatDate(
                      nextDateOf(selected)
                    )}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">
                    Start Date
                  </div>

                  <div className="detail-value">
                    {formatDate(
                      startDateOf(selected)
                    )}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">
                    End Date
                  </div>

                  <div className="detail-value">
                    {formatDate(
                      endDateOf(selected)
                    )}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">
                    Estimated Cost
                  </div>

                  <div className="detail-value">
                    {formatMoney(
                      estimatedCostOf(selected)
                    )}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">
                    Actual Cost
                  </div>

                  <div className="detail-value">
                    {formatMoney(
                      actualCostOf(selected)
                    )}
                  </div>
                </div>
              </div>

              {descriptionOf(selected) && (
                <div className="description-box">
                  <div className="detail-label">
                    Description
                  </div>

                  <div className="detail-value">
                    {descriptionOf(selected)}
                  </div>
                </div>
              )}

              {checklistOf(selected) && (
                <div className="description-box">
                  <div className="detail-label">
                    Maintenance Checklist
                  </div>

                  <div className="detail-value">
                    {checklistOf(selected)}
                  </div>
                </div>
              )}

              {remarksOf(selected) && (
                <div className="description-box">
                  <div className="detail-label">
                    Remarks
                  </div>

                  <div className="detail-value">
                    {remarksOf(selected)}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowForm(false);
            }
          }}
        >
          <form
            className="modal"
            onSubmit={savePlan}
          >
            <div className="modal-header">
              <h2 className="modal-title">
                {editing
                  ? "Edit Preventive Maintenance Plan"
                  : "Create Preventive Maintenance Plan"}
              </h2>

              <button
                type="button"
                className="close-btn"
                onClick={() => setShowForm(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <div className="form-grid">
                <div className="field">
                  <label>
                    Plan Number
                  </label>

                  <input
                    className="input"
                    name="planNumber"
                    value={form.planNumber}
                    onChange={handleChange}
                    placeholder="PM-2026-001"
                  />
                </div>

                <div className="field">
                  <label>
                    Plan Title{" "}
                    <span className="required">*</span>
                  </label>

                  <input
                    className="input"
                    name="title"
                    value={form.title}
                    onChange={handleChange}
                    placeholder="Generator preventive maintenance"
                    required
                  />
                </div>

                <div className="field">
                  <label>
                    Maintenance Type
                  </label>

                  <input
                    className="input"
                    name="maintenanceType"
                    value={form.maintenanceType}
                    onChange={handleChange}
                    placeholder="Preventive"
                  />
                </div>

                <div className="field">
                  <label>
                    Category
                  </label>

                  <input
                    className="input"
                    name="category"
                    value={form.category}
                    onChange={handleChange}
                    placeholder="Electrical / Plumbing / Building"
                  />
                </div>

                <div className="field">
                  <label>
                    Asset <span className="required">*</span>
                  </label>

                  <select
                    className="select"
                    name="assetId"
                    value={form.assetId}
                    onChange={handleChange}
                    required
                  >
                    <option value="">Select an infrastructure asset</option>
                    {assets.map((asset) => (
                      <option key={asset.id} value={asset.id}>
                        {asset.assetCode ? `${asset.assetCode} - ` : ""}{asset.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label>
                    Asset Name
                  </label>

                  <input
                    className="input"
                    name="assetName"
                    value={form.assetName}
                    onChange={handleChange}
                    placeholder="Generator / transformer / pump"
                  />
                </div>

                <div className="field">
                  <label>
                    Location{" "}
                    <span className="required">*</span>
                  </label>

                  <input
                    className="input"
                    name="location"
                    value={form.location}
                    onChange={handleChange}
                    placeholder="Building / facility / site"
                    required
                  />
                </div>

                <div className="field">
                  <label>
                    Frequency
                  </label>

                  <select
                    className="select"
                    name="frequency"
                    value={form.frequency}
                    onChange={handleChange}
                  >
                    <option value="daily">
                      Daily
                    </option>

                    <option value="weekly">
                      Weekly
                    </option>

                    <option value="monthly">
                      Monthly
                    </option>

                    <option value="quarterly">
                      Quarterly
                    </option>

                    <option value="annual">
                      Annual
                    </option>
                  </select>
                </div>

                <div className="field">
                  <label>
                    Interval
                  </label>

                  <input
                    className="input"
                    type="number"
                    min="1"
                    name="intervalValue"
                    value={form.intervalValue}
                    onChange={handleChange}
                  />
                </div>

                <div className="field">
                  <label>
                    Interval Unit
                  </label>

                  <select
                    className="select"
                    name="intervalUnit"
                    value={form.intervalUnit}
                    onChange={handleChange}
                  >
                    <option value="day">
                      Day
                    </option>

                    <option value="week">
                      Week
                    </option>

                    <option value="month">
                      Month
                    </option>

                    <option value="quarter">
                      Quarter
                    </option>

                    <option value="year">
                      Year
                    </option>
                  </select>
                </div>

                <div className="field">
                  <label>
                    Assigned Technician
                  </label>

                  <select
                    className="select"
                    name="assignedTo"
                    value={form.assignedTo}
                    onChange={handleChange}
                  >
                    <option value="">Unassigned</option>
                    {technicians.map((technician) => (
                      <option key={technician.id} value={technician.id}>
                        {technician.fullName || technician.username}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label>
                    Contractor
                  </label>

                  <input
                    className="input"
                    name="contractor"
                    value={form.contractor}
                    onChange={handleChange}
                    placeholder="Contractor / service provider"
                  />
                </div>

                <div className="field">
                  <label>
                    Priority
                  </label>

                  <select
                    className="select"
                    name="priority"
                    value={form.priority}
                    onChange={handleChange}
                  >
                    <option value="low">
                      Low
                    </option>

                    <option value="medium">
                      Medium
                    </option>

                    <option value="high">
                      High
                    </option>

                    <option value="critical">
                      Critical
                    </option>

                    <option value="urgent">
                      Urgent
                    </option>
                  </select>
                </div>

                <div className="field">
                  <label>
                    Status
                  </label>

                  <select
                    className="select"
                    name="status"
                    value={form.status}
                    onChange={handleChange}
                  >
                    <option value="pending">
                      Pending
                    </option>

                    <option value="due">
                      Due
                    </option>

                    <option value="overdue">
                      Overdue
                    </option>

                    <option value="completed">
                      Completed
                    </option>

                    <option value="skipped">
                      Skipped
                    </option>

                    <option value="cancelled">
                      Cancelled
                    </option>
                  </select>
                </div>

                <div className="field">
                  <label>
                    Last Maintenance
                  </label>

                  <input
                    className="input"
                    type="date"
                    name="lastMaintenanceDate"
                    value={form.lastMaintenanceDate}
                    onChange={handleChange}
                  />
                </div>

                <div className="field">
                  <label>
                    Next Maintenance{" "}
                    <span className="required">*</span>
                  </label>

                  <input
                    className="input"
                    type="date"
                    name="nextMaintenanceDate"
                    value={form.nextMaintenanceDate}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="field">
                  <label>
                    Plan Start Date
                  </label>

                  <input
                    className="input"
                    type="date"
                    name="startDate"
                    value={form.startDate}
                    onChange={handleChange}
                  />
                </div>

                <div className="field">
                  <label>
                    Plan End Date
                  </label>

                  <input
                    className="input"
                    type="date"
                    name="endDate"
                    value={form.endDate}
                    onChange={handleChange}
                  />
                </div>

                <div className="field">
                  <label>
                    Estimated Cost
                  </label>

                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="0.01"
                    name="estimatedCost"
                    value={form.estimatedCost}
                    onChange={handleChange}
                    placeholder="0.00"
                  />
                </div>

                <div className="field">
                  <label>
                    Actual Cost
                  </label>

                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="0.01"
                    name="actualCost"
                    value={form.actualCost}
                    onChange={handleChange}
                    placeholder="0.00"
                  />
                </div>

                <div className="field full">
                  <label>
                    Description
                  </label>

                  <textarea
                    className="textarea"
                    name="description"
                    value={form.description}
                    onChange={handleChange}
                    placeholder="Describe the preventive maintenance activity..."
                  />
                </div>

                <div className="field full">
                  <label>
                    Maintenance Checklist
                  </label>

                  <textarea
                    className="textarea"
                    name="checklist"
                    value={form.checklist}
                    onChange={handleChange}
                    placeholder="Inspection, cleaning, testing, lubrication, replacement..."
                  />
                </div>

                <div className="field full">
                  <label>
                    Remarks
                  </label>

                  <textarea
                    className="textarea"
                    name="remarks"
                    value={form.remarks}
                    onChange={handleChange}
                    placeholder="Additional maintenance notes..."
                  />
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowForm(false)}
                disabled={saving}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving}
              >
                {saving ? (
                  <>
                    <RefreshCw
                      size={16}
                      className="spinner"
                    />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} />
                    {editing
                      ? "Update Plan"
                      : "Create Plan"}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {showDelete && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowDelete(null);
            }
          }}
        >
          <div className="modal small">
            <div className="modal-header">
              <h2 className="modal-title">
                Delete Maintenance Plan
              </h2>

              <button
                type="button"
                className="close-btn"
                onClick={() => setShowDelete(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 14,
                  background: "#fef2f2",
                  color: "#dc2626",
                  display: "grid",
                  placeItems: "center",
                  marginBottom: 15,
                }}
              >
                <Trash2 size={24} />
              </div>

              <h3 style={{ margin: "0 0 7px" }}>
                Are you sure?
              </h3>

              <p
                style={{
                  margin: 0,
                  color: "#64748b",
                  lineHeight: 1.6,
                  fontSize: 13,
                }}
              >
                You are about to delete{" "}
                <strong>
                  {titleOf(showDelete)}
                </strong>
                . The deletion will be processed by
                the backend.
              </p>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowDelete(null)}
                disabled={deleting}
              >
                Cancel
              </button>

              <button
                type="button"
                className="btn btn-danger"
                onClick={deletePlan}
                disabled={deleting}
              >
                {deleting ? (
                  <>
                    <RefreshCw
                      size={16}
                      className="spinner"
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
    </div>
  );
}