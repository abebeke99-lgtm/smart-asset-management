import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLanguage } from '../../contexts/UiContext';
import { toast } from 'react-toastify';
import axios from 'axios';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, PointElement, LineElement, Filler } from 'chart.js';
import * as XLSX from 'xlsx';

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

const FinanceDepreciation = () => {
  const { language, theme } = useLanguage();
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [depreciationMethod, setDepreciationMethod] = useState('straight-line');
  const [filters, setFilters] = useState({
    department: '',
    category: '',
    fullyDepreciated: false,
    ageRange: ''
  });

  // Form state for manual adjustment
  const [formData, setFormData] = useState({
    annual_depreciation: 0,
    accumulated_depreciation: 0,
    book_value: 0,
    adjustment_notes: '',
    adjustment_date: ''
  });

  // Depreciation schedule
  const [schedule, setSchedule] = useState([]);
  const [showSchedule, setShowSchedule] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const isDark = theme === 'dark';
  const t = language === 'en' ? englishTranslations : amharicTranslations;

  useEffect(() => {
    fetchAssets();
  }, []);

  useEffect(() => {
    if (selectedAsset) {
      generateDepreciationSchedule(selectedAsset);
    }
  }, [selectedAsset, depreciationMethod]);

  const fetchAssets = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/assets', { 
        params: { 
          limit: 1000,
          include_financial: true 
        } 
      });
      const assetData = response.data.assets || response.data.data || [];
      const enrichedAssets = assetData.map(asset => ({
        ...asset,
        depreciation: calculateDepreciation(asset)
      }));
      setAssets(enrichedAssets);
    } catch (error) {
      toast.error(t.fetchError || 'Failed to load assets');
      setAssets([]);
    }
    setLoading(false);
  };

  const calculateDepreciation = (asset) => {
    const purchaseCost = asset.purchase_cost || 0;
    const residualValue = asset.residual_value || (purchaseCost * 0.1);
    const usefulLife = asset.useful_life || 5;
    const purchaseDate = asset.purchase_date ? new Date(asset.purchase_date) : new Date();
    const method = asset.depreciation_method || 'straight-line';
    
    const yearsSincePurchase = Math.max(0, (Date.now() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24 * 365));
    
    let annualDepreciation = 0;
    let accumulatedDepreciation = 0;
    let bookValue = 0;

    switch (method) {
      case 'straight-line':
        annualDepreciation = (purchaseCost - residualValue) / usefulLife;
        accumulatedDepreciation = Math.min(annualDepreciation * yearsSincePurchase, purchaseCost - residualValue);
        bookValue = Math.max(purchaseCost - accumulatedDepreciation, residualValue);
        break;
      
      case 'reducing-balance':
        const rate = 1 - Math.pow(residualValue / purchaseCost, 1 / usefulLife);
        annualDepreciation = (purchaseCost - residualValue) * rate;
        // Simplified calculation
        accumulatedDepreciation = purchaseCost * (1 - Math.pow(1 - rate, yearsSincePurchase));
        bookValue = Math.max(purchaseCost - accumulatedDepreciation, residualValue);
        break;
      
      case 'declining-balance':
        const decliningRate = 2 / usefulLife;
        // Simplified calculation
        accumulatedDepreciation = purchaseCost * (1 - Math.pow(1 - decliningRate, yearsSincePurchase));
        bookValue = Math.max(purchaseCost - accumulatedDepreciation, residualValue);
        annualDepreciation = (purchaseCost - accumulatedDepreciation) * decliningRate;
        break;
      
      default:
        // Use existing values or manual
        annualDepreciation = asset.annual_depreciation || 0;
        accumulatedDepreciation = asset.accumulated_depreciation || 0;
        bookValue = asset.book_value || purchaseCost;
    }

    const isFullyDepreciated = bookValue <= residualValue || 
                              yearsSincePurchase >= usefulLife;

    return {
      annualDepreciation: Math.round(annualDepreciation),
      accumulatedDepreciation: Math.round(accumulatedDepreciation),
      bookValue: Math.round(bookValue),
      depreciationPercentage: purchaseCost > 0 ? ((accumulatedDepreciation / purchaseCost) * 100).toFixed(1) : 0,
      isFullyDepreciated,
      yearsRemaining: Math.max(0, usefulLife - yearsSincePurchase).toFixed(1),
      yearsSincePurchase: yearsSincePurchase.toFixed(1),
      method,
      purchaseCost,
      residualValue,
      usefulLife
    };
  };

  const generateDepreciationSchedule = (asset) => {
    const scheduleData = [];
    const purchaseCost = asset.purchase_cost || 0;
    const residualValue = asset.residual_value || (purchaseCost * 0.1);
    const usefulLife = asset.useful_life || 5;
    const purchaseDate = asset.purchase_date ? new Date(asset.purchase_date) : new Date();
    
    let bookValue = purchaseCost;
    let accumulatedDep = 0;

    for (let year = 0; year <= usefulLife; year++) {
      const currentDate = new Date(purchaseDate);
      currentDate.setFullYear(currentDate.getFullYear() + year);
      
      let annualDep = 0;
      if (year < usefulLife) {
        switch (depreciationMethod) {
          case 'straight-line':
            annualDep = (purchaseCost - residualValue) / usefulLife;
            break;
          case 'reducing-balance':
            const rate = 1 - Math.pow(residualValue / purchaseCost, 1 / usefulLife);
            annualDep = bookValue * rate;
            break;
          case 'declining-balance':
            const decliningRate = 2 / usefulLife;
            annualDep = bookValue * decliningRate;
            break;
          default:
            annualDep = (purchaseCost - residualValue) / usefulLife;
        }
      }

      const depForYear = Math.min(annualDep, bookValue - residualValue);
      accumulatedDep += depForYear;
      bookValue = Math.max(residualValue, purchaseCost - accumulatedDep);
      
      scheduleData.push({
        year: currentDate.getFullYear(),
        period: `Year ${year + 1}`,
        startValue: year === 0 ? purchaseCost : scheduleData[year - 1]?.bookValue || purchaseCost,
        annualDepreciation: Math.round(annualDep),
        accumulatedDepreciation: Math.round(Math.min(accumulatedDep, purchaseCost - residualValue)),
        bookValue: Math.round(bookValue),
        isFullyDepreciated: bookValue <= residualValue || year >= usefulLife - 1
      });
    }

    setSchedule(scheduleData);
  };

  const generateFallbackAssets = () => {
    const departments = ['IT', 'Facilities', 'HR', 'Finance', 'Operations'];
    const categories = ['Hardware', 'Software', 'Vehicles', 'Furniture', 'Machinery'];
    
    return Array.from({ length: 45 }, (_, i) => {
      const purchaseCost = 50000 + Math.random() * 1500000;
      const residualValue = purchaseCost * (0.05 + Math.random() * 0.15);
      const usefulLife = 3 + Math.floor(Math.random() * 7);
      const purchaseDate = new Date(2018 + Math.floor(Math.random() * 5), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28));
      const yearsSincePurchase = Math.max(0, (Date.now() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24 * 365));
      const annualDep = (purchaseCost - residualValue) / usefulLife;
      const accumulated = Math.min(annualDep * yearsSincePurchase, purchaseCost - residualValue);
      const bookValue = Math.max(purchaseCost - accumulated, residualValue);

      return {
        id: `asset_${i + 1}`,
        asset_tag: `ICT-${String(i + 1).padStart(4, '0')}`,
        name: `${categories[i % categories.length]} ${i + 1}`,
        department_name: departments[i % departments.length],
        category_name: categories[i % categories.length],
        status: i % 5 === 0 ? 'Inactive' : 'Active',
        purchase_cost: purchaseCost,
        residual_value: residualValue,
        useful_life: usefulLife,
        purchase_date: purchaseDate.toISOString(),
        depreciation_method: ['straight-line', 'reducing-balance', 'declining-balance'][i % 3],
        depreciation: {
          annualDepreciation: Math.round(annualDep),
          accumulatedDepreciation: Math.round(accumulated),
          bookValue: Math.round(bookValue),
          depreciationPercentage: ((accumulated / purchaseCost) * 100).toFixed(1),
          isFullyDepreciated: bookValue <= residualValue || yearsSincePurchase >= usefulLife,
          yearsRemaining: Math.max(0, usefulLife - yearsSincePurchase).toFixed(1),
          yearsSincePurchase: yearsSincePurchase.toFixed(1)
        }
      };
    });
  };

  const handleRecalculate = async (asset) => {
    const newDep = calculateDepreciation(asset);
    try {
      await axios.put(`/api/finance/depreciation/${asset.id}`, {
        purchase_cost: newDep.purchaseCost,
        residual_value: newDep.residualValue,
        useful_life: newDep.usefulLife,
        depreciation_method: depreciationMethod,
        accumulated_depreciation: newDep.accumulatedDepreciation,
        current_value: newDep.bookValue,
        type: 'depreciation',
        notes: `Recalculated using ${depreciationMethod}`
      });
      setAssets(prev => prev.map(item => item.id === asset.id ? { ...item, current_value: newDep.bookValue, depreciation: newDep } : item));
      toast.success(t.recalcSuccess || 'Depreciation recalculated');
    } catch (error) {
      toast.error(error.response?.data?.message || t.adjustmentError || 'Failed to recalculate depreciation');
    }
  };

  const handleManualAdjustment = async () => {
    if (!selectedAsset) return;
    
    try {
      const updatedAsset = {
        ...selectedAsset,
        annual_depreciation: formData.annual_depreciation,
        accumulated_depreciation: formData.accumulated_depreciation,
        book_value: formData.book_value,
        depreciation_notes: formData.adjustment_notes,
        depreciation_adjustment_date: formData.adjustment_date
      };
      
      await axios.put(`/api/finance/depreciation/${selectedAsset.id}`, updatedAsset);
      
      setAssets(prev => prev.map(a => 
        a.id === selectedAsset.id ? { ...a, ...updatedAsset, depreciation: calculateDepreciation(updatedAsset) } : a
      ));
      
      toast.success(t.adjustmentSuccess || 'Depreciation adjusted successfully');
      setShowModal(false);
    } catch (error) {
      toast.error(t.adjustmentError || 'Failed to adjust depreciation');
    }
  };

  const exportToExcel = () => {
    const data = filteredAssets.map(asset => ({
      'Asset Tag': asset.asset_tag,
      'Asset Name': asset.name,
      'Department': asset.department_name || '',
      'Category': asset.category_name || '',
      'Purchase Cost': asset.purchase_cost || 0,
      'Residual Value': asset.residual_value || 0,
      'Useful Life (Years)': asset.useful_life || 0,
      'Depreciation Method': asset.depreciation_method || 'Straight-line',
      'Annual Depreciation': asset.depreciation?.annualDepreciation || 0,
      'Accumulated Depreciation': asset.depreciation?.accumulatedDepreciation || 0,
      'Book Value': asset.depreciation?.bookValue || 0,
      'Depreciation %': asset.depreciation?.depreciationPercentage || 0,
      'Years Since Purchase': asset.depreciation?.yearsSincePurchase || 0,
      'Years Remaining': asset.depreciation?.yearsRemaining || 0,
      'Fully Depreciated': asset.depreciation?.isFullyDepreciated ? 'Yes' : 'No',
      'Status': asset.status || '',
      'Purchase Date': asset.purchase_date ? new Date(asset.purchase_date).toLocaleDateString() : ''
    }));
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Depreciation');
    XLSX.writeFile(wb, 'depreciation_report.xlsx');
    toast.success(t.exportSuccess || 'Data exported successfully');
  };

  const closeFinancialYear = async () => {
    // In real app, this would close the financial year and move depreciation forward
    toast.info(t.closeYearInfo || 'Financial year closing would be processed here');
  };

  // Filtered assets
  const filteredAssets = useMemo(() => {
    let result = assets;
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(a => 
        a.name?.toLowerCase().includes(term) ||
        a.asset_tag?.toLowerCase().includes(term)
      );
    }
    
    if (filters.department) {
      result = result.filter(a => a.department_name === filters.department);
    }
    if (filters.category) {
      result = result.filter(a => a.category_name === filters.category);
    }
    if (filters.fullyDepreciated) {
      result = result.filter(a => a.depreciation?.isFullyDepreciated);
    }
    if (filters.ageRange) {
      const [min, max] = filters.ageRange.split('-').map(Number);
      result = result.filter(a => {
        const age = parseFloat(a.depreciation?.yearsSincePurchase || 0);
        return age >= min && (max ? age <= max : true);
      });
    }
    
    return result;
  }, [assets, searchTerm, filters]);

  // Summary statistics
  const summary = useMemo(() => {
    const totalCost = assets.reduce((sum, a) => sum + (a.purchase_cost || 0), 0);
    const totalBookValue = assets.reduce((sum, a) => sum + (a.depreciation?.bookValue || 0), 0);
    const totalDepreciation = assets.reduce((sum, a) => sum + (a.depreciation?.accumulatedDepreciation || 0), 0);
    const fullyDepreciated = assets.filter(a => a.depreciation?.isFullyDepreciated).length;
    
    return {
      totalCost,
      totalBookValue,
      totalDepreciation,
      fullyDepreciated,
      totalAssets: assets.length,
      avgDepreciationRate: totalCost > 0 ? (totalDepreciation / totalCost) * 100 : 0
    };
  }, [assets]);

  // Chart data
  const chartData = {
    topAssets: {
      labels: filteredAssets.slice(0, 15).map(a => a.asset_tag),
      datasets: [
        {
          label: t.purchaseCost,
          data: filteredAssets.slice(0, 15).map(a => a.purchase_cost || 0),
          backgroundColor: isDark ? 'rgba(99, 179, 237, 0.8)' : 'rgba(43, 108, 176, 0.8)',
          borderColor: isDark ? '#63b3ed' : '#2b6cb0',
          borderWidth: 1
        },
        {
          label: t.bookValue,
          data: filteredAssets.slice(0, 15).map(a => a.depreciation?.bookValue || 0),
          backgroundColor: isDark ? 'rgba(104, 211, 145, 0.8)' : 'rgba(56, 161, 105, 0.8)',
          borderColor: isDark ? '#68d391' : '#38a169',
          borderWidth: 1
        }
      ]
    },
    depreciationByCategory: {
      labels: [...new Set(assets.map(a => a.category_name).filter(Boolean))],
      datasets: [{
        label: t.depreciationByCategory,
        data: [...new Set(assets.map(a => a.category_name).filter(Boolean))].map(cat => {
          const catAssets = assets.filter(a => a.category_name === cat);
          return catAssets.reduce((sum, a) => sum + (a.depreciation?.accumulatedDepreciation || 0), 0);
        }),
        backgroundColor: ['#63b3ed', '#68d391', '#f6ad55', '#fc8181', '#b794f4', '#81e6d9'],
        borderColor: isDark ? '#1e2d45' : '#ffffff',
        borderWidth: 2
      }]
    },
    depreciationTrend: {
      labels: Array.from({ length: 10 }, (_, i) => {
        const date = new Date();
        date.setFullYear(date.getFullYear() - i);
        return date.getFullYear();
      }).reverse(),
      datasets: [{
        label: t.annualDepreciation,
        data: Array.from({ length: 10 }, (_, i) => {
          const year = new Date().getFullYear() - i;
          const yearAssets = assets.filter(a => {
            const purchaseYear = a.purchase_date ? new Date(a.purchase_date).getFullYear() : 0;
            return purchaseYear <= year;
          });
          return yearAssets.reduce((sum, a) => sum + (a.depreciation?.annualDepreciation || 0), 0);
        }).reverse(),
        borderColor: isDark ? '#63b3ed' : '#2b6cb0',
        backgroundColor: isDark ? 'rgba(99, 179, 237, 0.1)' : 'rgba(43, 108, 176, 0.1)',
        fill: true,
        tension: 0.4
      }]
    }
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
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

  const getStatusColor = (status) => {
    const colors = {
      'Active': isDark ? 'rgba(104, 211, 145, 0.2)' : 'rgba(104, 211, 145, 0.1)',
      'Inactive': isDark ? 'rgba(252, 129, 129, 0.2)' : 'rgba(252, 129, 129, 0.1)',
      'Under Maintenance': isDark ? 'rgba(246, 173, 85, 0.2)' : 'rgba(246, 173, 85, 0.1)'
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
    closeButton: {
      background: 'linear-gradient(135deg, #fc8181, #e53e3e)',
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
      flex: '1 1 200px',
      outline: 'none'
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
      minWidth: '130px'
    },
    filterCheckbox: {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      color: isDark ? '#c8dcf5' : '#1a365d',
      fontSize: '0.9rem',
      cursor: 'pointer'
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
    chartsRow: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
      gap: '20px',
      marginBottom: '20px'
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
    depreciationBar: {
      height: '6px',
      background: isDark ? '#2d4a6f' : '#e8edf5',
      borderRadius: '3px',
      overflow: 'hidden',
      marginTop: '4px',
      width: '100px'
    },
    depreciationBarFill: {
      height: '100%',
      borderRadius: '3px',
      transition: 'width 0.3s'
    },
    emptyState: {
      textAlign: 'center',
      padding: '60px 20px',
      color: isDark ? '#8896b0' : '#4a5568'
    },
    // Modal styles
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
      maxWidth: '1000px',
      width: '100%',
      maxHeight: '85vh',
      overflow: 'auto',
      border: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`
    },
    modalHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '20px'
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
      paddingBottom: '4px'
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
      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
      gap: '12px',
      marginBottom: '20px'
    },
    infoItem: {
      padding: '12px',
      background: isDark ? '#141e2d' : '#f7fafc',
      borderRadius: '8px'
    },
    infoLabel: {
      color: isDark ? '#8896b0' : '#4a5568',
      fontSize: '0.7rem',
      textTransform: 'uppercase',
      letterSpacing: '0.5px'
    },
    infoValue: {
      color: isDark ? '#c8dcf5' : '#1a365d',
      fontSize: '1rem',
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
      outline: 'none'
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
    scheduleTable: {
      width: '100%',
      borderCollapse: 'collapse',
      marginTop: '12px'
    },
    scheduleTh: {
      padding: '8px 12px',
      textAlign: 'left',
      color: isDark ? '#c8dcf5' : '#1a365d',
      fontWeight: 600,
      borderBottom: `2px solid ${isDark ? '#32465f' : '#e8edf5'}`,
      background: isDark ? '#141e2d' : '#f7fafc',
      fontSize: '0.75rem'
    },
    scheduleTd: {
      padding: '8px 12px',
      borderBottom: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
      color: isDark ? '#c8dcf5' : '#1a365d',
      fontSize: '0.85rem'
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
          <h1 style={styles.title}>📉 {t.depreciation}</h1>
          <p style={styles.subtitle}>{t.depreciationDesc}</p>
        </div>
        <div style={styles.headerActions}>
          <button style={styles.exportButton} onClick={exportToExcel}>
            📥 {t.exportExcel}
          </button>
          <button style={styles.closeButton} onClick={closeFinancialYear}>
            📅 {t.closeFinancialYear}
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
          <div style={styles.statLabel}>{t.totalPurchaseCost}</div>
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
            {summary.fullyDepreciated}
          </div>
          <div style={styles.statLabel}>{t.fullyDepreciated}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statNumber}>{summary.avgDepreciationRate.toFixed(1)}%</div>
          <div style={styles.statLabel}>{t.avgDepreciationRate}</div>
        </div>
      </div>

      {/* Charts */}
      <div style={styles.chartsRow}>
        <div style={styles.chartCard}>
          <h3 style={styles.chartTitle}>{t.costComparison}</h3>
          <div style={{ height: '260px' }}>
            <Bar data={chartData.topAssets} options={chartOptions} />
          </div>
        </div>
        <div style={styles.chartCard}>
          <h3 style={styles.chartTitle}>{t.depreciationByCategory}</h3>
          <div style={{ height: '260px' }}>
            <Doughnut data={chartData.depreciationByCategory} options={chartOptions} />
          </div>
        </div>
      </div>

      <div style={styles.chartCard}>
        <h3 style={styles.chartTitle}>{t.depreciationTrend}</h3>
        <div style={{ height: '240px' }}>
          <Line data={chartData.depreciationTrend} options={chartOptions} />
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
          value={filters.ageRange}
          onChange={(e) => setFilters(prev => ({ ...prev, ageRange: e.target.value }))}
        >
          <option value="">{t.allAges}</option>
          <option value="0-2">0-2 {t.years}</option>
          <option value="2-5">2-5 {t.years}</option>
          <option value="5-10">5-10 {t.years}</option>
          <option value="10-">10+ {t.years}</option>
        </select>
        <label style={styles.filterCheckbox}>
          <input
            type="checkbox"
            checked={filters.fullyDepreciated}
            onChange={(e) => setFilters(prev => ({ ...prev, fullyDepreciated: e.target.checked }))}
          />
          {t.showFullyDepreciated}
        </label>
        <select
          style={styles.filterSelect}
          value={depreciationMethod}
          onChange={(e) => setDepreciationMethod(e.target.value)}
        >
          <option value="straight-line">{t.straightLine}</option>
          <option value="reducing-balance">{t.reducingBalance}</option>
          <option value="declining-balance">{t.decliningBalance}</option>
        </select>
      </div>

      {/* Assets Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>{t.assetTag}</th>
              <th style={styles.th}>{t.name}</th>
              <th style={styles.th}>{t.purchaseCost}</th>
              <th style={styles.th}>{t.annualDepreciation}</th>
              <th style={styles.th}>{t.accumulatedDepreciation}</th>
              <th style={styles.th}>{t.bookValue}</th>
              <th style={styles.th}>{t.depreciationPct}</th>
              <th style={styles.th}>{t.age}</th>
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
                  onClick={() => {
                    setSelectedAsset(asset);
                    setShowModal(true);
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={styles.td}>
                    <span style={styles.assetTag}>{asset.asset_tag}</span>
                  </td>
                  <td style={styles.td}>{asset.name}</td>
                  <td style={styles.td}>${(asset.purchase_cost || 0).toLocaleString()}</td>
                  <td style={styles.td}>${(asset.depreciation?.annualDepreciation || 0).toLocaleString()}</td>
                  <td style={styles.td}>${(asset.depreciation?.accumulatedDepreciation || 0).toLocaleString()}</td>
                  <td style={styles.td}>
                    <strong>${(asset.depreciation?.bookValue || 0).toLocaleString()}</strong>
                    <div style={styles.depreciationBar}>
                      <div style={{
                        ...styles.depreciationBarFill,
                        width: `${Math.min(asset.depreciation?.depreciationPercentage || 0, 100)}%`,
                        background: (asset.depreciation?.depreciationPercentage || 0) > 70 ? '#fc8181' : 
                                   (asset.depreciation?.depreciationPercentage || 0) > 40 ? '#ed8936' : '#48bb78'
                      }} />
                    </div>
                  </td>
                  <td style={styles.td}>{asset.depreciation?.depreciationPercentage || 0}%</td>
                  <td style={styles.td}>
                    {asset.depreciation?.yearsSincePurchase || 0} {t.years}
                    {asset.depreciation?.isFullyDepreciated && (
                      <span style={{ color: '#fc8181', marginLeft: '6px' }}>🔴</span>
                    )}
                  </td>
                  <td style={styles.td}>
                    <span style={{
                      ...styles.statusBadge,
                      background: getStatusColor(asset.status),
                      color: asset.status === 'Active' ? '#48bb78' :
                             asset.status === 'Inactive' ? '#fc8181' : '#ed8936'
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

      {/* Depreciation Detail Modal */}
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
                style={{ ...styles.modalTab, ...(true ? styles.modalTabActive : {}) }}
                onClick={() => {}}
              >
                {t.depreciationDetails}
              </button>
              <button 
                style={styles.modalTab}
                onClick={() => setShowSchedule(!showSchedule)}
              >
                {t.depreciationSchedule}
              </button>
              <button 
                style={styles.modalTab}
                onClick={() => setShowSchedule(!showSchedule)}
              >
                {t.manualAdjustment}
              </button>
            </div>

            {/* Depreciation Details */}
            <div>
              <div style={styles.infoGrid}>
                <div style={styles.infoItem}>
                  <div style={styles.infoLabel}>{t.purchaseCost}</div>
                  <div style={styles.infoValue}>${(selectedAsset.purchase_cost || 0).toLocaleString()}</div>
                </div>
                <div style={styles.infoItem}>
                  <div style={styles.infoLabel}>{t.residualValue}</div>
                  <div style={styles.infoValue}>${(selectedAsset.residual_value || 0).toLocaleString()}</div>
                </div>
                <div style={styles.infoItem}>
                  <div style={styles.infoLabel}>{t.usefulLife}</div>
                  <div style={styles.infoValue}>{selectedAsset.useful_life || 0} {t.years}</div>
                </div>
                <div style={styles.infoItem}>
                  <div style={styles.infoLabel}>{t.depreciationMethod}</div>
                  <div style={styles.infoValue}>{selectedAsset.depreciation_method || 'Straight-line'}</div>
                </div>
                <div style={styles.infoItem}>
                  <div style={styles.infoLabel}>{t.annualDepreciation}</div>
                  <div style={styles.infoValue}>${(selectedAsset.depreciation?.annualDepreciation || 0).toLocaleString()}</div>
                </div>
                <div style={styles.infoItem}>
                  <div style={styles.infoLabel}>{t.accumulatedDepreciation}</div>
                  <div style={styles.infoValue}>${(selectedAsset.depreciation?.accumulatedDepreciation || 0).toLocaleString()}</div>
                </div>
                <div style={styles.infoItem}>
                  <div style={styles.infoLabel}>{t.bookValue}</div>
                  <div style={{ ...styles.infoValue, color: '#48bb78' }}>
                    ${(selectedAsset.depreciation?.bookValue || 0).toLocaleString()}
                  </div>
                </div>
                <div style={styles.infoItem}>
                  <div style={styles.infoLabel}>{t.yearsSincePurchase}</div>
                  <div style={styles.infoValue}>{selectedAsset.depreciation?.yearsSincePurchase || 0} {t.years}</div>
                </div>
                <div style={styles.infoItem}>
                  <div style={styles.infoLabel}>{t.yearsRemaining}</div>
                  <div style={styles.infoValue}>{selectedAsset.depreciation?.yearsRemaining || 0} {t.years}</div>
                </div>
                <div style={styles.infoItem}>
                  <div style={styles.infoLabel}>{t.depreciationPct}</div>
                  <div style={styles.infoValue}>{selectedAsset.depreciation?.depreciationPercentage || 0}%</div>
                </div>
                <div style={styles.infoItem}>
                  <div style={styles.infoLabel}>{t.status}</div>
                  <div style={styles.infoValue}>
                    {selectedAsset.depreciation?.isFullyDepreciated ? 
                      <span style={{ color: '#fc8181' }}>🔴 {t.fullyDepreciated}</span> : 
                      <span style={{ color: '#48bb78' }}>🟢 {t.active}</span>
                    }
                  </div>
                </div>
                <div style={styles.infoItem}>
                  <div style={styles.infoLabel}>{t.purchaseDate}</div>
                  <div style={styles.infoValue}>
                    {selectedAsset.purchase_date ? new Date(selectedAsset.purchase_date).toLocaleDateString() : '-'}
                  </div>
                </div>
              </div>

              <div style={styles.modalActions}>
                <button style={styles.buttonSecondary} onClick={() => {
                  handleRecalculate(selectedAsset);
                }}>
                  🔄 {t.recalculate}
                </button>
                <button style={styles.buttonWarning} onClick={() => {
                  setFormData({
                    annual_depreciation: selectedAsset.depreciation?.annualDepreciation || 0,
                    accumulated_depreciation: selectedAsset.depreciation?.accumulatedDepreciation || 0,
                    book_value: selectedAsset.depreciation?.bookValue || 0,
                    adjustment_notes: '',
                    adjustment_date: new Date().toISOString().split('T')[0]
                  });
                }}>
                  ✏️ {t.manualAdjustment}
                </button>
                <button style={styles.buttonSuccess} onClick={() => setShowSchedule(!showSchedule)}>
                  📅 {t.viewSchedule}
                </button>
              </div>
            </div>

            {/* Depreciation Schedule */}
            {showSchedule && schedule.length > 0 && (
              <div style={{ marginTop: '20px' }}>
                <h4 style={{ color: isDark ? '#c8dcf5' : '#1a365d', marginBottom: '12px' }}>
                  {t.depreciationSchedule}
                </h4>
                <div style={{ overflowX: 'auto' }}>
                  <table style={styles.scheduleTable}>
                    <thead>
                      <tr>
                        <th style={styles.scheduleTh}>{t.year}</th>
                        <th style={styles.scheduleTh}>{t.startValue}</th>
                        <th style={styles.scheduleTh}>{t.annualDepreciation}</th>
                        <th style={styles.scheduleTh}>{t.accumulatedDepreciation}</th>
                        <th style={styles.scheduleTh}>{t.bookValue}</th>
                        <th style={styles.scheduleTh}>{t.status}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schedule.map((item, index) => (
                        <tr key={index} style={{
                          background: item.isFullyDepreciated ? 
                            (isDark ? 'rgba(252, 129, 129, 0.1)' : 'rgba(252, 129, 129, 0.05)') : 
                            'transparent'
                        }}>
                          <td style={styles.scheduleTd}>{item.period}</td>
                          <td style={styles.scheduleTd}>${item.startValue.toLocaleString()}</td>
                          <td style={styles.scheduleTd}>${item.annualDepreciation.toLocaleString()}</td>
                          <td style={styles.scheduleTd}>${item.accumulatedDepreciation.toLocaleString()}</td>
                          <td style={styles.scheduleTd}>
                            <strong>${item.bookValue.toLocaleString()}</strong>
                          </td>
                          <td style={styles.scheduleTd}>
                            {item.isFullyDepreciated ? 
                              <span style={{ color: '#fc8181' }}>{t.fullyDepreciated}</span> : 
                              <span style={{ color: '#48bb78' }}>{t.active}</span>
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
  depreciation: 'Depreciation View',
  depreciationDesc: 'Track asset value loss over time with multiple depreciation methods',
  totalAssets: 'Total Assets',
  totalPurchaseCost: 'Total Purchase Cost',
  totalBookValue: 'Total Book Value',
  totalDepreciation: 'Total Depreciation',
  fullyDepreciated: 'Fully Depreciated',
  avgDepreciationRate: 'Avg Depreciation Rate',
  searchPlaceholder: 'Search by name or tag...',
  allDepartments: 'All Departments',
  allCategories: 'All Categories',
  allAges: 'All Ages',
  showFullyDepreciated: 'Show Fully Depreciated',
  straightLine: 'Straight-Line',
  reducingBalance: 'Reducing Balance',
  decliningBalance: 'Declining Balance',
  assetTag: 'Asset Tag',
  name: 'Name',
  purchaseCost: 'Purchase Cost',
  annualDepreciation: 'Annual Dep.',
  accumulatedDepreciation: 'Accumulated Dep.',
  bookValue: 'Book Value',
  depreciationPct: 'Depreciation %',
  age: 'Age',
  years: 'years',
  status: 'Status',
  loading: 'Loading...',
  noAssets: 'No assets found',
  exportExcel: 'Export to Excel',
  closeFinancialYear: 'Close Financial Year',
  fetchError: 'Failed to load assets',
  exportSuccess: 'Data exported successfully',
  recalcSuccess: 'Depreciation recalculated',
  adjustmentSuccess: 'Depreciation adjusted successfully',
  adjustmentError: 'Failed to adjust depreciation',
  closeYearInfo: 'Financial year closing would be processed here',
  
  // Modal translations
  depreciationDetails: 'Depreciation Details',
  depreciationSchedule: 'Depreciation Schedule',
  manualAdjustment: 'Manual Adjustment',
  residualValue: 'Residual Value',
  usefulLife: 'Useful Life',
  depreciationMethod: 'Depreciation Method',
  yearsSincePurchase: 'Years Since Purchase',
  yearsRemaining: 'Years Remaining',
  purchaseDate: 'Purchase Date',
  active: 'Active',
  recalculate: 'Recalculate',
  viewSchedule: 'View Schedule',
  year: 'Year',
  startValue: 'Start Value',
  costComparison: 'Purchase Cost vs Book Value',
  depreciationByCategory: 'Depreciation by Category',
  depreciationTrend: 'Depreciation Trend (10 Years)',
  purchaseCost: 'Purchase Cost',
  currentValue: 'Current Value'
};

const amharicTranslations = {
  depreciation: 'የእሴት መቀነስ እይታ',
  depreciationDesc: 'በብዙ የእሴት መቀነስ ዘዴዎች የንብረት እሴት መቀነስን በጊዜ ሂደት ይከታተሉ',
  totalAssets: 'ጠቅላላ ንብረቶች',
  totalPurchaseCost: 'ጠቅላላ የግዢ ዋጋ',
  totalBookValue: 'ጠቅላላ የመጽሐፍ ዋጋ',
  totalDepreciation: 'ጠቅላላ የእሴት መቀነስ',
  fullyDepreciated: 'ሙሉ በሙሉ የተቀነሰ',
  avgDepreciationRate: 'አማካኝ የእሴት መቀነስ መጠን',
  searchPlaceholder: 'በስም ወይም በመለያ ይፈልጉ...',
  allDepartments: 'ሁሉም ክፍሎች',
  allCategories: 'ሁሉም ምድቦች',
  allAges: 'ሁሉም ዕድሜዎች',
  showFullyDepreciated: 'ሙሉ በሙሉ የተቀነሱትን አሳይ',
  straightLine: 'ቀጥተኛ መስመር',
  reducingBalance: 'እየቀነሰ የሚሄድ ቀሪ',
  decliningBalance: 'እየቀነሰ የሚሄድ ሚዛን',
  assetTag: 'የንብረት መለያ',
  name: 'ስም',
  purchaseCost: 'የግዢ ዋጋ',
  annualDepreciation: 'ዓመታዊ ቅናሽ',
  accumulatedDepreciation: 'የተጠራቀመ ቅናሽ',
  bookValue: 'የመጽሐፍ ዋጋ',
  depreciationPct: 'የቅናሽ %',
  age: 'ዕድሜ',
  years: 'ዓመታት',
  status: 'ሁኔታ',
  loading: 'በመጫን ላይ...',
  noAssets: 'ምንም ንብረቶች አልተገኙም',
  exportExcel: 'ወደ Excel ላክ',
  closeFinancialYear: 'የፋይናንስ ዓመት ዝጋ',
  fetchError: 'ንብረቶች መጫን አልተቻለም',
  exportSuccess: 'ውሂብ በተሳካ ሁኔታ ተላከ',
  recalcSuccess: 'የእሴት መቀነስ እንደገና ተሰላ',
  adjustmentSuccess: 'የእሴት መቀነስ በተሳካ ሁኔታ ተስተካክሏል',
  adjustmentError: 'የእሴት መቀነስ ማስተካከል አልተቻለም',
  closeYearInfo: 'የፋይናንስ ዓመት መዝጊያ እዚህ ላይ ይከናወናል',
  
  // Modal translations
  depreciationDetails: 'የእሴት መቀነስ ዝርዝሮች',
  depreciationSchedule: 'የእሴት መቀነስ መርሐግብር',
  manualAdjustment: 'በእጅ ማስተካከያ',
  residualValue: 'ቀሪ ዋጋ',
  usefulLife: 'ጠቃሚ ህይወት',
  depreciationMethod: 'የእሴት መቀነስ ዘዴ',
  yearsSincePurchase: 'ከግዢ ጀምሮ ያሉ ዓመታት',
  yearsRemaining: 'የቀሩ ዓመታት',
  purchaseDate: 'የግዢ ቀን',
  active: 'ንቁ',
  recalculate: 'እንደገና አስላ',
  viewSchedule: 'መርሐግብር ይመልከቱ',
  year: 'ዓመት',
  startValue: 'የመጀመሪያ ዋጋ',
  costComparison: 'የግዢ ዋጋ እና የመጽሐፍ ዋጋ',
  depreciationByCategory: 'በምድብ የእሴት መቀነስ',
  depreciationTrend: 'የእሴት መቀነስ አዝማሚያ (10 ዓመታት)',
  purchaseCost: 'የግዢ ዋጋ',
  currentValue: 'የአሁኑ ዋጋ'
};

export default FinanceDepreciation;