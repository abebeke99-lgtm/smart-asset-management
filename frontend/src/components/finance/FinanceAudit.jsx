import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLanguage } from "../../contexts/UiContext";
import { toast } from "react-toastify";
import axios from "axios";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";

const FinanceAudit = () => {
  const { language, theme } = useLanguage();

  const isDark = theme === "dark";

  const t =
    language === "en"
      ? englishTranslations
      : amharicTranslations;

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const [selectedLog, setSelectedLog] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const [filters, setFilters] = useState({
    search: "",
    action: "",
    module: "",
    user: "",
    dateFrom: "",
    dateTo: "",
    status: "",
    assetId: "",
  });

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;
  const [totalItems, setTotalItems] = useState(0);

  const [serverTotalPages, setServerTotalPages] = useState(1);

  const API_URL = (
    process.env.REACT_APP_API_URL ||
    "http://localhost:5000/api"
  ).replace(/\/$/, "");

  const getToken = () =>
    localStorage.getItem("token") ||
    localStorage.getItem("accessToken") ||
    "";

  const api = useMemo(() => {
    return axios.create({
      baseURL: API_URL,
      headers: {
        Accept: "application/json",
      },
    });
  }, [API_URL]);

  const normalizeLog = (item = {}) => ({
    id:
      item.id ??
      item.audit_id ??
      item.auditId,

    audit_id:
      item.audit_id ??
      item.auditId ??
      item.id,

    user_id:
      item.user_id ??
      item.userId,

    username:
      item.username ??
      item.user_name ??
      item.userName ??
      item.name ??
      "",

    user_role:
      item.user_role ??
      item.userRole ??
      item.role ??
      "",

    action:
      item.action ??
      item.action_type ??
      item.actionType ??
      "",

    module:
      item.module ??
      item.module_name ??
      item.moduleName ??
      "",

    asset_id:
      item.asset_id ??
      item.assetId ??
      "",

    asset_tag:
      item.asset_tag ??
      item.assetTag ??
      "",

    asset_name:
      item.asset_name ??
      item.assetName ??
      "",

    old_value:
      item.old_value ??
      item.oldValue ??
      null,

    new_value:
      item.new_value ??
      item.newValue ??
      null,

    difference:
      item.difference ??
      item.change_amount ??
      item.changeAmount ??
      null,

    reason:
      item.reason ??
      "",

    notes:
      item.notes ??
      "",

    timestamp:
      item.timestamp ??
      item.created_at ??
      item.createdAt ??
      item.date ??
      "",

    status:
      item.status ??
      "",

    ip_address:
      item.ip_address ??
      item.ipAddress ??
      "",

    session_id:
      item.session_id ??
      item.sessionId ??
      "",

    user_agent:
      item.user_agent ??
      item.userAgent ??
      "",
  });

  const extractLogs = (data) => {
    if (Array.isArray(data)) {
      return data;
    }

    if (!data || typeof data !== "object") {
      return [];
    }

    const candidates = [
      data.logs,
      data.auditLogs,
      data.audit_logs,
      data.records,
      data.items,
      data.rows,
      data.results,
      data.data,
    ];

    for (const value of candidates) {
      if (Array.isArray(value)) {
        return value;
      }
    }

    if (
      data.data &&
      typeof data.data === "object"
    ) {
      return extractLogs(data.data);
    }

    return [];
  };

  const extractTotal = (data, fallback) => {
    if (!data || typeof data !== "object") {
      return fallback;
    }

    const values = [
      data.total,
      data.totalItems,
      data.total_items,
      data.count,
      data.pagination?.total,
      data.meta?.total,
      data.data?.total,
    ];

    const value = values.find(
      (item) =>
        item !== undefined &&
        item !== null &&
        !Number.isNaN(Number(item))
    );

    return value !== undefined
      ? Number(value)
      : fallback;
  };

  const fetchLogs = useCallback(async () => {
    setLoading(true);

    try {
      const token = getToken();

      const params = {
        page: currentPage,
        limit: itemsPerPage,
      };

      if (filters.action) {
        params.action = filters.action;
      }

      if (filters.module) {
        params.module = filters.module;
      }

      if (filters.user) {
        params.user = filters.user;
      }

      if (filters.status) {
        params.status = filters.status;
      }

      if (filters.dateFrom) {
        params.dateFrom = filters.dateFrom;
      }

      if (filters.dateTo) {
        params.dateTo = filters.dateTo;
      }

      if (filters.assetId) {
        params.assetId = filters.assetId;
      }

      const response = await api.get(
        "/finance/audit",
        {
          params,
          headers: token
            ? {
                Authorization: `Bearer ${token}`,
              }
            : {},
        }
      );

      const rows = extractLogs(
        response.data
      ).map(normalizeLog);

      const total = extractTotal(
        response.data,
        rows.length
      );

      setLogs(rows);
      setTotalItems(total);

      setServerTotalPages(
        Math.max(
          1,
          Math.ceil(
            total / itemsPerPage
          )
        )
      );
    } catch (error) {
      console.error(
        "Finance audit fetch error:",
        error
      );

      setLogs([]);
      setTotalItems(0);
      setServerTotalPages(1);

      toast.error(
        error.response?.data?.message ||
          t.fetchError
      );
    } finally {
      setLoading(false);
    }
  }, [
    api,
    currentPage,
    filters.action,
    filters.module,
    filters.user,
    filters.status,
    filters.dateFrom,
    filters.dateTo,
    filters.assetId,
    t.fetchError,
  ]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleFilterChange = (
    key,
    value
  ) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));

    setCurrentPage(1);
  };

  const clearFilters = () => {
    setFilters({
      search: "",
      action: "",
      module: "",
      user: "",
      dateFrom: "",
      dateTo: "",
      status: "",
      assetId: "",
    });

    setCurrentPage(1);
  };

  const uniqueActions = useMemo(
    () =>
      [
        ...new Set(
          logs
            .map((log) => log.action)
            .filter(Boolean)
        ),
      ].sort(),
    [logs]
  );

  const uniqueModules = useMemo(
    () =>
      [
        ...new Set(
          logs
            .map((log) => log.module)
            .filter(Boolean)
        ),
      ].sort(),
    [logs]
  );

  const uniqueUsers = useMemo(
    () =>
      [
        ...new Set(
          logs
            .map((log) => log.username)
            .filter(Boolean)
        ),
      ].sort(),
    [logs]
  );

  const filteredLogs = useMemo(() => {
    const term =
      filters.search.trim().toLowerCase();

    if (!term) {
      return logs;
    }

    return logs.filter((log) =>
      [
        log.audit_id,
        log.username,
        log.user_role,
        log.action,
        log.module,
        log.asset_id,
        log.asset_tag,
        log.asset_name,
        log.reason,
        log.notes,
        log.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [logs, filters.search]);

  const getActionColor = (action) => {
    const value = String(
      action || ""
    ).toUpperCase();

    if (
      value.includes("DELETE") ||
      value.includes("DISPOSE") ||
      value.includes("WRITE_OFF")
    ) {
      return "#dc2626";
    }

    if (
      value.includes("CREATE") ||
      value.includes("ADD") ||
      value.includes("RECEIVE")
    ) {
      return "#16a34a";
    }

    if (
      value.includes("VALUATION") ||
      value.includes("REVALUATION")
    ) {
      return "#7c3aed";
    }

    if (
      value.includes("DEPRECIATION") ||
      value.includes("ADJUST")
    ) {
      return "#ea580c";
    }

    if (
      value.includes("UPDATE") ||
      value.includes("CHANGE")
    ) {
      return "#0284c7";
    }

    return "#64748b";
  };

  const getActionLabel = (action) => {
    if (!action) return "—";

    const labels = {
      VALUATION_CHANGE:
        "Valuation Change",

      PURCHASE_COST_CHANGE:
        "Purchase Cost Change",

      RESIDUAL_VALUE_CHANGE:
        "Residual Value Change",

      USEFUL_LIFE_CHANGE:
        "Useful Life Change",

      DEPRECIATION_ADJUST:
        "Depreciation Adjustment",

      ASSET_DISPOSED:
        "Asset Disposed",

      ASSET_WRITTEN_OFF:
        "Asset Written Off",

      FINANCIAL_RECORD_CREATED:
        "Financial Record Created",

      FINANCIAL_RECORD_DELETED:
        "Financial Record Deleted",

      FINANCIAL_RECORD_VOIDED:
        "Financial Record Voided",

      REVALUATION:
        "Revaluation",

      COST_ADDITION:
        "Cost Addition",

      CREATE:
        "Created",

      UPDATE:
        "Updated",

      DELETE:
        "Deleted",
    };

    return (
      labels[action] ||
      String(action)
        .replace(/_/g, " ")
        .replace(/\b\w/g, (char) =>
          char.toUpperCase()
        )
    );
  };

  const getStatusColor = (status) => {
    const value = String(
      status || ""
    ).toLowerCase();

    if (
      value === "success" ||
      value === "successful" ||
      value === "completed"
    ) {
      return "#16a34a";
    }

    if (
      value === "failed" ||
      value === "error"
    ) {
      return "#dc2626";
    }

    if (
      value.includes("pending") ||
      value.includes("review")
    ) {
      return "#d97706";
    }

    return "#64748b";
  };

  const formatMoney = (value) => {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return "—";
    }

    const number = Number(value);

    if (Number.isNaN(number)) {
      return String(value);
    }

    return number.toLocaleString(
      undefined,
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    );
  };

  const formatDate = (value) => {
    if (!value) {
      return "—";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    return date.toLocaleString();
  };

  const handleLogClick = (log) => {
    setSelectedLog(log);
    setShowDetailModal(true);
  };

  const closeModal = () => {
    setSelectedLog(null);
    setShowDetailModal(false);
  };

  const exportToExcel = async () => {
    if (!filteredLogs.length) {
      toast.info(t.noLogs);
      return;
    }

    setExporting(true);

    try {
      const data =
        filteredLogs.map((log) => ({
          "Audit ID":
            log.audit_id || "",

          User:
            log.username || "",

          Role:
            log.user_role || "",

          Action:
            getActionLabel(
              log.action
            ),

          Module:
            log.module || "",

          "Asset ID":
            log.asset_id || "",

          "Asset Tag":
            log.asset_tag || "",

          "Asset Name":
            log.asset_name || "",

          "Old Value":
            log.old_value ?? "",

          "New Value":
            log.new_value ?? "",

          Difference:
            log.difference ?? "",

          Reason:
            log.reason || "",

          Notes:
            log.notes || "",

          Status:
            log.status || "",

          Timestamp:
            formatDate(
              log.timestamp
            ),

          "IP Address":
            log.ip_address || "",

          "Session ID":
            log.session_id || "",
        }));

      const worksheet =
        XLSX.utils.json_to_sheet(data);

      worksheet["!cols"] = [
        { wch: 18 },
        { wch: 22 },
        { wch: 20 },
        { wch: 25 },
        { wch: 22 },
        { wch: 16 },
        { wch: 16 },
        { wch: 25 },
        { wch: 16 },
        { wch: 16 },
        { wch: 16 },
        { wch: 35 },
        { wch: 35 },
        { wch: 18 },
        { wch: 25 },
        { wch: 20 },
        { wch: 22 },
      ];

      const workbook =
        XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        "Finance Audit"
      );

      XLSX.writeFile(
        workbook,
        "finance_audit_trail.xlsx"
      );

      toast.success(
        t.exportSuccess
      );
    } catch (error) {
      console.error(
        "Excel export error:",
        error
      );

      toast.error(
        "Excel export failed"
      );
    } finally {
      setExporting(false);
    }
  };

  const exportToPDF = async () => {
    if (!filteredLogs.length) {
      toast.info(t.noLogs);
      return;
    }

    setExporting(true);

    try {
      const doc = new jsPDF(
        "landscape",
        "mm",
        "a4"
      );

      doc.setFontSize(17);
      doc.setTextColor(
        isDark ? 200 : 26,
        isDark ? 220 : 54,
        isDark ? 245 : 93
      );

      doc.text(
        t.auditTrail,
        14,
        18
      );

      doc.setFontSize(9);
      doc.setTextColor(
        100,
        116,
        139
      );

      doc.text(
        `Generated: ${new Date().toLocaleString()}`,
        14,
        25
      );

      doc.text(
        `Records: ${filteredLogs.length}`,
        14,
        31
      );

      const tableData =
        filteredLogs
          .slice(0, 100)
          .map((log) => [
            log.audit_id || "",
            log.username || "",
            getActionLabel(
              log.action
            ),
            log.module || "",
            log.asset_tag || "",
            log.old_value !== null &&
            log.old_value !== undefined
              ? formatMoney(
                  log.old_value
                )
              : "",
            log.new_value !== null &&
            log.new_value !== undefined
              ? formatMoney(
                  log.new_value
                )
              : "",
            log.status || "",
            formatDate(
              log.timestamp
            ),
          ]);

      doc.autoTable({
        head: [
          [
            t.auditId,
            t.user,
            t.action,
            t.module,
            t.asset,
            t.oldValue,
            t.newValue,
            t.status,
            t.timestamp,
          ],
        ],

        body: tableData,

        startY: 37,

        theme: "grid",

        styles: {
          fontSize: 7,
          cellPadding: 2,
        },

        headStyles: {
          fillColor: [
            14,
            165,
            233,
          ],
          textColor: 255,
          fontStyle: "bold",
        },

        alternateRowStyles: {
          fillColor: [
            248,
            250,
            252,
          ],
        },
      });

      doc.save(
        "finance_audit_trail.pdf"
      );

      toast.success(
        t.exportSuccess
      );
    } catch (error) {
      console.error(
        "PDF export error:",
        error
      );

      toast.error(
        "PDF export failed"
      );
    } finally {
      setExporting(false);
    }
  };

  const totalPages =
    Math.max(
      serverTotalPages,
      1
    );

  const firstRecord =
    totalItems === 0
      ? 0
      : (currentPage - 1) *
          itemsPerPage +
        1;

  const lastRecord =
    Math.min(
      currentPage *
        itemsPerPage,
      totalItems
    );

  const styles = {
    container: {
      minHeight: "100vh",
      padding: "28px",
      background: isDark
        ? "#0f172a"
        : "#f8fafc",
      color: isDark
        ? "#e2e8f0"
        : "#0f172a",
    },

    header: {
      display: "flex",
      justifyContent:
        "space-between",
      alignItems: "flex-start",
      gap: "20px",
      flexWrap: "wrap",
      marginBottom: "22px",
    },

    title: {
      margin: 0,
      color: isDark
        ? "#e2e8f0"
        : "#0f172a",
      fontSize: "28px",
      fontWeight: 750,
    },

    subtitle: {
      margin: "6px 0 0",
      color: isDark
        ? "#94a3b8"
        : "#64748b",
      fontSize: "14px",
    },

    headerActions: {
      display: "flex",
      gap: "9px",
      flexWrap: "wrap",
    },

    button: {
      border: "1px solid #cbd5e1",
      background: isDark
        ? "#1e293b"
        : "#ffffff",
      color: isDark
        ? "#e2e8f0"
        : "#334155",
      borderRadius: "9px",
      padding: "9px 14px",
      cursor: "pointer",
      fontSize: "13px",
      fontWeight: 650,
    },

    primaryButton: {
      background: "#0ea5e9",
      borderColor: "#0ea5e9",
      color: "#fff",
    },

    filtersBar: {
      display: "grid",
      gridTemplateColumns:
        "repeat(auto-fit, minmax(150px, 1fr))",
      gap: "12px",
      padding: "18px",
      marginBottom: "18px",
      background: isDark
        ? "#1e293b"
        : "#ffffff",
      border: `1px solid ${
        isDark
          ? "#334155"
          : "#e2e8f0"
      }`,
      borderRadius: "14px",
    },

    filterGroup: {
      display: "flex",
      flexDirection: "column",
      gap: "6px",
    },

    filterLabel: {
      color: isDark
        ? "#94a3b8"
        : "#64748b",
      fontSize: "10px",
      fontWeight: 750,
      textTransform:
        "uppercase",
      letterSpacing: "0.05em",
    },

    filterInput: {
      width: "100%",
      height: "40px",
      padding: "0 10px",
      borderRadius: "8px",
      border: `1px solid ${
        isDark
          ? "#475569"
          : "#cbd5e1"
      }`,
      background: isDark
        ? "#0f172a"
        : "#ffffff",
      color: isDark
        ? "#e2e8f0"
        : "#0f172a",
      outline: "none",
    },

    tableWrapper: {
      overflowX: "auto",
      background: isDark
        ? "#1e293b"
        : "#ffffff",
      borderRadius: "14px",
      border: `1px solid ${
        isDark
          ? "#334155"
          : "#e2e8f0"
      }`,
      boxShadow:
        "0 4px 14px rgba(15,23,42,0.05)",
    },

    table: {
      width: "100%",
      minWidth: "1050px",
      borderCollapse:
        "collapse",
    },

    th: {
      padding: "12px 14px",
      textAlign: "left",
      background: isDark
        ? "#0f172a"
        : "#f1f5f9",
      color: isDark
        ? "#cbd5e1"
        : "#475569",
      borderBottom: `1px solid ${
        isDark
          ? "#334155"
          : "#e2e8f0"
      }`,
      fontSize: "11px",
      textTransform:
        "uppercase",
      letterSpacing: "0.04em",
      whiteSpace:
        "nowrap",
    },

    td: {
      padding: "12px 14px",
      borderBottom: `1px solid ${
        isDark
          ? "#334155"
          : "#eef2f7"
      }`,
      color: isDark
        ? "#e2e8f0"
        : "#334155",
      fontSize: "12px",
      verticalAlign: "middle",
    },

    modal: {
      position: "fixed",
      inset: 0,
      zIndex: 1000,
      display: "flex",
      justifyContent:
        "center",
      alignItems: "center",
      padding: "20px",
      background:
        "rgba(15,23,42,0.68)",
      backdropFilter:
        "blur(4px)",
    },

    modalContent: {
      width: "100%",
      maxWidth: "850px",
      maxHeight: "90vh",
      overflowY: "auto",
      background: isDark
        ? "#1e293b"
        : "#ffffff",
      borderRadius: "16px",
      border: `1px solid ${
        isDark
          ? "#334155"
          : "#e2e8f0"
      }`,
      padding: "22px",
    },

    detailGrid: {
      display: "grid",
      gridTemplateColumns:
        "repeat(2, minmax(0, 1fr))",
      gap: "12px",
    },

    detailItem: {
      padding: "13px",
      borderRadius: "9px",
      background: isDark
        ? "#0f172a"
        : "#f8fafc",
      border: `1px solid ${
        isDark
          ? "#334155"
          : "#e2e8f0"
      }`,
    },

    detailLabel: {
      fontSize: "10px",
      color: isDark
        ? "#94a3b8"
        : "#64748b",
      textTransform:
        "uppercase",
      fontWeight: 750,
      letterSpacing: "0.04em",
    },

    detailValue: {
      marginTop: "5px",
      color: isDark
        ? "#e2e8f0"
        : "#0f172a",
      fontSize: "13px",
      fontWeight: 600,
      overflowWrap:
        "anywhere",
    },

    pagination: {
      display: "flex",
      justifyContent:
        "space-between",
      alignItems: "center",
      gap: "15px",
      flexWrap: "wrap",
      padding: "16px 0",
      color: isDark
        ? "#94a3b8"
        : "#64748b",
      fontSize: "12px",
    },

    pageButton: {
      minWidth: "36px",
      height: "36px",
      marginLeft: "5px",
      borderRadius: "8px",
      border: `1px solid ${
        isDark
          ? "#475569"
          : "#cbd5e1"
      }`,
      background: isDark
        ? "#1e293b"
        : "#ffffff",
      color: isDark
        ? "#e2e8f0"
        : "#334155",
      cursor: "pointer",
    },
  };

  if (loading && logs.length === 0) {
    return (
      <div style={styles.container}>
        <div
          style={{
            textAlign: "center",
            paddingTop: "100px",
            color: isDark
              ? "#94a3b8"
              : "#64748b",
          }}
        >
          <div
            style={{
              fontSize: "34px",
              marginBottom: "12px",
            }}
          >
            ⏳
          </div>

          {t.loading}
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>
            🔍 {t.auditTrail}
          </h1>

          <p style={styles.subtitle}>
            {t.auditDesc}
          </p>
        </div>

        <div style={styles.headerActions}>
          <button
            type="button"
            style={{
              ...styles.button,
              ...styles.primaryButton,
              opacity: exporting
                ? 0.6
                : 1,
            }}
            disabled={exporting}
            onClick={exportToExcel}
          >
            📥 {t.exportExcel}
          </button>

          <button
            type="button"
            style={{
              ...styles.button,
              opacity: exporting
                ? 0.6
                : 1,
            }}
            disabled={exporting}
            onClick={exportToPDF}
          >
            📄 {t.exportPDF}
          </button>

          <button
            type="button"
            style={styles.button}
            onClick={fetchLogs}
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      <div style={styles.filtersBar}>
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>
            {t.search}
          </label>

          <input
            type="text"
            style={styles.filterInput}
            placeholder={
              t.searchPlaceholder
            }
            value={filters.search}
            onChange={(event) =>
              handleFilterChange(
                "search",
                event.target.value
              )
            }
          />
        </div>

        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>
            {t.action}
          </label>

          <select
            style={styles.filterInput}
            value={filters.action}
            onChange={(event) =>
              handleFilterChange(
                "action",
                event.target.value
              )
            }
          >
            <option value="">
              {t.allActions}
            </option>

            {uniqueActions.map(
              (action) => (
                <option
                  key={action}
                  value={action}
                >
                  {getActionLabel(
                    action
                  )}
                </option>
              )
            )}
          </select>
        </div>

        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>
            {t.module}
          </label>

          <select
            style={styles.filterInput}
            value={filters.module}
            onChange={(event) =>
              handleFilterChange(
                "module",
                event.target.value
              )
            }
          >
            <option value="">
              {t.allModules}
            </option>

            {uniqueModules.map(
              (module) => (
                <option
                  key={module}
                  value={module}
                >
                  {module}
                </option>
              )
            )}
          </select>
        </div>

        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>
            {t.user}
          </label>

          <select
            style={styles.filterInput}
            value={filters.user}
            onChange={(event) =>
              handleFilterChange(
                "user",
                event.target.value
              )
            }
          >
            <option value="">
              {t.allUsers}
            </option>

            {uniqueUsers.map(
              (username) => (
                <option
                  key={username}
                  value={username}
                >
                  {username}
                </option>
              )
            )}
          </select>
        </div>

        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>
            {t.status}
          </label>

          <select
            style={styles.filterInput}
            value={filters.status}
            onChange={(event) =>
              handleFilterChange(
                "status",
                event.target.value
              )
            }
          >
            <option value="">
              All Statuses
            </option>

            <option value="Success">
              Success
            </option>

            <option value="Failed">
              Failed
            </option>

            <option value="Pending Review">
              Pending Review
            </option>
          </select>
        </div>

        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>
            {t.assetId}
          </label>

          <input
            type="text"
            style={styles.filterInput}
            placeholder="Asset ID / Tag"
            value={filters.assetId}
            onChange={(event) =>
              handleFilterChange(
                "assetId",
                event.target.value
              )
            }
          />
        </div>

        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>
            {t.dateFrom}
          </label>

          <input
            type="date"
            style={styles.filterInput}
            value={filters.dateFrom}
            onChange={(event) =>
              handleFilterChange(
                "dateFrom",
                event.target.value
              )
            }
          />
        </div>

        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>
            {t.dateTo}
          </label>

          <input
            type="date"
            style={styles.filterInput}
            value={filters.dateTo}
            onChange={(event) =>
              handleFilterChange(
                "dateTo",
                event.target.value
              )
            }
          />
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
          }}
        >
          <button
            type="button"
            style={{
              ...styles.button,
              width: "100%",
            }}
            onClick={clearFilters}
          >
            ✕ {t.clearFilters}
          </button>
        </div>
      </div>

      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>
                {t.auditId}
              </th>

              <th style={styles.th}>
                {t.user}
              </th>

              <th style={styles.th}>
                {t.action}
              </th>

              <th style={styles.th}>
                {t.module}
              </th>

              <th style={styles.th}>
                {t.asset}
              </th>

              <th style={styles.th}>
                {t.oldValue}
              </th>

              <th style={styles.th}>
                {t.newValue}
              </th>

              <th style={styles.th}>
                {t.status}
              </th>

              <th style={styles.th}>
                {t.timestamp}
              </th>
            </tr>
          </thead>

          <tbody>
            {filteredLogs.length === 0 ? (
              <tr>
                <td
                  colSpan="9"
                  style={{
                    ...styles.td,
                    textAlign:
                      "center",
                    padding:
                      "55px 20px",
                  }}
                >
                  <div
                    style={{
                      fontSize:
                        "28px",
                      marginBottom:
                        "8px",
                    }}
                  >
                    📋
                  </div>

                  <strong>
                    {t.noLogs}
                  </strong>

                  <div
                    style={{
                      marginTop:
                        "5px",
                      color:
                        isDark
                          ? "#94a3b8"
                          : "#64748b",
                    }}
                  >
                    No audit records
                    were returned by
                    the backend.
                  </div>
                </td>
              </tr>
            ) : (
              filteredLogs.map(
                (log) => (
                  <tr
                    key={
                      log.id ||
                      log.audit_id
                    }
                    onClick={() =>
                      handleLogClick(
                        log
                      )
                    }
                    style={{
                      cursor:
                        "pointer",
                    }}
                  >
                    <td
                      style={
                        styles.td
                      }
                    >
                      <span
                        style={{
                          display:
                            "inline-block",
                          padding:
                            "4px 8px",
                          borderRadius:
                            "6px",
                          background:
                            isDark
                              ? "#0f3b59"
                              : "#e0f2fe",
                          color:
                            isDark
                              ? "#7dd3fc"
                              : "#0369a1",
                          fontWeight:
                            700,
                          fontSize:
                            "11px",
                        }}
                      >
                        {log.audit_id ||
                          "—"}
                      </span>
                    </td>

                    <td
                      style={
                        styles.td
                      }
                    >
                      <div
                        style={{
                          fontWeight:
                            650,
                        }}
                      >
                        {log.username ||
                          "—"}
                      </div>

                      {log.user_role && (
                        <div
                          style={{
                            marginTop:
                              "3px",
                            fontSize:
                              "10px",
                            color:
                              isDark
                                ? "#94a3b8"
                                : "#64748b",
                          }}
                        >
                          {
                            log.user_role
                          }
                        </div>
                      )}
                    </td>

                    <td
                      style={
                        styles.td
                      }
                    >
                      <span
                        style={{
                          color:
                            getActionColor(
                              log.action
                            ),
                          fontWeight:
                            700,
                        }}
                      >
                        {getActionLabel(
                          log.action
                        )}
                      </span>
                    </td>

                    <td
                      style={
                        styles.td
                      }
                    >
                      {log.module ||
                        "—"}
                    </td>

                    <td
                      style={
                        styles.td
                      }
                    >
                      {log.asset_tag ? (
                        <>
                          <span
                            style={{
                              fontWeight:
                                700,
                            }}
                          >
                            {
                              log.asset_tag
                            }
                          </span>

                          {log.asset_name && (
                            <div
                              style={{
                                marginTop:
                                  "3px",
                                fontSize:
                                  "10px",
                                color:
                                  isDark
                                    ? "#94a3b8"
                                    : "#64748b",
                              }}
                            >
                              {
                                log.asset_name
                              }
                            </div>
                          )}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>

                    <td
                      style={
                        styles.td
                      }
                    >
                      {formatMoney(
                        log.old_value
                      )}
                    </td>

                    <td
                      style={
                        styles.td
                      }
                    >
                      {formatMoney(
                        log.new_value
                      )}
                    </td>

                    <td
                      style={
                        styles.td
                      }
                    >
                      <span
                        style={{
                          display:
                            "inline-block",
                          padding:
                            "4px 9px",
                          borderRadius:
                            "999px",
                          background: `${getStatusColor(
                            log.status
                          )}18`,
                          color:
                            getStatusColor(
                              log.status
                            ),
                          fontSize:
                            "10px",
                          fontWeight:
                            750,
                        }}
                      >
                        {log.status ||
                          "—"}
                      </span>
                    </td>

                    <td
                      style={
                        styles.td
                      }
                    >
                      {formatDate(
                        log.timestamp
                      )}
                    </td>
                  </tr>
                )
              )
            )}
          </tbody>
        </table>
      </div>

      {totalItems > 0 && (
        <div style={styles.pagination}>
          <div>
            {t.showing}{" "}
            {firstRecord} -{" "}
            {lastRecord}{" "}
            {t.of}{" "}
            {totalItems}
          </div>

          <div>
            <button
              type="button"
              style={styles.pageButton}
              disabled={
                currentPage === 1
              }
              onClick={() =>
                setCurrentPage(
                  (page) =>
                    Math.max(
                      1,
                      page - 1
                    )
                )
              }
            >
              ◀
            </button>

            {Array.from(
              {
                length: Math.min(
                  5,
                  totalPages
                ),
              },
              (_, index) => {
                let pageNumber;

                if (
                  totalPages <=
                  5
                ) {
                  pageNumber =
                    index + 1;
                } else if (
                  currentPage <=
                  3
                ) {
                  pageNumber =
                    index + 1;
                } else if (
                  currentPage >=
                  totalPages - 2
                ) {
                  pageNumber =
                    totalPages -
                    4 +
                    index;
                } else {
                  pageNumber =
                    currentPage -
                    2 +
                    index;
                }

                return (
                  <button
                    key={
                      pageNumber
                    }
                    type="button"
                    style={{
                      ...styles.pageButton,
                      ...(currentPage ===
                      pageNumber
                        ? {
                            background:
                              "#0ea5e9",
                            color:
                              "#fff",
                            borderColor:
                              "#0ea5e9",
                          }
                        : {}),
                    }}
                    onClick={() =>
                      setCurrentPage(
                        pageNumber
                      )
                    }
                  >
                    {
                      pageNumber
                    }
                  </button>
                );
              }
            )}

            <button
              type="button"
              style={styles.pageButton}
              disabled={
                currentPage ===
                totalPages
              }
              onClick={() =>
                setCurrentPage(
                  (page) =>
                    Math.min(
                      totalPages,
                      page + 1
                    )
                )
              }
            >
              ▶
            </button>
          </div>
        </div>
      )}

      {showDetailModal &&
        selectedLog && (
          <div
            style={styles.modal}
            onClick={closeModal}
          >
            <div
              style={
                styles.modalContent
              }
              onClick={(event) =>
                event.stopPropagation()
              }
            >
              <div
                style={{
                  display:
                    "flex",
                  justifyContent:
                    "space-between",
                  alignItems:
                    "center",
                  marginBottom:
                    "18px",
                }}
              >
                <div>
                  <h2
                    style={{
                      margin: 0,
                      fontSize:
                        "20px",
                      color:
                        isDark
                          ? "#e2e8f0"
                          : "#0f172a",
                    }}
                  >
                    {t.auditDetail}
                  </h2>

                  <div
                    style={{
                      marginTop:
                        "4px",
                      color:
                        "#0284c7",
                      fontWeight:
                        700,
                      fontSize:
                        "12px",
                    }}
                  >
                    {
                      selectedLog.audit_id
                    }
                  </div>
                </div>

                <button
                  type="button"
                  style={{
                    ...styles.button,
                    padding:
                      "7px 11px",
                  }}
                  onClick={
                    closeModal
                  }
                >
                  ✕
                </button>
              </div>

              <div
                style={
                  styles.detailGrid
                }
              >
                <div
                  style={
                    styles.detailItem
                  }
                >
                  <div
                    style={
                      styles.detailLabel
                    }
                  >
                    {t.user}
                  </div>

                  <div
                    style={
                      styles.detailValue
                    }
                  >
                    {
                      selectedLog.username
                    }

                    {selectedLog.user_role && (
                      <div
                        style={{
                          marginTop:
                            "3px",
                          color:
                            isDark
                              ? "#94a3b8"
                              : "#64748b",
                          fontSize:
                            "11px",
                        }}
                      >
                        {
                          selectedLog.user_role
                        }
                      </div>
                    )}
                  </div>
                </div>

                <div
                  style={
                    styles.detailItem
                  }
                >
                  <div
                    style={
                      styles.detailLabel
                    }
                  >
                    {t.action}
                  </div>

                  <div
                    style={{
                      ...styles.detailValue,
                      color:
                        getActionColor(
                          selectedLog.action
                        ),
                    }}
                  >
                    {getActionLabel(
                      selectedLog.action
                    )}
                  </div>
                </div>

                <div
                  style={
                    styles.detailItem
                  }
                >
                  <div
                    style={
                      styles.detailLabel
                    }
                  >
                    {t.module}
                  </div>

                  <div
                    style={
                      styles.detailValue
                    }
                  >
                    {
                      selectedLog.module
                    }
                  </div>
                </div>

                <div
                  style={
                    styles.detailItem
                  }
                >
                  <div
                    style={
                      styles.detailLabel
                    }
                  >
                    {t.status}
                  </div>

                  <div
                    style={{
                      ...styles.detailValue,
                      color:
                        getStatusColor(
                          selectedLog.status
                        ),
                    }}
                  >
                    {
                      selectedLog.status
                    }
                  </div>
                </div>

                <div
                  style={
                    styles.detailItem
                  }
                >
                  <div
                    style={
                      styles.detailLabel
                    }
                  >
                    {t.asset}
                  </div>

                  <div
                    style={
                      styles.detailValue
                    }
                  >
                    {
                      selectedLog.asset_tag ||
                      "—"
                    }

                    {selectedLog.asset_name && (
                      <div
                        style={{
                          marginTop:
                            "3px",
                          color:
                            isDark
                              ? "#94a3b8"
                              : "#64748b",
                          fontSize:
                            "11px",
                        }}
                      >
                        {
                          selectedLog.asset_name
                        }
                      </div>
                    )}
                  </div>
                </div>

                <div
                  style={
                    styles.detailItem
                  }
                >
                  <div
                    style={
                      styles.detailLabel
                    }
                  >
                    {t.timestamp}
                  </div>

                  <div
                    style={
                      styles.detailValue
                    }
                  >
                    {formatDate(
                      selectedLog.timestamp
                    )}
                  </div>
                </div>
              </div>

              <div
                style={{
                  marginTop:
                    "14px",
                  padding:
                    "15px",
                  borderRadius:
                    "10px",
                  background:
                    isDark
                      ? "#0f172a"
                      : "#f8fafc",
                  border: `1px solid ${
                    isDark
                      ? "#334155"
                      : "#e2e8f0"
                  }`,
                }}
              >
                <div
                  style={
                    styles.detailLabel
                  }
                >
                  {t.valueChange}
                </div>

                <div
                  style={{
                    display:
                      "grid",
                    gridTemplateColumns:
                      "1fr auto 1fr",
                    alignItems:
                      "center",
                    gap: "14px",
                    marginTop:
                      "10px",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize:
                          "10px",
                        color:
                          "#64748b",
                      }}
                    >
                      {t.oldValue}
                    </div>

                    <div
                      style={{
                        marginTop:
                          "4px",
                        color:
                          "#dc2626",
                        fontWeight:
                          700,
                      }}
                    >
                      {formatMoney(
                        selectedLog.old_value
                      )}
                    </div>
                  </div>

                  <div
                    style={{
                      fontSize:
                        "20px",
                      color:
                        "#94a3b8",
                    }}
                  >
                    →
                  </div>

                  <div>
                    <div
                      style={{
                        fontSize:
                          "10px",
                        color:
                          "#64748b",
                      }}
                    >
                      {t.newValue}
                    </div>

                    <div
                      style={{
                        marginTop:
                          "4px",
                        color:
                          "#16a34a",
                        fontWeight:
                          700,
                      }}
                    >
                      {formatMoney(
                        selectedLog.new_value
                      )}
                    </div>
                  </div>
                </div>

                {selectedLog.difference !==
                  null &&
                  selectedLog.difference !==
                    undefined && (
                    <div
                      style={{
                        marginTop:
                          "12px",
                        fontSize:
                          "12px",
                        fontWeight:
                          700,
                        color:
                          Number(
                            selectedLog.difference
                          ) >= 0
                            ? "#16a34a"
                            : "#dc2626",
                      }}
                    >
                      Difference:{" "}
                      {Number(
                        selectedLog.difference
                      ) >= 0
                        ? "+"
                        : ""}
                      {formatMoney(
                        selectedLog.difference
                      )}
                    </div>
                  )}
              </div>

              {selectedLog.reason && (
                <div
                  style={{
                    ...styles.detailItem,
                    marginTop:
                      "14px",
                  }}
                >
                  <div
                    style={
                      styles.detailLabel
                    }
                  >
                    {t.reason}
                  </div>

                  <div
                    style={
                      styles.detailValue
                    }
                  >
                    {
                      selectedLog.reason
                    }
                  </div>
                </div>
              )}

              {selectedLog.notes && (
                <div
                  style={{
                    ...styles.detailItem,
                    marginTop:
                      "12px",
                  }}
                >
                  <div
                    style={
                      styles.detailLabel
                    }
                  >
                    {t.notes}
                  </div>

                  <div
                    style={
                      styles.detailValue
                    }
                  >
                    {
                      selectedLog.notes
                    }
                  </div>
                </div>
              )}

              <div
                style={{
                  marginTop:
                    "12px",
                  padding:
                    "14px",
                  borderRadius:
                    "10px",
                  background:
                    isDark
                      ? "#0f172a"
                      : "#f8fafc",
                  border: `1px solid ${
                    isDark
                      ? "#334155"
                      : "#e2e8f0"
                  }`,
                }}
              >
                <div
                  style={
                    styles.detailLabel
                  }
                >
                  {
                    t.technicalDetails
                  }
                </div>

                <div
                  style={{
                    display:
                      "grid",
                    gridTemplateColumns:
                      "1fr 1fr",
                    gap: "10px",
                    marginTop:
                      "9px",
                  }}
                >
                  <div>
                    <span
                      style={{
                        color:
                          "#64748b",
                        fontSize:
                          "10px",
                      }}
                    >
                      IP Address
                    </span>

                    <div
                      style={{
                        marginTop:
                          "3px",
                        fontSize:
                          "12px",
                      }}
                    >
                      {
                        selectedLog.ip_address ||
                        "—"
                      }
                    </div>
                  </div>

                  <div>
                    <span
                      style={{
                        color:
                          "#64748b",
                        fontSize:
                          "10px",
                      }}
                    >
                      Session ID
                    </span>

                    <div
                      style={{
                        marginTop:
                          "3px",
                        fontSize:
                          "12px",
                        overflowWrap:
                          "anywhere",
                      }}
                    >
                      {
                        selectedLog.session_id ||
                        "—"
                      }
                    </div>
                  </div>

                  <div
                    style={{
                      gridColumn:
                        "1 / -1",
                    }}
                  >
                    <span
                      style={{
                        color:
                          "#64748b",
                        fontSize:
                          "10px",
                      }}
                    >
                      User Agent
                    </span>

                    <div
                      style={{
                        marginTop:
                          "3px",
                        fontSize:
                          "11px",
                        overflowWrap:
                          "anywhere",
                      }}
                    >
                      {
                        selectedLog.user_agent ||
                        "—"
                      }
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
    </div>
  );
};

const englishTranslations = {
  auditTrail:
    "Financial Audit Trail",

  auditDesc:
    "Complete traceability of financial changes — who changed what, when, and why",

  search: "Search",

  searchPlaceholder:
    "Search by user, asset, action, reason...",

  allActions:
    "All Actions",

  allModules:
    "All Modules",

  allUsers:
    "All Users",

  clearFilters:
    "Clear Filters",

  loading:
    "Loading audit logs...",

  noLogs:
    "No audit logs found",

  exportExcel:
    "Export to Excel",

  exportPDF:
    "Export to PDF",

  fetchError:
    "Failed to load audit logs",

  exportSuccess:
    "Exported successfully",

  auditId:
    "Audit ID",

  user:
    "User",

  action:
    "Action",

  module:
    "Module",

  asset:
    "Asset",

  oldValue:
    "Old Value",

  newValue:
    "New Value",

  status:
    "Status",

  timestamp:
    "Timestamp",

  dateFrom:
    "Date From",

  dateTo:
    "Date To",

  showing:
    "Showing",

  of:
    "of",

  auditDetail:
    "Audit Detail",

  reason:
    "Reason",

  notes:
    "Notes",

  valueChange:
    "Value Change",

  technicalDetails:
    "Technical Details",

  assetId:
    "Asset ID",
};

const amharicTranslations = {
  auditTrail:
    "የፋይናንስ ኦዲት መዝገብ",

  auditDesc:
    "ሁሉንም የፋይናንስ ለውጦች በሙሉ መከታተል — ማን፣ ምን፣ መቼ እና ለምን እንደቀየረ",

  search:
    "ፈልግ",

  searchPlaceholder:
    "በተጠቃሚ፣ በንብረት፣ በተግባር፣ በምክንያት ይፈልጉ...",

  allActions:
    "ሁሉም ተግባራት",

  allModules:
    "ሁሉም ሞጁሎች",

  allUsers:
    "ሁሉም ተጠቃሚዎች",

  clearFilters:
    "ማጣሪያ አጽዳ",

  loading:
    "የኦዲት መዝገቦች በመጫን ላይ...",

  noLogs:
    "ምንም የኦዲት መዝገብ አልተገኘም",

  exportExcel:
    "ወደ Excel ላክ",

  exportPDF:
    "ወደ PDF ላክ",

  fetchError:
    "የኦዲት መዝገቦችን ማግኘት አልተቻለም",

  exportSuccess:
    "በተሳካ ሁኔታ ተላከ",

  auditId:
    "የኦዲት መለያ",

  user:
    "ተጠቃሚ",

  action:
    "ተግባር",

  module:
    "ሞጁል",

  asset:
    "ንብረት",

  oldValue:
    "የቀድሞ ዋጋ",

  newValue:
    "አዲስ ዋጋ",

  status:
    "ሁኔታ",

  timestamp:
    "ሰዓት",

  dateFrom:
    "ከቀን",

  dateTo:
    "እስከ ቀን",

  showing:
    "በማሳየት ላይ",

  of:
    "ከ",

  auditDetail:
    "የኦዲት ዝርዝር",

  reason:
    "ምክንያት",

  notes:
    "ማስታወሻ",

  valueChange:
    "የዋጋ ለውጥ",

  technicalDetails:
    "ቴክኒካል ዝርዝሮች",

  assetId:
    "የንብረት መለያ",
};

export default FinanceAudit;