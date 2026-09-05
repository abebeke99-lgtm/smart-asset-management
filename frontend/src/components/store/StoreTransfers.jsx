import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/UiContext';
import { getDepartmentLabel } from '../../utils/department';

const StoreTransfers = () => {
  const { user } = useAuth();
  const { language, theme } = useLanguage();

  const isDark = theme === 'dark';
  const isAmharic = language === 'am';

  const [transfers, setTransfers] = useState([]);
  const [assets, setAssets] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const [activeTab, setActiveTab] = useState('new');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [selectedTransfer, setSelectedTransfer] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  const [form, setForm] = useState({
    assetId: '',
    targetDepartment: '',
    targetUser: '',
    quantity: 1,
    reason: '',
    remarks: ''
  });

  const t = isAmharic
    ? {
        title: 'የንብረት ዝውውር',
        subtitle: 'የንብረት ዝውውርን ይፍጠሩ፣ ይከታተሉ እና ያስተዳድሩ',

        newTransfer: 'አዲስ ዝውውር',
        pending: 'በመጠባበቅ ላይ',
        approved: 'የተፈቀደ',
        incoming: 'የሚገባ',
        outgoing: 'የሚወጣ',
        completed: 'የተጠናቀቀ',
        history: 'የዝውውር ታሪክ',

        asset: 'ንብረት',
        selectAsset: 'ንብረት ይምረጡ',
        targetDepartment: 'የዒላማ ክፍል',
        selectDepartment: 'ክፍል ይምረጡ',
        targetUser: 'የዒላማ ተጠቃሚ',
        selectUser: 'ተጠቃሚ ይምረጡ',
        quantity: 'ብዛት',
        reason: 'ምክንያት',
        remarks: 'ማስታወሻ',

        createTransfer: 'ዝውውር ፍጠር',
        export: 'ወደ Excel ላክ',
        search: 'ፈልግ...',
        all: 'ሁሉም',

        status: 'ሁኔታ',
        from: 'ከ',
        to: 'ወደ',
        date: 'ቀን',
        actions: 'ተግባራት',
        details: 'ዝርዝር',
        close: 'ዝጋ',

        noTransfers: 'ምንም የዝውውር መዝገብ አልተገኘም',
        loading: 'በመጫን ላይ...',
        loadingData: 'ውሂብ በመጫን ላይ...',

        pendingStatus: 'Pending',
        approvedStatus: 'Approved',
        completedStatus: 'Completed',
        rejectedStatus: 'Rejected',
        cancelledStatus: 'Cancelled',
        inTransitStatus: 'In Transit',

        createSuccess: 'ዝውውሩ በተሳካ ሁኔታ ተፈጥሯል',
        createError: 'ዝውውሩን መፍጠር አልተቻለም',
        fetchError: 'የዝውውር መረጃ መጫን አልተቻለም',
        required: 'እባክዎ አስፈላጊ መረጃዎችን ይሙሉ',
        exportSuccess: 'ወደ Excel ተልኳል'
      }
    : {
        title: 'Asset Transfers',
        subtitle: 'Create, track, approve and manage asset transfers',

        newTransfer: 'New Transfer',
        pending: 'Pending Transfers',
        approved: 'Approved Transfers',
        incoming: 'Incoming Transfers',
        outgoing: 'Outgoing Transfers',
        completed: 'Completed Transfers',
        history: 'Transfer History',

        asset: 'Asset',
        selectAsset: 'Select Asset',
        targetDepartment: 'Target Department',
        selectDepartment: 'Select Department',
        targetUser: 'Target User',
        selectUser: 'Select User',
        quantity: 'Quantity',
        reason: 'Reason',
        remarks: 'Remarks',

        createTransfer: 'Create Transfer',
        export: 'Export Excel',
        search: 'Search...',
        all: 'All',

        status: 'Status',
        from: 'From',
        to: 'To',
        date: 'Date',
        actions: 'Actions',
        details: 'Details',
        close: 'Close',

        noTransfers: 'No transfer records found',
        loading: 'Loading...',
        loadingData: 'Loading data...',

        pendingStatus: 'Pending',
        approvedStatus: 'Approved',
        completedStatus: 'Completed',
        rejectedStatus: 'Rejected',
        cancelledStatus: 'Cancelled',
        inTransitStatus: 'In Transit',

        createSuccess: 'Transfer created successfully',
        createError: 'Failed to create transfer',
        fetchError: 'Failed to load transfer data',
        required: 'Please complete all required fields',
        exportSuccess: 'Exported successfully'
      };

  /*
   * ---------------------------------------------------------
   * DATA LOADING
   * ---------------------------------------------------------
   */

  const fetchData = useCallback(async () => {
    setLoading(true);

    try {
      const requests = [
        axios.get('/api/transfers'),
        axios.get('/api/inventory'),
        axios.get('/api/departments'),
        axios.get('/api/users', {
          params: { limit: 500 }
        })
      ];

      const [
        transfersResponse,
        inventoryResponse,
        departmentsResponse,
        usersResponse
      ] = await Promise.all(requests);

      const transferData =
        transfersResponse.data?.data ||
        transfersResponse.data?.transfers ||
        [];

      const inventoryData =
        inventoryResponse.data?.inventory ||
        inventoryResponse.data?.data ||
        [];

      const departmentData =
        departmentsResponse.data?.departments ||
        departmentsResponse.data?.data ||
        [];

      const userData =
        usersResponse.data?.users ||
        usersResponse.data?.data ||
        [];

      setTransfers(Array.isArray(transferData) ? transferData : []);
      setAssets(Array.isArray(inventoryData) ? inventoryData : []);
      setDepartments(Array.isArray(departmentData) ? departmentData : []);
      setUsers(Array.isArray(userData) ? userData : []);
    } catch (error) {
      console.error('StoreTransfers fetch error:', error);

      setTransfers([]);
      setAssets([]);
      setDepartments([]);
      setUsers([]);

      toast.error(t.fetchError);
    } finally {
      setLoading(false);
    }
  }, [t.fetchError]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /*
   * ---------------------------------------------------------
   * NORMALIZATION HELPERS
   * ---------------------------------------------------------
   */

  const getValue = (item, ...keys) => {
    for (const key of keys) {
      if (
        item &&
        item[key] !== undefined &&
        item[key] !== null &&
        item[key] !== ''
      ) {
        return item[key];
      }
    }

    return '';
  };

  const getTransferStatus = (item) => {
    const status = getValue(
      item,
      'status',
      'transfer_status',
      'transferStatus'
    );

    if (!status) return 'Pending';

    return String(status);
  };

  const normalizeStatus = (status) =>
    String(status || '')
      .trim()
      .toLowerCase()
      .replace(/_/g, ' ');

  const getAssetId = (asset) =>
    getValue(asset, 'asset_id', 'assetId', 'id');

  const getAssetName = (asset) =>
    getValue(
      asset,
      'name',
      'asset_name',
      'assetName',
      'asset_tag',
      'assetCode'
    ) || 'Unnamed Asset';

  const getTransferAssetName = (item) =>
    getValue(
      item,
      'asset_name',
      'assetName',
      'name',
      'asset_tag',
      'assetCode'
    ) || 'Asset';

  const getSourceDepartment = (item) =>
    getValue(
      item,
      'source_department',
      'sourceDepartment',
      'from_department',
      'fromDepartment',
      'department'
    ) || 'N/A';

  const getTargetDepartment = (item) =>
    getValue(
      item,
      'destination_department',
      'destinationDepartment',
      'target_department',
      'targetDepartment',
      'new_department',
      'newDepartment'
    ) || getValue(item, 'new_location', 'newLocation') || 'N/A';

  const getTransferDate = (item) =>
    getValue(
      item,
      'created_at',
      'createdAt',
      'transfer_date',
      'transferDate',
      'date'
    );

  const getTransferId = (item) =>
    getValue(
      item,
      'transfer_id',
      'transferId',
      'id'
    );

  /*
   * ---------------------------------------------------------
   * AVAILABLE ASSETS
   * ---------------------------------------------------------
   */

  const availableAssets = useMemo(() => {
    return assets.filter((asset) => {
      const status = normalizeStatus(
        getValue(asset, 'status', 'asset_status', 'assetStatus')
      );

      const available =
        asset.is_available === true ||
        asset.isAvailable === true ||
        status === 'available' ||
        Number(
          getValue(
            asset,
            'available_quantity',
            'availableQuantity'
          )
        ) > 0;

      return available;
    });
  }, [assets]);

  /*
   * ---------------------------------------------------------
   * FILTERING
   * ---------------------------------------------------------
   */

  const filteredTransfers = useMemo(() => {
    let result = [...transfers];

    if (search.trim()) {
      const query = search.toLowerCase();

      result = result.filter((item) => {
        const values = [
          getTransferId(item),
          getTransferAssetName(item),
          getSourceDepartment(item),
          getTargetDepartment(item),
          getValue(item, 'user_name', 'userName'),
          getValue(item, 'reason'),
          getTransferStatus(item)
        ];

        return values.some((value) =>
          String(value || '')
            .toLowerCase()
            .includes(query)
        );
      });
    }

    if (statusFilter !== 'all') {
      result = result.filter(
        (item) =>
          normalizeStatus(getTransferStatus(item)) ===
          normalizeStatus(statusFilter)
      );
    }

    switch (activeTab) {
      case 'pending':
        result = result.filter((item) =>
          ['pending', 'pending approval', 'requested'].includes(
            normalizeStatus(getTransferStatus(item))
          )
        );
        break;

      case 'approved':
        result = result.filter((item) =>
          ['approved', 'in transit'].includes(
            normalizeStatus(getTransferStatus(item))
          )
        );
        break;

      case 'incoming':
        result = result.filter((item) => {
          const direction = normalizeStatus(
            getValue(item, 'direction', 'transfer_direction')
          );

          return (
            direction === 'incoming' ||
            direction === 'in' ||
            direction === 'inbound' ||
            item.is_incoming === true ||
            item.isIncoming === true
          );
        });
        break;

      case 'outgoing':
        result = result.filter((item) => {
          const direction = normalizeStatus(
            getValue(item, 'direction', 'transfer_direction')
          );

          return (
            direction === 'outgoing' ||
            direction === 'out' ||
            direction === 'outbound' ||
            item.is_outgoing === true ||
            item.isOutgoing === true
          );
        });
        break;

      case 'completed':
        result = result.filter((item) =>
          ['completed', 'complete', 'received', 'closed'].includes(
            normalizeStatus(getTransferStatus(item))
          )
        );
        break;

      case 'history':
        break;

      default:
        break;
    }

    return result;
  }, [transfers, search, statusFilter, activeTab]);

  /*
   * ---------------------------------------------------------
   * CREATE TRANSFER
   * ---------------------------------------------------------
   */

  const handleFormChange = (field, value) => {
    setForm((previous) => ({
      ...previous,
      [field]: value
    }));
  };

  const resetForm = () => {
    setForm({
      assetId: '',
      targetDepartment: '',
      targetUser: '',
      quantity: 1,
      reason: '',
      remarks: ''
    });
  };

  const handleCreateTransfer = async (event) => {
    event.preventDefault();

    if (
      !form.assetId ||
      !form.targetDepartment ||
      Number(form.quantity) <= 0
    ) {
      toast.error(t.required);
      return;
    }

    setProcessing(true);

    try {
      const payload = {
        asset_id: form.assetId,
        new_department_id: form.targetDepartment,
        new_user_id: form.targetUser || undefined,
        quantity: Number(form.quantity),
        reason: form.reason,
        remarks: form.remarks,
        transferred_by: user?.id
      };

      await axios.post('/api/transfers', payload);

      toast.success(t.createSuccess);

      resetForm();
      await fetchData();

      setActiveTab('pending');
    } catch (error) {
      console.error('Create transfer error:', error);

      const message =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        t.createError;

      toast.error(message);
    } finally {
      setProcessing(false);
    }
  };

  /*
   * ---------------------------------------------------------
   * DETAILS
   * ---------------------------------------------------------
   */

  const openDetails = (transfer) => {
    setSelectedTransfer(transfer);
    setShowDetails(true);
  };

  const closeDetails = () => {
    setSelectedTransfer(null);
    setShowDetails(false);
  };

  /*
   * ---------------------------------------------------------
   * EXPORT
   * ---------------------------------------------------------
   */

  const exportToExcel = () => {
    const data = filteredTransfers.map((item) => ({
      'Transfer ID': getTransferId(item),
      'Asset': getTransferAssetName(item),
      'From': getSourceDepartment(item),
      'To': getTargetDepartment(item),
      'User': getValue(item, 'user_name', 'userName'),
      'Quantity': getValue(item, 'quantity') || 1,
      'Status': getTransferStatus(item),
      'Reason': getValue(item, 'reason'),
      'Date': getTransferDate(item)
        ? new Date(getTransferDate(item)).toLocaleDateString()
        : ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      'Asset Transfers'
    );

    XLSX.writeFile(workbook, 'asset_transfers.xlsx');

    toast.success(t.exportSuccess);
  };

  /*
   * ---------------------------------------------------------
   * STATUS COLOR
   * ---------------------------------------------------------
   */

  const getStatusColor = (status) => {
    switch (normalizeStatus(status)) {
      case 'pending':
      case 'pending approval':
      case 'requested':
        return '#f59e0b';

      case 'approved':
        return '#2563eb';

      case 'in transit':
        return '#7c3aed';

      case 'completed':
      case 'complete':
      case 'received':
      case 'closed':
        return '#16a34a';

      case 'rejected':
        return '#dc2626';

      case 'cancelled':
      case 'canceled':
        return '#64748b';

      default:
        return '#475569';
    }
  };

  /*
   * ---------------------------------------------------------
   * STYLES
   * ---------------------------------------------------------
   */

  const colors = {
    background: isDark ? '#0f172a' : '#f8fafc',
    card: isDark ? '#1e293b' : '#ffffff',
    cardSecondary: isDark ? '#172033' : '#f8fafc',
    border: isDark ? '#334155' : '#e2e8f0',
    text: isDark ? '#f1f5f9' : '#0f172a',
    muted: isDark ? '#94a3b8' : '#64748b',
    input: isDark ? '#0f172a' : '#ffffff'
  };

  const styles = {
    page: {
      minHeight: '100vh',
      padding: '24px',
      background: colors.background,
      color: colors.text,
      boxSizing: 'border-box'
    },

    wrapper: {
      maxWidth: '1500px',
      margin: '0 auto'
    },

    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: '20px',
      flexWrap: 'wrap',
      marginBottom: '24px'
    },

    title: {
      margin: 0,
      fontSize: '1.8rem',
      fontWeight: 800,
      color: colors.text
    },

    subtitle: {
      margin: '7px 0 0',
      color: colors.muted,
      fontSize: '0.95rem'
    },

    headerButtons: {
      display: 'flex',
      gap: '10px',
      flexWrap: 'wrap'
    },

    exportButton: {
      border: 'none',
      borderRadius: '8px',
      padding: '10px 16px',
      background: '#16a34a',
      color: '#fff',
      fontWeight: 700,
      cursor: 'pointer'
    },

    tabs: {
      display: 'flex',
      gap: '5px',
      flexWrap: 'wrap',
      padding: '5px',
      marginBottom: '20px',
      background: colors.card,
      border: `1px solid ${colors.border}`,
      borderRadius: '12px'
    },

    tab: {
      border: 'none',
      borderRadius: '8px',
      padding: '10px 15px',
      background: 'transparent',
      color: colors.muted,
      cursor: 'pointer',
      fontWeight: 700,
      fontSize: '0.85rem'
    },

    activeTab: {
      background: isDark ? '#334155' : '#eff6ff',
      color: isDark ? '#fff' : '#1d4ed8'
    },

    card: {
      background: colors.card,
      border: `1px solid ${colors.border}`,
      borderRadius: '14px',
      padding: '22px',
      marginBottom: '20px',
      boxShadow: isDark
        ? '0 4px 16px rgba(0,0,0,0.18)'
        : '0 4px 16px rgba(15,23,42,0.05)'
    },

    formGrid: {
      display: 'grid',
      gridTemplateColumns:
        'repeat(auto-fit, minmax(220px, 1fr))',
      gap: '16px'
    },

    formGroup: {
      display: 'flex',
      flexDirection: 'column'
    },

    label: {
      marginBottom: '6px',
      color: colors.muted,
      fontSize: '0.82rem',
      fontWeight: 700
    },

    input: {
      width: '100%',
      boxSizing: 'border-box',
      padding: '10px 12px',
      borderRadius: '8px',
      border: `1px solid ${colors.border}`,
      background: colors.input,
      color: colors.text,
      outline: 'none',
      fontSize: '0.9rem'
    },

    primaryButton: {
      marginTop: '18px',
      width: '100%',
      border: 'none',
      borderRadius: '8px',
      padding: '12px 16px',
      background: 'linear-gradient(135deg,#2563eb,#1d4ed8)',
      color: '#fff',
      fontWeight: 800,
      cursor: 'pointer'
    },

    toolbar: {
      display: 'flex',
      gap: '12px',
      flexWrap: 'wrap',
      marginBottom: '18px'
    },

    searchInput: {
      flex: '1 1 300px',
      padding: '10px 12px',
      borderRadius: '8px',
      border: `1px solid ${colors.border}`,
      background: colors.input,
      color: colors.text,
      outline: 'none'
    },

    filter: {
      padding: '10px 12px',
      borderRadius: '8px',
      border: `1px solid ${colors.border}`,
      background: colors.input,
      color: colors.text,
      outline: 'none'
    },

    tableWrapper: {
      width: '100%',
      overflowX: 'auto'
    },

    table: {
      width: '100%',
      minWidth: '900px',
      borderCollapse: 'collapse'
    },

    th: {
      textAlign: 'left',
      padding: '12px',
      background: colors.cardSecondary,
      color: colors.muted,
      fontSize: '0.75rem',
      textTransform: 'uppercase',
      letterSpacing: '0.4px',
      borderBottom: `1px solid ${colors.border}`,
      whiteSpace: 'nowrap'
    },

    td: {
      padding: '13px 12px',
      borderBottom: `1px solid ${colors.border}`,
      color: colors.text,
      fontSize: '0.86rem'
    },

    status: (status) => ({
      display: 'inline-block',
      padding: '4px 10px',
      borderRadius: '20px',
      background: `${getStatusColor(status)}20`,
      color: getStatusColor(status),
      fontWeight: 800,
      fontSize: '0.75rem'
    }),

    detailButton: {
      border: 'none',
      borderRadius: '6px',
      padding: '6px 10px',
      background: '#2563eb',
      color: '#fff',
      cursor: 'pointer',
      fontWeight: 700,
      fontSize: '0.78rem'
    },

    empty: {
      textAlign: 'center',
      padding: '45px 20px',
      color: colors.muted
    },

    overlay: {
      position: 'fixed',
      inset: 0,
      zIndex: 2000,
      background: 'rgba(0,0,0,0.65)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    },

    modal: {
      width: '100%',
      maxWidth: '650px',
      maxHeight: '85vh',
      overflowY: 'auto',
      background: colors.card,
      color: colors.text,
      border: `1px solid ${colors.border}`,
      borderRadius: '14px',
      padding: '24px',
      boxSizing: 'border-box'
    },

    modalHeader: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: '20px'
    },

    closeButton: {
      border: 'none',
      background: 'transparent',
      color: colors.muted,
      fontSize: '1.5rem',
      cursor: 'pointer'
    },

    detailGrid: {
      display: 'grid',
      gridTemplateColumns:
        'repeat(auto-fit, minmax(200px, 1fr))',
      gap: '14px'
    },

    detailItem: {
      padding: '13px',
      background: colors.cardSecondary,
      borderRadius: '8px',
      border: `1px solid ${colors.border}`
    },

    detailLabel: {
      display: 'block',
      marginBottom: '4px',
      color: colors.muted,
      fontSize: '0.75rem',
      fontWeight: 700
    },

    detailValue: {
      color: colors.text,
      fontWeight: 700,
      wordBreak: 'break-word'
    }
  };

  /*
   * ---------------------------------------------------------
   * LOADING
   * ---------------------------------------------------------
   */

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.wrapper}>
          <div style={styles.empty}>
            <div style={{ fontSize: '2rem' }}>⏳</div>
            <p>{t.loadingData}</p>
          </div>
        </div>
      </div>
    );
  }

  /*
   * ---------------------------------------------------------
   * RENDER
   * ---------------------------------------------------------
   */

  return (
    <div style={styles.page}>
      <div style={styles.wrapper}>

        {/* HEADER */}
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>
              🔄 {t.title}
            </h1>

            <p style={styles.subtitle}>
              {t.subtitle}
            </p>
          </div>

          <div style={styles.headerButtons}>
            <button
              type="button"
              style={styles.exportButton}
              onClick={exportToExcel}
            >
              📥 {t.export}
            </button>
          </div>
        </div>

        {/* TABS */}
        <div style={styles.tabs}>

          {[
            ['new', `➕ ${t.newTransfer}`],
            ['pending', `⏳ ${t.pending}`],
            ['approved', `✅ ${t.approved}`],
            ['incoming', `📥 ${t.incoming}`],
            ['outgoing', `📤 ${t.outgoing}`],
            ['completed', `✔️ ${t.completed}`],
            ['history', `📋 ${t.history}`]
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              style={{
                ...styles.tab,
                ...(activeTab === id
                  ? styles.activeTab
                  : {})
              }}
              onClick={() => setActiveTab(id)}
            >
              {label}
            </button>
          ))}

        </div>

        {/* NEW TRANSFER */}
        {activeTab === 'new' && (
          <div style={styles.card}>
            <h2
              style={{
                marginTop: 0,
                marginBottom: '20px',
                fontSize: '1.25rem'
              }}
            >
              ➕ {t.newTransfer}
            </h2>

            <form onSubmit={handleCreateTransfer}>

              <div style={styles.formGrid}>

                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    {t.asset} *
                  </label>

                  <select
                    value={form.assetId}
                    onChange={(e) =>
                      handleFormChange(
                        'assetId',
                        e.target.value
                      )
                    }
                    style={styles.input}
                    required
                  >
                    <option value="">
                      {t.selectAsset}
                    </option>

                    {availableAssets.map((asset) => (
                      <option
                        key={getAssetId(asset)}
                        value={getAssetId(asset)}
                      >
                        {getAssetName(asset)}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    {t.quantity} *
                  </label>

                  <input
                    type="number"
                    min="1"
                    value={form.quantity}
                    onChange={(e) =>
                      handleFormChange(
                        'quantity',
                        e.target.value
                      )
                    }
                    style={styles.input}
                    required
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    {t.targetDepartment} *
                  </label>

                  <select
                    value={form.targetDepartment}
                    onChange={(e) =>
                      handleFormChange(
                        'targetDepartment',
                        e.target.value
                      )
                    }
                    style={styles.input}
                    required
                  >
                    <option value="">
                      {t.selectDepartment}
                    </option>

                    {departments.map((department) => (
                      <option
                        key={
                          department.id ||
                          department.department_id
                        }
                        value={
                          department.id ||
                          department.department_id
                        }
                      >
                        {getDepartmentLabel(department)}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    {t.targetUser}
                  </label>

                  <select
                    value={form.targetUser}
                    onChange={(e) =>
                      handleFormChange(
                        'targetUser',
                        e.target.value
                      )
                    }
                    style={styles.input}
                  >
                    <option value="">
                      {t.selectUser}
                    </option>

                    {users.map((item) => (
                      <option
                        key={item.id}
                        value={item.id}
                      >
                        {item.full_name ||
                          item.fullName ||
                          item.username}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    {t.reason}
                  </label>

                  <input
                    type="text"
                    value={form.reason}
                    onChange={(e) =>
                      handleFormChange(
                        'reason',
                        e.target.value
                      )
                    }
                    placeholder={t.reason}
                    style={styles.input}
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    {t.remarks}
                  </label>

                  <input
                    type="text"
                    value={form.remarks}
                    onChange={(e) =>
                      handleFormChange(
                        'remarks',
                        e.target.value
                      )
                    }
                    placeholder={t.remarks}
                    style={styles.input}
                  />
                </div>

              </div>

              <button
                type="submit"
                style={{
                  ...styles.primaryButton,
                  opacity: processing ? 0.65 : 1
                }}
                disabled={processing}
              >
                {processing
                  ? '⏳ ' + t.loading
                  : '🔄 ' + t.createTransfer}
              </button>

            </form>
          </div>
        )}

        {/* TRANSFER LIST */}
        {activeTab !== 'new' && (
          <div style={styles.card}>

            <div style={styles.toolbar}>

              <input
                type="search"
                placeholder={t.search}
                value={search}
                onChange={(e) =>
                  setSearch(e.target.value)
                }
                style={styles.searchInput}
              />

              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value)
                }
                style={styles.filter}
              >
                <option value="all">
                  {t.all}
                </option>
                <option value="Pending">
                  {t.pendingStatus}
                </option>
                <option value="Approved">
                  {t.approvedStatus}
                </option>
                <option value="In Transit">
                  {t.inTransitStatus}
                </option>
                <option value="Completed">
                  {t.completedStatus}
                </option>
                <option value="Rejected">
                  {t.rejectedStatus}
                </option>
                <option value="Cancelled">
                  {t.cancelledStatus}
                </option>
              </select>

            </div>

            {filteredTransfers.length === 0 ? (
              <div style={styles.empty}>
                <div style={{ fontSize: '2.5rem' }}>
                  🔄
                </div>
                <p>{t.noTransfers}</p>
              </div>
            ) : (
              <div style={styles.tableWrapper}>
                <table style={styles.table}>

                  <thead>
                    <tr>
                      <th style={styles.th}>ID</th>
                      <th style={styles.th}>
                        {t.asset}
                      </th>
                      <th style={styles.th}>
                        {t.from}
                      </th>
                      <th style={styles.th}>
                        {t.to}
                      </th>
                      <th style={styles.th}>
                        {t.quantity}
                      </th>
                      <th style={styles.th}>
                        {t.date}
                      </th>
                      <th style={styles.th}>
                        {t.status}
                      </th>
                      <th style={styles.th}>
                        {t.actions}
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredTransfers.map((item) => {

                      const transferDate =
                        getTransferDate(item);

                      return (
                        <tr
                          key={
                            getTransferId(item) ||
                            Math.random()
                          }
                        >

                          <td style={styles.td}>
                            <strong>
                              {getTransferId(item) ||
                                '-'}
                            </strong>
                          </td>

                          <td style={styles.td}>
                            <div
                              style={{
                                fontWeight: 700
                              }}
                            >
                              {getTransferAssetName(
                                item
                              )}
                            </div>

                            {getValue(
                              item,
                              'asset_tag',
                              'assetCode'
                            ) && (
                              <div
                                style={{
                                  fontSize:
                                    '0.72rem',
                                  color:
                                    colors.muted,
                                  marginTop: 3
                                }}
                              >
                                {getValue(
                                  item,
                                  'asset_tag',
                                  'assetCode'
                                )}
                              </div>
                            )}
                          </td>

                          <td style={styles.td}>
                            {getSourceDepartment(
                              item
                            )}
                          </td>

                          <td style={styles.td}>
                            {getTargetDepartment(
                              item
                            )}
                          </td>

                          <td style={styles.td}>
                            {getValue(
                              item,
                              'quantity'
                            ) || 1}
                          </td>

                          <td style={styles.td}>
                            {transferDate
                              ? new Date(
                                  transferDate
                                ).toLocaleDateString()
                              : '-'}
                          </td>

                          <td style={styles.td}>
                            <span
                              style={styles.status(
                                getTransferStatus(
                                  item
                                )
                              )}
                            >
                              {getTransferStatus(
                                item
                              )}
                            </span>
                          </td>

                          <td style={styles.td}>
                            <button
                              type="button"
                              style={
                                styles.detailButton
                              }
                              onClick={() =>
                                openDetails(item)
                              }
                            >
                              👁️ {t.details}
                            </button>
                          </td>

                        </tr>
                      );
                    })}
                  </tbody>

                </table>
              </div>
            )}

          </div>
        )}

        {/* DETAILS MODAL */}
        {showDetails && selectedTransfer && (
          <div
            style={styles.overlay}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                closeDetails();
              }
            }}
          >
            <div style={styles.modal}>

              <div style={styles.modalHeader}>
                <h2
                  style={{
                    margin: 0,
                    fontSize: '1.25rem'
                  }}
                >
                  🔄 {t.details}
                </h2>

                <button
                  type="button"
                  style={styles.closeButton}
                  onClick={closeDetails}
                  aria-label={t.close}
                >
                  ×
                </button>
              </div>

              <div style={styles.detailGrid}>

                <div style={styles.detailItem}>
                  <span style={styles.detailLabel}>
                    ID
                  </span>
                  <span style={styles.detailValue}>
                    {getTransferId(
                      selectedTransfer
                    ) || '-'}
                  </span>
                </div>

                <div style={styles.detailItem}>
                  <span style={styles.detailLabel}>
                    {t.asset}
                  </span>
                  <span style={styles.detailValue}>
                    {getTransferAssetName(
                      selectedTransfer
                    )}
                  </span>
                </div>

                <div style={styles.detailItem}>
                  <span style={styles.detailLabel}>
                    {t.from}
                  </span>
                  <span style={styles.detailValue}>
                    {getSourceDepartment(
                      selectedTransfer
                    )}
                  </span>
                </div>

                <div style={styles.detailItem}>
                  <span style={styles.detailLabel}>
                    {t.to}
                  </span>
                  <span style={styles.detailValue}>
                    {getTargetDepartment(
                      selectedTransfer
                    )}
                  </span>
                </div>

                <div style={styles.detailItem}>
                  <span style={styles.detailLabel}>
                    {t.quantity}
                  </span>
                  <span style={styles.detailValue}>
                    {getValue(
                      selectedTransfer,
                      'quantity'
                    ) || 1}
                  </span>
                </div>

                <div style={styles.detailItem}>
                  <span style={styles.detailLabel}>
                    {t.status}
                  </span>

                  <span
                    style={styles.status(
                      getTransferStatus(
                        selectedTransfer
                      )
                    )}
                  >
                    {getTransferStatus(
                      selectedTransfer
                    )}
                  </span>
                </div>

                <div style={styles.detailItem}>
                  <span style={styles.detailLabel}>
                    {t.date}
                  </span>

                  <span style={styles.detailValue}>
                    {getTransferDate(
                      selectedTransfer
                    )
                      ? new Date(
                          getTransferDate(
                            selectedTransfer
                          )
                        ).toLocaleString()
                      : '-'}
                  </span>
                </div>

                <div style={styles.detailItem}>
                  <span style={styles.detailLabel}>
                    {t.reason}
                  </span>

                  <span style={styles.detailValue}>
                    {getValue(
                      selectedTransfer,
                      'reason'
                    ) || '-'}
                  </span>
                </div>

                <div style={styles.detailItem}>
                  <span style={styles.detailLabel}>
                    {t.remarks}
                  </span>

                  <span style={styles.detailValue}>
                    {getValue(
                      selectedTransfer,
                      'remarks',
                      'notes'
                    ) || '-'}
                  </span>
                </div>

              </div>

              <button
                type="button"
                style={{
                  ...styles.primaryButton,
                  marginTop: '20px'
                }}
                onClick={closeDetails}
              >
                {t.close}
              </button>

            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default StoreTransfers;
