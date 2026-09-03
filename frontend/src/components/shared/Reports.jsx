import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../contexts/UiContext';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import axios from 'axios';

const Reports = () => {
  const { language, theme } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [reportType, setReportType] = useState('assets');
  const [reportData, setReportData] = useState([]);

  const isDark = theme === 'dark';
  const t = language === 'en' ? englishTranslations : amharicTranslations;

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      let endpoint = '/api/assets?limit=500';
      if (reportType === 'maintenance') endpoint = '/api/maintenance?limit=500';
      else if (reportType === 'valuation') endpoint = '/api/assets?limit=500';
      
      const response = await axios.get(endpoint);
      let data = response.data.assets || response.data.requests || [];
      setReportData(data);
    } catch (error) {
      toast.error('Failed to load report data');
    }
    setLoading(false);
  }, [reportType]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const exportToExcel = () => {
    let data = [];
    if (reportType === 'assets') {
      data = reportData.map(a => ({
        'Asset Tag': a.asset_tag,
        'Name': a.name,
        'Category': a.category_name || '',
        'Department': a.department_name || '',
        'Status': a.status,
        'Location': a.location || '',
        'Value': a.current_value || 0
      }));
    } else if (reportType === 'maintenance') {
      data = reportData.map(m => ({
        'Request #': m.request_number,
        'Title': m.title,
        'Asset': m.asset_name || '',
        'Status': m.status,
        'Priority': m.priority,
        'Type': m.type,
        'Created': new Date(m.created_at).toLocaleDateString()
      }));
    } else if (reportType === 'valuation') {
      data = reportData.map(a => ({
        'Asset Tag': a.asset_tag,
        'Name': a.name,
        'Purchase Cost': a.purchase_cost || 0,
        'Current Value': a.current_value || 0,
        'Depreciation': ((a.purchase_cost || 0) - (a.current_value || 0))
      }));
    }
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, reportType);
    XLSX.writeFile(wb, `${reportType}_report.xlsx`);
    toast.success('Report exported successfully');
  };

  const styles = {
    container: { padding: '20px' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' },
    title: { color: isDark ? '#c8dcf5' : '#1a365d', fontSize: '1.5rem', fontWeight: 700 },
    controls: { display: 'flex', gap: '12px', flexWrap: 'wrap' },
    select: { padding: '10px 16px', borderRadius: '8px', border: `1px solid ${isDark ? '#32465f' : '#d0d8e8'}`, background: isDark ? '#0d1b2a' : '#f7fafc', color: isDark ? '#c8dcf5' : '#1a365d', fontSize: '0.95rem', cursor: 'pointer' },
    exportButton: { padding: '10px 20px', background: 'linear-gradient(135deg, #48bb78, #38a169)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' },
    table: { width: '100%', borderCollapse: 'collapse', background: isDark ? '#1e2d45' : '#ffffff', borderRadius: '12px', overflow: 'hidden', boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(0,0,100,0.06)' },
    th: { padding: '12px 16px', textAlign: 'left', color: isDark ? '#c8dcf5' : '#1a365d', fontWeight: 600, borderBottom: `2px solid ${isDark ? '#32465f' : '#e8edf5'}`, background: isDark ? '#141e2d' : '#f7fafc' },
    td: { padding: '12px 16px', borderBottom: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`, color: isDark ? '#c8dcf5' : '#1a365d' },
    emptyState: { textAlign: 'center', padding: '40px', color: isDark ? '#8896b0' : '#4a5568' }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>📊 {t.reports}</h1>
        <div style={styles.controls}>
          <select style={styles.select} value={reportType} onChange={(e) => setReportType(e.target.value)}>
            <option value="assets">{t.assetReport}</option>
            <option value="maintenance">{t.maintenanceReport}</option>
            <option value="valuation">{t.valuationReport}</option>
          </select>
          <button style={styles.exportButton} onClick={exportToExcel}>📥 {t.exportExcel}</button>
        </div>
      </div>

      {loading ? <div style={styles.emptyState}>⏳ {t.loading}</div> : reportData.length === 0 ? <div style={styles.emptyState}>{t.noData}</div> :
        <div style={{ overflowX: 'auto' }}>
          <table style={styles.table}>
            <thead>
              <tr>
                {reportType === 'assets' && (
                  <><th style={styles.th}>{t.assetTag}</th><th style={styles.th}>{t.name}</th>
                  <th style={styles.th}>{t.category}</th><th style={styles.th}>{t.department}</th>
                  <th style={styles.th}>{t.status}</th><th style={styles.th}>{t.location}</th>
                  <th style={styles.th}>{t.value}</th></>
                )}
                {reportType === 'maintenance' && (
                  <><th style={styles.th}>{t.requestNumber}</th><th style={styles.th}>{t.title}</th>
                  <th style={styles.th}>{t.asset}</th><th style={styles.th}>{t.status}</th>
                  <th style={styles.th}>{t.priority}</th><th style={styles.th}>{t.type}</th>
                  <th style={styles.th}>{t.created}</th></>
                )}
                {reportType === 'valuation' && (
                  <><th style={styles.th}>{t.assetTag}</th><th style={styles.th}>{t.name}</th>
                  <th style={styles.th}>{t.purchaseCost}</th><th style={styles.th}>{t.currentValue}</th>
                  <th style={styles.th}>{t.depreciation}</th></>
                )}
              </tr>
            </thead>
            <tbody>
              {reportData.slice(0, 50).map((item, index) => (
                <tr key={item.id || index}>
                  {reportType === 'assets' && (
                    <><td style={styles.td}>{item.asset_tag}</td><td style={styles.td}>{item.name}</td>
                    <td style={styles.td}>{item.category_name || '-'}</td><td style={styles.td}>{item.department_name || '-'}</td>
                    <td style={styles.td}>{item.status}</td><td style={styles.td}>{item.location || '-'}</td>
                    <td style={styles.td}>${(item.current_value || 0).toLocaleString()}</td></>
                  )}
                  {reportType === 'maintenance' && (
                    <><td style={styles.td}>{item.request_number}</td><td style={styles.td}>{item.title}</td>
                    <td style={styles.td}>{item.asset_name || '-'}</td><td style={styles.td}>{item.status}</td>
                    <td style={styles.td}>{item.priority}</td><td style={styles.td}>{item.type}</td>
                    <td style={styles.td}>{new Date(item.created_at).toLocaleDateString()}</td></>
                  )}
                  {reportType === 'valuation' && (
                    <><td style={styles.td}>{item.asset_tag}</td><td style={styles.td}>{item.name}</td>
                    <td style={styles.td}>${(item.purchase_cost || 0).toLocaleString()}</td>
                    <td style={styles.td}>${(item.current_value || 0).toLocaleString()}</td>
                    <td style={styles.td}>${((item.purchase_cost || 0) - (item.current_value || 0)).toLocaleString()}</td></>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {reportData.length > 50 && (
            <div style={{ textAlign: 'center', padding: '12px', color: isDark ? '#8896b0' : '#4a5568' }}>
              {t.showingFirst} 50 {t.of} {reportData.length}
            </div>
          )}
        </div>
      }
    </div>
  );
};

const englishTranslations = {
  reports: 'Reports',
  assetReport: 'Asset Report',
  maintenanceReport: 'Maintenance Report',
  valuationReport: 'Valuation Report',
  exportExcel: 'Export to Excel',
  loading: 'Loading...',
  noData: 'No data available',
  showingFirst: 'Showing first',
  of: 'of',
  assetTag: 'Asset Tag',
  name: 'Name',
  category: 'Category',
  department: 'Department',
  status: 'Status',
  location: 'Location',
  value: 'Value',
  requestNumber: 'Request #',
  title: 'Title',
  asset: 'Asset',
  priority: 'Priority',
  type: 'Type',
  created: 'Created',
  purchaseCost: 'Purchase Cost',
  currentValue: 'Current Value',
  depreciation: 'Depreciation'
};

const amharicTranslations = {
  reports: 'ሪፖርቶች',
  assetReport: 'የንብረት ሪፖርት',
  maintenanceReport: 'የጥገና ሪፖርት',
  valuationReport: 'የዋጋ ግምት ሪፖርት',
  exportExcel: 'ወደ Excel ላክ',
  loading: 'በመጫን ላይ...',
  noData: 'ምንም መረጃ የለም',
  showingFirst: 'የመጀመሪያዎቹን',
  of: 'ከ',
  assetTag: 'የንብረት መለያ',
  name: 'ስም',
  category: 'ምድብ',
  department: 'ክፍል',
  status: 'ሁኔታ',
  location: 'ቦታ',
  value: 'ዋጋ',
  requestNumber: 'የጥያቄ ቁጥር',
  title: 'ርዕስ',
  asset: 'ንብረት',
  priority: 'ቅድሚያ',
  type: 'አይነት',
  created: 'ተፈጥሯል',
  purchaseCost: 'የግዢ ዋጋ',
  currentValue: 'አሁን ያለው ዋጋ',
  depreciation: 'ውድመት'
};

export default Reports;


