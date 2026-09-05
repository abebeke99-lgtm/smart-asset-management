import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../contexts/UiContext';
import { toast } from 'react-toastify';
import axios from 'axios';

const RFIDMonitor = () => {
  const { language, theme } = useLanguage();
  const [logs, setLogs] = useState([]);
  const [realTimeData, setRealTimeData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalScans: 0, anomalies: 0, activeAssets: 0 });
  const [anomaliesSupported, setAnomaliesSupported] = useState(false);

  const isDark = theme === 'dark';
  const t = language === 'en' ? englishTranslations : amharicTranslations;

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/rfid', { params: { limit: 100 } });
      const data = response.data.logs || [];
      setAnomaliesSupported(response.data.capabilities?.anomalies === true);
      setLogs(data);
      setStats({
        totalScans: data.length,
        anomalies: data.filter(l => l.isAnomaly).length,
        activeAssets: new Set(data.map(l => l.asset_id)).size
      });
    } catch (error) {
      toast.error('Failed to load RFID data');
    }
    setLoading(false);
  };

  const getStatusColor = (isAnomaly) => isAnomaly ? '#fc8181' : '#48bb78';

  const styles = {
    container: { padding: '20px' },
    title: { color: isDark ? '#c8dcf5' : '#1a365d', fontSize: '1.5rem', fontWeight: 700, marginBottom: '24px' },
    statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px', marginBottom: '24px' },
    statCard: { background: isDark ? '#1e2d45' : '#ffffff', padding: '16px', borderRadius: '12px', border: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`, textAlign: 'center' },
    statNumber: { fontSize: '2rem', fontWeight: 700, color: isDark ? '#c8dcf5' : '#1a365d' },
    statLabel: { color: isDark ? '#8896b0' : '#4a5568', fontSize: '0.85rem' },
    realTimeCard: { background: isDark ? '#1e2d45' : '#ffffff', padding: '16px', borderRadius: '12px', border: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`, marginBottom: '24px' },
    realTimeItem: { padding: '8px 12px', borderBottom: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    table: { width: '100%', borderCollapse: 'collapse', background: isDark ? '#1e2d45' : '#ffffff', borderRadius: '12px', overflow: 'hidden', boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(0,0,100,0.06)' },
    th: { padding: '12px 16px', textAlign: 'left', color: isDark ? '#c8dcf5' : '#1a365d', fontWeight: 600, borderBottom: `2px solid ${isDark ? '#32465f' : '#e8edf5'}`, background: isDark ? '#141e2d' : '#f7fafc' },
    td: { padding: '12px 16px', borderBottom: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`, color: isDark ? '#c8dcf5' : '#1a365d' },
    emptyState: { textAlign: 'center', padding: '40px', color: isDark ? '#8896b0' : '#4a5568' }
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>📡 {t.rfidTracking}</h1>

      <div style={styles.statsGrid}>
        <div style={styles.statCard}><div style={styles.statNumber}>{stats.totalScans}</div><div style={styles.statLabel}>{t.totalScans}</div></div>
        {anomaliesSupported && <div style={styles.statCard}><div style={{ ...styles.statNumber, color: '#fc8181' }}>{stats.anomalies}</div><div style={styles.statLabel}>{t.anomalies}</div></div>}
        <div style={styles.statCard}><div style={{ ...styles.statNumber, color: '#48bb78' }}>{stats.activeAssets}</div><div style={styles.statLabel}>{t.activeAssets}</div></div>
      </div>

      <div style={styles.realTimeCard}>
        <h3 style={{ color: isDark ? '#c8dcf5' : '#1a365d', marginBottom: '12px' }}>🔴 {t.realTimeFeed}</h3>
        <div style={{ maxHeight: '150px', overflow: 'auto' }}>
          {realTimeData.length === 0 ? <p style={{ textAlign: 'center', color: isDark ? '#8896b0' : '#4a5568' }}>{t.waitingForScans}</p> :
            realTimeData.map((data, index) => (
              <div key={index} style={styles.realTimeItem}>
                <span>{data.asset_name || data.asset?.name || 'Unknown RFID Tag'} - {data.reader_location || '-'}</span>
                <span style={{ color: getStatusColor(data.isAnomaly), fontWeight: 600 }}>{data.isAnomaly ? '⚠️ Anomaly' : '✅ Normal'}</span>
                <span style={{ fontSize: '0.8rem', color: isDark ? '#8896b0' : '#4a5568' }}>{new Date(data.timestamp).toLocaleTimeString()}</span>
              </div>
            ))}
        </div>
      </div>

      {loading ? <div style={styles.emptyState}>⏳ {t.loading}</div> :
        <div style={{ overflowX: 'auto' }}>
          <table style={styles.table}>
            <thead><tr>
              <th style={styles.th}>{t.time}</th>
              <th style={styles.th}>{t.asset}</th>
              <th style={styles.th}>{t.rfidTag}</th>
              <th style={styles.th}>{t.location}</th>
              <th style={styles.th}>{t.status}</th>
            </tr></thead>
            <tbody>
              {logs.length === 0 ? <tr><td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: isDark ? '#8896b0' : '#4a5568' }}>{t.noLogs}</td></tr> :
                logs.map(log => (
                  <tr key={log.id}>
                    <td style={styles.td}>{new Date(log.timestamp).toLocaleString()}</td>
                    <td style={styles.td}>{log.asset_name || '-'}</td>
                    <td style={styles.td}>{log.rfid_tag || '-'}</td>
                    <td style={styles.td}>{log.reader_location || '-'}</td>
                    <td style={styles.td}><span style={{ color: getStatusColor(log.isAnomaly) }}>{log.isAnomaly ? '⚠️ Anomaly' : '✅ Normal'}</span></td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  );
};

const englishTranslations = {
  rfidTracking: 'RFID Tracking',
  totalScans: 'Total Scans',
  anomalies: 'Anomalies',
  activeAssets: 'Active Assets',
  realTimeFeed: 'Real-Time Feed',
  waitingForScans: 'Waiting for RFID scans...',
  time: 'Time',
  asset: 'Asset',
  rfidTag: 'RFID Tag',
  location: 'Location',
  status: 'Status',
  loading: 'Loading...',
  noLogs: 'No RFID logs found',
  anomalyDetected: 'Anomaly Detected'
};

const amharicTranslations = {
  rfidTracking: 'RFID ክትትል',
  totalScans: 'ጠቅላላ ቅኝቶች',
  anomalies: 'ያልተለመዱ',
  activeAssets: 'ንቁ ንብረቶች',
  realTimeFeed: 'የቅጽበት መረጃ',
  waitingForScans: 'RFID ቅኝቶችን በመጠበቅ ላይ...',
  time: 'ሰዓት',
  asset: 'ንብረት',
  rfidTag: 'RFID መለያ',
  location: 'ቦታ',
  status: 'ሁኔታ',
  loading: 'በመጫን ላይ...',
  noLogs: 'ምንም RFID መዝገቦች አልተገኙም',
  anomalyDetected: 'ያልተለመደ ነገር ተገኝቷል'
};

export default RFIDMonitor;

