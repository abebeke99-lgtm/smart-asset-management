import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLanguage } from '../../contexts/UiContext';
import { toast } from 'react-toastify';
import axios from 'axios';

const AdminMaintenance = () => {
  const { language, theme } = useLanguage();
  const isDark = theme === 'dark';

  const t = language === 'en' ? englishTranslations : amharicTranslations;

  // ============================================================
  // STATE
  // ============================================================

  const [requests, setRequests] = useState([]);
  const [scheduledMaintenance, setScheduledMaintenance] = useState([]);
  const [maintenanceHistory, setMaintenanceHistory] = useState([]);
  const [assets, setAssets] = useState([]);
  const [technicians, setTechnicians] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [viewMode, setViewMode] = useState('requests');

  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [search, setSearch] = useState('');
  const [historyFilter, setHistoryFilter] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [showScheduledCreate, setShowScheduledCreate] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showCostModal, setShowCostModal] = useState(false);

  const [selectedAsset, setSelectedAsset] = useState(null);
  const [selectedMaintenance, setSelectedMaintenance] = useState(null);

  const [completionMap, setCompletionMap] = useState({});

  const [formData, setFormData] = useState({
    asset_id: '',
    type: 'Corrective',
    priority: 'Medium',
    title: '',
    description: '',
    scheduled_date: '',
    estimated_cost: '',
    technician_id: '',
    due_date: ''
  });

  const [scheduledFormData, setScheduledFormData] = useState({
    asset_id: '',
    maintenance_type: 'Preventive',
    technician_id: '',
    scheduled_date: '',
    expected_completion: '',
    priority: 'Medium',
    notes: '',
    recurring: false,
    interval_days: 30
  });

  // ============================================================
  // HELPERS
  // ============================================================

  const safeText = (value, fallback = '-') => {
    if (
      value === null ||
      value === undefined ||
      value === ''
    ) {
      return fallback;
    }

    return String(value);
  };

  const formatDate = (value) => {
    if (!value) return '-';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return '-';
    }

    return date.toLocaleDateString();
  };

  const formatCurrency = (value) => {
    const amount = Number(value);

    if (!Number.isFinite(amount)) {
      return '$0.00';
    }

    return `$${amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  const numberValue = (value) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  };

  const normalizeStatusValue = (value) => {
    const raw = String(value || 'Pending').trim();

    const normalized = raw
      .toLowerCase()
      .replace(/\s+/g, '-');

    const lookup = {
      pending: 'Pending',
      approved: 'Approved',
      assigned: 'Assigned',
      'in-progress': 'In Progress',
      'waiting-for-parts': 'Waiting for Parts',
      completed: 'Completed',
      rejected: 'Rejected',
      cancelled: 'Cancelled'
    };

    return lookup[normalized] || raw;
  };

  const normalizePriorityValue = (value) => {
    const raw = String(value || 'Medium').trim();
    const normalized = raw.toLowerCase();

    const lookup = {
      low: 'Low',
      medium: 'Medium',
      high: 'High',
      critical: 'Critical'
    };

    return lookup[normalized] || raw;
  };

  const getStatusColor = (status) => {
    const normalized = normalizeStatusValue(status);

    const colors = {
      Pending: '#ed8936',
      Approved: '#4299e1',
      Assigned: '#805ad5',
      'In Progress': '#48bb78',
      Completed: '#38a169',
      Cancelled: '#fc8181',
      Rejected: '#e53e3e',
      'Waiting for Parts': '#d69e2e'
    };

    return colors[normalized] || '#a0aec0';
  };

  const getPriorityColor = (priority) => {
    const normalized = normalizePriorityValue(priority);

    const colors = {
      Low: '#48bb78',
      Medium: '#4299e1',
      High: '#ed8936',
      Critical: '#e53e3e'
    };

    return colors[normalized] || '#a0aec0';
  };

  const getStatusIcon = (status) => {
    const normalized = normalizeStatusValue(status);

    const icons = {
      Pending: '⏳',
      Approved: '✅',
      Assigned: '👤',
      'In Progress': '🔄',
      Completed: '✔️',
      Cancelled: '❌',
      Rejected: '🚫',
      'Waiting for Parts': '🧩'
    };

    return icons[normalized] || '📌';
  };

  // ============================================================
  // FETCH DATA
  // ============================================================

  const fetchAllData = useCallback(async () => {
    setLoading(true);

    try {
      const params = {};

      if (filterStatus) {
        params.status = filterStatus;
      }

      if (filterPriority) {
        params.priority = filterPriority;
      }

      const [
        requestsRes,
        scheduledRes,
        historyRes,
        assetsRes,
        techsRes
      ] = await Promise.all([
        axios.get('/api/maintenance', { params }),

        axios.get('/api/maintenance/scheduled', {
          params
        }),

        axios.get('/api/maintenance/history', {
          params: {
            search: historyFilter || undefined
          }
        }),

        axios.get('/api/assets'),

        axios.get('/api/users', {
          params: {
            role: 'technician'
          }
        })
      ]);

      const extractArray = (response, keys = []) => {
        for (const key of keys) {
          if (Array.isArray(response?.data?.[key])) {
            return response.data[key];
          }
        }

        if (Array.isArray(response?.data)) {
          return response.data;
        }

        return [];
      };

      setRequests(
        extractArray(requestsRes, [
          'requests',
          'maintenance',
          'data'
        ])
      );

      setScheduledMaintenance(
        extractArray(scheduledRes, [
          'requests',
          'scheduled',
          'maintenance',
          'data'
        ])
      );

      setMaintenanceHistory(
        extractArray(historyRes, [
          'history',
          'requests',
          'maintenance',
          'data'
        ])
      );

      setAssets(
        extractArray(assetsRes, [
          'assets',
          'data'
        ])
      );

      setTechnicians(
        extractArray(techsRes, [
          'users',
          'technicians',
          'data'
        ])
      );
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        t.loadFailed;

      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [
    filterStatus,
    filterPriority,
    historyFilter,
    t.loadFailed
  ]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // ============================================================
  // CREATE REQUEST
  // ============================================================

  const handleCreate = async (event) => {
    event.preventDefault();

    if (!formData.asset_id) {
      toast.error(t.selectAsset);
      return;
    }

    if (!formData.title.trim()) {
      toast.error(t.titleRequired);
      return;
    }

    setSaving(true);

    try {
      const payload = {
        asset_id: formData.asset_id,
        title: formData.title,
        problem: formData.title,
        type: formData.type,
        maintenance_type: formData.type,
        description: formData.description,
        priority: String(
          formData.priority || 'Medium'
        ).toLowerCase(),

        requested_date:
          formData.scheduled_date || undefined,

        scheduled_date:
          formData.scheduled_date || undefined,

        preferred_repair_date:
          formData.due_date || undefined,

        due_date:
          formData.due_date || undefined,

        estimated_cost:
          formData.estimated_cost
            ? Number(formData.estimated_cost)
            : 0,

        technician_id:
          formData.technician_id || undefined
      };

      await axios.post(
        '/api/maintenance',
        payload
      );

      toast.success(t.requestCreated);

      setShowCreate(false);
      resetForm();

      await fetchAllData();
    } catch (error) {
      toast.error(
        error?.response?.data?.message ||
        t.createFailed
      );
    } finally {
      setSaving(false);
    }
  };

  // ============================================================
  // CREATE SCHEDULED MAINTENANCE
  // ============================================================

  const handleScheduledCreate = async (event) => {
    event.preventDefault();

    if (!scheduledFormData.asset_id) {
      toast.error(t.selectAsset);
      return;
    }

    setSaving(true);

    try {
      const payload = {
        asset_id: scheduledFormData.asset_id,

        title:
          scheduledFormData.maintenance_type ||
          'Scheduled maintenance',

        problem:
          scheduledFormData.maintenance_type ||
          'Scheduled maintenance',

        type: scheduledFormData.maintenance_type,

        maintenance_type:
          scheduledFormData.maintenance_type,

        description:
          scheduledFormData.notes ||
          'Scheduled maintenance',

        priority: String(
          scheduledFormData.priority || 'Medium'
        ).toLowerCase(),

        requested_date:
          scheduledFormData.scheduled_date,

        scheduled_date:
          scheduledFormData.scheduled_date,

        preferred_repair_date:
          scheduledFormData.expected_completion ||
          undefined,

        expected_completion:
          scheduledFormData.expected_completion ||
          undefined,

        technician_id:
          scheduledFormData.technician_id ||
          undefined,

        recurring:
          scheduledFormData.recurring,

        interval_days:
          scheduledFormData.recurring
            ? Number(
                scheduledFormData.interval_days
              )
            : undefined
      };

      await axios.post(
        '/api/maintenance',
        payload
      );

      toast.success(t.scheduledCreated);

      setShowScheduledCreate(false);
      resetScheduledForm();

      await fetchAllData();
    } catch (error) {
      toast.error(
        error?.response?.data?.message ||
        t.createFailed
      );
    } finally {
      setSaving(false);
    }
  };

  // ============================================================
  // WORKFLOW
  // ============================================================

  const handleApprove = async (id) => {
    try {
      await axios.patch(
        `/api/maintenance/${id}/approve`
      );

      toast.success(t.requestApproved);

      await fetchAllData();
    } catch (error) {
      toast.error(
        error?.response?.data?.message ||
        t.approveFailed
      );
    }
  };

  const handleReject = async (id) => {
    try {
      await axios.patch(
        `/api/maintenance/${id}/reject`
      );

      toast.success(t.requestRejected);

      await fetchAllData();
    } catch (error) {
      toast.error(
        error?.response?.data?.message ||
        t.rejectFailed
      );
    }
  };

  const handleAssign = async (
    id,
    technicianId
  ) => {
    if (!technicianId) {
      return;
    }

    try {
      await axios.post(
        `/api/maintenance/${id}/reassign`,
        {
          technician_id: technicianId
        }
      );

      toast.success(
        t.technicianAssigned
      );

      await fetchAllData();
    } catch (error) {
      toast.error(
        error?.response?.data?.message ||
        t.assignFailed
      );
    }
  };

  const handleStart = async (id) => {
    try {
      await axios.patch(
        `/api/maintenance/${id}/start`
      );

      toast.success(
        t.maintenanceStarted
      );

      await fetchAllData();
    } catch (error) {
      toast.error(
        error?.response?.data?.message ||
        t.startFailed
      );
    }
  };

  const handleComplete = async (id) => {
    const current =
      completionMap[id] || {};

    const resolution =
      (
        current.resolution ||
        t.completedByAdmin
      ).trim();

    const laborCost =
      numberValue(current.labor_cost);

    const partsCost =
      numberValue(current.parts_cost);

    const serviceCost =
      numberValue(current.service_cost);

    const actualCost =
      laborCost +
      partsCost +
      serviceCost;

    try {
      await axios.post(
        `/api/maintenance/${id}/complete`,
        {
          resolution,
          labor_cost: laborCost,
          parts_cost: partsCost,
          service_cost: serviceCost,
          actual_cost: actualCost,
          parts_used:
            current.parts_used || ''
        }
      );

      toast.success(
        t.maintenanceCompleted
      );

      setCompletionMap((previous) => ({
        ...previous,
        [id]: {}
      }));

      await fetchAllData();
    } catch (error) {
      toast.error(
        error?.response?.data?.message ||
        t.completeFailed
      );
    }
  };

  // ============================================================
  // HISTORY
  // ============================================================

  const handleViewHistory = async (
    assetId
  ) => {
    if (!assetId) {
      toast.error(t.assetNotFound);
      return;
    }

    try {
      const response = await axios.get(
        `/api/assets/${assetId}/maintenance`
      );

      const history =
        Array.isArray(response?.data?.history)
          ? response.data.history
          : Array.isArray(response?.data?.data)
            ? response.data.data
            : [];

      setMaintenanceHistory(history);

      setSelectedAsset(
        assets.find(
          (asset) =>
            String(asset.id) ===
            String(assetId)
        ) || null
      );

      setShowHistoryModal(true);
    } catch (error) {
      toast.error(
        error?.response?.data?.message ||
        t.historyFailed
      );
    }
  };

  // ============================================================
  // COST DETAILS
  // ============================================================

  const openCostModal = (maintenance) => {
    setSelectedMaintenance(
      maintenance
    );

    setShowCostModal(true);
  };

  const getLaborCost = (item) => {
    return numberValue(
      item?.labor_cost ??
      item?.laborCost ??
      0
    );
  };

  const getPartsCost = (item) => {
    return numberValue(
      item?.parts_cost ??
      item?.partsCost ??
      0
    );
  };

  const getServiceCost = (item) => {
    return numberValue(
      item?.service_cost ??
      item?.serviceCost ??
      0
    );
  };

  const getTotalCost = (item) => {
    const storedTotal =
      numberValue(
        item?.actual_cost ??
        item?.total_cost ??
        item?.totalCost ??
        0
      );

    const calculated =
      getLaborCost(item) +
      getPartsCost(item) +
      getServiceCost(item);

    return storedTotal > 0
      ? storedTotal
      : calculated;
  };

  // ============================================================
  // RESET
  // ============================================================

  const resetForm = () => {
    setFormData({
      asset_id: '',
      type: 'Corrective',
      priority: 'Medium',
      title: '',
      description: '',
      scheduled_date: '',
      estimated_cost: '',
      technician_id: '',
      due_date: ''
    });
  };

  const resetScheduledForm = () => {
    setScheduledFormData({
      asset_id: '',
      maintenance_type: 'Preventive',
      technician_id: '',
      scheduled_date: '',
      expected_completion: '',
      priority: 'Medium',
      notes: '',
      recurring: false,
      interval_days: 30
    });
  };

  // ============================================================
  // FILTERING
  // ============================================================

  const filteredRequests = useMemo(() => {
    const query =
      search.trim().toLowerCase();

    return requests.filter((request) => {
      if (!query) return true;

      const text = [
        request?.title,
        request?.problem,
        request?.description,
        request?.asset_name,
        request?.asset?.name,
        request?.request_number,
        request?.technician_name,
        request?.assigned_to_name
      ]
        .map((value) =>
          safeText(value, '')
        )
        .join(' ')
        .toLowerCase();

      return text.includes(query);
    });
  }, [requests, search]);

  const filteredScheduled = useMemo(() => {
    const query =
      search.trim().toLowerCase();

    return scheduledMaintenance.filter(
      (item) => {
        if (!query) return true;

        const text = [
          item?.asset_name,
          item?.asset?.name,
          item?.maintenance_type,
          item?.type,
          item?.notes,
          item?.technician_name
        ]
          .map((value) =>
            safeText(value, '')
          )
          .join(' ')
          .toLowerCase();

        return text.includes(query);
      }
    );
  }, [
    scheduledMaintenance,
    search
  ]);

  const filteredHistory = useMemo(() => {
    const query =
      historyFilter.trim().toLowerCase();

    return maintenanceHistory.filter(
      (item) => {
        if (!query) return true;

        const text = [
          item?.asset_name,
          item?.asset?.name,
          item?.problem,
          item?.title,
          item?.description,
          item?.technician_name
        ]
          .map((value) =>
            safeText(value, '')
          )
          .join(' ')
          .toLowerCase();

        return text.includes(query);
      }
    );
  }, [
    maintenanceHistory,
    historyFilter
  ]);

  // ============================================================
  // STATISTICS
  // ============================================================

  const statistics = useMemo(() => {
    const all = requests || [];

    const pending = all.filter(
      (item) =>
        normalizeStatusValue(
          item?.status
        ) === 'Pending'
    ).length;

    const inProgress = all.filter(
      (item) =>
        normalizeStatusValue(
          item?.status
        ) === 'In Progress'
    ).length;

    const completed = all.filter(
      (item) =>
        normalizeStatusValue(
          item?.status
        ) === 'Completed'
    ).length;

    const approved = all.filter(
      (item) =>
        normalizeStatusValue(
          item?.status
        ) === 'Approved'
    ).length;

    const assigned = all.filter(
      (item) =>
        normalizeStatusValue(
          item?.status
        ) === 'Assigned'
    ).length;

    const totalEstimated =
      all.reduce(
        (sum, item) =>
          sum +
          numberValue(
            item?.estimated_cost
          ),
        0
      );

    const totalLabor =
      all.reduce(
        (sum, item) =>
          sum + getLaborCost(item),
        0
      );

    const totalParts =
      all.reduce(
        (sum, item) =>
          sum + getPartsCost(item),
        0
      );

    const totalService =
      all.reduce(
        (sum, item) =>
          sum + getServiceCost(item),
        0
      );

    const totalActual =
      all.reduce(
        (sum, item) =>
          sum + getTotalCost(item),
        0
      );

    return {
      total: all.length,
      pending,
      approved,
      assigned,
      inProgress,
      completed,
      scheduled:
        scheduledMaintenance.length,
      technicians:
        technicians.length,
      totalEstimated,
      totalLabor,
      totalParts,
      totalService,
      totalActual
    };
  }, [
    requests,
    scheduledMaintenance,
    technicians
  ]);

  // ============================================================
  // STYLES
  // ============================================================

  const styles = {
    container: {
      padding: '20px',
      maxWidth: '1500px',
      margin: '0 auto'
    },

    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: '16px',
      marginBottom: '20px'
    },

    title: {
      color: isDark
        ? '#c8dcf5'
        : '#1a365d',
      fontSize: '1.8rem',
      fontWeight: 700,
      margin: 0
    },

    subtitle: {
      color: isDark
        ? '#8896b0'
        : '#4a5568',
      fontSize: '0.9rem',
      marginTop: '5px'
    },

    headerButtons: {
      display: 'flex',
      gap: '8px',
      flexWrap: 'wrap'
    },

    button: (
      background = 'linear-gradient(135deg,#2b6cb0,#4299e1)'
    ) => ({
      padding: '10px 16px',
      background,
      color: '#fff',
      border: 'none',
      borderRadius: '8px',
      fontWeight: 600,
      cursor: 'pointer',
      fontSize: '0.85rem',
      whiteSpace: 'nowrap'
    }),

    statsGrid: {
      display: 'grid',
      gridTemplateColumns:
        'repeat(auto-fit,minmax(180px,1fr))',
      gap: '14px',
      marginBottom: '20px'
    },

    statCard: {
      background: isDark
        ? '#1e2d45'
        : '#fff',
      border:
        `1px solid ${
          isDark
            ? '#32465f'
            : '#e8edf5'
        }`,
      borderRadius: '12px',
      padding: '18px',
      boxShadow:
        '0 2px 8px rgba(0,0,0,.04)'
    },

    statIcon: {
      fontSize: '1.6rem',
      marginBottom: '7px'
    },

    statLabel: {
      color: isDark
        ? '#8896b0'
        : '#718096',
      fontSize: '0.8rem',
      marginBottom: '4px'
    },

    statValue: {
      color: isDark
        ? '#c8dcf5'
        : '#1a365d',
      fontSize: '1.5rem',
      fontWeight: 700
    },

    tabs: {
      display: 'flex',
      gap: '6px',
      flexWrap: 'wrap',
      background: isDark
        ? '#1a273a'
        : '#f0f4f8',
      padding: '5px',
      borderRadius: '10px',
      marginBottom: '16px'
    },

    tab: (active) => ({
      padding: '10px 14px',
      border: 'none',
      borderRadius: '7px',
      cursor: 'pointer',
      fontWeight: 600,
      fontSize: '0.82rem',
      background: active
        ? '#2b6cb0'
        : 'transparent',
      color: active
        ? '#fff'
        : isDark
          ? '#8896b0'
          : '#4a5568'
    }),

    controls: {
      display: 'flex',
      gap: '10px',
      flexWrap: 'wrap',
      padding: '14px',
      background: isDark
        ? '#1a273a'
        : '#f7fafc',
      border:
        `1px solid ${
          isDark
            ? '#32465f'
            : '#e8edf5'
        }`,
      borderRadius: '10px',
      marginBottom: '16px'
    },

    input: {
      padding: '10px 13px',
      borderRadius: '8px',
      border:
        `1px solid ${
          isDark
            ? '#32465f'
            : '#d0d8e8'
        }`,
      background: isDark
        ? '#0d1b2a'
        : '#fff',
      color: isDark
        ? '#c8dcf5'
        : '#1a365d',
      fontSize: '0.85rem',
      minWidth: '180px',
      flex: 1,
      outline: 'none'
    },

    select: {
      padding: '10px 13px',
      borderRadius: '8px',
      border:
        `1px solid ${
          isDark
            ? '#32465f'
            : '#d0d8e8'
        }`,
      background: isDark
        ? '#0d1b2a'
        : '#fff',
      color: isDark
        ? '#c8dcf5'
        : '#1a365d',
      fontSize: '0.85rem',
      minWidth: '140px',
      cursor: 'pointer'
    },

    card: {
      background: isDark
        ? '#1e2d45'
        : '#fff',
      border:
        `1px solid ${
          isDark
            ? '#32465f'
            : '#e8edf5'
        }`,
      borderRadius: '12px',
      padding: '18px',
      marginBottom: '12px',
      boxShadow:
        '0 2px 8px rgba(0,0,0,.04)'
    },

    cardHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: '15px',
      flexWrap: 'wrap'
    },

    cardTitle: {
      color: isDark
        ? '#c8dcf5'
        : '#1a365d',
      fontSize: '1rem',
      fontWeight: 700
    },

    cardSubtitle: {
      color: isDark
        ? '#8896b0'
        : '#718096',
      fontSize: '0.8rem',
      marginTop: '4px'
    },

    meta: {
      display: 'flex',
      gap: '8px',
      flexWrap: 'wrap',
      marginTop: '9px'
    },

    metaText: {
      color: isDark
        ? '#a0aec0'
        : '#4a5568',
      fontSize: '0.78rem'
    },

    status: (value) => ({
      display: 'inline-block',
      padding: '4px 10px',
      borderRadius: '20px',
      fontSize: '0.7rem',
      fontWeight: 700,
      background:
        `${getStatusColor(value)}20`,
      color:
        getStatusColor(value)
    }),

    priority: (value) => ({
      display: 'inline-block',
      padding: '4px 10px',
      borderRadius: '20px',
      fontSize: '0.7rem',
      fontWeight: 700,
      background:
        `${getPriorityColor(value)}20`,
      color:
        getPriorityColor(value)
    }),

    actions: {
      display: 'flex',
      gap: '5px',
      flexWrap: 'wrap',
      alignItems: 'center'
    },

    action: (
      background
    ) => ({
      padding: '7px 10px',
      background,
      color: '#fff',
      border: 'none',
      borderRadius: '6px',
      cursor: 'pointer',
      fontSize: '0.72rem',
      fontWeight: 600
    }),

    empty: {
      textAlign: 'center',
      padding: '60px 20px',
      background: isDark
        ? '#1e2d45'
        : '#fff',
      color: isDark
        ? '#8896b0'
        : '#718096',
      borderRadius: '12px',
      border:
        `1px solid ${
          isDark
            ? '#32465f'
            : '#e8edf5'
        }`
    },

    costGrid: {
      display: 'grid',
      gridTemplateColumns:
        'repeat(auto-fit,minmax(180px,1fr))',
      gap: '12px',
      marginTop: '15px'
    },

    costCard: {
      padding: '15px',
      borderRadius: '10px',
      background: isDark
        ? '#162235'
        : '#f7fafc',
      border:
        `1px solid ${
          isDark
            ? '#32465f'
            : '#e8edf5'
        }`
    },

    costLabel: {
      color: isDark
        ? '#8896b0'
        : '#718096',
      fontSize: '0.75rem'
    },

    costValue: {
      color: isDark
        ? '#c8dcf5'
        : '#1a365d',
      fontWeight: 700,
      fontSize: '1.15rem',
      marginTop: '5px'
    },

    modal: {
      position: 'fixed',
      inset: 0,
      background:
        'rgba(0,0,0,.65)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 9999,
      padding: '20px'
    },

    modalContent: {
      background: isDark
        ? '#1e2d45'
        : '#fff',
      width: '100%',
      maxWidth: '650px',
      maxHeight: '90vh',
      overflowY: 'auto',
      padding: '25px',
      borderRadius: '15px',
      boxShadow:
        '0 20px 60px rgba(0,0,0,.4)'
    },

    modalTitle: {
      color: isDark
        ? '#c8dcf5'
        : '#1a365d',
      marginTop: 0,
      marginBottom: '20px',
      fontSize: '1.25rem'
    },

    modalInput: {
      width: '100%',
      boxSizing: 'border-box',
      padding: '10px 13px',
      borderRadius: '8px',
      border:
        `1px solid ${
          isDark
            ? '#32465f'
            : '#d0d8e8'
        }`,
      background: isDark
        ? '#0d1b2a'
        : '#fff',
      color: isDark
        ? '#c8dcf5'
        : '#1a365d',
      marginBottom: '12px',
      fontSize: '0.85rem'
    },

    textarea: {
      width: '100%',
      boxSizing: 'border-box',
      minHeight: '90px',
      resize: 'vertical',
      padding: '10px 13px',
      borderRadius: '8px',
      border:
        `1px solid ${
          isDark
            ? '#32465f'
            : '#d0d8e8'
        }`,
      background: isDark
        ? '#0d1b2a'
        : '#fff',
      color: isDark
        ? '#c8dcf5'
        : '#1a365d',
      marginBottom: '12px',
      fontSize: '0.85rem'
    },

    formGrid: {
      display: 'grid',
      gridTemplateColumns:
        'repeat(2,minmax(0,1fr))',
      gap: '12px'
    },

    formActions: {
      display: 'flex',
      gap: '10px',
      marginTop: '12px'
    }
  };

  // ============================================================
  // REQUEST CARD
  // ============================================================

  const renderRequestCard = (request) => {
    const status =
      normalizeStatusValue(
        request?.status
      );

    const priority =
      normalizePriorityValue(
        request?.priority
      );

    const assetName =
      safeText(
        request?.asset_name ||
        request?.asset?.name ||
        request?.assetName
      );

    const technicianName =
      safeText(
        request?.technician_name ||
        request?.assigned_to_name ||
        request?.technician?.fullName ||
        request?.technician?.name,
        t.notAssigned
      );

    const requester =
      safeText(
        request?.requested_by_name ||
        request?.reported_by_name ||
        request?.requester?.fullName ||
        request?.requester?.username
      );

    const completion =
      completionMap[
        request.id
      ] || {};

    return (
      <div
        key={request.id}
        style={styles.card}
      >
        <div style={styles.cardHeader}>
          <div style={{ flex: 1 }}>
            <div style={styles.cardTitle}>
              {getStatusIcon(status)}{' '}
              {safeText(
                request?.title ||
                request?.problem
              )}
            </div>

            <div
              style={
                styles.cardSubtitle
              }
            >
              {assetName}{' '}
              • #{safeText(
                request?.request_number ||
                request?.id
              )}
            </div>

            <div style={styles.meta}>
              <span
                style={styles.status(
                  status
                )}
              >
                {status}
              </span>

              <span
                style={styles.priority(
                  priority
                )}
              >
                {priority}
              </span>

              <span
                style={styles.metaText}
              >
                {t.type}:{' '}
                {safeText(
                  request?.type ||
                  request?.maintenance_type
                )}
              </span>

              <span
                style={styles.metaText}
              >
                {t.technician}:{' '}
                {technicianName}
              </span>
            </div>

            <p
              style={{
                color: isDark
                  ? '#a0aec0'
                  : '#4a5568',
                fontSize: '0.82rem',
                lineHeight: 1.5
              }}
            >
              {safeText(
                request?.description
              )}
            </p>

            <div style={styles.meta}>
              <span
                style={styles.metaText}
              >
                {t.reportedBy}:{' '}
                {requester}
              </span>

              <span
                style={styles.metaText}
              >
                {t.created}:{' '}
                {formatDate(
                  request?.created_at ||
                  request?.createdAt
                )}
              </span>

              {request?.scheduled_date && (
                <span
                  style={
                    styles.metaText
                  }
                >
                  {t.scheduledDate}:{' '}
                  {formatDate(
                    request.scheduled_date
                  )}
                </span>
              )}

              {request?.estimated_cost !==
                undefined && (
                <span
                  style={
                    styles.metaText
                  }
                >
                  {t.estimatedCost}:{' '}
                  {formatCurrency(
                    request.estimated_cost
                  )}
                </span>
              )}
            </div>

            {(status === 'In Progress' ||
              status === 'Completed') && (
              <div style={styles.costGrid}>
                <div
                  style={
                    styles.costCard
                  }
                >
                  <div
                    style={
                      styles.costLabel
                    }
                  >
                    {t.laborCost}
                  </div>
                  <div
                    style={
                      styles.costValue
                    }
                  >
                    {formatCurrency(
                      getLaborCost(
                        request
                      )
                    )}
                  </div>
                </div>

                <div
                  style={
                    styles.costCard
                  }
                >
                  <div
                    style={
                      styles.costLabel
                    }
                  >
                    {t.partsCost}
                  </div>
                  <div
                    style={
                      styles.costValue
                    }
                  >
                    {formatCurrency(
                      getPartsCost(
                        request
                      )
                    )}
                  </div>
                </div>

                <div
                  style={
                    styles.costCard
                  }
                >
                  <div
                    style={
                      styles.costLabel
                    }
                  >
                    {t.serviceCost}
                  </div>
                  <div
                    style={
                      styles.costValue
                    }
                  >
                    {formatCurrency(
                      getServiceCost(
                        request
                      )
                    )}
                  </div>
                </div>

                <div
                  style={
                    styles.costCard
                  }
                >
                  <div
                    style={
                      styles.costLabel
                    }
                  >
                    {t.totalCost}
                  </div>
                  <div
                    style={
                      styles.costValue
                    }
                  >
                    {formatCurrency(
                      getTotalCost(
                        request
                      )
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div style={styles.actions}>
            {status === 'Pending' && (
              <>
                <button
                  style={styles.action(
                    '#38a169'
                  )}
                  onClick={() =>
                    handleApprove(
                      request.id
                    )
                  }
                >
                  ✅ {t.approve}
                </button>

                <button
                  style={styles.action(
                    '#e53e3e'
                  )}
                  onClick={() =>
                    handleReject(
                      request.id
                    )
                  }
                >
                  ❌ {t.reject}
                </button>
              </>
            )}

            {(status === 'Approved' ||
              status === 'Assigned') && (
              <>
                <select
                  style={{
                    ...styles.select,
                    minWidth: '150px',
                    padding: '7px'
                  }}
                  value=""
                  onChange={(event) =>
                    handleAssign(
                      request.id,
                      event.target.value
                    )
                  }
                >
                  <option value="">
                    {t.assignTechnician}
                  </option>

                  {technicians.map(
                    (tech) => (
                      <option
                        key={tech.id}
                        value={tech.id}
                      >
                        {safeText(
                          tech.full_name ||
                          tech.fullName ||
                          tech.username
                        )}
                      </option>
                    )
                  )}
                </select>

                <button
                  style={styles.action(
                    '#4299e1'
                  )}
                  onClick={() =>
                    handleStart(
                      request.id
                    )
                  }
                >
                  🚀 {t.start}
                </button>
              </>
            )}

            {status ===
              'In Progress' && (
              <>
                <input
                  style={{
                    ...styles.input,
                    flex: 'none',
                    width: '120px',
                    minWidth: '120px',
                    padding: '7px'
                  }}
                  placeholder={
                    t.laborCost
                  }
                  type="number"
                  min="0"
                  step="0.01"
                  value={
                    completion.labor_cost ??
                    ''
                  }
                  onChange={(event) =>
                    setCompletionMap(
                      (previous) => ({
                        ...previous,
                        [request.id]: {
                          ...(previous[
                            request.id
                          ] || {}),
                          labor_cost:
                            event.target
                              .value
                        }
                      })
                    )
                  }
                />

                <input
                  style={{
                    ...styles.input,
                    flex: 'none',
                    width: '120px',
                    minWidth: '120px',
                    padding: '7px'
                  }}
                  placeholder={
                    t.partsCost
                  }
                  type="number"
                  min="0"
                  step="0.01"
                  value={
                    completion.parts_cost ??
                    ''
                  }
                  onChange={(event) =>
                    setCompletionMap(
                      (previous) => ({
                        ...previous,
                        [request.id]: {
                          ...(previous[
                            request.id
                          ] || {}),
                          parts_cost:
                            event.target
                              .value
                        }
                      })
                    )
                  }
                />

                <input
                  style={{
                    ...styles.input,
                    flex: 'none',
                    width: '120px',
                    minWidth: '120px',
                    padding: '7px'
                  }}
                  placeholder={
                    t.serviceCost
                  }
                  type="number"
                  min="0"
                  step="0.01"
                  value={
                    completion.service_cost ??
                    ''
                  }
                  onChange={(event) =>
                    setCompletionMap(
                      (previous) => ({
                        ...previous,
                        [request.id]: {
                          ...(previous[
                            request.id
                          ] || {}),
                          service_cost:
                            event.target
                              .value
                        }
                      })
                    )
                  }
                />

                <input
                  style={{
                    ...styles.input,
                    flex: 'none',
                    width: '150px',
                    minWidth: '150px',
                    padding: '7px'
                  }}
                  placeholder={
                    t.resolution
                  }
                  value={
                    completion.resolution ||
                    ''
                  }
                  onChange={(event) =>
                    setCompletionMap(
                      (previous) => ({
                        ...previous,
                        [request.id]: {
                          ...(previous[
                            request.id
                          ] || {}),
                          resolution:
                            event.target
                              .value
                        }
                      })
                    )
                  }
                />

                <button
                  style={styles.action(
                    '#38a169'
                  )}
                  onClick={() =>
                    handleComplete(
                      request.id
                    )
                  }
                >
                  ✔️ {t.complete}
                </button>
              </>
            )}

            <button
              style={styles.action(
                '#805ad5'
              )}
              onClick={() =>
                handleViewHistory(
                  request.asset_id ||
                  request.assetId ||
                  request.asset?.id
                )
              }
            >
              📜 {t.history}
            </button>

            <button
              style={styles.action(
                '#d69e2e'
              )}
              onClick={() =>
                openCostModal(request)
              }
            >
              💰 {t.cost}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ============================================================
  // SCHEDULED CARD
  // ============================================================

  const renderScheduledCard = (
    item
  ) => {
    const status =
      normalizeStatusValue(
        item?.status
      );

    const priority =
      normalizePriorityValue(
        item?.priority
      );

    const assetName =
      safeText(
        item?.asset_name ||
        item?.asset?.name ||
        item?.assetName
      );

    const technician =
      safeText(
        item?.technician_name ||
        item?.assigned_to_name ||
        item?.technician?.fullName ||
        item?.technician?.name,
        t.notAssigned
      );

    return (
      <div
        key={item.id}
        style={styles.card}
      >
        <div style={styles.cardHeader}>
          <div>
            <div style={styles.cardTitle}>
              📅 {assetName} —{' '}
              {safeText(
                item?.maintenance_type ||
                item?.type
              )}
            </div>

            <div style={styles.meta}>
              <span
                style={styles.status(
                  status
                )}
              >
                {status}
              </span>

              <span
                style={styles.priority(
                  priority
                )}
              >
                {priority}
              </span>

              <span
                style={styles.metaText}
              >
                {t.technician}:{' '}
                {technician}
              </span>

              <span
                style={styles.metaText}
              >
                {t.scheduledDate}:{' '}
                {formatDate(
                  item?.scheduled_date
                )}
              </span>

              {item?.expected_completion && (
                <span
                  style={
                    styles.metaText
                  }
                >
                  {t.expectedCompletion}:{' '}
                  {formatDate(
                    item.expected_completion
                  )}
                </span>
              )}
            </div>

            {item?.recurring && (
              <div
                style={{
                  ...styles.metaText,
                  marginTop: '8px'
                }}
              >
                🔁 {t.recurring}:{' '}
                {safeText(
                  item.interval_days,
                  '30'
                )}{' '}
                {t.days}
              </div>
            )}

            {item?.notes && (
              <p
                style={{
                  color: isDark
                    ? '#a0aec0'
                    : '#4a5568',
                  fontSize: '0.82rem'
                }}
              >
                {item.notes}
              </p>
            )}
          </div>

          <button
            style={styles.action(
              '#4299e1'
            )}
            onClick={() =>
              toast.info(
                t.reminderSent
              )
            }
          >
            🔔 {t.reminder}
          </button>
        </div>
      </div>
    );
  };

  // ============================================================
  // HISTORY CARD
  // ============================================================

  const renderHistoryItem = (
    item,
    index
  ) => {
    const status =
      normalizeStatusValue(
        item?.status ||
        'Completed'
      );

    const assetName =
      safeText(
        item?.asset_name ||
        item?.asset?.name ||
        item?.assetName
      );

    const title =
      safeText(
        item?.problem ||
        item?.title ||
        item?.maintenance_type ||
        item?.type ||
        t.problem
      );

    const technician =
      safeText(
        item?.technician_name ||
        item?.assigned_to_name ||
        item?.technician?.fullName ||
        item?.technician?.name,
        t.notAssigned
      );

    return (
      <div
        key={`${item?.id || index}-${title}`}
        style={styles.card}
      >
        <div
          style={
            styles.cardHeader
          }
        >
          <div>
            <div
              style={
                styles.cardTitle
              }
            >
              📜 {assetName} —{' '}
              {title}
            </div>

            <div style={styles.meta}>
              <span
                style={styles.status(
                  status
                )}
              >
                {status}
              </span>

              <span
                style={styles.metaText}
              >
                {t.technician}:{' '}
                {technician}
              </span>

              {item?.start_date && (
                <span
                  style={
                    styles.metaText
                  }
                >
                  {t.start}:{' '}
                  {formatDate(
                    item.start_date
                  )}
                </span>
              )}

              {item?.end_date && (
                <span
                  style={
                    styles.metaText
                  }
                >
                  {t.end}:{' '}
                  {formatDate(
                    item.end_date
                  )}
                </span>
              )}
            </div>

            {item?.resolution && (
              <p
                style={{
                  color: isDark
                    ? '#a0aec0'
                    : '#4a5568',
                  fontSize: '0.82rem'
                }}
              >
                <strong>
                  {t.resolution}:
                </strong>{' '}
                {item.resolution}
              </p>
            )}

            {item?.parts_used && (
              <div
                style={
                  styles.metaText
                }
              >
                {t.partsUsed}:{' '}
                {item.parts_used}
              </div>
            )}
          </div>

          <div>
            <div
              style={{
                fontWeight: 700,
                color: isDark
                  ? '#c8dcf5'
                  : '#1a365d'
              }}
            >
              {formatCurrency(
                getTotalCost(item)
              )}
            </div>

            <button
              style={{
                ...styles.action(
                  '#805ad5'
                ),
                marginTop: '8px'
              }}
              onClick={() =>
                openCostModal(item)
              }
            >
              💰 {t.viewCost}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div style={styles.container}>
      {/* HEADER */}

      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>
            🔧 {t.maintenance}
          </h1>

          <div
            style={styles.subtitle}
          >
            {viewMode === 'requests' &&
              t.manageRequests}

            {viewMode === 'scheduled' &&
              t.manageScheduled}

            {viewMode === 'pending' &&
              t.pendingDescription}

            {viewMode === 'progress' &&
              t.progressDescription}

            {viewMode === 'completed' &&
              t.completedDescription}

            {viewMode === 'technicians' &&
              t.manageTechnicians}

            {viewMode === 'cost' &&
              t.manageCosts}

            {viewMode === 'history' &&
              t.viewHistory}
          </div>
        </div>

        <div
          style={
            styles.headerButtons
          }
        >
          {viewMode === 'requests' && (
            <button
              style={styles.button()}
              onClick={() =>
                setShowCreate(true)
              }
            >
              ➕ {t.createRequest}
            </button>
          )}

          {viewMode === 'scheduled' && (
            <button
              style={styles.button(
                '#805ad5'
              )}
              onClick={() =>
                setShowScheduledCreate(
                  true
                )
              }
            >
              ➕ {t.createScheduled}
            </button>
          )}

          <button
            style={styles.button(
              '#718096'
            )}
            onClick={fetchAllData}
          >
            🔄 {t.refresh}
          </button>
        </div>
      </div>

      {/* STATISTICS */}

      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={styles.statIcon}>
            📋
          </div>
          <div style={styles.statLabel}>
            {t.totalRequests}
          </div>
          <div style={styles.statValue}>
            {statistics.total}
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statIcon}>
            ⏳
          </div>
          <div style={styles.statLabel}>
            {t.pending}
          </div>
          <div style={styles.statValue}>
            {statistics.pending}
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statIcon}>
            🔄
          </div>
          <div style={styles.statLabel}>
            {t.inProgress}
          </div>
          <div style={styles.statValue}>
            {statistics.inProgress}
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statIcon}>
            ✅
          </div>
          <div style={styles.statLabel}>
            {t.completed}
          </div>
          <div style={styles.statValue}>
            {statistics.completed}
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statIcon}>
            📅
          </div>
          <div style={styles.statLabel}>
            {t.scheduledMaintenance}
          </div>
          <div style={styles.statValue}>
            {statistics.scheduled}
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statIcon}>
            👨‍🔧
          </div>
          <div style={styles.statLabel}>
            {t.technicians}
          </div>
          <div style={styles.statValue}>
            {statistics.technicians}
          </div>
        </div>
      </div>

      {/* COST SUMMARY */}

      <div
        style={{
          ...styles.card,
          marginBottom: '20px'
        }}
      >
        <div style={styles.cardTitle}>
          💰 {t.maintenanceCost}
        </div>

        <div style={styles.costGrid}>
          <div style={styles.costCard}>
            <div style={styles.costLabel}>
              {t.estimatedCost}
            </div>
            <div style={styles.costValue}>
              {formatCurrency(
                statistics.totalEstimated
              )}
            </div>
          </div>

          <div style={styles.costCard}>
            <div style={styles.costLabel}>
              {t.laborCost}
            </div>
            <div style={styles.costValue}>
              {formatCurrency(
                statistics.totalLabor
              )}
            </div>
          </div>

          <div style={styles.costCard}>
            <div style={styles.costLabel}>
              {t.partsCost}
            </div>
            <div style={styles.costValue}>
              {formatCurrency(
                statistics.totalParts
              )}
            </div>
          </div>

          <div style={styles.costCard}>
            <div style={styles.costLabel}>
              {t.serviceCost}
            </div>
            <div style={styles.costValue}>
              {formatCurrency(
                statistics.totalService
              )}
            </div>
          </div>

          <div style={styles.costCard}>
            <div style={styles.costLabel}>
              {t.totalCost}
            </div>
            <div style={styles.costValue}>
              {formatCurrency(
                statistics.totalActual
              )}
            </div>
          </div>
        </div>
      </div>

      {/* NAVIGATION */}

      <div style={styles.tabs}>
        <button
          style={styles.tab(
            viewMode === 'requests'
          )}
          onClick={() =>
            setViewMode('requests')
          }
        >
          📋 {t.requests}
        </button>

        <button
          style={styles.tab(
            viewMode === 'scheduled'
          )}
          onClick={() =>
            setViewMode('scheduled')
          }
        >
          📅 {t.scheduledMaintenance}
        </button>

        <button
          style={styles.tab(
            viewMode === 'pending'
          )}
          onClick={() =>
            setViewMode('pending')
          }
        >
          ⏳ {t.pending}
        </button>

        <button
          style={styles.tab(
            viewMode === 'progress'
          )}
          onClick={() =>
            setViewMode('progress')
          }
        >
          🔄 {t.inProgress}
        </button>

        <button
          style={styles.tab(
            viewMode === 'completed'
          )}
          onClick={() =>
            setViewMode('completed')
          }
        >
          ✅ {t.completed}
        </button>

        <button
          style={styles.tab(
            viewMode === 'technicians'
          )}
          onClick={() =>
            setViewMode('technicians')
          }
        >
          👨‍🔧 {t.technicians}
        </button>

        <button
          style={styles.tab(
            viewMode === 'cost'
          )}
          onClick={() =>
            setViewMode('cost')
          }
        >
          💰 {t.maintenanceCost}
        </button>

        <button
          style={styles.tab(
            viewMode === 'history'
          )}
          onClick={() =>
            setViewMode('history')
          }
        >
          📜 {t.history}
        </button>
      </div>

      {/* CONTROLS */}

      <div style={styles.controls}>
        {(viewMode === 'requests' ||
          viewMode === 'pending' ||
          viewMode === 'progress' ||
          viewMode === 'completed') && (
          <>
            <input
              style={styles.input}
              placeholder={
                t.searchMaintenance
              }
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
            />

            <select
              style={styles.select}
              value={filterStatus}
              onChange={(event) =>
                setFilterStatus(
                  event.target.value
                )
              }
            >
              <option value="">
                {t.allStatus}
              </option>
              <option value="Pending">
                {t.pending}
              </option>
              <option value="Approved">
                {t.approved}
              </option>
              <option value="Assigned">
                {t.assigned}
              </option>
              <option value="In-Progress">
                {t.inProgress}
              </option>
              <option value="Completed">
                {t.completed}
              </option>
              <option value="Rejected">
                {t.rejected}
              </option>
              <option value="Cancelled">
                {t.cancelled}
              </option>
            </select>

            <select
              style={styles.select}
              value={filterPriority}
              onChange={(event) =>
                setFilterPriority(
                  event.target.value
                )
              }
            >
              <option value="">
                {t.allPriorities}
              </option>
              <option value="Low">
                {t.low}
              </option>
              <option value="Medium">
                {t.medium}
              </option>
              <option value="High">
                {t.high}
              </option>
              <option value="Critical">
                {t.critical}
              </option>
            </select>
          </>
        )}

        {viewMode === 'scheduled' && (
          <input
            style={styles.input}
            placeholder={
              t.searchMaintenance
            }
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
          />
        )}

        {viewMode === 'history' && (
          <input
            style={styles.input}
            placeholder={
              t.searchHistory
            }
            value={historyFilter}
            onChange={(event) =>
              setHistoryFilter(
                event.target.value
              )
            }
          />
        )}

        <button
          style={styles.button()}
          onClick={fetchAllData}
        >
          🔍 {t.filter}
        </button>
      </div>

      {/* CONTENT */}

      {loading ? (
        <div style={styles.empty}>
          ⏳ {t.loading}
        </div>
      ) : (
        <>
          {/* REQUESTS */}

          {viewMode === 'requests' && (
            filteredRequests.length ===
            0 ? (
              <div style={styles.empty}>
                {t.noRequests}
              </div>
            ) : (
              filteredRequests.map(
                renderRequestCard
              )
            )
          )}

          {/* PENDING */}

          {viewMode === 'pending' && (
            (() => {
              const list =
                filteredRequests.filter(
                  (item) =>
                    normalizeStatusValue(
                      item?.status
                    ) === 'Pending'
                );

              return list.length === 0 ? (
                <div style={styles.empty}>
                  {t.noPending}
                </div>
              ) : (
                list.map(
                  renderRequestCard
                )
              );
            })()
          )}

          {/* IN PROGRESS */}

          {viewMode === 'progress' && (
            (() => {
              const list =
                filteredRequests.filter(
                  (item) =>
                    normalizeStatusValue(
                      item?.status
                    ) === 'In Progress'
                );

              return list.length === 0 ? (
                <div style={styles.empty}>
                  {t.noInProgress}
                </div>
              ) : (
                list.map(
                  renderRequestCard
                )
              );
            })()
          )}

          {/* COMPLETED */}

          {viewMode === 'completed' && (
            (() => {
              const list =
                filteredRequests.filter(
                  (item) =>
                    normalizeStatusValue(
                      item?.status
                    ) === 'Completed'
                );

              return list.length === 0 ? (
                <div style={styles.empty}>
                  {t.noCompleted}
                </div>
              ) : (
                list.map(
                  renderRequestCard
                )
              );
            })()
          )}

          {/* SCHEDULED */}

          {viewMode === 'scheduled' && (
            filteredScheduled.length ===
            0 ? (
              <div style={styles.empty}>
                {t.noScheduled}
              </div>
            ) : (
              filteredScheduled.map(
                renderScheduledCard
              )
            )
          )}

          {/* TECHNICIANS */}

          {viewMode ===
            'technicians' && (
            technicians.length === 0 ? (
              <div style={styles.empty}>
                👨‍🔧 {t.noTechnicians}
              </div>
            ) : (
              technicians.map(
                (technician) => (
                  <div
                    key={technician.id}
                    style={styles.card}
                  >
                    <div
                      style={
                        styles.cardHeader
                      }
                    >
                      <div>
                        <div
                          style={
                            styles.cardTitle
                          }
                        >
                          👨‍🔧{' '}
                          {safeText(
                            technician.full_name ||
                            technician.fullName ||
                            technician.username
                          )}
                        </div>

                        <div
                          style={
                            styles.meta
                          }
                        >
                          <span
                            style={
                              styles.metaText
                            }
                          >
                            👤{' '}
                            {safeText(
                              technician.username
                            )}
                          </span>

                          <span
                            style={
                              styles.metaText
                            }
                          >
                            📧{' '}
                            {safeText(
                              technician.email
                            )}
                          </span>

                          <span
                            style={
                              styles.status(
                                'Assigned'
                              )}
                          >
                            {t.technician}
                          </span>
                        </div>
                      </div>

                      <button
                        style={styles.action(
                          '#4299e1'
                        )}
                        onClick={() =>
                          toast.info(
                            t.technicianManagement
                          )
                        }
                      >
                        ⚙️ {t.manage}
                      </button>
                    </div>
                  </div>
                )
              )
            )
          )}

          {/* COST */}

          {viewMode === 'cost' && (
            (() => {
              const costItems =
                requests.filter(
                  (item) =>
                    getTotalCost(item) > 0 ||
                    normalizeStatusValue(
                      item?.status
                    ) === 'Completed'
                );

              return (
                <>
                  <div
                    style={styles.card}
                  >
                    <div
                      style={
                        styles.cardTitle
                      }
                    >
                      💰{' '}
                      {t.costBreakdown}
                    </div>

                    <div
                      style={
                        styles.costGrid
                      }
                    >
                      <div
                        style={
                          styles.costCard
                        }
                      >
                        <div
                          style={
                            styles.costLabel
                          }
                        >
                          {t.laborCost}
                        </div>

                        <div
                          style={
                            styles.costValue
                          }
                        >
                          {formatCurrency(
                            statistics.totalLabor
                          )}
                        </div>
                      </div>

                      <div
                        style={
                          styles.costCard
                        }
                      >
                        <div
                          style={
                            styles.costLabel
                          }
                        >
                          {t.partsCost}
                        </div>

                        <div
                          style={
                            styles.costValue
                          }
                        >
                          {formatCurrency(
                            statistics.totalParts
                          )}
                        </div>
                      </div>

                      <div
                        style={
                          styles.costCard
                        }
                      >
                        <div
                          style={
                            styles.costLabel
                          }
                        >
                          {t.serviceCost}
                        </div>

                        <div
                          style={
                            styles.costValue
                          }
                        >
                          {formatCurrency(
                            statistics.totalService
                          )}
                        </div>
                      </div>

                      <div
                        style={
                          styles.costCard
                        }
                      >
                        <div
                          style={
                            styles.costLabel
                          }
                        >
                          {t.totalCost}
                        </div>

                        <div
                          style={
                            styles.costValue
                          }
                        >
                          {formatCurrency(
                            statistics.totalActual
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {costItems.length ===
                  0 ? (
                    <div
                      style={
                        styles.empty
                      }
                    >
                      {t.noCostRecords}
                    </div>
                  ) : (
                    costItems.map(
                      renderRequestCard
                    )
                  )}
                </>
              );
            })()
          )}

          {/* HISTORY */}

          {viewMode === 'history' && (
            filteredHistory.length ===
            0 ? (
              <div style={styles.empty}>
                {t.noHistory}
              </div>
            ) : (
              filteredHistory.map(
                renderHistoryItem
              )
            )
          )}
        </>
      )}

      {/* ====================================================== */}
      {/* CREATE REQUEST MODAL */}
      {/* ====================================================== */}

      {showCreate && (
        <div
          style={styles.modal}
          onClick={() =>
            setShowCreate(false)
          }
        >
          <div
            style={styles.modalContent}
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <h2
              style={
                styles.modalTitle
              }
            >
              ➕ {t.createRequest}
            </h2>

            <form
              onSubmit={handleCreate}
            >
              <select
                style={
                  styles.modalInput
                }
                value={
                  formData.asset_id
                }
                onChange={(event) =>
                  setFormData({
                    ...formData,
                    asset_id:
                      event.target
                        .value
                  })
                }
                required
              >
                <option value="">
                  {t.selectAsset}
                </option>

                {assets.map(
                  (asset) => (
                    <option
                      key={asset.id}
                      value={asset.id}
                    >
                      {safeText(
                        asset.asset_tag
                      )}{' '}
                      -{' '}
                      {safeText(
                        asset.name
                      )}
                    </option>
                  )
                )}
              </select>

              <input
                type="text"
                style={
                  styles.modalInput
                }
                placeholder={
                  t.title
                }
                value={
                  formData.title
                }
                onChange={(event) =>
                  setFormData({
                    ...formData,
                    title:
                      event.target
                        .value
                  })
                }
                required
              />

              <textarea
                style={
                  styles.textarea
                }
                placeholder={
                  t.description
                }
                value={
                  formData.description
                }
                onChange={(event) =>
                  setFormData({
                    ...formData,
                    description:
                      event.target
                        .value
                  })
                }
                required
              />

              <div
                style={
                  styles.formGrid
                }
              >
                <select
                  style={
                    styles.modalInput
                  }
                  value={
                    formData.type
                  }
                  onChange={(event) =>
                    setFormData({
                      ...formData,
                      type:
                        event.target
                          .value
                    })
                  }
                >
                  <option value="Corrective">
                    {t.corrective}
                  </option>
                  <option value="Preventive">
                    {t.preventive}
                  </option>
                  <option value="Emergency">
                    {t.emergency}
                  </option>
                  <option value="Scheduled">
                    {t.scheduled}
                  </option>
                </select>

                <select
                  style={
                    styles.modalInput
                  }
                  value={
                    formData.priority
                  }
                  onChange={(event) =>
                    setFormData({
                      ...formData,
                      priority:
                        event.target
                          .value
                    })
                  }
                >
                  <option value="Low">
                    {t.low}
                  </option>
                  <option value="Medium">
                    {t.medium}
                  </option>
                  <option value="High">
                    {t.high}
                  </option>
                  <option value="Critical">
                    {t.critical}
                  </option>
                </select>
              </div>

              <div
                style={
                  styles.formGrid
                }
              >
                <input
                  type="date"
                  style={
                    styles.modalInput
                  }
                  value={
                    formData.scheduled_date
                  }
                  onChange={(event) =>
                    setFormData({
                      ...formData,
                      scheduled_date:
                        event.target
                          .value
                    })
                  }
                />

                <input
                  type="date"
                  style={
                    styles.modalInput
                  }
                  value={
                    formData.due_date
                  }
                  onChange={(event) =>
                    setFormData({
                      ...formData,
                      due_date:
                        event.target
                          .value
                    })
                  }
                />
              </div>

              <select
                style={
                  styles.modalInput
                }
                value={
                  formData.technician_id
                }
                onChange={(event) =>
                  setFormData({
                    ...formData,
                    technician_id:
                      event.target
                        .value
                  })
                }
              >
                <option value="">
                  {t.assignTechnician}
                </option>

                {technicians.map(
                  (tech) => (
                    <option
                      key={tech.id}
                      value={tech.id}
                    >
                      {safeText(
                        tech.full_name ||
                        tech.fullName ||
                        tech.username
                      )}
                    </option>
                  )
                )}
              </select>

              <input
                type="number"
                min="0"
                step="0.01"
                style={
                  styles.modalInput
                }
                placeholder={
                  t.estimatedCost
                }
                value={
                  formData.estimated_cost
                }
                onChange={(event) =>
                  setFormData({
                    ...formData,
                    estimated_cost:
                      event.target
                        .value
                  })
                }
              />

              <div
                style={
                  styles.formActions
                }
              >
                <button
                  type="submit"
                  style={
                    styles.button()
                  }
                  disabled={saving}
                >
                  {saving
                    ? t.saving
                    : `✅ ${t.submit}`}
                </button>

                <button
                  type="button"
                  style={
                    styles.button(
                      '#e53e3e'
                    )
                  }
                  onClick={() =>
                    setShowCreate(false)
                  }
                >
                  ❌ {t.cancel}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================== */}
      {/* SCHEDULED MODAL */}
      {/* ====================================================== */}

      {showScheduledCreate && (
        <div
          style={styles.modal}
          onClick={() =>
            setShowScheduledCreate(
              false
            )
          }
        >
          <div
            style={styles.modalContent}
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <h2
              style={
                styles.modalTitle
              }
            >
              📅 {t.createScheduled}
            </h2>

            <form
              onSubmit={
                handleScheduledCreate
              }
            >
              <select
                style={
                  styles.modalInput
                }
                value={
                  scheduledFormData.asset_id
                }
                onChange={(event) =>
                  setScheduledFormData({
                    ...scheduledFormData,
                    asset_id:
                      event.target
                        .value
                  })
                }
                required
              >
                <option value="">
                  {t.selectAsset}
                </option>

                {assets.map(
                  (asset) => (
                    <option
                      key={asset.id}
                      value={asset.id}
                    >
                      {safeText(
                        asset.asset_tag
                      )}{' '}
                      -{' '}
                      {safeText(
                        asset.name
                      )}
                    </option>
                  )
                )}
              </select>

              <select
                style={
                  styles.modalInput
                }
                value={
                  scheduledFormData.maintenance_type
                }
                onChange={(event) =>
                  setScheduledFormData({
                    ...scheduledFormData,
                    maintenance_type:
                      event.target
                        .value
                  })
                }
              >
                <option value="Preventive">
                  {t.preventive}
                </option>

                <option value="Scheduled">
                  {t.scheduled}
                </option>

                <option value="Inspection">
                  {t.inspection}
                </option>

                <option value="Calibration">
                  {t.calibration}
                </option>
              </select>

              <select
                style={
                  styles.modalInput
                }
                value={
                  scheduledFormData.technician_id
                }
                onChange={(event) =>
                  setScheduledFormData({
                    ...scheduledFormData,
                    technician_id:
                      event.target
                        .value
                  })
                }
              >
                <option value="">
                  {t.assignTechnician}
                </option>

                {technicians.map(
                  (tech) => (
                    <option
                      key={tech.id}
                      value={tech.id}
                    >
                      {safeText(
                        tech.full_name ||
                        tech.fullName ||
                        tech.username
                      )}
                    </option>
                  )
                )}
              </select>

              <div
                style={
                  styles.formGrid
                }
              >
                <input
                  type="date"
                  style={
                    styles.modalInput
                  }
                  value={
                    scheduledFormData.scheduled_date
                  }
                  onChange={(event) =>
                    setScheduledFormData({
                      ...scheduledFormData,
                      scheduled_date:
                        event.target
                          .value
                    })
                  }
                  required
                />

                <input
                  type="date"
                  style={
                    styles.modalInput
                  }
                  value={
                    scheduledFormData.expected_completion
                  }
                  onChange={(event) =>
                    setScheduledFormData({
                      ...scheduledFormData,
                      expected_completion:
                        event.target
                          .value
                    })
                  }
                />
              </div>

              <select
                style={
                  styles.modalInput
                }
                value={
                  scheduledFormData.priority
                }
                onChange={(event) =>
                  setScheduledFormData({
                    ...scheduledFormData,
                    priority:
                      event.target
                        .value
                  })
                }
              >
                <option value="Low">
                  {t.low}
                </option>

                <option value="Medium">
                  {t.medium}
                </option>

                <option value="High">
                  {t.high}
                </option>

                <option value="Critical">
                  {t.critical}
                </option>
              </select>

              <textarea
                style={
                  styles.textarea
                }
                placeholder={
                  t.notes
                }
                value={
                  scheduledFormData.notes
                }
                onChange={(event) =>
                  setScheduledFormData({
                    ...scheduledFormData,
                    notes:
                      event.target
                        .value
                  })
                }
              />

              <label
                style={{
                  color: isDark
                    ? '#c8dcf5'
                    : '#1a365d',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '12px'
                }}
              >
                <input
                  type="checkbox"
                  checked={
                    scheduledFormData.recurring
                  }
                  onChange={(event) =>
                    setScheduledFormData({
                      ...scheduledFormData,
                      recurring:
                        event.target
                          .checked
                    })
                  }
                />

                {t.recurring}
              </label>

              {scheduledFormData.recurring && (
                <input
                  type="number"
                  min="1"
                  style={
                    styles.modalInput
                  }
                  placeholder={
                    t.intervalDays
                  }
                  value={
                    scheduledFormData.interval_days
                  }
                  onChange={(event) =>
                    setScheduledFormData({
                      ...scheduledFormData,
                      interval_days:
                        Number(
                          event.target
                            .value
                        )
                    })
                  }
                />
              )}

              <div
                style={
                  styles.formActions
                }
              >
                <button
                  type="submit"
                  style={styles.button(
                    '#805ad5'
                  )}
                  disabled={saving}
                >
                  {saving
                    ? t.saving
                    : `✅ ${t.submit}`}
                </button>

                <button
                  type="button"
                  style={styles.button(
                    '#e53e3e'
                  )}
                  onClick={() =>
                    setShowScheduledCreate(
                      false
                    )
                  }
                >
                  ❌ {t.cancel}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================== */}
      {/* COST MODAL */}
      {/* ====================================================== */}

      {showCostModal &&
        selectedMaintenance && (
          <div
            style={styles.modal}
            onClick={() =>
              setShowCostModal(false)
            }
          >
            <div
              style={{
                ...styles.modalContent,
                maxWidth: '550px'
              }}
              onClick={(event) =>
                event.stopPropagation()
              }
            >
              <h2
                style={
                  styles.modalTitle
                }
              >
                💰 {t.maintenanceCost}
              </h2>

              <p
                style={{
                  color: isDark
                    ? '#a0aec0'
                    : '#4a5568'
                }}
              >
                <strong>
                  {safeText(
                    selectedMaintenance?.title ||
                    selectedMaintenance?.problem
                  )}
                </strong>
              </p>

              <div
                style={
                  styles.costGrid
                }
              >
                <div
                  style={
                    styles.costCard
                  }
                >
                  <div
                    style={
                      styles.costLabel
                    }
                  >
                    {t.laborCost}
                  </div>

                  <div
                    style={
                      styles.costValue
                    }
                  >
                    {formatCurrency(
                      getLaborCost(
                        selectedMaintenance
                      )
                    )}
                  </div>
                </div>

                <div
                  style={
                    styles.costCard
                  }
                >
                  <div
                    style={
                      styles.costLabel
                    }
                  >
                    {t.partsCost}
                  </div>

                  <div
                    style={
                      styles.costValue
                    }
                  >
                    {formatCurrency(
                      getPartsCost(
                        selectedMaintenance
                      )
                    )}
                  </div>
                </div>

                <div
                  style={
                    styles.costCard
                  }
                >
                  <div
                    style={
                      styles.costLabel
                    }
                  >
                    {t.serviceCost}
                  </div>

                  <div
                    style={
                      styles.costValue
                    }
                  >
                    {formatCurrency(
                      getServiceCost(
                        selectedMaintenance
                      )
                    )}
                  </div>
                </div>

                <div
                  style={
                    styles.costCard
                  }
                >
                  <div
                    style={
                      styles.costLabel
                    }
                  >
                    {t.totalCost}
                  </div>

                  <div
                    style={
                      styles.costValue
                    }
                  >
                    {formatCurrency(
                      getTotalCost(
                        selectedMaintenance
                      )
                    )}
                  </div>
                </div>
              </div>

              <button
                style={{
                  ...styles.button(
                    '#718096'
                  ),
                  marginTop: '20px'
                }}
                onClick={() =>
                  setShowCostModal(false)
                }
              >
                {t.close}
              </button>
            </div>
          </div>
        )}

      {/* ====================================================== */}
      {/* HISTORY MODAL */}
      {/* ====================================================== */}

      {showHistoryModal && (
        <div
          style={styles.modal}
          onClick={() =>
            setShowHistoryModal(
              false
            )
          }
        >
          <div
            style={{
              ...styles.modalContent,
              maxWidth: '800px'
            }}
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <h2
              style={
                styles.modalTitle
              }
            >
              📜 {t.maintenanceHistory}
              {' - '}
              {safeText(
                selectedAsset?.name
              )}
            </h2>

            {maintenanceHistory.length ===
            0 ? (
              <div style={styles.empty}>
                {t.noMaintenanceHistory}
              </div>
            ) : (
              maintenanceHistory.map(
                renderHistoryItem
              )
            )}

            <button
              style={{
                ...styles.button(
                  '#718096'
                ),
                marginTop: '15px'
              }}
              onClick={() =>
                setShowHistoryModal(
                  false
                )
              }
            >
              {t.close}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================
// ENGLISH TRANSLATIONS
// ============================================================

const englishTranslations = {
  maintenance: 'Maintenance',

  requests: 'Requests',

  scheduledMaintenance:
    'Scheduled Maintenance',

  pending: 'Pending',

  inProgress: 'In Progress',

  completed: 'Completed',

  technicians: 'Technicians',

  maintenanceCost:
    'Maintenance Cost',

  history: 'Maintenance History',

  createRequest:
    'Create Maintenance Request',

  createScheduled:
    'Create Scheduled Maintenance',

  manageRequests:
    'Manage maintenance requests',

  manageScheduled:
    'Manage scheduled maintenance',

  pendingDescription:
    'Maintenance requests waiting to be processed',

  progressDescription:
    'Maintenance tasks currently in progress',

  completedDescription:
    'Completed maintenance tasks',

  manageTechnicians:
    'Manage and assign maintenance technicians',

  manageCosts:
    'Track maintenance expenses and costs',

  viewHistory:
    'View all maintenance records',

  totalRequests:
    'Total Requests',

  approved:
    'Approved',

  assigned:
    'Assigned',

  allStatus:
    'All Status',

  allPriorities:
    'All Priorities',

  filter:
    'Filter',

  refresh:
    'Refresh',

  loading:
    'Loading...',

  saving:
    'Saving...',

  noRequests:
    'No maintenance requests found',

  noPending:
    'No pending maintenance requests',

  noInProgress:
    'No maintenance tasks are currently in progress',

  noCompleted:
    'No completed maintenance tasks',

  noScheduled:
    'No scheduled maintenance found',

  noTechnicians:
    'No technicians found',

  noHistory:
    'No maintenance history found',

  noMaintenanceHistory:
    'No maintenance history for this asset',

  noCostRecords:
    'No maintenance cost records found',

  searchMaintenance:
    'Search maintenance...',

  searchHistory:
    'Search history...',

  all: 'All',

  asset: 'Asset',

  type: 'Type',

  reportedBy:
    'Reported By',

  created:
    'Created',

  approve:
    'Approve',

  reject:
    'Reject',

  complete:
    'Complete',

  start:
    'Start',

  assignTechnician:
    'Assign Technician',

  technician:
    'Technician',

  selectAsset:
    'Select Asset',

  title:
    'Maintenance Title',

  titleRequired:
    'Maintenance title is required',

  description:
    'Description',

  corrective:
    'Corrective',

  preventive:
    'Preventive',

  emergency:
    'Emergency',

  scheduled:
    'Scheduled',

  inspection:
    'Inspection',

  calibration:
    'Calibration',

  scheduledDate:
    'Scheduled Date',

  dueDate:
    'Due Date',

  expectedCompletion:
    'Expected Completion',

  estimatedCost:
    'Estimated Cost',

  actualCost:
    'Actual Cost',

  laborCost:
    'Labor Cost',

  partsCost:
    'Parts Cost',

  serviceCost:
    'Service Cost',

  totalCost:
    'Total Cost',

  low:
    'Low',

  medium:
    'Medium',

  high:
    'High',

  critical:
    'Critical',

  submit:
    'Submit',

  cancel:
    'Cancel',

  close:
    'Close',

  notes:
    'Notes',

  partsUsed:
    'Parts Used',

  resolution:
    'Resolution',

  problem:
    'Problem',

  recurring:
    'Recurring',

  days:
    'days',

  intervalDays:
    'Interval (days)',

  reminder:
    'Remind',

  reminderSent:
    'Reminder sent successfully',

  cost:
    'Cost',

  viewCost:
    'View Cost',

  costBreakdown:
    'Maintenance Cost Breakdown',

  notAssigned:
    'Not assigned',

  assetNotFound:
    'Asset not found',

  requestCreated:
    'Maintenance request created successfully',

  scheduledCreated:
    'Scheduled maintenance created successfully',

  requestApproved:
    'Request approved successfully',

  requestRejected:
    'Request rejected successfully',

  technicianAssigned:
    'Technician assigned successfully',

  maintenanceStarted:
    'Maintenance started',

  maintenanceCompleted:
    'Maintenance completed successfully',

  technicianManagement:
    'Technician management can be expanded here',

  manage:
    'Manage',

  completedByAdmin:
    'Completed by admin',

  createFailed:
    'Failed to create maintenance request',

  approveFailed:
    'Failed to approve request',

  rejectFailed:
    'Failed to reject request',

  assignFailed:
    'Failed to assign technician',

  startFailed:
    'Failed to start maintenance',

  completeFailed:
    'Failed to complete maintenance',

  historyFailed:
    'Failed to load maintenance history',

  loadFailed:
    'Failed to load maintenance data'
};

// ============================================================
// AMHARIC TRANSLATIONS
// ============================================================

const amharicTranslations = {
  maintenance: 'ጥገና',

  requests: 'የጥገና ጥያቄዎች',

  scheduledMaintenance:
    'የታቀደ ጥገና',

  pending:
    'በመጠባበቅ ላይ',

  inProgress:
    'በሂደት ላይ',

  completed:
    'ተጠናቋል',

  technicians:
    'ቴክኒሺያኖች',

  maintenanceCost:
    'የጥገና ወጪ',

  history:
    'የጥገና ታሪክ',

  createRequest:
    'የጥገና ጥያቄ ፍጠር',

  createScheduled:
    'የታቀደ ጥገና ፍጠር',

  manageRequests:
    'የጥገና ጥያቄዎችን ያስተዳድሩ',

  manageScheduled:
    'የታቀዱ ጥገናዎችን ያስተዳድሩ',

  pendingDescription:
    'ለመከናወን የሚጠብቁ የጥገና ጥያቄዎች',

  progressDescription:
    'በአሁኑ ጊዜ በሂደት ላይ ያሉ የጥገና ስራዎች',

  completedDescription:
    'የተጠናቀቁ የጥገና ስራዎች',

  manageTechnicians:
    'የጥገና ቴክኒሺያኖችን ያስተዳድሩና ይመድቡ',

  manageCosts:
    'የጥገና ወጪዎችን ይከታተሉ',

  viewHistory:
    'ሁሉንም የጥገና መዝገቦች ይመልከቱ',

  totalRequests:
    'ጠቅላላ ጥያቄዎች',

  approved:
    'ተፅድቋል',

  assigned:
    'ተመድቧል',

  allStatus:
    'ሁሉም ሁኔታዎች',

  allPriorities:
    'ሁሉም ቅድሚያዎች',

  filter:
    'ማጣሪያ',

  refresh:
    'አድስ',

  loading:
    'በመጫን ላይ...',

  saving:
    'በማስቀመጥ ላይ...',

  noRequests:
    'ምንም የጥገና ጥያቄ አልተገኘም',

  noPending:
    'ምንም በመጠባበቅ ላይ ያለ ጥገና የለም',

  noInProgress:
    'በሂደት ላይ ያለ ጥገና የለም',

  noCompleted:
    'የተጠናቀቀ ጥገና አልተገኘም',

  noScheduled:
    'ምንም የታቀደ ጥገና አልተገኘም',

  noTechnicians:
    'ምንም ቴክኒሺያን አልተገኘም',

  noHistory:
    'ምንም የጥገና ታሪክ አልተገኘም',

  noMaintenanceHistory:
    'ለዚህ ንብረት የጥገና ታሪክ የለም',

  noCostRecords:
    'ምንም የጥገና ወጪ መዝገብ አልተገኘም',

  searchMaintenance:
    'የጥገና መረጃ ፈልግ...',

  searchHistory:
    'ታሪክ ውስጥ ፈልግ...',

  asset:
    'ንብረት',

  type:
    'አይነት',

  reportedBy:
    'አቅራቢ',

  created:
    'ተፈጥሯል',

  approve:
    'አፅድቅ',

  reject:
    'ውድቅ አድርግ',

  complete:
    'ጨርስ',

  start:
    'ጀምር',

  assignTechnician:
    'ቴክኒሺያን መድብ',

  technician:
    'ቴክኒሺያን',

  selectAsset:
    'ንብረት ይምረጡ',

  title:
    'የጥገና ርዕስ',

  titleRequired:
    'የጥገና ርዕስ ያስፈልጋል',

  description:
    'መግለጫ',

  corrective:
    'ማስተካከያ',

  preventive:
    'መከላከያ',

  emergency:
    'አስቸኳይ',

  scheduled:
    'የታቀደ',

  inspection:
    'ምርመራ',

  calibration:
    'ማስተካከያ',

  scheduledDate:
    'የታቀደ ቀን',

  dueDate:
    'የማጠናቀቂያ ቀን',

  expectedCompletion:
    'የሚጠበቅ ማጠናቀቂያ',

  estimatedCost:
    'የግምት ወጪ',

  actualCost:
    'ትክክለኛ ወጪ',

  laborCost:
    'የሰራተኛ ወጪ',

  partsCost:
    'የእቃ/ክፍል ወጪ',

  serviceCost:
    'የአገልግሎት ወጪ',

  totalCost:
    'ጠቅላላ ወጪ',

  low:
    'ዝቅተኛ',

  medium:
    'መካከለኛ',

  high:
    'ከፍተኛ',

  critical:
    'አስቸኳይ',

  submit:
    'አስገባ',

  cancel:
    'ሰርዝ',

  close:
    'ዝጋ',

  notes:
    'ማስታወሻ',

  partsUsed:
    'የተጠቀሙት ክፍሎች',

  resolution:
    'መፍትሔ',

  problem:
    'ችግር',

  recurring:
    'ተደጋጋሚ',

  days:
    'ቀናት',

  intervalDays:
    'የጊዜ ክፍተት',

  reminder:
    'አሳስብ',

  reminderSent:
    'ማሳሰቢያ ተልኳል',

  cost:
    'ወጪ',

  viewCost:
    'ወጪ ይመልከቱ',

  costBreakdown:
    'የጥገና ወጪ ዝርዝር',

  notAssigned:
    'አልተመደበም',

  assetNotFound:
    'ንብረቱ አልተገኘም',

  requestCreated:
    'የጥገና ጥያቄ በተሳካ ሁኔታ ተፈጥሯል',

  scheduledCreated:
    'የታቀደ ጥገና በተሳካ ሁኔታ ተፈጥሯል',

  requestApproved:
    'ጥያቄው በተሳካ ሁኔታ ፀድቋል',

  requestRejected:
    'ጥያቄው ውድቅ ተደርጓል',

  technicianAssigned:
    'ቴክኒሺያን በተሳካ ሁኔታ ተመድቧል',

  maintenanceStarted:
    'ጥገና ተጀምሯል',

  maintenanceCompleted:
    'ጥገና በተሳካ ሁኔታ ተጠናቋል',

  technicianManagement:
    'የቴክኒሺያን አስተዳደር',

  manage:
    'አስተዳድር',

  completedByAdmin:
    'በአስተዳዳሪ ተጠናቋል',

  createFailed:
    'የጥገና ጥያቄ መፍጠር አልተቻለም',

  approveFailed:
    'ጥያቄውን ማፅደቅ አልተቻለም',

  rejectFailed:
    'ጥያቄውን ውድቅ ማድረግ አልተቻለም',

  assignFailed:
    'ቴክኒሺያን መመደብ አልተቻለም',

  startFailed:
    'ጥገና መጀመር አልተቻለም',

  completeFailed:
    'ጥገና ማጠናቀቅ አልተቻለም',

  historyFailed:
    'የጥገና ታሪክ ማግኘት አልተቻለም',

  loadFailed:
    'የጥገና መረጃ መጫን አልተቻለም'
};

export default AdminMaintenance;
