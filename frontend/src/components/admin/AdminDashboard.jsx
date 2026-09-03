// AdminDashboard.jsx - Complete Single File
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage, useTheme } from '../../contexts/UiContext';
import {
  Chart as ChartJS,
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
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { toast } from 'react-toastify';
import { apiClient } from '../../utils/api';
import { useNavigate } from 'react-router-dom';
import {
  RefreshCw,
  Search,
  Download,
  Eye,
  Pencil,
  Plus,
  Users,
  Building2,
  Wrench,
  Radio,
  FileText,
  Settings,
  Database,
  Bell,
  Activity,
  Package,
  AlertTriangle,
  CheckCircle,
  XCircle
} from 'lucide-react';

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

const DEFAULT_STATS = {
  totalAssets: 0,
  activeAssets: 0,
  availableAssets: 0,
  retiredAssets: 0,
  missingAssets: 0,
  damagedAssets: 0,
  underMaintenance: 0,
  totalDepartments: 0,
  totalUsers: 0,
  pendingMaintenance: 0,
  rfidActivity: 0,
  totalValue: 0,
  assignedAssets: 0,
  overdueReturns: 0,
  assetByStatus: [],
  assetByDepartment: [],
  assetByCategory: [],
  assetsPurchasedOverTime: [],
  maintenanceTrend: [],
  rfidActivityLog: [],
  recentActivities: [],
  alerts: [],
  quickActions: [],
  rfidMetrics: {
    detectedTags: 0,
    uniqueTags: 0,
    onlineDevices: 0,
    offlineDevices: 0,
    unknownAlerts: 0,
    latestActivity: null
  },
  weeklySummary: {
    newAssets: 0,
    assignments: 0,
    maintenanceRequests: 0,
    completedMaintenance: 0,
    rfidActivity: 0
  },
  maintenanceSummary: {
    open: 0,
    inProgress: 0,
    completed: 0,
    overdue: 0,
    scheduled: 0
  },
  userSummary: {
    active: 0,
    inactive: 0,
    byRole: {}
  },
  departmentSummary: {
    mostAssets: null,
    attention: []
  },
  storeSummary: {
    totalItems: 0,
    inStock: 0,
    lowStock: 0,
    outOfStock: 0,
    totalTransactions: 0,
    thisWeek: 0,
    issues: 0
  },
  storeInventory: [],
  storeTransactions: [],
  recentAssets: [],
  searchCatalog: {
    assets: [],
    users: [],
    departments: []
  }
};

const AdminDashboard = () => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const { theme } = useTheme();
  const navigate = useNavigate();

  const [stats, setStats] = useState(DEFAULT_STATS);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [backups, setBackups] = useState([]);
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [lastUpdated, setLastUpdated] = useState(null);
  const [apiError, setApiError] = useState('');
  const isDark = theme === 'dark';

  // Translations
  const translations = {
    en: {
      dashboard: 'Admin Dashboard',
      welcome: 'Welcome',
      totalAssets: 'Total Assets',
      availableAssets: 'Available',
      assignedAssets: 'Assigned',
      retiredAssets: 'Retired',
      overdueReturns: 'Overdue Returns',
      missingAssets: 'Missing',
      damagedAssets: 'Damaged',
      underMaintenance: 'In Maintenance',
      totalDepartments: 'Departments',
      totalUsers: 'Users',
      pendingMaintenance: 'Pending Maintenance',
      rfidActivity: 'RFID Activity',
      totalValue: 'Total Value',
      assetsByStatus: 'Assets by Status',
      assetsByDepartment: 'Assets by Department',
      assetsByCategory: 'Assets by Category',
      assetsPurchased: 'Purchase Trend',
      maintenanceTrend: 'Maintenance Trend',
      recentActivities: 'Recent Activities',
      rfidActivityLog: 'RFID Log',
      recentAssets: 'Recent Assets',
      noRecentActivities: 'No recent activities',
      loading: 'Loading...',
      refresh: 'Refresh',
      retry: 'Retry',
      searchPlaceholder: 'Search assets, users, departments...',
      searchResults: 'Search Results',
      noSearchResults: 'No results found',
      asset: 'Asset',
      location: 'Location',
      timestamp: 'Timestamp',
      viewAll: 'View All',
      noData: 'No data available',
      loadError: 'Unable to load dashboard data.',
      notificationCenter: 'Notifications',
      notification: 'Notification',
      read: 'Read',
      unread: 'Unread',
      apiStatus: 'API Status',
      databaseStatus: 'Database',
      healthy: 'Healthy',
      error: 'Error',
      unavailable: 'Unavailable',
      maintenanceSummary: 'Maintenance Summary',
      inProgressMaintenance: 'In Progress',
      completedMaintenance: 'Completed',
      overdueMaintenance: 'Overdue',
      cancelledMaintenance: 'Cancelled',
      detectedTags: 'Detected Tags',
      uniqueTags: 'Unique Tags',
      onlineDevices: 'Online Devices',
      offlineDevices: 'Offline Devices',
      unknownAlerts: 'Unknown Alerts',
      openRfid: 'Open RFID',
      rfidSummary: 'RFID Summary',
      rfidAlerts: 'RFID Alerts',
      systemPerformance: 'System Performance',
      assetUtilization: 'Asset Utilization',
      maintenanceCompletion: 'Maintenance Completion',
      backupStatus: 'Backup',
      latestBackup: 'Latest Backup',
      backupDate: 'Backup Date',
      openBackup: 'Open Backup',
      notAvailable: 'Not available',
      weeklySummary: 'Weekly Summary',
      assetsAdded: 'Assets Added',
      assignments: 'Assignments',
      maintenanceRequests: 'Requests',
      adminTasks: 'Admin Tasks',
      noTasks: 'No pending tasks',
      review: 'Review',
      quickSettings: 'Quick Settings',
      quickActions: 'Quick Actions',
      settings: 'Settings',
      quickReports: 'Reports',
      helpSupport: 'Help & Support',
      account: 'Account',
      adminRole: 'System Administrator',
      addUser: 'Add User',
      addDepartment: 'Add Department',
      createMaintenance: 'Maintenance Request',
      alertCenter: 'Alert Center',
      systemAlert: 'System Alert',
      userSummary: 'User Summary',
      activeUsers: 'Active Users',
      inactiveUsers: 'Inactive Users',
      manageUsers: 'Manage Users',
      departmentSummary: 'Department Summary',
      mostAssets: 'Most Assets',
      needsAttention: 'Needs Attention',
      manageDepartments: 'Manage Departments',
      viewMaintenance: 'View Maintenance',
      exportDashboard: 'Export',
      exportSuccess: 'Export completed successfully.',
      exportError: 'Export failed.',
      pdfTitle: 'Admin Dashboard Asset Summary',
      lastUpdated: 'Last Updated',
      id: 'ID',
      name: 'Name',
      category: 'Category',
      department: 'Department',
      status: 'Status',
      rfid: 'RFID',
      lastUpdatedCol: 'Updated',
      actions: 'Actions',
      view: 'View',
      edit: 'Edit',
      none: 'None',
      storeDashboard: 'Store Dashboard',
      storeOverview: 'Store Overview',
      storeInventory: 'Store Inventory',
      totalStoreItems: 'Total Items',
      inStock: 'In Stock',
      lowStock: 'Low Stock',
      outOfStock: 'Out of Stock',
      totalTransactions: 'Total Transactions',
      thisWeekTransactions: 'This Week',
      stockIssues: 'Stock Issues',
      lowStockAlert: 'Low Stock Alert',
      allItemsInGoodStock: 'All items in good stock',
      topSellingItems: 'Top Selling Items',
      itemName: 'Item Name',
      quantity: 'Quantity',
      unitPrice: 'Unit Price',
      addItem: 'Add Item',
      recentTransactions: 'Recent Transactions',
      noTransactionsYet: 'No transactions yet',
      viewInventory: 'View Inventory',
      totalValueLabel: 'Total Value'
    },
    am: {
      dashboard: 'የአስተዳዳሪ ዳሽቦርድ',
      welcome: 'እንኳን ደህና መጡ',
      totalAssets: 'ጠቅላላ ንብረቶች',
      availableAssets: 'ያሉ',
      assignedAssets: 'የተመደቡ',
      retiredAssets: 'የተሰናበቱ',
      overdueReturns: 'ያለፈባቸው',
      missingAssets: 'የጠፉ',
      damagedAssets: 'የተበላሹ',
      underMaintenance: 'በጥገና',
      totalDepartments: 'ክፍሎች',
      totalUsers: 'ተጠቃሚዎች',
      pendingMaintenance: 'በመጠባበቅ',
      rfidActivity: 'RFID እንቅስቃሴ',
      totalValue: 'ጠቅላላ ዋጋ',
      assetsByStatus: 'በሁኔታ',
      assetsByDepartment: 'በክፍል',
      assetsByCategory: 'በምድብ',
      assetsPurchased: 'የግዢ አዝማሚያ',
      maintenanceTrend: 'የጥገና አዝማሚያ',
      recentActivities: 'የቅርብ ጊዜ እንቅስቃሴዎች',
      rfidActivityLog: 'RFID መዝገብ',
      recentAssets: 'የቅርብ ጊዜ ንብረቶች',
      noRecentActivities: 'ምንም እንቅስቃሴ የለም',
      loading: 'በመጫን...',
      refresh: 'አድስ',
      retry: 'እንደገና ሞክር',
      searchPlaceholder: 'ፈልግ...',
      searchResults: 'ውጤቶች',
      noSearchResults: 'ምንም አልተገኘም',
      asset: 'ንብረት',
      location: 'ቦታ',
      timestamp: 'ሰዓት',
      viewAll: 'ሁሉንም ተመልከት',
      noData: 'መረጃ የለም',
      loadError: 'መረጃ መጫን አልተቻለም።',
      notificationCenter: 'ማሳወቂያዎች',
      notification: 'ማሳወቂያ',
      read: 'ተነቧል',
      unread: 'ያልተነበበ',
      apiStatus: 'API ሁኔታ',
      databaseStatus: 'መረጃ ቋት',
      healthy: 'ጤናማ',
      error: 'ስህተት',
      unavailable: 'አይገኝም',
      maintenanceSummary: 'የጥገና ማጠቃለያ',
      inProgressMaintenance: 'በሂደት',
      completedMaintenance: 'ተጠናቋል',
      overdueMaintenance: 'ያለፈበት',
      cancelledMaintenance: 'ተሰርዟል',
      detectedTags: 'የተገኙ መለያዎች',
      uniqueTags: 'ልዩ መለያዎች',
      onlineDevices: 'በመስመር',
      offlineDevices: 'ከመስመር ውጭ',
      unknownAlerts: 'ያልታወቁ',
      openRfid: 'RFID ክፈት',
      rfidSummary: 'RFID ማጠቃለያ',
      rfidAlerts: 'RFID ማንቂያዎች',
      systemPerformance: 'የስርዓት አፈጻጸም',
      assetUtilization: 'የንብረት አጠቃቀም',
      maintenanceCompletion: 'የጥገና ማጠናቀቅ',
      backupStatus: 'ምትኬ',
      latestBackup: 'የቅርብ ጊዜ',
      backupDate: 'ቀን',
      openBackup: 'ምትኬ ክፈት',
      notAvailable: 'አይገኝም',
      weeklySummary: 'ሳምንታዊ ማጠቃለያ',
      assetsAdded: 'ንብረቶች',
      assignments: 'ምደባዎች',
      maintenanceRequests: 'ጥያቄዎች',
      adminTasks: 'የአስተዳዳሪ ሥራዎች',
      noTasks: 'ምንም ሥራ የለም',
      review: 'ገምግም',
      quickSettings: 'ፈጣን ቅንብሮች',
      quickActions: 'ፈጣን እርምጃዎች',
      settings: 'ቅንብሮች',
      quickReports: 'ሪፖርቶች',
      helpSupport: 'እገዛ',
      account: 'መለያ',
      adminRole: 'አስተዳዳሪ',
      addUser: 'ተጠቃሚ ጨምር',
      addDepartment: 'ክፍል ጨምር',
      createMaintenance: 'ጥገና ጠይቅ',
      alertCenter: 'ማንቂያዎች',
      systemAlert: 'ስርዓት',
      userSummary: 'ተጠቃሚዎች',
      activeUsers: 'ንቁ',
      inactiveUsers: 'ንቁ ያልሆኑ',
      manageUsers: 'አስተዳድር',
      departmentSummary: 'ክፍሎች',
      mostAssets: 'ብዙ ንብረት',
      needsAttention: 'ትኩረት የሚፈልጉ',
      manageDepartments: 'አስተዳድር',
      viewMaintenance: 'ጥገና ተመልከት',
      exportDashboard: 'ላክ',
      exportSuccess: 'በትክክል ተልኳል።',
      exportError: 'መላክ አልተሳካም።',
      pdfTitle: 'የአስተዳዳሪ ዳሽቦርድ ማጠቃለያ',
      lastUpdated: 'የመጨረሻ ማሻሻያ',
      id: 'መለያ',
      name: 'ስም',
      category: 'ምድብ',
      department: 'ክፍል',
      status: 'ሁኔታ',
      rfid: 'RFID',
      lastUpdatedCol: 'የተሻሻለ',
      actions: 'እርምጃዎች',
      view: 'ተመልከት',
      edit: 'አስተካክል',
      none: 'የለም',
      storeDashboard: 'የሱቅ ዳሽቦርድ',
      storeOverview: 'አጠቃላይ',
      storeInventory: 'ስቶክ',
      totalStoreItems: 'ጠቅላላ ዕቃዎች',
      inStock: 'በሱቁ ላይ',
      lowStock: 'ዝቅተኛ',
      outOfStock: 'አልተገኘም',
      totalTransactions: 'ግብይቶች',
      thisWeekTransactions: 'ይህ ሳምንት',
      stockIssues: 'ችግሮች',
      lowStockAlert: 'ዝቅተኛ ስቶክ',
      allItemsInGoodStock: 'ሁሉም ጤናማ ናቸው',
      topSellingItems: 'በርካታ የሚሸጡ',
      itemName: 'ዕቃ',
      quantity: 'ብዛት',
      unitPrice: 'ዋጋ',
      addItem: 'ዕቃ ጨምር',
      recentTransactions: 'የቅርብ ግብይቶች',
      noTransactionsYet: 'ግብይት የለም',
      viewInventory: 'ስቶክን ተመልከት',
      totalValueLabel: 'ጠቅላላ ዋጋ'
    }
  };

  const t = translations[language] || translations.en;

  // Safe helpers
  const safeArray = (value) => Array.isArray(value) ? value : [];
  const safeObject = (value, fallback = {}) => value && typeof value === 'object' && !Array.isArray(value) ? value : fallback;
  const safeNumber = (value, fallback = 0) => {
    if (value === null || value === undefined || value === '') return fallback;
    const num = Number(value);
    return Number.isFinite(num) && num >= 0 ? num : fallback;
  };
  const safeDate = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString();
  };
  const safeDateOnly = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString();
  };

  const normalizeStats = (data) => {
    const source = safeObject(data);
    return {
      ...DEFAULT_STATS,
      totalAssets: safeNumber(source.totalAssets),
      activeAssets: safeNumber(source.activeAssets),
      availableAssets: safeNumber(source.availableAssets, safeNumber(source.activeAssets)),
      retiredAssets: safeNumber(source.retiredAssets),
      missingAssets: safeNumber(source.missingAssets),
      damagedAssets: safeNumber(source.damagedAssets),
      underMaintenance: safeNumber(source.underMaintenance),
      totalDepartments: safeNumber(source.totalDepartments),
      totalUsers: safeNumber(source.totalUsers),
      pendingMaintenance: safeNumber(source.pendingMaintenance),
      rfidActivity: safeNumber(source.rfidActivity),
      totalValue: safeNumber(source.totalValue),
      assignedAssets: safeNumber(source.assignedAssets),
      overdueReturns: safeNumber(source.overdueReturns),
      assetByStatus: safeArray(source.assetByStatus),
      assetByDepartment: safeArray(source.assetByDepartment),
      assetByCategory: safeArray(source.assetByCategory),
      assetsPurchasedOverTime: safeArray(source.assetsPurchasedOverTime),
      maintenanceTrend: safeArray(source.maintenanceTrend),
      rfidActivityLog: safeArray(source.rfidActivityLog),
      recentActivities: safeArray(source.recentActivities),
      alerts: safeArray(source.alerts),
      quickActions: safeArray(source.quickActions),
      rfidMetrics: { ...DEFAULT_STATS.rfidMetrics, ...safeObject(source.rfidMetrics) },
      weeklySummary: { ...DEFAULT_STATS.weeklySummary, ...safeObject(source.weeklySummary) },
      maintenanceSummary: { ...DEFAULT_STATS.maintenanceSummary, ...safeObject(source.maintenanceSummary) },
      userSummary: { ...DEFAULT_STATS.userSummary, ...safeObject(source.userSummary), byRole: safeObject(source.userSummary?.byRole) },
      departmentSummary: { ...DEFAULT_STATS.departmentSummary, ...safeObject(source.departmentSummary), attention: safeArray(source.departmentSummary?.attention) },
      storeSummary: { ...DEFAULT_STATS.storeSummary, ...safeObject(source.storeSummary) },
      storeInventory: safeArray(source.storeInventory),
      storeTransactions: safeArray(source.storeTransactions),
      recentAssets: safeArray(source.recentAssets),
      searchCatalog: { ...DEFAULT_STATS.searchCatalog, ...safeObject(source.searchCatalog), assets: safeArray(source.searchCatalog?.assets), users: safeArray(source.searchCatalog?.users), departments: safeArray(source.searchCatalog?.departments) }
    };
  };

  // Fetch dashboard data
  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    setApiError('');

    try {
      const response = await apiClient.get('/api/admin/dashboard');
      let data = {};
      
      if (response?.data?.data && typeof response.data.data === 'object') {
        data = response.data.data;
      } else if (response?.data && typeof response.data === 'object') {
        if (response.data.success !== undefined) {
          data = response.data.data || response.data;
        } else {
          data = response.data;
        }
      }

      // Fetch optional data
      const [notificationsResponse, backupsResponse] = await Promise.allSettled([
        apiClient.get('/api/notifications'),
        apiClient.get('/api/backups')
      ]);

      if (notificationsResponse.status === 'fulfilled') {
        try {
          const notificationData = notificationsResponse.value?.data;
          setNotifications(safeArray(notificationData?.notifications || notificationData?.data || notificationData));
        } catch (err) {
          console.warn('Failed to parse notifications:', err);
          setNotifications([]);
        }
      } else {
        setNotifications([]);
      }

      if (backupsResponse.status === 'fulfilled') {
        try {
          const backupData = backupsResponse.value?.data;
          setBackups(safeArray(backupData?.backups || backupData?.data || backupData));
        } catch (err) {
          console.warn('Failed to parse backups:', err);
          setBackups([]);
        }
      } else {
        setBackups([]);
      }

      const normalizedStats = normalizeStats(data);
      setStats(normalizedStats);
      setLastUpdated(new Date());
    } catch (error) {
      const message = error?.response?.data?.message || error?.response?.data?.error || error?.message || t.loadError;
      setApiError(message);
      setLoadError(true);
      setStats(DEFAULT_STATS);
      console.error('Dashboard fetch error:', error);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [t.loadError]);

  // Clock and auto refresh
  useEffect(() => {
    fetchDashboardData();
    const clockTimer = window.setInterval(() => setCurrentDateTime(new Date()), 1000);
    const refreshTimer = window.setInterval(() => fetchDashboardData(), 60000);
    return () => {
      window.clearInterval(clockTimer);
      window.clearInterval(refreshTimer);
    };
  }, [fetchDashboardData]);

  // Colors
  const chartColors = {
    light: {
      primary: '#2b6cb0',
      secondary: '#4299e1',
      success: '#48bb78',
      warning: '#ed8936',
      danger: '#fc8181',
      purple: '#805ad5',
      teal: '#38b2ac',
      background: 'rgba(43, 108, 176, 0.2)'
    },
    dark: {
      primary: '#63b3ed',
      secondary: '#4299e1',
      success: '#48bb78',
      warning: '#ed8936',
      danger: '#fc8181',
      purple: '#b794f4',
      teal: '#4fd1c5',
      background: 'rgba(99, 179, 237, 0.2)'
    }
  };
  const colors = isDark ? chartColors.dark : chartColors.light;

  // Status routes
  const statusRoutes = {
    Available: '/admin/assets?status=available',
    Active: '/admin/assets?status=active',
    Assigned: '/admin/assets?status=assigned',
    Maintenance: '/admin/maintenance',
    'Under-Maintenance': '/admin/maintenance',
    Damaged: '/admin/assets?status=damaged',
    Missing: '/admin/assets?status=missing',
    Retired: '/admin/assets?status=retired'
  };

  // Chart data
  const statusChartData = useMemo(() => {
    const labels = safeArray(stats.assetByStatus).map(item => item?.label || item?.status || 'Unknown');
    const values = safeArray(stats.assetByStatus).map(item => safeNumber(item?.value));
    return {
      labels: labels.length > 0 ? labels : ['No Data'],
      datasets: [{
        label: t.assetsByStatus,
        data: values.length > 0 ? values : [0],
        backgroundColor: [colors.success, colors.primary, colors.warning, colors.danger, colors.purple, colors.secondary],
        borderColor: isDark ? '#1e2d45' : '#ffffff',
        borderWidth: 2
      }]
    };
  }, [stats.assetByStatus, t.assetsByStatus, colors, isDark]);

  const departmentChartData = useMemo(() => {
    const labels = safeArray(stats.assetByDepartment).map(item => item?.label || item?.department || 'Unknown');
    const values = safeArray(stats.assetByDepartment).map(item => safeNumber(item?.value));
    return {
      labels: labels.length > 0 ? labels : ['No Data'],
      datasets: [{
        label: t.assetsByDepartment,
        data: values.length > 0 ? values : [0],
        backgroundColor: ['#4299e1', '#48bb78', '#ed8936', '#fc8181', '#805ad5', '#9f7aea', '#f687b3', '#4fd1c5', '#f6ad55', '#63b3ed'],
        borderColor: isDark ? '#1e2d45' : '#ffffff',
        borderWidth: 2
      }]
    };
  }, [stats.assetByDepartment, t.assetsByDepartment, isDark]);

  const categoryChartData = useMemo(() => {
    const labels = safeArray(stats.assetByCategory).map(item => item?.label || item?.category || 'Unknown');
    const values = safeArray(stats.assetByCategory).map(item => safeNumber(item?.value));
    return {
      labels: labels.length > 0 ? labels : ['No Data'],
      datasets: [{
        label: t.assetsByCategory,
        data: values.length > 0 ? values : [0],
        backgroundColor: ['#2864E8', '#48bb78', '#ed8936', '#fc8181', '#805ad5', '#4fd1c5'],
        borderWidth: 2
      }]
    };
  }, [stats.assetByCategory, t.assetsByCategory]);

  const purchasedChartData = useMemo(() => {
    const labels = safeArray(stats.assetsPurchasedOverTime).map(item => item?.label || item?.month || item?.year || '-');
    const values = safeArray(stats.assetsPurchasedOverTime).map(item => safeNumber(item?.value));
    return {
      labels: labels.length > 0 ? labels : ['No Data'],
      datasets: [{
        label: t.assetsPurchased,
        data: values.length > 0 ? values : [0],
        borderColor: '#2864E8',
        backgroundColor: 'rgba(40,100,232,0.18)',
        fill: true,
        tension: 0.35
      }]
    };
  }, [stats.assetsPurchasedOverTime, t.assetsPurchased]);

  const trendChartData = useMemo(() => {
    const maintenanceData = safeArray(stats.maintenanceTrend);
    const labels = maintenanceData.length > 0 ? maintenanceData.map(item => item?.month || item?.label || '-') : ['No Data'];
    return {
      labels,
      datasets: [
        { label: t.pendingMaintenance, data: maintenanceData.length > 0 ? maintenanceData.map(item => safeNumber(item?.pending)) : [0], borderColor: colors.warning, backgroundColor: 'transparent', tension: 0.4 },
        { label: t.inProgressMaintenance, data: maintenanceData.length > 0 ? maintenanceData.map(item => safeNumber(item?.inProgress)) : [0], borderColor: colors.primary, backgroundColor: 'transparent', tension: 0.4 },
        { label: t.completedMaintenance, data: maintenanceData.length > 0 ? maintenanceData.map(item => safeNumber(item?.completed)) : [0], borderColor: colors.success, backgroundColor: 'transparent', tension: 0.4 },
        { label: t.cancelledMaintenance, data: maintenanceData.length > 0 ? maintenanceData.map(item => safeNumber(item?.cancelled)) : [0], borderColor: colors.danger, backgroundColor: 'transparent', tension: 0.4 }
      ]
    };
  }, [stats.maintenanceTrend, t.pendingMaintenance, t.inProgressMaintenance, t.completedMaintenance, t.cancelledMaintenance, colors]);

  // Chart options
  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom', labels: { color: isDark ? '#c8dcf5' : '#1a365d', boxWidth: 12, padding: 16 } },
      tooltip: { enabled: true }
    },
    scales: {
      y: { beginAtZero: true, ticks: { color: isDark ? '#8896b0' : '#4a5568' }, grid: { color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' } },
      x: { ticks: { color: isDark ? '#8896b0' : '#4a5568' }, grid: { color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' } }
    }
  }), [isDark]);

  const statusChartOptions = useMemo(() => ({
    ...chartOptions,
    onClick: (_, elements) => {
      const item = elements?.[0];
      if (!item) return;
      const status = statusChartData.labels[item.index];
      if (statusRoutes[status]) navigate(statusRoutes[status]);
    }
  }), [chartOptions, statusChartData.labels, navigate]);

  const departmentChartOptions = useMemo(() => ({
    ...chartOptions,
    onClick: (_, elements) => {
      const item = elements?.[0];
      if (!item) return;
      const department = departmentChartData.labels[item.index];
      if (department) navigate(`/admin/assets?department=${encodeURIComponent(department)}`);
    }
  }), [chartOptions, departmentChartData.labels, navigate]);

  const lineChartOptions = useMemo(() => ({
    ...chartOptions,
    plugins: { ...chartOptions.plugins, legend: { ...chartOptions.plugins.legend, position: 'top' } }
  }), [chartOptions]);

  // Search
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const searchResults = useMemo(() => {
    if (!normalizedSearch) return [];
    const assets = safeArray(stats.searchCatalog?.assets);
    const users = safeArray(stats.searchCatalog?.users);
    const departments = safeArray(stats.searchCatalog?.departments);
    const activities = safeArray(stats.recentActivities);
    
    const assetResults = assets.filter(item => [item?.id, item?.name, item?.category, item?.department, item?.rfid, item?.status].some(v => String(v ?? '').toLowerCase().includes(normalizedSearch))).map(item => ({ ...item, kind: 'Asset' }));
    const userResults = users.filter(item => [item?.id, item?.username, item?.name, item?.fullName, item?.role].some(v => String(v ?? '').toLowerCase().includes(normalizedSearch))).map(item => ({ ...item, kind: 'User' }));
    const departmentResults = departments.filter(item => String(item?.name ?? '').toLowerCase().includes(normalizedSearch)).map(item => ({ ...item, kind: 'Department' }));
    const activityResults = activities.filter(item => [item?.title, item?.description, item?.action, item?.module, item?.type].some(v => String(v ?? '').toLowerCase().includes(normalizedSearch))).map((item, index) => ({ ...item, id: item?.id || `activity-${index}`, kind: 'Activity' }));
    return [...assetResults, ...userResults, ...departmentResults, ...activityResults].slice(0, 12);
  }, [normalizedSearch, stats.searchCatalog, stats.recentActivities]);

  // Export
  const exportRows = useMemo(() => safeArray(stats.recentAssets).map(asset => ({
    ID: asset?.id ?? '',
    Name: asset?.name ?? '',
    Category: asset?.category ?? '',
    Department: asset?.department ?? '',
    Status: asset?.status ?? '',
    RFID: asset?.rfid ?? '',
    Updated: asset?.updatedAt ? safeDate(asset.updatedAt) : ''
  })), [stats.recentAssets]);

  const exportHeaders = ['ID', 'Name', 'Category', 'Department', 'Status', 'RFID', 'Updated'];

  const downloadCsv = () => {
    try {
      const rows = exportRows.length ? exportRows : [{ ID: '', Name: '', Category: '', Department: '', Status: '', RFID: '', Updated: '' }];
      const csv = [exportHeaders, ...rows.map(row => exportHeaders.map(h => String(row[h] ?? '').replace(/"/g, '""')))].map(row => row.map(v => `"${v}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'admin-dashboard-assets.csv';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success(t.exportSuccess);
    } catch (error) {
      toast.error(error?.message || t.exportError);
    }
  };

  const downloadExcel = async () => {
    try {
      const XLSX = await import('xlsx');
      const rows = exportRows.length ? exportRows : [{ ID: '', Name: '', Category: '', Department: '', Status: '', RFID: '', Updated: '' }];
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Assets');
      XLSX.writeFile(workbook, 'admin-dashboard-assets.xlsx');
      toast.success(t.exportSuccess);
    } catch (error) {
      toast.error(error?.message || t.exportError);
    }
  };

  const downloadPdf = async () => {
    try {
      const [jspdfModule, autoTableModule] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
      const { jsPDF } = jspdfModule;
      const autoTable = autoTableModule.default || autoTableModule;
      const doc = new jsPDF();
      const rows = exportRows.length ? exportRows : [{ ID: '', Name: '', Category: '', Department: '', Status: '', RFID: '', Updated: '' }];
      doc.text(t.pdfTitle, 14, 16);
      autoTable(doc, { head: [exportHeaders], body: rows.map(row => exportHeaders.map(h => row[h])), startY: 24 });
      doc.save('admin-dashboard-assets.pdf');
      toast.success(t.exportSuccess);
    } catch (error) {
      toast.error(error?.message || t.exportError);
    }
  };

  // Calculations
  const maintenanceTotal = safeArray(stats.maintenanceTrend).reduce((total, period) => total + safeNumber(period?.count), 0);
  const maintenanceCompleted = safeArray(stats.maintenanceTrend).reduce((total, period) => total + safeNumber(period?.completed), 0);
  const maintenanceCompletion = maintenanceTotal > 0 ? Math.round((maintenanceCompleted / maintenanceTotal) * 100) : 0;
  const assetUtilization = stats.totalAssets > 0 ? Math.round((stats.assignedAssets / stats.totalAssets) * 100) : 0;
  const unreadNotifications = safeArray(notifications).filter(n => !n?.is_read && !n?.isRead);
  const latestBackup = safeArray(backups)[0];

  // Admin tasks
  const adminTasks = useMemo(() => {
    const tasks = [];
    if (stats.missingAssets > 0) tasks.push({ id: 'missing-assets', icon: '⚠️', message: `${stats.missingAssets} ${t.missingAssets}`, path: '/admin/assets?status=missing' });
    if (stats.damagedAssets > 0) tasks.push({ id: 'damaged-assets', icon: '🔧', message: `${stats.damagedAssets} ${t.damagedAssets}`, path: '/admin/assets?status=damaged' });
    if (stats.pendingMaintenance > 0) tasks.push({ id: 'pending-maintenance', icon: '🛠️', message: `${stats.pendingMaintenance} ${t.pendingMaintenance}`, path: '/admin/maintenance' });
    if (stats.overdueReturns > 0) tasks.push({ id: 'overdue-returns', icon: '⏰', message: `${stats.overdueReturns} ${t.overdueReturns}`, path: '/admin/assets' });
    if (safeNumber(stats.rfidMetrics?.unknownAlerts) > 0) tasks.push({ id: 'rfid-alerts', icon: '📡', message: `${stats.rfidMetrics.unknownAlerts} ${t.rfidAlerts}`, path: '/admin/rfid' });
    return tasks;
  }, [stats.missingAssets, stats.damagedAssets, stats.pendingMaintenance, stats.overdueReturns, stats.rfidMetrics, t]);

  // Quick actions
  const dashboardActions = useMemo(() => {
    const defaultActions = [
      { icon: '🏢', label: t.addDepartment, path: '/admin/departments' },
      { icon: '🔧', label: t.createMaintenance, path: '/admin/maintenance' }
    ];
    const apiActions = safeArray(stats.quickActions);
    return [...apiActions, ...defaultActions]
      .filter(action => action?.path && action?.label && !action.path.endsWith('/assets/create'))
      .filter((action, index, actions) => actions.findIndex(item => item.path === action.path) === index);
  }, [stats.quickActions, t]);

  // Loading state
  if (loading && !lastUpdated) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '20px', color: '#4a5568' }}>
        <RefreshCw size={30} style={{ animation: 'spin 1s linear infinite' }} />
        <p>{t.loading}</p>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Main render
  return (
    <div style={{
      width: '100%',
      background: isDark ? '#0d1117' : '#f0f2f5',
      color: isDark ? '#e6edf3' : '#1a365d',
      transition: 'all 0.3s ease'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '24px',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0, color: isDark ? '#c8dcf5' : '#1a365d' }}>
            {t.welcome}, {user?.fullName || user?.username || 'Admin'}
          </h1>
          <p style={{ margin: '4px 0 0 0', color: isDark ? '#8896b0' : '#4a5568' }}>{t.adminRole}</p>
          <p style={{ margin: '4px 0 0 0', color: isDark ? '#8896b0' : '#4a5568' }}>{currentDateTime.toLocaleString()}</p>
          {lastUpdated && <p style={{ margin: '4px 0 0 0', color: isDark ? '#8896b0' : '#4a5568' }}>{t.lastUpdated}: {lastUpdated.toLocaleString()}</p>}
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <Search size={17} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: isDark ? '#8896b0' : '#718096' }} />
            <input
              type="text"
              placeholder={t.searchPlaceholder}
              style={{
                padding: '10px 16px 10px 40px',
                borderRadius: '8px',
                border: `1px solid ${isDark ? '#32465f' : '#e2e8f0'}`,
                background: isDark ? '#1a273a' : '#ffffff',
                color: isDark ? '#c8dcf5' : '#1a365d',
                fontSize: '0.9rem',
                minWidth: '260px'
              }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 14px',
              borderRadius: '8px',
              border: `1px solid ${isDark ? '#4a6385' : '#cbd5e1'}`,
              background: isDark ? '#243652' : '#ffffff',
              color: isDark ? '#c8dcf5' : '#1a365d',
              cursor: loading ? 'wait' : 'pointer',
              fontWeight: 600,
              fontSize: '0.9rem'
            }}
            onClick={fetchDashboardData}
            disabled={loading}
          >
            <RefreshCw size={16} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            {t.refresh}
          </button>
        </div>
      </div>

      {/* Error */}
      {apiError && (
        <div style={{
          padding: '14px',
          borderRadius: '10px',
          marginBottom: '20px',
          background: isDark ? '#4a1a1a' : '#fed7d7',
          color: isDark ? '#fc8181' : '#9b2c2c',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          flexWrap: 'wrap'
        }}>
          <span><AlertTriangle size={18} style={{ verticalAlign: 'middle', marginRight: '8px' }} /> {apiError}</span>
          <button style={{
            padding: '10px 18px',
            borderRadius: '8px',
            background: isDark ? '#2b4a6b' : '#ebf4ff',
            color: isDark ? '#c8dcf5' : '#2b6cb0',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: 500,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '7px'
          }} onClick={fetchDashboardData}>{t.retry}</button>
        </div>
      )}

      {/* Search Results */}
      {normalizedSearch && (
        <div style={{
          background: isDark ? '#1e2d45' : '#ffffff',
          padding: '20px',
          borderRadius: '12px',
          border: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
          boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(0,0,100,0.06)',
          marginBottom: '20px'
        }}>
          <h3 style={{ color: isDark ? '#c8dcf5' : '#1a365d', fontSize: '1rem', marginBottom: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Search size={17} /> {t.searchResults}
          </h3>
          {searchResults.length > 0 ? (
            searchResults.map((result, index) => {
              const key = `${result.kind}-${result.id || index}`;
              return (
                <button
                  key={key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    padding: '10px 14px',
                    borderBottom: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
                    width: '100%',
                    border: 'none',
                    background: 'transparent',
                    textAlign: 'left',
                    cursor: 'pointer',
                    color: isDark ? '#c8dcf5' : '#1a365d'
                  }}
                  onClick={() => {
                    if (result.kind === 'Asset') navigate(`/admin/assets/${result.id}`);
                    else if (result.kind === 'User') navigate('/admin/users');
                    else if (result.kind === 'Department') navigate('/admin/departments');
                    else navigate('/admin/audit-logs');
                  }}
                >
                  <span><strong>{result.kind}</strong> {result.name || result.fullName || result.username || result.title || result.id}</span>
                  <span>{result.status || result.role || ''}</span>
                </button>
              );
            })
          ) : (
            <p style={{ textAlign: 'center', padding: '40px', color: isDark ? '#8896b0' : '#4a5568' }}>{t.noSearchResults}</p>
          )}
        </div>
      )}

      {/* Statistics Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '12px',
        marginBottom: '24px'
      }}>
        {[
          { label: t.totalAssets, value: stats.totalAssets, icon: Package, color: colors.primary, path: '/admin/assets' },
          { label: t.availableAssets, value: stats.availableAssets, icon: CheckCircle, color: colors.success, path: '/admin/assets?status=available' },
          { label: t.assignedAssets, value: stats.assignedAssets, icon: Users, color: colors.secondary, path: '/admin/assets?status=assigned' },
          { label: t.underMaintenance, value: stats.underMaintenance, icon: Wrench, color: colors.warning, path: '/admin/maintenance' },
          { label: t.missingAssets, value: stats.missingAssets, icon: XCircle, color: colors.danger, path: '/admin/assets?status=missing' },
          { label: t.damagedAssets, value: stats.damagedAssets, icon: AlertTriangle, color: colors.warning, path: '/admin/assets?status=damaged' },
          { label: t.totalUsers, value: stats.totalUsers, icon: Users, color: colors.purple, path: '/admin/users' },
          { label: t.totalDepartments, value: stats.totalDepartments, icon: Building2, color: colors.teal, path: '/admin/departments' },
          { label: t.pendingMaintenance, value: stats.pendingMaintenance, icon: Wrench, color: colors.warning, path: '/admin/maintenance' },
          { label: t.rfidActivity, value: stats.rfidActivity, icon: Radio, color: colors.primary, path: '/admin/rfid' },
          { label: t.overdueReturns, value: stats.overdueReturns, icon: Activity, color: colors.danger, path: '/admin/assets' },
          { label: t.totalValueLabel, value: stats.totalValue.toLocaleString(), icon: FileText, color: colors.success, path: '/admin/reports' }
        ].map((stat, idx) => (
          <div
            key={idx}
            style={{
              background: isDark ? '#1e2d45' : '#ffffff',
              padding: '16px 18px',
              borderRadius: '12px',
              border: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
              boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(0,0,100,0.06)',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              cursor: 'pointer',
              transition: 'transform 0.2s'
            }}
            onClick={() => navigate(stat.path)}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={{
              background: stat.color,
              borderRadius: '10px',
              padding: '10px',
              color: '#ffffff',
              minWidth: '40px',
              minHeight: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>{React.createElement(stat.icon, { size: 22 })}</div>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: isDark ? '#c8dcf5' : '#1a365d', lineHeight: 1.2 }}>{stat.value}</div>
              <div style={{ fontSize: '0.75rem', color: isDark ? '#8896b0' : '#4a5568' }}>{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Alert Center */}
      {stats.alerts.length > 0 && (
        <div style={{
          background: isDark ? '#1e2d45' : '#ffffff',
          padding: '16px 20px',
          borderRadius: '12px',
          border: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
          marginBottom: '24px'
        }}>
          <h3 style={{ color: isDark ? '#c8dcf5' : '#1a365d', fontSize: '1rem', marginBottom: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={18} /> {t.alertCenter}
          </h3>
          {stats.alerts.map((alert, index) => (
            <button
              key={alert?.id || `alert-${index}`}
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                marginBottom: '6px',
                width: '100%',
                border: 'none',
                textAlign: 'left',
                cursor: 'pointer',
                background: alert?.type === 'danger' ? (isDark ? '#4a1a1a' : '#fed7d7') : alert?.type === 'warning' ? (isDark ? '#4a3a1a' : '#fefcbf') : (isDark ? '#1a2a4a' : '#bee3f8'),
                color: alert?.type === 'danger' ? (isDark ? '#fc8181' : '#9b2c2c') : alert?.type === 'warning' ? (isDark ? '#f6ad55' : '#744210') : (isDark ? '#63b3ed' : '#2a4365')
              }}
              onClick={() => {
                const type = String(alert?.type || alert?.category || '').toLowerCase();
                if (type.includes('rfid')) navigate('/admin/rfid');
                else if (type.includes('maintenance')) navigate('/admin/maintenance');
                else if (type.includes('missing')) navigate('/admin/assets?status=missing');
                else if (type.includes('damaged')) navigate('/admin/assets?status=damaged');
                else navigate('/admin/assets');
              }}
            >
              {alert?.type === 'danger' ? '⚠️ ' : alert?.type === 'warning' ? '⚡ ' : 'ℹ️ '}
              {alert?.count !== undefined && <strong>{alert.count} </strong>}
              {alert?.message || alert?.title || t.systemAlert}
            </button>
          ))}
        </div>
      )}

      {/* Quick Actions */}
      <div style={{
        background: isDark ? '#1e2d45' : '#ffffff',
        padding: '20px',
        borderRadius: '12px',
        border: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
        boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(0,0,100,0.06)',
        marginBottom: '20px'
      }}>
        <h3 style={{ color: isDark ? '#c8dcf5' : '#1a365d', fontSize: '1rem', marginBottom: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Plus size={18} /> {t.quickActions}
        </h3>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '12px' }}>
          {dashboardActions.map((action, index) => (
            <button
              key={action?.path || `action-${index}`}
              style={{
                padding: '10px 18px',
                borderRadius: '8px',
                background: isDark ? '#2b4a6b' : '#ebf4ff',
                color: isDark ? '#c8dcf5' : '#2b6cb0',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: 500,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px'
              }}
              onClick={() => navigate(action.path)}
            >
              {action.icon || '⚡'} {action.label}
            </button>
          ))}
        </div>
      </div>

      {/* Charts Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
        gap: '20px',
        marginBottom: '24px'
      }}>
        <div style={{
          background: isDark ? '#1e2d45' : '#ffffff',
          padding: '20px',
          borderRadius: '12px',
          border: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
          boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(0,0,100,0.06)'
        }}>
          <h3 style={{ color: isDark ? '#c8dcf5' : '#1a365d', fontSize: '1rem', marginBottom: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            {t.assetsByStatus}
          </h3>
          <div style={{ height: '260px', position: 'relative' }}>
            {stats.assetByStatus.length ? <Doughnut data={statusChartData} options={statusChartOptions} /> : <p style={{ textAlign: 'center', padding: '40px', color: isDark ? '#8896b0' : '#4a5568' }}>{t.noData}</p>}
          </div>
        </div>
        <div style={{
          background: isDark ? '#1e2d45' : '#ffffff',
          padding: '20px',
          borderRadius: '12px',
          border: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
          boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(0,0,100,0.06)'
        }}>
          <h3 style={{ color: isDark ? '#c8dcf5' : '#1a365d', fontSize: '1rem', marginBottom: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            {t.assetsByDepartment}
          </h3>
          <div style={{ height: '260px', position: 'relative' }}>
            {stats.assetByDepartment.length ? <Bar data={departmentChartData} options={departmentChartOptions} /> : <p style={{ textAlign: 'center', padding: '40px', color: isDark ? '#8896b0' : '#4a5568' }}>{t.noData}</p>}
          </div>
        </div>
        <div style={{
          background: isDark ? '#1e2d45' : '#ffffff',
          padding: '20px',
          borderRadius: '12px',
          border: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
          boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(0,0,100,0.06)'
        }}>
          <h3 style={{ color: isDark ? '#c8dcf5' : '#1a365d', fontSize: '1rem', marginBottom: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            {t.maintenanceTrend}
          </h3>
          <div style={{ height: '260px', position: 'relative' }}>
            {stats.maintenanceTrend.length ? <Line data={trendChartData} options={lineChartOptions} /> : <p style={{ textAlign: 'center', padding: '40px', color: isDark ? '#8896b0' : '#4a5568' }}>{t.noData}</p>}
          </div>
        </div>
        <div style={{
          background: isDark ? '#1e2d45' : '#ffffff',
          padding: '20px',
          borderRadius: '12px',
          border: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
          boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(0,0,100,0.06)'
        }}>
          <h3 style={{ color: isDark ? '#c8dcf5' : '#1a365d', fontSize: '1rem', marginBottom: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            {t.assetsByCategory}
          </h3>
          <div style={{ height: '260px', position: 'relative' }}>
            {stats.assetByCategory.length ? <Bar data={categoryChartData} options={chartOptions} /> : <p style={{ textAlign: 'center', padding: '40px', color: isDark ? '#8896b0' : '#4a5568' }}>{t.noData}</p>}
          </div>
        </div>
        <div style={{
          background: isDark ? '#1e2d45' : '#ffffff',
          padding: '20px',
          borderRadius: '12px',
          border: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
          boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(0,0,100,0.06)'
        }}>
          <h3 style={{ color: isDark ? '#c8dcf5' : '#1a365d', fontSize: '1rem', marginBottom: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            {t.assetsPurchased}
          </h3>
          <div style={{ height: '260px', position: 'relative' }}>
            {stats.assetsPurchasedOverTime.length ? <Line data={purchasedChartData} options={lineChartOptions} /> : <p style={{ textAlign: 'center', padding: '40px', color: isDark ? '#8896b0' : '#4a5568' }}>{t.noData}</p>}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
        gap: '20px',
        marginBottom: '24px'
      }}>
        <div style={{
          background: isDark ? '#1e2d45' : '#ffffff',
          padding: '20px',
          borderRadius: '12px',
          border: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
          boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(0,0,100,0.06)',
          marginBottom: '20px'
        }}>
          <h3 style={{ color: isDark ? '#c8dcf5' : '#1a365d', fontSize: '1rem', marginBottom: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Wrench size={18} /> {t.maintenanceSummary}
          </h3>
          {Object.entries(stats.maintenanceSummary).map(([key, value]) => (
            <div key={key} style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              padding: '10px 14px',
              borderBottom: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
              color: isDark ? '#c8dcf5' : '#1a365d'
            }}>
              <span>{key.replace(/([A-Z])/g, ' $1')}</span>
              <strong>{safeNumber(value)}</strong>
            </div>
          ))}
          <button style={{
            padding: '10px 18px',
            borderRadius: '8px',
            background: isDark ? '#2b4a6b' : '#ebf4ff',
            color: isDark ? '#c8dcf5' : '#2b6cb0',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: 500,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '7px',
            marginTop: '12px'
          }} onClick={() => navigate('/admin/maintenance')}><Wrench size={15} /> {t.viewMaintenance}</button>
        </div>

        <div style={{
          background: isDark ? '#1e2d45' : '#ffffff',
          padding: '20px',
          borderRadius: '12px',
          border: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
          boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(0,0,100,0.06)',
          marginBottom: '20px'
        }}>
          <h3 style={{ color: isDark ? '#c8dcf5' : '#1a365d', fontSize: '1rem', marginBottom: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={18} /> {t.userSummary}
          </h3>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            padding: '10px 14px',
            borderBottom: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
            color: isDark ? '#c8dcf5' : '#1a365d'
          }}><span>{t.totalUsers}</span><strong>{stats.totalUsers}</strong></div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            padding: '10px 14px',
            borderBottom: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
            color: isDark ? '#c8dcf5' : '#1a365d'
          }}><span>{t.activeUsers}</span><strong>{safeNumber(stats.userSummary.active)}</strong></div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            padding: '10px 14px',
            borderBottom: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
            color: isDark ? '#c8dcf5' : '#1a365d'
          }}><span>{t.inactiveUsers}</span><strong>{safeNumber(stats.userSummary.inactive)}</strong></div>
          {Object.entries(stats.userSummary.byRole).map(([role, count]) => (
            <div key={role} style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              padding: '10px 14px',
              borderBottom: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
              color: isDark ? '#c8dcf5' : '#1a365d'
            }}><span>{role}</span><strong>{safeNumber(count)}</strong></div>
          ))}
        </div>

        <div style={{
          background: isDark ? '#1e2d45' : '#ffffff',
          padding: '20px',
          borderRadius: '12px',
          border: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
          boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(0,0,100,0.06)',
          marginBottom: '20px'
        }}>
          <h3 style={{ color: isDark ? '#c8dcf5' : '#1a365d', fontSize: '1rem', marginBottom: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Radio size={18} /> {t.rfidSummary}
          </h3>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            padding: '10px 14px',
            borderBottom: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
            color: isDark ? '#c8dcf5' : '#1a365d'
          }}><span>{t.detectedTags}</span><strong>{safeNumber(stats.rfidMetrics.detectedTags)}</strong></div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            padding: '10px 14px',
            borderBottom: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
            color: isDark ? '#c8dcf5' : '#1a365d'
          }}><span>{t.uniqueTags}</span><strong>{safeNumber(stats.rfidMetrics.uniqueTags)}</strong></div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            padding: '10px 14px',
            borderBottom: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
            color: isDark ? '#c8dcf5' : '#1a365d'
          }}><span>{t.onlineDevices}</span><strong>{safeNumber(stats.rfidMetrics.onlineDevices)}</strong></div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            padding: '10px 14px',
            borderBottom: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
            color: isDark ? '#c8dcf5' : '#1a365d'
          }}><span>{t.offlineDevices}</span><strong>{safeNumber(stats.rfidMetrics.offlineDevices)}</strong></div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            padding: '10px 14px',
            borderBottom: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
            color: isDark ? '#c8dcf5' : '#1a365d'
          }}><span>{t.unknownAlerts}</span><strong>{safeNumber(stats.rfidMetrics.unknownAlerts)}</strong></div>
          <button style={{
            padding: '10px 18px',
            borderRadius: '8px',
            background: isDark ? '#2b4a6b' : '#ebf4ff',
            color: isDark ? '#c8dcf5' : '#2b6cb0',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: 500,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '7px',
            marginTop: '12px'
          }} onClick={() => navigate('/admin/rfid')}><Radio size={15} /> {t.openRfid}</button>
        </div>
      </div>

      {/* Department Summary & Export */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
        gap: '20px',
        marginBottom: '24px'
      }}>
        <div style={{
          background: isDark ? '#1e2d45' : '#ffffff',
          padding: '20px',
          borderRadius: '12px',
          border: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
          boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(0,0,100,0.06)',
          marginBottom: '20px'
        }}>
          <h3 style={{ color: isDark ? '#c8dcf5' : '#1a365d', fontSize: '1rem', marginBottom: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Building2 size={18} /> {t.departmentSummary}
          </h3>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            padding: '10px 14px',
            borderBottom: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
            color: isDark ? '#c8dcf5' : '#1a365d'
          }}><span>{t.totalDepartments}</span><strong>{stats.totalDepartments}</strong></div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            padding: '10px 14px',
            borderBottom: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
            color: isDark ? '#c8dcf5' : '#1a365d'
          }}><span>{t.mostAssets}</span><strong>{stats.departmentSummary.mostAssets || t.none}</strong></div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            padding: '10px 14px',
            borderBottom: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
            color: isDark ? '#c8dcf5' : '#1a365d'
          }}><span>{t.needsAttention}</span><strong>{safeArray(stats.departmentSummary.attention).length}</strong></div>
          <button style={{
            padding: '10px 18px',
            borderRadius: '8px',
            background: isDark ? '#2b4a6b' : '#ebf4ff',
            color: isDark ? '#c8dcf5' : '#2b6cb0',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: 500,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '7px',
            marginTop: '12px'
          }} onClick={() => navigate('/admin/departments')}><Building2 size={15} /> {t.manageDepartments}</button>
        </div>

        <div style={{
          background: isDark ? '#1e2d45' : '#ffffff',
          padding: '20px',
          borderRadius: '12px',
          border: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
          boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(0,0,100,0.06)',
          marginBottom: '20px'
        }}>
          <h3 style={{ color: isDark ? '#c8dcf5' : '#1a365d', fontSize: '1rem', marginBottom: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Download size={18} /> {t.exportDashboard}
          </h3>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '12px' }}>
            <button style={{
              padding: '10px 18px',
              borderRadius: '8px',
              background: isDark ? '#2b4a6b' : '#ebf4ff',
              color: isDark ? '#c8dcf5' : '#2b6cb0',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: 500,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px'
            }} onClick={downloadPdf}><Download size={15} /> PDF</button>
            <button style={{
              padding: '10px 18px',
              borderRadius: '8px',
              background: isDark ? '#2b4a6b' : '#ebf4ff',
              color: isDark ? '#c8dcf5' : '#2b6cb0',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: 500,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px'
            }} onClick={downloadExcel}><Download size={15} /> Excel</button>
            <button style={{
              padding: '10px 18px',
              borderRadius: '8px',
              background: isDark ? '#2b4a6b' : '#ebf4ff',
              color: isDark ? '#c8dcf5' : '#2b6cb0',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: 500,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px'
            }} onClick={downloadCsv}><Download size={15} /> CSV</button>
          </div>
        </div>
      </div>

      {/* Recent Assets Table */}
      <div style={{
        background: isDark ? '#1e2d45' : '#ffffff',
        padding: '20px',
        borderRadius: '12px',
        border: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
        boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(0,0,100,0.06)',
        marginBottom: '20px'
      }}>
        <h3 style={{ color: isDark ? '#c8dcf5' : '#1a365d', fontSize: '1rem', marginBottom: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Package size={18} /> {t.recentAssets}
        </h3>
        {stats.recentAssets.length ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  {[t.id, t.name, t.category, t.department, t.status, t.rfid, t.lastUpdatedCol, t.actions].map(label => (
                    <th key={label} style={{ textAlign: 'left', padding: '8px 12px', borderBottom: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`, color: isDark ? '#8896b0' : '#4a5568', fontWeight: 600 }}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stats.recentAssets.map((asset, index) => (
                  <tr key={asset?.id || `asset-${index}`}>
                    <td style={{ padding: '8px 12px', borderBottom: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`, color: isDark ? '#c8dcf5' : '#1a365d' }}>{asset?.id || '-'}</td>
                    <td style={{ padding: '8px 12px', borderBottom: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`, color: isDark ? '#c8dcf5' : '#1a365d' }}>{asset?.name || '-'}</td>
                    <td style={{ padding: '8px 12px', borderBottom: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`, color: isDark ? '#c8dcf5' : '#1a365d' }}>{asset?.category || '-'}</td>
                    <td style={{ padding: '8px 12px', borderBottom: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`, color: isDark ? '#c8dcf5' : '#1a365d' }}>{asset?.department || '-'}</td>
                    <td style={{ padding: '8px 12px', borderBottom: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`, color: isDark ? '#c8dcf5' : '#1a365d' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 10px',
                        borderRadius: '20px',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        color: '#ffffff',
                        background: ['Available', 'Active'].includes(asset?.status) ? '#48bb78' : asset?.status === 'Missing' ? '#fc8181' : asset?.status === 'Damaged' ? '#ed8936' : ['Under-Maintenance', 'Maintenance'].includes(asset?.status) ? '#4299e1' : '#a0aec0'
                      }}>{asset?.status || '-'}</span>
                    </td>
                    <td style={{ padding: '8px 12px', borderBottom: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`, color: isDark ? '#c8dcf5' : '#1a365d' }}>{asset?.rfid || '-'}</td>
                    <td style={{ padding: '8px 12px', borderBottom: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`, color: isDark ? '#c8dcf5' : '#1a365d' }}>{safeDateOnly(asset?.updatedAt)}</td>
                    <td style={{ padding: '8px 12px', borderBottom: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`, color: isDark ? '#c8dcf5' : '#1a365d' }}>
                      <button style={{
                        padding: '6px 8px',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        background: 'transparent',
                        color: '#4299e1'
                      }} onClick={() => navigate(`/admin/assets/${asset.id}`)}><Eye size={15} /></button>
                      <button style={{
                        padding: '6px 8px',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        background: 'transparent',
                        color: '#ed8936'
                      }} onClick={() => navigate(`/admin/assets/${asset.id}/edit`)}><Pencil size={15} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p style={{ textAlign: 'center', padding: '40px', color: isDark ? '#8896b0' : '#4a5568' }}>{t.noData}</p>}
      </div>

      {/* Notifications */}
      <div style={{
        background: isDark ? '#1e2d45' : '#ffffff',
        padding: '20px',
        borderRadius: '12px',
        border: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
        boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(0,0,100,0.06)',
        marginBottom: '20px'
      }}>
        <h3 style={{ color: isDark ? '#c8dcf5' : '#1a365d', fontSize: '1rem', marginBottom: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Bell size={18} /> {t.notificationCenter}
        </h3>
        {notifications.length ? (
          safeArray(notifications).slice(0, 5).map((notification, index) => (
            <button key={notification?.id || `notification-${index}`} style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              padding: '10px 14px',
              borderBottom: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
              width: '100%',
              border: 'none',
              background: 'transparent',
              textAlign: 'left',
              cursor: 'pointer',
              color: isDark ? '#c8dcf5' : '#1a365d'
            }} onClick={() => navigate('/admin/notifications')}>
              <span>{notification?.is_read || notification?.isRead ? '○' : '●'} <strong>{notification?.title || t.notification}</strong> {notification?.message || ''}</span>
              <span>{notification?.is_read || notification?.isRead ? t.read : t.unread}</span>
            </button>
          ))
        ) : <p style={{ textAlign: 'center', padding: '40px', color: isDark ? '#8896b0' : '#4a5568' }}>{t.noData}</p>}
        <button style={{
          padding: '10px 18px',
          borderRadius: '8px',
          background: isDark ? '#2b4a6b' : '#ebf4ff',
          color: isDark ? '#c8dcf5' : '#2b6cb0',
          border: 'none',
          cursor: 'pointer',
          fontSize: '0.9rem',
          fontWeight: 500,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '7px',
          marginTop: '12px'
        }} onClick={() => navigate('/admin/notifications')}><Bell size={15} /> {t.viewAll}</button>
      </div>

      {/* System Performance & Weekly Summary */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
        gap: '20px',
        marginBottom: '24px'
      }}>
        <div style={{
          background: isDark ? '#1e2d45' : '#ffffff',
          padding: '20px',
          borderRadius: '12px',
          border: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
          boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(0,0,100,0.06)',
          marginBottom: '20px'
        }}>
          <h3 style={{ color: isDark ? '#c8dcf5' : '#1a365d', fontSize: '1rem', marginBottom: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={18} /> {t.systemPerformance}
          </h3>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            padding: '10px 14px',
            borderBottom: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
            color: isDark ? '#c8dcf5' : '#1a365d'
          }}><span>{t.apiStatus}</span><strong style={{ color: loadError ? '#fc8181' : '#48bb78' }}>{loadError ? t.error : t.healthy}</strong></div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            padding: '10px 14px',
            borderBottom: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
            color: isDark ? '#c8dcf5' : '#1a365d'
          }}><span>{t.databaseStatus}</span><strong style={{ color: loadError ? '#fc8181' : '#48bb78' }}>{loadError ? t.unavailable : t.healthy}</strong></div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            padding: '10px 14px',
            borderBottom: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
            color: isDark ? '#c8dcf5' : '#1a365d'
          }}><span>{t.assetUtilization}</span><strong>{assetUtilization}%</strong></div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            padding: '10px 14px',
            borderBottom: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
            color: isDark ? '#c8dcf5' : '#1a365d'
          }}><span>{t.maintenanceCompletion}</span><strong>{maintenanceCompletion}%</strong></div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            padding: '10px 14px',
            borderBottom: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
            color: isDark ? '#c8dcf5' : '#1a365d'
          }}><span>{t.notificationCenter}</span><strong>{unreadNotifications.length} {t.unread}</strong></div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            padding: '10px 14px',
            borderBottom: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
            color: isDark ? '#c8dcf5' : '#1a365d'
          }}><span>{t.backupStatus}</span><strong>{latestBackup?.status || t.notAvailable}</strong></div>
        </div>

        <div style={{
          background: isDark ? '#1e2d45' : '#ffffff',
          padding: '20px',
          borderRadius: '12px',
          border: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
          boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(0,0,100,0.06)',
          marginBottom: '20px'
        }}>
          <h3 style={{ color: isDark ? '#c8dcf5' : '#1a365d', fontSize: '1rem', marginBottom: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            📅 {t.weeklySummary}
          </h3>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            padding: '10px 14px',
            borderBottom: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
            color: isDark ? '#c8dcf5' : '#1a365d'
          }}><span>{t.assetsAdded}</span><strong>{safeNumber(stats.weeklySummary.newAssets)}</strong></div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            padding: '10px 14px',
            borderBottom: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
            color: isDark ? '#c8dcf5' : '#1a365d'
          }}><span>{t.assignments}</span><strong>{safeNumber(stats.weeklySummary.assignments)}</strong></div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            padding: '10px 14px',
            borderBottom: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
            color: isDark ? '#c8dcf5' : '#1a365d'
          }}><span>{t.maintenanceRequests}</span><strong>{safeNumber(stats.weeklySummary.maintenanceRequests)}</strong></div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            padding: '10px 14px',
            borderBottom: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
            color: isDark ? '#c8dcf5' : '#1a365d'
          }}><span>{t.completedMaintenance}</span><strong>{safeNumber(stats.weeklySummary.completedMaintenance)}</strong></div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            padding: '10px 14px',
            borderBottom: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
            color: isDark ? '#c8dcf5' : '#1a365d'
          }}><span>{t.rfidActivity}</span><strong>{safeNumber(stats.weeklySummary.rfidActivity)}</strong></div>
        </div>

        <div style={{
          background: isDark ? '#1e2d45' : '#ffffff',
          padding: '20px',
          borderRadius: '12px',
          border: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
          boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(0,0,100,0.06)',
          marginBottom: '20px'
        }}>
          <h3 style={{ color: isDark ? '#c8dcf5' : '#1a365d', fontSize: '1rem', marginBottom: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            ✅ {t.adminTasks}
          </h3>
          {adminTasks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: isDark ? '#8896b0' : '#4a5568' }}>
              <CheckCircle size={30} />
              <p>{t.noTasks}</p>
            </div>
          ) : (
            adminTasks.map(task => (
              <div key={task.id} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                padding: '10px 14px',
                borderBottom: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
                color: isDark ? '#c8dcf5' : '#1a365d'
              }}>
                <span>{task.icon} {task.message}</span>
                <button style={{
                  padding: '5px 9px',
                  borderRadius: '8px',
                  background: isDark ? '#2b4a6b' : '#ebf4ff',
                  color: isDark ? '#c8dcf5' : '#2b6cb0',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: 500,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '7px'
                }} onClick={() => navigate(task.path)}>{t.review}</button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Quick Settings */}
      <div style={{
        background: isDark ? '#1e2d45' : '#ffffff',
        padding: '20px',
        borderRadius: '12px',
        border: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
        boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(0,0,100,0.06)',
        marginBottom: '20px'
      }}>
        <h3 style={{ color: isDark ? '#c8dcf5' : '#1a365d', fontSize: '1rem', marginBottom: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Settings size={18} /> {t.quickSettings}
        </h3>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '12px' }}>
          <button style={{
            padding: '10px 18px',
            borderRadius: '8px',
            background: isDark ? '#2b4a6b' : '#ebf4ff',
            color: isDark ? '#c8dcf5' : '#2b6cb0',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: 500,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '7px'
          }} onClick={() => navigate('/admin/settings')}><Settings size={15} /> {t.settings}</button>
          <button style={{
            padding: '10px 18px',
            borderRadius: '8px',
            background: isDark ? '#2b4a6b' : '#ebf4ff',
            color: isDark ? '#c8dcf5' : '#2b6cb0',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: 500,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '7px'
          }} onClick={() => navigate('/admin/reports')}><FileText size={15} /> {t.quickReports}</button>
          <button style={{
            padding: '10px 18px',
            borderRadius: '8px',
            background: isDark ? '#2b4a6b' : '#ebf4ff',
            color: isDark ? '#c8dcf5' : '#2b6cb0',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: 500,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '7px'
          }} onClick={() => navigate('/admin/backup')}><Database size={15} /> {t.backupStatus}</button>
          <button style={{
            padding: '10px 18px',
            borderRadius: '8px',
            background: isDark ? '#2b4a6b' : '#ebf4ff',
            color: isDark ? '#c8dcf5' : '#2b6cb0',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: 500,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '7px'
          }} onClick={() => navigate('/contact')}>{t.helpSupport}</button>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          padding: '10px 14px',
          borderBottom: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
          color: isDark ? '#c8dcf5' : '#1a365d',
          marginTop: '16px',
          paddingLeft: 0,
          paddingRight: 0
        }}>
          <span>👤 {t.account}: {user?.fullName || user?.username || 'System Administrator'}</span>
          <span>{t.adminRole}</span>
        </div>
      </div>

      {/* Recent Activities & RFID Log */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
        gap: '20px',
        marginBottom: '24px'
      }}>
        <div style={{
          background: isDark ? '#1e2d45' : '#ffffff',
          padding: '20px',
          borderRadius: '12px',
          border: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
          boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(0,0,100,0.06)',
          marginBottom: '20px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
            <h3 style={{ color: isDark ? '#c8dcf5' : '#1a365d', fontSize: '1rem', marginBottom: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={18} /> {t.recentActivities}
            </h3>
            <button style={{
              padding: '6px 10px',
              borderRadius: '8px',
              background: isDark ? '#2b4a6b' : '#ebf4ff',
              color: isDark ? '#c8dcf5' : '#2b6cb0',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: 500,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px'
            }} onClick={() => navigate('/admin/audit-logs')}>{t.viewAll}</button>
          </div>
          {safeArray(stats.recentActivities).filter(a => String(a?.title || a?.description || a?.action || '').toLowerCase().includes(normalizedSearch)).length === 0 ? (
            <p style={{ textAlign: 'center', padding: '40px', color: isDark ? '#8896b0' : '#4a5568' }}>{t.noRecentActivities}</p>
          ) : (
            safeArray(stats.recentActivities).filter(a => String(a?.title || a?.description || a?.action || '').toLowerCase().includes(normalizedSearch)).slice(0, 8).map((activity, index) => (
              <div key={activity?.id || index} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                padding: '10px 14px',
                borderBottom: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
                color: isDark ? '#c8dcf5' : '#1a365d'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span>{activity?.icon || '•'}</span>
                  <span><strong>{activity?.module || activity?.type || 'System'}</strong> {activity?.action || ''} {activity?.description || activity?.title || ''}</span>
                </div>
                <span style={{ fontSize: '0.75rem', color: isDark ? '#8896b0' : '#4a5568' }}>{safeDate(activity?.time || activity?.createdAt || activity?.created_at)}</span>
              </div>
            ))
          )}
        </div>

        <div style={{
          background: isDark ? '#1e2d45' : '#ffffff',
          padding: '20px',
          borderRadius: '12px',
          border: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
          boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(0,0,100,0.06)',
          marginBottom: '20px'
        }}>
          <h3 style={{ color: isDark ? '#c8dcf5' : '#1a365d', fontSize: '1rem', marginBottom: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Radio size={18} /> {t.rfidActivityLog}
          </h3>
          <button style={{
            padding: '10px 18px',
            borderRadius: '8px',
            background: isDark ? '#2b4a6b' : '#ebf4ff',
            color: isDark ? '#c8dcf5' : '#2b6cb0',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: 500,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '7px',
            marginBottom: '12px'
          }} onClick={() => navigate('/admin/rfid')}><Radio size={15} /> {t.openRfid}</button>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`, color: isDark ? '#8896b0' : '#4a5568', fontWeight: 600 }}>#</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`, color: isDark ? '#8896b0' : '#4a5568', fontWeight: 600 }}>{t.asset}</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`, color: isDark ? '#8896b0' : '#4a5568', fontWeight: 600 }}>{t.location}</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`, color: isDark ? '#8896b0' : '#4a5568', fontWeight: 600 }}>{t.timestamp}</th>
                </tr>
              </thead>
              <tbody>
                {stats.rfidActivityLog.length === 0 ? (
                  <tr><td colSpan="4" style={{ textAlign: 'center', padding: '40px', color: isDark ? '#8896b0' : '#4a5568' }}>{t.noData}</td></tr>
                ) : (
                  stats.rfidActivityLog.slice(0, 6).map((log, index) => (
                    <tr key={log?.id || index}>
                      <td style={{ padding: '8px 12px', borderBottom: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`, color: isDark ? '#c8dcf5' : '#1a365d' }}>{index + 1}</td>
                      <td style={{ padding: '8px 12px', borderBottom: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`, color: isDark ? '#c8dcf5' : '#1a365d' }}>{log?.asset || log?.assetName || '-'}</td>
                      <td style={{ padding: '8px 12px', borderBottom: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`, color: isDark ? '#c8dcf5' : '#1a365d' }}>{log?.location || '-'}</td>
                      <td style={{ padding: '8px 12px', borderBottom: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`, color: isDark ? '#c8dcf5' : '#1a365d' }}>{log?.timestamp ? safeDate(log.timestamp) : '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Backup Status */}
      <div style={{
        background: isDark ? '#1e2d45' : '#ffffff',
        padding: '20px',
        borderRadius: '12px',
        border: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
        boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(0,0,100,0.06)',
        marginBottom: '20px'
      }}>
        <h3 style={{ color: isDark ? '#c8dcf5' : '#1a365d', fontSize: '1rem', marginBottom: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Database size={18} /> {t.backupStatus}
        </h3>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          padding: '10px 14px',
          borderBottom: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
          color: isDark ? '#c8dcf5' : '#1a365d'
        }}><span>{t.latestBackup}</span><strong>{latestBackup?.status || t.notAvailable}</strong></div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          padding: '10px 14px',
          borderBottom: `1px solid ${isDark ? '#32465f' : '#e8edf5'}`,
          color: isDark ? '#c8dcf5' : '#1a365d'
        }}><span>{t.backupDate}</span><strong>{safeDate(latestBackup?.created_at || latestBackup?.createdAt || latestBackup?.date)}</strong></div>
        <button style={{
          padding: '10px 18px',
          borderRadius: '8px',
          background: isDark ? '#2b4a6b' : '#ebf4ff',
          color: isDark ? '#c8dcf5' : '#2b6cb0',
          border: 'none',
          cursor: 'pointer',
          fontSize: '0.9rem',
          fontWeight: 500,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '7px',
          marginTop: '12px'
        }} onClick={() => navigate('/admin/backup')}><Database size={15} /> {t.openBackup}</button>
      </div>
    </div>
  );
};

export default AdminDashboard;