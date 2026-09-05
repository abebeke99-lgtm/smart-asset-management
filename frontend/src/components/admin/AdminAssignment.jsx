import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../contexts/UiContext';
import { toast } from 'react-toastify';
import { apiClient as axios } from '../../utils/api';

/*
 * ADMIN — ASSET ASSIGNMENT MANAGEMENT
 *
 * Backend endpoints used:
 *
 * GET    /api/assignments
 * POST   /api/assignments
 * POST   /api/assignments/:id/return
 * DELETE /api/assignments/:id
 *
 * GET    /api/assets
 * GET    /api/users
 * GET    /api/departments
 */

const AdminAssignment = () => {
  const { language, theme } = useLanguage();

  const isDark = theme === 'dark';

  const t = language === 'en'
    ? englishTranslations
    : amharicTranslations;

  /* =========================================================
     STATE
  ========================================================= */

  const [assignments, setAssignments] = useState([]);
  const [assets, setAssets] = useState([]);
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [returningId, setReturningId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const [loadError, setLoadError] = useState(false);

  const [showForm, setShowForm] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterDepartment, setFilterDepartment] = useState('all');

  const [currentPage, setCurrentPage] = useState(1);

  const itemsPerPage = 10;

  const [formData, setFormData] = useState({
    assetId: '',
    assignedTo: '',
    department: '',
    location: '',
    assignmentDate: new Date().toISOString().split('T')[0],
    expectedReturnDate: '',
    notes: ''
  });

  /* =========================================================
     THEME
  ========================================================= */

  const styles = {
    page: {
      minHeight: '100vh',
      padding: '24px',
      background: isDark ? '#0f172a' : '#f5f8fc',
      color: isDark ? '#e2e8f0' : '#1a365d'
    },

    container: {
      maxWidth: '1500px',
      margin: '0 auto'
    },

    card: {
      background: isDark ? '#1e293b' : '#ffffff',
      border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
      borderRadius: '14px',
      boxShadow: isDark
        ? '0 8px 25px rgba(0,0,0,.25)'
        : '0 5px 18px rgba(15,23,42,.06)'
    },

    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: '16px',
      flexWrap: 'wrap',
      padding: '22px',
      marginBottom: '18px'
    },

    title: {
      margin: 0,
      fontSize: '1.7rem',
      fontWeight: 800,
      color: isDark ? '#dbeafe' : '#17365d'
    },

    subtitle: {
      margin: '6px 0 0',
      color: isDark ? '#94a3b8' : '#64748b',
      fontSize: '.9rem'
    },

    primaryButton: {
      padding: '11px 18px',
      border: 'none',
      borderRadius: '8px',
      background: 'linear-gradient(135deg,#2563eb,#3b82f6)',
      color: '#fff',
      fontWeight: 700,
      cursor: 'pointer'
    },

    successButton: {
      padding: '10px 16px',
      border: 'none',
      borderRadius: '8px',
      background: '#16a34a',
      color: '#fff',
      fontWeight: 700,
      cursor: 'pointer'
    },

    dangerButton: {
      padding: '8px 12px',
      border: 'none',
      borderRadius: '7px',
      background: '#dc2626',
      color: '#fff',
      fontWeight: 600,
      cursor: 'pointer'
    },

    secondaryButton: {
      padding: '10px 16px',
      border: `1px solid ${isDark ? '#475569' : '#cbd5e1'}`,
      borderRadius: '8px',
      background: isDark ? '#334155' : '#f8fafc',
      color: isDark ? '#e2e8f0' : '#334155',
      fontWeight: 600,
      cursor: 'pointer'
    },

    summaryGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))',
      gap: '12px',
      marginBottom: '18px'
    },

    summaryCard: (color, active) => ({
      padding: '17px',
      borderRadius: '11px',
      background: isDark ? '#1e293b' : '#fff',
      border: `1px solid ${active ? color : isDark ? '#334155' : '#e2e8f0'}`,
      borderLeft: `4px solid ${color}`,
      cursor: 'pointer',
      textAlign: 'left',
      boxShadow: active
        ? `0 0 0 2px ${color}25`
        : '0 2px 8px rgba(0,0,0,.04)'
    }),

    summaryValue: {
      fontSize: '1.6rem',
      fontWeight: 800,
      color: isDark ? '#f1f5f9' : '#1e3a5f'
    },

    summaryLabel: {
      marginTop: '3px',
      color: isDark ? '#94a3b8' : '#64748b',
      fontSize: '.78rem',
      fontWeight: 600
    },

    controls: {
      display: 'flex',
      gap: '10px',
      flexWrap: 'wrap',
      padding: '16px',
      marginBottom: '18px',
      background: isDark ? '#172033' : '#f8fafc',
      border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
      borderRadius: '10px'
    },

    input: {
      flex: 1,
      minWidth: '220px',
      padding: '10px 13px',
      borderRadius: '8px',
      border: `1px solid ${isDark ? '#475569' : '#cbd5e1'}`,
      background: isDark ? '#0f172a' : '#fff',
      color: isDark ? '#f8fafc' : '#1e293b',
      outline: 'none'
    },

    select: {
      minWidth: '160px',
      padding: '10px 13px',
      borderRadius: '8px',
      border: `1px solid ${isDark ? '#475569' : '#cbd5e1'}`,
      background: isDark ? '#0f172a' : '#fff',
      color: isDark ? '#f8fafc' : '#1e293b',
      cursor: 'pointer'
    },

    form: {
      padding: '20px',
      marginBottom: '18px',
      borderRadius: '11px',
      background: isDark ? '#111827' : '#f8fafc',
      border: `1px solid ${isDark ? '#334155' : '#dbe4ef'}`
    },

    formGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))',
      gap: '15px'
    },

    formGroup: {
      display: 'flex',
      flexDirection: 'column',
      gap: '6px'
    },

    label: {
      fontSize: '.82rem',
      fontWeight: 700,
      color: isDark ? '#cbd5e1' : '#334155'
    },

    formInput: {
      width: '100%',
      boxSizing: 'border-box',
      padding: '10px 12px',
      borderRadius: '8px',
      border: `1px solid ${isDark ? '#475569' : '#cbd5e1'}`,
      background: isDark ? '#0f172a' : '#fff',
      color: isDark ? '#f8fafc' : '#1e293b'
    },

    textarea: {
      width: '100%',
      boxSizing: 'border-box',
      padding: '10px 12px',
      borderRadius: '8px',
      border: `1px solid ${isDark ? '#475569' : '#cbd5e1'}`,
      background: isDark ? '#0f172a' : '#fff',
      color: isDark ? '#f8fafc' : '#1e293b',
      resize: 'vertical'
    },

    tableWrapper: {
      overflowX: 'auto'
    },

    table: {
      width: '100%',
      minWidth: '1050px',
      borderCollapse: 'collapse'
    },

    th: {
      padding: '13px 12px',
      textAlign: 'left',
      whiteSpace: 'nowrap',
      background: isDark ? '#111827' : '#f8fafc',
      color: isDark ? '#cbd5e1' : '#334155',
      borderBottom: `2px solid ${isDark ? '#334155' : '#e2e8f0'}`,
      fontSize: '.8rem',
      fontWeight: 800
    },

    td: {
      padding: '13px 12px',
      color: isDark ? '#dbeafe' : '#334155',
      borderBottom: `1px solid ${isDark ? '#334155' : '#edf2f7'}`,
      fontSize: '.86rem',
      verticalAlign: 'middle'
    },

    badge: (type) => {
      const colors = {
        Active: ['#dcfce7', '#166534'],
        'Due Soon': ['#fef3c7', '#92400e'],
        Overdue: ['#fee2e2', '#991b1b'],
        Returned: ['#e2e8f0', '#475569']
      };

      const [background, color] =
        colors[type] || ['#e2e8f0', '#475569'];

      return {
        display: 'inline-block',
        padding: '5px 10px',
        borderRadius: '999px',
        background,
        color,
        fontSize: '.72rem',
        fontWeight: 800
      };
    },

    actionButton: (background) => ({
      padding: '7px 9px',
      border: 'none',
      borderRadius: '6px',
      background,
      color: '#fff',
      cursor: 'pointer',
      marginRight: '4px'
    }),

    empty: {
      padding: '55px 20px',
      textAlign: 'center',
      color: isDark ? '#94a3b8' : '#64748b'
    },

    pagination: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: '10px',
      flexWrap: 'wrap',
      padding: '18px'
    },

    pageButton: (active, disabled) => ({
      padding: '7px 11px',
      borderRadius: '6px',
      border: `1px solid ${isDark ? '#475569' : '#cbd5e1'}`,
      background: active
        ? '#2563eb'
        : isDark
          ? '#1e293b'
          : '#fff',
      color: active
        ? '#fff'
        : disabled
          ? '#94a3b8'
          : isDark
            ? '#e2e8f0'
            : '#334155',
      cursor: disabled ? 'not-allowed' : 'pointer'
    }),

    error: {
      padding: '40px',
      textAlign: 'center',
      color: isDark ? '#fecaca' : '#991b1b'
    }
  };

  /* =========================================================
     HELPERS
  ========================================================= */

  const extractArray = (response, keys = []) => {
    const data = response?.data;

    if (Array.isArray(data)) {
      return data;
    }

    for (const key of keys) {
      if (Array.isArray(data?.[key])) {
        return data[key];
      }
    }

    if (Array.isArray(data?.data)) {
      return data.data;
    }

    return [];
  };

  const getToday = () => {
    return new Date().toISOString().split('T')[0];
  };

  const resetForm = () => {
    setFormData({
      assetId: '',
      assignedTo: '',
      department: '',
      location: '',
      assignmentDate: getToday(),
      expectedReturnDate: '',
      notes: ''
    });
  };

  const getAssignmentExpectedReturn = (assignment) => {
    /*
     * Primary backend field.
     */
    if (assignment?.expected_return_date) {
      return assignment.expected_return_date;
    }

    if (assignment?.expectedReturnDate) {
      return assignment.expectedReturnDate;
    }

    /*
     * Backward compatibility for old records
     * where expectedReturnDate was stored in notes.
     */
    try {
      const parsed =
        typeof assignment?.notes === 'string'
          ? JSON.parse(assignment.notes)
          : assignment?.notes;

      if (parsed?.expectedReturnDate) {
        return parsed.expectedReturnDate;
      }
    } catch (error) {
      // Notes may simply be normal text.
    }

    return '';
  };

  const getAssignmentStatus = (assignment) => {
    const rawStatus = String(
      assignment?.status || ''
    ).trim().toLowerCase();

    if (
      assignment?.returned_at ||
      assignment?.actual_return_date ||
      rawStatus === 'returned'
    ) {
      return 'Returned';
    }

    const expected = getAssignmentExpectedReturn(assignment);

    if (!expected) {
      return 'Active';
    }

    const expectedDate = new Date(expected);
    const now = new Date();

    if (Number.isNaN(expectedDate.getTime())) {
      return 'Active';
    }

    expectedDate.setHours(23, 59, 59, 999);

    const difference =
      (expectedDate.getTime() - now.getTime()) /
      (1000 * 60 * 60 * 24);

    if (difference < 0) {
      return 'Overdue';
    }

    if (difference <= 7) {
      return 'Due Soon';
    }

    return 'Active';
  };

  const isActiveAssignment = (assignment) => {
    return getAssignmentStatus(assignment) !== 'Returned';
  };

  const getAssetStatus = (asset) => {
    return String(
      asset?.status || ''
    ).trim().toLowerCase().replace(/[_ ]/g, '-');
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';

    const parsed = new Date(date);

    if (Number.isNaN(parsed.getTime())) {
      return 'N/A';
    }

    return parsed.toLocaleDateString();
  };

  const getUserName = (user) => {
    return (
      user?.full_name ||
      user?.fullName ||
      user?.name ||
      user?.username ||
      `User #${user?.id || ''}`
    );
  };

  const getDepartmentName = (department) => {
    return (
      department?.name ||
      department?.department_name ||
      department?.title ||
      ''
    );
  };

  const getAssetName = (asset) => {
    return (
      asset?.name ||
      asset?.asset_name ||
      asset?.asset_tag ||
      `Asset #${asset?.id || ''}`
    );
  };

  const getAssetTag = (asset) => {
    return (
      asset?.asset_tag ||
      asset?.assetCode ||
      asset?.asset_code ||
      asset?.id ||
      ''
    );
  };

  /* =========================================================
     API — FETCH ASSIGNMENTS
  ========================================================= */

  const fetchAssignments = useCallback(async () => {
    try {
      const response = await axios.get('/api/assignments');

      const rows = extractArray(response, [
        'assignments',
        'data'
      ]);

      setAssignments(rows);
      setLoadError(false);

      return rows;
    } catch (error) {
      console.error(
        'Failed to load assignments:',
        error
      );

      setAssignments([]);
      setLoadError(true);

      throw error;
    }
  }, []);

  /* =========================================================
     API — FETCH ASSETS
  ========================================================= */

  const fetchAssets = useCallback(async () => {
    try {
      const response = await axios.get('/api/assets');

      const rows = extractArray(response, [
        'assets',
        'data'
      ]);

      setAssets(rows);

      return rows;
    } catch (error) {
      console.error(
        'Failed to load assets:',
        error
      );

      setAssets([]);

      return [];
    }
  }, []);

  /* =========================================================
     API — FETCH USERS
  ========================================================= */

  const fetchUsers = useCallback(async () => {
    try {
      const response = await axios.get('/api/users');

      const rows = extractArray(response, [
        'users',
        'data'
      ]);

      setUsers(rows);

      return rows;
    } catch (error) {
      console.error(
        'Failed to load users:',
        error
      );

      setUsers([]);

      return [];
    }
  }, []);

  /* =========================================================
     API — FETCH DEPARTMENTS
  ========================================================= */

  const fetchDepartments = useCallback(async () => {
    try {
      const response = await axios.get('/api/departments');

      const rows = extractArray(response, [
        'departments',
        'data'
      ]);

      setDepartments(rows);

      return rows;
    } catch (error) {
      console.error(
        'Failed to load departments:',
        error
      );

      setDepartments([]);

      return [];
    }
  }, []);

  /* =========================================================
     INITIAL LOAD
  ========================================================= */

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);

      try {
        await Promise.all([
          fetchAssignments(),
          fetchAssets(),
          fetchUsers(),
          fetchDepartments()
        ]);
      } catch (error) {
        if (mounted) {
          setLoadError(true);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, [
    fetchAssignments,
    fetchAssets,
    fetchUsers,
    fetchDepartments
  ]);

  /* =========================================================
     FORM
  ========================================================= */

  const handleInputChange = (event) => {
    const {
      name,
      value
    } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value
    }));
  };

  const openNewAssignment = () => {
    resetForm();
    setShowForm(true);
  };

  const closeForm = () => {
    if (saving) return;

    resetForm();
    setShowForm(false);
  };

  /* =========================================================
     CREATE ASSIGNMENT
  ========================================================= */

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (saving) return;

    if (!formData.assetId) {
      toast.error(t.selectAsset);
      return;
    }

    if (!formData.assignedTo) {
      toast.error(t.selectUser);
      return;
    }

    if (!formData.assignmentDate) {
      toast.error(t.assignmentDateRequired);
      return;
    }

    const assignmentDate =
      new Date(formData.assignmentDate);

    const expectedReturnDate =
      formData.expectedReturnDate
        ? new Date(formData.expectedReturnDate)
        : null;

    if (Number.isNaN(assignmentDate.getTime())) {
      toast.error(t.invalidDate);
      return;
    }

    if (
      expectedReturnDate &&
      Number.isNaN(expectedReturnDate.getTime())
    ) {
      toast.error(t.invalidDate);
      return;
    }

    if (
      expectedReturnDate &&
      expectedReturnDate < assignmentDate
    ) {
      toast.error(t.returnDateError);
      return;
    }

    const selectedAsset = assets.find(
      (asset) =>
        String(asset.id) ===
        String(formData.assetId)
    );

    if (!selectedAsset) {
      toast.error(t.assetNotFound);
      return;
    }

    const selectedAssetStatus =
      getAssetStatus(selectedAsset);

    /*
     * Asset must be available.
     */
    if (
      selectedAssetStatus &&
      selectedAssetStatus !== 'available'
    ) {
      toast.error(t.assetUnavailable);
      return;
    }

    /*
     * Prevent duplicate active assignment.
     */
    const alreadyAssigned =
      assignments.some(
        (assignment) =>
          String(assignment.asset_id) ===
            String(formData.assetId) &&
          isActiveAssignment(assignment)
      );

    if (alreadyAssigned) {
      toast.error(t.assetAlreadyAssigned);
      return;
    }

    setSaving(true);

    try {
      /*
       * IMPORTANT:
       * Send backend field names directly.
       *
       * expected_return_date is sent as a real
       * backend field, not hidden inside notes.
       */
      const payload = {
        asset_id: formData.assetId,
        assigned_to: formData.assignedTo,
        department_id:
          formData.department || null,
        location:
          formData.location.trim() || null,
        assigned_date:
          formData.assignmentDate,
        expected_return_date:
          formData.expectedReturnDate || null,
        notes:
          formData.notes.trim() || null
      };

      const response =
        await axios.post(
          '/api/assignments',
          payload
        );

      const createdAssignment =
        response?.data?.assignment ||
        response?.data?.data ||
        response?.data;

      toast.success(
        createdAssignment?.asset_name
          ? `${t.assignmentCreated} ${createdAssignment.asset_name}`
          : t.assignmentCreated
      );

      resetForm();
      setShowForm(false);
      setCurrentPage(1);

      /*
       * Refresh both assignments and assets because
       * backend assignment normally changes asset status.
       */
      await Promise.all([
        fetchAssignments(),
        fetchAssets()
      ]);
    } catch (error) {
      console.error(
        'Failed to create assignment:',
        error
      );

      toast.error(
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        t.assignmentCreateFailed
      );
    } finally {
      setSaving(false);
    }
  };

  /* =========================================================
     RETURN ASSET
  ========================================================= */

  const handleReturnAsset = async (assignment) => {
    if (!assignment?.id) return;

    const confirmed = window.confirm(
      t.confirmReturn
    );

    if (!confirmed) return;

    setReturningId(assignment.id);

    try {
      await axios.post(
        `/api/assignments/${assignment.id}/return`,
        {}
      );

      toast.success(t.assetReturned);

      await Promise.all([
        fetchAssignments(),
        fetchAssets()
      ]);
    } catch (error) {
      console.error(
        'Failed to return asset:',
        error
      );

      toast.error(
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        t.returnFailed
      );
    } finally {
      setReturningId(null);
    }
  };

  /* =========================================================
     DELETE ASSIGNMENT
  ========================================================= */

  const handleDelete = async (assignment) => {
    if (!assignment?.id) return;

    const confirmed = window.confirm(
      t.confirmDelete
    );

    if (!confirmed) return;

    setDeletingId(assignment.id);

    try {
      await axios.delete(
        `/api/assignments/${assignment.id}`
      );

      toast.success(t.assignmentDeleted);

      await Promise.all([
        fetchAssignments(),
        fetchAssets()
      ]);
    } catch (error) {
      console.error(
        'Failed to delete assignment:',
        error
      );

      toast.error(
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        t.deleteFailed
      );
    } finally {
      setDeletingId(null);
    }
  };

  /* =========================================================
     DERIVED DATA
  ========================================================= */

  const activeAssignments = useMemo(
    () =>
      assignments.filter(
        (assignment) =>
          getAssignmentStatus(assignment) !==
          'Returned'
      ),
    [assignments]
  );

  const returnedAssignments = useMemo(
    () =>
      assignments.filter(
        (assignment) =>
          getAssignmentStatus(assignment) ===
          'Returned'
      ),
    [assignments]
  );

  const dueSoonAssignments = useMemo(
    () =>
      assignments.filter(
        (assignment) =>
          getAssignmentStatus(assignment) ===
          'Due Soon'
      ),
    [assignments]
  );

  const overdueAssignments = useMemo(
    () =>
      assignments.filter(
        (assignment) =>
          getAssignmentStatus(assignment) ===
          'Overdue'
      ),
    [assignments]
  );

  /*
   * Only available assets that are not currently assigned
   * should appear in the New Assignment form.
   */
  const availableAssets = useMemo(
    () =>
      assets.filter((asset) => {
        const status =
          getAssetStatus(asset);

        const active =
          assignments.some(
            (assignment) =>
              String(assignment.asset_id) ===
                String(asset.id) &&
              isActiveAssignment(assignment)
          );

        return (
          (!status || status === 'available') &&
          !active
        );
      }),
    [assets, assignments]
  );

  /* =========================================================
     SEARCH + FILTER
  ========================================================= */

  const filteredAssignments = useMemo(() => {
    const query =
      searchQuery.trim().toLowerCase();

    return assignments.filter(
      (assignment) => {
        const searchableValues = [
          assignment.asset_name,
          assignment.asset_tag,
          assignment.asset_code,
          assignment.assigned_to_name,
          assignment.user_name,
          assignment.department,
          assignment.department_name,
          assignment.location,
          assignment.notes
        ];

        const matchesSearch =
          !query ||
          searchableValues.some(
            (value) =>
              String(value || '')
                .toLowerCase()
                .includes(query)
          );

        const status =
          getAssignmentStatus(assignment);

        const matchesStatus =
          filterStatus === 'all' ||
          status === filterStatus;

        const departmentValue =
          String(
            assignment.department_id ||
            assignment.department ||
            assignment.department_name ||
            ''
          ).toLowerCase();

        const selectedDepartment =
          String(
            filterDepartment
          ).toLowerCase();

        const matchesDepartment =
          filterDepartment === 'all' ||
          departmentValue ===
            selectedDepartment;

        return (
          matchesSearch &&
          matchesStatus &&
          matchesDepartment
        );
      }
    );
  }, [
    assignments,
    searchQuery,
    filterStatus,
    filterDepartment
  ]);

  /* =========================================================
     PAGINATION
  ========================================================= */

  const totalPages = Math.max(
    1,
    Math.ceil(
      filteredAssignments.length /
        itemsPerPage
    )
  );

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedAssignments =
    filteredAssignments.slice(
      (currentPage - 1) *
        itemsPerPage,
      currentPage *
        itemsPerPage
    );

  const startItem =
    filteredAssignments.length === 0
      ? 0
      : (currentPage - 1) *
          itemsPerPage +
        1;

  const endItem = Math.min(
    currentPage * itemsPerPage,
    filteredAssignments.length
  );

  const clearFilters = () => {
    setSearchQuery('');
    setFilterStatus('all');
    setFilterDepartment('all');
    setCurrentPage(1);
  };

  /* =========================================================
     LOADING / ERROR
  ========================================================= */

  if (loading) {
    return (
      <div style={styles.page}>
        <div
          style={{
            ...styles.card,
            ...styles.empty
          }}
        >
          <div style={{ fontSize: '2rem' }}>
            ⏳
          </div>

          <h2>{t.loading}</h2>

          <p>{t.loadingAssignments}</p>
        </div>
      </div>
    );
  }

  if (loadError && assignments.length === 0) {
    return (
      <div style={styles.page}>
        <div
          style={{
            ...styles.card,
            ...styles.error
          }}
        >
          <div style={{ fontSize: '3rem' }}>
            ⚠️
          </div>

          <h2>{t.loadError}</h2>

          <p>{t.loadErrorDescription}</p>

          <button
            type="button"
            style={styles.primaryButton}
            onClick={async () => {
              setLoading(true);
              setLoadError(false);

              try {
                await Promise.all([
                  fetchAssignments(),
                  fetchAssets(),
                  fetchUsers(),
                  fetchDepartments()
                ]);
              } catch (error) {
                setLoadError(true);
              } finally {
                setLoading(false);
              }
            }}
          >
            🔄 {t.retry}
          </button>
        </div>
      </div>
    );
  }

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div style={styles.page}>
      <div style={styles.container}>

        {/* =====================================================
            HEADER
        ===================================================== */}

        <div
          style={{
            ...styles.card,
            ...styles.header
          }}
        >
          <div>
            <h1 style={styles.title}>
              📋 {t.title}
            </h1>

            <p style={styles.subtitle}>
              {t.subtitle}
            </p>
          </div>

          <button
            type="button"
            style={styles.primaryButton}
            onClick={
              showForm
                ? closeForm
                : openNewAssignment
            }
          >
            {showForm
              ? `✕ ${t.close}`
              : `➕ ${t.newAssignment}`}
          </button>
        </div>

        {/* =====================================================
            SUMMARY
        ===================================================== */}

        <div style={styles.summaryGrid}>

          <button
            type="button"
            style={styles.summaryCard(
              '#2563eb',
              filterStatus === 'all'
            )}
            onClick={() => {
              setFilterStatus('all');
              setCurrentPage(1);
            }}
          >
            <div style={styles.summaryValue}>
              {assignments.length}
            </div>

            <div style={styles.summaryLabel}>
              📋 {t.totalAssignments}
            </div>
          </button>

          <button
            type="button"
            style={styles.summaryCard(
              '#16a34a',
              filterStatus === 'Active'
            )}
            onClick={() => {
              setFilterStatus('Active');
              setCurrentPage(1);
            }}
          >
            <div style={styles.summaryValue}>
              {activeAssignments.length}
            </div>

            <div style={styles.summaryLabel}>
              🟢 {t.active}
            </div>
          </button>

          <button
            type="button"
            style={styles.summaryCard(
              '#f59e0b',
              filterStatus === 'Due Soon'
            )}
            onClick={() => {
              setFilterStatus('Due Soon');
              setCurrentPage(1);
            }}
          >
            <div style={styles.summaryValue}>
              {dueSoonAssignments.length}
            </div>

            <div style={styles.summaryLabel}>
              🟡 {t.dueSoon}
            </div>
          </button>

          <button
            type="button"
            style={styles.summaryCard(
              '#dc2626',
              filterStatus === 'Overdue'
            )}
            onClick={() => {
              setFilterStatus('Overdue');
              setCurrentPage(1);
            }}
          >
            <div style={styles.summaryValue}>
              {overdueAssignments.length}
            </div>

            <div style={styles.summaryLabel}>
              🔴 {t.overdue}
            </div>
          </button>

          <button
            type="button"
            style={styles.summaryCard(
              '#64748b',
              filterStatus === 'Returned'
            )}
            onClick={() => {
              setFilterStatus('Returned');
              setCurrentPage(1);
            }}
          >
            <div style={styles.summaryValue}>
              {returnedAssignments.length}
            </div>

            <div style={styles.summaryLabel}>
              ↩️ {t.returned}
            </div>
          </button>

        </div>

        {/* =====================================================
            NEW ASSIGNMENT FORM
        ===================================================== */}

        {showForm && (
          <form
            onSubmit={handleSubmit}
            style={{
              ...styles.card,
              ...styles.form
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '18px',
                gap: '10px',
                flexWrap: 'wrap'
              }}
            >
              <div>
                <h2
                  style={{
                    margin: 0,
                    color: styles.title.color,
                    fontSize: '1.2rem'
                  }}
                >
                  ➕ {t.newAssignment}
                </h2>

                <p
                  style={{
                    margin: '5px 0 0',
                    color: isDark
                      ? '#94a3b8'
                      : '#64748b',
                    fontSize: '.8rem'
                  }}
                >
                  {t.assignmentDescription}
                </p>
              </div>
            </div>

            <div style={styles.formGrid}>

              {/* ASSET */}

              <div style={styles.formGroup}>
                <label style={styles.label}>
                  {t.asset} *
                </label>

                <select
                  name="assetId"
                  value={formData.assetId}
                  onChange={handleInputChange}
                  required
                  style={styles.formInput}
                >
                  <option value="">
                    {t.selectAsset}
                  </option>

                  {availableAssets.map(
                    (asset) => (
                      <option
                        key={asset.id}
                        value={asset.id}
                      >
                        {getAssetTag(asset)}
                        {' — '}
                        {getAssetName(asset)}
                        {asset.location
                          ? ` — ${asset.location}`
                          : ''}
                      </option>
                    )
                  )}
                </select>

                {availableAssets.length === 0 && (
                  <small
                    style={{
                      color: '#dc2626'
                    }}
                  >
                    {t.noAvailableAssets}
                  </small>
                )}
              </div>

              {/* USER */}

              <div style={styles.formGroup}>
                <label style={styles.label}>
                  {t.assignedTo} *
                </label>

                <select
                  name="assignedTo"
                  value={formData.assignedTo}
                  onChange={handleInputChange}
                  required
                  style={styles.formInput}
                >
                  <option value="">
                    {t.selectUser}
                  </option>

                  {users.map((user) => (
                    <option
                      key={user.id}
                      value={user.id}
                    >
                      {getUserName(user)}
                      {user.role
                        ? ` — ${user.role}`
                        : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* DEPARTMENT */}

              <div style={styles.formGroup}>
                <label style={styles.label}>
                  {t.department}
                </label>

                <select
                  name="department"
                  value={formData.department}
                  onChange={handleInputChange}
                  style={styles.formInput}
                >
                  <option value="">
                    {t.selectDepartment}
                  </option>

                  {departments.map(
                    (department) => (
                      <option
                        key={department.id}
                        value={department.id}
                      >
                        {getDepartmentName(
                          department
                        )}
                      </option>
                    )
                  )}
                </select>
              </div>

              {/* LOCATION */}

              <div style={styles.formGroup}>
                <label style={styles.label}>
                  {t.location}
                </label>

                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                  placeholder={t.enterLocation}
                  style={styles.formInput}
                />
              </div>

              {/* ASSIGNMENT DATE */}

              <div style={styles.formGroup}>
                <label style={styles.label}>
                  {t.assignmentDate} *
                </label>

                <input
                  type="date"
                  name="assignmentDate"
                  value={formData.assignmentDate}
                  onChange={handleInputChange}
                  required
                  style={styles.formInput}
                />
              </div>

              {/* EXPECTED RETURN */}

              <div style={styles.formGroup}>
                <label style={styles.label}>
                  {t.expectedReturn}
                </label>

                <input
                  type="date"
                  name="expectedReturnDate"
                  value={
                    formData.expectedReturnDate
                  }
                  onChange={handleInputChange}
                  min={formData.assignmentDate}
                  style={styles.formInput}
                />
              </div>

            </div>

            {/* NOTES */}

            <div
              style={{
                ...styles.formGroup,
                marginTop: '15px'
              }}
            >
              <label style={styles.label}>
                {t.notes}
              </label>

              <textarea
                name="notes"
                rows="4"
                value={formData.notes}
                onChange={handleInputChange}
                placeholder={t.enterNotes}
                style={styles.textarea}
              />
            </div>

            {/* FORM BUTTONS */}

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
                marginTop: '18px',
                flexWrap: 'wrap'
              }}
            >
              <button
                type="button"
                style={styles.secondaryButton}
                onClick={closeForm}
                disabled={saving}
              >
                {t.cancel}
              </button>

              <button
                type="submit"
                style={{
                  ...styles.successButton,
                  opacity: saving ? .7 : 1,
                  cursor: saving
                    ? 'not-allowed'
                    : 'pointer'
                }}
                disabled={
                  saving ||
                  availableAssets.length === 0
                }
              >
                {saving
                  ? `⏳ ${t.saving}`
                  : `✔️ ${t.createAssignment}`}
              </button>
            </div>
          </form>
        )}

        {/* =====================================================
            SEARCH + FILTER
        ===================================================== */}

        <div
          style={{
            ...styles.card,
            ...styles.controls
          }}
        >
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(
                event.target.value
              );
              setCurrentPage(1);
            }}
            placeholder={t.searchPlaceholder}
            style={styles.input}
          />

          <select
            value={filterStatus}
            onChange={(event) => {
              setFilterStatus(
                event.target.value
              );
              setCurrentPage(1);
            }}
            style={styles.select}
          >
            <option value="all">
              {t.allStatus}
            </option>

            <option value="Active">
              {t.active}
            </option>

            <option value="Due Soon">
              {t.dueSoon}
            </option>

            <option value="Overdue">
              {t.overdue}
            </option>

            <option value="Returned">
              {t.returned}
            </option>
          </select>

          <select
            value={filterDepartment}
            onChange={(event) => {
              setFilterDepartment(
                event.target.value
              );
              setCurrentPage(1);
            }}
            style={styles.select}
          >
            <option value="all">
              {t.allDepartments}
            </option>

            {departments.map(
              (department) => (
                <option
                  key={department.id}
                  value={
                    department.id
                  }
                >
                  {getDepartmentName(
                    department
                  )}
                </option>
              )
            )}
          </select>

          <button
            type="button"
            style={styles.secondaryButton}
            onClick={clearFilters}
          >
            🔄 {t.clearFilters}
          </button>

          <button
            type="button"
            style={styles.secondaryButton}
            onClick={async () => {
              try {
                await Promise.all([
                  fetchAssignments(),
                  fetchAssets()
                ]);

                toast.success(
                  t.refreshed
                );
              } catch (error) {
                toast.error(
                  t.refreshFailed
                );
              }
            }}
          >
            🔄 {t.refresh}
          </button>
        </div>

        {/* =====================================================
            TABLE
        ===================================================== */}

        <div style={styles.card}>

          {paginatedAssignments.length === 0 ? (
            <div style={styles.empty}>

              <div
                style={{
                  fontSize: '3rem',
                  marginBottom: '10px'
                }}
              >
                📭
              </div>

              <h2
                style={{
                  color: isDark
                    ? '#cbd5e1'
                    : '#334155'
                }}
              >
                {t.noAssignments}
              </h2>

              <p>
                {searchQuery ||
                filterStatus !== 'all' ||
                filterDepartment !== 'all'
                  ? t.noMatchingAssignments
                  : t.noAssignmentsDescription}
              </p>

              {!searchQuery &&
                filterStatus === 'all' &&
                filterDepartment === 'all' && (
                  <button
                    type="button"
                    style={styles.primaryButton}
                    onClick={
                      openNewAssignment
                    }
                  >
                    ➕ {t.newAssignment}
                  </button>
                )}
            </div>
          ) : (
            <>
              <div style={styles.tableWrapper}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>
                        {t.asset}
                      </th>

                      <th style={styles.th}>
                        {t.assignedTo}
                      </th>

                      <th style={styles.th}>
                        {t.department}
                      </th>

                      <th style={styles.th}>
                        {t.location}
                      </th>

                      <th style={styles.th}>
                        {t.assignmentDate}
                      </th>

                      <th style={styles.th}>
                        {t.expectedReturn}
                      </th>

                      <th style={styles.th}>
                        {t.actualReturn}
                      </th>

                      <th style={styles.th}>
                        {t.condition}
                      </th>

                      <th style={styles.th}>
                        {t.status}
                      </th>

                      <th
                        style={{
                          ...styles.th,
                          textAlign: 'center'
                        }}
                      >
                        {t.actions}
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {paginatedAssignments.map(
                      (assignment) => {
                        const status =
                          getAssignmentStatus(
                            assignment
                          );

                        const expectedReturn =
                          getAssignmentExpectedReturn(
                            assignment
                          );

                        return (
                          <tr
                            key={
                              assignment.id
                            }
                          >
                            {/* ASSET */}

                            <td
                              style={
                                styles.td
                              }
                            >
                              <div
                                style={{
                                  fontWeight: 700
                                }}
                              >
                                {assignment.asset_tag ||
                                  assignment.asset_code ||
                                  assignment.asset_name ||
                                  'N/A'}
                              </div>

                              {assignment.asset_name && (
                                <div
                                  style={{
                                    marginTop:
                                      '3px',
                                    color:
                                      isDark
                                        ? '#94a3b8'
                                        : '#64748b',
                                    fontSize:
                                      '.74rem'
                                  }}
                                >
                                  {
                                    assignment.asset_name
                                  }
                                </div>
                              )}
                            </td>

                            {/* ASSIGNED TO */}

                            <td
                              style={
                                styles.td
                              }
                            >
                              {assignment.assigned_to_name ||
                                assignment.user_name ||
                                'N/A'}
                            </td>

                            {/* DEPARTMENT */}

                            <td
                              style={
                                styles.td
                              }
                            >
                              {assignment.department_name ||
                                assignment.department ||
                                'N/A'}
                            </td>

                            {/* LOCATION */}

                            <td
                              style={
                                styles.td
                              }
                            >
                              {assignment.location ||
                                'N/A'}
                            </td>

                            {/* ASSIGNMENT DATE */}

                            <td
                              style={
                                styles.td
                              }
                            >
                              {formatDate(
                                assignment.assigned_date ||
                                  assignment.assignment_date
                              )}
                            </td>

                            {/* EXPECTED RETURN */}

                            <td
                              style={
                                styles.td
                              }
                            >
                              {formatDate(
                                expectedReturn
                              )}
                            </td>

                            {/* ACTUAL RETURN */}

                            <td
                              style={
                                styles.td
                              }
                            >
                              {formatDate(
                                assignment.returned_at ||
                                  assignment.actual_return_date
                              )}
                            </td>

                            {/* CONDITION */}

                            <td
                              style={
                                styles.td
                              }
                            >
                              {assignment.condition ||
                                assignment.return_condition ||
                                'N/A'}
                            </td>

                            {/* STATUS */}

                            <td
                              style={
                                styles.td
                              }
                            >
                              <span
                                style={styles.badge(
                                  status
                                )}
                              >
                                {status ===
                                'Active'
                                  ? `🟢 ${t.active}`
                                  : status ===
                                      'Due Soon'
                                    ? `🟡 ${t.dueSoon}`
                                    : status ===
                                        'Overdue'
                                      ? `🔴 ${t.overdue}`
                                      : `↩️ ${t.returned}`}
                              </span>
                            </td>

                            {/* ACTIONS */}

                            <td
                              style={{
                                ...styles.td,
                                textAlign:
                                  'center',
                                whiteSpace:
                                  'nowrap'
                              }}
                            >
                              {assignment.asset_id && (
                                <Link
                                  to={`/assets/${assignment.asset_id}`}
                                >
                                  <button
                                    type="button"
                                    title={
                                      t.viewAsset
                                    }
                                    style={styles.actionButton(
                                      '#2563eb'
                                    )}
                                  >
                                    👁️
                                  </button>
                                </Link>
                              )}

                              {status !==
                                'Returned' && (
                                <button
                                  type="button"
                                  title={
                                    t.returnAsset
                                  }
                                  disabled={
                                    returningId ===
                                    assignment.id
                                  }
                                  onClick={() =>
                                    handleReturnAsset(
                                      assignment
                                    )
                                  }
                                  style={{
                                    ...styles.actionButton(
                                      '#f59e0b'
                                    ),
                                    opacity:
                                      returningId ===
                                      assignment.id
                                        ? .6
                                        : 1
                                  }}
                                >
                                  {returningId ===
                                  assignment.id
                                    ? '⏳'
                                    : '↩️'}
                                </button>
                              )}

                              <button
                                type="button"
                                title={
                                  t.delete
                                }
                                disabled={
                                  deletingId ===
                                  assignment.id
                                }
                                onClick={() =>
                                  handleDelete(
                                    assignment
                                  )
                                }
                                style={{
                                  ...styles.actionButton(
                                    '#dc2626'
                                  ),
                                  opacity:
                                    deletingId ===
                                    assignment.id
                                      ? .6
                                      : 1
                                }}
                              >
                                {deletingId ===
                                assignment.id
                                  ? '⏳'
                                  : '🗑️'}
                              </button>
                            </td>
                          </tr>
                        );
                      }
                    )}
                  </tbody>
                </table>
              </div>

              {/* =================================================
                  PAGINATION
              ================================================= */}

              <div style={styles.pagination}>
                <div
                  style={{
                    fontSize: '.82rem',
                    color: isDark
                      ? '#94a3b8'
                      : '#64748b'
                  }}
                >
                  {t.showing}{' '}
                  {startItem}–{endItem}{' '}
                  {t.of}{' '}
                  {filteredAssignments.length}
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: '5px',
                    flexWrap: 'wrap'
                  }}
                >
                  <button
                    type="button"
                    disabled={
                      currentPage === 1
                    }
                    style={styles.pageButton(
                      false,
                      currentPage === 1
                    )}
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
                    ← {t.previous}
                  </button>

                  {Array.from(
                    {
                      length: Math.min(
                        totalPages,
                        7
                      )
                    },
                    (_, index) => {
                      let page;

                      if (
                        totalPages <=
                        7
                      ) {
                        page =
                          index + 1;
                      } else if (
                        currentPage <=
                        4
                      ) {
                        page =
                          index + 1;
                      } else if (
                        currentPage >=
                        totalPages - 3
                      ) {
                        page =
                          totalPages -
                          6 +
                          index;
                      } else {
                        page =
                          currentPage -
                          3 +
                          index;
                      }

                      return (
                        <button
                          type="button"
                          key={page}
                          style={styles.pageButton(
                            page ===
                              currentPage,
                            false
                          )}
                          onClick={() =>
                            setCurrentPage(
                              page
                            )
                          }
                        >
                          {page}
                        </button>
                      );
                    }
                  )}

                  <button
                    type="button"
                    disabled={
                      currentPage ===
                      totalPages
                    }
                    style={styles.pageButton(
                      false,
                      currentPage ===
                        totalPages
                    )}
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
                    {t.next} →
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* =====================================================
            INFORMATION / FUNCTION SUMMARY
        ===================================================== */}

        <div
          style={{
            ...styles.card,
            padding: '20px',
            marginTop: '18px'
          }}
        >
          <h3
            style={{
              marginTop: 0,
              color: isDark
                ? '#dbeafe'
                : '#17365d'
            }}
          >
            🔗 {t.assignmentInformation}
          </h3>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit,minmax(190px,1fr))',
              gap: '10px'
            }}
          >
            {[
              `📦 ${t.asset}`,
              `👤 ${t.assignedTo}`,
              `🏢 ${t.department}`,
              `📅 ${t.assignmentDate}`,
              `📅 ${t.expectedReturn}`,
              `↩️ ${t.actualReturn}`,
              `🔧 ${t.condition}`,
              `📝 ${t.notes}`,
              `✅ ${t.approvedBy}`
            ].map((item) => (
              <div
                key={item}
                style={{
                  padding: '10px 12px',
                  borderRadius: '8px',
                  background:
                    isDark
                      ? '#172033'
                      : '#f8fafc',
                  border:
                    `1px solid ${
                      isDark
                        ? '#334155'
                        : '#e2e8f0'
                    }`,
                  color:
                    isDark
                      ? '#cbd5e1'
                      : '#475569',
                  fontSize: '.8rem',
                  fontWeight: 600
                }}
              >
                {item}
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

/* ============================================================
   ENGLISH
============================================================ */

const englishTranslations = {
  title: 'Asset Assignment Management',
  subtitle:
    'Assign assets to users or departments, manage returns, and track assignment history.',

  newAssignment: 'New Assignment',
  close: 'Close',

  totalAssignments: 'Total Assignments',
  active: 'Active',
  dueSoon: 'Due Soon',
  overdue: 'Overdue',
  returned: 'Returned',

  assignmentDescription:
    'Create a new asset assignment using the asset management backend.',

  asset: 'Asset',
  assignedTo: 'Assigned To',
  department: 'Department',
  location: 'Location',

  assignmentDate: 'Assignment Date',
  expectedReturn: 'Expected Return',
  actualReturn: 'Actual Return',

  condition: 'Condition',
  notes: 'Notes',
  approvedBy: 'Approved By',

  selectAsset: 'Select Asset',
  selectUser: 'Select User',
  selectDepartment: 'Select Department',

  enterLocation: 'Enter location',
  enterNotes:
    'Enter assignment notes...',

  createAssignment:
    'Create Assignment',

  saving: 'Saving...',
  cancel: 'Cancel',

  searchPlaceholder:
    'Search asset, user, department, location...',

  allStatus: 'All Status',
  allDepartments: 'All Departments',

  clearFilters: 'Clear Filters',
  refresh: 'Refresh',
  refreshed: 'Data refreshed successfully.',
  refreshFailed:
    'Failed to refresh data.',

  noAvailableAssets:
    'No available assets are currently ready for assignment.',

  noAssignments:
    'No assignments found',

  noMatchingAssignments:
    'No assignments match your search or filters.',

  noAssignmentsDescription:
    'Assignments will appear here after an asset is assigned.',

  showing: 'Showing',
  of: 'of',

  previous: 'Previous',
  next: 'Next',

  status: 'Status',
  actions: 'Actions',

  viewAsset: 'View Asset',
  returnAsset: 'Return Asset',
  delete: 'Delete',

  loading: 'Loading...',
  loadingAssignments:
    'Loading assignment management data...',

  loadError:
    'Unable to load assignments',

  loadErrorDescription:
    'The assignment data could not be retrieved from the backend.',

  retry: 'Retry',

  assignmentDateRequired:
    'Assignment date is required.',

  invalidDate:
    'Please enter valid dates.',

  returnDateError:
    'Expected return date cannot be before the assignment date.',

  assetNotFound:
    'Selected asset was not found.',

  assetUnavailable:
    'This asset is not available for assignment.',

  assetAlreadyAssigned:
    'This asset already has an active assignment.',

  assignmentCreated:
    'Assignment created successfully.',

  assignmentCreateFailed:
    'Unable to create assignment.',

  confirmReturn:
    'Are you sure you want to return this asset?',

  assetReturned:
    'Asset returned successfully.',

  returnFailed:
    'Unable to return the asset.',

  confirmDelete:
    'Are you sure you want to delete this assignment?',

  assignmentDeleted:
    'Assignment deleted successfully.',

  deleteFailed:
    'Unable to delete assignment.',

  assignmentInformation:
    'Assignment Information'
};

/* ============================================================
   AMHARIC
============================================================ */

const amharicTranslations = {
  title: 'የንብረት ምደባ አስተዳደር',

  subtitle:
    'ንብረቶችን ለተጠቃሚዎች ወይም ለክፍሎች መመደብ፣ መመለስ እና የምደባ ታሪክ መቆጣጠር።',

  newAssignment: 'አዲስ ምደባ',
  close: 'ዝጋ',

  totalAssignments: 'ጠቅላላ ምደባ',
  active: 'ንቁ',
  dueSoon: 'በቅርቡ የሚመለስ',
  overdue: 'ጊዜው ያለፈ',
  returned: 'የተመለሰ',

  assignmentDescription:
    'ከንብረት አስተዳደር backend ጋር በመገናኘት አዲስ የንብረት ምደባ ይፍጠሩ።',

  asset: 'ንብረት',
  assignedTo: 'የተመደበለት',
  department: 'ክፍል',
  location: 'ቦታ',

  assignmentDate: 'የምደባ ቀን',
  expectedReturn: 'የሚመለስበት ቀን',
  actualReturn: 'በእውነት የተመለሰበት',

  condition: 'ሁኔታ',
  notes: 'ማስታወሻ',
  approvedBy: 'ያጸደቀው',

  selectAsset: 'ንብረት ይምረጡ',
  selectUser: 'ተጠቃሚ ይምረጡ',
  selectDepartment: 'ክፍል ይምረጡ',

  enterLocation: 'ቦታ ያስገቡ',

  enterNotes:
    'የምደባ ማስታወሻ ያስገቡ...',

  createAssignment: 'ምደባ ፍጠር',

  saving: 'በማስቀመጥ ላይ...',
  cancel: 'ሰርዝ',

  searchPlaceholder:
    'ንብረት፣ ተጠቃሚ፣ ክፍል ወይም ቦታ ይፈልጉ...',

  allStatus: 'ሁሉም ሁኔታዎች',
  allDepartments: 'ሁሉም ክፍሎች',

  clearFilters: 'ማጣሪያ አጽዳ',
  refresh: 'አድስ',
  refreshed:
    'መረጃው በተሳካ ሁኔታ ታድሷል።',
  refreshFailed:
    'መረጃውን ማደስ አልተቻለም።',

  noAvailableAssets:
    'ለምደባ ዝግጁ የሆነ ንብረት የለም።',

  noAssignments:
    'ምንም የምደባ መዝገብ አልተገኘም',

  noMatchingAssignments:
    'ከፍለጋዎ ወይም ማጣሪያዎ ጋር የሚዛመድ ምደባ የለም።',

  noAssignmentsDescription:
    'ንብረት ከተመደበ በኋላ የምደባ መዝገቦች እዚህ ይታያሉ።',

  showing: 'እያሳየ',
  of: 'ከ',

  previous: 'ቀዳሚ',
  next: 'ቀጣይ',

  status: 'ሁኔታ',
  actions: 'ተግባራት',

  viewAsset: 'ንብረቱን እይ',
  returnAsset: 'ንብረቱን መልስ',
  delete: 'ሰርዝ',

  loading: 'በመጫን ላይ...',
  loadingAssignments:
    'የንብረት ምደባ መረጃን በመጫን ላይ...',

  loadError:
    'የምደባ መረጃን መጫን አልተቻለም',

  loadErrorDescription:
    'የምደባ መረጃውን ከbackend ማግኘት አልተቻለም።',

  retry: 'እንደገና ሞክር',

  assignmentDateRequired:
    'የምደባ ቀን ያስፈልጋል።',

  invalidDate:
    'እባክዎ ትክክለኛ ቀን ያስገቡ።',

  returnDateError:
    'የመመለሻ ቀን ከምደባ ቀን በፊት መሆን አይችልም።',

  assetNotFound:
    'የተመረጠው ንብረት አልተገኘም።',

  assetUnavailable:
    'ይህ ንብረት ለምደባ ዝግጁ አይደለም።',

  assetAlreadyAssigned:
    'ይህ ንብረት አሁን የተመደበ ነው።',

  assignmentCreated:
    'ምደባው በተሳካ ሁኔታ ተፈጥሯል።',

  assignmentCreateFailed:
    'ምደባውን መፍጠር አልተቻለም።',

  confirmReturn:
    'ይህንን ንብረት መመለስ እርግጠኛ ነዎት?',

  assetReturned:
    'ንብረቱ በተሳካ ሁኔታ ተመልሷል።',

  returnFailed:
    'ንብረቱን መመለስ አልተቻለም።',

  confirmDelete:
    'ይህንን የምደባ መዝገብ መሰረዝ እርግጠኛ ነዎት?',

  assignmentDeleted:
    'የምደባ መዝገቡ በተሳካ ሁኔታ ተሰርዟል።',

  deleteFailed:
    'የምደባ መዝገቡን መሰረዝ አልተቻለም።',

  assignmentInformation:
    'የምደባ መረጃ'
};

export default AdminAssignment;
