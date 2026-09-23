import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, ArrowRight, Building2, CalendarClock, CheckCircle2, ChevronDown, ClipboardList, Clock3, Eye, Filter, LoaderCircle, MoreHorizontal, PackageSearch, Plus, RefreshCw, Search, ShieldCheck, UserCheck, X } from 'lucide-react';
import { toast } from 'react-toastify';
import { useLanguage } from '../../contexts/UiContext';
import { apiClient as axios } from '../../utils/api';

export const parseExpectedReturnDate = (assignment) => {
  if (assignment?.expected_return_date) return assignment.expected_return_date;
  if (assignment?.expectedReturnDate) return assignment.expectedReturnDate;

  try {
    const parsed = typeof assignment?.notes === 'string' ? JSON.parse(assignment.notes) : assignment?.notes;
    if (parsed?.expectedReturnDate) return parsed.expectedReturnDate;
    if (parsed?.expected_return_date) return parsed.expected_return_date;
  } catch (error) {
    // Ignore parsing issues; notes may be plain text.
  }

  return '';
};

export const formatAssignmentDate = (value, fallback = 'Not specified') => {
  if (!value) return fallback;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback;

  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

export const getAssignmentLifecycleStatus = (assignment) => {
  const rawStatus = String(assignment?.status || '').trim().toLowerCase();
  const isReturned = assignment?.returned_at || assignment?.actual_return_date || rawStatus === 'returned';

  if (isReturned) {
    return 'returned';
  }

  const expectedReturn = parseExpectedReturnDate(assignment);
  if (!expectedReturn) {
    return 'active';
  }

  const expectedDate = new Date(expectedReturn);
  if (Number.isNaN(expectedDate.getTime())) {
    return 'active';
  }

  const now = new Date();
  const differenceInDays = (expectedDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

  if (differenceInDays < 0) {
    return 'overdue';
  }

  if (differenceInDays <= 7) {
    return 'due-soon';
  }

  return 'active';
};

export const buildAssignmentSummary = (rows = []) => {
  const summary = {
    total: rows.length,
    active: 0,
    dueSoon: 0,
    overdue: 0,
    returned: 0,
  };

  rows.forEach((assignment) => {
    const status = getAssignmentLifecycleStatus(assignment);
    if (status === 'active') summary.active += 1;
    if (status === 'due-soon') summary.dueSoon += 1;
    if (status === 'overdue') summary.overdue += 1;
    if (status === 'returned') summary.returned += 1;
  });

  return summary;
};

const AdminAssignment = () => {
  const { language, theme } = useLanguage();
  const isDark = theme === 'dark';
  const t = language === 'en' ? englishTranslations : amharicTranslations;

  const [assignments, setAssignments] = useState([]);
  const [assets, setAssets] = useState([]);
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [selectedReturnAssignment, setSelectedReturnAssignment] = useState(null);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [historyAsset, setHistoryAsset] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [filterUser, setFilterUser] = useState('all');
  const [filterDateRange, setFilterDateRange] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [saving, setSaving] = useState(false);
  const [returningId, setReturningId] = useState(null);
  const [actionMenuId, setActionMenuId] = useState(null);
  const [summary, setSummary] = useState(buildAssignmentSummary([]));

  const [formData, setFormData] = useState({
    assetId: '',
    assignedTo: '',
    department: '',
    location: '',
    assignmentDate: new Date().toISOString().split('T')[0],
    expectedReturnDate: '',
    notes: '',
  });

  const itemsPerPage = 10;

  const extractArray = useCallback((response, keys = []) => {
    const data = response?.data;
    if (Array.isArray(data)) return data;
    for (const key of keys) {
      if (Array.isArray(data?.[key])) return data[key];
    }
    if (Array.isArray(data?.data)) return data.data;
    return [];
  }, []);

  const getAssetStatus = (asset) => String(asset?.status || '').trim().toLowerCase().replace(/[_ ]/g, '-');
  const getUserName = (user) => user?.fullName || user?.full_name || user?.name || user?.username || `User #${user?.id || ''}`;
  const getDepartmentName = (department) => department?.name || department?.department_name || department?.title || 'Not specified';
  const getAssetTag = (asset) => asset?.assetCode || asset?.asset_code || asset?.assetTag || asset?.asset_tag || `AST-${asset?.id || ''}`;
  const getAssetName = (asset) => asset?.name || asset?.asset_name || 'Unnamed asset';

  const fetchAssignments = useCallback(async () => {
    try {
      const response = await axios.get('/api/assignments', { params: { page: 1, limit: 500 } });
      const rows = extractArray(response, ['assignments', 'data']);
      setAssignments(rows);
      setSummary(buildAssignmentSummary(rows));
      setLoadError(false);
      return rows;
    } catch (error) {
      console.error('Failed to load assignments:', error);
      setAssignments([]);
      setSummary(buildAssignmentSummary([]));
      setLoadError(true);
      throw error;
    }
  }, [extractArray]);

  const fetchAssets = useCallback(async () => {
    try {
      const response = await axios.get('/api/assets');
      const rows = extractArray(response, ['assets', 'data']);
      setAssets(rows);
      return rows;
    } catch (error) {
      console.error('Failed to load assets:', error);
      setAssets([]);
      return [];
    }
  }, [extractArray]);

  const fetchUsers = useCallback(async () => {
    try {
      const response = await axios.get('/api/users');
      const rows = extractArray(response, ['users', 'data']);
      setUsers(rows);
      return rows;
    } catch (error) {
      console.error('Failed to load users:', error);
      setUsers([]);
      return [];
    }
  }, [extractArray]);

  const fetchDepartments = useCallback(async () => {
    try {
      const response = await axios.get('/api/departments');
      const rows = extractArray(response, ['departments', 'data']);
      setDepartments(rows);
      return rows;
    } catch (error) {
      console.error('Failed to load departments:', error);
      setDepartments([]);
      return [];
    }
  }, [extractArray]);

  const resetForm = useCallback(() => {
    setFormData({
      assetId: '',
      assignedTo: '',
      department: '',
      location: '',
      assignmentDate: new Date().toISOString().split('T')[0],
      expectedReturnDate: '',
      notes: '',
    });
  }, []);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      try {
        await Promise.all([
          fetchAssignments(),
          fetchAssets(),
          fetchUsers(),
          fetchDepartments(),
        ]);
      } catch (error) {
        if (mounted) setLoadError(true);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [fetchAssignments, fetchAssets, fetchUsers, fetchDepartments]);

  const openNewAssignment = () => {
    resetForm();
    setShowForm(true);
  };

  const closeForm = () => {
    if (saving) return;
    setShowForm(false);
    resetForm();
  };

  const availableAssets = useMemo(
    () => assets.filter((asset) => {
      const status = getAssetStatus(asset);
      const active = assignments.some((assignment) => {
        const sameAsset = String(assignment.asset_id ?? assignment.assetId ?? assignment.asset?.id) === String(asset.id);
        return sameAsset && getAssignmentLifecycleStatus(assignment) !== 'returned';
      });

      return (!status || status === 'available') && !active;
    }),
    [assets, assignments]
  );

  const filteredAssignments = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return assignments.filter((assignment) => {
      const searchValues = [
        assignment.asset_tag,
        assignment.asset_name,
        assignment.asset_code,
        assignment.assigned_to_name,
        assignment.user_name,
        assignment.department_name,
        assignment.department,
        assignment.location,
        assignment.notes,
      ];

      const matchesSearch = !query || searchValues.some((value) => String(value || '').toLowerCase().includes(query));
      const status = getAssignmentLifecycleStatus(assignment);
      const matchesStatus = filterStatus === 'all' || status === filterStatus.replace(' ', '-');

      const assignmentDepartment = String(assignment.department_id || assignment.department || assignment.department_name || '').toLowerCase();
      const matchesDepartment = filterDepartment === 'all' || assignmentDepartment === String(filterDepartment).toLowerCase();
      const matchesUser = filterUser === 'all' || String(assignment.assigned_to || assignment.assignedTo) === String(filterUser);

      let matchesDateRange = true;
      if (filterDateRange === 'assignment-30') {
        const assignmentDate = new Date(assignment.assigned_date || assignment.assignment_date || assignment.createdAt || '');
        const now = new Date();
        const startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        matchesDateRange = !Number.isNaN(assignmentDate.getTime()) && assignmentDate >= startDate;
      }
      if (filterDateRange === 'expected-30') {
        const now = new Date();
        const expectedDate = new Date(parseExpectedReturnDate(assignment));
        const endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        matchesDateRange = !Number.isNaN(expectedDate.getTime()) && expectedDate >= now && expectedDate <= endDate;
      }
      if (filterDateRange === 'overdue') {
        matchesDateRange = status === 'overdue';
      }

      return matchesSearch && matchesStatus && matchesDepartment && matchesUser && matchesDateRange;
    });
  }, [assignments, filterDateRange, filterDepartment, filterStatus, filterUser, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredAssignments.length / itemsPerPage));

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  const paginatedAssignments = filteredAssignments.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const startItem = filteredAssignments.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, filteredAssignments.length);

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormData((previous) => ({ ...previous, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving) return;

    if (!formData.assetId) {
      toast.error(t.assetRequired || 'Please select an asset.');
      return;
    }

    if (!formData.assignedTo) {
      toast.error(t.assigneeRequired || 'Please select a user.');
      return;
    }

    if (!formData.assignmentDate) {
      toast.error(t.assignmentDateRequired || 'Assignment date is required.');
      return;
    }

    const assignmentDate = new Date(formData.assignmentDate);
    const expectedReturnDate = formData.expectedReturnDate ? new Date(formData.expectedReturnDate) : null;

    if (Number.isNaN(assignmentDate.getTime())) {
      toast.error(t.invalidDate || 'Please enter a valid assignment date.');
      return;
    }

    if (expectedReturnDate && Number.isNaN(expectedReturnDate.getTime())) {
      toast.error(t.invalidReturnDate || 'Please enter a valid expected return date.');
      return;
    }

    if (expectedReturnDate && expectedReturnDate < assignmentDate) {
      toast.error(t.returnDateError || 'Expected return date cannot be before the assignment date.');
      return;
    }

    const selectedAsset = assets.find((asset) => String(asset.id) === String(formData.assetId));
    if (!selectedAsset) {
      toast.error(t.assetNotFound || 'Selected asset was not found.');
      return;
    }

    const status = getAssetStatus(selectedAsset);
    if (status && status !== 'available') {
      toast.error(t.assetUnavailable || 'This asset is not available for assignment.');
      return;
    }

    const alreadyAssigned = assignments.some((assignment) => {
      const sameAsset = String(assignment.asset_id ?? assignment.assetId ?? assignment.asset?.id) === String(formData.assetId);
      return sameAsset && getAssignmentLifecycleStatus(assignment) !== 'returned';
    });

    if (alreadyAssigned) {
      toast.error(t.assetAlreadyAssigned || 'This asset already has an active assignment.');
      return;
    }

    setSaving(true);

    try {
      const payload = {
        asset_id: formData.assetId,
        assigned_to: formData.assignedTo,
        department_id: formData.department || null,
        location: formData.location.trim() || null,
        assigned_date: formData.assignmentDate,
        expected_return_date: formData.expectedReturnDate || null,
        notes: formData.notes.trim() || null,
      };

      await axios.post('/api/assignments', payload);
      toast.success(t.assignmentCreated || 'Asset assigned successfully.');
      closeForm();
      setCurrentPage(1);
      await Promise.all([fetchAssignments(), fetchAssets()]);
    } catch (error) {
      console.error('Failed to create assignment:', error);
      toast.error(error?.response?.data?.message || t.assignmentCreateFailed || 'Unable to create assignment.');
    } finally {
      setSaving(false);
    }
  };

  const handleReturnAsset = async (assignment) => {
    if (!assignment?.id) return;
    setSelectedReturnAssignment(assignment);
    setShowReturnModal(true);
  };

  const confirmReturn = async () => {
    if (!selectedReturnAssignment) return;
    setReturningId(selectedReturnAssignment.id);

    try {
      await axios.post(`/api/assignments/${selectedReturnAssignment.id}/return`, {});
      setShowReturnModal(false);
      setSelectedReturnAssignment(null);
      toast.success(t.assetReturned || 'Asset returned successfully.');
      await Promise.all([fetchAssignments(), fetchAssets()]);
    } catch (error) {
      console.error('Failed to return asset:', error);
      toast.error(error?.response?.data?.message || t.returnFailed || 'Unable to return the asset.');
    } finally {
      setReturningId(null);
    }
  };

  const handleViewHistory = async (assetId, assetName) => {
    if (!assetId) return;

    try {
      const response = await axios.get(`/api/assignments/history/${assetId}`);
      const rows = Array.isArray(response?.data?.history) ? response.data.history : [];
      setHistoryData(rows);
      setHistoryAsset({ id: assetId, name: assetName });
    } catch (error) {
      console.error('Failed to load assignment history:', error);
      toast.error(error?.response?.data?.message || 'Unable to load assignment history.');
    }
  };

  const refreshData = async () => {
    setRefreshing(true);
    try {
      await Promise.all([fetchAssignments(), fetchAssets(), fetchUsers(), fetchDepartments()]);
      toast.success(t.refreshed || 'Data refreshed successfully.');
    } catch (error) {
      toast.error(t.refreshFailed || 'Failed to refresh data.');
    } finally {
      setRefreshing(false);
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setFilterStatus('all');
    setFilterDepartment('all');
    setFilterUser('all');
    setFilterDateRange('all');
    setCurrentPage(1);
  };

  const summaryCards = [
    { key: 'total', label: t.totalAssignments, value: summary.total, color: 'var(--color-primary)', icon: ClipboardList },
    { key: 'active', label: t.active, value: summary.active, color: 'var(--color-success)', icon: UserCheck },
    { key: 'dueSoon', label: t.dueSoon, value: summary.dueSoon, color: 'var(--color-warning)', icon: CalendarClock },
    { key: 'overdue', label: t.overdue, value: summary.overdue, color: 'var(--color-danger)', icon: AlertTriangle },
    { key: 'returned', label: t.returned, value: summary.returned, color: '#64748b', icon: CheckCircle2 },
  ];

  const styles = useMemo(() => ({
    page: {
      minHeight: '100vh',
      padding: '24px',
      background: isDark ? 'var(--color-background-dark, #0f172a)' : 'var(--color-background, #f8fafc)',
      color: isDark ? '#dfeaf9' : '#0f172a',
    },
    shell: {
      maxWidth: '1500px',
      margin: '0 auto',
    },
    breadcrumb: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      flexWrap: 'wrap',
      fontSize: '0.76rem',
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      color: isDark ? '#8ca3c1' : '#64748b',
      fontWeight: 700,
      marginBottom: '14px',
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: '16px',
      flexWrap: 'wrap',
      marginBottom: '20px',
    },
    title: {
      margin: 0,
      color: isDark ? '#dfeaf9' : '#142a4a',
      fontSize: '2rem',
      fontWeight: 800,
      letterSpacing: '-0.03em',
    },
    subtitle: {
      margin: '8px 0 0',
      color: isDark ? '#9aaec6' : '#475569',
      fontSize: '0.96rem',
      maxWidth: '760px',
    },
    primaryButton: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
      background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-hover))',
      color: '#ffffff',
      border: 'none',
      borderRadius: '10px',
      padding: '11px 18px',
      cursor: 'pointer',
      fontWeight: 700,
      boxShadow: 'var(--shadow-sm)',
    },
    secondaryButton: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
      background: isDark ? '#1e293b' : '#ffffff',
      border: `1px solid ${isDark ? '#334155' : '#dfe7f1'}`,
      color: isDark ? '#dfeaf9' : '#1e293b',
      borderRadius: '10px',
      padding: '10px 14px',
      cursor: 'pointer',
      fontWeight: 600,
    },
    summaryGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
      gap: '14px',
      marginBottom: '18px',
    },
    summaryCard: {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      gap: '12px',
      background: isDark ? '#111827' : '#ffffff',
      border: `1px solid ${isDark ? '#243244' : '#e2e8f0'}`,
      borderTop: '3px solid var(--color-primary)',
      borderRadius: '12px',
      padding: '16px',
      boxShadow: 'var(--shadow-sm)',
      textAlign: 'left',
      minHeight: '118px',
      cursor: 'pointer',
    },
    statHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      color: isDark ? '#b9c8dd' : '#475569',
      fontSize: '0.75rem',
      fontWeight: 700,
      letterSpacing: '0.02em',
      textTransform: 'uppercase',
    },
    statValue: {
      fontSize: '1.8rem',
      fontWeight: 800,
      color: isDark ? '#f8fbff' : '#101c34',
      lineHeight: 1.2,
    },
    toolbar: {
      background: isDark ? '#111827' : '#ffffff',
      border: `1px solid ${isDark ? '#243244' : '#e2e8f0'}`,
      borderRadius: '12px',
      boxShadow: 'var(--shadow-sm)',
      display: 'grid',
      gridTemplateColumns: 'minmax(220px, 1.5fr) repeat(3, minmax(140px, 1fr)) auto auto',
      gap: '12px',
      padding: '14px',
      marginBottom: '18px',
      alignItems: 'center',
    },
    searchBox: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      background: isDark ? '#0f172a' : '#f8fafc',
      border: `1px solid ${isDark ? '#334155' : '#dbe7f3'}`,
      borderRadius: '10px',
      padding: '0 12px',
      minHeight: '42px',
    },
    input: {
      border: 'none',
      outline: 'none',
      background: 'transparent',
      width: '100%',
      color: isDark ? '#f8fbff' : '#0f172a',
      fontSize: '0.92rem',
    },
    select: {
      width: '100%',
      minHeight: '42px',
      borderRadius: '10px',
      border: `1px solid ${isDark ? '#334155' : '#dbe7f3'}`,
      background: isDark ? '#0f172a' : '#f8fafc',
      color: isDark ? '#f8fbff' : '#0f172a',
      padding: '0 12px',
      outline: 'none',
    },
    panel: {
      background: isDark ? '#111827' : '#ffffff',
      border: `1px solid ${isDark ? '#243244' : '#e2e8f0'}`,
      borderRadius: '12px',
      boxShadow: 'var(--shadow-sm)',
      overflow: 'hidden',
    },
    tableWrap: {
      overflowX: 'auto',
    },
    table: {
      width: '100%',
      minWidth: '1100px',
      borderCollapse: 'collapse',
    },
    th: {
      textAlign: 'left',
      fontSize: '0.76rem',
      fontWeight: 800,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      color: isDark ? '#b9c8dd' : '#475569',
      background: isDark ? '#0f172a' : '#f8fafc',
      borderBottom: `1px solid ${isDark ? '#243244' : '#e2e8f0'}`,
      padding: '12px 16px',
    },
    td: {
      borderBottom: `1px solid ${isDark ? '#243244' : '#e2e8f0'}`,
      padding: '14px 16px',
      verticalAlign: 'middle',
      color: isDark ? '#dfeaf9' : '#1f2d3d',
      background: 'transparent',
    },
    assetTitle: {
      fontWeight: 700,
      color: isDark ? '#f8fbff' : '#101c34',
    },
    assetSubtitle: {
      fontSize: '0.76rem',
      color: isDark ? '#9aaec6' : '#64748b',
      marginTop: '4px',
    },
    badge: (status) => {
      const map = {
        active: ['rgba(16,185,129,0.12)', '#047857'],
        'due-soon': ['rgba(245,158,11,0.12)', '#b45309'],
        overdue: ['rgba(239,68,68,0.12)', '#b91c1c'],
        returned: ['rgba(100,116,139,0.12)', '#475569'],
      };
      const [background, color] = map[status] || ['rgba(148,163,184,0.12)', '#475569'];
      return { background, color, borderRadius: '999px', padding: '6px 10px', display: 'inline-flex', alignItems: 'center', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.02em' };
    },
    actionButton: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '32px',
      height: '32px',
      borderRadius: '8px',
      border: 'none',
      cursor: 'pointer',
      background: 'rgba(37, 99, 235, 0.1)',
      color: '#2563eb',
    },
    muted: {
      color: isDark ? '#9aaec6' : '#64748b',
      fontSize: '0.8rem',
    },
    emptyState: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '46px 20px',
      textAlign: 'center',
      color: isDark ? '#dfeaf9' : '#475569',
    },
    emptyIcon: {
      marginBottom: '12px',
      color: isDark ? '#9aaec6' : '#94a3b8',
    },
    modalBackdrop: {
      position: 'fixed',
      inset: 0,
      background: 'rgba(15, 23, 42, 0.52)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      zIndex: 2000,
    },
    modal: {
      width: 'min(760px, 100%)',
      background: isDark ? '#111827' : '#ffffff',
      borderRadius: '16px',
      border: `1px solid ${isDark ? '#243244' : '#e2e8f0'}`,
      boxShadow: 'var(--shadow-lg)',
      overflow: 'hidden',
    },
    modalHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: '12px',
      padding: '18px 20px',
      borderBottom: `1px solid ${isDark ? '#243244' : '#e2e8f0'}`,
    },
    modalTitle: {
      margin: 0,
      color: isDark ? '#f8fbff' : '#142a4a',
      fontSize: '1.2rem',
      fontWeight: 800,
    },
    modalBody: {
      padding: '20px',
    },
    formGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
      gap: '16px',
    },
    formGroup: {
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    },
    label: {
      color: isDark ? '#dfeaf9' : '#334155',
      fontSize: '0.82rem',
      fontWeight: 700,
    },
    formInput: {
      width: '100%',
      minHeight: '42px',
      borderRadius: '10px',
      border: `1px solid ${isDark ? '#334155' : '#dbe7f3'}`,
      background: isDark ? '#0f172a' : '#f8fafc',
      color: isDark ? '#f8fbff' : '#0f172a',
      padding: '0 12px',
      outline: 'none',
      boxSizing: 'border-box',
    },
    textarea: {
      width: '100%',
      minHeight: '110px',
      padding: '12px',
      borderRadius: '10px',
      border: `1px solid ${isDark ? '#334155' : '#dbe7f3'}`,
      background: isDark ? '#0f172a' : '#f8fafc',
      color: isDark ? '#f8fbff' : '#0f172a',
      resize: 'vertical',
      outline: 'none',
    },
    modalActions: {
      display: 'flex',
      justifyContent: 'flex-end',
      gap: '12px',
      marginTop: '18px',
      flexWrap: 'wrap',
    },
    statIconWrap: {
      width: '38px',
      height: '38px',
      borderRadius: '10px',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(37,99,235,0.08)',
    },
    skeletonRow: {
      height: '60px',
      background: isDark ? '#0f172a' : '#f8fafc',
      borderRadius: '10px',
      animation: 'pulse 1.4s ease-in-out infinite',
    },
    pageButton: (active, disabled) => ({
      minWidth: '34px',
      height: '34px',
      borderRadius: '8px',
      border: `1px solid ${isDark ? '#334155' : '#dbe7f3'}`,
      background: active ? 'var(--color-primary)' : isDark ? '#0f172a' : '#ffffff',
      color: active ? '#ffffff' : isDark ? '#dfeaf9' : '#1e293b',
      fontWeight: 700,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.6 : 1,
    }),
  }));

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.shell}>
          <div style={styles.breadcrumb}><span>Admin</span><span>/</span><span>Assets</span><span>/</span><span>Asset Assignment</span></div>
          <div style={{ ...styles.panel, padding: '18px' }}>
            <div style={{ ...styles.skeletonRow, marginBottom: '12px' }} />
            <div style={{ ...styles.skeletonRow, marginBottom: '12px', width: '60%' }} />
            <div style={{ ...styles.skeletonRow, marginBottom: '12px' }} />
            <div style={{ ...styles.skeletonRow }} />
          </div>
        </div>
      </div>
    );
  }

  if (loadError && assignments.length === 0) {
    return (
      <div style={styles.page}>
        <div style={styles.shell}>
          <div style={styles.emptyState}>
            <AlertTriangle size={42} style={styles.emptyIcon} />
            <h2 style={{ margin: '0 0 8px' }}>{t.loadError}</h2>
            <p style={{ margin: '0 0 16px', maxWidth: '480px' }}>{t.loadErrorDescription}</p>
            <button type="button" style={styles.primaryButton} onClick={refreshData}><RefreshCw size={16} /> {t.retry}</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.shell}>
        <nav style={styles.breadcrumb} aria-label="Breadcrumb">
          <span>Admin</span>
          <span>/</span>
          <span>Assets</span>
          <span>/</span>
          <span style={{ color: isDark ? '#dfeaf9' : '#142a4a' }}>Asset Assignment</span>
        </nav>

        <header style={styles.header}>
          <div>
            <h1 style={styles.title}>{t.title}</h1>
            <p style={styles.subtitle}>{t.subtitle}</p>
          </div>

          <button type="button" style={styles.primaryButton} onClick={openNewAssignment}>
            <Plus size={16} />
            {t.newAssignment}
          </button>
        </header>

        <section style={styles.summaryGrid}>
          {summaryCards.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.key}
                type="button"
                style={{
                  ...styles.summaryCard,
                  borderTop: `3px solid ${card.color}`,
                }}
                onClick={() => {
                  if (card.key === 'total') setFilterStatus('all');
                  else if (card.key === 'active') setFilterStatus('active');
                  else if (card.key === 'dueSoon') setFilterStatus('due-soon');
                  else if (card.key === 'overdue') setFilterStatus('overdue');
                  else if (card.key === 'returned') setFilterStatus('returned');
                  setCurrentPage(1);
                }}
              >
                <div style={styles.statHeader}>
                  <span>{card.label}</span>
                  <span style={{ ...styles.statIconWrap, background: `${card.color}14` }}>
                    <Icon size={18} color={card.color} />
                  </span>
                </div>
                <div style={styles.statValue}>{card.value}</div>
              </button>
            );
          })}
        </section>

        {showForm && (
          <div style={styles.modalBackdrop} onClick={closeForm}>
            <div style={styles.modal} onClick={(event) => event.stopPropagation()}>
              <div style={styles.modalHeader}>
                <div>
                  <h2 style={styles.modalTitle}>{t.newAssignment}</h2>
                  <p style={{ ...styles.muted, margin: '6px 0 0' }}>{t.assignmentDescription}</p>
                </div>
                <button type="button" style={styles.secondaryButton} onClick={closeForm} aria-label={t.close}><X size={16} /></button>
              </div>

              <div style={styles.modalBody}>
                <form onSubmit={handleSubmit}>
                  <div style={styles.formGrid}>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>{t.asset} *</label>
                      <select name="assetId" value={formData.assetId} onChange={handleInputChange} style={styles.formInput} required>
                        <option value="">{t.selectAsset}</option>
                        {availableAssets.map((asset) => (
                          <option key={asset.id} value={asset.id}>
                            {getAssetTag(asset)} — {getAssetName(asset)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={styles.formGroup}>
                      <label style={styles.label}>{t.assignedTo} *</label>
                      <select name="assignedTo" value={formData.assignedTo} onChange={handleInputChange} style={styles.formInput} required>
                        <option value="">{t.selectUser}</option>
                        {users.map((user) => (
                          <option key={user.id} value={user.id}>
                            {getUserName(user)}{user.role ? ` — ${user.role}` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={styles.formGroup}>
                      <label style={styles.label}>{t.department}</label>
                      <select name="department" value={formData.department} onChange={handleInputChange} style={styles.formInput}>
                        <option value="">{t.selectDepartment}</option>
                        {departments.map((department) => (
                          <option key={department.id} value={department.id}>{getDepartmentName(department)}</option>
                        ))}
                      </select>
                    </div>

                    <div style={styles.formGroup}>
                      <label style={styles.label}>{t.location}</label>
                      <input type="text" name="location" value={formData.location} onChange={handleInputChange} placeholder={t.enterLocation} style={styles.formInput} />
                    </div>

                    <div style={styles.formGroup}>
                      <label style={styles.label}>{t.assignmentDate} *</label>
                      <input type="date" name="assignmentDate" value={formData.assignmentDate} onChange={handleInputChange} style={styles.formInput} required />
                    </div>

                    <div style={styles.formGroup}>
                      <label style={styles.label}>{t.expectedReturn}</label>
                      <input type="date" name="expectedReturnDate" value={formData.expectedReturnDate} onChange={handleInputChange} min={formData.assignmentDate} style={styles.formInput} />
                    </div>
                  </div>

                  <div style={{ ...styles.formGroup, marginTop: '18px' }}>
                    <label style={styles.label}>{t.notes}</label>
                    <textarea name="notes" value={formData.notes} onChange={handleInputChange} placeholder={t.enterNotes} style={styles.textarea} />
                  </div>

                  <div style={styles.modalActions}>
                    <button type="button" style={styles.secondaryButton} onClick={closeForm} disabled={saving}>{t.cancel}</button>
                    <button type="submit" style={{ ...styles.primaryButton, opacity: saving ? 0.7 : 1, cursor: saving ? 'not-allowed' : 'pointer' }} disabled={saving || availableAssets.length === 0}>
                      {saving ? <LoaderCircle size={16} className="spin" /> : <CheckCircle2 size={16} />}
                      {saving ? t.saving : t.createAssignment}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {showReturnModal && selectedReturnAssignment && (
          <div style={styles.modalBackdrop} onClick={() => setShowReturnModal(false)}>
            <div style={styles.modal} onClick={(event) => event.stopPropagation()}>
              <div style={styles.modalHeader}>
                <div>
                  <h2 style={styles.modalTitle}>{t.returnAsset}</h2>
                  <p style={{ ...styles.muted, margin: '6px 0 0' }}>{t.returnConfirmation}</p>
                </div>
                <button type="button" style={styles.secondaryButton} onClick={() => setShowReturnModal(false)} aria-label={t.close}><X size={16} /></button>
              </div>

              <div style={styles.modalBody}>
                <div style={{ display: 'grid', gap: '10px' }}>
                  <div><strong>Asset:</strong> {selectedReturnAssignment.asset_name || selectedReturnAssignment.asset_tag || 'N/A'}</div>
                  <div><strong>Assigned To:</strong> {selectedReturnAssignment.assigned_to_name || selectedReturnAssignment.user_name || 'N/A'}</div>
                  <div><strong>Expected Return:</strong> {formatAssignmentDate(parseExpectedReturnDate(selectedReturnAssignment))}</div>
                </div>

                <div style={styles.modalActions}>
                  <button type="button" style={styles.secondaryButton} onClick={() => setShowReturnModal(false)}>{t.cancel}</button>
                  <button type="button" style={{ ...styles.primaryButton, background: 'linear-gradient(135deg, #ef4444, #dc2626)' }} onClick={confirmReturn} disabled={returningId === selectedReturnAssignment.id}>
                    {returningId === selectedReturnAssignment.id ? <LoaderCircle size={16} className="spin" /> : <ShieldCheck size={16} />}
                    {t.confirmReturn}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {selectedAssignment && (
          <div style={styles.modalBackdrop} onClick={() => setSelectedAssignment(null)}>
            <div style={styles.modal} onClick={(event) => event.stopPropagation()}>
              <div style={styles.modalHeader}>
                <div>
                  <h2 style={styles.modalTitle}>{t.assignmentDetails}</h2>
                  <p style={{ ...styles.muted, margin: '6px 0 0' }}>{selectedAssignment.asset_name || selectedAssignment.asset_tag || 'Assignment'}</p>
                </div>
                <button type="button" style={styles.secondaryButton} onClick={() => setSelectedAssignment(null)} aria-label={t.close}><X size={16} /></button>
              </div>
              <div style={styles.modalBody}>
                <div style={styles.formGrid}>
                  <div><strong>{t.asset}</strong><div style={styles.muted}>{selectedAssignment.asset_name || 'N/A'}</div></div>
                  <div><strong>{t.assignedTo}</strong><div style={styles.muted}>{selectedAssignment.assigned_to_name || selectedAssignment.user_name || 'N/A'}</div></div>
                  <div><strong>{t.department}</strong><div style={styles.muted}>{selectedAssignment.department_name || selectedAssignment.department || 'Not specified'}</div></div>
                  <div><strong>{t.location}</strong><div style={styles.muted}>{selectedAssignment.location || 'Not specified'}</div></div>
                  <div><strong>{t.assignmentDate}</strong><div style={styles.muted}>{formatAssignmentDate(selectedAssignment.assigned_date || selectedAssignment.assignment_date)}</div></div>
                  <div><strong>{t.expectedReturn}</strong><div style={styles.muted}>{formatAssignmentDate(parseExpectedReturnDate(selectedAssignment))}</div></div>
                  <div><strong>{t.status}</strong><div style={styles.muted}>{getAssignmentLifecycleStatus(selectedAssignment)}</div></div>
                  <div><strong>{t.notes}</strong><div style={styles.muted}>{selectedAssignment.notes || 'No notes provided.'}</div></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {historyAsset && (
          <div style={styles.modalBackdrop} onClick={() => setHistoryAsset(null)}>
            <div style={styles.modal} onClick={(event) => event.stopPropagation()}>
              <div style={styles.modalHeader}>
                <div>
                  <h2 style={styles.modalTitle}>{t.assignmentHistory}</h2>
                  <p style={{ ...styles.muted, margin: '6px 0 0' }}>{historyAsset.name}</p>
                </div>
                <button type="button" style={styles.secondaryButton} onClick={() => setHistoryAsset(null)} aria-label={t.close}><X size={16} /></button>
              </div>
              <div style={styles.modalBody}>
                <div style={styles.tableWrap}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>{t.assignedTo}</th>
                        <th style={styles.th}>{t.department}</th>
                        <th style={styles.th}>{t.assignmentDate}</th>
                        <th style={styles.th}>{t.status}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyData.length === 0 ? (
                        <tr><td style={styles.td} colSpan={4}>{t.noHistory}</td></tr>
                      ) : (
                        historyData.map((row) => (
                          <tr key={row.id}>
                            <td style={styles.td}>{row.assigned_to_name || row.user_name || 'Unknown user'}</td>
                            <td style={styles.td}>{row.department_name || row.department || 'Not specified'}</td>
                            <td style={styles.td}>{formatAssignmentDate(row.assigned_date || row.assignment_date)}</td>
                            <td style={styles.td}><span style={styles.badge(getAssignmentLifecycleStatus(row))}>{getAssignmentLifecycleStatus(row)}</span></td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        <section style={styles.toolbar}>
          <div style={styles.searchBox}>
            <Search size={16} color={isDark ? '#9aaec6' : '#64748b'} />
            <input type="text" value={searchQuery} onChange={(event) => { setSearchQuery(event.target.value); setCurrentPage(1); }} placeholder={t.searchPlaceholder} style={styles.input} aria-label={t.searchPlaceholder} />
          </div>

          <select aria-label={t.status} value={filterStatus} onChange={(event) => { setFilterStatus(event.target.value); setCurrentPage(1); }} style={styles.select}>
            <option value="all">{t.allStatus}</option>
            <option value="active">{t.active}</option>
            <option value="due-soon">{t.dueSoon}</option>
            <option value="overdue">{t.overdue}</option>
            <option value="returned">{t.returned}</option>
          </select>

          <select aria-label={t.department} value={filterDepartment} onChange={(event) => { setFilterDepartment(event.target.value); setCurrentPage(1); }} style={styles.select}>
            <option value="all">{t.allDepartments}</option>
            {departments.map((department) => (
              <option key={department.id} value={String(department.id)}>{getDepartmentName(department)}</option>
            ))}
          </select>

          <select aria-label={t.assignedTo} value={filterUser} onChange={(event) => { setFilterUser(event.target.value); setCurrentPage(1); }} style={styles.select}>
            <option value="all">{t.allUsers}</option>
            {users.map((user) => (
              <option key={user.id} value={String(user.id)}>{getUserName(user)}</option>
            ))}
          </select>

          <select aria-label={t.dateRange} value={filterDateRange} onChange={(event) => { setFilterDateRange(event.target.value); setCurrentPage(1); }} style={styles.select}>
            <option value="all">{t.allDates}</option>
            <option value="assignment-30">{t.assignmentLast30}</option>
            <option value="expected-30">{t.expectedNext30}</option>
            <option value="overdue">{t.overdue}</option>
          </select>

          <button type="button" style={styles.secondaryButton} onClick={clearFilters}>
            <Filter size={16} />
            {t.clearFilters}
          </button>

          <button type="button" style={styles.secondaryButton} onClick={refreshData} disabled={refreshing}>
            <RefreshCw size={16} className={refreshing ? 'spin' : ''} />
            {t.refresh}
          </button>
        </section>

        <div style={styles.panel}>
          {paginatedAssignments.length === 0 ? (
            <div style={styles.emptyState}>
              <PackageSearch size={42} style={styles.emptyIcon} />
              <h2 style={{ margin: '0 0 8px' }}>{searchQuery || filterStatus !== 'all' || filterDepartment !== 'all' || filterUser !== 'all' || filterDateRange !== 'all' ? t.noMatchingAssignments : t.noAssignments}</h2>
              <p style={{ margin: '0 0 16px', maxWidth: '480px' }}>{searchQuery || filterStatus !== 'all' || filterDepartment !== 'all' || filterUser !== 'all' || filterDateRange !== 'all' ? t.noMatchingDescription : t.noAssignmentsDescription}</p>
              {(searchQuery || filterStatus !== 'all' || filterDepartment !== 'all' || filterUser !== 'all' || filterDateRange !== 'all') ? (
                <button type="button" style={styles.secondaryButton} onClick={clearFilters}>{t.clearFilters}</button>
              ) : (
                <button type="button" style={styles.primaryButton} onClick={openNewAssignment}><Plus size={16} /> {t.newAssignment}</button>
              )}
            </div>
          ) : (
            <>
              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>{t.asset}</th>
                      <th style={styles.th}>{t.assignedTo}</th>
                      <th style={styles.th}>{t.department}</th>
                      <th style={styles.th}>{t.assignmentDate}</th>
                      <th style={styles.th}>{t.expectedReturn}</th>
                      <th style={styles.th}>{t.status}</th>
                      <th style={styles.th}>{t.actions}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedAssignments.map((assignment) => {
                      const status = getAssignmentLifecycleStatus(assignment);
                      const expectedReturn = parseExpectedReturnDate(assignment);
                      const assetId = assignment.asset_id ?? assignment.assetId ?? assignment.asset?.id;
                      const assetName = assignment.asset_name || assignment.asset?.name || 'Asset';
                      const assignmentStatusLabel = status === 'active' ? t.active : status === 'due-soon' ? t.dueSoon : status === 'overdue' ? t.overdue : t.returned;

                      return (
                        <tr key={assignment.id}>
                          <td style={styles.td}>
                            <div style={styles.assetTitle}>{assignment.asset_tag || assignment.asset_code || 'N/A'}</div>
                            <div style={styles.assetSubtitle}>{assetName}</div>
                          </td>
                          <td style={styles.td}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(37,99,235,0.12)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}><UserCheck size={14} /></span>
                              <div>
                                <div style={{ fontWeight: 700 }}>{assignment.assigned_to_name || assignment.user_name || 'Not specified'}</div>
                                <div style={styles.muted}>{assignment.username || assignment.user?.username || 'User'}</div>
                              </div>
                            </div>
                          </td>
                          <td style={styles.td}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(14,165,233,0.10)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#0ea5e9' }}><Building2 size={14} /></span>
                              <span>{assignment.department_name || assignment.department || 'Not specified'}</span>
                            </div>
                          </td>
                          <td style={styles.td}>{formatAssignmentDate(assignment.assigned_date || assignment.assignment_date || assignment.createdAt)}</td>
                          <td style={styles.td}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <Clock3 size={14} color={status === 'overdue' ? '#b91c1c' : '#f59e0b'} />
                              <span style={{ fontWeight: 600 }}>{formatAssignmentDate(expectedReturn)}</span>
                            </div>
                          </td>
                          <td style={styles.td}><span style={styles.badge(status)}>{assignmentStatusLabel}</span></td>
                          <td style={styles.td}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <button type="button" style={styles.actionButton} title={t.viewAsset} onClick={() => setSelectedAssignment(assignment)} aria-label={t.viewAsset}><Eye size={14} /></button>
                              {status !== 'returned' && (
                                <button type="button" style={{ ...styles.actionButton, background: 'rgba(245,158,11,0.12)', color: '#b45309' }} title={t.returnAsset} aria-label={t.returnAsset} onClick={() => handleReturnAsset(assignment)} disabled={returningId === assignment.id}>
                                  {returningId === assignment.id ? <LoaderCircle size={14} className="spin" /> : <RefreshCw size={14} />}
                                </button>
                              )}

                              <div style={{ position: 'relative' }}>
                                <button type="button" style={{ ...styles.actionButton, background: 'rgba(148,163,184,0.14)', color: '#475569' }} title={t.moreActions} aria-label={t.moreActions} onClick={() => setActionMenuId(actionMenuId === assignment.id ? null : assignment.id)}>
                                  <MoreHorizontal size={14} />
                                </button>
                                {actionMenuId === assignment.id && (
                                  <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', background: isDark ? '#0f172a' : '#ffffff', border: `1px solid ${isDark ? '#243244' : '#e2e8f0'}`, borderRadius: '10px', minWidth: '185px', boxShadow: 'var(--shadow-md)', zIndex: 100 }}>
                                    <button type="button" style={{ display: 'block', width: '100%', border: 'none', background: 'transparent', textAlign: 'left', padding: '10px 12px', cursor: 'pointer', color: isDark ? '#dfeaf9' : '#1e293b' }} onClick={() => { setSelectedAssignment(assignment); setActionMenuId(null); }}>{t.viewDetails}</button>
                                    <button type="button" style={{ display: 'block', width: '100%', border: 'none', background: 'transparent', textAlign: 'left', padding: '10px 12px', cursor: 'pointer', color: isDark ? '#dfeaf9' : '#1e293b' }} onClick={() => { if (assetId) handleViewHistory(assetId, assetName); setActionMenuId(null); }}>{t.viewHistory}</button>
                                    {status !== 'returned' && (
                                      <button type="button" style={{ display: 'block', width: '100%', border: 'none', background: 'transparent', textAlign: 'left', padding: '10px 12px', cursor: 'pointer', color: isDark ? '#dfeaf9' : '#1e293b' }} onClick={() => { handleReturnAsset(assignment); setActionMenuId(null); }}>{t.returnAsset}</button>
                                    )}
                                    {assignment.asset_id && (
                                      <Link to={`/assets/${assignment.asset_id}`} style={{ display: 'block', textDecoration: 'none', padding: '10px 12px', color: isDark ? '#dfeaf9' : '#1e293b' }} onClick={() => setActionMenuId(null)}>{t.viewAsset}</Link>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 18px', flexWrap: 'wrap', gap: '12px', borderTop: `1px solid ${isDark ? '#243244' : '#e2e8f0'}` }}>
                <div style={styles.muted}>{t.showing} {startItem}–{endItem} {t.of} {filteredAssignments.length}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage === 1} style={styles.pageButton(false, currentPage === 1)}>{t.previous}</button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, index) => {
                    const page = Math.min(Math.max(1, currentPage - 2 + index), totalPages);
                    return (
                      <button key={page} type="button" onClick={() => setCurrentPage(page)} style={styles.pageButton(page === currentPage, false)}>
                        {page}
                      </button>
                    );
                  })}
                  <button type="button" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={currentPage === totalPages} style={styles.pageButton(false, currentPage === totalPages)}>{t.next}</button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const englishTranslations = {
  title: 'Asset Assignment',
  subtitle: 'Assign university assets to users or departments, manage returns, and track assignment history.',
  newAssignment: 'New Assignment',
  close: 'Close',
  totalAssignments: 'Total Assignments',
  active: 'Active',
  dueSoon: 'Due Soon',
  overdue: 'Overdue',
  returned: 'Returned',
  assignmentDescription: 'Assign an available university asset to a user or department.',
  asset: 'Asset',
  assignedTo: 'Assigned To',
  department: 'Department',
  location: 'Location',
  assignmentDate: 'Assignment Date',
  expectedReturn: 'Expected Return',
  status: 'Status',
  actions: 'Actions',
  notes: 'Notes',
  assignmentDetails: 'Assignment Details',
  allStatus: 'All Status',
  allDepartments: 'All Departments',
  allUsers: 'All Users',
  allDates: 'All Dates',
  clearFilters: 'Clear Filters',
  refresh: 'Refresh',
  refreshed: 'Data refreshed successfully.',
  refreshFailed: 'Failed to refresh data.',
  searchPlaceholder: 'Search by asset tag, asset name, user, department...',
  createAssignment: 'Create Assignment',
  cancel: 'Cancel',
  saving: 'Saving...',
  selectAsset: 'Select asset',
  selectUser: 'Select user',
  selectDepartment: 'Select department',
  enterLocation: 'Enter location',
  enterNotes: 'Assignment notes...',
  assetRequired: 'Please select an asset.',
  assigneeRequired: 'Please select a user.',
  assignmentDateRequired: 'Assignment date is required.',
  invalidDate: 'Please enter a valid assignment date.',
  invalidReturnDate: 'Please enter a valid expected return date.',
  returnDateError: 'Expected return date cannot be before the assignment date.',
  assetNotFound: 'Selected asset was not found.',
  assetUnavailable: 'This asset is not available for assignment.',
  assetAlreadyAssigned: 'This asset already has an active assignment.',
  assignmentCreated: 'Asset assigned successfully.',
  assignmentCreateFailed: 'Unable to create assignment.',
  returnAsset: 'Return Asset',
  confirmReturn: 'Confirm Return',
  returnConfirmation: 'Are you sure you want to mark this asset as returned?',
  assetReturned: 'Asset returned successfully.',
  returnFailed: 'Unable to return the asset.',
  noAssignments: 'No assignments found',
  noAssignmentsDescription: 'There are currently no asset assignments matching your filters.',
  noMatchingAssignments: 'No matching assignments',
  noMatchingDescription: 'Try changing your search or filters.',
  retry: 'Retry',
  loadError: 'Unable to load assignments',
  loadErrorDescription: 'We could not retrieve assignment data from the server.',
  showing: 'Showing',
  of: 'of',
  previous: 'Previous',
  next: 'Next',
  viewAsset: 'View Asset',
  viewDetails: 'View Details',
  viewHistory: 'View History',
  assignmentHistory: 'Assignment History',
  noHistory: 'No assignment history found.',
  moreActions: 'More actions',
  dateRange: 'Date Range',
  assignmentLast30: 'Assignment in last 30 days',
  expectedNext30: 'Expected return in next 30 days',
};

const amharicTranslations = {
  title: 'የንብረት ምደባ',
  subtitle: 'የዩኒቨርሲቲ ንብረቶችን ለተጠቃሚዎች ወይም ክፍሎች ይመድቡ፣ መልሶችን ያስተዳድሩ እና የምደባ ታሪክ ያዩ።',
  newAssignment: 'አዲስ ምደባ',
  close: 'ዝጋ',
  totalAssignments: 'ጠቅላላ ምደባ',
  active: 'ንቁ',
  dueSoon: 'በቅርቡ የሚመለስ',
  overdue: 'ጊዜው ያለፈ',
  returned: 'የተመለሰ',
  assignmentDescription: 'አንድ ዝግጁ የዩኒቨርሲቲ ንብረት ለተጠቃሚ ወይም ክፍል ይመድቡ።',
  asset: 'ንብረት',
  assignedTo: 'የተመደበ',
  department: 'ክፍል',
  location: 'ቦታ',
  assignmentDate: 'የምደባ ቀን',
  expectedReturn: 'የሚመለስበት ቀን',
  status: 'ሁኔታ',
  actions: 'እርምጃዎች',
  notes: 'ማስታወሻ',
  assignmentDetails: 'የምደባ ዝርዝሮች',
  allStatus: 'ሁሉም ሁኔታዎች',
  allDepartments: 'ሁሉም ክፍሎች',
  allUsers: 'ሁሉም ተጠቃሚዎች',
  allDates: 'ሁሉም ቀናት',
  clearFilters: 'ማጣሪያ አጽዳ',
  refresh: 'አድስ',
  refreshed: 'መረጃው በተሳካ ሁኔታ ታድሷል።',
  refreshFailed: 'መረጃውን ማደስ አልተቻለም።',
  searchPlaceholder: 'በንብረት ኮድ፣ ስም፣ ተጠቃሚ ወይም ክፍል ይፈልጉ...',
  createAssignment: 'ምደባ ፍጠር',
  cancel: 'ሰርዝ',
  saving: 'በማስቀመጥ ላይ...',
  selectAsset: 'ንብረት ይምረጡ',
  selectUser: 'ተጠቃሚ ይምረጡ',
  selectDepartment: 'ክፍል ይምረጡ',
  enterLocation: 'ቦታ ያስገቡ',
  enterNotes: 'የምደባ ማስታወሻ...',
  assetRequired: 'እባክዎ ንብረት ይምረጡ።',
  assigneeRequired: 'እባክዎ ተጠቃሚ ይምረጡ።',
  assignmentDateRequired: 'የምደባ ቀን ያስፈልጋል።',
  invalidDate: 'እባክዎ ትክክለኛ የምደባ ቀን ያስገቡ።',
  invalidReturnDate: 'እባክዎ ትክክለኛ የመልሶ ቀን ያስገቡ።',
  returnDateError: 'የመልሶ ቀን ከምደባ ቀን በፊት መሆን አይችልም።',
  assetNotFound: 'የተመረጠው ንብረት አልተገኘም።',
  assetUnavailable: 'ይህ ንብረት ለምደባ አይገኝም።',
  assetAlreadyAssigned: 'ይህ ንብረት አስቀድሞ ንቁ ምደባ አለው።',
  assignmentCreated: 'ንብረቱ በተሳካ ሁኔታ ተመድቧል።',
  assignmentCreateFailed: 'ንብረት ማመድብ አልተቻለም።',
  returnAsset: 'ንብረቱን መልስ',
  confirmReturn: 'መልሷን አረጋግጥ',
  returnConfirmation: 'ይህን ንብረት እንደተመለሰ ማረጋገጥ ትፈልጋለህ?',
  assetReturned: 'ንብረቱ በተሳካ ሁኔታ ተመልሷል።',
  returnFailed: 'ንብረቱን መመለስ አልተቻለም።',
  noAssignments: 'ምንም ምደባዎች አልተገኙም',
  noAssignmentsDescription: 'በአሁኑ ጊዜ ለአሁኑ ማጣሪያ የሚዛመድ ምደባ የለም።',
  noMatchingAssignments: 'የሚዛመዱ ምደባዎች የሉም',
  noMatchingDescription: 'ፍለጋዎትን ወይም ማጣሪያዎችን ይቀይሩ።',
  retry: 'እንደገና ሞክር',
  loadError: 'ምደባዎችን መጫን አልተቻለም',
  loadErrorDescription: 'የምደባ መረጃን ከሰርቨር ማግኘት አልተቻለም።',
  showing: 'እየታየ',
  of: 'ከ',
  previous: 'ቀዳሚ',
  next: 'ቀጣይ',
  viewAsset: 'ንብረት እይ',
  viewDetails: 'ዝርዝሮችን እይ',
  viewHistory: 'ታሪክ እይ',
  assignmentHistory: 'የምደባ ታሪክ',
  noHistory: 'ምንም የምደባ ታሪክ አልተገኘም።',
  moreActions: 'ተጨማሪ እርምጃዎች',
  dateRange: 'የቀን ክልል',
  assignmentLast30: 'በ30 ቀናት ውስጥ የተመደበ',
  expectedNext30: 'በቀጣይ 30 ቀናት ውስጥ የሚመለስ',
};

export default AdminAssignment;
