import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../contexts/UiContext';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import axios from 'axios';

const ICTReports = () => {
  const { user } = useAuth();
  const { language, theme } = useLanguage();
  
  // State
  const [loading, setLoading] = useState(true);
  const [reportType, setReportType] = useState('assets');
  const [reportData, setReportData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [summary, setSummary] = useState(null);
  
  // Filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [departments, setDepartments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [locations, setLocations] = useState([]);
  const [statuses, setStatuses] = useState([]);

  const isDark = theme === 'dark';
  const t = language === 'en' ? englishTranslations : amharicTranslations;

  // Report types
  const reportTypes = {
    assets: { label: 'Asset Report', icon: '📊' },
    ict: { label: 'ICT Asset Report', icon: '💻' },
    assignments: { label: 'Assignment Report', icon: '📋' },
    maintenance: { label: 'Maintenance Report', icon: '🔧' },
    inventory: { label: 'Inventory Report', icon: '📦' },
    rfid: { label: 'RFID Activity Report', icon: '📡' }
  };

  // Fetch report data
  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      let endpoint = '';
      let params = { limit: 1000 };
      
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      if (departmentFilter !== 'all') params.department = departmentFilter;
      if (categoryFilter !== 'all') params.category = categoryFilter;
      if (statusFilter !== 'all') params.status = statusFilter;
      if (locationFilter !== 'all') params.location = locationFilter;

      switch (reportType) {
        case 'assets':
          endpoint = '/api/assets';
          break;
        case 'ict':
          endpoint = '/api/assets';
          break;
        case 'assignments':
          endpoint = '/api/assignments';
          break;
        case 'maintenance':
          endpoint = '/api/maintenance';
          break;
        case 'inventory':
          endpoint = '/api/inventory';
          break;
        case 'rfid':
          endpoint = '/api/rfid';
          break;
        default:
          endpoint = '/api/assets';
      }

      const response = await axios.get(endpoint, { params });
      let data = response.data.assets || response.data.requests || 
                  response.data.assignments || response.data.items || 
                  response.data.logs || [];

      // Filter ICT assets
      if (reportType === 'ict') {
        data = data.filter(a => 
          a.category_name === 'Computers' || 
          a.category_name === 'Printers' ||
          a.category_name === 'Servers' ||
          a.category_name === 'Projectors' ||
          a.category_name === 'Networking' ||
          a.category_name === 'Software' ||
          a.department_name === 'Information Technology'
        );
      }

      setReportData(data);
      setFilteredData(data);
      
      // Extract filter options
      const depts = [...new Set(data.map(item => item.department_name || item.department).filter(Boolean))];
      const cats = [...new Set(data.map(item => item.category_name || item.category).filter(Boolean))];
      const locs = [...new Set(data.map(item => item.location || item.reader_location).filter(Boolean))];
      const stats = [...new Set(data.map(item => item.status).filter(Boolean))];
      
      setDepartments(depts);
      setCategories(cats);
      setLocations(locs);
      setStatuses(stats);

      // Generate summary
      generateSummary(data);

    } catch (error) {
      console.error('Report fetch error:', error);
      toast.error('Failed to load report data');
    }
    setLoading(false);
  }, [reportType, dateFrom, dateTo, departmentFilter, categoryFilter, statusFilter, locationFilter]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  // Generate summary statistics
  const generateSummary = (data) => {
    if (reportType === 'assets' || reportType === 'ict') {
      const byStatus = data.reduce((acc, item) => {
        acc[item.status] = (acc[item.status] || 0) + 1;
        return acc;
      }, {});
      
      const totalValue = data.reduce((sum, item) => sum + (item.current_value || item.purchase_cost || 0), 0);
      
      setSummary({
        total: data.length,
        byStatus: byStatus,
        totalValue: totalValue,
        avgValue: data.length > 0 ? totalValue / data.length : 0
      });
    } else if (reportType === 'maintenance') {
      const byStatus = data.reduce((acc, item) => {
        acc[item.status] = (acc[item.status] || 0) + 1;
        return acc;
      }, {});
      
      const totalCost = data.reduce((sum, item) => sum + (parseFloat(item.cost) || 0), 0);
      
      setSummary({
        total: data.length,
        byStatus: byStatus,
        totalCost: totalCost,
        avgCost: data.length > 0 ? totalCost / data.length : 0
      });
    } else if (reportType === 'assignments') {
      const active = data.filter(item => !item.returned_at).length;
      const returned = data.filter(item => item.returned_at).length;
      
      setSummary({
        total: data.length,
        active: active,
        returned: returned,
        activePercentage: data.length > 0 ? (active / data.length) * 100 : 0
      });
    } else if (reportType === 'inventory') {
      const lowStock = data.filter(item => item.quantity <= item.min_quantity).length;
      const outOfStock = data.filter(item => item.quantity <= 0).length;
      
      setSummary({
        total: data.length,
        lowStock: lowStock,
        outOfStock: outOfStock,
        totalQuantity: data.reduce((sum, item) => sum + (item.quantity || 0), 0)
      });
    } else if (reportType === 'rfid') {
      const anomalies = data.filter(item => item.isAnomaly).length;
      
      setSummary({
        total: data.length,
        anomalies: anomalies,
        normal: data.length - anomalies,
        uniqueAssets: new Set(data.map(item => item.asset_id)).size
      });
    }
  };

  // Apply filters
  const applyFilters = useCallback(() => {
    let data = [...reportData];
    
    if (dateFrom) {
      data = data.filter(item => new Date(item.created_at || item.timestamp) >= new Date(dateFrom));
    }
    if (dateTo) {
      data = data.filter(item => new Date(item.created_at || item.timestamp) <= new Date(dateTo));
    }
    if (departmentFilter !== 'all') {
      data = data.filter(item => 
        item.department_name === departmentFilter || 
        item.department === departmentFilter
      );
    }
    if (categoryFilter !== 'all') {
      data = data.filter(item => 
        item.category_name === categoryFilter || 
        item.category === categoryFilter
      );
    }
    if (statusFilter !== 'all') {
      data = data.filter(item => item.status === statusFilter);
    }
    if (locationFilter !== 'all') {
      data = data.filter(item => 
        item.location === locationFilter || 
        item.reader_location === locationFilter
      );
    }
    
    setFilteredData(data);
    generateSummary(data);
  }, [reportData, dateFrom, dateTo, departmentFilter, categoryFilter, statusFilter, locationFilter]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  // Export to Excel
  const exportToExcel = () => {
    let data = [];
    
    switch (reportType) {
      case 'assets':
      case 'ict':
        data = filteredData.map(a => ({
          'Asset Tag': a.asset_tag,
          'Asset ID': a.id,
          'Name': a.name,
          'Category': a.category_name || '',
          'Department': a.department_name || '',
          'Status': a.status,
          'Location': a.location || '',
          'Condition': a.condition_status || '',
          'Serial Number': a.serial_number || '',
          'RFID Tag': a.rfid_tag || '',
          'Brand': a.brand || '',
          'Model': a.model || '',
          'Purchase Date': a.purchase_date ? new Date(a.purchase_date).toLocaleDateString() : '',
          'Purchase Cost': a.purchase_cost || 0,
          'Current Value': a.current_value || 0,
          'Warranty Expiry': a.warranty_expiry ? new Date(a.warranty_expiry).toLocaleDateString() : '',
          'Assigned To': a.assigned_to_name || ''
        }));
        break;
      
      case 'assignments':
        data = filteredData.map(a => ({
          'Assignment ID': a.id,
          'Asset Tag': a.asset_tag,
          'Asset Name': a.asset_name || '',
          'Assigned To': a.assigned_to_name || '',
          'Department': a.department_name || '',
          'Assigned Date': new Date(a.assigned_date).toLocaleDateString(),
          'Expected Return': a.expected_return_date ? new Date(a.expected_return_date).toLocaleDateString() : '',
          'Return Date': a.returned_at ? new Date(a.returned_at).toLocaleDateString() : '',
          'Status': a.returned_at ? 'Returned' : 'Active'
        }));
        break;
      
      case 'maintenance':
        data = filteredData.map(m => ({
          'Request #': m.request_number || m.id,
          'Title': m.title || m.problem,
          'Asset': m.asset_name || '',
          'Status': m.status,
          'Priority': m.priority,
          'Type': m.maintenance_type || m.type,
          'Reported By': m.reported_by_name || '',
          'Technician': m.assigned_to_name || '',
          'Created': new Date(m.created_at).toLocaleDateString(),
          'Scheduled': m.scheduled_date ? new Date(m.scheduled_date).toLocaleDateString() : '',
          'Completion': m.completion_date ? new Date(m.completion_date).toLocaleDateString() : '',
          'Cost': m.cost || 0,
          'Parts Used': m.parts_used || ''
        }));
        break;
      
      case 'inventory':
        data = filteredData.map(i => ({
          'Item Name': i.name,
          'Category': i.category || '',
          'Quantity': i.quantity || 0,
          'Min Quantity': i.min_quantity || 0,
          'Location': i.location || '',
          'Status': i.quantity <= 0 ? 'Out of Stock' : 
                    i.quantity <= i.min_quantity ? 'Low Stock' : 'Normal',
          'Supplier': i.supplier || '',
          'Unit Cost': i.unit_cost || 0,
          'Total Value': (i.quantity || 0) * (i.unit_cost || 0)
        }));
        break;
      
      case 'rfid':
        data = filteredData.map(r => ({
          'Timestamp': new Date(r.timestamp).toLocaleString(),
          'Asset': r.asset_name || '',
          'Asset ID': r.asset_id,
          'RFID Tag': r.rfid_tag || '',
          'Location': r.reader_location || '',
          'Reader ID': r.reader_id || '',
          'Status': r.isAnomaly ? '⚠️ Anomaly' : '✅ Normal',
          'Signal Strength': r.signal_strength || 'N/A'
        }));
        break;
      
      default:
        data = filteredData;
    }

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, reportType);
    XLSX.writeFile(wb, `${reportType}_report_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Report exported successfully');
  };

  const downloadReportFile = (content, extension, type) => {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${reportType}_report_${new Date().toISOString().split('T')[0]}.${extension}`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Report exported successfully');
  };

  const exportToCSV = () => {
    const rows = filteredData.map(item => ({
      ID: item.id || item.asset_id || item.request_number || '',
      Name: item.name || item.title || item.asset_name || '',
      Status: item.status || '',
      Department: item.department_name || item.department || '',
      Location: item.location || item.reader_location || '',
      Date: item.created_at || item.timestamp || item.assigned_date || ''
    }));
    const headers = Object.keys(rows[0] || { ID: '', Name: '', Status: '', Department: '', Location: '', Date: '' });
    const csv = [headers.join(','), ...rows.map(row => headers.map(header => `"${String(row[header]).replace(/"/g, '""')}"`).join(','))].join('\n');
    downloadReportFile(csv, 'csv', 'text/csv;charset=utf-8');
  };

  const exportToJSON = () => {
    downloadReportFile(JSON.stringify({ reportType, generatedAt: new Date().toISOString(), filters: { dateFrom, dateTo, departmentFilter, categoryFilter, statusFilter, locationFilter }, summary, records: filteredData }, null, 2), 'json', 'application/json');
  };

  // Export to PDF
  const exportToPDF = () => {
    const doc = new jsPDF();
    const title = reportTypes[reportType]?.label || 'ICT Report';
    
    doc.text(`${title} - ${new Date().toLocaleString()}`, 14, 15);
    doc.text(`Generated by: ${user?.fullName || user?.username || 'System'}`, 14, 25);
    doc.text(`Total Records: ${filteredData.length}`, 14, 35);
    
    let headers = [];
    let rows = [];
    
    switch (reportType) {
      case 'assets':
      case 'ict':
        headers = ['Asset Tag', 'Name', 'Category', 'Status', 'Location', 'Value'];
        rows = filteredData.slice(0, 100).map(a => [
          a.asset_tag || a.id,
          a.name,
          a.category_name || '',
          a.status || '',
          a.location || '',
          `$${(a.current_value || 0).toLocaleString()}`
        ]);
        break;
      
      case 'assignments':
        headers = ['Asset', 'Assigned To', 'Department', 'Assigned Date', 'Status'];
        rows = filteredData.slice(0, 100).map(a => [
          a.asset_name || a.asset_tag,
          a.assigned_to_name || '',
          a.department_name || '',
          new Date(a.assigned_date).toLocaleDateString(),
          a.returned_at ? 'Returned' : 'Active'
        ]);
        break;
      
      case 'maintenance':
        headers = ['Request #', 'Problem', 'Asset', 'Status', 'Priority', 'Cost'];
        rows = filteredData.slice(0, 100).map(m => [
          m.request_number || m.id,
          (m.title || m.problem || '').substring(0, 20),
          m.asset_name || '',
          m.status || '',
          m.priority || '',
          `$${(parseFloat(m.cost) || 0).toFixed(2)}`
        ]);
        break;
      
      case 'inventory':
        headers = ['Item', 'Quantity', 'Min Qty', 'Status', 'Value'];
        rows = filteredData.slice(0, 100).map(i => [
          i.name,
          i.quantity || 0,
          i.min_quantity || 0,
          i.quantity <= 0 ? 'Out of Stock' : 
            i.quantity <= i.min_quantity ? 'Low Stock' : 'Normal',
          `$${((i.quantity || 0) * (i.unit_cost || 0)).toFixed(2)}`
        ]);
        break;
      
      case 'rfid':
        headers = ['Asset', 'Location', 'Time', 'Status'];
        rows = filteredData.slice(0, 100).map(r => [
          r.asset_name || r.asset,
          r.reader_location || '',
          new Date(r.timestamp).toLocaleTimeString(),
          r.isAnomaly ? '⚠️ Anomaly' : '✅ Normal'
        ]);
        break;
      
      default:
        headers = ['ID', 'Name', 'Status'];
        rows = filteredData.slice(0, 100).map(item => [
          item.id,
          item.name || '',
          item.status || ''
        ]);
    }

    doc.autoTable({
      head: [headers],
      body: rows,
      startY: 45,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [26, 54, 93] }
    });

    if (filteredData.length > 100) {
      doc.text(`Showing 100 of ${filteredData.length} records`, 14, doc.lastAutoTable.finalY + 10);
    }

    doc.save(`${reportType}_report_${new Date().toISOString().split('T')[0]}.pdf`);
    toast.success('Report exported successfully');
  };

  // Print report
  const printReport = () => {
    window.print();
  };

  // Get report label
  const getReportLabel = () => {
    return reportTypes[reportType]?.label || 'Report';
  };

  // Get status color
  const getStatusColor = (status) => {
    const colors = {
      'Available': '#48bb78',
      'Assigned': '#4299e1',
      'Under-Maintenance': '#ed8936',
      'Lost': '#fc8181',
      'Disposed': '#805ad5',
      'Pending': '#ed8936',
      'In Progress': '#ed8936',
      'Completed': '#48bb78',
      'Rejected': '#fc8181',
      'Active': '#48bb78',
      'Returned': '#4299e1'
    };
    return colors[status] || '#718096';
  };

  // Styles
  const styles = {
    container: { padding: '20px', maxWidth: '1400px', margin: '0 auto' },
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
      margin: '4px 0 0 0'
    },
    controls: {
      display: 'flex',
      gap: '12px',
      flexWrap: 'wrap',
      alignItems: 'center'
    },
    select: {
      padding: '10px 16px',
      borderRadius: '8px',
      border: `1px solid ${isDark ? '#32465f' : '#d0d8e8'}`,
      background: isDark ? '#0d1b2a' : '#f7fafc',
      color: isDark ? '#c8dcf5' : '#1a365d',
      fontSize: '0.95rem',
      cursor: 'pointer',
      minWidth: '150px'
    },
    input: {
      padding: '10px 16px',
      borderRadius: '8px',
      border: `1px solid ${isDark ? '#32465f' : '#d0d8e8'}`,
      background: isDark ? '#0d1b2a' : '#f7fafc',
      color: isDark ? '#c8dcf5' : '#1a365d',
      fontSize: '0.95rem'
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
    summaryGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
      gap: '16px',
      marginBottom: '24px'
    },
    summaryCard: {
      background: isDark ? '#1e2d45' : '#ffffff',
      padding: '16px 20px',
      borderRadius: '12px',
      border: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
      textAlign: 'center'
    },
    summaryNumber: {
      fontSize: '1.5rem',
      fontWeight: 700,
      color: isDark ? '#c8dcf5' : '#1a365d'
    },
    summaryLabel: {
      fontSize: '0.85rem',
      color: isDark ? '#8896b0' : '#4a5568'
    },
    filtersRow: {
      display: 'flex',
      gap: '12px',
      flexWrap: 'wrap',
      marginBottom: '24px',
      padding: '16px 20px',
      background: isDark ? '#1e2d45' : '#ffffff',
      borderRadius: '12px',
      border: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`
    },
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
      letterSpacing: '0.3px'
    },
    td: {
      padding: '12px 16px',
      borderBottom: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
      color: isDark ? '#c8dcf5' : '#1a365d',
      fontSize: '14px'
    },
    statusBadge: (status) => ({
      display: 'inline-block',
      padding: '4px 12px',
      borderRadius: '20px',
      fontSize: '12px',
      fontWeight: 600,
      background: `${getStatusColor(status)}20`,
      color: getStatusColor(status),
      border: `1px solid ${getStatusColor(status)}40`
    }),
    emptyState: {
      textAlign: 'center',
      padding: '40px',
      color: isDark ? '#8896b0' : '#4a5568'
    },
    printHide: {
      '@media print': { display: 'none' }
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
          <h1 style={styles.title}>📊 {t.reports}</h1>
          <p style={styles.subtitle}>{t.reportDesc}</p>
        </div>
        <div style={styles.controls}>
          <select 
            style={styles.select} 
            value={reportType} 
            onChange={(e) => setReportType(e.target.value)}
          >
            {Object.entries(reportTypes).map(([key, value]) => (
              <option key={key} value={key}>{value.icon} {value.label}</option>
            ))}
          </select>
          <button style={styles.button('linear-gradient(135deg, #48bb78, #38a169)')} onClick={exportToExcel}>
            📥 {t.exportExcel}
          </button>
          <button style={styles.button('linear-gradient(135deg, #319795, #4fd1c5)')} onClick={exportToCSV}>
            🧾 {t.exportCSV}
          </button>
          <button style={styles.button('linear-gradient(135deg, #d69e2e, #f6ad55)')} onClick={exportToJSON}>
            {'{ }'} {t.exportJSON}
          </button>
          <button style={styles.button('linear-gradient(135deg, #805ad5, #b794f4)')} onClick={exportToPDF}>
            📄 {t.exportPDF}
          </button>
          <button style={styles.button('linear-gradient(135deg, #718096, #4a5568)')} onClick={printReport}>
            🖨️ {t.print}
          </button>
        </div>
      </div>

      {/* Summary */}
      {summary && (
        <div style={styles.summaryGrid}>
          <div style={styles.summaryCard}>
            <div style={styles.summaryNumber}>{summary.total}</div>
            <div style={styles.summaryLabel}>{t.totalRecords}</div>
          </div>
          
          {(reportType === 'assets' || reportType === 'ict') && (
            <>
              <div style={styles.summaryCard}>
                <div style={styles.summaryNumber}>${summary.totalValue?.toLocaleString() || 0}</div>
                <div style={styles.summaryLabel}>{t.totalValue}</div>
              </div>
              <div style={styles.summaryCard}>
                <div style={styles.summaryNumber}>${summary.avgValue?.toLocaleString() || 0}</div>
                <div style={styles.summaryLabel}>{t.avgValue}</div>
              </div>
            </>
          )}
          
          {reportType === 'maintenance' && (
            <>
              <div style={styles.summaryCard}>
                <div style={styles.summaryNumber}>${summary.totalCost?.toFixed(2) || 0}</div>
                <div style={styles.summaryLabel}>{t.totalCost}</div>
              </div>
              <div style={styles.summaryCard}>
                <div style={styles.summaryNumber}>${summary.avgCost?.toFixed(2) || 0}</div>
                <div style={styles.summaryLabel}>{t.avgCost}</div>
              </div>
            </>
          )}
          
          {reportType === 'assignments' && (
            <>
              <div style={styles.summaryCard}>
                <div style={styles.summaryNumber}>{summary.active || 0}</div>
                <div style={styles.summaryLabel}>{t.activeAssignments}</div>
              </div>
              <div style={styles.summaryCard}>
                <div style={styles.summaryNumber}>{summary.returned || 0}</div>
                <div style={styles.summaryLabel}>{t.returnedAssignments}</div>
              </div>
            </>
          )}
          
          {reportType === 'inventory' && (
            <>
              <div style={styles.summaryCard}>
                <div style={styles.summaryNumber}>{summary.lowStock || 0}</div>
                <div style={styles.summaryLabel}>{t.lowStockItems}</div>
              </div>
              <div style={styles.summaryCard}>
                <div style={styles.summaryNumber}>{summary.outOfStock || 0}</div>
                <div style={styles.summaryLabel}>{t.outOfStockItems}</div>
              </div>
              <div style={styles.summaryCard}>
                <div style={styles.summaryNumber}>{summary.totalQuantity || 0}</div>
                <div style={styles.summaryLabel}>{t.totalQuantity}</div>
              </div>
            </>
          )}
          
          {reportType === 'rfid' && (
            <>
              <div style={styles.summaryCard}>
                <div style={{ ...styles.summaryNumber, color: '#fc8181' }}>{summary.anomalies || 0}</div>
                <div style={styles.summaryLabel}>{t.anomalies}</div>
              </div>
              <div style={styles.summaryCard}>
                <div style={{ ...styles.summaryNumber, color: '#48bb78' }}>{summary.normal || 0}</div>
                <div style={styles.summaryLabel}>{t.normalScans}</div>
              </div>
              <div style={styles.summaryCard}>
                <div style={styles.summaryNumber}>{summary.uniqueAssets || 0}</div>
                <div style={styles.summaryLabel}>{t.uniqueAssets}</div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Filters */}
      <div style={styles.filtersRow}>
        <input 
          type="date" 
          style={styles.input} 
          value={dateFrom} 
          onChange={(e) => setDateFrom(e.target.value)} 
          placeholder="From"
        />
        <input 
          type="date" 
          style={styles.input} 
          value={dateTo} 
          onChange={(e) => setDateTo(e.target.value)} 
          placeholder="To"
        />
        
        {departments.length > 0 && (
          <select 
            style={styles.select} 
            value={departmentFilter} 
            onChange={(e) => setDepartmentFilter(e.target.value)}
          >
            <option value="all">{t.allDepartments}</option>
            {departments.map(dept => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
        )}
        
        {categories.length > 0 && (
          <select 
            style={styles.select} 
            value={categoryFilter} 
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="all">{t.allCategories}</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        )}
        
        {statuses.length > 0 && (
          <select 
            style={styles.select} 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">{t.allStatus}</option>
            {statuses.map(status => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        )}
        
        {locations.length > 0 && (
          <select 
            style={styles.select} 
            value={locationFilter} 
            onChange={(e) => setLocationFilter(e.target.value)}
          >
            <option value="all">{t.allLocations}</option>
            {locations.map(loc => (
              <option key={loc} value={loc}>{loc}</option>
            ))}
          </select>
        )}
      </div>

      {/* Report Title */}
      <h2 style={{ color: isDark ? '#c8dcf5' : '#1a365d', marginBottom: '16px' }}>
        {reportTypes[reportType]?.icon} {getReportLabel()} ({filteredData.length} {t.records})
      </h2>

      {/* Table */}
      {filteredData.length === 0 ? (
        <div style={styles.emptyState}>{t.noData}</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={styles.table}>
            <thead>
              <tr>
                {(reportType === 'assets' || reportType === 'ict') && (
                  <>
                    <th style={styles.th}>{t.assetTag}</th>
                    <th style={styles.th}>{t.name}</th>
                    <th style={styles.th}>{t.category}</th>
                    <th style={styles.th}>{t.department}</th>
                    <th style={styles.th}>{t.status}</th>
                    <th style={styles.th}>{t.location}</th>
                    <th style={styles.th}>{t.value}</th>
                  </>
                )}
                {reportType === 'assignments' && (
                  <>
                    <th style={styles.th}>{t.assetTag}</th>
                    <th style={styles.th}>{t.assetName}</th>
                    <th style={styles.th}>{t.assignedTo}</th>
                    <th style={styles.th}>{t.department}</th>
                    <th style={styles.th}>{t.assignedDate}</th>
                    <th style={styles.th}>{t.expectedReturn}</th>
                    <th style={styles.th}>{t.status}</th>
                  </>
                )}
                {reportType === 'maintenance' && (
                  <>
                    <th style={styles.th}>{t.requestNumber}</th>
                    <th style={styles.th}>{t.title}</th>
                    <th style={styles.th}>{t.asset}</th>
                    <th style={styles.th}>{t.status}</th>
                    <th style={styles.th}>{t.priority}</th>
                    <th style={styles.th}>{t.type}</th>
                    <th style={styles.th}>{t.reportedBy}</th>
                  </>
                )}
                {reportType === 'inventory' && (
                  <>
                    <th style={styles.th}>{t.itemName}</th>
                    <th style={styles.th}>{t.category}</th>
                    <th style={styles.th}>{t.quantity}</th>
                    <th style={styles.th}>{t.minQuantity}</th>
                    <th style={styles.th}>{t.status}</th>
                    <th style={styles.th}>{t.location}</th>
                    <th style={styles.th}>{t.value}</th>
                  </>
                )}
                {reportType === 'rfid' && (
                  <>
                    <th style={styles.th}>{t.time}</th>
                    <th style={styles.th}>{t.asset}</th>
                    <th style={styles.th}>{t.rfidTag}</th>
                    <th style={styles.th}>{t.location}</th>
                    <th style={styles.th}>{t.status}</th>
                    <th style={styles.th}>{t.readerId}</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {filteredData.slice(0, 100).map((item, index) => (
                <tr key={item.id || index}>
                  {(reportType === 'assets' || reportType === 'ict') && (
                    <>
                      <td style={styles.td}>{item.asset_tag || item.id}</td>
                      <td style={styles.td}>{item.name}</td>
                      <td style={styles.td}>{item.category_name || '-'}</td>
                      <td style={styles.td}>{item.department_name || '-'}</td>
                      <td style={styles.td}>
                        <span style={styles.statusBadge(item.status)}>{item.status || '-'}</span>
                      </td>
                      <td style={styles.td}>{item.location || '-'}</td>
                      <td style={styles.td}>${(item.current_value || 0).toLocaleString()}</td>
                    </>
                  )}
                  {reportType === 'assignments' && (
                    <>
                      <td style={styles.td}>{item.asset_tag || '-'}</td>
                      <td style={styles.td}>{item.asset_name || '-'}</td>
                      <td style={styles.td}>{item.assigned_to_name || '-'}</td>
                      <td style={styles.td}>{item.department_name || '-'}</td>
                      <td style={styles.td}>{new Date(item.assigned_date).toLocaleDateString()}</td>
                      <td style={styles.td}>{item.expected_return_date ? new Date(item.expected_return_date).toLocaleDateString() : '-'}</td>
                      <td style={styles.td}>
                        <span style={styles.statusBadge(item.returned_at ? 'Returned' : 'Active')}>
                          {item.returned_at ? 'Returned' : 'Active'}
                        </span>
                      </td>
                    </>
                  )}
                  {reportType === 'maintenance' && (
                    <>
                      <td style={styles.td}>{item.request_number || item.id}</td>
                      <td style={styles.td}>{item.title || item.problem}</td>
                      <td style={styles.td}>{item.asset_name || '-'}</td>
                      <td style={styles.td}>
                        <span style={styles.statusBadge(item.status)}>{item.status || '-'}</span>
                      </td>
                      <td style={styles.td}>
                        <span style={{ 
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 700,
                          background: item.priority === 'Critical' ? 'rgba(252, 129, 129, 0.2)' :
                                     item.priority === 'High' ? 'rgba(237, 137, 54, 0.2)' :
                                     item.priority === 'Medium' ? 'rgba(43, 108, 176, 0.2)' :
                                     'rgba(72, 187, 120, 0.2)',
                          color: item.priority === 'Critical' ? '#fc8181' :
                                 item.priority === 'High' ? '#ed8936' :
                                 item.priority === 'Medium' ? '#4299e1' :
                                 '#48bb78'
                        }}>
                          {item.priority || '-'}
                        </span>
                      </td>
                      <td style={styles.td}>{item.maintenance_type || item.type || '-'}</td>
                      <td style={styles.td}>{item.reported_by_name || '-'}</td>
                    </>
                  )}
                  {reportType === 'inventory' && (
                    <>
                      <td style={styles.td}>{item.name}</td>
                      <td style={styles.td}>{item.category || '-'}</td>
                      <td style={styles.td}>{item.quantity || 0}</td>
                      <td style={styles.td}>{item.min_quantity || 0}</td>
                      <td style={styles.td}>
                        <span style={styles.statusBadge(
                          item.quantity <= 0 ? 'Out of Stock' :
                          item.quantity <= item.min_quantity ? 'Low Stock' : 'Available'
                        )}>
                          {item.quantity <= 0 ? 'Out of Stock' :
                           item.quantity <= item.min_quantity ? 'Low Stock' : 'Normal'}
                        </span>
                      </td>
                      <td style={styles.td}>{item.location || '-'}</td>
                      <td style={styles.td}>${((item.quantity || 0) * (item.unit_cost || 0)).toFixed(2)}</td>
                    </>
                  )}
                  {reportType === 'rfid' && (
                    <>
                      <td style={styles.td}>
                        <div>{new Date(item.timestamp).toLocaleDateString()}</div>
                        <div style={{ fontSize: '11px', color: isDark ? '#8896b0' : '#4a5568' }}>
                          {new Date(item.timestamp).toLocaleTimeString()}
                        </div>
                      </td>
                      <td style={styles.td}>{item.asset_name || '-'}</td>
                      <td style={styles.td}><code style={{ fontSize: '12px' }}>{item.rfid_tag || '-'}</code></td>
                      <td style={styles.td}>{item.reader_location || '-'}</td>
                      <td style={styles.td}>
                        <span style={{ color: item.isAnomaly ? '#fc8181' : '#48bb78', fontWeight: 600 }}>
                          {item.isAnomaly ? '⚠️ Anomaly' : '✅ Normal'}
                        </span>
                      </td>
                      <td style={styles.td}>{item.reader_id || '-'}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {filteredData.length > 100 && (
            <div style={{ textAlign: 'center', padding: '12px', color: isDark ? '#8896b0' : '#4a5568', fontSize: '12px' }}>
              {t.showingFirst} 100 {t.of} {filteredData.length}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Translations
const englishTranslations = {
  reports: 'ICT Reports',
  reportDesc: 'Generate and export comprehensive ICT management reports',
  exportExcel: 'Export Excel',
  exportCSV: 'Export CSV',
  exportJSON: 'Export JSON',
  exportPDF: 'Export PDF',
  print: 'Print',
  records: 'records',
  loading: 'Loading...',
  noData: 'No data available',
  showingFirst: 'Showing first',
  of: 'of',
  totalRecords: 'Total Records',
  totalValue: 'Total Value',
  avgValue: 'Average Value',
  totalCost: 'Total Cost',
  avgCost: 'Average Cost',
  activeAssignments: 'Active',
  returnedAssignments: 'Returned',
  lowStockItems: 'Low Stock',
  outOfStockItems: 'Out of Stock',
  totalQuantity: 'Total Quantity',
  anomalies: 'Anomalies',
  normalScans: 'Normal Scans',
  uniqueAssets: 'Unique Assets',
  allDepartments: 'All Departments',
  allCategories: 'All Categories',
  allStatus: 'All Status',
  allLocations: 'All Locations',
  
  // Asset Report
  assetTag: 'Asset Tag',
  name: 'Name',
  category: 'Category',
  department: 'Department',
  status: 'Status',
  location: 'Location',
  value: 'Value',
  assetName: 'Asset Name',
  
  // Assignment Report
  assignedTo: 'Assigned To',
  assignedDate: 'Assigned Date',
  expectedReturn: 'Expected Return',
  
  // Maintenance Report
  requestNumber: 'Request #',
  title: 'Title',
  asset: 'Asset',
  priority: 'Priority',
  type: 'Type',
  reportedBy: 'Reported By',
  
  // Inventory Report
  itemName: 'Item Name',
  quantity: 'Quantity',
  minQuantity: 'Min Qty',
  
  // RFID Report
  time: 'Time',
  rfidTag: 'RFID Tag',
  readerId: 'Reader ID'
};

const amharicTranslations = {
  reports: 'የICT ሪፖርቶች',
  reportDesc: 'አጠቃላይ የICT አስተዳደር ሪፖርቶችን ያዘጋጁ እና ያስወጡ',
  exportExcel: 'Excel ወጣ',
  exportCSV: 'CSV ወጣ',
  exportJSON: 'JSON ወጣ',
  exportPDF: 'PDF ወጣ',
  print: 'አትም',
  records: 'መዝገቦች',
  loading: 'በመጫን ላይ...',
  noData: 'ምንም መረጃ የለም',
  showingFirst: 'የመጀመሪያዎቹን',
  of: 'ከ',
  totalRecords: 'ጠቅላላ መዝገቦች',
  totalValue: 'ጠቅላላ ዋጋ',
  avgValue: 'አማካይ ዋጋ',
  totalCost: 'ጠቅላላ ወጪ',
  avgCost: 'አማካይ ወጪ',
  activeAssignments: 'ንቁ',
  returnedAssignments: 'የተመለሱ',
  lowStockItems: 'አነስተኛ ክምችት',
  outOfStockItems: 'ክምችት የሌለ',
  totalQuantity: 'ጠቅላላ ብዛት',
  anomalies: 'ያልተለመዱ',
  normalScans: 'መደበኛ ቅኝቶች',
  uniqueAssets: 'ልዩ ንብረቶች',
  allDepartments: 'ሁሉም ክፍሎች',
  allCategories: 'ሁሉም ምድቦች',
  allStatus: 'ሁሉም ሁኔታዎች',
  allLocations: 'ሁሉም ቦታዎች',
  
  // Asset Report
  assetTag: 'የንብረት መለያ',
  name: 'ስም',
  category: 'ምድብ',
  department: 'ክፍል',
  status: 'ሁኔታ',
  location: 'ቦታ',
  value: 'ዋጋ',
  assetName: 'የንብረት ስም',
  
  // Assignment Report
  assignedTo: 'ተመድቦለት',
  assignedDate: 'የተመደበበት ቀን',
  expectedReturn: 'የሚጠበቀው መመለስ',
  
  // Maintenance Report
  requestNumber: 'የጥያቄ ቁጥር',
  title: 'ርዕስ',
  asset: 'ንብረት',
  priority: 'ቅድሚያ',
  type: 'አይነት',
  reportedBy: 'አቅራቢ',
  
  // Inventory Report
  itemName: 'የንጥል ስም',
  quantity: 'ብዛት',
  minQuantity: 'ዝቅተኛ ብዛት',
  
  // RFID Report
  time: 'ሰዓት',
  rfidTag: 'RFID መለያ',
  readerId: 'አንባቢ መለያ'
};

export default ICTReports;