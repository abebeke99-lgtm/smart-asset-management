import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/UiContext';
import { toast } from 'react-toastify';
import { apiClient as axios } from '../../utils/api';

const AdminAssets = () => {
  const { language, theme } = useLanguage();
  const navigate = useNavigate();

  const isDark = theme === 'dark';
  const t = language === 'en' ? englishTranslations : amharicTranslations;

  // ============================================================
  // STATE
  // ============================================================

  const [assets, setAssets] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [users, setUsers] = useState([]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterCondition, setFilterCondition] = useState('');
  const [filterLocation, setFilterLocation] = useState('');

  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const [selectedAssets, setSelectedAssets] = useState([]);

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const [selectedAsset, setSelectedAsset] = useState(null);
  const [historyData, setHistoryData] = useState([]);

  const [actionLoading, setActionLoading] = useState(false);

  const [assignData, setAssignData] = useState({
    department_id: '',
    user_id: '',
    location: '',
    reason: ''
  });

  const [transferData, setTransferData] = useState({
    department_id: '',
    user_id: '',
    location: '',
    reason: ''
  });

  const [summary, setSummary] = useState({
    total: 0,
    available: 0,
    assigned: 0,
    maintenance: 0,
    damaged: 0,
    missing: 0,
    retired: 0
  });

  // ============================================================
  // STYLES
  // ============================================================

  const styles = useMemo(
    () => ({
      container: {
        padding: '20px',
        width: '100%',
        maxWidth: '1600px',
        margin: '0 auto',
        boxSizing: 'border-box'
      },

      header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px',
        marginBottom: '24px'
      },

      title: {
        color: isDark ? '#c8dcf5' : '#1a365d',
        fontSize: '1.75rem',
        fontWeight: 700,
        margin: 0
      },

      subtitle: {
        color: isDark ? '#8896b0' : '#4a5568',
        fontSize: '0.9rem',
        margin: '5px 0 0'
      },

      headerActions: {
        display: 'flex',
        gap: '10px',
        flexWrap: 'wrap'
      },

      button: (background = 'linear-gradient(135deg, #2b6cb0, #4299e1)') => ({
        padding: '10px 18px',
        background,
        color: '#fff',
        border: 'none',
        borderRadius: '8px',
        fontWeight: 600,
        cursor: 'pointer',
        fontSize: '0.88rem',
        transition: 'all 0.2s ease',
        whiteSpace: 'nowrap'
      }),

      summaryGrid: {
        display: 'grid',
        gridTemplateColumns:
          'repeat(auto-fit, minmax(140px, 1fr))',
        gap: '12px',
        marginBottom: '20px'
      },

      summaryCard: (color, active = false) => ({
        background: isDark ? '#1e2d45' : '#fff',
        border: `1px solid ${
          active ? color : isDark ? '#32465f' : '#e8edf5'
        }`,
        borderLeft: `4px solid ${color}`,
        borderRadius: '10px',
        padding: '14px',
        textAlign: 'left',
        cursor: 'pointer',
        boxShadow: active
          ? `0 0 0 2px ${color}30`
          : '0 2px 8px rgba(0,0,0,0.04)',
        color: isDark ? '#c8dcf5' : '#1a365d'
      }),

      summaryIcon: {
        fontSize: '1.2rem',
        display: 'block',
        marginBottom: '5px'
      },

      summaryValue: {
        fontSize: '1.4rem',
        fontWeight: 700
      },

      summaryLabel: {
        fontSize: '0.76rem',
        color: isDark ? '#a0aec0' : '#4a5568',
        marginTop: '3px'
      },

      controls: {
        display: 'flex',
        gap: '10px',
        flexWrap: 'wrap',
        alignItems: 'center',
        marginBottom: '16px',
        padding: '16px',
        background: isDark ? '#1a273a' : '#f7fafc',
        borderRadius: '12px',
        border: `1px solid ${
          isDark ? '#32465f' : '#e8edf5'
        }`
      },

      input: {
        padding: '10px 14px',
        borderRadius: '8px',
        border: `1px solid ${
          isDark ? '#32465f' : '#d0d8e8'
        }`,
        background: isDark ? '#0d1b2a' : '#fff',
        color: isDark ? '#c8dcf5' : '#1a365d',
        fontSize: '0.88rem',
        minWidth: '180px',
        flex: '1'
      },

      select: {
        padding: '10px 14px',
        borderRadius: '8px',
        border: `1px solid ${
          isDark ? '#32465f' : '#d0d8e8'
        }`,
        background: isDark ? '#0d1b2a' : '#fff',
        color: isDark ? '#c8dcf5' : '#1a365d',
        fontSize: '0.88rem',
        cursor: 'pointer',
        minWidth: '140px'
      },

      tableWrapper: {
        width: '100%',
        overflowX: 'auto',
        borderRadius: '12px',
        boxShadow: isDark
          ? '0 4px 12px rgba(0,0,0,0.3)'
          : '0 4px 12px rgba(0,0,100,0.06)'
      },

      table: {
        width: '100%',
        minWidth: '1250px',
        borderCollapse: 'collapse',
        background: isDark ? '#1e2d45' : '#fff'
      },

      th: {
        padding: '13px 14px',
        textAlign: 'left',
        color: isDark ? '#c8dcf5' : '#1a365d',
        fontWeight: 700,
        borderBottom: `2px solid ${
          isDark ? '#32465f' : '#e8edf5'
        }`,
        background: isDark ? '#141e2d' : '#f7fafc',
        fontSize: '0.82rem',
        whiteSpace: 'nowrap'
      },

      td: {
        padding: '12px 14px',
        borderBottom: `1px solid ${
          isDark ? '#32465f' : '#e8edf5'
        }`,
        color: isDark ? '#c8dcf5' : '#1a365d',
        fontSize: '0.86rem',
        verticalAlign: 'middle'
      },

      statusBadge: status => {
        const color = getStatusColor(status);

        return {
          display: 'inline-block',
          padding: '4px 10px',
          borderRadius: '20px',
          fontSize: '0.72rem',
          fontWeight: 700,
          background: `${color}20`,
          color
        };
      },

      conditionBadge: condition => {
        const color = getConditionColor(condition);

        return {
          display: 'inline-block',
          padding: '4px 10px',
          borderRadius: '20px',
          fontSize: '0.72rem',
          fontWeight: 700,
          background: `${color}20`,
          color
        };
      },

      actionButton: background => ({
        padding: '6px 9px',
        borderRadius: '6px',
        border: 'none',
        cursor: 'pointer',
        fontSize: '0.75rem',
        background,
        color: '#fff',
        transition: 'all 0.2s'
      }),

      checkbox: {
        width: '17px',
        height: '17px',
        cursor: 'pointer'
      },

      emptyState: {
        textAlign: 'center',
        padding: '60px 20px',
        color: isDark ? '#8896b0' : '#4a5568',
        background: isDark ? '#1e2d45' : '#fff',
        borderRadius: '12px',
        border: `1px solid ${
          isDark ? '#32465f' : '#e8edf5'
        }`
      },

      pagination: {
        display: 'flex',
        justifyContent: 'center',
        gap: '7px',
        marginTop: '20px',
        alignItems: 'center',
        flexWrap: 'wrap'
      },

      pageButton: (active = false) => ({
        padding: '8px 13px',
        borderRadius: '6px',
        border: `1px solid ${
          isDark ? '#32465f' : '#d0d8e8'
        }`,
        background: active
          ? '#2b6cb0'
          : isDark
          ? '#0d1b2a'
          : '#fff',
        color: active
          ? '#fff'
          : isDark
          ? '#c8dcf5'
          : '#1a365d',
        cursor: 'pointer',
        fontWeight: active ? 700 : 400
      }),

      modalOverlay: {
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px'
      },

      modal: {
        background: isDark ? '#1e2d45' : '#fff',
        borderRadius: '16px',
        padding: '28px',
        maxWidth: '560px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.4)'
      },

      modalTitle: {
        color: isDark ? '#c8dcf5' : '#1a365d',
        fontSize: '1.25rem',
        fontWeight: 700,
        margin: '0 0 20px'
      },

      formGroup: {
        marginBottom: '16px'
      },

      label: {
        display: 'block',
        color: isDark ? '#c8dcf5' : '#1a365d',
        fontSize: '0.84rem',
        fontWeight: 600,
        marginBottom: '6px'
      },

      formInput: {
        width: '100%',
        boxSizing: 'border-box',
        padding: '10px 13px',
        borderRadius: '8px',
        border: `1px solid ${
          isDark ? '#32465f' : '#d0d8e8'
        }`,
        background: isDark ? '#0d1b2a' : '#fff',
        color: isDark ? '#c8dcf5' : '#1a365d',
        fontSize: '0.92rem'
      },

      modalActions: {
        display: 'flex',
        gap: '10px',
        justifyContent: 'flex-end',
        marginTop: '22px'
      },

      historyTimeline: {
        borderLeft: `2px solid ${
          isDark ? '#32465f' : '#d0d8e8'
        }`,
        paddingLeft: '16px',
        marginLeft: '8px'
      },

      historyItem: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        padding: '12px 0',
        borderBottom: `1px solid ${
          isDark ? '#32465f' : '#e8edf5'
        }`
      },

      historyIcon: {
        fontSize: '1.2rem'
      },

      historyContent: {
        flex: 1
      },

      historyTitle: {
        color: isDark ? '#c8dcf5' : '#1a365d',
        fontSize: '0.88rem',
        fontWeight: 600
      },

      historyMeta: {
        color: isDark ? '#8896b0' : '#4a5568',
        fontSize: '0.72rem',
        marginTop: '4px'
      },

      chip: {
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: '12px',
        fontSize: '0.68rem',
        fontWeight: 600,
        background: isDark ? '#32465f' : '#e8edf5',
        color: isDark ? '#c8dcf5' : '#1a365d'
      },

      managementGrid: {
        display: 'grid',
        gridTemplateColumns:
          'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '10px',
        marginBottom: '20px'
      },

      managementCard: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '12px 14px',
        background: isDark ? '#1e2d45' : '#fff',
        border: `1px solid ${
          isDark ? '#32465f' : '#e8edf5'
        }`,
        borderRadius: '10px',
        color: isDark ? '#c8dcf5' : '#1a365d',
        textDecoration: 'none',
        fontWeight: 600,
        fontSize: '0.85rem'
      }
    }),
    [isDark]
  );

  // ============================================================
  // FETCH ASSETS
  // ============================================================

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    setLoadError(false);

    try {
      const params = {
        page: currentPage,
        limit: 10,
        status: filterStatus || undefined,
        department_id: filterDepartment || undefined,
        category: filterCategory || undefined,
        condition: filterCondition || undefined,
        location: filterLocation || undefined,
        sort_by: sortBy,
        sort_order: sortOrder,
        search: search.trim() || undefined
      };

      const response = await axios.get('/api/assets', { params });

      const data = response.data || {};

      const rows = Array.isArray(data.data)
        ? data.data
        : Array.isArray(data.assets)
        ? data.assets
        : [];

      const pagination = data.pagination || {};

      const total =
        pagination.total ??
        data.total ??
        rows.length;

      const pages =
        pagination.pages ??
        Math.max(1, Math.ceil(total / 10));

      setAssets(rows);
      setTotalItems(Number(total) || 0);
      setTotalPages(Number(pages) || 1);

      if (data.summary) {
        setSummary({
          total: Number(data.summary.total ?? total) || 0,
          available:
            Number(data.summary.available) || 0,
          assigned:
            Number(data.summary.assigned) || 0,
          maintenance:
            Number(data.summary.maintenance) || 0,
          damaged:
            Number(data.summary.damaged) || 0,
          missing:
            Number(data.summary.missing) || 0,
          retired:
            Number(data.summary.retired) || 0
        });
      } else {
        setSummary(prev => ({
          ...prev,
          total: Number(total) || 0
        }));
      }

      // Remove selections that no longer exist on the page.
      setSelectedAssets(prev =>
        prev.filter(id => rows.some(asset => asset.id === id))
      );
    } catch (error) {
      console.error('Failed to load assets:', error);
      setLoadError(true);

      if (assets.length > 0) {
        toast.error(t.loadError);
      }
    } finally {
      setLoading(false);
    }
  }, [
    currentPage,
    filterStatus,
    filterDepartment,
    filterCategory,
    filterCondition,
    filterLocation,
    sortBy,
    sortOrder,
    search,
    t.loadError,
    assets.length
  ]);

  // ============================================================
  // FETCH SUPPORTING DATA
  // ============================================================

  const fetchDepartments = useCallback(async () => {
    try {
      const response = await axios.get('/api/departments');

      const rows = Array.isArray(response.data?.departments)
        ? response.data.departments
        : Array.isArray(response.data?.data)
        ? response.data.data
        : [];

      setDepartments(rows);
    } catch (error) {
      console.error('Failed to load departments:', error);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const response = await axios.get('/api/categories');

      const rows = Array.isArray(response.data?.categories)
        ? response.data.categories
        : Array.isArray(response.data?.data)
        ? response.data.data
        : [];

      setCategories(rows);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const response = await axios.get('/api/users');

      const rows = Array.isArray(response.data?.users)
        ? response.data.users
        : Array.isArray(response.data?.data)
        ? response.data.data
        : [];

      setUsers(rows);
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  }, []);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  useEffect(() => {
    fetchDepartments();
    fetchCategories();
    fetchUsers();
  }, [
    fetchDepartments,
    fetchCategories,
    fetchUsers
  ]);

  // ============================================================
  // FILTER HELPERS
  // ============================================================

  const resetFilters = () => {
    setSearch('');
    setFilterStatus('');
    setFilterDepartment('');
    setFilterCategory('');
    setFilterCondition('');
    setFilterLocation('');
    setSortBy('created_at');
    setSortOrder('desc');
    setCurrentPage(1);
    setSelectedAssets([]);
  };

  const applyStatusFilter = status => {
    setFilterStatus(status);
    setCurrentPage(1);
    setSelectedAssets([]);
  };

  const handleSearch = event => {
    event.preventDefault();
    setCurrentPage(1);
    fetchAssets();
  };

  // ============================================================
  // SELECT ASSETS
  // ============================================================

  const allCurrentPageSelected =
    assets.length > 0 &&
    assets.every(asset =>
      selectedAssets.includes(asset.id)
    );

  const toggleSelectAll = checked => {
    if (checked) {
      setSelectedAssets(
        assets.map(asset => asset.id)
      );
    } else {
      setSelectedAssets([]);
    }
  };

  const toggleAssetSelection = (id, checked) => {
    setSelectedAssets(prev => {
      if (checked) {
        return prev.includes(id)
          ? prev
          : [...prev, id];
      }

      return prev.filter(assetId => assetId !== id);
    });
  };

  // ============================================================
  // DELETE
  // ============================================================

  const handleDelete = async id => {
    if (!window.confirm(t.confirmDelete)) {
      return;
    }

    setActionLoading(true);

    try {
      await axios.delete(`/api/assets/${id}`);

      toast.success(t.assetDeleted);

      setSelectedAssets(prev =>
        prev.filter(assetId => assetId !== id)
      );

      await fetchAssets();
    } catch (error) {
      console.error('Delete asset failed:', error);
      toast.error(
        error.response?.data?.message ||
          t.deleteFailed
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedAssets.length === 0) {
      return;
    }

    const confirmed = window.confirm(
      t.confirmBulkDelete.replace(
        '{count}',
        selectedAssets.length
      )
    );

    if (!confirmed) {
      return;
    }

    setActionLoading(true);

    try {
      await Promise.all(
        selectedAssets.map(id =>
          axios.delete(`/api/assets/${id}`)
        )
      );

      toast.success(
        t.bulkDeleteSuccess.replace(
          '{count}',
          selectedAssets.length
        )
      );

      setSelectedAssets([]);

      await fetchAssets();
    } catch (error) {
      console.error(
        'Bulk delete failed:',
        error
      );

      toast.error(
        error.response?.data?.message ||
          t.deleteFailed
      );
    } finally {
      setActionLoading(false);
    }
  };

  // ============================================================
  // ASSIGN
  // ============================================================

  const openAssignModal = asset => {
    setSelectedAsset(asset);

    setAssignData({
      department_id:
        asset.department_id ||
        asset.department_name ||
        '',
      user_id:
        asset.assigned_to_id ||
        asset.user_id ||
        '',
      location: asset.location || '',
      reason: ''
    });

    setShowAssignModal(true);
  };

  const closeAssignModal = () => {
    if (actionLoading) return;

    setShowAssignModal(false);
    setSelectedAsset(null);

    setAssignData({
      department_id: '',
      user_id: '',
      location: '',
      reason: ''
    });
  };

  const handleAssign = async () => {
    if (!selectedAsset) {
      return;
    }

    if (!assignData.user_id) {
      toast.error(t.selectUser);
      return;
    }

    setActionLoading(true);

    try {
      await axios.post(
        `/api/assets/${selectedAsset.id}/assign`,
        {
          user_id: assignData.user_id,
          department_id:
            assignData.department_id || undefined,
          location:
            assignData.location || undefined,
          reason:
            assignData.reason || undefined
        }
      );

      toast.success(t.assignSuccess);

      closeAssignModal();

      await fetchAssets();
    } catch (error) {
      console.error(
        'Assign asset failed:',
        error
      );

      toast.error(
        error.response?.data?.message ||
          t.assignFailed
      );
    } finally {
      setActionLoading(false);
    }
  };

  // ============================================================
  // TRANSFER
  // ============================================================

  const openTransferModal = asset => {
    setSelectedAsset(asset);

    setTransferData({
      department_id: '',
      user_id: '',
      location: asset.location || '',
      reason: ''
    });

    setShowTransferModal(true);
  };

  const closeTransferModal = () => {
    if (actionLoading) return;

    setShowTransferModal(false);
    setSelectedAsset(null);

    setTransferData({
      department_id: '',
      user_id: '',
      location: '',
      reason: ''
    });
  };

  const handleTransfer = async () => {
    if (!selectedAsset) {
      return;
    }

    if (!transferData.department_id) {
      toast.error(t.selectDepartment);
      return;
    }

    setActionLoading(true);

    try {
      await axios.post(
        `/api/assets/${selectedAsset.id}/transfer`,
        {
          department_id:
            transferData.department_id,
          new_user_id:
            transferData.user_id || undefined,
          location:
            transferData.location || undefined,
          reason:
            transferData.reason || undefined
        }
      );

      toast.success(t.transferSuccess);

      closeTransferModal();

      await fetchAssets();
    } catch (error) {
      console.error(
        'Transfer asset failed:',
        error
      );

      toast.error(
        error.response?.data?.message ||
          t.transferFailed
      );
    } finally {
      setActionLoading(false);
    }
  };

  // ============================================================
  // HISTORY
  // ============================================================

  const fetchAssetHistory = async asset => {
    setSelectedAsset(asset);
    setHistoryData([]);
    setShowHistoryModal(true);

    try {
      const response = await axios.get(
        `/api/assets/${asset.id}/history`
      );

      const history = Array.isArray(
        response.data?.history
      )
        ? response.data.history
        : Array.isArray(response.data?.data)
        ? response.data.data
        : [];

      setHistoryData(history);
    } catch (error) {
      console.error(
        'Failed to load asset history:',
        error
      );

      toast.error(t.historyLoadFailed);
    }
  };

  const closeHistoryModal = () => {
    setShowHistoryModal(false);
    setSelectedAsset(null);
    setHistoryData([]);
  };

  // ============================================================
  // RFID / QR
  // ============================================================

  const handleGenerateQR = assetId => {
    navigate(`/admin/rfid?asset=${assetId}`);
  };

  // ============================================================
  // NAVIGATION
  // ============================================================

  const managementLinks = [
    {
      label: t.createAsset,
      icon: '➕',
      path: '/admin/assets/create'
    },
    {
      label: t.categories,
      icon: '🗂️',
      path: '/admin/assets/categories'
    },
    {
      label: t.locations,
      icon: '📍',
      path: '/admin/assets/locations'
    },
    {
      label: t.lifecycle,
      icon: '🔄',
      path: '/admin/assets/lifecycle'
    },
    {
      label: t.disposalRetirement,
      icon: '🗑️',
      path: '/admin/assets/disposal'
    },
    {
      label: t.documents,
      icon: '📄',
      path: '/admin/assets/documents'
    }
  ];

  // ============================================================
  // LOADING / ERROR
  // ============================================================

  if (loading && assets.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.emptyState}>
          <div style={{ fontSize: '2.5rem' }}>
            ⏳
          </div>

          <h2
            style={{
              color: isDark
                ? '#c8dcf5'
                : '#1a365d'
            }}
          >
            {t.loading}
          </h2>

          <p>{t.loadingAssets}</p>
        </div>
      </div>
    );
  }

  if (loadError && assets.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.emptyState}>
          <div style={{ fontSize: '3rem' }}>
            ⚠️
          </div>

          <h2
            style={{
              color: isDark
                ? '#c8dcf5'
                : '#1a365d'
            }}
          >
            {t.loadError}
          </h2>

          <p>{t.loadErrorDesc}</p>

          <button
            type="button"
            style={styles.button('#2b6cb0')}
            onClick={fetchAssets}
          >
            🔄 {t.retry}
          </button>
        </div>
      </div>
    );
  }

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div style={styles.container}>
      {/* ======================================================
          HEADER
      ======================================================= */}

      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>
            📦 {t.assets}
          </h1>

          <p style={styles.subtitle}>
            {t.totalAssetsCount.replace(
              '{count}',
              totalItems
            )}
          </p>
        </div>

        <div style={styles.headerActions}>
          {selectedAssets.length > 0 && (
            <button
              type="button"
              style={styles.button('#e53e3e')}
              onClick={handleBulkDelete}
              disabled={actionLoading}
            >
              🗑️ {t.deleteSelected} (
              {selectedAssets.length})
            </button>
          )}

          <button
            type="button"
            style={styles.button('#805ad5')}
            onClick={resetFilters}
          >
            🔄 {t.resetFilters}
          </button>

          <button
            type="button"
            style={styles.button(
              'linear-gradient(135deg,#2b6cb0,#4299e1)'
            )}
            onClick={() =>
              navigate('/admin/assets/create')
            }
          >
            ➕ {t.createAsset}
          </button>
        </div>
      </div>

      {/* ======================================================
          ASSET MANAGEMENT NAVIGATION
      ======================================================= */}

      <div style={styles.managementGrid}>
        {managementLinks.map(item => (
          <Link
            key={item.path}
            to={item.path}
            style={styles.managementCard}
          >
            <span style={{ fontSize: '1.15rem' }}>
              {item.icon}
            </span>

            <span>{item.label}</span>
          </Link>
        ))}
      </div>

      {/* ======================================================
          SUMMARY CARDS
      ======================================================= */}

      <div
        style={styles.summaryGrid}
        aria-label={t.assetSummary}
      >
        {[
          [
            t.totalAssets,
            summary.total,
            '📦',
            '#2b6cb0',
            ''
          ],
          [
            t.available,
            summary.available,
            '✅',
            '#38a169',
            'available'
          ],
          [
            t.assigned,
            summary.assigned,
            '📋',
            '#805ad5',
            'assigned'
          ],
          [
            t.underMaintenance,
            summary.maintenance,
            '🔧',
            '#dd6b20',
            'under-maintenance'
          ],
          [
            t.damaged,
            summary.damaged,
            '⚠️',
            '#c53030',
            'damaged'
          ],
          [
            t.lost,
            summary.missing,
            '❌',
            '#9b2c2c',
            'lost'
          ],
          [
            t.retired,
            summary.retired,
            '🗄️',
            '#718096',
            'retired'
          ]
        ].map(
          ([
            label,
            value,
            icon,
            color,
            status
          ]) => (
            <button
              type="button"
              key={label}
              style={styles.summaryCard(
                color,
                filterStatus === status
              )}
              onClick={() =>
                applyStatusFilter(status)
              }
            >
              <span style={styles.summaryIcon}>
                {icon}
              </span>

              <div style={styles.summaryValue}>
                {value}
              </div>

              <div style={styles.summaryLabel}>
                {label}
              </div>
            </button>
          )
        )}
      </div>

      {/* ======================================================
          SEARCH / FILTER / SORT
      ======================================================= */}

      <form
        style={styles.controls}
        onSubmit={handleSearch}
      >
        <input
          type="text"
          style={styles.input}
          placeholder={t.searchPlaceholder}
          value={search}
          onChange={event =>
            setSearch(event.target.value)
          }
        />

        <select
          style={styles.select}
          value={filterStatus}
          onChange={event => {
            setFilterStatus(event.target.value);
            setCurrentPage(1);
          }}
        >
          <option value="">
            {t.allStatus}
          </option>

          <option value="Active">
            {t.active}
          </option>

          <option value="In-Use">
            {t.inUse}
          </option>

          <option value="Available">
            {t.available}
          </option>

          <option value="Under-Maintenance">
            {t.underMaintenance}
          </option>

          <option value="Disposed">
            {t.disposed}
          </option>

          <option value="Lost">
            {t.lost}
          </option>

          <option value="Reserved">
            {t.reserved}
          </option>
        </select>

        <select
          style={styles.select}
          value={filterDepartment}
          onChange={event => {
            setFilterDepartment(
              event.target.value
            );
            setCurrentPage(1);
          }}
        >
          <option value="">
            {t.allDepartments}
          </option>

          {departments.map(department => (
            <option
              key={department.id}
              value={
                department.id ||
                department.name
              }
            >
              {department.name}
            </option>
          ))}
        </select>

        <select
          style={styles.select}
          value={filterCategory}
          onChange={event => {
            setFilterCategory(
              event.target.value
            );
            setCurrentPage(1);
          }}
        >
          <option value="">
            {t.allCategories}
          </option>

          {categories.map(category => (
            <option
              key={category.id}
              value={
                category.name ||
                category.id
              }
            >
              {category.name}
            </option>
          ))}
        </select>

        <select
          style={styles.select}
          value={filterCondition}
          onChange={event => {
            setFilterCondition(
              event.target.value
            );
            setCurrentPage(1);
          }}
        >
          <option value="">
            {t.allConditions}
          </option>

          <option value="Excellent">
            {t.excellent}
          </option>

          <option value="Good">
            {t.good}
          </option>

          <option value="Fair">
            {t.fair}
          </option>

          <option value="Poor">
            {t.poor}
          </option>

          <option value="Damaged">
            {t.damaged}
          </option>
        </select>

        <input
          type="text"
          style={styles.input}
          placeholder={t.locationFilter}
          value={filterLocation}
          onChange={event => {
            setFilterLocation(
              event.target.value
            );
            setCurrentPage(1);
          }}
        />

        <select
          style={styles.select}
          value={sortBy}
          onChange={event => {
            setSortBy(event.target.value);
            setCurrentPage(1);
          }}
        >
          <option value="name">
            {t.sortByName}
          </option>

          <option value="created_at">
            {t.sortByDate}
          </option>

          <option value="current_value">
            {t.sortByValue}
          </option>

          <option value="status">
            {t.sortByStatus}
          </option>
        </select>

        <select
          style={styles.select}
          value={sortOrder}
          onChange={event => {
            setSortOrder(event.target.value);
            setCurrentPage(1);
          }}
        >
          <option value="asc">
            {t.ascending}
          </option>

          <option value="desc">
            {t.descending}
          </option>
        </select>

        <button
          type="submit"
          style={styles.button(
            'linear-gradient(135deg,#2b6cb0,#4299e1)'
          )}
        >
          🔍 {t.search}
        </button>
      </form>

      {/* ======================================================
          TABLE
      ======================================================= */}

      {assets.length === 0 ? (
        <div style={styles.emptyState}>
          <div
            style={{
              fontSize: '3rem',
              marginBottom: '12px'
            }}
          >
            📭
          </div>

          <h2
            style={{
              color: isDark
                ? '#c8dcf5'
                : '#1a365d'
            }}
          >
            {t.noAssets}
          </h2>

          <p>{t.tryFilters}</p>

          <button
            type="button"
            style={{
              ...styles.button('#805ad5'),
              marginTop: '12px'
            }}
            onClick={resetFilters}
          >
            {t.resetFilters}
          </button>
        </div>
      ) : (
        <>
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>
                    <input
                      type="checkbox"
                      style={styles.checkbox}
                      checked={
                        allCurrentPageSelected
                      }
                      onChange={event =>
                        toggleSelectAll(
                          event.target.checked
                        )
                      }
                      aria-label={
                        t.selectAll
                      }
                    />
                  </th>

                  <th style={styles.th}>
                    {t.assetTag}
                  </th>

                  <th style={styles.th}>
                    {t.name}
                  </th>

                  <th style={styles.th}>
                    {t.category}
                  </th>

                  <th style={styles.th}>
                    {t.department}
                  </th>

                  <th style={styles.th}>
                    {t.status}
                  </th>

                  <th style={styles.th}>
                    {t.condition}
                  </th>

                  <th style={styles.th}>
                    {t.location}
                  </th>

                  <th style={styles.th}>
                    {t.value}
                  </th>

                  <th style={styles.th}>
                    {t.assignedTo}
                  </th>

                  <th style={styles.th}>
                    {t.rfidTag}
                  </th>

                  <th style={styles.th}>
                    {t.actions}
                  </th>
                </tr>
              </thead>

              <tbody>
                {assets.map(asset => (
                  <tr key={asset.id}>
                    <td style={styles.td}>
                      <input
                        type="checkbox"
                        style={styles.checkbox}
                        checked={selectedAssets.includes(
                          asset.id
                        )}
                        onChange={event =>
                          toggleAssetSelection(
                            asset.id,
                            event.target.checked
                          )
                        }
                      />
                    </td>

                    <td style={styles.td}>
                      <Link
                        to={`/assets/${asset.id}`}
                        style={{
                          color: '#2b6cb0',
                          textDecoration: 'none',
                          fontWeight: 700
                        }}
                      >
                        {asset.asset_tag ||
                          asset.asset_code ||
                          asset.id}
                      </Link>
                    </td>

                    <td style={styles.td}>
                      <div
                        style={{
                          fontWeight: 600
                        }}
                      >
                        {asset.name || '-'}
                      </div>

                      <div
                        style={{
                          fontSize: '0.7rem',
                          color: isDark
                            ? '#8896b0'
                            : '#4a5568',
                          marginTop: '3px'
                        }}
                      >
                        {asset.brand
                          ? `${asset.brand} `
                          : ''}
                        {asset.model ||
                          asset.serial_number ||
                          ''}
                      </div>
                    </td>

                    <td style={styles.td}>
                      {asset.category || '-'}
                    </td>

                    <td style={styles.td}>
                      {asset.department_name ||
                        asset.department ||
                        '-'}
                    </td>

                    <td style={styles.td}>
                      <span
                        style={styles.statusBadge(
                          asset.status
                        )}
                      >
                        {asset.status || '-'}
                      </span>
                    </td>

                    <td style={styles.td}>
                      <span
                        style={styles.conditionBadge(
                          asset.condition
                        )}
                      >
                        {asset.condition || '-'}
                      </span>
                    </td>

                    <td style={styles.td}>
                      {asset.location || '-'}
                    </td>

                    <td style={styles.td}>
                      $
                      {Number(
                        asset.current_value ??
                          asset.purchase_price ??
                          0
                      ).toLocaleString()}
                    </td>

                    <td style={styles.td}>
                      {asset.assigned_to_name ||
                        asset.assigned_to ||
                        '-'}
                    </td>

                    <td style={styles.td}>
                      {asset.rfid_tag || '-'}
                    </td>

                    <td style={styles.td}>
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '4px'
                        }}
                      >
                        {/* VIEW */}
                        <Link
                          to={`/assets/${asset.id}`}
                        >
                          <button
                            type="button"
                            style={styles.actionButton(
                              '#4299e1'
                            )}
                            title={t.view}
                          >
                            👁️
                          </button>
                        </Link>

                        {/* EDIT */}
                        <Link
                          to={`/assets/${asset.id}/edit`}
                        >
                          <button
                            type="button"
                            style={styles.actionButton(
                              '#ed8936'
                            )}
                            title={t.edit}
                          >
                            ✏️
                          </button>
                        </Link>

                        {/* ASSIGN */}
                        <button
                          type="button"
                          style={styles.actionButton(
                            '#48bb78'
                          )}
                          title={t.assign}
                          onClick={() =>
                            openAssignModal(asset)
                          }
                        >
                          📋
                        </button>

                        {/* TRANSFER */}
                        <button
                          type="button"
                          style={styles.actionButton(
                            '#805ad5'
                          )}
                          title={t.transfer}
                          onClick={() =>
                            openTransferModal(
                              asset
                            )
                          }
                        >
                          🔄
                        </button>

                        {/* RFID / QR */}
                        <button
                          type="button"
                          style={styles.actionButton(
                            '#9f7aea'
                          )}
                          title={t.qrCode}
                          onClick={() =>
                            handleGenerateQR(
                              asset.id
                            )
                          }
                        >
                          📱
                        </button>

                        {/* HISTORY */}
                        <button
                          type="button"
                          style={styles.actionButton(
                            '#3182ce'
                          )}
                          title={t.history}
                          onClick={() =>
                            fetchAssetHistory(
                              asset
                            )
                          }
                        >
                          📜
                        </button>

                        {/* DELETE */}
                        <button
                          type="button"
                          style={styles.actionButton(
                            '#e53e3e'
                          )}
                          title={t.delete}
                          onClick={() =>
                            handleDelete(
                              asset.id
                            )
                          }
                          disabled={actionLoading}
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ==================================================
              PAGINATION
          =================================================== */}

          {totalPages > 1 && (
            <div style={styles.pagination}>
              <span
                style={{
                  color: isDark
                    ? '#8896b0'
                    : '#4a5568',
                  fontSize: '0.82rem'
                }}
              >
                {t.showing} {assets.length}{' '}
                {t.of} {totalItems}
              </span>

              <button
                type="button"
                style={styles.pageButton(false)}
                disabled={currentPage === 1}
                onClick={() =>
                  setCurrentPage(page =>
                    Math.max(1, page - 1)
                  )
                }
              >
                {t.previous}
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

                  if (totalPages <= 7) {
                    page = index + 1;
                  } else if (
                    currentPage <= 4
                  ) {
                    page = index + 1;
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
                        page === currentPage
                      )}
                      onClick={() =>
                        setCurrentPage(page)
                      }
                    >
                      {page}
                    </button>
                  );
                }
              )}

              <button
                type="button"
                style={styles.pageButton(false)}
                disabled={
                  currentPage === totalPages
                }
                onClick={() =>
                  setCurrentPage(page =>
                    Math.min(
                      totalPages,
                      page + 1
                    )
                  )
                }
              >
                {t.next}
              </button>
            </div>
          )}

          {loading && (
            <div
              style={{
                textAlign: 'center',
                padding: '12px',
                color: isDark
                  ? '#8896b0'
                  : '#4a5568'
              }}
            >
              ⏳ {t.loading}
            </div>
          )}
        </>
      )}

      {/* ======================================================
          ASSIGN MODAL
      ======================================================= */}

      {showAssignModal && selectedAsset && (
        <div
          style={styles.modalOverlay}
          onClick={closeAssignModal}
        >
          <div
            style={styles.modal}
            onClick={event =>
              event.stopPropagation()
            }
          >
            <h2 style={styles.modalTitle}>
              📋 {t.assignAsset} —{' '}
              {selectedAsset.name}
            </h2>

            <div style={styles.formGroup}>
              <label style={styles.label}>
                {t.department}
              </label>

              <select
                style={styles.formInput}
                value={
                  assignData.department_id
                }
                onChange={event =>
                  setAssignData(prev => ({
                    ...prev,
                    department_id:
                      event.target.value
                  }))
                }
              >
                <option value="">
                  {t.selectDepartment}
                </option>

                {departments.map(
                  department => (
                    <option
                      key={department.id}
                      value={
                        department.id ||
                        department.name
                      }
                    >
                      {department.name}
                    </option>
                  )
                )}
              </select>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>
                {t.assignTo} *
              </label>

              <select
                style={styles.formInput}
                value={assignData.user_id}
                onChange={event =>
                  setAssignData(prev => ({
                    ...prev,
                    user_id:
                      event.target.value
                  }))
                }
              >
                <option value="">
                  {t.selectUser}
                </option>

                {users.map(user => (
                  <option
                    key={user.id}
                    value={user.id}
                  >
                    {user.full_name ||
                      user.fullName ||
                      user.username ||
                      user.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>
                {t.location}
              </label>

              <input
                type="text"
                style={styles.formInput}
                placeholder={
                  t.enterLocation
                }
                value={assignData.location}
                onChange={event =>
                  setAssignData(prev => ({
                    ...prev,
                    location:
                      event.target.value
                  }))
                }
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>
                {t.reason}
              </label>

              <input
                type="text"
                style={styles.formInput}
                placeholder={
                  t.enterReason
                }
                value={assignData.reason}
                onChange={event =>
                  setAssignData(prev => ({
                    ...prev,
                    reason:
                      event.target.value
                  }))
                }
              />
            </div>

            <div style={styles.modalActions}>
              <button
                type="button"
                style={styles.button(
                  '#718096'
                )}
                onClick={closeAssignModal}
                disabled={actionLoading}
              >
                {t.cancel}
              </button>

              <button
                type="button"
                style={styles.button(
                  '#38a169'
                )}
                onClick={handleAssign}
                disabled={actionLoading}
              >
                {actionLoading
                  ? `⏳ ${t.processing}`
                  : `✓ ${t.confirmAssign}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================
          TRANSFER MODAL
      ======================================================= */}

      {showTransferModal &&
        selectedAsset && (
          <div
            style={styles.modalOverlay}
            onClick={closeTransferModal}
          >
            <div
              style={styles.modal}
              onClick={event =>
                event.stopPropagation()
              }
            >
              <h2 style={styles.modalTitle}>
                🔄 {t.transferAsset} —{' '}
                {selectedAsset.name}
              </h2>

              <div style={styles.formGroup}>
                <label style={styles.label}>
                  {t.currentDepartment}
                </label>

                <input
                  style={styles.formInput}
                  value={
                    selectedAsset.department_name ||
                    selectedAsset.department ||
                    '-'
                  }
                  disabled
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>
                  {t.newDepartment} *
                </label>

                <select
                  style={styles.formInput}
                  value={
                    transferData.department_id
                  }
                  onChange={event =>
                    setTransferData(prev => ({
                      ...prev,
                      department_id:
                        event.target.value
                    }))
                  }
                >
                  <option value="">
                    {t.selectDepartment}
                  </option>

                  {departments.map(
                    department => (
                      <option
                        key={department.id}
                        value={
                          department.id
                        }
                      >
                        {department.name}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>
                  {t.assignTo}
                </label>

                <select
                  style={styles.formInput}
                  value={
                    transferData.user_id
                  }
                  onChange={event =>
                    setTransferData(prev => ({
                      ...prev,
                      user_id:
                        event.target.value
                    }))
                  }
                >
                  <option value="">
                    {t.selectUser}
                  </option>

                  {users.map(user => (
                    <option
                      key={user.id}
                      value={user.id}
                    >
                      {user.full_name ||
                        user.fullName ||
                        user.username ||
                        user.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>
                  {t.newLocation}
                </label>

                <input
                  type="text"
                  style={styles.formInput}
                  placeholder={
                    t.enterNewLocation
                  }
                  value={
                    transferData.location
                  }
                  onChange={event =>
                    setTransferData(prev => ({
                      ...prev,
                      location:
                        event.target.value
                    }))
                  }
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>
                  {t.reason}
                </label>

                <input
                  type="text"
                  style={styles.formInput}
                  placeholder={
                    t.enterReason
                  }
                  value={
                    transferData.reason
                  }
                  onChange={event =>
                    setTransferData(prev => ({
                      ...prev,
                      reason:
                        event.target.value
                    }))
                  }
                />
              </div>

              <div style={styles.modalActions}>
                <button
                  type="button"
                  style={styles.button(
                    '#718096'
                  )}
                  onClick={
                    closeTransferModal
                  }
                  disabled={actionLoading}
                >
                  {t.cancel}
                </button>

                <button
                  type="button"
                  style={styles.button(
                    '#805ad5'
                  )}
                  onClick={handleTransfer}
                  disabled={actionLoading}
                >
                  {actionLoading
                    ? `⏳ ${t.processing}`
                    : `✓ ${t.confirmTransfer}`}
                </button>
              </div>
            </div>
          </div>
        )}

      {/* ======================================================
          HISTORY MODAL
      ======================================================= */}

      {showHistoryModal && (
        <div
          style={styles.modalOverlay}
          onClick={closeHistoryModal}
        >
          <div
            style={{
              ...styles.modal,
              maxWidth: '650px'
            }}
            onClick={event =>
              event.stopPropagation()
            }
          >
            <h2 style={styles.modalTitle}>
              📜 {t.assetHistory} —{' '}
              {selectedAsset?.name || ''}
            </h2>

            {historyData.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '30px 10px',
                  color: isDark
                    ? '#8896b0'
                    : '#4a5568'
                }}
              >
                <div
                  style={{
                    fontSize: '2rem'
                  }}
                >
                  📭
                </div>

                <p>{t.noHistory}</p>
              </div>
            ) : (
              <div style={styles.historyTimeline}>
                {historyData.map(
                  (item, index) => (
                    <div
                      key={
                        item.id ||
                        `${item.created_at}-${index}`
                      }
                      style={
                        styles.historyItem
                      }
                    >
                      <span
                        style={
                          styles.historyIcon
                        }
                      >
                        {getHistoryIcon(
                          item.type
                        )}
                      </span>

                      <div
                        style={
                          styles.historyContent
                        }
                      >
                        <div
                          style={
                            styles.historyTitle
                          }
                        >
                          {item.description ||
                            item.type ||
                            t.updated}

                          {item.details && (
                            <span
                              style={{
                                ...styles.chip,
                                marginLeft:
                                  '8px'
                              }}
                            >
                              {item.details}
                            </span>
                          )}
                        </div>

                        <div
                          style={
                            styles.historyMeta
                          }
                        >
                          {item.user_name ||
                            item.userName ||
                            'System'}

                          {' • '}

                          {item.created_at
                            ? new Date(
                                item.created_at
                              ).toLocaleString()
                            : '-'}
                        </div>
                      </div>
                    </div>
                  )
                )}
              </div>
            )}

            <div style={styles.modalActions}>
              <button
                type="button"
                style={styles.button(
                  '#718096'
                )}
                onClick={closeHistoryModal}
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
// STATUS HELPERS
// ============================================================

const getStatusColor = status => {
  const normalized = String(
    status || ''
  )
    .trim()
    .toLowerCase()
    .replace(/[_ ]/g, '-');

  const colors = {
    active: '#48bb78',
    'in-use': '#48bb78',
    available: '#4299e1',
    'under-maintenance': '#ed8936',
    maintenance: '#ed8936',
    disposed: '#fc8181',
    lost: '#fc8181',
    missing: '#fc8181',
    reserved: '#805ad5',
    pending: '#f6ad55',
    assigned: '#805ad5',
    retired: '#718096',
    received: '#38a169',
    purchased: '#3182ce',
    returned: '#4299e1',
    damaged: '#c53030'
  };

  return colors[normalized] || '#a0aec0';
};

const getConditionColor = condition => {
  const normalized = String(
    condition || ''
  )
    .trim()
    .toLowerCase();

  const colors = {
    excellent: '#48bb78',
    good: '#4299e1',
    fair: '#ed8936',
    poor: '#fc8181',
    damaged: '#c53030'
  };

  return colors[normalized] || '#a0aec0';
};

// ============================================================
// HISTORY ICONS
// ============================================================

const getHistoryIcon = type => {
  const icons = {
    created: '➕',
    purchased: '🛒',
    received: '📥',
    assigned: '📋',
    transferred: '🔄',
    maintained: '🔧',
    maintenance: '🔧',
    returned: '↩️',
    lost: '❌',
    damaged: '⚠️',
    retired: '🗄️',
    disposed: '🗑️',
    updated: '✏️'
  };

  return icons[
    String(type || '').toLowerCase()
  ] || '📌';
};

// ============================================================
// ENGLISH
// ============================================================

const englishTranslations = {
  assets: 'Assets',
  assetSummary: 'Asset Summary',

  totalAssets: 'Total Assets',
  assigned: 'Assigned',
  retired: 'Retired',
  available: 'Available',
  underMaintenance: 'Under Maintenance',
  damaged: 'Damaged',
  lost: 'Lost',

  createAsset: 'Create Asset',
  categories: 'Categories',
  locations: 'Locations',
  lifecycle: 'Asset Lifecycle',
  disposalRetirement: 'Disposal / Retirement',
  documents: 'Documents',

  searchPlaceholder:
    'Search by name, tag, code, or serial...',
  allStatus: 'All Status',
  allDepartments: 'All Departments',
  allCategories: 'All Categories',
  allConditions: 'All Conditions',

  active: 'Active',
  inUse: 'In-Use',
  disposed: 'Disposed',
  reserved: 'Reserved',

  excellent: 'Excellent',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',

  search: 'Search',
  resetFilters: 'Reset Filters',
  assetTag: 'Asset Tag',
  name: 'Name',
  category: 'Category',
  department: 'Department',
  status: 'Status',
  condition: 'Condition',
  location: 'Location',
  locationFilter:
    'Filter by location...',
  value: 'Value',
  assignedTo: 'Assigned To',
  rfidTag: 'RFID Tag',
  actions: 'Actions',

  loading: 'Loading...',
  loadingAssets:
    'Please wait while the asset inventory is loaded.',
  processing: 'Processing...',

  noAssets: 'No Assets Found',
  tryFilters:
    'Try changing your search or filters.',
  loadError: 'Unable to Load Assets',
  loadErrorDesc:
    "We couldn't retrieve the asset inventory.",
  retry: 'Retry',

  previous: 'Previous',
  next: 'Next',
  showing: 'Showing',
  of: 'of',

  selectAll: 'Select all assets',
  deleteSelected: 'Delete Selected',

  totalAssetsCount: 'Total: {count} assets',

  view: 'View',
  edit: 'Edit',
  assign: 'Assign',
  transfer: 'Transfer',
  delete: 'Delete',
  qrCode: 'RFID / QR',
  history: 'History',

  assignAsset: 'Assign Asset',
  transferAsset: 'Transfer Asset',
  assetHistory: 'Asset History',

  currentDepartment: 'Current Department',
  newDepartment: 'New Department',
  newLocation: 'New Location',

  assignTo: 'Assign To',
  selectDepartment: 'Select Department',
  selectUser: 'Select User',

  enterLocation: 'Enter location',
  enterNewLocation: 'Enter new location',
  enterReason: 'Enter reason',

  confirmAssign: 'Confirm Assignment',
  confirmTransfer: 'Confirm Transfer',

  cancel: 'Cancel',
  close: 'Close',
  reason: 'Reason',
  noHistory: 'No history records found',
  historyLoadFailed:
    'Failed to load asset history.',

  sortByName: 'Sort by Name',
  sortByDate: 'Sort by Date',
  sortByValue: 'Sort by Value',
  sortByStatus: 'Sort by Status',
  ascending: 'Ascending',
  descending: 'Descending',

  confirmDelete:
    'Are you sure you want to delete this asset?',
  confirmBulkDelete:
    'Are you sure you want to delete {count} assets?',

  assetDeleted:
    'Asset deleted successfully',
  deleteFailed:
    'Failed to delete asset',

  bulkDeleteSuccess:
    '{count} assets deleted successfully',

  assignSuccess:
    'Asset assigned successfully',
  assignFailed:
    'Failed to assign asset',

  transferSuccess:
    'Asset transferred successfully',
  transferFailed:
    'Failed to transfer asset',

  updated: 'Updated',

  qrGenerated:
    'QR Code generated successfully',
  qrFailed:
    'Failed to generate QR Code'
};

// ============================================================
// AMHARIC
// ============================================================

const amharicTranslations = {
  assets: 'ንብረቶች',
  assetSummary: 'የንብረት ማጠቃለያ',

  totalAssets: 'ጠቅላላ ንብረቶች',
  assigned: 'የተመደቡ',
  retired: 'የተሰናበቱ',
  available: 'ይገኛል',
  underMaintenance: 'በጥገና ላይ',
  damaged: 'ተበላሽቷል',
  lost: 'ጠፍቷል',

  createAsset: 'አዲስ ንብረት ፍጠር',
  categories: 'የንብረት ምድቦች',
  locations: 'የንብረት ቦታዎች',
  lifecycle: 'የንብረት የሕይወት ዑደት',
  disposalRetirement:
    'ማስወገድ / ማሰናበት',
  documents: 'ሰነዶች',

  searchPlaceholder:
    'በስም፣ መለያ፣ ኮድ ወይም ተከታታይ ቁጥር ይፈልጉ...',
  allStatus: 'ሁሉም ሁኔታዎች',
  allDepartments: 'ሁሉም ክፍሎች',
  allCategories: 'ሁሉም ምድቦች',
  allConditions: 'ሁሉም ሁኔታዎች',

  active: 'ንቁ',
  inUse: 'በመጠቀም ላይ',
  disposed: 'ተወግዷል',
  reserved: 'ተጠብቋል',

  excellent: 'እጅግ ጥሩ',
  good: 'ጥሩ',
  fair: 'መጠነኛ',
  poor: 'ደካማ',

  search: 'ፈልግ',
  resetFilters: 'ማጣሪያ ዳግም አስጀምር',

  assetTag: 'የንብረት መለያ',
  name: 'ስም',
  category: 'ምድብ',
  department: 'ክፍል',
  status: 'ሁኔታ',
  condition: 'ሁኔታ',
  location: 'ቦታ',
  locationFilter: 'በቦታ ይፈልጉ...',
  value: 'ዋጋ',
  assignedTo: 'የተመደበለት',
  rfidTag: 'RFID መለያ',
  actions: 'ተግባራት',

  loading: 'በመጫን ላይ...',
  loadingAssets:
    'የንብረት ዝርዝሩ በመጫን ላይ ነው።',
  processing: 'በማስኬድ ላይ...',

  noAssets: 'ምንም ንብረት አልተገኘም',
  tryFilters:
    'ፍለጋዎን ወይም ማጣሪያዎን ለመቀየር ይሞክሩ።',

  loadError: 'ንብረቶችን መጫን አልተቻለም',
  loadErrorDesc:
    'የንብረት ዝርዝሩን ማግኘት አልቻልንም።',
  retry: 'እንደገና ሞክር',

  previous: 'ቀዳሚ',
  next: 'ቀጣይ',
  showing: 'እያሳየ',
  of: 'ከ',

  selectAll: 'ሁሉንም ንብረቶች ምረጥ',
  deleteSelected: 'የተመረጡትን ሰርዝ',

  totalAssetsCount:
    'ጠቅላላ፡ {count} ንብረቶች',

  view: 'እይ',
  edit: 'አርትዕ',
  assign: 'መድብ',
  transfer: 'አዛውር',
  delete: 'ሰርዝ',
  qrCode: 'RFID / QR',
  history: 'ታሪክ',

  assignAsset: 'ንብረት መድብ',
  transferAsset: 'ንብረት አዛውር',
  assetHistory: 'የንብረት ታሪክ',

  currentDepartment: 'አሁን ያለበት ክፍል',
  newDepartment: 'አዲስ ክፍል',
  newLocation: 'አዲስ ቦታ',

  assignTo: 'ለማን ይመደብ',
  selectDepartment: 'ክፍል ይምረጡ',
  selectUser: 'ተጠቃሚ ይምረጡ',

  enterLocation: 'ቦታ ያስገቡ',
  enterNewLocation: 'አዲስ ቦታ ያስገቡ',
  enterReason: 'ምክንያት ያስገቡ',

  confirmAssign: 'ምደባ አረጋግጥ',
  confirmTransfer: 'ማዛወር አረጋግጥ',

  cancel: 'ሰርዝ',
  close: 'ዝጋ',
  reason: 'ምክንያት',

  noHistory:
    'ምንም የታሪክ መዝገቦች አልተገኙም',

  historyLoadFailed:
    'የንብረት ታሪክን መጫን አልተቻለም።',

  sortByName: 'በስም ደርድር',
  sortByDate: 'በቀን ደርድር',
  sortByValue: 'በዋጋ ደርድር',
  sortByStatus: 'በሁኔታ ደርድር',

  ascending: 'ቅደም ተከተል',
  descending: 'ተቃራኒ ቅደም ተከተል',

  confirmDelete:
    'ይህንን ንብረት መሰረዝ እርግጠኛ ነዎት?',

  confirmBulkDelete:
    '{count} ንብረቶችን መሰረዝ እርግጠኛ ነዎት?',

  assetDeleted:
    'ንብረቱ በተሳካ ሁኔታ ተሰርዟል',

  deleteFailed:
    'ንብረቱን መሰረዝ አልተቻለም',

  bulkDeleteSuccess:
    '{count} ንብረቶች በተሳካ ሁኔታ ተሰርዘዋል',

  assignSuccess:
    'ንብረቱ በተሳካ ሁኔታ ተመድቧል',

  assignFailed:
    'ንብረቱን መመደብ አልተቻለም',

  transferSuccess:
    'ንብረቱ በተሳካ ሁኔታ ተዛውሯል',

  transferFailed:
    'ንብረቱን ማዛወር አልተቻለም',

  updated: 'ተሻሽሏል',

  qrGenerated:
    'QR ኮድ በተሳካ ሁኔታ ተፈጥሯል',

  qrFailed:
    'QR ኮድ መፍጠር አልተቻለም'
};

export default AdminAssets;