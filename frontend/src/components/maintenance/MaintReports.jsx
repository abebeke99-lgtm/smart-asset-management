/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useMemo, useState } from "react";
import { withMaintenanceAuth } from "./maintenanceAuth";

const API = "/api";

const EMPTY_FILTERS = {
  search: "",
  reportType: "overview",
  dateFrom: "",
  dateTo: "",
  status: "all",
};

function safeArray(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

function numberValue(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeText(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function formatCurrency(value) {
  return numberValue(value).toLocaleString(
    undefined,
    {
      minimumFractionDigits: 2,
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

function dateOnly(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return `${date.getFullYear()}-${String(
    date.getMonth() + 1
  ).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

function normalizeRecord(item, index) {
  const request = item.request || {};
  const workOrder =
    item.workOrder ||
    item.work_order ||
    {};
  const repair = item.repair || {};
  const asset = item.asset || {};
  const technician =
    item.technician || {};

  const laborCost = numberValue(
    item.laborCost ??
      item.labor_cost ??
      repair.laborCost ??
      repair.labor_cost
  );

  const partsCost = numberValue(
    item.partsCost ??
      item.parts_cost ??
      repair.partsCost ??
      repair.parts_cost
  );

  const materialsCost = numberValue(
    item.materialsCost ??
      item.materials_cost ??
      repair.materialsCost ??
      repair.materials_cost
  );

  const otherCost = numberValue(
    item.otherCost ??
      item.other_cost ??
      repair.otherCost ??
      repair.other_cost
  );

  const explicitTotal =
    item.totalCost ??
    item.total_cost ??
    repair.totalCost ??
    repair.total_cost;

  const totalCost =
    explicitTotal !== undefined &&
    explicitTotal !== null &&
    explicitTotal !== ""
      ? numberValue(explicitTotal)
      : laborCost +
        partsCost +
        materialsCost +
        otherCost;

  return {
    id:
      item.id ??
      item.reportId ??
      `record-${index}`,

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

    technicianId:
      item.technicianId ??
      item.technician_id ??
      technician.id ??
      "",

    technicianName:
      item.technicianName ??
      item.technician_name ??
      technician.name ??
      technician.fullName ??
      technician.full_name ??
      "",

    category:
      item.category ??
      item.maintenanceType ??
      item.maintenance_type ??
      request.category ??
      "Maintenance",

    priority:
      item.priority ??
      request.priority ??
      "",

    status:
      item.status ??
      workOrder.status ??
      repair.status ??
      request.status ??
      "",

    description:
      item.description ??
      request.description ??
      repair.description ??
      "",

    date:
      item.date ??
      item.reportDate ??
      item.report_date ??
      item.createdAt ??
      item.created_at ??
      workOrder.createdAt ??
      repair.createdAt ??
      null,

    laborCost,
    partsCost,
    materialsCost,
    otherCost,
    totalCost,

    laborHours: numberValue(
      item.laborHours ??
        item.labor_hours ??
        repair.laborHours ??
        repair.labor_hours
    ),

    source: item,
  };
}

function statusClass(status) {
  const value = normalizeText(status);

  if (
    [
      "completed",
      "approved",
      "closed",
      "resolved",
      "passed",
      "active",
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
      "assigned",
      "scheduled",
      "in_progress",
      "started",
    ].includes(value)
  ) {
    return "status-blue";
  }

  return "status-gray";
}

function statusLabel(status) {
  if (!status) return "—";

  return String(status)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}

export default function Reports() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [filters, setFilters] =
    useState(EMPTY_FILTERS);

  const [activeTab, setActiveTab] =
    useState("overview");

  const [selectedRecord, setSelectedRecord] =
    useState(null);

  async function fetchJson(url) {
    const response = await fetch(url, {
      headers: withMaintenanceAuth({
        "Content-Type": "application/json",
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

  async function loadReports() {
    setLoading(true);
    setError("");

    try {
      let data;

      try {
        data = await fetchJson(
          `${API}/maintenance/reports`
        );
      } catch {
        data = await fetchJson(
          `${API}/maintenance/history`
        );
      }

      const normalized = safeArray(data)
        .map(normalizeRecord)
        .sort((a, b) => {
          const dateA = new Date(
            a.date || 0
          ).getTime();

          const dateB = new Date(
            b.date || 0
          ).getTime();

          return dateB - dateA;
        });

      setRecords(normalized);
    } catch (err) {
      setError(
        err.message ||
          "Unable to load maintenance reports."
      );
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReports();
  }, []);

  const filteredRecords = useMemo(() => {
    const query =
      normalizeText(filters.search);

    return records.filter((record) => {
      const searchable = [
        record.assetCode,
        record.assetName,
        record.requestNumber,
        record.workOrderNumber,
        record.repairNumber,
        record.technicianName,
        record.category,
        record.priority,
        record.status,
        record.description,
      ]
        .filter(Boolean)
        .join(" ");

      const searchMatch =
        !query ||
        normalizeText(searchable).includes(
          query
        );

      const statusMatch =
        filters.status === "all" ||
        normalizeText(record.status) ===
          normalizeText(filters.status);

      const recordDate =
        dateOnly(record.date);

      const fromMatch =
        !filters.dateFrom ||
        (recordDate &&
          recordDate >= filters.dateFrom);

      const toMatch =
        !filters.dateTo ||
        (recordDate &&
          recordDate <= filters.dateTo);

      return (
        searchMatch &&
        statusMatch &&
        fromMatch &&
        toMatch
      );
    });
  }, [records, filters]);

  const summary = useMemo(() => {
    const result = {
      totalRecords: filteredRecords.length,
      totalCost: 0,
      laborCost: 0,
      partsCost: 0,
      materialsCost: 0,
      otherCost: 0,
      laborHours: 0,
      completed: 0,
      pending: 0,
      inProgress: 0,
      approved: 0,
      rejected: 0,
      uniqueAssets: 0,
      uniqueTechnicians: 0,
    };

    const assets = new Set();
    const technicians = new Set();

    filteredRecords.forEach((record) => {
      result.totalCost += record.totalCost;
      result.laborCost += record.laborCost;
      result.partsCost += record.partsCost;
      result.materialsCost +=
        record.materialsCost;
      result.otherCost += record.otherCost;
      result.laborHours +=
        record.laborHours;

      const status =
        normalizeText(record.status);

      if (status === "completed") {
        result.completed++;
      }

      if (
        [
          "pending",
          "requested",
          "open",
        ].includes(status)
      ) {
        result.pending++;
      }

      if (
        [
          "in_progress",
          "assigned",
          "scheduled",
        ].includes(status)
      ) {
        result.inProgress++;
      }

      if (status === "approved") {
        result.approved++;
      }

      if (
        [
          "rejected",
          "cancelled",
          "canceled",
        ].includes(status)
      ) {
        result.rejected++;
      }

      if (record.assetId) {
        assets.add(record.assetId);
      } else if (record.assetCode) {
        assets.add(record.assetCode);
      }

      if (record.technicianId) {
        technicians.add(
          record.technicianId
        );
      } else if (
        record.technicianName
      ) {
        technicians.add(
          record.technicianName
        );
      }
    });

    result.uniqueAssets =
      assets.size;

    result.uniqueTechnicians =
      technicians.size;

    return result;
  }, [filteredRecords]);

  const statusBreakdown = useMemo(() => {
    const map = {};

    filteredRecords.forEach((record) => {
      const status =
        record.status || "unknown";

      map[status] =
        (map[status] || 0) + 1;
    });

    return Object.entries(map).sort(
      (a, b) => b[1] - a[1]
    );
  }, [filteredRecords]);

  const technicianBreakdown = useMemo(() => {
    const map = {};

    filteredRecords.forEach((record) => {
      const name =
        record.technicianName ||
        (record.technicianId
          ? `Technician #${record.technicianId}`
          : "Unassigned");

      if (!map[name]) {
        map[name] = {
          name,
          jobs: 0,
          cost: 0,
          hours: 0,
        };
      }

      map[name].jobs++;
      map[name].cost +=
        record.totalCost;
      map[name].hours +=
        record.laborHours;
    });

    return Object.values(map)
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 10);
  }, [filteredRecords]);

  const assetBreakdown = useMemo(() => {
    const map = {};

    filteredRecords.forEach((record) => {
      const key =
        record.assetCode ||
        record.assetName ||
        record.assetId ||
        "Unknown Asset";

      if (!map[key]) {
        map[key] = {
          key,
          name:
            record.assetName ||
            "Unknown Asset",
          code:
            record.assetCode ||
            "",
          jobs: 0,
          cost: 0,
        };
      }

      map[key].jobs++;
      map[key].cost +=
        record.totalCost;
    });

    return Object.values(map)
      .sort((a, b) => b.jobs - a.jobs)
      .slice(0, 10);
  }, [filteredRecords]);

  const monthlyBreakdown = useMemo(() => {
    const map = {};

    filteredRecords.forEach((record) => {
      if (!record.date) return;

      const date = new Date(record.date);

      if (Number.isNaN(date.getTime())) {
        return;
      }

      const key = `${date.getFullYear()}-${String(
        date.getMonth() + 1
      ).padStart(2, "0")}`;

      if (!map[key]) {
        map[key] = {
          key,
          label: date.toLocaleDateString(
            undefined,
            {
              month: "short",
              year: "numeric",
            }
          ),
          jobs: 0,
          cost: 0,
        };
      }

      map[key].jobs++;
      map[key].cost +=
        record.totalCost;
    });

    return Object.values(map)
      .sort((a, b) =>
        a.key.localeCompare(b.key)
      )
      .slice(-12);
  }, [filteredRecords]);

  const maxMonthlyCost = Math.max(
    ...monthlyBreakdown.map(
      (item) => item.cost
    ),
    1
  );

  const maxTechnicianCost = Math.max(
    ...technicianBreakdown.map(
      (item) => item.cost
    ),
    1
  );

  const maxAssetJobs = Math.max(
    ...assetBreakdown.map(
      (item) => item.jobs
    ),
    1
  );

  function updateFilter(field, value) {
    setFilters((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
  }

  function exportCsv() {
    if (filteredRecords.length === 0) {
      return;
    }

    const headers = [
      "Date",
      "Asset Code",
      "Asset Name",
      "Request",
      "Work Order",
      "Repair",
      "Technician",
      "Category",
      "Priority",
      "Status",
      "Labor Cost",
      "Parts Cost",
      "Materials Cost",
      "Other Cost",
      "Total Cost",
      "Labor Hours",
    ];

    const rows = filteredRecords.map(
      (record) => [
        record.date || "",
        record.assetCode || "",
        record.assetName || "",
        record.requestNumber ||
          record.requestId ||
          "",
        record.workOrderNumber ||
          record.workOrderId ||
          "",
        record.repairNumber ||
          record.repairId ||
          "",
        record.technicianName || "",
        record.category || "",
        record.priority || "",
        record.status || "",
        record.laborCost,
        record.partsCost,
        record.materialsCost,
        record.otherCost,
        record.totalCost,
        record.laborHours,
      ]
    );

    const csv = [headers, ...rows]
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

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement("a");

    link.href = url;
    link.download = `maintenance-report-${dateOnly(
      new Date()
    )}.csv`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }

  return (
    <div className="reports-page">
      <style>{`
        * {
          box-sizing: border-box;
        }

        .reports-page {
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

        .reports-container {
          max-width: 1500px;
          margin: 0 auto;
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 20px;
          margin-bottom: 18px;
        }

        .page-title {
          margin: 0;
          font-size: 28px;
          font-weight: 780;
          letter-spacing: -.5px;
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

        .alert {
          margin-bottom: 14px;
          padding: 10px 12px;
          background: #fff7ed;
          border: 1px solid #fed7aa;
          color: #9a3412;
          border-radius: 9px;
          font-size: 12px;
        }

        .filters {
          display: flex;
          align-items: center;
          gap: 9px;
          flex-wrap: wrap;
          background: white;
          border: 1px solid #e3e7ee;
          border-radius: 12px;
          padding: 13px;
          margin-bottom: 16px;
        }

        .search {
          flex: 1 1 300px;
          min-width: 240px;
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

        .filter-control {
          width: 150px;
        }

        .date-control {
          width: 145px;
        }

        .tabs {
          display: flex;
          gap: 3px;
          background: #eef1f5;
          padding: 4px;
          border-radius: 10px;
          margin-bottom: 16px;
          overflow-x: auto;
        }

        .tab {
          border: none;
          background: transparent;
          color: #667085;
          padding: 9px 14px;
          border-radius: 7px;
          cursor: pointer;
          font-size: 11px;
          font-weight: 750;
          white-space: nowrap;
        }

        .tab.active {
          background: white;
          color: #2563eb;
          box-shadow:
            0 1px 4px
            rgba(16, 24, 40, .08);
        }

        .summary-grid {
          display: grid;
          grid-template-columns:
            repeat(6, minmax(0, 1fr));
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
            rgba(16, 24, 40, .03);
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
          color: #1d2939;
          font-size: 21px;
          font-weight: 780;
        }

        .summary-note {
          margin-top: 3px;
          color: #98a2b3;
          font-size: 9px;
        }

        .grid-2 {
          display: grid;
          grid-template-columns:
            minmax(0, 1fr)
            minmax(0, 1fr);
          gap: 15px;
          margin-bottom: 15px;
        }

        .panel {
          background: white;
          border: 1px solid #e3e7ee;
          border-radius: 12px;
          padding: 16px;
          box-shadow:
            0 2px 7px
            rgba(16, 24, 40, .03);
        }

        .panel-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 14px;
        }

        .panel-title {
          margin: 0;
          color: #344054;
          font-size: 14px;
          font-weight: 760;
        }

        .panel-subtitle {
          margin: 4px 0 0;
          color: #98a2b3;
          font-size: 10px;
        }

        .breakdown {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .breakdown-row {
          display: grid;
          grid-template-columns: 105px 1fr 80px;
          gap: 9px;
          align-items: center;
        }

        .breakdown-label {
          color: #475467;
          font-size: 10px;
          font-weight: 650;
        }

        .bar-track {
          height: 8px;
          background: #eef1f5;
          border-radius: 999px;
          overflow: hidden;
        }

        .bar {
          height: 100%;
          background: #2563eb;
          border-radius: 999px;
        }

        .breakdown-value {
          color: #344054;
          font-size: 10px;
          font-weight: 750;
          text-align: right;
        }

        .status-list {
          display: flex;
          flex-direction: column;
          gap: 9px;
        }

        .status-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .status-left {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .status-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #98a2b3;
        }

        .status-name {
          color: #475467;
          font-size: 10px;
        }

        .status-count {
          color: #344054;
          font-size: 10px;
          font-weight: 750;
        }

        .monthly-chart {
          display: flex;
          align-items: flex-end;
          gap: 11px;
          height: 200px;
          overflow-x: auto;
          padding: 8px 4px 0;
        }

        .month {
          min-width: 55px;
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-end;
          gap: 5px;
        }

        .month-cost {
          color: #667085;
          font-size: 8px;
          white-space: nowrap;
        }

        .month-area {
          height: 135px;
          width: 34px;
          display: flex;
          align-items: flex-end;
        }

        .month-bar {
          width: 100%;
          min-height: 3px;
          border-radius: 6px 6px 2px 2px;
          background: #2563eb;
        }

        .month-label {
          color: #98a2b3;
          font-size: 8px;
          white-space: nowrap;
        }

        .rank-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .rank-row {
          display: grid;
          grid-template-columns: 24px 1fr 100px;
          gap: 9px;
          align-items: center;
        }

        .rank-number {
          width: 23px;
          height: 23px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          background: #f2f4f7;
          color: #667085;
          font-size: 9px;
          font-weight: 800;
        }

        .rank-main {
          min-width: 0;
        }

        .rank-name {
          color: #344054;
          font-size: 10px;
          font-weight: 700;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .rank-sub {
          margin-top: 3px;
          color: #98a2b3;
          font-size: 8px;
        }

        .rank-bar-track {
          height: 5px;
          margin-top: 5px;
          background: #eef1f5;
          border-radius: 999px;
          overflow: hidden;
        }

        .rank-bar {
          height: 100%;
          background: #2563eb;
          border-radius: 999px;
        }

        .rank-value {
          text-align: right;
          color: #15803d;
          font-size: 10px;
          font-weight: 750;
        }

        .table-card {
          background: white;
          border: 1px solid #e3e7ee;
          border-radius: 12px;
          overflow: hidden;
          box-shadow:
            0 2px 7px
            rgba(16, 24, 40, .03);
        }

        .table-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          padding: 14px 16px;
          border-bottom: 1px solid #edf0f4;
        }

        .result-count {
          color: #667085;
          font-size: 10px;
        }

        .table-wrapper {
          overflow-x: auto;
        }

        table {
          width: 100%;
          min-width: 1150px;
          border-collapse: collapse;
        }

        th {
          padding: 11px 13px;
          background: #fafbfc;
          border-bottom: 1px solid #e8ebf0;
          color: #667085;
          text-align: left;
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

        .asset-main {
          color: #344054;
          font-weight: 720;
        }

        .asset-sub {
          margin-top: 3px;
          color: #98a2b3;
          font-size: 9px;
        }

        .reference {
          color: #2563eb;
          font-weight: 700;
        }

        .cost {
          color: #15803d;
          font-weight: 760;
          white-space: nowrap;
        }

        .status {
          display: inline-flex;
          padding: 4px 8px;
          border-radius: 999px;
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

        .view-button {
          border: 1px solid #d7dce5;
          background: white;
          color: #475467;
          border-radius: 7px;
          padding: 6px 8px;
          cursor: pointer;
          font-size: 10px;
          font-weight: 700;
        }

        .view-button:hover {
          background: #f2f4f7;
        }

        .loading,
        .empty {
          padding: 55px 20px;
          text-align: center;
          color: #98a2b3;
          font-size: 12px;
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
          justify-content: space-between;
          gap: 15px;
          padding: 18px 20px;
          border-bottom: 1px solid #edf0f4;
        }

        .modal-title {
          margin: 0;
          font-size: 18px;
          font-weight: 780;
        }

        .modal-subtitle {
          margin-top: 5px;
          color: #667085;
          font-size: 10px;
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

        .modal-total {
          margin-top: 13px;
          padding: 14px;
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          border-radius: 9px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .modal-total-label {
          color: #166534;
          font-size: 10px;
          font-weight: 750;
        }

        .modal-total-value {
          color: #15803d;
          font-size: 20px;
          font-weight: 800;
        }

        .modal-footer {
          display: flex;
          justify-content: flex-end;
          padding: 14px 20px;
          border-top: 1px solid #edf0f4;
        }

        @media (max-width: 1200px) {
          .summary-grid {
            grid-template-columns:
              repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 900px) {
          .reports-page {
            padding: 15px;
          }

          .page-header {
            flex-direction: column;
          }

          .grid-2 {
            grid-template-columns: 1fr;
          }

          .summary-grid {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 560px) {
          .summary-grid {
            grid-template-columns: 1fr;
          }

          .search,
          .filter-control,
          .date-control {
            width: 100%;
            min-width: 100%;
          }

          .detail-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="reports-container">
        <div className="page-header">
          <div>
            <h1 className="page-title">
              Maintenance Reports
            </h1>

            <p className="page-subtitle">
              Operational, financial and
              maintenance-performance reports
              across assets, technicians and
              maintenance activities.
            </p>
          </div>

          <div className="header-actions">
            <button
              className="btn"
              onClick={loadReports}
              disabled={loading}
            >
              ↻ Refresh
            </button>

            <button
              className="btn btn-primary"
              onClick={exportCsv}
              disabled={
                filteredRecords.length === 0
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

        <div className="filters">
          <div className="search">
            <input
              className="input"
              value={filters.search}
              onChange={(event) =>
                updateFilter(
                  "search",
                  event.target.value
                )
              }
              placeholder="Search asset, request, work order, technician..."
            />
          </div>

          <select
            className="select filter-control"
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
          </select>

          <input
            className="input date-control"
            type="date"
            value={filters.dateFrom}
            onChange={(event) =>
              updateFilter(
                "dateFrom",
                event.target.value
              )
            }
          />

          <input
            className="input date-control"
            type="date"
            value={filters.dateTo}
            onChange={(event) =>
              updateFilter(
                "dateTo",
                event.target.value
              )
            }
          />

          <button
            className="btn"
            onClick={clearFilters}
          >
            Clear
          </button>
        </div>

        <div className="tabs">
          <button
            className={`tab ${
              activeTab === "overview"
                ? "active"
                : ""
            }`}
            onClick={() =>
              setActiveTab("overview")
            }
          >
            Overview
          </button>

          <button
            className={`tab ${
              activeTab === "cost"
                ? "active"
                : ""
            }`}
            onClick={() =>
              setActiveTab("cost")
            }
          >
            Cost Report
          </button>

          <button
            className={`tab ${
              activeTab === "technicians"
                ? "active"
                : ""
            }`}
            onClick={() =>
              setActiveTab("technicians")
            }
          >
            Technician Report
          </button>

          <button
            className={`tab ${
              activeTab === "assets"
                ? "active"
                : ""
            }`}
            onClick={() =>
              setActiveTab("assets")
            }
          >
            Asset Report
          </button>

          <button
            className={`tab ${
              activeTab === "activity"
                ? "active"
                : ""
            }`}
            onClick={() =>
              setActiveTab("activity")
            }
          >
            Activity Report
          </button>
        </div>

        {loading ? (
          <div className="panel loading">
            Loading maintenance reports...
          </div>
        ) : (
          <>
            <div className="summary-grid">
              <div className="summary-card">
                <div className="summary-label">
                  Records
                </div>
                <div className="summary-value">
                  {summary.totalRecords}
                </div>
                <div className="summary-note">
                  Filtered maintenance records
                </div>
              </div>

              <div className="summary-card">
                <div className="summary-label">
                  Total Cost
                </div>
                <div className="summary-value">
                  {formatCurrency(
                    summary.totalCost
                  )}
                </div>
                <div className="summary-note">
                  Total maintenance expenditure
                </div>
              </div>

              <div className="summary-card">
                <div className="summary-label">
                  Completed
                </div>
                <div className="summary-value">
                  {summary.completed}
                </div>
                <div className="summary-note">
                  Completed activities
                </div>
              </div>

              <div className="summary-card">
                <div className="summary-label">
                  In Progress
                </div>
                <div className="summary-value">
                  {summary.inProgress}
                </div>
                <div className="summary-note">
                  Active maintenance work
                </div>
              </div>

              <div className="summary-card">
                <div className="summary-label">
                  Assets
                </div>
                <div className="summary-value">
                  {summary.uniqueAssets}
                </div>
                <div className="summary-note">
                  Assets with activity
                </div>
              </div>

              <div className="summary-card">
                <div className="summary-label">
                  Technicians
                </div>
                <div className="summary-value">
                  {summary.uniqueTechnicians}
                </div>
                <div className="summary-note">
                  Technicians involved
                </div>
              </div>
            </div>

            {activeTab === "overview" && (
              <>
                <div className="grid-2">
                  <div className="panel">
                    <div className="panel-header">
                      <div>
                        <h2 className="panel-title">
                          Status Distribution
                        </h2>
                        <p className="panel-subtitle">
                          Maintenance records by
                          current status.
                        </p>
                      </div>
                    </div>

                    {statusBreakdown.length ===
                    0 ? (
                      <div className="empty">
                        No status data available.
                      </div>
                    ) : (
                      <div className="status-list">
                        {statusBreakdown.map(
                          ([status, count]) => (
                            <div
                              className="status-row"
                              key={status}
                            >
                              <div className="status-left">
                                <span
                                  className="status-dot"
                                />

                                <span className="status-name">
                                  {statusLabel(
                                    status
                                  )}
                                </span>
                              </div>

                              <span className="status-count">
                                {count}
                              </span>
                            </div>
                          )
                        )}
                      </div>
                    )}
                  </div>

                  <div className="panel">
                    <div className="panel-header">
                      <div>
                        <h2 className="panel-title">
                          Cost Distribution
                        </h2>
                        <p className="panel-subtitle">
                          Maintenance expenditure
                          by cost category.
                        </p>
                      </div>
                    </div>

                    <div className="breakdown">
                      {[
                        [
                          "Labor",
                          summary.laborCost,
                        ],
                        [
                          "Parts",
                          summary.partsCost,
                        ],
                        [
                          "Materials",
                          summary.materialsCost,
                        ],
                        [
                          "Other",
                          summary.otherCost,
                        ],
                      ].map(
                        ([label, value]) => {
                          const percentage =
                            summary.totalCost
                              ? (value /
                                  summary.totalCost) *
                                100
                              : 0;

                          return (
                            <div
                              className="breakdown-row"
                              key={label}
                            >
                              <div className="breakdown-label">
                                {label}
                              </div>

                              <div className="bar-track">
                                <div
                                  className="bar"
                                  style={{
                                    width: `${percentage}%`,
                                  }}
                                />
                              </div>

                              <div className="breakdown-value">
                                {formatCurrency(
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

                <div className="panel">
                  <div className="panel-header">
                    <div>
                      <h2 className="panel-title">
                        Monthly Maintenance Trend
                      </h2>
                      <p className="panel-subtitle">
                        Maintenance expenditure
                        over the latest available
                        months.
                      </p>
                    </div>
                  </div>

                  {monthlyBreakdown.length ===
                  0 ? (
                    <div className="empty">
                      No monthly data available.
                    </div>
                  ) : (
                    <div className="monthly-chart">
                      {monthlyBreakdown.map(
                        (month) => (
                          <div
                            className="month"
                            key={month.key}
                          >
                            <div className="month-cost">
                              {formatCurrency(
                                month.cost
                              )}
                            </div>

                            <div className="month-area">
                              <div
                                className="month-bar"
                                style={{
                                  height: `${Math.max(
                                    3,
                                    (month.cost /
                                      maxMonthlyCost) *
                                      100
                                  )}%`,
                                }}
                              />
                            </div>

                            <div className="month-label">
                              {month.label}
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

            {activeTab === "cost" && (
              <>
                <div className="grid-2">
                  <div className="panel">
                    <div className="panel-header">
                      <div>
                        <h2 className="panel-title">
                          Cost Summary
                        </h2>
                        <p className="panel-subtitle">
                          Financial summary for the
                          selected period.
                        </p>
                      </div>
                    </div>

                    <div className="breakdown">
                      <div className="breakdown-row">
                        <div className="breakdown-label">
                          Labor
                        </div>
                        <div className="bar-track">
                          <div
                            className="bar"
                            style={{
                              width: `${
                                summary.totalCost
                                  ? (summary.laborCost /
                                      summary.totalCost) *
                                    100
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                        <div className="breakdown-value">
                          {formatCurrency(
                            summary.laborCost
                          )}
                        </div>
                      </div>

                      <div className="breakdown-row">
                        <div className="breakdown-label">
                          Parts
                        </div>
                        <div className="bar-track">
                          <div
                            className="bar"
                            style={{
                              width: `${
                                summary.totalCost
                                  ? (summary.partsCost /
                                      summary.totalCost) *
                                    100
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                        <div className="breakdown-value">
                          {formatCurrency(
                            summary.partsCost
                          )}
                        </div>
                      </div>

                      <div className="breakdown-row">
                        <div className="breakdown-label">
                          Materials
                        </div>
                        <div className="bar-track">
                          <div
                            className="bar"
                            style={{
                              width: `${
                                summary.totalCost
                                  ? (summary.materialsCost /
                                      summary.totalCost) *
                                    100
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                        <div className="breakdown-value">
                          {formatCurrency(
                            summary.materialsCost
                          )}
                        </div>
                      </div>

                      <div className="breakdown-row">
                        <div className="breakdown-label">
                          Other
                        </div>
                        <div className="bar-track">
                          <div
                            className="bar"
                            style={{
                              width: `${
                                summary.totalCost
                                  ? (summary.otherCost /
                                      summary.totalCost) *
                                    100
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                        <div className="breakdown-value">
                          {formatCurrency(
                            summary.otherCost
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="panel">
                    <div className="panel-header">
                      <div>
                        <h2 className="panel-title">
                          Labor Utilization
                        </h2>
                        <p className="panel-subtitle">
                          Recorded labor hours and
                          labor expenditure.
                        </p>
                      </div>
                    </div>

                    <div className="summary-value">
                      {summary.laborHours.toLocaleString()}
                    </div>

                    <div className="summary-note">
                      Total recorded labor hours
                    </div>

                    <div
                      style={{
                        marginTop: "20px",
                        color: "#15803d",
                        fontSize: "18px",
                        fontWeight: 800,
                      }}
                    >
                      {formatCurrency(
                        summary.laborCost
                      )}
                    </div>

                    <div className="summary-note">
                      Total labor expenditure
                    </div>
                  </div>
                </div>

                <div className="panel">
                  <div className="panel-header">
                    <div>
                      <h2 className="panel-title">
                        Monthly Cost Report
                      </h2>
                      <p className="panel-subtitle">
                        Cost trend for reporting
                        purposes.
                      </p>
                    </div>
                  </div>

                  {monthlyBreakdown.length ===
                  0 ? (
                    <div className="empty">
                      No cost data available.
                    </div>
                  ) : (
                    <div className="monthly-chart">
                      {monthlyBreakdown.map(
                        (month) => (
                          <div
                            className="month"
                            key={month.key}
                          >
                            <div className="month-cost">
                              {formatCurrency(
                                month.cost
                              )}
                            </div>

                            <div className="month-area">
                              <div
                                className="month-bar"
                                style={{
                                  height: `${Math.max(
                                    3,
                                    (month.cost /
                                      maxMonthlyCost) *
                                      100
                                  )}%`,
                                }}
                              />
                            </div>

                            <div className="month-label">
                              {month.label}
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

            {activeTab ===
              "technicians" && (
              <div className="panel">
                <div className="panel-header">
                  <div>
                    <h2 className="panel-title">
                      Technician Performance
                    </h2>
                    <p className="panel-subtitle">
                      Maintenance workload, labor
                      hours and cost by technician.
                    </p>
                  </div>
                </div>

                {technicianBreakdown.length ===
                0 ? (
                  <div className="empty">
                    No technician data available.
                  </div>
                ) : (
                  <div className="rank-list">
                    {technicianBreakdown.map(
                      (item, index) => (
                        <div
                          className="rank-row"
                          key={item.name}
                        >
                          <div className="rank-number">
                            {index + 1}
                          </div>

                          <div className="rank-main">
                            <div className="rank-name">
                              {item.name}
                            </div>

                            <div className="rank-sub">
                              {item.jobs} job
                              {item.jobs !== 1
                                ? "s"
                                : ""}{" "}
                              ·{" "}
                              {item.hours.toLocaleString()}{" "}
                              labor hours
                            </div>

                            <div className="rank-bar-track">
                              <div
                                className="rank-bar"
                                style={{
                                  width: `${Math.max(
                                    2,
                                    (item.cost /
                                      maxTechnicianCost) *
                                      100
                                  )}%`,
                                }}
                              />
                            </div>
                          </div>

                          <div className="rank-value">
                            {formatCurrency(
                              item.cost
                            )}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === "assets" && (
              <div className="panel">
                <div className="panel-header">
                  <div>
                    <h2 className="panel-title">
                      Asset Maintenance Report
                    </h2>
                    <p className="panel-subtitle">
                      Assets with the highest number
                      of maintenance activities.
                    </p>
                  </div>
                </div>

                {assetBreakdown.length ===
                0 ? (
                  <div className="empty">
                    No asset data available.
                  </div>
                ) : (
                  <div className="rank-list">
                    {assetBreakdown.map(
                      (item, index) => (
                        <div
                          className="rank-row"
                          key={item.key}
                        >
                          <div className="rank-number">
                            {index + 1}
                          </div>

                          <div className="rank-main">
                            <div className="rank-name">
                              {item.code ||
                                item.name}
                            </div>

                            <div className="rank-sub">
                              {item.name}
                              {" · "}
                              {item.jobs} maintenance
                              activity
                              {item.jobs !== 1
                                ? "ies"
                                : ""}
                            </div>

                            <div className="rank-bar-track">
                              <div
                                className="rank-bar"
                                style={{
                                  width: `${Math.max(
                                    2,
                                    (item.jobs /
                                      maxAssetJobs) *
                                      100
                                  )}%`,
                                }}
                              />
                            </div>
                          </div>

                          <div className="rank-value">
                            {formatCurrency(
                              item.cost
                            )}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === "activity" && (
              <div className="table-card">
                <div className="table-header">
                  <div>
                    <h2 className="panel-title">
                      Maintenance Activity Report
                    </h2>
                  </div>

                  <div className="result-count">
                    {filteredRecords.length} record
                    {filteredRecords.length !==
                    1
                      ? "s"
                      : ""}
                  </div>
                </div>

                {filteredRecords.length ===
                0 ? (
                  <div className="empty">
                    No maintenance activity found.
                  </div>
                ) : (
                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Asset</th>
                          <th>Request</th>
                          <th>Work Order</th>
                          <th>Repair</th>
                          <th>Technician</th>
                          <th>Status</th>
                          <th>Total Cost</th>
                          <th />
                        </tr>
                      </thead>

                      <tbody>
                        {filteredRecords.map(
                          (record) => (
                            <tr
                              key={record.id}
                            >
                              <td>
                                {formatDate(
                                  record.date
                                )}
                              </td>

                              <td>
                                <div className="asset-main">
                                  {record.assetCode ||
                                    record.assetName ||
                                    "—"}
                                </div>

                                {record.assetCode &&
                                  record.assetName && (
                                    <div className="asset-sub">
                                      {
                                        record.assetName
                                      }
                                    </div>
                                  )}
                              </td>

                              <td>
                                <span className="reference">
                                  {record.requestNumber ||
                                    (record.requestId
                                      ? `REQ-${record.requestId}`
                                      : "—")}
                                </span>
                              </td>

                              <td>
                                <span className="reference">
                                  {record.workOrderNumber ||
                                    (record.workOrderId
                                      ? `WO-${record.workOrderId}`
                                      : "—")}
                                </span>
                              </td>

                              <td>
                                <span className="reference">
                                  {record.repairNumber ||
                                    (record.repairId
                                      ? `RP-${record.repairId}`
                                      : "—")}
                                </span>
                              </td>

                              <td>
                                {record.technicianName ||
                                  "Unassigned"}
                              </td>

                              <td>
                                <span
                                  className={`status ${statusClass(
                                    record.status
                                  )}`}
                                >
                                  {statusLabel(
                                    record.status
                                  )}
                                </span>
                              </td>

                              <td>
                                <span className="cost">
                                  {formatCurrency(
                                    record.totalCost
                                  )}
                                </span>
                              </td>

                              <td>
                                <button
                                  className="view-button"
                                  onClick={() =>
                                    setSelectedRecord(
                                      record
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
                )}
              </div>
            )}

            {activeTab !== "activity" &&
              activeTab !== "technicians" &&
              activeTab !== "assets" &&
              activeTab !== "overview" &&
              activeTab !== "cost" && (
                <div className="panel empty">
                  Select a report type.
                </div>
              )}
          </>
        )}

        <div
          className="table-card"
          style={{ marginTop: "16px" }}
        >
          <div className="table-header">
            <div>
              <h2 className="panel-title">
                Report Data
              </h2>
            </div>

            <div className="result-count">
              {filteredRecords.length} record
              {filteredRecords.length !== 1
                ? "s"
                : ""}
            </div>
          </div>

          {loading ? (
            <div className="loading">
              Loading...
            </div>
          ) : filteredRecords.length ===
            0 ? (
            <div className="empty">
              No records match the selected
              filters.
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Asset</th>
                    <th>Work Order</th>
                    <th>Technician</th>
                    <th>Category</th>
                    <th>Status</th>
                    <th>Labor</th>
                    <th>Parts</th>
                    <th>Materials</th>
                    <th>Other</th>
                    <th>Total</th>
                    <th />
                  </tr>
                </thead>

                <tbody>
                  {filteredRecords.map(
                    (record) => (
                      <tr key={`data-${record.id}`}>
                        <td>
                          {formatDate(
                            record.date
                          )}
                        </td>

                        <td>
                          <div className="asset-main">
                            {record.assetCode ||
                              record.assetName ||
                              "—"}
                          </div>

                          {record.assetCode &&
                            record.assetName && (
                              <div className="asset-sub">
                                {record.assetName}
                              </div>
                            )}
                        </td>

                        <td>
                          <span className="reference">
                            {record.workOrderNumber ||
                              (record.workOrderId
                                ? `WO-${record.workOrderId}`
                                : "—")}
                          </span>
                        </td>

                        <td>
                          {record.technicianName ||
                            "Unassigned"}
                        </td>

                        <td>
                          {record.category}
                        </td>

                        <td>
                          <span
                            className={`status ${statusClass(
                              record.status
                            )}`}
                          >
                            {statusLabel(
                              record.status
                            )}
                          </span>
                        </td>

                        <td>
                          {formatCurrency(
                            record.laborCost
                          )}
                        </td>

                        <td>
                          {formatCurrency(
                            record.partsCost
                          )}
                        </td>

                        <td>
                          {formatCurrency(
                            record.materialsCost
                          )}
                        </td>

                        <td>
                          {formatCurrency(
                            record.otherCost
                          )}
                        </td>

                        <td>
                          <span className="cost">
                            {formatCurrency(
                              record.totalCost
                            )}
                          </span>
                        </td>

                        <td>
                          <button
                            className="view-button"
                            onClick={() =>
                              setSelectedRecord(
                                record
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
          )}
        </div>
      </div>

      {selectedRecord && (
        <div
          className="modal-overlay"
          onClick={() =>
            setSelectedRecord(null)
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
                  Maintenance Report Detail
                </h2>

                <div className="modal-subtitle">
                  Record #
                  {selectedRecord.id}
                </div>
              </div>

              <button
                className="close-button"
                onClick={() =>
                  setSelectedRecord(null)
                }
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="detail-grid">
                <div className="detail-item">
                  <div className="detail-label">
                    Date
                  </div>
                  <div className="detail-value">
                    {formatDate(
                      selectedRecord.date
                    )}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    Status
                  </div>
                  <div className="detail-value">
                    <span
                      className={`status ${statusClass(
                        selectedRecord.status
                      )}`}
                    >
                      {statusLabel(
                        selectedRecord.status
                      )}
                    </span>
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    Asset
                  </div>
                  <div className="detail-value">
                    {selectedRecord.assetCode ||
                      selectedRecord.assetName ||
                      (selectedRecord.assetId
                        ? `Asset #${selectedRecord.assetId}`
                        : "—")}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    Technician
                  </div>
                  <div className="detail-value">
                    {selectedRecord.technicianName ||
                      "Unassigned"}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    Request
                  </div>
                  <div className="detail-value">
                    {selectedRecord.requestNumber ||
                      (selectedRecord.requestId
                        ? `REQ-${selectedRecord.requestId}`
                        : "—")}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    Work Order
                  </div>
                  <div className="detail-value">
                    {selectedRecord.workOrderNumber ||
                      (selectedRecord.workOrderId
                        ? `WO-${selectedRecord.workOrderId}`
                        : "—")}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    Repair
                  </div>
                  <div className="detail-value">
                    {selectedRecord.repairNumber ||
                      (selectedRecord.repairId
                        ? `RP-${selectedRecord.repairId}`
                        : "—")}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    Category
                  </div>
                  <div className="detail-value">
                    {selectedRecord.category ||
                      "—"}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    Priority
                  </div>
                  <div className="detail-value">
                    {selectedRecord.priority ||
                      "—"}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    Labor Hours
                  </div>
                  <div className="detail-value">
                    {selectedRecord.laborHours.toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="detail-grid"
                style={{ marginTop: "10px" }}
              >
                <div className="detail-item">
                  <div className="detail-label">
                    Labor Cost
                  </div>
                  <div className="detail-value">
                    {formatCurrency(
                      selectedRecord.laborCost
                    )}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    Parts Cost
                  </div>
                  <div className="detail-value">
                    {formatCurrency(
                      selectedRecord.partsCost
                    )}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    Materials Cost
                  </div>
                  <div className="detail-value">
                    {formatCurrency(
                      selectedRecord.materialsCost
                    )}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    Other Cost
                  </div>
                  <div className="detail-value">
                    {formatCurrency(
                      selectedRecord.otherCost
                    )}
                  </div>
                </div>
              </div>

              <div className="modal-total">
                <span className="modal-total-label">
                  Total Maintenance Cost
                </span>

                <span className="modal-total-value">
                  {formatCurrency(
                    selectedRecord.totalCost
                  )}
                </span>
              </div>

              <div
                className="detail-item"
                style={{ marginTop: "12px" }}
              >
                <div className="detail-label">
                  Description
                </div>

                <div
                  className="detail-value"
                  style={{
                    lineHeight: 1.6,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {selectedRecord.description ||
                    "No description recorded."}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn"
                onClick={() =>
                  setSelectedRecord(null)
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
