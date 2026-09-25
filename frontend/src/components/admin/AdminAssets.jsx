import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Archive,
  ArrowRightLeft,
  Boxes,
  CheckCircle2,
  Eye,
  FileText,
  History,
  MapPin,
  MoreHorizontal,
  Package,
  Pencil,
  Plus,
  Radio,
  RotateCcw,
  Search,
  Tags,
  Trash2,
  UserCheck,
  Wrench,
  Workflow,
  XCircle
} from 'lucide-react';
import { useLanguage } from '../../contexts/UiContext';
import { toast } from 'react-toastify';
import { apiClient as axios } from '../../utils/api';

const AdminAssets = () => {
  const { language, theme } = useLanguage();
  const navigate = useNavigate();

  const isDark = theme === 'dark';
  const t = language === 'en' ? englishTranslations : amharicTranslations;

  const formatCurrency = (value, currency = 'ETB') => {
    const amount = Number(value ?? 0);

    if (!Number.isFinite(amount)) {
      return `${currency} 0.00`;
    }

    return `${currency} ${amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  const getDisplayStatus = rawStatus => {
    const normalized = String(rawStatus || '')
      .trim()
      .replace(/[_-]+/g, ' ')
      .toLowerCase();

    const labelMap = {
      available: 'Available',
      active: 'Active',
      'in use': 'In Use',
      'in-use': 'In Use',
      assigned: 'Assigned',
      'under maintenance': 'Under Maintenance',
      maintenance: 'Under Maintenance',
      'in maintenance': 'Under Maintenance',
      lost: 'Lost',
      missing: 'Lost',
      disposed: 'Disposed',
      retired: 'Retired',
      reserved: 'Reserved',
      damaged: 'Damaged',
      pending: 'Pending'
    };

    return labelMap[normalized] || rawStatus || 'Available';
  };

  const getConditionLabel = rawCondition => {
    const normalized = String(rawCondition || '')
      .trim()
      .toLowerCase();

    const labelMap = {
      excellent: 'Excellent',
      good: 'Good',
      fair: 'Fair',
      poor: 'Poor',
      damaged: 'Damaged'
    };

    return labelMap[normalized] || rawCondition || 'Good';
  };

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
  const [actionMenuId, setActionMenuId] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);

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

      const response = await axios.get('/api/admin/assets', { params });

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

      const rows = Array.isArray(response.data?.items)
        ? response.data.items
        : Array.isArray(response.data?.categories)
          ? response.data.categories
          : Array.isArray(response.data?.data)
            ? response.data.data
            : Array.isArray(response.data)
              ? response.data
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
    const asset = assets.find(item => item.id === id);
    const assetLabel =
      asset?.asset_tag ||
      asset?.asset_code ||
      asset?.name ||
      `Asset #${id}`;

    setConfirmDialog({
      title: 'Delete Asset',
      subtitle: 'This action cannot be undone.',
      assetLabel,
      confirmText: 'Delete Asset',
      danger: true,
      onConfirm: async () => {
        setActionLoading(true);

        try {
          await axios.delete(`/api/assets/${id}`);

          toast.success(t.assetDeleted);

          setSelectedAssets(prev =>
            prev.filter(assetId => assetId !== id)
          );

          setConfirmDialog(null);
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
      }
    });
  };

  const handleBulkDelete = async () => {
    if (selectedAssets.length === 0) {
      return;
    }

    setConfirmDialog({
      title: 'Delete selected assets',
      subtitle: `This will permanently remove ${selectedAssets.length} asset(s).`,
      assetLabel: `${selectedAssets.length} selected assets`,
      confirmText: 'Delete Selected',
      danger: true,
      onConfirm: async () => {
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
          setConfirmDialog(null);
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
      }
    });
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
      label: t.categories,
      description: 'Manage asset types',
      icon: Tags,
      path: '/admin/assets/categories'
    },
    {
      label: t.locations,
      description: 'Track facilities',
      icon: MapPin,
      path: '/admin/assets/locations'
    },
    {
      label: t.lifecycle,
      description: 'Lifecycle history',
      icon: Workflow,
      path: '/admin/assets/lifecycle'
    },
    {
      label: t.disposalRetirement,
      description: 'Retire assets',
      icon: Trash2,
      path: '/admin/assets/disposal'
    },
    {
      label: t.documents,
      description: 'Support files',
      icon: FileText,
      path: '/admin/assets/documents'
    },
    {
      label: t.createAsset,
      description: 'Register new asset',
      icon: Plus,
      path: '/admin/assets/create'
    }
  ];

  // ============================================================
  // LOADING / ERROR
  // ============================================================

  if (loading && assets.length === 0) {
    return (
      <div style={styles.container}>
        <div
          style={{
            display: 'grid',
            gap: '16px'
          }}
        >
          <div
            style={{
              ...styles.header,
              padding: '28px 24px',
              background: isDark ? '#1b2a3b' : '#fff',
              border: `1px solid ${isDark ? '#314866' : '#e5edf9'}`,
              borderRadius: '18px',
              boxShadow: isDark ? '0 8px 18px rgba(0,0,0,0.2)' : '0 8px 18px rgba(15, 23, 42, 0.06)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '52px', height: '52px', borderRadius: '12px', background: 'linear-gradient(135deg, #2563eb, #60a5fa)', opacity: 0.9 }} />
              <div style={{ display: 'grid', gap: '8px' }}>
                <div style={{ width: '140px', height: '10px', borderRadius: '999px', background: isDark ? '#2b3d59' : '#e2e8f0' }} />
                <div style={{ width: '220px', height: '12px', borderRadius: '999px', background: isDark ? '#2b3d59' : '#e2e8f0' }} />
              </div>
            </div>
            <div style={{ width: '160px', height: '42px', borderRadius: '10px', background: isDark ? '#2b3d59' : '#e2e8f0' }} />
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '12px'
            }}
          >
            {Array.from({ length: 7 }).map((_, index) => (
              <div
                key={index}
                style={{
                  height: '110px',
                  borderRadius: '14px',
                  background: isDark ? '#1b2a3b' : '#fff',
                  border: `1px solid ${isDark ? '#314866' : '#e5edf9'}`,
                  padding: '16px'
                }}
              >
                <div style={{ width: '24px', height: '24px', borderRadius: '8px', background: isDark ? '#2b3d59' : '#e2e8f0', marginBottom: '12px' }} />
                <div style={{ width: '70%', height: '12px', borderRadius: '999px', background: isDark ? '#2b3d59' : '#e2e8f0', marginBottom: '10px' }} />
                <div style={{ width: '55%', height: '20px', borderRadius: '999px', background: isDark ? '#2b3d59' : '#e2e8f0' }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (loadError && assets.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.emptyState}>
          <div style={{ fontSize: '3rem', marginBottom: '12px' }}>
            <Package size={48} />
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
            style={{ ...styles.button('#2b6cb0'), display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            onClick={fetchAssets}
          >
            <RotateCcw size={16} /> {t.retry}
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
      <div style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #2563eb, #60a5fa)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: '0 10px 20px rgba(37, 99, 235, 0.20)'
            }}
          >
            <Package size={24} />
          </div>

          <div>
            <div
              style={{
                color: '#2563eb',
                fontSize: '0.72rem',
                fontWeight: 800,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                marginBottom: '4px'
              }}
            >
              Assets
            </div>

            <h1 style={styles.title}>Assets</h1>
            <p style={styles.subtitle}>Manage and monitor all university assets</p>
            <p
              style={{
                margin: '8px 0 0',
                color: isDark ? '#9fb0c5' : '#64748b',
                fontSize: '0.85rem',
                fontWeight: 600
              }}
            >
              {totalItems} total assets
            </p>
          </div>
        </div>

        <div style={styles.headerActions}>
          {selectedAssets.length > 0 && (
            <button
              type="button"
              style={{ ...styles.button('#e53e3e'), display: 'inline-flex', alignItems: 'center', gap: '8px' }}
              onClick={handleBulkDelete}
              disabled={actionLoading}
            >
              <Trash2 size={16} />
              {t.deleteSelected} ({selectedAssets.length})
            </button>
          )}

          <button
            type="button"
            style={{ ...styles.button('linear-gradient(135deg, #1e293b, #334155)'), display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            onClick={() => navigate('/admin/assets/create')}
          >
            <Plus size={16} /> {t.createAsset}
          </button>
        </div>
      </div>

      <div style={styles.managementGrid}>
        {managementLinks.map(item => {
          const Icon = item.icon;

          return (
            <Link
              key={item.path}
              to={item.path}
              style={styles.managementCard}
            >
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '12px',
                  background: 'rgba(37,99,235,0.08)',
                  color: '#2563eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <Icon size={18} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontWeight: 700 }}>{item.label}</span>
                <span style={{ fontSize: '0.72rem', color: isDark ? '#9fb0c5' : '#64748b' }}>{item.description}</span>
              </div>
            </Link>
          );
        })}
      </div>

      <div style={styles.summaryGrid} aria-label={t.assetSummary}>
        {[
          [t.totalAssets, summary.total, Boxes, '#2563eb', ''],
          [t.available, summary.available, CheckCircle2, '#16a34a', 'available'],
          [t.assigned, summary.assigned, UserCheck, '#7c3aed', 'assigned'],
          [t.underMaintenance, summary.maintenance, Wrench, '#f59e0b', 'under-maintenance'],
          [t.damaged, summary.damaged, AlertTriangle, '#dc2626', 'damaged'],
          [t.lost, summary.missing, XCircle, '#b91c1c', 'lost'],
          [t.retired, summary.retired, Archive, '#64748b', 'retired']
        ].map(([label, value, Icon, color, status]) => (
          <button
            type="button"
            key={label}
            style={styles.summaryCard(color, filterStatus === status)}
            onClick={() => applyStatusFilter(status)}
          >
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: `${color}18`,
                color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '10px'
              }}
            >
              <Icon size={17} />
            </div>

            <div style={styles.summaryValue}>{value}</div>
            <div style={styles.summaryLabel}>{label}</div>
          </button>
        ))}
      </div>

      <form style={styles.controls} onSubmit={handleSearch}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 260px', minWidth: '200px', padding: '0 12px', borderRadius: '10px', border: `1px solid ${isDark ? '#32465f' : '#d0d8e8'}`, background: isDark ? '#0d1b2a' : '#fff' }}>
          <Search size={16} style={{ color: isDark ? '#8aa4c4' : '#64748b' }} />
          <input
            type="text"
            style={{ ...styles.input, minWidth: '0', flex: 1, border: 'none', background: 'transparent', boxShadow: 'none', paddingLeft: 0, paddingRight: 0 }}
            placeholder={t.searchPlaceholder}
            value={search}
            onChange={event => setSearch(event.target.value)}
          />
        </div>

        <select style={styles.select} value={filterStatus} onChange={event => { setFilterStatus(event.target.value); setCurrentPage(1); }}>
          <option value="">{t.allStatus}</option>
          <option value="Active">{t.active}</option>
          <option value="In-Use">{t.inUse}</option>
          <option value="Available">{t.available}</option>
          <option value="Under-Maintenance">{t.underMaintenance}</option>
          <option value="Disposed">{t.disposed}</option>
          <option value="Lost">{t.lost}</option>
          <option value="Reserved">{t.reserved}</option>
        </select>

        <select style={styles.select} value={filterDepartment} onChange={event => { setFilterDepartment(event.target.value); setCurrentPage(1); }}>
          <option value="">{t.allDepartments}</option>
          {departments.map(department => (
            <option key={department.id} value={department.id || department.name}>{department.name}</option>
          ))}
        </select>

        <select style={styles.select} value={filterCategory} onChange={event => { setFilterCategory(event.target.value); setCurrentPage(1); }}>
          <option value="">{t.allCategories}</option>
          {categories.map(category => (
            <option key={category.id} value={category.name || category.id}>{category.name}</option>
          ))}
        </select>

        <select style={styles.select} value={filterCondition} onChange={event => { setFilterCondition(event.target.value); setCurrentPage(1); }}>
          <option value="">{t.allConditions}</option>
          <option value="Excellent">{t.excellent}</option>
          <option value="Good">{t.good}</option>
          <option value="Fair">{t.fair}</option>
          <option value="Poor">{t.poor}</option>
          <option value="Damaged">{t.damaged}</option>
        </select>

        <input
          type="text"
          style={styles.input}
          placeholder={t.locationFilter}
          value={filterLocation}
          onChange={event => { setFilterLocation(event.target.value); setCurrentPage(1); }}
        />

        <select style={styles.select} value={sortBy} onChange={event => { setSortBy(event.target.value); setCurrentPage(1); }}>
          <option value="name">{t.sortByName}</option>
          <option value="created_at">{t.sortByDate}</option>
          <option value="current_value">{t.sortByValue}</option>
          <option value="status">{t.sortByStatus}</option>
        </select>

        <select style={styles.select} value={sortOrder} onChange={event => { setSortOrder(event.target.value); setCurrentPage(1); }}>
          <option value="asc">{t.ascending}</option>
          <option value="desc">{t.descending}</option>
        </select>

        <button type="button" style={{ ...styles.button('transparent'), color: isDark ? '#c8dcf5' : '#334155', background: isDark ? '#0f172a' : '#fff', border: `1px solid ${isDark ? '#32465f' : '#d0d8e8'}`, display: 'inline-flex', alignItems: 'center', gap: '8px' }} onClick={resetFilters}>
          <RotateCcw size={15} /> {t.resetFilters}
        </button>

        <button type="submit" style={{ ...styles.button('linear-gradient(135deg,#2b6cb0,#4299e1)'), display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <Search size={15} /> {t.search}
        </button>
      </form>

      {assets.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={{ fontSize: '3rem', marginBottom: '12px' }}>
            <Boxes size={48} />
          </div>

          <h2 style={{ color: isDark ? '#c8dcf5' : '#1a365d' }}>{t.noAssets}</h2>
          <p>There are no assets matching your current filters.</p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap', marginTop: '18px' }}>
            <button type="button" style={{ ...styles.button('transparent'), color: isDark ? '#c8dcf5' : '#334155', background: isDark ? '#0f172a' : '#fff', border: `1px solid ${isDark ? '#32465f' : '#d0d8e8'}` }} onClick={resetFilters}>
              <RotateCcw size={15} /> Reset Filters
            </button>
            <button type="button" style={{ ...styles.button('linear-gradient(135deg,#2b6cb0,#4299e1)'), display: 'inline-flex', alignItems: 'center', gap: '8px' }} onClick={() => navigate('/admin/assets/create')}>
              <Plus size={15} /> Add Asset
            </button>
          </div>
        </div>
      ) : (
        <>
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>
                    <input type="checkbox" style={styles.checkbox} checked={allCurrentPageSelected} onChange={event => toggleSelectAll(event.target.checked)} aria-label={t.selectAll} />
                  </th>
                  <th style={styles.th}>{t.assetTag}</th>
                  <th style={styles.th}>{t.name}</th>
                  <th style={styles.th}>{t.category}</th>
                  <th style={styles.th}>{t.department}</th>
                  <th style={styles.th}>{t.status}</th>
                  <th style={styles.th}>{t.condition}</th>
                  <th style={styles.th}>{t.location}</th>
                  <th style={styles.th}>{t.value}</th>
                  <th style={styles.th}>{t.assignedTo}</th>
                  <th style={styles.th}>{t.rfidTag}</th>
                  <th style={styles.th}>{t.actions}</th>
                </tr>
              </thead>

              <tbody>
                {assets.map(asset => {
                  const assetCategory = typeof asset.category === 'object' ? asset.category?.name || asset.category?.title || 'Uncategorized' : asset.category || 'Uncategorized';
                  const departmentName = asset.department_name || asset.department || asset.departmentName || asset.department?.name || 'Not assigned';
                  const conditionText = getConditionLabel(asset.condition);
                  const statusText = getDisplayStatus(asset.status);
                  const assetLocation = asset.location || 'Not assigned';
                  const assignedUser = asset.assigned_to_name || asset.assigned_to || asset.assignedTo || 'Not assigned';
                  const rfidValue = asset.rfid_tag || asset.rfidTag || asset.rfid || 'Not registered';
                  const valueText = formatCurrency(asset.current_value ?? asset.currentValue ?? asset.purchase_price ?? asset.purchasePrice ?? asset.purchase_cost ?? asset.purchaseCost ?? 0);
                  const assetName = asset.name || 'Unnamed Asset';
                  const assetCode = asset.asset_tag || asset.asset_code || `ASSET-${asset.id}`;

                  return (
                    <tr key={asset.id}>
                      <td style={styles.td}>
                        <input type="checkbox" style={styles.checkbox} checked={selectedAssets.includes(asset.id)} onChange={event => toggleAssetSelection(asset.id, event.target.checked)} />
                      </td>

                      <td style={styles.td}>
                        <Link to={`/assets/${asset.id}`} style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 700 }}>
                          {assetCode}
                        </Link>
                      </td>

                      <td style={styles.td}>
                        <div style={{ fontWeight: 700 }}>{assetName}</div>
                        <div style={{ color: isDark ? '#8ea7c5' : '#64748b', fontSize: '0.72rem', marginTop: '3px' }}>
                          {asset.serial_number || asset.model || asset.brand || 'No serial model'}
                        </div>
                      </td>

                      <td style={styles.td}>{assetCategory}</td>
                      <td style={styles.td}>{departmentName}</td>
                      <td style={styles.td}><span style={styles.statusBadge(statusText)}>{statusText}</span></td>
                      <td style={styles.td}><span style={styles.conditionBadge(conditionText)}>{conditionText}</span></td>
                      <td style={styles.td}>{assetLocation}</td>
                      <td style={styles.td}>{valueText}</td>
                      <td style={styles.td}>{assignedUser}</td>
                      <td style={styles.td}>{rfidValue}</td>

                      <td style={styles.td}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative', flexWrap: 'wrap' }}>
                          <Link to={`/assets/${asset.id}`} style={{ ...styles.button('linear-gradient(135deg, #3b82f6, #60a5fa)'), textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <Eye size={14} /> {t.view}
                          </Link>

                          <Link to={`/assets/${asset.id}/edit`} style={{ ...styles.button('linear-gradient(135deg, #f59e0b, #fbbf24)'), textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <Pencil size={14} /> {t.edit}
                          </Link>

                          <div style={{ position: 'relative' }}>
                            <button type="button" style={{ ...styles.button('linear-gradient(135deg, #1f2937, #374151)'), display: 'inline-flex', alignItems: 'center', gap: '6px' }} onClick={() => setActionMenuId(actionMenuId === asset.id ? null : asset.id)}>
                              <MoreHorizontal size={14} />
                            </button>

                            {actionMenuId === asset.id && (
                              <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', zIndex: 30, minWidth: '190px', background: isDark ? '#0f172a' : '#fff', border: `1px solid ${isDark ? '#32465f' : '#e5edf9'}`, borderRadius: '12px', boxShadow: isDark ? '0 12px 28px rgba(0,0,0,0.35)' : '0 16px 30px rgba(15,23,42,0.12)', padding: '8px' }}>
                                <button type="button" style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: '8px', background: 'transparent', border: 'none', color: isDark ? '#c8dcf5' : '#1a365d', cursor: 'pointer', fontWeight: 600 }} onClick={() => { setActionMenuId(null); openAssignModal(asset); }}>
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><UserCheck size={14} /> Assign</span>
                                </button>
                                <button type="button" style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: '8px', background: 'transparent', border: 'none', color: isDark ? '#c8dcf5' : '#1a365d', cursor: 'pointer', fontWeight: 600 }} onClick={() => { setActionMenuId(null); openTransferModal(asset); }}>
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><ArrowRightLeft size={14} /> Transfer</span>
                                </button>
                                <button type="button" style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: '8px', background: 'transparent', border: 'none', color: isDark ? '#c8dcf5' : '#1a365d', cursor: 'pointer', fontWeight: 600 }} onClick={() => { setActionMenuId(null); handleGenerateQR(asset.id); }}>
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Radio size={14} /> RFID / QR</span>
                                </button>
                                <button type="button" style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: '8px', background: 'transparent', border: 'none', color: isDark ? '#c8dcf5' : '#1a365d', cursor: 'pointer', fontWeight: 600 }} onClick={() => { setActionMenuId(null); fetchAssetHistory(asset); }}>
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><History size={14} /> History</span>
                                </button>
                                <button type="button" style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: '8px', background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 700 }} onClick={() => { setActionMenuId(null); handleDelete(asset.id); }}>
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Trash2 size={14} /> Delete</span>
                                </button>
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

          {totalPages > 1 && (
            <div style={styles.pagination}>
              <span style={{ color: isDark ? '#8896b0' : '#4a5568', fontSize: '0.82rem' }}>
                {t.showing} {assets.length} {t.of} {totalItems}
              </span>

              <button type="button" style={styles.pageButton(false)} disabled={currentPage === 1} onClick={() => setCurrentPage(page => Math.max(1, page - 1))}>
                {t.previous}
              </button>

              {Array.from({ length: Math.min(totalPages, 7) }, (_, index) => {
                let page;

                if (totalPages <= 7) {
                  page = index + 1;
                } else if (currentPage <= 4) {
                  page = index + 1;
                } else if (currentPage >= totalPages - 3) {
                  page = totalPages - 6 + index;
                } else {
                  page = currentPage - 3 + index;
                }

                return (
                  <button key={page} type="button" style={styles.pageButton(page === currentPage)} onClick={() => setCurrentPage(page)}>
                    {page}
                  </button>
                );
              })}

              <button type="button" style={styles.pageButton(false)} disabled={currentPage === totalPages} onClick={() => setCurrentPage(page => Math.min(totalPages, page + 1))}>
                {t.next}
              </button>
            </div>
          )}

          {loading && (
            <div style={{ textAlign: 'center', padding: '12px', color: isDark ? '#8896b0' : '#4a5568' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}><Search size={14} /> {t.loading}</div>
            </div>
          )}
        </>
      )}

      {confirmDialog && (
        <div style={styles.modalOverlay} onClick={() => setConfirmDialog(null)}>
          <div style={{ ...styles.modal, maxWidth: '480px' }} onClick={event => event.stopPropagation()}>
            <h2 style={{ ...styles.modalTitle, marginBottom: '8px' }}>{confirmDialog.title}</h2>
            <p style={{ margin: '0 0 18px', color: isDark ? '#a7bbd4' : '#52617a', lineHeight: 1.6 }}>{confirmDialog.subtitle}</p>

            <div style={{ padding: '12px 14px', borderRadius: '10px', background: isDark ? '#0d1b2a' : '#f8fafc', border: `1px solid ${isDark ? '#314866' : '#dce7f5'}`, marginBottom: '16px' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b', marginBottom: '6px' }}>Asset</div>
              <div style={{ color: isDark ? '#e2ebf7' : '#0f172a', fontWeight: 600 }}>{confirmDialog.assetLabel}</div>
            </div>

            <div style={styles.modalActions}>
              <button type="button" style={styles.button('#718096')} onClick={() => setConfirmDialog(null)} disabled={actionLoading}>{t.cancel}</button>
              <button type="button" style={styles.button(confirmDialog.danger ? '#dc2626' : '#2b6cb0')} onClick={confirmDialog.onConfirm} disabled={actionLoading}>
                {confirmDialog.confirmText}
              </button>
            </div>
          </div>
        </div>
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