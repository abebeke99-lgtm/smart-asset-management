import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLanguage, useTheme } from '../../contexts/UiContext';
import { toast } from 'react-toastify';
import { apiClient, apiBase } from '../../utils/api';

/**
 * AdminAuditLogs
 *
 * Full Audit Log Management:
 * - All Activities
 * - Login Activities
 * - Asset Activities
 * - Assignment Activities
 * - Transfer Activities
 * - Maintenance Activities
 * - User Activities
 * - Settings Changes
 * - Security Events
 *
 * Supported operations:
 * - READ audit logs
 * - FILTER/search audit logs
 * - EXPORT audit logs
 * - VIEW audit details
 *
 * Audit records are intentionally NOT editable/deletable from this UI.
 */

const AdminAuditLogs = () => {
  const { language } = useLanguage();
  const { theme } = useTheme();

  const isDark = theme === 'dark';
  const t = language === 'en' ? englishTranslations : amharicTranslations;

  // ============================================================
  // STATE
  // ============================================================

  const [auditLogs, setAuditLogs] = useState([]);
  const [users, setUsers] = useState([]);

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');

  const [category, setCategory] = useState('all');
  const [filterAction, setFilterAction] = useState('all');
  const [filterModule, setFilterModule] = useState('all');
  const [filterUser, setFilterUser] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const [totalEvents, setTotalEvents] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [selectedLog, setSelectedLog] = useState(null);

  // ============================================================
  // THEME
  // ============================================================

  const colors = {
    light: {
      pageBg: '#f0f5ff',
      card: '#ffffff',
      cardSoft: '#f8fafc',
      text: '#17365d',
      subText: '#64748b',
      border: '#d7e2ef',
      accent: '#2563eb',
      accentSoft: '#dbeafe',
      success: '#16a34a',
      successSoft: '#dcfce7',
      warning: '#d97706',
      warningSoft: '#fef3c7',
      danger: '#dc2626',
      dangerSoft: '#fee2e2',
      purple: '#7c3aed',
      purpleSoft: '#ede9fe',
      cyan: '#0891b2',
      cyanSoft: '#cffafe',
      shadow: '0 4px 16px rgba(30, 64, 175, 0.08)'
    },
    dark: {
      pageBg: '#0f172a',
      card: '#1e293b',
      cardSoft: '#162235',
      text: '#e2e8f0',
      subText: '#94a3b8',
      border: '#334155',
      accent: '#60a5fa',
      accentSoft: '#1e3a5f',
      success: '#4ade80',
      successSoft: '#143d27',
      warning: '#fbbf24',
      warningSoft: '#493914',
      danger: '#f87171',
      dangerSoft: '#4a2020',
      purple: '#a78bfa',
      purpleSoft: '#352660',
      cyan: '#22d3ee',
      cyanSoft: '#103c47',
      shadow: '0 4px 18px rgba(0, 0, 0, 0.25)'
    }
  };

  const c = isDark ? colors.dark : colors.light;

  // ============================================================
  // AUDIT CATEGORIES
  // ============================================================

  const categories = useMemo(
    () => [
      {
        id: 'all',
        label: t.allActivities,
        icon: '📋'
      },
      {
        id: 'login',
        label: t.loginActivities,
        icon: '🔐'
      },
      {
        id: 'asset',
        label: t.assetActivities,
        icon: '📦'
      },
      {
        id: 'assignment',
        label: t.assignmentActivities,
        icon: '📋'
      },
      {
        id: 'transfer',
        label: t.transferActivities,
        icon: '🔄'
      },
      {
        id: 'maintenance',
        label: t.maintenanceActivities,
        icon: '🔧'
      },
      {
        id: 'user',
        label: t.userActivities,
        icon: '👥'
      },
      {
        id: 'settings',
        label: t.settingsChanges,
        icon: '⚙️'
      },
      {
        id: 'security',
        label: t.securityEvents,
        icon: '🛡️'
      }
    ],
    [t]
  );

  // ============================================================
  // ACTIONS
  // ============================================================

  const actionTypes = useMemo(
    () => [
      'Login',
      'Logout',
      'Failed Login',
      'Password Change',

      'User Create',
      'User Update',
      'User Delete',
      'User Activate',
      'User Deactivate',
      'Role Change',
      'Permission Change',

      'Asset Create',
      'Asset Update',
      'Asset Delete',
      'Asset View',
      'Asset Assign',
      'Asset Transfer',
      'Asset Return',
      'Asset Retire',

      'Assignment Create',
      'Assignment Update',
      'Assignment Cancel',
      'Assignment Approve',
      'Assignment Reject',

      'Transfer Create',
      'Transfer Approve',
      'Transfer Reject',
      'Transfer Complete',

      'Maintenance Request',
      'Maintenance Update',
      'Maintenance Complete',
      'Maintenance Cancel',

      'Settings Change',

      'Unauthorized Access',
      'Failed Authentication',
      'Suspicious Activity',

      'RFID Scan',
      'RFID Register',

      'Backup Create',
      'Backup Restore',

      'Data Export',
      'Approval',
      'Rejection'
    ],
    []
  );

  // ============================================================
  // MODULES
  // ============================================================

  const moduleTypes = useMemo(
    () => [
      'Authentication',
      'User Management',
      'Asset Management',
      'Assignment',
      'Transfer',
      'Maintenance',
      'RFID',
      'Finance',
      'Inventory',
      'Notifications',
      'Settings',
      'Reports',
      'Backup',
      'Security'
    ],
    []
  );

  // ============================================================
  // HELPERS
  // ============================================================

  const normalizeLogs = (data) => {
    if (Array.isArray(data)) {
      return data;
    }

    if (Array.isArray(data?.logs)) {
      return data.logs;
    }

    if (Array.isArray(data?.data)) {
      return data.data;
    }

    if (Array.isArray(data?.auditLogs)) {
      return data.auditLogs;
    }

    if (Array.isArray(data?.results)) {
      return data.results;
    }

    return [];
  };

  const getLogDate = (log) => {
    return (
      log?.createdAt ||
      log?.created_at ||
      log?.timestamp ||
      log?.date ||
      log?.dateTime ||
      null
    );
  };

  const getUsername = (log) => {
    return (
      log?.user?.username ||
      log?.user?.name ||
      log?.username ||
      log?.userName ||
      log?.user_name ||
      'N/A'
    );
  };

  const getUserRole = (log) => {
    return (
      log?.userRole ||
      log?.user_role ||
      log?.role ||
      log?.user?.role ||
      'N/A'
    );
  };

  const getUserId = (log) => {
    return (
      log?.userId ??
      log?.user_id ??
      log?.user?.id ??
      ''
    );
  };

  const getAction = (log) => {
    return log?.action || log?.event || 'Unknown';
  };

  const getModule = (log) => {
    return log?.module || log?.moduleName || 'Unknown';
  };

  const getStatus = (log) => {
    return (
      log?.status ||
      log?.result ||
      log?.outcome ||
      'Unknown'
    );
  };

  const getDescription = (log) => {
    return (
      log?.description ||
      log?.details ||
      log?.message ||
      log?.activity ||
      '—'
    );
  };

  const getRecordId = (log) => {
    return (
      log?.recordId ??
      log?.record_id ??
      log?.assetId ??
      log?.asset_id ??
      log?.entityId ??
      log?.entity_id ??
      '—'
    );
  };

  const getIpAddress = (log) => {
    return (
      log?.ipAddress ||
      log?.ip_address ||
      log?.ip ||
      'N/A'
    );
  };

  const getActionIcon = (action = '') => {
    const normalized = action.toLowerCase();

    if (normalized.includes('login')) return '🔐';
    if (normalized.includes('logout')) return '🚪';
    if (normalized.includes('password')) return '🔑';

    if (normalized.includes('create')) return '➕';
    if (normalized.includes('update')) return '✏️';
    if (normalized.includes('delete')) return '🗑️';
    if (normalized.includes('view')) return '👁️';

    if (normalized.includes('assign')) return '📌';
    if (normalized.includes('transfer')) return '🔄';
    if (normalized.includes('return')) return '↩️';

    if (normalized.includes('maintenance')) return '🔧';
    if (normalized.includes('rfid')) return '📡';

    if (normalized.includes('permission')) return '🔒';
    if (normalized.includes('role')) return '👤';

    if (normalized.includes('setting')) return '⚙️';
    if (normalized.includes('backup')) return '💾';
    if (normalized.includes('export')) return '📤';

    if (
      normalized.includes('unauthorized') ||
      normalized.includes('failed authentication') ||
      normalized.includes('suspicious')
    ) {
      return '🚨';
    }

    if (normalized.includes('approval')) return '✅';
    if (normalized.includes('reject')) return '❌';

    return '📋';
  };

  const getActionColor = (action = '') => {
    const normalized = action.toLowerCase();

    if (
      normalized.includes('delete') ||
      normalized.includes('failed') ||
      normalized.includes('unauthorized') ||
      normalized.includes('suspicious') ||
      normalized.includes('reject')
    ) {
      return {
        background: c.dangerSoft,
        color: c.danger
      };
    }

    if (
      normalized.includes('create') ||
      normalized.includes('login') ||
      normalized.includes('approve') ||
      normalized.includes('complete')
    ) {
      return {
        background: c.successSoft,
        color: c.success
      };
    }

    if (
      normalized.includes('update') ||
      normalized.includes('change') ||
      normalized.includes('password')
    ) {
      return {
        background: c.warningSoft,
        color: c.warning
      };
    }

    if (
      normalized.includes('transfer') ||
      normalized.includes('assign')
    ) {
      return {
        background: c.purpleSoft,
        color: c.purple
      };
    }

    return {
      background: c.accentSoft,
      color: c.accent
    };
  };

  const getStatusStyle = (status = '') => {
    const normalized = String(status).toLowerCase();

    if (
      normalized === 'success' ||
      normalized === 'successful' ||
      normalized === 'completed' ||
      normalized === 'approved' ||
      normalized === 'ok'
    ) {
      return {
        background: c.successSoft,
        color: c.success
      };
    }

    if (
      normalized === 'failed' ||
      normalized === 'failure' ||
      normalized === 'error' ||
      normalized === 'rejected' ||
      normalized === 'denied'
    ) {
      return {
        background: c.dangerSoft,
        color: c.danger
      };
    }

    if (
      normalized === 'pending' ||
      normalized === 'warning'
    ) {
      return {
        background: c.warningSoft,
        color: c.warning
      };
    }

    return {
      background: c.accentSoft,
      color: c.accent
    };
  };

  const formatDate = (value) => {
    if (!value) return '—';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return '—';
    }

    return date.toLocaleString();
  };

  const getCategoryForLog = (log) => {
    const action = getAction(log).toLowerCase();
    const module = getModule(log).toLowerCase();

    if (
      action.includes('login') ||
      action.includes('logout') ||
      action.includes('password') ||
      module.includes('authentication')
    ) {
      return 'login';
    }

    if (
      action.includes('asset') ||
      module.includes('asset') ||
      action.includes('rfid') ||
      module.includes('rfid')
    ) {
      return 'asset';
    }

    if (
      action.includes('assignment') ||
      action.includes('assign') ||
      module.includes('assignment')
    ) {
      return 'assignment';
    }

    if (
      action.includes('transfer') ||
      module.includes('transfer')
    ) {
      return 'transfer';
    }

    if (
      action.includes('maintenance') ||
      module.includes('maintenance')
    ) {
      return 'maintenance';
    }

    if (
      action.includes('user') ||
      action.includes('role') ||
      action.includes('permission') ||
      module.includes('user')
    ) {
      return 'user';
    }

    if (
      action.includes('setting') ||
      module.includes('setting')
    ) {
      return 'settings';
    }

    if (
      action.includes('unauthorized') ||
      action.includes('authentication') ||
      action.includes('suspicious') ||
      module.includes('security')
    ) {
      return 'security';
    }

    return 'all';
  };

  // ============================================================
  // FETCH USERS
  // ============================================================

  const fetchUsers = useCallback(async () => {
    try {
      const response = await apiClient.get('/api/users');

      const data = response.data;

      const list =
        data?.users ||
        data?.data ||
        data?.results ||
        (Array.isArray(data) ? data : []);

      setUsers(Array.isArray(list) ? list : []);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  }, []);

  // ============================================================
  // FETCH AUDIT LOGS
  // ============================================================

  const fetchAuditLogs = useCallback(async () => {
    setLoading(true);

    try {
      const response = await apiClient.get('/api/audit', {
        params: {
          page: currentPage,
          limit: itemsPerPage,

          search: searchQuery.trim() || undefined,

          action:
            filterAction !== 'all'
              ? filterAction
              : undefined,

          module:
            filterModule !== 'all'
              ? filterModule
              : undefined,

          user:
            filterUser !== 'all'
              ? filterUser
              : undefined,

          status:
            filterStatus !== 'all'
              ? filterStatus
              : undefined,

          dateFrom:
            filterStartDate || undefined,

          dateTo:
            filterEndDate || undefined,

          category:
            category !== 'all'
              ? category
              : undefined
        }
      });

      const data = response.data;

      let logs = normalizeLogs(data);

      logs = [...logs].sort(
        (a, b) =>
          new Date(getLogDate(b)) -
          new Date(getLogDate(a))
      );

      setAuditLogs(logs);

      const serverTotal =
        data?.pagination?.total ??
        data?.total ??
        data?.count;

      const serverPages =
        data?.pagination?.pages ??
        data?.pages;

      const calculatedTotal =
        Number(serverTotal) ||
        logs.length;

      const calculatedPages =
        Number(serverPages) ||
        Math.max(
          1,
          Math.ceil(calculatedTotal / itemsPerPage)
        );

      setTotalEvents(calculatedTotal);
      setTotalPages(calculatedPages);
    } catch (error) {
      console.error('Error fetching audit logs:', error);

      setAuditLogs([]);
      setTotalEvents(0);
      setTotalPages(1);

      toast.error(t.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [
    currentPage,
    itemsPerPage,
    searchQuery,
    filterAction,
    filterModule,
    filterUser,
    filterStatus,
    filterStartDate,
    filterEndDate,
    category,
    t.loadFailed
  ]);

  // ============================================================
  // INITIAL LOAD
  // ============================================================

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  // ============================================================
  // REAL-TIME AUDIT STREAM
  // ============================================================

  useEffect(() => {
    const token = localStorage.getItem('token');

    if (!token) {
      return undefined;
    }

    const controller = new AbortController();

    const streamAuditEvents = async () => {
      try {
        const response = await fetch(
          `${apiBase()}/api/audit/stream`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: 'text/event-stream'
            },
            signal: controller.signal
          }
        );

        if (!response.ok || !response.body) {
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        let buffer = '';

        while (!controller.signal.aborted) {
          const { value, done } =
            await reader.read();

          if (done) {
            break;
          }

          buffer += decoder.decode(value, {
            stream: true
          });

          const events = buffer.split('\n\n');

          buffer = events.pop() || '';

          events.forEach((event) => {
            if (
              event.includes('event: ready') ||
              event.includes('event: heartbeat')
            ) {
              return;
            }

            const dataLine = event
              .split('\n')
              .find((line) =>
                line.startsWith('data: ')
              );

            if (!dataLine) {
              return;
            }

            try {
              const audit = JSON.parse(
                dataLine.slice(6)
              );

              if (!audit?.id) {
                return;
              }

              setAuditLogs((current) => {
                const exists = current.some(
                  (item) =>
                    String(item.id) ===
                    String(audit.id)
                );

                if (exists) {
                  return current;
                }

                return [audit, ...current];
              });

              setTotalEvents(
                (current) => current + 1
              );
            } catch (error) {
              console.error(
                'Invalid audit stream event:',
                error
              );
            }
          });
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error(
            'Audit stream unavailable:',
            error
          );
        }
      }
    };

    streamAuditEvents();

    return () => {
      controller.abort();
    };
  }, []);

  // ============================================================
  // CLIENT FILTERING
  // ============================================================

  const filteredLogs = useMemo(() => {
    const query =
      searchQuery.trim().toLowerCase();

    return auditLogs.filter((log) => {
      const action = getAction(log);
      const module = getModule(log);
      const username = getUsername(log);
      const description = getDescription(log);
      const ipAddress = getIpAddress(log);
      const recordId = String(getRecordId(log));

      const matchesSearch =
        !query ||
        username
          .toLowerCase()
          .includes(query) ||
        action
          .toLowerCase()
          .includes(query) ||
        module
          .toLowerCase()
          .includes(query) ||
        description
          .toLowerCase()
          .includes(query) ||
        ipAddress
          .toLowerCase()
          .includes(query) ||
        recordId
          .toLowerCase()
          .includes(query);

      const matchesCategory =
        category === 'all' ||
        getCategoryForLog(log) === category;

      const matchesAction =
        filterAction === 'all' ||
        action === filterAction;

      const matchesModule =
        filterModule === 'all' ||
        module === filterModule;

      const matchesUser =
        filterUser === 'all' ||
        String(getUserId(log)) ===
          String(filterUser);

      const matchesStatus =
        filterStatus === 'all' ||
        getStatus(log).toLowerCase() ===
          filterStatus.toLowerCase();

      let matchesDate = true;

      const rawDate = getLogDate(log);

      if (rawDate) {
        const logDate = new Date(rawDate);

        if (filterStartDate) {
          const start = new Date(
            `${filterStartDate}T00:00:00`
          );

          if (logDate < start) {
            matchesDate = false;
          }
        }

        if (filterEndDate) {
          const end = new Date(
            `${filterEndDate}T23:59:59.999`
          );

          if (logDate > end) {
            matchesDate = false;
          }
        }
      }

      return (
        matchesSearch &&
        matchesCategory &&
        matchesAction &&
        matchesModule &&
        matchesUser &&
        matchesStatus &&
        matchesDate
      );
    });
  }, [
    auditLogs,
    searchQuery,
    category,
    filterAction,
    filterModule,
    filterUser,
    filterStatus,
    filterStartDate,
    filterEndDate
  ]);

  // ============================================================
  // STATISTICS
  // ============================================================

  const statistics = useMemo(() => {
    const successful = auditLogs.filter((log) => {
      const status =
        getStatus(log).toLowerCase();

      return (
        status === 'success' ||
        status === 'successful' ||
        status === 'completed' ||
        status === 'approved'
      );
    }).length;

    const failed = auditLogs.filter((log) => {
      const status =
        getStatus(log).toLowerCase();

      return (
        status === 'failed' ||
        status === 'failure' ||
        status === 'error' ||
        status === 'rejected' ||
        status === 'denied'
      );
    }).length;

    const securityEvents = auditLogs.filter(
      (log) =>
        getCategoryForLog(log) ===
        'security'
    ).length;

    const uniqueUsers = new Set(
      auditLogs
        .map(getUserId)
        .filter(Boolean)
    ).size;

    return {
      total: totalEvents,
      filtered: filteredLogs.length,
      successful,
      failed,
      securityEvents,
      uniqueUsers
    };
  }, [
    auditLogs,
    filteredLogs,
    totalEvents
  ]);

  // ============================================================
  // FILTER OPTIONS
  // ============================================================

  const availableActions = useMemo(() => {
    const fromLogs = auditLogs
      .map(getAction)
      .filter(Boolean);

    return [
      ...new Set([
        ...actionTypes,
        ...fromLogs
      ])
    ].sort();
  }, [auditLogs, actionTypes]);

  const availableModules = useMemo(() => {
    const fromLogs = auditLogs
      .map(getModule)
      .filter(Boolean);

    return [
      ...new Set([
        ...moduleTypes,
        ...fromLogs
      ])
    ].sort();
  }, [auditLogs, moduleTypes]);

  // ============================================================
  // FILTER RESET
  // ============================================================

  const clearFilters = () => {
    setSearchQuery('');
    setCategory('all');
    setFilterAction('all');
    setFilterModule('all');
    setFilterUser('all');
    setFilterStatus('all');
    setFilterStartDate('');
    setFilterEndDate('');
    setCurrentPage(1);
  };

  // ============================================================
  // CATEGORY CHANGE
  // ============================================================

  const handleCategoryChange = (newCategory) => {
    setCategory(newCategory);
    setCurrentPage(1);

    setFilterAction('all');

    if (newCategory === 'login') {
      setFilterModule('Authentication');
    } else if (newCategory === 'asset') {
      setFilterModule('Asset Management');
    } else if (newCategory === 'assignment') {
      setFilterModule('Assignment');
    } else if (newCategory === 'transfer') {
      setFilterModule('Transfer');
    } else if (newCategory === 'maintenance') {
      setFilterModule('Maintenance');
    } else if (newCategory === 'user') {
      setFilterModule('User Management');
    } else if (newCategory === 'settings') {
      setFilterModule('Settings');
    } else if (newCategory === 'security') {
      setFilterModule('Security');
    } else {
      setFilterModule('all');
    }
  };

  // ============================================================
  // EXPORT
  // ============================================================

  const exportAudit = async (format) => {
    setExporting(true);

    try {
      const response = await apiClient.get(
        '/api/audit/export',
        {
          params: {
            format,

            search:
              searchQuery.trim() ||
              undefined,

            action:
              filterAction !== 'all'
                ? filterAction
                : undefined,

            module:
              filterModule !== 'all'
                ? filterModule
                : undefined,

            user:
              filterUser !== 'all'
                ? filterUser
                : undefined,

            status:
              filterStatus !== 'all'
                ? filterStatus
                : undefined,

            dateFrom:
              filterStartDate ||
              undefined,

            dateTo:
              filterEndDate ||
              undefined,

            category:
              category !== 'all'
                ? category
                : undefined
          },
          responseType: 'blob'
        }
      );

      const contentType =
        response.headers?.['content-type'] ||
        'application/octet-stream';

      const blob = new Blob(
        [response.data],
        {
          type: contentType
        }
      );

      const url =
        URL.createObjectURL(blob);

      const link =
        document.createElement('a');

      link.href = url;

      const extension =
        format === 'excel'
          ? 'xlsx'
          : format;

      link.download =
        `audit-logs-${new Date()
          .toISOString()
          .split('T')[0]}.${extension}`;

      document.body.appendChild(link);

      link.click();

      document.body.removeChild(link);

      URL.revokeObjectURL(url);

      toast.success(
        `${t.exported} ${format.toUpperCase()}`
      );
    } catch (error) {
      console.error(
        'Audit export failed:',
        error
      );

      toast.error(
        t.exportFailed
      );
    } finally {
      setExporting(false);
    }
  };

  // ============================================================
  // PRINT / PDF
  // ============================================================

  const handlePrintPDF = () => {
    const logsToPrint =
      filteredLogs.length > 0
        ? filteredLogs
        : auditLogs;

    const popup =
      window.open(
        '',
        '_blank',
        'width=1200,height=800'
      );

    if (!popup) {
      toast.error(t.popupBlocked);
      return;
    }

    const rows = logsToPrint
      .map(
        (log) => `
          <tr>
            <td>${escapeHtml(
              formatDate(getLogDate(log))
            )}</td>
            <td>${escapeHtml(
              getUsername(log)
            )}</td>
            <td>${escapeHtml(
              getUserRole(log)
            )}</td>
            <td>${escapeHtml(
              getAction(log)
            )}</td>
            <td>${escapeHtml(
              getModule(log)
            )}</td>
            <td>${escapeHtml(
              String(getRecordId(log))
            )}</td>
            <td>${escapeHtml(
              getIpAddress(log)
            )}</td>
            <td>${escapeHtml(
              getStatus(log)
            )}</td>
            <td>${escapeHtml(
              getDescription(log)
            )}</td>
          </tr>
        `
      )
      .join('');

    popup.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Audit Logs Report</title>

          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 30px;
              color: #1f2937;
            }

            h1 {
              margin-bottom: 5px;
            }

            .generated {
              color: #64748b;
              margin-bottom: 25px;
            }

            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 11px;
            }

            th {
              background: #e5e7eb;
              padding: 8px;
              border: 1px solid #cbd5e1;
              text-align: left;
            }

            td {
              padding: 7px;
              border: 1px solid #cbd5e1;
              vertical-align: top;
            }

            @media print {
              body {
                padding: 10px;
              }

              button {
                display: none;
              }
            }
          </style>
        </head>

        <body>
          <h1>Audit Logs Report</h1>

          <div class="generated">
            Generated: ${escapeHtml(
              new Date().toLocaleString()
            )}
          </div>

          <table>
            <thead>
              <tr>
                <th>Date/Time</th>
                <th>User</th>
                <th>Role</th>
                <th>Action</th>
                <th>Module</th>
                <th>Record</th>
                <th>IP Address</th>
                <th>Status</th>
                <th>Description</th>
              </tr>
            </thead>

            <tbody>
              ${rows}
            </tbody>
          </table>
        </body>
      </html>
    `);

    popup.document.close();

    popup.focus();

    setTimeout(() => {
      popup.print();
    }, 300);
  };

  // ============================================================
  // VIEW DETAILS
  // ============================================================

  const handleViewDetails = (log) => {
    setSelectedLog(log);
  };

  const closeDetails = () => {
    setSelectedLog(null);
  };

  // ============================================================
  // PAGINATION
  // ============================================================

  const pageNumbers = useMemo(() => {
    const maxPages = 5;

    if (totalPages <= maxPages) {
      return Array.from(
        { length: totalPages },
        (_, index) => index + 1
      );
    }

    let start = Math.max(
      1,
      currentPage - 2
    );

    let end = Math.min(
      totalPages,
      start + maxPages - 1
    );

    if (end - start < maxPages - 1) {
      start = Math.max(
        1,
        end - maxPages + 1
      );
    }

    return Array.from(
      { length: end - start + 1 },
      (_, index) => start + index
    );
  }, [currentPage, totalPages]);

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div
      style={{
        minHeight: '100vh',
        background: c.pageBg,
        padding: '20px'
      }}
    >
      <div
        style={{
          maxWidth: '1500px',
          margin: '0 auto'
        }}
      >
        {/* ======================================================
            HEADER
        ====================================================== */}

        <div
          style={{
            background: c.card,
            border: `1px solid ${c.border}`,
            borderRadius: '14px',
            padding: '22px',
            boxShadow: c.shadow,
            marginBottom: '18px'
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: '16px',
              flexWrap: 'wrap'
            }}
          >
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  flexWrap: 'wrap'
                }}
              >
                <h1
                  style={{
                    margin: 0,
                    color: c.text,
                    fontSize: '1.8rem'
                  }}
                >
                  📋 {t.auditLogs}
                </h1>

                <span
                  style={{
                    padding: '5px 10px',
                    borderRadius: '20px',
                    background: c.accentSoft,
                    color: c.accent,
                    fontSize: '0.75rem',
                    fontWeight: 700
                  }}
                >
                  {t.securityRecord}
                </span>
              </div>

              <p
                style={{
                  margin:
                    '8px 0 0',
                  color: c.subText
                }}
              >
                {t.auditDescription}
              </p>
            </div>

            <div
              style={{
                display: 'flex',
                gap: '8px',
                flexWrap: 'wrap'
              }}
            >
              <button
                type="button"
                onClick={handlePrintPDF}
                style={buttonStyle(
                  c.accent
                )}
              >
                📄 {t.exportPDF}
              </button>

              <button
                type="button"
                disabled={exporting}
                onClick={() =>
                  exportAudit('csv')
                }
                style={buttonStyle(
                  c.success
                )}
              >
                📊 {t.exportCSV}
              </button>

              <button
                type="button"
                disabled={exporting}
                onClick={() =>
                  exportAudit('json')
                }
                style={buttonStyle(
                  c.purple
                )}
              >
                {'{ }'} {t.exportJSON}
              </button>

              <button
                type="button"
                onClick={fetchAuditLogs}
                style={buttonStyle(
                  c.cyan
                )}
              >
                🔄 {t.refresh}
              </button>
            </div>
          </div>
        </div>

        {/* ======================================================
            CATEGORY NAVIGATION
        ====================================================== */}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fit, minmax(170px, 1fr))',
            gap: '10px',
            marginBottom: '18px'
          }}
        >
          {categories.map((item) => {
            const active =
              category === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() =>
                  handleCategoryChange(
                    item.id
                  )
                }
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '9px',
                  padding: '13px 15px',
                  borderRadius: '10px',
                  border: `1px solid ${
                    active
                      ? c.accent
                      : c.border
                  }`,
                  background: active
                    ? c.accentSoft
                    : c.card,
                  color: active
                    ? c.accent
                    : c.text,
                  cursor: 'pointer',
                  fontWeight: active
                    ? 700
                    : 600,
                  textAlign: 'left'
                }}
              >
                <span
                  style={{
                    fontSize: '1.1rem'
                  }}
                >
                  {item.icon}
                </span>

                <span>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* ======================================================
            STATISTICS
        ====================================================== */}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fit, minmax(170px, 1fr))',
            gap: '12px',
            marginBottom: '18px'
          }}
        >
          <StatCard
            icon="📋"
            label={t.totalEvents}
            value={statistics.total}
            colors={c}
          />

          <StatCard
            icon="🔎"
            label={t.filteredEvents}
            value={statistics.filtered}
            colors={c}
          />

          <StatCard
            icon="✅"
            label={t.successfulEvents}
            value={statistics.successful}
            colors={c}
          />

          <StatCard
            icon="❌"
            label={t.failedEvents}
            value={statistics.failed}
            colors={c}
          />

          <StatCard
            icon="👥"
            label={t.uniqueUsers}
            value={statistics.uniqueUsers}
            colors={c}
          />

          <StatCard
            icon="🚨"
            label={t.securityEventsCount}
            value={statistics.securityEvents}
            colors={c}
          />
        </div>

        {/* ======================================================
            FILTERS
        ====================================================== */}

        <div
          style={{
            background: c.card,
            border: `1px solid ${c.border}`,
            borderRadius: '12px',
            padding: '18px',
            boxShadow: c.shadow,
            marginBottom: '18px'
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '14px',
              flexWrap: 'wrap'
            }}
          >
            <div
              style={{
                color: c.text,
                fontWeight: 700
              }}
            >
              🔍 {t.filters}
            </div>

            <button
              type="button"
              onClick={clearFilters}
              style={{
                border: `1px solid ${c.border}`,
                background: c.cardSoft,
                color: c.text,
                borderRadius: '7px',
                padding: '7px 12px',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              ✖ {t.clearFilters}
            </button>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '10px'
            }}
          >
            <input
              type="text"
              placeholder={
                t.searchPlaceholder
              }
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(
                  event.target.value
                );
                setCurrentPage(1);
              }}
              style={inputStyle(c)}
            />

            <select
              value={filterUser}
              onChange={(event) => {
                setFilterUser(
                  event.target.value
                );
                setCurrentPage(1);
              }}
              style={inputStyle(c)}
            >
              <option value="all">
                {t.allUsers}
              </option>

              {users.map((item) => (
                <option
                  key={item.id}
                  value={item.id}
                >
                  {item.username ||
                    item.name ||
                    item.email ||
                    `User ${item.id}`}
                </option>
              ))}
            </select>

            <select
              value={filterAction}
              onChange={(event) => {
                setFilterAction(
                  event.target.value
                );
                setCurrentPage(1);
              }}
              style={inputStyle(c)}
            >
              <option value="all">
                {t.allActions}
              </option>

              {availableActions.map(
                (action) => (
                  <option
                    key={action}
                    value={action}
                  >
                    {action}
                  </option>
                )
              )}
            </select>

            <select
              value={filterModule}
              onChange={(event) => {
                setFilterModule(
                  event.target.value
                );
                setCurrentPage(1);
              }}
              style={inputStyle(c)}
            >
              <option value="all">
                {t.allModules}
              </option>

              {availableModules.map(
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

            <select
              value={filterStatus}
              onChange={(event) => {
                setFilterStatus(
                  event.target.value
                );
                setCurrentPage(1);
              }}
              style={inputStyle(c)}
            >
              <option value="all">
                {t.allStatuses}
              </option>
              <option value="Success">
                {t.success}
              </option>
              <option value="Failed">
                {t.failed}
              </option>
              <option value="Pending">
                {t.pending}
              </option>
              <option value="Approved">
                {t.approved}
              </option>
              <option value="Rejected">
                {t.rejected}
              </option>
            </select>

            <input
              type="date"
              value={filterStartDate}
              onChange={(event) => {
                setFilterStartDate(
                  event.target.value
                );
                setCurrentPage(1);
              }}
              style={inputStyle(c)}
              title={t.startDate}
            />

            <input
              type="date"
              value={filterEndDate}
              onChange={(event) => {
                setFilterEndDate(
                  event.target.value
                );
                setCurrentPage(1);
              }}
              style={inputStyle(c)}
              title={t.endDate}
            />
          </div>
        </div>

        {/* ======================================================
            TABLE
        ====================================================== */}

        <div
          style={{
            background: c.card,
            border: `1px solid ${c.border}`,
            borderRadius: '12px',
            boxShadow: c.shadow,
            overflow: 'hidden'
          }}
        >
          {loading ? (
            <div
              style={{
                padding: '70px 20px',
                textAlign: 'center',
                color: c.subText
              }}
            >
              <div
                style={{
                  fontSize: '2rem',
                  marginBottom: '10px'
                }}
              >
                ⏳
              </div>

              <div>
                {t.loading}
              </div>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div
              style={{
                padding: '70px 20px',
                textAlign: 'center',
                color: c.subText
              }}
            >
              <div
                style={{
                  fontSize: '3rem',
                  marginBottom: '10px'
                }}
              >
                📭
              </div>

              <h3
                style={{
                  margin: 0,
                  color: c.text
                }}
              >
                {t.noLogs}
              </h3>

              <p>
                {t.noLogsDescription}
              </p>
            </div>
          ) : (
            <>
              <div
                style={{
                  overflowX: 'auto'
                }}
              >
                <table
                  style={{
                    width: '100%',
                    minWidth: '1100px',
                    borderCollapse:
                      'collapse'
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        background:
                          c.cardSoft,
                        borderBottom: `2px solid ${c.border}`
                      }}
                    >
                      <TableHeader
                        label={t.dateTime}
                        colors={c}
                      />

                      <TableHeader
                        label={t.user}
                        colors={c}
                      />

                      <TableHeader
                        label={t.role}
                        colors={c}
                      />

                      <TableHeader
                        label={t.action}
                        colors={c}
                      />

                      <TableHeader
                        label={t.module}
                        colors={c}
                      />

                      <TableHeader
                        label={t.record}
                        colors={c}
                      />

                      <TableHeader
                        label={t.ipAddress}
                        colors={c}
                      />

                      <TableHeader
                        label={t.status}
                        colors={c}
                      />

                      <TableHeader
                        label={t.actions}
                        colors={c}
                      />
                    </tr>
                  </thead>

                  <tbody>
                    {filteredLogs.map(
                      (log) => {
                        const action =
                          getAction(log);

                        const actionStyle =
                          getActionColor(
                            action
                          );

                        const status =
                          getStatus(log);

                        const statusStyle =
                          getStatusStyle(
                            status
                          );

                        return (
                          <tr
                            key={
                              log.id ||
                              `${getLogDate(
                                log
                              )}-${action}-${getUsername(
                                log
                              )}`
                            }
                            style={{
                              borderBottom: `1px solid ${c.border}`
                            }}
                          >
                            <td
                              style={cellStyle(
                                c
                              )}
                            >
                              <div
                                style={{
                                  fontWeight: 600
                                }}
                              >
                                {formatDate(
                                  getLogDate(
                                    log
                                  )
                                ).split(
                                  ','
                                )[0]}
                              </div>

                              <div
                                style={{
                                  fontSize:
                                    '0.75rem',
                                  color:
                                    c.subText,
                                  marginTop:
                                    '3px'
                                }}
                              >
                                {formatDate(
                                  getLogDate(
                                    log
                                  )
                                )
                                  .split(
                                    ','
                                  )
                                  .slice(1)
                                  .join(
                                    ','
                                  )
                                  .trim()}
                              </div>
                            </td>

                            <td
                              style={cellStyle(
                                c
                              )}
                            >
                              <div
                                style={{
                                  fontWeight: 600
                                }}
                              >
                                👤{' '}
                                {getUsername(
                                  log
                                )}
                              </div>
                            </td>

                            <td
                              style={cellStyle(
                                c
                              )}
                            >
                              <span
                                style={{
                                  display:
                                    'inline-block',
                                  padding:
                                    '4px 8px',
                                  borderRadius:
                                    '5px',
                                  background:
                                    c.accentSoft,
                                  color:
                                    c.accent,
                                  fontSize:
                                    '0.72rem',
                                  fontWeight: 700
                                }}
                              >
                                {getUserRole(
                                  log
                                )}
                              </span>
                            </td>

                            <td
                              style={cellStyle(
                                c
                              )}
                            >
                              <span
                                style={{
                                  display:
                                    'inline-flex',
                                  alignItems:
                                    'center',
                                  gap: '5px',
                                  padding:
                                    '5px 8px',
                                  borderRadius:
                                    '6px',
                                  background:
                                    actionStyle.background,
                                  color:
                                    actionStyle.color,
                                  fontSize:
                                    '0.72rem',
                                  fontWeight: 700,
                                  whiteSpace:
                                    'nowrap'
                                }}
                              >
                                {getActionIcon(
                                  action
                                )}

                                {action}
                              </span>
                            </td>

                            <td
                              style={cellStyle(
                                c
                              )}
                            >
                              {getModule(
                                log
                              )}
                            </td>

                            <td
                              style={{
                                ...cellStyle(
                                  c
                                ),
                                fontFamily:
                                  'monospace',
                                fontSize:
                                  '0.78rem'
                              }}
                            >
                              {getRecordId(
                                log
                              )}
                            </td>

                            <td
                              style={{
                                ...cellStyle(
                                  c
                                ),
                                fontFamily:
                                  'monospace',
                                fontSize:
                                  '0.78rem'
                              }}
                            >
                              {getIpAddress(
                                log
                              )}
                            </td>

                            <td
                              style={cellStyle(
                                c
                              )}
                            >
                              <span
                                style={{
                                  padding:
                                    '5px 9px',
                                  borderRadius:
                                    '6px',
                                  background:
                                    statusStyle.background,
                                  color:
                                    statusStyle.color,
                                  fontSize:
                                    '0.72rem',
                                  fontWeight: 700
                                }}
                              >
                                {status}
                              </span>
                            </td>

                            <td
                              style={cellStyle(
                                c
                              )}
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  handleViewDetails(
                                    log
                                  )
                                }
                                style={{
                                  padding:
                                    '6px 10px',
                                  borderRadius:
                                    '6px',
                                  border: `1px solid ${c.border}`,
                                  background:
                                    c.cardSoft,
                                  color:
                                    c.accent,
                                  cursor:
                                    'pointer',
                                  fontWeight:
                                    700,
                                  fontSize:
                                    '0.72rem'
                                }}
                              >
                                👁️{' '}
                                {t.view}
                              </button>
                            </td>
                          </tr>
                        );
                      }
                    )}
                  </tbody>
                </table>
              </div>

              {/* ==================================================
                  PAGINATION
              ================================================== */}

              <div
                style={{
                  display: 'flex',
                  justifyContent:
                    'space-between',
                  alignItems: 'center',
                  gap: '15px',
                  padding: '16px',
                  borderTop: `1px solid ${c.border}`,
                  flexWrap: 'wrap'
                }}
              >
                <div
                  style={{
                    color: c.subText,
                    fontSize:
                      '0.82rem'
                  }}
                >
                  {t.showing}{' '}
                  <strong
                    style={{
                      color: c.text
                    }}
                  >
                    {totalEvents === 0
                      ? 0
                      : (currentPage -
                          1) *
                          itemsPerPage +
                        1}
                  </strong>{' '}
                  {t.to}{' '}
                  <strong
                    style={{
                      color: c.text
                    }}
                  >
                    {Math.min(
                      currentPage *
                        itemsPerPage,
                      totalEvents
                    )}
                  </strong>{' '}
                  {t.of}{' '}
                  <strong
                    style={{
                      color: c.text
                    }}
                  >
                    {totalEvents}
                  </strong>
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: '5px',
                    alignItems: 'center',
                    flexWrap: 'wrap'
                  }}
                >
                  <button
                    type="button"
                    disabled={
                      currentPage ===
                      1
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
                    style={paginationButton(
                      c,
                      currentPage ===
                        1
                    )}
                  >
                    ← {t.previous}
                  </button>

                  {pageNumbers.map(
                    (page) => (
                      <button
                        key={page}
                        type="button"
                        onClick={() =>
                          setCurrentPage(
                            page
                          )
                        }
                        style={{
                          ...paginationButton(
                            c,
                            false
                          ),
                          background:
                            page ===
                            currentPage
                              ? c.accent
                              : c.cardSoft,
                          color:
                            page ===
                            currentPage
                              ? '#ffffff'
                              : c.text
                        }}
                      >
                        {page}
                      </button>
                    )
                  )}

                  <button
                    type="button"
                    disabled={
                      currentPage >=
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
                    style={paginationButton(
                      c,
                      currentPage >=
                        totalPages
                    )}
                  >
                    {t.next} →
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ======================================================
            DESCRIPTION / SECURITY NOTE
        ====================================================== */}

        <div
          style={{
            marginTop: '18px',
            padding: '15px 18px',
            background: isDark
              ? '#332b12'
              : '#fffbeb',
            border: `1px solid ${
              isDark
                ? '#66551b'
                : '#fde68a'
            }`,
            borderRadius: '10px',
            color: isDark
              ? '#fde68a'
              : '#92400e',
            fontSize: '0.84rem'
          }}
        >
          <strong>
            ⚠️ {t.securityNoteTitle}
          </strong>

          <div
            style={{
              marginTop: '5px'
            }}
          >
            {t.securityNote}
          </div>
        </div>
      </div>

      {/* ========================================================
          DETAILS MODAL
      ======================================================== */}

      {selectedLog && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={closeDetails}
          style={{
            position: 'fixed',
            inset: 0,
            background:
              'rgba(0,0,0,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent:
              'center',
            padding: '20px',
            zIndex: 9999
          }}
        >
          <div
            onClick={(event) =>
              event.stopPropagation()
            }
            style={{
              width: '100%',
              maxWidth: '850px',
              maxHeight: '90vh',
              overflowY: 'auto',
              background: c.card,
              borderRadius: '14px',
              border: `1px solid ${c.border}`,
              boxShadow:
                '0 20px 60px rgba(0,0,0,0.35)'
            }}
          >
            <div
              style={{
                padding: '18px 20px',
                borderBottom: `1px solid ${c.border}`,
                display: 'flex',
                justifyContent:
                  'space-between',
                alignItems: 'center',
                gap: '10px'
              }}
            >
              <div>
                <h2
                  style={{
                    margin: 0,
                    color: c.text,
                    fontSize:
                      '1.25rem'
                  }}
                >
                  📋 {t.auditDetails}
                </h2>

                <div
                  style={{
                    color: c.subText,
                    fontSize:
                      '0.78rem',
                    marginTop:
                      '4px'
                  }}
                >
                  {formatDate(
                    getLogDate(
                      selectedLog
                    )
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={closeDetails}
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius:
                    '50%',
                  border: 'none',
                  background:
                    c.dangerSoft,
                  color:
                    c.danger,
                  cursor:
                    'pointer',
                  fontSize:
                    '1.1rem',
                  fontWeight: 700
                }}
              >
                ×
              </button>
            </div>

            <div
              style={{
                padding: '20px'
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '12px'
                }}
              >
                <DetailItem
                  label={t.user}
                  value={getUsername(
                    selectedLog
                  )}
                  colors={c}
                />

                <DetailItem
                  label={t.role}
                  value={getUserRole(
                    selectedLog
                  )}
                  colors={c}
                />

                <DetailItem
                  label={t.action}
                  value={getAction(
                    selectedLog
                  )}
                  colors={c}
                />

                <DetailItem
                  label={t.module}
                  value={getModule(
                    selectedLog
                  )}
                  colors={c}
                />

                <DetailItem
                  label={t.record}
                  value={String(
                    getRecordId(
                      selectedLog
                    )
                  )}
                  colors={c}
                />

                <DetailItem
                  label={t.ipAddress}
                  value={getIpAddress(
                    selectedLog
                  )}
                  colors={c}
                />

                <DetailItem
                  label={t.status}
                  value={getStatus(
                    selectedLog
                  )}
                  colors={c}
                />

                <DetailItem
                  label={t.dateTime}
                  value={formatDate(
                    getLogDate(
                      selectedLog
                    )
                  )}
                  colors={c}
                />
              </div>

              <div
                style={{
                  marginTop: '14px',
                  padding: '15px',
                  background:
                    c.cardSoft,
                  border: `1px solid ${c.border}`,
                  borderRadius: '9px'
                }}
              >
                <div
                  style={{
                    fontWeight: 700,
                    color: c.text,
                    marginBottom:
                      '7px'
                  }}
                >
                  📝 {t.description}
                </div>

                <div
                  style={{
                    color: c.subText,
                    lineHeight: 1.6
                  }}
                >
                  {getDescription(
                    selectedLog
                  )}
                </div>
              </div>

              <div
                style={{
                  marginTop: '14px'
                }}
              >
                <div
                  style={{
                    fontWeight: 700,
                    color: c.text,
                    marginBottom:
                      '7px'
                  }}
                >
                  🔐 {t.rawData}
                </div>

                <pre
                  style={{
                    background:
                      isDark
                        ? '#0b1120'
                        : '#f1f5f9',
                    color: c.text,
                    padding: '14px',
                    borderRadius:
                      '8px',
                    border: `1px solid ${c.border}`,
                    overflowX:
                      'auto',
                    fontSize:
                      '0.75rem',
                    lineHeight: 1.5
                  }}
                >
                  {JSON.stringify(
                    selectedLog,
                    null,
                    2
                  )}
                </pre>
              </div>
            </div>

            <div
              style={{
                padding: '15px 20px',
                borderTop: `1px solid ${c.border}`,
                display: 'flex',
                justifyContent:
                  'flex-end'
              }}
            >
              <button
                type="button"
                onClick={closeDetails}
                style={buttonStyle(
                  c.accent
                )}
              >
                {t.close}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================
// SMALL COMPONENTS
// ============================================================

const StatCard = ({
  icon,
  label,
  value,
  colors
}) => (
  <div
    style={{
      background: colors.card,
      border: `1px solid ${colors.border}`,
      borderRadius: '10px',
      padding: '16px',
      boxShadow: colors.shadow
    }}
  >
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        color: colors.subText,
        fontSize: '0.78rem',
        fontWeight: 600
      }}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </div>

    <div
      style={{
        color: colors.text,
        fontSize: '1.45rem',
        fontWeight: 800,
        marginTop: '7px'
      }}
    >
      {value}
    </div>
  </div>
);

const TableHeader = ({
  label,
  colors
}) => (
  <th
    style={{
      padding: '12px',
      textAlign: 'left',
      color: colors.text,
      fontSize: '0.75rem',
      fontWeight: 800,
      whiteSpace: 'nowrap'
    }}
  >
    {label}
  </th>
);

const DetailItem = ({
  label,
  value,
  colors
}) => (
  <div
    style={{
      padding: '12px',
      background: colors.cardSoft,
      border: `1px solid ${colors.border}`,
      borderRadius: '8px'
    }}
  >
    <div
      style={{
        color: colors.subText,
        fontSize: '0.72rem',
        marginBottom: '5px',
        fontWeight: 600
      }}
    >
      {label}
    </div>

    <div
      style={{
        color: colors.text,
        fontWeight: 700,
        wordBreak: 'break-word'
      }}
    >
      {value || '—'}
    </div>
  </div>
);

// ============================================================
// STYLE HELPERS
// ============================================================

const buttonStyle = (background) => ({
  padding: '9px 13px',
  background,
  color: '#ffffff',
  border: 'none',
  borderRadius: '7px',
  cursor: 'pointer',
  fontWeight: 700,
  fontSize: '0.78rem',
  whiteSpace: 'nowrap'
});

const inputStyle = (colors) => ({
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 11px',
  background: colors.card,
  color: colors.text,
  border: `1px solid ${colors.border}`,
  borderRadius: '7px',
  outline: 'none',
  fontSize: '0.82rem'
});

const cellStyle = (colors) => ({
  padding: '11px 12px',
  color: colors.text,
  verticalAlign: 'middle',
  fontSize: '0.8rem'
});

const paginationButton = (
  colors,
  disabled
) => ({
  padding: '7px 10px',
  border: `1px solid ${colors.border}`,
  borderRadius: '6px',
  background: disabled
    ? colors.cardSoft
    : colors.card,
  color: disabled
    ? colors.subText
    : colors.text,
  cursor: disabled
    ? 'not-allowed'
    : 'pointer',
  fontSize: '0.75rem',
  fontWeight: 700
});

// ============================================================
// HTML ESCAPE FOR PRINT
// ============================================================

const escapeHtml = (value) => {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

// ============================================================
// ENGLISH TRANSLATIONS
// ============================================================

const englishTranslations = {
  auditLogs: 'Audit Logs',
  securityRecord: 'Security Record',

  auditDescription:
    'Track and review all major activities performed in the system for security, accountability, and compliance.',

  allActivities: 'All Activities',
  loginActivities: 'Login Activities',
  assetActivities: 'Asset Activities',
  assignmentActivities:
    'Assignment Activities',
  transferActivities:
    'Transfer Activities',
  maintenanceActivities:
    'Maintenance Activities',
  userActivities: 'User Activities',
  settingsChanges: 'Settings Changes',
  securityEvents: 'Security Events',

  totalEvents: 'Total Events',
  filteredEvents: 'Filtered Events',
  successfulEvents: 'Successful',
  failedEvents: 'Failed',
  uniqueUsers: 'Unique Users',
  securityEventsCount:
    'Security Events',

  filters: 'Filters',
  clearFilters: 'Clear Filters',

  searchPlaceholder:
    'Search user, action, module, record, IP...',

  allUsers: 'All Users',
  allActions: 'All Actions',
  allModules: 'All Modules',
  allStatuses: 'All Statuses',

  success: 'Success',
  failed: 'Failed',
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',

  startDate: 'Start Date',
  endDate: 'End Date',

  dateTime: 'Date/Time',
  user: 'User',
  role: 'Role',
  action: 'Action',
  module: 'Module',
  record: 'Record',
  ipAddress: 'IP Address',
  status: 'Status',
  description: 'Description',
  actions: 'Actions',

  view: 'View',

  auditDetails: 'Audit Log Details',
  rawData: 'Raw Audit Data',
  close: 'Close',

  showing: 'Showing',
  to: 'to',
  of: 'of',
  previous: 'Previous',
  next: 'Next',

  exportPDF: 'Export PDF',
  exportCSV: 'Export CSV',
  exportJSON: 'Export JSON',
  refresh: 'Refresh',

  loading: 'Loading audit logs...',
  noLogs: 'No Audit Logs Found',
  noLogsDescription:
    'No activities match the current filters.',

  loadFailed:
    'Failed to load audit logs',

  exportFailed:
    'Failed to export audit logs',

  exported: 'Exported',

  popupBlocked:
    'Please allow pop-ups to print the audit report.',

  securityNoteTitle:
    'Audit Log Security',

  securityNote:
    'Audit logs are permanent security records. They should not be edited or deleted through the normal administrator interface. System activities, authentication events, asset changes, assignments, transfers, maintenance, user changes, settings changes, and security events should be retained according to your organization’s retention policy.'
};

// ============================================================
// AMHARIC TRANSLATIONS
// ============================================================

const amharicTranslations = {
  auditLogs: 'የኦዲት መዝገቦች',
  securityRecord: 'የደህንነት መዝገብ',

  auditDescription:
    'በስርዓቱ ውስጥ የተፈጸሙ ዋና ዋና እንቅስቃሴዎችን ለደህንነት፣ ተጠያቂነት እና ተገዢነት ይመዘግባል።',

  allActivities: 'ሁሉም እንቅስቃሴዎች',
  loginActivities: 'የመግቢያ እንቅስቃሴዎች',
  assetActivities: 'የAsset እንቅስቃሴዎች',
  assignmentActivities:
    'የAssignment እንቅስቃሴዎች',
  transferActivities:
    'የTransfer እንቅስቃሴዎች',
  maintenanceActivities:
    'የMaintenance እንቅስቃሴዎች',
  userActivities:
    'የተጠቃሚ እንቅስቃሴዎች',
  settingsChanges:
    'የSettings ለውጦች',
  securityEvents:
    'የደህንነት ክስተቶች',

  totalEvents: 'ጠቅላላ ክስተቶች',
  filteredEvents:
    'በማጣሪያ የተገኙ',
  successfulEvents:
    'የተሳኩ',
  failedEvents:
    'ያልተሳኩ',
  uniqueUsers:
    'ልዩ ተጠቃሚዎች',
  securityEventsCount:
    'የደህንነት ክስተቶች',

  filters: 'ማጣሪያዎች',
  clearFilters: 'ማጣሪያዎችን አጽዳ',

  searchPlaceholder:
    'ተጠቃሚ፣ action፣ module፣ record፣ IP ፈልግ...',

  allUsers: 'ሁሉም ተጠቃሚዎች',
  allActions: 'ሁሉም Actions',
  allModules: 'ሁሉም Modules',
  allStatuses: 'ሁሉም Statuses',

  success: 'ተሳክቷል',
  failed: 'አልተሳካም',
  pending: 'በመጠባበቅ ላይ',
  approved: 'ጸድቋል',
  rejected: 'ውድቅ ተደርጓል',

  startDate: 'የመጀመሪያ ቀን',
  endDate: 'የመጨረሻ ቀን',

  dateTime: 'ቀን/ሰዓት',
  user: 'ተጠቃሚ',
  role: 'ሚና',
  action: 'Action',
  module: 'Module',
  record: 'Record',
  ipAddress: 'IP Address',
  status: 'ሁኔታ',
  description: 'መግለጫ',
  actions: 'Actions',

  view: 'ይመልከቱ',

  auditDetails:
    'የኦዲት መዝገብ ዝርዝር',
  rawData: 'የAudit ዋና መረጃ',
  close: 'ዝጋ',

  showing: 'እያሳየ',
  to: 'እስከ',
  of: 'ከ',
  previous: 'ቀዳሚ',
  next: 'ቀጣይ',

  exportPDF: 'PDF አውጣ',
  exportCSV: 'CSV አውጣ',
  exportJSON: 'JSON አውጣ',
  refresh: 'አድስ',

  loading:
    'የAudit መዝገቦች በመጫን ላይ...',

  noLogs:
    'ምንም Audit Logs አልተገኙም',

  noLogsDescription:
    'ከአሁኑ ማጣሪያዎች ጋር የሚዛመድ እንቅስቃሴ የለም።',

  loadFailed:
    'የAudit Logs መጫን አልተሳካም',

  exportFailed:
    'Audit Logs ማውጣት አልተሳካም',

  exported: 'ተልኳል',

  popupBlocked:
    'የAudit Report ለማተም Pop-up እንዲፈቀድ ያድርጉ።',

  securityNoteTitle:
    'የAudit Log ደህንነት',

  securityNote:
    'Audit Logs የስርዓቱ ቋሚ የደህንነት መዝገቦች ናቸው። በመደበኛ Administrator interface ውስጥ ሊስተካከሉ ወይም ሊሰረዙ አይገባም። Login፣ Asset፣ Assignment፣ Transfer፣ Maintenance፣ User፣ Settings እና Security እንቅስቃሴዎች በድርጅቱ የመዝገብ ጊዜ መመሪያ መሰረት መጠበቅ አለባቸው።'
};

export default AdminAuditLogs;
