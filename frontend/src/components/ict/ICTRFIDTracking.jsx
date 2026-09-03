import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLanguage } from '../../contexts/UiContext';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-toastify';
import axios from 'axios';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const ICTRFIDTracking = () => {
  const { user } = useAuth();
  const { language, theme } = useLanguage();
  
  // State
  const [logs, setLogs] = useState([]);
  const [realTimeData, setRealTimeData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ 
    totalScans: 0, 
    anomalies: 0, 
    activeAssets: 0,
    readers: 0,
    locations: 0
  });
  const [filter, setFilter] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterLocation, setFilterLocation] = useState('all');
  const [locations, setLocations] = useState([]);
  const [readers, setReaders] = useState([]);
  const [showAssetLocation, setShowAssetLocation] = useState(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyData, setHistoryData] = useState([]);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [mapView, setMapView] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [capabilities, setCapabilities] = useState({ anomalies: false, realtime: false });

  const isDark = theme === 'dark';
  const t = language === 'en' ? englishTranslations : amharicTranslations;

  // Fetch logs and data
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const logsRes = await axios.get('/api/rfid', { params: { limit: 500 } });

      const data = logsRes.data.logs || [];
      setCapabilities(logsRes.data.capabilities || { anomalies: false, realtime: false });
      setLogs(data);
      setRealTimeData(data.slice(0, 10));
      setConnectionStatus('connected');
      
      const readersData = [];
      setReaders(readersData);
      
      // Extract unique locations
      const uniqueLocations = [...new Set(data.map(l => l.reader_location).filter(Boolean))];
      setLocations(uniqueLocations);

      setStats({
        totalScans: data.length,
        anomalies: data.filter(l => l.isAnomaly).length,
        activeAssets: new Set(data.map(l => l.asset_id).filter(Boolean)).size,
        readers: readersData.length,
        locations: uniqueLocations.length
      });
    } catch (error) {
      console.error('Fetch error:', error);
      setConnectionStatus('disconnected');
      toast.error('Failed to load RFID data');
    }
    setLoading(false);
  }, []);

  // Socket connection
  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Get filtered logs
  const getFilteredLogs = () => {
    let filtered = logs;
    
    if (filter) {
      filtered = filtered.filter(log =>
        log.asset_name?.toLowerCase().includes(filter.toLowerCase()) ||
        log.rfid_tag?.toLowerCase().includes(filter.toLowerCase()) ||
        log.reader_location?.toLowerCase().includes(filter.toLowerCase()) ||
        log.asset_id?.toString().includes(filter)
      );
    }
    
    if (filterType === 'anomaly') {
      filtered = filtered.filter(log => log.isAnomaly);
    } else if (filterType === 'normal') {
      filtered = filtered.filter(log => !log.isAnomaly);
    }
    
    if (filterLocation !== 'all') {
      filtered = filtered.filter(log => log.reader_location === filterLocation);
    }
    
    return filtered;
  };

  // Get current location of an asset
  const getAssetCurrentLocation = (assetId) => {
    const latestLog = logs
      .filter(l => l.asset_id === assetId)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
    return latestLog || null;
  };

  // Get movement history of an asset
  const getAssetHistory = async (assetId) => {
    setSelectedAsset(assetId);
    setShowHistoryModal(true);
    try {
      const response = await axios.get(`/api/rfid/history/${assetId}`);
      setHistoryData(response.data.history || []);
    } catch (error) {
      toast.error('Failed to load history');
    }
  };

  // Export to Excel
  const exportToExcel = () => {
    const exportData = getFilteredLogs().map(log => ({
      'Timestamp': new Date(log.timestamp).toLocaleString(),
      'Asset ID': log.asset_id,
      'Asset Name': log.asset_name,
      'RFID Tag': log.rfid_tag,
      'Location': log.reader_location,
      'Reader ID': log.reader_id,
      'Status': log.isAnomaly ? 'Anomaly' : 'Normal',
      'Signal Strength': log.signal_strength || 'N/A'
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);
    XLSX.utils.book_append_sheet(wb, ws, 'RFID Logs');
    XLSX.writeFile(wb, `RFID_Logs_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Export successful');
  };

  // Export to PDF
  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.text('ICT RFID Tracking Report', 14, 15);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 25);
    
    const tableData = getFilteredLogs().slice(0, 100).map(log => [
      new Date(log.timestamp).toLocaleString(),
      log.asset_name || 'N/A',
      log.rfid_tag || 'N/A',
      log.reader_location || 'N/A',
      log.isAnomaly ? '⚠️ Anomaly' : '✅ Normal'
    ]);

    doc.autoTable({
      head: [['Time', 'Asset', 'RFID Tag', 'Location', 'Status']],
      body: tableData,
      startY: 35
    });

    doc.save(`RFID_Logs_${new Date().toISOString().split('T')[0]}.pdf`);
    toast.success('Export successful');
  };

  const importRFIDData = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '' });
      const results = await Promise.allSettled(rows.map(row => axios.post('/api/rfid', {
        asset_id: row['Asset ID'] || row.asset_id,
        rfid_tag: row['RFID Tag'] || row.rfid_tag,
        reader_location: row.Location || row.reader_location,
          action: row['Event Type'] || row.action || 'scan',
          notes: row.Notes || row.notes || ''
      })));
      const imported = results.filter(result => result.status === 'fulfilled').length;
      toast.success(`${imported} RFID records imported`);
      fetchLogs();
    } catch (error) {
      toast.error('Failed to import RFID data');
    }
  };

  // Get status color
  const getStatusColor = (isAnomaly) => {
    return isAnomaly ? '#fc8181' : '#48bb78';
  };

  // Get status label
  const getStatusLabel = (isAnomaly) => {
    return isAnomaly ? '⚠️ Anomaly' : '✅ Normal';
  };

  // Get signal strength bar
  const getSignalBar = (strength) => {
    if (!strength) return 'N/A';
    const levels = Math.min(5, Math.ceil(strength / 20));
    const bars = '█'.repeat(levels) + '░'.repeat(5 - levels);
    return bars;
  };

  const filteredLogs = getFilteredLogs();

  // Styles
  const styles = {
    container: { padding: '20px', maxWidth: '1400px', margin: '0 auto' },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '24px',
      flexWrap: 'wrap',
      gap: '16px'
    },
    title: {
      color: isDark ? '#c8dcf5' : '#1a365d',
      fontSize: '1.75rem',
      fontWeight: 700,
      margin: 0
    },
    subtitle: {
      color: isDark ? '#8896b0' : '#4a5568',
      margin: '4px 0 0 0'
    },
    statusBadge: {
      display: 'inline-block',
      padding: '4px 12px',
      borderRadius: '20px',
      fontSize: '12px',
      fontWeight: 600,
      background: connectionStatus === 'connected' ? 'rgba(72, 187, 120, 0.15)' : 'rgba(252, 129, 129, 0.15)',
      color: connectionStatus === 'connected' ? '#48bb78' : '#fc8181',
      border: `1px solid ${connectionStatus === 'connected' ? 'rgba(72, 187, 120, 0.3)' : 'rgba(252, 129, 129, 0.3)'}`
    },
    statsRow: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
      gap: '16px',
      marginBottom: '24px'
    },
    statCard: {
      background: isDark ? '#1e2d45' : '#ffffff',
      padding: '16px 20px',
      borderRadius: '12px',
      border: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
      boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(0,0,100,0.06)',
      textAlign: 'center'
    },
    statNumber: {
      fontSize: '1.75rem',
      fontWeight: 700,
      color: isDark ? '#c8dcf5' : '#1a365d'
    },
    statLabel: {
      fontSize: '0.85rem',
      color: isDark ? '#8896b0' : '#4a5568'
    },
    realTimeCard: {
      background: isDark ? '#1e2d45' : '#ffffff',
      padding: '16px 20px',
      borderRadius: '12px',
      border: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
      boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(0,0,100,0.06)',
      marginBottom: '24px'
    },
    realTimeHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '12px',
      flexWrap: 'wrap',
      gap: '8px'
    },
    realTimeTitle: {
      color: isDark ? '#c8dcf5' : '#1a365d',
      fontSize: '1rem',
      fontWeight: 600,
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    },
    realTimeFeed: {
      maxHeight: '150px',
      overflow: 'auto',
      borderRadius: '8px',
      border: isDark ? '1px solid #32465f' : '1px solid #e8edf5'
    },
    realTimeItem: (isAnomaly) => ({
      padding: '8px 12px',
      borderBottom: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      background: isAnomaly ? (isDark ? 'rgba(252, 129, 129, 0.1)' : 'rgba(252, 129, 129, 0.05)') : 'transparent'
    }),
    filters: {
      display: 'flex',
      gap: '12px',
      flexWrap: 'wrap',
      marginBottom: '16px'
    },
    input: {
      padding: '10px 16px',
      borderRadius: '8px',
      border: `1px solid ${isDark ? '#32465f' : '#d0d8e8'}`,
      background: isDark ? '#0d1b2a' : '#f7fafc',
      color: isDark ? '#c8dcf5' : '#1a365d',
      fontSize: '0.95rem',
      flex: 1,
      minWidth: '150px'
    },
    select: {
      padding: '10px 16px',
      borderRadius: '8px',
      border: `1px solid ${isDark ? '#32465f' : '#d0d8e8'}`,
      background: isDark ? '#0d1b2a' : '#f7fafc',
      color: isDark ? '#c8dcf5' : '#1a365d',
      fontSize: '0.95rem',
      cursor: 'pointer',
      minWidth: '140px'
    },
    button: (bg = 'linear-gradient(135deg, #1a365d, #2b6cb0)') => ({
      padding: '10px 20px',
      borderRadius: '8px',
      border: 'none',
      background: bg,
      color: 'white',
      fontWeight: 600,
      cursor: 'pointer',
      transition: 'all 0.2s ease'
    }),
    table: {
      width: '100%',
      borderCollapse: 'collapse',
      background: isDark ? '#1e2d45' : '#ffffff',
      borderRadius: '12px',
      overflow: 'hidden',
      boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(0,0,100,0.06)'
    },
    th: {
      padding: '12px 16px',
      textAlign: 'left',
      color: isDark ? '#c8dcf5' : '#1a365d',
      fontWeight: 600,
      borderBottom: `2px solid ${isDark ? '#32465f' : '#e8edf5'}`,
      background: isDark ? '#141e2d' : '#f7fafc',
      fontSize: '12px',
      textTransform: 'uppercase',
      letterSpacing: '0.3px',
      position: 'sticky',
      top: 0,
      zIndex: 10
    },
    td: {
      padding: '12px 16px',
      borderBottom: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
      color: isDark ? '#c8dcf5' : '#1a365d',
      fontSize: '14px'
    },
    signalBar: {
      display: 'inline-block',
      fontSize: '12px',
      fontFamily: 'monospace',
      color: isDark ? '#c8dcf5' : '#1a365d'
    },
    emptyState: {
      textAlign: 'center',
      padding: '40px',
      color: isDark ? '#8896b0' : '#4a5568'
    },
    modal: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      backdropFilter: 'blur(4px)',
      padding: '20px'
    },
    modalContent: {
      background: isDark ? '#1e2d45' : '#ffffff',
      borderRadius: '16px',
      padding: '30px',
      maxWidth: '800px',
      width: '100%',
      maxHeight: '90vh',
      overflowY: 'auto'
    },
    modalHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '20px',
      borderBottom: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
      paddingBottom: '16px'
    },
    modalTitle: {
      color: isDark ? '#c8dcf5' : '#1a365d',
      fontSize: '1.25rem',
      fontWeight: 700
    },
    modalClose: {
      background: 'none',
      border: 'none',
      fontSize: '1.5rem',
      cursor: 'pointer',
      color: isDark ? '#8896b0' : '#4a5568'
    }
  };

  if (loading) {
    return <div style={styles.emptyState}>⏳ {t.loading}</div>;
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>📡 {t.rfidTracking}</h1>
          <p style={styles.subtitle}>{t.trackingDesc}</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={styles.statusBadge}>
            {connectionStatus === 'connected' ? '🟢 API Connected' : '🔴 API Offline'}
          </span>
          <button 
            style={styles.button('linear-gradient(135deg, #48bb78, #68d391)')} 
            onClick={exportToExcel}
          >
            📊 {t.exportExcel}
          </button>
          <button style={styles.button('linear-gradient(135deg, #319795, #4fd1c5)')} onClick={() => document.getElementById('rfid-import-input').click()}>
            📥 {t.importData}
          </button>
          <input id="rfid-import-input" type="file" accept=".csv,.xlsx,.xls" onChange={importRFIDData} style={{ display: 'none' }} />
          <button 
            style={styles.button('linear-gradient(135deg, #805ad5, #b794f4)')} 
            onClick={exportToPDF}
          >
            📄 {t.exportPDF}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={styles.statsRow}>
        <div style={styles.statCard}>
          <div style={styles.statNumber}>{stats.totalScans}</div>
          <div style={styles.statLabel}>{t.totalScans}</div>
        </div>
        {capabilities.anomalies && <div style={styles.statCard}>
          <div style={{ ...styles.statNumber, color: '#fc8181' }}>{stats.anomalies}</div>
          <div style={styles.statLabel}>{t.anomalies}</div>
        </div>}
        <div style={styles.statCard}>
          <div style={{ ...styles.statNumber, color: '#48bb78' }}>{stats.activeAssets}</div>
          <div style={styles.statLabel}>{t.activeAssets}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statNumber}>{stats.readers}</div>
          <div style={styles.statLabel}>{t.readers}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statNumber}>{stats.locations}</div>
          <div style={styles.statLabel}>{t.locations}</div>
        </div>
      </div>

      {/* Real-Time Feed */}
      <div style={styles.realTimeCard}>
        <div style={styles.realTimeHeader}>
          <span style={styles.realTimeTitle}>
            <span style={{ color: connectionStatus === 'connected' ? '#48bb78' : '#fc8181', fontSize: '14px' }}>
              {connectionStatus === 'connected' ? '●' : '○'}
            </span>
            {t.realTimeFeed}
          </span>
          <span style={{ fontSize: '12px', color: isDark ? '#8896b0' : '#4a5568' }}>
            {realTimeData.length} {t.latestScans}
          </span>
        </div>
        <div style={styles.realTimeFeed}>
          {realTimeData.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '20px', color: isDark ? '#8896b0' : '#4a5568' }}>
              {t.waitingForScans}
            </p>
          ) : (
            realTimeData.map((data, index) => (
              <div key={index} style={styles.realTimeItem(data.isAnomaly)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span>{data.asset_name || data.asset?.name || 'Unknown RFID Tag'}</span>
                  <span style={{ fontSize: '12px', color: isDark ? '#8896b0' : '#4a5568' }}>
                    📍 {data.reader_location || 'Unknown'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ color: getStatusColor(data.isAnomaly), fontWeight: 600 }}>
                    {getStatusLabel(data.isAnomaly)}
                  </span>
                  <span style={{ fontSize: '11px', color: isDark ? '#8896b0' : '#4a5568' }}>
                    {data.timestamp ? new Date(data.timestamp).toLocaleTimeString() : ''}
                  </span>
                  {data.signal_strength && <span style={styles.signalBar}>📶 {getSignalBar(data.signal_strength)}</span>}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Filters */}
      <div style={styles.filters}>
        <input 
          type="text" 
          style={styles.input} 
          placeholder={t.searchPlaceholder} 
          value={filter} 
          onChange={(e) => setFilter(e.target.value)} 
        />
        
        <select 
          style={styles.select} 
          value={filterType} 
          onChange={(e) => setFilterType(e.target.value)}
        >
          <option value="all">{t.allStatus}</option>
          <option value="normal">{t.normal}</option>
          {capabilities.anomalies && <option value="anomaly">{t.anomaly}</option>}
        </select>

        <select 
          style={styles.select} 
          value={filterLocation} 
          onChange={(e) => setFilterLocation(e.target.value)}
        >
          <option value="all">{t.allLocations}</option>
          {locations.map(loc => (
            <option key={loc} value={loc}>{loc}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>{t.time}</th>
              <th style={styles.th}>{t.asset}</th>
              <th style={styles.th}>{t.rfidTag}</th>
              <th style={styles.th}>{t.location}</th>
              <th style={styles.th}>{t.readerId}</th>
              <th style={styles.th}>{t.signal}</th>
              <th style={styles.th}>{t.status}</th>
              <th style={styles.th}>{t.actions}</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '40px', color: isDark ? '#8896b0' : '#4a5568' }}>
                  {t.noLogs}
                </td>
              </tr>
            ) : (
              filteredLogs.slice(0, 100).map(log => (
                <tr key={log.id}>
                  <td style={styles.td}>
                    <div>{new Date(log.timestamp).toLocaleDateString()}</div>
                    <div style={{ fontSize: '11px', color: isDark ? '#8896b0' : '#4a5568' }}>
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </div>
                  </td>
                  <td style={styles.td}>
                    <div style={{ fontWeight: 600 }}>{log.asset_name || 'Unknown'}</div>
                    <div style={{ fontSize: '11px', color: isDark ? '#8896b0' : '#4a5568' }}>
                      ID: {log.asset_id || 'N/A'}
                    </div>
                  </td>
                  <td style={styles.td}>
                    <code style={{ fontSize: '12px' }}>{log.rfid_tag || 'N/A'}</code>
                  </td>
                  <td style={styles.td}>
                    <div>{log.reader_location || 'N/A'}</div>
                    {log.previous_location && (
                      <div style={{ fontSize: '11px', color: isDark ? '#8896b0' : '#4a5568' }}>
                        ← {log.previous_location}
                      </div>
                    )}
                  </td>
                  <td style={styles.td}>
                    <code style={{ fontSize: '11px' }}>{log.reader_id || 'N/A'}</code>
                  </td>
                  <td style={styles.td}>
                    {log.signal_strength ? (
                      <span style={styles.signalBar}>
                        📶 {getSignalBar(log.signal_strength)}
                      </span>
                    ) : 'N/A'}
                  </td>
                  <td style={styles.td}>
                    <span style={{ color: getStatusColor(log.isAnomaly), fontWeight: 600 }}>
                      {getStatusLabel(log.isAnomaly)}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <button 
                      style={{
                        padding: '4px 10px',
                        borderRadius: '4px',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '12px',
                        background: '#4299e1',
                        color: 'white',
                        marginRight: '4px'
                      }}
                      onClick={() => getAssetHistory(log.asset_id)}
                    >
                      📜 {t.history}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {filteredLogs.length > 100 && (
          <div style={{ textAlign: 'center', padding: '12px', color: isDark ? '#8896b0' : '#4a5568', fontSize: '12px' }}>
            {t.showingFirst} 100 {t.of} {filteredLogs.length}
          </div>
        )}
      </div>

      {/* History Modal */}
      {showHistoryModal && (
        <div style={styles.modal} onClick={() => setShowHistoryModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>📜 {t.movementHistory}</h3>
              <button style={styles.modalClose} onClick={() => setShowHistoryModal(false)}>✕</button>
            </div>
            
            {historyData.length === 0 ? (
              <p style={styles.emptyState}>{t.noHistory}</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>{t.time}</th>
                      <th style={styles.th}>{t.location}</th>
                      <th style={styles.th}>{t.status}</th>
                      <th style={styles.th}>{t.readerId}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyData.map((h, idx) => (
                      <tr key={idx}>
                        <td style={styles.td}>
                          {new Date(h.timestamp).toLocaleString()}
                        </td>
                        <td style={styles.td}>{h.reader_location || 'N/A'}</td>
                        <td style={styles.td}>
                          <span style={{ color: getStatusColor(h.isAnomaly) }}>
                            {getStatusLabel(h.isAnomaly)}
                          </span>
                        </td>
                        <td style={styles.td}>
                          <code style={{ fontSize: '11px' }}>{h.reader_id || 'N/A'}</code>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Translations
const englishTranslations = {
  rfidTracking: 'ICT RFID Tracking',
  trackingDesc: 'Real-time asset location and movement tracking',
  totalScans: 'Total Scans',
  anomalies: 'Anomalies',
  activeAssets: 'Active Assets',
  readers: 'Readers',
  locations: 'Locations',
  realTimeFeed: '🔴 Real-Time Feed',
  latestScans: 'latest scans',
  waitingForScans: 'Waiting for RFID scans...',
  searchPlaceholder: 'Search by asset, ID, RFID tag, or location...',
  allStatus: 'All Status',
  normal: '✅ Normal',
  anomaly: '⚠️ Anomaly',
  allLocations: 'All Locations',
  time: 'Time',
  asset: 'Asset',
  rfidTag: 'RFID Tag',
  location: 'Location',
  readerId: 'Reader ID',
  signal: 'Signal',
  status: 'Status',
  actions: 'Actions',
  history: 'History',
  exportExcel: 'Export Excel',
  exportPDF: 'Export PDF',
  loading: 'Loading...',
  noLogs: 'No RFID logs found',
  anomalyDetected: 'Anomaly Detected',
  movementHistory: 'Movement History',
  noHistory: 'No movement history found',
  showingFirst: 'Showing first',
  of: 'of'
};

const amharicTranslations = {
  rfidTracking: 'የICT RFID ክትትል',
  trackingDesc: 'የንብረት ቦታ እና እንቅስቃሴ የቅጽበት ክትትል',
  totalScans: 'ጠቅላላ ቅኝቶች',
  anomalies: 'ያልተለመዱ',
  activeAssets: 'ንቁ ንብረቶች',
  readers: 'አንባቢዎች',
  locations: 'ቦታዎች',
  realTimeFeed: '🔴 የቅጽበት መረጃ',
  latestScans: 'የቅርብ ቅኝቶች',
  waitingForScans: 'RFID ቅኝቶችን በመጠበቅ ላይ...',
  searchPlaceholder: 'በንብረት፣ መለያ፣ RFID መለያ ወይም ቦታ ይፈልጉ...',
  allStatus: 'ሁሉም ሁኔታዎች',
  normal: '✅ መደበኛ',
  anomaly: '⚠️ ያልተለመደ',
  allLocations: 'ሁሉም ቦታዎች',
  time: 'ሰዓት',
  asset: 'ንብረት',
  rfidTag: 'RFID መለያ',
  location: 'ቦታ',
  readerId: 'አንባቢ መለያ',
  signal: 'ሲግናል',
  status: 'ሁኔታ',
  actions: 'ተግባራት',
  history: 'ታሪክ',
  exportExcel: 'Excel ወጣ',
  exportPDF: 'PDF ወጣ',
  loading: 'በመጫን ላይ...',
  noLogs: 'ምንም RFID መዝገቦች አልተገኙም',
  anomalyDetected: 'ያልተለመደ ነገር ተገኝቷል',
  movementHistory: 'የእንቅስቃሴ ታሪክ',
  noHistory: 'ምንም የእንቅስቃሴ ታሪክ አልተገኘም',
  showingFirst: 'የመጀመሪያ',
  of: 'ከ'
};

export default ICTRFIDTracking;