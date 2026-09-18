import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import {
  AlertCircle,
  CalendarCheck2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Edit3,
  Eye,
  Filter,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserRound,
  X,
} from "lucide-react";

const PAGE_SIZE = 10;

const EMPTY_FORM = {
  inspectionNumber: "",
  title: "",
  assetId: "",
  assetName: "",
  assetTag: "",
  category: "",
  location: "",
  inspectionType: "Routine",
  inspectionDate: "",
  nextInspectionDate: "",
  inspector: "",
  condition: "Good",
  status: "Completed",
  priority: "Medium",
  safetyStatus: "Safe",
  operationalStatus: "Operational",
  defects: "",
  findings: "",
  recommendations: "",
  correctiveAction: "",
  estimatedCost: "",
  actualCost: "",
  photos: "",
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
    "inspectionId",
    "inspection_id",
  ]);

const inspectionNumberOf = (row) =>
  valueOf(
    row,
    [
      "inspectionNumber",
      "inspection_number",
      "referenceNumber",
      "reference",
    ],
    "—"
  );

const titleOf = (row) =>
  valueOf(
    row,
    ["title", "name", "inspectionTitle"],
    "Infrastructure Inspection"
  );

const assetIdOf = (row) =>
  valueOf(row, ["assetId", "asset_id"], "");

const assetNameOf = (row) =>
  valueOf(
    row,
    [
      "assetName",
      "asset_name",
      "asset",
      "equipmentName",
      "equipment_name",
    ],
    "—"
  );

const assetTagOf = (row) =>
  valueOf(
    row,
    ["assetTag", "asset_tag", "tag", "assetCode"],
    ""
  );

const categoryOf = (row) =>
  valueOf(row, ["category", "assetCategory"], "—");

const locationOf = (row) =>
  valueOf(
    row,
    ["location", "location_name", "site"],
    "—"
  );

const inspectionTypeOf = (row) =>
  valueOf(
    row,
    ["inspectionType", "inspection_type", "type"],
    "Routine"
  );

const inspectionDateOf = (row) =>
  valueOf(
    row,
    [
      "inspectionDate",
      "inspection_date",
      "date",
    ],
    ""
  );

const nextInspectionDateOf = (row) =>
  valueOf(
    row,
    [
      "nextInspectionDate",
      "next_inspection_date",
      "nextDate",
      "next_date",
    ],
    ""
  );

const inspectorOf = (row) =>
  valueOf(
    row,
    [
      "inspector",
      "inspectorName",
      "inspector_name",
      "conductedBy",
      "conducted_by",
    ],
    "—"
  );

const conditionOf = (row) =>
  String(
    valueOf(
      row,
      ["condition", "conditionStatus", "assetCondition"],
      "Good"
    )
  ).toLowerCase();

const statusOf = (row) =>
  String(
    valueOf(
      row,
      ["status", "inspectionStatus"],
      "completed"
    )
  ).toLowerCase();

const priorityOf = (row) =>
  String(
    valueOf(row, ["priority"], "medium")
  ).toLowerCase();

const safetyStatusOf = (row) =>
  String(
    valueOf(
      row,
      ["safetyStatus", "safety_status"],
      "safe"
    )
  ).toLowerCase();

const operationalStatusOf = (row) =>
  String(
    valueOf(
      row,
      ["operationalStatus", "operational_status"],
      "operational"
    )
  ).toLowerCase();

const defectsOf = (row) =>
  valueOf(
    row,
    ["defects", "defect", "defectDescription"],
    ""
  );

const findingsOf = (row) =>
  valueOf(
    row,
    ["findings", "inspectionFindings", "inspection_findings"],
    ""
  );

const recommendationsOf = (row) =>
  valueOf(
    row,
    ["recommendations", "recommendation"],
    ""
  );

const correctiveActionOf = (row) =>
  valueOf(
    row,
    ["correctiveAction", "corrective_action", "actionRequired"],
    ""
  );

const estimatedCostOf = (row) =>
  valueOf(row, ["estimatedCost", "estimated_cost"], "");

const actualCostOf = (row) =>
  valueOf(row, ["actualCost", "actual_cost"], "");

const photosOf = (row) =>
  valueOf(row, ["photos", "photo", "attachments"], "");

const remarksOf = (row) =>
  valueOf(row, ["remarks", "notes", "comments"], "");

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
      Number(
        meta.page ??
          data?.page ??
          data?.data?.page
      ) || page,
    total,
    pages,
  };
};

const conditionText = (condition) => {
  const labels = {
    excellent: "Excellent",
    good: "Good",
    fair: "Fair",
    poor: "Poor",
    critical: "Critical",
    damaged: "Damaged",
    failed: "Failed",
  };

  return (
    labels[condition] ||
    String(condition || "Unknown")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
  );
};

const conditionClass = (condition) => {
  if (condition === "excellent") return "excellent";
  if (condition === "good") return "good";
  if (condition === "fair") return "fair";
  if (
    ["poor", "critical", "damaged", "failed"].includes(
      condition
    )
  ) {
    return "danger";
  }

  return "neutral";
};

const statusText = (status) => {
  const labels = {
    scheduled: "Scheduled",
    in_progress: "In Progress",
    completed: "Completed",
    failed: "Failed",
    cancelled: "Cancelled",
    pending: "Pending",
  };

  return (
    labels[status] ||
    String(status || "Unknown")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
  );
};

const statusClass = (status) => {
  if (status === "completed") return "success";
  if (status === "scheduled" || status === "pending") {
    return "warning";
  }
  if (["failed", "cancelled"].includes(status)) {
    return "danger";
  }
  if (status === "in_progress") return "info";

  return "neutral";
};

const priorityClass = (priority) => {
  if (["critical", "urgent"].includes(priority)) {
    return "critical";
  }

  if (priority === "high") return "high";
  if (priority === "medium") return "medium";

  return "low";
};

export default function InfrastructureInspection() {
  const [rows, setRows] = useState([]);
  const [assets, setAssets] = useState([]);
  const [assetsLoading, setAssetsLoading] = useState(false);

  const [locations, setLocations] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [condition, setCondition] = useState("");
  const [priority, setPriority] = useState("");
  const [inspectionType, setInspectionType] = useState("");
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

  useEffect(() => {
    let active = true;

    const loadAssets = async () => {
      setAssetsLoading(true);
      try {
        const response = await api.get("/api/infrastructure/inspection/assets");
        const availableAssets = extractRows(response.data).filter((asset) => asset?.id);
        if (active) setAssets(availableAssets);
      } catch (err) {
        if (active) setError(err?.response?.data?.message || "Unable to load infrastructure assets.");
      } finally {
        if (active) setAssetsLoading(false);
      }
    };

    loadAssets();
    return () => {
      active = false;
    };
  }, []);

  const loadInspections = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get(
        "/api/infrastructure/inspection",
        {
          params: {
            page,
            limit: PAGE_SIZE,
            search: search.trim() || undefined,
            status: status || undefined,
            condition: condition || undefined,
            priority: priority || undefined,
            inspectionType:
              inspectionType || undefined,
            location: location || undefined,
          },
        }
      );

      const data = response.data;
      const extracted = extractRows(data);

      setRows(extracted);

      setPagination(
        extractPagination(
          data,
          page,
          extracted.length
        )
      );

      setLocations([
        ...new Set(
          extracted
            .map(locationOf)
            .filter(
              (item) => item && item !== "—"
            )
        ),
      ]);
    } catch (err) {
      setRows([]);

      setPagination({
        page: 1,
        total: 0,
        pages: 1,
      });

      setError(
        err?.response?.data?.message ||
          "Unable to load inspection records from the backend."
      );
    } finally {
      setLoading(false);
    }
  }, [
    page,
    search,
    status,
    condition,
    priority,
    inspectionType,
    location,
  ]);

  useEffect(() => {
    loadInspections();
  }, [loadInspections]);

  useEffect(() => {
    if (!success) return;

    const timer = setTimeout(
      () => setSuccess(""),
      3500
    );

    return () => clearTimeout(timer);
  }, [success]);

  const summary = useMemo(() => {
    const completed = rows.filter(
      (row) => statusOf(row) === "completed"
    ).length;

    const scheduled = rows.filter(
      (row) => statusOf(row) === "scheduled"
    ).length;

    const inProgress = rows.filter(
      (row) => statusOf(row) === "in_progress"
    ).length;

    const critical = rows.filter((row) =>
      ["critical", "damaged", "failed"].includes(
        conditionOf(row)
      )
    ).length;

    const unsafe = rows.filter(
      (row) =>
        ["unsafe", "dangerous", "failed"].includes(
          safetyStatusOf(row)
        )
    ).length;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const overdue = rows.filter((row) => {
      const next = nextInspectionDateOf(row);

      if (!next) return false;

      const date = new Date(next);

      if (Number.isNaN(date.getTime())) {
        return false;
      }

      return (
        date < today &&
        statusOf(row) !== "cancelled"
      );
    }).length;

    const dueSoon = rows.filter((row) => {
      const next = nextInspectionDateOf(row);

      if (!next) return false;

      const date = new Date(next);

      if (Number.isNaN(date.getTime())) {
        return false;
      }

      const days =
        (date.getTime() -
          today.getTime()) /
        (1000 * 60 * 60 * 24);

      return days >= 0 && days <= 30;
    }).length;

    return {
      total:
        pagination.total || rows.length,
      completed,
      scheduled,
      inProgress,
      critical,
      unsafe,
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
      inspectionNumber:
        inspectionNumberOf(row) === "—"
          ? ""
          : inspectionNumberOf(row),

      title:
        titleOf(row) === "Infrastructure Inspection"
          ? ""
          : titleOf(row),

      assetId: assetIdOf(row),

      assetName:
        assetNameOf(row) === "—"
          ? ""
          : assetNameOf(row),

      assetTag: assetTagOf(row),

      category:
        categoryOf(row) === "—"
          ? ""
          : categoryOf(row),

      location:
        locationOf(row) === "—"
          ? ""
          : locationOf(row),

      inspectionType:
        inspectionTypeOf(row),

      inspectionDate: inspectionDateOf(row)
        ? String(inspectionDateOf(row)).slice(0, 10)
        : "",

      nextInspectionDate:
        nextInspectionDateOf(row)
          ? String(
              nextInspectionDateOf(row)
            ).slice(0, 10)
          : "",

      inspector:
        inspectorOf(row) === "—"
          ? ""
          : inspectorOf(row),

      condition:
        conditionOf(row) || "good",

      status:
        statusOf(row) || "completed",

      priority:
        priorityOf(row) || "medium",

      safetyStatus:
        safetyStatusOf(row) || "safe",

      operationalStatus:
        operationalStatusOf(row) ||
        "operational",

      defects: defectsOf(row),
      findings: findingsOf(row),
      recommendations:
        recommendationsOf(row),

      correctiveAction:
        correctiveActionOf(row),

      estimatedCost:
        estimatedCostOf(row),

      actualCost:
        actualCostOf(row),

      photos: photosOf(row),
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

  const handleAssetChange = (event) => {
    const asset = assets.find((item) => String(item.id) === event.target.value);
    setForm((current) => ({
      ...current,
      assetId: event.target.value,
      assetName: asset?.name || "",
      assetTag: asset?.assetCode || "",
      category: asset?.category || "",
      location: asset?.location || asset?.building || "",
    }));
  };

  const saveInspection = async (event) => {
    event.preventDefault();

    if (!form.title.trim()) {
      setError("Inspection title is required.");
      return;
    }

    if (!form.assetId.trim() && !editing) {
      setError("Select an infrastructure asset from the asset list.");
      return;
    }

    if (!form.location.trim()) {
      setError("Inspection location is required.");
      return;
    }

    if (!form.inspectionDate) {
      setError("Inspection date is required.");
      return;
    }

    setSaving(true);
    setError("");

    const payload = {
      inspectionNumber:
        form.inspectionNumber.trim() || null,

      title:
        form.title.trim(),

      assetId:
        form.assetId.trim() || null,

      assetName:
        form.assetName.trim() || null,

      assetTag:
        form.assetTag.trim() || null,

      category:
        form.category.trim() || null,

      location:
        form.location.trim(),

      inspectionType:
        form.inspectionType,

      inspectionDate:
        form.inspectionDate,

      nextInspectionDate:
        form.nextInspectionDate || null,

      inspector:
        form.inspector.trim() || null,

      condition:
        form.condition,

      status:
        form.status,

      priority:
        form.priority,

      safetyStatus:
        form.safetyStatus,

      operationalStatus:
        form.operationalStatus,

      defects:
        form.defects.trim() || null,

      findings:
        form.findings.trim() || null,

      recommendations:
        form.recommendations.trim() || null,

      correctiveAction:
        form.correctiveAction.trim() || null,

      estimatedCost:
        form.estimatedCost || null,

      actualCost:
        form.actualCost || null,

      photos:
        form.photos.trim() || null,

      remarks:
        form.remarks.trim() || null,
    };

    try {
      if (editing) {
        const id = idOf(editing);

        if (!id) {
          throw new Error(
            "The selected inspection has no valid ID."
          );
        }

        await api.put(
          `/api/infrastructure/inspection/${id}`,
          payload
        );

        setSuccess(
          "Inspection record updated successfully."
        );
      } else {
        await api.post(
          "/api/infrastructure/inspection",
          payload
        );

        setSuccess(
          "Inspection record created successfully."
        );
      }

      setShowForm(false);
      setEditing(null);
      setForm(EMPTY_FORM);

      await loadInspections();
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Unable to save the inspection record."
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteInspection = async () => {
    const id = idOf(showDelete);

    if (!id) {
      setError(
        "The selected inspection has no valid ID."
      );
      return;
    }

    setDeleting(true);
    setError("");

    try {
      await api.delete(
        `/api/infrastructure/inspection/${id}`
      );

      setSuccess(
        "Inspection record deleted successfully."
      );

      setShowDelete(null);

      if (rows.length === 1 && page > 1) {
        setPage((current) => current - 1);
      } else {
        await loadInspections();
      }
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          "Unable to delete the inspection record."
      );
    } finally {
      setDeleting(false);
    }
  };

  const clearFilters = () => {
    setSearch("");
    setStatus("");
    setCondition("");
    setPriority("");
    setInspectionType("");
    setLocation("");
    setPage(1);
  };

  const hasFilters =
    search ||
    status ||
    condition ||
    priority ||
    inspectionType ||
    location;

  return (
    <div className="inspection-page">
      <style>{`
        * {
          box-sizing: border-box;
        }

        .inspection-page {
          min-height: 100vh;
          background: #f8fafc;
          color: #0f172a;
          padding: 24px;
          font-family: Inter, ui-sans-serif, system-ui,
            -apple-system, BlinkMacSystemFont, "Segoe UI",
            sans-serif;
        }

        .inspection-container {
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
          box-shadow: 0 10px 25px rgba(37, 99, 235, .20);
          flex-shrink: 0;
        }

        .page-title {
          margin: 0;
          font-size: 28px;
          font-weight: 800;
          letter-spacing: -.5px;
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
          transition: .2s ease;
        }

        .btn:hover:not(:disabled) {
          transform: translateY(-1px);
        }

        .btn:disabled {
          opacity: .55;
          cursor: not-allowed;
        }

        .btn-primary {
          color: white;
          background: #0ea5e9;
          box-shadow: 0 6px 16px rgba(14,165,233,.20);
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
          grid-template-columns: repeat(7, minmax(0,1fr));
          gap: 14px;
          margin-bottom: 22px;
        }

        .summary-card {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 17px;
          box-shadow: 0 4px 16px rgba(15,23,42,.04);
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
          letter-spacing: .5px;
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
          box-shadow: 0 4px 16px rgba(15,23,42,.04);
        }

        .filters-row {
          display: grid;
          grid-template-columns:
            minmax(230px,2fr)
            repeat(5,minmax(125px,1fr))
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
          box-shadow: 0 0 0 3px rgba(14,165,233,.10);
        }

        .table-card {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 4px 16px rgba(15,23,42,.04);
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
          min-width: 1550px;
          border-collapse: collapse;
        }

        th {
          background: #f8fafc;
          color: #64748b;
          padding: 13px 14px;
          text-align: left;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: .5px;
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

        .inspection-cell {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 250px;
        }

        .inspection-icon {
          width: 38px;
          height: 38px;
          display: grid;
          place-items: center;
          border-radius: 10px;
          color: #2563eb;
          background: #eff6ff;
          flex-shrink: 0;
        }

        .inspection-title {
          font-weight: 800;
        }

        .inspection-number {
          color: #64748b;
          font-size: 11px;
          margin-top: 2px;
        }

        .muted {
          color: #64748b;
        }

        .badge,
        .condition,
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

        .condition.excellent,
        .condition.good {
          color: #15803d;
          background: #ecfdf5;
        }

        .condition.fair {
          color: #a16207;
          background: #fffbeb;
        }

        .condition.danger {
          color: #b91c1c;
          background: #fef2f2;
        }

        .condition.neutral {
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

        .date-soon {
          color: #c2410c;
          font-weight: 800;
        }

        .date-overdue {
          color: #dc2626;
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
          opacity: .45;
          cursor: not-allowed;
        }

        .modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 1000;
          background: rgba(15,23,42,.58);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }

        .modal {
          width: min(1100px,100%);
          max-height: 92vh;
          overflow-y: auto;
          background: white;
          border-radius: 18px;
          box-shadow: 0 25px 70px rgba(15,23,42,.25);
        }

        .modal.small {
          width: min(470px,100%);
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
          grid-template-columns: repeat(3,minmax(0,1fr));
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
          letter-spacing: .4px;
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
            grid-template-columns: repeat(4,1fr);
          }

          .filters-row {
            grid-template-columns: repeat(4,1fr);
          }
        }

        @media (max-width: 900px) {
          .summary-grid,
          .form-grid,
          .details-grid {
            grid-template-columns: repeat(2,1fr);
          }

          .filters-row {
            grid-template-columns: repeat(2,1fr);
          }
        }

        @media (max-width: 650px) {
          .inspection-page {
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

      <div className="inspection-container">
        <header className="page-header">
          <div className="title-wrap">
            <div className="title-icon">
              <ClipboardCheck size={25} />
            </div>

            <div>
              <h1 className="page-title">
                Inspections &amp; Condition
              </h1>

              <p className="page-subtitle">
                Inspect infrastructure assets, record
                condition findings, identify defects,
                and track corrective actions.
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
              to="/infrastructure/preventive"
              className="btn btn-secondary"
            >
              Preventive Maintenance
            </Link>

            <Link
              to="/infrastructure/maintenance"
              className="btn btn-secondary"
            >
              Maintenance
            </Link>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={loadInspections}
              disabled={loading}
            >
              <RefreshCw
                size={16}
                className={
                  loading ? "spinner" : ""
                }
              />
              Refresh
            </button>

            <button
              type="button"
              className="btn btn-primary"
              onClick={openCreate}
            >
              <Plus size={17} />
              New Inspection
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
                  Total Inspections
                </div>

                <div className="summary-value">
                  {summary.total}
                </div>
              </div>

              <div className="summary-icon">
                <ClipboardCheck size={20} />
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

          <div className="summary-card warning">
            <div className="summary-top">
              <div>
                <div className="summary-label">
                  Scheduled
                </div>

                <div className="summary-value">
                  {summary.scheduled}
                </div>
              </div>

              <div className="summary-icon">
                <CalendarCheck2 size={20} />
              </div>
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-top">
              <div>
                <div className="summary-label">
                  In Progress
                </div>

                <div className="summary-value">
                  {summary.inProgress}
                </div>
              </div>

              <div className="summary-icon">
                <RefreshCw size={20} />
              </div>
            </div>
          </div>

          <div className="summary-card danger">
            <div className="summary-top">
              <div>
                <div className="summary-label">
                  Critical Condition
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

          <div className="summary-card danger">
            <div className="summary-top">
              <div>
                <div className="summary-label">
                  Unsafe
                </div>

                <div className="summary-value">
                  {summary.unsafe}
                </div>
              </div>

              <div className="summary-icon">
                <ShieldCheck size={20} />
              </div>
            </div>
          </div>

          <div className="summary-card warning">
            <div className="summary-top">
              <div>
                <div className="summary-label">
                  Due / Overdue
                </div>

                <div className="summary-value">
                  {summary.overdue +
                    summary.dueSoon}
                </div>
              </div>

              <div className="summary-icon">
                <CalendarCheck2 size={20} />
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
                placeholder="Search inspection, asset, inspector..."
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
              <option value="">
                All Statuses
              </option>
              <option value="scheduled">
                Scheduled
              </option>
              <option value="in_progress">
                In Progress
              </option>
              <option value="completed">
                Completed
              </option>
              <option value="failed">
                Failed
              </option>
              <option value="cancelled">
                Cancelled
              </option>
            </select>

            <select
              className="select"
              value={condition}
              onChange={(event) => {
                setCondition(event.target.value);
                setPage(1);
              }}
            >
              <option value="">
                All Conditions
              </option>
              <option value="excellent">
                Excellent
              </option>
              <option value="good">
                Good
              </option>
              <option value="fair">
                Fair
              </option>
              <option value="poor">
                Poor
              </option>
              <option value="critical">
                Critical
              </option>
              <option value="damaged">
                Damaged
              </option>
              <option value="failed">
                Failed
              </option>
            </select>

            <select
              className="select"
              value={priority}
              onChange={(event) => {
                setPriority(event.target.value);
                setPage(1);
              }}
            >
              <option value="">
                All Priorities
              </option>
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

            <select
              className="select"
              value={inspectionType}
              onChange={(event) => {
                setInspectionType(
                  event.target.value
                );
                setPage(1);
              }}
            >
              <option value="">
                All Types
              </option>
              <option value="Routine">
                Routine
              </option>
              <option value="Safety">
                Safety
              </option>
              <option value="Electrical">
                Electrical
              </option>
              <option value="Structural">
                Structural
              </option>
              <option value="Mechanical">
                Mechanical
              </option>
              <option value="Compliance">
                Compliance
              </option>
              <option value="Emergency">
                Emergency
              </option>
            </select>

            <select
              className="select"
              value={location}
              onChange={(event) => {
                setLocation(event.target.value);
                setPage(1);
              }}
            >
              <option value="">
                All Locations
              </option>

              {locations.map((item) => (
                <option
                  key={item}
                  value={item}
                >
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
                Inspection Records
              </h2>

              <div className="table-count">
                {pagination.total} inspection
                {pagination.total === 1
                  ? ""
                  : "s"}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="loading">
              <RefreshCw
                size={30}
                className="spinner"
              />

              <h3>
                Loading inspection records
              </h3>

              <p>
                Fetching current infrastructure
                inspection information from the
                backend.
              </p>
            </div>
          ) : rows.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">
                <ClipboardCheck size={28} />
              </div>

              <h3>
                No inspection records found
              </h3>

              <p>
                No inspection records match the
                selected filters, or no inspection
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
                  Create First Inspection
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Inspection</th>
                      <th>Asset</th>
                      <th>Location</th>
                      <th>Type</th>
                      <th>Condition</th>
                      <th>Status</th>
                      <th>Priority</th>
                      <th>Inspector</th>
                      <th>Inspection Date</th>
                      <th>Next Inspection</th>
                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {rows.map((row) => {
                      const id = idOf(row);
                      const nextDate =
                        nextInspectionDateOf(row);

                      let nextClass =
                        "date-normal";

                      if (nextDate) {
                        const next =
                          new Date(nextDate);
                        const today =
                          new Date();

                        today.setHours(
                          0,
                          0,
                          0,
                          0
                        );

                        if (
                          !Number.isNaN(
                            next.getTime()
                          )
                        ) {
                          const days =
                            (next.getTime() -
                              today.getTime()) /
                            (1000 *
                              60 *
                              60 *
                              24);

                          if (days < 0) {
                            nextClass =
                              "date-overdue";
                          } else if (
                            days <= 30
                          ) {
                            nextClass =
                              "date-soon";
                          }
                        }
                      }

                      return (
                        <tr
                          key={
                            id ||
                            `${inspectionNumberOf(
                              row
                            )}-${titleOf(row)}`
                          }
                        >
                          <td>
                            <div className="inspection-cell">
                              <div className="inspection-icon">
                                <ClipboardCheck
                                  size={18}
                                />
                              </div>

                              <div>
                                <div className="inspection-title">
                                  {titleOf(row)}
                                </div>

                                <div className="inspection-number">
                                  {
                                    inspectionNumberOf(
                                      row
                                    )
                                  }
                                </div>
                              </div>
                            </div>
                          </td>

                          <td>
                            <strong>
                              {assetNameOf(row)}
                            </strong>

                            {assetTagOf(row) && (
                              <div className="muted">
                                Tag:{" "}
                                {assetTagOf(row)}
                              </div>
                            )}
                          </td>

                          <td>
                            <div
                              style={{
                                display: "flex",
                                alignItems:
                                  "center",
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
                            {inspectionTypeOf(row)}
                          </td>

                          <td>
                            <span
                              className={`condition ${conditionClass(
                                conditionOf(row)
                              )}`}
                            >
                              {conditionText(
                                conditionOf(row)
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
                            <span
                              className={`priority ${priorityClass(
                                priorityOf(row)
                              )}`}
                            >
                              {priorityOf(row)
                                .charAt(0)
                                .toUpperCase() +
                                priorityOf(row).slice(
                                  1
                                )}
                            </span>
                          </td>

                          <td>
                            <div
                              style={{
                                display: "flex",
                                alignItems:
                                  "center",
                                gap: 5,
                              }}
                            >
                              <UserRound
                                size={13}
                                color="#64748b"
                              />
                              {inspectorOf(row)}
                            </div>
                          </td>

                          <td>
                            {formatDate(
                              inspectionDateOf(
                                row
                              )
                            )}
                          </td>

                          <td>
                            <span
                              className={
                                nextClass
                              }
                            >
                              {formatDate(
                                nextDate
                              )}
                            </span>
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
                                  setShowDelete(
                                    row
                                  )
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
                        Math.max(
                          1,
                          current - 1
                        )
                      )
                    }
                  >
                    <ChevronLeft size={16} />
                  </button>

                  <button
                    type="button"
                    className="page-btn"
                    disabled={
                      page >=
                      pagination.pages
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
            if (
              event.target ===
              event.currentTarget
            ) {
              setSelected(null);
            }
          }}
        >
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">
                Inspection Details
              </h2>

              <button
                type="button"
                className="close-btn"
                onClick={() =>
                  setSelected(null)
                }
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <div className="details-grid">
                <div className="detail">
                  <div className="detail-label">
                    Inspection
                  </div>

                  <div className="detail-value">
                    {titleOf(selected)}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">
                    Inspection Number
                  </div>

                  <div className="detail-value">
                    {inspectionNumberOf(
                      selected
                    )}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">
                    Inspection Type
                  </div>

                  <div className="detail-value">
                    {inspectionTypeOf(
                      selected
                    )}
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
                    Asset Tag
                  </div>

                  <div className="detail-value">
                    {assetTagOf(selected) || "—"}
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
                    Location
                  </div>

                  <div className="detail-value">
                    {locationOf(selected)}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">
                    Inspector
                  </div>

                  <div className="detail-value">
                    {inspectorOf(selected)}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">
                    Condition
                  </div>

                  <div className="detail-value">
                    {conditionText(
                      conditionOf(selected)
                    )}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">
                    Safety Status
                  </div>

                  <div className="detail-value">
                    {safetyStatusOf(
                      selected
                    )}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">
                    Operational Status
                  </div>

                  <div className="detail-value">
                    {operationalStatusOf(
                      selected
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
                    Priority
                  </div>

                  <div className="detail-value">
                    {priorityOf(selected)}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">
                    Inspection Date
                  </div>

                  <div className="detail-value">
                    {formatDate(
                      inspectionDateOf(
                        selected
                      )
                    )}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">
                    Next Inspection
                  </div>

                  <div className="detail-value">
                    {formatDate(
                      nextInspectionDateOf(
                        selected
                      )
                    )}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">
                    Estimated Cost
                  </div>

                  <div className="detail-value">
                    {formatMoney(
                      estimatedCostOf(
                        selected
                      )
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

              {defectsOf(selected) && (
                <div className="description-box">
                  <div className="detail-label">
                    Defects
                  </div>

                  <div className="detail-value">
                    {defectsOf(selected)}
                  </div>
                </div>
              )}

              {findingsOf(selected) && (
                <div className="description-box">
                  <div className="detail-label">
                    Inspection Findings
                  </div>

                  <div className="detail-value">
                    {findingsOf(selected)}
                  </div>
                </div>
              )}

              {recommendationsOf(selected) && (
                <div className="description-box">
                  <div className="detail-label">
                    Recommendations
                  </div>

                  <div className="detail-value">
                    {recommendationsOf(
                      selected
                    )}
                  </div>
                </div>
              )}

              {correctiveActionOf(selected) && (
                <div className="description-box">
                  <div className="detail-label">
                    Corrective Action
                  </div>

                  <div className="detail-value">
                    {correctiveActionOf(
                      selected
                    )}
                  </div>
                </div>
              )}

              {photosOf(selected) && (
                <div className="description-box">
                  <div className="detail-label">
                    Photos / Attachments
                  </div>

                  <div className="detail-value">
                    {photosOf(selected)}
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
            if (
              event.target ===
              event.currentTarget
            ) {
              setShowForm(false);
            }
          }}
        >
          <form
            className="modal"
            onSubmit={saveInspection}
          >
            <div className="modal-header">
              <h2 className="modal-title">
                {editing
                  ? "Edit Inspection Record"
                  : "Create Inspection Record"}
              </h2>

              <button
                type="button"
                className="close-btn"
                onClick={() =>
                  setShowForm(false)
                }
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <div className="form-grid">
                <div className="field">
                  <label>
                    Inspection Number
                  </label>

                  <input
                    className="input"
                    name="inspectionNumber"
                    value={
                      form.inspectionNumber
                    }
                    onChange={handleChange}
                    placeholder="INS-2026-001"
                  />
                </div>

                <div className="field">
                  <label>
                    Inspection Title{" "}
                    <span className="required">
                      *
                    </span>
                  </label>

                  <input
                    className="input"
                    name="title"
                    value={form.title}
                    onChange={handleChange}
                    placeholder="Generator safety inspection"
                    required
                  />
                </div>

                <div className="field">
                  <label>
                    Inspection Type
                  </label>

                  <select
                    className="select"
                    name="inspectionType"
                    value={
                      form.inspectionType
                    }
                    onChange={handleChange}
                  >
                    <option value="Routine">
                      Routine
                    </option>

                    <option value="Safety">
                      Safety
                    </option>

                    <option value="Electrical">
                      Electrical
                    </option>

                    <option value="Structural">
                      Structural
                    </option>

                    <option value="Mechanical">
                      Mechanical
                    </option>

                    <option value="Compliance">
                      Compliance
                    </option>

                    <option value="Emergency">
                      Emergency
                    </option>
                  </select>
                </div>

                <div className="field">
                  <label>
                    Infrastructure Asset{" "}
                    <span className="required">*</span>
                  </label>

                  <select
                    className="select"
                    name="assetId"
                    value={form.assetId}
                    onChange={handleAssetChange}
                    disabled={assetsLoading}
                    required={!editing}
                  >
                    <option value="">
                      {assetsLoading ? "Loading assets..." : "Select an infrastructure asset"}
                    </option>
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
                    readOnly
                  />
                </div>

                <div className="field">
                  <label>
                    Asset Tag
                  </label>

                  <input
                    className="input"
                    name="assetTag"
                    value={form.assetTag}
                    readOnly
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
                    readOnly
                  />
                </div>

                <div className="field">
                  <label>
                    Location{" "}
                    <span className="required">
                      *
                    </span>
                  </label>

                  <input
                    className="input"
                    name="location"
                    value={form.location}
                    readOnly
                    required
                  />
                </div>

                <div className="field">
                  <label>
                    Inspection Date{" "}
                    <span className="required">
                      *
                    </span>
                  </label>

                  <input
                    className="input"
                    type="date"
                    name="inspectionDate"
                    value={
                      form.inspectionDate
                    }
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="field">
                  <label>
                    Next Inspection Date
                  </label>

                  <input
                    className="input"
                    type="date"
                    name="nextInspectionDate"
                    value={
                      form.nextInspectionDate
                    }
                    onChange={handleChange}
                  />
                </div>

                <div className="field">
                  <label>
                    Inspector
                  </label>

                  <input
                    className="input"
                    name="inspector"
                    value={form.inspector}
                    onChange={handleChange}
                    placeholder="Inspector / technician"
                  />
                </div>

                <div className="field">
                  <label>
                    Condition
                  </label>

                  <select
                    className="select"
                    name="condition"
                    value={form.condition}
                    onChange={handleChange}
                  >
                    <option value="excellent">
                      Excellent
                    </option>

                    <option value="good">
                      Good
                    </option>

                    <option value="fair">
                      Fair
                    </option>

                    <option value="poor">
                      Poor
                    </option>

                    <option value="critical">
                      Critical
                    </option>

                    <option value="damaged">
                      Damaged
                    </option>

                    <option value="failed">
                      Failed
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
                    <option value="scheduled">
                      Scheduled
                    </option>

                    <option value="in_progress">
                      In Progress
                    </option>

                    <option value="completed">
                      Completed
                    </option>

                    <option value="failed">
                      Failed
                    </option>

                    <option value="cancelled">
                      Cancelled
                    </option>

                    <option value="pending">
                      Pending
                    </option>
                  </select>
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
                    Safety Status
                  </label>

                  <select
                    className="select"
                    name="safetyStatus"
                    value={form.safetyStatus}
                    onChange={handleChange}
                  >
                    <option value="safe">
                      Safe
                    </option>

                    <option value="unsafe">
                      Unsafe
                    </option>

                    <option value="restricted">
                      Restricted
                    </option>

                    <option value="dangerous">
                      Dangerous
                    </option>
                  </select>
                </div>

                <div className="field">
                  <label>
                    Operational Status
                  </label>

                  <select
                    className="select"
                    name="operationalStatus"
                    value={
                      form.operationalStatus
                    }
                    onChange={handleChange}
                  >
                    <option value="operational">
                      Operational
                    </option>

                    <option value="partially_operational">
                      Partially Operational
                    </option>

                    <option value="non_operational">
                      Non-Operational
                    </option>

                    <option value="out_of_service">
                      Out of Service
                    </option>
                  </select>
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
                    value={
                      form.estimatedCost
                    }
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

                <div className="field">
                  <label>
                    Photo / Attachment Reference
                  </label>

                  <input
                    className="input"
                    name="photos"
                    value={form.photos}
                    onChange={handleChange}
                    placeholder="File reference or attachment path"
                  />
                </div>

                <div className="field full">
                  <label>
                    Defects
                  </label>

                  <textarea
                    className="textarea"
                    name="defects"
                    value={form.defects}
                    onChange={handleChange}
                    placeholder="Record defects or damaged components..."
                  />
                </div>

                <div className="field full">
                  <label>
                    Inspection Findings
                  </label>

                  <textarea
                    className="textarea"
                    name="findings"
                    value={form.findings}
                    onChange={handleChange}
                    placeholder="Record inspection observations and measurements..."
                  />
                </div>

                <div className="field full">
                  <label>
                    Recommendations
                  </label>

                  <textarea
                    className="textarea"
                    name="recommendations"
                    value={
                      form.recommendations
                    }
                    onChange={handleChange}
                    placeholder="Recommended maintenance, replacement, repair or monitoring..."
                  />
                </div>

                <div className="field full">
                  <label>
                    Corrective Action
                  </label>

                  <textarea
                    className="textarea"
                    name="correctiveAction"
                    value={
                      form.correctiveAction
                    }
                    onChange={handleChange}
                    placeholder="Required corrective action..."
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
                    placeholder="Additional inspection notes..."
                  />
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() =>
                  setShowForm(false)
                }
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
                      ? "Update Inspection"
                      : "Create Inspection"}
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
            if (
              event.target ===
              event.currentTarget
            ) {
              setShowDelete(null);
            }
          }}
        >
          <div className="modal small">
            <div className="modal-header">
              <h2 className="modal-title">
                Delete Inspection
              </h2>

              <button
                type="button"
                className="close-btn"
                onClick={() =>
                  setShowDelete(null)
                }
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
                onClick={() =>
                  setShowDelete(null)
                }
                disabled={deleting}
              >
                Cancel
              </button>

              <button
                type="button"
                className="btn btn-danger"
                onClick={deleteInspection}
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