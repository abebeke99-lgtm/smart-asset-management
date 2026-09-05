import React, {
  useCallback,
  useEffect,
  useMemo,
  useState
} from 'react';

import { useLanguage } from '../../contexts/UiContext';
import { toast } from 'react-toastify';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { useNavigate } from 'react-router-dom';

import {
  FaBox,
  FaBoxes,
  FaCheckCircle,
  FaClipboardList,
  FaWarehouse,
  FaExclamationTriangle,
  FaTimesCircle,
  FaSearch,
  FaFilter,
  FaSyncAlt,
  FaFileExcel,
  FaPlus,
  FaEye,
  FaArrowDown,
  FaArrowUp,
  FaExchangeAlt,
  FaUndo,
  FaTools,
  FaTrash,
  FaEdit,
  FaHistory,
  FaMapMarkerAlt,
  FaTag,
  FaBarcode,
  FaCalendarAlt,
  FaUser,
  FaBuilding,
  FaTimes,
  FaSave,
  FaChevronLeft,
  FaChevronRight,
  FaSort,
  FaSortUp,
  FaSortDown,
  FaCheck,
  FaMinus,
  FaChartLine,
  FaAdjust,
  FaLayerGroup,
  FaClipboardCheck,
  FaDatabase
} from 'react-icons/fa';

const EMPTY_ARRAY = [];

const EMPTY_STATS = {
  total: 0,
  available: 0,
  reserved: 0,
  issued: 0,
  damaged: 0,
  missing: 0,
  lowStock: 0,
  totalQuantity: 0
};

const StoreInventory = () => {
  const { language, theme } = useLanguage();
  const navigate = useNavigate();

  const isDark = theme === 'dark';
  const t =
    language === 'en'
      ? englishTranslations
      : amharicTranslations;

  // =========================================================
  // STATE
  // =========================================================

  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [activeView, setActiveView] = useState('overview');

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [filterCondition, setFilterCondition] = useState('');
  const [showLowStock, setShowLowStock] = useState(false);

  const [sortField, setSortField] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  const [selectedIds, setSelectedIds] = useState([]);

  const [selectedItem, setSelectedItem] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const [showMovementModal, setShowMovementModal] = useState(false);
  const [movementType, setMovementType] = useState('');

  const [movementData, setMovementData] = useState({
    quantity: 1,
    reason: '',
    destination: '',
    recipient: '',
    adjustmentType: 'increase'
  });

  const [movementHistory, setMovementHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // =========================================================
  // THEME
  // =========================================================

  const colors = {
    primary: isDark ? '#63b3ed' : '#3182ce',
    success: isDark ? '#68d391' : '#38a169',
    warning: isDark ? '#f6ad55' : '#dd6b20',
    danger: isDark ? '#fc8181' : '#e53e3e',
    purple: isDark ? '#b794f4' : '#805ad5',
    cyan: isDark ? '#76e4f7' : '#319795',
    orange: '#ed8936'
  };

  const styles = {
    container: {
      minHeight: '100vh',
      padding: '20px',
      background: isDark ? '#0b1628' : '#f4f7fb',
      color: isDark ? '#dbeafe' : '#1a365d'
    },

    page: {
      maxWidth: '1700px',
      margin: '0 auto'
    },

    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: '20px',
      flexWrap: 'wrap',
      marginBottom: '22px'
    },

    title: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      margin: 0,
      fontSize: '1.8rem',
      fontWeight: 800,
      color: isDark ? '#e2e8f0' : '#1a365d'
    },

    subtitle: {
      margin: '7px 0 0',
      color: isDark ? '#94a3b8' : '#64748b',
      fontSize: '0.9rem'
    },

    headerActions: {
      display: 'flex',
      gap: '8px',
      flexWrap: 'wrap'
    },

    button: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '7px',
      padding: '9px 14px',
      borderRadius: '8px',
      border: 'none',
      cursor: 'pointer',
      fontWeight: 600,
      fontSize: '0.85rem'
    },

    primaryButton: {
      background: 'linear-gradient(135deg,#4299e1,#3182ce)',
      color: '#fff'
    },

    successButton: {
      background: 'linear-gradient(135deg,#48bb78,#38a169)',
      color: '#fff'
    },

    secondaryButton: {
      background: isDark ? '#243b53' : '#e2e8f0',
      color: isDark ? '#e2e8f0' : '#334155'
    },

    dangerButton: {
      background: 'linear-gradient(135deg,#fc8181,#e53e3e)',
      color: '#fff'
    },

    card: {
      background: isDark ? '#17263d' : '#fff',
      border: `1px solid ${isDark ? '#2d415d' : '#e2e8f0'}`,
      borderRadius: '12px',
      boxShadow: isDark
        ? '0 4px 16px rgba(0,0,0,.18)'
        : '0 4px 16px rgba(15,23,42,.05)'
    },

    tabs: {
      display: 'flex',
      gap: '4px',
      flexWrap: 'wrap',
      padding: '5px',
      marginBottom: '18px',
      background: isDark ? '#111e31' : '#eaf0f7',
      borderRadius: '10px'
    },

    tab: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '7px',
      padding: '9px 13px',
      borderRadius: '7px',
      border: 'none',
      cursor: 'pointer',
      fontWeight: 600,
      fontSize: '0.82rem'
    },

    controls: {
      ...{
        background: isDark ? '#17263d' : '#fff',
        border: `1px solid ${isDark ? '#2d415d' : '#e2e8f0'}`,
        borderRadius: '12px'
      },
      display: 'flex',
      gap: '10px',
      flexWrap: 'wrap',
      alignItems: 'center',
      padding: '14px',
      marginBottom: '18px'
    },

    input: {
      flex: '1 1 220px',
      minWidth: '190px',
      padding: '9px 12px',
      borderRadius: '8px',
      border: `1px solid ${isDark ? '#38506e' : '#cbd5e1'}`,
      background: isDark ? '#101b2c' : '#fff',
      color: isDark ? '#e2e8f0' : '#1e293b',
      outline: 'none'
    },

    select: {
      minWidth: '145px',
      padding: '9px 10px',
      borderRadius: '8px',
      border: `1px solid ${isDark ? '#38506e' : '#cbd5e1'}`,
      background: isDark ? '#101b2c' : '#fff',
      color: isDark ? '#e2e8f0' : '#1e293b',
      outline: 'none'
    },

    checkboxLabel: {
      display: 'flex',
      alignItems: 'center',
      gap: '7px',
      fontSize: '0.82rem',
      fontWeight: 600,
      cursor: 'pointer'
    },

    kpiGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))',
      gap: '12px',
      marginBottom: '18px'
    },

    kpi: {
      padding: '17px',
      cursor: 'pointer',
      transition: 'transform .15s ease'
    },

    kpiIcon: {
      width: '40px',
      height: '40px',
      borderRadius: '10px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: '10px',
      fontSize: '1rem'
    },

    kpiValue: {
      fontSize: '1.55rem',
      fontWeight: 800
    },

    kpiLabel: {
      marginTop: '3px',
      fontSize: '0.78rem',
      color: isDark ? '#94a3b8' : '#64748b'
    },

    tableWrapper: {
      overflowX: 'auto',
      ...stylesCard(isDark)
    },

    table: {
      width: '100%',
      borderCollapse: 'collapse',
      minWidth: '1150px'
    },

    th: {
      padding: '11px 13px',
      textAlign: 'left',
      whiteSpace: 'nowrap',
      fontSize: '0.73rem',
      textTransform: 'uppercase',
      letterSpacing: '.4px',
      background: isDark ? '#101c2d' : '#f8fafc',
      color: isDark ? '#cbd5e1' : '#475569',
      borderBottom: `2px solid ${isDark ? '#2d415d' : '#e2e8f0'}`
    },

    td: {
      padding: '11px 13px',
      fontSize: '0.82rem',
      color: isDark ? '#dbeafe' : '#334155',
      borderBottom: `1px solid ${isDark ? '#263b57' : '#edf2f7'}`
    },

    badge: (color) => ({
      display: 'inline-flex',
      alignItems: 'center',
      gap: '5px',
      padding: '4px 9px',
      borderRadius: '20px',
      background: `${color}20`,
      color,
      fontSize: '0.72rem',
      fontWeight: 700,
      whiteSpace: 'nowrap'
    }),

    itemCode: {
      display: 'inline-block',
      padding: '4px 7px',
      borderRadius: '5px',
      background: isDark ? '#243b53' : '#eef2ff',
      color: isDark ? '#bfdbfe' : '#3730a3',
      fontSize: '.72rem',
      fontWeight: 700
    },

    quantityBox: {
      display: 'flex',
      alignItems: 'center',
      gap: '5px'
    },

    quantityAvailable: {
      fontWeight: 800,
      color: colors.success
    },

    quantityLow: {
      fontWeight: 800,
      color: colors.warning
    },

    empty: {
      textAlign: 'center',
      padding: '55px 20px',
      color: isDark ? '#94a3b8' : '#64748b'
    },

    pagination: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '10px',
      flexWrap: 'wrap',
      padding: '13px 15px',
      borderTop: `1px solid ${isDark ? '#2d415d' : '#e2e8f0'}`
    },

    pageButtons: {
      display: 'flex',
      alignItems: 'center',
      gap: '5px'
    },

    pageButton: {
      minWidth: '32px',
      height: '32px',
      borderRadius: '6px',
      border: `1px solid ${isDark ? '#38506e' : '#cbd5e1'}`,
      background: isDark ? '#17263d' : '#fff',
      color: isDark ? '#dbeafe' : '#334155',
      cursor: 'pointer'
    },

    modal: {
      position: 'fixed',
      inset: 0,
      zIndex: 2000,
      background: 'rgba(0,0,0,.72)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    },

    modalContent: {
      width: '100%',
      maxWidth: '900px',
      maxHeight: '90vh',
      overflowY: 'auto',
      padding: '24px',
      borderRadius: '16px',
      background: isDark ? '#17263d' : '#fff',
      border: `1px solid ${isDark ? '#38506e' : '#e2e8f0'}`
    },

    modalHeader: {
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: '15px',
      marginBottom: '20px'
    },

    modalTitle: {
      margin: 0,
      fontSize: '1.25rem',
      color: isDark ? '#e2e8f0' : '#1e293b'
    },

    closeButton: {
      border: 'none',
      background: 'transparent',
      color: isDark ? '#94a3b8' : '#64748b',
      cursor: 'pointer',
      fontSize: '1.1rem'
    },

    detailGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))',
      gap: '10px',
      marginBottom: '20px'
    },

    detailItem: {
      padding: '12px',
      borderRadius: '8px',
      background: isDark ? '#101c2d' : '#f8fafc'
    },

    detailLabel: {
      display: 'block',
      fontSize: '.68rem',
      textTransform: 'uppercase',
      color: isDark ? '#94a3b8' : '#64748b',
      marginBottom: '4px'
    },

    detailValue: {
      fontWeight: 700,
      color: isDark ? '#e2e8f0' : '#1e293b'
    },

    actionGrid: {
      display: 'flex',
      gap: '8px',
      flexWrap: 'wrap',
      marginBottom: '22px'
    },

    formGroup: {
      marginBottom: '15px'
    },

    label: {
      display: 'block',
      marginBottom: '6px',
      fontSize: '.8rem',
      fontWeight: 700,
      color: isDark ? '#cbd5e1' : '#475569'
    },

    formInput: {
      width: '100%',
      boxSizing: 'border-box',
      padding: '10px 12px',
      borderRadius: '8px',
      border: `1px solid ${isDark ? '#38506e' : '#cbd5e1'}`,
      background: isDark ? '#101b2c' : '#fff',
      color: isDark ? '#e2e8f0' : '#1e293b',
      outline: 'none'
    },

    history: {
      maxHeight: '260px',
      overflowY: 'auto',
      border: `1px solid ${isDark ? '#2d415d' : '#e2e8f0'}`,
      borderRadius: '8px'
    },

    historyRow: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: '10px',
      padding: '10px 12px',
      borderBottom: `1px solid ${isDark ? '#263b57' : '#edf2f7'}`
    }
  };

  // =========================================================
  // FETCH INVENTORY
  // =========================================================

  const fetchInventory = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    else setRefreshing(true);

    try {
      const params = {
        limit: 500
      };

      if (filterStatus) params.status = filterStatus;
      if (filterCategory) params.category = filterCategory;
      if (filterLocation) params.location = filterLocation;

      const response = await axios.get('/api/inventory', { params });

      const inventory =
        response.data?.inventory ||
        response.data?.data ||
        [];

      setAssets(Array.isArray(inventory) ? inventory : []);
    } catch (error) {
      console.error('Inventory fetch error:', error);
      setAssets([]);
      toast.error(t.fetchError);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [
    filterStatus,
    filterCategory,
    filterLocation,
    t.fetchError
  ]);

  useEffect(() => {
    fetchInventory(true);
  }, [fetchInventory]);

  // =========================================================
  // NORMALIZE STATUS
  // =========================================================

  const normalizedStatus = useCallback((item) => {
    return String(
      item?.status ||
      item?.stock_status ||
      ''
    ).trim().toLowerCase();
  }, []);

  const getQuantity = (item, field, fallback = 0) => {
    const value = Number(item?.[field]);
    return Number.isFinite(value) ? value : fallback;
  };

  // =========================================================
  // STATISTICS
  // =========================================================

  const stats = useMemo(() => {
    const result = { ...EMPTY_STATS };

    assets.forEach(item => {
      const status = normalizedStatus(item);

      const quantity = getQuantity(
        item,
        'quantity'
      );

      const available = getQuantity(
        item,
        'available_quantity'
      );

      result.total += 1;
      result.totalQuantity += quantity;

      if (
        status === 'available' ||
        available > 0
      ) {
        result.available += 1;
      }

      if (status === 'reserved') {
        result.reserved += 1;
      }

      if (
        status === 'issued' ||
        status === 'assigned'
      ) {
        result.issued += 1;
      }

      if (status === 'damaged') {
        result.damaged += 1;
      }

      if (
        status === 'missing' ||
        status === 'lost'
      ) {
        result.missing += 1;
      }

      if (
        item?.is_low_stock ||
        item?.stock_status === 'Low Stock' ||
        (
          Number.isFinite(Number(item?.min_stock)) &&
          available <= Number(item.min_stock)
        )
      ) {
        result.lowStock += 1;
      }
    });

    return result;
  }, [assets, normalizedStatus]);

  // =========================================================
  // UNIQUE FILTER DATA
  // =========================================================

  const uniqueCategories = useMemo(
    () => [
      ...new Set(
        assets
          .map(item => item?.category)
          .filter(Boolean)
      )
    ].sort(),
    [assets]
  );

  const uniqueLocations = useMemo(
    () => [
      ...new Set(
        assets
          .map(item => item?.location)
          .filter(Boolean)
      )
    ].sort(),
    [assets]
  );

  const uniqueConditions = useMemo(
    () => [
      ...new Set(
        assets
          .map(item => item?.condition)
          .filter(Boolean)
      )
    ].sort(),
    [assets]
  );

  // =========================================================
  // VIEW FILTER
  // =========================================================

  const viewFilteredAssets = useMemo(() => {
    let result = [...assets];

    const query = search
      .trim()
      .toLowerCase();

    if (query) {
      result = result.filter(item =>
        [
          item?.name,
          item?.item_id,
          item?.asset_id,
          item?.serial_number,
          item?.category,
          item?.location,
          item?.supplier,
          item?.condition
        ].some(value =>
          String(value || '')
            .toLowerCase()
            .includes(query)
        )
      );
    }

    if (filterCondition) {
      result = result.filter(
        item =>
          String(item?.condition || '') ===
          filterCondition
      );
    }

    if (showLowStock) {
      result = result.filter(item =>
        item?.is_low_stock ||
        item?.stock_status === 'Low Stock' ||
        (
          Number.isFinite(Number(item?.min_stock)) &&
          getQuantity(item, 'available_quantity') <=
            Number(item.min_stock)
        )
      );
    }

    const statusMatches = {
      available: [
        'available'
      ],
      reserved: [
        'reserved'
      ],
      assigned: [
        'assigned',
        'issued'
      ],
      damaged: [
        'damaged'
      ],
      missing: [
        'missing',
        'lost'
      ]
    };

    if (
      activeView !== 'overview' &&
      statusMatches[activeView]
    ) {
      result = result.filter(item =>
        statusMatches[activeView].includes(
          normalizedStatus(item)
        )
      );
    }

    if (activeView === 'stock-levels') {
      result = result.filter(item =>
        item?.is_low_stock ||
        item?.stock_status === 'Low Stock' ||
        (
          Number.isFinite(Number(item?.min_stock)) &&
          getQuantity(item, 'available_quantity') <=
            Number(item.min_stock)
        )
      );
    }

    return result;
  }, [
    assets,
    search,
    filterCondition,
    showLowStock,
    activeView,
    normalizedStatus
  ]);

  // =========================================================
  // SORT
  // =========================================================

  const sortedAssets = useMemo(() => {
    const result = [...viewFilteredAssets];

    result.sort((a, b) => {
      let aValue = a?.[sortField];
      let bValue = b?.[sortField];

      if (
        sortField === 'quantity' ||
        sortField === 'available_quantity' ||
        sortField === 'issued_quantity'
      ) {
        aValue = Number(aValue) || 0;
        bValue = Number(bValue) || 0;
      } else {
        aValue = String(aValue || '').toLowerCase();
        bValue = String(bValue || '').toLowerCase();
      }

      if (aValue < bValue) {
        return sortDirection === 'asc'
          ? -1
          : 1;
      }

      if (aValue > bValue) {
        return sortDirection === 'asc'
          ? 1
          : -1;
      }

      return 0;
    });

    return result;
  }, [
    viewFilteredAssets,
    sortField,
    sortDirection
  ]);

  // =========================================================
  // PAGINATION
  // =========================================================

  const totalPages = Math.max(
    1,
    Math.ceil(sortedAssets.length / pageSize)
  );

  const safePage = Math.min(
    currentPage,
    totalPages
  );

  const paginatedAssets = useMemo(() => {
    const start =
      (safePage - 1) * pageSize;

    return sortedAssets.slice(
      start,
      start + pageSize
    );
  }, [
    sortedAssets,
    safePage,
    pageSize
  ]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    search,
    filterStatus,
    filterCategory,
    filterLocation,
    filterCondition,
    showLowStock,
    activeView,
    pageSize
  ]);

  // =========================================================
  // SORT HANDLER
  // =========================================================

  const handleSort = field => {
    if (sortField === field) {
      setSortDirection(prev =>
        prev === 'asc' ? 'desc' : 'asc'
      );
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) {
      return <FaSort />;
    }

    return sortDirection === 'asc'
      ? <FaSortUp />
      : <FaSortDown />;
  };

  // =========================================================
  // FILTER CLEAR
  // =========================================================

  const clearFilters = () => {
    setSearch('');
    setFilterStatus('');
    setFilterCategory('');
    setFilterLocation('');
    setFilterCondition('');
    setShowLowStock(false);
    setActiveView('overview');
    setCurrentPage(1);
  };

  // =========================================================
  // SELECT ITEMS
  // =========================================================

  const toggleSelect = id => {
    setSelectedIds(prev =>
      prev.includes(id)
        ? prev.filter(itemId => itemId !== id)
        : [...prev, id]
    );
  };

  const allCurrentSelected =
    paginatedAssets.length > 0 &&
    paginatedAssets.every(item =>
      selectedIds.includes(item.id)
    );

  const toggleSelectAll = () => {
    const currentIds = paginatedAssets.map(
      item => item.id
    );

    if (allCurrentSelected) {
      setSelectedIds(prev =>
        prev.filter(
          id => !currentIds.includes(id)
        )
      );
    } else {
      setSelectedIds(prev =>
        Array.from(
          new Set([
            ...prev,
            ...currentIds
          ])
        )
      );
    }
  };

  // =========================================================
  // ITEM DETAIL
  // =========================================================

  const handleItemClick = async item => {
    setSelectedItem(item);
    setMovementHistory([]);
    setShowDetailModal(true);
    setHistoryLoading(true);

    try {
      const response =
        await axios.get(
          '/api/transactions',
          {
            params: {
              asset_id:
                item.asset_id || item.id
            }
          }
        );

      setMovementHistory(
        response.data?.transactions || []
      );
    } catch (error) {
      console.error(
        'Movement history error:',
        error
      );

      setMovementHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  // =========================================================
  // MOVEMENT
  // =========================================================

  const openMovement = (
    type,
    item = selectedItem
  ) => {
    if (!item) return;

    setSelectedItem(item);
    setMovementType(type);

    setMovementData({
      quantity: 1,
      reason: '',
      destination: '',
      recipient: '',
      adjustmentType: 'increase'
    });

    setShowDetailModal(false);
    setShowMovementModal(true);
  };

  const movementTitle = {
    receive: t.receiveStock,
    issue: t.issueStock,
    return: t.returnStock,
    damage: t.damageStock,
    transfer: t.transferStock,
    adjustment: t.stockAdjustment
  };

  const submitMovement = async () => {
    if (!selectedItem) return;

    const quantity =
      Number(movementData.quantity);

    if (
      !Number.isFinite(quantity) ||
      quantity <= 0
    ) {
      toast.error(t.invalidQuantity);
      return;
    }

    if (
      (
        movementType === 'issue' ||
        movementType === 'damage'
      ) &&
      quantity >
        getQuantity(
          selectedItem,
          'available_quantity'
        )
    ) {
      toast.error(t.insufficientStock);
      return;
    }

    if (
      movementType === 'transfer' &&
      !movementData.destination.trim()
    ) {
      toast.error(t.destinationRequired);
      return;
    }

    try {
      await axios.post(
        `/api/inventory/${
          selectedItem.asset_id ||
          selectedItem.id
        }/movement`,
        {
          ...movementData,
          quantity,
          type: movementType
        }
      );

      toast.success(
        t.movementSuccess
      );

      setShowMovementModal(false);
      await fetchInventory(false);
    } catch (error) {
      console.error(
        'Movement error:',
        error
      );

      toast.error(
        error?.response?.data?.message ||
          t.movementError
      );
    }
  };

  // =========================================================
  // EXCEL EXPORT
  // =========================================================

  const exportToExcel = () => {
    const data =
      sortedAssets.map(item => ({
        'Item ID':
          item.item_id || '',
        'Asset ID':
          item.asset_id || '',
        'Item Name':
          item.name || '',
        Category:
          item.category || '',
        'Serial Number':
          item.serial_number || '',
        Quantity:
          getQuantity(item, 'quantity'),
        Available:
          getQuantity(
            item,
            'available_quantity'
          ),
        Issued:
          getQuantity(
            item,
            'issued_quantity'
          ),
        Reserved:
          getQuantity(
            item,
            'reserved_quantity'
          ),
        Damaged:
          getQuantity(
            item,
            'damaged_quantity'
          ),
        Location:
          item.location || '',
        Condition:
          item.condition || '',
        Status:
          item.status || '',
        'Stock Status':
          item.stock_status || '',
        Supplier:
          item.supplier || '',
        'Date Received':
          item.date_received
            ? new Date(
                item.date_received
              ).toLocaleDateString()
            : '',
        'Current Value':
          item.current_value || 0
      }));

    const worksheet =
      XLSX.utils.json_to_sheet(data);

    const workbook =
      XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      'Inventory'
    );

    XLSX.writeFile(
      workbook,
      `store-inventory-${new Date()
        .toISOString()
        .slice(0, 10)}.xlsx`
    );

    toast.success(
      t.exportSuccess
    );
  };

  // =========================================================
  // STATUS COLORS
  // =========================================================

  const getStatusColor = status => {
    const value =
      String(status || '').toLowerCase();

    if (value === 'available')
      return colors.success;

    if (value === 'reserved')
      return colors.purple;

    if (
      value === 'issued' ||
      value === 'assigned'
    )
      return colors.primary;

    if (value === 'returned')
      return colors.cyan;

    if (value === 'damaged')
      return colors.danger;

    if (
      value === 'missing' ||
      value === 'lost'
    )
      return '#b91c1c';

    if (
      value === 'under inspection'
    )
      return colors.warning;

    return '#94a3b8';
  };

  const getStockColor = status => {
    const value =
      String(status || '').toLowerCase();

    if (value === 'normal')
      return colors.success;

    if (value === 'low stock')
      return colors.warning;

    if (value === 'damaged')
      return colors.danger;

    if (value === 'disposed')
      return '#94a3b8';

    return colors.primary;
  };

  // =========================================================
  // MOVEMENT ICON
  // =========================================================

  const MovementIcon = ({ type }) => {
    const value =
      String(type || '').toLowerCase();

    if (value.includes('receive'))
      return <FaArrowDown />;

    if (value.includes('issue'))
      return <FaArrowUp />;

    if (value.includes('return'))
      return <FaUndo />;

    if (value.includes('damage'))
      return <FaTools />;

    if (value.includes('transfer'))
      return <FaExchangeAlt />;

    if (value.includes('adjust'))
      return <FaAdjust />;

    return <FaHistory />;
  };

  // =========================================================
  // KPI CARDS
  // =========================================================

  const kpis = [
    {
      key: 'overview',
      label: t.totalItems,
      value: stats.total,
      icon: <FaBoxes />,
      color: colors.primary,
      view: 'overview'
    },
    {
      key: 'available',
      label: t.available,
      value: stats.available,
      icon: <FaCheckCircle />,
      color: colors.success,
      view: 'available'
    },
    {
      key: 'reserved',
      label: t.reserved,
      value: stats.reserved,
      icon: <FaClipboardList />,
      color: colors.purple,
      view: 'reserved'
    },
    {
      key: 'assigned',
      label: t.assigned,
      value: stats.issued,
      icon: <FaUser />,
      color: colors.primary,
      view: 'assigned'
    },
    {
      key: 'damaged',
      label: t.damaged,
      value: stats.damaged,
      icon: <FaExclamationTriangle />,
      color: colors.danger,
      view: 'damaged'
    },
    {
      key: 'missing',
      label: t.missing,
      value: stats.missing,
      icon: <FaTimesCircle />,
      color: '#b91c1c',
      view: 'missing'
    },
    {
      key: 'lowStock',
      label: t.lowStock,
      value: stats.lowStock,
      icon: <FaDatabase />,
      color: colors.warning,
      view: 'stock-levels'
    }
  ];

  // =========================================================
  // TABS
  // =========================================================

  const tabs = [
    {
      id: 'overview',
      label: t.inventoryOverview,
      icon: <FaLayerGroup />
    },
    {
      id: 'available',
      label: t.availableAssets,
      icon: <FaCheckCircle />
    },
    {
      id: 'reserved',
      label: t.reservedAssets,
      icon: <FaClipboardList />
    },
    {
      id: 'assigned',
      label: t.assignedAssets,
      icon: <FaUser />
    },
    {
      id: 'damaged',
      label: t.damagedAssets,
      icon: <FaExclamationTriangle />
    },
    {
      id: 'missing',
      label: t.missingAssets,
      icon: <FaTimesCircle />
    },
    {
      id: 'stock-levels',
      label: t.stockLevels,
      icon: <FaChartLine />
    }
  ];

  // =========================================================
  // RENDER
  // =========================================================

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.page}>
          <div
            style={{
              ...styles.card,
              ...styles.empty
            }}
          >
            <FaBoxes
              size={38}
              style={{
                marginBottom: '12px'
              }}
            />

            <div>
              {t.loading}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.page}>

        {/* =================================================
            HEADER
        ================================================= */}

        <header style={styles.header}>
          <div>
            <h1 style={styles.title}>
              <FaWarehouse
                color={colors.primary}
              />
              {t.inventory}
            </h1>

            <p style={styles.subtitle}>
              {t.inventorySubtitle}
            </p>
          </div>

          <div style={styles.headerActions}>
            <button
              style={{
                ...styles.button,
                ...styles.secondaryButton
              }}
              onClick={() =>
                fetchInventory(false)
              }
              disabled={refreshing}
            >
              <FaSyncAlt
                style={
                  refreshing
                    ? {
                        animation:
                          'spin 1s linear infinite'
                      }
                    : undefined
                }
              />

              {t.refresh}
            </button>

            <button
              style={{
                ...styles.button,
                ...styles.successButton
              }}
              onClick={exportToExcel}
            >
              <FaFileExcel />
              {t.exportExcel}
            </button>

            <button
              style={{
                ...styles.button,
                ...styles.primaryButton
              }}
              onClick={() =>
                navigate(
                  '/store/inventory/add'
                )
              }
            >
              <FaPlus />
              {t.addStock}
            </button>
          </div>
        </header>

        {/* =================================================
            KPI CARDS
        ================================================= */}

        <div style={styles.kpiGrid}>
          {kpis.map(kpi => (
            <div
              key={kpi.key}
              style={{
                ...styles.card,
                ...styles.kpi
              }}
              onClick={() => {
                setActiveView(kpi.view);

                if (
                  kpi.view ===
                  'stock-levels'
                ) {
                  setShowLowStock(true);
                } else {
                  setShowLowStock(false);
                }
              }}
            >
              <div
                style={{
                  ...styles.kpiIcon,
                  background:
                    `${kpi.color}18`,
                  color: kpi.color
                }}
              >
                {kpi.icon}
              </div>

              <div
                style={{
                  ...styles.kpiValue,
                  color: kpi.color
                }}
              >
                {kpi.value}
              </div>

              <div style={styles.kpiLabel}>
                {kpi.label}
              </div>
            </div>
          ))}
        </div>

        {/* =================================================
            NAVIGATION TABS
        ================================================= */}

        <div style={styles.tabs}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              style={{
                ...styles.tab,
                background:
                  activeView === tab.id
                    ? colors.primary
                    : 'transparent',
                color:
                  activeView === tab.id
                    ? '#fff'
                    : isDark
                    ? '#cbd5e1'
                    : '#475569'
              }}
              onClick={() => {
                setActiveView(tab.id);

                if (
                  tab.id !==
                  'stock-levels'
                ) {
                  setShowLowStock(false);
                }
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* =================================================
            FILTERS
        ================================================= */}

        <div style={styles.controls}>
          <div
            style={{
              position: 'relative',
              flex: '1 1 220px'
            }}
          >
            <FaSearch
              style={{
                position: 'absolute',
                left: '11px',
                top: '50%',
                transform:
                  'translateY(-50%)',
                color: isDark
                  ? '#64748b'
                  : '#94a3b8'
              }}
            />

            <input
              type="text"
              value={search}
              onChange={e =>
                setSearch(e.target.value)
              }
              placeholder={
                t.searchPlaceholder
              }
              style={{
                ...styles.input,
                width: '100%',
                boxSizing: 'border-box',
                paddingLeft: '34px'
              }}
            />
          </div>

          <select
            style={styles.select}
            value={filterStatus}
            onChange={e =>
              setFilterStatus(
                e.target.value
              )
            }
          >
            <option value="">
              {t.allStatus}
            </option>
            <option value="Available">
              {t.available}
            </option>
            <option value="Reserved">
              {t.reserved}
            </option>
            <option value="Issued">
              {t.assigned}
            </option>
            <option value="Damaged">
              {t.damaged}
            </option>
            <option value="Missing">
              {t.missing}
            </option>
            <option value="Under Inspection">
              {t.underInspection}
            </option>
            <option value="Disposed">
              {t.disposed}
            </option>
          </select>

          <select
            style={styles.select}
            value={filterCategory}
            onChange={e =>
              setFilterCategory(
                e.target.value
              )
            }
          >
            <option value="">
              {t.allCategories}
            </option>

            {uniqueCategories.map(
              category => (
                <option
                  key={category}
                  value={category}
                >
                  {category}
                </option>
              )
            )}
          </select>

          <select
            style={styles.select}
            value={filterLocation}
            onChange={e =>
              setFilterLocation(
                e.target.value
              )
            }
          >
            <option value="">
              {t.allLocations}
            </option>

            {uniqueLocations.map(
              location => (
                <option
                  key={location}
                  value={location}
                >
                  {location}
                </option>
              )
            )}
          </select>

          <select
            style={styles.select}
            value={filterCondition}
            onChange={e =>
              setFilterCondition(
                e.target.value
              )
            }
          >
            <option value="">
              {t.allConditions}
            </option>

            {uniqueConditions.map(
              condition => (
                <option
                  key={condition}
                  value={condition}
                >
                  {condition}
                </option>
              )
            )}
          </select>

          <label
            style={styles.checkboxLabel}
          >
            <input
              type="checkbox"
              checked={showLowStock}
              onChange={e =>
                setShowLowStock(
                  e.target.checked
                )
              }
            />

            {t.showLowStock}
          </label>

          <button
            style={{
              ...styles.button,
              ...styles.secondaryButton
            }}
            onClick={clearFilters}
          >
            <FaTimes />
            {t.clearFilters}
          </button>
        </div>

        {/* =================================================
            RESULTS SUMMARY
        ================================================= */}

        <div
          style={{
            display: 'flex',
            justifyContent:
              'space-between',
            alignItems: 'center',
            gap: '10px',
            flexWrap: 'wrap',
            marginBottom: '10px',
            color: isDark
              ? '#94a3b8'
              : '#64748b',
            fontSize: '.82rem'
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '7px'
            }}
          >
            <FaFilter />

            {t.showing}{' '}
            <strong>
              {sortedAssets.length}
            </strong>{' '}
            {t.items}
          </div>

          {selectedIds.length > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <FaCheck />

              {selectedIds.length}{' '}
              {t.selected}
            </div>
          )}
        </div>

        {/* =================================================
            INVENTORY TABLE
        ================================================= */}

        <div
          style={{
            ...styles.tableWrapper,
            ...styles.card
          }}
        >
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>
                  <input
                    type="checkbox"
                    checked={
                      allCurrentSelected
                    }
                    onChange={
                      toggleSelectAll
                    }
                  />
                </th>

                <th style={styles.th}>
                  <button
                    onClick={() =>
                      handleSort(
                        'item_id'
                      )
                    }
                    style={sortButtonStyle(
                      isDark
                    )}
                  >
                    {t.itemId}
                    <SortIcon field="item_id" />
                  </button>
                </th>

                <th style={styles.th}>
                  <button
                    onClick={() =>
                      handleSort(
                        'name'
                      )
                    }
                    style={sortButtonStyle(
                      isDark
                    )}
                  >
                    {t.name}
                    <SortIcon field="name" />
                  </button>
                </th>

                <th style={styles.th}>
                  {t.category}
                </th>

                <th style={styles.th}>
                  <button
                    onClick={() =>
                      handleSort(
                        'quantity'
                      )
                    }
                    style={sortButtonStyle(
                      isDark
                    )}
                  >
                    {t.quantity}
                    <SortIcon
                      field="quantity"
                    />
                  </button>
                </th>

                <th style={styles.th}>
                  <button
                    onClick={() =>
                      handleSort(
                        'available_quantity'
                      )
                    }
                    style={sortButtonStyle(
                      isDark
                    )}
                  >
                    {t.available}
                    <SortIcon
                      field="available_quantity"
                    />
                  </button>
                </th>

                <th style={styles.th}>
                  {t.reserved}
                </th>

                <th style={styles.th}>
                  {t.assigned}
                </th>

                <th style={styles.th}>
                  {t.status}
                </th>

                <th style={styles.th}>
                  {t.location}
                </th>

                <th style={styles.th}>
                  {t.stockStatus}
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
                    colSpan="12"
                    style={styles.empty}
                  >
                    <FaBoxes
                      size={38}
                      style={{
                        marginBottom:
                          '12px'
                      }}
                    />

                    <div>
                      {t.noItems}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedAssets.map(item => {
                  const available =
                    getQuantity(
                      item,
                      'available_quantity'
                    );

                  const lowStock =
                    item?.is_low_stock ||
                    item?.stock_status ===
                      'Low Stock' ||
                    (
                      Number.isFinite(
                        Number(
                          item?.min_stock
                        )
                      ) &&
                      available <=
                        Number(
                          item.min_stock
                        )
                    );

                  return (
                    <tr
                      key={
                        item.id ||
                        item.asset_id ||
                        item.item_id
                      }
                      style={{
                        cursor: 'pointer'
                      }}
                      onDoubleClick={() =>
                        handleItemClick(
                          item
                        )
                      }
                    >
                      <td style={styles.td}>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(
                            item.id
                          )}
                          onChange={() =>
                            toggleSelect(
                              item.id
                            )
                          }
                          onClick={e =>
                            e.stopPropagation()
                          }
                        />
                      </td>

                      <td style={styles.td}>
                        <span
                          style={
                            styles.itemCode
                          }
                        >
                          <FaTag
                            size={9}
                          />{' '}
                          {item.item_id ||
                            item.asset_id ||
                            '-'}
                        </span>
                      </td>

                      <td style={styles.td}>
                        <strong>
                          {item.name ||
                            '-'}
                        </strong>

                        {item.serial_number && (
                          <div
                            style={{
                              fontSize:
                                '.7rem',
                              color:
                                isDark
                                  ? '#64748b'
                                  : '#94a3b8',
                              marginTop:
                                '3px'
                            }}
                          >
                            <FaBarcode
                              size={9}
                            />{' '}
                            {
                              item.serial_number
                            }
                          </div>
                        )}
                      </td>

                      <td style={styles.td}>
                        {item.category ||
                          '-'}
                      </td>

                      <td style={styles.td}>
                        <strong>
                          {getQuantity(
                            item,
                            'quantity'
                          )}
                        </strong>
                      </td>

                      <td style={styles.td}>
                        <div
                          style={
                            styles.quantityBox
                          }
                        >
                          <span
                            style={
                              lowStock
                                ? styles.quantityLow
                                : styles.quantityAvailable
                            }
                          >
                            {available}
                          </span>

                          {lowStock && (
                            <FaExclamationTriangle
                              color={
                                colors.warning
                              }
                              size={12}
                            />
                          )}
                        </div>
                      </td>

                      <td style={styles.td}>
                        {getQuantity(
                          item,
                          'reserved_quantity'
                        )}
                      </td>

                      <td style={styles.td}>
                        {getQuantity(
                          item,
                          'issued_quantity'
                        )}
                      </td>

                      <td style={styles.td}>
                        <span
                          style={styles.badge(
                            getStatusColor(
                              item.status
                            )
                          )}
                        >
                          {item.status ||
                            '-'}
                        </span>
                      </td>

                      <td style={styles.td}>
                        <span
                          style={{
                            display:
                              'inline-flex',
                            alignItems:
                              'center',
                            gap: '5px'
                          }}
                        >
                          <FaMapMarkerAlt
                            size={11}
                          />

                          {item.location ||
                            '-'}
                        </span>
                      </td>

                      <td style={styles.td}>
                        <span
                          style={styles.badge(
                            getStockColor(
                              item.stock_status ||
                                'Normal'
                            )
                          )}
                        >
                          {item.stock_status ||
                            'Normal'}
                        </span>
                      </td>

                      <td style={styles.td}>
                        <button
                          title={
                            t.viewDetails
                          }
                          style={{
                            ...styles.button,
                            ...styles.secondaryButton,
                            padding:
                              '6px 9px'
                          }}
                          onClick={() =>
                            handleItemClick(
                              item
                            )
                          }
                        >
                          <FaEye />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {/* =================================================
              PAGINATION
          ================================================= */}

          <div style={styles.pagination}>
            <div>
              {t.page}{' '}
              <strong>
                {safePage}
              </strong>{' '}
              {t.of}{' '}
              <strong>
                {totalPages}
              </strong>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems:
                  'center',
                gap: '8px'
              }}
            >
              <select
                value={pageSize}
                onChange={e =>
                  setPageSize(
                    Number(
                      e.target.value
                    )
                  )
                }
                style={{
                  ...styles.select,
                  minWidth: '90px'
                }}
              >
                <option value={10}>
                  10
                </option>
                <option value={15}>
                  15
                </option>
                <option value={25}>
                  25
                </option>
                <option value={50}>
                  50
                </option>
              </select>

              <div
                style={
                  styles.pageButtons
                }
              >
                <button
                  style={
                    styles.pageButton
                  }
                  disabled={
                    safePage <= 1
                  }
                  onClick={() =>
                    setCurrentPage(
                      prev =>
                        Math.max(
                          1,
                          prev - 1
                        )
                    )
                  }
                >
                  <FaChevronLeft />
                </button>

                <span
                  style={{
                    padding:
                      '0 7px',
                    fontSize:
                      '.8rem'
                  }}
                >
                  {safePage} /{' '}
                  {totalPages}
                </span>

                <button
                  style={
                    styles.pageButton
                  }
                  disabled={
                    safePage >=
                    totalPages
                  }
                  onClick={() =>
                    setCurrentPage(
                      prev =>
                        Math.min(
                          totalPages,
                          prev + 1
                        )
                    )
                  }
                >
                  <FaChevronRight />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* =================================================
            DETAIL MODAL
        ================================================= */}

        {showDetailModal &&
          selectedItem && (
            <div
              style={styles.modal}
              onClick={() =>
                setShowDetailModal(
                  false
                )
              }
            >
              <div
                style={
                  styles.modalContent
                }
                onClick={e =>
                  e.stopPropagation()
                }
              >
                <div
                  style={
                    styles.modalHeader
                  }
                >
                  <div>
                    <h2
                      style={
                        styles.modalTitle
                      }
                    >
                      <FaBox
                        style={{
                          marginRight:
                            '8px'
                        }}
                      />

                      {selectedItem.name ||
                        '-'}
                    </h2>

                    <div
                      style={{
                        marginTop:
                          '5px',
                        fontSize:
                          '.78rem',
                        color:
                          isDark
                            ? '#94a3b8'
                            : '#64748b'
                      }}
                    >
                      {selectedItem.item_id ||
                        selectedItem.asset_id}
                    </div>
                  </div>

                  <button
                    style={
                      styles.closeButton
                    }
                    onClick={() =>
                      setShowDetailModal(
                        false
                      )
                    }
                  >
                    <FaTimes />
                  </button>
                </div>

                {/* DETAIL GRID */}

                <div
                  style={
                    styles.detailGrid
                  }
                >
                  <DetailItem
                    label={t.itemId}
                    value={
                      selectedItem.item_id ||
                      '-'
                    }
                  />

                  <DetailItem
                    label={t.assetId}
                    value={
                      selectedItem.asset_id ||
                      '-'
                    }
                  />

                  <DetailItem
                    label={t.category}
                    value={
                      selectedItem.category ||
                      '-'
                    }
                  />

                  <DetailItem
                    label={t.serialNumber}
                    value={
                      selectedItem.serial_number ||
                      '-'
                    }
                  />

                  <DetailItem
                    label={t.totalQuantity}
                    value={getQuantity(
                      selectedItem,
                      'quantity'
                    )}
                  />

                  <DetailItem
                    label={t.available}
                    value={getQuantity(
                      selectedItem,
                      'available_quantity'
                    )}
                  />

                  <DetailItem
                    label={t.reserved}
                    value={getQuantity(
                      selectedItem,
                      'reserved_quantity'
                    )}
                  />

                  <DetailItem
                    label={t.assigned}
                    value={getQuantity(
                      selectedItem,
                      'issued_quantity'
                    )}
                  />

                  <DetailItem
                    label={t.damaged}
                    value={getQuantity(
                      selectedItem,
                      'damaged_quantity'
                    )}
                  />

                  <DetailItem
                    label={t.location}
                    value={
                      selectedItem.location ||
                      '-'
                    }
                  />

                  <DetailItem
                    label={t.condition}
                    value={
                      selectedItem.condition ||
                      '-'
                    }
                  />

                  <DetailItem
                    label={t.supplier}
                    value={
                      selectedItem.supplier ||
                      '-'
                    }
                  />

                  <DetailItem
                    label={t.dateReceived}
                    value={
                      selectedItem.date_received
                        ? new Date(
                            selectedItem.date_received
                          ).toLocaleDateString()
                        : '-'
                    }
                  />

                  <DetailItem
                    label={t.status}
                    value={
                      selectedItem.status ||
                      '-'
                    }
                  />

                  <DetailItem
                    label={t.stockStatus}
                    value={
                      selectedItem.stock_status ||
                      'Normal'
                    }
                  />

                  <DetailItem
                    label={t.currentValue}
                    value={
                      selectedItem.current_value !=
                      null
                        ? Number(
                            selectedItem.current_value
                          ).toLocaleString()
                        : '-'
                    }
                  />
                </div>

                {/* ACTIONS */}

                <div
                  style={
                    styles.actionGrid
                  }
                >
                  <button
                    style={{
                      ...styles.button,
                      ...styles.successButton
                    }}
                    onClick={() =>
                      openMovement(
                        'receive'
                      )
                    }
                  >
                    <FaArrowDown />
                    {t.receiveStock}
                  </button>

                  <button
                    style={{
                      ...styles.button,
                      ...styles.primaryButton
                    }}
                    onClick={() =>
                      openMovement(
                        'issue'
                      )
                    }
                  >
                    <FaArrowUp />
                    {t.issueStock}
                  </button>

                  <button
                    style={{
                      ...styles.button,
                      background:
                        colors.cyan,
                      color: '#fff'
                    }}
                    onClick={() =>
                      openMovement(
                        'return'
                      )
                    }
                  >
                    <FaUndo />
                    {t.returnStock}
                  </button>

                  <button
                    style={{
                      ...styles.button,
                      ...styles.dangerButton
                    }}
                    onClick={() =>
                      openMovement(
                        'damage'
                      )
                    }
                  >
                    <FaTools />
                    {t.damageStock}
                  </button>

                  <button
                    style={{
                      ...styles.button,
                      background:
                        colors.purple,
                      color: '#fff'
                    }}
                    onClick={() =>
                      openMovement(
                        'transfer'
                      )
                    }
                  >
                    <FaExchangeAlt />
                    {t.transferStock}
                  </button>

                  <button
                    style={{
                      ...styles.button,
                      background:
                        colors.warning,
                      color: '#fff'
                    }}
                    onClick={() =>
                      openMovement(
                        'adjustment'
                      )
                    }
                  >
                    <FaAdjust />
                    {t.stockAdjustment}
                  </button>
                </div>

                {/* MOVEMENT HISTORY */}

                <div>
                  <h3
                    style={{
                      display:
                        'flex',
                      alignItems:
                        'center',
                      gap: '7px',
                      fontSize:
                        '1rem',
                      marginBottom:
                        '10px'
                    }}
                  >
                    <FaHistory />
                    {t.inventoryHistory}
                  </h3>

                  <div
                    style={
                      styles.history
                    }
                  >
                    {historyLoading ? (
                      <div
                        style={{
                          ...styles.empty,
                          padding:
                            '25px'
                        }}
                      >
                        {t.loading}
                      </div>
                    ) : movementHistory.length ===
                      0 ? (
                      <div
                        style={{
                          ...styles.empty,
                          padding:
                            '25px'
                        }}
                      >
                        {t.noHistory}
                      </div>
                    ) : (
                      movementHistory.map(
                        (movement, index) => (
                          <div
                            key={
                              movement.id ||
                              index
                            }
                            style={
                              styles.historyRow
                            }
                          >
                            <div
                              style={{
                                display:
                                  'flex',
                                alignItems:
                                  'center',
                                gap:
                                  '8px'
                              }}
                            >
                              <span
                                style={
                                  styles.badge(
                                    colors.primary
                                  )
                                }
                              >
                                <MovementIcon
                                  type={
                                    movement.type
                                  }
                                />

                                {
                                  movement.type
                                }
                              </span>

                              <span>
                                {
                                  movement.quantity
                                }{' '}
                                {t.units}
                              </span>
                            </div>

                            <div
                              style={{
                                textAlign:
                                  'right',
                                fontSize:
                                  '.72rem',
                                color:
                                  isDark
                                    ? '#94a3b8'
                                    : '#64748b'
                              }}
                            >
                              {movement.user ||
                                movement.created_by ||
                                '-'}

                              <br />

                              {movement.date ||
                              movement.created_at
                                ? new Date(
                                    movement.date ||
                                      movement.created_at
                                  ).toLocaleString()
                                : '-'}
                            </div>
                          </div>
                        )
                      )
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

        {/* =================================================
            MOVEMENT / ADJUSTMENT MODAL
        ================================================= */}

        {showMovementModal &&
          selectedItem && (
            <div
              style={styles.modal}
              onClick={() =>
                setShowMovementModal(
                  false
                )
              }
            >
              <div
                style={{
                  ...styles.modalContent,
                  maxWidth: '520px'
                }}
                onClick={e =>
                  e.stopPropagation()
                }
              >
                <div
                  style={
                    styles.modalHeader
                  }
                >
                  <div>
                    <h2
                      style={
                        styles.modalTitle
                      }
                    >
                      <MovementIcon
                        type={
                          movementType
                        }
                      />{' '}
                      {movementTitle[
                        movementType
                      ] ||
                        movementType}
                    </h2>

                    <div
                      style={{
                        marginTop:
                          '5px',
                        fontSize:
                          '.78rem',
                        color:
                          isDark
                            ? '#94a3b8'
                            : '#64748b'
                      }}
                    >
                      {
                        selectedItem.name
                      }
                    </div>
                  </div>

                  <button
                    style={
                      styles.closeButton
                    }
                    onClick={() =>
                      setShowMovementModal(
                        false
                      )
                    }
                  >
                    <FaTimes />
                  </button>
                </div>

                <div
                  style={{
                    padding:
                      '11px',
                    borderRadius:
                      '8px',
                    background:
                      isDark
                        ? '#101c2d'
                        : '#f8fafc',
                    marginBottom:
                      '17px'
                  }}
                >
                  <div
                    style={{
                      fontSize:
                        '.75rem',
                      color:
                        isDark
                          ? '#94a3b8'
                          : '#64748b'
                    }}
                  >
                    {t.currentStock}
                  </div>

                  <strong
                    style={{
                      fontSize:
                        '1.2rem'
                    }}
                  >
                    {getQuantity(
                      selectedItem,
                      'available_quantity'
                    )}{' '}
                    {t.units}
                  </strong>
                </div>

                {/* ADJUSTMENT TYPE */}

                {movementType ===
                  'adjustment' && (
                  <div
                    style={
                      styles.formGroup
                    }
                  >
                    <label
                      style={
                        styles.label
                      }
                    >
                      {t.adjustmentType}
                    </label>

                    <select
                      style={
                        styles.formInput
                      }
                      value={
                        movementData.adjustmentType
                      }
                      onChange={e =>
                        setMovementData(
                          prev => ({
                            ...prev,
                            adjustmentType:
                              e.target.value
                          })
                        )
                      }
                    >
                      <option value="increase">
                        {t.increaseStock}
                      </option>

                      <option value="decrease">
                        {t.decreaseStock}
                      </option>
                    </select>
                  </div>
                )}

                {/* QUANTITY */}

                <div
                  style={
                    styles.formGroup
                  }
                >
                  <label
                    style={
                      styles.label
                    }
                  >
                    {t.quantity}
                  </label>

                  <input
                    type="number"
                    min="1"
                    style={
                      styles.formInput
                    }
                    value={
                      movementData.quantity
                    }
                    onChange={e =>
                      setMovementData(
                        prev => ({
                          ...prev,
                          quantity:
                            Math.max(
                              1,
                              Number(
                                e.target
                                  .value
                              ) || 1
                            )
                        })
                      )
                    }
                  />
                </div>

                {/* RECIPIENT */}

                {(
                  movementType ===
                    'issue' ||
                  movementType ===
                    'transfer'
                ) && (
                  <div
                    style={
                      styles.formGroup
                    }
                  >
                    <label
                      style={
                        styles.label
                      }
                    >
                      {t.recipient}
                    </label>

                    <input
                      type="text"
                      style={
                        styles.formInput
                      }
                      placeholder={
                        t.recipientPlaceholder
                      }
                      value={
                        movementData.recipient
                      }
                      onChange={e =>
                        setMovementData(
                          prev => ({
                            ...prev,
                            recipient:
                              e.target
                                .value
                          })
                        )
                      }
                    />
                  </div>
                )}

                {/* DESTINATION */}

                {movementType ===
                  'transfer' && (
                  <div
                    style={
                      styles.formGroup
                    }
                  >
                    <label
                      style={
                        styles.label
                      }
                    >
                      {t.destination}
                    </label>

                    <input
                      type="text"
                      style={
                        styles.formInput
                      }
                      placeholder={
                        t.destinationPlaceholder
                      }
                      value={
                        movementData.destination
                      }
                      onChange={e =>
                        setMovementData(
                          prev => ({
                            ...prev,
                            destination:
                              e.target
                                .value
                          })
                        )
                      }
                    />
                  </div>
                )}

                {/* REASON */}

                <div
                  style={
                    styles.formGroup
                  }
                >
                  <label
                    style={
                      styles.label
                    }
                  >
                    {t.reason}
                  </label>

                  <textarea
                    style={{
                      ...styles.formInput,
                      minHeight:
                        '90px',
                      resize:
                        'vertical'
                    }}
                    placeholder={
                      t.reasonPlaceholder
                    }
                    value={
                      movementData.reason
                    }
                    onChange={e =>
                      setMovementData(
                        prev => ({
                          ...prev,
                          reason:
                            e.target
                              .value
                        })
                      )
                    }
                  />
                </div>

                <div
                  style={{
                    display:
                      'flex',
                    justifyContent:
                      'flex-end',
                    gap: '8px',
                    marginTop:
                      '20px'
                  }}
                >
                  <button
                    style={{
                      ...styles.button,
                      ...styles.secondaryButton
                    }}
                    onClick={() =>
                      setShowMovementModal(
                        false
                      )
                    }
                  >
                    <FaTimes />
                    {t.cancel}
                  </button>

                  <button
                    style={{
                      ...styles.button,
                      ...styles.successButton
                    }}
                    onClick={
                      submitMovement
                    }
                  >
                    <FaSave />
                    {t.confirm}
                  </button>
                </div>
              </div>
            </div>
          )}
      </div>
    </div>
  );
};

// =============================================================
// DETAIL ITEM
// =============================================================

const DetailItem = ({
  label,
  value
}) => {
  return (
    <div
      style={{
        padding: '12px',
        borderRadius: '8px',
        background:
          'var(--detail-bg, #f8fafc)'
      }}
    >
      <span
        style={{
          display: 'block',
          fontSize: '.68rem',
          textTransform:
            'uppercase',
          color: '#64748b',
          marginBottom:
            '4px'
        }}
      >
        {label}
      </span>

      <strong
        style={{
          fontSize: '.88rem'
        }}
      >
        {value}
      </strong>
    </div>
  );
};

// =============================================================
// HELPER
// =============================================================

const stylesCard = isDark => ({
  background: isDark
    ? '#17263d'
    : '#fff',
  border: `1px solid ${
    isDark
      ? '#2d415d'
      : '#e2e8f0'
  }`,
  borderRadius: '12px'
});

const sortButtonStyle = isDark => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  border: 'none',
  background: 'transparent',
  color: isDark
    ? '#cbd5e1'
    : '#475569',
  cursor: 'pointer',
  fontWeight: 700,
  fontSize: '.73rem',
  padding: 0
});

// =============================================================
// ENGLISH
// =============================================================

const englishTranslations = {
  inventory:
    'Store Inventory',

  inventorySubtitle:
    'Complete inventory overview, stock control, movements and history',

  inventoryOverview:
    'Inventory Overview',

  availableAssets:
    'Available Assets',

  reservedAssets:
    'Reserved Assets',

  assignedAssets:
    'Assigned Assets',

  damagedAssets:
    'Damaged Assets',

  missingAssets:
    'Missing Assets',

  stockLevels:
    'Stock Levels',

  inventoryHistory:
    'Inventory History',

  totalItems:
    'Total Items',

  totalQuantity:
    'Total Quantity',

  available:
    'Available',

  reserved:
    'Reserved',

  assigned:
    'Assigned',

  issued:
    'Issued',

  damaged:
    'Damaged',

  missing:
    'Missing',

  lowStock:
    'Low Stock',

  category:
    'Category',

  location:
    'Location',

  condition:
    'Condition',

  status:
    'Status',

  stockStatus:
    'Stock Status',

  quantity:
    'Quantity',

  itemId:
    'Item ID',

  assetId:
    'Asset ID',

  name:
    'Name',

  serialNumber:
    'Serial Number',

  supplier:
    'Supplier',

  dateReceived:
    'Date Received',

  currentValue:
    'Current Value',

  allStatus:
    'All Status',

  allCategories:
    'All Categories',

  allLocations:
    'All Locations',

  allConditions:
    'All Conditions',

  searchPlaceholder:
    'Search name, item ID, asset ID, serial number...',

  showLowStock:
    'Low stock only',

  clearFilters:
    'Clear Filters',

  refresh:
    'Refresh',

  exportExcel:
    'Export Excel',

  addStock:
    'Add Stock',

  showing:
    'Showing',

  items:
    'items',

  selected:
    'selected',

  page:
    'Page',

  of:
    'of',

  actions:
    'Actions',

  viewDetails:
    'View Details',

  receiveStock:
    'Receive Stock',

  issueStock:
    'Issue Stock',

  returnStock:
    'Return Stock',

  damageStock:
    'Report Damage',

  transferStock:
    'Transfer Stock',

  stockAdjustment:
    'Stock Adjustment',

  adjustmentType:
    'Adjustment Type',

  increaseStock:
    'Increase Stock',

  decreaseStock:
    'Decrease Stock',

  recipient:
    'Recipient',

  destination:
    'Destination',

  recipientPlaceholder:
    'Enter recipient name...',

  destinationPlaceholder:
    'Enter destination location...',

  reason:
    'Reason',

  reasonPlaceholder:
    'Enter reason for this movement...',

  currentStock:
    'Current Stock',

  units:
    'units',

  confirm:
    'Confirm',

  cancel:
    'Cancel',

  loading:
    'Loading inventory...',

  noItems:
    'No inventory items found',

  noHistory:
    'No inventory history found',

  underInspection:
    'Under Inspection',

  disposed:
    'Disposed',

  fetchError:
    'Failed to load inventory',

  exportSuccess:
    'Inventory exported successfully',

  movementSuccess:
    'Inventory movement recorded successfully',

  movementError:
    'Failed to record inventory movement',

  invalidQuantity:
    'Please enter a valid quantity',

  insufficientStock:
    'Insufficient available stock',

  destinationRequired:
    'Destination is required'
};

// =============================================================
// AMHARIC
// =============================================================

const amharicTranslations = {
  inventory:
    'የመደብር ክምችት',

  inventorySubtitle:
    'ሙሉ የክምችት፣ የእቃ እንቅስቃሴ እና ታሪክ አስተዳደር',

  inventoryOverview:
    'የክምችት አጠቃላይ እይታ',

  availableAssets:
    'የሚገኙ እቃዎች',

  reservedAssets:
    'የተያዙ እቃዎች',

  assignedAssets:
    'የተመደቡ እቃዎች',

  damagedAssets:
    'የተጎዱ እቃዎች',

  missingAssets:
    'የጠፉ እቃዎች',

  stockLevels:
    'የክምችት ደረጃ',

  inventoryHistory:
    'የክምችት ታሪክ',

  totalItems:
    'ጠቅላላ እቃዎች',

  totalQuantity:
    'ጠቅላላ ብዛት',

  available:
    'ይገኛል',

  reserved:
    'ተይዟል',

  assigned:
    'ተመድቧል',

  issued:
    'ተሰጥቷል',

  damaged:
    'የተጎዳ',

  missing:
    'የጠፋ',

  lowStock:
    'ዝቅተኛ ክምችት',

  category:
    'ምድብ',

  location:
    'አካባቢ',

  condition:
    'ሁኔታ',

  status:
    'ሁኔታ',

  stockStatus:
    'የክምችት ሁኔታ',

  quantity:
    'ብዛት',

  itemId:
    'የእቃ መለያ',

  assetId:
    'የAsset መለያ',

  name:
    'ስም',

  serialNumber:
    'ተከታታይ ቁጥር',

  supplier:
    'አቅራቢ',

  dateReceived:
    'የተቀበለበት ቀን',

  currentValue:
    'የአሁኑ ዋጋ',

  allStatus:
    'ሁሉም ሁኔታዎች',

  allCategories:
    'ሁሉም ምድቦች',

  allLocations:
    'ሁሉም አካባቢዎች',

  allConditions:
    'ሁሉም ሁኔታዎች',

  searchPlaceholder:
    'በስም፣ በመለያ፣ በSerial Number ይፈልጉ...',

  showLowStock:
    'ዝቅተኛ ክምችት ብቻ',

  clearFilters:
    'ማጣሪያ አጽዳ',

  refresh:
    'አድስ',

  exportExcel:
    'ወደ Excel ላክ',

  addStock:
    'ክምችት ጨምር',

  showing:
    'እየታየ ያለው',

  items:
    'እቃዎች',

  selected:
    'ተመርጧል',

  page:
    'ገጽ',

  of:
    'ከ',

  actions:
    'ተግባራት',

  viewDetails:
    'ዝርዝር እይታ',

  receiveStock:
    'ክምችት ተቀበል',

  issueStock:
    'ክምችት ስጥ',

  returnStock:
    'ክምችት መልስ',

  damageStock:
    'ጉዳት ዘግብ',

  transferStock:
    'ክምችት አስተላልፍ',

  stockAdjustment:
    'የክምችት ማስተካከያ',

  adjustmentType:
    'የማስተካከያ አይነት',

  increaseStock:
    'ክምችት ጨምር',

  decreaseStock:
    'ክምችት ቀንስ',

  recipient:
    'ተቀባይ',

  destination:
    'መድረሻ',

  recipientPlaceholder:
    'የተቀባዩን ስም ያስገቡ...',

  destinationPlaceholder:
    'የመድረሻ ቦታ ያስገቡ...',

  reason:
    'ምክንያት',

  reasonPlaceholder:
    'የእንቅስቃሴውን ምክንያት ያስገቡ...',

  currentStock:
    'የአሁኑ ክምችት',

  units:
    'ክፍሎች',

  confirm:
    'አረጋግጥ',

  cancel:
    'ይቅር',

  loading:
    'ክምችት በመጫን ላይ...',

  noItems:
    'ምንም የክምችት እቃ አልተገኘም',

  noHistory:
    'የክምችት ታሪክ አልተገኘም',

  underInspection:
    'በምርመራ ላይ',

  disposed:
    'ተወግዷል',

  fetchError:
    'ክምችትን መጫን አልተቻለም',

  exportSuccess:
    'ክምችት በተሳካ ሁኔታ ወደ Excel ተላከ',

  movementSuccess:
    'የክምችት እንቅስቃሴ በተሳካ ሁኔታ ተመዝግቧል',

  movementError:
    'የክምችት እንቅስቃሴን መመዝገብ አልተቻለም',

  invalidQuantity:
    'ትክክለኛ ብዛት ያስገቡ',

  insufficientStock:
    'በቂ የሚገኝ ክምችት የለም',

  destinationRequired:
    'የመድረሻ ቦታ ያስፈልጋል'
};

export default StoreInventory;
