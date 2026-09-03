import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLanguage } from '../../contexts/UiContext';
import { toast } from 'react-toastify';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { getDepartmentLabel } from '../../utils/department';

const StoreAssets = () => {
  const { language, theme } = useLanguage();
  const isDark = theme === 'dark';

  const t = language === 'en' ? englishTranslations : amharicTranslations;

  // ============================================================
  // STATE
  // ============================================================

  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAsset, setSelectedAsset] = useState(null);

  const [activeSection, setActiveSection] = useState('all');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [conditionFilter, setConditionFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');

  const [sortField, setSortField] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // ============================================================
  // API
  // ============================================================

  const fetchAssets = useCallback(async () => {
    setLoading(true);

    try {
      const response = await axios.get('/api/assets', {
        params: {
          limit: 1000
        }
      });

      const data =
        response.data?.assets ||
        response.data?.data ||
        response.data ||
        [];

      setAssets(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch assets:', error);

      toast.error(
        language === 'en'
          ? 'Failed to load assets'
          : 'ንብረቶችን መጫን አልተቻለም'
      );

      setAssets([]);
    } finally {
      setLoading(false);
    }
  }, [language]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  // ============================================================
  // HELPERS
  // ============================================================

  const normalize = (value) =>
    String(value ?? '')
      .trim()
      .toLowerCase();

  const getAssetName = (asset) =>
    asset?.name ||
    asset?.asset_name ||
    asset?.assetName ||
    '-';

  const getAssetTag = (asset) =>
    asset?.asset_tag ||
    asset?.assetTag ||
    asset?.asset_code ||
    asset?.assetCode ||
    '-';

  const getCategory = (asset) =>
    asset?.category_name ||
    asset?.category ||
    asset?.categoryName ||
    '-';

  const getLocation = (asset) =>
    asset?.location_name ||
    asset?.location ||
    asset?.locationName ||
    '-';

  const getStatus = (asset) =>
    asset?.status ||
    asset?.asset_status ||
    'Unknown';

  const getCondition = (asset) =>
    asset?.condition ||
    asset?.asset_condition ||
    'Unknown';

  const getSerialNumber = (asset) =>
    asset?.serial_number ||
    asset?.serialNumber ||
    '-';

  const getBrand = (asset) =>
    asset?.brand ||
    '-';

  const getModel = (asset) =>
    asset?.model ||
    '-';

  const getDepartment = (asset) =>
    asset?.department_name ||
    asset?.department ||
    asset?.departmentName ||
    '-';

  const getSupplier = (asset) =>
    asset?.supplier ||
    asset?.supplier_name ||
    '-';

  const getPurchasePrice = (asset) => {
    const value =
      asset?.purchase_price ??
      asset?.purchasePrice ??
      asset?.price;

    if (value === null || value === undefined || value === '') {
      return '-';
    }

    const number = Number(value);

    if (Number.isNaN(number)) {
      return value;
    }

    return number.toLocaleString();
  };

  const formatDate = (value) => {
    if (!value) return '-';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return '-';
    }

    return date.toLocaleDateString();
  };

  // ============================================================
  // UNIQUE VALUES
  // ============================================================

  const categories = useMemo(() => {
    return [...new Set(
      assets
        .map(getCategory)
        .filter((value) => value && value !== '-')
    )].sort();
  }, [assets]);

  const locations = useMemo(() => {
    return [...new Set(
      assets
        .map(getLocation)
        .filter((value) => value && value !== '-')
    )].sort();
  }, [assets]);

  const statuses = useMemo(() => {
    return [...new Set(
      assets
        .map(getStatus)
        .filter((value) => value && value !== 'Unknown')
    )].sort();
  }, [assets]);

  const conditions = useMemo(() => {
    return [...new Set(
      assets
        .map(getCondition)
        .filter((value) => value && value !== 'Unknown')
    )].sort();
  }, [assets]);

  // ============================================================
  // FILTERED ASSETS
  // ============================================================

  const filteredAssets = useMemo(() => {
    let result = [...assets];

    const query = normalize(search);

    if (query) {
      result = result.filter((asset) => {
        const values = [
          getAssetName(asset),
          getAssetTag(asset),
          getSerialNumber(asset),
          getCategory(asset),
          getLocation(asset),
          getStatus(asset),
          getCondition(asset),
          getBrand(asset),
          getModel(asset),
          getDepartment(asset),
          getSupplier(asset)
        ];

        return values.some((value) =>
          normalize(value).includes(query)
        );
      });
    }

    if (statusFilter !== 'all') {
      result = result.filter(
        (asset) =>
          normalize(getStatus(asset)) ===
          normalize(statusFilter)
      );
    }

    if (conditionFilter !== 'all') {
      result = result.filter(
        (asset) =>
          normalize(getCondition(asset)) ===
          normalize(conditionFilter)
      );
    }

    if (categoryFilter !== 'all') {
      result = result.filter(
        (asset) =>
          normalize(getCategory(asset)) ===
          normalize(categoryFilter)
      );
    }

    if (locationFilter !== 'all') {
      result = result.filter(
        (asset) =>
          normalize(getLocation(asset)) ===
          normalize(locationFilter)
      );
    }

    result.sort((a, b) => {
      let first;
      let second;

      switch (sortField) {
        case 'tag':
          first = getAssetTag(a);
          second = getAssetTag(b);
          break;

        case 'category':
          first = getCategory(a);
          second = getCategory(b);
          break;

        case 'location':
          first = getLocation(a);
          second = getLocation(b);
          break;

        case 'status':
          first = getStatus(a);
          second = getStatus(b);
          break;

        case 'condition':
          first = getCondition(a);
          second = getCondition(b);
          break;

        default:
          first = getAssetName(a);
          second = getAssetName(b);
      }

      const comparison = normalize(first).localeCompare(
        normalize(second)
      );

      return sortDirection === 'asc'
        ? comparison
        : -comparison;
    });

    return result;
  }, [
    assets,
    search,
    statusFilter,
    conditionFilter,
    categoryFilter,
    locationFilter,
    sortField,
    sortDirection
  ]);

  // ============================================================
  // PAGINATION
  // ============================================================

  const totalPages = Math.max(
    1,
    Math.ceil(filteredAssets.length / pageSize)
  );

  const paginatedAssets = useMemo(() => {
    const start = (currentPage - 1) * pageSize;

    return filteredAssets.slice(
      start,
      start + pageSize
    );
  }, [
    filteredAssets,
    currentPage,
    pageSize
  ]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    search,
    statusFilter,
    conditionFilter,
    categoryFilter,
    locationFilter,
    pageSize
  ]);

  // ============================================================
  // SUMMARY
  // ============================================================

  const summary = useMemo(() => {
    const total = assets.length;

    const available = assets.filter((asset) =>
      ['available', 'in stock', 'active'].includes(
        normalize(getStatus(asset))
      ) ||
      asset?.is_available === true
    ).length;

    const issued = assets.filter((asset) =>
      ['issued', 'assigned', 'in use'].includes(
        normalize(getStatus(asset))
      )
    ).length;

    const maintenance = assets.filter((asset) =>
      normalize(getStatus(asset)).includes('maintenance')
    ).length;

    const damaged = assets.filter((asset) =>
      normalize(getCondition(asset)) === 'damaged' ||
      normalize(getStatus(asset)) === 'damaged'
    ).length;

    return {
      total,
      available,
      issued,
      maintenance,
      damaged
    };
  }, [assets]);

  // ============================================================
  // SORT
  // ============================================================

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection((previous) =>
        previous === 'asc' ? 'desc' : 'asc'
      );
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortIndicator = (field) => {
    if (sortField !== field) return '';

    return sortDirection === 'asc'
      ? ' ↑'
      : ' ↓';
  };

  // ============================================================
  // RESET FILTERS
  // ============================================================

  const resetFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setConditionFilter('all');
    setCategoryFilter('all');
    setLocationFilter('all');
    setCurrentPage(1);
  };

  // ============================================================
  // DETAILS
  // ============================================================

  const openDetails = (asset) => {
    setSelectedAsset(asset);
    setActiveSection('details');
  };

  const closeDetails = () => {
    setSelectedAsset(null);
  };

  // ============================================================
  // HISTORY
  // ============================================================

  const fetchAssetHistory = async (asset) => {
    if (!asset) return;

    setHistoryLoading(true);
    setHistory([]);

    const assetId =
      asset.id ||
      asset.asset_id;

    try {
      const response = await axios.get(
        `/api/assets/${assetId}/history`
      );

      const data =
        response.data?.history ||
        response.data?.data ||
        response.data ||
        [];

      setHistory(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(
        'Asset history endpoint unavailable:',
        error
      );

      /*
       * Do not invent history.
       * If the backend does not expose the endpoint,
       * show an empty state instead.
       */

      setHistory([]);

      toast.info(
        language === 'en'
          ? 'No asset history is available.'
          : 'የንብረቱ ታሪክ አልተገኘም።'
      );
    } finally {
      setHistoryLoading(false);
    }
  };

  const openHistory = async (asset) => {
    setSelectedAsset(asset);
    setActiveSection('history');

    await fetchAssetHistory(asset);
  };

  // ============================================================
  // EXPORT
  // ============================================================

  const exportToExcel = () => {
    if (!filteredAssets.length) {
      toast.info(t.noAssets);
      return;
    }

    const data = filteredAssets.map((asset) => ({
      [t.assetId]: asset.id || '',
      [t.assetTag]: getAssetTag(asset),
      [t.assetName]: getAssetName(asset),
      [t.category]: getCategory(asset),
      [t.serialNumber]: getSerialNumber(asset),
      [t.brand]: getBrand(asset),
      [t.model]: getModel(asset),
      [t.location]: getLocation(asset),
      [t.department]: getDepartment(asset),
      [t.status]: getStatus(asset),
      [t.condition]: getCondition(asset),
      [t.supplier]: getSupplier(asset),
      [t.purchasePrice]: getPurchasePrice(asset),
      [t.purchaseDate]: formatDate(
        asset.purchase_date ||
        asset.purchaseDate
      )
    }));

    const worksheet =
      XLSX.utils.json_to_sheet(data);

    const workbook =
      XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      'Assets'
    );

    XLSX.writeFile(
      workbook,
      'store_assets.xlsx'
    );

    toast.success(t.exportSuccess);
  };

  // ============================================================
  // STYLES
  // ============================================================

  const colors = {
    background: isDark ? '#0b1220' : '#f5f7fb',
    surface: isDark ? '#172235' : '#ffffff',
    surfaceAlt: isDark ? '#1d2b42' : '#f8fafc',
    border: isDark ? '#2d405b' : '#e2e8f0',
    text: isDark ? '#e6edf7' : '#1a365d',
    muted: isDark ? '#9aa9bd' : '#64748b',
    primary: '#3182ce',
    success: '#38a169',
    warning: '#dd6b20',
    danger: '#e53e3e',
    purple: '#805ad5'
  };

  const styles = {
    container: {
      minHeight: '100vh',
      background: colors.background,
      padding: '24px',
      color: colors.text,
      boxSizing: 'border-box'
    },

    pageHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: '20px',
      flexWrap: 'wrap',
      marginBottom: '24px'
    },

    title: {
      margin: 0,
      fontSize: '1.8rem',
      fontWeight: 800,
      color: colors.text
    },

    subtitle: {
      margin: '7px 0 0',
      color: colors.muted,
      fontSize: '0.95rem'
    },

    headerActions: {
      display: 'flex',
      gap: '10px',
      flexWrap: 'wrap'
    },

    button: {
      border: 'none',
      borderRadius: '8px',
      padding: '10px 16px',
      cursor: 'pointer',
      fontWeight: 700,
      fontSize: '0.85rem'
    },

    exportButton: {
      background: colors.success,
      color: '#ffffff'
    },

    refreshButton: {
      background: colors.primary,
      color: '#ffffff'
    },

    summaryGrid: {
      display: 'grid',
      gridTemplateColumns:
        'repeat(auto-fit, minmax(170px, 1fr))',
      gap: '14px',
      marginBottom: '22px'
    },

    summaryCard: {
      background: colors.surface,
      border: `1px solid ${colors.border}`,
      borderRadius: '12px',
      padding: '18px',
      boxShadow: isDark
        ? '0 5px 15px rgba(0,0,0,.18)'
        : '0 5px 15px rgba(15,23,42,.05)'
    },

    summaryLabel: {
      color: colors.muted,
      fontSize: '0.78rem',
      fontWeight: 700,
      marginBottom: '7px'
    },

    summaryValue: {
      color: colors.text,
      fontSize: '1.65rem',
      fontWeight: 800
    },

    navigation: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '5px',
      background: colors.surfaceAlt,
      border: `1px solid ${colors.border}`,
      borderRadius: '12px',
      padding: '6px',
      marginBottom: '18px'
    },

    navButton: {
      border: 'none',
      background: 'transparent',
      color: colors.muted,
      padding: '10px 14px',
      borderRadius: '8px',
      cursor: 'pointer',
      fontWeight: 700,
      fontSize: '0.84rem'
    },

    navActive: {
      background: colors.primary,
      color: '#ffffff'
    },

    card: {
      background: colors.surface,
      border: `1px solid ${colors.border}`,
      borderRadius: '12px',
      padding: '20px',
      marginBottom: '20px',
      boxShadow: isDark
        ? '0 5px 15px rgba(0,0,0,.18)'
        : '0 5px 15px rgba(15,23,42,.04)'
    },

    filterGrid: {
      display: 'grid',
      gridTemplateColumns:
        'minmax(220px, 2fr) repeat(4, minmax(140px, 1fr)) auto',
      gap: '10px',
      alignItems: 'end'
    },

    field: {
      display: 'flex',
      flexDirection: 'column',
      gap: '5px'
    },

    label: {
      fontSize: '0.75rem',
      color: colors.muted,
      fontWeight: 700
    },

    input: {
      width: '100%',
      boxSizing: 'border-box',
      border: `1px solid ${colors.border}`,
      background: isDark ? '#111a2a' : '#ffffff',
      color: colors.text,
      borderRadius: '7px',
      padding: '9px 11px',
      outline: 'none',
      fontSize: '0.84rem'
    },

    select: {
      width: '100%',
      boxSizing: 'border-box',
      border: `1px solid ${colors.border}`,
      background: isDark ? '#111a2a' : '#ffffff',
      color: colors.text,
      borderRadius: '7px',
      padding: '9px 11px',
      outline: 'none',
      fontSize: '0.84rem'
    },

    resetButton: {
      border: `1px solid ${colors.border}`,
      background: colors.surfaceAlt,
      color: colors.text,
      borderRadius: '7px',
      padding: '9px 12px',
      cursor: 'pointer',
      fontWeight: 700,
      whiteSpace: 'nowrap'
    },

    tableWrapper: {
      overflowX: 'auto'
    },

    table: {
      width: '100%',
      minWidth: '1050px',
      borderCollapse: 'collapse'
    },

    th: {
      padding: '11px 12px',
      background: colors.surfaceAlt,
      borderBottom: `2px solid ${colors.border}`,
      color: colors.muted,
      textAlign: 'left',
      fontSize: '0.72rem',
      fontWeight: 800,
      textTransform: 'uppercase',
      whiteSpace: 'nowrap',
      cursor: 'pointer'
    },

    td: {
      padding: '12px',
      borderBottom: `1px solid ${colors.border}`,
      color: colors.text,
      fontSize: '0.82rem',
      verticalAlign: 'middle'
    },

    badge: (color) => ({
      display: 'inline-flex',
      alignItems: 'center',
      padding: '4px 9px',
      borderRadius: '20px',
      background: `${color}22`,
      color,
      fontWeight: 700,
      fontSize: '0.7rem',
      whiteSpace: 'nowrap'
    }),

    actionGroup: {
      display: 'flex',
      gap: '5px',
      flexWrap: 'wrap'
    },

    smallButton: (background) => ({
      border: 'none',
      borderRadius: '6px',
      background,
      color: '#ffffff',
      padding: '6px 9px',
      cursor: 'pointer',
      fontSize: '0.72rem',
      fontWeight: 700
    }),

    pagination: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: '10px',
      flexWrap: 'wrap',
      marginTop: '16px'
    },

    paginationButtons: {
      display: 'flex',
      gap: '5px',
      alignItems: 'center'
    },

    pageButton: {
      border: `1px solid ${colors.border}`,
      background: colors.surface,
      color: colors.text,
      borderRadius: '6px',
      padding: '7px 10px',
      cursor: 'pointer',
      fontWeight: 700
    },

    pageButtonActive: {
      background: colors.primary,
      color: '#ffffff',
      borderColor: colors.primary
    },

    muted: {
      color: colors.muted,
      fontSize: '0.8rem'
    },

    detailsGrid: {
      display: 'grid',
      gridTemplateColumns:
        'repeat(auto-fit, minmax(220px, 1fr))',
      gap: '12px'
    },

    detailItem: {
      background: colors.surfaceAlt,
      border: `1px solid ${colors.border}`,
      borderRadius: '9px',
      padding: '13px'
    },

    detailLabel: {
      color: colors.muted,
      fontSize: '0.72rem',
      fontWeight: 700,
      marginBottom: '5px'
    },

    detailValue: {
      color: colors.text,
      fontSize: '0.88rem',
      fontWeight: 700,
      wordBreak: 'break-word'
    },

    sectionTitle: {
      margin: '0 0 16px',
      fontSize: '1.1rem',
      fontWeight: 800,
      color: colors.text
    },

    empty: {
      padding: '45px 20px',
      textAlign: 'center',
      color: colors.muted
    },

    loading: {
      minHeight: '300px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: colors.muted,
      fontWeight: 700
    }
  };

  // ============================================================
  // STATUS / CONDITION COLORS
  // ============================================================

  const getStatusColor = (status) => {
    const value = normalize(status);

    if (
      value.includes('available') ||
      value.includes('active') ||
      value.includes('stock')
    ) {
      return colors.success;
    }

    if (
      value.includes('issued') ||
      value.includes('assigned') ||
      value.includes('use')
    ) {
      return colors.primary;
    }

    if (value.includes('maintenance')) {
      return colors.warning;
    }

    if (
      value.includes('damaged') ||
      value.includes('lost')
    ) {
      return colors.danger;
    }

    if (value.includes('reserved')) {
      return colors.purple;
    }

    return colors.muted;
  };

  const getConditionColor = (condition) => {
    const value = normalize(condition);

    if (value === 'new') {
      return colors.success;
    }

    if (value === 'good') {
      return colors.primary;
    }

    if (value === 'fair') {
      return '#d69e2e';
    }

    if (value === 'poor') {
      return colors.warning;
    }

    if (value === 'damaged') {
      return colors.danger;
    }

    return colors.muted;
  };

  // ============================================================
  // CATEGORY VIEW
  // ============================================================

  const categoryStats = useMemo(() => {
    return categories.map((category) => {
      const items = assets.filter(
        (asset) =>
          normalize(getCategory(asset)) ===
          normalize(category)
      );

      return {
        name: category,
        total: items.length,
        available: items.filter((asset) =>
          normalize(getStatus(asset)).includes('available')
        ).length,
        issued: items.filter((asset) =>
          ['issued', 'assigned', 'in use'].includes(
            normalize(getStatus(asset))
          )
        ).length
      };
    });
  }, [assets, categories]);

  // ============================================================
  // LOCATION VIEW
  // ============================================================

  const locationStats = useMemo(() => {
    return locations.map((location) => {
      const items = assets.filter(
        (asset) =>
          normalize(getLocation(asset)) ===
          normalize(location)
      );

      return {
        name: location,
        total: items.length,
        available: items.filter((asset) =>
          normalize(getStatus(asset)).includes('available')
        ).length
      };
    });
  }, [assets, locations]);

  // ============================================================
  // CONDITION VIEW
  // ============================================================

  const conditionStats = useMemo(() => {
    return conditions.map((condition) => ({
      name: condition,
      total: assets.filter(
        (asset) =>
          normalize(getCondition(asset)) ===
          normalize(condition)
      ).length
    }));
  }, [assets, conditions]);

  // ============================================================
  // STATUS VIEW
  // ============================================================

  const statusStats = useMemo(() => {
    return statuses.map((status) => ({
      name: status,
      total: assets.filter(
        (asset) =>
          normalize(getStatus(asset)) ===
          normalize(status)
      ).length
    }));
  }, [assets, statuses]);

  // ============================================================
  // RENDER HELPERS
  // ============================================================

  const renderPagination = () => {
    if (filteredAssets.length === 0) return null;

    const pages = [];

    const start = Math.max(
      1,
      currentPage - 2
    );

    const end = Math.min(
      totalPages,
      currentPage + 2
    );

    for (let page = start; page <= end; page++) {
      pages.push(page);
    }

    return (
      <div style={styles.pagination}>
        <div style={styles.muted}>
          {t.showing}{' '}
          {Math.min(
            (currentPage - 1) * pageSize + 1,
            filteredAssets.length
          )}
          {' - '}
          {Math.min(
            currentPage * pageSize,
            filteredAssets.length
          )}
          {' '}
          {t.of}
          {' '}
          {filteredAssets.length}
        </div>

        <div style={styles.paginationButtons}>
          <button
            style={styles.pageButton}
            disabled={currentPage === 1}
            onClick={() =>
              setCurrentPage((page) =>
                Math.max(1, page - 1)
              )
            }
          >
            ‹
          </button>

          {pages.map((page) => (
            <button
              key={page}
              style={{
                ...styles.pageButton,
                ...(currentPage === page
                  ? styles.pageButtonActive
                  : {})
              }}
              onClick={() =>
                setCurrentPage(page)
              }
            >
              {page}
            </button>
          ))}

          <button
            style={styles.pageButton}
            disabled={currentPage === totalPages}
            onClick={() =>
              setCurrentPage((page) =>
                Math.min(totalPages, page + 1)
              )
            }
          >
            ›
          </button>
        </div>
      </div>
    );
  };

  const renderFilters = () => (
    <div style={styles.card}>
      <div style={styles.filterGrid}>
        <div style={styles.field}>
          <label style={styles.label}>
            {t.search}
          </label>

          <input
            style={styles.input}
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder={t.searchPlaceholder}
          />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>
            {t.category}
          </label>

          <select
            style={styles.select}
            value={categoryFilter}
            onChange={(event) =>
              setCategoryFilter(event.target.value)
            }
          >
            <option value="all">
              {t.allCategories}
            </option>

            {categories.map((category) => (
              <option
                key={category}
                value={category}
              >
                {category}
              </option>
            ))}
          </select>
        </div>

        <div style={styles.field}>
          <label style={styles.label}>
            {t.location}
          </label>

          <select
            style={styles.select}
            value={locationFilter}
            onChange={(event) =>
              setLocationFilter(event.target.value)
            }
          >
            <option value="all">
              {t.allLocations}
            </option>

            {locations.map((location) => (
              <option
                key={location}
                value={location}
              >
                {location}
              </option>
            ))}
          </select>
        </div>

        <div style={styles.field}>
          <label style={styles.label}>
            {t.status}
          </label>

          <select
            style={styles.select}
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value)
            }
          >
            <option value="all">
              {t.allStatuses}
            </option>

            {statuses.map((status) => (
              <option
                key={status}
                value={status}
              >
                {status}
              </option>
            ))}
          </select>
        </div>

        <div style={styles.field}>
          <label style={styles.label}>
            {t.condition}
          </label>

          <select
            style={styles.select}
            value={conditionFilter}
            onChange={(event) =>
              setConditionFilter(event.target.value)
            }
          >
            <option value="all">
              {t.allConditions}
            </option>

            {conditions.map((condition) => (
              <option
                key={condition}
                value={condition}
              >
                {condition}
              </option>
            ))}
          </select>
        </div>

        <button
          style={styles.resetButton}
          onClick={resetFilters}
        >
          ↻ {t.reset}
        </button>
      </div>
    </div>
  );

  const renderAssetTable = () => (
    <div style={styles.card}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '10px',
          marginBottom: '14px',
          flexWrap: 'wrap'
        }}
      >
        <h2 style={styles.sectionTitle}>
          📦 {t.allAssets}
        </h2>

        <div style={styles.muted}>
          {filteredAssets.length} {t.assetsFound}
        </div>
      </div>

      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th
                style={styles.th}
                onClick={() =>
                  handleSort('tag')
                }
              >
                {t.assetTag}
                {sortIndicator('tag')}
              </th>

              <th
                style={styles.th}
                onClick={() =>
                  handleSort('name')
                }
              >
                {t.assetName}
                {sortIndicator('name')}
              </th>

              <th
                style={styles.th}
                onClick={() =>
                  handleSort('category')
                }
              >
                {t.category}
                {sortIndicator('category')}
              </th>

              <th style={styles.th}>
                {t.serialNumber}
              </th>

              <th
                style={styles.th}
                onClick={() =>
                  handleSort('location')
                }
              >
                {t.location}
                {sortIndicator('location')}
              </th>

              <th
                style={styles.th}
                onClick={() =>
                  handleSort('status')
                }
              >
                {t.status}
                {sortIndicator('status')}
              </th>

              <th
                style={styles.th}
                onClick={() =>
                  handleSort('condition')
                }
              >
                {t.condition}
                {sortIndicator('condition')}
              </th>

              <th style={styles.th}>
                {t.department}
              </th>

              <th style={styles.th}>
                {t.actions}
              </th>
            </tr>
          </thead>

          <tbody>
            {paginatedAssets.length === 0 ? (
              <tr>
                <td
                  colSpan="9"
                  style={styles.td}
                >
                  <div style={styles.empty}>
                    📦
                    <div
                      style={{
                        marginTop: '10px',
                        fontWeight: 700
                      }}
                    >
                      {t.noAssets}
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedAssets.map((asset) => (
                <tr
                  key={
                    asset.id ||
                    asset.asset_id ||
                    getAssetTag(asset)
                  }
                >
                  <td style={styles.td}>
                    <strong>
                      {getAssetTag(asset)}
                    </strong>
                  </td>

                  <td style={styles.td}>
                    <div
                      style={{
                        fontWeight: 700
                      }}
                    >
                      {getAssetName(asset)}
                    </div>

                    {(getBrand(asset) !== '-' ||
                      getModel(asset) !== '-') && (
                      <div style={styles.muted}>
                        {getBrand(asset)}
                        {' '}
                        {getModel(asset)}
                      </div>
                    )}
                  </td>

                  <td style={styles.td}>
                    {getCategory(asset)}
                  </td>

                  <td style={styles.td}>
                    {getSerialNumber(asset)}
                  </td>

                  <td style={styles.td}>
                    {getLocation(asset)}
                  </td>

                  <td style={styles.td}>
                    <span
                      style={styles.badge(
                        getStatusColor(
                          getStatus(asset)
                        )
                      )}
                    >
                      {getStatus(asset)}
                    </span>
                  </td>

                  <td style={styles.td}>
                    <span
                      style={styles.badge(
                        getConditionColor(
                          getCondition(asset)
                        )
                      )}
                    >
                      {getCondition(asset)}
                    </span>
                  </td>

                  <td style={styles.td}>
                    {getDepartment(asset)}
                  </td>

                  <td style={styles.td}>
                    <div style={styles.actionGroup}>
                      <button
                        style={styles.smallButton(
                          colors.primary
                        )}
                        onClick={() =>
                          openDetails(asset)
                        }
                      >
                        👁 {t.details}
                      </button>

                      <button
                        style={styles.smallButton(
                          colors.purple
                        )}
                        onClick={() =>
                          openHistory(asset)
                        }
                      >
                        📋 {t.history}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {renderPagination()}
    </div>
  );

  // ============================================================
  // DETAILS
  // ============================================================

  const renderDetails = () => {
    if (!selectedAsset) {
      return (
        <div style={styles.card}>
          <div style={styles.empty}>
            🔎
            <div
              style={{
                marginTop: '10px',
                fontWeight: 700
              }}
            >
              {t.selectAssetForDetails}
            </div>
          </div>
        </div>
      );
    }

    const asset = selectedAsset;

    return (
      <div style={styles.card}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '10px',
            marginBottom: '18px',
            flexWrap: 'wrap'
          }}
        >
          <div>
            <h2 style={styles.sectionTitle}>
              📄 {t.assetDetails}
            </h2>

            <div style={styles.muted}>
              {getAssetTag(asset)}
              {' — '}
              {getAssetName(asset)}
            </div>
          </div>

          <div style={styles.actionGroup}>
            <button
              style={styles.smallButton(
                colors.primary
              )}
              onClick={() =>
                openHistory(asset)
              }
            >
              📋 {t.viewHistory}
            </button>

            <button
              style={styles.smallButton(
                colors.muted
              )}
              onClick={closeDetails}
            >
              ✕ {t.close}
            </button>
          </div>
        </div>

        <div style={styles.detailsGrid}>
          <Detail
            label={t.assetId}
            value={asset.id || asset.asset_id || '-'}
            styles={styles}
          />

          <Detail
            label={t.assetTag}
            value={getAssetTag(asset)}
            styles={styles}
          />

          <Detail
            label={t.assetName}
            value={getAssetName(asset)}
            styles={styles}
          />

          <Detail
            label={t.category}
            value={getCategory(asset)}
            styles={styles}
          />

          <Detail
            label={t.serialNumber}
            value={getSerialNumber(asset)}
            styles={styles}
          />

          <Detail
            label={t.brand}
            value={getBrand(asset)}
            styles={styles}
          />

          <Detail
            label={t.model}
            value={getModel(asset)}
            styles={styles}
          />

          <Detail
            label={t.location}
            value={getLocation(asset)}
            styles={styles}
          />

          <Detail
            label={t.department}
            value={getDepartment(asset)}
            styles={styles}
          />

          <Detail
            label={t.status}
            value={getStatus(asset)}
            styles={styles}
          />

          <Detail
            label={t.condition}
            value={getCondition(asset)}
            styles={styles}
          />

          <Detail
            label={t.supplier}
            value={getSupplier(asset)}
            styles={styles}
          />

          <Detail
            label={t.purchasePrice}
            value={getPurchasePrice(asset)}
            styles={styles}
          />

          <Detail
            label={t.purchaseDate}
            value={formatDate(
              asset.purchase_date ||
              asset.purchaseDate
            )}
            styles={styles}
          />

          <Detail
            label={t.warranty}
            value={
              asset.warranty ||
              asset.warranty_period ||
              '-'
            }
            styles={styles}
          />

          <Detail
            label={t.rfid}
            value={
              asset.rfid_tag ||
              asset.rfid ||
              '-'
            }
            styles={styles}
          />

          <Detail
            label={t.qrBarcode}
            value={
              asset.qr_code ||
              asset.barcode ||
              '-'
            }
            styles={styles}
          />
        </div>
      </div>
    );
  };

  // ============================================================
  // CATEGORY VIEW
  // ============================================================

  const renderCategories = () => (
    <div style={styles.card}>
      <h2 style={styles.sectionTitle}>
        🗂️ {t.categories}
      </h2>

      {categoryStats.length === 0 ? (
        <div style={styles.empty}>
          {t.noCategories}
        </div>
      ) : (
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>
                  {t.category}
                </th>
                <th style={styles.th}>
                  {t.total}
                </th>
                <th style={styles.th}>
                  {t.available}
                </th>
                <th style={styles.th}>
                  {t.issued}
                </th>
                <th style={styles.th}>
                  {t.actions}
                </th>
              </tr>
            </thead>

            <tbody>
              {categoryStats.map((item) => (
                <tr key={item.name}>
                  <td style={styles.td}>
                    <strong>
                      {item.name}
                    </strong>
                  </td>

                  <td style={styles.td}>
                    {item.total}
                  </td>

                  <td style={styles.td}>
                    <span
                      style={styles.badge(
                        colors.success
                      )}
                    >
                      {item.available}
                    </span>
                  </td>

                  <td style={styles.td}>
                    <span
                      style={styles.badge(
                        colors.primary
                      )}
                    >
                      {item.issued}
                    </span>
                  </td>

                  <td style={styles.td}>
                    <button
                      style={styles.smallButton(
                        colors.primary
                      )}
                      onClick={() => {
                        setCategoryFilter(
                          item.name
                        );
                        setActiveSection('all');
                      }}
                    >
                      {t.viewAssets}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  // ============================================================
  // LOCATION VIEW
  // ============================================================

  const renderLocations = () => (
    <div style={styles.card}>
      <h2 style={styles.sectionTitle}>
        📍 {t.locations}
      </h2>

      {locationStats.length === 0 ? (
        <div style={styles.empty}>
          {t.noLocations}
        </div>
      ) : (
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>
                  {t.location}
                </th>

                <th style={styles.th}>
                  {t.total}
                </th>

                <th style={styles.th}>
                  {t.available}
                </th>

                <th style={styles.th}>
                  {t.actions}
                </th>
              </tr>
            </thead>

            <tbody>
              {locationStats.map((item) => (
                <tr key={item.name}>
                  <td style={styles.td}>
                    <strong>
                      {item.name}
                    </strong>
                  </td>

                  <td style={styles.td}>
                    {item.total}
                  </td>

                  <td style={styles.td}>
                    <span
                      style={styles.badge(
                        colors.success
                      )}
                    >
                      {item.available}
                    </span>
                  </td>

                  <td style={styles.td}>
                    <button
                      style={styles.smallButton(
                        colors.primary
                      )}
                      onClick={() => {
                        setLocationFilter(
                          item.name
                        );
                        setActiveSection('all');
                      }}
                    >
                      {t.viewAssets}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  // ============================================================
  // CONDITION VIEW
  // ============================================================

  const renderConditions = () => (
    <div style={styles.card}>
      <h2 style={styles.sectionTitle}>
        🛠️ {t.assetCondition}
      </h2>

      {conditionStats.length === 0 ? (
        <div style={styles.empty}>
          {t.noConditions}
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '14px'
          }}
        >
          {conditionStats.map((item) => (
            <button
              key={item.name}
              onClick={() => {
                setConditionFilter(
                  item.name
                );
                setActiveSection('all');
              }}
              style={{
                textAlign: 'left',
                border: `1px solid ${colors.border}`,
                background: colors.surfaceAlt,
                borderRadius: '10px',
                padding: '18px',
                cursor: 'pointer'
              }}
            >
              <div
                style={{
                  color: colors.muted,
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  marginBottom: '7px'
                }}
              >
                {item.name}
              </div>

              <div
                style={{
                  color: getConditionColor(
                    item.name
                  ),
                  fontSize: '1.6rem',
                  fontWeight: 800
                }}
              >
                {item.total}
              </div>

              <div
                style={{
                  color: colors.muted,
                  fontSize: '0.75rem',
                  marginTop: '5px'
                }}
              >
                {t.assets}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  // ============================================================
  // STATUS VIEW
  // ============================================================

  const renderStatuses = () => (
    <div style={styles.card}>
      <h2 style={styles.sectionTitle}>
        📊 {t.assetStatus}
      </h2>

      {statusStats.length === 0 ? (
        <div style={styles.empty}>
          {t.noStatuses}
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '14px'
          }}
        >
          {statusStats.map((item) => (
            <button
              key={item.name}
              onClick={() => {
                setStatusFilter(item.name);
                setActiveSection('all');
              }}
              style={{
                textAlign: 'left',
                border: `1px solid ${colors.border}`,
                background: colors.surfaceAlt,
                borderRadius: '10px',
                padding: '18px',
                cursor: 'pointer'
              }}
            >
              <div
                style={{
                  marginBottom: '9px'
                }}
              >
                <span
                  style={styles.badge(
                    getStatusColor(
                      item.name
                    )
                  )}
                >
                  {item.name}
                </span>
              </div>

              <div
                style={{
                  color: colors.text,
                  fontSize: '1.6rem',
                  fontWeight: 800
                }}
              >
                {item.total}
              </div>

              <div
                style={{
                  color: colors.muted,
                  fontSize: '0.75rem',
                  marginTop: '5px'
                }}
              >
                {t.assets}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  // ============================================================
  // HISTORY VIEW
  // ============================================================

  const renderHistory = () => (
    <div style={styles.card}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '10px',
          flexWrap: 'wrap'
        }}
      >
        <div>
          <h2 style={styles.sectionTitle}>
            📋 {t.assetHistory}
          </h2>

          {selectedAsset && (
            <div style={styles.muted}>
              {getAssetTag(selectedAsset)}
              {' — '}
              {getAssetName(selectedAsset)}
            </div>
          )}
        </div>

        {selectedAsset && (
          <button
            style={styles.smallButton(
              colors.primary
            )}
            onClick={() =>
              fetchAssetHistory(
                selectedAsset
              )
            }
          >
            ↻ {t.refresh}
          </button>
        )}
      </div>

      {!selectedAsset ? (
        <div style={styles.empty}>
          📋
          <div
            style={{
              marginTop: '10px',
              fontWeight: 700
            }}
          >
            {t.selectAssetForHistory}
          </div>
        </div>
      ) : historyLoading ? (
        <div style={styles.loading}>
          ⏳ {t.loadingHistory}
        </div>
      ) : history.length === 0 ? (
        <div style={styles.empty}>
          📋
          <div
            style={{
              marginTop: '10px',
              fontWeight: 700
            }}
          >
            {t.noHistory}
          </div>
        </div>
      ) : (
        <div
          style={{
            ...styles.tableWrapper,
            marginTop: '18px'
          }}
        >
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>
                  {t.date}
                </th>

                <th style={styles.th}>
                  {t.action}
                </th>

                <th style={styles.th}>
                  {t.status}
                </th>

                <th style={styles.th}>
                  {t.department}
                </th>

                <th style={styles.th}>
                  {t.location}
                </th>

                <th style={styles.th}>
                  {t.user}
                </th>

                <th style={styles.th}>
                  {t.remarks}
                </th>
              </tr>
            </thead>

            <tbody>
              {history.map((item, index) => (
                <tr
                  key={
                    item.id ||
                    item.history_id ||
                    index
                  }
                >
                  <td style={styles.td}>
                    {formatDate(
                      item.created_at ||
                      item.date ||
                      item.action_date
                    )}
                  </td>

                  <td style={styles.td}>
                    {item.action ||
                      item.action_type ||
                      '-'}
                  </td>

                  <td style={styles.td}>
                    {item.status || '-'}
                  </td>

                  <td style={styles.td}>
                    {getDepartmentLabel(
                      item.department
                    ) || '-'}
                  </td>

                  <td style={styles.td}>
                    {item.location || '-'}
                  </td>

                  <td style={styles.td}>
                    {item.user_name ||
                      item.username ||
                      item.user ||
                      '-'}
                  </td>

                  <td style={styles.td}>
                    {item.remarks ||
                      item.notes ||
                      '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  // ============================================================
  // LOADING
  // ============================================================

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>
          ⏳ {t.loading}
        </div>
      </div>
    );
  }

  // ============================================================
  // MAIN RENDER
  // ============================================================

  return (
    <div style={styles.container}>
      {/* HEADER */}
      <div style={styles.pageHeader}>
        <div>
          <h1 style={styles.title}>
            📦 {t.assets}
          </h1>

          <p style={styles.subtitle}>
            {t.assetManagementDescription}
          </p>
        </div>

        <div style={styles.headerActions}>
          <button
            style={{
              ...styles.button,
              ...styles.refreshButton
            }}
            onClick={fetchAssets}
          >
            ↻ {t.refresh}
          </button>

          <button
            style={{
              ...styles.button,
              ...styles.exportButton
            }}
            onClick={exportToExcel}
          >
            📥 {t.exportExcel}
          </button>
        </div>
      </div>

      {/* SUMMARY */}
      <div style={styles.summaryGrid}>
        <div style={styles.summaryCard}>
          <div style={styles.summaryLabel}>
            📦 {t.totalAssets}
          </div>

          <div style={styles.summaryValue}>
            {summary.total}
          </div>
        </div>

        <div style={styles.summaryCard}>
          <div style={styles.summaryLabel}>
            ✅ {t.available}
          </div>

          <div
            style={{
              ...styles.summaryValue,
              color: colors.success
            }}
          >
            {summary.available}
          </div>
        </div>

        <div style={styles.summaryCard}>
          <div style={styles.summaryLabel}>
            📤 {t.issued}
          </div>

          <div
            style={{
              ...styles.summaryValue,
              color: colors.primary
            }}
          >
            {summary.issued}
          </div>
        </div>

        <div style={styles.summaryCard}>
          <div style={styles.summaryLabel}>
            🔧 {t.underMaintenance}
          </div>

          <div
            style={{
              ...styles.summaryValue,
              color: colors.warning
            }}
          >
            {summary.maintenance}
          </div>
        </div>

        <div style={styles.summaryCard}>
          <div style={styles.summaryLabel}>
            ⚠️ {t.damaged}
          </div>

          <div
            style={{
              ...styles.summaryValue,
              color: colors.danger
            }}
          >
            {summary.damaged}
          </div>
        </div>
      </div>

      {/* ASSET NAVIGATION */}
      <div style={styles.navigation}>
        <button
          style={{
            ...styles.navButton,
            ...(activeSection === 'all'
              ? styles.navActive
              : {})
          }}
          onClick={() => {
            setActiveSection('all');
            setSelectedAsset(null);
          }}
        >
          📦 {t.allAssets}
        </button>

        <button
          style={{
            ...styles.navButton,
            ...(activeSection === 'details'
              ? styles.navActive
              : {})
          }}
          onClick={() =>
            setActiveSection('details')
          }
        >
          📄 {t.assetDetails}
        </button>

        <button
          style={{
            ...styles.navButton,
            ...(activeSection === 'categories'
              ? styles.navActive
              : {})
          }}
          onClick={() =>
            setActiveSection('categories')
          }
        >
          🗂️ {t.categories}
        </button>

        <button
          style={{
            ...styles.navButton,
            ...(activeSection === 'locations'
              ? styles.navActive
              : {})
          }}
          onClick={() =>
            setActiveSection('locations')
          }
        >
          📍 {t.locations}
        </button>

        <button
          style={{
            ...styles.navButton,
            ...(activeSection === 'condition'
              ? styles.navActive
              : {})
          }}
          onClick={() =>
            setActiveSection('condition')
          }
        >
          🛠️ {t.assetCondition}
        </button>

        <button
          style={{
            ...styles.navButton,
            ...(activeSection === 'status'
              ? styles.navActive
              : {})
          }}
          onClick={() =>
            setActiveSection('status')
          }
        >
          📊 {t.assetStatus}
        </button>

        <button
          style={{
            ...styles.navButton,
            ...(activeSection === 'history'
              ? styles.navActive
              : {})
          }}
          onClick={() =>
            setActiveSection('history')
          }
        >
          📋 {t.assetHistory}
        </button>
      </div>

      {/* ALL ASSETS */}
      {activeSection === 'all' && (
        <>
          {renderFilters()}
          {renderAssetTable()}
        </>
      )}

      {/* DETAILS */}
      {activeSection === 'details' &&
        renderDetails()}

      {/* CATEGORIES */}
      {activeSection === 'categories' &&
        renderCategories()}

      {/* LOCATIONS */}
      {activeSection === 'locations' &&
        renderLocations()}

      {/* CONDITION */}
      {activeSection === 'condition' &&
        renderConditions()}

      {/* STATUS */}
      {activeSection === 'status' &&
        renderStatuses()}

      {/* HISTORY */}
      {activeSection === 'history' &&
        renderHistory()}
    </div>
  );
};

// ============================================================
// DETAIL COMPONENT
// ============================================================

const Detail = ({
  label,
  value,
  styles
}) => (
  <div style={styles.detailItem}>
    <div style={styles.detailLabel}>
      {label}
    </div>

    <div style={styles.detailValue}>
      {value || '-'}
    </div>
  </div>
);

// ============================================================
// ENGLISH TRANSLATIONS
// ============================================================

const englishTranslations = {
  assets: 'Assets',
  assetManagementDescription:
    'Manage, inspect, filter, and track university assets',

  allAssets: 'All Assets',
  assetDetails: 'Asset Details',
  categories: 'Categories',
  locations: 'Locations',
  assetCondition: 'Asset Condition',
  assetStatus: 'Asset Status',
  assetHistory: 'Asset History',

  totalAssets: 'Total Assets',
  available: 'Available',
  issued: 'Issued',
  underMaintenance: 'Under Maintenance',
  damaged: 'Damaged',

  search: 'Search',
  searchPlaceholder:
    'Search asset name, tag, serial, category, location...',
  reset: 'Reset',

  category: 'Category',
  location: 'Location',
  status: 'Status',
  condition: 'Condition',
  department: 'Department',

  allCategories: 'All Categories',
  allLocations: 'All Locations',
  allStatuses: 'All Statuses',
  allConditions: 'All Conditions',

  assetId: 'Asset ID',
  assetTag: 'Asset Tag',
  assetName: 'Asset Name',
  serialNumber: 'Serial Number',
  brand: 'Brand',
  model: 'Model',
  supplier: 'Supplier',
  purchasePrice: 'Purchase Price',
  purchaseDate: 'Purchase Date',
  warranty: 'Warranty',
  rfid: 'RFID Tag',
  qrBarcode: 'QR / Barcode',

  actions: 'Actions',
  details: 'Details',
  history: 'History',
  viewHistory: 'View History',
  viewAssets: 'View Assets',
  close: 'Close',

  total: 'Total',
  assetsFound: 'assets found',
  assets: 'Assets',

  showing: 'Showing',
  of: 'of',

  refresh: 'Refresh',
  exportExcel: 'Export Excel',
  exportSuccess:
    'Assets exported successfully',

  loading: 'Loading assets...',
  loadingHistory: 'Loading history...',
  noAssets: 'No assets found',
  noCategories: 'No categories found',
  noLocations: 'No locations found',
  noConditions: 'No condition data found',
  noStatuses: 'No status data found',
  noHistory: 'No history records found',

  selectAssetForDetails:
    'Select an asset from All Assets to view its details.',

  selectAssetForHistory:
    'Select an asset from All Assets to view its history.',

  date: 'Date',
  action: 'Action',
  user: 'User',
  remarks: 'Remarks'
};

// ============================================================
// AMHARIC TRANSLATIONS
// ============================================================

const amharicTranslations = {
  assets: 'ንብረቶች',
  assetManagementDescription:
    'የዩኒቨርሲቲ ንብረቶችን ያስተዳድሩ፣ ይመርምሩ እና ይከታተሉ',

  allAssets: 'ሁሉም ንብረቶች',
  assetDetails: 'የንብረት ዝርዝር',
  categories: 'ምድቦች',
  locations: 'ቦታዎች',
  assetCondition: 'የንብረት ሁኔታ',
  assetStatus: 'የንብረት ሁኔታ/Status',
  assetHistory: 'የንብረት ታሪክ',

  totalAssets: 'ጠቅላላ ንብረቶች',
  available: 'የሚገኙ',
  issued: 'የተሰጡ',
  underMaintenance: 'በጥገና ላይ',
  damaged: 'የተጎዱ',

  search: 'ፈልግ',
  searchPlaceholder:
    'በንብረት ስም፣ መለያ፣ ተከታታይ ቁጥር፣ ምድብ፣ ቦታ ፈልግ...',
  reset: 'አጽዳ',

  category: 'ምድብ',
  location: 'ቦታ',
  status: 'ሁኔታ',
  condition: 'የንብረት ሁኔታ',
  department: 'ክፍል',

  allCategories: 'ሁሉም ምድቦች',
  allLocations: 'ሁሉም ቦታዎች',
  allStatuses: 'ሁሉም ሁኔታዎች',
  allConditions: 'ሁሉም የንብረት ሁኔታዎች',

  assetId: 'የንብረት መለያ',
  assetTag: 'የንብረት ታግ',
  assetName: 'የንብረት ስም',
  serialNumber: 'ተከታታይ ቁጥር',
  brand: 'ብራንድ',
  model: 'ሞዴል',
  supplier: 'አቅራቢ',
  purchasePrice: 'የግዢ ዋጋ',
  purchaseDate: 'የግዢ ቀን',
  warranty: 'ዋስትና',
  rfid: 'RFID ታግ',
  qrBarcode: 'QR / Barcode',

  actions: 'ተግባራት',
  details: 'ዝርዝር',
  history: 'ታሪክ',
  viewHistory: 'ታሪክ ይመልከቱ',
  viewAssets: 'ንብረቶችን ይመልከቱ',
  close: 'ዝጋ',

  total: 'ጠቅላላ',
  assetsFound: 'ንብረቶች ተገኝተዋል',
  assets: 'ንብረቶች',

  showing: 'እየታየ ያለው',
  of: 'ከ',

  refresh: 'አድስ',
  exportExcel: 'ወደ Excel ላክ',
  exportSuccess:
    'ንብረቶች በተሳካ ሁኔታ ወደ Excel ተላክተዋል',

  loading: 'ንብረቶች በመጫን ላይ...',
  loadingHistory:
    'ታሪክ በመጫን ላይ...',
  noAssets: 'ምንም ንብረት አልተገኘም',
  noCategories: 'ምንም ምድብ አልተገኘም',
  noLocations: 'ምንም ቦታ አልተገኘም',
  noConditions:
    'የሁኔታ መረጃ አልተገኘም',
  noStatuses:
    'የሁኔታ Status መረጃ አልተገኘም',
  noHistory:
    'ምንም የታሪክ መዝገብ አልተገኘም',

  selectAssetForDetails:
    'ዝርዝሩን ለማየት ከሁሉም ንብረቶች አንድ ንብረት ይምረጡ።',

  selectAssetForHistory:
    'ታሪኩን ለማየት ከሁሉም ንብረቶች አንድ ንብረት ይምረጡ።',

  date: 'ቀን',
  action: 'ተግባር',
  user: 'ተጠቃሚ',
  remarks: 'ማስታወሻ'
};

export default StoreAssets;
