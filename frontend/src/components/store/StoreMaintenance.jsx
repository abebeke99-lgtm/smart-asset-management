import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { useLanguage } from '../../contexts/UiContext';
import { apiClient } from '../../utils/api';

const normalizeStatus = (value) => String(value ?? '').trim().toLowerCase().replace(/\s+/g, '-');

const displayStatus = (value) => {
  const map = {
    pending: 'Pending',
    approved: 'Approved',
    assigned: 'Assigned',
    'in-progress': 'In Progress',
    'waiting-for-parts': 'Waiting for Parts',
    testing: 'Testing',
    completed: 'Completed',
    rejected: 'Rejected',
    cancelled: 'Cancelled',
    'ready-for-return': 'Ready for Return',
    returned: 'Returned',
    'under-maintenance': 'Under Maintenance',
    inspection: 'Inspection',
    repair: 'Repair',
    'on-hold': 'On Hold',
  };
  return map[normalizeStatus(value)] || String(value || 'Unknown');
};

const formatPriority = (value) => {
  const map = { low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical' };
  return map[String(value ?? '').toLowerCase()] || String(value || 'Medium');
};

const formatDate = (value) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleString();
};

const withinDateRange = (value, range) => {
  if (!value || !range || range === 'all') return true;
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return true;
  const now = new Date();

  switch (range) {
    case 'today': {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return target >= start;
    }
    case 'week': {
      const start = new Date(now);
      start.setDate(now.getDate() - 7);
      return target >= start;
    }
    case 'month': {
      const start = new Date(now);
      start.setMonth(now.getMonth() - 1);
      return target >= start;
    }
    case 'last-month': {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return target >= start && target <= end;
    }
    default:
      return true;
  }
};

const isOverdue = (request) => {
  const status = normalizeStatus(request.status);
  if (['completed', 'rejected', 'cancelled', 'returned', 'ready-for-return'].includes(status)) {
    return false;
  }

  const dueValue = request.expectedCompletionDate || request.expected_completion_date || request.preferredRepairDate || request.preferred_repair_date || request.scheduledDate || request.scheduled_date || request.dueDate || request.due_date;
  if (!dueValue) return false;

  const dueDate = new Date(dueValue);
  if (Number.isNaN(dueDate.getTime())) return false;
  return dueDate < new Date();
};

const getRequestId = (request) => request.id || request.requestId || request.request_id || 'N/A';

const getAssetInfo = (request) => {
  const asset = request.Asset || request.asset || request.assetData || {};
  const name = asset.name || request.assetName || request.asset_name || 'N/A';
  const code = asset.assetCode || request.assetCode || request.asset_code || request.asset_tag || 'N/A';
  const location = asset.location || request.location || request.assetLocation || 'N/A';
  const department = asset.department || request.department || request.assetDepartment || 'N/A';
  const serial = asset.serialNumber || request.serialNumber || request.serial_number || 'N/A';
  return { name, code, location, department, serial };
};

const getTechnicianName = (request) => {
  const technician = request.Technician || request.technician || request.assignedTechnician || {};
  const name = technician.fullName || technician.name || request.assignedToName || request.assigned_to_name || 'Not assigned';
  return name || 'Not assigned';
};

const StoreMaintenanceStatus = () => {
  const { language, theme } = useLanguage();
  const isDark = theme === 'dark';
  const t = language === 'en' ? englishTranslations : amharicTranslations;

  const [requests, setRequests] = useState([]);
  const [assets, setAssets] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [technicianFilter, setTechnicianFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [maintenanceResponse, assetsResponse, usersResponse] = await Promise.all([
        apiClient.get('/api/maintenance', { params: { limit: 1000 } }),
        apiClient.get('/api/assets', { params: { limit: 1000 } }),
        apiClient.get('/api/users', { params: { limit: 1000 } }),
      ]);

      const maintenanceList = Array.isArray(maintenanceResponse.data?.data)
        ? maintenanceResponse.data.data
        : Array.isArray(maintenanceResponse.data?.requests)
          ? maintenanceResponse.data.requests
          : Array.isArray(maintenanceResponse.data)
            ? maintenanceResponse.data
            : [];

      const assetList = Array.isArray(assetsResponse.data?.data)
        ? assetsResponse.data.data
        : Array.isArray(assetsResponse.data?.assets)
          ? assetsResponse.data.assets
          : Array.isArray(assetsResponse.data)
            ? assetsResponse.data
            : [];

      const userList = Array.isArray(usersResponse.data?.data)
        ? usersResponse.data.data
        : Array.isArray(usersResponse.data?.users)
          ? usersResponse.data.users
          : Array.isArray(usersResponse.data)
            ? usersResponse.data
            : [];

      setRequests(maintenanceList);
      setAssets(assetList);
      setUsers(userList);
    } catch (error) {
      toast.error(error?.response?.data?.message || t.fetchError);
      setRequests([]);
      setAssets([]);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [t.fetchError]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const assetLookup = useMemo(() => {
    const map = {};
    assets.forEach((asset) => {
      map[asset.id] = asset;
    });
    return map;
  }, [assets]);

  const technicianList = useMemo(() => {
    const list = users.filter((user) => ['maintenance', 'ict_officer', 'admin'].includes(String(user.role || '').toLowerCase()));
    return list.map((user) => ({
      id: user.id,
      name: user.fullName || user.username || `User ${user.id}`,
    }));
  }, [users]);

  const statusOptions = useMemo(() => {
    const values = new Set();
    requests.forEach((request) => {
      if (request.status) values.add(normalizeStatus(request.status));
    });
    return ['all', ...Array.from(values).sort()];
  }, [requests]);

  const priorityOptions = useMemo(() => ['all', 'low', 'medium', 'high', 'critical'], []);

  const departments = useMemo(() => {
    const values = new Set();
    requests.forEach((request) => {
      const asset = assetLookup[request.assetId] || request.Asset || request.asset || {};
      const dept = asset.department || request.department || request.assetDepartment || request.departmentName;
      if (dept) values.add(dept);
    });
    return Array.from(values).sort();
  }, [assetLookup, requests]);

  const locations = useMemo(() => {
    const values = new Set();
    requests.forEach((request) => {
      const asset = assetLookup[request.assetId] || request.Asset || request.asset || {};
      const loc = asset.location || request.location || request.assetLocation;
      if (loc) values.add(loc);
    });
    return Array.from(values).sort();
  }, [assetLookup, requests]);

  const stats = useMemo(() => {
    const total = requests.length;
    const pending = requests.filter((request) => ['pending', 'approved'].includes(normalizeStatus(request.status))).length;
    const inProgress = requests.filter((request) => ['assigned', 'in-progress', 'waiting-for-parts', 'testing', 'inspection', 'repair', 'on-hold'].includes(normalizeStatus(request.status))).length;
    const completed = requests.filter((request) => ['completed', 'returned', 'ready-for-return'].includes(normalizeStatus(request.status))).length;
    const ready = requests.filter((request) => ['ready-for-return', 'returned'].includes(normalizeStatus(request.status))).length;
    const overdue = requests.filter((request) => isOverdue(request)).length;
    return { total, pending, inProgress, completed, ready, overdue };
  }, [requests]);

  const filteredRequests = useMemo(() => {
    let filtered = [...requests];

    if (statusFilter !== 'all') {
      filtered = filtered.filter((request) => normalizeStatus(request.status) === statusFilter);
    }

    if (priorityFilter !== 'all') {
      filtered = filtered.filter((request) => normalizeStatus(request.priority) === priorityFilter);
    }

    if (departmentFilter !== 'all') {
      filtered = filtered.filter((request) => {
        const asset = assetLookup[request.assetId] || request.Asset || request.asset || {};
        const dept = asset.department || request.department || request.assetDepartment || request.departmentName;
        return String(dept || '').toLowerCase() === String(departmentFilter).toLowerCase();
      });
    }

    if (locationFilter !== 'all') {
      filtered = filtered.filter((request) => {
        const asset = assetLookup[request.assetId] || request.Asset || request.asset || {};
        const loc = asset.location || request.location || request.assetLocation;
        return String(loc || '').toLowerCase() === String(locationFilter).toLowerCase();
      });
    }

    if (technicianFilter !== 'all') {
      filtered = filtered.filter((request) => {
        const techName = getTechnicianName(request);
        return String(techName).toLowerCase() === String(technicianFilter).toLowerCase();
      });
    }

    if (search.trim()) {
      const query = search.trim().toLowerCase();
      filtered = filtered.filter((request) => {
        const asset = assetLookup[request.assetId] || request.Asset || request.asset || {};
        const assetInfo = getAssetInfo(request);
        const technician = getTechnicianName(request);
        const text = [
          getRequestId(request),
          assetInfo.code,
          assetInfo.name,
          assetInfo.serial,
          request.title,
          request.problem,
          request.description,
          technician,
          assetInfo.department,
          assetInfo.location,
          displayStatus(request.status),
        ].join(' ').toLowerCase();
        return text.includes(query);
      });
    }

    if (dateFilter !== 'all') {
      filtered = filtered.filter((request) => {
        const dateValue = request.createdAt || request.created_at || request.requestedDate || request.requested_date;
        return withinDateRange(dateValue, dateFilter);
      });
    }

    return filtered.sort((a, b) => new Date(b.updatedAt || b.updated_at || b.createdAt || b.created_at || 0) - new Date(a.updatedAt || a.updated_at || a.createdAt || a.created_at || 0));
  }, [assetLookup, dateFilter, departmentFilter, locationFilter, priorityFilter, requests, search, statusFilter, technicianFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / pageSize));

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, priorityFilter, departmentFilter, locationFilter, technicianFilter, dateFilter]);

  const paginatedRequests = filteredRequests.slice((page - 1) * pageSize, page * pageSize);

  const openRequest = (request) => {
    setSelectedRequest(request);
    setShowDetail(true);
  };

  const styles = {
    page: {
      padding: '24px',
      background: isDark ? '#020817' : '#f8fafc',
      minHeight: '100vh',
      color: isDark ? '#e2e8f0' : '#0f172a',
    },
    shell: {
      maxWidth: '1400px',
      margin: '0 auto',
    },
    header: {
      marginBottom: '20px',
    },
    title: {
      margin: 0,
      fontSize: '2rem',
      fontWeight: 800,
    },
    subtitle: {
      margin: '8px 0 0',
      color: isDark ? '#94a3b8' : '#64748b',
      fontSize: '0.96rem',
    },
    metricGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
      gap: '16px',
      marginBottom: '20px',
    },
    card: {
      background: isDark ? '#111827' : '#fff',
      border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
      borderRadius: '14px',
      padding: '16px',
    },
    cardLabel: {
      fontSize: '0.8rem',
      color: isDark ? '#94a3b8' : '#64748b',
      marginBottom: '10px',
    },
    cardValue: {
      fontSize: '2rem',
      fontWeight: 800,
    },
    filterBar: {
      background: isDark ? '#111827' : '#fff',
      border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
      borderRadius: '14px',
      padding: '16px',
      marginBottom: '18px',
    },
    filterRow: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
      gap: '12px',
    },
    input: {
      width: '100%',
      borderRadius: '10px',
      border: `1px solid ${isDark ? '#334155' : '#dbe2ea'}`,
      background: isDark ? '#020817' : '#fff',
      color: isDark ? '#e2e8f0' : '#0f172a',
      padding: '10px 12px',
      fontSize: '0.95rem',
    },
    tablePanel: {
      background: isDark ? '#111827' : '#fff',
      border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
      borderRadius: '14px',
      padding: '16px',
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse',
    },
    th: {
      textAlign: 'left',
      padding: '12px',
      color: isDark ? '#cbd5e1' : '#475569',
      fontSize: '0.76rem',
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
      borderBottom: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
    },
    td: {
      padding: '12px',
      borderBottom: `1px solid ${isDark ? '#1f2937' : '#e2e8f0'}`,
      verticalAlign: 'top',
    },
    button: {
      border: 'none',
      borderRadius: '10px',
      padding: '9px 12px',
      fontWeight: 700,
      cursor: 'pointer',
    },
    primaryButton: {
      background: '#2563eb',
      color: '#fff',
    },
    secondaryButton: {
      background: isDark ? '#334155' : '#e2e8f0',
      color: isDark ? '#e2e8f0' : '#0f172a',
    },
    badge: (status) => {
      const state = normalizeStatus(status);
      const palette = {
        pending: { background: '#fef3c7', color: '#92400e' },
        approved: { background: '#dbeafe', color: '#1d4ed8' },
        assigned: { background: '#ede9fe', color: '#6d28d9' },
        'in-progress': { background: '#cffafe', color: '#0f766e' },
        'waiting-for-parts': { background: '#fce7f3', color: '#be185d' },
        testing: { background: '#fef9c3', color: '#854d0e' },
        completed: { background: '#dcfce7', color: '#166534' },
        rejected: { background: '#fee2e2', color: '#b91c1c' },
        cancelled: { background: '#f1f5f9', color: '#334155' },
        'ready-for-return': { background: '#d1fae5', color: '#065f46' },
        returned: { background: '#d1fae5', color: '#065f46' },
        'under-maintenance': { background: '#dbeafe', color: '#1e3a8a' },
        inspection: { background: '#e0e7ff', color: '#3730a3' },
        repair: { background: '#f3e8ff', color: '#7c3aed' },
        'on-hold': { background: '#fef2f2', color: '#b91c1c' },
      };
      const tone = palette[state] || { background: '#f1f5f9', color: '#334155' };
      return { display: 'inline-block', padding: '5px 10px', borderRadius: '999px', fontWeight: 700, fontSize: '0.72rem', background: tone.background, color: tone.color };
    },
    priorityPill: (priority) => {
      const normalized = String(priority ?? '').toLowerCase();
      const palette = {
        low: { background: '#ecfdf5', color: '#166534' },
        medium: { background: '#fef3c7', color: '#92400e' },
        high: { background: '#ffedd5', color: '#c2410c' },
        critical: { background: '#fee2e2', color: '#991b1b' },
      };
      const tone = palette[normalized] || { background: '#f1f5f9', color: '#334155' };
      return { display: 'inline-block', padding: '5px 10px', borderRadius: '999px', fontWeight: 700, fontSize: '0.7rem', background: tone.background, color: tone.color };
    },
    empty: { textAlign: 'center', padding: '36px 20px', color: isDark ? '#94a3b8' : '#64748b' },
    modalBackdrop: { position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', zIndex: 1000 },
    modalCard: { width: '100%', maxWidth: '820px', background: isDark ? '#111827' : '#fff', borderRadius: '16px', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, maxHeight: '90vh', overflowY: 'auto', padding: '20px' },
    section: { marginBottom: '18px' },
    sectionTitle: { fontSize: '1rem', fontWeight: 800, marginBottom: '10px' },
    detailGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' },
    infoBox: { background: isDark ? '#020817' : '#f8fafc', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, borderRadius: '10px', padding: '12px' },
    timelineItem: { padding: '10px 0', borderBottom: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` },
    nav: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' },
  };

  return (
    <div style={styles.page}>
      <div style={styles.shell}>
        <header style={styles.header}>
          <h1 style={styles.title}>{t.pageTitle}</h1>
          <p style={styles.subtitle}>{t.pageSubtitle}</p>
        </header>

        <section style={styles.metricGrid}>
          <div style={styles.card}>
            <div style={styles.cardLabel}>{t.total}</div>
            <div style={styles.cardValue}>{stats.total}</div>
          </div>
          <div style={styles.card}>
            <div style={styles.cardLabel}>{t.pending}</div>
            <div style={styles.cardValue}>{stats.pending}</div>
          </div>
          <div style={styles.card}>
            <div style={styles.cardLabel}>{t.inProgress}</div>
            <div style={styles.cardValue}>{stats.inProgress}</div>
          </div>
          <div style={styles.card}>
            <div style={styles.cardLabel}>{t.completed}</div>
            <div style={styles.cardValue}>{stats.completed}</div>
          </div>
          <div style={styles.card}>
            <div style={styles.cardLabel}>{t.readyForReturn}</div>
            <div style={styles.cardValue}>{stats.ready}</div>
          </div>
          <div style={styles.card}>
            <div style={styles.cardLabel}>{t.overdue}</div>
            <div style={styles.cardValue}>{stats.overdue}</div>
          </div>
        </section>

        <div style={styles.filterBar}>
          <div style={styles.filterRow}>
            <input
              style={styles.input}
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t.searchPlaceholder}
            />
            <select style={styles.input} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              {statusOptions.map((value) => (
                <option key={value} value={value}>{value === 'all' ? t.allStatuses : displayStatus(value)}</option>
              ))}
            </select>
            <select style={styles.input} value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}>
              <option value="all">{t.allPriorities}</option>
              {priorityOptions.filter((value) => value !== 'all').map((value) => (
                <option key={value} value={value}>{formatPriority(value)}</option>
              ))}
            </select>
            <select style={styles.input} value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)}>
              <option value="all">{t.allDepartments}</option>
              {departments.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
            <select style={styles.input} value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)}>
              <option value="all">{t.allLocations}</option>
              {locations.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
            <select style={styles.input} value={technicianFilter} onChange={(event) => setTechnicianFilter(event.target.value)}>
              <option value="all">{t.allTechnicians}</option>
              {technicianList.map((tech) => (
                <option key={tech.id} value={tech.name}>{tech.name}</option>
              ))}
            </select>
            <select style={styles.input} value={dateFilter} onChange={(event) => setDateFilter(event.target.value)}>
              <option value="all">{t.allDates}</option>
              <option value="today">{t.today}</option>
              <option value="week">{t.thisWeek}</option>
              <option value="month">{t.thisMonth}</option>
              <option value="last-month">{t.lastMonth}</option>
            </select>
            <button type="button" style={{ ...styles.button, ...styles.primaryButton }} onClick={fetchData}>{t.refresh}</button>
          </div>
        </div>

        <div style={styles.tablePanel}>
          {loading ? (
            <div style={styles.empty}>{t.loading}</div>
          ) : filteredRequests.length === 0 ? (
            <div style={styles.empty}>{t.noData}</div>
          ) : (
            <>
              <div style={{ marginBottom: '12px', color: isDark ? '#94a3b8' : '#64748b' }}>
                {t.showing} {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, filteredRequests.length)} {t.of} {filteredRequests.length}
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>{t.requestId}</th>
                      <th style={styles.th}>{t.asset}</th>
                      <th style={styles.th}>{t.problem}</th>
                      <th style={styles.th}>{t.priority}</th>
                      <th style={styles.th}>{t.status}</th>
                      <th style={styles.th}>{t.technician}</th>
                      <th style={styles.th}>{t.location}</th>
                      <th style={styles.th}>{t.lastUpdated}</th>
                      <th style={styles.th}>{t.action}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRequests.map((request) => {
                      const assetInfo = getAssetInfo(request);
                      const isLate = isOverdue(request);
                      return (
                        <tr key={request.id || `${request.assetId}-${request.createdAt}`}>
                          <td style={styles.td}>#{getRequestId(request)}</td>
                          <td style={styles.td}>
                            <div style={{ fontWeight: 700 }}>{assetInfo.code}</div>
                            <div style={{ color: isDark ? '#94a3b8' : '#64748b', fontSize: '0.82rem' }}>{assetInfo.name}</div>
                          </td>
                          <td style={styles.td}>
                            <div>{request.title || request.problem || request.description || 'N/A'}</div>
                            {isLate && <div style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '4px', fontWeight: 600 }}>{t.overdue}</div>}
                          </td>
                          <td style={styles.td}><span style={styles.priorityPill(request.priority)}>{formatPriority(request.priority)}</span></td>
                          <td style={styles.td}><span style={styles.badge(request.status)}>{displayStatus(request.status)}</span></td>
                          <td style={styles.td}>{getTechnicianName(request)}</td>
                          <td style={styles.td}>{assetInfo.location}</td>
                          <td style={styles.td}>{formatDate(request.updatedAt || request.updated_at || request.createdAt || request.created_at)}</td>
                          <td style={styles.td}>
                            <button type="button" style={{ ...styles.button, ...styles.secondaryButton, padding: '8px 10px' }} onClick={() => openRequest(request)}>{t.view}</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div style={styles.nav}>
                <button type="button" style={{ ...styles.button, ...styles.secondaryButton }} disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>{t.previous}</button>
                <div>{t.page} {page} {t.of} {totalPages}</div>
                <button type="button" style={{ ...styles.button, ...styles.secondaryButton }} disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>{t.next}</button>
              </div>
            </>
          )}
        </div>
      </div>

      {showDetail && selectedRequest && (
        <div style={styles.modalBackdrop} onClick={() => setShowDetail(false)}>
          <div style={styles.modalCard} onClick={(event) => event.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h3 style={{ margin: 0, fontSize: '1.5rem' }}>{t.requestDetails}</h3>
              <button type="button" onClick={() => setShowDetail(false)} style={{ background: 'transparent', border: 'none', color: isDark ? '#e2e8f0' : '#0f172a', fontSize: '1.7rem', cursor: 'pointer' }}>×</button>
            </div>

            <div style={styles.section}>
              <div style={styles.sectionTitle}>{t.currentStatus}</div>
              <div style={styles.detailGrid}>
                <div style={styles.infoBox}><strong>{t.requestId}:</strong> #{getRequestId(selectedRequest)}</div>
                <div style={styles.infoBox}><strong>{t.status}:</strong> <span style={styles.badge(selectedRequest.status)}>{displayStatus(selectedRequest.status)}</span></div>
                <div style={styles.infoBox}><strong>{t.priority}:</strong> <span style={styles.priorityPill(selectedRequest.priority)}>{formatPriority(selectedRequest.priority)}</span></div>
                <div style={styles.infoBox}><strong>{t.requestedDate}:</strong> {formatDate(selectedRequest.createdAt || selectedRequest.created_at)}</div>
                <div style={styles.infoBox}><strong>{t.lastUpdated}:</strong> {formatDate(selectedRequest.updatedAt || selectedRequest.updated_at)}</div>
                <div style={styles.infoBox}><strong>{t.technician}:</strong> {getTechnicianName(selectedRequest)}</div>
              </div>
            </div>

            <div style={styles.section}>
              <div style={styles.sectionTitle}>{t.assetDetails}</div>
              <div style={styles.detailGrid}>
                <div style={styles.infoBox}><strong>{t.assetCode}:</strong> {getAssetInfo(selectedRequest).code}</div>
                <div style={styles.infoBox}><strong>{t.assetName}:</strong> {getAssetInfo(selectedRequest).name}</div>
                <div style={styles.infoBox}><strong>{t.department}:</strong> {getAssetInfo(selectedRequest).department}</div>
                <div style={styles.infoBox}><strong>{t.location}:</strong> {getAssetInfo(selectedRequest).location}</div>
                <div style={styles.infoBox}><strong>{t.serialNumber}:</strong> {getAssetInfo(selectedRequest).serial}</div>
                <div style={styles.infoBox}><strong>{t.condition}:</strong> {selectedRequest.Asset?.condition || selectedRequest.condition || 'N/A'}</div>
              </div>
            </div>

            <div style={styles.section}>
              <div style={styles.sectionTitle}>{t.problemSection}</div>
              <div style={styles.infoBox}>{selectedRequest.title || selectedRequest.problem || selectedRequest.description || 'N/A'}</div>
            </div>

            <div style={styles.section}>
              <div style={styles.sectionTitle}>{t.timeline}</div>
              <div>
                {[{ label: 'Request Created', date: selectedRequest.createdAt || selectedRequest.created_at, note: 'Request created' }, { label: 'Current Status', date: selectedRequest.updatedAt || selectedRequest.updated_at || selectedRequest.createdAt || selectedRequest.created_at, note: displayStatus(selectedRequest.status) }, { label: 'Assigned Technician', date: selectedRequest.updatedAt || selectedRequest.updated_at, note: getTechnicianName(selectedRequest) }].filter((entry) => entry.date).map((entry, index) => (
                  <div key={`${entry.label}-${index}`} style={styles.timelineItem}>
                    <div style={{ fontWeight: 700 }}>{entry.label}</div>
                    <div style={{ color: isDark ? '#94a3b8' : '#64748b', fontSize: '0.82rem' }}>{formatDate(entry.date)}</div>
                    <div style={{ marginTop: '4px' }}>{entry.note}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
              <button type="button" style={{ ...styles.button, ...styles.secondaryButton }} onClick={() => setShowDetail(false)}>{t.close}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const englishTranslations = {
  pageTitle: 'Maintenance Status',
  pageSubtitle: 'Monitor assets currently in maintenance and track their repair progress and status.',
  total: 'Total Maintenance Requests',
  pending: 'Pending',
  inProgress: 'In Progress',
  completed: 'Completed',
  readyForReturn: 'Ready for Return',
  overdue: 'Overdue',
  searchPlaceholder: 'Search by request ID, asset code, name, serial, technician, or issue',
  allStatuses: 'All statuses',
  allPriorities: 'All priorities',
  allDepartments: 'All departments',
  allLocations: 'All locations',
  allTechnicians: 'All technicians',
  allDates: 'All dates',
  today: 'Today',
  thisWeek: 'This week',
  thisMonth: 'This month',
  lastMonth: 'Last month',
  refresh: 'Refresh',
  loading: 'Loading maintenance status...',
  noData: 'No maintenance records match your search or filters.',
  showing: 'Showing',
  of: 'of',
  requestId: 'Request ID',
  asset: 'Asset',
  problem: 'Problem',
  priority: 'Priority',
  status: 'Status',
  technician: 'Technician',
  location: 'Location',
  lastUpdated: 'Last Updated',
  action: 'Action',
  view: 'View',
  previous: 'Previous',
  next: 'Next',
  page: 'Page',
  due: 'Due',
  requestDetails: 'Maintenance Request Details',
  currentStatus: 'Current Status',
  requestDate: 'Requested Date',
  assetDetails: 'Asset Details',
  assetCode: 'Asset Code',
  assetName: 'Asset Name',
  department: 'Department',
  serialNumber: 'Serial Number',
  condition: 'Condition',
  problemSection: 'Problem / Notes',
  timeline: 'Maintenance Timeline',
  close: 'Close',
  fetchError: 'Unable to load maintenance status. Please try again.',
};

const amharicTranslations = {
  pageTitle: 'የጥገና ሁኔታ',
  pageSubtitle: 'በጥገና ላይ ያሉ ንብረቶችን እና የጥገና ሂደታቸውን ይከታተሉ።',
  total: 'ጠቅላላ የጥገና ጥያቄዎች',
  pending: 'በመጠባበቅ ላይ',
  inProgress: 'በሂደት ላይ',
  completed: 'ተጠናቋል',
  readyForReturn: 'ወደ መመለስ ዝግጁ',
  overdue: 'ዘግይቷል',
  searchPlaceholder: 'በጥያቄ መለያ፣ ንብረት ኮድ፣ ስም፣ መለያ ኮድ፣ ቴክኒሽያን ወይም ችግር ይፈልጉ',
  allStatuses: 'ሁሉም ሁኔታዎች',
  allPriorities: 'ሁሉም ቅድሚያዎች',
  allDepartments: 'ሁሉም መምሪያዎች',
  allLocations: 'ሁሉም ቦታዎች',
  allTechnicians: 'ሁሉም ቴክኒሻኖች',
  allDates: 'ሁሉም ቀናት',
  today: 'ዛሬ',
  thisWeek: 'የዚህ ሳምንት',
  thisMonth: 'የዚህ ወር',
  lastMonth: 'ያለፈው ወር',
  refresh: 'አድስ',
  loading: 'የጥገና ሁኔታ በመጫን ላይ...',
  noData: 'ምንም የጥገና መረጃ አልተገኘም።',
  showing: 'የሚታየው',
  of: 'ከ',
  requestId: 'የጥያቄ መለያ',
  asset: 'ንብረት',
  problem: 'ችግር',
  priority: 'ቅድሚያ',
  status: 'ሁኔታ',
  technician: 'ቴክኒሽያን',
  location: 'ቦታ',
  lastUpdated: 'የመጨረሻ ዝመና',
  action: 'እርምጃ',
  view: 'እይታ',
  previous: 'ቀዳሚ',
  next: 'ቀጣይ',
  page: 'ገጽ',
  due: 'የሚፈጸም',
  requestDetails: 'የጥገና ጥያቄ ዝርዝሮች',
  currentStatus: 'የአሁኑ ሁኔታ',
  requestDate: 'የተጠየቀበት ቀን',
  assetDetails: 'የንብረት ዝርዝሮች',
  assetCode: 'የንብረት ኮድ',
  assetName: 'የንብረት ስም',
  department: 'መምሪያ',
  serialNumber: 'መለያ ቁጥር',
  condition: 'ሁኔታ',
  problemSection: 'ችግር / ማስታወሻ',
  timeline: 'የጥገና ጊዜ መስመር',
  close: 'ዝጋ',
  fetchError: 'የጥገና ሁኔታ መጫን አልተቻለም።',
};

export default StoreMaintenanceStatus;