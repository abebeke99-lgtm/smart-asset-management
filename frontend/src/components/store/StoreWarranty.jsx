import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/UiContext';
import { toast } from 'react-toastify';
import axios from 'axios';
import * as XLSX from 'xlsx';

const StoreWarranty = () => {
  const { user } = useAuth();
  const { language, theme } = useLanguage();
  const isDark = theme === 'dark';
  const t = language === 'en' ? englishTranslations : amharicTranslations;

  // State
  const [warranties, setWarranties] = useState([]);
  const [filteredWarranties, setFilteredWarranties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('active');
  const [selectedWarranty, setSelectedWarranty] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Fetch warranties
  useEffect(() => {
    fetchWarranties();
  }, []);

  const fetchWarranties = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/assets', { params: { limit: 500 } });
      const assets = response.data.assets || response.data.data || [];

      // Filter assets with warranty information
      const warrantyData = assets
        .filter((asset) => asset.warranty || asset.warrantyExpiry || asset.warrantyProvider)
        .map((asset) => ({
          id: asset.id,
          assetCode: asset.assetCode || asset.asset_code || 'N/A',
          assetName: asset.name || asset.assetName || 'N/A',
          category: asset.category || 'N/A',
          warrantyProvider: asset.warrantyProvider || asset.warranty_provider || 'N/A',
          warrantyNumber: asset.warrantyNumber || asset.warranty_number || 'N/A',
          purchaseDate: asset.purchaseDate || asset.purchase_date || '',
          warrantyStartDate: asset.purchaseDate || asset.purchase_date || '',
          warrantyEndDate: asset.warrantyExpiry || asset.warranty_expiry || '',
          coverage: asset.warranty || asset.coverage || 'N/A',
          cost: asset.purchasePrice || asset.purchase_price || 0,
          status: getWarrantyStatus(asset.warrantyExpiry || asset.warranty_expiry),
          notes: asset.notes || ''
        }));

      setWarranties(warrantyData);
    } catch (error) {
      toast.error(t.fetchError || 'Failed to load warranty data');
      setWarranties([]);
    } finally {
      setLoading(false);
    }
  };

  const getWarrantyStatus = (expiryDate) => {
    if (!expiryDate) return 'unknown';
    const today = new Date();
    const expiry = new Date(expiryDate);
    const diffTime = expiry - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'expired';
    if (diffDays <= 30) return 'expiring-soon';
    return 'active';
  };

  // Filter and search
  useEffect(() => {
    let filtered = warranties;

    if (activeTab === 'active') {
      filtered = filtered.filter((w) => w.status === 'active');
    } else if (activeTab === 'expiring') {
      filtered = filtered.filter((w) => w.status === 'expiring-soon');
    } else if (activeTab === 'expired') {
      filtered = filtered.filter((w) => w.status === 'expired');
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (w) =>
          (w.assetCode || '').toLowerCase().includes(query) ||
          (w.assetName || '').toLowerCase().includes(query) ||
          (w.category || '').toLowerCase().includes(query) ||
          (w.warrantyProvider || '').toLowerCase().includes(query)
      );
    }

    setFilteredWarranties(filtered);
  }, [warranties, activeTab, searchQuery]);

  // Calculate statistics
  const stats = useMemo(() => {
    return {
      total: warranties.length,
      active: warranties.filter((w) => w.status === 'active').length,
      expiring: warranties.filter((w) => w.status === 'expiring-soon').length,
      expired: warranties.filter((w) => w.status === 'expired').length
    };
  }, [warranties]);

  // Export to Excel
  const handleExport = () => {
    try {
      const exportData = filteredWarranties.map((w) => ({
        'Asset Tag': w.assetCode || '',
        'Asset Name': w.assetName || '',
        'Category': w.category || '',
        'Warranty Provider': w.warrantyProvider || '',
        'Warranty Number': w.warrantyNumber || '',
        'Start Date': w.warrantyStartDate
          ? new Date(w.warrantyStartDate).toLocaleDateString()
          : '',
        'End Date': w.warrantyEndDate ? new Date(w.warrantyEndDate).toLocaleDateString() : '',
        'Coverage': w.coverage || '',
        'Status': w.status || ''
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Warranties');
      XLSX.writeFile(
        wb,
        `store_warranties_${new Date().toISOString().split('T')[0]}.xlsx`
      );
      toast.success(t.exportSuccess || 'Exported successfully');
    } catch (error) {
      toast.error(t.exportError || 'Export failed');
    }
  };

  const styles = {
    container: {
      padding: isDark ? '20px' : '24px',
      background: isDark ? '#1a1a2e' : '#ffffff',
      borderRadius: '12px',
      boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(0,0,0,0.08)'
    },
    header: {
      marginBottom: '24px',
      paddingBottom: '16px',
      borderBottom: isDark ? '1px solid #333' : '1px solid #e2e8f0'
    },
    title: {
      fontSize: '24px',
      fontWeight: '700',
      color: isDark ? '#fff' : '#1a365d',
      margin: '0 0 8px 0'
    },
    subtitle: {
      fontSize: '14px',
      color: isDark ? '#aaa' : '#5a6b8a',
      margin: 0
    },
    statsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
      gap: '16px',
      marginBottom: '24px'
    },
    statCard: (color) => ({
      padding: '16px',
      borderRadius: '8px',
      background: isDark ? '#2a2a3e' : '#f7fafc',
      border: isDark ? `2px solid ${color}20` : `2px solid ${color}30`,
      textAlign: 'center'
    }),
    statValue: (color) => ({
      fontSize: '28px',
      fontWeight: '700',
      color: color,
      margin: '0 0 8px 0'
    }),
    statLabel: {
      fontSize: '12px',
      color: isDark ? '#aaa' : '#5a6b8a',
      margin: 0
    },
    tabs: {
      display: 'flex',
      gap: '12px',
      marginBottom: '20px',
      borderBottom: isDark ? '1px solid #333' : '1px solid #e2e8f0',
      flexWrap: 'wrap'
    },
    tab: (active) => ({
      padding: '12px 16px',
      background: 'transparent',
      border: 'none',
      borderBottom: active ? '3px solid #2b6cb0' : '3px solid transparent',
      color: active ? '#2b6cb0' : isDark ? '#aaa' : '#5a6b8a',
      cursor: 'pointer',
      fontWeight: active ? '600' : '500',
      fontSize: '14px'
    }),
    controls: {
      display: 'flex',
      gap: '12px',
      marginBottom: '20px',
      flexWrap: 'wrap',
      alignItems: 'center'
    },
    searchInput: {
      flex: 1,
      minWidth: '250px',
      padding: '10px 12px',
      border: isDark ? '1px solid #444' : '1px solid #cbd5e1',
      borderRadius: '8px',
      background: isDark ? '#2a2a3e' : '#fff',
      color: isDark ? '#fff' : '#000',
      fontSize: '14px'
    },
    button: {
      padding: '10px 16px',
      borderRadius: '8px',
      border: 'none',
      cursor: 'pointer',
      fontWeight: '600',
      fontSize: '14px',
      transition: 'all 0.2s'
    },
    primaryButton: {
      background: '#2b6cb0',
      color: '#fff'
    },
    secondaryButton: {
      background: isDark ? '#444' : '#e2e8f0',
      color: isDark ? '#fff' : '#1a365d'
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse',
      marginTop: '16px'
    },
    th: {
      padding: '12px',
      textAlign: 'left',
      background: isDark ? '#2a2a3e' : '#f7fafc',
      color: isDark ? '#fff' : '#1a365d',
      fontWeight: '600',
      fontSize: '13px',
      borderBottom: isDark ? '1px solid #444' : '1px solid #e2e8f0'
    },
    td: {
      padding: '12px',
      borderBottom: isDark ? '1px solid #333' : '1px solid #e2e8f0',
      color: isDark ? '#ddd' : '#2d3748',
      fontSize: '14px'
    },
    statusBadge: (status) => {
      const colors = {
        active: { bg: '#dcfce7', color: '#166534' },
        'expiring-soon': { bg: '#fef3c7', color: '#92400e' },
        expired: { bg: '#fee2e2', color: '#991b1b' },
        unknown: { bg: '#e5e7eb', color: '#374151' }
      };
      const style = colors[status] || colors.unknown;
      return {
        display: 'inline-block',
        padding: '6px 12px',
        borderRadius: '12px',
        background: style.bg,
        color: style.color,
        fontWeight: '600',
        fontSize: '12px'
      };
    },
    modal: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    },
    modalContent: {
      background: isDark ? '#2a2a3e' : '#fff',
      borderRadius: '12px',
      padding: '24px',
      maxWidth: '600px',
      width: '90%',
      maxHeight: '90vh',
      overflow: 'auto'
    },
    modalHeader: {
      fontSize: '18px',
      fontWeight: '700',
      marginBottom: '16px',
      color: isDark ? '#fff' : '#1a365d'
    },
    detailGrid: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '16px',
      marginBottom: '20px'
    },
    detailItem: {
      marginBottom: '12px'
    },
    detailLabel: {
      fontWeight: '600',
      color: isDark ? '#aaa' : '#5a6b8a',
      fontSize: '12px',
      marginBottom: '4px'
    },
    detailValue: {
      color: isDark ? '#fff' : '#1a365d',
      fontSize: '14px'
    },
    emptyState: {
      textAlign: 'center',
      padding: '40px 20px',
      color: isDark ? '#aaa' : '#4a5568'
    }
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>🛡️ {t.warranty}</h1>
        <p style={styles.subtitle}>{t.warrantyDesc || 'Track and manage asset warranties'}</p>
      </div>

      {/* Stats */}
      {!loading && (
        <div style={styles.statsGrid}>
          <div style={styles.statCard('#2b6cb0')}>
            <p style={styles.statValue('#2b6cb0')}>{stats.active}</p>
            <p style={styles.statLabel}>{t.activeWarranties || 'Active'}</p>
          </div>
          <div style={styles.statCard('#f59e0b')}>
            <p style={styles.statValue('#f59e0b')}>{stats.expiring}</p>
            <p style={styles.statLabel}>{t.expiringWarranties || 'Expiring Soon'}</p>
          </div>
          <div style={styles.statCard('#ef4444')}>
            <p style={styles.statValue('#ef4444')}>{stats.expired}</p>
            <p style={styles.statLabel}>{t.expiredWarranties || 'Expired'}</p>
          </div>
          <div style={styles.statCard('#6366f1')}>
            <p style={styles.statValue('#6366f1')}>{stats.total}</p>
            <p style={styles.statLabel}>{t.total || 'Total'}</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={styles.tabs}>
        <button
          style={styles.tab(activeTab === 'active')}
          onClick={() => setActiveTab('active')}
        >
          ✅ {t.activeTab || 'Active'} ({stats.active})
        </button>
        <button
          style={styles.tab(activeTab === 'expiring')}
          onClick={() => setActiveTab('expiring')}
        >
          ⚠️ {t.expiringTab || 'Expiring Soon'} ({stats.expiring})
        </button>
        <button
          style={styles.tab(activeTab === 'expired')}
          onClick={() => setActiveTab('expired')}
        >
          ❌ {t.expiredTab || 'Expired'} ({stats.expired})
        </button>
      </div>

      {/* Controls */}
      <div style={styles.controls}>
        <input
          type="text"
          style={styles.searchInput}
          placeholder={t.search || 'Search by asset, category, or provider...'}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <button
          style={{ ...styles.button, ...styles.secondaryButton }}
          onClick={handleExport}
        >
          📥 {t.export || 'Export'}
        </button>
      </div>

      {/* Loading State */}
      {loading && (
        <div style={styles.emptyState}>
          {t.loading || 'Loading...'}
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredWarranties.length === 0 && (
        <div style={styles.emptyState}>
          {t.noWarranties || 'No warranties found in this category'}
        </div>
      )}

      {/* Table */}
      {!loading && filteredWarranties.length > 0 && (
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>{t.assetTag || 'Asset Tag'}</th>
              <th style={styles.th}>{t.assetName || 'Asset Name'}</th>
              <th style={styles.th}>{t.category || 'Category'}</th>
              <th style={styles.th}>{t.provider || 'Provider'}</th>
              <th style={styles.th}>{t.endDate || 'End Date'}</th>
              <th style={styles.th}>{t.status || 'Status'}</th>
              <th style={styles.th}>{t.actions || 'Actions'}</th>
            </tr>
          </thead>
          <tbody>
            {filteredWarranties.map((w) => (
              <tr key={w.id}>
                <td style={styles.td}>{w.assetCode}</td>
                <td style={styles.td}>{w.assetName}</td>
                <td style={styles.td}>{w.category}</td>
                <td style={styles.td}>{w.warrantyProvider}</td>
                <td style={styles.td}>
                  {w.warrantyEndDate
                    ? new Date(w.warrantyEndDate).toLocaleDateString()
                    : 'N/A'}
                </td>
                <td style={styles.td}>
                  <span style={styles.statusBadge(w.status)}>
                    {w.status === 'active'
                      ? t.activeStatus || 'Active'
                      : w.status === 'expiring-soon'
                      ? t.expiringStatus || 'Expiring Soon'
                      : t.expiredStatus || 'Expired'}
                  </span>
                </td>
                <td style={styles.td}>
                  <button
                    style={{
                      ...styles.button,
                      ...styles.secondaryButton,
                      fontSize: '12px',
                      padding: '6px 12px'
                    }}
                    onClick={() => {
                      setSelectedWarranty(w);
                      setShowDetailModal(true);
                    }}
                  >
                    {t.view || 'View'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedWarranty && (
        <div style={styles.modal} onClick={() => setShowDetailModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>🛡️ {t.warrantyDetails || 'Warranty Details'}</div>

            <div style={styles.detailGrid}>
              <div style={styles.detailItem}>
                <div style={styles.detailLabel}>{t.assetTag || 'Asset Tag'}</div>
                <div style={styles.detailValue}>{selectedWarranty.assetCode}</div>
              </div>
              <div style={styles.detailItem}>
                <div style={styles.detailLabel}>{t.assetName || 'Asset Name'}</div>
                <div style={styles.detailValue}>{selectedWarranty.assetName}</div>
              </div>
              <div style={styles.detailItem}>
                <div style={styles.detailLabel}>{t.category || 'Category'}</div>
                <div style={styles.detailValue}>{selectedWarranty.category}</div>
              </div>
              <div style={styles.detailItem}>
                <div style={styles.detailLabel}>{t.provider || 'Warranty Provider'}</div>
                <div style={styles.detailValue}>{selectedWarranty.warrantyProvider}</div>
              </div>
              <div style={styles.detailItem}>
                <div style={styles.detailLabel}>{t.warrantyNumber || 'Warranty Number'}</div>
                <div style={styles.detailValue}>{selectedWarranty.warrantyNumber}</div>
              </div>
              <div style={styles.detailItem}>
                <div style={styles.detailLabel}>{t.status || 'Status'}</div>
                <div>
                  <span style={styles.statusBadge(selectedWarranty.status)}>
                    {selectedWarranty.status === 'active'
                      ? t.activeStatus || 'Active'
                      : selectedWarranty.status === 'expiring-soon'
                      ? t.expiringStatus || 'Expiring Soon'
                      : t.expiredStatus || 'Expired'}
                  </span>
                </div>
              </div>
              <div style={styles.detailItem}>
                <div style={styles.detailLabel}>{t.startDate || 'Start Date'}</div>
                <div style={styles.detailValue}>
                  {selectedWarranty.warrantyStartDate
                    ? new Date(selectedWarranty.warrantyStartDate).toLocaleDateString()
                    : 'N/A'}
                </div>
              </div>
              <div style={styles.detailItem}>
                <div style={styles.detailLabel}>{t.endDate || 'End Date'}</div>
                <div style={styles.detailValue}>
                  {selectedWarranty.warrantyEndDate
                    ? new Date(selectedWarranty.warrantyEndDate).toLocaleDateString()
                    : 'N/A'}
                </div>
              </div>
              <div style={{ ...styles.detailItem, gridColumn: '1 / -1' }}>
                <div style={styles.detailLabel}>{t.coverage || 'Coverage'}</div>
                <div style={styles.detailValue}>{selectedWarranty.coverage}</div>
              </div>
            </div>

            <div style={{ marginTop: '20px' }}>
              <button
                type="button"
                style={{ ...styles.button, ...styles.secondaryButton }}
                onClick={() => setShowDetailModal(false)}
              >
                {t.close || 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Translations
const englishTranslations = {
  warranty: 'Warranty',
  warrantyDesc: 'Track and manage asset warranties',
  activeWarranties: 'Active Warranties',
  expiringWarranties: 'Expiring Soon',
  expiredWarranties: 'Expired',
  total: 'Total',
  activeTab: 'Active',
  expiringTab: 'Expiring Soon',
  expiredTab: 'Expired',
  search: 'Search by asset, category, or provider...',
  export: 'Export',
  assetTag: 'Asset Tag',
  assetName: 'Asset Name',
  category: 'Category',
  provider: 'Warranty Provider',
  startDate: 'Start Date',
  endDate: 'End Date',
  coverage: 'Coverage',
  status: 'Status',
  actions: 'Actions',
  view: 'View',
  loading: 'Loading...',
  noWarranties: 'No warranties found in this category',
  warrantyDetails: 'Warranty Details',
  close: 'Close',
  warrantyNumber: 'Warranty Number',
  activeStatus: 'Active',
  expiringStatus: 'Expiring Soon',
  expiredStatus: 'Expired',
  fetchError: 'Failed to load warranty data',
  exportSuccess: 'Exported successfully',
  exportError: 'Export failed'
};

const amharicTranslations = {
  warranty: 'ዋስትና',
  warrantyDesc: 'ንብረት ዋስትናዎችን ይከታተሉ እና ያስተዳድሩ',
  activeWarranties: 'ንቁ ዋስትናዎች',
  expiringWarranties: 'ብዙ ውጪ',
  expiredWarranties: 'የሚያልቅ',
  total: 'ጠቅላላ',
  activeTab: 'ንቁ',
  expiringTab: 'ብዙ ውጪ',
  expiredTab: 'የሚያልቅ',
  search: 'በንብረት፣ ምድብ ወይም አቅራቢ ይፈልጉ...',
  export: 'ላክ',
  assetTag: 'የንብረት ትር',
  assetName: 'የንብረት ስም',
  category: 'ምድብ',
  provider: 'ዋስትና አቅራቢ',
  startDate: 'ጀምር ቀን',
  endDate: 'ጨረስ ቀን',
  coverage: 'ሽፋን',
  status: 'ሁኔታ',
  actions: 'ተግባራት',
  view: 'ተመልከት',
  loading: 'በመጫን ላይ...',
  noWarranties: 'በዚህ ምድብ ውስጥ ምንም ዋስትናዎች አልተገኙም',
  warrantyDetails: 'ዋስትና ዝርዝሮች',
  close: 'ዝጋ',
  warrantyNumber: 'ዋስትና ቁጥር',
  activeStatus: 'ንቁ',
  expiringStatus: 'ብዙ ውጪ',
  expiredStatus: 'የሚያልቅ',
  fetchError: 'ዋስትና ውሂብ መጫን አልተቻለም',
  exportSuccess: 'በተሳካ ሁኔታ ተላከ',
  exportError: 'ላክ አልተቻለም'
};

export default StoreWarranty;
