import React, { useEffect, useMemo, useState } from "react";
import { withMaintenanceAuth } from "./maintenanceAuth";

const API = "/api";

const EVENT_TYPES = {
  all: "All Events",
  request: "Maintenance Request",
  work_order: "Work Order",
  repair: "Repair",
  testing: "Technical Testing",
  quality_control: "Quality Control",
  preventive: "Preventive Maintenance",
  asset: "Asset",
  cost: "Cost",
  assignment: "Assignment",
  status: "Status Change",
};

const EMPTY_FILTERS = {
  search: "",
  eventType: "all",
  status: "all",
  dateFrom: "",
  dateTo: "",
};

function safeArray(data) {
  if (Array.isArray(data)) return data;

  if (Array.isArray(data?.data)) {
    return data.data;
  }

  if (Array.isArray(data?.rows)) {
    return data.rows;
  }

  if (Array.isArray(data?.items)) {
    return data.items;
  }

  if (Array.isArray(data?.history)) {
    return data.history;
  }

  if (Array.isArray(data?.events)) {
    return data.events;
  }

  if (Array.isArray(data?.maintenanceHistory)) {
    return data.maintenanceHistory;
  }

  return [];
}

function normalizeEvent(item, index) {
  const rawType =
    item.eventType ??
    item.event_type ??
    item.type ??
    item.entityType ??
    item.entity_type ??
    "status";

  const eventType = String(rawType)
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  const rawStatus =
    item.status ??
    item.newStatus ??
    item.new_status ??
    item.action ??
    "";

  const actor =
    item.actor ??
    item.user ??
    item.performedBy ??
    item.performed_by ??
    item.createdBy ??
    item.created_by ??
    {};

  const asset =
    item.asset ??
    {};

  const request =
    item.request ??
    {};

  const workOrder =
    item.workOrder ??
    item.work_order ??
    {};

  const repair =
    item.repair ??
    {};

  return {
    id:
      item.id ??
      item.historyId ??
      item.history_id ??
      `history-${index}`,

    eventType,

    eventTypeLabel:
      item.eventTypeLabel ??
      item.event_type_label ??
      EVENT_TYPES[eventType] ??
      String(eventType)
        .replace(/_/g, " ")
        .replace(/\b\w/g, (letter) =>
          letter.toUpperCase()
        ),

    action:
      item.action ??
      item.event ??
      item.description ??
      item.message ??
      "",

    title:
      item.title ??
      item.name ??
      item.subject ??
      "",

    description:
      item.description ??
      item.details ??
      item.message ??
      "",

    status: String(rawStatus || "")
      .toLowerCase()
      .replace(/[\s-]+/g, "_"),

    oldStatus:
      item.oldStatus ??
      item.old_status ??
      item.previousStatus ??
      item.previous_status ??
      "",

    newStatus:
      item.newStatus ??
      item.new_status ??
      "",

    entityId:
      item.entityId ??
      item.entity_id ??
      item.referenceId ??
      item.reference_id ??
      "",

    requestId:
      item.requestId ??
      item.request_id ??
      request.id ??
      "",

    requestNumber:
      item.requestNumber ??
      item.request_number ??
      request.requestNumber ??
      request.request_number ??
      "",

    workOrderId:
      item.workOrderId ??
      item.work_order_id ??
      workOrder.id ??
      "",

    workOrderNumber:
      item.workOrderNumber ??
      item.work_order_number ??
      workOrder.workOrderNumber ??
      workOrder.work_order_number ??
      "",

    repairId:
      item.repairId ??
      item.repair_id ??
      repair.id ??
      "",

    repairNumber:
      item.repairNumber ??
      item.repair_number ??
      repair.repairNumber ??
      repair.repair_number ??
      "",

    assetId:
      item.assetId ??
      item.asset_id ??
      asset.id ??
      "",

    assetCode:
      item.assetCode ??
      item.asset_code ??
      asset.assetCode ??
      asset.asset_code ??
      asset.code ??
      "",

    assetName:
      item.assetName ??
      item.asset_name ??
      asset.name ??
      asset.assetName ??
      "",

    userId:
      item.userId ??
      item.user_id ??
      actor.id ??
      "",

    userName:
      item.userName ??
      item.user_name ??
      actor.name ??
      actor.fullName ??
      actor.full_name ??
      actor.username ??
      "",

    department:
      item.department ??
      actor.department ??
      "",

    cost:
      item.cost ??
      item.amount ??
      item.totalCost ??
      item.total_cost ??
      null,

    timestamp:
      item.timestamp ??
      item.eventDate ??
      item.event_date ??
      item.createdAt ??
      item.created_at ??
      item.updatedAt ??
      item.updated_at ??
      null,

    metadata:
      item.metadata ??
      item.meta ??
      {},

    source: item,
  };
}

function normalizeText(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function formatDateTime(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString();
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString();
}

function formatCurrency(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return String(value);
  }

  return amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function statusLabel(status) {
  if (!status) return "—";

  return String(status)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}

function statusClass(status) {
  const value = normalizeText(status);

  if (
    [
      "completed",
      "approved",
      "active",
      "passed",
      "closed",
      "resolved",
    ].includes(value)
  ) {
    return "status-green";
  }

  if (
    [
      "rejected",
      "cancelled",
      "canceled",
      "failed",
      "declined",
    ].includes(value)
  ) {
    return "status-red";
  }

  if (
    [
      "pending",
      "requested",
      "open",
      "in_review",
      "under_review",
    ].includes(value)
  ) {
    return "status-orange";
  }

  if (
    [
      "in_progress",
      "assigned",
      "scheduled",
      "started",
    ].includes(value)
  ) {
    return "status-blue";
  }

  return "status-gray";
}

function eventIcon(eventType) {
  switch (eventType) {
    case "request":
    case "maintenance_request":
      return "RQ";

    case "work_order":
      return "WO";

    case "repair":
      return "RP";

    case "testing":
    case "technical_testing":
      return "TT";

    case "quality_control":
    case "qc":
      return "QC";

    case "preventive":
    case "preventive_maintenance":
      return "PM";

    case "asset":
      return "AS";

    case "cost":
      return "$";

    case "assignment":
      return "AT";

    default:
      return "HS";
  }
}

function eventColorClass(eventType) {
  switch (eventType) {
    case "request":
    case "maintenance_request":
      return "event-request";

    case "work_order":
      return "event-work-order";

    case "repair":
      return "event-repair";

    case "testing":
    case "technical_testing":
      return "event-testing";

    case "quality_control":
    case "qc":
      return "event-qc";

    case "preventive":
    case "preventive_maintenance":
      return "event-preventive";

    case "cost":
      return "event-cost";

    default:
      return "event-default";
  }
}

function dateOnly(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");
  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export default function History() {
  const [events, setEvents] = useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [selectedEvent, setSelectedEvent] =
    useState(null);

  const [filters, setFilters] =
    useState(EMPTY_FILTERS);

  const [page, setPage] = useState(1);

  const [pageSize, setPageSize] =
    useState(25);

  const [expanded, setExpanded] =
    useState({});

  async function fetchJson(
    url,
    options = {}
  ) {
    const response = await fetch(url, {
      ...options,
      headers: withMaintenanceAuth({
        "Content-Type": "application/json",
        ...(options.headers || {}),
      }),
    });

    let data = null;

    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      throw new Error(
        data?.message ||
          data?.error ||
          `Request failed: ${response.status}`
      );
    }

    return data;
  }

  async function loadHistory() {
    setLoading(true);
    setError("");

    try {
      const data = await fetchJson(
        `${API}/maintenance/history`
      );

      const normalized = safeArray(data)
        .map(normalizeEvent)
        .sort((a, b) => {
          const dateA = new Date(
            a.timestamp || 0
          ).getTime();

          const dateB = new Date(
            b.timestamp || 0
          ).getTime();

          return dateB - dateA;
        });

      setEvents(normalized);
    } catch (err) {
      setError(
        err.message ||
          "Unable to load maintenance history."
      );

      setEvents([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadHistory();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [
    filters.search,
    filters.eventType,
    filters.status,
    filters.dateFrom,
    filters.dateTo,
  ]);

  const eventTypes = useMemo(() => {
    const types = new Set();

    events.forEach((event) => {
      if (event.eventType) {
        types.add(event.eventType);
      }
    });

    return Array.from(types).sort(
      (a, b) =>
        String(
          EVENT_TYPES[a] || a
        ).localeCompare(
          String(EVENT_TYPES[b] || b)
        )
    );
  }, [events]);

  const filteredEvents = useMemo(() => {
    const query =
      normalizeText(filters.search);

    return events.filter((event) => {
      const searchable = [
        event.eventTypeLabel,
        event.action,
        event.title,
        event.description,
        event.status,
        event.oldStatus,
        event.newStatus,
        event.requestNumber,
        event.workOrderNumber,
        event.repairNumber,
        event.assetCode,
        event.assetName,
        event.userName,
        event.department,
        event.entityId,
      ]
        .filter(Boolean)
        .join(" ");

      const searchMatch =
        !query ||
        normalizeText(
          searchable
        ).includes(query);

      const typeMatch =
        filters.eventType === "all" ||
        event.eventType ===
          filters.eventType;

      const statusMatch =
        filters.status === "all" ||
        normalizeText(
          event.status
        ) ===
          normalizeText(
            filters.status
          );

      const eventDate =
        dateOnly(event.timestamp);

      const fromMatch =
        !filters.dateFrom ||
        (eventDate &&
          eventDate >=
            filters.dateFrom);

      const toMatch =
        !filters.dateTo ||
        (eventDate &&
          eventDate <=
            filters.dateTo);

      return (
        searchMatch &&
        typeMatch &&
        statusMatch &&
        fromMatch &&
        toMatch
      );
    });
  }, [events, filters]);

  const summary = useMemo(() => {
    const total = events.length;

    const today = new Date();

    const todayKey = dateOnly(
      today
    );

    const todayCount = events.filter(
      (event) =>
        dateOnly(
          event.timestamp
        ) === todayKey
    ).length;

    const requestCount =
      events.filter(
        (event) =>
          event.eventType ===
            "request" ||
          event.eventType ===
            "maintenance_request"
      ).length;

    const workOrderCount =
      events.filter(
        (event) =>
          event.eventType ===
          "work_order"
      ).length;

    const repairCount =
      events.filter(
        (event) =>
          event.eventType ===
          "repair"
      ).length;

    const testingCount =
      events.filter(
        (event) =>
          event.eventType ===
            "testing" ||
          event.eventType ===
            "technical_testing"
      ).length;

    const qcCount =
      events.filter(
        (event) =>
          event.eventType ===
            "quality_control" ||
          event.eventType === "qc"
      ).length;

    const costEvents =
      events.filter(
        (event) =>
          event.cost !== null &&
          event.cost !== undefined &&
          event.cost !== ""
      );

    const totalCost =
      costEvents.reduce(
        (sum, event) =>
          sum +
          (Number(event.cost) || 0),
        0
      );

    return {
      total,
      todayCount,
      requestCount,
      workOrderCount,
      repairCount,
      testingCount,
      qcCount,
      totalCost,
    };
  }, [events]);

  const totalPages = Math.max(
    1,
    Math.ceil(
      filteredEvents.length /
        pageSize
    )
  );

  const safePage = Math.min(
    page,
    totalPages
  );

  const paginatedEvents =
    useMemo(() => {
      const start =
        (safePage - 1) *
        pageSize;

      return filteredEvents.slice(
        start,
        start + pageSize
      );
    }, [
      filteredEvents,
      safePage,
      pageSize,
    ]);

  function updateFilter(
    field,
    value
  ) {
    setFilters((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  function clearFilters() {
    setFilters(
      EMPTY_FILTERS
    );
    setPage(1);
  }

  function toggleExpanded(id) {
    setExpanded((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }

  function exportCsv() {
    if (
      filteredEvents.length === 0
    ) {
      return;
    }

    const headers = [
      "ID",
      "Event Type",
      "Action",
      "Status",
      "Old Status",
      "New Status",
      "Request",
      "Work Order",
      "Repair",
      "Asset Code",
      "Asset Name",
      "User",
      "Department",
      "Cost",
      "Timestamp",
    ];

    const rows =
      filteredEvents.map(
        (event) => [
          event.id,
          event.eventTypeLabel,
          event.action ||
            event.title ||
            "",
          event.status || "",
          event.oldStatus || "",
          event.newStatus || "",
          event.requestNumber ||
            event.requestId ||
            "",
          event.workOrderNumber ||
            event.workOrderId ||
            "",
          event.repairNumber ||
            event.repairId ||
            "",
          event.assetCode || "",
          event.assetName || "",
          event.userName || "",
          event.department || "",
          event.cost ?? "",
          event.timestamp || "",
        ]
      );

    const csv = [
      headers,
      ...rows,
    ]
      .map((row) =>
        row
          .map((value) => {
            const text =
              value === null ||
              value === undefined
                ? ""
                : String(value);

            return `"${text.replace(
              /"/g,
              '""'
            )}"`;
          })
          .join(",")
      )
      .join("\n");

    const blob =
      new Blob([csv], {
        type: "text/csv;charset=utf-8;",
      });

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement("a");

    link.href = url;
    link.download = `maintenance-history-${dateOnly(
      new Date()
    )}.csv`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }

  function renderReference(event) {
    if (
      event.workOrderNumber ||
      event.workOrderId
    ) {
      return (
        event.workOrderNumber ||
        `WO-${event.workOrderId}`
      );
    }

    if (
      event.requestNumber ||
      event.requestId
    ) {
      return (
        event.requestNumber ||
        `REQ-${event.requestId}`
      );
    }

    if (
      event.repairNumber ||
      event.repairId
    ) {
      return (
        event.repairNumber ||
        `RP-${event.repairId}`
      );
    }

    if (event.entityId) {
      return `#${event.entityId}`;
    }

    return "—";
  }

  return (
    <div className="history-page">
      <style>{`
        * {
          box-sizing: border-box;
        }

        .history-page {
          min-height: 100vh;
          background: #f6f8fb;
          color: #172033;
          padding: 24px;
          font-family:
            Inter,
            ui-sans-serif,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
        }

        .history-container {
          max-width: 1500px;
          margin: 0 auto;
        }

        .page-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 20px;
        }

        .page-title {
          margin: 0;
          font-size: 28px;
          font-weight: 780;
          letter-spacing: -0.5px;
        }

        .page-subtitle {
          margin: 7px 0 0;
          color: #667085;
          font-size: 14px;
          line-height: 1.5;
        }

        .header-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .btn {
          border: 1px solid #d7dce5;
          background: white;
          color: #344054;
          border-radius: 9px;
          padding: 9px 13px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }

        .btn:hover {
          background: #f2f4f7;
        }

        .btn-primary {
          background: #2563eb;
          border-color: #2563eb;
          color: white;
        }

        .btn-primary:hover {
          background: #1d4ed8;
        }

        .summary-grid {
          display: grid;
          grid-template-columns:
            repeat(7, minmax(0, 1fr));
          gap: 11px;
          margin-bottom: 16px;
        }

        .summary-card {
          background: white;
          border: 1px solid #e3e7ee;
          border-radius: 11px;
          padding: 14px;
          box-shadow:
            0 2px 7px
            rgba(16, 24, 40, 0.03);
        }

        .summary-label {
          color: #667085;
          font-size: 9px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: .4px;
        }

        .summary-value {
          margin-top: 7px;
          font-size: 22px;
          font-weight: 780;
          color: #1d2939;
        }

        .summary-note {
          margin-top: 3px;
          color: #98a2b3;
          font-size: 9px;
        }

        .alert {
          margin-bottom: 14px;
          padding: 10px 12px;
          background: #fff7ed;
          border: 1px solid #fed7aa;
          border-radius: 9px;
          color: #9a3412;
          font-size: 12px;
        }

        .filters-card {
          background: white;
          border: 1px solid #e3e7ee;
          border-radius: 12px;
          padding: 13px;
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          gap: 9px;
          flex-wrap: wrap;
        }

        .search-box {
          flex: 1 1 320px;
          min-width: 250px;
        }

        .input,
        .select {
          width: 100%;
          border: 1px solid #d7dce5;
          border-radius: 8px;
          padding: 9px 10px;
          background: white;
          color: #344054;
          font-size: 12px;
          outline: none;
        }

        .input:focus,
        .select:focus {
          border-color: #2563eb;
          box-shadow:
            0 0 0 3px
            rgba(37, 99, 235, .09);
        }

        .filter-select {
          min-width: 145px;
        }

        .date-filter {
          width: 145px;
        }

        .history-card {
          background: white;
          border: 1px solid #e3e7ee;
          border-radius: 12px;
          overflow: hidden;
          box-shadow:
            0 2px 7px
            rgba(16, 24, 40, 0.03);
        }

        .card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          padding: 14px 17px;
          border-bottom: 1px solid #edf0f4;
        }

        .card-title {
          margin: 0;
          font-size: 15px;
          font-weight: 760;
        }

        .result-count {
          color: #667085;
          font-size: 11px;
        }

        .table-wrapper {
          overflow-x: auto;
        }

        table {
          width: 100%;
          min-width: 1250px;
          border-collapse: collapse;
        }

        th {
          text-align: left;
          padding: 11px 13px;
          background: #fafbfc;
          border-bottom: 1px solid #e8ebf0;
          color: #667085;
          font-size: 9px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: .4px;
          white-space: nowrap;
        }

        td {
          padding: 11px 13px;
          border-bottom: 1px solid #edf0f4;
          color: #475467;
          font-size: 11px;
          vertical-align: middle;
        }

        tbody tr:hover {
          background: #fafcff;
        }

        .event-cell {
          display: flex;
          align-items: center;
          gap: 9px;
          min-width: 225px;
        }

        .event-icon {
          width: 35px;
          height: 35px;
          border-radius: 9px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          font-size: 9px;
          font-weight: 850;
        }

        .event-request {
          background: #eff6ff;
          color: #2563eb;
        }

        .event-work-order {
          background: #f5f3ff;
          color: #7c3aed;
        }

        .event-repair {
          background: #fff7ed;
          color: #ea580c;
        }

        .event-testing {
          background: #ecfeff;
          color: #0891b2;
        }

        .event-qc {
          background: #f0fdf4;
          color: #15803d;
        }

        .event-preventive {
          background: #fdf4ff;
          color: #a21caf;
        }

        .event-cost {
          background: #f0fdf4;
          color: #166534;
        }

        .event-default {
          background: #f2f4f7;
          color: #475467;
        }

        .event-title {
          color: #344054;
          font-weight: 720;
          font-size: 11px;
        }

        .event-subtitle {
          margin-top: 3px;
          color: #98a2b3;
          font-size: 9px;
        }

        .asset-main {
          color: #344054;
          font-weight: 700;
        }

        .asset-sub {
          margin-top: 3px;
          color: #98a2b3;
          font-size: 9px;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          padding: 4px 8px;
          font-size: 9px;
          font-weight: 800;
          white-space: nowrap;
        }

        .status-green {
          background: #dcfce7;
          color: #166534;
        }

        .status-red {
          background: #fee2e2;
          color: #b91c1c;
        }

        .status-orange {
          background: #ffedd5;
          color: #c2410c;
        }

        .status-blue {
          background: #dbeafe;
          color: #1d4ed8;
        }

        .status-gray {
          background: #f2f4f7;
          color: #475467;
        }

        .transition {
          display: flex;
          align-items: center;
          gap: 5px;
          white-space: nowrap;
        }

        .transition-arrow {
          color: #98a2b3;
        }

        .reference {
          color: #2563eb;
          font-weight: 700;
        }

        .cost {
          color: #15803d;
          font-weight: 750;
        }

        .timestamp {
          white-space: nowrap;
          color: #667085;
        }

        .action-button {
          border: 1px solid #d7dce5;
          background: white;
          color: #475467;
          border-radius: 7px;
          padding: 6px 8px;
          cursor: pointer;
          font-size: 10px;
          font-weight: 700;
        }

        .action-button:hover {
          background: #f2f4f7;
        }

        .loading,
        .empty {
          padding: 55px 20px;
          text-align: center;
          color: #98a2b3;
          font-size: 12px;
        }

        .pagination {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 12px 15px;
          border-top: 1px solid #edf0f4;
          flex-wrap: wrap;
        }

        .pagination-info {
          color: #667085;
          font-size: 10px;
        }

        .pagination-actions {
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .page-btn {
          min-width: 30px;
          height: 30px;
          border: 1px solid #d7dce5;
          border-radius: 7px;
          background: white;
          color: #475467;
          cursor: pointer;
          font-size: 10px;
          font-weight: 700;
        }

        .page-btn:hover:not(:disabled) {
          background: #f2f4f7;
        }

        .page-btn:disabled {
          opacity: .45;
          cursor: not-allowed;
        }

        .page-size {
          width: 75px;
          height: 30px;
          padding: 5px 7px;
          font-size: 10px;
        }

        .modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 1000;
          background: rgba(15, 23, 42, .48);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }

        .modal {
          width: min(820px, 100%);
          max-height: 92vh;
          overflow-y: auto;
          background: white;
          border-radius: 14px;
          box-shadow:
            0 20px 60px
            rgba(15, 23, 42, .25);
        }

        .modal-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 15px;
          padding: 18px 20px;
          border-bottom: 1px solid #edf0f4;
        }

        .modal-title {
          margin: 0;
          color: #1d2939;
          font-size: 18px;
          font-weight: 780;
        }

        .modal-subtitle {
          margin-top: 5px;
          color: #667085;
          font-size: 11px;
        }

        .close-button {
          width: 32px;
          height: 32px;
          border: none;
          border-radius: 8px;
          background: #f2f4f7;
          color: #475467;
          cursor: pointer;
          font-size: 18px;
        }

        .modal-body {
          padding: 20px;
        }

        .detail-top {
          display: flex;
          align-items: center;
          gap: 13px;
          margin-bottom: 18px;
        }

        .detail-icon {
          width: 54px;
          height: 54px;
          border-radius: 11px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 850;
        }

        .detail-title {
          margin: 0;
          font-size: 17px;
          font-weight: 760;
        }

        .detail-subtitle {
          margin-top: 4px;
          color: #667085;
          font-size: 10px;
        }

        .detail-grid {
          display: grid;
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .detail-item {
          background: #fafbfc;
          border: 1px solid #edf0f4;
          border-radius: 9px;
          padding: 11px;
        }

        .detail-label {
          color: #98a2b3;
          font-size: 8px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: .4px;
        }

        .detail-value {
          margin-top: 5px;
          color: #344054;
          font-size: 11px;
          font-weight: 650;
          word-break: break-word;
        }

        .description-box {
          margin-top: 12px;
          padding: 12px;
          background: #fafbfc;
          border: 1px solid #edf0f4;
          border-radius: 9px;
        }

        .description-label {
          color: #667085;
          font-size: 9px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: .3px;
        }

        .description {
          margin-top: 6px;
          color: #475467;
          font-size: 11px;
          line-height: 1.6;
          white-space: pre-wrap;
        }

        .metadata {
          margin-top: 12px;
          padding: 12px;
          background: #111827;
          color: #d1d5db;
          border-radius: 9px;
          overflow: auto;
          font-family:
            ui-monospace,
            SFMono-Regular,
            Menlo,
            Monaco,
            Consolas,
            monospace;
          font-size: 10px;
          line-height: 1.5;
        }

        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          padding: 14px 20px;
          border-top: 1px solid #edf0f4;
        }

        .timeline {
          position: relative;
        }

        .timeline-item {
          display: flex;
          gap: 12px;
          padding-bottom: 17px;
          position: relative;
        }

        .timeline-line {
          position: absolute;
          left: 16px;
          top: 34px;
          bottom: 0;
          width: 1px;
          background: #e4e7ec;
        }

        .timeline-item:last-child .timeline-line {
          display: none;
        }

        .timeline-dot {
          width: 33px;
          height: 33px;
          flex-shrink: 0;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 8px;
          font-weight: 850;
          z-index: 1;
        }

        .timeline-content {
          flex: 1;
          padding: 2px 0;
        }

        .timeline-title {
          color: #344054;
          font-size: 11px;
          font-weight: 720;
        }

        .timeline-date {
          margin-top: 3px;
          color: #98a2b3;
          font-size: 9px;
        }

        .timeline-description {
          margin-top: 5px;
          color: #667085;
          font-size: 10px;
          line-height: 1.5;
        }

        @media (max-width: 1300px) {
          .summary-grid {
            grid-template-columns:
              repeat(4, minmax(0, 1fr));
          }
        }

        @media (max-width: 900px) {
          .history-page {
            padding: 15px;
          }

          .page-header {
            flex-direction: column;
          }

          .summary-grid {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }

          .detail-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 560px) {
          .summary-grid {
            grid-template-columns: 1fr;
          }

          .search-box,
          .filter-select,
          .date-filter {
            width: 100%;
            min-width: 100%;
          }

          .header-actions {
            width: 100%;
          }

          .header-actions .btn {
            flex: 1;
          }
        }
      `}</style>

      <div className="history-container">
        <div className="page-header">
          <div>
            <h1 className="page-title">
              Maintenance History
            </h1>

            <p className="page-subtitle">
              Central audit trail for maintenance
              requests, work orders, repairs,
              testing, quality control and asset
              lifecycle activity.
            </p>
          </div>

          <div className="header-actions">
            <button
              className="btn"
              onClick={loadHistory}
              disabled={loading}
            >
              ↻ Refresh
            </button>

            <button
              className="btn btn-primary"
              onClick={exportCsv}
              disabled={
                filteredEvents.length === 0
              }
            >
              ↓ Export CSV
            </button>
          </div>
        </div>

        {error && (
          <div className="alert">
            {error}
          </div>
        )}

        <div className="summary-grid">
          <div className="summary-card">
            <div className="summary-label">
              Total Events
            </div>

            <div className="summary-value">
              {summary.total}
            </div>

            <div className="summary-note">
              Complete history
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-label">
              Today
            </div>

            <div className="summary-value">
              {summary.todayCount}
            </div>

            <div className="summary-note">
              Events today
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-label">
              Requests
            </div>

            <div className="summary-value">
              {summary.requestCount}
            </div>

            <div className="summary-note">
              Request activity
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-label">
              Work Orders
            </div>

            <div className="summary-value">
              {summary.workOrderCount}
            </div>

            <div className="summary-note">
              Work order activity
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-label">
              Repairs
            </div>

            <div className="summary-value">
              {summary.repairCount}
            </div>

            <div className="summary-note">
              Repair activity
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-label">
              Testing / QC
            </div>

            <div className="summary-value">
              {summary.testingCount +
                summary.qcCount}
            </div>

            <div className="summary-note">
              Verification activity
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-label">
              Recorded Cost
            </div>

            <div className="summary-value">
              {formatCurrency(
                summary.totalCost
              )}
            </div>

            <div className="summary-note">
              Cost-tagged history
            </div>
          </div>
        </div>

        <div className="filters-card">
          <div className="search-box">
            <input
              className="input"
              value={filters.search}
              onChange={(event) =>
                updateFilter(
                  "search",
                  event.target.value
                )
              }
              placeholder="Search history, asset, work order, request, user..."
            />
          </div>

          <select
            className="select filter-select"
            value={filters.eventType}
            onChange={(event) =>
              updateFilter(
                "eventType",
                event.target.value
              )
            }
          >
            <option value="all">
              All Event Types
            </option>

            {eventTypes.map((type) => (
              <option
                key={type}
                value={type}
              >
                {EVENT_TYPES[type] ||
                  type
                    .replace(/_/g, " ")
                    .replace(
                      /\b\w/g,
                      (letter) =>
                        letter.toUpperCase()
                    )}
              </option>
            ))}
          </select>

          <select
            className="select filter-select"
            value={filters.status}
            onChange={(event) =>
              updateFilter(
                "status",
                event.target.value
              )
            }
          >
            <option value="all">
              All Statuses
            </option>

            <option value="pending">
              Pending
            </option>

            <option value="requested">
              Requested
            </option>

            <option value="assigned">
              Assigned
            </option>

            <option value="in_progress">
              In Progress
            </option>

            <option value="completed">
              Completed
            </option>

            <option value="approved">
              Approved
            </option>

            <option value="rejected">
              Rejected
            </option>

            <option value="cancelled">
              Cancelled
            </option>

            <option value="failed">
              Failed
            </option>
          </select>

          <input
            className="input date-filter"
            type="date"
            value={filters.dateFrom}
            onChange={(event) =>
              updateFilter(
                "dateFrom",
                event.target.value
              )
            }
            title="From date"
          />

          <input
            className="input date-filter"
            type="date"
            value={filters.dateTo}
            onChange={(event) =>
              updateFilter(
                "dateTo",
                event.target.value
              )
            }
            title="To date"
          />

          <button
            className="btn"
            onClick={clearFilters}
          >
            Clear
          </button>
        </div>

        <div className="history-card">
          <div className="card-header">
            <h2 className="card-title">
              Activity Timeline
            </h2>

            <div className="result-count">
              {filteredEvents.length} event
              {filteredEvents.length !== 1
                ? "s"
                : ""}
            </div>
          </div>

          {loading ? (
            <div className="loading">
              Loading maintenance history...
            </div>
          ) : paginatedEvents.length ===
            0 ? (
            <div className="empty">
              No maintenance history found
              for the selected filters.
            </div>
          ) : (
            <>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Event</th>
                      <th>Action</th>
                      <th>Status</th>
                      <th>Reference</th>
                      <th>Asset</th>
                      <th>User</th>
                      <th>Cost</th>
                      <th>Date / Time</th>
                      <th />
                    </tr>
                  </thead>

                  <tbody>
                    {paginatedEvents.map(
                      (event) => (
                        <tr key={event.id}>
                          <td>
                            <div className="event-cell">
                              <div
                                className={`event-icon ${eventColorClass(
                                  event.eventType
                                )}`}
                              >
                                {eventIcon(
                                  event.eventType
                                )}
                              </div>

                              <div>
                                <div className="event-title">
                                  {event.eventTypeLabel}
                                </div>

                                <div className="event-subtitle">
                                  Event #
                                  {event.id}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td>
                            <div>
                              {event.action ||
                                event.title ||
                                "Activity recorded"}
                            </div>

                            {event.description &&
                              event.description !==
                                event.action && (
                                <div
                                  style={{
                                    marginTop:
                                      "3px",
                                    color:
                                      "#98a2b3",
                                    fontSize:
                                      "9px",
                                    maxWidth:
                                      "270px",
                                    overflow:
                                      "hidden",
                                    textOverflow:
                                      "ellipsis",
                                    whiteSpace:
                                      "nowrap",
                                  }}
                                >
                                  {
                                    event.description
                                  }
                                </div>
                              )}
                          </td>

                          <td>
                            {event.oldStatus ||
                            event.newStatus ? (
                              <div className="transition">
                                <span
                                  className={`status-badge ${statusClass(
                                    event.oldStatus
                                  )}`}
                                >
                                  {statusLabel(
                                    event.oldStatus
                                  )}
                                </span>

                                <span className="transition-arrow">
                                  →
                                </span>

                                <span
                                  className={`status-badge ${statusClass(
                                    event.newStatus ||
                                      event.status
                                  )}`}
                                >
                                  {statusLabel(
                                    event.newStatus ||
                                      event.status
                                  )}
                                </span>
                              </div>
                            ) : event.status ? (
                              <span
                                className={`status-badge ${statusClass(
                                  event.status
                                )}`}
                              >
                                {statusLabel(
                                  event.status
                                )}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>

                          <td>
                            <span className="reference">
                              {renderReference(
                                event
                              )}
                            </span>
                          </td>

                          <td>
                            <div className="asset-main">
                              {event.assetCode ||
                                event.assetName ||
                                "—"}
                            </div>

                            {event.assetCode &&
                              event.assetName && (
                                <div className="asset-sub">
                                  {
                                    event.assetName
                                  }
                                </div>
                              )}
                          </td>

                          <td>
                            {event.userName ||
                              (event.userId
                                ? `User #${event.userId}`
                                : "System")}
                          </td>

                          <td>
                            {event.cost !==
                              null &&
                            event.cost !==
                              undefined &&
                            event.cost !==
                              "" ? (
                              <span className="cost">
                                {formatCurrency(
                                  event.cost
                                )}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>

                          <td>
                            <span className="timestamp">
                              {formatDateTime(
                                event.timestamp
                              )}
                            </span>
                          </td>

                          <td>
                            <button
                              className="action-button"
                              onClick={() =>
                                setSelectedEvent(
                                  event
                                )
                              }
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>

              <div className="pagination">
                <div className="pagination-info">
                  Showing{" "}
                  {filteredEvents.length ===
                  0
                    ? 0
                    : (safePage - 1) *
                        pageSize +
                      1}{" "}
                  to{" "}
                  {Math.min(
                    safePage *
                      pageSize,
                    filteredEvents.length
                  )}{" "}
                  of{" "}
                  {filteredEvents.length}
                </div>

                <div className="pagination-actions">
                  <select
                    className="select page-size"
                    value={pageSize}
                    onChange={(event) => {
                      setPageSize(
                        Number(
                          event.target.value
                        )
                      );
                      setPage(1);
                    }}
                  >
                    <option value={10}>
                      10
                    </option>

                    <option value={25}>
                      25
                    </option>

                    <option value={50}>
                      50
                    </option>

                    <option value={100}>
                      100
                    </option>
                  </select>

                  <button
                    className="page-btn"
                    disabled={
                      safePage <= 1
                    }
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
                    ‹
                  </button>

                  <button
                    className="page-btn"
                    disabled={
                      safePage >=
                      totalPages
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
                    ›
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {selectedEvent && (
        <div
          className="modal-overlay"
          onClick={() =>
            setSelectedEvent(null)
          }
        >
          <div
            className="modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="modal-header">
              <div>
                <h2 className="modal-title">
                  History Event Details
                </h2>

                <div className="modal-subtitle">
                  Event #
                  {selectedEvent.id}
                </div>
              </div>

              <button
                className="close-button"
                onClick={() =>
                  setSelectedEvent(null)
                }
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="detail-top">
                <div
                  className={`detail-icon ${eventColorClass(
                    selectedEvent.eventType
                  )}`}
                >
                  {eventIcon(
                    selectedEvent.eventType
                  )}
                </div>

                <div>
                  <h2 className="detail-title">
                    {selectedEvent.eventTypeLabel}
                  </h2>

                  <div className="detail-subtitle">
                    {formatDateTime(
                      selectedEvent.timestamp
                    )}
                  </div>
                </div>
              </div>

              <div className="detail-grid">
                <div className="detail-item">
                  <div className="detail-label">
                    Event Type
                  </div>

                  <div className="detail-value">
                    {
                      selectedEvent.eventTypeLabel
                    }
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    Action
                  </div>

                  <div className="detail-value">
                    {selectedEvent.action ||
                      selectedEvent.title ||
                      "Activity recorded"}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    Reference
                  </div>

                  <div className="detail-value">
                    {renderReference(
                      selectedEvent
                    )}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    Asset
                  </div>

                  <div className="detail-value">
                    {selectedEvent.assetCode ||
                      selectedEvent.assetName ||
                      (selectedEvent.assetId
                        ? `Asset #${selectedEvent.assetId}`
                        : "—")}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    Performed By
                  </div>

                  <div className="detail-value">
                    {selectedEvent.userName ||
                      (selectedEvent.userId
                        ? `User #${selectedEvent.userId}`
                        : "System")}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    Department
                  </div>

                  <div className="detail-value">
                    {selectedEvent.department ||
                      "—"}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    Status
                  </div>

                  <div className="detail-value">
                    {selectedEvent.status ? (
                      <span
                        className={`status-badge ${statusClass(
                          selectedEvent.status
                        )}`}
                      >
                        {statusLabel(
                          selectedEvent.status
                        )}
                      </span>
                    ) : (
                      "—"
                    )}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    Cost
                  </div>

                  <div className="detail-value">
                    {selectedEvent.cost !==
                      null &&
                    selectedEvent.cost !==
                      undefined &&
                    selectedEvent.cost !==
                      ""
                      ? formatCurrency(
                          selectedEvent.cost
                        )
                      : "—"}
                  </div>
                </div>
              </div>

              {(selectedEvent.oldStatus ||
                selectedEvent.newStatus) && (
                <div className="description-box">
                  <div className="description-label">
                    Status Transition
                  </div>

                  <div
                    style={{
                      marginTop: "8px",
                      display: "flex",
                      alignItems: "center",
                      gap: "7px",
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      className={`status-badge ${statusClass(
                        selectedEvent.oldStatus
                      )}`}
                    >
                      {statusLabel(
                        selectedEvent.oldStatus
                      )}
                    </span>

                    <span
                      style={{
                        color:
                          "#98a2b3",
                      }}
                    >
                      →
                    </span>

                    <span
                      className={`status-badge ${statusClass(
                        selectedEvent.newStatus
                      )}`}
                    >
                      {statusLabel(
                        selectedEvent.newStatus
                      )}
                    </span>
                  </div>
                </div>
              )}

              <div className="description-box">
                <div className="description-label">
                  Description
                </div>

                <div className="description">
                  {selectedEvent.description ||
                    selectedEvent.action ||
                    "No additional description recorded."}
                </div>
              </div>

              {selectedEvent.metadata &&
                Object.keys(
                  selectedEvent.metadata
                ).length > 0 && (
                  <div>
                    <button
                      className="action-button"
                      style={{
                        marginTop: "12px",
                      }}
                      onClick={() =>
                        toggleExpanded(
                          selectedEvent.id
                        )
                      }
                    >
                      {expanded[
                        selectedEvent.id
                      ]
                        ? "Hide Metadata"
                        : "Show Metadata"}
                    </button>

                    {expanded[
                      selectedEvent.id
                    ] && (
                      <pre className="metadata">
                        {JSON.stringify(
                          selectedEvent.metadata,
                          null,
                          2
                        )}
                      </pre>
                    )}
                  </div>
                )}
            </div>

            <div className="modal-footer">
              <button
                className="btn"
                onClick={() =>
                  setSelectedEvent(null)
                }
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
