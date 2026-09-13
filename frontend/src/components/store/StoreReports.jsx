import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Bar, Doughnut } from 'react-chartjs-2';
import { ArcElement, BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Tooltip } from 'chart.js';
import * as XLSX from 'xlsx';
import { useLanguage } from '../../contexts/UiContext';
import { apiClient } from '../../utils/api';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

const safeNumber = (value) => {
  const numericValue = Number(value ?? 0);
  return Number.isFinite(numericValue) ? numericValue : 0;
};

const normalizeStatus = (value) => String(value ?? '').trim().toLowerCase();

const formatCurrency = (value) => `ETB ${safeNumber(value).toLocaleString()}`;

const displayStatus = (value) => {
  const normalized = normalizeStatus(value);
  const map = {
    available: 'Available',
    in_store: 'Available',
    'in-store': 'Available',
    assigned: 'Assigned',
    issued: 'Assigned',
    in_use: 'Assigned',
    'under-maintenance': 'Under Maintenance',
    maintenance: 'Under Maintenance',
    damaged: 'Damaged',
    missing: 'Missing',
    lost: 'Missing',
    retired: 'Retired',
    disposed: 'Disposed',
    pending: 'Pending',
    approved: 'Approved',
    returned: 'Returned',
    'ready-for-return': 'Ready for Return',
  };

  return map[normalized] || String(value || 'Unknown');
};

const getInventoryStatus = (row) => {
  const status = displayStatus(row?.status || row?.assetStatus || 'available');
  if (status === 'Assigned') return 'Assigned';
  if (status === 'Under Maintenance') return 'Under Maintenance';
  if (status === 'Damaged') return 'Damaged';
  if (status === 'Missing') return 'Missing';
  if (status === 'Retired') return 'Retired';
  return 'Available';
};

const getAssetValue = (asset) => {
  const value = asset?.currentValue ?? asset?.current_value ?? asset?.purchasePrice ?? asset?.purchase_price ?? asset?.purchaseCost ?? asset?.purchase_cost ?? asset?.value ?? 0;
  return safeNumber(value);
};

const getAssetLocation = (asset) => asset?.location || asset?.currentLocation || asset?.stockLocation || 'Unassigned';
const getAssetDepartment = (asset) => asset?.department || asset?.departmentName || asset?.department_name || asset?.departmentId || 'Unassigned';
const getAssetCode = (asset) => asset?.assetCode || asset?.asset_code || asset?.assetTag || asset?.asset_tag || 'N/A';

const normalizeAssetRow = (row) => ({
  id: row?.id ?? row?.assetId ?? row?.asset_id,
  name: row?.name || row?.assetName || 'Unnamed Asset',
  assetCode: getAssetCode(row),
  category: row?.category || row?.categoryName || row?.category_name || 'Uncategorized',
  location: getAssetLocation(row),
  department: getAssetDepartment(row),
  status: getInventoryStatus(row),
  condition: row?.condition || 'Good',
  value: getAssetValue(row),
  createdAt: row?.createdAt || row?.purchaseDate || row?.purchase_date || null,
  availableQuantity: safeNumber(row?.availableQuantity ?? row?.available_quantity),
  minimumQuantity: safeNumber(row?.minimumQuantity ?? row?.minimum_quantity),
});

const formatIssueDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
};

const getDateRange = (preset) => {
  const today = new Date();
  const to = new Date(today);
  const from = new Date(today);

  switch (preset) {
    case 'today':
      from.setHours(0, 0, 0, 0);
      to.setHours(23, 59, 59, 999);
      return { from: from.toISOString(), to: to.toISOString() };
    case 'thisWeek':
      from.setDate(today.getDate() - today.getDay());
      from.setHours(0, 0, 0, 0);
      return { from: from.toISOString(), to: to.toISOString() };
    case 'thisMonth':
      from.setDate(1);
      from.setHours(0, 0, 0, 0);
      return { from: from.toISOString(), to: to.toISOString() };
    case 'lastMonth':
      from.setMonth(today.getMonth() - 1, 1);
      from.setHours(0, 0, 0, 0);
      to.setMonth(today.getMonth(), 0);
      to.setHours(23, 59, 59, 999);
      return { from: from.toISOString(), to: to.toISOString() };
    case 'thisYear':
      from.setMonth(0, 1);
      from.setHours(0, 0, 0, 0);
      return { from: from.toISOString(), to: to.toISOString() };
    default:
      return {};
  }
};

const formatMovementDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
};

const formatMovementType = (value) => {
  if (!value) return 'Movement';
  return String(value)
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
};

const StoreReports = () => {
  const { language, theme } = useLanguage();
  const location = useLocation();
  const isDark = theme === 'dark';
  const translations = language === 'en' ? englishTranslations : amharicTranslations;
  const isIssueReport = location.pathname.endsWith('/issues');
  const isReturnReport = location.pathname.endsWith('/returns');
  const isMovementReport = location.pathname.endsWith('/movements') || location.pathname.endsWith('/movement');

  const [loading, setLoading] = useState(true);
  const [inventoryError, setInventoryError] = useState('');
  const [inventory, setInventory] = useState([]);
  const [summary, setSummary] = useState({
    totalAssets: 0,
    available: 0,
    assigned: 0,
    maintenance: 0,
    damaged: 0,
    missing: 0,
    lowStock: 0,
    totalValue: 0,
  });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [returnReasonFilter, setReturnReasonFilter] = useState('all');
  const [returnConditionFilter, setReturnConditionFilter] = useState('all');
  const [returnLocationFilter, setReturnLocationFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [movementPage, setMovementPage] = useState(1);
  const [issueRows, setIssueRows] = useState([]);
  const [returnRows, setReturnRows] = useState([]);
  const [movementRows, setMovementRows] = useState([]);
  const [movementMeta, setMovementMeta] = useState({ movementTypes: [], locations: [], departments: [] });
  const [movementSummary, setMovementSummary] = useState({ totalMovements: 0, today: 0, thisMonth: 0, transfers: 0, issues: 0, returns: 0 });
  const [movementTypeFilter, setMovementTypeFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [destinationFilter, setDestinationFilter] = useState('');
  const [datePreset, setDatePreset] = useState('thisMonth');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [movementTotalPages, setMovementTotalPages] = useState(1);
  const [movementLoading, setMovementLoading] = useState(false);
  const [movementError, setMovementError] = useState('');
  const [selectedMovement, setSelectedMovement] = useState(null);
  const pageSize = 12;

  const fetchInventory = useCallback(async () => {
    setLoading(true);
    setInventoryError('');
    try {
      let response;
      try {
        response = await apiClient.get('/api/store/inventory', {
          params: {
            page: 1,
            pageSize: 500,
          },
        });
      } catch (storeError) {
        response = await apiClient.get('/api/assets', {
          params: {
            page: 1,
            limit: 500,
          },
        });
      }

      const rows = Array.isArray(response?.data?.data)
        ? response.data.data
        : Array.isArray(response?.data?.items)
          ? response.data.items
          : Array.isArray(response?.data?.assets)
            ? response.data.assets
            : [];

      const normalizedRows = rows.map(normalizeAssetRow);
      const summaryFromApi = response?.data?.summary || {};

      const derivedSummary = {
        totalAssets: safeNumber(summaryFromApi.totalAssets ?? summaryFromApi.total ?? normalizedRows.length),
        available: safeNumber(summaryFromApi.available ?? normalizedRows.filter((item) => item.status === 'Available').length),
        assigned: safeNumber(summaryFromApi.assigned ?? normalizedRows.filter((item) => item.status === 'Assigned').length),
        maintenance: safeNumber(summaryFromApi.maintenance ?? normalizedRows.filter((item) => item.status === 'Under Maintenance').length),
        damaged: safeNumber(summaryFromApi.damaged ?? normalizedRows.filter((item) => item.status === 'Damaged').length),
        missing: safeNumber(summaryFromApi.missing ?? normalizedRows.filter((item) => item.status === 'Missing').length),
        lowStock: safeNumber(summaryFromApi.lowStock ?? normalizedRows.filter((item) => item.availableQuantity <= item.minimumQuantity).length),
        totalValue: normalizedRows.reduce((sum, item) => sum + item.value, 0),
      };

      setInventory(normalizedRows);
      setSummary(derivedSummary);
    } catch (error) {
      const message = error?.response?.data?.message || translations.fetchError;
      toast.error(message);
      setInventoryError(message);
      setInventory([]);
      setSummary({
        totalAssets: 0,
        available: 0,
        assigned: 0,
        maintenance: 0,
        damaged: 0,
        missing: 0,
        lowStock: 0,
        totalValue: 0,
      });
    } finally {
      setLoading(false);
    }
  }, [translations.fetchError]);

  const fetchMovementReport = useCallback(async () => {
    setMovementLoading(true);
    setMovementError('');

    try {
      const params = {
        page: movementPage,
        pageSize,
        search,
      };

      if (movementTypeFilter) params.movementType = movementTypeFilter;
      if (locationFilter && locationFilter !== 'all') params.location = locationFilter;
      if (departmentFilter && departmentFilter !== 'all') params.department = departmentFilter;

      const dateRange = datePreset === 'custom' ? { from: customFrom, to: customTo } : getDateRange(datePreset);
      if (dateRange.from) params.dateFrom = dateRange.from;
      if (dateRange.to) params.dateTo = dateRange.to;

      const response = await apiClient.get('/api/store/history', { params });
      const payload = response?.data?.data || {};
      const rows = Array.isArray(payload.items) ? payload.items : [];
      const normalizedRows = rows.map((row) => ({
        ...row,
        quantity: row.quantity ?? (row.referenceType ? null : 1),
        movementLabel: row.movementLabel || formatMovementType(row.movementType),
        displayReference: row.referenceNumber || row.referenceType || `MOV-${row.id || 'N/A'}`,
      }));

      setMovementRows(normalizedRows);
      setMovementSummary(payload.summary || { totalMovements: 0, today: 0, thisMonth: 0, transfers: 0, issues: 0, returns: 0 });
      setMovementMeta(payload.filters || { movementTypes: [], locations: [], departments: [] });
      setMovementTotalPages(Math.max(1, Number(payload.totalPages) || 1));
      setSelectedMovement(null);
    } catch (error) {
      const message = error?.response?.status === 403
        ? 'You do not have permission to view movement reports.'
        : 'Unable to load movement reports. Please try again.';
      setMovementError(message);
      setMovementRows([]);
      setMovementSummary({ totalMovements: 0, today: 0, thisMonth: 0, transfers: 0, issues: 0, returns: 0 });
      setMovementMeta({ movementTypes: [], locations: [], departments: [] });
      setMovementTotalPages(1);
    } finally {
      setMovementLoading(false);
    }
  }, [customFrom, customTo, datePreset, departmentFilter, locationFilter, movementPage, movementTypeFilter, pageSize, search]);

  const fetchIssueReport = useCallback(async () => {
    setLoading(true);
    try {
      const [transactionResponse, assignmentResponse] = await Promise.all([
        apiClient.get('/api/transactions', { params: { type: 'issue' } }),
        apiClient.get('/api/assignments', { params: { page: 1, limit: 500 } }),
      ]);

      const issues = Array.isArray(transactionResponse?.data?.transactions)
        ? transactionResponse.data.transactions
        : [];
      const assignments = Array.isArray(assignmentResponse?.data?.assignments || assignmentResponse?.data?.data)
        ? (assignmentResponse.data.assignments || assignmentResponse.data.data)
        : [];

      const assignmentMap = new Map(
        assignments.map((assignment) => [String(assignment.asset_id ?? assignment.assetId ?? assignment.asset_id), assignment])
      );

      const normalizedIssues = issues.map((issue) => {
        const asset = issue.Asset || {};
        const user = issue.User || {};
        const assignment = assignmentMap.get(String(issue.assetId));
        const recipientName = assignment?.assigned_to_name || assignment?.User?.fullName || assignment?.User?.username || user.fullName || user.username || 'Unassigned';
        const departmentName = assignment?.department || issue.Department?.name || asset.department || 'Unassigned';
        const destinationLocation = assignment?.location || issue.toLocation || asset.location || 'Unassigned';

        return {
          id: issue.id,
          assetName: asset.name || 'Unnamed Asset',
          assetCode: asset.assetCode || 'N/A',
          category: asset.category || 'Uncategorized',
          department: departmentName,
          recipient: recipientName,
          quantity: Number(issue.quantity || 0),
          destination: destinationLocation,
          date: issue.createdAt,
          status: 'Issued',
          reason: issue.reason || issue.notes || 'Issued from store',
          issuedBy: user.fullName || user.username || 'Store Manager',
        };
      });

      setIssueRows(normalizedIssues);
      setSummary({
        totalAssets: normalizedIssues.length,
        available: normalizedIssues.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
        assigned: normalizedIssues.filter((item) => item.status === 'Issued').length,
        maintenance: 0,
        damaged: 0,
        missing: 0,
        lowStock: 0,
        totalValue: 0,
      });
    } catch (error) {
      toast.error(error?.response?.data?.message || translations.fetchError);
      setIssueRows([]);
      setSummary({
        totalAssets: 0,
        available: 0,
        assigned: 0,
        maintenance: 0,
        damaged: 0,
        missing: 0,
        lowStock: 0,
        totalValue: 0,
      });
    } finally {
      setLoading(false);
    }
  }, [translations.fetchError]);

  const fetchReturnReport = useCallback(async () => {
    setLoading(true);
    try {
      const [returnResponse, userResponse] = await Promise.all([
        apiClient.get('/api/store/returns', { params: { page: 1, pageSize: 500 } }),
        apiClient.get('/api/users', { params: { limit: 500 } }),
      ]);

      const rows = Array.isArray(returnResponse?.data?.data || returnResponse?.data?.returns)
        ? (returnResponse.data.data || returnResponse.data.returns)
        : [];
      const users = Array.isArray(userResponse?.data?.users || userResponse?.data?.data)
        ? (userResponse.data.users || userResponse.data.data)
        : [];

      const userMap = new Map(users.map((user) => [String(user.id), user.fullName || user.username || 'Unknown User']));
      const normalizedReturns = rows.map((row) => {
        const asset = row.Asset || {};
        return {
          id: row.id,
          returnNumber: row.return_number || row.returnNumber || `RET-${String(row.id).padStart(5, '0')}`,
          issueReference: row.issueReference || row.issue_reference || '—',
          requestReference: row.requestReference || row.request_reference || '—',
          assetName: asset.name || 'Unnamed Asset',
          assetCode: asset.assetCode || 'N/A',
          serialNumber: asset.serialNumber || '—',
          category: asset.category || row.category || 'Uncategorized',
          department: asset.department || row.department || 'Unassigned',
          location: asset.location || row.location || 'Unassigned',
          quantity: Number(row.quantity ?? 1),
          returnedBy: row.sourceUserId ? userMap.get(String(row.sourceUserId)) || 'Unknown User' : '—',
          receivedBy: row.receivedBy ? userMap.get(String(row.receivedBy)) || 'Unknown User' : '—',
          condition: row.condition || 'Good',
          reason: row.reason || 'Not specified',
          status: row.status || 'Received',
          returnDate: row.createdAt || row.receivedAt || row.requestedAt,
          notes: row.notes || '',
          requestedBy: row.requestedBy ? userMap.get(String(row.requestedBy)) || 'Unknown User' : '—',
          outcome: row.outcome || '—',
        };
      });

      setReturnRows(normalizedReturns);
      setSummary({
        totalAssets: normalizedReturns.length,
        available: normalizedReturns.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
        assigned: normalizedReturns.filter((item) => item.status === 'Received').length,
        maintenance: normalizedReturns.filter((item) => String(item.outcome || '').toLowerCase().includes('maintenance')).length,
        damaged: normalizedReturns.filter((item) => String(item.condition || '').toLowerCase().includes('damaged')).length,
        missing: 0,
        lowStock: 0,
        totalValue: 0,
      });
    } catch (error) {
      toast.error(error?.response?.data?.message || translations.fetchError);
      setReturnRows([]);
      setSummary({
        totalAssets: 0,
        available: 0,
        assigned: 0,
        maintenance: 0,
        damaged: 0,
        missing: 0,
        lowStock: 0,
        totalValue: 0,
      });
    } finally {
      setLoading(false);
    }
  }, [translations.fetchError]);

  useEffect(() => {
    if (isMovementReport) {
      fetchMovementReport();
      return;
    }
    if (isReturnReport) {
      fetchReturnReport();
      return;
    }
    if (isIssueReport) {
      fetchIssueReport();
      return;
    }
    fetchInventory();
  }, [fetchInventory, fetchIssueReport, fetchMovementReport, fetchReturnReport, isIssueReport, isMovementReport, isReturnReport]);

  const categories = useMemo(
    () => [...new Set(inventory.map((item) => item.category).filter(Boolean))].sort(),
    [inventory]
  );

  const locations = useMemo(
    () => [...new Set(inventory.map((item) => item.location).filter(Boolean))].sort(),
    [inventory]
  );

  const departments = useMemo(
    () => [...new Set(inventory.map((item) => item.department).filter(Boolean))].sort(),
    [inventory]
  );

  const statuses = useMemo(
    () => [...new Set(inventory.map((item) => item.status).filter(Boolean))].sort(),
    [inventory]
  );

  const filteredInventory = useMemo(() => {
    const lowerSearch = search.trim().toLowerCase();

    return inventory.filter((item) => {
      const haystack = [item.name, item.assetCode, item.category, item.location, item.department, item.status]
        .join(' ')
        .toLowerCase();

      const matchesSearch = !lowerSearch || haystack.includes(lowerSearch);
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
      const matchesLocation = locationFilter === 'all' || item.location === locationFilter;
      const matchesDepartment = departmentFilter === 'all' || item.department === departmentFilter;

      return matchesSearch && matchesStatus && matchesCategory && matchesLocation && matchesDepartment;
    });
  }, [inventory, search, statusFilter, categoryFilter, locationFilter, departmentFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredInventory.length / pageSize));

  const issueFilteredRows = useMemo(() => {
    const lowerSearch = search.trim().toLowerCase();
    return issueRows.filter((issue) => {
      if (!lowerSearch) return true;
      const haystack = [issue.assetName, issue.assetCode, issue.recipient, issue.department, issue.destination, issue.reason]
        .join(' ')
        .toLowerCase();
      return haystack.includes(lowerSearch);
    });
  }, [issueRows, search]);

  const issuePageTotal = Math.max(1, Math.ceil(issueFilteredRows.length / pageSize));

  const returnStatusOptions = useMemo(() => [...new Set(returnRows.map((item) => item.status).filter(Boolean))].sort(), [returnRows]);
  const returnReasonOptions = useMemo(() => [...new Set(returnRows.map((item) => item.reason).filter(Boolean))].sort(), [returnRows]);
  const returnConditionOptions = useMemo(() => [...new Set(returnRows.map((item) => item.condition).filter(Boolean))].sort(), [returnRows]);
  const returnDepartmentOptions = useMemo(() => [...new Set(returnRows.map((item) => item.department).filter(Boolean))].sort(), [returnRows]);
  const returnLocationOptions = useMemo(() => [...new Set(returnRows.map((item) => item.location).filter(Boolean))].sort(), [returnRows]);

  const returnFilteredRows = useMemo(() => {
    const lowerSearch = search.trim().toLowerCase();
    return returnRows.filter((item) => {
      const haystack = [item.returnNumber, item.assetName, item.assetCode, item.returnedBy, item.receivedBy, item.department, item.location, item.reason, item.status].join(' ').toLowerCase();
      const matchesSearch = !lowerSearch || haystack.includes(lowerSearch);
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      const matchesReason = returnReasonFilter === 'all' || item.reason === returnReasonFilter;
      const matchesCondition = returnConditionFilter === 'all' || item.condition === returnConditionFilter;
      const matchesDepartment = departmentFilter === 'all' || item.department === departmentFilter;
      const matchesLocation = returnLocationFilter === 'all' || item.location === returnLocationFilter;
      return matchesSearch && matchesStatus && matchesReason && matchesCondition && matchesDepartment && matchesLocation;
    });
  }, [returnRows, search, statusFilter, returnReasonFilter, returnConditionFilter, departmentFilter, returnLocationFilter]);

  const returnPageTotal = Math.max(1, Math.ceil(returnFilteredRows.length / pageSize));

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, categoryFilter, locationFilter, departmentFilter, returnReasonFilter, returnConditionFilter, returnLocationFilter]);

  const paginatedInventory = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredInventory.slice(start, start + pageSize);
  }, [filteredInventory, page]);

  const issuePaginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return issueFilteredRows.slice(start, start + pageSize);
  }, [issueFilteredRows, page]);

  const returnPaginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return returnFilteredRows.slice(start, start + pageSize);
  }, [returnFilteredRows, page]);

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: isDark ? '#dbeafe' : '#0f172a',
            boxWidth: 10,
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { color: isDark ? '#dbeafe' : '#0f172a' },
          grid: { color: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)' },
        },
        x: {
          ticks: { color: isDark ? '#dbeafe' : '#0f172a' },
          grid: { display: false },
        },
      },
    }),
    [isDark]
  );

  const statusChartData = {
    labels: ['Available', 'Assigned', 'Under Maintenance', 'Damaged', 'Missing'],
    datasets: [
      {
        data: [summary.available, summary.assigned, summary.maintenance, summary.damaged, summary.missing],
        backgroundColor: ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'],
        borderWidth: 0,
      },
    ],
  };

  const categoryChartData = useMemo(() => {
    const grouped = {};
    filteredInventory.forEach((item) => {
      grouped[item.category] = (grouped[item.category] || 0) + 1;
    });
    return {
      labels: Object.keys(grouped),
      datasets: [{
        label: 'Assets',
        data: Object.values(grouped),
        backgroundColor: ['#60a5fa', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#2dd4bf', '#fb7185'],
        borderWidth: 0,
      }],
    };
  }, [filteredInventory]);

  const locationChartData = useMemo(() => {
    const grouped = {};
    filteredInventory.forEach((item) => {
      grouped[item.location] = (grouped[item.location] || 0) + 1;
    });
    return {
      labels: Object.keys(grouped),
      datasets: [{
        label: 'Locations',
        data: Object.values(grouped),
        backgroundColor: ['#38bdf8', '#4ade80', '#fbbf24', '#f472b6', '#a78bfa'],
        borderWidth: 0,
      }],
    };
  }, [filteredInventory]);

  const exportToExcel = () => {
    const data = filteredInventory.map((item) => ({
      assetCode: item.assetCode,
      name: item.name,
      category: item.category,
      department: item.department,
      location: item.location,
      status: item.status,
      condition: item.condition,
      value: item.value,
      availableQuantity: item.availableQuantity,
      minimumQuantity: item.minimumQuantity,
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventory Report');
    XLSX.writeFile(workbook, `inventory-report-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success(translations.exportSuccess);
  };

  if (!location.pathname.startsWith('/store/reports')) {
    return <Navigate to="/store/reports/inventory" replace />;
  }

  if (loading && !inventoryError) {
    return (
      <div style={styles.container}>
        <div style={styles.emptyState}>{translations.loading}</div>
      </div>
    );
  }

  if (inventoryError && inventory.length === 0 && !isIssueReport && !isReturnReport && !isMovementReport) {
    return (
      <div style={styles.container}>
        <div style={styles.emptyState}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>{inventoryError}</div>
          <button type="button" style={styles.primaryButton} onClick={fetchInventory}>{translations.refresh}</button>
        </div>
      </div>
    );
  }

  if (isReturnReport) {
    return (
      <div style={styles.container}>
        <div style={styles.headerRow}>
          <div>
            <div style={styles.kicker}>{translations.pageKicker}</div>
            <h1 style={styles.title}>{translations.returnReportTitle}</h1>
            <div style={styles.subtitle}>{translations.returnSubtitle}</div>
          </div>
          <div style={styles.headerActions}>
            <button type="button" style={styles.secondaryButton} onClick={fetchReturnReport}>{translations.refresh}</button>
          </div>
        </div>

        <div style={styles.kpiGrid}>
          <div style={styles.kpiCard}><div style={styles.kpiLabel}>{translations.totalReturnTransactions}</div><div style={styles.kpiValue}>{returnRows.length}</div></div>
          <div style={styles.kpiCard}><div style={styles.kpiLabel}>{translations.totalReturnedQuantity}</div><div style={styles.kpiValue}>{returnRows.reduce((sum, item) => sum + Number(item.quantity || 0), 0)}</div></div>
          <div style={styles.kpiCard}><div style={styles.kpiLabel}>{translations.thisMonth}</div><div style={styles.kpiValue}>{returnRows.filter((item) => { const date = new Date(item.returnDate || item.createdAt || 0); return date instanceof Date && !Number.isNaN(date.getTime()) && date.getMonth() === new Date().getMonth() && date.getFullYear() === new Date().getFullYear(); }).length}</div></div>
          <div style={styles.kpiCard}><div style={styles.kpiLabel}>{translations.uniqueAssets}</div><div style={styles.kpiValue}>{new Set(returnRows.map((item) => item.assetCode)).size}</div></div>
        </div>

        <div style={styles.filterBar}>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>{translations.search}</label>
            <input style={styles.filterInput} type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={translations.returnSearchPlaceholder} />
          </div>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>{translations.status}</label>
            <select style={styles.filterInput} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">{translations.allStatuses}</option>
              {returnStatusOptions.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </div>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>{translations.reason}</label>
            <select style={styles.filterInput} value={returnReasonFilter} onChange={(event) => setReturnReasonFilter(event.target.value)}>
              <option value="all">{translations.allReasons}</option>
              {returnReasonOptions.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </div>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>{translations.condition}</label>
            <select style={styles.filterInput} value={returnConditionFilter} onChange={(event) => setReturnConditionFilter(event.target.value)}>
              <option value="all">{translations.allConditions}</option>
              {returnConditionOptions.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </div>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>{translations.department}</label>
            <select style={styles.filterInput} value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)}>
              <option value="all">{translations.allDepartments}</option>
              {returnDepartmentOptions.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </div>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>{translations.location}</label>
            <select style={styles.filterInput} value={returnLocationFilter} onChange={(event) => setReturnLocationFilter(event.target.value)}>
              <option value="all">{translations.allLocations}</option>
              {returnLocationOptions.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </div>
        </div>

        <div style={styles.tableCard}>
          <div style={styles.tableHeaderRow}>
            <h3 style={styles.chartTitle}>{translations.returnTable}</h3>
            <div style={styles.metaText}>{translations.showing} {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, returnFilteredRows.length)} {translations.of} {returnFilteredRows.length}</div>
          </div>

          {returnFilteredRows.length === 0 ? (
            <div style={styles.emptyState}>{translations.noReturnResults}</div>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>{translations.returnReference}</th>
                      <th style={styles.th}>{translations.issueReference}</th>
                      <th style={styles.th}>{translations.assetName}</th>
                      <th style={styles.th}>{translations.assetCode}</th>
                      <th style={styles.th}>{translations.returnedBy}</th>
                      <th style={styles.th}>{translations.department}</th>
                      <th style={styles.th}>{translations.location}</th>
                      <th style={styles.th}>{translations.quantity}</th>
                      <th style={styles.th}>{translations.date}</th>
                      <th style={styles.th}>{translations.status}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {returnPaginatedRows.map((item) => (
                      <tr key={item.id ?? item.returnNumber}>
                        <td style={styles.td}>{item.returnNumber}</td>
                        <td style={styles.td}>{item.issueReference}</td>
                        <td style={styles.td}>{item.assetName}</td>
                        <td style={styles.td}>{item.assetCode}</td>
                        <td style={styles.td}>{item.returnedBy}</td>
                        <td style={styles.td}>{item.department}</td>
                        <td style={styles.td}>{item.location}</td>
                        <td style={styles.td}>{item.quantity}</td>
                        <td style={styles.td}>{formatIssueDate(item.returnDate)}</td>
                        <td style={styles.td}><span style={styles.statusPill(item.status)}>{item.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={styles.paginationRow}>
                <button type="button" style={styles.paginationButton} disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>{translations.previous}</button>
                <span style={styles.metaText}>{translations.page} {page} {translations.of} {returnPageTotal}</span>
                <button type="button" style={styles.paginationButton} disabled={page >= returnPageTotal} onClick={() => setPage((current) => Math.min(returnPageTotal, current + 1))}>{translations.next}</button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  if (isMovementReport) {
    const movementFilteredRows = movementRows.filter((row) => {
      const haystack = [
        row.assetName,
        row.assetCode,
        row.serialNumber,
        row.category,
        row.from,
        row.to,
        row.performedByName,
        row.referenceNumber,
        row.referenceType,
        row.movementLabel,
      ].filter(Boolean).join(' ').toLowerCase();
      const matchesSearch = !search || haystack.includes(search.toLowerCase());
      const matchesType = !movementTypeFilter || row.movementType === movementTypeFilter || row.movementLabel === movementTypeFilter;
      const matchesSource = !sourceFilter || (row.from || '').toLowerCase() === sourceFilter.toLowerCase();
      const matchesDestination = !destinationFilter || (row.to || '').toLowerCase() === destinationFilter.toLowerCase();
      const matchesDepartment = !departmentFilter || departmentFilter === 'all' || String(row.departmentId || '') === String(departmentFilter);
      const matchesLocation = !locationFilter || locationFilter === 'all' || (row.currentLocation || '').toLowerCase() === String(locationFilter).toLowerCase();
      return matchesSearch && matchesType && matchesSource && matchesDestination && matchesDepartment && matchesLocation;
    });

    const movementSourceOptions = [...new Set(movementRows.map((row) => row.from).filter(Boolean))].sort();
    const movementDestinationOptions = [...new Set(movementRows.map((row) => row.to).filter(Boolean))].sort();
    const movementDepartmentOptions = (movementMeta.departments || []).map((department) => ({
      id: department.id,
      name: department.name || department.code || `Department ${department.id}`,
    }));

    const exportMovements = () => {
      const worksheet = XLSX.utils.json_to_sheet(movementFilteredRows.map((row) => ({
        'Movement Reference': row.displayReference,
        'Movement Type': row.movementLabel,
        'Asset / Item': row.assetName || '—',
        'Code': row.assetCode || '—',
        'Category': row.category || '—',
        'Quantity': row.quantity ?? '—',
        'Source': row.from || '—',
        'Destination': row.to || '—',
        'Department': row.departmentName || '—',
        'Processed By': row.performedByName || 'System',
        'Date / Time': formatMovementDateTime(row.createdAt),
        'Status': row.status || 'Recorded',
      })));
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Movement Report');
      XLSX.writeFile(workbook, `movement-report-${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success('Movement report exported successfully.');
    };

    return (
      <div style={styles.container}>
        <div style={styles.headerRow}>
          <div>
            <div style={styles.kicker}>{translations.pageKicker || 'Store / Reports'}</div>
            <h1 style={styles.title}>Movement Reports</h1>
            <div style={styles.subtitle}>Track asset and inventory movements across the university, including source, destination, movement type, quantity, processor, and date.</div>
          </div>
          <div style={styles.headerActions}>
            <button type="button" style={styles.secondaryButton} onClick={fetchMovementReport}>Refresh</button>
            {movementRows.length > 0 && (
              <button type="button" style={styles.primaryButton} onClick={exportMovements}>Export Report</button>
            )}
          </div>
        </div>

        <div style={styles.kpiGrid}>
          <div style={styles.kpiCard}><div style={styles.kpiLabel}>Total Movements</div><div style={styles.kpiValue}>{movementSummary.totalMovements || movementRows.length}</div></div>
          <div style={styles.kpiCard}><div style={styles.kpiLabel}>Items Moved</div><div style={styles.kpiValue}>{movementRows.reduce((sum, item) => sum + (Number(item.quantity) > 0 ? Number(item.quantity) : 0), 0)}</div></div>
          <div style={styles.kpiCard}><div style={styles.kpiLabel}>Issues</div><div style={styles.kpiValue}>{movementSummary.issues || movementRows.filter((item) => String(item.movementType || item.movementLabel || '').toLowerCase().includes('issue')).length}</div></div>
          <div style={styles.kpiCard}><div style={styles.kpiLabel}>Returns</div><div style={styles.kpiValue}>{movementSummary.returns || movementRows.filter((item) => String(item.movementType || item.movementLabel || '').toLowerCase().includes('return')).length}</div></div>
          <div style={styles.kpiCard}><div style={styles.kpiLabel}>Transfers</div><div style={styles.kpiValue}>{movementSummary.transfers || movementRows.filter((item) => String(item.movementType || item.movementLabel || '').toLowerCase().includes('transfer')).length}</div></div>
          <div style={styles.kpiCard}><div style={styles.kpiLabel}>Maintenance Movements</div><div style={styles.kpiValue}>{movementRows.filter((item) => String(item.movementType || item.movementLabel || '').toLowerCase().includes('maintenance')).length}</div></div>
          <div style={styles.kpiCard}><div style={styles.kpiLabel}>This Month</div><div style={styles.kpiValue}>{movementSummary.thisMonth || movementRows.filter((item) => {
            const date = new Date(item.createdAt);
            const now = new Date();
            return !Number.isNaN(date.getTime()) && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
          }).length}</div></div>
        </div>

        <div style={styles.filterBar}>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Search</label>
            <input style={styles.filterInput} type="search" value={search} onChange={(event) => { setSearch(event.target.value); setMovementPage(1); }} placeholder="Search movement reference, asset, user, source, or destination" />
          </div>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Date Range</label>
            <select style={styles.filterInput} value={datePreset} onChange={(event) => setDatePreset(event.target.value)}>
              <option value="today">Today</option>
              <option value="thisWeek">This Week</option>
              <option value="thisMonth">This Month</option>
              <option value="lastMonth">Last Month</option>
              <option value="thisYear">This Year</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Movement Type</label>
            <select style={styles.filterInput} value={movementTypeFilter} onChange={(event) => { setMovementTypeFilter(event.target.value); setMovementPage(1); }}>
              <option value="">All Types</option>
              {(movementMeta.movementTypes || []).map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Source</label>
            <select style={styles.filterInput} value={sourceFilter} onChange={(event) => { setSourceFilter(event.target.value); setMovementPage(1); }}>
              <option value="">All Sources</option>
              {movementSourceOptions.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </div>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Destination</label>
            <select style={styles.filterInput} value={destinationFilter} onChange={(event) => { setDestinationFilter(event.target.value); setMovementPage(1); }}>
              <option value="">All Destinations</option>
              {movementDestinationOptions.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </div>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Department</label>
            <select style={styles.filterInput} value={departmentFilter} onChange={(event) => { setDepartmentFilter(event.target.value); setMovementPage(1); }}>
              <option value="all">All Departments</option>
              {movementDepartmentOptions.map((department) => (
                <option key={department.id} value={String(department.id)}>{department.name}</option>
              ))}
            </select>
          </div>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Location</label>
            <select style={styles.filterInput} value={locationFilter} onChange={(event) => { setLocationFilter(event.target.value); setMovementPage(1); }}>
              <option value="all">All Locations</option>
              {(movementMeta.locations || []).map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </div>
        </div>

        {datePreset === 'custom' && (
          <div style={styles.filterBar}>
            <div style={styles.filterGroup}>
              <label style={styles.filterLabel}>From</label>
              <input type="date" style={styles.filterInput} value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} />
            </div>
            <div style={styles.filterGroup}>
              <label style={styles.filterLabel}>To</label>
              <input type="date" style={styles.filterInput} value={customTo} onChange={(event) => setCustomTo(event.target.value)} />
            </div>
          </div>
        )}

        {movementError ? (
          <div style={styles.emptyState}>{movementError}</div>
        ) : null}

        {movementLoading ? (
          <div style={styles.emptyState}>Loading movement reports...</div>
        ) : movementFilteredRows.length === 0 ? (
          <div style={styles.tableCard}>
            <div style={styles.emptyState}>No movement records found.</div>
          </div>
        ) : (
          <div style={styles.tableCard}>
            <div style={styles.tableHeaderRow}>
              <h3 style={styles.chartTitle}>Detailed Movement Report</h3>
              <div style={styles.metaText}>Showing {(movementPage - 1) * pageSize + 1}-{Math.min(movementPage * pageSize, movementFilteredRows.length)} of {movementFilteredRows.length}</div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Movement Reference</th>
                    <th style={styles.th}>Movement Type</th>
                    <th style={styles.th}>Asset / Item</th>
                    <th style={styles.th}>Code</th>
                    <th style={styles.th}>Category</th>
                    <th style={styles.th}>Quantity</th>
                    <th style={styles.th}>Source</th>
                    <th style={styles.th}>Destination</th>
                    <th style={styles.th}>Department</th>
                    <th style={styles.th}>Processed By</th>
                    <th style={styles.th}>Date / Time</th>
                    <th style={styles.th}>Status</th>
                    <th style={styles.th}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {movementFilteredRows.slice((movementPage - 1) * pageSize, movementPage * pageSize).map((row) => (
                    <tr key={row.id || row.displayReference}>
                      <td style={styles.td}>{row.displayReference}</td>
                      <td style={styles.td}>{row.movementLabel}</td>
                      <td style={styles.td}>{row.assetName || '—'}</td>
                      <td style={styles.td}>{row.assetCode || '—'}</td>
                      <td style={styles.td}>{row.category || '—'}</td>
                      <td style={styles.td}>{row.quantity ?? '—'}</td>
                      <td style={styles.td}>{row.from || '—'}</td>
                      <td style={styles.td}>{row.to || '—'}</td>
                      <td style={styles.td}>{row.departmentName || '—'}</td>
                      <td style={styles.td}>{row.performedByName || 'System'}</td>
                      <td style={styles.td}>{formatMovementDateTime(row.createdAt)}</td>
                      <td style={styles.td}><span style={styles.statusPill(row.status || 'Recorded')}>{row.status || 'Recorded'}</span></td>
                      <td style={styles.td}><button type="button" onClick={() => setSelectedMovement(row)} style={styles.linkButton}>View</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={styles.paginationRow}>
              <button type="button" style={styles.paginationButton} disabled={movementPage === 1} onClick={() => setMovementPage((current) => Math.max(1, current - 1))}>Previous</button>
              <span style={styles.metaText}>Page {movementPage} of {Math.max(1, Math.ceil(movementFilteredRows.length / pageSize))}</span>
              <button type="button" style={styles.paginationButton} disabled={movementPage >= Math.max(1, Math.ceil(movementFilteredRows.length / pageSize))} onClick={() => setMovementPage((current) => Math.min(Math.max(1, Math.ceil(movementFilteredRows.length / pageSize)), current + 1))}>Next</button>
            </div>
          </div>
        )}

        {selectedMovement && (
          <div style={styles.detailPanel}>
            <div style={styles.detailHeader}>
              <div>
                <p style={styles.kicker}>Movement Details</p>
                <h2 style={styles.detailTitle}>{selectedMovement.assetName || 'Asset'} · {selectedMovement.movementLabel}</h2>
              </div>
              <button type="button" style={styles.secondaryButton} onClick={() => setSelectedMovement(null)}>Close</button>
            </div>
            <div style={styles.detailGrid}>
              <div style={styles.detailCard}>
                <h3>Movement Information</h3>
                <p><strong>Reference:</strong> {selectedMovement.displayReference}</p>
                <p><strong>Type:</strong> {selectedMovement.movementLabel}</p>
                <p><strong>Date / Time:</strong> {formatMovementDateTime(selectedMovement.createdAt)}</p>
                <p><strong>Status:</strong> {selectedMovement.status || 'Recorded'}</p>
                <p><strong>Processed By:</strong> {selectedMovement.performedByName || 'System'}</p>
              </div>
              <div style={styles.detailCard}>
                <h3>Asset / Item</h3>
                <p><strong>Name:</strong> {selectedMovement.assetName || '—'}</p>
                <p><strong>Code:</strong> {selectedMovement.assetCode || '—'}</p>
                <p><strong>Category:</strong> {selectedMovement.category || '—'}</p>
                <p><strong>Quantity:</strong> {selectedMovement.quantity ?? '—'}</p>
                <p><strong>Serial Number:</strong> {selectedMovement.serialNumber || '—'}</p>
              </div>
              <div style={styles.detailCard}>
                <h3>Source</h3>
                <p><strong>From:</strong> {selectedMovement.from || '—'}</p>
                <p><strong>Source Type:</strong> {selectedMovement.sourceType || '—'}</p>
              </div>
              <div style={styles.detailCard}>
                <h3>Destination</h3>
                <p><strong>To:</strong> {selectedMovement.to || '—'}</p>
                <p><strong>Destination Type:</strong> {selectedMovement.destinationType || '—'}</p>
              </div>
              <div style={styles.detailCard}>
                <h3>Related Transaction</h3>
                <p><strong>Reference Type:</strong> {selectedMovement.referenceType || '—'}</p>
                <p><strong>Reference Number:</strong> {selectedMovement.referenceNumber || '—'}</p>
              </div>
              <div style={styles.detailCard}>
                <h3>Notes</h3>
                <p>{selectedMovement.notes || 'No movement notes recorded.'}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (isIssueReport) {
    return (
      <div style={styles.container}>
        <div style={styles.headerRow}>
          <div>
            <div style={styles.kicker}>{translations.pageKicker}</div>
            <h1 style={styles.title}>{translations.issueReportTitle}</h1>
          </div>
          <div style={styles.headerActions}>
            <button type="button" style={styles.secondaryButton} onClick={fetchIssueReport}>{translations.refresh}</button>
          </div>
        </div>

        <div style={styles.kpiGrid}>
          <div style={styles.kpiCard}><div style={styles.kpiLabel}>{translations.totalIssues}</div><div style={styles.kpiValue}>{issueRows.length}</div></div>
          <div style={styles.kpiCard}><div style={styles.kpiLabel}>{translations.totalIssuedQuantity}</div><div style={styles.kpiValue}>{issueRows.reduce((sum, item) => sum + Number(item.quantity || 0), 0)}</div></div>
          <div style={styles.kpiCard}><div style={styles.kpiLabel}>{translations.uniqueRecipients}</div><div style={styles.kpiValue}>{new Set(issueRows.map((item) => item.recipient)).size}</div></div>
          <div style={styles.kpiCard}><div style={styles.kpiLabel}>{translations.departments}</div><div style={styles.kpiValue}>{new Set(issueRows.map((item) => item.department)).size}</div></div>
        </div>

        <div style={styles.filterBar}>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>{translations.search}</label>
            <input style={styles.filterInput} type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={translations.issueSearchPlaceholder} />
          </div>
        </div>

        <div style={styles.tableCard}>
          <div style={styles.tableHeaderRow}>
            <h3 style={styles.chartTitle}>{translations.issueTable}</h3>
            <div style={styles.metaText}>{translations.showing} {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, issueFilteredRows.length)} {translations.of} {issueFilteredRows.length}</div>
          </div>

          {issueFilteredRows.length === 0 ? (
            <div style={styles.emptyState}>{translations.noIssueResults}</div>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>{translations.assetCode}</th>
                      <th style={styles.th}>{translations.assetName}</th>
                      <th style={styles.th}>{translations.recipient}</th>
                      <th style={styles.th}>{translations.department}</th>
                      <th style={styles.th}>{translations.location}</th>
                      <th style={styles.th}>{translations.quantity}</th>
                      <th style={styles.th}>{translations.date}</th>
                      <th style={styles.th}>{translations.reason}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {issuePaginatedRows.map((item) => (
                      <tr key={item.id ?? `${item.assetCode}-${item.date}`}>
                        <td style={styles.td}>{item.assetCode}</td>
                        <td style={styles.td}>{item.assetName}</td>
                        <td style={styles.td}>{item.recipient}</td>
                        <td style={styles.td}>{item.department}</td>
                        <td style={styles.td}>{item.destination}</td>
                        <td style={styles.td}>{item.quantity}</td>
                        <td style={styles.td}>{formatIssueDate(item.date)}</td>
                        <td style={styles.td}>{item.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={styles.paginationRow}>
                <button type="button" style={styles.paginationButton} disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>{translations.previous}</button>
                <span style={styles.metaText}>{translations.page} {page} {translations.of} {issuePageTotal}</span>
                <button type="button" style={styles.paginationButton} disabled={page >= issuePageTotal} onClick={() => setPage((current) => Math.min(issuePageTotal, current + 1))}>{translations.next}</button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.headerRow}>
        <div>
          <div style={styles.kicker}>{translations.pageKicker}</div>
          <h1 style={styles.title}>{translations.pageTitle}</h1>
        </div>
        <div style={styles.headerActions}>
          <button type="button" style={styles.secondaryButton} onClick={fetchInventory}>{translations.refresh}</button>
          <button type="button" style={styles.primaryButton} onClick={exportToExcel}>{translations.export}</button>
        </div>
      </div>

      <div style={styles.kpiGrid}>
        <div style={styles.kpiCard}><div style={styles.kpiLabel}>{translations.totalAssets}</div><div style={styles.kpiValue}>{summary.totalAssets}</div></div>
        <div style={styles.kpiCard}><div style={styles.kpiLabel}>{translations.available}</div><div style={styles.kpiValue}>{summary.available}</div></div>
        <div style={styles.kpiCard}><div style={styles.kpiLabel}>{translations.assigned}</div><div style={styles.kpiValue}>{summary.assigned}</div></div>
        <div style={styles.kpiCard}><div style={styles.kpiLabel}>{translations.maintenance}</div><div style={styles.kpiValue}>{summary.maintenance}</div></div>
        <div style={styles.kpiCard}><div style={styles.kpiLabel}>{translations.damaged}</div><div style={styles.kpiValue}>{summary.damaged}</div></div>
        <div style={styles.kpiCard}><div style={styles.kpiLabel}>{translations.missing}</div><div style={styles.kpiValue}>{summary.missing}</div></div>
        <div style={styles.kpiCard}><div style={styles.kpiLabel}>{translations.lowStock}</div><div style={styles.kpiValue}>{summary.lowStock}</div></div>
        <div style={styles.kpiCard}><div style={styles.kpiLabel}>{translations.inventoryValue}</div><div style={styles.kpiValue}>{formatCurrency(summary.totalValue)}</div></div>
      </div>

      <div style={styles.filterBar}>
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>{translations.search}</label>
          <input style={styles.filterInput} type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={translations.searchPlaceholder} />
        </div>
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>{translations.status}</label>
          <select style={styles.filterInput} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">{translations.allStatuses}</option>
            {statuses.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </div>
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>{translations.category}</label>
          <select style={styles.filterInput} value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
            <option value="all">{translations.allCategories}</option>
            {categories.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </div>
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>{translations.location}</label>
          <select style={styles.filterInput} value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)}>
            <option value="all">{translations.allLocations}</option>
            {locations.map((locationValue) => (
              <option key={locationValue} value={locationValue}>{locationValue}</option>
            ))}
          </select>
        </div>
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>{translations.department}</label>
          <select style={styles.filterInput} value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)}>
            <option value="all">{translations.allDepartments}</option>
            {departments.map((department) => (
              <option key={department} value={department}>{department}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={styles.chartGrid}>
        <div style={styles.chartCard}>
          <h3 style={styles.chartTitle}>{translations.assetStatus}</h3>
          <div style={{ height: '240px' }}>
            <Doughnut data={statusChartData} options={chartOptions} />
          </div>
        </div>
        <div style={styles.chartCard}>
          <h3 style={styles.chartTitle}>{translations.categoryDistribution}</h3>
          <div style={{ height: '240px' }}>
            <Bar data={categoryChartData} options={chartOptions} />
          </div>
        </div>
        <div style={styles.chartCard}>
          <h3 style={styles.chartTitle}>{translations.locationDistribution}</h3>
          <div style={{ height: '240px' }}>
            <Bar data={locationChartData} options={chartOptions} />
          </div>
        </div>
      </div>

      <div style={styles.tableCard}>
        <div style={styles.tableHeaderRow}>
          <h3 style={styles.chartTitle}>{translations.inventoryTable}</h3>
          <div style={styles.metaText}>{translations.showing} {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, filteredInventory.length)} {translations.of} {filteredInventory.length}</div>
        </div>

        {filteredInventory.length === 0 ? (
          <div style={styles.emptyState}>{translations.noResults}</div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>{translations.assetCode}</th>
                    <th style={styles.th}>{translations.assetName}</th>
                    <th style={styles.th}>{translations.category}</th>
                    <th style={styles.th}>{translations.location}</th>
                    <th style={styles.th}>{translations.department}</th>
                    <th style={styles.th}>{translations.status}</th>
                    <th style={styles.th}>{translations.value}</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedInventory.map((asset) => (
                    <tr key={asset.id ?? `${asset.name}-${asset.assetCode}`}>
                      <td style={styles.td}>{asset.assetCode}</td>
                      <td style={styles.td}>{asset.name}</td>
                      <td style={styles.td}>{asset.category}</td>
                      <td style={styles.td}>{asset.location}</td>
                      <td style={styles.td}>{asset.department}</td>
                      <td style={styles.td}><span style={styles.statusPill(asset.status)}>{asset.status}</span></td>
                      <td style={styles.td}>{formatCurrency(asset.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={styles.paginationRow}>
              <button type="button" style={styles.paginationButton} disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>{translations.previous}</button>
              <span style={styles.metaText}>{translations.page} {page} {translations.of} {totalPages}</span>
              <button type="button" style={styles.paginationButton} disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>{translations.next}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const styles = {
  container: {
    padding: '24px',
    minHeight: '100vh',
    background: '#f8fafc',
    color: '#0f172a',
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
    marginBottom: '18px',
  },
  kicker: {
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    fontSize: '0.72rem',
    fontWeight: 700,
  },
  title: {
    margin: '8px 0 0',
    fontSize: '2rem',
    fontWeight: 800,
  },
  subtitle: {
    marginTop: '6px',
    color: '#475569',
    fontSize: '0.96rem',
  },
  headerActions: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
  },
  primaryButton: {
    background: '#16a34a',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    padding: '10px 16px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  secondaryButton: {
    background: '#e2e8f0',
    color: '#0f172a',
    border: 'none',
    borderRadius: '10px',
    padding: '10px 16px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '16px',
    marginBottom: '20px',
  },
  kpiCard: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '16px',
    boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
  },
  kpiLabel: {
    color: '#64748b',
    fontSize: '0.8rem',
    marginBottom: '8px',
  },
  kpiValue: {
    fontSize: '1.8rem',
    fontWeight: 800,
  },
  filterBar: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '12px',
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '18px',
  },
  filterGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  filterLabel: {
    fontSize: '0.7rem',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: '#475569',
    fontWeight: 700,
  },
  filterInput: {
    width: '100%',
    border: '1px solid #cbd5e1',
    borderRadius: '10px',
    background: '#fff',
    color: '#0f172a',
    padding: '10px 12px',
    fontSize: '0.95rem',
  },
  chartGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '16px',
    marginBottom: '18px',
  },
  chartCard: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '16px',
  },
  chartTitle: {
    margin: '0 0 12px',
    fontSize: '1rem',
    fontWeight: 700,
  },
  tableCard: {
    background: '#fff',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    padding: '16px',
  },
  tableHeaderRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
    marginBottom: '12px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    padding: '10px 12px',
    textAlign: 'left',
    borderBottom: '1px solid #e2e8f0',
    color: '#475569',
    fontSize: '0.76rem',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  td: {
    padding: '10px 12px',
    borderBottom: '1px solid #f1f5f9',
    fontSize: '0.9rem',
  },
  metaText: {
    color: '#475569',
    fontSize: '0.85rem',
  },
  statusPill: (status) => ({
    display: 'inline-block',
    padding: '5px 10px',
    borderRadius: '999px',
    fontWeight: 700,
    fontSize: '0.72rem',
    background:
      status === 'Available' ? '#dcfce7' :
      status === 'Assigned' ? '#dbeafe' :
      status === 'Under Maintenance' ? '#fef3c7' :
      status === 'Damaged' ? '#fee2e2' :
      status === 'Missing' ? '#f3e8ff' : '#f1f5f9',
    color:
      status === 'Available' ? '#166534' :
      status === 'Assigned' ? '#1d4ed8' :
      status === 'Under Maintenance' ? '#92400e' :
      status === 'Damaged' ? '#b91c1c' :
      status === 'Missing' ? '#7c3aed' : '#334155',
  }),
  paginationRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '14px',
  },
  paginationButton: {
    background: '#e2e8f0',
    color: '#0f172a',
    border: 'none',
    borderRadius: '8px',
    padding: '8px 12px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  emptyState: {
    textAlign: 'center',
    padding: '40px 20px',
    color: '#475569',
  },
};

const englishTranslations = {
  pageKicker: 'Store / Reports',
  pageTitle: 'Inventory Reports',
  returnReportTitle: 'Return Reports',
  issueReportTitle: 'Issue Reports',
  returnSubtitle: 'Track assets and inventory items returned to the store, including return dates, quantities, conditions, reasons, and related issue transactions.',
  refresh: 'Refresh',
  export: 'Export Excel',
  exportSuccess: 'Inventory report exported successfully.',
  fetchError: 'Unable to load inventory report.',
  totalAssets: 'Total Assets',
  available: 'Available',
  assigned: 'Assigned',
  maintenance: 'In Maintenance',
  damaged: 'Damaged',
  missing: 'Missing',
  lowStock: 'Low Stock',
  inventoryValue: 'Inventory Value',
  totalIssues: 'Total Issues',
  totalIssuedQuantity: 'Total Quantity Issued',
  uniqueRecipients: 'Recipients',
  departments: 'Departments',
  totalReturnTransactions: 'Total Return Transactions',
  totalReturnedQuantity: 'Total Returned Quantity',
  thisMonth: 'This Month',
  uniqueAssets: 'Unique Assets',
  search: 'Search',
  searchPlaceholder: 'Search by asset code, name, category, department',
  issueSearchPlaceholder: 'Search by asset, recipient, location, or reason',
  returnSearchPlaceholder: 'Search by return reference, asset, person, or reason',
  status: 'Status',
  category: 'Category',
  location: 'Location',
  department: 'Department',
  condition: 'Condition',
  reason: 'Reason',
  allStatuses: 'All statuses',
  allCategories: 'All categories',
  allLocations: 'All locations',
  allDepartments: 'All departments',
  allConditions: 'All conditions',
  allReasons: 'All reasons',
  assetStatus: 'Asset Status',
  categoryDistribution: 'Category Distribution',
  locationDistribution: 'Location Distribution',
  inventoryTable: 'Inventory Detail',
  issueTable: 'Issued Assets',
  returnTable: 'Return Transactions',
  assetCode: 'Asset Code',
  assetName: 'Asset Name',
  recipient: 'Recipient',
  returnedBy: 'Returned By',
  receivedBy: 'Received By',
  returnReference: 'Return Reference',
  issueReference: 'Issue Reference',
  requestReference: 'Request Reference',
  quantity: 'Quantity',
  date: 'Date',
  value: 'Value',
  showing: 'Showing',
  of: 'of',
  previous: 'Previous',
  next: 'Next',
  page: 'Page',
  noResults: 'No inventory records match the selected filters.',
  noIssueResults: 'No issue records match the current search.',
  noReturnResults: 'No return transactions match the selected filters.',
  loading: 'Loading inventory report...',
};

const amharicTranslations = {
  pageKicker: 'መደብር / ሪፖርቶች',
  pageTitle: 'የክምችት ሪፖርቶች',
  returnReportTitle: 'የመመለሻ ሪፖርቶች',
  issueReportTitle: 'የመስጫ ሪፖርቶች',
  returnSubtitle: 'የተመለሱ ንብረቶችን እና የክምችት እቃዎችን በመመለሻ ቀን፣ ብዛት፣ ሁኔታ፣ ምክንያት እና የመስጫ ግንኙነቶች ይከታተሉ።',
  refresh: 'አድስ',
  export: 'Excel ያውጡ',
  exportSuccess: 'የክምችት ሪፖርት በተሳካ ሁኔታ ተወጥቷል።',
  fetchError: 'የክምችት ሪፖርት መጫን አልተቻለም።',
  totalAssets: 'ጠቅላላ ንብረቶች',
  available: 'ዝግጁ',
  assigned: 'ተመድቧል',
  maintenance: 'በጥገና ላይ',
  damaged: 'የተጎዱ',
  missing: 'የጠፋ',
  lowStock: 'ዝቅተኛ ክምችት',
  inventoryValue: 'የክምችት ዋጋ',
  totalIssues: 'ጠቅላላ መስጫዎች',
  totalIssuedQuantity: 'ጠቅላላ የተሰጠ ብዛት',
  uniqueRecipients: 'ተቀባዮች',
  departments: 'ክፍሎች',
  totalReturnTransactions: 'ጠቅላላ የመመለሻ ግብይቶች',
  totalReturnedQuantity: 'ጠቅላላ የተመለሰ ብዛት',
  thisMonth: 'በዚህ ወር',
  uniqueAssets: 'የተለያዩ ንብረቶች',
  search: 'ፈልግ',
  searchPlaceholder: 'በንብረት ኮድ፣ ስም፣ ምድብ ወይም ክፍል ይፈልጉ',
  issueSearchPlaceholder: 'በንብረት፣ ተቀባይ፣ ቦታ ወይም ምክንያት ይፈልጉ',
  returnSearchPlaceholder: 'በመመለሻ ማጣቀሻ፣ ንብረት፣ ሰው ወይም ምክንያት ይፈልጉ',
  status: 'ሁኔታ',
  category: 'ምድብ',
  location: 'ቦታ',
  department: 'ክፍል',
  condition: 'ሁኔታ',
  reason: 'ምክንያት',
  allStatuses: 'ሁሉም ሁኔታዎች',
  allCategories: 'ሁሉም ምድቦች',
  allLocations: 'ሁሉም ቦታዎች',
  allDepartments: 'ሁሉም ክፍሎች',
  allConditions: 'ሁሉም ሁኔታዎች',
  allReasons: 'ሁሉም ምክንያቶች',
  assetStatus: 'የንብረት ሁኔታ',
  categoryDistribution: 'የምድብ ስርጭት',
  locationDistribution: 'የቦታ ስርጭት',
  inventoryTable: 'የክምችት ዝርዝር',
  issueTable: 'የተሰጡ ንብረቶች',
  returnTable: 'የመመለሻ ግብይቶች',
  assetCode: 'የንብረት ኮድ',
  assetName: 'የንብረት ስም',
  recipient: 'ተቀባይ',
  returnedBy: 'የተመለሰው',
  receivedBy: 'የተቀባው',
  returnReference: 'የመመለሻ ማጣቀሻ',
  issueReference: 'የመስጫ ማጣቀሻ',
  requestReference: 'የጥያቄ ማጣቀሻ',
  quantity: 'ብዛት',
  date: 'ቀን',
  value: 'ዋጋ',
  showing: 'እየታየ',
  of: 'ከ',
  previous: 'ቀደም',
  next: 'ቀጣይ',
  page: 'ገጽ',
  noResults: 'ምንም የክምችት መረጃ ከተመረጡት ማጣሪያዎች ጋር አልተገኘም።',
  noIssueResults: 'ምንም የመስጫ መረጃ ከአሁኑ ፍለጋ ጋር አልተገኘም።',
  noReturnResults: 'ምንም የመመለሻ መረጃ ከተመረጡት ማጣሪያዎች ጋር አልተገኘም።',
  loading: 'የክምችት ሪፖርት በመጫን ላይ...',
};

export default StoreReports;