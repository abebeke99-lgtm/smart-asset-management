import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/UiContext';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import axios from 'axios';
import { Bar, Line, Doughnut, Pie } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, PointElement, LineElement, Filler } from 'chart.js';

ChartJS.register(
  CategoryScale, 
  LinearScale, 
  BarElement, 
  Title, 
  Tooltip, 
  Legend, 
  ArcElement,
  PointElement,
  LineElement,
  Filler
);

const DeptReports = () => {
  const { user } = useAuth();
  const { language, theme } = useLanguage();
  const printRef = useRef();
  
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('assets');
  const [reportData, setReportData] = useState({
    assets: [],
    maintenance: [],
    staff: [],
    approvals: []
  });
  
  const [summary, setSummary] = useState({
    assets: {},
    maintenance: {},
    staff: {},
    approvals: {}
  });

  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    category: '',
    employee: '',
    location: '',
    assetStatus: '',
    requestStatus: '',
    maintenanceStatus: ''
  });

  const isDark = theme === 'dark';
  const t = language === 'en' ? englishTranslations : amharicTranslations;

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const [assetsRes, maintRes, staffRes, approvalsRes] = await Promise.all([
        axios.get('/api/assets', { params: { department: user?.department, limit: 500 } }),
        axios.get('/api/maintenance', { params: { limit: 500 } }),
        axios.get('/api/users', { params: { department: user?.department } }),
        axios.get('/api/approvals', { params: { department: user?.department, limit: 200 } })
      ]);

      const assets = assetsRes.data?.assets || assetsRes.data?.data || [];
      const maintenance = maintRes.data?.requests || [];
      const staff = staffRes.data?.users || [];
      const approvals = approvalsRes.data?.requests || [];

      // Filter maintenance by department
      const deptMaintenance = maintenance.filter(m => 
        m.asset?.department === user?.department || m.department === user?.department
      );

      setReportData({ 
        assets, 
        maintenance: deptMaintenance, 
        staff,
        approvals 
      });

      calculateSummary(assets, deptMaintenance, staff, approvals);
    } catch (error) {
      toast.error(t.fetchError || 'Failed to load report data');
      setReportData({ 
        assets: [], 
        maintenance: [], 
        staff: [],
        approvals: [] 
      });
      calculateSummary([], [], [], []);
    }
    setLoading(false);
  };

  const calculateSummary = (assets, maintenance, staff, approvals) => {
    const totalAssets = assets.length;
    const inUse = assets.filter(a => a.status === 'In-Use' || a.status === 'Assigned').length;
    const available = assets.filter(a => a.status === 'Available').length;
    const underMaintenance = assets.filter(a => a.status === 'Under-Maintenance' || a.status === 'In-Repair').length;
    const disposed = assets.filter(a => a.status === 'Disposed').length;
    const totalValue = assets.reduce((sum, a) => sum + (a.current_value || 0), 0);
    const totalPurchaseCost = assets.reduce((sum, a) => sum + (a.purchase_cost || 0), 0);
    const depreciation = totalPurchaseCost - totalValue;

    const byCategory = assets.reduce((acc, a) => {
      const cat = a.category_name || 'Other';
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    }, {});

    const byLocation = assets.reduce((acc, a) => {
      const loc = a.location || 'Unknown';
      acc[loc] = (acc[loc] || 0) + 1;
      return acc;
    }, {});

    const byEmployee = assets.reduce((acc, a) => {
      if (a.assigned_to_name) {
        acc[a.assigned_to_name] = (acc[a.assigned_to_name] || 0) + 1;
      }
      return acc;
    }, {});

    const pendingMaintenance = maintenance.filter(m => m.status === 'Pending').length;
    const inProgressMaintenance = maintenance.filter(m => m.status === 'In-Progress').length;
    const completedMaintenance = maintenance.filter(m => m.status === 'Completed').length;
    const totalMaintenanceCost = maintenance.reduce((sum, m) => sum + (m.actual_cost || 0), 0);

    const staffWithAssets = staff.filter(s => s.assigned_assets > 0).length;
    const staffWithoutAssets = staff.length - staffWithAssets;

    const pendingApprovals = approvals.filter(a => a.status === 'Pending').length;
    const approvedApprovals = approvals.filter(a => a.status === 'Approved').length;
    const rejectedApprovals = approvals.filter(a => a.status === 'Rejected').length;

    setSummary({
      assets: {
        totalAssets,
        inUse,
        available,
        underMaintenance,
        disposed,
        totalValue,
        totalPurchaseCost,
        depreciation,
        byCategory,
        byLocation,
        byEmployee,
        utilizationRate: totalAssets > 0 ? (inUse / totalAssets) * 100 : 0
      },
      maintenance: {
        totalMaintenance: maintenance.length,
        pendingMaintenance,
        inProgressMaintenance,
        completedMaintenance,
        totalMaintenanceCost,
        byPriority: maintenance.reduce((acc, m) => {
          acc[m.priority] = (acc[m.priority] || 0) + 1;
          return acc;
        }, {}),
        byType: maintenance.reduce((acc, m) => {
          acc[m.type] = (acc[m.type] || 0) + 1;
          return acc;
        }, {})
      },
      staff: {
        totalStaff: staff.length,
        staffWithAssets,
        staffWithoutAssets,
        byRole: staff.reduce((acc, s) => {
          acc[s.role] = (acc[s.role] || 0) + 1;
          return acc;
        }, {})
      },
      approvals: {
        totalApprovals: approvals.length,
        pendingApprovals,
        approvedApprovals,
        rejectedApprovals,
        byType: approvals.reduce((acc, a) => {
          acc[a.type] = (acc[a.type] || 0) + 1;
          return acc;
        }, {})
      }
    });
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      dateFrom: '',
      dateTo: '',
      category: '',
      employee: '',
      location: '',
      assetStatus: '',
      requestStatus: '',
      maintenanceStatus: ''
    });
  };

  const getFilteredAssets = useMemo(() => {
    let result = reportData.assets;
    
    if (filters.dateFrom) {
      result = result.filter(a => new Date(a.purchase_date) >= new Date(filters.dateFrom));
    }
    if (filters.dateTo) {
      result = result.filter(a => new Date(a.purchase_date) <= new Date(filters.dateTo));
    }
    if (filters.category) {
      result = result.filter(a => a.category_name === filters.category);
    }
    if (filters.employee) {
      result = result.filter(a => a.assigned_to_name === filters.employee);
    }
    if (filters.location) {
      result = result.filter(a => a.location === filters.location);
    }
    if (filters.assetStatus) {
      result = result.filter(a => a.status === filters.assetStatus);
    }
    
    return result;
  }, [reportData.assets, filters]);

  const getFilteredMaintenance = useMemo(() => {
    let result = reportData.maintenance;
    
    if (filters.dateFrom) {
      result = result.filter(m => new Date(m.created_at) >= new Date(filters.dateFrom));
    }
    if (filters.dateTo) {
      result = result.filter(m => new Date(m.created_at) <= new Date(filters.dateTo));
    }
    if (filters.maintenanceStatus) {
      result = result.filter(m => m.status === filters.maintenanceStatus);
    }
    if (filters.requestStatus) {
      result = result.filter(m => m.status === filters.requestStatus);
    }
    
    return result;
  }, [reportData.maintenance, filters]);

  const getFilteredStaff = useMemo(() => {
    let result = reportData.staff;
    
    if (filters.employee) {
      result = result.filter(s => s.fullName === filters.employee);
    }
    
    return result;
  }, [reportData.staff, filters]);

  const exportToPDF = () => {
    const doc = new jsPDF('landscape', 'mm', 'a4');
    
    doc.setFontSize(18);
    doc.setTextColor(isDark ? '#c8dcf5' : '#1a365d');
    doc.text(`${t.reports} - ${user?.department || 'Department'}`, 14, 20);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);
    doc.text(`Report Type: ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}`, 14, 34);

    let tableData = [];
    let headers = [];

    if (activeTab === 'assets') {
      headers = [t.assetTag, t.name, t.category, t.status, t.location, t.assignedTo, t.value];
      tableData = getFilteredAssets.slice(0, 50).map(a => [
        a.asset_tag || '',
        a.name || '',
        a.category_name || '',
        a.status || '',
        a.location || '',
        a.assigned_to_name || '-',
        a.current_value ? `$${a.current_value.toLocaleString()}` : '$0'
      ]);
    } else if (activeTab === 'maintenance') {
      headers = [t.requestId, t.title, t.asset, t.status, t.priority, t.type, t.created];
      tableData = getFilteredMaintenance.slice(0, 50).map(m => [
        m.request_number || '',
        m.title || '',
        m.asset_name || '',
        m.status || '',
        m.priority || '',
        m.type || '',
        new Date(m.created_at).toLocaleDateString() || ''
      ]);
    } else if (activeTab === 'staff') {
      headers = [t.employee, t.role, t.assignedAssets, t.status];
      tableData = getFilteredStaff.map(s => [
        s.fullName || '',
        s.role || '',
        s.assigned_assets || 0,
        s.active ? 'Active' : 'Inactive'
      ]);
    } else if (activeTab === 'approvals') {
      headers = [t.requestId, t.type, t.requestedBy, t.status, t.created];
      tableData = reportData.approvals.slice(0, 50).map(a => [
        a.request_id || '',
        a.type || '',
        a.requested_by || '',
        a.status || '',
        new Date(a.created_at).toLocaleDateString() || ''
      ]);
    }

    if (tableData.length > 0) {
      doc.autoTable({
        head: [headers],
        body: tableData,
        startY: 42,
        theme: isDark ? 'dark' : 'grid',
        styles: { fontSize: 7 },
        headStyles: { fillColor: isDark ? [30, 45, 69] : [55, 65, 81] }
      });
    }

    doc.save(`department_report_${user?.department}_${activeTab}.pdf`);
    toast.success(t.exportSuccess || 'PDF exported successfully');
  };

  const exportToExcel = () => {
    let data = [];

    if (activeTab === 'assets') {
      data = getFilteredAssets.map(a => ({
        'Asset Tag': a.asset_tag || '',
        'Name': a.name || '',
        'Category': a.category_name || '',
        'Status': a.status || '',
        'Condition': a.condition || '',
        'Location': a.location || '',
        'Assigned To': a.assigned_to_name || '',
        'Purchase Cost': a.purchase_cost || 0,
        'Current Value': a.current_value || 0,
        'Depreciation': (a.purchase_cost || 0) - (a.current_value || 0),
        'Purchase Date': a.purchase_date ? new Date(a.purchase_date).toLocaleDateString() : '',
        'Last Maintenance': a.last_maintenance_date ? new Date(a.last_maintenance_date).toLocaleDateString() : '',
        'Maintenance Count': a.maintenance_count || 0
      }));
    } else if (activeTab === 'maintenance') {
      data = getFilteredMaintenance.map(m => ({
        'Request #': m.request_number || '',
        'Title': m.title || '',
        'Asset': m.asset_name || '',
        'Status': m.status || '',
        'Priority': m.priority || '',
        'Type': m.type || '',
        'Reported By': m.reported_by_name || '',
        'Created': new Date(m.created_at).toLocaleDateString() || '',
        'Completed': m.completion_date ? new Date(m.completion_date).toLocaleDateString() : '-',
        'Cost': m.actual_cost || 0
      }));
    } else if (activeTab === 'staff') {
      data = getFilteredStaff.map(s => ({
        'Employee': s.fullName || '',
        'Role': s.role || '',
        'Email': s.email || '',
        'Assigned Assets': s.assigned_assets || 0,
        'Status': s.active ? 'Active' : 'Inactive'
      }));
    } else if (activeTab === 'approvals') {
      data = reportData.approvals.map(a => ({
        'Request ID': a.request_id || '',
        'Type': a.type || '',
        'Requested By': a.requested_by || '',
        'Status': a.status || '',
        'Created': new Date(a.created_at).toLocaleDateString() || '',
        'Approved/Rejected': a.approved_at ? new Date(a.approved_at).toLocaleDateString() : '-',
        'Decision By': a.approved_by || a.rejected_by || '-',
        'Comment': a.approval_comment || '-'
      }));
    }

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, activeTab.charAt(0).toUpperCase() + activeTab.slice(1));
    XLSX.writeFile(wb, `department_report_${user?.department}_${activeTab}.xlsx`);
    toast.success(t.exportSuccess || 'Excel exported successfully');
  };

  const handlePrint = () => {
    window.print();
  };

  const getStatusColor = (status) => {
    const colors = {
      'In-Use': '#48bb78',
      'Assigned': '#48bb78',
      'Available': '#4299e1',
      'Under-Maintenance': '#ed8936',
      'In-Repair': '#fc8181',
      'Disposed': '#a0aec0',
      'Pending': '#f6ad55',
      'In-Progress': '#4299e1',
      'Completed': '#48bb78',
      'Approved': '#48bb78',
      'Rejected': '#fc8181'
    };
    return colors[status] || '#a0aec0';
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: isDark ? '#c8dcf5' : '#1a365d',
          boxWidth: 12,
          padding: 15
        }
      }
    },
    scales: {
      y: {
        ticks: { 
          color: isDark ? '#8896b0' : '#4a5568',
          callback: (value) => {
            if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
            if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
            return value;
          }
        },
        grid: { color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }
      },
      x: {
        ticks: { color: isDark ? '#8896b0' : '#4a5568' },
        grid: { color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }
      }
    }
  };

  const styles = {
    container: {
      padding: '20px',
      maxWidth: '1600px',
      margin: '0 auto',
      background: isDark ? '#0d1a2e' : '#f0f4f8',
      minHeight: '100vh'
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      flexWrap: 'wrap',
      marginBottom: '24px'
    },
    title: {
      color: isDark ? '#c8dcf5' : '#1a365d',
      fontSize: '1.75rem',
      fontWeight: 700,
      marginBottom: '4px'
    },
    subtitle: {
      color: isDark ? '#8896b0' : '#4a5568',
      fontSize: '0.95rem'
    },
    headerActions: {
      display: 'flex',
      gap: '10px',
      flexWrap: 'wrap',
      marginTop: '8px'
    },
    exportButton: {
      background: 'linear-gradient(135deg, #48bb78, #38a169)',
      color: 'white',
      padding: '8px 16px',
      borderRadius: '8px',
      border: 'none',
      fontWeight: 600,
      cursor: 'pointer',
      fontSize: '0.9rem'
    },
    pdfButton: {
      background: 'linear-gradient(135deg, #fc8181, #e53e3e)',
      color: 'white',
      padding: '8px 16px',
      borderRadius: '8px',
      border: 'none',
      fontWeight: 600,
      cursor: 'pointer',
      fontSize: '0.9rem'
    },
    printButton: {
      background: 'linear-gradient(135deg, #63b3ed, #3182ce)',
      color: 'white',
      padding: '8px 16px',
      borderRadius: '8px',
      border: 'none',
      fontWeight: 600,
      cursor: 'pointer',
      fontSize: '0.9rem'
    },
    tabs: {
      display: 'flex',
      gap: '4px',
      marginBottom: '24px',
      flexWrap: 'wrap',
      background: isDark ? '#1e2d45' : '#f7fafc',
      padding: '4px',
      borderRadius: '12px'
    },
    tab: {
      padding: '10px 20px',
      borderRadius: '8px',
      border: 'none',
      background: 'transparent',
      color: isDark ? '#8896b0' : '#4a5568',
      cursor: 'pointer',
      fontWeight: 600,
      fontSize: '0.9rem',
      transition: 'all 0.2s'
    },
    activeTab: {
      background: isDark ? '#2d4a6f' : '#ffffff',
      color: isDark ? '#c8dcf5' : '#1a365d',
      boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,100,0.08)'
    },
    filtersBar: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '12px',
      padding: '16px',
      background: isDark ? '#1e2d45' : '#ffffff',
      borderRadius: '12px',
      border: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
      marginBottom: '24px',
      alignItems: 'center'
    },
    filterGroup: {
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
      flex: '1 1 140px',
      minWidth: '120px'
    },
    filterLabel: {
      color: isDark ? '#8896b0' : '#4a5568',
      fontSize: '0.7rem',
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.5px'
    },
    filterInput: {
      padding: '6px 10px',
      borderRadius: '6px',
      border: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
      background: isDark ? '#141e2d' : '#ffffff',
      color: isDark ? '#c8dcf5' : '#1a365d',
      fontSize: '0.85rem',
      outline: 'none'
    },
    filterSelect: {
      padding: '6px 10px',
      borderRadius: '6px',
      border: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
      background: isDark ? '#141e2d' : '#ffffff',
      color: isDark ? '#c8dcf5' : '#1a365d',
      fontSize: '0.85rem',
      cursor: 'pointer',
      outline: 'none'
    },
    clearFiltersButton: {
      padding: '6px 16px',
      borderRadius: '6px',
      border: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
      background: isDark ? '#141e2d' : '#f7fafc',
      color: isDark ? '#8896b0' : '#4a5568',
      cursor: 'pointer',
      fontSize: '0.85rem',
      marginTop: '16px',
      alignSelf: 'flex-end'
    },
    statsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
      gap: '12px',
      marginBottom: '24px'
    },
    statCard: {
      background: isDark ? '#1e2d45' : '#ffffff',
      padding: '16px',
      borderRadius: '12px',
      border: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
      textAlign: 'center'
    },
    statNumber: {
      fontSize: '1.3rem',
      fontWeight: 700,
      color: isDark ? '#c8dcf5' : '#1a365d'
    },
    statLabel: {
      color: isDark ? '#8896b0' : '#4a5568',
      fontSize: '0.8rem',
      marginTop: '2px'
    },
    chartsRow: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
      gap: '20px',
      marginBottom: '24px'
    },
    chartCard: {
      background: isDark ? '#1e2d45' : '#ffffff',
      padding: '20px',
      borderRadius: '12px',
      border: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
      marginBottom: '20px'
    },
    chartTitle: {
      color: isDark ? '#c8dcf5' : '#1a365d',
      fontSize: '1rem',
      fontWeight: 600,
      marginBottom: '16px'
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
      padding: '10px 14px',
      textAlign: 'left',
      color: isDark ? '#c8dcf5' : '#1a365d',
      fontWeight: 600,
      borderBottom: `2px solid ${isDark ? '#32465f' : '#e8edf5'}`,
      background: isDark ? '#141e2d' : '#f7fafc',
      fontSize: '0.75rem',
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      whiteSpace: 'nowrap'
    },
    td: {
      padding: '10px 14px',
      borderBottom: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
      color: isDark ? '#c8dcf5' : '#1a365d',
      fontSize: '0.85rem'
    },
    statusBadge: (status) => ({
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: '12px',
      fontSize: '0.75rem',
      fontWeight: 600,
      background: getStatusColor(status) + '22',
      color: getStatusColor(status)
    }),
    emptyState: {
      textAlign: 'center',
      padding: '60px 20px',
      color: isDark ? '#8896b0' : '#4a5568'
    },
    assetTag: {
      display: 'inline-block',
      padding: '2px 10px',
      background: isDark ? '#2d4a6f' : '#e8edf5',
      borderRadius: '4px',
      fontSize: '0.8rem',
      fontWeight: 600,
      color: isDark ? '#c8dcf5' : '#1a365d'
    }
  };

  const tabs = [
    { id: 'assets', label: t.assets || 'Assets' },
    { id: 'maintenance', label: t.maintenance || 'Maintenance' },
    { id: 'staff', label: t.staff || 'Staff' },
    { id: 'approvals', label: t.approvals || 'Approvals' }
  ];

  // Get unique filter options
  const uniqueCategories = useMemo(() => 
    [...new Set(reportData.assets.map(a => a.category_name).filter(Boolean))], 
    [reportData.assets]
  );
  const uniqueLocations = useMemo(() => 
    [...new Set(reportData.assets.map(a => a.location).filter(Boolean))], 
    [reportData.assets]
  );
  const uniqueEmployees = useMemo(() => 
    [...new Set(reportData.assets.map(a => a.assigned_to_name).filter(Boolean))], 
    [reportData.assets]
  );

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.emptyState}>
          <div style={{ fontSize: '2rem', marginBottom: '12px' }}>⏳</div>
          <div>{t.loading}</div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container} ref={printRef}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>📊 {t.reports}</h1>
          <p style={styles.subtitle}>
            {t.reportsFor} <strong>{user?.department || 'Department'}</strong>
          </p>
        </div>
        <div style={styles.headerActions}>
          <button style={styles.exportButton} onClick={exportToExcel}>
            📥 {t.exportExcel}
          </button>
          <button style={styles.pdfButton} onClick={exportToPDF}>
            📄 {t.exportPDF}
          </button>
          <button style={styles.printButton} onClick={handlePrint}>
            🖨️ {t.print}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            style={{
              ...styles.tab,
              ...(activeTab === tab.id ? styles.activeTab : {})
            }}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div style={styles.filtersBar}>
        <div style={styles.filterGroup}>
          <span style={styles.filterLabel}>{t.dateFrom}</span>
          <input
            type="date"
            style={styles.filterInput}
            value={filters.dateFrom}
            onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
          />
        </div>
        <div style={styles.filterGroup}>
          <span style={styles.filterLabel}>{t.dateTo}</span>
          <input
            type="date"
            style={styles.filterInput}
            value={filters.dateTo}
            onChange={(e) => handleFilterChange('dateTo', e.target.value)}
          />
        </div>
        {activeTab === 'assets' && (
          <>
            <div style={styles.filterGroup}>
              <span style={styles.filterLabel}>{t.category}</span>
              <select
                style={styles.filterSelect}
                value={filters.category}
                onChange={(e) => handleFilterChange('category', e.target.value)}
              >
                <option value="">{t.allCategories}</option>
                {uniqueCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div style={styles.filterGroup}>
              <span style={styles.filterLabel}>{t.employee}</span>
              <select
                style={styles.filterSelect}
                value={filters.employee}
                onChange={(e) => handleFilterChange('employee', e.target.value)}
              >
                <option value="">{t.allEmployees}</option>
                {uniqueEmployees.map(emp => (
                  <option key={emp} value={emp}>{emp}</option>
                ))}
              </select>
            </div>
            <div style={styles.filterGroup}>
              <span style={styles.filterLabel}>{t.location}</span>
              <select
                style={styles.filterSelect}
                value={filters.location}
                onChange={(e) => handleFilterChange('location', e.target.value)}
              >
                <option value="">{t.allLocations}</option>
                {uniqueLocations.map(loc => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
            </div>
            <div style={styles.filterGroup}>
              <span style={styles.filterLabel}>{t.assetStatus}</span>
              <select
                style={styles.filterSelect}
                value={filters.assetStatus}
                onChange={(e) => handleFilterChange('assetStatus', e.target.value)}
              >
                <option value="">{t.allStatuses}</option>
                <option value="In-Use">In-Use</option>
                <option value="Available">Available</option>
                <option value="Under-Maintenance">Under Maintenance</option>
                <option value="In-Repair">In Repair</option>
                <option value="Disposed">Disposed</option>
              </select>
            </div>
          </>
        )}
        {activeTab === 'maintenance' && (
          <>
            <div style={styles.filterGroup}>
              <span style={styles.filterLabel}>{t.maintenanceStatus}</span>
              <select
                style={styles.filterSelect}
                value={filters.maintenanceStatus}
                onChange={(e) => handleFilterChange('maintenanceStatus', e.target.value)}
              >
                <option value="">{t.allStatuses}</option>
                <option value="Pending">Pending</option>
                <option value="In-Progress">In-Progress</option>
                <option value="Completed">Completed</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>
          </>
        )}
        <button style={styles.clearFiltersButton} onClick={clearFilters}>
          ✕ {t.clearFilters}
        </button>
      </div>

      {/* Asset Reports */}
      {activeTab === 'assets' && (
        <div>
          {/* Summary Stats */}
          <div style={styles.statsGrid}>
            <div style={styles.statCard}>
              <div style={styles.statNumber}>{summary.assets.totalAssets || 0}</div>
              <div style={styles.statLabel}>{t.totalAssets}</div>
            </div>
            <div style={styles.statCard}>
              <div style={{ ...styles.statNumber, color: '#48bb78' }}>{summary.assets.inUse || 0}</div>
              <div style={styles.statLabel}>{t.inUse}</div>
            </div>
            <div style={styles.statCard}>
              <div style={{ ...styles.statNumber, color: '#4299e1' }}>{summary.assets.available || 0}</div>
              <div style={styles.statLabel}>{t.available}</div>
            </div>
            <div style={styles.statCard}>
              <div style={{ ...styles.statNumber, color: '#ed8936' }}>{summary.assets.underMaintenance || 0}</div>
              <div style={styles.statLabel}>{t.underMaintenance}</div>
            </div>
            <div style={styles.statCard}>
              <div style={{ ...styles.statNumber, color: '#a0aec0' }}>{summary.assets.disposed || 0}</div>
              <div style={styles.statLabel}>{t.disposed}</div>
            </div>
            <div style={styles.statCard}>
              <div style={{ ...styles.statNumber, color: '#38a169' }}>
                ${(summary.assets.totalValue || 0).toLocaleString()}
              </div>
              <div style={styles.statLabel}>{t.totalValue}</div>
            </div>
            <div style={styles.statCard}>
              <div style={{ ...styles.statNumber, color: '#805ad5' }}>
                {summary.assets.utilizationRate?.toFixed(1) || 0}%
              </div>
              <div style={styles.statLabel}>{t.utilizationRate}</div>
            </div>
          </div>

          {/* Charts */}
          <div style={styles.chartsRow}>
            <div style={styles.chartCard}>
              <h3 style={styles.chartTitle}>{t.assetsByCategory}</h3>
              <div style={{ height: '250px' }}>
                <Doughnut 
                  data={{
                    labels: Object.keys(summary.assets.byCategory || {}),
                    datasets: [{
                      data: Object.values(summary.assets.byCategory || {}),
                      backgroundColor: ['#63b3ed', '#68d391', '#f6ad55', '#fc8181', '#b794f4', '#81e6d9'],
                      borderColor: isDark ? '#1e2d45' : '#ffffff',
                      borderWidth: 2
                    }]
                  }}
                  options={chartOptions}
                />
              </div>
            </div>
            <div style={styles.chartCard}>
              <h3 style={styles.chartTitle}>{t.assetsByLocation}</h3>
              <div style={{ height: '250px' }}>
                <Pie 
                  data={{
                    labels: Object.keys(summary.assets.byLocation || {}),
                    datasets: [{
                      data: Object.values(summary.assets.byLocation || {}),
                      backgroundColor: ['#48bb78', '#4299e1', '#ed8936', '#fc8181', '#805ad5'],
                      borderColor: isDark ? '#1e2d45' : '#ffffff',
                      borderWidth: 2
                    }]
                  }}
                  options={chartOptions}
                />
              </div>
            </div>
          </div>

          {/* Asset Table */}
          <div style={styles.chartCard}>
            <h3 style={styles.chartTitle}>{t.assetSummary}</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>{t.assetTag}</th>
                    <th style={styles.th}>{t.name}</th>
                    <th style={styles.th}>{t.category}</th>
                    <th style={styles.th}>{t.status}</th>
                    <th style={styles.th}>{t.location}</th>
                    <th style={styles.th}>{t.assignedTo}</th>
                    <th style={styles.th}>{t.value}</th>
                  </tr>
                </thead>
                <tbody>
                  {getFilteredAssets.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={{ ...styles.td, textAlign: 'center', padding: '30px' }}>
                        {t.noAssets}
                      </td>
                    </tr>
                  ) : (
                    getFilteredAssets.slice(0, 50).map(asset => (
                      <tr key={asset.id}>
                        <td style={styles.td}>
                          <span style={styles.assetTag}>{asset.asset_tag}</span>
                        </td>
                        <td style={styles.td}>{asset.name}</td>
                        <td style={styles.td}>{asset.category_name || '-'}</td>
                        <td style={styles.td}>
                          <span style={styles.statusBadge(asset.status)}>
                            {asset.status}
                          </span>
                        </td>
                        <td style={styles.td}>{asset.location || '-'}</td>
                        <td style={styles.td}>{asset.assigned_to_name || '-'}</td>
                        <td style={styles.td}>${(asset.current_value || 0).toLocaleString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              {getFilteredAssets.length > 50 && (
                <div style={{ textAlign: 'center', padding: '12px', color: isDark ? '#8896b0' : '#4a5568' }}>
                  {t.showingFirst} 50 {t.of} {getFilteredAssets.length}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Maintenance Reports */}
      {activeTab === 'maintenance' && (
        <div>
          <div style={styles.statsGrid}>
            <div style={styles.statCard}>
              <div style={styles.statNumber}>{summary.maintenance.totalMaintenance || 0}</div>
              <div style={styles.statLabel}>{t.totalMaintenance}</div>
            </div>
            <div style={styles.statCard}>
              <div style={{ ...styles.statNumber, color: '#ed8936' }}>{summary.maintenance.pendingMaintenance || 0}</div>
              <div style={styles.statLabel}>{t.pending}</div>
            </div>
            <div style={styles.statCard}>
              <div style={{ ...styles.statNumber, color: '#4299e1' }}>{summary.maintenance.inProgressMaintenance || 0}</div>
              <div style={styles.statLabel}>{t.inProgress}</div>
            </div>
            <div style={styles.statCard}>
              <div style={{ ...styles.statNumber, color: '#48bb78' }}>{summary.maintenance.completedMaintenance || 0}</div>
              <div style={styles.statLabel}>{t.completed}</div>
            </div>
            <div style={styles.statCard}>
              <div style={{ ...styles.statNumber, color: '#38a169' }}>
                ${(summary.maintenance.totalMaintenanceCost || 0).toLocaleString()}
              </div>
              <div style={styles.statLabel}>{t.maintenanceCost}</div>
            </div>
          </div>

          <div style={styles.chartsRow}>
            <div style={styles.chartCard}>
              <h3 style={styles.chartTitle}>{t.maintenanceByPriority}</h3>
              <div style={{ height: '250px' }}>
                <Doughnut 
                  data={{
                    labels: Object.keys(summary.maintenance.byPriority || {}),
                    datasets: [{
                      data: Object.values(summary.maintenance.byPriority || {}),
                      backgroundColor: ['#fc8181', '#ed8936', '#f6ad55', '#48bb78'],
                      borderColor: isDark ? '#1e2d45' : '#ffffff',
                      borderWidth: 2
                    }]
                  }}
                  options={chartOptions}
                />
              </div>
            </div>
            <div style={styles.chartCard}>
              <h3 style={styles.chartTitle}>{t.maintenanceByType}</h3>
              <div style={{ height: '250px' }}>
                <Pie 
                  data={{
                    labels: Object.keys(summary.maintenance.byType || {}),
                    datasets: [{
                      data: Object.values(summary.maintenance.byType || {}),
                      backgroundColor: ['#63b3ed', '#68d391', '#f6ad55', '#fc8181', '#b794f4'],
                      borderColor: isDark ? '#1e2d45' : '#ffffff',
                      borderWidth: 2
                    }]
                  }}
                  options={chartOptions}
                />
              </div>
            </div>
          </div>

          <div style={styles.chartCard}>
            <h3 style={styles.chartTitle}>{t.maintenanceRequests}</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>{t.requestId}</th>
                    <th style={styles.th}>{t.title}</th>
                    <th style={styles.th}>{t.asset}</th>
                    <th style={styles.th}>{t.status}</th>
                    <th style={styles.th}>{t.priority}</th>
                    <th style={styles.th}>{t.type}</th>
                    <th style={styles.th}>{t.created}</th>
                  </tr>
                </thead>
                <tbody>
                  {getFilteredMaintenance.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={{ ...styles.td, textAlign: 'center', padding: '30px' }}>
                        {t.noMaintenance}
                      </td>
                    </tr>
                  ) : (
                    getFilteredMaintenance.slice(0, 50).map(m => (
                      <tr key={m.id}>
                        <td style={styles.td}>{m.request_number || '-'}</td>
                        <td style={styles.td}>{m.title}</td>
                        <td style={styles.td}>{m.asset_name || '-'}</td>
                        <td style={styles.td}>
                          <span style={styles.statusBadge(m.status)}>
                            {m.status}
                          </span>
                        </td>
                        <td style={styles.td}>
                          <span style={styles.statusBadge(m.priority)}>
                            {m.priority}
                          </span>
                        </td>
                        <td style={styles.td}>{m.type || '-'}</td>
                        <td style={styles.td}>{new Date(m.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              {getFilteredMaintenance.length > 50 && (
                <div style={{ textAlign: 'center', padding: '12px', color: isDark ? '#8896b0' : '#4a5568' }}>
                  {t.showingFirst} 50 {t.of} {getFilteredMaintenance.length}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Staff Reports */}
      {activeTab === 'staff' && (
        <div>
          <div style={styles.statsGrid}>
            <div style={styles.statCard}>
              <div style={styles.statNumber}>{summary.staff.totalStaff || 0}</div>
              <div style={styles.statLabel}>{t.totalStaff}</div>
            </div>
            <div style={styles.statCard}>
              <div style={{ ...styles.statNumber, color: '#48bb78' }}>{summary.staff.staffWithAssets || 0}</div>
              <div style={styles.statLabel}>{t.withAssets}</div>
            </div>
            <div style={styles.statCard}>
              <div style={{ ...styles.statNumber, color: '#ed8936' }}>{summary.staff.staffWithoutAssets || 0}</div>
              <div style={styles.statLabel}>{t.withoutAssets}</div>
            </div>
          </div>

          <div style={styles.chartCard}>
            <h3 style={styles.chartTitle}>{t.staffByRole}</h3>
            <div style={{ height: '250px' }}>
              <Bar 
                data={{
                  labels: Object.keys(summary.staff.byRole || {}),
                  datasets: [{
                    label: t.staffByRole,
                    data: Object.values(summary.staff.byRole || {}),
                    backgroundColor: ['#63b3ed', '#68d391', '#f6ad55', '#fc8181', '#b794f4'],
                    borderColor: isDark ? '#1e2d45' : '#ffffff',
                    borderWidth: 2
                  }]
                }}
                options={chartOptions}
              />
            </div>
          </div>

          <div style={styles.chartCard}>
            <h3 style={styles.chartTitle}>{t.staffSummary}</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>{t.employee}</th>
                    <th style={styles.th}>{t.role}</th>
                    <th style={styles.th}>{t.email}</th>
                    <th style={styles.th}>{t.assignedAssets}</th>
                    <th style={styles.th}>{t.status}</th>
                  </tr>
                </thead>
                <tbody>
                  {getFilteredStaff.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ ...styles.td, textAlign: 'center', padding: '30px' }}>
                        {t.noStaff}
                      </td>
                    </tr>
                  ) : (
                    getFilteredStaff.map(s => (
                      <tr key={s.id}>
                        <td style={styles.td}>{s.fullName}</td>
                        <td style={styles.td}>{s.role || '-'}</td>
                        <td style={styles.td}>{s.email || '-'}</td>
                        <td style={styles.td}>{s.assigned_assets || 0}</td>
                        <td style={styles.td}>
                          <span style={styles.statusBadge(s.active ? 'Active' : 'Inactive')}>
                            {s.active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Approvals Reports */}
      {activeTab === 'approvals' && (
        <div>
          <div style={styles.statsGrid}>
            <div style={styles.statCard}>
              <div style={styles.statNumber}>{summary.approvals.totalApprovals || 0}</div>
              <div style={styles.statLabel}>{t.totalApprovals}</div>
            </div>
            <div style={styles.statCard}>
              <div style={{ ...styles.statNumber, color: '#ed8936' }}>{summary.approvals.pendingApprovals || 0}</div>
              <div style={styles.statLabel}>{t.pending}</div>
            </div>
            <div style={styles.statCard}>
              <div style={{ ...styles.statNumber, color: '#48bb78' }}>{summary.approvals.approvedApprovals || 0}</div>
              <div style={styles.statLabel}>{t.approved}</div>
            </div>
            <div style={styles.statCard}>
              <div style={{ ...styles.statNumber, color: '#fc8181' }}>{summary.approvals.rejectedApprovals || 0}</div>
              <div style={styles.statLabel}>{t.rejected}</div>
            </div>
          </div>

          <div style={styles.chartCard}>
            <h3 style={styles.chartTitle}>{t.approvalsByType}</h3>
            <div style={{ height: '250px' }}>
              <Doughnut 
                data={{
                  labels: Object.keys(summary.approvals.byType || {}),
                  datasets: [{
                    data: Object.values(summary.approvals.byType || {}),
                    backgroundColor: ['#63b3ed', '#68d391', '#f6ad55', '#fc8181', '#b794f4', '#81e6d9'],
                    borderColor: isDark ? '#1e2d45' : '#ffffff',
                    borderWidth: 2
                  }]
                }}
                options={chartOptions}
              />
            </div>
          </div>

          <div style={styles.chartCard}>
            <h3 style={styles.chartTitle}>{t.approvalHistory}</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>{t.requestId}</th>
                    <th style={styles.th}>{t.type}</th>
                    <th style={styles.th}>{t.requestedBy}</th>
                    <th style={styles.th}>{t.status}</th>
                    <th style={styles.th}>{t.created}</th>
                    <th style={styles.th}>{t.decision}</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.approvals.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ ...styles.td, textAlign: 'center', padding: '30px' }}>
                        {t.noApprovals}
                      </td>
                    </tr>
                  ) : (
                    reportData.approvals.slice(0, 50).map(a => (
                      <tr key={a.id}>
                        <td style={styles.td}>{a.request_id || '-'}</td>
                        <td style={styles.td}>{a.type || '-'}</td>
                        <td style={styles.td}>{a.requested_by || '-'}</td>
                        <td style={styles.td}>
                          <span style={styles.statusBadge(a.status)}>
                            {a.status}
                          </span>
                        </td>
                        <td style={styles.td}>{new Date(a.created_at).toLocaleDateString()}</td>
                        <td style={styles.td}>
                          {a.approved_by ? `✅ ${a.approved_by}` : 
                           a.rejected_by ? `❌ ${a.rejected_by}` : '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              {reportData.approvals.length > 50 && (
                <div style={{ textAlign: 'center', padding: '12px', color: isDark ? '#8896b0' : '#4a5568' }}>
                  {t.showingFirst} 50 {t.of} {reportData.approvals.length}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Translations
const englishTranslations = {
  reports: 'Department Reports',
  reportsFor: 'Reports for',
  exportExcel: 'Export to Excel',
  exportPDF: 'Export to PDF',
  print: 'Print',
  loading: 'Loading...',
  totalAssets: 'Total Assets',
  inUse: 'In Use',
  available: 'Available',
  underMaintenance: 'Under Maintenance',
  pending: 'Pending',
  inProgress: 'In Progress',
  completed: 'Completed',
  totalValue: 'Total Value',
  maintenanceCost: 'Maintenance Cost',
  assetSummary: 'Asset Summary',
  noAssets: 'No assets found',
  showingFirst: 'Showing first',
  of: 'of',
  assetTag: 'Asset Tag',
  name: 'Name',
  category: 'Category',
  status: 'Status',
  location: 'Location',
  assignedTo: 'Assigned To',
  value: 'Value',
  totalMaintenance: 'Total Maintenance',
  fetchError: 'Failed to load data',
  exportSuccess: 'Exported successfully',
  assets: 'Assets',
  maintenance: 'Maintenance',
  staff: 'Staff',
  approvals: 'Approvals',
  dateFrom: 'Date From',
  dateTo: 'Date To',
  employee: 'Employee',
  allCategories: 'All Categories',
  allEmployees: 'All Employees',
  allLocations: 'All Locations',
  allStatuses: 'All Statuses',
  clearFilters: 'Clear Filters',
  utilizationRate: 'Utilization Rate',
  assetsByCategory: 'Assets by Category',
  assetsByLocation: 'Assets by Location',
  disposed: 'Disposed',
  maintenanceByPriority: 'Maintenance by Priority',
  maintenanceByType: 'Maintenance by Type',
  maintenanceRequests: 'Maintenance Requests',
  requestId: 'Request ID',
  title: 'Title',
  asset: 'Asset',
  priority: 'Priority',
  type: 'Type',
  created: 'Created',
  noMaintenance: 'No maintenance records found',
  totalStaff: 'Total Staff',
  withAssets: 'With Assets',
  withoutAssets: 'Without Assets',
  staffByRole: 'Staff by Role',
  staffSummary: 'Staff Summary',
  role: 'Role',
  email: 'Email',
  assignedAssets: 'Assigned Assets',
  noStaff: 'No staff found',
  totalApprovals: 'Total Approvals',
  approved: 'Approved',
  rejected: 'Rejected',
  approvalsByType: 'Approvals by Type',
  approvalHistory: 'Approval History',
  requestedBy: 'Requested By',
  decision: 'Decision',
  noApprovals: 'No approval records found',
  maintenanceStatus: 'Maintenance Status',
  assetStatus: 'Asset Status',
  requestStatus: 'Request Status'
};

const amharicTranslations = {
  reports: 'የክፍል ሪፖርቶች',
  reportsFor: 'ሪፖርቶች ለ',
  exportExcel: 'ወደ Excel ላክ',
  exportPDF: 'ወደ PDF ላክ',
  print: 'አትም',
  loading: 'በመጫን ላይ...',
  totalAssets: 'ጠቅላላ ንብረቶች',
  inUse: 'በመጠቀም ላይ',
  available: 'ይገኛል',
  underMaintenance: 'በጥገና ላይ',
  pending: 'በመጠባበቅ ላይ',
  inProgress: 'በሂደት ላይ',
  completed: 'ተጠናቋል',
  totalValue: 'ጠቅላላ ዋጋ',
  maintenanceCost: 'የጥገና ዋጋ',
  assetSummary: 'የንብረት ማጠቃለያ',
  noAssets: 'ምንም ንብረቶች አልተገኙም',
  showingFirst: 'የመጀመሪያዎቹን',
  of: 'ከ',
  assetTag: 'የንብረት መለያ',
  name: 'ስም',
  category: 'ምድብ',
  status: 'ሁኔታ',
  location: 'አካባቢ',
  assignedTo: 'ተመድቧል',
  value: 'ዋጋ',
  totalMaintenance: 'ጠቅላላ ጥገና',
  fetchError: 'ውሂብ ማግኘት አልተቻለም',
  exportSuccess: 'በተሳካ ሁኔታ ተላከ',
  assets: 'ንብረቶች',
  maintenance: 'ጥገና',
  staff: 'ሰራተኞች',
  approvals: 'ማጽደቂያዎች',
  dateFrom: 'ከቀን',
  dateTo: 'እስከ ቀን',
  employee: 'ሰራተኛ',
  allCategories: 'ሁሉም ምድቦች',
  allEmployees: 'ሁሉም ሰራተኞች',
  allLocations: 'ሁሉም አካባቢዎች',
  allStatuses: 'ሁሉም ሁኔታዎች',
  clearFilters: 'ማጣሪያ አጽዳ',
  utilizationRate: 'የአጠቃቀም መጠን',
  assetsByCategory: 'ንብረቶች በምድብ',
  assetsByLocation: 'ንብረቶች በአካባቢ',
  disposed: 'የተወገዱ',
  maintenanceByPriority: 'ጥገና በቅድሚያ',
  maintenanceByType: 'ጥገና በአይነት',
  maintenanceRequests: 'የጥገና ጥያቄዎች',
  requestId: 'የጥያቄ መለያ',
  title: 'ርዕስ',
  asset: 'ንብረት',
  priority: 'ቅድሚያ',
  type: 'አይነት',
  created: 'ተፈጥሯል',
  noMaintenance: 'ምንም የጥገና መዝገቦች አልተገኙም',
  totalStaff: 'ጠቅላላ ሰራተኞች',
  withAssets: 'ከንብረት ጋር',
  withoutAssets: 'ያለ ንብረት',
  staffByRole: 'ሰራተኞች በሚና',
  staffSummary: 'የሰራተኞች ማጠቃለያ',
  role: 'ሚና',
  email: 'ኢሜይል',
  assignedAssets: 'የተመደቡ ንብረቶች',
  noStaff: 'ምንም ሰራተኞች አልተገኙም',
  totalApprovals: 'ጠቅላላ ማጽደቂያዎች',
  approved: 'ጸድቋል',
  rejected: 'ውድቅ ተደርጓል',
  approvalsByType: 'ማጽደቂያዎች በአይነት',
  approvalHistory: 'የማጽደቂያ ታሪክ',
  requestedBy: 'የጠየቀው',
  decision: 'ውሳኔ',
  noApprovals: 'ምንም የማጽደቂያ መዝገቦች አልተገኙም',
  maintenanceStatus: 'የጥገና ሁኔታ',
  assetStatus: 'የንብረት ሁኔታ',
  requestStatus: 'የጥያቄ ሁኔታ'
};

export default DeptReports;