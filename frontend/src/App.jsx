// ==============================================
// src/App.jsx - COMPLETE WITH FIXED NAVIGATION
// ==============================================

import './App.css';
import './admin-design-system.css';
import axios from 'axios';
import { BrowserRouter, Routes, Route, Link, Navigate, useNavigate, useLocation, Outlet } from 'react-router-dom';
import React, { useState, useEffect, useRef, Suspense, lazy, useMemo } from 'react';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { ArrowLeftRight, BarChart3, Bell, Building2, ChevronDown, ChevronRight, ClipboardCheck, ClipboardList, DatabaseBackup, Github, LayoutDashboard, Linkedin, LogOut, Menu, Package, Radio, Settings, Users, Wrench, X } from 'lucide-react';
import MaintenanceLayout from './components/maintenance/MaintenanceLayout';
import Login from './components/public/Login';
import CollegeManagerPages from './components/college/CollegeManagerPages';

// ==========================================
// IMPORT UI CONTEXT
// ==========================================

import { UIProvider, useLanguage, useTheme } from './contexts/UiContext';

// ==========================================
// IMPORT CONTEXTS
// ==========================================

import { AuthProvider, useAuth } from './contexts/AuthContext';
import { DataProvider } from './contexts/DataContext';
import { getDepartmentLabel } from './utils/department';

// ==========================================
// LAZY LOAD ALL COMPONENTS
// ==========================================

// Admin Components
const AdminDashboard = lazy(() => import('./components/admin/AdminDashboard'));
const AdminAssets = lazy(() => import('./components/admin/AdminAssets'));
const AdminAssignment = lazy(() => import('./components/admin/AdminAssignment'));
const AdminTransfer = lazy(() => import('./components/admin/AdminTransfer'));
const AdminMaintenance = lazy(() => import('./components/admin/AdminMaintenance'));
const AdminRFIDTracking = lazy(() => import('./components/admin/AdminRFIDTracking'));
const AdminReports = lazy(() => import('./components/admin/AdminReports'));
const AdminUserManagement = lazy(() => import('./components/admin/AdminUserManagement'));
const AdminSettings = lazy(() => import('./components/admin/AdminSettings'));
const AdminNotifications = lazy(() => import('./components/admin/AdminNotifications'));
const AdminBackup = lazy(() => import('./components/admin/AdminBackup'));
const AdminDepartmentManagement = lazy(() => import('./components/admin/AdminDepartmentManagement'));
const AdminAuditLogs = lazy(() => import('./components/admin/AdminAuditLogs'));

// ICT Components
const ICTDashboard = lazy(() => import('./components/ict/ICTDashboard'));
const ICTAssets = lazy(() => import('./components/ict/ICTAssets'));
const ICTCreateAsset = lazy(() => import('./components/ict/ICTCreateAsset'));
const ICTAssignments = lazy(() => import('./components/ict/ICTAssignments'));
const ICTMaintenance = lazy(() => import('./components/ict/ICTMaintenance'));
const ICTRFIDTracking = lazy(() => import('./components/ict/ICTRFIDTracking'));
const ICTReports = lazy(() => import('./components/ict/ICTReports'));
const ICTInventory = lazy(() => import('./components/ict/ICTInventory'));
const ICTNotifications = lazy(() => import('./components/ict/ICTNotifications'));
const ICTAssetHistory = lazy(() => import('./components/ict/ICTAssetHistory'));
const ICTAssetRequests = lazy(() => import('./components/ict/ICTAssetRequests'));
const ICTEquipment = lazy(() => import('./components/ict/ICTEquipment'));
const ICTNetwork = lazy(() => import('./components/ict/ICTNetwork'));
const ICTTechnicalSupport = lazy(() => import('./components/ict/ICTTechnicalSupport'));

// Department Components
const DeptDashboard = lazy(() => import('./components/department/DeptDashboard'));
const DeptAssets = lazy(() => import('./components/department/DeptAssets'));
const DeptApprovals = lazy(() => import('./components/department/DeptApprovals'));
const DeptReports = lazy(() => import('./components/department/DeptReports'));
const DeptStaff = lazy(() => import('./components/department/DeptStaff'));
const DeptNotifications = lazy(() => import('./components/department/DeptNotifications'));
const DeptAssetHistory = lazy(() => import('./components/department/DeptAssetHistory'));

// Store Components
const StoreDashboard = lazy(() => import('./components/store/StoreDashboard'));
const StoreInventory = lazy(() => import('./components/store/StoreInventory'));
const StoreAssets = lazy(() => import('./components/store/StoreAssets'));
const StoreReceive = lazy(() => import('./components/store/StoreReceive'));
const StoreIssue = lazy(() => import('./components/store/StoreIssue'));
const StoreReturns = lazy(() => import('./components/store/StoreReturns'));
const StoreTransfers = lazy(() => import('./components/store/StoreTransfers'));
const StoreAssetRequests = lazy(() => import('./components/store/StoreAssetRequests'));
const StoreTracking = lazy(() => import('./components/store/StoreTracking'));
const StoreMaintenance = lazy(() => import('./components/store/StoreMaintenance'));
const StoreWarranty = lazy(() => import('./components/store/StoreWarranty'));
const StoreReports = lazy(() => import('./components/store/StoreReports'));
const StoreNotifications = lazy(() => import('./components/store/StoreNotifications'));
const StoreHistory = lazy(() => import('./components/store/StoreHistory'));

// Finance Components
const FinanceDashboard = lazy(() => import('./components/finance/FinanceDashboard'));
const FinanceValuation = lazy(() => import('./components/finance/FinanceValuation'));
const FinanceReports = lazy(() => import('./components/finance/FinanceReports'));
const FinanceDepreciation = lazy(() => import('./components/finance/FinanceDepreciation'));
const FinanceAudit = lazy(() => import('./components/finance/FinanceAudit'));
const FinanceNotifications = lazy(() => import('./components/finance/FinanceNotifications'));

// Maintenance Components
const MaintDashboard = lazy(() => import('./components/maintenance/MaintDashboard'));
const MaintRequests = lazy(() => import('./components/maintenance/MaintRequests'));
const MaintAssetInspection = lazy(() => import('./components/maintenance/MaintAssetInspection'));
const MaintWorkOrders = lazy(() => import('./components/maintenance/MaintWorkOrders'));
const MaintRepairs = lazy(() => import('./components/maintenance/MaintRepairs'));
const MaintPreventive = lazy(() => import('./components/maintenance/MaintPreventive'));
const MaintTechnicians = lazy(() => import('./components/maintenance/MaintTechnicians'));
const MaintSpareParts = lazy(() => import('./components/maintenance/MaintSpareParts'));
const MaintAssetsUnderMaintenance = lazy(() => import('./components/maintenance/MaintAssetsUnderMaintenance'));
const MaintTestingQuality = lazy(() => import('./components/maintenance/MaintTestingQuality'));
const MaintAssigned = lazy(() => import('./components/maintenance/MaintAssigned'));
const MaintHistory = lazy(() => import('./components/maintenance/MaintHistory'));
const MaintReports = lazy(() => import('./components/maintenance/MaintReports'));
const MaintNotifications = lazy(() => import('./components/maintenance/MaintNotifications'));

// Infrastructure Components
const InfrastructureLayout = lazy(() => import('./components/infrastructure/InfrastructureLayout'));
const InfrastructureDashboard = lazy(() => import('./components/infrastructure/InfrastructureDashboard'));
const InfrastructureAssets = lazy(() => import('./components/infrastructure/InfrastructureAssets'));
const RegisterInfrastructureAsset = lazy(() => import('./components/infrastructure/RegisterInfrastructureAsset'));
const InfrastructureBuildings = lazy(() => import('./components/infrastructure/InfrastructureBuildings'));
const InfrastructureElectrical = lazy(() => import('./components/infrastructure/InfrastructureElectrical'));
const InfrastructureGenerators = lazy(() => import('./components/infrastructure/InfrastructureGenerators'));
const InfrastructureTransformers = lazy(() => import('./components/infrastructure/InfrastructureTransformers'));
const InfrastructureUPS = lazy(() => import('./components/infrastructure/InfrastructureUPS'));
const InfrastructureSolar = lazy(() => import('./components/infrastructure/InfrastructureSolar'));
const InfrastructureWater = lazy(() => import('./components/infrastructure/InfrastructureWater'));
const InfrastructureRoads = lazy(() => import('./components/infrastructure/InfrastructureRoads'));
const InfrastructureMaintenance = lazy(() => import('./components/infrastructure/InfrastructureMaintenance'));
const InfrastructureWorkOrders = lazy(() => import('./components/infrastructure/InfrastructureWorkOrders'));
const InfrastructurePreventive = lazy(() => import('./components/infrastructure/InfrastructurePreventive'));
const InfrastructureSpareParts = lazy(() => import('./components/infrastructure/InfrastructureSpareParts'));
const InfrastructureEnergy = lazy(() => import('./components/infrastructure/InfrastructureEnergy'));
const InfrastructureFuel = lazy(() => import('./components/infrastructure/InfrastructureFuel'));
const InfrastructureInspection = lazy(() => import('./components/infrastructure/InfrastructureInspection'));
const InfrastructureTracking = lazy(() => import('./components/infrastructure/InfrastructureTracking'));
const InfrastructureRequests = lazy(() => import('./components/infrastructure/InfrastructureRequests'));
const InfrastructureReports = lazy(() => import('./components/infrastructure/InfrastructureReports'));
const InfrastructureDocuments = lazy(() => import('./components/infrastructure/InfrastructureDocuments'));
const InfrastructureNotifications = lazy(() => import('./components/infrastructure/InfrastructureNotifications'));
const InfrastructureAudit = lazy(() => import('./components/infrastructure/InfrastructureAudit'));

// Shared Components - THESE ARE THE ACTUAL PAGE COMPONENTS
const AssetDetails = lazy(() => import('./components/shared/AssetDetails'));
const AssetCreate = lazy(() => import('./components/shared/AssetCreate'));

// Public Components - Login is NOT lazy loaded (critical page)
const Register = lazy(() => import('./components/public/Register'));
const ForgotPassword = lazy(() => import('./components/public/ForgotPassword'));
const ResetPassword = lazy(() => import('./components/public/ResetPassword'));
const Home = lazy(() => import('./components/public/Home'));
const AboutUs = lazy(() => import('./components/public/AboutUs'));
const Contact = lazy(() => import('./components/public/Contact'));

// ==========================================
// CONSTANTS
// ==========================================

const UNIVERSITY_LOGO = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTD7zNEgsJkgKAYvZNDkb5tckLn_KdLu_kHYaTLgqqwyhbv8cEsI8P5UYSk&s=10';

const normalizeRole = (role) => {
  if (!role) return 'user';
  const value = String(role).trim().toLowerCase();
  const aliases = {
    'admin': 'admin',
    'administrator': 'admin',
    'ict officer': 'ict_officer',
    'ict_officer': 'ict_officer',
    'ict-officer': 'ict_officer',
    'college': 'college',
    'department head': 'college',
    'department_head': 'college',
    'department-head': 'college',
    'dept_head': 'college',
    'dept-head': 'college',
    'department': 'college',
    'finance': 'finance',
    'finance officer': 'finance',
    'store manager': 'store_manager',
    'store_manager': 'store_manager',
    'store-manager': 'store_manager',
    'maintenance': 'maintenance',
    'maint': 'maintenance',
    'infrastructure': 'infrastructure',
    'infrastructure_directorate': 'infrastructure',
    'infra': 'infrastructure',
    'staff': 'staff',
    'student': 'student',
    'user': 'user'
  };
  return aliases[value] || value.replace(/\s+/g, '_');
};

const getDashboardRoute = (role) => {
  const roleMap = {
    admin: '/admin',
    ict_officer: '/ict',
    college: '/college',
    finance: '/finance',
    store_manager: '/store',
    maintenance: '/maintenance',
    infrastructure: '/infrastructure',
    staff: '/department'
  };
  return roleMap[normalizeRole(role)] || '/home';
};

const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { user } = useAuth();
  const currentRole = normalizeRole(user?.role || user?.roles);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(currentRole)) {
    return <Navigate to={getDashboardRoute(user.role)} replace />;
  }

  return children;
};

const DepartmentWorkspaceRoute = () => {
  const { user } = useAuth();
  const role = normalizeRole(user?.role || user?.roles);
  const responsibility = String(user?.departmentRole || user?.responsibility || user?.position || '').trim().toLowerCase().replace(/[_-]+/g, ' ');
  const canUseDepartmentWorkspace = role === 'staff' || responsibility === 'department staff' || responsibility === 'department dean' || responsibility === 'dean';

  if (!canUseDepartmentWorkspace) {
    return <Navigate to={getDashboardRoute(user?.role)} replace />;
  }

  return <RoleLayout />;
};

const DepartmentDeanRoute = () => {
  const { user } = useAuth();
  const responsibility = String(user?.departmentRole || user?.responsibility || user?.position || '').trim().toLowerCase().replace(/[_-]+/g, ' ');
  return responsibility === 'department dean' || responsibility === 'dean'
    ? <DeptApprovals />
    : <Navigate to="/department" replace />;
};

// ==========================================
// CHUNK ERROR HANDLING - Recovers from chunk loading failures
// ==========================================

class ChunkErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasChunkError: false };
  }

  static getDerivedStateFromError(error) {
    if (error && error.name === 'ChunkLoadError') {
      return { hasChunkError: true };
    }
    throw error;
  }

  componentDidMount() {
    window.addEventListener('error', (event) => {
      if (event.message?.includes('ChunkLoadError') || event.message?.includes('Loading chunk')) {
        this.setState({ hasChunkError: true });
      }
    });
  }

  handleReload = () => {
    this.setState({ hasChunkError: false });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasChunkError) {
      return (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          backgroundColor: '#f3f4f6',
          flexDirection: 'column',
          gap: '20px'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '10px' }}>⚠️</div>
            <h1 style={{ color: '#1f2937', margin: '0 0 10px', fontSize: '1.5rem' }}>Loading Error</h1>
            <p style={{ color: '#6b7280', margin: '0 0 20px', maxWidth: '300px' }}>
              A component failed to load. Please reload the page to continue.
            </p>
            <button
              onClick={this.handleReload}
              style={{
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// ==========================================
// TRANSLATIONS
// ==========================================

const translations = {
  en: {
    university: "Mekdela Amba University",
    systemName: "Smart University Asset Management System",
    home: "Home",
    about: "About Us",
    contact: "Contact",
    login: "Login",
    logout: "Logout",
    welcome: "Welcome",
    welcomeBack: "Welcome Back",
    signIn: "Sign In",
    register: "Register",
    forgotPassword: "Forgot Password?",
    rememberMe: "Remember Me",
    noAccount: "Don't have an account?",
    signUp: "Sign Up",
    adminDashboard: "Admin Dashboard",
    ictDashboard: "ICT Officer Dashboard",
    departmentDashboard: "College Dashboard",
    financeDashboard: "Finance Dashboard",
    storeDashboard: "Store Manager Dashboard",
    maintenanceDashboard: "Maintenance Dashboard",
    dashboard: "Dashboard",
    assets: "Assets",
    allAssets: "All Assets",
    createAsset: "Create Asset",
    maintenance: "Maintenance",
    reports: "Reports",
    rfidTracking: "RFID Tracking",
    users: "User Management",
    settings: "Settings",
    assignments: "Assignments",
    inventory: "Inventory",
    valuation: "Asset Valuation",
    depreciation: "Depreciation",
    audit: "Audit Trail",
    footer: "© 2026 Mekdela Amba University - Smart University Asset Management System | All Rights Reserved | Developed by: Bekele :0986481821",
    light: "Light",
    dark: "Dark",
    language: "Language",
    companyName: "Mekdela Amba University",
    address: "Addis Ababa, Ethiopia",
    phone: "+251-111-222-333",
    email: "support@suams.edu",
    workingHours: "Mon-Fri: 8:00 - 17:00",
    privacyPolicy: "Privacy Policy",
    termsOfService: "Terms of Service",
    cookiePolicy: "Cookie Policy",
    allRightsReserved: "All Rights Reserved",
    developedBy: "Developed by: Bekele :0986481821",
    staff: "Staff",
    approvals: "Approvals",
    history: "History",
    requests: "Requests",
    assigned: "Assigned Tasks",
    financial: "Financial",
    store: "Store",
    notifications: "Notifications",
    backup: "Backup",
    departmentManagement: "Department Management",
    infrastructureDashboard: "Infrastructure Dashboard",
    infrastructure: "Infrastructure",
    infrastructureAssets: "Infrastructure Assets",
    buildings: "Buildings & Facilities",
    electricalSystems: "Electrical Systems",
    generators: "Generators",
    transformers: "Transformers",
    ups: "UPS / Inverters",
    solar: "Solar Energy",
    waterSystems: "Water Systems",
    roads: "Roads & Drainage",
    facilityMaintenance: "Facility Maintenance",
    workOrders: "Work Orders",
    preventiveMaintenance: "Preventive Maintenance",
    spareParts: "Spare Parts",
    energyManagement: "Energy Management",
    fuelManagement: "Fuel Management",
    inspection: "Inspection & Condition",
    tracking: "RFID / QR Tracking",
    documents: "Documents",
    auditHistory: "Audit & History"
  },
  am: {
    university: "መቅደላ አምባ ዩኒቨርሲቲ",
    systemName: "ስማርት ዩኒቨርሲቲ ንብረት አስተዳደር ስርዓት",
    home: "መነሻ",
    about: "ስለ እኛ",
    contact: "አግኙን",
    login: "ግባ",
    logout: "ውጣ",
    welcome: "እንኳን ደህና መጡ",
    welcomeBack: "እንኳን በደህና ተመለሱ",
    signIn: "ግባ",
    register: "ይመዝገቡ",
    forgotPassword: "የይለፍ ቃል ረሱ?",
    rememberMe: "አስታውሰኝ",
    noAccount: "መለያ የለዎትም?",
    signUp: "ይመዝገቡ",
    adminDashboard: "የአስተዳዳሪ ዳሽቦርድ",
    ictDashboard: "የICT መኮንን ዳሽቦርድ",
    departmentDashboard: "የክፍል ኃላፊ ዳሽቦርድ",
    financeDashboard: "የፋይናንስ ዳሽቦርድ",
    storeDashboard: "የመደብር አስተዳዳሪ ዳሽቦርድ",
    maintenanceDashboard: "የጥገና ቡድን ዳሽቦርድ",
    dashboard: "ዳሽቦርድ",
    assets: "ንብረቶች",
    allAssets: "ሁሉም ንብረቶች",
    createAsset: "አዲስ ንብረት ፍጠር",
    maintenance: "ጥገና",
    reports: "ሪፖርቶች",
    rfidTracking: "RFID ክትትል",
    users: "ተጠቃሚዎች",
    settings: "ቅንብሮች",
    assignments: "ምደባዎች",
    inventory: "ኢንቬንቶሪ",
    valuation: "የንብረት ዋጋ ግምት",
    depreciation: "ውድመት",
    audit: "የኦዲት መንገድ",
    footer: "© 2026 መቅደላ አምባ ዩኒቨርሲቲ - ስማርት ንብረት አስተዳደር ስርዓት | ሁሉም መብቶች ተጠብቀዋል | የተሰራዉ በ: በቀለ :0986481821",
    light: "ብርሃን",
    dark: "ጨለማ",
    language: "ቋንቋ",
    companyName: "መቅደላ አምባ ዩኒቨርሲቲ",
    address: "አዲስ አበባ፣ ኢትዮጵያ",
    phone: "+251-111-222-333",
    email: "support@suams.edu",
    workingHours: "ሰኞ-አርብ: 8:00 - 17:00",
    privacyPolicy: "የግላዊነት ፖሊሲ",
    termsOfService: "የአገልግሎት ውሎች",
    cookiePolicy: "የኩኪ ፖሊሲ",
    allRightsReserved: "ሁሉም መብቶች የተጠበቁ ናቸው",
    developedBy: "የተሰራዉ በ: በቀለ :0986481821",
    staff: "ሰራተኞች",
    approvals: "ማፅደቆች",
    history: "ታሪክ",
    requests: "ጥያቄዎች",
    assigned: "የተመደቡ ስራዎች",
    financial: "ፋይናንስ",
    store: "መደብር",
    notifications: "ማስታወቂያዎች",
    backup: "ምትኬ",
    departmentManagement: "ክፍል አስተዳደር",
    infrastructureDashboard: "የመሠረተ ልማት ዳሽቦርድ",
    infrastructure: "መሠረተ ልማት",
    infrastructureAssets: "መሠረተ ልማት ንብረቶች",
    buildings: "ሕንጻዎች ও ተቋማት",
    electricalSystems: "ኤሌክትሪክ ስርዓቶች",
    generators: "ጄነሬተሮች",
    transformers: "ትራንስፎርመሮች",
    ups: "UPS / ኢንቬርተሮች",
    solar: "ሥር የሰላጭ ኃይል",
    waterSystems: "ውሃ ስርዓቶች",
    roads: "መንገዶች እና ፍሳሽ",
    facilityMaintenance: "የተቋም ጥገና",
    workOrders: "የሥራ ትዕዛዞች",
    preventiveMaintenance: "ተ防止ታዊ ጥገና",
    spareParts: "ተተክ ስፍራዎች",
    energyManagement: "ኃይል ማሻሻያ",
    fuelManagement: "ነዳጅ አሪፍ",
    inspection: "ምርመራ እና ሁኔታ",
    tracking: "RFID / QR ክትትል",
    documents: "ሰነዶች",
    auditHistory: "ኦዲት እና ታሪክ"
  }
};

// ==========================================
// LOADING COMPONENT
// ==========================================

const LoadingFallback = () => (
  <div style={{
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    fontSize: '1.2rem',
    color: '#4a5568'
  }}>
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '2rem', marginBottom: '8px' }}>⏳</div>
      <div>Loading...</div>
    </div>
  </div>
);

const normalizeListResponse = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.assets)) return payload.assets;
  if (Array.isArray(payload.categories)) return payload.categories;
  if (Array.isArray(payload.locations)) return payload.locations;
  return [];
};

const getAssetCategoryFallback = (assets = []) => {
  const buckets = {};
  assets.forEach((asset) => {
    const name = String(asset?.category || asset?.category_name || 'Uncategorized').trim() || 'Uncategorized';
    if (!buckets[name]) {
      buckets[name] = { id: Date.now() + Math.random(), name, description: `${name} asset category`, assetCount: 0 };
    }
    buckets[name].assetCount += 1;
  });
  return Object.values(buckets).sort((left, right) => left.name.localeCompare(right.name));
};

const getAssetLocationFallback = (assets = []) => {
  const buckets = {};
  assets.forEach((asset) => {
    const name = String(asset?.location || asset?.site || 'Unassigned').trim() || 'Unassigned';
    if (!buckets[name]) {
      buckets[name] = { id: Date.now() + Math.random(), name, description: `${name} asset location`, assetCount: 0 };
    }
    buckets[name].assetCount += 1;
  });
  return Object.values(buckets).sort((left, right) => left.name.localeCompare(right.name));
};

const AdminAssetCategories = () => {
  const [categories, setCategories] = useState([]);
  const [assets, setAssets] = useState([]);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ name: '', description: '' });
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [categoriesResponse, assetsResponse] = await Promise.all([
        axios.get('/api/categories').catch(() => ({ data: { categories: [] } })),
        axios.get('/api/assets').catch(() => ({ data: { assets: [] } }))
      ]);

      const categoryRows = normalizeListResponse(categoriesResponse?.data ?? []);
      const assetRows = normalizeListResponse(assetsResponse?.data ?? []);
      const fallback = getAssetCategoryFallback(assetRows);
      const merged = [...categoryRows, ...fallback].reduce((accumulator, category) => {
        const key = String(category?.name || category?.category || '').trim() || 'Uncategorized';
        if (!accumulator[key]) {
          accumulator[key] = {
            id: category?.id || `${key}-${Date.now()}`,
            name: key,
            description: category?.description || `Category for ${key}`,
            assetCount: 0
          };
        }
        accumulator[key].assetCount += Number(category?.assetCount || 0);
        return accumulator;
      }, {});

      const finalRows = Object.values(merged).map((category) => ({
        ...category,
        assetCount: assetRows.filter((asset) => String(asset?.category || asset?.category_name || 'Uncategorized').trim() === category.name).length || category.assetCount || 0
      }));

      setAssets(assetRows);
      setCategories(finalRows.sort((left, right) => left.name.localeCompare(right.name)));
    } catch (loadError) {
      const fallback = getAssetCategoryFallback(assets);
      setCategories(fallback);
      setError('Category service is not available right now. Showing local category data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredCategories = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return categories;
    return categories.filter((category) => [category.name, category.description].some((value) => String(value || '').toLowerCase().includes(query)));
  }, [categories, search]);

  const saveCategory = () => {
    const name = form.name.trim();
    if (!name) return;

    if (editingId) {
      setCategories((previous) => previous.map((category) => category.id === editingId ? { ...category, name, description: form.description.trim() || category.description } : category));
    } else {
      setCategories((previous) => [{
        id: `local-${Date.now()}`,
        name,
        description: form.description.trim() || `${name} category`,
        assetCount: 0
      }, ...previous]);
    }

    setForm({ name: '', description: '' });
    setEditingId(null);
  };

  const removeCategory = (categoryId) => {
    setCategories((previous) => previous.filter((category) => category.id !== categoryId));
  };

  const startEdit = (category) => {
    setEditingId(category.id);
    setForm({ name: category.name, description: category.description || '' });
  };

  return (
    <div style={{ padding: '24px', background: '#ffffff', borderRadius: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ color: '#5a6b8a', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Admin / Assets</div>
          <h2 style={{ margin: '8px 0 0', color: '#1a365d', fontSize: '2rem' }}>📂 Categories</h2>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 360px) minmax(0, 1fr)', gap: '20px', marginBottom: '20px' }}>
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px' }}>
          <h3 style={{ margin: '0 0 16px', color: '#1a365d' }}>{editingId ? 'Edit Category' : 'Create Category'}</h3>
          <div style={{ display: 'grid', gap: '12px' }}>
            <input value={form.name} onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))} placeholder="Category name" style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
            <textarea value={form.description} onChange={(event) => setForm((previous) => ({ ...previous, description: event.target.value }))} placeholder="Category description" rows={4} style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', resize: 'vertical' }} />
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button type="button" onClick={saveCategory} style={{ background: '#2b6cb0', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 16px', cursor: 'pointer', fontWeight: 600 }}>
                {editingId ? 'Save Changes' : 'Create Category'}
              </button>
              {editingId && <button type="button" onClick={() => { setEditingId(null); setForm({ name: '', description: '' }); }} style={{ background: '#e2e8f0', color: '#1a365d', border: 'none', borderRadius: '8px', padding: '10px 16px', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>}
            </div>
          </div>
        </div>

        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0, color: '#1a365d' }}>Category List</h3>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search categories" style={{ padding: '9px 12px', minWidth: '220px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
          </div>

          {loading ? (
            <div style={{ padding: '20px 0', color: '#4a5568' }}>Loading categories...</div>
          ) : error ? (
            <div style={{ padding: '12px 14px', borderRadius: '8px', background: '#fff7ed', color: '#9a5b00', marginBottom: '12px' }}>{error}</div>
          ) : null}

          {filteredCategories.length === 0 ? (
            <div style={{ padding: '18px', borderRadius: '8px', background: '#fff', border: '1px dashed #cbd5e1', color: '#4a5568' }}>No categories found.</div>
          ) : (
            <div style={{ display: 'grid', gap: '12px' }}>
              {filteredCategories.map((category) => (
                <div key={category.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '14px 16px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 700, color: '#1a365d', fontSize: '1rem' }}>{category.name}</div>
                    <div style={{ color: '#4a5568', fontSize: '0.85rem' }}>{category.description || 'No description'}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <span style={{ background: '#e6fffa', color: '#0f766e', borderRadius: '999px', padding: '5px 10px', fontSize: '0.8rem', fontWeight: 600 }}>{category.assetCount || 0} assets</span>
                    <button type="button" onClick={() => startEdit(category)} style={{ background: '#edf2ff', color: '#2b6cb0', border: 'none', borderRadius: '8px', padding: '8px 12px', cursor: 'pointer' }}>Edit</button>
                    <button type="button" onClick={() => removeCategory(category.id)} style={{ background: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: '8px', padding: '8px 12px', cursor: 'pointer' }}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const AdminAssetLocations = () => {
  const [locations, setLocations] = useState([]);
  const [assets, setAssets] = useState([]);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ name: '', description: '' });
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [locationsResponse, assetsResponse] = await Promise.all([
        axios.get('/api/locations').catch(() => ({ data: { locations: [] } })),
        axios.get('/api/assets').catch(() => ({ data: { assets: [] } }))
      ]);

      const locationRows = normalizeListResponse(locationsResponse?.data ?? []);
      const assetRows = normalizeListResponse(assetsResponse?.data ?? []);
      const fallback = getAssetLocationFallback(assetRows);
      const merged = [...locationRows, ...fallback].reduce((accumulator, location) => {
        const key = String(location?.name || location?.location || '').trim() || 'Unassigned';
        if (!accumulator[key]) {
          accumulator[key] = { id: location?.id || `${key}-${Date.now()}`, name: key, description: location?.description || `Location for ${key}`, assetCount: 0 };
        }
        accumulator[key].assetCount += Number(location?.assetCount || 0);
        return accumulator;
      }, {});

      const finalRows = Object.values(merged).map((location) => ({
        ...location,
        assetCount: assetRows.filter((asset) => String(asset?.location || asset?.site || 'Unassigned').trim() === location.name).length || location.assetCount || 0
      }));

      setAssets(assetRows);
      setLocations(finalRows.sort((left, right) => left.name.localeCompare(right.name)));
    } catch (loadError) {
      const fallback = getAssetLocationFallback(assets);
      setLocations(fallback);
      setError('Location service is not available right now. Showing local location data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredLocations = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return locations;
    return locations.filter((location) => [location.name, location.description].some((value) => String(value || '').toLowerCase().includes(query)));
  }, [locations, search]);

  const saveLocation = () => {
    const name = form.name.trim();
    if (!name) return;

    if (editingId) {
      setLocations((previous) => previous.map((location) => location.id === editingId ? { ...location, name, description: form.description.trim() || location.description } : location));
    } else {
      setLocations((previous) => [{
        id: `local-${Date.now()}`,
        name,
        description: form.description.trim() || `${name} location`,
        assetCount: 0
      }, ...previous]);
    }

    setForm({ name: '', description: '' });
    setEditingId(null);
  };

  const removeLocation = (locationId) => {
    setLocations((previous) => previous.filter((location) => location.id !== locationId));
  };

  const startEdit = (location) => {
    setEditingId(location.id);
    setForm({ name: location.name, description: location.description || '' });
  };

  return (
    <div style={{ padding: '24px', background: '#ffffff', borderRadius: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ color: '#5a6b8a', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Admin / Assets</div>
          <h2 style={{ margin: '8px 0 0', color: '#1a365d', fontSize: '2rem' }}>📍 Locations</h2>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 360px) minmax(0, 1fr)', gap: '20px', marginBottom: '20px' }}>
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px' }}>
          <h3 style={{ margin: '0 0 16px', color: '#1a365d' }}>{editingId ? 'Edit Location' : 'Create Location'}</h3>
          <div style={{ display: 'grid', gap: '12px' }}>
            <input value={form.name} onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))} placeholder="Location name" style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
            <textarea value={form.description} onChange={(event) => setForm((previous) => ({ ...previous, description: event.target.value }))} placeholder="Location description" rows={4} style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', resize: 'vertical' }} />
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button type="button" onClick={saveLocation} style={{ background: '#2b6cb0', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 16px', cursor: 'pointer', fontWeight: 600 }}>
                {editingId ? 'Save Changes' : 'Create Location'}
              </button>
              {editingId && <button type="button" onClick={() => { setEditingId(null); setForm({ name: '', description: '' }); }} style={{ background: '#e2e8f0', color: '#1a365d', border: 'none', borderRadius: '8px', padding: '10px 16px', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>}
            </div>
          </div>
        </div>

        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0, color: '#1a365d' }}>Location List</h3>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search locations" style={{ padding: '9px 12px', minWidth: '220px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
          </div>

          {loading ? (
            <div style={{ padding: '20px 0', color: '#4a5568' }}>Loading locations...</div>
          ) : error ? (
            <div style={{ padding: '12px 14px', borderRadius: '8px', background: '#fff7ed', color: '#9a5b00', marginBottom: '12px' }}>{error}</div>
          ) : null}

          {filteredLocations.length === 0 ? (
            <div style={{ padding: '18px', borderRadius: '8px', background: '#fff', border: '1px dashed #cbd5e1', color: '#4a5568' }}>No locations found.</div>
          ) : (
            <div style={{ display: 'grid', gap: '12px' }}>
              {filteredLocations.map((location) => (
                <div key={location.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '14px 16px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 700, color: '#1a365d', fontSize: '1rem' }}>{location.name}</div>
                    <div style={{ color: '#4a5568', fontSize: '0.85rem' }}>{location.description || 'No description'}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <span style={{ background: '#ecfeff', color: '#0f766e', borderRadius: '999px', padding: '5px 10px', fontSize: '0.8rem', fontWeight: 600 }}>{location.assetCount || 0} assets</span>
                    <button type="button" onClick={() => startEdit(location)} style={{ background: '#edf2ff', color: '#2b6cb0', border: 'none', borderRadius: '8px', padding: '8px 12px', cursor: 'pointer' }}>Edit</button>
                    <button type="button" onClick={() => removeLocation(location.id)} style={{ background: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: '8px', padding: '8px 12px', cursor: 'pointer' }}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const AdminAssetLifecycle = () => {
  const [assets, setAssets] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAssets = async () => {
      setLoading(true);
      try {
        const response = await axios.get('/api/assets').catch(() => ({ data: { assets: [] } }));
        const rows = normalizeListResponse(response?.data ?? []);
        setAssets(rows);
      } catch (error) {
        setAssets([]);
      } finally {
        setLoading(false);
      }
    };
    loadAssets();
  }, []);

  const lifecycleStages = ['Purchased', 'Registered', 'Available', 'Assigned', 'Maintenance', 'Returned / Reassigned', 'Retired', 'Disposed'];

  const filteredAssets = useMemo(() => {
    const value = search.trim().toLowerCase();
    return assets.filter((asset) => {
      const matchesSearch = !value || [asset.name, asset.assetCode, asset.serialNumber, asset.location].some((field) => String(field || '').toLowerCase().includes(value));
      const matchesStatus = statusFilter === 'all' || String(asset.status || 'available').toLowerCase() === statusFilter.toLowerCase();
      return matchesSearch && matchesStatus;
    });
  }, [assets, search, statusFilter]);

  return (
    <div style={{ padding: '24px', background: '#ffffff', borderRadius: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ color: '#5a6b8a', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Admin / Assets</div>
          <h2 style={{ margin: '8px 0 0', color: '#1a365d', fontSize: '2rem' }}>🔄 Asset Lifecycle</h2>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search asset" style={{ padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', minWidth: '220px' }} />
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} style={{ padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px' }}>
          <option value="all">All statuses</option>
          <option value="available">Available</option>
          <option value="assigned">Assigned</option>
          <option value="maintenance">Maintenance</option>
          <option value="retired">Retired</option>
          <option value="disposed">Disposed</option>
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', marginBottom: '24px' }}>
        {lifecycleStages.map((stage, index) => (
          <div key={stage} style={{ border: '1px solid #dbeafe', background: index % 2 === 0 ? '#eff6ff' : '#f8fafc', borderRadius: '12px', padding: '12px 14px', color: '#1a365d', fontWeight: 600 }}>
            {index > 0 && '↓'}
            <div>{stage}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: '24px', color: '#4a5568' }}>Loading lifecycle data...</div>
      ) : filteredAssets.length === 0 ? (
        <div style={{ padding: '24px', borderRadius: '10px', background: '#f8fafc', border: '1px dashed #cbd5e1', color: '#4a5568' }}>No asset lifecycle records match your filter.</div>
      ) : (
        <div style={{ display: 'grid', gap: '14px' }}>
          {filteredAssets.map((asset) => {
            const currentStage = lifecycleStages.includes(String(asset.status || '').replace(/_/g, ' ')) ? String(asset.status || '').replace(/_/g, ' ') : 'Available';
            const currentIndex = lifecycleStages.indexOf(currentStage) === -1 ? 2 : lifecycleStages.indexOf(currentStage);
            return (
              <div key={asset.id} style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', background: '#f8fafc' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
                  <div>
                    <div style={{ fontWeight: 700, color: '#1a365d', fontSize: '1.1rem' }}>{asset.name || `Asset ${asset.assetCode || asset.id}`}</div>
                    <div style={{ color: '#4a5568', fontSize: '0.85rem' }}>{asset.assetCode || 'No asset code'} · {asset.location || 'No location'}</div>
                  </div>
                  <span style={{ background: '#e0f2fe', color: '#075985', borderRadius: '999px', padding: '6px 10px', fontWeight: 700 }}>{currentStage}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px' }}>
                  {lifecycleStages.map((stage, index) => (
                    <div key={`${asset.id}-${stage}`} style={{ borderRadius: '10px', padding: '8px 10px', background: index <= currentIndex ? '#d1fae5' : '#e2e8f0', color: index <= currentIndex ? '#065f46' : '#475569', fontWeight: 600, textAlign: 'center' }}>
                      {stage}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const AdminAssetDisposal = () => {
  const [assets, setAssets] = useState([]);
  const [requests, setRequests] = useState([]);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ assetId: '', reason: '', disposalDate: '', disposalValue: '0' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const response = await axios.get('/api/assets').catch(() => ({ data: { assets: [] } }));
        const rows = normalizeListResponse(response?.data ?? []);
        setAssets(rows);
        const generated = rows.slice(0, 4).map((asset, index) => ({
          id: `request-${asset.id || index}`,
          assetId: asset.id,
          assetName: asset.name || `Asset ${asset.assetCode || asset.id}`,
          reason: index % 2 === 0 ? 'End of useful life' : 'Replacement with newer equipment',
          status: index % 2 === 0 ? 'Approved' : 'Pending',
          disposalDate: new Date(Date.now() - index * 86400000).toISOString().slice(0, 10),
          disposalValue: Number(asset.currentValue || 0).toFixed(2),
        }));
        setRequests(generated.length ? generated : [{ id: 'placeholder-1', assetId: 'N/A', assetName: 'No active requests', reason: 'No retirement records found', status: 'No data', disposalDate: '', disposalValue: '0.00' }]);
      } catch (error) {
        setAssets([]);
        setRequests([{ id: 'placeholder-1', assetId: 'N/A', assetName: 'No active requests', reason: 'Service unavailable', status: 'No data', disposalDate: '', disposalValue: '0.00' }]);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const filteredRequests = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return requests;
    return requests.filter((request) => [request.assetName, request.reason, request.status].some((value) => String(value || '').toLowerCase().includes(query)));
  }, [requests, search]);

  const submitRequest = () => {
    if (!form.assetId || !form.reason.trim()) return;
    const selectedAsset = assets.find((asset) => String(asset.id) === String(form.assetId));
    const nextRequest = {
      id: `local-${Date.now()}`,
      assetId: form.assetId,
      assetName: selectedAsset?.name || `Asset ${form.assetId}`,
      reason: form.reason,
      status: 'Pending',
      disposalDate: form.disposalDate || new Date().toISOString().slice(0, 10),
      disposalValue: Number(form.disposalValue || 0).toFixed(2),
    };
    setRequests((previous) => [nextRequest, ...previous.filter((item) => item.id !== 'placeholder-1')]);
    setForm({ assetId: '', reason: '', disposalDate: '', disposalValue: '0' });
  };

  const updateStatus = (requestId, newStatus) => {
    setRequests((previous) => previous.map((request) => request.id === requestId ? { ...request, status: newStatus } : request));
  };

  return (
    <div style={{ padding: '24px', background: '#ffffff', borderRadius: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ color: '#5a6b8a', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Admin / Assets</div>
          <h2 style={{ margin: '8px 0 0', color: '#1a365d', fontSize: '2rem' }}>🗑️ Disposal / Retirement</h2>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 360px) minmax(0, 1fr)', gap: '20px', marginBottom: '20px' }}>
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px' }}>
          <h3 style={{ margin: '0 0 16px', color: '#1a365d' }}>Create Retirement Request</h3>
          <div style={{ display: 'grid', gap: '12px' }}>
            <select value={form.assetId} onChange={(event) => setForm((previous) => ({ ...previous, assetId: event.target.value }))} style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
              <option value="">Select asset</option>
              {assets.map((asset) => (
                <option key={asset.id} value={asset.id}>{asset.name || `Asset ${asset.assetCode || asset.id}`}</option>
              ))}
            </select>
            <textarea value={form.reason} onChange={(event) => setForm((previous) => ({ ...previous, reason: event.target.value }))} placeholder="Disposal reason" rows={4} style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', resize: 'vertical' }} />
            <input type="date" value={form.disposalDate} onChange={(event) => setForm((previous) => ({ ...previous, disposalDate: event.target.value }))} style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
            <input type="number" step="0.01" value={form.disposalValue} onChange={(event) => setForm((previous) => ({ ...previous, disposalValue: event.target.value }))} placeholder="Disposal value" style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
            <button type="button" onClick={submitRequest} style={{ background: '#2b6cb0', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 16px', cursor: 'pointer', fontWeight: 600 }}>Submit Request</button>
          </div>
        </div>

        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0, color: '#1a365d' }}>Disposal Requests</h3>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search requests" style={{ padding: '9px 12px', minWidth: '220px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
          </div>

          {loading ? (
            <div style={{ padding: '20px 0', color: '#4a5568' }}>Loading disposal records...</div>
          ) : filteredRequests.length === 0 ? (
            <div style={{ padding: '18px', borderRadius: '8px', background: '#fff', border: '1px dashed #cbd5e1', color: '#4a5568' }}>No disposal requests found.</div>
          ) : (
            <div style={{ display: 'grid', gap: '12px' }}>
              {filteredRequests.map((request) => (
                <div key={request.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontWeight: 700, color: '#1a365d' }}>{request.assetName}</div>
                      <div style={{ color: '#4a5568', fontSize: '0.85rem' }}>{request.reason}</div>
                    </div>
                    <span style={{ background: request.status === 'Approved' ? '#dcfce7' : request.status === 'Rejected' ? '#fee2e2' : '#fef3c7', color: request.status === 'Approved' ? '#166534' : request.status === 'Rejected' ? '#991b1b' : '#92400e', borderRadius: '999px', padding: '6px 10px', fontSize: '0.8rem', fontWeight: 700 }}>{request.status}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ color: '#4a5568', fontSize: '0.8rem' }}>Date: {request.disposalDate || 'Not set'}</div>
                    <div style={{ color: '#4a5568', fontSize: '0.8rem' }}>Value: ${Number(request.disposalValue || 0).toFixed(2)}</div>
                  </div>
                  {request.status !== 'Approved' && request.status !== 'Rejected' && request.status !== 'No data' && (
                    <div style={{ display: 'flex', gap: '10px', marginTop: '12px', flexWrap: 'wrap' }}>
                      <button type="button" onClick={() => updateStatus(request.id, 'Approved')} style={{ background: '#22c55e', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 12px', cursor: 'pointer' }}>Approve</button>
                      <button type="button" onClick={() => updateStatus(request.id, 'Rejected')} style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 12px', cursor: 'pointer' }}>Reject</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const AdminAssetDocuments = () => {
  const [documents, setDocuments] = useState([]);
  const [assets, setAssets] = useState([]);
  const [search, setSearch] = useState('');
  const [assetFilter, setAssetFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [assetsResponse] = await Promise.all([
          axios.get('/api/assets').catch(() => ({ data: { assets: [] } }))
        ]);
        const assetRows = normalizeListResponse(assetsResponse?.data ?? []);
        setAssets(assetRows);
        const seededDocuments = [
          { id: 1, assetId: assetRows[0]?.id || 1, assetName: assetRows[0]?.name || 'Sample Asset', name: 'Invoice - Asset 1.pdf', type: 'Invoice', uploadedAt: '2026-08-18', size: '245 KB' },
          { id: 2, assetId: assetRows[1]?.id || 2, assetName: assetRows[1]?.name || 'Sample Asset 2', name: 'Warranty - Asset 2.pdf', type: 'Warranty', uploadedAt: '2026-08-20', size: '184 KB' },
          { id: 3, assetId: assetRows[2]?.id || 3, assetName: assetRows[2]?.name || 'Sample Asset 3', name: 'Maintenance Review.pdf', type: 'Maintenance Document', uploadedAt: '2026-08-22', size: '315 KB' }
        ];
        setDocuments(seededDocuments);
      } catch (error) {
        setAssets([]);
        setDocuments([]);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const documentTypes = ['Invoice', 'Warranty', 'Purchase Document', 'Maintenance Document', 'Transfer Document', 'Assignment Document', 'Disposal Document', 'Other'];

  const filteredDocuments = useMemo(() => {
    const query = search.trim().toLowerCase();
    return documents.filter((document) => {
      const matchesSearch = !query || [document.name, document.type, document.assetName].some((value) => String(value || '').toLowerCase().includes(query));
      const matchesAsset = assetFilter === 'all' || String(document.assetId) === String(assetFilter);
      const matchesType = typeFilter === 'all' || document.type === typeFilter;
      return matchesSearch && matchesAsset && matchesType;
    });
  }, [documents, search, assetFilter, typeFilter]);

  const handleUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const selectedAsset = assets.find((asset) => String(asset.id) === String(assetFilter || assets[0]?.id));
    const newDocument = {
      id: `upload-${Date.now()}`,
      assetId: selectedAsset?.id || 1,
      assetName: selectedAsset?.name || 'Uploaded Asset',
      name: file.name,
      type: typeFilter === 'all' ? 'Other' : typeFilter,
      uploadedAt: new Date().toISOString().slice(0, 10),
      size: `${Math.max(1, Math.round(file.size / 1024))} KB`,
      file
    };
    setDocuments((previous) => [newDocument, ...previous]);
    event.target.value = '';
  };

  const removeDocument = (documentId) => {
    setDocuments((previous) => previous.filter((document) => document.id !== documentId));
  };

  const openDocument = (document) => {
    if (document.file && typeof URL !== 'undefined') {
      const url = URL.createObjectURL(document.file);
      window.open(url, '_blank');
      return;
    }
    alert(`Viewing document: ${document.name}`);
  };

  return (
    <div style={{ padding: '24px', background: '#ffffff', borderRadius: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ color: '#5a6b8a', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Admin / Assets</div>
          <h2 style={{ margin: '8px 0 0', color: '#1a365d', fontSize: '2rem' }}>📄 Asset Documents</h2>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 360px) minmax(0, 1fr)', gap: '20px', marginBottom: '20px' }}>
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px' }}>
          <h3 style={{ margin: '0 0 16px', color: '#1a365d' }}>Upload Document</h3>
          <div style={{ display: 'grid', gap: '12px' }}>
            <select value={assetFilter} onChange={(event) => setAssetFilter(event.target.value)} style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
              <option value="all">All assets</option>
              {assets.map((asset) => (
                <option key={asset.id} value={asset.id}>{asset.name || `Asset ${asset.assetCode || asset.id}`}</option>
              ))}
            </select>
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
              <option value="all">All document types</option>
              {documentTypes.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            <label style={{ border: '1px dashed #94a3b8', background: '#fff', borderRadius: '8px', padding: '14px 12px', cursor: 'pointer', fontWeight: 600, color: '#1a365d', textAlign: 'center' }}>
              <input type="file" onChange={handleUpload} style={{ display: 'none' }} />
              Upload file
            </label>
          </div>
        </div>

        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0, color: '#1a365d' }}>Document Library</h3>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search documents" style={{ padding: '9px 12px', minWidth: '220px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
          </div>

          {loading ? (
            <div style={{ padding: '20px 0', color: '#4a5568' }}>Loading documents...</div>
          ) : filteredDocuments.length === 0 ? (
            <div style={{ padding: '18px', borderRadius: '8px', background: '#fff', border: '1px dashed #cbd5e1', color: '#4a5568' }}>No documents found.</div>
          ) : (
            <div style={{ display: 'grid', gap: '12px' }}>
              {filteredDocuments.map((document) => (
                <div key={document.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontWeight: 700, color: '#1a365d' }}>{document.name}</div>
                      <div style={{ color: '#4a5568', fontSize: '0.85rem' }}>{document.assetName} · {document.type}</div>
                    </div>
                    <span style={{ background: '#e0f2fe', color: '#075985', borderRadius: '999px', padding: '6px 10px', fontSize: '0.78rem', fontWeight: 700 }}>{document.type}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', gap: '10px', flexWrap: 'wrap' }}>
                    <div style={{ color: '#4a5568', fontSize: '0.8rem' }}>{document.uploadedAt} · {document.size}</div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button type="button" onClick={() => openDocument(document)} style={{ background: '#edf2ff', color: '#2b6cb0', border: 'none', borderRadius: '8px', padding: '8px 12px', cursor: 'pointer' }}>View</button>
                      <button type="button" onClick={() => removeDocument(document.id)} style={{ background: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: '8px', padding: '8px 12px', cursor: 'pointer' }}>Delete</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const AdminComponentStub = ({ title = 'Section' }) => (
  <div style={{ padding: '24px', background: '#fff', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
    <h2 style={{ margin: '0 0 12px' }}>{title}</h2>
    <p style={{ margin: 0, color: '#4a5568' }}>This section is currently under development.</p>
  </div>
);

// ==========================================
// LAYOUT COMPONENT - Renders Outlet for nested routes
// ==========================================

const RoleLayout = () => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  return (
    <div style={{
      backgroundColor: isDark ? '#141e2d' : '#f0f5ff',
      color: isDark ? '#c8dcf5' : '#1a375d',
      padding: '30px',
      minHeight: 'calc(100vh - var(--header-height))'
    }}>
      <Suspense fallback={<LoadingFallback />}>
        <Outlet />
      </Suspense>
    </div>
  );
};

// Admin Layout with Sidebar
const AdminLayout = () => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div style={{
      display: 'flex',
      gap: 0,
      backgroundColor: isDark ? '#141e2d' : '#f0f5ff',
      minHeight: 'calc(100vh - var(--header-height))'
    }}>
      {/* Main Content */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        maxHeight: 'calc(100vh - var(--header-height))',
        padding: '30px',
        color: isDark ? '#c8dcf5' : '#1a375d'
      }}>
        <Suspense fallback={<LoadingFallback />}>
          <Outlet />
        </Suspense>
      </div>
    </div>
  );
};

// ==========================================
// APP CONTENT COMPONENT
// ==========================================

function AppContent() {
  const { user, logout, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [ethiopianTime, setEthiopianTime] = useState('');
  const { language, setLanguage } = useLanguage();
  const { theme, setTheme } = useTheme();
  const [logoError, setLogoError] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collegeManagementOpen, setCollegeManagementOpen] = useState(() => JSON.parse(localStorage.getItem('collegeManagementOpen') || 'true'));
  const [departmentManagementOpen, setDepartmentManagementOpen] = useState(() => JSON.parse(localStorage.getItem('departmentManagementOpen') || 'false'));
  const [departmentsNavOpen, setDepartmentsNavOpen] = useState(() => JSON.parse(localStorage.getItem('departmentsNavOpen') || (location.pathname.startsWith('/department') ? 'true' : 'false')));
  const [pendingPublicPath, setPendingPublicPath] = useState(null);
  const allowPublicNavigationRef = useRef(false);
  const logoutDestinationRef = useRef(null);

  const t = translations[language] || translations.en;

  const getRoleDisplay = (role) => {
    const normalizedRole = normalizeRole(role);
    const roleMap = {
      'admin': { emoji: '👑', label: 'Admin' },
      'ict_officer': { emoji: '💻', label: 'ICT Officer' },
      'college': { emoji: '🏫', label: 'College Manager' },
      'store_manager': { emoji: '🏪', label: 'Store Manager' },
      'finance': { emoji: '💰', label: 'Finance' },
      'maintenance': { emoji: '🔧', label: 'Maintenance' },
      'infrastructure': { emoji: '🏗️', label: 'Infrastructure' }
    };
    return roleMap[normalizedRole] || { emoji: '👤', label: normalizedRole ? normalizedRole.replace(/_/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase()) : 'User' };
  };

  useEffect(() => {
    document.body.className = theme;
  }, [theme]);

  useEffect(() => {
    const collegeManagementActive = ['/college', '/college/profile', '/college/staff', '/college/locations', '/college/assets', '/college/inventory', '/college/requests', '/college/approvals', '/college/assignments', '/college/transfers', '/college/returns', '/college/maintenance', '/college/rfid', '/college/reports', '/college/notifications', '/college/history'].includes(location.pathname);
    const departmentManagementActive = location.pathname.startsWith('/college/department');
    const departmentsActive = location.pathname.startsWith('/department');
    if (collegeManagementActive) setCollegeManagementOpen(true);
    if (departmentManagementActive) setDepartmentManagementOpen(true);
    if (departmentsActive) setDepartmentsNavOpen(true);
    localStorage.setItem('collegeManagementOpen', JSON.stringify(collegeManagementOpen));
    localStorage.setItem('departmentManagementOpen', JSON.stringify(departmentManagementOpen));
    localStorage.setItem('departmentsNavOpen', JSON.stringify(departmentsNavOpen));
  }, [location.pathname, collegeManagementOpen, departmentManagementOpen, departmentsNavOpen]);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);
      const ethiopiaTime = new Date(now.getTime() + (3 * 60 * 60 * 1000));
      setEthiopianTime(ethiopiaTime.toLocaleTimeString(language === 'en' ? 'en-US' : 'am-ET', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      }));
    }, 1000);
    return () => clearInterval(timer);
  }, [language]);

  const handleLogout = async () => {
    logoutDestinationRef.current = '/home';
    allowPublicNavigationRef.current = true;
    navigate('/home', { replace: true });
    await logout();
    navigate('/home', { replace: true });
  };

  const dashboardRoute = getDashboardRoute(user?.role);
  const publicPaths = ['/home', '/about', '/contact'];
  const requestPublicNavigation = (path, event) => {
    if (user) {
      event?.preventDefault();
      setPendingPublicPath(path);
    }
  };

  useEffect(() => {
    if (user && !publicPaths.includes(location.pathname)) {
      allowPublicNavigationRef.current = false;
    } else if (user && publicPaths.includes(location.pathname) && !allowPublicNavigationRef.current) {
      setPendingPublicPath(location.pathname);
      navigate(dashboardRoute, { replace: true });
    }
    if (!user && publicPaths.includes(location.pathname)) {
      logoutDestinationRef.current = null;
    }
  }, [dashboardRoute, location.pathname, navigate, user]);

  const handleLogoutToRequestedPage = async () => {
    const destination = pendingPublicPath || '/home';
    logoutDestinationRef.current = destination;
    allowPublicNavigationRef.current = true;
    setPendingPublicPath(null);
    navigate(destination, { replace: true });
    await logout();
    navigate(destination, { replace: true });
  };

  if (authLoading) {
    return <LoadingFallback />;
  }

  const toggleLanguage = () => setLanguage(prev => prev === 'en' ? 'am' : 'en');
  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  const handleLogoError = () => setLogoError(true);

  const themeStyles = {
    light: {
      headerBg: '#00b2ee',
      headerText: '#ffffff',
      footerBg: '#00b2ee',
      footerText: '#ffffff',
      mainBg: '#f7f9fc',
      mainText: '#17305f',
      cardBg: '#ffffff',
      cardBorder: '#d9e2f2',
      cardShadow: '0 4px 12px rgba(40, 100, 232, 0.1)',
      sidebarBg: '#00b2ee',
      sidebarHover: '#009bd1',
      accent: '#2864E8',
      accentLight: '#eaf0ff',
      subText: '#4a5568',
      danger: '#e53e3e',
      success: '#48bb78'
    },
    dark: {
      headerBg: '#00b2ee',
      headerText: '#ffffff',
      footerBg: '#00b2ee',
      footerText: '#ffffff',
      mainBg: '#eef3fb',
      mainText: '#17305f',
      cardBg: '#ffffff',
      cardBorder: '#c8d5ea',
      cardShadow: '0 4px 12px rgba(23, 48, 95, 0.14)',
      sidebarBg: '#00b2ee',
      sidebarHover: '#009bd1',
      accent: '#2864E8',
      accentLight: '#dce7ff',
      subText: '#a0aec0',
      danger: '#fc8181',
      success: '#48bb78'
    }
  };

  const currentTheme = themeStyles[theme];

  // ==========================================
  // HEADER COMPONENT
  // ==========================================

  const HeaderLink = ({ to, children }) => (
    <Link to={to} onClick={(event) => requestPublicNavigation(to, event)} style={{ color: 'white', textDecoration: 'none', fontWeight: 600, opacity: 0.95, cursor: 'pointer' }}>
      {children}
    </Link>
  );

  const Header = () => (
    <header className={`app-header${!user ? ' public-site-header sticky top-0 z-50' : ''}`} style={{
      background: currentTheme.headerBg,
      color: currentTheme.headerText,
      padding: '0.75rem 2rem',
      borderBottom: '3px solid #ffdd57',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: '10px',
      width: '100%',
      boxSizing: 'border-box',
      boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
        <div style={{
          width: '55px',
          height: '55px',
          borderRadius: '8px',
          border: '2px solid #ffdd57',
          background: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          flexShrink: 0,
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
        }}>
          {!logoError ? (
            <img 
              src={UNIVERSITY_LOGO}
              alt="Mekdela Amba University"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              onError={handleLogoError}
            />
          ) : (
            <span style={{ fontSize: '1.5rem' }}>🏫</span>
          )}
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, letterSpacing: '0.25px', textShadow: '0 1px 2px rgba(0,0,0,0.25)' }}>
            {t.university}
          </h1>
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#ffffff', opacity: 0.9, fontWeight: 500 }}>
            {t.systemName}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
        <nav style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <HeaderLink to="/home">{t.home}</HeaderLink>
          <HeaderLink to="/about">{t.about}</HeaderLink>
          <HeaderLink to="/contact">{t.contact}</HeaderLink>
        </nav>

        <div style={{ fontSize: '0.85rem', textAlign: 'right', color: '#ffffff', fontFamily: 'monospace', fontWeight: 600 }}>
          <div>{currentTime.toLocaleTimeString()}</div>
          <div>🇪🇹 {ethiopianTime}</div>
        </div>

        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#fff',
              border: '2px solid rgba(255,255,255,0.15)',
              flexShrink: 0
            }}>
              <div style={{ fontWeight: 800, color: '#2b6cb0', fontSize: '0.9rem' }}>
                {(user.username || 'U').split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', color: 'white', lineHeight: 1.1 }}>
              <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{user.username}</div>
              <div style={{ fontSize: '0.6rem', opacity: 0.8, textTransform: 'capitalize' }}>{user.role}</div>
            </div>
          </div>
        ) : (
          <Link className="public-login-button" to="/login" style={{
            background: '#09dfe5',
            color: '#073b4c',
            textDecoration: 'none',
            padding: '7px 16px',
            borderRadius: 20,
            fontWeight: 700,
            fontSize: '0.9rem',
            transition: '0.2s'
          }}
          onMouseEnter={e => e.target.style.background = '#64f3f5'}
          onMouseLeave={e => e.target.style.background = '#09dfe5'}>
            🔐 {t.login}
          </Link>
        )}

        <button onClick={toggleLanguage} style={{
          background: 'rgba(0,0,0,0.3)',
          border: '1px solid #ffdd57',
          padding: '4px 10px',
          borderRadius: '5px',
          cursor: 'pointer',
          color: 'white',
          fontSize: '0.8rem',
          fontWeight: 600
        }}>
          {language === 'en' ? 'አማ' : 'EN'}
        </button>

        <button onClick={toggleTheme} style={{
          background: 'rgba(0,0,0,0.3)',
          border: '1px solid #ffdd57',
          padding: '4px 10px',
          borderRadius: '5px',
          cursor: 'pointer',
          color: 'white',
          fontSize: '0.9rem'
        }}>
          {theme === 'light' ? '🌙' : '☀️'}
        </button>
      </div>
    </header>
  );

  // ==========================================
  // FOOTER COMPONENT
  // ==========================================

  const Footer = () => (
    <footer className={`app-footer${!user ? ' public-site-footer bg-sky-900' : ''}`} style={{ 
      backgroundColor: '#00b2ee',
      color: '#ffffff',
      padding: '30px 20px 15px',
      borderTop: '1px solid rgba(255,255,255,0.1)',
      marginTop: 'auto'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '30px',
        marginBottom: '20px'
      }}>
        <div>
          <h4 style={{ color: 'white', marginBottom: '12px', fontSize: '1rem' }}>{t.companyName}</h4>
          <p style={{ opacity: 0.8, fontSize: '0.9rem', lineHeight: '1.6' }}>{t.systemName}</p>
          <div style={{ marginTop: '10px' }}><span style={{ opacity: 0.6, fontSize: '0.8rem' }}>🔒 256-bit SSL Secured</span></div>
          {!user && <div className="flex items-center gap-2" style={{ marginTop: '16px' }} aria-label="Social media links">
            <a href="https://github.com" target="_blank" rel="noreferrer" aria-label="GitHub" style={{ color: 'white', opacity: 0.8 }}><Github size={18} /></a>
            <a href="https://linkedin.com" target="_blank" rel="noreferrer" aria-label="LinkedIn" style={{ color: 'white', opacity: 0.8 }}><Linkedin size={18} /></a>
          </div>}
        </div>
        <div>
          <h4 style={{ color: 'white', marginBottom: '12px', fontSize: '1rem' }}>Quick Links</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <Link to="/home" onClick={(event) => requestPublicNavigation('/home', event)} style={{ color: currentTheme.footerText, textDecoration: 'none', opacity: 0.8, fontSize: '0.9rem' }}>{t.home}</Link>
            <Link to="/about" onClick={(event) => requestPublicNavigation('/about', event)} style={{ color: currentTheme.footerText, textDecoration: 'none', opacity: 0.8, fontSize: '0.9rem' }}>{t.about}</Link>
            <Link to="/contact" onClick={(event) => requestPublicNavigation('/contact', event)} style={{ color: currentTheme.footerText, textDecoration: 'none', opacity: 0.8, fontSize: '0.9rem' }}>{t.contact}</Link>
            <Link to="/login" style={{ color: currentTheme.footerText, textDecoration: 'none', opacity: 0.8, fontSize: '0.9rem' }}>{t.login}</Link>
          </div>
        </div>
        <div>
          <h4 style={{ color: 'white', marginBottom: '12px', fontSize: '1rem' }}>Contact Info</h4>
          <div style={{ opacity: 0.8, fontSize: '0.9rem', lineHeight: '1.8' }}>
            <div>📧 {t.email}</div>
            <div>📞 {t.phone}</div>
            <div>📍 {t.address}</div>
            <div>🕐 {t.workingHours}</div>
          </div>
        </div>
        <div>
          <h4 style={{ color: 'white', marginBottom: '12px', fontSize: '1rem' }}>System Status</h4>
          <div style={{ opacity: 0.8, fontSize: '0.9rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#48bb78', display: 'inline-block', animation: 'pulse 2s infinite' }}></span>
              All Systems Operational
            </div>
            <div>Version: v2.4.1</div>
            <div>Last Updated: 2026-01-15</div>
          </div>
        </div>
      </div>
      <div style={{
        borderTop: '1px solid rgba(255,255,255,0.1)',
        backgroundColor: user ? '#1f50c4' : '#075985',
        padding: '15px 20px 0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '10px'
      }}>
        <span style={{ opacity: 0.7, fontSize: '0.8rem' }}>{t.footer}</span>
        <div style={{ display: 'flex', gap: '15px', opacity: 0.7, fontSize: '0.8rem' }}>
          <Link to="/home" style={{ color: currentTheme.footerText, textDecoration: 'none' }}>{t.privacyPolicy}</Link>
          <Link to="/about" style={{ color: currentTheme.footerText, textDecoration: 'none' }}>{t.termsOfService}</Link>
          <Link to="/contact" style={{ color: currentTheme.footerText, textDecoration: 'none' }}>{t.cookiePolicy}</Link>
        </div>
      </div>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </footer>
  );

  // ==========================================
  // NAVIGATION LINK STYLE
  // ==========================================

  const navLinkStyle = () => ({
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 20px',
    textDecoration: 'none',
    color: currentTheme.mainText,
    borderLeft: '3px solid transparent',
    transition: 'all 0.2s ease',
    borderRadius: '0 8px 8px 0'
  });

  // ==========================================
  // GET DASHBOARD ROUTE BASED ON ROLE
  // ==========================================

  // ==========================================
  // PUBLIC ROUTES
  // ==========================================

  if (!user) {
    return (
      <>
        <Header />
        <div className="app-public-content" style={{ minHeight: 'calc(100vh - 200px)', backgroundColor: currentTheme.mainBg, padding: '20px' }}>
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              <Route path="/" element={<Navigate to="/login" />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password/:token" element={<ResetPassword />} />
              <Route path="/home" element={<Home />} />
              <Route path="/about" element={<AboutUs />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/ict/*" element={<Navigate to="/login" replace />} />
              <Route path="*" element={<Navigate to={logoutDestinationRef.current || '/login'} replace />} />
            </Routes>
          </Suspense>
        </div>
        <Footer />
        <ToastContainer position="top-right" autoClose={3000} />
      </>
    );
  }

  // ==========================================
  // SIDEBAR ITEMS BASED ON ROLE
  // ==========================================

  const getSidebarItems = (role) => {
    const normalizedRole = normalizeRole(role);
    const items = {
      'admin': [
        { path: '/admin', label: t.dashboard, icon: LayoutDashboard, group: 'Overview' },
        { path: '/admin/assets', label: t.assets, icon: Package, group: 'Asset Management' },
        { path: '/admin/assets/assign', label: 'Asset Assignment', icon: ClipboardList, group: 'Asset Management' },
        { path: '/admin/assets/transfer', label: 'Asset Transfer', icon: ArrowLeftRight, group: 'Asset Management' },
        { path: '/admin/maintenance', label: t.maintenance, icon: Wrench, group: 'Asset Management' },
        { path: '/admin/rfid', label: t.rfidTracking, icon: Radio, group: 'Asset Management' },
        { path: '/admin/reports', label: t.reports, icon: BarChart3, group: 'Analytics' },
        { path: '/admin/users', label: t.users, icon: Users, group: 'Organization' },
        { path: '/admin/departments', label: t.departmentManagement, icon: Building2, group: 'Organization' },
        { path: '/admin/settings', label: t.settings, icon: Settings, group: 'System' },
        { path: '/admin/notifications', label: t.notifications, icon: Bell, group: 'System' },
        { path: '/admin/backup', label: t.backup, icon: DatabaseBackup, group: 'System' },
        { path: '/admin/audit-logs', label: 'Audit Logs', icon: ClipboardCheck, group: 'System' }
      ],
      'ict_officer': [
        { path: '/ict', label: '📊 ' + t.dashboard },
        { path: '/ict/assets', label: '📦 ' + t.assets },
        { path: '/ict/assets/create', label: '➕ ' + t.createAsset },
        { path: '/ict/assets/assign', label: '� ' + t.assignments },
        { path: '/ict/maintenance', label: '🔧 ' + t.maintenance },
        { path: '/ict/rfid', label: '📡 ' + t.rfidTracking },
        { path: '/ict/reports', label: '📊 ' + t.reports },
        { path: '/ict/inventory', label: '📋 ' + t.inventory },
        { path: '/ict/requests', label: '📝 Asset Requests' },
        { path: '/ict/equipment', label: '💻 IT Equipment' },
        { path: '/ict/network', label: '🌐 Network / Technical' },
        { path: '/ict/support', label: '🛠️ Technical Support' },
        { path: '/ict/notifications', label: '🔔 ' + t.notifications },
        { path: '/ict/assets/history', label: '📜 Asset History' }
      ],
      'college': [
        { path: '/college', label: '📊 ' + t.dashboard },
        { path: '/college/profile', label: '🏢 College Profile' },
        { path: '/college/departments', label: '🏫 Departments' },
        { path: '/college/staff', label: '👥 ' + t.staff },
        { path: '/college/locations', label: '📍 Locations' },
        { path: '/college/assets', label: '📦 ' + t.assets },
        { path: '/college/inventory', label: '📋 ' + t.inventory },
        { path: '/college/requests', label: '📝 Asset Requests' },
        { path: '/college/approvals', label: '✅ Approvals' },
        { path: '/college/assignments', label: '👤 Assignments' },
        { path: '/college/transfers', label: '🔄 Transfers' },
        { path: '/college/returns', label: '↩️ Returns' },
        { path: '/college/maintenance', label: '🔧 ' + t.maintenance },
        { path: '/college/rfid', label: '📡 RFID / QR Tracking' },
        { path: '/college/reports', label: '📊 ' + t.reports },
        { path: '/college/notifications', label: '🔔 ' + t.notifications },
        { path: '/college/history', label: '📜 Audit & History' }
      ],
      'staff': [],
      'finance': [
        { path: '/finance', label: '📊 ' + t.dashboard },
        { path: '/finance/purchases', label: '🛒 Purchase Management' },
        { path: '/finance/invoices', label: '🧾 Invoice Management' },
        { path: '/finance/payments', label: '💳 Payment Management' },
        { path: '/finance/budget', label: '🏦 Budget Management' },
        { path: '/finance/assets', label: '📦 ' + t.valuation },
        { path: '/finance/depreciation', label: '💰 ' + t.depreciation },
        { path: '/finance/suppliers', label: '🤝 Suppliers' },
        { path: '/finance/reports', label: '📊 ' + t.financial },
        { path: '/finance/transactions', label: '🧾 Transactions' },
        { path: '/finance/audit', label: '📋 ' + t.audit },
        { path: '/finance/notifications', label: '🔔 ' + t.notifications }
      ],
      'store_manager': [
        { path: '/store', label: '📊 ' + t.dashboard },
        { path: '/store/inventory', label: '� ' + t.inventory },
        { path: '/store/assets', label: '📦 ' + t.assets },
        { path: '/store/receive', label: '📥 Receive Assets' },
        { path: '/store/issue', label: '📤 Issue Assets' },
        { path: '/store/returns', label: '↩️ Returns' },
        { path: '/store/transfers', label: '🔄 Transfers' },
        { path: '/store/requests', label: '📝 Asset Requests' },
        { path: '/store/tracking', label: '📡 RFID / QR Tracking' },
        { path: '/store/maintenance', label: '🔧 Maintenance' },
        { path: '/store/warranty', label: '🛡️ Warranty' },
        { path: '/store/reports', label: '📊 ' + t.reports },
        { path: '/store/notifications', label: '🔔 ' + t.notifications },
        { path: '/store/history', label: '📜 Asset History' }
      ],
      'maintenance': [
        { path: '/maintenance', label: '📊 ' + t.dashboard },
        { path: '/maintenance/requests', label: '🔧 ' + t.requests },
        { path: '/maintenance/inspection', label: '🔍 Asset Inspection' },
        { path: '/maintenance/work-orders', label: '📋 Work Orders' },
        { path: '/maintenance/repairs', label: '🛠️ Repairs' },
        { path: '/maintenance/preventive', label: '📅 Preventive Maintenance' },
        { path: '/maintenance/technicians', label: '👨‍🔧 Technicians' },
        { path: '/maintenance/spare-parts', label: '🧰 Spare Parts' },
        { path: '/maintenance/assets-under-maintenance', label: '📦 Assets Under Maintenance' },
        { path: '/maintenance/testing-quality', label: '🧪 Testing & Quality' },
        { path: '/maintenance/assigned-tasks', label: '📋 ' + t.assigned },
        { path: '/maintenance/history', label: '📜 ' + t.history },
        { path: '/maintenance/reports', label: '📊 ' + t.reports }
      ],
      'infrastructure': [
        { path: '/infrastructure', label: '📊 ' + t.dashboard, group: 'Overview' },
        { path: '/infrastructure/assets', label: '🏢 Infrastructure Assets', group: 'Asset Management' },
        { path: '/infrastructure/assets/register', label: '➕ Register Asset', group: 'Asset Management' },
        { path: '/infrastructure/buildings', label: '🏛️ Buildings & Facilities', group: 'Infrastructure' },
        { path: '/infrastructure/electrical', label: '⚡ Electrical Systems', group: 'Infrastructure' },
        { path: '/infrastructure/generators', label: '🔋 Generators', group: 'Power Systems' },
        { path: '/infrastructure/transformers', label: '🔌 Transformers', group: 'Power Systems' },
        { path: '/infrastructure/ups', label: '🔋 UPS / Inverters', group: 'Power Systems' },
        { path: '/infrastructure/solar', label: '☀️ Solar Energy', group: 'Power Systems' },
        { path: '/infrastructure/water', label: '💧 Water Systems', group: 'Infrastructure' },
        { path: '/infrastructure/roads', label: '🛣️ Roads & Drainage', group: 'Infrastructure' },
        { path: '/infrastructure/maintenance', label: '🔧 Facility Maintenance', group: 'Operations' },
        { path: '/infrastructure/work-orders', label: '📋 Work Orders', group: 'Operations' },
        { path: '/infrastructure/preventive', label: '📅 Preventive Maintenance', group: 'Operations' },
        { path: '/infrastructure/spare-parts', label: '🧰 Spare Parts', group: 'Inventory' },
        { path: '/infrastructure/energy', label: '⚡ Energy Management', group: 'Monitoring' },
        { path: '/infrastructure/fuel', label: '⛽ Fuel Management', group: 'Inventory' },
        { path: '/infrastructure/inspection', label: '🔍 Inspection & Condition', group: 'Monitoring' },
        { path: '/infrastructure/tracking', label: '📡 RFID / QR Tracking', group: 'Monitoring' },
        { path: '/infrastructure/requests', label: '📝 Requests', group: 'Management' },
        { path: '/infrastructure/reports', label: '📊 Reports & Analytics', group: 'Analytics' },
        { path: '/infrastructure/documents', label: '📄 Documents', group: 'Management' },
        { path: '/infrastructure/notifications', label: '🔔 Notifications', group: 'Management' },
        { path: '/infrastructure/audit', label: '📜 Audit & History', group: 'Management' }
      ]
    };
    return items[normalizedRole] || items['admin'];
  };

  const sidebarRole = normalizeRole(user?.role || user?.roles);
  const isStoreManager = sidebarRole === 'store_manager';
  const sidebarItems = getSidebarItems(sidebarRole);
  const responsibility = String(user?.departmentRole || user?.responsibility || user?.position || '').trim().toLowerCase().replace(/[_-]+/g, ' ');
  const isDepartmentStaff = sidebarRole === 'staff' || responsibility === 'department staff';
  const isDepartmentDean = responsibility === 'department dean' || responsibility === 'dean';
  const showCollegeNavigation = sidebarRole === 'college' && !isDepartmentStaff && !isDepartmentDean;
  const showDepartmentsNavigation = isDepartmentStaff || isDepartmentDean;
  const collegeManagementItems = [
    { path: '/college', label: '📊 Dashboard', icon: LayoutDashboard },
    { path: '/college/profile', label: '🏢 College Profile', icon: Building2 },
    { path: '/college/staff', label: '👥 Staff', icon: Users },
    { path: '/college/locations', label: '📍 Locations', icon: Building2 },
    { path: '/college/assets', label: '📦 Assets', icon: Package },
    { path: '/college/inventory', label: '📋 Inventory', icon: ClipboardList },
    { path: '/college/requests', label: '📝 Asset Requests', icon: ClipboardList },
    { path: '/college/approvals', label: '✅ Approvals', icon: ClipboardCheck },
    { path: '/college/assignments', label: '👤 Assignments', icon: Users },
    { path: '/college/transfers', label: '🔄 Transfers', icon: ArrowLeftRight },
    { path: '/college/returns', label: '↩️ Returns', icon: ArrowLeftRight },
    { path: '/college/maintenance', label: '🔧 Maintenance', icon: Wrench },
    { path: '/college/rfid', label: '📡 RFID / QR Tracking', icon: Radio },
    { path: '/college/reports', label: '📊 Reports', icon: BarChart3 },
    { path: '/college/notifications', label: '🔔 Notifications', icon: Bell },
    { path: '/college/history', label: '📜 Audit & History', icon: ClipboardCheck }
  ];
  const departmentManagementItems = [
    { path: '/college/departments', label: 'Departments', icon: Building2 },
    { path: '/college/department-deans', label: 'Department Deans', icon: Users },
    { path: '/college/department-staff', label: 'Department Staff', icon: Users },
    { path: '/college/department-assets', label: 'Department Assets', icon: Package },
    { path: '/college/department-requests', label: 'Department Requests', icon: ClipboardList },
    { path: '/college/department-approvals', label: 'Department Approvals', icon: ClipboardCheck },
    { path: '/college/department-assignments', label: 'Department Assignments', icon: Users },
    { path: '/college/department-transfers', label: 'Department Transfers', icon: ArrowLeftRight },
    { path: '/college/department-returns', label: 'Department Returns', icon: ArrowLeftRight },
    { path: '/college/department-maintenance', label: 'Department Maintenance', icon: Wrench },
    { path: '/college/department-reports', label: 'Department Reports', icon: BarChart3 },
    { path: '/college/department-history', label: 'Department History', icon: ClipboardCheck }
  ];
  const departmentDeanItems = [
    { path: '/department', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/department/profile', label: 'Department Profile', icon: Users },
    { path: '/department/staff', label: 'Staff', icon: Users },
    { path: '/department/assets', label: 'Assets', icon: Package },
    { path: '/department/requests', label: 'Asset Requests', icon: ClipboardList },
    { path: '/department/approvals', label: 'Approvals', icon: ClipboardCheck },
    { path: '/department/assignments', label: 'Assignments', icon: ClipboardList },
    { path: '/department/transfers', label: 'Transfers', icon: ArrowLeftRight },
    { path: '/department/returns', label: 'Returns', icon: ArrowLeftRight },
    { path: '/department/maintenance', label: 'Maintenance', icon: Wrench },
    { path: '/department/reports', label: 'Reports', icon: BarChart3 },
    { path: '/department/history', label: 'History', icon: ClipboardCheck }
  ];
  const departmentStaffItems = [
    { path: '/department', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/department/profile', label: 'My Profile', icon: Users },
    { path: '/department/assets', label: 'My Assets', icon: Package },
    { path: '/department/requests', label: 'Asset Requests', icon: ClipboardList },
    { path: '/department/assignments', label: 'Assigned Assets', icon: ClipboardList },
    { path: '/department/returns', label: 'Asset Returns', icon: ArrowLeftRight },
    { path: '/department/maintenance', label: 'Maintenance Requests', icon: Wrench },
    { path: '/department/notifications', label: 'Notifications', icon: Bell },
    { path: '/department/history', label: 'Asset History', icon: ClipboardCheck }
  ];
  const navigationItems = [...sidebarItems, ...(isDepartmentDean ? departmentDeanItems : isDepartmentStaff ? departmentStaffItems : [])];
  const currentActiveSidebar = [...navigationItems]
    .sort((left, right) => right.path.length - left.path.length)
    .find((item) => location.pathname === item.path || location.pathname.startsWith(`${item.path}/`))?.path
    || getDashboardRoute(user?.role);

  const renderSidebarLink = (item, nested = false) => {
    const isActive = item.path === currentActiveSidebar;
    const Icon = item.icon || LayoutDashboard;
    return (
      <Link
        key={item.path}
        to={item.path}
        className={`admin-nav-link${isActive ? ' is-active' : ''}`}
        aria-current={isActive ? 'page' : undefined}
        onClick={() => setSidebarOpen(false)}
        style={nested ? { paddingLeft: '34px', fontSize: '0.86rem' } : undefined}
      >
        <Icon size={17} strokeWidth={1.9} aria-hidden="true" />
        <span>{item.label.replace(/^[^\w]+\s*/, '')}</span>
      </Link>
    );
  };

  const renderCollapsibleSection = (label, open, setOpen, children, sectionKey) => (
    <div className="sidebar-collapsible-section" key={sectionKey}>
      <button
        type="button"
        className="sidebar-section-toggle"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {open ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
        <span>{label}</span>
      </button>
      <div className={`sidebar-section-children${open ? ' is-expanded' : ''}`} aria-hidden={!open}>
        {open && children}
      </div>
    </div>
  );

  // ==========================================
  // AUTHENTICATED ROUTES - FIXED!
  // ==========================================

  return (
    <div className="App" style={{ backgroundColor: currentTheme.mainBg, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <button className="mobile-sidebar-toggle" type="button" onClick={() => setSidebarOpen(true)} aria-label="Open navigation menu"><Menu size={20} /></button>
      {sidebarOpen && <button className="sidebar-backdrop is-visible" type="button" onClick={() => setSidebarOpen(false)} aria-label="Close navigation menu" />}
      <div className={`authenticated-shell${isStoreManager ? ' store-manager-body' : ''}`}>
        <aside className={`admin-sidebar${isStoreManager ? ' store-manager-sidebar' : ''}${sidebarOpen ? ' is-open' : ''}`} style={{
          backgroundColor: currentTheme.sidebarBg,
          borderRight: `1px solid ${currentTheme.cardBorder}`,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0
        }}>
          <div className="admin-sidebar-profile">
            <button className="sidebar-close" type="button" onClick={() => setSidebarOpen(false)} aria-label="Close navigation menu"><X size={18} /></button>
            <div className="sidebar-avatar" aria-hidden="true">{(user.fullName || user.username || 'A').charAt(0).toUpperCase()}</div>
            <div className="sidebar-user-name">{user.fullName || user.username || 'Admin'}</div>
            <div className="sidebar-role">{getRoleDisplay(sidebarRole).label}</div>
            <div className="sidebar-organization">{user.department ? getDepartmentLabel(user.department) : 'Administration'}</div>
            <div className="sidebar-status"><span /> Online</div>
          </div>

          <nav className="admin-sidebar-nav" aria-label="Application navigation">
            {showCollegeNavigation && <div className="sidebar-subsection-label">COLLEGE MANAGER</div>}
            {showCollegeNavigation && renderCollapsibleSection(
              'COLLEGE MANAGEMENT', collegeManagementOpen, setCollegeManagementOpen,
              collegeManagementItems.map((item) => renderSidebarLink(item, true)), 'college-management'
            )}
            {showCollegeNavigation && renderCollapsibleSection(
              'DEPARTMENT MANAGEMENT', departmentManagementOpen, setDepartmentManagementOpen,
              departmentManagementItems.map((item) => renderSidebarLink(item, true)), 'department-management'
            )}
            {showDepartmentsNavigation && renderCollapsibleSection(
              'DEPARTMENTS',
              departmentsNavOpen,
              setDepartmentsNavOpen,
              isDepartmentDean
                ? <><div className="sidebar-subsection-label">Department Dean</div>{departmentDeanItems.map((item) => renderSidebarLink(item, true))}</>
                : isDepartmentStaff
                  ? <><div className="sidebar-subsection-label">Department Staff</div>{departmentStaffItems.map((item) => renderSidebarLink(item, true))}</>
                  : <><div className="sidebar-subsection-label">Department Management</div>{renderSidebarLink({ path: '/college/departments', label: 'Departments', icon: Building2 }, true)}</>,
              'departments'
            )}
            {!showCollegeNavigation && !showDepartmentsNavigation && sidebarItems.map((item, index) => {
              const previousItem = sidebarItems[index - 1];
              return (
                <React.Fragment key={item.path}>
                  {sidebarRole === 'admin' && item.group !== previousItem?.group && <div className="sidebar-section-label">{item.group}</div>}
                  {renderSidebarLink(item)}
                </React.Fragment>
              );
            })}
          </nav>

          <div className="admin-sidebar-footer">
            <div className="sidebar-account"><div className="sidebar-account-avatar">{(user.fullName || user.username || 'A').charAt(0).toUpperCase()}</div><div><strong>{user.username || 'Admin'}</strong><span>System Administrator</span></div></div>
            <button className="sidebar-logout" type="button" onClick={handleLogout}><LogOut size={16} aria-hidden="true" /> {t.logout}</button>
          </div>
        </aside>

        {/* MAIN CONTENT WITH FIXED ROUTES */}
        <main className={`admin-main-content app-main-content${isStoreManager ? ' store-manager-main' : ''}`}>
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              {/* Public Routes */}
              <Route path="/home" element={<Home />} />
              <Route path="/about" element={<AboutUs />} />
              <Route path="/contact" element={<Contact />} />

              {/* ADMIN ROUTES - Fixed with AdminLayout */}
              <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><AdminLayout /></ProtectedRoute>}>
                <Route index element={<AdminDashboard />} />
                <Route path="dashboard" element={<AdminDashboard />} />
                
                {/* Asset Management */}
                <Route path="assets" element={<AdminAssets />} />
                <Route path="assets/create" element={<AssetCreate />} />
                <Route path="assets/:id" element={<AssetDetails />} />
                <Route path="assets/categories" element={<AdminAssetCategories />} />
                <Route path="assets/locations" element={<AdminAssetLocations />} />
                <Route path="assets/lifecycle" element={<AdminComponentStub title="Asset Lifecycle" />} />
                <Route path="assets/disposal" element={<AdminComponentStub title="Disposal/Retirement" />} />
                <Route path="assets/documents" element={<AdminComponentStub title="Asset Documents" />} />
                
                {/* Asset Assignment */}
                <Route path="assets/assign" element={<AdminAssignment />} />
                <Route path="assignment/assigned" element={<AdminComponentStub title="Assigned Assets" />} />
                <Route path="assignment/returns" element={<AdminComponentStub title="Asset Returns" />} />
                <Route path="assignment/history" element={<AdminComponentStub title="Assignment History" />} />
                
                {/* Asset Transfer */}
                <Route path="assets/transfer" element={<AdminTransfer />} />
                <Route path="transfer/pending" element={<AdminComponentStub title="Pending Transfers" />} />
                <Route path="transfer/approved" element={<AdminComponentStub title="Approved Transfers" />} />
                <Route path="transfer/history" element={<AdminComponentStub title="Transfer History" />} />
                
                {/* Inventory */}
                <Route path="inventory/available" element={<AdminComponentStub title="Available Assets" />} />
                <Route path="inventory/overview" element={<AdminComponentStub title="Stock Overview" />} />
                <Route path="inventory/movement" element={<AdminComponentStub title="Stock Movement" />} />
                <Route path="inventory/history" element={<AdminComponentStub title="Inventory History" />} />
                
                {/* RFID/QR Tracking */}
                <Route path="rfid" element={<AdminRFIDTracking />} />
                <Route path="rfid/qr" element={<AdminComponentStub title="QR/Barcode Management" />} />
                <Route path="rfid/register" element={<AdminComponentStub title="Register RFID/QR" />} />
                <Route path="rfid/activity" element={<AdminComponentStub title="Scan Activity" />} />
                <Route path="rfid/history" element={<AdminComponentStub title="Tracking History" />} />
                
                {/* Maintenance */}
                <Route path="maintenance" element={<AdminMaintenance />} />
                <Route path="maintenance/requests" element={<AdminComponentStub title="Maintenance Requests" />} />
                <Route path="maintenance/scheduled" element={<AdminComponentStub title="Scheduled Maintenance" />} />
                <Route path="maintenance/pending" element={<AdminComponentStub title="Pending Maintenance" />} />
                <Route path="maintenance/inprogress" element={<AdminComponentStub title="In Progress" />} />
                <Route path="maintenance/completed" element={<AdminComponentStub title="Completed Maintenance" />} />
                <Route path="maintenance/technicians" element={<AdminComponentStub title="Technicians" />} />
                <Route path="maintenance/history" element={<AdminComponentStub title="Maintenance History" />} />
                
                {/* Warranty */}
                <Route path="warranty/active" element={<AdminComponentStub title="Active Warranties" />} />
                <Route path="warranty/expiring" element={<AdminComponentStub title="Expiring Warranties" />} />
                <Route path="warranty/expired" element={<AdminComponentStub title="Expired Warranties" />} />
                
                {/* Procurement */}
                <Route path="procurement/requests" element={<AdminComponentStub title="Purchase Requests" />} />
                <Route path="procurement/purchases" element={<AdminComponentStub title="Purchases" />} />
                <Route path="procurement/suppliers" element={<AdminComponentStub title="Suppliers" />} />
                <Route path="procurement/invoices" element={<AdminComponentStub title="Invoices" />} />
                <Route path="procurement/history" element={<AdminComponentStub title="Purchase History" />} />
                
                {/* User Management */}
                <Route path="users" element={<AdminUserManagement />} />
                <Route path="users/create" element={<AdminUserManagement initialSection="create" />} />
                <Route path="users/roles" element={<AdminUserManagement initialSection="roles" />} />
                <Route path="users/permissions" element={<AdminUserManagement initialSection="permissions" />} />
                <Route path="users/active" element={<AdminUserManagement initialSection="status" />} />
                <Route path="users/inactive" element={<AdminUserManagement initialSection="status" />} />
                <Route path="users/activity" element={<AdminUserManagement initialSection="activity" />} />
                <Route path="roles" element={<AdminUserManagement initialSection="roles" />} />
                <Route path="permissions" element={<AdminUserManagement initialSection="permissions" />} />
                
                {/* Department Management */}
                <Route path="departments" element={<AdminDepartmentManagement />} />
                <Route path="departments/create" element={<AdminComponentStub title="Create Department" />} />
                <Route path="departments/heads" element={<AdminComponentStub title="Department Heads" />} />
                <Route path="departments/users" element={<AdminComponentStub title="Department Users" />} />
                <Route path="departments/assets" element={<AdminComponentStub title="Department Assets" />} />
                <Route path="departments/locations" element={<AdminComponentStub title="Department Locations" />} />
                
                {/* Reports & Analytics */}
                <Route path="reports" element={<AdminReports />} />
                <Route path="reports/assets" element={<AdminComponentStub title="Asset Reports" />} />
                <Route path="reports/inventory" element={<AdminComponentStub title="Inventory Reports" />} />
                <Route path="reports/assignments" element={<AdminComponentStub title="Assignment Reports" />} />
                <Route path="reports/transfers" element={<AdminComponentStub title="Transfer Reports" />} />
                <Route path="reports/maintenance" element={<AdminComponentStub title="Maintenance Reports" />} />
                <Route path="reports/rfid" element={<AdminComponentStub title="RFID Reports" />} />
                <Route path="reports/procurement" element={<AdminComponentStub title="Procurement Reports" />} />
                <Route path="reports/financial" element={<AdminComponentStub title="Financial Reports" />} />
                <Route path="reports/departments" element={<AdminComponentStub title="Department Reports" />} />
                <Route path="reports/users" element={<AdminComponentStub title="User Reports" />} />
                <Route path="reports/analytics" element={<AdminComponentStub title="Analytics" />} />
                
                {/* Notifications */}
                <Route path="notifications" element={<AdminNotifications />} />
                <Route path="notifications/unread" element={<AdminComponentStub title="Unread Notifications" />} />
                <Route path="notifications/maintenance" element={<AdminComponentStub title="Maintenance Alerts" />} />
                <Route path="notifications/assignment" element={<AdminComponentStub title="Assignment Alerts" />} />
                <Route path="notifications/transfer" element={<AdminComponentStub title="Transfer Alerts" />} />
                <Route path="notifications/missing" element={<AdminComponentStub title="Missing Asset Alerts" />} />
                <Route path="notifications/warranty" element={<AdminComponentStub title="Warranty Alerts" />} />
                <Route path="notifications/rfid" element={<AdminComponentStub title="RFID Alerts" />} />
                <Route path="notifications/security" element={<AdminComponentStub title="Security Alerts" />} />
                
                {/* Approvals */}
                <Route path="approvals/assignment" element={<AdminComponentStub title="Asset Assignment Approvals" />} />
                <Route path="approvals/transfer" element={<AdminComponentStub title="Asset Transfer Approvals" />} />
                <Route path="approvals/purchase" element={<AdminComponentStub title="Purchase Approvals" />} />
                <Route path="approvals/disposal" element={<AdminComponentStub title="Disposal Approvals" />} />
                <Route path="approvals/pending" element={<AdminComponentStub title="Pending Approvals" />} />
                
                {/* Settings */}
                <Route path="settings" element={<AdminSettings />} />
                
                {/* Backup */}
                <Route path="backup" element={<AdminBackup />} />
                <Route path="backup/history" element={<AdminComponentStub title="Backup History" />} />
                <Route path="backup/restore" element={<AdminComponentStub title="Restore Backup" />} />
                <Route path="backup/status" element={<AdminComponentStub title="Backup Status" />} />
                
                {/* Audit Logs */}
                <Route path="audit-logs" element={<AdminAuditLogs />} />
                <Route path="audit-logs/login" element={<AdminComponentStub title="Login Activities" />} />
                <Route path="audit-logs/assets" element={<AdminComponentStub title="Asset Activities" />} />
                <Route path="audit-logs/assignments" element={<AdminComponentStub title="Assignment Activities" />} />
                <Route path="audit-logs/transfers" element={<AdminComponentStub title="Transfer Activities" />} />
                <Route path="audit-logs/maintenance" element={<AdminComponentStub title="Maintenance Activities" />} />
                <Route path="audit-logs/users" element={<AdminComponentStub title="User Activities" />} />
                <Route path="audit-logs/settings" element={<AdminComponentStub title="Settings Changes" />} />
                <Route path="audit-logs/security" element={<AdminComponentStub title="Security Events" />} />
              </Route>

              {/* ICT OFFICER ROUTES - Fixed with RoleLayout */}
              <Route path="/ict" element={<ProtectedRoute allowedRoles={['ict_officer']}><RoleLayout /></ProtectedRoute>}>
                <Route index element={<ICTDashboard />} />
                <Route path="assets" element={<ICTAssets />} />
                <Route path="assets/create" element={<ICTCreateAsset />} />
                <Route path="assets/assign" element={<ICTAssignments />} />
                <Route path="assets/:id" element={<AssetDetails />} />
                <Route path="maintenance" element={<ICTMaintenance />} />
                <Route path="rfid" element={<ICTRFIDTracking />} />
                <Route path="reports" element={<ICTReports />} />
                <Route path="inventory" element={<ICTInventory />} />
                <Route path="requests" element={<ICTAssetRequests />} />
                <Route path="equipment" element={<ICTEquipment />} />
                <Route path="network" element={<ICTNetwork />} />
                <Route path="support" element={<ICTTechnicalSupport />} />
                <Route path="notifications" element={<ICTNotifications />} />
                <Route path="assets/:id/history" element={<ICTAssetHistory />} />
              </Route>

              {/* COLLEGE ROUTES - canonical route for department-head responsibilities under the college role */}
              <Route path="/college" element={<ProtectedRoute allowedRoles={['college']}><RoleLayout /></ProtectedRoute>}>
                <Route index element={<CollegeManagerPages section="dashboard" />} />
                <Route path="profile" element={<CollegeManagerPages section="profile" />} />
                <Route path="departments" element={<CollegeManagerPages section="departments" />} />
                <Route path="department-deans" element={<CollegeManagerPages section="department-deans" />} />
                <Route path="department-staff" element={<CollegeManagerPages section="department-staff" />} />
                <Route path="department-assets" element={<CollegeManagerPages section="department-assets" />} />
                <Route path="department-requests" element={<CollegeManagerPages section="department-requests" />} />
                <Route path="department-approvals" element={<CollegeManagerPages section="department-approvals" />} />
                <Route path="department-assignments" element={<CollegeManagerPages section="department-assignments" />} />
                <Route path="department-transfers" element={<CollegeManagerPages section="department-transfers" />} />
                <Route path="department-returns" element={<CollegeManagerPages section="department-returns" />} />
                <Route path="department-maintenance" element={<CollegeManagerPages section="department-maintenance" />} />
                <Route path="department-reports" element={<CollegeManagerPages section="department-reports" />} />
                <Route path="department-history" element={<CollegeManagerPages section="department-history" />} />
                <Route path="staff" element={<CollegeManagerPages section="staff" />} />
                <Route path="locations" element={<CollegeManagerPages section="locations" />} />
                <Route path="assets" element={<CollegeManagerPages section="assets" />} />
                <Route path="inventory" element={<CollegeManagerPages section="inventory" />} />
                <Route path="requests" element={<CollegeManagerPages section="requests" />} />
                <Route path="approvals" element={<CollegeManagerPages section="approvals" />} />
                <Route path="assignments" element={<CollegeManagerPages section="assignments" />} />
                <Route path="transfers" element={<CollegeManagerPages section="transfers" />} />
                <Route path="returns" element={<CollegeManagerPages section="returns" />} />
                <Route path="maintenance" element={<CollegeManagerPages section="maintenance" />} />
                <Route path="rfid" element={<CollegeManagerPages section="rfid" />} />
                <Route path="reports" element={<CollegeManagerPages section="reports" />} />
                <Route path="notifications" element={<CollegeManagerPages section="notifications" />} />
                <Route path="history" element={<CollegeManagerPages section="history" />} />
              </Route>

              <Route path="/department" element={<DepartmentWorkspaceRoute />}>
                <Route index element={<DeptDashboard />} />
                <Route path="profile" element={<DeptDashboard />} />
                <Route path="staff" element={<DeptStaff />} />
                <Route path="assets" element={<DeptAssets />} />
                <Route path="requests" element={<DeptApprovals />} />
                <Route path="approvals" element={<DepartmentDeanRoute />} />
                <Route path="assignments" element={<DeptAssets />} />
                <Route path="transfers" element={<DeptAssets />} />
                <Route path="returns" element={<DeptAssets />} />
                <Route path="maintenance" element={<DeptApprovals />} />
                <Route path="reports" element={<DeptReports />} />
                <Route path="notifications" element={<DeptNotifications />} />
                <Route path="history" element={<DeptAssetHistory />} />
              </Route>

              {/* FINANCE ROUTES - Fixed with RoleLayout */}
              <Route path="/finance" element={<ProtectedRoute allowedRoles={['admin', 'finance']}><RoleLayout /></ProtectedRoute>}>
                <Route index element={<FinanceDashboard />} />
                <Route path="purchases" element={<FinanceReports />} />
                <Route path="invoices" element={<FinanceReports />} />
                <Route path="payments" element={<FinanceReports />} />
                <Route path="budget" element={<FinanceReports />} />
                <Route path="assets" element={<FinanceValuation />} />
                <Route path="reports" element={<FinanceReports />} />
                <Route path="depreciation" element={<FinanceDepreciation />} />
                <Route path="suppliers" element={<FinanceReports />} />
                <Route path="transactions" element={<FinanceAudit />} />
                <Route path="audit" element={<FinanceAudit />} />
                <Route path="notifications" element={<FinanceNotifications />} />
              </Route>

              {/* STORE MANAGER ROUTES - Fixed with RoleLayout */}
              <Route path="/store" element={<ProtectedRoute allowedRoles={['store_manager']}><RoleLayout /></ProtectedRoute>}>
                <Route index element={<StoreDashboard />} />
                <Route path="inventory" element={<StoreInventory />} />
                <Route path="assets" element={<StoreAssets />} />
                <Route path="receive" element={<StoreReceive />} />
                <Route path="issue" element={<StoreIssue />} />
                <Route path="returns" element={<StoreReturns />} />
                <Route path="transfers" element={<StoreTransfers />} />
                <Route path="requests" element={<StoreAssetRequests />} />
                <Route path="tracking" element={<StoreTracking />} />
                <Route path="maintenance" element={<StoreMaintenance />} />
                <Route path="warranty" element={<StoreWarranty />} />
                <Route path="reports" element={<StoreReports />} />
                <Route path="notifications" element={<StoreNotifications />} />
                <Route path="history" element={<StoreHistory />} />
              </Route>

              {/* MAINTENANCE ROUTES - Fixed with RoleLayout */}
              <Route path="/maintenance" element={<ProtectedRoute allowedRoles={['maintenance', 'admin', 'ict_officer']}><MaintenanceLayout /></ProtectedRoute>}>
                <Route index element={<MaintDashboard />} />
                <Route path="requests" element={<MaintRequests />} />
                <Route path="inspection" element={<MaintAssetInspection />} />
                <Route path="work-orders" element={<MaintWorkOrders />} />
                <Route path="repairs" element={<MaintRepairs />} />
                <Route path="preventive" element={<MaintPreventive />} />
                <Route path="technicians" element={<MaintTechnicians />} />
                <Route path="spare-parts" element={<MaintSpareParts />} />
                <Route path="assets-under-maintenance" element={<MaintAssetsUnderMaintenance />} />
                <Route path="testing-quality" element={<MaintTestingQuality />} />
                <Route path="assigned-tasks" element={<MaintAssigned />} />
                <Route path="history" element={<MaintHistory />} />
                <Route path="reports" element={<MaintReports />} />
                <Route path="parts" element={<MaintSpareParts />} />
                <Route path="assets" element={<MaintAssetsUnderMaintenance />} />
                <Route path="testing" element={<MaintTestingQuality />} />
                <Route path="assigned" element={<MaintAssigned />} />
              </Route>

              {/* INFRASTRUCTURE ROUTES */}
              <Route path="/infrastructure" element={<ProtectedRoute allowedRoles={['infrastructure', 'admin']}><InfrastructureLayout /></ProtectedRoute>}>
                <Route index element={<InfrastructureDashboard />} />
                
                {/* Asset Management */}
                <Route path="assets" element={<InfrastructureAssets />} />
                <Route path="assets/register" element={<RegisterInfrastructureAsset />} />
                
                {/* Infrastructure Categories */}
                <Route path="buildings" element={<InfrastructureBuildings />} />
                <Route path="electrical" element={<InfrastructureElectrical />} />
                <Route path="generators" element={<InfrastructureGenerators />} />
                <Route path="transformers" element={<InfrastructureTransformers />} />
                <Route path="ups" element={<InfrastructureUPS />} />
                <Route path="solar" element={<InfrastructureSolar />} />
                <Route path="water" element={<InfrastructureWater />} />
                <Route path="roads" element={<InfrastructureRoads />} />
                
                {/* Operations */}
                <Route path="maintenance" element={<InfrastructureMaintenance />} />
                <Route path="work-orders" element={<InfrastructureWorkOrders />} />
                <Route path="preventive" element={<InfrastructurePreventive />} />
                
                {/* Inventory & Resources */}
                <Route path="spare-parts" element={<InfrastructureSpareParts />} />
                <Route path="energy" element={<InfrastructureEnergy />} />
                <Route path="fuel" element={<InfrastructureFuel />} />
                
                {/* Monitoring & Tracking */}
                <Route path="inspection" element={<InfrastructureInspection />} />
                <Route path="tracking" element={<InfrastructureTracking />} />
                
                {/* Management */}
                <Route path="requests" element={<InfrastructureRequests />} />
                <Route path="reports" element={<InfrastructureReports />} />
                <Route path="documents" element={<InfrastructureDocuments />} />
                <Route path="notifications" element={<InfrastructureNotifications />} />
                <Route path="audit" element={<InfrastructureAudit />} />
              </Route>

              {/* Redirects */}
              <Route path="/" element={<Navigate to={getDashboardRoute(user.role)} />} />
              <Route path="/dashboard" element={<Navigate to={getDashboardRoute(user.role)} />} />
              <Route path="*" element={<Navigate to={getDashboardRoute(user.role)} />} />
            </Routes>
          </Suspense>
          <Footer />
        </main>
      </div>
      <ToastContainer position="top-right" autoClose={3000} />
      {pendingPublicPath && (
        <div className="public-navigation-modal" role="dialog" aria-modal="true" aria-labelledby="public-navigation-title">
          <div className="public-navigation-modal-card">
            <h2 id="public-navigation-title">You are currently logged in.</h2>
            <p>Please logout first before accessing this public page.</p>
            <div className="public-navigation-modal-actions">
              <button type="button" onClick={() => setPendingPublicPath(null)}>Cancel</button>
              <button type="button" className="primary" onClick={handleLogoutToRequestedPage}>Logout Now</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// MAIN APP COMPONENT
// ==========================================

function App() {
  return (
    <ChunkErrorBoundary>
      <UIProvider>
        <AuthProvider>
          <DataProvider>
            <BrowserRouter
              future={{
                v7_startTransition: true,
                v7_relativeSplatPath: true
              }}
            >
              <AppContent />
            </BrowserRouter>
          </DataProvider>
        </AuthProvider>
      </UIProvider>
    </ChunkErrorBoundary>
  );
}

export default App;