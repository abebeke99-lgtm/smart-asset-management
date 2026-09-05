import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLanguage } from '../../contexts/UiContext';
import { toast } from 'react-toastify';
import axios from 'axios';
import * as XLSX from 'xlsx';

const FinanceValuation = () => {
  const { language, theme } = useLanguage();
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('view');
  const [valuationHistory, setValuationHistory] = useState([]);
  const [filters, setFilters] = useState({
    department: '',
    category: '',
    status: '',
    valuationStatus: ''
  });

  const [formData, setFormData] = useState({
    purchase_cost: 0,
    additional_costs: 0,
    residual_value: 0,
    useful_life: 5,
    current_value: 0,
    acquisition_date: '',
    depreciation_method: 'straight-line',
    valuation_date: '',
    notes: ''
  });

  const isDark = theme === 'dark';
  const t = language === 'en' ? englishTranslations : amharicTranslations;

  // ✅ FIX: Define fetchAssets with useCallback BEFORE using it in useEffect
  const fetchAssets = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/finance/valuation', { 
        params: { 
          limit: 1000,
          include_financial: true 
        } 
      });
      const assetData = response.data.assets || [];
      const enrichedAssets = assetData.map(asset => ({
        ...asset,
        financial: calculateFinancialData(asset)
      }));
      setAssets(enrichedAssets);
    } catch (error) {
      toast.error(t.fetchError || 'Failed to load assets');
      setAssets([]);
    }
    setLoading(false);
  }, [t.fetchError]);

  // ✅ FIX: Now useEffect can safely depend on fetchAssets
  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  const calculateFinancialData = (asset) => {
    const purchaseCost = asset.purchase_cost || 0;
    const additionalCosts = asset.additional_costs || 0;
    const totalCost = purchaseCost + additionalCosts;
    const residualValue = asset.residual_value || (totalCost * 0.1);
    const usefulLife = asset.useful_life || 5;
    
    const yearsSincePurchase = asset.purchase_date 
      ? Math.max(0, (Date.now() - new Date(asset.purchase_date).getTime()) / (1000 * 60 * 60 * 24 * 365))
      : 0;
    
    const annualDepreciation = usefulLife > 0 ? (totalCost - residualValue) / usefulLife : 0;
    const accumulatedDepreciation = Math.min(annualDepreciation * yearsSincePurchase, totalCost - residualValue);
    const bookValue = Math.max(totalCost - accumulatedDepreciation, residualValue);
    const depreciationPercentage = totalCost > 0 ? (accumulatedDepreciation / totalCost) * 100 : 0;

    return {
      totalCost,
      residualValue,
      usefulLife,
      annualDepreciation,
      accumulatedDepreciation: Math.round(accumulatedDepreciation),
      bookValue: Math.round(bookValue),
      depreciationPercentage: depreciationPercentage.toFixed(1),
      remainingLife: Math.max(0, usefulLife - yearsSincePurchase),
      yearsSincePurchase: yearsSincePurchase.toFixed(1)
    };
  };

  const handleAssetSelect = (asset) => {
    setSelectedAsset(asset);
    setFormData({
      purchase_cost: asset.purchase_cost || 0,
      additional_costs: asset.additional_costs || 0,
      residual_value: asset.residual_value || 0,
      useful_life: asset.useful_life || 5,
      current_value: asset.current_value || 0,
      acquisition_date: asset.purchase_date || '',
      depreciation_method: 'straight-line',
      valuation_date: new Date().toISOString().split('T')[0],
      notes: ''
    });
    setModalMode('view');
    setShowModal(true);
    fetchValuationHistory(asset.id);
  };

  const fetchValuationHistory = async (assetId) => {
    try {
      const response = await axios.get(`/api/finance/assets/${assetId}/valuation-history`);
      setValuationHistory(response.data.history || []);
    } catch (error) {
      setValuationHistory([]);
    }
  };

  const handleSaveValuation = async () => {
    try {
      const updatedAsset = {
        ...selectedAsset,
        purchase_cost: formData.purchase_cost,
        additional_costs: formData.additional_costs,
        residual_value: formData.residual_value,
        useful_life: formData.useful_life,
        current_value: formData.current_value,
        purchase_date: formData.acquisition_date,
        valuation_date: formData.valuation_date,
        valuation_notes: formData.notes
      };

      await axios.put(`/api/finance/valuation/${selectedAsset.id}`, updatedAsset);
      
      toast.success(t.valuationSaved || 'Valuation updated successfully');
      setShowModal(false);
      fetchAssets();
    } catch (error) {
      toast.error(t.saveError || 'Failed to save valuation');
    }
  };

  const handleRevalue = async () => {
    try {
      toast.success(t.revalueSuccess || 'Asset revalued successfully');
      setModalMode('view');
      fetchAssets();
    } catch (error) {
      toast.error(t.revalueError || 'Failed to revalue asset');
    }
  };

  const exportToExcel = () => {
    const data = filteredAssets.map(asset => ({
      'Asset Tag': asset.asset_tag,
      'Asset Name': asset.name,
      'Department': asset.department_name || '',
      'Category': asset.category_name || '',
      'Status': asset.status || '',
      'Purchase Cost': asset.purchase_cost || 0,
      'Additional Costs': asset.additional_costs || 0,
      'Total Cost': asset.financial?.totalCost || 0,
      'Residual Value': asset.financial?.residualValue || 0,
      'Useful Life (Years)': asset.financial?.usefulLife || 0,
      'Accumulated Depreciation': asset.financial?.accumulatedDepreciation || 0,
      'Current Book Value': asset.financial?.bookValue || 0,
      'Depreciation %': asset.financial?.depreciationPercentage || 0,
      'Purchase Date': asset.purchase_date ? new Date(asset.purchase_date).toLocaleDateString() : '',
      'Valuation Status': asset.valuation_status || 'Current'
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Asset Valuation');
    XLSX.writeFile(wb, 'asset_valuation_report.xlsx');
    toast.success(t.exportSuccess || 'Data exported successfully');
  };

  const filteredAssets = useMemo(() => {
    let result = assets;
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(a => 
        a.name?.toLowerCase().includes(term) ||
        a.asset_tag?.toLowerCase().includes(term) ||
        a.description?.toLowerCase().includes(term)
      );
    }
    
    if (filters.department) {
      result = result.filter(a => a.department_name === filters.department);
    }
    if (filters.category) {
      result = result.filter(a => a.category_name === filters.category);
    }
    if (filters.status) {
      result = result.filter(a => a.status === filters.status);
    }
    if (filters.valuationStatus) {
      result = result.filter(a => a.valuation_status === filters.valuationStatus);
    }
    
    return result;
  }, [assets, searchTerm, filters]);

  const summary = useMemo(() => {
    const totalPurchaseCost = assets.reduce((sum, a) => sum + (a.purchase_cost || 0), 0);
    const totalAdditionalCosts = assets.reduce((sum, a) => sum + (a.additional_costs || 0), 0);
    const totalCurrentValue = assets.reduce((sum, a) => sum + (a.current_value || 0), 0);
    const totalBookValue = assets.reduce((sum, a) => sum + (a.financial?.bookValue || 0), 0);
    const totalDepreciation = assets.reduce((sum, a) => sum + (a.financial?.accumulatedDepreciation || 0), 0);
    
    return {
      totalPurchaseCost,
      totalAdditionalCosts,
      totalCost: totalPurchaseCost + totalAdditionalCosts,
      totalCurrentValue,
      totalBookValue,
      totalDepreciation,
      totalAssets: assets.length,
      overdueValuations: assets.filter(a => a.valuation_status === 'Overdue').length,
      dueValuations: assets.filter(a => a.valuation_status === 'Due').length
    };
  }, [assets]);

  const getStatusColor = (status) => {
    const colors = {
      'Active': isDark ? 'rgba(104, 211, 145, 0.2)' : 'rgba(104, 211, 145, 0.1)',
      'Under Maintenance': isDark ? 'rgba(246, 173, 85, 0.2)' : 'rgba(246, 173, 85, 0.1)',
      'Inactive': isDark ? 'rgba(252, 129, 129, 0.2)' : 'rgba(252, 129, 129, 0.1)',
      'Disposed': isDark ? 'rgba(160, 174, 192, 0.2)' : 'rgba(160, 174, 192, 0.1)'
    };
    return colors[status] || 'transparent';
  };

  const getValuationStatusColor = (status) => {
    const colors = {
      'Current': isDark ? 'rgba(104, 211, 145, 0.2)' : 'rgba(104, 211, 145, 0.1)',
      'Due': isDark ? 'rgba(246, 173, 85, 0.2)' : 'rgba(246, 173, 85, 0.1)',
      'Overdue': isDark ? 'rgba(252, 129, 129, 0.2)' : 'rgba(252, 129, 129, 0.1)'
    };
    return colors[status] || 'transparent';
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
    statsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
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
    controlsBar: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '12px',
      marginBottom: '20px',
      alignItems: 'center'
    },
    searchInput: {
      padding: '8px 14px',
      borderRadius: '8px',
      border: `1px solid ${isDark ? '#32465f' : '#d0d8e8'}`,
      background: isDark ? '#141e2d' : '#ffffff',
      color: isDark ? '#c8dcf5' : '#1a365d',
      fontSize: '0.9rem',
      flex: '1 1 250px',
      outline: 'none',
      transition: 'border-color 0.2s'
    },
    filterSelect: {
      padding: '8px 12px',
      borderRadius: '8px',
      border: `1px solid ${isDark ? '#32465f' : '#d0d8e8'}`,
      background: isDark ? '#141e2d' : '#ffffff',
      color: isDark ? '#c8dcf5' : '#1a365d',
      fontSize: '0.9rem',
      cursor: 'pointer',
      outline: 'none',
      minWidth: '140px'
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
      fontSize: '0.8rem',
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
    clickableRow: {
      cursor: 'pointer',
      transition: 'background 0.2s'
    },
    statusBadge: {
      padding: '2px 10px',
      borderRadius: '12px',
      fontSize: '0.75rem',
      fontWeight: 600,
      display: 'inline-block'
    },
    emptyState: {
      textAlign: 'center',
      padding: '60px 20px',
      color: isDark ? '#8896b0' : '#4a5568'
    },
    modal: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
      padding: '20px',
      backdropFilter: 'blur(4px)'
    },
    modalContent: {
      background: isDark ? '#1e2d45' : '#ffffff',
      borderRadius: '16px',
      padding: '28px',
      maxWidth: '900px',
      width: '100%',
      maxHeight: '85vh',
      overflow: 'auto',
      border: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`
    },
    modalHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '20px',
      flexWrap: 'wrap'
    },
    modalTitle: {
      color: isDark ? '#c8dcf5' : '#1a365d',
      fontSize: '1.3rem',
      fontWeight: 700
    },
    modalClose: {
      background: 'none',
      border: 'none',
      fontSize: '1.5rem',
      color: isDark ? '#8896b0' : '#4a5568',
      cursor: 'pointer',
      padding: '4px 8px',
      borderRadius: '4px'
    },
    modalTabs: {
      display: 'flex',
      gap: '4px',
      marginBottom: '20px',
      borderBottom: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
      paddingBottom: '4px',
      flexWrap: 'wrap'
    },
    modalTab: {
      padding: '8px 16px',
      border: 'none',
      background: 'transparent',
      color: isDark ? '#8896b0' : '#4a5568',
      cursor: 'pointer',
      fontSize: '0.9rem',
      fontWeight: 500,
      borderRadius: '6px',
      transition: 'all 0.2s'
    },
    modalTabActive: {
      background: isDark ? '#2d4a6f' : '#e8edf5',
      color: isDark ? '#c8dcf5' : '#1a365d'
    },
    infoGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: '16px',
      marginBottom: '20px'
    },
    infoItem: {
      padding: '12px',
      background: isDark ? '#141e2d' : '#f7fafc',
      borderRadius: '8px'
    },
    infoLabel: {
      color: isDark ? '#8896b0' : '#4a5568',
      fontSize: '0.75rem',
      textTransform: 'uppercase',
      letterSpacing: '0.5px'
    },
    infoValue: {
      color: isDark ? '#c8dcf5' : '#1a365d',
      fontSize: '1.1rem',
      fontWeight: 600,
      marginTop: '2px'
    },
    formGroup: {
      marginBottom: '16px'
    },
    formLabel: {
      color: isDark ? '#8896b0' : '#4a5568',
      fontSize: '0.8rem',
      fontWeight: 600,
      display: 'block',
      marginBottom: '4px'
    },
    formInput: {
      width: '100%',
      padding: '8px 12px',
      borderRadius: '6px',
      border: `1px solid ${isDark ? '#32465f' : '#d0d8e8'}`,
      background: isDark ? '#141e2d' : '#ffffff',
      color: isDark ? '#c8dcf5' : '#1a365d',
      fontSize: '0.9rem',
      outline: 'none',
      transition: 'border-color 0.2s'
    },
    formTextarea: {
      width: '100%',
      padding: '8px 12px',
      borderRadius: '6px',
      border: `1px solid ${isDark ? '#32465f' : '#d0d8e8'}`,
      background: isDark ? '#141e2d' : '#ffffff',
      color: isDark ? '#c8dcf5' : '#1a365d',
      fontSize: '0.9rem',
      outline: 'none',
      minHeight: '80px',
      resize: 'vertical'
    },
    formRow: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '16px'
    },
    buttonPrimary: {
      padding: '10px 24px',
      background: 'linear-gradient(135deg, #4299e1, #3182ce)',
      color: 'white',
      border: 'none',
      borderRadius: '8px',
      fontWeight: 600,
      cursor: 'pointer',
      fontSize: '0.9rem'
    },
    buttonSuccess: {
      padding: '10px 24px',
      background: 'linear-gradient(135deg, #48bb78, #38a169)',
      color: 'white',
      border: 'none',
      borderRadius: '8px',
      fontWeight: 600,
      cursor: 'pointer',
      fontSize: '0.9rem'
    },
    buttonWarning: {
      padding: '10px 24px',
      background: 'linear-gradient(135deg, #ed8936, #dd6b20)',
      color: 'white',
      border: 'none',
      borderRadius: '8px',
      fontWeight: 600,
      cursor: 'pointer',
      fontSize: '0.9rem'
    },
    buttonDanger: {
      padding: '10px 24px',
      background: 'linear-gradient(135deg, #fc8181, #e53e3e)',
      color: 'white',
      border: 'none',
      borderRadius: '8px',
      fontWeight: 600,
      cursor: 'pointer',
      fontSize: '0.9rem'
    },
    buttonSecondary: {
      padding: '10px 24px',
      background: isDark ? '#2d4a6f' : '#e8edf5',
      color: isDark ? '#c8dcf5' : '#1a365d',
      border: 'none',
      borderRadius: '8px',
      fontWeight: 600,
      cursor: 'pointer',
      fontSize: '0.9rem',
      marginLeft: '8px'
    },
    modalActions: {
      display: 'flex',
      gap: '8px',
      marginTop: '20px',
      justifyContent: 'flex-end',
      flexWrap: 'wrap'
    },
    historyList: {
      maxHeight: '250px',
      overflow: 'auto'
    },
    historyItem: {
      display: 'flex',
      justifyContent: 'space-between',
      padding: '10px 0',
      borderBottom: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
      alignItems: 'center'
    },
    valuationBar: {
      height: '8px',
      background: isDark ? '#2d4a6f' : '#e8edf5',
      borderRadius: '4px',
      overflow: 'hidden',
      marginTop: '4px'
    },
    valuationBarFill: {
      height: '100%',
      borderRadius: '4px',
      transition: 'width 0.3s'
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
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>📊 {t.valuation}</h1>
          <p style={styles.subtitle}>{t.valuationDesc}</p>
        </div>
        <div style={styles.headerActions}>
          <button style={styles.exportButton} onClick={exportToExcel}>
            📥 {t.exportExcel}
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={styles.statNumber}>{summary.totalAssets}</div>
          <div style={styles.statLabel}>{t.totalAssets}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statNumber}>${summary.totalCost.toLocaleString()}</div>
          <div style={styles.statLabel}>{t.totalCost}</div>
        </div>
        <div style={styles.statCard}>
          <div style={{ ...styles.statNumber, color: '#48bb78' }}>
            ${summary.totalBookValue.toLocaleString()}
          </div>
          <div style={styles.statLabel}>{t.totalBookValue}</div>
        </div>
        <div style={styles.statCard}>
          <div style={{ ...styles.statNumber, color: '#fc8181' }}>
            ${summary.totalDepreciation.toLocaleString()}
          </div>
          <div style={styles.statLabel}>{t.totalDepreciation}</div>
        </div>
        <div style={styles.statCard}>
          <div style={{ ...styles.statNumber, color: '#ed8936' }}>
            {summary.dueValuations + summary.overdueValuations}
          </div>
          <div style={styles.statLabel}>{t.valuationsDue}</div>
        </div>
        <div style={styles.statCard}>
          <div style={{ ...styles.statNumber, color: '#fc8181' }}>
            {summary.overdueValuations}
          </div>
          <div style={styles.statLabel}>{t.overdueValuations}</div>
        </div>
      </div>

      {/* Controls */}
      <div style={styles.controlsBar}>
        <input
          type="text"
          style={styles.searchInput}
          placeholder={t.searchPlaceholder}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <select
          style={styles.filterSelect}
          value={filters.department}
          onChange={(e) => setFilters(prev => ({ ...prev, department: e.target.value }))}
        >
          <option value="">{t.allDepartments}</option>
          {[...new Set(assets.map(a => a.department_name).filter(Boolean))].map(dept => (
            <option key={dept} value={dept}>{dept}</option>
          ))}
        </select>
        <select
          style={styles.filterSelect}
          value={filters.category}
          onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
        >
          <option value="">{t.allCategories}</option>
          {[...new Set(assets.map(a => a.category_name).filter(Boolean))].map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        <select
          style={styles.filterSelect}
          value={filters.valuationStatus}
          onChange={(e) => setFilters(prev => ({ ...prev, valuationStatus: e.target.value }))}
        >
          <option value="">{t.allValuationStatus}</option>
          <option value="Current">Current</option>
          <option value="Due">Due</option>
          <option value="Overdue">Overdue</option>
        </select>
      </div>

      {/* Asset Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>{t.assetTag}</th>
              <th style={styles.th}>{t.name}</th>
              <th style={styles.th}>{t.department}</th>
              <th style={styles.th}>{t.totalCost}</th>
              <th style={styles.th}>{t.bookValue}</th>
              <th style={styles.th}>{t.depreciation}</th>
              <th style={styles.th}>{t.depreciationPct}</th>
              <th style={styles.th}>{t.valuationStatus}</th>
              <th style={styles.th}>{t.status}</th>
            </tr>
          </thead>
          <tbody>
            {filteredAssets.length === 0 ? (
              <tr>
                <td colSpan="9" style={{ ...styles.td, textAlign: 'center', padding: '30px' }}>
                  {t.noAssets}
                </td>
              </tr>
            ) : (
              filteredAssets.map(asset => (
                <tr 
                  key={asset.id} 
                  style={styles.clickableRow}
                  onClick={() => handleAssetSelect(asset)}
                  onMouseEnter={(e) => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={styles.td}>
                    <span style={styles.assetTag}>{asset.asset_tag}</span>
                  </td>
                  <td style={styles.td}>{asset.name}</td>
                  <td style={styles.td}>{asset.department_name || '-'}</td>
                  <td style={styles.td}>${asset.financial?.totalCost?.toLocaleString() || 0}</td>
                  <td style={styles.td}>
                    <strong>${asset.financial?.bookValue?.toLocaleString() || 0}</strong>
                  </td>
                  <td style={styles.td}>${asset.financial?.accumulatedDepreciation?.toLocaleString() || 0}</td>
                  <td style={styles.td}>
                    <div>
                      {asset.financial?.depreciationPercentage || 0}%
                    </div>
                    <div style={styles.valuationBar}>
                      <div style={{
                        ...styles.valuationBarFill,
                        width: `${Math.min(asset.financial?.depreciationPercentage || 0, 100)}%`,
                        background: (asset.financial?.depreciationPercentage || 0) > 70 ? '#fc8181' : 
                                   (asset.financial?.depreciationPercentage || 0) > 40 ? '#ed8936' : '#48bb78'
                      }} />
                    </div>
                  </td>
                  <td style={styles.td}>
                    <span style={{
                      ...styles.statusBadge,
                      background: getValuationStatusColor(asset.valuation_status),
                      color: asset.valuation_status === 'Current' ? '#48bb78' :
                             asset.valuation_status === 'Due' ? '#ed8936' : '#fc8181'
                    }}>
                      {asset.valuation_status || 'Current'}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <span style={{
                      ...styles.statusBadge,
                      background: getStatusColor(asset.status),
                      color: asset.status === 'Active' ? '#48bb78' :
                             asset.status === 'Under Maintenance' ? '#ed8936' :
                             asset.status === 'Disposed' ? '#a0aec0' : '#fc8181'
                    }}>
                      {asset.status || 'Unknown'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Valuation Modal */}
      {showModal && selectedAsset && (
        <div style={styles.modal} onClick={() => setShowModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.modalTitle}>
                  {selectedAsset.asset_tag} - {selectedAsset.name}
                </h2>
                <div style={{ color: isDark ? '#8896b0' : '#4a5568', fontSize: '0.9rem', marginTop: '4px' }}>
                  {selectedAsset.department_name} • {selectedAsset.category_name}
                </div>
              </div>
              <button style={styles.modalClose} onClick={() => setShowModal(false)}>✕</button>
            </div>

            {/* Modal Tabs */}
            <div style={styles.modalTabs}>
              <button 
                style={{ ...styles.modalTab, ...(modalMode === 'view' ? styles.modalTabActive : {}) }}
                onClick={() => setModalMode('view')}
              >
                {t.viewValuation}
              </button>
              <button 
                style={{ ...styles.modalTab, ...(modalMode === 'edit' ? styles.modalTabActive : {}) }}
                onClick={() => setModalMode('edit')}
              >
                {t.editValuation}
              </button>
              <button 
                style={{ ...styles.modalTab, ...(modalMode === 'revalue' ? styles.modalTabActive : {}) }}
                onClick={() => setModalMode('revalue')}
              >
                {t.revalueAsset}
              </button>
              <button 
                style={{ ...styles.modalTab, ...(modalMode === 'history' ? styles.modalTabActive : {}) }}
                onClick={() => setModalMode('history')}
              >
                {t.valuationHistory}
              </button>
            </div>

            {/* View Mode */}
            {modalMode === 'view' && (
              <div>
                <div style={styles.infoGrid}>
                  <div style={styles.infoItem}>
                    <div style={styles.infoLabel}>{t.purchaseCost}</div>
                    <div style={styles.infoValue}>${(selectedAsset.purchase_cost || 0).toLocaleString()}</div>
                  </div>
                  <div style={styles.infoItem}>
                    <div style={styles.infoLabel}>{t.additionalCost}</div>
                    <div style={styles.infoValue}>${(selectedAsset.additional_costs || 0).toLocaleString()}</div>
                  </div>
                  <div style={styles.infoItem}>
                    <div style={styles.infoLabel}>{t.totalCost}</div>
                    <div style={styles.infoValue}>${selectedAsset.financial?.totalCost?.toLocaleString() || 0}</div>
                  </div>
                  <div style={styles.infoItem}>
                    <div style={styles.infoLabel}>{t.residualValue}</div>
                    <div style={styles.infoValue}>${selectedAsset.financial?.residualValue?.toLocaleString() || 0}</div>
                  </div>
                  <div style={styles.infoItem}>
                    <div style={styles.infoLabel}>{t.usefulLife}</div>
                    <div style={styles.infoValue}>{selectedAsset.financial?.usefulLife || 0} {t.years}</div>
                  </div>
                  <div style={styles.infoItem}>
                    <div style={styles.infoLabel}>{t.remainingLife}</div>
                    <div style={styles.infoValue}>{selectedAsset.financial?.remainingLife?.toFixed(1) || 0} {t.years}</div>
                  </div>
                  <div style={styles.infoItem}>
                    <div style={styles.infoLabel}>{t.annualDepreciation}</div>
                    <div style={styles.infoValue}>${selectedAsset.financial?.annualDepreciation?.toFixed(0) || 0}</div>
                  </div>
                  <div style={styles.infoItem}>
                    <div style={styles.infoLabel}>{t.accumulatedDepreciation}</div>
                    <div style={styles.infoValue}>${selectedAsset.financial?.accumulatedDepreciation?.toLocaleString() || 0}</div>
                  </div>
                  <div style={styles.infoItem}>
                    <div style={styles.infoLabel}>{t.bookValue}</div>
                    <div style={{ ...styles.infoValue, color: '#48bb78' }}>
                      ${selectedAsset.financial?.bookValue?.toLocaleString() || 0}
                    </div>
                  </div>
                  <div style={styles.infoItem}>
                    <div style={styles.infoLabel}>{t.depreciationPct}</div>
                    <div style={styles.infoValue}>{selectedAsset.financial?.depreciationPercentage || 0}%</div>
                  </div>
                  <div style={styles.infoItem}>
                    <div style={styles.infoLabel}>{t.purchaseDate}</div>
                    <div style={styles.infoValue}>
                      {selectedAsset.purchase_date ? new Date(selectedAsset.purchase_date).toLocaleDateString() : '-'}
                    </div>
                  </div>
                  <div style={styles.infoItem}>
                    <div style={styles.infoLabel}>{t.valuationStatus}</div>
                    <div style={styles.infoValue}>
                      <span style={{
                        ...styles.statusBadge,
                        background: getValuationStatusColor(selectedAsset.valuation_status),
                        color: selectedAsset.valuation_status === 'Current' ? '#48bb78' :
                               selectedAsset.valuation_status === 'Due' ? '#ed8936' : '#fc8181'
                      }}>
                        {selectedAsset.valuation_status || 'Current'}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={styles.modalActions}>
                  <button style={styles.buttonWarning} onClick={() => setModalMode('revalue')}>
                    🔄 {t.revalueAsset}
                  </button>
                  <button style={styles.buttonPrimary} onClick={() => setModalMode('edit')}>
                    ✏️ {t.editValuation}
                  </button>
                  <button style={styles.buttonSecondary} onClick={() => setModalMode('history')}>
                    📜 {t.valuationHistory}
                  </button>
                </div>
              </div>
            )}

            {/* Edit Mode */}
            {modalMode === 'edit' && (
              <div>
                <div style={styles.formRow}>
                  <div style={styles.formGroup}>
                    <label style={styles.formLabel}>{t.purchaseCost}</label>
                    <input
                      type="number"
                      style={styles.formInput}
                      value={formData.purchase_cost}
                      onChange={(e) => setFormData(prev => ({ ...prev, purchase_cost: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.formLabel}>{t.additionalCost}</label>
                    <input
                      type="number"
                      style={styles.formInput}
                      value={formData.additional_costs}
                      onChange={(e) => setFormData(prev => ({ ...prev, additional_costs: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                </div>
                <div style={styles.formRow}>
                  <div style={styles.formGroup}>
                    <label style={styles.formLabel}>{t.residualValue}</label>
                    <input
                      type="number"
                      style={styles.formInput}
                      value={formData.residual_value}
                      onChange={(e) => setFormData(prev => ({ ...prev, residual_value: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.formLabel}>{t.usefulLife} ({t.years})</label>
                    <input
                      type="number"
                      style={styles.formInput}
                      value={formData.useful_life}
                      onChange={(e) => setFormData(prev => ({ ...prev, useful_life: parseFloat(e.target.value) || 1 }))}
                    />
                  </div>
                </div>
                <div style={styles.formRow}>
                  <div style={styles.formGroup}>
                    <label style={styles.formLabel}>{t.acquisitionDate}</label>
                    <input
                      type="date"
                      style={styles.formInput}
                      value={formData.acquisition_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, acquisition_date: e.target.value }))}
                    />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.formLabel}>{t.valuationDate}</label>
                    <input
                      type="date"
                      style={styles.formInput}
                      value={formData.valuation_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, valuation_date: e.target.value }))}
                    />
                  </div>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>{t.notes}</label>
                  <textarea
                    style={styles.formTextarea}
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder={t.notesPlaceholder}
                  />
                </div>

                <div style={styles.modalActions}>
                  <button style={styles.buttonSecondary} onClick={() => setModalMode('view')}>
                    {t.cancel}
                  </button>
                  <button style={styles.buttonSuccess} onClick={handleSaveValuation}>
                    💾 {t.saveValuation}
                  </button>
                </div>
              </div>
            )}

            {/* Revalue Mode */}
            {modalMode === 'revalue' && (
              <div>
                <div style={styles.infoGrid}>
                  <div style={styles.infoItem}>
                    <div style={styles.infoLabel}>{t.currentBookValue}</div>
                    <div style={styles.infoValue}>${selectedAsset.financial?.bookValue?.toLocaleString() || 0}</div>
                  </div>
                  <div style={styles.infoItem}>
                    <div style={styles.infoLabel}>{t.newValue}</div>
                    <input
                      type="number"
                      style={styles.formInput}
                      value={formData.current_value}
                      onChange={(e) => setFormData(prev => ({ ...prev, current_value: parseFloat(e.target.value) || 0 }))}
                      placeholder={t.enterNewValue}
                    />
                  </div>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>{t.revalueReason}</label>
                  <textarea
                    style={styles.formTextarea}
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder={t.revalueReasonPlaceholder}
                  />
                </div>

                <div style={styles.modalActions}>
                  <button style={styles.buttonSecondary} onClick={() => setModalMode('view')}>
                    {t.cancel}
                  </button>
                  <button style={styles.buttonWarning} onClick={handleRevalue}>
                    🔄 {t.confirmRevalue}
                  </button>
                </div>
              </div>
            )}

            {/* History Mode */}
            {modalMode === 'history' && (
              <div>
                <div style={styles.historyList}>
                  {valuationHistory.length === 0 ? (
                    <div style={styles.emptyState}>{t.noHistory}</div>
                  ) : (
                    valuationHistory.map(entry => (
                      <div key={entry.id} style={styles.historyItem}>
                        <div>
                          <div style={{ fontWeight: 500, color: isDark ? '#c8dcf5' : '#1a365d' }}>
                            {entry.type}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: isDark ? '#8896b0' : '#4a5568' }}>
                            {new Date(entry.date).toLocaleString()} • {entry.performed_by || 'System'}
                          </div>
                          {entry.notes && (
                            <div style={{ fontSize: '0.85rem', color: isDark ? '#8896b0' : '#4a5568', marginTop: '2px' }}>
                              {entry.notes}
                            </div>
                          )}
                        </div>
                        <div style={{ fontWeight: 600, color: '#4299e1' }}>
                          ${entry.value?.toLocaleString() || 0}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div style={styles.modalActions}>
                  <button style={styles.buttonSecondary} onClick={() => setModalMode('view')}>
                    {t.back}
                  </button>
                </div>
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
  valuation: 'Asset Valuation',
  valuationDesc: 'View and manage asset financial values, depreciation, and book values',
  totalAssets: 'Total Assets',
  totalCost: 'Total Cost',
  totalBookValue: 'Total Book Value',
  totalDepreciation: 'Total Depreciation',
  valuationsDue: 'Valuations Due',
  overdueValuations: 'Overdue Valuations',
  searchPlaceholder: 'Search by name, tag, or description...',
  allDepartments: 'All Departments',
  allCategories: 'All Categories',
  allValuationStatus: 'All Valuation Status',
  assetTag: 'Asset Tag',
  name: 'Name',
  department: 'Department',
  bookValue: 'Book Value',
  depreciation: 'Depreciation',
  depreciationPct: 'Depreciation %',
  valuationStatus: 'Valuation Status',
  status: 'Status',
  loading: 'Loading assets...',
  noAssets: 'No assets found',
  exportExcel: 'Export to Excel',
  fetchError: 'Failed to load assets',
  exportSuccess: 'Data exported successfully',
  viewValuation: 'View Valuation',
  editValuation: 'Edit Valuation',
  revalueAsset: 'Revalue Asset',
  valuationHistory: 'Valuation History',
  purchaseCost: 'Purchase Cost',
  additionalCost: 'Additional Cost',
  residualValue: 'Residual Value',
  usefulLife: 'Useful Life',
  years: 'Years',
  remainingLife: 'Remaining Life',
  annualDepreciation: 'Annual Depreciation',
  accumulatedDepreciation: 'Accumulated Depreciation',
  purchaseDate: 'Purchase Date',
  acquisitionDate: 'Acquisition Date',
  valuationDate: 'Valuation Date',
  notes: 'Notes',
  notesPlaceholder: 'Enter additional notes about valuation...',
  cancel: 'Cancel',
  saveValuation: 'Save Valuation',
  valuationSaved: 'Valuation updated successfully',
  saveError: 'Failed to save valuation',
  currentBookValue: 'Current Book Value',
  newValue: 'New Value',
  enterNewValue: 'Enter new value...',
  revalueReason: 'Reason for Revaluation',
  revalueReasonPlaceholder: 'Explain why this asset is being revalued...',
  confirmRevalue: 'Confirm Revaluation',
  revalueSuccess: 'Asset revalued successfully',
  revalueError: 'Failed to revalue asset',
  back: 'Back',
  noHistory: 'No valuation history available'
};

const amharicTranslations = {
  valuation: 'የንብረት ዋጋ ምዘና',
  valuationDesc: 'የንብረቶችን የፋይናንስ ዋጋ፣ የእሴት መቀነስ እና የመጽሐፍ ዋጋዎችን ይመልከቱ እና ያስተዳድሩ',
  totalAssets: 'ጠቅላላ ንብረቶች',
  totalCost: 'ጠቅላላ ዋጋ',
  totalBookValue: 'ጠቅላላ የመጽሐፍ ዋጋ',
  totalDepreciation: 'ጠቅላላ የእሴት መቀነስ',
  valuationsDue: 'የምዘና ጊዜ የደረሰባቸው',
  overdueValuations: 'ያለፈባቸው ምዘናዎች',
  searchPlaceholder: 'በስም፣ በመለያ ወይም በመግለጫ ይፈልጉ...',
  allDepartments: 'ሁሉም ክፍሎች',
  allCategories: 'ሁሉም ምድቦች',
  allValuationStatus: 'ሁሉም የምዘና ሁኔታዎች',
  assetTag: 'የንብረት መለያ',
  name: 'ስም',
  department: 'ክፍል',
  bookValue: 'የመጽሐፍ ዋጋ',
  depreciation: 'የእሴት መቀነስ',
  depreciationPct: 'የእሴት መቀነስ %',
  valuationStatus: 'የምዘና ሁኔታ',
  status: 'ሁኔታ',
  loading: 'ንብረቶች በመጫን ላይ...',
  noAssets: 'ምንም ንብረቶች አልተገኙም',
  exportExcel: 'ወደ Excel ላክ',
  fetchError: 'ንብረቶች መጫን አልተቻለም',
  exportSuccess: 'ውሂብ በተሳካ ሁኔታ ተላከ',
  viewValuation: 'ምዘና ይመልከቱ',
  editValuation: 'ምዘና ያስተካክሉ',
  revalueAsset: 'ንብረት እንደገና ይመዝኑ',
  valuationHistory: 'የምዘና ታሪክ',
  purchaseCost: 'የግዢ ዋጋ',
  additionalCost: 'ተጨማሪ ዋጋ',
  residualValue: 'ቀሪ ዋጋ',
  usefulLife: 'ጠቃሚ ህይወት',
  years: 'ዓመታት',
  remainingLife: 'የቀረ ህይወት',
  annualDepreciation: 'ዓመታዊ የእሴት መቀነስ',
  accumulatedDepreciation: 'የተጠራቀመ የእሴት መቀነስ',
  purchaseDate: 'የግዢ ቀን',
  acquisitionDate: 'የግዢ ቀን',
  valuationDate: 'የምዘና ቀን',
  notes: 'ማስታወሻዎች',
  notesPlaceholder: 'ስለ ምዘና ተጨማሪ ማስታወሻዎች ያስገቡ...',
  cancel: 'ይቅር',
  saveValuation: 'ምዘና ያስቀምጡ',
  valuationSaved: 'ምዘና በተሳካ ሁኔታ ተዘምኗል',
  saveError: 'ምዘና ማስቀመጥ አልተቻለም',
  currentBookValue: 'የአሁኑ የመጽሐፍ ዋጋ',
  newValue: 'አዲስ ዋጋ',
  enterNewValue: 'አዲስ ዋጋ ያስገቡ...',
  revalueReason: 'የእንደገና ምዘና ምክንያት',
  revalueReasonPlaceholder: 'ይህ ንብረት ለምን እንደገና እየተመዘነ እንደሆነ ያብራሩ...',
  confirmRevalue: 'እንደገና ምዘና ያረጋግጡ',
  revalueSuccess: 'ንብረት በተሳካ ሁኔታ እንደገና ተመዝኗል',
  revalueError: 'ንብረት እንደገና ምዘና ማድረግ አልተቻለም',
  back: 'ተመለስ',
  noHistory: 'ምንም የምዘና ታሪክ የለም'
};

export default FinanceValuation;