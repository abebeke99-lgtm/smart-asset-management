import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useLanguage } from '../../contexts/UiContext';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import axios from 'axios';
import { Bar, Line, Doughnut, Pie } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, PointElement, LineElement, Filler } from 'chart.js';
import { getDepartmentLabel } from '../../utils/department';

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
const StoreReports = () => {
  const { language, theme } = useLanguage();
  const printRef = useRef();
  
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('inventory');
  const [reportData, setReportData] = useState({
    assets: [],
    transactions: [],
    assignments: [],
    departments: [],
    employees: []
  });
  
  const [summary, setSummary] = useState({
    inventory: {},
    transactions: {},
    departments: {},
    employees: {}
  });

  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    department: '',
    employee: '',
    category: '',
    location: '',
    condition: '',
    transactionType: '',
    assetStatus: ''
  });

  const isDark = theme === 'dark';
  const t = language === 'en' ? englishTranslations : amharicTranslations;

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const [assetsRes, transRes, assignRes, deptRes, empRes] = await Promise.all([
        axios.get('/api/assets', { params: { limit: 1000 } }),
        axios.get('/api/transactions', { params: { limit: 500 } }),
        axios.get('/api/assignments', { params: { limit: 500 } }),
        axios.get('/api/departments'),
        axios.get('/api/users', { params: { limit: 200 } })
      ]);

      const assets = assetsRes.data?.assets || assetsRes.data?.data || [];
      const transactions = transRes.data?.transactions || [];
      const assignments = assignRes.data?.assignments || [];
      const departments = deptRes.data?.departments || [];
      const employees = empRes.data?.users || [];

      setReportData({ assets, transactions, assignments, departments, employees });
      calculateSummary(assets, transactions, assignments, departments, employees);
    } catch (error) {
      toast.error(t.fetchError || 'Failed to load report data');
      setReportData({ 
        assets: [],
        transactions: [],
        assignments: [],
        departments: [],
        employees: []
      });
      calculateSummary([], [], [], [], []);
    }
    setLoading(false);
  };

  const calculateSummary = (assets, transactions, assignments, departments, employees) => {
    const totalAssets = assets.length;
    const available = assets.filter(a => a.status === 'Available').length;
    const issued = assets.filter(a => a.status === 'Issued').length;
    const reserved = assets.filter(a => a.status === 'Reserved').length;
    const returned = assets.filter(a => a.status === 'Returned').length;
    const damaged = assets.filter(a => a.status === 'Damaged' || a.condition === 'Damaged').length;
    const lowStock = assets.filter(a => a.is_low_stock || (a.available_quantity && a.available_quantity < 5)).length;
    const totalValue = assets.reduce((sum, a) => sum + (a.current_value || 0), 0);

    const byCategory = assets.reduce((acc, a) => {
      const cat = a.category || 'Other';
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    }, {});

    const byDepartment = assets.reduce((acc, a) => {
      const dept = getDepartmentLabel(a.department) || 'Other';
      acc[dept] = (acc[dept] || 0) + 1;
      return acc;
    }, {});

    const byLocation = assets.reduce((acc, a) => {
      const loc = a.location || 'Unknown';
      acc[loc] = (acc[loc] || 0) + 1;
      return acc;
    }, {});

    // Transaction summary
    const receipts = transactions.filter(t => t.type === 'Receipt').length;
    const issues = transactions.filter(t => t.type === 'Issue').length;
    const returns = transactions.filter(t => t.type === 'Return').length;
    const transfers = transactions.filter(t => t.type === 'Transfer').length;
    const damages = transactions.filter(t => t.type === 'Damage').length;
    const totalTransactionValue = transactions.reduce((sum, t) => sum + (t.value || 0), 0);

    // Department summary
    const deptSummary = departments
      .map(getDepartmentLabel)
      .filter(Boolean)
      .map(dept => {
      const deptAssets = assets.filter(a => getDepartmentLabel(a.department) === dept);
      const deptIssued = deptAssets.filter(a => a.status === 'Issued').length;
      const deptReturned = deptAssets.filter(a => a.status === 'Returned').length;
      const deptPending = deptAssets.filter(a => a.status === 'Reserved').length;
      return {
        name: dept,
        total: deptAssets.length,
        issued: deptIssued,
        returned: deptReturned,
        pending: deptPending
      };
      });

    // Employee summary
    const empSummary = employees.map(emp => ({
      name: emp.full_name,
      assigned: emp.assigned_assets || 0,
      returned: emp.returned_assets || 0,
      outstanding: emp.outstanding_assets || 0
    }));

    setSummary({
      inventory: {
        totalAssets,
        available,
        issued,
        reserved,
        returned,
        damaged,
        lowStock,
        totalValue,
        byCategory,
        byDepartment,
        byLocation
      },
      transactions: {
        receipts,
        issues,
        returns,
        transfers,
        damages,
        total: transactions.length,
        totalValue: totalTransactionValue
      },
      departments: deptSummary,
      employees: empSummary
    });
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      dateFrom: '',
      dateTo: '',
      department: '',
      employee: '',
      category: '',
      location: '',
      condition: '',
      transactionType: '',
      assetStatus: ''
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
    if (filters.department) {
      result = result.filter(a => getDepartmentLabel(a.department) === filters.department);
    }
    if (filters.category) {
      result = result.filter(a => a.category === filters.category);
    }
    if (filters.location) {
      result = result.filter(a => a.location === filters.location);
    }
    if (filters.condition) {
      result = result.filter(a => a.condition === filters.condition);
    }
    if (filters.assetStatus) {
      result = result.filter(a => a.status === filters.assetStatus);
    }
    if (filters.employee) {
      result = result.filter(a => a.assigned_to === filters.employee);
    }
    
    return result;
  }, [reportData.assets, filters]);

  const getFilteredTransactions = useMemo(() => {
    let result = reportData.transactions;
    
    if (filters.dateFrom) {
      result = result.filter(t => new Date(t.date) >= new Date(filters.dateFrom));
    }
    if (filters.dateTo) {
      result = result.filter(t => new Date(t.date) <= new Date(filters.dateTo));
    }
    if (filters.department) {
      result = result.filter(t => getDepartmentLabel(t.department) === filters.department);
    }
    if (filters.transactionType) {
      result = result.filter(t => t.type === filters.transactionType);
    }
    if (filters.employee) {
      result = result.filter(t => t.user === filters.employee);
    }
    
    return result;
  }, [reportData.transactions, filters]);

  const exportToPDF = () => {
    const doc = new jsPDF('landscape', 'mm', 'a4');
    
    doc.setFontSize(18);
    doc.setTextColor(isDark ? '#c8dcf5' : '#1a365d');
    doc.text(`${t.reports} - Store Report`, 14, 20);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);
    doc.text(`Report Type: ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}`, 14, 34);

    let tableData = [];
    let headers = [];

    if (activeTab === 'inventory') {
      headers = ['Asset Tag', 'Name', 'Category', 'Status', 'Location', 'Condition', 'Value'];
      tableData = getFilteredAssets.slice(0, 50).map(a => [
        a.asset_tag || '',
        a.name || '',
        a.category || '',
        a.status || '',
        a.location || '',
        a.condition || '',
        a.current_value ? `$${a.current_value.toLocaleString()}` : '$0'
      ]);
    } else if (activeTab === 'transactions') {
      headers = ['Transaction ID', 'Type', 'Item', 'Quantity', 'User', 'Department', 'Date', 'Value'];
      tableData = getFilteredTransactions.slice(0, 50).map(t => [
        t.transaction_id || '',
        t.type || '',
        t.item_name || '',
        t.quantity || 0,
        t.user || '',
        t.department || '',
        new Date(t.date).toLocaleDateString() || '',
        t.value ? `$${t.value.toLocaleString()}` : '$0'
      ]);
    } else if (activeTab === 'departments') {
      headers = ['Department', 'Total Assets', 'Issued', 'Returned', 'Pending'];
      tableData = summary.departments.map(d => [
        d.name || '',
        d.total || 0,
        d.issued || 0,
        d.returned || 0,
        d.pending || 0
      ]);
    } else if (activeTab === 'employees') {
      headers = ['Employee', 'Department', 'Assigned', 'Returned', 'Outstanding'];
      tableData = summary.employees.map(e => [
        e.name || '',
        e.department || '',
        e.assigned || 0,
        e.returned || 0,
        e.outstanding || 0
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

    doc.save('store_report.pdf');
    toast.success(t.exportSuccess || 'PDF exported successfully');
  };

  const exportToExcel = () => {
    let data = [];

    if (activeTab === 'inventory') {
      data = getFilteredAssets.map(a => ({
        'Asset Tag': a.asset_tag || '',
        'Name': a.name || '',
        'Category': a.category || '',
        'Status': a.status || '',
        'Location': a.location || '',
        'Condition': a.condition || '',
        'Quantity': a.quantity || 0,
        'Available': a.available_quantity || 0,
        'Value': a.current_value || 0,
        'Department': getDepartmentLabel(a.department),
        'Assigned To': a.assigned_to || ''
      }));
    } else if (activeTab === 'transactions') {
      data = getFilteredTransactions.map(t => ({
        'Transaction ID': t.transaction_id || '',
        'Type': t.type || '',
        'Item': t.item_name || '',
        'Quantity': t.quantity || 0,
        'User': t.user || '',
        'Department': t.department || '',
        'From': t.from_location || '',
        'To': t.to_location || '',
        'Status': t.status || '',
        'Date': new Date(t.date).toLocaleDateString() || '',
        'Value': t.value || 0,
        'Notes': t.notes || ''
      }));
    } else if (activeTab === 'departments') {
      data = summary.departments.map(d => ({
        'Department': d.name || '',
        'Total Assets': d.total || 0,
        'Issued': d.issued || 0,
        'Returned': d.returned || 0,
        'Pending': d.pending || 0
      }));
    } else if (activeTab === 'employees') {
      data = summary.employees.map(e => ({
        'Employee': e.name || '',
        'Department': e.department || '',
        'Assigned Assets': e.assigned || 0,
        'Returned Assets': e.returned || 0,
        'Outstanding Assets': e.outstanding || 0
      }));
    }

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, activeTab.charAt(0).toUpperCase() + activeTab.slice(1));
    XLSX.writeFile(wb, `store_report_${activeTab}.xlsx`);
    toast.success(t.exportSuccess || 'Excel exported successfully');
  };

  const handlePrint = () => {
    window.print();
  };

  const getStatusColor = (status) => {
    const colors = {
      'Available': '#48bb78',
      'Issued': '#4299e1',
      'Reserved': '#805ad5',
      'Returned': '#38a169',
      'Damaged': '#fc8181',
      'Under Repair': '#ed8936',
      'Completed': '#48bb78',
      'Pending': '#f6ad55',
      'Cancelled': '#a0aec0',
      'Active': '#48bb78',
      'Overdue': '#fc8181'
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

  const statusChartData = {
    labels: ['Available', 'Issued', 'Reserved', 'Returned', 'Damaged', 'Under Repair'],
    datasets: [{
      label: 'Inventory Status',
      data: [
        summary.inventory.available || 0,
        summary.inventory.issued || 0,
        summary.inventory.reserved || 0,
        summary.inventory.returned || 0,
        summary.inventory.damaged || 0,
        summary.inventory.underRepair || 0
      ],
      backgroundColor: ['#48bb78', '#4299e1', '#805ad5', '#38a169', '#fc8181', '#ed8936'],
      borderColor: isDark ? '#1e2d45' : '#ffffff',
      borderWidth: 2
    }]
  };

  const categoryChartData = {
    labels: Object.keys(summary.inventory.byCategory || {}),
    datasets: [{
      label: 'Assets by Category',
      data: Object.values(summary.inventory.byCategory || {}),
      backgroundColor: ['#63b3ed', '#68d391', '#f6ad55', '#fc8181', '#b794f4', '#81e6d9', '#f687b3'],
      borderColor: isDark ? '#1e2d45' : '#ffffff',
      borderWidth: 2
    }]
  };

  const deptChartData = {
    labels: Object.keys(summary.inventory.byDepartment || {}),
    datasets: [{
      label: 'Assets by Department',
      data: Object.values(summary.inventory.byDepartment || {}),
      backgroundColor: ['#48bb78', '#4299e1', '#ed8936', '#fc8181', '#805ad5', '#81e6d9'],
      borderColor: isDark ? '#1e2d45' : '#ffffff',
      borderWidth: 2
    }]
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
      gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
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
    { id: 'inventory', label: '📦 ' + t.inventory },
    { id: 'transactions', label: '🔄 ' + t.transactions },
    { id: 'departments', label: '🏢 ' + t.departments },
    { id: 'employees', label: '👤 ' + t.employees }
  ];

  // Get unique filter options
  const uniqueCategories = useMemo(() => 
    [...new Set(reportData.assets.map(a => a.category).filter(Boolean))], 
    [reportData.assets]
  );
  const uniqueLocations = useMemo(() => 
    [...new Set(reportData.assets.map(a => a.location).filter(Boolean))], 
    [reportData.assets]
  );
  const uniqueDepartments = useMemo(() => 
    [...new Set(reportData.assets.map(a => getDepartmentLabel(a.department)).filter(Boolean))], 
    [reportData.assets]
  );
  const uniqueEmployees = useMemo(() => 
    [...new Set(reportData.assets.map(a => a.assigned_to).filter(Boolean))], 
    [reportData.assets]
  );
  const uniqueTransactionTypes = useMemo(() => 
    [...new Set(reportData.transactions.map(t => t.type).filter(Boolean))], 
    [reportData.transactions]
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
          <p style={styles.subtitle}>{t.storeReport}</p>
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
        <div style={styles.filterGroup}>
          <span style={styles.filterLabel}>{t.department}</span>
          <select
            style={styles.filterSelect}
            value={filters.department}
            onChange={(e) => handleFilterChange('department', e.target.value)}
          >
            <option value="">{t.allDepartments}</option>
            {uniqueDepartments.map(dept => (
              <option key={dept} value={dept}>{dept}</option>
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
        {activeTab === 'inventory' && (
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
              <span style={styles.filterLabel}>{t.condition}</span>
              <select
                style={styles.filterSelect}
                value={filters.condition}
                onChange={(e) => handleFilterChange('condition', e.target.value)}
              >
                <option value="">{t.allConditions}</option>
                <option value="New">New</option>
                <option value="Good">Good</option>
                <option value="Fair">Fair</option>
                <option value="Poor">Poor</option>
                <option value="Damaged">Damaged</option>
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
                <option value="Available">Available</option>
                <option value="Issued">Issued</option>
                <option value="Reserved">Reserved</option>
                <option value="Returned">Returned</option>
                <option value="Damaged">Damaged</option>
                <option value="Under Repair">Under Repair</option>
              </select>
            </div>
          </>
        )}
        {activeTab === 'transactions' && (
          <div style={styles.filterGroup}>
            <span style={styles.filterLabel}>{t.transactionType}</span>
            <select
              style={styles.filterSelect}
              value={filters.transactionType}
              onChange={(e) => handleFilterChange('transactionType', e.target.value)}
            >
              <option value="">{t.allTypes}</option>
              {uniqueTransactionTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
        )}
        <button style={styles.clearFiltersButton} onClick={clearFilters}>
          ✕ {t.clearFilters}
        </button>
      </div>

      {/* Inventory Tab */}
      {activeTab === 'inventory' && (
        <div>
          <div style={styles.statsGrid}>
            <div style={styles.statCard}>
              <div style={styles.statNumber}>{summary.inventory.totalAssets || 0}</div>
              <div style={styles.statLabel}>{t.totalAssets}</div>
            </div>
            <div style={styles.statCard}>
              <div style={{ ...styles.statNumber, color: '#48bb78' }}>{summary.inventory.available || 0}</div>
              <div style={styles.statLabel}>{t.available}</div>
            </div>
            <div style={styles.statCard}>
              <div style={{ ...styles.statNumber, color: '#4299e1' }}>{summary.inventory.issued || 0}</div>
              <div style={styles.statLabel}>{t.issued}</div>
            </div>
            <div style={styles.statCard}>
              <div style={{ ...styles.statNumber, color: '#805ad5' }}>{summary.inventory.reserved || 0}</div>
              <div style={styles.statLabel}>{t.reserved}</div>
            </div>
            <div style={styles.statCard}>
              <div style={{ ...styles.statNumber, color: '#38a169' }}>{summary.inventory.returned || 0}</div>
              <div style={styles.statLabel}>{t.returned}</div>
            </div>
            <div style={styles.statCard}>
              <div style={{ ...styles.statNumber, color: '#fc8181' }}>{summary.inventory.damaged || 0}</div>
              <div style={styles.statLabel}>{t.damaged}</div>
            </div>
            <div style={styles.statCard}>
              <div style={{ ...styles.statNumber, color: '#ed8936' }}>{summary.inventory.lowStock || 0}</div>
              <div style={styles.statLabel}>{t.lowStock}</div>
            </div>
            <div style={styles.statCard}>
              <div style={{ ...styles.statNumber, color: '#38a169' }}>
                ${(summary.inventory.totalValue || 0).toLocaleString()}
              </div>
              <div style={styles.statLabel}>{t.totalValue}</div>
            </div>
          </div>

          <div style={styles.chartsRow}>
            <div style={styles.chartCard}>
              <h3 style={styles.chartTitle}>{t.inventoryStatus}</h3>
              <div style={{ height: '240px' }}>
                <Doughnut data={statusChartData} options={chartOptions} />
              </div>
            </div>
            <div style={styles.chartCard}>
              <h3 style={styles.chartTitle}>{t.assetsByCategory}</h3>
              <div style={{ height: '240px' }}>
                <Pie data={categoryChartData} options={chartOptions} />
              </div>
            </div>
          </div>

          <div style={styles.chartCard}>
            <h3 style={styles.chartTitle}>{t.assetsByDepartment}</h3>
            <div style={{ height: '240px' }}>
              <Bar data={deptChartData} options={chartOptions} />
            </div>
          </div>

          <div style={styles.chartCard}>
            <h3 style={styles.chartTitle}>{t.inventoryList}</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>{t.assetTag}</th>
                    <th style={styles.th}>{t.name}</th>
                    <th style={styles.th}>{t.category}</th>
                    <th style={styles.th}>{t.status}</th>
                    <th style={styles.th}>{t.location}</th>
                    <th style={styles.th}>{t.condition}</th>
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
                        <td style={styles.td}>{asset.category || '-'}</td>
                        <td style={styles.td}>
                          <span style={styles.statusBadge(asset.status)}>
                            {asset.status}
                          </span>
                        </td>
                        <td style={styles.td}>{asset.location || '-'}</td>
                        <td style={styles.td}>{asset.condition || '-'}</td>
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

      {/* Transactions Tab */}
      {activeTab === 'transactions' && (
        <div>
          <div style={styles.statsGrid}>
            <div style={styles.statCard}>
              <div style={styles.statNumber}>{summary.transactions.receipts || 0}</div>
              <div style={styles.statLabel}>{t.receipts}</div>
            </div>
            <div style={styles.statCard}>
              <div style={{ ...styles.statNumber, color: '#4299e1' }}>{summary.transactions.issues || 0}</div>
              <div style={styles.statLabel}>{t.issues}</div>
            </div>
            <div style={styles.statCard}>
              <div style={{ ...styles.statNumber, color: '#38a169' }}>{summary.transactions.returns || 0}</div>
              <div style={styles.statLabel}>{t.returns}</div>
            </div>
            <div style={styles.statCard}>
              <div style={{ ...styles.statNumber, color: '#805ad5' }}>{summary.transactions.transfers || 0}</div>
              <div style={styles.statLabel}>{t.transfers}</div>
            </div>
            <div style={styles.statCard}>
              <div style={{ ...styles.statNumber, color: '#fc8181' }}>{summary.transactions.damages || 0}</div>
              <div style={styles.statLabel}>{t.damages}</div>
            </div>
            <div style={styles.statCard}>
              <div style={{ ...styles.statNumber, color: '#38a169' }}>
                ${(summary.transactions.totalValue || 0).toLocaleString()}
              </div>
              <div style={styles.statLabel}>{t.totalValue}</div>
            </div>
          </div>

          <div style={styles.chartCard}>
            <h3 style={styles.chartTitle}>{t.transactionSummary}</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>{t.transactionId}</th>
                    <th style={styles.th}>{t.type}</th>
                    <th style={styles.th}>{t.item}</th>
                    <th style={styles.th}>{t.quantity}</th>
                    <th style={styles.th}>{t.user}</th>
                    <th style={styles.th}>{t.department}</th>
                    <th style={styles.th}>{t.status}</th>
                    <th style={styles.th}>{t.date}</th>
                    <th style={styles.th}>{t.value}</th>
                  </tr>
                </thead>
                <tbody>
                  {getFilteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan="9" style={{ ...styles.td, textAlign: 'center', padding: '30px' }}>
                        {t.noTransactions}
                      </td>
                    </tr>
                  ) : (
                    getFilteredTransactions.slice(0, 50).map(trans => (
                      <tr key={trans.id}>
                        <td style={styles.td}>
                          <span style={styles.assetTag}>{trans.transaction_id}</span>
                        </td>
                        <td style={styles.td}>{trans.type}</td>
                        <td style={styles.td}>{trans.item_name}</td>
                        <td style={styles.td}>{trans.quantity}</td>
                        <td style={styles.td}>{trans.user}</td>
                        <td style={styles.td}>{getDepartmentLabel(trans.department) || '-'}</td>
                        <td style={styles.td}>
                          <span style={styles.statusBadge(trans.status)}>
                            {trans.status}
                          </span>
                        </td>
                        <td style={styles.td}>{new Date(trans.date).toLocaleDateString()}</td>
                        <td style={styles.td}>${(trans.value || 0).toLocaleString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              {getFilteredTransactions.length > 50 && (
                <div style={{ textAlign: 'center', padding: '12px', color: isDark ? '#8896b0' : '#4a5568' }}>
                  {t.showingFirst} 50 {t.of} {getFilteredTransactions.length}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Departments Tab */}
      {activeTab === 'departments' && (
        <div>
          <div style={styles.chartCard}>
            <h3 style={styles.chartTitle}>{t.departmentSummary}</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>{t.department}</th>
                    <th style={styles.th}>{t.totalAssets}</th>
                    <th style={styles.th}>{t.issued}</th>
                    <th style={styles.th}>{t.returned}</th>
                    <th style={styles.th}>{t.pending}</th>
                    <th style={styles.th}>{t.utilization}</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.departments.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ ...styles.td, textAlign: 'center', padding: '30px' }}>
                        {t.noDepartments}
                      </td>
                    </tr>
                  ) : (
                    summary.departments.map(dept => (
                      <tr key={dept.name}>
                        <td style={styles.td}><strong>{dept.name}</strong></td>
                        <td style={styles.td}>{dept.total}</td>
                        <td style={styles.td}>{dept.issued}</td>
                        <td style={styles.td}>{dept.returned}</td>
                        <td style={styles.td}>{dept.pending}</td>
                        <td style={styles.td}>
                          {dept.total > 0 ? ((dept.issued / dept.total) * 100).toFixed(1) : 0}%
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

      {/* Employees Tab */}
      {activeTab === 'employees' && (
        <div>
          <div style={styles.chartCard}>
            <h3 style={styles.chartTitle}>{t.employeeSummary}</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>{t.employee}</th>
                    <th style={styles.th}>{t.department}</th>
                    <th style={styles.th}>{t.assignedAssets}</th>
                    <th style={styles.th}>{t.returnedAssets}</th>
                    <th style={styles.th}>{t.outstandingAssets}</th>
                    <th style={styles.th}>{t.status}</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.employees.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ ...styles.td, textAlign: 'center', padding: '30px' }}>
                        {t.noEmployees}
                      </td>
                    </tr>
                  ) : (
                    summary.employees.map(emp => (
                      <tr key={emp.name}>
                        <td style={styles.td}><strong>{emp.name}</strong></td>
                        <td style={styles.td}>{emp.department || '-'}</td>
                        <td style={styles.td}>{emp.assigned || 0}</td>
                        <td style={styles.td}>{emp.returned || 0}</td>
                        <td style={styles.td}>
                          <span style={{ color: (emp.outstanding || 0) > 0 ? '#ed8936' : '#48bb78' }}>
                            {emp.outstanding || 0}
                          </span>
                        </td>
                        <td style={styles.td}>
                          <span style={styles.statusBadge((emp.outstanding || 0) > 0 ? 'Active' : 'Returned')}>
                            {(emp.outstanding || 0) > 0 ? 'Active' : 'Returned'}
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
    </div>
  );
};

// Translations
const englishTranslations = {
  reports: 'Store Reports',
  storeReport: 'Complete inventory and movement report',
  exportExcel: 'Export to Excel',
  exportPDF: 'Export to PDF',
  print: 'Print',
  loading: 'Loading...',
  totalAssets: 'Total Assets',
  available: 'Available',
  issued: 'Issued',
  reserved: 'Reserved',
  returned: 'Returned',
  damaged: 'Damaged',
  lowStock: 'Low Stock',
  totalValue: 'Total Value',
  showingFirst: 'Showing first',
  of: 'of',
  assetTag: 'Asset Tag',
  name: 'Name',
  category: 'Category',
  status: 'Status',
  location: 'Location',
  condition: 'Condition',
  value: 'Value',
  fetchError: 'Failed to load report data',
  exportSuccess: 'Exported successfully',
  
  // Tabs
  inventory: 'Inventory',
  transactions: 'Transactions',
  departments: 'Departments',
  employees: 'Employees',
  
  // Filters
  dateFrom: 'Date From',
  dateTo: 'Date To',
  department: 'Department',
  employee: 'Employee',
  allDepartments: 'All Departments',
  allEmployees: 'All Employees',
  allCategories: 'All Categories',
  allLocations: 'All Locations',
  allConditions: 'All Conditions',
  allStatuses: 'All Statuses',
  allTypes: 'All Types',
  clearFilters: 'Clear Filters',
  assetStatus: 'Asset Status',
  transactionType: 'Transaction Type',
  
  // Transaction
  transactions: 'Transactions',
  transactionId: 'Transaction ID',
  type: 'Type',
  item: 'Item',
  quantity: 'Quantity',
  user: 'User',
  date: 'Date',
  receipts: 'Receipts',
  issues: 'Issues',
  returns: 'Returns',
  transfers: 'Transfers',
  damages: 'Damages',
  transactionSummary: 'Transaction Summary',
  noTransactions: 'No transactions found',
  
  // Departments
  departments: 'Departments',
  departmentSummary: 'Department Summary',
  totalAssets: 'Total Assets',
  pending: 'Pending',
  utilization: 'Utilization',
  noDepartments: 'No departments found',
  
  // Employees
  employees: 'Employees',
  employeeSummary: 'Employee Summary',
  assignedAssets: 'Assigned Assets',
  returnedAssets: 'Returned Assets',
  outstandingAssets: 'Outstanding Assets',
  noEmployees: 'No employees found',
  
  // Inventory
  inventoryStatus: 'Inventory Status',
  assetsByCategory: 'Assets by Category',
  assetsByDepartment: 'Assets by Department',
  inventoryList: 'Inventory List',
  noAssets: 'No assets found',
  underRepair: 'Under Repair'
};

const amharicTranslations = {
  reports: 'የመደብር ሪፖርቶች',
  storeReport: 'ሙሉ የክምችት እና የእንቅስቃሴ ሪፖርት',
  exportExcel: 'ወደ Excel ላክ',
  exportPDF: 'ወደ PDF ላክ',
  print: 'አትም',
  loading: 'በመጫን ላይ...',
  totalAssets: 'ጠቅላላ ንብረቶች',
  available: 'ይገኛል',
  issued: 'ተሰጥቷል',
  reserved: 'ተይዟል',
  returned: 'ተመልሷል',
  damaged: 'የተጎዳ',
  lowStock: 'ዝቅተኛ ክምችት',
  totalValue: 'ጠቅላላ ዋጋ',
  showingFirst: 'የመጀመሪያዎቹን',
  of: 'ከ',
  assetTag: 'የንብረት መለያ',
  name: 'ስም',
  category: 'ምድብ',
  status: 'ሁኔታ',
  location: 'ቦታ',
  condition: 'ሁኔታ',
  value: 'ዋጋ',
  fetchError: 'የሪፖርት ውሂብ ማግኘት አልተቻለም',
  exportSuccess: 'በተሳካ ሁኔታ ተላከ',
  
  // Tabs
  inventory: 'ክምችት',
  transactions: 'ግብይቶች',
  departments: 'ክፍሎች',
  employees: 'ሰራተኞች',
  
  // Filters
  dateFrom: 'ከቀን',
  dateTo: 'እስከ ቀን',
  department: 'ክፍል',
  employee: 'ሰራተኛ',
  allDepartments: 'ሁሉም ክፍሎች',
  allEmployees: 'ሁሉም ሰራተኞች',
  allCategories: 'ሁሉም ምድቦች',
  allLocations: 'ሁሉም ቦታዎች',
  allConditions: 'ሁሉም ሁኔታዎች',
  allStatuses: 'ሁሉም ሁኔታዎች',
  allTypes: 'ሁሉም ዓይነቶች',
  clearFilters: 'ማጣሪያ አጽዳ',
  assetStatus: 'የንብረት ሁኔታ',
  transactionType: 'የግብይት ዓይነት',
  
  // Transaction
  transactions: 'ግብይቶች',
  transactionId: 'የግብይት መለያ',
  type: 'ዓይነት',
  item: 'እቃ',
  quantity: 'ብዛት',
  user: 'ተጠቃሚ',
  date: 'ቀን',
  receipts: 'ደረሰኞች',
  issues: 'መስጠቶች',
  returns: 'መመለሶች',
  transfers: 'ማስተላለፎች',
  damages: 'ጉዳቶች',
  transactionSummary: 'የግብይት ማጠቃለያ',
  noTransactions: 'ምንም ግብይቶች አልተገኙም',
  
  // Departments
  departments: 'ክፍሎች',
  departmentSummary: 'የክፍል ማጠቃለያ',
  pending: 'በመጠባበቅ ላይ',
  utilization: 'አጠቃቀም',
  noDepartments: 'ምንም ክፍሎች አልተገኙም',
  
  // Employees
  employees: 'ሰራተኞች',
  employeeSummary: 'የሰራተኛ ማጠቃለያ',
  assignedAssets: 'የተመደቡ ንብረቶች',
  returnedAssets: 'የተመለሱ ንብረቶች',
  outstandingAssets: 'ያልተመለሱ ንብረቶች',
  noEmployees: 'ምንም ሰራተኞች አልተገኙም',
  
  // Inventory
  inventoryStatus: 'የክምችት ሁኔታ',
  assetsByCategory: 'ንብረቶች በምድብ',
  assetsByDepartment: 'ንብረቶች በክፍል',
  inventoryList: 'የክምችት ዝርዝር',
  noAssets: 'ምንም ንብረቶች አልተገኙም',
  underRepair: 'በጥገና ላይ'
};

export default StoreReports;