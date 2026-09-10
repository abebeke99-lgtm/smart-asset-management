import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useLanguage } from '../../contexts/UiContext';

const StoreTracking = () => {
  const { language, theme } = useLanguage();
  const isDark = theme === 'dark';
  const isAmharic = language === 'am';

  const [activeTab, setActiveTab] = useState('lookup');
  const [assets, setAssets] = useState([]);
  const [trackingHistory, setTrackingHistory] = useState([]);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [lookupType, setLookupType] = useState('RFID');
  const [identifier, setIdentifier] = useState('');
  const [location, setLocation] = useState('');
  const [lookupMessage, setLookupMessage] = useState('');

  const t = isAmharic
    ? {
        title: 'RFID / QR ክትትል',
        subtitle: 'ንብረትን በRFID እና የንብረት ኮድ ይመልከቱ እና ያስተዳድሩ።',
        lookup: 'ፍለጋ',
        lookupPlaceholder: 'RFID ወይም የንብረት ኮድ ያስገቡ',
        findAsset: 'ንብረት ፈልግ',
        assetFound: 'ንብረት ተገኝቷል።',
        notFound: 'ምንም ንብረት አልተገኘም።',
        noRecentActivity: 'ምንም የቅርብ ክትትል መረጃ የለም።',
        scanEvent: 'የስካን ክስተት መዝግብ',
        registerRfid: 'RFID መመዝገብ',
        recentActivity: 'የቅርብ እንቅስቃሴ',
        assetList: 'ንብረቶች',
        refresh: 'አድስ',
        loading: 'በመጫን ላይ...',
        registerSuccess: 'RFID በተሳካ ሁኔታ ተመዝግቧል።',
        scanSuccess: 'የስካን ክስተት ተመዝግቧል።',
        error: 'ሂደቱ አልተሳካም።',
      }
    : {
        title: 'RFID / QR Tracking',
        subtitle: 'Identify and manage assets using RFID and asset identifiers from the live system.',
        lookup: 'Lookup',
        lookupPlaceholder: 'Enter RFID or asset code',
        findAsset: 'Find Asset',
        assetFound: 'Asset identified successfully.',
        notFound: 'No matching asset was found.',
        noRecentActivity: 'No recent tracking activity.',
        scanEvent: 'Record Scan Event',
        registerRfid: 'Register RFID',
        recentActivity: 'Recent Activity',
        assetList: 'Asset List',
        refresh: 'Refresh',
        loading: 'Loading...',
        registerSuccess: 'RFID tag registered successfully.',
        scanSuccess: 'Tracking event recorded successfully.',
        error: 'The operation failed.',
      };

  const parseAssetRows = (response) => {
    const data = response?.data;
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.assets)) return data.assets;
    if (Array.isArray(data?.data)) return data.data;
    return [];
  };

  const parseLogRows = (response) => {
    const data = response?.data;
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.logs)) return data.logs;
    if (Array.isArray(data?.data)) return data.data;
    return [];
  };

  const fetchTrackingData = useCallback(async () => {
    setLoading(true);
    try {
      const [assetResponse, logResponse] = await Promise.allSettled([
        axios.get('/api/assets', { params: { limit: 1000 } }),
        axios.get('/api/rfid', { params: { limit: 200 } })
      ]);

      setAssets(assetResponse.status === 'fulfilled' ? parseAssetRows(assetResponse.value) : []);
      setTrackingHistory(logResponse.status === 'fulfilled' ? parseLogRows(logResponse.value) : []);
    } catch (error) {
      setAssets([]);
      setTrackingHistory([]);
      toast.error(t.error);
    } finally {
      setLoading(false);
    }
  }, [t.error]);

  useEffect(() => {
    fetchTrackingData();
  }, [fetchTrackingData]);

  const stats = useMemo(() => {
    const rfidCount = assets.filter((asset) => String(asset.rfidTag || asset.rfid_tag || '').trim()).length;
    const assetCodeCount = assets.filter((asset) => String(asset.assetCode || asset.asset_tag || '').trim()).length;
    const today = new Date();
    const scansToday = trackingHistory.filter((entry) => {
      const date = new Date(entry.createdAt || entry.timestamp || entry.created_at || 0);
      return !Number.isNaN(date.getTime()) && date.toDateString() === today.toDateString();
    }).length;

    return {
      totalAssets: assets.length,
      rfidCount,
      assetCodeCount,
      scansToday,
      lastScan: trackingHistory[0]?.createdAt || trackingHistory[0]?.timestamp || null,
    };
  }, [assets, trackingHistory]);

  const handleLookup = async (event) => {
    event.preventDefault();
    const query = identifier.trim();
    if (!query) {
      toast.error(t.lookupPlaceholder);
      return;
    }

    setProcessing(true);
    setLookupMessage('');

    try {
      const response = await axios.get('/api/assets', { params: { search: query, limit: 20 } });
      const rows = parseAssetRows(response);
      const match = rows.find((asset) => {
        const values = [
          asset.rfidTag || asset.rfid_tag || '',
          asset.assetCode || asset.asset_tag || '',
          asset.serialNumber || asset.serial_number || '',
          asset.name || '',
        ].map((value) => String(value).toLowerCase());

        const normalized = query.toLowerCase();
        if (lookupType === 'RFID') {
          return values.some((value) => value === normalized);
        }
        return values.some((value) => value.includes(normalized));
      });

      if (!match) {
        setSelectedAsset(null);
        setLookupMessage(t.notFound);
        toast.info(t.notFound);
        return;
      }

      setSelectedAsset(match);
      setLocation(String(match.location || match.current_location || ''));
      setLookupMessage(t.assetFound);
      toast.success(t.assetFound);
    } catch (error) {
      setSelectedAsset(null);
      setLookupMessage(t.notFound);
      toast.error(error?.response?.data?.message || t.error);
    } finally {
      setProcessing(false);
    }
  };

  const handleRecordScan = async () => {
    if (!selectedAsset) {
      toast.error(t.notFound);
      return;
    }

    const tag = selectedAsset.rfidTag || selectedAsset.rfid_tag || identifier.trim() || selectedAsset.assetCode || selectedAsset.asset_tag;
    if (!tag) {
      toast.error(t.error);
      return;
    }

    setProcessing(true);
    try {
      await axios.post('/api/rfid', {
        asset_id: selectedAsset.id,
        assetId: selectedAsset.id,
        rfid_tag: tag,
        tag,
        location: location || selectedAsset.location || '',
        action: 'scan',
        notes: 'Manual verification scan by Store Manager',
      });
      toast.success(t.scanSuccess);
      setIdentifier('');
      setLocation('');
      setSelectedAsset(null);
      await fetchTrackingData();
    } catch (error) {
      toast.error(error?.response?.data?.message || t.error);
    } finally {
      setProcessing(false);
    }
  };

  const handleRegisterTag = async () => {
    if (!selectedAsset) {
      toast.error(t.notFound);
      return;
    }

    const tag = identifier.trim();
    if (!tag) {
      toast.error(t.lookupPlaceholder);
      return;
    }

    setProcessing(true);
    try {
      await axios.post(`/api/assets/${selectedAsset.id}/rfid`, {
        rfid_tag: tag,
        location: location || selectedAsset.location || '',
        notes: 'Store Manager RFID registration',
      });
      toast.success(t.registerSuccess);
      await fetchTrackingData();
    } catch (error) {
      toast.error(error?.response?.data?.message || t.error);
    } finally {
      setProcessing(false);
    }
  };

  const styles = {
    page: { minHeight: '100vh', padding: '22px', background: isDark ? '#0f172a' : '#f8fafc', color: isDark ? '#e2e8f0' : '#0f172a' },
    wrapper: { maxWidth: '1400px', margin: '0 auto' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap', marginBottom: '20px' },
    title: { margin: 0, fontSize: '1.8rem', fontWeight: 800 },
    subtitle: { margin: '6px 0 0', color: isDark ? '#94a3b8' : '#64748b' },
    button: { border: 'none', borderRadius: '10px', background: '#2563eb', color: '#fff', fontWeight: 700, padding: '10px 16px', cursor: 'pointer' },
    card: { background: isDark ? '#111827' : '#ffffff', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, borderRadius: '14px', boxShadow: '0 8px 24px rgba(15,23,42,0.06)', padding: '20px', marginBottom: '18px' },
    kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '16px', marginBottom: '20px' },
    kpiCard: { background: isDark ? '#111827' : '#fff', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, borderRadius: '12px', padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' },
    kpiLabel: { color: isDark ? '#94a3b8' : '#64748b', fontSize: '0.78rem' },
    kpiValue: { fontSize: '1.6rem', fontWeight: 800 },
    tabRow: { display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '18px' },
    tab: { background: 'transparent', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, padding: '9px 12px', borderRadius: '9px', color: isDark ? '#cbd5e1' : '#334155', cursor: 'pointer', fontWeight: 700 },
    tabActive: { background: '#2563eb', color: '#fff', borderColor: '#2563eb' },
    formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '16px' },
    input: { width: '100%', boxSizing: 'border-box', border: `1px solid ${isDark ? '#334155' : '#cbd5e1'}`, background: isDark ? '#0f172a' : '#fff', color: isDark ? '#e2e8f0' : '#0f172a', borderRadius: '8px', padding: '10px 12px' },
    label: { display: 'block', marginBottom: '6px', fontWeight: 700, color: isDark ? '#cbd5e1' : '#475569' },
    tableWrapper: { overflowX: 'auto' },
    table: { width: '100%', borderCollapse: 'collapse', minWidth: '700px' },
    th: { textAlign: 'left', padding: '12px', color: isDark ? '#cbd5e1' : '#475569', borderBottom: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` },
    td: { padding: '12px', borderBottom: `1px solid ${isDark ? '#1f2937' : '#e2e8f0'}` },
    empty: { textAlign: 'center', padding: '34px 20px', color: isDark ? '#94a3b8' : '#64748b' },
    detailGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '12px', marginTop: '18px' },
    detailItem: { background: isDark ? '#0f172a' : '#f8fafc', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, borderRadius: '10px', padding: '12px' },
    detailLabel: { fontSize: '0.72rem', color: isDark ? '#94a3b8' : '#64748b', fontWeight: 700, display: 'block', marginBottom: '6px' },
    modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', zIndex: 2000 },
    modalCard: { width: '100%', maxWidth: '720px', background: isDark ? '#111827' : '#fff', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, borderRadius: '14px', padding: '20px' },
    closeButton: { border: 'none', background: 'transparent', fontSize: '24px', cursor: 'pointer', color: isDark ? '#cbd5e1' : '#334155' },
    primaryButton: { marginTop: '18px', border: 'none', background: '#2563eb', color: '#fff', borderRadius: '10px', padding: '11px 18px', fontWeight: 800, cursor: 'pointer' },
  };

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.wrapper}>
          <div style={{ ...styles.card, textAlign: 'center', padding: '42px 24px', color: isDark ? '#cbd5e1' : '#334155', fontWeight: 700 }}>
            {t.loading}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.wrapper}>
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>{t.title}</h1>
            <p style={styles.subtitle}>{t.subtitle}</p>
          </div>
          <button type="button" style={styles.button} onClick={fetchTrackingData}>{t.refresh}</button>
        </div>

        <div style={styles.kpiGrid}>
          <div style={styles.kpiCard}><div style={{ fontSize: '1.8rem' }}>📦</div><div><div style={styles.kpiLabel}>Assets</div><div style={styles.kpiValue}>{stats.totalAssets}</div></div></div>
          <div style={styles.kpiCard}><div style={{ fontSize: '1.8rem' }}>📡</div><div><div style={styles.kpiLabel}>RFID Tagged</div><div style={styles.kpiValue}>{stats.rfidCount}</div></div></div>
          <div style={styles.kpiCard}><div style={{ fontSize: '1.8rem' }}>🧾</div><div><div style={styles.kpiLabel}>Asset Codes</div><div style={styles.kpiValue}>{stats.assetCodeCount}</div></div></div>
          <div style={styles.kpiCard}><div style={{ fontSize: '1.8rem' }}>⏱️</div><div><div style={styles.kpiLabel}>Scans Today</div><div style={styles.kpiValue}>{stats.scansToday}</div></div></div>
        </div>

        <div style={styles.tabRow}>
          {['lookup', 'assets', 'history'].map((tab) => (
            <button
              key={tab}
              type="button"
              style={{ ...styles.tab, ...(activeTab === tab ? styles.tabActive : {}) }}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'lookup' ? t.lookup : tab === 'assets' ? 'Assets' : t.recentActivity}
            </button>
          ))}
        </div>

        {activeTab === 'lookup' && (
          <div style={styles.card}>
            <form onSubmit={handleLookup}>
              <div style={styles.formGrid}>
                <div>
                  <label style={styles.label}>Identifier Type</label>
                  <select value={lookupType} onChange={(e) => setLookupType(e.target.value)} style={styles.input}>
                    <option value="RFID">RFID</option>
                    <option value="ASSET_CODE">Asset Code</option>
                  </select>
                </div>
                <div>
                  <label style={styles.label}>Identifier</label>
                  <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder={t.lookupPlaceholder} style={styles.input} />
                </div>
                <div>
                  <label style={styles.label}>Location</label>
                  <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Current location" style={styles.input} />
                </div>
              </div>
              <button type="submit" disabled={processing} style={styles.primaryButton}>{processing ? t.loading : t.findAsset}</button>
              {lookupMessage && <div style={{ marginTop: '14px', color: isDark ? '#cbd5e1' : '#334155', fontWeight: 600 }}>{lookupMessage}</div>}
            </form>

            {selectedAsset && (
              <div style={{ marginTop: '18px', borderTop: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, paddingTop: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <h3 style={{ margin: 0 }}>{selectedAsset.name || selectedAsset.asset_name || 'Asset'}</h3>
                  <button type="button" onClick={() => setShowDetails(true)} style={{ ...styles.button, background: '#0f766e' }}>View Details</button>
                </div>
                <div style={styles.detailGrid}>
                  <div style={styles.detailItem}><span style={styles.detailLabel}>Asset Code</span><span>{selectedAsset.assetCode || selectedAsset.asset_tag || '-'}</span></div>
                  <div style={styles.detailItem}><span style={styles.detailLabel}>Serial Number</span><span>{selectedAsset.serialNumber || selectedAsset.serial_number || '-'}</span></div>
                  <div style={styles.detailItem}><span style={styles.detailLabel}>Status</span><span>{selectedAsset.status || 'Available'}</span></div>
                  <div style={styles.detailItem}><span style={styles.detailLabel}>Location</span><span>{selectedAsset.location || selectedAsset.current_location || 'Location not available'}</span></div>
                  <div style={styles.detailItem}><span style={styles.detailLabel}>Department</span><span>{selectedAsset.department || '-'}</span></div>
                  <div style={styles.detailItem}><span style={styles.detailLabel}>RFID Tag</span><span>{selectedAsset.rfidTag || selectedAsset.rfid_tag || '-'}</span></div>
                </div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '18px' }}>
                  <button type="button" style={{ ...styles.button, background: '#16a34a' }} onClick={handleRecordScan}>{t.scanEvent}</button>
                  <button type="button" style={{ ...styles.button, background: '#7c3aed' }} onClick={handleRegisterTag}>{t.registerRfid}</button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'assets' && (
          <div style={styles.card}>
            {assets.length === 0 ? <div style={styles.empty}>No assets found.</div> : (
              <div style={styles.tableWrapper}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Asset</th>
                      <th style={styles.th}>Code</th>
                      <th style={styles.th}>RFID</th>
                      <th style={styles.th}>Location</th>
                      <th style={styles.th}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assets.map((asset) => (
                      <tr key={asset.id}>
                        <td style={styles.td}>{asset.name || asset.asset_name || '-'}</td>
                        <td style={styles.td}>{asset.assetCode || asset.asset_tag || '-'}</td>
                        <td style={styles.td}>{asset.rfidTag || asset.rfid_tag || '-'}</td>
                        <td style={styles.td}>{asset.location || asset.current_location || '-'}</td>
                        <td style={styles.td}>{asset.status || 'Available'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div style={styles.card}>
            {trackingHistory.length === 0 ? <div style={styles.empty}>{t.noRecentActivity}</div> : (
              <div style={styles.tableWrapper}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Time</th>
                      <th style={styles.th}>Asset</th>
                      <th style={styles.th}>Identifier</th>
                      <th style={styles.th}>Location</th>
                      <th style={styles.th}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trackingHistory.slice(0, 20).map((entry) => (
                      <tr key={entry.id || `${entry.tag || 'scan'}-${entry.createdAt || entry.timestamp || Math.random()}`}>
                        <td style={styles.td}>{entry.createdAt || entry.timestamp ? new Date(entry.createdAt || entry.timestamp).toLocaleString() : '-'}</td>
                        <td style={styles.td}>{entry.asset_name || entry.asset?.name || '-'}</td>
                        <td style={styles.td}>{entry.tag || entry.rfid_tag || entry.asset_tag || '-'}</td>
                        <td style={styles.td}>{entry.location || entry.reader_location || '-'}</td>
                        <td style={styles.td}>{entry.action || 'scan'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {showDetails && selectedAsset && (
        <div style={styles.modalOverlay} onClick={() => setShowDetails(false)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ margin: 0 }}>Asset Information</h3>
              <button type="button" style={styles.closeButton} onClick={() => setShowDetails(false)}>×</button>
            </div>
            <div style={styles.detailGrid}>
              <div style={styles.detailItem}><span style={styles.detailLabel}>Asset Code</span><span>{selectedAsset.assetCode || selectedAsset.asset_tag || '-'}</span></div>
              <div style={styles.detailItem}><span style={styles.detailLabel}>Serial Number</span><span>{selectedAsset.serialNumber || selectedAsset.serial_number || '-'}</span></div>
              <div style={styles.detailItem}><span style={styles.detailLabel}>Status</span><span>{selectedAsset.status || 'Available'}</span></div>
              <div style={styles.detailItem}><span style={styles.detailLabel}>Location</span><span>{selectedAsset.location || selectedAsset.current_location || 'Location not available'}</span></div>
              <div style={styles.detailItem}><span style={styles.detailLabel}>Department</span><span>{selectedAsset.department || '-'}</span></div>
              <div style={styles.detailItem}><span style={styles.detailLabel}>RFID Tag</span><span>{selectedAsset.rfidTag || selectedAsset.rfid_tag || '-'}</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StoreTracking;
