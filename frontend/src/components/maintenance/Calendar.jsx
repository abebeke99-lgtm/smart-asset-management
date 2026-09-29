import React, { useEffect, useMemo, useState } from "react";
import { withMaintenanceAuth } from "./maintenanceAuth";

const API = "/api";

const EVENT_TYPES = {
  preventive: {
    label: "Preventive Maintenance",
    short: "PM",
  },
  work_order: {
    label: "Work Order",
    short: "WO",
  },
  request: {
    label: "Maintenance Request",
    short: "REQ",
  },
};

const STATUS_LABELS = {
  scheduled: "Scheduled",
  pending: "Pending",
  approved: "Approved",
  assigned: "Assigned",
  "in-progress": "In Progress",
  "in_progress": "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
  overdue: "Overdue",
  active: "Active",
  paused: "Paused",
};

const STATUS_CLASS = {
  scheduled: "status-blue",
  pending: "status-yellow",
  approved: "status-green",
  assigned: "status-purple",
  "in-progress": "status-orange",
  "in_progress": "status-orange",
  completed: "status-green",
  cancelled: "status-red",
  overdue: "status-red",
  active: "status-green",
  paused: "status-gray",
};

function safeArray(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

function parseDate(value) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function dateKey(date) {
  if (!date) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDate(value) {
  const date = parseDate(value);

  if (!date) return "—";

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatTime(value) {
  const date = parseDate(value);

  if (!date) return "";

  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function startOfCalendar(date) {
  const first = startOfMonth(date);
  const day = first.getDay();

  return new Date(
    first.getFullYear(),
    first.getMonth(),
    first.getDate() - day
  );
}

function addDays(date, amount) {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

function getMonthTitle(date) {
  return date.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

function normalizeStatus(status) {
  if (!status) return "scheduled";

  return String(status)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
}

function normalizePreventive(item) {
  const date =
    item.nextDueDate ||
    item.next_due_date ||
    item.scheduledDate ||
    item.scheduled_date ||
    item.dueDate ||
    item.due_date;

  const asset =
    item.asset ||
    item.Asset ||
    item.assetInfo ||
    item.asset_info ||
    {};

  const assetName =
    asset.name ||
    asset.assetName ||
    asset.asset_name ||
    item.assetName ||
    item.asset_name ||
    `Asset #${item.assetId || item.asset_id || "—"}`;

  return {
    id: item.id || item.preventiveId || item.preventive_id,
    type: "preventive",
    title:
      item.title ||
      item.name ||
      item.planName ||
      item.plan_name ||
      "Preventive Maintenance",
    description: item.description || item.notes || "",
    date,
    status: normalizeStatus(item.status || "scheduled"),
    priority: normalizeStatus(item.priority || "medium"),
    assetId: item.assetId || item.asset_id,
    assetName,
    technician:
      item.technician?.name ||
      item.Technician?.name ||
      item.technicianName ||
      item.technician_name ||
      "",
    frequency: item.frequency || "",
    source: item,
  };
}

function normalizeWorkOrder(item) {
  const date =
    item.scheduledDate ||
    item.scheduled_date ||
    item.startDate ||
    item.start_date ||
    item.dueDate ||
    item.due_date ||
    item.createdAt ||
    item.created_at;

  const asset =
    item.asset ||
    item.Asset ||
    {};

  return {
    id: item.id || item.workOrderId || item.work_order_id,
    type: "work_order",
    title:
      item.title ||
      item.workOrderNumber ||
      item.work_order_number ||
      `Work Order #${item.id || "—"}`,
    description:
      item.description ||
      item.problemDescription ||
      item.problem_description ||
      "",
    date,
    status: normalizeStatus(item.status || "scheduled"),
    priority: normalizeStatus(item.priority || "medium"),
    assetId: item.assetId || item.asset_id,
    assetName:
      asset.name ||
      asset.assetName ||
      asset.asset_name ||
      item.assetName ||
      item.asset_name ||
      `Asset #${item.assetId || item.asset_id || "—"}`,
    technician:
      item.technician?.name ||
      item.Technician?.name ||
      item.technicianName ||
      item.technician_name ||
      "",
    source: item,
  };
}

function normalizeRequest(item) {
  const date =
    item.scheduledDate ||
    item.scheduled_date ||
    item.requestedDate ||
    item.requested_date ||
    item.createdAt ||
    item.created_at;

  const asset =
    item.asset ||
    item.Asset ||
    {};

  return {
    id: item.id || item.requestId || item.request_id,
    type: "request",
    title:
      item.title ||
      item.subject ||
      item.requestNumber ||
      item.request_number ||
      `Request #${item.id || "—"}`,
    description:
      item.description ||
      item.problemDescription ||
      item.problem_description ||
      "",
    date,
    status: normalizeStatus(item.status || "pending"),
    priority: normalizeStatus(item.priority || "medium"),
    assetId: item.assetId || item.asset_id,
    assetName:
      asset.name ||
      asset.assetName ||
      asset.asset_name ||
      item.assetName ||
      item.asset_name ||
      `Asset #${item.assetId || item.asset_id || "—"}`,
    technician:
      item.technician?.name ||
      item.Technician?.name ||
      item.technicianName ||
      item.technician_name ||
      "",
    source: item,
  };
}

export default function Calendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const [preventivePlans, setPreventivePlans] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [requests, setRequests] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedType, setSelectedType] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [search, setSearch] = useState("");

  const [selectedEvent, setSelectedEvent] = useState(null);

  const [showUpcoming, setShowUpcoming] = useState(false);

  async function fetchJson(url) {
    const response = await fetch(url, {
      headers: withMaintenanceAuth(),
    });

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }

    return response.json();
  }

  async function loadCalendarData() {
    setLoading(true);
    setError("");

    try {
      const results = await Promise.allSettled([
        fetchJson(`${API}/maintenance/preventive`),
        fetchJson(`${API}/maintenance/work-orders`),
        fetchJson(`${API}/maintenance/requests`),
      ]);

      const preventiveResult = results[0];
      const workOrderResult = results[1];
      const requestResult = results[2];

      if (preventiveResult.status === "fulfilled") {
        setPreventivePlans(
          safeArray(preventiveResult.value).map(normalizePreventive)
        );
      } else {
        setPreventivePlans([]);
      }

      if (workOrderResult.status === "fulfilled") {
        setWorkOrders(
          safeArray(workOrderResult.value).map(normalizeWorkOrder)
        );
      } else {
        setWorkOrders([]);
      }

      if (requestResult.status === "fulfilled") {
        setRequests(
          safeArray(requestResult.value).map(normalizeRequest)
        );
      } else {
        setRequests([]);
      }

      const allFailed = results.every(
        (result) => result.status === "rejected"
      );

      if (allFailed) {
        throw new Error("Unable to load maintenance calendar data.");
      }

      const partialFailure = results.some(
        (result) => result.status === "rejected"
      );

      if (partialFailure) {
        setError(
          "Some maintenance sources could not be loaded. Available events are still displayed."
        );
      }
    } catch (err) {
      setError(err.message || "Unable to load calendar data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCalendarData();
  }, []);

  const allEvents = useMemo(() => {
    return [
      ...preventivePlans,
      ...workOrders,
      ...requests,
    ].filter((event) => parseDate(event.date));
  }, [preventivePlans, workOrders, requests]);

  const today = useMemo(() => {
    const date = new Date();

    return new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate()
    );
  }, []);

  const filteredEvents = useMemo(() => {
    const query = search.trim().toLowerCase();

    return allEvents.filter((event) => {
      const typeMatch =
        selectedType === "all" ||
        event.type === selectedType;

      const statusMatch =
        selectedStatus === "all" ||
        event.status === selectedStatus;

      const searchMatch =
        !query ||
        [
          event.title,
          event.description,
          event.assetName,
          event.technician,
          event.priority,
          event.status,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query);

      return typeMatch && statusMatch && searchMatch;
    });
  }, [
    allEvents,
    selectedType,
    selectedStatus,
    search,
  ]);

  const eventsByDate = useMemo(() => {
    const map = {};

    filteredEvents.forEach((event) => {
      const date = parseDate(event.date);

      if (!date) return;

      const key = dateKey(date);

      if (!map[key]) {
        map[key] = [];
      }

      map[key].push(event);
    });

    Object.values(map).forEach((events) => {
      events.sort((a, b) => {
        const aTime = parseDate(a.date)?.getTime() || 0;
        const bTime = parseDate(b.date)?.getTime() || 0;

        return aTime - bTime;
      });
    });

    return map;
  }, [filteredEvents]);

  const calendarDays = useMemo(() => {
    const first = startOfCalendar(currentMonth);
    const days = [];

    for (let i = 0; i < 42; i += 1) {
      days.push(addDays(first, i));
    }

    return days;
  }, [currentMonth]);

  const monthEvents = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    return filteredEvents
      .filter((event) => {
        const date = parseDate(event.date);

        return (
          date &&
          date.getFullYear() === year &&
          date.getMonth() === month
        );
      })
      .sort((a, b) => {
        return (
          (parseDate(a.date)?.getTime() || 0) -
          (parseDate(b.date)?.getTime() || 0)
        );
      });
  }, [filteredEvents, currentMonth]);

  const upcomingEvents = useMemo(() => {
    const now = new Date();

    return filteredEvents
      .filter((event) => {
        const date = parseDate(event.date);

        return date && date >= now;
      })
      .sort((a, b) => {
        return (
          (parseDate(a.date)?.getTime() || 0) -
          (parseDate(b.date)?.getTime() || 0)
        );
      })
      .slice(0, 10);
  }, [filteredEvents]);

  const overdueEvents = useMemo(() => {
    return filteredEvents.filter((event) => {
      const date = parseDate(event.date);

      if (!date) return false;

      return date < today && event.status !== "completed";
    });
  }, [filteredEvents, today]);

  const dueTodayEvents = useMemo(() => {
    const key = dateKey(today);

    return (eventsByDate[key] || []).filter(
      (event) => event.status !== "completed"
    );
  }, [eventsByDate, today]);

  const getEventStatus = (event) => {
    const eventDate = parseDate(event.date);

    if (
      eventDate &&
      eventDate < today &&
      event.status !== "completed" &&
      event.status !== "cancelled"
    ) {
      return "overdue";
    }

    return event.status;
  };

  const previousMonth = () => {
    setCurrentMonth(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
    );
  };

  const nextMonth = () => {
    setCurrentMonth(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
    );
  };

  const goToToday = () => {
    setCurrentMonth(new Date());
  };

  const clearFilters = () => {
    setSelectedType("all");
    setSelectedStatus("all");
    setSearch("");
  };

  const eventType = (event) => {
    return EVENT_TYPES[event.type] || {
      label: "Maintenance",
      short: "M",
    };
  };

  const eventStatus = (event) => {
    const status = getEventStatus(event);

    return (
      STATUS_LABELS[status] ||
      status.replace(/-/g, " ")
    );
  };

  return (
    <div className="maintenance-calendar">
      <style>{`
        * {
          box-sizing: border-box;
        }

        .maintenance-calendar {
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

        .calendar-container {
          max-width: 1500px;
          margin: 0 auto;
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 20px;
          margin-bottom: 22px;
        }

        .page-title {
          margin: 0;
          font-size: 28px;
          font-weight: 750;
          letter-spacing: -0.5px;
        }

        .page-subtitle {
          margin: 7px 0 0;
          color: #667085;
          font-size: 14px;
        }

        .header-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .btn {
          border: 1px solid #d7dce5;
          background: white;
          color: #263248;
          border-radius: 9px;
          padding: 10px 14px;
          font-size: 13px;
          font-weight: 650;
          cursor: pointer;
          transition: 0.18s ease;
        }

        .btn:hover {
          background: #f1f4f8;
        }

        .btn-primary {
          border-color: #2563eb;
          background: #2563eb;
          color: white;
        }

        .btn-primary:hover {
          background: #1d4ed8;
        }

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 18px;
        }

        .summary-card {
          background: white;
          border: 1px solid #e3e7ee;
          border-radius: 12px;
          padding: 17px;
          box-shadow: 0 2px 7px rgba(16, 24, 40, 0.03);
        }

        .summary-label {
          color: #667085;
          font-size: 12px;
          font-weight: 650;
          text-transform: uppercase;
          letter-spacing: 0.4px;
        }

        .summary-value {
          margin-top: 7px;
          font-size: 26px;
          font-weight: 760;
        }

        .summary-description {
          margin-top: 4px;
          font-size: 12px;
          color: #98a2b3;
        }

        .filters {
          background: white;
          border: 1px solid #e3e7ee;
          border-radius: 12px;
          padding: 14px;
          margin-bottom: 16px;
          display: flex;
          gap: 10px;
          align-items: center;
          flex-wrap: wrap;
        }

        .search-box {
          flex: 1 1 240px;
          min-width: 220px;
          position: relative;
        }

        .search-box input {
          width: 100%;
          border: 1px solid #d7dce5;
          border-radius: 9px;
          padding: 10px 12px;
          outline: none;
          font-size: 13px;
          background: #fff;
        }

        .search-box input:focus,
        .filter-select:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
        }

        .filter-select {
          border: 1px solid #d7dce5;
          border-radius: 9px;
          padding: 10px 12px;
          background: white;
          color: #263248;
          font-size: 13px;
          outline: none;
          min-width: 150px;
        }

        .calendar-layout {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 320px;
          gap: 16px;
          align-items: start;
        }

        .calendar-card,
        .side-card {
          background: white;
          border: 1px solid #e3e7ee;
          border-radius: 12px;
          box-shadow: 0 2px 7px rgba(16, 24, 40, 0.03);
          overflow: hidden;
        }

        .calendar-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          padding: 16px;
          border-bottom: 1px solid #edf0f4;
        }

        .month-title {
          font-size: 18px;
          font-weight: 750;
          min-width: 190px;
          text-align: center;
        }

        .calendar-nav {
          display: flex;
          align-items: center;
          gap: 7px;
        }

        .nav-btn {
          border: 1px solid #d7dce5;
          background: white;
          border-radius: 8px;
          width: 36px;
          height: 36px;
          cursor: pointer;
          font-size: 17px;
          color: #344054;
        }

        .nav-btn:hover {
          background: #f3f5f8;
        }

        .week-header {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          background: #fafbfc;
          border-bottom: 1px solid #e8ebf0;
        }

        .week-day {
          padding: 11px 8px;
          text-align: right;
          font-size: 11px;
          color: #667085;
          font-weight: 750;
          text-transform: uppercase;
        }

        .calendar-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
        }

        .calendar-day {
          min-height: 138px;
          border-right: 1px solid #edf0f4;
          border-bottom: 1px solid #edf0f4;
          padding: 8px;
          background: white;
          overflow: hidden;
        }

        .calendar-day:nth-child(7n) {
          border-right: none;
        }

        .calendar-day.other-month {
          background: #fafbfc;
        }

        .calendar-day.today {
          background: #f4f8ff;
        }

        .day-header {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 5px;
        }

        .day-number {
          width: 27px;
          height: 27px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 700;
          color: #475467;
        }

        .today .day-number {
          background: #2563eb;
          color: white;
        }

        .day-events {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .event-chip {
          width: 100%;
          text-align: left;
          border: none;
          border-left: 3px solid #2563eb;
          background: #eff6ff;
          border-radius: 5px;
          padding: 5px 6px;
          cursor: pointer;
          overflow: hidden;
        }

        .event-chip:hover {
          filter: brightness(0.97);
        }

        .event-chip.event-preventive {
          border-left-color: #2563eb;
          background: #eff6ff;
        }

        .event-chip.event-work_order {
          border-left-color: #7c3aed;
          background: #f5f3ff;
        }

        .event-chip.event-request {
          border-left-color: #0891b2;
          background: #ecfeff;
        }

        .event-chip.event-overdue {
          border-left-color: #dc2626;
          background: #fef2f2;
        }

        .event-time {
          display: inline-block;
          margin-right: 4px;
          font-size: 9px;
          font-weight: 700;
          color: #667085;
        }

        .event-title {
          display: block;
          font-size: 10px;
          line-height: 1.3;
          color: #1d2939;
          font-weight: 700;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .event-more {
          border: none;
          background: transparent;
          color: #667085;
          font-size: 10px;
          padding: 2px 5px;
          cursor: pointer;
        }

        .side-column {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .side-card-header {
          padding: 15px 16px;
          border-bottom: 1px solid #edf0f4;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .side-card-title {
          margin: 0;
          font-size: 14px;
          font-weight: 750;
        }

        .side-card-content {
          padding: 12px;
        }

        .upcoming-item {
          display: block;
          width: 100%;
          border: 1px solid #edf0f4;
          background: white;
          border-radius: 9px;
          padding: 10px;
          margin-bottom: 8px;
          cursor: pointer;
          text-align: left;
        }

        .upcoming-item:hover {
          background: #fafbfc;
          border-color: #d7dce5;
        }

        .upcoming-item:last-child {
          margin-bottom: 0;
        }

        .upcoming-top {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          align-items: flex-start;
        }

        .upcoming-title {
          font-size: 12px;
          font-weight: 700;
          color: #1d2939;
        }

        .upcoming-date {
          margin-top: 4px;
          color: #667085;
          font-size: 11px;
        }

        .type-badge {
          flex-shrink: 0;
          border-radius: 5px;
          padding: 3px 5px;
          font-size: 9px;
          font-weight: 800;
        }

        .type-preventive {
          background: #dbeafe;
          color: #1d4ed8;
        }

        .type-work_order {
          background: #ede9fe;
          color: #6d28d9;
        }

        .type-request {
          background: #cffafe;
          color: #0e7490;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          padding: 3px 7px;
          font-size: 9px;
          font-weight: 750;
          margin-top: 6px;
        }

        .status-blue {
          background: #dbeafe;
          color: #1d4ed8;
        }

        .status-yellow {
          background: #fef3c7;
          color: #92400e;
        }

        .status-green {
          background: #dcfce7;
          color: #166534;
        }

        .status-purple {
          background: #ede9fe;
          color: #6d28d9;
        }

        .status-orange {
          background: #ffedd5;
          color: #c2410c;
        }

        .status-red {
          background: #fee2e2;
          color: #b91c1c;
        }

        .status-gray {
          background: #f2f4f7;
          color: #475467;
        }

        .empty-state {
          text-align: center;
          padding: 28px 14px;
          color: #98a2b3;
          font-size: 12px;
        }

        .legend {
          display: grid;
          grid-template-columns: 1fr;
          gap: 8px;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #475467;
          font-size: 11px;
        }

        .legend-dot {
          width: 10px;
          height: 10px;
          border-radius: 3px;
          flex-shrink: 0;
        }

        .dot-preventive {
          background: #2563eb;
        }

        .dot-work {
          background: #7c3aed;
        }

        .dot-request {
          background: #0891b2;
        }

        .dot-overdue {
          background: #dc2626;
        }

        .alert {
          border: 1px solid #fed7aa;
          background: #fff7ed;
          color: #9a3412;
          padding: 10px 12px;
          border-radius: 9px;
          font-size: 12px;
          margin-bottom: 15px;
        }

        .loading {
          padding: 50px;
          text-align: center;
          color: #667085;
          font-size: 13px;
        }

        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.48);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          z-index: 1000;
        }

        .modal {
          width: min(620px, 100%);
          max-height: 90vh;
          overflow-y: auto;
          background: white;
          border-radius: 14px;
          box-shadow: 0 20px 60px rgba(15, 23, 42, 0.25);
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          gap: 15px;
          align-items: flex-start;
          padding: 18px 20px;
          border-bottom: 1px solid #edf0f4;
        }

        .modal-title {
          margin: 0;
          font-size: 19px;
          font-weight: 750;
        }

        .modal-subtitle {
          margin-top: 5px;
          font-size: 12px;
          color: #667085;
        }

        .close-btn {
          border: none;
          background: #f2f4f7;
          width: 32px;
          height: 32px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 18px;
          color: #475467;
        }

        .modal-body {
          padding: 20px;
        }

        .detail-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .detail-item {
          border: 1px solid #edf0f4;
          border-radius: 9px;
          padding: 11px;
          background: #fafbfc;
        }

        .detail-label {
          font-size: 10px;
          text-transform: uppercase;
          color: #98a2b3;
          font-weight: 750;
          letter-spacing: 0.35px;
        }

        .detail-value {
          margin-top: 4px;
          font-size: 13px;
          font-weight: 650;
          color: #344054;
          word-break: break-word;
        }

        .description-box {
          margin-top: 14px;
          border: 1px solid #edf0f4;
          border-radius: 9px;
          padding: 12px;
        }

        .description-title {
          font-size: 11px;
          font-weight: 750;
          color: #475467;
          margin-bottom: 5px;
        }

        .description-text {
          color: #667085;
          font-size: 12px;
          line-height: 1.6;
        }

        .modal-footer {
          padding: 14px 20px;
          border-top: 1px solid #edf0f4;
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }

        @media (max-width: 1100px) {
          .calendar-layout {
            grid-template-columns: 1fr;
          }

          .side-column {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 800px) {
          .maintenance-calendar {
            padding: 14px;
          }

          .page-header {
            flex-direction: column;
          }

          .summary-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .calendar-day {
            min-height: 105px;
          }

          .event-title {
            font-size: 9px;
          }

          .side-column {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 600px) {
          .summary-grid {
            grid-template-columns: 1fr;
          }

          .calendar-toolbar {
            flex-direction: column;
            align-items: stretch;
          }

          .calendar-nav {
            justify-content: center;
          }

          .month-title {
            order: -1;
          }

          .week-day {
            font-size: 9px;
            padding: 8px 3px;
          }

          .calendar-day {
            min-height: 88px;
            padding: 4px;
          }

          .day-number {
            width: 23px;
            height: 23px;
            font-size: 10px;
          }

          .event-chip {
            padding: 3px 4px;
          }

          .event-time {
            display: none;
          }

          .event-title {
            font-size: 8px;
          }

          .event-more {
            font-size: 8px;
          }

          .detail-grid {
            grid-template-columns: 1fr;
          }

          .filters {
            align-items: stretch;
          }

          .filter-select,
          .search-box {
            width: 100%;
            min-width: 100%;
          }
        }
      `}</style>

      <div className="calendar-container">
        <div className="page-header">
          <div>
            <h1 className="page-title">Maintenance Calendar</h1>
            <p className="page-subtitle">
              View preventive maintenance, work orders, and maintenance
              requests by schedule.
            </p>
          </div>

          <div className="header-actions">
            <button
              className="btn"
              onClick={loadCalendarData}
              disabled={loading}
            >
              ↻ Refresh
            </button>

            <button
              className="btn btn-primary"
              onClick={goToToday}
            >
              Today
            </button>
          </div>
        </div>

        <div className="summary-grid">
          <div className="summary-card">
            <div className="summary-label">This Month</div>
            <div className="summary-value">
              {monthEvents.length}
            </div>
            <div className="summary-description">
              Scheduled maintenance events
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-label">Due Today</div>
            <div className="summary-value">
              {dueTodayEvents.length}
            </div>
            <div className="summary-description">
              Maintenance activities requiring attention
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-label">Upcoming</div>
            <div className="summary-value">
              {upcomingEvents.length}
            </div>
            <div className="summary-description">
              Next scheduled maintenance events
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-label">Overdue</div>
            <div className="summary-value">
              {overdueEvents.length}
            </div>
            <div className="summary-description">
              Past events not completed
            </div>
          </div>
        </div>

        {error && (
          <div className="alert">
            {error}
          </div>
        )}

        <div className="filters">
          <div className="search-box">
            <input
              type="text"
              placeholder="Search asset, maintenance, technician..."
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
            />
          </div>

          <select
            className="filter-select"
            value={selectedType}
            onChange={(event) =>
              setSelectedType(event.target.value)
            }
          >
            <option value="all">All Types</option>
            <option value="preventive">
              Preventive Maintenance
            </option>
            <option value="work_order">
              Work Orders
            </option>
            <option value="request">
              Maintenance Requests
            </option>
          </select>

          <select
            className="filter-select"
            value={selectedStatus}
            onChange={(event) =>
              setSelectedStatus(event.target.value)
            }
          >
            <option value="all">All Statuses</option>

            <option value="scheduled">Scheduled</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="assigned">Assigned</option>
            <option value="in-progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="overdue">Overdue</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
          </select>

          <button
            className="btn"
            onClick={clearFilters}
          >
            Clear
          </button>
        </div>

        {loading ? (
          <div className="calendar-card">
            <div className="loading">
              Loading maintenance calendar...
            </div>
          </div>
        ) : (
          <div className="calendar-layout">
            <div className="calendar-card">
              <div className="calendar-toolbar">
                <div className="calendar-nav">
                  <button
                    className="nav-btn"
                    onClick={previousMonth}
                    aria-label="Previous month"
                  >
                    ‹
                  </button>

                  <button
                    className="btn"
                    onClick={goToToday}
                  >
                    Today
                  </button>

                  <button
                    className="nav-btn"
                    onClick={nextMonth}
                    aria-label="Next month"
                  >
                    ›
                  </button>
                </div>

                <div className="month-title">
                  {getMonthTitle(currentMonth)}
                </div>

                <div>
                  <span
                    style={{
                      color: "#667085",
                      fontSize: "12px",
                    }}
                  >
                    {monthEvents.length} events
                  </span>
                </div>
              </div>

              <div className="week-header">
                {[
                  "Sun",
                  "Mon",
                  "Tue",
                  "Wed",
                  "Thu",
                  "Fri",
                  "Sat",
                ].map((day) => (
                  <div
                    key={day}
                    className="week-day"
                  >
                    {day}
                  </div>
                ))}
              </div>

              <div className="calendar-grid">
                {calendarDays.map((day) => {
                  const key = dateKey(day);
                  const events = eventsByDate[key] || [];

                  const isCurrentMonth =
                    day.getMonth() ===
                      currentMonth.getMonth() &&
                    day.getFullYear() ===
                      currentMonth.getFullYear();

                  const isToday =
                    dateKey(day) === dateKey(today);

                  const visibleEvents = events.slice(0, 3);

                  return (
                    <div
                      key={key}
                      className={[
                        "calendar-day",
                        !isCurrentMonth
                          ? "other-month"
                          : "",
                        isToday ? "today" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      <div className="day-header">
                        <div className="day-number">
                          {day.getDate()}
                        </div>
                      </div>

                      <div className="day-events">
                        {visibleEvents.map((event) => {
                          const status =
                            getEventStatus(event);

                          return (
                            <button
                              key={`${event.type}-${event.id}-${event.date}`}
                              className={[
                                "event-chip",
                                `event-${event.type}`,
                                status === "overdue"
                                  ? "event-overdue"
                                  : "",
                              ]
                                .filter(Boolean)
                                .join(" ")}
                              onClick={() =>
                                setSelectedEvent(event)
                              }
                              title={event.title}
                            >
                              <span className="event-time">
                                {formatTime(event.date)}
                              </span>

                              <span className="event-title">
                                {event.title}
                              </span>
                            </button>
                          );
                        })}

                        {events.length > 3 && (
                          <button
                            className="event-more"
                            onClick={() => {
                              setSelectedEvent({
                                type: "day",
                                date: day,
                                events,
                              });
                            }}
                          >
                            +{events.length - 3} more
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="side-column">
              <div className="side-card">
                <div className="side-card-header">
                  <h3 className="side-card-title">
                    Upcoming Maintenance
                  </h3>

                  <button
                    className="btn"
                    style={{
                      padding: "6px 9px",
                      fontSize: "10px",
                    }}
                    onClick={() =>
                      setShowUpcoming(!showUpcoming)
                    }
                  >
                    {showUpcoming ? "Close" : "View"}
                  </button>
                </div>

                <div className="side-card-content">
                  {(showUpcoming
                    ? upcomingEvents
                    : upcomingEvents.slice(0, 5)
                  ).length === 0 ? (
                    <div className="empty-state">
                      No upcoming maintenance events.
                    </div>
                  ) : (
                    (showUpcoming
                      ? upcomingEvents
                      : upcomingEvents.slice(0, 5)
                    ).map((event) => {
                      const type = eventType(event);
                      const status = getEventStatus(event);

                      return (
                        <button
                          key={`${event.type}-${event.id}-${event.date}`}
                          className="upcoming-item"
                          onClick={() =>
                            setSelectedEvent(event)
                          }
                        >
                          <div className="upcoming-top">
                            <div>
                              <div className="upcoming-title">
                                {event.title}
                              </div>

                              <div className="upcoming-date">
                                {formatDate(event.date)}
                              </div>
                            </div>

                            <span
                              className={`type-badge type-${event.type}`}
                            >
                              {type.short}
                            </span>
                          </div>

                          <span
                            className={`status-badge ${
                              STATUS_CLASS[status] ||
                              "status-gray"
                            }`}
                          >
                            {eventStatus(event)}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="side-card">
                <div className="side-card-header">
                  <h3 className="side-card-title">
                    Calendar Legend
                  </h3>
                </div>

                <div className="side-card-content">
                  <div className="legend">
                    <div className="legend-item">
                      <span className="legend-dot dot-preventive" />
                      Preventive Maintenance
                    </div>

                    <div className="legend-item">
                      <span className="legend-dot dot-work" />
                      Work Order
                    </div>

                    <div className="legend-item">
                      <span className="legend-dot dot-request" />
                      Maintenance Request
                    </div>

                    <div className="legend-item">
                      <span className="legend-dot dot-overdue" />
                      Overdue
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {selectedEvent && selectedEvent.type === "day" && (
        <div
          className="modal-overlay"
          onClick={() => setSelectedEvent(null)}
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
                  Maintenance Events
                </h2>

                <div className="modal-subtitle">
                  {formatDate(selectedEvent.date)}
                </div>
              </div>

              <button
                className="close-btn"
                onClick={() =>
                  setSelectedEvent(null)
                }
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              {selectedEvent.events.map((event) => {
                const type = eventType(event);
                const status = getEventStatus(event);

                return (
                  <button
                    key={`${event.type}-${event.id}-${event.date}`}
                    className="upcoming-item"
                    style={{
                      width: "100%",
                      marginBottom: "9px",
                    }}
                    onClick={() =>
                      setSelectedEvent(event)
                    }
                  >
                    <div className="upcoming-top">
                      <div>
                        <div className="upcoming-title">
                          {event.title}
                        </div>

                        <div className="upcoming-date">
                          {formatTime(event.date)}
                          {event.assetName
                            ? ` • ${event.assetName}`
                            : ""}
                        </div>
                      </div>

                      <span
                        className={`type-badge type-${event.type}`}
                      >
                        {type.short}
                      </span>
                    </div>

                    <span
                      className={`status-badge ${
                        STATUS_CLASS[status] ||
                        "status-gray"
                      }`}
                    >
                      {eventStatus(event)}
                    </span>
                  </button>
                );
              })}
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

      {selectedEvent &&
        selectedEvent.type !== "day" && (
          <div
            className="modal-overlay"
            onClick={() => setSelectedEvent(null)}
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
                    {selectedEvent.title}
                  </h2>

                  <div className="modal-subtitle">
                    {eventType(selectedEvent).label}
                  </div>
                </div>

                <button
                  className="close-btn"
                  onClick={() =>
                    setSelectedEvent(null)
                  }
                >
                  ×
                </button>
              </div>

              <div className="modal-body">
                <div className="detail-grid">
                  <div className="detail-item">
                    <div className="detail-label">
                      Type
                    </div>

                    <div className="detail-value">
                      {eventType(selectedEvent).label}
                    </div>
                  </div>

                  <div className="detail-item">
                    <div className="detail-label">
                      Status
                    </div>

                    <div className="detail-value">
                      <span
                        className={`status-badge ${
                          STATUS_CLASS[
                            getEventStatus(selectedEvent)
                          ] || "status-gray"
                        }`}
                      >
                        {eventStatus(selectedEvent)}
                      </span>
                    </div>
                  </div>

                  <div className="detail-item">
                    <div className="detail-label">
                      Scheduled Date
                    </div>

                    <div className="detail-value">
                      {formatDate(selectedEvent.date)}
                    </div>
                  </div>

                  <div className="detail-item">
                    <div className="detail-label">
                      Time
                    </div>

                    <div className="detail-value">
                      {formatTime(selectedEvent.date) ||
                        "Not specified"}
                    </div>
                  </div>

                  <div className="detail-item">
                    <div className="detail-label">
                      Asset
                    </div>

                    <div className="detail-value">
                      {selectedEvent.assetName ||
                        "Not specified"}
                    </div>
                  </div>

                  <div className="detail-item">
                    <div className="detail-label">
                      Priority
                    </div>

                    <div className="detail-value">
                      {selectedEvent.priority ||
                        "Not specified"}
                    </div>
                  </div>

                  <div className="detail-item">
                    <div className="detail-label">
                      Technician
                    </div>

                    <div className="detail-value">
                      {selectedEvent.technician ||
                        "Not assigned"}
                    </div>
                  </div>

                  {selectedEvent.frequency && (
                    <div className="detail-item">
                      <div className="detail-label">
                        Frequency
                      </div>

                      <div className="detail-value">
                        {selectedEvent.frequency}
                      </div>
                    </div>
                  )}
                </div>

                {selectedEvent.description && (
                  <div className="description-box">
                    <div className="description-title">
                      Description
                    </div>

                    <div className="description-text">
                      {selectedEvent.description}
                    </div>
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
