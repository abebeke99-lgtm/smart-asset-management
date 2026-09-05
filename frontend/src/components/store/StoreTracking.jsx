import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useLanguage } from '../../contexts/UiContext';

/*
 * STORE RFID / QR TRACKING
 *
 * Menu:
 *   RFID Assets
 *   QR / Barcode
 *   Register Tag
 *   Scan Asset
 *   Current Location
 *   Scan Activity
 *   Tracking History
 *
 * API endpoints used:
 *   GET  /api/assets
 *   GET  /api/assets/:id
 *   PUT  /api/assets/:id
 *   POST /api/assets/:id/rfid
 *   POST /api/assets/:id/qr
 *   POST /api/tracking/scan
 *   GET  /api/tracking
 *
 * The component also gracefully falls back when an optional
 * tracking endpoint is not available.
 */

const StoreTracking = () => {
  const { language, theme } = useLanguage();

  const isDark = theme === 'dark';
  const isAmharic = language === 'am';

  const [activeTab, setActiveTab] = useState('rfid');
  const [assets, setAssets] = useState([]);
  const [trackingHistory, setTrackingHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [selectedAsset, setSelectedAsset] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  const [registerForm, setRegisterForm] = useState({
    assetId: '',
    tagType: 'RFID',
    tagCode: '',
    notes: ''
  });

  const [scanForm, setScanForm] = useState({
    code: '',
    scanType: 'RFID',
    location: 'Main Store',
    notes: ''
  });

  const [locationForm, setLocationForm] = useState({
    assetId: '',
    location: 'Main Store',
    notes: ''
  });

  const t = isAmharic
    ? {
        title: 'RFID / QR ክትትል',
        subtitle: 'የንብረት RFID፣ QR እና ባርኮድ ክትትል ያስተዳድሩ',

        rfidAssets: 'RFID ያላቸው ንብረቶች',
        qrBarcode: 'QR / Barcode',
        registerTag: 'Tag ይመዝግቡ',
        scanAsset: 'ንብረት ስካን',
        currentLocation: 'የአሁኑ አካባቢ',
        scanActivity: 'የስካን እንቅስቃሴ',
        trackingHistory: 'የክትትል ታሪክ',

        asset: 'ንብረት',
        assetTag: 'የንብረት Tag',
        name: 'ስም',
        category: 'ምድብ',
        serialNumber: 'ተከታታይ ቁጥር',
        status: 'ሁኔታ',
        location: 'አካባቢ',
        rfid: 'RFID',
        qrCode: 'QR Code',
        barcode: 'Barcode',
        tagType: 'የTag አይነት',
        tagCode: 'Tag Code',
        notes: 'ማስታወሻ',
        scanCode: 'የስካን ኮድ',
        scanType: 'የስካን አይነት',
        scanLocation: 'የስካን አካባቢ',
        updateLocation: 'አካባቢ አዘምን',

        register: 'መዝግብ',
        scan: 'ስካን',
        update: 'አዘምን',
        refresh: 'አድስ',
        details: 'ዝርዝር',
        close: 'ዝጋ',
        search: 'ፈልግ',

        all: 'ሁሉም',
        available: 'ይገኛል',
        issued: 'ተሰጥቷል',
        maintenance: 'ጥገና',
        noData: 'ምንም መረጃ አልተገኘም',

        loading: 'በመጫን ላይ...',
        loadingAssets: 'ንብረቶችን በመጫን ላይ...',
        processing: 'በሂደት ላይ...',

        registerSuccess: 'Tag በተሳካ ሁኔታ ተመዝግቧል',
        registerError: 'Tag መመዝገብ አልተቻለም',
        scanSuccess: 'ስካኑ በተሳካ ሁኔታ ተመዝግቧል',
        scanError: 'ስካን መመዝገብ አልተቻለም',
        locationSuccess: 'አካባቢው በተሳካ ሁኔታ ተዘምኗል',
        locationError: 'አካባቢውን ማዘመን አልተቻለም',
        fetchError: 'መረጃ ማግኘት አልተቻለም',

        noRfid: 'RFID የሌላቸው ንብረቶች',
        noQr: 'QR / Barcode የሌላቸው ንብረቶች',
        selectAsset: 'ንብረት ይምረጡ',
        selectTagType: 'የTag አይነት ይምረጡ',
        enterCode: 'ኮድ ያስገቡ',
        mainStore: 'ዋና መደብር'
      }
    : {
        title: 'RFID / QR Tracking',
        subtitle: 'Manage RFID, QR code, barcode and asset location tracking',

        rfidAssets: 'RFID Assets',
        qrBarcode: 'QR / Barcode',
        registerTag: 'Register Tag',
        scanAsset: 'Scan Asset',
        currentLocation: 'Current Location',
        scanActivity: 'Scan Activity',
        trackingHistory: 'Tracking History',

        asset: 'Asset',
        assetTag: 'Asset Tag',
        name: 'Name',
        category: 'Category',
        serialNumber: 'Serial Number',
        status: 'Status',
        location: 'Location',
        rfid: 'RFID',
        qrCode: 'QR Code',
        barcode: 'Barcode',
        tagType: 'Tag Type',
        tagCode: 'Tag Code',
        notes: 'Notes',
        scanCode: 'Scan Code',
        scanType: 'Scan Type',
        scanLocation: 'Scan Location',
        updateLocation: 'Update Location',

        register: 'Register',
        scan: 'Scan',
        update: 'Update',
        refresh: 'Refresh',
        details: 'Details',
        close: 'Close',
        search: 'Search',

        all: 'All',
        available: 'Available',
        issued: 'Issued',
        maintenance: 'Maintenance',
        noData: 'No records found',

        loading: 'Loading...',
        loadingAssets: 'Loading assets...',
        processing: 'Processing...',

        registerSuccess: 'Tag registered successfully',
        registerError: 'Failed to register tag',
        scanSuccess: 'Scan recorded successfully',
        scanError: 'Failed to record scan',
        locationSuccess: 'Location updated successfully',
        locationError: 'Failed to update location',
        fetchError: 'Failed to load tracking data',

        noRfid: 'No RFID assets found',
        noQr: 'No QR / Barcode assets found',
        selectAsset: 'Select Asset',
        selectTagType: 'Select Tag Type',
        enterCode: 'Enter code',
        mainStore: 'Main Store'
      };

  const getAssetId = (asset) =>
    asset?.id ||
    asset?.asset_id ||
    asset?.assetId ||
    '';

  const getAssetName = (asset) =>
    asset?.name ||
    asset?.asset_name ||
    asset?.assetName ||
    'Unnamed Asset';

  const getAssetTag = (asset) =>
    asset?.asset_tag ||
    asset?.assetTag ||
    asset?.asset_code ||
    asset?.assetCode ||
    '-';

  const getSerial = (asset) =>
    asset?.serial_number ||
    asset?.serialNumber ||
    '-';

  const getCategory = (asset) =>
    asset?.category_name ||
    asset?.category ||
    asset?.categoryName ||
    '-';

  const getStatus = (asset) =>
    asset?.status ||
    (asset?.is_available ? 'Available' : 'Issued') ||
    '-';

  const getLocation = (asset) =>
    asset?.location ||
    asset?.current_location ||
    asset?.currentLocation ||
    asset?.department ||
    '-';

  const getRfid = (asset) =>
    asset?.rfid_tag ||
    asset?.rfid ||
    asset?.rfid_code ||
    asset?.rfidCode ||
    '';

  const getQr = (asset) =>
    asset?.qr_code ||
    asset?.qrCode ||
    asset?.barcode ||
    asset?.barcode_value ||
    '';

  const normalizeAssets = (response) => {
    return (
      response?.data?.assets ||
      response?.data?.data ||
      response?.data ||
      []
    );
  };

  const fetchTrackingData = useCallback(async () => {
    setLoading(true);

    try {
      const [assetsResponse, trackingResponse] = await Promise.allSettled([
        axios.get('/api/assets', {
          params: {
            limit: 1000
          }
        }),
        axios.get('/api/tracking', {
          params: {
            limit: 500
          }
        })
      ]);

      if (assetsResponse.status === 'fulfilled') {
        setAssets(normalizeAssets(assetsResponse.value));
      } else {
        setAssets([]);
        toast.error(t.fetchError);
      }

      if (trackingResponse.status === 'fulfilled') {
        const data =
          trackingResponse.value?.data?.data ||
          trackingResponse.value?.data?.tracking ||
          trackingResponse.value?.data?.history ||
          trackingResponse.value?.data ||
          [];

        setTrackingHistory(Array.isArray(data) ? data : []);
      } else {
        setTrackingHistory([]);
      }
    } catch (error) {
      setAssets([]);
      setTrackingHistory([]);
      toast.error(t.fetchError);
    } finally {
      setLoading(false);
    }
  }, [t.fetchError]);

  useEffect(() => {
    fetchTrackingData();
  }, [fetchTrackingData]);

  const filteredAssets = useMemo(() => {
    const term = search.trim().toLowerCase();

    return assets.filter((asset) => {
      const matchesSearch =
        !term ||
        [
          getAssetName(asset),
          getAssetTag(asset),
          getSerial(asset),
          getCategory(asset),
          getLocation(asset),
          getRfid(asset),
          getQr(asset)
        ]
          .join(' ')
          .toLowerCase()
          .includes(term);

      const status = getStatus(asset);

      const matchesStatus =
        statusFilter === 'all' ||
        status.toLowerCase() === statusFilter.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }, [assets, search, statusFilter]);

  const rfidAssets = useMemo(
    () => filteredAssets.filter((asset) => Boolean(getRfid(asset))),
    [filteredAssets]
  );

  const qrAssets = useMemo(
    () => filteredAssets.filter((asset) => Boolean(getQr(asset))),
    [filteredAssets]
  );

  const untaggedAssets = useMemo(
    () =>
      filteredAssets.filter(
        (asset) => !getRfid(asset) && !getQr(asset)
      ),
    [filteredAssets]
  );

  const handleRegisterTag = async (event) => {
    event.preventDefault();

    if (!registerForm.assetId || !registerForm.tagCode.trim()) {
      toast.error(
        isAmharic
          ? 'ንብረት እና Tag Code ይምረጡ'
          : 'Select an asset and enter a tag code'
      );
      return;
    }

    setProcessing(true);

    const payload = {
      tag_type: registerForm.tagType,
      tag_code: registerForm.tagCode.trim(),
      notes: registerForm.notes
    };

    try {
      let response;

      if (registerForm.tagType === 'RFID') {
        response = await axios.post(
          `/api/assets/${registerForm.assetId}/rfid`,
          payload
        );
      } else {
        response = await axios.post(
          `/api/assets/${registerForm.assetId}/qr`,
          payload
        );
      }

      if (response?.status >= 200 && response?.status < 300) {
        toast.success(t.registerSuccess);
      }

      setRegisterForm({
        assetId: '',
        tagType: 'RFID',
        tagCode: '',
        notes: ''
      });

      await fetchTrackingData();
    } catch (error) {
      /*
       * Fallback for installations where dedicated RFID/QR endpoints
       * are not yet available.
       */
      try {
        await axios.put(`/api/assets/${registerForm.assetId}`, {
          rfid_tag:
            registerForm.tagType === 'RFID'
              ? registerForm.tagCode.trim()
              : undefined,
          qr_code:
            registerForm.tagType !== 'RFID'
              ? registerForm.tagCode.trim()
              : undefined
        });

        toast.success(t.registerSuccess);

        setRegisterForm({
          assetId: '',
          tagType: 'RFID',
          tagCode: '',
          notes: ''
        });

        await fetchTrackingData();
      } catch (fallbackError) {
        toast.error(t.registerError);
      }
    } finally {
      setProcessing(false);
    }
  };

  const handleScan = async (event) => {
    event.preventDefault();

    if (!scanForm.code.trim()) {
      toast.error(t.enterCode);
      return;
    }

    setProcessing(true);

    try {
      await axios.post('/api/tracking/scan', {
        code: scanForm.code.trim(),
        scan_type: scanForm.scanType,
        location: scanForm.location,
        notes: scanForm.notes
      });

      toast.success(t.scanSuccess);

      setScanForm({
        code: '',
        scanType: 'RFID',
        location: t.mainStore,
        notes: ''
      });

      await fetchTrackingData();
    } catch (error) {
      /*
       * If tracking endpoint does not exist, locate the asset locally
       * and update its current location.
       */
      const found = assets.find(
        (asset) =>
          getRfid(asset).toLowerCase() ===
            scanForm.code.trim().toLowerCase() ||
          getQr(asset).toLowerCase() ===
            scanForm.code.trim().toLowerCase() ||
          getAssetTag(asset).toLowerCase() ===
            scanForm.code.trim().toLowerCase()
      );

      if (found) {
        try {
          await axios.put(`/api/assets/${getAssetId(found)}`, {
            location: scanForm.location,
            current_location: scanForm.location
          });

          toast.success(t.scanSuccess);
          setScanForm({
            code: '',
            scanType: 'RFID',
            location: t.mainStore,
            notes: ''
          });

          await fetchTrackingData();
        } catch (fallbackError) {
          toast.error(t.scanError);
        }
      } else {
        toast.error(t.scanError);
      }
    } finally {
      setProcessing(false);
    }
  };

  const handleLocationUpdate = async (event) => {
    event.preventDefault();

    if (!locationForm.assetId || !locationForm.location.trim()) {
      toast.error(
        isAmharic
          ? 'ንብረት እና አካባቢ ይምረጡ'
          : 'Select an asset and enter a location'
      );
      return;
    }

    setProcessing(true);

    try {
      await axios.put(`/api/assets/${locationForm.assetId}`, {
        location: locationForm.location.trim(),
        current_location: locationForm.location.trim()
      });

      toast.success(t.locationSuccess);

      setLocationForm({
        assetId: '',
        location: t.mainStore,
        notes: ''
      });

      await fetchTrackingData();
    } catch (error) {
      toast.error(t.locationError);
    } finally {
      setProcessing(false);
    }
  };

  const openDetails = (asset) => {
    setSelectedAsset(asset);
    setShowDetails(true);
  };

  const statusStyle = (status) => {
    const normalized = String(status || '').toLowerCase();

    let background = isDark ? '#24364d' : '#eff6ff';
    let color = isDark ? '#bfdbfe' : '#2563eb';

    if (normalized.includes('available')) {
      background = isDark ? '#123b2a' : '#ecfdf5';
      color = '#16a34a';
    }

    if (normalized.includes('maintenance')) {
      background = isDark ? '#422006' : '#fff7ed';
      color = '#ea580c';
    }

    if (normalized.includes('damaged')) {
      background = isDark ? '#450a0a' : '#fef2f2';
      color = '#dc2626';
    }

    return {
      display: 'inline-flex',
      padding: '4px 10px',
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 700,
      background,
      color
    };
  };

  const renderAssetTable = (data, emptyMessage) => {
    if (data.length === 0) {
      return (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>📡</div>
          <div style={styles.emptyTitle}>{emptyMessage}</div>
          <div style={styles.emptyText}>{t.noData}</div>
        </div>
      );
    }

    return (
      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>{t.asset}</th>
              <th style={styles.th}>{t.assetTag}</th>
              <th style={styles.th}>{t.serialNumber}</th>
              <th style={styles.th}>{t.category}</th>
              <th style={styles.th}>{t.location}</th>
              <th style={styles.th}>{t.status}</th>
              <th style={styles.th}>{t.rfid}</th>
              <th style={styles.th}>{t.qrCode}</th>
              <th style={styles.th}>{t.details}</th>
            </tr>
          </thead>

          <tbody>
            {data.map((asset) => (
              <tr key={getAssetId(asset)} style={styles.tr}>
                <td style={styles.td}>
                  <div style={styles.assetName}>
                    {getAssetName(asset)}
                  </div>
                </td>

                <td style={styles.td}>
                  <span style={styles.codeBadge}>
                    {getAssetTag(asset)}
                  </span>
                </td>

                <td style={styles.td}>{getSerial(asset)}</td>

                <td style={styles.td}>{getCategory(asset)}</td>

                <td style={styles.td}>
                  📍 {getLocation(asset)}
                </td>

                <td style={styles.td}>
                  <span style={statusStyle(getStatus(asset))}>
                    {getStatus(asset)}
                  </span>
                </td>

                <td style={styles.td}>
                  {getRfid(asset) ? (
                    <span style={styles.tagBadge}>📡 {getRfid(asset)}</span>
                  ) : (
                    <span style={styles.muted}>-</span>
                  )}
                </td>

                <td style={styles.td}>
                  {getQr(asset) ? (
                    <span style={styles.qrBadge}>▦ {getQr(asset)}</span>
                  ) : (
                    <span style={styles.muted}>-</span>
                  )}
                </td>

                <td style={styles.td}>
                  <button
                    type="button"
                    style={styles.smallButton}
                    onClick={() => openDetails(asset)}
                  >
                    👁 {t.details}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const tabs = [
    {
      id: 'rfid',
      label: `📡 ${t.rfidAssets}`,
      count: rfidAssets.length
    },
    {
      id: 'qr',
      label: `▦ ${t.qrBarcode}`,
      count: qrAssets.length
    },
    {
      id: 'register',
      label: `🏷️ ${t.registerTag}`
    },
    {
      id: 'scan',
      label: `📷 ${t.scanAsset}`
    },
    {
      id: 'location',
      label: `📍 ${t.currentLocation}`
    },
    {
      id: 'activity',
      label: `⚡ ${t.scanActivity}`
    },
    {
      id: 'history',
      label: `🕘 ${t.trackingHistory}`
    }
  ];

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.loadingCard}>
          <div style={styles.loadingIcon}>📡</div>
          <div>{t.loadingAssets}</div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <div style={styles.titleRow}>
            <div style={styles.titleIcon}>📡</div>

            <div>
              <h1 style={styles.title}>{t.title}</h1>
              <p style={styles.subtitle}>{t.subtitle}</p>
            </div>
          </div>
        </div>

        <button
          type="button"
          style={styles.refreshButton}
          onClick={fetchTrackingData}
        >
          🔄 {t.refresh}
        </button>
      </div>

      {/* KPI cards */}
      <div style={styles.kpiGrid}>
        <div style={styles.kpiCard}>
          <div style={styles.kpiIcon}>📦</div>
          <div>
            <div style={styles.kpiLabel}>{t.asset}</div>
            <div style={styles.kpiValue}>{assets.length}</div>
          </div>
        </div>

        <div style={styles.kpiCard}>
          <div style={styles.kpiIcon}>📡</div>
          <div>
            <div style={styles.kpiLabel}>{t.rfidAssets}</div>
            <div style={styles.kpiValue}>{rfidAssets.length}</div>
          </div>
        </div>

        <div style={styles.kpiCard}>
          <div style={styles.kpiIcon}>▦</div>
          <div>
            <div style={styles.kpiLabel}>{t.qrBarcode}</div>
            <div style={styles.kpiValue}>{qrAssets.length}</div>
          </div>
        </div>

        <div style={styles.kpiCard}>
          <div style={styles.kpiIcon}>🏷️</div>
          <div>
            <div style={styles.kpiLabel}>
              {isAmharic ? 'Tag የሌላቸው' : 'Untagged'}
            </div>
            <div style={styles.kpiValue}>{untaggedAssets.length}</div>
          </div>
        </div>
      </div>

      {/* Search/filter */}
      {['rfid', 'qr', 'location'].includes(activeTab) && (
        <div style={styles.toolbar}>
          <div style={styles.searchBox}>
            <span>🔎</span>

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={`${t.search}...`}
              style={styles.searchInput}
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            style={styles.filterSelect}
          >
            <option value="all">{t.all}</option>
            <option value="available">{t.available}</option>
            <option value="issued">{t.issued}</option>
            <option value="under maintenance">
              {t.maintenance}
            </option>
          </select>
        </div>
      )}

      {/* Navigation */}
      <div style={styles.tabs}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            style={{
              ...styles.tab,
              ...(activeTab === tab.id ? styles.activeTab : {})
            }}
          >
            {tab.label}

            {typeof tab.count === 'number' && (
              <span style={styles.tabCount}>{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* RFID Assets */}
      {activeTab === 'rfid' && (
        <section style={styles.card}>
          <div style={styles.cardHeader}>
            <div>
              <h2 style={styles.cardTitle}>📡 {t.rfidAssets}</h2>
              <p style={styles.cardSubtitle}>
                {isAmharic
                  ? 'RFID Tag የተመዘገቡባቸውን ንብረቶች ይመልከቱ።'
                  : 'View all assets registered with RFID tags.'}
              </p>
            </div>
          </div>

          {renderAssetTable(rfidAssets, t.noRfid)}
        </section>
      )}

      {/* QR / Barcode */}
      {activeTab === 'qr' && (
        <section style={styles.card}>
          <div style={styles.cardHeader}>
            <div>
              <h2 style={styles.cardTitle}>▦ {t.qrBarcode}</h2>
              <p style={styles.cardSubtitle}>
                {isAmharic
                  ? 'QR Code ወይም Barcode የተመዘገቡባቸውን ንብረቶች ይመልከቱ።'
                  : 'View assets registered with QR codes or barcodes.'}
              </p>
            </div>
          </div>

          {renderAssetTable(qrAssets, t.noQr)}
        </section>
      )}

      {/* Register Tag */}
      {activeTab === 'register' && (
        <section style={styles.card}>
          <div style={styles.cardHeader}>
            <div>
              <h2 style={styles.cardTitle}>🏷️ {t.registerTag}</h2>
              <p style={styles.cardSubtitle}>
                {isAmharic
                  ? 'RFID፣ QR ወይም Barcode ከንብረት ጋር ያገናኙ።'
                  : 'Register an RFID, QR code or barcode against an asset.'}
              </p>
            </div>
          </div>

          <form onSubmit={handleRegisterTag}>
            <div style={styles.formGrid}>
              <div style={styles.formGroup}>
                <label style={styles.label}>{t.asset} *</label>

                <select
                  required
                  value={registerForm.assetId}
                  onChange={(event) =>
                    setRegisterForm({
                      ...registerForm,
                      assetId: event.target.value
                    })
                  }
                  style={styles.input}
                >
                  <option value="">{t.selectAsset}</option>

                  {assets.map((asset) => (
                    <option
                      key={getAssetId(asset)}
                      value={getAssetId(asset)}
                    >
                      {getAssetTag(asset)} — {getAssetName(asset)}
                    </option>
                  ))}
                </select>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>{t.tagType} *</label>

                <select
                  value={registerForm.tagType}
                  onChange={(event) =>
                    setRegisterForm({
                      ...registerForm,
                      tagType: event.target.value
                    })
                  }
                  style={styles.input}
                >
                  <option value="RFID">RFID</option>
                  <option value="QR">QR Code</option>
                  <option value="BARCODE">Barcode</option>
                </select>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>{t.tagCode} *</label>

                <input
                  required
                  value={registerForm.tagCode}
                  onChange={(event) =>
                    setRegisterForm({
                      ...registerForm,
                      tagCode: event.target.value
                    })
                  }
                  placeholder={t.enterCode}
                  style={styles.input}
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>{t.notes}</label>

                <input
                  value={registerForm.notes}
                  onChange={(event) =>
                    setRegisterForm({
                      ...registerForm,
                      notes: event.target.value
                    })
                  }
                  placeholder="Optional..."
                  style={styles.input}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={processing}
              style={styles.primaryButton}
            >
              {processing ? t.processing : `🏷️ ${t.register}`}
            </button>
          </form>
        </section>
      )}

      {/* Scan Asset */}
      {activeTab === 'scan' && (
        <section style={styles.card}>
          <div style={styles.scanHero}>
            <div style={styles.scanIcon}>📷</div>

            <h2 style={styles.cardTitle}>{t.scanAsset}</h2>

            <p style={styles.cardSubtitle}>
              {isAmharic
                ? 'RFID፣ QR ወይም Barcode ስካን በማድረግ ንብረቱን ይከታተሉ።'
                : 'Scan an RFID, QR code or barcode to record asset activity.'}
            </p>
          </div>

          <form onSubmit={handleScan}>
            <div style={styles.formGrid}>
              <div style={styles.formGroup}>
                <label style={styles.label}>{t.scanCode} *</label>

                <input
                  autoFocus
                  required
                  value={scanForm.code}
                  onChange={(event) =>
                    setScanForm({
                      ...scanForm,
                      code: event.target.value
                    })
                  }
                  placeholder="RFID / QR / Barcode..."
                  style={styles.largeInput}
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>{t.scanType}</label>

                <select
                  value={scanForm.scanType}
                  onChange={(event) =>
                    setScanForm({
                      ...scanForm,
                      scanType: event.target.value
                    })
                  }
                  style={styles.input}
                >
                  <option value="RFID">RFID</option>
                  <option value="QR">QR Code</option>
                  <option value="BARCODE">Barcode</option>
                </select>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>{t.scanLocation}</label>

                <input
                  value={scanForm.location}
                  onChange={(event) =>
                    setScanForm({
                      ...scanForm,
                      location: event.target.value
                    })
                  }
                  style={styles.input}
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>{t.notes}</label>

                <input
                  value={scanForm.notes}
                  onChange={(event) =>
                    setScanForm({
                      ...scanForm,
                      notes: event.target.value
                    })
                  }
                  style={styles.input}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={processing}
              style={styles.primaryButton}
            >
              {processing ? t.processing : `📷 ${t.scan}`}
            </button>
          </form>
        </section>
      )}

      {/* Current Location */}
      {activeTab === 'location' && (
        <section style={styles.card}>
          <div style={styles.cardHeader}>
            <div>
              <h2 style={styles.cardTitle}>📍 {t.currentLocation}</h2>
              <p style={styles.cardSubtitle}>
                {isAmharic
                  ? 'የንብረት የአሁኑን አካባቢ ይከታተሉ እና ያዘምኑ።'
                  : 'View and update the current location of assets.'}
              </p>
            </div>
          </div>

          <form onSubmit={handleLocationUpdate}>
            <div style={styles.formGrid}>
              <div style={styles.formGroup}>
                <label style={styles.label}>{t.asset} *</label>

                <select
                  required
                  value={locationForm.assetId}
                  onChange={(event) =>
                    setLocationForm({
                      ...locationForm,
                      assetId: event.target.value
                    })
                  }
                  style={styles.input}
                >
                  <option value="">{t.selectAsset}</option>

                  {assets.map((asset) => (
                    <option
                      key={getAssetId(asset)}
                      value={getAssetId(asset)}
                    >
                      {getAssetTag(asset)} — {getAssetName(asset)}
                    </option>
                  ))}
                </select>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>{t.location} *</label>

                <input
                  required
                  value={locationForm.location}
                  onChange={(event) =>
                    setLocationForm({
                      ...locationForm,
                      location: event.target.value
                    })
                  }
                  style={styles.input}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={processing}
              style={styles.primaryButton}
            >
              {processing ? t.processing : `📍 ${t.updateLocation}`}
            </button>
          </form>

          <div style={{ marginTop: 28 }}>
            {renderAssetTable(filteredAssets, t.noData)}
          </div>
        </section>
      )}

      {/* Scan Activity */}
      {activeTab === 'activity' && (
        <section style={styles.card}>
          <div style={styles.cardHeader}>
            <div>
              <h2 style={styles.cardTitle}>⚡ {t.scanActivity}</h2>
              <p style={styles.cardSubtitle}>
                {isAmharic
                  ? 'የቅርብ ጊዜ የRFID/QR ስካን እንቅስቃሴ።'
                  : 'Recent RFID, QR and barcode scan activity.'}
              </p>
            </div>
          </div>

          {trackingHistory.length === 0 ? (
            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}>⚡</div>
              <div style={styles.emptyTitle}>{t.noData}</div>
            </div>
          ) : (
            <div style={styles.activityList}>
              {trackingHistory.slice(0, 100).map((item, index) => (
                <div
                  key={item.id || item.scan_id || index}
                  style={styles.activityItem}
                >
                  <div style={styles.activityIcon}>📡</div>

                  <div style={{ flex: 1 }}>
                    <div style={styles.activityTitle}>
                      {item.asset_name ||
                        item.assetName ||
                        item.asset_tag ||
                        item.assetTag ||
                        item.code ||
                        'Asset Scan'}
                    </div>

                    <div style={styles.activityMeta}>
                      {item.scan_type ||
                        item.scanType ||
                        'RFID'}{' '}
                      •{' '}
                      {item.location ||
                        item.scan_location ||
                        item.scanLocation ||
                        '-'}
                    </div>
                  </div>

                  <div style={styles.activityDate}>
                    {item.created_at ||
                    item.createdAt ||
                    item.scan_time ||
                    item.scanTime
                      ? new Date(
                          item.created_at ||
                            item.createdAt ||
                            item.scan_time ||
                            item.scanTime
                        ).toLocaleString()
                      : '-'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Tracking History */}
      {activeTab === 'history' && (
        <section style={styles.card}>
          <div style={styles.cardHeader}>
            <div>
              <h2 style={styles.cardTitle}>🕘 {t.trackingHistory}</h2>
              <p style={styles.cardSubtitle}>
                {isAmharic
                  ? 'ሁሉንም የንብረት ክትትል ታሪክ ይመልከቱ።'
                  : 'Complete historical record of asset tracking events.'}
              </p>
            </div>
          </div>

          {trackingHistory.length === 0 ? (
            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}>🕘</div>
              <div style={styles.emptyTitle}>{t.noData}</div>
            </div>
          ) : (
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>#</th>
                    <th style={styles.th}>{t.asset}</th>
                    <th style={styles.th}>{t.scanType}</th>
                    <th style={styles.th}>{t.tagCode}</th>
                    <th style={styles.th}>{t.location}</th>
                    <th style={styles.th}>{t.status}</th>
                    <th style={styles.th}>Date</th>
                  </tr>
                </thead>

                <tbody>
                  {trackingHistory.map((item, index) => (
                    <tr
                      key={item.id || item.scan_id || index}
                      style={styles.tr}
                    >
                      <td style={styles.td}>{index + 1}</td>

                      <td style={styles.td}>
                        {item.asset_name ||
                          item.assetName ||
                          item.asset_tag ||
                          item.assetTag ||
                          '-'}
                      </td>

                      <td style={styles.td}>
                        {item.scan_type ||
                          item.scanType ||
                          item.tag_type ||
                          item.tagType ||
                          'RFID'}
                      </td>

                      <td style={styles.td}>
                        <span style={styles.codeBadge}>
                          {item.code ||
                            item.tag_code ||
                            item.tagCode ||
                            item.rfid ||
                            item.qr_code ||
                            '-'}
                        </span>
                      </td>

                      <td style={styles.td}>
                        📍{' '}
                        {item.location ||
                          item.scan_location ||
                          item.scanLocation ||
                          '-'}
                      </td>

                      <td style={styles.td}>
                        <span style={statusStyle(item.status || 'Scanned')}>
                          {item.status || 'Scanned'}
                        </span>
                      </td>

                      <td style={styles.td}>
                        {item.created_at ||
                        item.createdAt ||
                        item.scan_time ||
                        item.scanTime
                          ? new Date(
                              item.created_at ||
                                item.createdAt ||
                                item.scan_time ||
                                item.scanTime
                            ).toLocaleString()
                          : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Asset Details Modal */}
      {showDetails && selectedAsset && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.modalTitle}>
                  📦 {getAssetName(selectedAsset)}
                </h2>

                <div style={styles.modalSubtitle}>
                  {getAssetTag(selectedAsset)}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowDetails(false);
                  setSelectedAsset(null);
                }}
                style={styles.closeButton}
              >
                ✕
              </button>
            </div>

            <div style={styles.detailGrid}>
              <div style={styles.detailItem}>
                <span>{t.asset}</span>
                <strong>{getAssetName(selectedAsset)}</strong>
              </div>

              <div style={styles.detailItem}>
                <span>{t.assetTag}</span>
                <strong>{getAssetTag(selectedAsset)}</strong>
              </div>

              <div style={styles.detailItem}>
                <span>{t.serialNumber}</span>
                <strong>{getSerial(selectedAsset)}</strong>
              </div>

              <div style={styles.detailItem}>
                <span>{t.category}</span>
                <strong>{getCategory(selectedAsset)}</strong>
              </div>

              <div style={styles.detailItem}>
                <span>{t.status}</span>
                <strong>{getStatus(selectedAsset)}</strong>
              </div>

              <div style={styles.detailItem}>
                <span>{t.location}</span>
                <strong>{getLocation(selectedAsset)}</strong>
              </div>

              <div style={styles.detailItem}>
                <span>{t.rfid}</span>
                <strong>{getRfid(selectedAsset) || '-'}</strong>
              </div>

              <div style={styles.detailItem}>
                <span>{t.qrCode}</span>
                <strong>{getQr(selectedAsset) || '-'}</strong>
              </div>
            </div>

            <div style={styles.modalFooter}>
              <button
                type="button"
                style={styles.secondaryButton}
                onClick={() => {
                  setShowDetails(false);
                  setSelectedAsset(null);
                }}
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

const styles = {
  page: {
    minHeight: '100vh',
    padding: '24px',
    boxSizing: 'border-box',
    background: 'var(--page-bg, #f4f7fb)',
    color: 'var(--text, #172033)'
  },

  header: {
    maxWidth: 1600,
    margin: '0 auto 22px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
    flexWrap: 'wrap'
  },

  titleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 14
  },

  titleIcon: {
    width: 54,
    height: 54,
    borderRadius: 14,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 28,
    background: '#2563eb',
    color: '#fff',
    boxShadow: '0 8px 20px rgba(37,99,235,0.2)'
  },

  title: {
    margin: 0,
    fontSize: '1.8rem',
    fontWeight: 800
  },

  subtitle: {
    margin: '5px 0 0',
    fontSize: 14,
    color: '#64748b'
  },

  refreshButton: {
    border: '1px solid #cbd5e1',
    background: '#fff',
    color: '#1e293b',
    borderRadius: 9,
    padding: '10px 16px',
    fontWeight: 700,
    cursor: 'pointer'
  },

  kpiGrid: {
    maxWidth: 1600,
    margin: '0 auto 20px',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
    gap: 14
  },

  kpiCard: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 14,
    padding: 18,
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    boxShadow: '0 3px 12px rgba(15,23,42,0.05)'
  },

  kpiIcon: {
    width: 44,
    height: 44,
    borderRadius: 11,
    background: '#eff6ff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 21
  },

  kpiLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: 600
  },

  kpiValue: {
    marginTop: 2,
    fontSize: 23,
    fontWeight: 800
  },

  toolbar: {
    maxWidth: 1600,
    margin: '0 auto 16px',
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap'
  },

  searchBox: {
    flex: 1,
    minWidth: 240,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: '#fff',
    border: '1px solid #cbd5e1',
    borderRadius: 9,
    padding: '0 12px'
  },

  searchInput: {
    width: '100%',
    border: 'none',
    outline: 'none',
    padding: '11px 0',
    fontSize: 14,
    background: 'transparent'
  },

  filterSelect: {
    minWidth: 170,
    border: '1px solid #cbd5e1',
    borderRadius: 9,
    background: '#fff',
    padding: '10px 12px',
    outline: 'none'
  },

  tabs: {
    maxWidth: 1600,
    margin: '0 auto 20px',
    display: 'flex',
    gap: 7,
    overflowX: 'auto',
    paddingBottom: 4
  },

  tab: {
    flexShrink: 0,
    border: '1px solid #e2e8f0',
    background: '#fff',
    color: '#475569',
    borderRadius: 9,
    padding: '10px 14px',
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap'
  },

  activeTab: {
    background: '#2563eb',
    color: '#fff',
    borderColor: '#2563eb',
    boxShadow: '0 5px 14px rgba(37,99,235,0.2)'
  },

  tabCount: {
    marginLeft: 7,
    padding: '2px 7px',
    borderRadius: 20,
    background: 'rgba(255,255,255,0.25)',
    fontSize: 11
  },

  card: {
    maxWidth: 1600,
    margin: '0 auto',
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 14,
    padding: 22,
    boxShadow: '0 4px 16px rgba(15,23,42,0.05)'
  },

  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 15,
    marginBottom: 20
  },

  cardTitle: {
    margin: 0,
    fontSize: '1.2rem',
    fontWeight: 800
  },

  cardSubtitle: {
    margin: '5px 0 0',
    color: '#64748b',
    fontSize: 13
  },

  tableWrapper: {
    width: '100%',
    overflowX: 'auto'
  },

  table: {
    width: '100%',
    minWidth: 1050,
    borderCollapse: 'collapse'
  },

  th: {
    textAlign: 'left',
    padding: '12px 13px',
    background: '#f8fafc',
    color: '#475569',
    borderBottom: '2px solid #e2e8f0',
    fontSize: 11,
    fontWeight: 800,
    textTransform: 'uppercase',
    whiteSpace: 'nowrap'
  },

  tr: {
    borderBottom: '1px solid #eef2f7'
  },

  td: {
    padding: '12px 13px',
    color: '#334155',
    fontSize: 13,
    verticalAlign: 'middle'
  },

  assetName: {
    fontWeight: 750,
    color: '#172033'
  },

  codeBadge: {
    display: 'inline-block',
    background: '#f1f5f9',
    color: '#334155',
    padding: '4px 8px',
    borderRadius: 6,
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: 700
  },

  tagBadge: {
    display: 'inline-block',
    background: '#eff6ff',
    color: '#2563eb',
    padding: '4px 8px',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 700
  },

  qrBadge: {
    display: 'inline-block',
    background: '#f5f3ff',
    color: '#7c3aed',
    padding: '4px 8px',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 700
  },

  muted: {
    color: '#94a3b8'
  },

  smallButton: {
    border: 'none',
    borderRadius: 7,
    background: '#eff6ff',
    color: '#2563eb',
    padding: '7px 10px',
    fontWeight: 700,
    cursor: 'pointer'
  },

  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 16
  },

  formGroup: {
    display: 'flex',
    flexDirection: 'column'
  },

  label: {
    marginBottom: 7,
    fontSize: 12,
    color: '#475569',
    fontWeight: 750
  },

  input: {
    width: '100%',
    boxSizing: 'border-box',
    border: '1px solid #cbd5e1',
    borderRadius: 8,
    background: '#fff',
    color: '#172033',
    padding: '11px 12px',
    fontSize: 14,
    outline: 'none'
  },

  largeInput: {
    width: '100%',
    boxSizing: 'border-box',
    border: '2px solid #93c5fd',
    borderRadius: 9,
    background: '#fff',
    color: '#172033',
    padding: '14px',
    fontSize: 16,
    outline: 'none'
  },

  primaryButton: {
    marginTop: 20,
    width: '100%',
    border: 'none',
    borderRadius: 9,
    padding: '12px 18px',
    background: '#2563eb',
    color: '#fff',
    fontWeight: 800,
    cursor: 'pointer'
  },

  secondaryButton: {
    border: '1px solid #cbd5e1',
    borderRadius: 8,
    background: '#fff',
    color: '#334155',
    padding: '10px 16px',
    fontWeight: 700,
    cursor: 'pointer'
  },

  scanHero: {
    textAlign: 'center',
    padding: '12px 0 26px'
  },

  scanIcon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    margin: '0 auto 14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#eff6ff',
    fontSize: 34
  },

  activityList: {
    display: 'grid',
    gap: 9
  },

  activityItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 13,
    padding: 13,
    border: '1px solid #e2e8f0',
    borderRadius: 10,
    background: '#f8fafc'
  },

  activityIcon: {
    width: 38,
    height: 38,
    borderRadius: 9,
    background: '#eff6ff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },

  activityTitle: {
    fontWeight: 750,
    color: '#172033',
    fontSize: 14
  },

  activityMeta: {
    marginTop: 3,
    color: '#64748b',
    fontSize: 12
  },

  activityDate: {
    color: '#64748b',
    fontSize: 11,
    whiteSpace: 'nowrap'
  },

  emptyState: {
    textAlign: 'center',
    padding: '60px 20px',
    color: '#64748b'
  },

  emptyIcon: {
    fontSize: 42,
    marginBottom: 10
  },

  emptyTitle: {
    fontSize: 16,
    fontWeight: 800,
    color: '#334155'
  },

  emptyText: {
    marginTop: 5,
    fontSize: 13
  },

  loadingCard: {
    minHeight: '70vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#64748b',
    fontWeight: 700
  },

  loadingIcon: {
    fontSize: 42,
    marginBottom: 12
  },

  modalOverlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 2000,
    background: 'rgba(15,23,42,0.65)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20
  },

  modal: {
    width: '100%',
    maxWidth: 720,
    maxHeight: '90vh',
    overflowY: 'auto',
    background: '#fff',
    borderRadius: 16,
    padding: 24,
    boxShadow: '0 25px 70px rgba(0,0,0,0.25)'
  },

  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 22
  },

  modalTitle: {
    margin: 0,
    fontSize: '1.25rem',
    fontWeight: 800,
    color: '#172033'
  },

  modalSubtitle: {
    marginTop: 5,
    color: '#64748b',
    fontFamily: 'monospace',
    fontSize: 12
  },

  closeButton: {
    width: 36,
    height: 36,
    border: 'none',
    borderRadius: 8,
    background: '#f1f5f9',
    color: '#475569',
    cursor: 'pointer',
    fontWeight: 800
  },

  detailGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
    gap: 12
  },

  detailItem: {
    border: '1px solid #e2e8f0',
    borderRadius: 9,
    padding: 13,
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
    background: '#f8fafc'
  },

  modalFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: 22,
    paddingTop: 16,
    borderTop: '1px solid #e2e8f0'
  }
};

export default StoreTracking;
