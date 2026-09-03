import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import {
  Activity,
  ArrowRight,
  Barcode,
  CheckCircle,
  Clock,
  Download,
  Edit3,
  History,
  MapPin,
  Package,
  Plus,
  Printer,
  QrCode,
  Radio,
  RefreshCw,
  Search,
  Settings,
  Tag,
  Trash2,
  Wifi,
  WifiOff,
  X,
  Zap
} from 'lucide-react';
import { useLanguage } from '../../contexts/UiContext';

/* =========================================================
   ADMIN RFID / QR TRACKING
   ========================================================= */

const AdminRFIDTracking = () => {
  const { language, theme } = useLanguage();

  const isDark = theme === 'dark';
  const isAmharic = language !== 'en';

  const t = isAmharic ? amharic : english;

  const [activeSection, setActiveSection] = useState('rfid-assets');

  const [logs, setLogs] = useState([]);
  const [devices, setDevices] = useState([]);
  const [assets, setAssets] = useState([]);

  const [loading, setLoading] = useState(true);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [assetsLoading, setAssetsLoading] = useState(false);

  const [search, setSearch] = useState('');
  const [locationSearch, setLocationSearch] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [scanSearch, setScanSearch] = useState('');

  const [dateRange, setDateRange] = useState({
    start: '',
    end: ''
  });

  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [showCodeModal, setShowCodeModal] = useState(false);

  const [editingDevice, setEditingDevice] = useState(null);

  const [registerForm, setRegisterForm] = useState({
    asset_id: '',
    asset_name: '',
    tag_type: 'RFID',
    tag_code: '',
    location: ''
  });

  const [deviceForm, setDeviceForm] = useState({
    name: '',
    reader_id: '',
    ip_address: '',
    location: '',
    status: 'Active'
  });

  const [codeForm, setCodeForm] = useState({
    asset_id: '',
    asset_name: '',
    code_type: 'QR',
    code_value: ''
  });

  /* =========================================================
     LOAD DATA
     ========================================================= */

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    await Promise.all([
      fetchLogs(),
      fetchDevices(),
      fetchAssets()
    ]);
  };

  const fetchLogs = async () => {
    setLoading(true);

    try {
      const response = await axios.get('/api/rfid', {
        params: {
          limit: 500
        }
      });

      const data = Array.isArray(response.data?.logs)
        ? response.data.logs
        : Array.isArray(response.data)
          ? response.data
          : [];

      setLogs(data);
    } catch (error) {
      console.error('RFID logs error:', error);
      toast.error(t.loadFailed);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchDevices = async () => {
    setDevicesLoading(true);

    try {
      const response = await axios.get('/api/rfid/devices');

      const data = Array.isArray(response.data?.devices)
        ? response.data.devices
        : Array.isArray(response.data)
          ? response.data
          : [];

      setDevices(data);
    } catch (error) {
      /*
       * Some backend versions do not have device management yet.
       * Do not break the whole RFID page.
       */
      console.warn('RFID device API unavailable:', error.message);
      setDevices([]);
    } finally {
      setDevicesLoading(false);
    }
  };

  const fetchAssets = async () => {
    setAssetsLoading(true);

    try {
      const response = await axios.get('/api/assets', {
        params: {
          limit: 500
        }
      });

      const data = Array.isArray(response.data?.assets)
        ? response.data.assets
        : Array.isArray(response.data)
          ? response.data
          : [];

      setAssets(data);
    } catch (error) {
      console.warn('Assets API unavailable:', error.message);
      setAssets([]);
    } finally {
      setAssetsLoading(false);
    }
  };

  /* =========================================================
     STATISTICS
     ========================================================= */

  const stats = useMemo(() => {
    const uniqueAssets = new Set();

    logs.forEach((log) => {
      const id =
        log.asset_id ||
        log.asset?.id ||
        log.rfid_tag ||
        log.tag_code;

      if (id) uniqueAssets.add(String(id));
    });

    const uniqueReaders = new Set();

    logs.forEach((log) => {
      const reader =
        log.reader_id ||
        log.reader?.id;

      if (reader) uniqueReaders.add(String(reader));
    });

    const anomalies = logs.filter(
      (log) => log.isAnomaly === true || log.is_anomaly === true
    ).length;

    const locations = new Set();

    logs.forEach((log) => {
      const location =
        log.new_location ||
        log.reader_location ||
        log.location ||
        log.current_location;

      if (location) locations.add(location);
    });

    return {
      totalScans: logs.length,
      trackedAssets: uniqueAssets.size,
      readers: uniqueReaders.size || devices.length,
      anomalies,
      locations: locations.size,
      devices: devices.length
    };
  }, [logs, devices]);

  /* =========================================================
     RFID ASSETS
     ========================================================= */

  const rfidAssets = useMemo(() => {
    const map = new Map();

    logs.forEach((log) => {
      const assetId =
        log.asset_id ||
        log.asset?.id ||
        log.rfid_tag;

      if (!assetId) return;

      const key = String(assetId);

      if (!map.has(key)) {
        map.set(key, {
          id: assetId,
          asset_name:
            log.asset_name ||
            log.asset?.name ||
            'Unknown Asset',
          asset_code:
            log.asset_code ||
            log.asset?.asset_code ||
            '-',
          rfid_tag:
            log.rfid_tag ||
            log.tag_code ||
            '-',
          location:
            log.new_location ||
            log.reader_location ||
            log.location ||
            '-',
          reader_id:
            log.reader_id ||
            '-',
          timestamp:
            log.timestamp ||
            log.created_at,
          isAnomaly:
            log.isAnomaly === true ||
            log.is_anomaly === true
        });
      }
    });

    return Array.from(map.values());
  }, [logs]);

  const filteredRFIDAssets = useMemo(() => {
    const value = search.toLowerCase().trim();

    if (!value) return rfidAssets;

    return rfidAssets.filter((asset) =>
      [
        asset.asset_name,
        asset.asset_code,
        asset.rfid_tag,
        asset.location,
        asset.reader_id
      ]
        .join(' ')
        .toLowerCase()
        .includes(value)
    );
  }, [rfidAssets, search]);

  /* =========================================================
     CURRENT LOCATIONS
     ========================================================= */

  const currentLocations = useMemo(() => {
    const map = new Map();

    logs.forEach((log) => {
      const assetId =
        log.asset_id ||
        log.asset?.id ||
        log.rfid_tag;

      if (!assetId) return;

      const timestamp = new Date(
        log.timestamp ||
        log.created_at ||
        0
      ).getTime();

      const existing = map.get(String(assetId));

      if (
        !existing ||
        timestamp > existing.timestampValue
      ) {
        map.set(String(assetId), {
          id: assetId,
          asset_name:
            log.asset_name ||
            log.asset?.name ||
            'Unknown Asset',
          rfid_tag:
            log.rfid_tag ||
            log.tag_code ||
            '-',
          location:
            log.new_location ||
            log.reader_location ||
            log.location ||
            '-',
          reader_id:
            log.reader_id ||
            '-',
          timestamp:
            log.timestamp ||
            log.created_at,
          timestampValue: timestamp
        });
      }
    });

    return Array.from(map.values());
  }, [logs]);

  const filteredLocations = currentLocations.filter((item) => {
    const value = locationSearch.toLowerCase().trim();

    if (!value) return true;

    return [
      item.asset_name,
      item.rfid_tag,
      item.location,
      item.reader_id
    ]
      .join(' ')
      .toLowerCase()
      .includes(value);
  });

  /* =========================================================
     SCAN ACTIVITY
     ========================================================= */

  const filteredScans = useMemo(() => {
    const value = scanSearch.toLowerCase().trim();

    return logs.filter((log) => {
      if (!value) return true;

      return [
        log.asset_name,
        log.asset_code,
        log.rfid_tag,
        log.reader_id,
        log.reader_location,
        log.location
      ]
        .join(' ')
        .toLowerCase()
        .includes(value);
    });
  }, [logs, scanSearch]);

  /* =========================================================
     HISTORY
     ========================================================= */

  const filteredHistory = useMemo(() => {
    return logs.filter((log) => {
      const value = historySearch.toLowerCase().trim();

      const matchesSearch =
        !value ||
        [
          log.asset_name,
          log.asset_code,
          log.rfid_tag,
          log.reader_id,
          log.reader_location,
          log.location
        ]
          .join(' ')
          .toLowerCase()
          .includes(value);

      if (!matchesSearch) return false;

      const timestamp = new Date(
        log.timestamp ||
        log.created_at ||
        0
      );

      if (dateRange.start) {
        const start = new Date(dateRange.start);
        start.setHours(0, 0, 0, 0);

        if (timestamp < start) return false;
      }

      if (dateRange.end) {
        const end = new Date(dateRange.end);
        end.setHours(23, 59, 59, 999);

        if (timestamp > end) return false;
      }

      return true;
    });
  }, [
    logs,
    historySearch,
    dateRange
  ]);

  /* =========================================================
     REGISTER TAG
     ========================================================= */

  const handleRegisterTag = async (event) => {
    event.preventDefault();

    if (!registerForm.asset_id) {
      toast.error(t.selectAsset);
      return;
    }

    if (!registerForm.tag_code.trim()) {
      toast.error(t.enterTag);
      return;
    }

    try {
      await axios.post('/api/rfid/register', {
        asset_id: registerForm.asset_id,
        tag_type: registerForm.tag_type,
        tag_code: registerForm.tag_code.trim(),
        location: registerForm.location
      });

      toast.success(t.tagRegistered);

      setShowRegisterModal(false);

      setRegisterForm({
        asset_id: '',
        asset_name: '',
        tag_type: 'RFID',
        tag_code: '',
        location: ''
      });

      await loadAllData();
    } catch (error) {
      console.warn(
        'Register API error:',
        error.response?.data || error.message
      );

      toast.error(
        error.response?.data?.message ||
        t.tagRegisterFailed
      );
    }
  };

  /* =========================================================
     DEVICE MANAGEMENT
     ========================================================= */

  const openAddDevice = () => {
    setEditingDevice(null);

    setDeviceForm({
      name: '',
      reader_id: '',
      ip_address: '',
      location: '',
      status: 'Active'
    });

    setShowDeviceModal(true);
  };

  const openEditDevice = (device) => {
    setEditingDevice(device);

    setDeviceForm({
      name: device.name || '',
      reader_id: device.reader_id || '',
      ip_address: device.ip_address || '',
      location: device.location || '',
      status: device.status || 'Active'
    });

    setShowDeviceModal(true);
  };

  const handleDeviceSubmit = async (event) => {
    event.preventDefault();

    try {
      if (editingDevice) {
        await axios.put(
          `/api/rfid/devices/${editingDevice.id}`,
          deviceForm
        );

        toast.success(t.deviceUpdated);
      } else {
        await axios.post(
          '/api/rfid/devices',
          deviceForm
        );

        toast.success(t.deviceAdded);
      }

      setShowDeviceModal(false);
      await fetchDevices();
    } catch (error) {
      console.error(error);

      toast.error(
        error.response?.data?.message ||
        t.deviceSaveFailed
      );
    }
  };

  const handleDeleteDevice = async (id) => {
    if (!window.confirm(t.confirmDelete)) {
      return;
    }

    try {
      await axios.delete(
        `/api/rfid/devices/${id}`
      );

      toast.success(t.deviceDeleted);

      await fetchDevices();
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
        t.deviceDeleteFailed
      );
    }
  };

  const handleToggleDevice = async (
    device
  ) => {
    const status =
      device.status === 'Active'
        ? 'Inactive'
        : 'Active';

    try {
      await axios.put(
        `/api/rfid/devices/${device.id}/status`,
        { status }
      );

      toast.success(t.statusChanged);

      await fetchDevices();
    } catch (error) {
      toast.error(t.statusFailed);
    }
  };

  const handleTestConnection = async (device) => {
    try {
      const response = await axios.post(
        `/api/rfid/devices/${device.id}/test`
      );

      if (response.data?.success) {
        toast.success(t.connectionSuccess);
      } else {
        toast.error(t.connectionFailed);
      }
    } catch (error) {
      toast.error(t.connectionFailed);
    }
  };

  /* =========================================================
     QR / BARCODE
     ========================================================= */

  const openCodeGenerator = () => {
    setCodeForm({
      asset_id: '',
      asset_name: '',
      code_type: 'QR',
      code_value: ''
    });

    setShowCodeModal(true);
  };

  const generateCode = () => {
    if (!codeForm.asset_id) {
      toast.error(t.selectAsset);
      return;
    }

    const asset =
      assets.find(
        (item) =>
          String(item.id) ===
          String(codeForm.asset_id)
      );

    const value =
      asset?.asset_code ||
      asset?.code ||
      `ASSET-${codeForm.asset_id}`;

    setCodeForm((previous) => ({
      ...previous,
      asset_name:
        asset?.name ||
        asset?.asset_name ||
        '',
      code_value: value
    }));
  };

  const openCodeForAsset = (asset) => {
    setCodeForm({
      asset_id: asset.id,
      asset_name:
        asset.asset_name ||
        asset.name ||
        '',
      code_type: 'QR',
      code_value:
        asset.asset_code ||
        asset.rfid_tag ||
        `ASSET-${asset.id}`
    });

    setShowCodeModal(true);
  };

  const printCode = () => {
    window.print();
  };

  const downloadCode = () => {
    const value =
      codeForm.code_value ||
      `ASSET-${codeForm.asset_id}`;

    const blob = new Blob(
      [
        `${codeForm.code_type}\n${value}\n${codeForm.asset_name}`
      ],
      {
        type: 'text/plain'
      }
    );

    const url =
      window.URL.createObjectURL(blob);

    const link =
      document.createElement('a');

    link.href = url;

    link.download =
      `${value}-${codeForm.code_type}.txt`;

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);

    window.URL.revokeObjectURL(url);
  };

  /* =========================================================
     HELPERS
     ========================================================= */

  const formatDate = (value) => {
    if (!value) return '-';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return '-';
    }

    return date.toLocaleString();
  };

  const getLocation = (log) =>
    log.new_location ||
    log.reader_location ||
    log.location ||
    '-';

  const isAnomaly = (log) =>
    log.isAnomaly === true ||
    log.is_anomaly === true;

  /* =========================================================
     STYLES
     ========================================================= */

  const colors = {
    background: isDark
      ? '#0f172a'
      : '#f8fafc',

    card: isDark
      ? '#172033'
      : '#ffffff',

    card2: isDark
      ? '#1d2a40'
      : '#f8fafc',

    border: isDark
      ? '#2c3b54'
      : '#e2e8f0',

    text: isDark
      ? '#e5edf8'
      : '#1e293b',

    muted: isDark
      ? '#94a3b8'
      : '#64748b',

    primary: '#2563eb',

    success: '#16a34a',

    danger: '#dc2626',

    warning: '#d97706',

    purple: '#7c3aed'
  };

  const styles = {
    page: {
      minHeight: '100%',
      padding: '24px',
      background: colors.background,
      color: colors.text,
      boxSizing: 'border-box'
    },

    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: '16px',
      flexWrap: 'wrap',
      marginBottom: '24px'
    },

    title: {
      margin: 0,
      fontSize: '28px',
      fontWeight: 800,
      color: colors.text
    },

    subtitle: {
      margin: '6px 0 0',
      color: colors.muted,
      fontSize: '14px'
    },

    headerActions: {
      display: 'flex',
      gap: '8px',
      flexWrap: 'wrap'
    },

    button: (background = colors.primary) => ({
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '7px',
      padding: '10px 15px',
      border: 'none',
      borderRadius: '8px',
      background,
      color: '#fff',
      fontWeight: 700,
      fontSize: '13px',
      cursor: 'pointer'
    }),

    tabs: {
      display: 'flex',
      gap: '6px',
      flexWrap: 'wrap',
      background: colors.card,
      border: `1px solid ${colors.border}`,
      borderRadius: '12px',
      padding: '6px',
      marginBottom: '20px'
    },

    tab: (active) => ({
      display: 'flex',
      alignItems: 'center',
      gap: '7px',
      border: 'none',
      borderRadius: '8px',
      padding: '10px 14px',
      cursor: 'pointer',
      fontWeight: 700,
      fontSize: '13px',
      background: active
        ? colors.primary
        : 'transparent',
      color: active
        ? '#fff'
        : colors.muted
    }),

    stats: {
      display: 'grid',
      gridTemplateColumns:
        'repeat(auto-fit,minmax(180px,1fr))',
      gap: '14px',
      marginBottom: '20px'
    },

    stat: {
      background: colors.card,
      border: `1px solid ${colors.border}`,
      borderRadius: '12px',
      padding: '18px',
      display: 'flex',
      alignItems: 'center',
      gap: '14px'
    },

    statIcon: (background) => ({
      width: '44px',
      height: '44px',
      borderRadius: '10px',
      background,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#fff'
    }),

    statValue: {
      fontSize: '25px',
      fontWeight: 800,
      color: colors.text
    },

    statLabel: {
      fontSize: '12px',
      color: colors.muted,
      marginTop: '2px'
    },

    panel: {
      background: colors.card,
      border: `1px solid ${colors.border}`,
      borderRadius: '12px',
      overflow: 'hidden'
    },

    panelHeader: {
      padding: '17px 18px',
      borderBottom: `1px solid ${colors.border}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '12px',
      flexWrap: 'wrap'
    },

    panelTitle: {
      margin: 0,
      fontSize: '17px',
      fontWeight: 800,
      color: colors.text
    },

    controls: {
      display: 'flex',
      gap: '10px',
      flexWrap: 'wrap',
      padding: '15px',
      background: colors.card2,
      borderBottom: `1px solid ${colors.border}`
    },

    input: {
      padding: '10px 12px',
      borderRadius: '8px',
      border: `1px solid ${colors.border}`,
      background: colors.card,
      color: colors.text,
      outline: 'none',
      minWidth: '220px',
      fontSize: '13px'
    },

    tableWrapper: {
      width: '100%',
      overflowX: 'auto'
    },

    table: {
      width: '100%',
      borderCollapse: 'collapse',
      minWidth: '900px'
    },

    th: {
      padding: '12px 14px',
      textAlign: 'left',
      background: colors.card2,
      color: colors.muted,
      borderBottom: `1px solid ${colors.border}`,
      fontSize: '12px',
      fontWeight: 800,
      whiteSpace: 'nowrap'
    },

    td: {
      padding: '13px 14px',
      borderBottom: `1px solid ${colors.border}`,
      color: colors.text,
      fontSize: '13px',
      verticalAlign: 'middle'
    },

    badge: (background, color) => ({
      display: 'inline-flex',
      alignItems: 'center',
      gap: '5px',
      padding: '5px 9px',
      borderRadius: '999px',
      background,
      color,
      fontSize: '11px',
      fontWeight: 800
    }),

    empty: {
      padding: '55px 20px',
      textAlign: 'center',
      color: colors.muted
    },

    deviceGrid: {
      display: 'grid',
      gridTemplateColumns:
        'repeat(auto-fit,minmax(310px,1fr))',
      gap: '14px',
      padding: '16px'
    },

    deviceCard: {
      border: `1px solid ${colors.border}`,
      borderRadius: '12px',
      padding: '17px',
      background: colors.card2
    },

    deviceTop: {
      display: 'flex',
      justifyContent: 'space-between',
      gap: '10px',
      alignItems: 'flex-start',
      marginBottom: '15px'
    },

    deviceName: {
      fontWeight: 800,
      fontSize: '16px'
    },

    deviceInfo: {
      display: 'grid',
      gap: '8px',
      marginBottom: '15px'
    },

    infoRow: {
      display: 'flex',
      justifyContent: 'space-between',
      gap: '10px',
      fontSize: '12px'
    },

    infoLabel: {
      color: colors.muted
    },

    deviceActions: {
      display: 'flex',
      gap: '6px',
      flexWrap: 'wrap'
    },

    smallButton: (
      background = colors.primary
    ) => ({
      border: 'none',
      borderRadius: '7px',
      background,
      color: '#fff',
      padding: '7px 9px',
      cursor: 'pointer',
      fontWeight: 700,
      fontSize: '11px',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '5px'
    }),

    locationGrid: {
      display: 'grid',
      gridTemplateColumns:
        'repeat(auto-fit,minmax(260px,1fr))',
      gap: '14px',
      padding: '16px'
    },

    locationCard: {
      border: `1px solid ${colors.border}`,
      borderRadius: '12px',
      padding: '17px',
      background: colors.card2
    },

    locationName: {
      fontSize: '16px',
      fontWeight: 800,
      marginBottom: '8px'
    },

    locationValue: {
      color: colors.primary,
      fontWeight: 700
    },

    modalOverlay: {
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,.65)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 9999,
      padding: '20px'
    },

    modal: {
      width: '100%',
      maxWidth: '520px',
      maxHeight: '90vh',
      overflowY: 'auto',
      background: colors.card,
      borderRadius: '15px',
      border: `1px solid ${colors.border}`,
      boxShadow: '0 25px 80px rgba(0,0,0,.4)'
    },

    modalHeader: {
      padding: '18px 20px',
      borderBottom: `1px solid ${colors.border}`,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    },

    modalTitle: {
      margin: 0,
      fontSize: '18px',
      fontWeight: 800
    },

    closeButton: {
      border: 'none',
      background: 'transparent',
      color: colors.muted,
      cursor: 'pointer'
    },

    modalBody: {
      padding: '20px'
    },

    field: {
      marginBottom: '14px'
    },

    label: {
      display: 'block',
      marginBottom: '6px',
      color: colors.muted,
      fontSize: '12px',
      fontWeight: 700
    },

    modalInput: {
      width: '100%',
      boxSizing: 'border-box',
      padding: '11px 12px',
      borderRadius: '8px',
      border: `1px solid ${colors.border}`,
      background: colors.card2,
      color: colors.text,
      fontSize: '13px'
    },

    modalFooter: {
      display: 'flex',
      justifyContent: 'flex-end',
      gap: '8px',
      paddingTop: '10px'
    },

    codeBox: {
      margin: '20px auto',
      width: '240px',
      minHeight: '240px',
      border: `2px dashed ${colors.border}`,
      borderRadius: '12px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      gap: '10px',
      textAlign: 'center',
      padding: '15px'
    },

    codeText: {
      wordBreak: 'break-all',
      fontWeight: 800,
      color: colors.text
    }
  };

  /* =========================================================
     RENDER TABS
     ========================================================= */

  const sections = [
    {
      id: 'rfid-assets',
      label: t.rfidAssets,
      icon: <Radio size={16} />
    },
    {
      id: 'qr-barcode',
      label: t.qrBarcode,
      icon: <QrCode size={16} />
    },
    {
      id: 'register',
      label: t.registerTag,
      icon: <Tag size={16} />
    },
    {
      id: 'scan-activity',
      label: t.scanActivity,
      icon: <Activity size={16} />
    },
    {
      id: 'current-location',
      label: t.currentLocation,
      icon: <MapPin size={16} />
    },
    {
      id: 'history',
      label: t.trackingHistory,
      icon: <History size={16} />
    },
    {
      id: 'devices',
      label: t.devices,
      icon: <Settings size={16} />
    }
  ];

  return (
    <div style={styles.page}>
      {/* =====================================================
          HEADER
      ===================================================== */}

      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>
            📡 {t.title}
          </h1>

          <p style={styles.subtitle}>
            {t.subtitle}
          </p>
        </div>

        <div style={styles.headerActions}>
          <button
            style={styles.button('#64748b')}
            onClick={loadAllData}
          >
            <RefreshCw size={15} />
            {t.refresh}
          </button>

          <button
            style={styles.button(colors.primary)}
            onClick={() => setShowRegisterModal(true)}
          >
            <Plus size={15} />
            {t.registerTag}
          </button>
        </div>
      </div>

      {/* =====================================================
          TABS
      ===================================================== */}

      <div style={styles.tabs}>
        {sections.map((section) => (
          <button
            key={section.id}
            style={styles.tab(
              activeSection === section.id
            )}
            onClick={() =>
              setActiveSection(section.id)
            }
          >
            {section.icon}
            {section.label}
          </button>
        ))}
      </div>

      {/* =====================================================
          STATS
      ===================================================== */}

      <div style={styles.stats}>
        <div style={styles.stat}>
          <div style={styles.statIcon('#2563eb')}>
            <Activity size={21} />
          </div>

          <div>
            <div style={styles.statValue}>
              {stats.totalScans}
            </div>

            <div style={styles.statLabel}>
              {t.totalScans}
            </div>
          </div>
        </div>

        <div style={styles.stat}>
          <div style={styles.statIcon('#16a34a')}>
            <Package size={21} />
          </div>

          <div>
            <div style={styles.statValue}>
              {stats.trackedAssets}
            </div>

            <div style={styles.statLabel}>
              {t.trackedAssets}
            </div>
          </div>
        </div>

        <div style={styles.stat}>
          <div style={styles.statIcon('#7c3aed')}>
            <Radio size={21} />
          </div>

          <div>
            <div style={styles.statValue}>
              {stats.readers}
            </div>

            <div style={styles.statLabel}>
              {t.readers}
            </div>
          </div>
        </div>

        <div style={styles.stat}>
          <div style={styles.statIcon('#d97706')}>
            <MapPin size={21} />
          </div>

          <div>
            <div style={styles.statValue}>
              {stats.locations}
            </div>

            <div style={styles.statLabel}>
              {t.locations}
            </div>
          </div>
        </div>

        <div style={styles.stat}>
          <div style={styles.statIcon('#dc2626')}>
            <Zap size={21} />
          </div>

          <div>
            <div style={styles.statValue}>
              {stats.anomalies}
            </div>

            <div style={styles.statLabel}>
              {t.anomalies}
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================
          RFID ASSETS
      ===================================================== */}

      {activeSection === 'rfid-assets' && (
        <div style={styles.panel}>
          <div style={styles.panelHeader}>
            <h2 style={styles.panelTitle}>
              📡 {t.rfidAssets}
            </h2>

            <button
              style={styles.button(colors.primary)}
              onClick={() =>
                setShowRegisterModal(true)
              }
            >
              <Plus size={15} />
              {t.registerTag}
            </button>
          </div>

          <div style={styles.controls}>
            <Search
              size={17}
              color={colors.muted}
            />

            <input
              style={styles.input}
              placeholder={t.searchAssets}
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
            />
          </div>

          {loading ? (
            <div style={styles.empty}>
              ⏳ {t.loading}
            </div>
          ) : filteredRFIDAssets.length === 0 ? (
            <div style={styles.empty}>
              <Radio
                size={40}
                color={colors.muted}
              />

              <p>
                {t.noRFIDAssets}
              </p>
            </div>
          ) : (
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>
                      {t.asset}
                    </th>

                    <th style={styles.th}>
                      {t.assetCode}
                    </th>

                    <th style={styles.th}>
                      {t.rfidTag}
                    </th>

                    <th style={styles.th}>
                      {t.location}
                    </th>

                    <th style={styles.th}>
                      {t.reader}
                    </th>

                    <th style={styles.th}>
                      {t.lastScan}
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
                  {filteredRFIDAssets.map(
                    (asset) => (
                      <tr key={asset.id}>
                        <td style={styles.td}>
                          <strong>
                            {asset.asset_name}
                          </strong>
                        </td>

                        <td style={styles.td}>
                          {asset.asset_code}
                        </td>

                        <td style={styles.td}>
                          <span
                            style={styles.badge(
                              isDark
                                ? '#1e3a5f'
                                : '#eff6ff',
                              colors.primary
                            )}
                          >
                            <Radio size={12} />
                            {asset.rfid_tag}
                          </span>
                        </td>

                        <td style={styles.td}>
                          <MapPin
                            size={13}
                            style={{
                              verticalAlign:
                                'middle'
                            }}
                          />{' '}
                          {asset.location}
                        </td>

                        <td style={styles.td}>
                          {asset.reader_id}
                        </td>

                        <td style={styles.td}>
                          {formatDate(
                            asset.timestamp
                          )}
                        </td>

                        <td style={styles.td}>
                          {asset.isAnomaly ? (
                            <span
                              style={styles.badge(
                                '#fee2e2',
                                '#dc2626'
                              )}
                            >
                              ⚠️ {t.anomaly}
                            </span>
                          ) : (
                            <span
                              style={styles.badge(
                                '#dcfce7',
                                '#16a34a'
                              )}
                            >
                              <CheckCircle
                                size={12}
                              />
                              {t.normal}
                            </span>
                          )}
                        </td>

                        <td style={styles.td}>
                          <button
                            style={styles.smallButton(
                              colors.primary
                            )}
                            onClick={() =>
                              openCodeForAsset(
                                asset
                              )
                            }
                          >
                            <QrCode size={12} />
                            {t.code}
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

      {/* =====================================================
          QR / BARCODE
      ===================================================== */}

      {activeSection === 'qr-barcode' && (
        <div style={styles.panel}>
          <div style={styles.panelHeader}>
            <h2 style={styles.panelTitle}>
              🔳 {t.qrBarcode}
            </h2>

            <button
              style={styles.button(colors.primary)}
              onClick={openCodeGenerator}
            >
              <Plus size={15} />
              {t.generateCode}
            </button>
          </div>

          <div style={styles.locationGrid}>
            {assetsLoading ? (
              <div style={styles.empty}>
                ⏳ {t.loading}
              </div>
            ) : assets.length === 0 ? (
              <div style={styles.empty}>
                {t.noAssets}
              </div>
            ) : (
              assets.map((asset) => (
                <div
                  key={asset.id}
                  style={styles.locationCard}
                >
                  <div style={styles.locationName}>
                    <Package
                      size={17}
                      style={{
                        verticalAlign: 'middle'
                      }}
                    />{' '}
                    {asset.name ||
                      asset.asset_name ||
                      `Asset ${asset.id}`}
                  </div>

                  <p style={styles.statLabel}>
                    {t.assetCode}:{' '}
                    <strong>
                      {asset.asset_code ||
                        asset.code ||
                        '-'}
                    </strong>
                  </p>

                  <button
                    style={styles.button(
                      colors.primary
                    )}
                    onClick={() =>
                      openCodeForAsset({
                        id: asset.id,
                        asset_name:
                          asset.name ||
                          asset.asset_name,
                        asset_code:
                          asset.asset_code ||
                          asset.code
                      })
                    }
                  >
                    <QrCode size={15} />
                    {t.generateCode}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* =====================================================
          REGISTER TAG
      ===================================================== */}

      {activeSection === 'register' && (
        <div style={styles.panel}>
          <div style={styles.panelHeader}>
            <div>
              <h2 style={styles.panelTitle}>
                🔗 {t.registerTag}
              </h2>

              <p style={styles.subtitle}>
                {t.registerDescription}
              </p>
            </div>

            <button
              style={styles.button(colors.primary)}
              onClick={() =>
                setShowRegisterModal(true)
              }
            >
              <Plus size={15} />
              {t.registerTag}
            </button>
          </div>

          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>
                    {t.asset}
                  </th>

                  <th style={styles.th}>
                    {t.tagType}
                  </th>

                  <th style={styles.th}>
                    {t.tagCode}
                  </th>

                  <th style={styles.th}>
                    {t.location}
                  </th>

                  <th style={styles.th}>
                    {t.lastScan}
                  </th>
                </tr>
              </thead>

              <tbody>
                {rfidAssets.length === 0 ? (
                  <tr>
                    <td
                      colSpan="5"
                      style={styles.empty}
                    >
                      {t.noRegisteredTags}
                    </td>
                  </tr>
                ) : (
                  rfidAssets.map((asset) => (
                    <tr key={asset.id}>
                      <td style={styles.td}>
                        {asset.asset_name}
                      </td>

                      <td style={styles.td}>
                        <span
                          style={styles.badge(
                            '#eff6ff',
                            '#2563eb'
                          )}
                        >
                          RFID
                        </span>
                      </td>

                      <td style={styles.td}>
                        {asset.rfid_tag}
                      </td>

                      <td style={styles.td}>
                        {asset.location}
                      </td>

                      <td style={styles.td}>
                        {formatDate(
                          asset.timestamp
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================
          SCAN ACTIVITY
      ===================================================== */}

      {activeSection === 'scan-activity' && (
        <div style={styles.panel}>
          <div style={styles.panelHeader}>
            <h2 style={styles.panelTitle}>
              📡 {t.scanActivity}
            </h2>

            <span
              style={styles.badge(
                '#dcfce7',
                '#16a34a'
              )}
            >
              <span>●</span>
              {t.live}
            </span>
          </div>

          <div style={styles.controls}>
            <Search
              size={17}
              color={colors.muted}
            />

            <input
              style={styles.input}
              placeholder={t.searchScans}
              value={scanSearch}
              onChange={(event) =>
                setScanSearch(event.target.value)
              }
            />
          </div>

          {loading ? (
            <div style={styles.empty}>
              ⏳ {t.loading}
            </div>
          ) : (
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>
                      {t.dateTime}
                    </th>

                    <th style={styles.th}>
                      {t.asset}
                    </th>

                    <th style={styles.th}>
                      {t.rfidTag}
                    </th>

                    <th style={styles.th}>
                      {t.reader}
                    </th>

                    <th style={styles.th}>
                      {t.location}
                    </th>

                    <th style={styles.th}>
                      {t.status}
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredScans.length === 0 ? (
                    <tr>
                      <td
                        colSpan="6"
                        style={styles.empty}
                      >
                        {t.noScans}
                      </td>
                    </tr>
                  ) : (
                    filteredScans
                      .slice(0, 200)
                      .map((log) => (
                        <tr key={log.id}>
                          <td style={styles.td}>
                            <Clock
                              size={13}
                              style={{
                                verticalAlign:
                                  'middle'
                              }}
                            />{' '}
                            {formatDate(
                              log.timestamp ||
                                log.created_at
                            )}
                          </td>

                          <td style={styles.td}>
                            <strong>
                              {log.asset_name ||
                                log.asset?.name ||
                                '-'}
                            </strong>
                          </td>

                          <td style={styles.td}>
                            {log.rfid_tag ||
                              log.tag_code ||
                              '-'}
                          </td>

                          <td style={styles.td}>
                            {log.reader_id ||
                              '-'}
                          </td>

                          <td style={styles.td}>
                            <MapPin
                              size={13}
                              style={{
                                verticalAlign:
                                  'middle'
                              }}
                            />{' '}
                            {getLocation(log)}
                          </td>

                          <td style={styles.td}>
                            {isAnomaly(log) ? (
                              <span
                                style={styles.badge(
                                  '#fee2e2',
                                  '#dc2626'
                                )}
                              >
                                ⚠️ {t.anomaly}
                              </span>
                            ) : (
                              <span
                                style={styles.badge(
                                  '#dcfce7',
                                  '#16a34a'
                                )}
                              >
                                <CheckCircle
                                  size={12}
                                />
                                {t.normal}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* =====================================================
          CURRENT LOCATION
      ===================================================== */}

      {activeSection === 'current-location' && (
        <div style={styles.panel}>
          <div style={styles.panelHeader}>
            <div>
              <h2 style={styles.panelTitle}>
                📍 {t.currentLocation}
              </h2>

              <p style={styles.subtitle}>
                {t.locationDescription}
              </p>
            </div>
          </div>

          <div style={styles.controls}>
            <Search
              size={17}
              color={colors.muted}
            />

            <input
              style={styles.input}
              placeholder={t.searchLocation}
              value={locationSearch}
              onChange={(event) =>
                setLocationSearch(
                  event.target.value
                )
              }
            />
          </div>

          <div style={styles.locationGrid}>
            {filteredLocations.length === 0 ? (
              <div style={styles.empty}>
                <MapPin
                  size={40}
                  color={colors.muted}
                />

                <p>
                  {t.noLocations}
                </p>
              </div>
            ) : (
              filteredLocations.map(
                (item) => (
                  <div
                    key={item.id}
                    style={styles.locationCard}
                  >
                    <div style={styles.locationName}>
                      <Package
                        size={17}
                        style={{
                          verticalAlign:
                            'middle'
                        }}
                      />{' '}
                      {item.asset_name}
                    </div>

                    <p style={styles.statLabel}>
                      {t.rfidTag}:{' '}
                      <strong>
                        {item.rfid_tag}
                      </strong>
                    </p>

                    <p style={styles.statLabel}>
                      {t.currentLocation}:
                    </p>

                    <div
                      style={
                        styles.locationValue
                      }
                    >
                      <MapPin
                        size={16}
                        style={{
                          verticalAlign:
                            'middle'
                        }}
                      />{' '}
                      {item.location}
                    </div>

                    <p style={styles.statLabel}>
                      {t.reader}:{' '}
                      {item.reader_id}
                    </p>

                    <p style={styles.statLabel}>
                      {t.lastSeen}:{' '}
                      {formatDate(
                        item.timestamp
                      )}
                    </p>
                  </div>
                )
              )
            )}
          </div>
        </div>
      )}

      {/* =====================================================
          HISTORY
      ===================================================== */}

      {activeSection === 'history' && (
        <div style={styles.panel}>
          <div style={styles.panelHeader}>
            <h2 style={styles.panelTitle}>
              📜 {t.trackingHistory}
            </h2>
          </div>

          <div style={styles.controls}>
            <Search
              size={17}
              color={colors.muted}
            />

            <input
              style={styles.input}
              placeholder={t.searchHistory}
              value={historySearch}
              onChange={(event) =>
                setHistorySearch(
                  event.target.value
                )
              }
            />

            <input
              type="date"
              style={styles.input}
              value={dateRange.start}
              onChange={(event) =>
                setDateRange({
                  ...dateRange,
                  start: event.target.value
                })
              }
            />

            <input
              type="date"
              style={styles.input}
              value={dateRange.end}
              onChange={(event) =>
                setDateRange({
                  ...dateRange,
                  end: event.target.value
                })
              }
            />

            <button
              style={styles.button('#64748b')}
              onClick={() => {
                setHistorySearch('');
                setDateRange({
                  start: '',
                  end: ''
                });
              }}
            >
              <X size={14} />
              {t.clear}
            </button>
          </div>

          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>
                    {t.dateTime}
                  </th>

                  <th style={styles.th}>
                    {t.asset}
                  </th>

                  <th style={styles.th}>
                    {t.rfidTag}
                  </th>

                  <th style={styles.th}>
                    {t.previousLocation}
                  </th>

                  <th style={styles.th}>
                    {t.newLocation}
                  </th>

                  <th style={styles.th}>
                    {t.movementType}
                  </th>

                  <th style={styles.th}>
                    {t.reader}
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredHistory.length === 0 ? (
                  <tr>
                    <td
                      colSpan="7"
                      style={styles.empty}
                    >
                      {t.noHistory}
                    </td>
                  </tr>
                ) : (
                  filteredHistory.map(
                    (log) => {
                      const previous =
                        log.previous_location ||
                        '-';

                      const current =
                        log.new_location ||
                        getLocation(log);

                      const moved =
                        previous !== '-' &&
                        current !== '-' &&
                        previous !== current;

                      return (
                        <tr key={log.id}>
                          <td style={styles.td}>
                            {formatDate(
                              log.timestamp ||
                                log.created_at
                            )}
                          </td>

                          <td style={styles.td}>
                            {log.asset_name ||
                              log.asset?.name ||
                              '-'}
                          </td>

                          <td style={styles.td}>
                            {log.rfid_tag ||
                              log.tag_code ||
                              '-'}
                          </td>

                          <td style={styles.td}>
                            {previous}
                          </td>

                          <td style={styles.td}>
                            {moved && (
                              <ArrowRight
                                size={14}
                                color={
                                  colors.primary
                                }
                                style={{
                                  verticalAlign:
                                    'middle'
                                }}
                              />
                            )}{' '}
                            {current}
                          </td>

                          <td style={styles.td}>
                            <span
                              style={styles.badge(
                                moved
                                  ? '#ede9fe'
                                  : '#eff6ff',
                                moved
                                  ? '#7c3aed'
                                  : '#2563eb'
                              )}
                            >
                              {moved
                                ? `🔄 ${t.transferred}`
                                : `📡 ${t.scanned}`}
                            </span>
                          </td>

                          <td style={styles.td}>
                            {log.reader_id ||
                              '-'}
                          </td>
                        </tr>
                      );
                    }
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================
          DEVICES
      ===================================================== */}

      {activeSection === 'devices' && (
        <div style={styles.panel}>
          <div style={styles.panelHeader}>
            <div>
              <h2 style={styles.panelTitle}>
                📟 {t.devices}
              </h2>

              <p style={styles.subtitle}>
                {t.devicesDescription}
              </p>
            </div>

            <button
              style={styles.button(colors.primary)}
              onClick={openAddDevice}
            >
              <Plus size={15} />
              {t.addDevice}
            </button>
          </div>

          {devicesLoading ? (
            <div style={styles.empty}>
              ⏳ {t.loading}
            </div>
          ) : devices.length === 0 ? (
            <div style={styles.empty}>
              <WifiOff
                size={40}
                color={colors.muted}
              />

              <p>
                {t.noDevices}
              </p>

              <button
                style={styles.button(
                  colors.primary
                )}
                onClick={openAddDevice}
              >
                <Plus size={15} />
                {t.addDevice}
              </button>
            </div>
          ) : (
            <div style={styles.deviceGrid}>
              {devices.map((device) => (
                <div
                  key={device.id}
                  style={styles.deviceCard}
                >
                  <div style={styles.deviceTop}>
                    <div>
                      <div
                        style={
                          styles.deviceName
                        }
                      >
                        📟{' '}
                        {device.name ||
                          `Reader ${device.id}`}
                      </div>

                      <span
                        style={styles.badge(
                          device.status ===
                            'Active'
                            ? '#dcfce7'
                            : '#fee2e2',
                          device.status ===
                            'Active'
                            ? '#16a34a'
                            : '#dc2626'
                        )}
                      >
                        {device.status ===
                        'Active' ? (
                          <Wifi size={11} />
                        ) : (
                          <WifiOff
                            size={11}
                          />
                        )}

                        {device.status ||
                          'Inactive'}
                      </span>
                    </div>
                  </div>

                  <div
                    style={styles.deviceInfo}
                  >
                    <div
                      style={
                        styles.infoRow
                      }
                    >
                      <span
                        style={
                          styles.infoLabel
                        }
                      >
                        {t.readerId}
                      </span>

                      <strong>
                        {device.reader_id ||
                          '-'}
                      </strong>
                    </div>

                    <div
                      style={
                        styles.infoRow
                      }
                    >
                      <span
                        style={
                          styles.infoLabel
                        }
                      >
                        {t.ipAddress}
                      </span>

                      <strong>
                        {device.ip_address ||
                          '-'}
                      </strong>
                    </div>

                    <div
                      style={
                        styles.infoRow
                      }
                    >
                      <span
                        style={
                          styles.infoLabel
                        }
                      >
                        {t.location}
                      </span>

                      <strong>
                        {device.location ||
                          '-'}
                      </strong>
                    </div>

                    <div
                      style={
                        styles.infoRow
                      }
                    >
                      <span
                        style={
                          styles.infoLabel
                        }
                      >
                        {t.lastConnected}
                      </span>

                      <strong>
                        {formatDate(
                          device.last_connected
                        )}
                      </strong>
                    </div>
                  </div>

                  <div
                    style={
                      styles.deviceActions
                    }
                  >
                    <button
                      style={styles.smallButton(
                        device.status ===
                          'Active'
                          ? colors.warning
                          : colors.success
                      )}
                      onClick={() =>
                        handleToggleDevice(
                          device
                        )
                      }
                    >
                      {device.status ===
                      'Active'
                        ? t.deactivate
                        : t.activate}
                    </button>

                    <button
                      style={styles.smallButton(
                        colors.primary
                      )}
                      onClick={() =>
                        handleTestConnection(
                          device
                        )
                      }
                    >
                      <Wifi size={12} />
                      {t.test}
                    </button>

                    <button
                      style={styles.smallButton(
                        '#7c3aed'
                      )}
                      onClick={() =>
                        openEditDevice(
                          device
                        )
                      }
                    >
                      <Edit3 size={12} />
                      {t.edit}
                    </button>

                    <button
                      style={styles.smallButton(
                        colors.danger
                      )}
                      onClick={() =>
                        handleDeleteDevice(
                          device.id
                        )
                      }
                    >
                      <Trash2 size={12} />
                      {t.delete}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =====================================================
          REGISTER TAG MODAL
      ===================================================== */}

      {showRegisterModal && (
        <div
          style={styles.modalOverlay}
          onClick={() =>
            setShowRegisterModal(false)
          }
        >
          <div
            style={styles.modal}
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>
                🔗 {t.registerTag}
              </h2>

              <button
                style={styles.closeButton}
                onClick={() =>
                  setShowRegisterModal(false)
                }
              >
                <X size={20} />
              </button>
            </div>

            <form
              style={styles.modalBody}
              onSubmit={handleRegisterTag}
            >
              <div style={styles.field}>
                <label style={styles.label}>
                  {t.asset}
                </label>

                <select
                  style={styles.modalInput}
                  value={
                    registerForm.asset_id
                  }
                  onChange={(event) => {
                    const asset =
                      assets.find(
                        (item) =>
                          String(item.id) ===
                          String(
                            event.target.value
                          )
                      );

                    setRegisterForm({
                      ...registerForm,
                      asset_id:
                        event.target.value,
                      asset_name:
                        asset?.name ||
                        asset?.asset_name ||
                        ''
                    });
                  }}
                  required
                >
                  <option value="">
                    {t.selectAsset}
                  </option>

                  {assets.map((asset) => (
                    <option
                      key={asset.id}
                      value={asset.id}
                    >
                      {asset.name ||
                        asset.asset_name ||
                        `Asset ${asset.id}`}
                      {' - '}
                      {asset.asset_code ||
                        asset.code ||
                        ''}
                    </option>
                  ))}
                </select>
              </div>

              <div style={styles.field}>
                <label style={styles.label}>
                  {t.tagType}
                </label>

                <select
                  style={styles.modalInput}
                  value={
                    registerForm.tag_type
                  }
                  onChange={(event) =>
                    setRegisterForm({
                      ...registerForm,
                      tag_type:
                        event.target.value
                    })
                  }
                >
                  <option value="RFID">
                    RFID
                  </option>

                  <option value="QR">
                    QR Code
                  </option>

                  <option value="BARCODE">
                    Barcode
                  </option>
                </select>
              </div>

              <div style={styles.field}>
                <label style={styles.label}>
                  {t.tagCode}
                </label>

                <input
                  style={styles.modalInput}
                  value={
                    registerForm.tag_code
                  }
                  onChange={(event) =>
                    setRegisterForm({
                      ...registerForm,
                      tag_code:
                        event.target.value
                    })
                  }
                  placeholder={
                    t.tagCodePlaceholder
                  }
                  required
                />
              </div>

              <div style={styles.field}>
                <label style={styles.label}>
                  {t.location}
                </label>

                <input
                  style={styles.modalInput}
                  value={
                    registerForm.location
                  }
                  onChange={(event) =>
                    setRegisterForm({
                      ...registerForm,
                      location:
                        event.target.value
                    })
                  }
                  placeholder={
                    t.locationPlaceholder
                  }
                />
              </div>

              <div style={styles.modalFooter}>
                <button
                  type="button"
                  style={styles.button(
                    '#64748b'
                  )}
                  onClick={() =>
                    setShowRegisterModal(
                      false
                    )
                  }
                >
                  {t.cancel}
                </button>

                <button
                  type="submit"
                  style={styles.button(
                    colors.primary
                  )}
                >
                  <Tag size={15} />
                  {t.register}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================
          DEVICE MODAL
      ===================================================== */}

      {showDeviceModal && (
        <div
          style={styles.modalOverlay}
          onClick={() =>
            setShowDeviceModal(false)
          }
        >
          <div
            style={styles.modal}
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>
                📟{' '}
                {editingDevice
                  ? t.editDevice
                  : t.addDevice}
              </h2>

              <button
                style={styles.closeButton}
                onClick={() =>
                  setShowDeviceModal(false)
                }
              >
                <X size={20} />
              </button>
            </div>

            <form
              style={styles.modalBody}
              onSubmit={handleDeviceSubmit}
            >
              <div style={styles.field}>
                <label style={styles.label}>
                  {t.deviceName}
                </label>

                <input
                  style={styles.modalInput}
                  value={deviceForm.name}
                  onChange={(event) =>
                    setDeviceForm({
                      ...deviceForm,
                      name: event.target.value
                    })
                  }
                  required
                />
              </div>

              <div style={styles.field}>
                <label style={styles.label}>
                  {t.readerId}
                </label>

                <input
                  style={styles.modalInput}
                  value={
                    deviceForm.reader_id
                  }
                  onChange={(event) =>
                    setDeviceForm({
                      ...deviceForm,
                      reader_id:
                        event.target.value
                    })
                  }
                />
              </div>

              <div style={styles.field}>
                <label style={styles.label}>
                  {t.ipAddress}
                </label>

                <input
                  style={styles.modalInput}
                  value={
                    deviceForm.ip_address
                  }
                  onChange={(event) =>
                    setDeviceForm({
                      ...deviceForm,
                      ip_address:
                        event.target.value
                    })
                  }
                />
              </div>

              <div style={styles.field}>
                <label style={styles.label}>
                  {t.location}
                </label>

                <input
                  style={styles.modalInput}
                  value={
                    deviceForm.location
                  }
                  onChange={(event) =>
                    setDeviceForm({
                      ...deviceForm,
                      location:
                        event.target.value
                    })
                  }
                />
              </div>

              <div style={styles.field}>
                <label style={styles.label}>
                  {t.status}
                </label>

                <select
                  style={styles.modalInput}
                  value={deviceForm.status}
                  onChange={(event) =>
                    setDeviceForm({
                      ...deviceForm,
                      status:
                        event.target.value
                    })
                  }
                >
                  <option value="Active">
                    Active
                  </option>

                  <option value="Inactive">
                    Inactive
                  </option>

                  <option value="Maintenance">
                    Maintenance
                  </option>
                </select>
              </div>

              <div style={styles.modalFooter}>
                <button
                  type="button"
                  style={styles.button(
                    '#64748b'
                  )}
                  onClick={() =>
                    setShowDeviceModal(
                      false
                    )
                  }
                >
                  {t.cancel}
                </button>

                <button
                  type="submit"
                  style={styles.button(
                    colors.primary
                  )}
                >
                  {editingDevice
                    ? t.update
                    : t.add}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================
          QR / BARCODE MODAL
      ===================================================== */}

      {showCodeModal && (
        <div
          style={styles.modalOverlay}
          onClick={() =>
            setShowCodeModal(false)
          }
        >
          <div
            style={styles.modal}
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>
                🔳 {t.qrBarcode}
              </h2>

              <button
                style={styles.closeButton}
                onClick={() =>
                  setShowCodeModal(false)
                }
              >
                <X size={20} />
              </button>
            </div>

            <div style={styles.modalBody}>
              <div style={styles.field}>
                <label style={styles.label}>
                  {t.asset}
                </label>

                <select
                  style={styles.modalInput}
                  value={codeForm.asset_id}
                  onChange={(event) => {
                    const asset =
                      assets.find(
                        (item) =>
                          String(item.id) ===
                          String(
                            event.target.value
                          )
                      );

                    setCodeForm({
                      ...codeForm,
                      asset_id:
                        event.target.value,
                      asset_name:
                        asset?.name ||
                        asset?.asset_name ||
                        '',
                      code_value:
                        asset?.asset_code ||
                        asset?.code ||
                        ''
                    });
                  }}
                >
                  <option value="">
                    {t.selectAsset}
                  </option>

                  {assets.map((asset) => (
                    <option
                      key={asset.id}
                      value={asset.id}
                    >
                      {asset.name ||
                        asset.asset_name ||
                        `Asset ${asset.id}`}
                    </option>
                  ))}
                </select>
              </div>

              <div style={styles.field}>
                <label style={styles.label}>
                  {t.codeType}
                </label>

                <select
                  style={styles.modalInput}
                  value={
                    codeForm.code_type
                  }
                  onChange={(event) =>
                    setCodeForm({
                      ...codeForm,
                      code_type:
                        event.target.value
                    })
                  }
                >
                  <option value="QR">
                    QR Code
                  </option>

                  <option value="BARCODE">
                    Barcode
                  </option>
                </select>
              </div>

              <button
                style={styles.button(
                  colors.primary
                )}
                onClick={generateCode}
              >
                <Zap size={15} />
                {t.generateCode}
              </button>

              {codeForm.code_value && (
                <>
                  <div style={styles.codeBox}>
                    {codeForm.code_type ===
                    'QR' ? (
                      <QrCode
                        size={150}
                        strokeWidth={1.2}
                      />
                    ) : (
                      <Barcode
                        size={190}
                        strokeWidth={1.2}
                      />
                    )}

                    <strong>
                      {codeForm.asset_name}
                    </strong>

                    <div
                      style={
                        styles.codeText
                      }
                    >
                      {codeForm.code_value}
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      gap: '8px',
                      justifyContent:
                        'center',
                      flexWrap: 'wrap'
                    }}
                  >
                    <button
                      style={styles.button(
                        colors.primary
                      )}
                      onClick={downloadCode}
                    >
                      <Download size={15} />
                      {t.download}
                    </button>

                    <button
                      style={styles.button(
                        '#64748b'
                      )}
                      onClick={printCode}
                    >
                      <Printer size={15} />
                      {t.print}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* =========================================================
   ENGLISH
   ========================================================= */

const english = {
  title: 'RFID / QR Tracking',
  subtitle:
    'Complete asset identification, scanning and location tracking',

  rfidAssets: 'RFID Assets',
  qrBarcode: 'QR / Barcode',
  registerTag: 'Register Tag',
  scanActivity: 'Scan Activity',
  currentLocation: 'Current Location',
  trackingHistory: 'Tracking History',
  devices: 'RFID Devices',

  totalScans: 'Total Scans',
  trackedAssets: 'Tracked Assets',
  readers: 'Readers',
  locations: 'Locations',
  anomalies: 'Anomalies',

  refresh: 'Refresh',
  loading: 'Loading...',
  live: 'LIVE',

  asset: 'Asset',
  assetCode: 'Asset Code',
  rfidTag: 'RFID Tag',
  tagType: 'Tag Type',
  tagCode: 'Tag Code',
  reader: 'Reader',
  readerId: 'Reader ID',
  location: 'Location',
  status: 'Status',
  lastScan: 'Last Scan',
  lastSeen: 'Last Seen',
  dateTime: 'Date & Time',
  previousLocation: 'Previous Location',
  newLocation: 'New Location',
  movementType: 'Movement Type',
  actions: 'Actions',

  normal: 'Normal',
  anomaly: 'Anomaly',
  scanned: 'Scanned',
  transferred: 'Transferred',

  searchAssets:
    'Search asset, tag, location...',
  searchScans:
    'Search scan activity...',
  searchLocation:
    'Search asset or location...',
  searchHistory:
    'Search tracking history...',

  generateCode: 'Generate Code',
  code: 'Code',
  codeType: 'Code Type',
  download: 'Download',
  print: 'Print',

  register: 'Register',
  cancel: 'Cancel',
  add: 'Add',
  update: 'Update',
  edit: 'Edit',
  delete: 'Delete',
  test: 'Test',
  activate: 'Activate',
  deactivate: 'Deactivate',

  addDevice: 'Add RFID Device',
  editDevice: 'Edit RFID Device',
  deviceName: 'Device Name',
  ipAddress: 'IP Address',
  lastConnected: 'Last Connected',

  connectionSuccess:
    'Connection test successful',
  connectionFailed:
    'Connection test failed',

  tagRegistered:
    'Tag registered successfully',
  tagRegisterFailed:
    'Failed to register tag',

  deviceAdded:
    'RFID device added successfully',
  deviceUpdated:
    'RFID device updated successfully',
  deviceDeleted:
    'RFID device deleted successfully',
  deviceSaveFailed:
    'Failed to save RFID device',
  deviceDeleteFailed:
    'Failed to delete RFID device',

  statusChanged:
    'Device status changed successfully',
  statusFailed:
    'Failed to change device status',

  confirmDelete:
    'Are you sure you want to delete this device?',

  selectAsset: 'Select Asset',
  enterTag: 'Enter RFID/QR tag',
  tagCodePlaceholder:
    'Enter unique tag code',
  locationPlaceholder:
    'Enter current location',

  registerDescription:
    'Connect an RFID, QR or barcode identifier to an asset.',

  locationDescription:
    'Latest known location based on the most recent scan.',

  devicesDescription:
    'Manage RFID readers and scanning devices.',

  noRFIDAssets:
    'No RFID-tracked assets found',
  noAssets: 'No assets found',
  noRegisteredTags:
    'No registered tags found',
  noScans:
    'No scan activity found',
  noLocations:
    'No current asset locations found',
  noHistory:
    'No tracking history found',
  noDevices:
    'No RFID devices found',

  loadFailed:
    'Failed to load RFID data'
};

/* =========================================================
   AMHARIC
   ========================================================= */

const amharic = {
  title: 'RFID / QR ክትትል',
  subtitle:
    'የንብረት መለያ፣ ቅኝት እና የቦታ ክትትል ሙሉ ስርዓት',

  rfidAssets: 'RFID ንብረቶች',
  qrBarcode: 'QR / Barcode',
  registerTag: 'Tag መመዝገብ',
  scanActivity: 'የScan እንቅስቃሴ',
  currentLocation: 'የአሁኑ ቦታ',
  trackingHistory: 'የክትትል ታሪክ',
  devices: 'RFID መሳሪያዎች',

  totalScans: 'ጠቅላላ Scans',
  trackedAssets: 'የሚከታተሉ ንብረቶች',
  readers: 'አንባቢዎች',
  locations: 'ቦታዎች',
  anomalies: 'ያልተለመዱ',

  refresh: 'አድስ',
  loading: 'በመጫን ላይ...',
  live: 'በቀጥታ',

  asset: 'ንብረት',
  assetCode: 'የንብረት ኮድ',
  rfidTag: 'RFID Tag',
  tagType: 'የTag አይነት',
  tagCode: 'Tag ኮድ',
  reader: 'አንባቢ',
  readerId: 'የአንባቢ መለያ',
  location: 'ቦታ',
  status: 'ሁኔታ',
  lastScan: 'የመጨረሻ Scan',
  lastSeen: 'የመጨረሻ የታየበት',
  dateTime: 'ቀን እና ሰዓት',
  previousLocation: 'ቀዳሚ ቦታ',
  newLocation: 'አዲስ ቦታ',
  movementType: 'የእንቅስቃሴ አይነት',
  actions: 'ተግባራት',

  normal: 'መደበኛ',
  anomaly: 'ያልተለመደ',
  scanned: 'ተቃኝቷል',
  transferred: 'ተዛውሯል',

  searchAssets:
    'በንብረት፣ Tag ወይም ቦታ ይፈልጉ...',
  searchScans:
    'የScan እንቅስቃሴ ይፈልጉ...',
  searchLocation:
    'ንብረት ወይም ቦታ ይፈልጉ...',
  searchHistory:
    'የክትትል ታሪክ ይፈልጉ...',

  generateCode: 'ኮድ ፍጠር',
  code: 'ኮድ',
  codeType: 'የኮድ አይነት',
  download: 'አውርድ',
  print: 'አትም',

  register: 'መዝግብ',
  cancel: 'ሰርዝ',
  add: 'ጨምር',
  update: 'አሻሽል',
  edit: 'አርትዕ',
  delete: 'ሰርዝ',
  test: 'ፈትን',
  activate: 'አንቃ',
  deactivate: 'አቦዝን',

  addDevice: 'RFID መሳሪያ ጨምር',
  editDevice: 'RFID መሳሪያ አርትዕ',
  deviceName: 'የመሳሪያ ስም',
  ipAddress: 'IP አድራሻ',
  lastConnected: 'የመጨረሻ ግንኙነት',

  connectionSuccess:
    'የግንኙነት ሙከራ ተሳክቷል',
  connectionFailed:
    'የግንኙነት ሙከራ አልተሳካም',

  tagRegistered:
    'Tag በተሳካ ሁኔታ ተመዝግቧል',
  tagRegisterFailed:
    'Tag መመዝገብ አልተቻለም',

  deviceAdded:
    'RFID መሳሪያ በተሳካ ሁኔታ ተጨምሯል',
  deviceUpdated:
    'RFID መሳሪያ በተሳካ ሁኔታ ተሻሽሏል',
  deviceDeleted:
    'RFID መሳሪያ በተሳካ ሁኔታ ተሰርዟል',
  deviceSaveFailed:
    'RFID መሳሪያ ማስቀመጥ አልተቻለም',
  deviceDeleteFailed:
    'RFID መሳሪያ መሰረዝ አልተቻለም',

  statusChanged:
    'የመሳሪያ ሁኔታ ተቀይሯል',
  statusFailed:
    'የመሳሪያ ሁኔታ መቀየር አልተቻለም',

  confirmDelete:
    'ይህንን መሳሪያ ለመሰረዝ እርግጠኛ ነዎት?',

  selectAsset: 'ንብረት ይምረጡ',
  enterTag: 'RFID/QR Tag ያስገቡ',
  tagCodePlaceholder:
    'ልዩ Tag ኮድ ያስገቡ',
  locationPlaceholder:
    'የአሁኑን ቦታ ያስገቡ',

  registerDescription:
    'RFID፣ QR ወይም Barcode መለያን ከንብረት ጋር ያገናኙ።',

  locationDescription:
    'በመጨረሻው Scan ላይ የተመሰረተ የንብረቱ የቅርብ ጊዜ ቦታ።',

  devicesDescription:
    'RFID አንባቢዎችን እና የScan መሳሪያዎችን ያስተዳድሩ።',

  noRFIDAssets:
    'RFID የተመዘገቡ ንብረቶች የሉም',
  noAssets:
    'ምንም ንብረት አልተገኘም',
  noRegisteredTags:
    'ምንም የተመዘገቡ Tags የሉም',
  noScans:
    'ምንም Scan እንቅስቃሴ አልተገኘም',
  noLocations:
    'የንብረት የአሁኑ ቦታ አልተገኘም',
  noHistory:
    'ምንም የክትትል ታሪክ አልተገኘም',
  noDevices:
    'ምንም RFID መሳሪያ አልተገኘም',

  loadFailed:
    'RFID መረጃ መጫን አልተቻለም'
};

export default AdminRFIDTracking;