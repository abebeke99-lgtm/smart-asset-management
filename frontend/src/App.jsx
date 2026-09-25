// ==============================================
// src/App.jsx - COMPLETE WITH FIXED NAVIGATION
// ==============================================

import React, { useState, useEffect, useRef, useMemo, useCallback, Suspense, lazy } from 'react';
import axios from 'axios';
import { BrowserRouter, Routes, Route, Link, Navigate, useNavigate, useLocation, Outlet } from 'react-router-dom';
import './App.css';
import './admin-design-system.css';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Archive, ArrowLeftRight, BarChart3, Bell, Building2, Check, ChevronDown, ChevronRight, ClipboardCheck, ClipboardList, DatabaseBackup, FilePlus2, FileText, GitBranch, Home as HomeIcon, Info, Languages, LayoutDashboard, LockKeyhole, LogIn, LogOut, Mail, MapPin, Menu, Moon, MoreHorizontal, Package, PanelLeft, Phone, Radio, Search, Settings, ShieldCheck, Sun, UserCircle, Users, Wrench, X } from 'lucide-react';
import MaintenanceLayout from './components/maintenance/MaintenanceLayout';
import Login from './components/public/Login';
import CollegeManagerPages from './components/college/CollegeManagerPages';
import CollegeDepartments from './pages/college/CollegeDepartments';
import DepartmentDetails from './components/college/DepartmentDetails';
import DepartmentMaintenance from './components/department/DepartmentMaintenance';
import ScopedWorkflowPage from './components/shared/ScopedWorkflowPage';

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
import { apiClient } from './utils/api';
import UserAvatar from './components/common/UserAvatar';
import StoreTracking from './components/store/StoreTracking';

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
const AdminRolesPermissions = lazy(() => import('./components/admin/AdminRolesPermissions'));
const AdminSettings = lazy(() => import('./components/admin/AdminSettings'));
const SystemMonitoring = lazy(() => import('./components/admin/SystemMonitoring'));
const AdminNotifications = lazy(() => import('./components/admin/AdminNotifications'));
const AdminNotificationDetails = lazy(() => import('./components/admin/AdminNotificationDetails'));
const AdminBackup = lazy(() => import('./components/admin/AdminBackup'));
const AdminDepartmentManagement = lazy(() => import('./components/admin/AdminDepartmentManagement'));
const AdminCollegeManagement = lazy(() => import('./components/admin/AdminCollegeManagement'));
const AdminCollegeDetails = lazy(() => import('./components/admin/AdminCollegeDetails'));
const AdminAnalyticsCenter = lazy(() => import('./components/admin/AdminAnalyticsCenter'));

// ICT Components
const ICTDashboard = lazy(() => import('./components/ict/ICTDashboard'));
const ICTAssets = lazy(() => import('./components/ict/ICTAssets'));
const ICTAssignments = lazy(() => import('./components/ict/ICTAssignments'));
const ICTMaintenance = lazy(() => import('./components/ict/ICTMaintenance'));
const ICTDeviceHealth = lazy(() => import('./components/ict/ICTDeviceHealth'));
const ICTRepairHistory = lazy(() => import('./components/ict/ICTRepairHistory'));
const ICTRFIDTracking = lazy(() => import('./components/ict/ICTRFIDTracking'));
const ICTReports = lazy(() => import('./components/ict/ICTReports'));
const ICTAssetAnalytics = lazy(() => import('./components/ict/ICTAssetAnalytics'));
const ICTInventory = lazy(() => import('./components/ict/ICTInventory'));
const ICTNotifications = lazy(() => import('./components/ict/ICTNotifications'));
const ICTAssetHistory = lazy(() => import('./components/ict/ICTAssetHistory'));
const ICTAssetRequests = lazy(() => import('./components/ict/ICTAssetRequests'));
const ICTEquipment = lazy(() => import('./components/ict/ICTEquipment'));
const ICTNetwork = lazy(() => import('./components/ict/ICTNetwork'));
const ICTTechnicalSupport = lazy(() => import('./components/ict/ICTTechnicalSupport'));
const ICTIncidents = lazy(() => import('./components/ict/ICTIncidents'));
const ICTSoftwareLicenses = lazy(() => import('./components/ict/ICTSoftwareLicenses'));

// Department Components
const DeptDashboard = lazy(() => import('./components/department/DeptDashboard'));
const DeptAssets = lazy(() => import('./components/department/DeptAssets'));
const DeptApprovals = lazy(() => import('./components/department/DeptApprovals'));
const DeptReports = lazy(() => import('./components/department/DeptReports'));
const DeptUtilization = lazy(() => import('./components/department/DeptUtilization'));
const DeptLocations = lazy(() => import('./components/department/DeptLocations'));
const DeptProfile = lazy(() => import('./components/department/DeptProfile'));
const DeptStaff = lazy(() => import('./components/department/DeptStaff'));
const DeptNotifications = lazy(() => import('./components/department/DeptNotifications'));
const DeptAssetHistory = lazy(() => import('./components/department/DeptAssetHistory'));

// Store Components
const StoreDashboard = lazy(() => import('./components/store/StoreDashboard'));
const StoreInventory = lazy(() => import('./components/store/StoreInventory'));
const StoreAssets = lazy(() => import('./components/store/StoreAssets'));
const StoreLowStock = lazy(() => import('./components/store/StoreLowStock'));
const StoreAdjustments = lazy(() => import('./components/store/StoreAdjustments'));
const StoreReceive = lazy(() => import('./components/store/StoreReceive'));
const StoreReceivePage = lazy(() => import('./components/store/StoreReceivePage'));
const StoreIssue = lazy(() => import('./components/store/StoreIssue'));
const StoreIssuePage = lazy(() => import('./components/store/StoreIssuePage'));
const StoreReturns = lazy(() => import('./components/store/StoreReturns'));
const StoreReturnsPage = lazy(() => import('./components/store/StoreReturnsPage'));
const StoreTransfers = lazy(() => import('./components/store/StoreTransfers'));
const StoreAssetRequests = lazy(() => import('./components/store/StoreAssetRequests'));
const StoreMaintenance = lazy(() => import('./components/store/StoreMaintenance'));
const StoreWarranty = lazy(() => import('./components/store/StoreWarranty'));
const StoreReports = lazy(() => import('./components/store/StoreReports'));
const StoreNotifications = lazy(() => import('./components/store/StoreNotifications'));
const StoreHistory = lazy(() => import('./components/store/StoreHistory'));

// Finance Components
const FinanceDashboard = lazy(() => import('./components/finance/FinanceDashboard'));
const FinancePurchaseRequests = lazy(() => import('./components/finance/FinancePurchaseRequests'));
const FinancePurchaseOrders = lazy(() => import('./components/finance/FinancePurchaseOrders'));
const FinancePurchaseHistory = lazy(() => import('./components/finance/FinancePurchaseHistory'));
const FinanceInvoices = lazy(() => import('./components/finance/FinanceInvoices'));
const FinanceTransactions = lazy(() => import('./components/finance/FinanceTransactions'));
const FinanceSuppliers = lazy(() => import('./components/finance/FinanceSuppliers'));
const FinanceValuation = lazy(() => import('./components/finance/FinanceValuation'));
const FinanceReports = lazy(() => import('./components/finance/FinanceReports'));
const FinanceDepreciation = lazy(() => import('./components/finance/FinanceDepreciation'));
const FinanceDepreciationReports = lazy(() => import('./components/finance/FinanceDepreciationReports'));
const Capitalization = lazy(() => import('./components/finance/Capitalization'));
const FinanceNotifications = lazy(() => import('./components/finance/FinanceNotifications'));
const FinancePayments = lazy(() => import('./components/finance/FinancePayments'));
const FinanceBudgetManagement = lazy(() => import('./components/finance/FinanceBudgetManagement'));
const FinanceBudgetReports = lazy(() => import('./components/finance/FinanceBudgetReports'));
const DisposalFinancialRecords = lazy(() => import('./components/finance/DisposalFinancialRecords'));
const FinanceAssetValueReports = lazy(() => import('./components/finance/FinanceAssetValueReports'));

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
const InfrastructureAssignment = lazy(() => import('./components/infrastructure/InfrastructureAssignment'));
const InfrastructureInventory = lazy(() => import('./components/infrastructure/InfrastructureInventory'));
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
const InfrastructureVerification = lazy(() => import('./components/infrastructure/InfrastructureVerification'));
const InfrastructureTracking = lazy(() => import('./components/infrastructure/InfrastructureTracking'));
const InfrastructureRequests = lazy(() => import('./components/infrastructure/InfrastructureRequests'));
const InfrastructureReports = lazy(() => import('./components/infrastructure/InfrastructureReports'));
const InfrastructureDocuments = lazy(() => import('./components/infrastructure/InfrastructureDocuments'));
const InfrastructureNotifications = lazy(() => import('./components/infrastructure/InfrastructureNotifications'));

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

const UNIVERSITY_LOGO = '/assets/mekdela-amba-university-logo.png';

export const shouldHideSidebarForPath = (pathname = '') => {
  const normalizedPath = String(pathname || '').split('?')[0].split('#')[0].trim();
  return normalizedPath === '/ict/assets/create' || normalizedPath.startsWith('/ict/assets/create/');
};

export const isPublicRoute = (pathname = '') => {
  const normalizedPath = String(pathname || '').split('?')[0].split('#')[0].trim();
  return ['/', '/home', '/about', '/about-us', '/contact', '/register', '/forgot-password', '/reset-password'].includes(normalizedPath)
    || normalizedPath.startsWith('/reset-password/');
};

export const isDashboardRoute = (pathname = '') => {
  const normalizedPath = String(pathname || '').split('?')[0].split('#')[0].trim();
  if (!normalizedPath || normalizedPath === '/' || isPublicRoute(normalizedPath)) return false;
  return normalizedPath === '/dashboard'
    || normalizedPath.startsWith('/dashboard/')
    || normalizedPath.startsWith('/admin')
    || normalizedPath.startsWith('/ict')
    || normalizedPath.startsWith('/college')
    || normalizedPath.startsWith('/department')
    || normalizedPath.startsWith('/finance')
    || normalizedPath.startsWith('/store')
    || normalizedPath.startsWith('/maintenance')
    || normalizedPath.startsWith('/infrastructure');
};

export const shouldUseStandaloneLoginLayout = (pathname = '') => {
  const normalizedPath = String(pathname || '').split('?')[0].split('#')[0].trim();
  return normalizedPath === '/login';
};

export const shouldShowDashboardSidebar = (pathname = '') => {
  const normalizedPath = String(pathname || '').split('?')[0].split('#')[0].trim();
  const publicPaths = ['/', '/home', '/about', '/contact', '/login', '/register', '/forgot-password', '/reset-password'];
  return normalizedPath !== '' && !publicPaths.includes(normalizedPath) && !normalizedPath.startsWith('/reset-password/');
};

export const normalizeRole = (role) => {
  if (!role) return 'user';
  const value = String(role).trim().toLowerCase();
  const aliases = {
    'admin': 'admin',
    'administrator': 'admin',
    'ict officer': 'ict_officer',
    'ict_officer': 'ict_officer',
    'ict-officer': 'ict_officer',
    'college': 'college',
    'department head': 'department_head',
    'department_head': 'department_head',
    'department-head': 'department_head',
    'dept_head': 'department_head',
    'dept-head': 'department_head',
    'department': 'department_head',
    'finance': 'finance',
    'finance officer': 'finance',
    'store manager': 'store_manager',
    'store_manager': 'store_manager',
    'store-manager': 'store_manager',
    'maintenance': 'maintenance',
    'maint': 'maintenance',
    'infrastructure': 'infrastructure',
    'infrastructure director': 'infrastructure',
    'infrastructure directorate': 'infrastructure',
    'infrastructure_directorate': 'infrastructure',
    'infrastructure-directorate': 'infrastructure',
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
    department_head: '/department',
    finance: '/finance',
    store_manager: '/store',
    maintenance: '/maintenance',
    infrastructure: '/infrastructure',
    staff: '/department'
  };
  return roleMap[normalizeRole(role)] || '/home';
};

const AccessDenied = () => (
  <main role="alert" aria-labelledby="access-denied-title" style={{ padding: '48px 24px', textAlign: 'center' }}>
    <h1 id="access-denied-title">Access denied</h1>
    <p>You do not have permission to access this section.</p>
    <Link to="/dashboard">Return to your dashboard</Link>
  </main>
);

export const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();
  const currentRole = normalizeRole(user?.role || user?.roles);

  if (authLoading) {
    return <LoadingFallback />;
  }

  if (!user) {
    const redirectPath = `${location.pathname}${location.search || ''}`;
    return <Navigate to={`/login?redirect=${encodeURIComponent(redirectPath)}`} replace state={{ from: location }} />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(currentRole)) {
    return <AccessDenied />;
  }

  return children;
};

const DepartmentWorkspaceRoute = () => {
  const { user } = useAuth();
  const role = normalizeRole(user?.role || user?.roles);
  const responsibility = String(user?.departmentRole || user?.responsibility || user?.position || '').trim().toLowerCase().replace(/[_-]+/g, ' ');
  const canUseDepartmentWorkspace = role === 'staff' || role === 'department_head' || responsibility === 'department staff' || responsibility === 'department dean' || responsibility === 'dean';

  if (!canUseDepartmentWorkspace) {
    return <Navigate to={getDashboardRoute(user?.role)} replace />;
  }

  return <RoleLayout />;
};

const DepartmentDeanRoute = () => {
  const { user } = useAuth();
  const role = normalizeRole(user?.role || user?.roles);
  const responsibility = String(user?.departmentRole || user?.responsibility || user?.position || '').trim().toLowerCase().replace(/[_-]+/g, ' ');
  return role === 'department_head' || responsibility === 'department dean' || responsibility === 'dean'
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
    systemName: " University Asset Management System",
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
    footer: "© 2026 Mekdela Amba University | University Asset Management System | All rights reserved.",
    footerDescription: "A clear, reliable way to manage university assets.",
    footerNavigation: "Navigation",
    footerUsefulLinks: "Useful links",
    footerCopyright: "All rights reserved.",
    light: "Light",
    dark: "Dark",
    language: "Language",
    companyName: "Mekdela Amba University",
    address: "tulu awliya, Ethiopia",
    phone: "+251-986481821",
    email: "bekelea906@gmail.com",
    workingHours: "Monday - Friday, 2:30 AM - 11:30 AM",
    emailValue: "bekelea906@gmail.com",
    phoneValue: "+251-986481821",
    addressValue: "tulu awliya, Ethiopia",
    workingHoursValue: "Monday - Friday, 2:30 AM - 11:30 AM",
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
    systemName: " ዩኒቨርሲቲ ንብረት አስተዳደር ስርዓት",
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
    footer: "2026 መቅደላ አምባ ዩኒቨርሲቲ -  ንብረት አስተዳደር ስርዓት | ሁሉም መብቶች ተጠብቀዋል | የተሰራዉ በ: በቀለ :0986481821",
    footerDescription: "የዩኒቨርሲቲ ንብረቶችን ለማስተዳደር ግልጽና አስተማማኝ መንገድ።",
    footerNavigation: "አሰሳ",
    footerUsefulLinks: "ጠቃሚ አገናኞች",
    footerCopyright: "መብቱ በሙሉ የተጠበቀ ነው።",
    light: "ብርሃን",
    dark: "ጨለማ",
    language: "ቋንቋ",
    companyName: "መቅደላ አምባ ዩኒቨርሲቲ",
    address: "ቱሉ አውሊያ፣ ኢትዮጵያ",
    phone: "+251-986481821",
    email: "bekelea906@gmail.com",
    workingHours: "ሰኞ - አርብ, 2:30 ጠዋት - 11:30 ጠዋት",
    emailValue: "bekelea906@gmail.com",
    phoneValue: "+251-986481821",
    addressValue: "ቱሉ አውሊያ፣ ኢትዮጵያ",
    workingHoursValue: "ሰኞ - አርብ, 2:30 ጠዋት - 11:30 ጠዋት",
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
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.assets)) return payload.assets;
  if (Array.isArray(payload.categories)) return payload.categories;
  if (Array.isArray(payload.locations)) return payload.locations;
  if (Array.isArray(payload.disposals)) return payload.disposals;
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
  const { user } = useAuth();
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [form, setForm] = useState({
    name: '',
    code: '',
    description: '',
    icon: 'package',
    status: 'active'
  });
  const [formErrors, setFormErrors] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [viewCategory, setViewCategory] = useState(null);
  const [deleteCandidate, setDeleteCandidate] = useState(null);
  const [menuOpenId, setMenuOpenId] = useState(null);

  const role = String(user?.role || '').trim().toLowerCase();
  const canManageCategories = ['admin', 'ict_officer', 'department_head', 'finance', 'store_manager', 'maintenance', 'infrastructure'].includes(role);
  const canDeleteCategory = role === 'admin';

  const normalizeCategory = (category = {}) => {
    const entry = category || {};
    const status = String(entry.status || 'active').trim().toLowerCase();
    const assetCount = Number(entry.assetCount ?? entry.asset_count ?? entry.assets ?? entry.count ?? 0);
    return {
      id: entry.id,
      name: entry.name || 'Unnamed category',
      code: entry.code || '',
      description: entry.description || '',
      icon: entry.icon || 'package',
      status: ['active', 'inactive'].includes(status) ? status : 'active',
      assetCount: Number.isFinite(assetCount) ? assetCount : 0,
      createdAt: entry.createdAt || entry.created_at || null,
      updatedAt: entry.updatedAt || entry.updated_at || null,
    };
  };

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await axios.get('/api/categories', { params: { page: 1, limit: 100 } });
      const rows = normalizeListResponse(response?.data ?? []);
      setCategories(Array.isArray(rows) ? rows.map(normalizeCategory) : []);
    } catch (loadError) {
      console.error('Category load failed:', loadError);
      setCategories([]);
      setError('Unable to load asset categories. Please check the server connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const summary = useMemo(() => ({
    total: categories.length,
    active: categories.filter((category) => category.status === 'active').length,
    inactive: categories.filter((category) => category.status === 'inactive').length,
  }), [categories]);

  const filteredCategories = useMemo(() => {
    const query = search.trim().toLowerCase();
    return categories.filter((category) => {
      const matchesStatus = statusFilter === 'all' || category.status === statusFilter;
      if (!matchesStatus) return false;
      if (!query) return true;

      const haystack = [category.name, category.code, category.description, category.status].join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }, [categories, search, statusFilter]);

  const resetCategoryForm = () => {
    setEditingId(null);
    setForm({
      name: '',
      code: '',
      description: '',
      icon: 'package',
      status: 'active',
    });
    setFormErrors({});
  };

  const openCreateForm = () => {
    resetCategoryForm();
    setIsFormOpen(true);
  };

  const openEditForm = (category) => {
    setEditingId(category.id);
    setForm({
      name: category.name || '',
      code: category.code || '',
      description: category.description || '',
      icon: category.icon || 'package',
      status: category.status || 'active',
    });
    setFormErrors({});
    setIsFormOpen(true);
  };

  const validateCategory = () => {
    const nextErrors = {};
    const name = String(form.name || '').trim();
    const code = String(form.code || '').trim();
    const status = String(form.status || 'active').trim().toLowerCase();

    if (!name) {
      nextErrors.name = 'Category name is required.';
    } else if (name.length > 120) {
      nextErrors.name = 'Category name must be 120 characters or fewer.';
    }

    if (code.length > 80) {
      nextErrors.code = 'Category code is too long.';
    }

    if (!['active', 'inactive'].includes(status)) {
      nextErrors.status = 'A valid status is required.';
    }

    return nextErrors;
  };

  const saveCategory = async () => {
    const nextErrors = validateCategory();
    if (Object.keys(nextErrors).length > 0) {
      setFormErrors(nextErrors);
      return;
    }

    const name = String(form.name || '').trim();
    const code = String(form.code || '').trim().toUpperCase();
    const description = String(form.description || '').trim();
    const icon = String(form.icon || 'package').trim();
    const status = String(form.status || 'active').trim().toLowerCase();

    setSaving(true);
    setError('');
    setFormErrors({});

    try {
      const payload = { name, code, description, icon, status };

      if (editingId) {
        const response = await axios.put(`/api/categories/${editingId}`, payload);
        const updatedItem = normalizeListResponse(response?.data ?? []);
        setCategories((previous) => previous.map((category) => String(category.id) === String(editingId)
          ? normalizeCategory({ ...category, ...(Array.isArray(updatedItem) ? updatedItem[0] : updatedItem) })
          : category));
      } else {
        const response = await axios.post('/api/categories', payload);
        const createdItem = normalizeListResponse(response?.data ?? []);
        setCategories((previous) => [normalizeCategory(createdItem.length > 0 ? createdItem[0] : createdItem), ...previous]);
      }

      setIsFormOpen(false);
      resetCategoryForm();
      await loadData();
    } catch (saveError) {
      const message = saveError?.response?.data?.message || 'Unable to save category.';
      setFormErrors({ submit: message });
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const removeCategory = async () => {
    if (!deleteCandidate) return;

    try {
      await axios.delete(`/api/categories/${deleteCandidate?.id}`);
      setCategories((previous) => previous.filter((category) => String(category.id) !== String(deleteCandidate?.id)));
      setDeleteCandidate(null);
      setMenuOpenId(null);
      if (editingId === deleteCandidate?.id) {
        resetCategoryForm();
      }
    } catch (deleteError) {
      const message = deleteError?.response?.data?.message || 'Unable to delete category.';
      setError(message);
      setDeleteCandidate(null);
    }
  };

  const handleDeleteClick = (category) => {
    setMenuOpenId(null);
    if (Number(category.assetCount || 0) > 0) {
      setDeleteCandidate(category);
      return;
    }

    setDeleteCandidate(category);
  };

  const resetFilters = () => {
    setSearch('');
    setStatusFilter('all');
  };

  const categoryStatusLabel = (status) => status === 'active' ? 'Active' : 'Inactive';

  return (
    <div className="asset-category-shell">
      <div className="asset-category-header">
        <div>
          <div className="asset-category-breadcrumb">Assets / Categories</div>
          <h2 className="asset-category-page-title"><Package size={24} aria-hidden="true" /> Asset Categories</h2>
          <p className="asset-category-subtitle">Manage and organize the categories used to classify university assets.</p>
        </div>

        {canManageCategories && (
          <button type="button" className="asset-category-primary-button" onClick={openCreateForm} aria-label="Create category">
            <FilePlus2 size={18} aria-hidden="true" />
            Create Category
          </button>
        )}
      </div>

      <div className="asset-category-summary-grid" aria-label="Category summary">
        <div className="asset-category-summary-card">
          <div className="asset-category-summary-icon asset-category-summary-icon--neutral"><Package size={20} aria-hidden="true" /></div>
          <div className="asset-category-summary-meta">
            <span>Total Categories</span>
            <strong>{summary.total}</strong>
            <small>All asset types</small>
          </div>
        </div>

        <div className="asset-category-summary-card">
          <div className="asset-category-summary-icon asset-category-summary-icon--success"><Check size={20} aria-hidden="true" /></div>
          <div className="asset-category-summary-meta">
            <span>Active</span>
            <strong>{summary.active}</strong>
            <small>Currently usable</small>
          </div>
        </div>

        <div className="asset-category-summary-card">
          <div className="asset-category-summary-icon asset-category-summary-icon--muted"><X size={20} aria-hidden="true" /></div>
          <div className="asset-category-summary-meta">
            <span>Inactive</span>
            <strong>{summary.inactive}</strong>
            <small>Not currently used</small>
          </div>
        </div>
      </div>

      <div className="asset-category-toolbar" role="search">
        <label className="asset-category-search" htmlFor="category-search">
          <Search size={16} aria-hidden="true" />
          <input
            id="category-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search categories..."
            aria-label="Search categories"
          />
        </label>

        <label className="asset-category-status-filter" htmlFor="category-status-filter">
          <span>Status</span>
          <select id="category-status-filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter by status">
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>

        <button type="button" className="asset-category-secondary-button" onClick={resetFilters} aria-label="Reset filters">
          Reset
        </button>
      </div>

      {loading ? (
        <div className="asset-category-skeleton-list" aria-live="polite" aria-label="Loading categories">
          {[...Array(4)].map((_, index) => (
            <div key={index} className="asset-category-skeleton-row" />
          ))}
        </div>
      ) : error ? (
        <div className="asset-category-state asset-category-state--error" role="alert">
          <h3>Unable to load asset categories</h3>
          <p>Please check the server connection and try again.</p>
          <button type="button" className="asset-category-secondary-button" onClick={loadData}>Retry</button>
        </div>
      ) : filteredCategories.length === 0 ? (
        <div className="asset-category-state asset-category-state--empty">
          <h3>No asset categories found</h3>
          <p>Create your first asset category to organize university assets.</p>
          {canManageCategories && (
            <button type="button" className="asset-category-primary-button" onClick={openCreateForm}>
              <FilePlus2 size={18} aria-hidden="true" />
              Create Category
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="asset-category-table-wrap">
            <table className="asset-category-table" aria-label="Asset category list">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Assets</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCategories.map((category) => (
                  <tr key={category.id}>
                    <td>
                      <div className="asset-category-name-cell">
                        <span className="asset-category-name-icon" aria-hidden="true"><Package size={14} /></span>
                        <span>{category.name}</span>
                      </div>
                    </td>
                    <td className="asset-category-cell-muted">{category.description || '—'}</td>
                    <td>
                      <span className="asset-category-count-pill" title={`${category.assetCount} assets`}>
                        {category.assetCount} {category.assetCount === 1 ? 'asset' : 'assets'}
                      </span>
                    </td>
                    <td>
                      <span className={`asset-category-status-badge ${category.status === 'active' ? 'is-active' : 'is-inactive'}`}>
                        <span className="asset-category-status-dot" aria-hidden="true" />
                        {categoryStatusLabel(category.status)}
                      </span>
                    </td>
                    <td className="asset-category-cell-muted">
                      {category.createdAt ? new Date(category.createdAt).toLocaleDateString() : '—'}
                    </td>
                    <td>
                      <div className="asset-category-actions">
                        <button type="button" className="asset-category-link-button" onClick={() => setViewCategory(category)}>
                          View
                        </button>
                        {canManageCategories && (
                          <button type="button" className="asset-category-link-button" onClick={() => openEditForm(category)}>
                            Edit
                          </button>
                        )}
                        {canManageCategories && (
                          <div className="asset-category-menu-wrap">
                            <button
                              type="button"
                              className="asset-category-menu-button"
                              onClick={() => setMenuOpenId((current) => current === category.id ? null : category.id)}
                              aria-label={`More actions for ${category.name}`}
                              aria-haspopup="menu"
                            >
                              <MoreHorizontal size={16} aria-hidden="true" />
                            </button>

                            {menuOpenId === category.id && (
                              <div className="asset-category-menu" role="menu" aria-label={`Actions for ${category.name}`}>
                                <button type="button" role="menuitem" onClick={() => setViewCategory(category)}>View</button>
                                <button type="button" role="menuitem" onClick={() => openEditForm(category)}>Edit</button>
                                <button type="button" role="menuitem" onClick={() => {
                                  const nextStatus = category.status === 'active' ? 'inactive' : 'active';
                                  setCategories((previous) => previous.map((item) => String(item.id) === String(category.id)
                                    ? { ...item, status: nextStatus }
                                    : item));
                                  axios.put(`/api/categories/${category.id}`, { ...category, status: nextStatus })
                                    .catch((updateError) => setError(updateError?.response?.data?.message || 'Unable to update category status.'));
                                  setMenuOpenId(null);
                                }}>
                                  {category.status === 'active' ? 'Deactivate' : 'Activate'}
                                </button>
                                <button type="button" role="menuitem" onClick={() => setViewCategory({ ...category, assetCount: category.assetCount, showAssets: true })}>View Assets</button>
                                {canDeleteCategory && (
                                  <button type="button" role="menuitem" className="danger" onClick={() => handleDeleteClick(category)}>
                                    Delete
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="asset-category-mobile-list" aria-label="Asset category cards">
            {filteredCategories.map((category) => (
              <div key={category.id} className="asset-category-mobile-card">
                <div className="asset-category-mobile-header">
                  <div className="asset-category-name-cell">
                    <span className="asset-category-name-icon" aria-hidden="true"><Package size={14} /></span>
                    <span>{category.name}</span>
                  </div>
                  <span className={`asset-category-status-badge ${category.status === 'active' ? 'is-active' : 'is-inactive'}`}>
                    <span className="asset-category-status-dot" aria-hidden="true" />
                    {categoryStatusLabel(category.status)}
                  </span>
                </div>

                <p className="asset-category-mobile-description">{category.description || 'No description available.'}</p>

                <div className="asset-category-mobile-meta">
                  <span>{category.assetCount} assets</span>
                  <span>{category.createdAt ? new Date(category.createdAt).toLocaleDateString() : 'No date'}</span>
                </div>

                <div className="asset-category-actions mobile-actions">
                  <button type="button" className="asset-category-link-button" onClick={() => setViewCategory(category)}>View</button>
                  {canManageCategories && (
                    <button type="button" className="asset-category-link-button" onClick={() => openEditForm(category)}>Edit</button>
                  )}
                  {canManageCategories && (
                    <div className="asset-category-menu-wrap">
                      <button type="button" className="asset-category-menu-button" onClick={() => setMenuOpenId((current) => current === category.id ? null : category.id)} aria-label={`More actions for ${category.name}`}>
                        <MoreHorizontal size={16} aria-hidden="true" />
                      </button>
                      {menuOpenId === category.id && (
                        <div className="asset-category-menu" role="menu" aria-label={`Actions for ${category.name}`}>
                          <button type="button" role="menuitem" onClick={() => setViewCategory(category)}>View</button>
                          <button type="button" role="menuitem" onClick={() => openEditForm(category)}>Edit</button>
                          <button type="button" role="menuitem" onClick={() => {
                            const nextStatus = category.status === 'active' ? 'inactive' : 'active';
                            setCategories((previous) => previous.map((item) => String(item.id) === String(category.id) ? { ...item, status: nextStatus } : item));
                            axios.put(`/api/categories/${category.id}`, { ...category, status: nextStatus })
                              .catch((updateError) => setError(updateError?.response?.data?.message || 'Unable to update category status.'));
                            setMenuOpenId(null);
                          }}>
                            {category.status === 'active' ? 'Deactivate' : 'Activate'}
                          </button>
                          <button type="button" role="menuitem" onClick={() => setViewCategory({ ...category, assetCount: category.assetCount, showAssets: true })}>View Assets</button>
                          {canDeleteCategory && (
                            <button type="button" role="menuitem" className="danger" onClick={() => handleDeleteClick(category)}>Delete</button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {isFormOpen && (
        <div className="asset-category-modal-backdrop" onClick={() => { setIsFormOpen(false); resetCategoryForm(); }}>
          <div className="asset-category-modal" role="dialog" aria-modal="true" aria-labelledby="category-form-title" onClick={(event) => event.stopPropagation()}>
            <div className="asset-category-modal-header">
              <div>
                <span className="asset-category-modal-kicker">Asset Management</span>
                <h3 id="category-form-title">{editingId ? 'Edit Category' : 'Create Category'}</h3>
              </div>
              <button type="button" className="asset-category-close-button" onClick={() => { setIsFormOpen(false); resetCategoryForm(); }} aria-label="Close category form">
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <div className="asset-category-form-grid">
              <label className="asset-category-field">
                <span>Category Name <strong aria-hidden="true">*</strong></span>
                <input
                  type="text"
                  value={form.name}
                  onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))}
                  placeholder="Computer Equipment"
                />
                {formErrors.name && <small>{formErrors.name}</small>}
              </label>

              <label className="asset-category-field">
                <span>Category Code</span>
                <input
                  type="text"
                  value={form.code}
                  onChange={(event) => setForm((previous) => ({ ...previous, code: event.target.value }))}
                  placeholder="COMP-IT"
                />
                {formErrors.code && <small>{formErrors.code}</small>}
              </label>

              <label className="asset-category-field full-width">
                <span>Description</span>
                <textarea
                  rows={4}
                  value={form.description}
                  onChange={(event) => setForm((previous) => ({ ...previous, description: event.target.value }))}
                  placeholder="Computers, laptops, accessories and related equipment."
                />
              </label>

              <label className="asset-category-field">
                <span>Status</span>
                <select value={form.status} onChange={(event) => setForm((previous) => ({ ...previous, status: event.target.value }))}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
                {formErrors.status && <small>{formErrors.status}</small>}
              </label>

              <label className="asset-category-field">
                <span>Icon</span>
                <select value={form.icon} onChange={(event) => setForm((previous) => ({ ...previous, icon: event.target.value }))}>
                  <option value="package">Package</option>
                  <option value="folder">Folder</option>
                  <option value="layers">Layers</option>
                </select>
              </label>
            </div>

            {formErrors.submit && (
              <div className="asset-category-form-error" role="alert">{formErrors.submit}</div>
            )}

            <div className="asset-category-modal-actions">
              <button type="button" className="asset-category-secondary-button" onClick={() => { setIsFormOpen(false); resetCategoryForm(); }}>
                Cancel
              </button>
              <button type="button" className="asset-category-primary-button" onClick={saveCategory} disabled={saving}>
                {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Category'}
              </button>
            </div>
          </div>
        </div>
      )}

      {(viewCategory || deleteCandidate) && (
        <div className="asset-category-modal-backdrop" onClick={() => { setViewCategory(null); setDeleteCandidate(null); }}>
          <div className="asset-category-modal asset-category-modal--compact" role="dialog" aria-modal="true" aria-labelledby="category-detail-title" onClick={(event) => event.stopPropagation()}>
            {deleteCandidate ? (
              <>
                <div className="asset-category-modal-header">
                  <div>
                    <span className="asset-category-modal-kicker">Delete protection</span>
                    <h3 id="category-detail-title">Category Cannot Be Deleted</h3>
                  </div>
                  <button type="button" className="asset-category-close-button" onClick={() => setDeleteCandidate(null)} aria-label="Close delete confirmation">
                    <X size={18} aria-hidden="true" />
                  </button>
                </div>

                <div className="asset-category-delete-panel">
                  <p>This category is currently used by <strong>{deleteCandidate.assetCount}</strong> assets.</p>
                  <p>Move or update those assets before deleting this category.</p>
                </div>

                <div className="asset-category-modal-actions">
                  <button type="button" className="asset-category-primary-button" onClick={() => setDeleteCandidate(null)}>Close</button>
                </div>
              </>
            ) : (
              <>
                <div className="asset-category-modal-header">
                  <div>
                    <span className="asset-category-modal-kicker">Category Details</span>
                    <h3 id="category-detail-title">{viewCategory?.name}</h3>
                  </div>
                  <button type="button" className="asset-category-close-button" onClick={() => setViewCategory(null)} aria-label="Close category details">
                    <X size={18} aria-hidden="true" />
                  </button>
                </div>

                <div className="asset-category-detail-grid">
                  <div>
                    <span>Name</span>
                    <strong>{viewCategory?.name}</strong>
                  </div>
                  <div>
                    <span>Status</span>
                    <strong>{categoryStatusLabel(viewCategory?.status)}</strong>
                  </div>
                  <div>
                    <span>Code</span>
                    <strong>{viewCategory?.code || '—'}</strong>
                  </div>
                  <div>
                    <span>Assets</span>
                    <strong>{viewCategory?.assetCount ?? 0}</strong>
                  </div>
                </div>

                <div className="asset-category-detail-description">
                  <span>Description</span>
                  <p>{viewCategory?.description || 'No description provided for this category.'}</p>
                </div>

                <div className="asset-category-modal-actions">
                  <button type="button" className="asset-category-secondary-button" onClick={() => setViewCategory(null)}>Close</button>
                  {canManageCategories && (
                    <button type="button" className="asset-category-primary-button" onClick={() => {
                      setViewCategory(null);
                      openEditForm(viewCategory);
                    }}>
                      Edit Category
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const AdminAssetLocations = () => {
  const [locations, setLocations] = useState([]);
  const [summary, setSummary] = useState({ totalLocations: 0, activeLocations: 0, locationsWithAssets: 0, totalAssets: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [form, setForm] = useState({ name: '', code: '', description: '', status: 'active' });
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [statsResponse, locationsResponse] = await Promise.all([
        axios.get('/api/locations/stats').catch(() => ({ data: { summary: { totalLocations: 0, activeLocations: 0, locationsWithAssets: 0, totalAssets: 0 } } })),
        axios.get('/api/locations', { params: { search: search.trim(), status: statusFilter !== 'all' ? statusFilter : undefined } }).catch(() => ({ data: { locations: [] } }))
      ]);

      const stats = statsResponse?.data?.summary || statsResponse?.data?.data || { totalLocations: 0, activeLocations: 0, locationsWithAssets: 0, totalAssets: 0 };
      setSummary(stats);
      setLocations(normalizeListResponse(locationsResponse?.data ?? []) || []);
    } catch (loadError) {
      setSummary({ totalLocations: 0, activeLocations: 0, locationsWithAssets: 0, totalAssets: 0 });
      setLocations([]);
      setError('Unable to load locations.');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredLocations = useMemo(() => {
    const query = search.trim().toLowerCase();
    return locations.filter((location) => {
      const matchesQuery = !query || [location.name, location.code, location.description].some((value) => String(value || '').toLowerCase().includes(query));
      const matchesStatus = statusFilter === 'all' || String(location.status || 'active') === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [locations, search, statusFilter]);

  const saveLocation = async () => {
    const name = form.name.trim();
    if (!name) {
      alert('Location name is required.');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await axios.put(`/api/locations/${editingId}`, {
          name,
          code: form.code.trim(),
          description: form.description.trim(),
          status: form.status,
        });
      } else {
        await axios.post('/api/locations', {
          name,
          code: form.code.trim(),
          description: form.description.trim(),
          status: form.status,
        });
      }

      setForm({ name: '', code: '', description: '', status: 'active' });
      setEditingId(null);
      await loadData();
    } catch (saveError) {
      alert(saveError.response?.data?.message || 'Could not save the location. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const removeLocation = async (locationId) => {
    if (!window.confirm('Delete this location? If it is referenced by assets, the backend will block the delete and suggest deactivation.')) return;

    try {
      await axios.delete(`/api/locations/${locationId}`);
      await loadData();
    } catch (removeError) {
      alert(removeError.response?.data?.message || 'Could not delete the location. Please try again.');
    }
  };

  const startEdit = (location) => {
    setEditingId(location.id);
    setForm({
      name: location.name || '',
      code: location.code || '',
      description: location.description || '',
      status: ['active', 'inactive'].includes(String(location.status || 'active')) ? String(location.status || 'active') : 'active',
    });
  };

  const resetForm = () => {
    setEditingId(null);
    setForm({ name: '', code: '', description: '', status: 'active' });
  };

  return (
    <div style={{ padding: '24px', background: '#ffffff', borderRadius: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ color: '#5a6b8a', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Admin / Organization</div>
          <h2 style={{ margin: '8px 0 0', color: '#1a365d', fontSize: '2rem' }}>Locations</h2>
          <div style={{ color: '#64748b', marginTop: '6px' }}>Manage university physical locations where assets are stored, assigned, transferred, and tracked.</div>
        </div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button type="button" onClick={loadData} style={{ background: '#e2e8f0', color: '#1a365d', border: 'none', borderRadius: '10px', padding: '10px 16px', cursor: 'pointer', fontWeight: 700 }}>
            Refresh
          </button>
          <button type="button" onClick={resetForm} style={{ background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 18px', cursor: 'pointer', fontWeight: 700 }}>
            Create Location
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '16px', marginBottom: '20px' }}>
        {[
          { label: 'Total Locations', subtitle: 'Registered physical locations', value: summary.totalLocations || 0, accent: '#1d4ed8' },
          { label: 'Active Locations', subtitle: 'Operational locations', value: summary.activeLocations || 0, accent: '#16a34a' },
          { label: 'Locations With Assets', subtitle: 'Locations currently containing assets', value: summary.locationsWithAssets || 0, accent: '#7c3aed' },
          { label: 'Assets Across Locations', subtitle: 'Assets currently linked to locations', value: summary.totalAssets || 0, accent: '#f59e0b' },
        ].map((card) => (
          <div key={card.label} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '18px 20px', minHeight: '120px' }}>
            <div style={{ color: card.accent, fontSize: '0.7rem', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 800 }}>Location</div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a', margin: '12px 0 8px' }}>{Number(card.value).toLocaleString()}</div>
            <div style={{ color: '#1a365d', fontWeight: 700 }}>{card.label}</div>
            <div style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '4px' }}>{card.subtitle}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 360px) minmax(0, 1fr)', gap: '20px', marginBottom: '20px' }}>
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px' }}>
          <h3 style={{ margin: '0 0 16px', color: '#1a365d' }}>{editingId ? 'Edit Location' : 'Create Location'}</h3>
          <div style={{ display: 'grid', gap: '12px' }}>
            <input value={form.name} onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))} placeholder="Location name" style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
            <input value={form.code} onChange={(event) => setForm((previous) => ({ ...previous, code: event.target.value }))} placeholder="Location code" style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
            <select value={form.status} onChange={(event) => setForm((previous) => ({ ...previous, status: event.target.value }))} style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <textarea value={form.description} onChange={(event) => setForm((previous) => ({ ...previous, description: event.target.value }))} placeholder="Location description" rows={4} style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', resize: 'vertical' }} />
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button type="button" disabled={saving} onClick={saveLocation} style={{ background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 16px', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 600 }}>
                {saving ? 'Saving...' : (editingId ? 'Save Changes' : 'Create Location')}
              </button>
              {editingId && <button type="button" onClick={resetForm} style={{ background: '#e2e8f0', color: '#1a365d', border: 'none', borderRadius: '8px', padding: '10px 16px', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>}
            </div>
          </div>
        </div>

        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0, color: '#1a365d' }}>Location List</h3>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search locations" style={{ padding: '9px 12px', minWidth: '220px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} style={{ padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
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
                    <div style={{ fontWeight: 700, color: '#1a365d', fontSize: '1rem' }}>{location.name || 'Unnamed location'}</div>
                    <div style={{ color: '#4a5568', fontSize: '0.85rem', marginTop: '4px' }}>{location.code || 'No code'} · {location.status === 'active' ? 'Active' : 'Inactive'}</div>
                    <div style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '2px' }}>{location.description || 'No description available'}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <span style={{ background: '#ecfeff', color: '#0f766e', borderRadius: '999px', padding: '5px 10px', fontSize: '0.8rem', fontWeight: 600 }}>{Number(location.assetCount || 0)} assets</span>
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
  const [statusFilter, setStatusFilter] = useState('all');
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({
    assetId: '',
    type: 'Retirement',
    condition: 'Fair',
    reason: '',
    technicalAssessment: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const normalizeRequest = (row = {}) => {
    const request = row || {};
    const status = String(request.status || 'Requested').trim();
    return {
      ...request,
      id: request.id,
      asset: request.asset || request.Asset || null,
      disposalNumber: request.disposalNumber || request.disposal_number || request.request_number || `DSP-${request.id || 'NEW'}`,
      assetName: request.assetName || request.asset_name || request.asset?.name || `Asset ${request.assetId || request.asset_id || ''}`,
      status,
      reason: request.reason || '',
      condition: request.condition || request.asset?.condition || 'Fair',
      createdAt: request.createdAt || request.created_at || null,
      purchaseValue: request.purchaseValue ?? request.purchase_value ?? request.asset?.purchasePrice ?? 0,
      bookValue: request.bookValue ?? request.book_value ?? request.asset?.currentValue ?? 0,
      netBookValue: request.netBookValue ?? request.net_book_value ?? request.bookValue ?? request.bookValue ?? 0,
      estimatedDisposalValue: request.estimatedDisposalValue ?? request.estimated_disposal_value ?? 0,
      recoveryValue: request.recoveryValue ?? request.recovery_value ?? 0,
      disposalCost: request.disposalCost ?? request.disposal_cost ?? 0,
    };
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [assetsResponse, disposalsResponse] = await Promise.all([
        axios.get('/api/assets', { params: { page: 1, limit: 500 } }).catch(() => ({ data: { assets: [] } })),
        axios.get('/api/admin/disposals', { params: { page: 1, limit: 500, sortBy: 'createdAt', sortOrder: 'DESC' } }).catch(() => ({ data: { disposals: [] } }))
      ]);

      const assetRows = normalizeListResponse(assetsResponse?.data ?? []).filter((asset) => asset && (asset.status !== 'deleted' || asset.deletedAt == null));
      const requestRows = normalizeListResponse(disposalsResponse?.data ?? []).map(normalizeRequest);

      setAssets(assetRows);
      setRequests(requestRows);
    } catch (loadError) {
      console.error('Disposal load failed:', loadError);
      setAssets([]);
      setRequests([]);
      setError('Disposal service is not available right now.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const summary = useMemo(() => {
    const totalRequests = requests.length;
    const requested = requests.filter((request) => ['Requested', 'Under Review'].includes(String(request.status || ''))).length;
    const approved = requests.filter((request) => ['Approved', 'Scheduled'].includes(String(request.status || ''))).length;
    const rejected = requests.filter((request) => ['Rejected', 'Cancelled'].includes(String(request.status || ''))).length;
    const completed = requests.filter((request) => ['Disposed', 'Completed'].includes(String(request.status || ''))).length;
    const retiredAssets = assets.filter((asset) => ['retired', 'disposed'].includes(String(asset?.status || '').toLowerCase())).length;

    return {
      totalRequests,
      requested,
      approved,
      rejected,
      completed,
      retiredAssets,
    };
  }, [assets, requests]);

  const filteredRequests = useMemo(() => {
    const query = search.trim().toLowerCase();
    return requests.filter((request) => {
      const matchesSearch = !query || [
        request.asset?.name,
        request.assetName,
        request.disposalNumber,
        request.reason,
        request.status,
        request.type,
      ].some((value) => String(value || '').toLowerCase().includes(query));

      const matchesStatus = statusFilter === 'all' || String(request.status || '').toLowerCase() === String(statusFilter).toLowerCase();
      return matchesSearch && matchesStatus;
    });
  }, [requests, search, statusFilter]);

  const submitRequest = async () => {
    const assetId = form.assetId;
    const reason = String(form.reason || '').trim();

    if (!assetId || !reason) {
      setError('Asset and reason are required.');
      return;
    }

    setSaving(true);
    setError('');
    setNotice('');

    try {
      await axios.post('/api/admin/disposals', {
        assetId,
        reason,
        type: String(form.type || 'Retirement').trim(),
        condition: String(form.condition || 'Fair').trim(),
        technicalAssessment: String(form.technicalAssessment || '').trim(),
      });

      setForm({ assetId: '', type: 'Retirement', condition: 'Fair', reason: '', technicalAssessment: '' });
      setFormOpen(false);
      setNotice('Retirement request submitted successfully.');
      await loadData();
    } catch (saveError) {
      setError(saveError?.response?.data?.message || 'Unable to submit retirement request.');
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (requestId, action) => {
    try {
      if (action === 'approve') {
        await axios.post(`/api/admin/disposals/${requestId}/approve`);
      } else if (action === 'reject') {
        const rejectionReason = window.prompt('Rejection reason:', '');
        if (!rejectionReason || !String(rejectionReason).trim()) return;
        await axios.post(`/api/admin/disposals/${requestId}/reject`, { reason: String(rejectionReason).trim() });
      } else if (action === 'retire') {
        await axios.post(`/api/admin/disposals/${requestId}/retire`);
      } else if (action === 'dispose') {
        await axios.post(`/api/admin/disposals/${requestId}/execute`);
      }

      setNotice(action === 'dispose' ? 'Asset disposal executed and preserved in the historical record.' : 'Request updated successfully.');
      await loadData();
    } catch (statusError) {
      setError(statusError?.response?.data?.message || 'Unable to update disposal request.');
    }
  };

  const getStatusStyle = (status) => {
    const value = String(status || '').toLowerCase();
    if (value === 'approved' || value === 'scheduled') return { background: '#dbeafe', color: '#1d4ed8' };
    if (value === 'rejected' || value === 'cancelled') return { background: '#fee2e2', color: '#b91c1c' };
    if (value === 'retired' || value === 'disposed' || value === 'completed') return { background: '#e2e8f0', color: '#334155' };
    if (value === 'under review') return { background: '#fef3c7', color: '#b45309' };
    return { background: '#dcfce7', color: '#166534' };
  };

  const getActionButtons = (request) => {
    const status = String(request.status || 'Requested');
    if (status === 'Rejected' || status === 'Cancelled') return null;

    const buttons = [];
    if (status === 'Requested' || status === 'Under Review') {
      buttons.push({ label: 'Approve', action: 'approve', tone: 'success' });
      buttons.push({ label: 'Reject', action: 'reject', tone: 'danger' });
    }

    if (status === 'Approved' || status === 'Scheduled') {
      buttons.push({ label: 'Retire asset', action: 'retire', tone: 'neutral' });
      buttons.push({ label: 'Complete disposal', action: 'dispose', tone: 'success' });
    }

    if (status === 'Retired' || status === 'Disposed') {
      buttons.push({ label: 'View record', action: 'view', tone: 'neutral', disabled: true });
    }

    return buttons;
  };

  return (
    <div style={{ padding: '24px', background: '#f8fafc', minHeight: '100%' }}>
      <div style={{ maxWidth: '1600px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ color: '#64748b', fontSize: '0.76rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>Admin / Assets / Disposal & Retirement</div>
            <h2 style={{ margin: '8px 0 6px', color: '#0f172a', fontSize: '2.2rem', fontWeight: 800 }}>Disposal & Retirement</h2>
            <p style={{ margin: 0, color: '#475569', maxWidth: '900px', lineHeight: 1.6 }}>
              Manage asset retirement and disposal requests while preserving university asset history and audit records.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setFormOpen((previous) => !previous)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: '#0f172a',
              color: '#ffffff',
              padding: '12px 18px',
              borderRadius: '12px',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 10px 22px rgba(15, 23, 42, 0.16)',
              fontSize: '0.95rem',
              fontWeight: 700,
            }}
          >
            <FilePlus2 size={18} />
            + Create Retirement Request
          </button>
        </div>

        {error && (
          <div style={{ padding: '12px 14px', background: '#fff7ed', color: '#9a5b00', borderRadius: '12px', border: '1px solid #fed7aa', marginBottom: '18px' }}>{error}</div>
        )}

        {notice && (
          <div style={{ padding: '12px 14px', background: '#ecfdf5', color: '#166534', borderRadius: '12px', border: '1px solid #a7f3d0', marginBottom: '18px' }}>{notice}</div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          {[
            { label: 'Total Requests', value: summary.totalRequests, tone: '#0f172a' },
            { label: 'Requested', value: summary.requested, tone: '#f59e0b' },
            { label: 'Approved', value: summary.approved, tone: '#2563eb' },
            { label: 'Rejected', value: summary.rejected, tone: '#dc2626' },
            { label: 'Completed', value: summary.completed, tone: '#16a34a' },
            { label: 'Retired Assets', value: summary.retiredAssets, tone: '#7c3aed' },
          ].map((card) => (
            <div key={card.label} style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '18px 20px', boxShadow: '0 8px 18px rgba(15, 23, 42, 0.04)' }}>
              <div style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{card.label}</div>
              <div style={{ marginTop: '12px', color: card.tone, fontSize: '2rem', fontWeight: 800, lineHeight: 1 }}>{card.value}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 360px) minmax(0, 1fr)', gap: '20px' }}>
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', boxShadow: '0 8px 18px rgba(15, 23, 42, 0.04)', padding: '20px' }}>
            {formOpen ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                  <div>
                    <div style={{ color: '#64748b', fontSize: '0.76rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>Workflow</div>
                    <h3 style={{ margin: '8px 0 0', color: '#0f172a', fontSize: '1.35rem' }}>Create retirement request</h3>
                  </div>
                  <button type="button" onClick={() => setFormOpen(false)} style={{ border: '1px solid #e2e8f0', background: '#fff', borderRadius: '8px', width: '36px', height: '36px', cursor: 'pointer', color: '#475569' }} aria-label="Close form">
                    <X size={16} />
                  </button>
                </div>

                <div style={{ display: 'grid', gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', color: '#475569', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>Select asset</label>
                    <select
                      value={form.assetId}
                      onChange={(event) => setForm((previous) => ({ ...previous, assetId: event.target.value }))}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a' }}
                    >
                      <option value="">Select asset</option>
                      {assets.map((asset) => (
                        <option key={asset.id} value={asset.id}>
                          {asset.name || `Asset ${asset.assetCode || asset.id}`} {asset.assetCode ? `(${asset.assetCode})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', color: '#475569', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>Disposal / retirement type</label>
                    <select
                      value={form.type}
                      onChange={(event) => setForm((previous) => ({ ...previous, type: event.target.value }))}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a' }}
                    >
                      <option value="Retirement">Retirement</option>
                      <option value="Disposal">Disposal</option>
                      <option value="Scrap">Scrap</option>
                      <option value="Transfer">Transfer</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', color: '#475569', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>Asset condition</label>
                    <select
                      value={form.condition}
                      onChange={(event) => setForm((previous) => ({ ...previous, condition: event.target.value }))}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a' }}
                    >
                      <option value="Good">Good</option>
                      <option value="Fair">Fair</option>
                      <option value="Poor">Poor</option>
                      <option value="Damaged">Damaged</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', color: '#475569', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>Disposal reason</label>
                    <textarea
                      value={form.reason}
                      onChange={(event) => setForm((previous) => ({ ...previous, reason: event.target.value }))}
                      rows={4}
                      placeholder="Describe why the asset is being retired or disposed."
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', resize: 'vertical', background: '#fff', color: '#0f172a' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', color: '#475569', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>Technical assessment (optional)</label>
                    <textarea
                      value={form.technicalAssessment}
                      onChange={(event) => setForm((previous) => ({ ...previous, technicalAssessment: event.target.value }))}
                      rows={3}
                      placeholder="Condition assessment, repair viability, or disposal notes"
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', resize: 'vertical', background: '#fff', color: '#0f172a' }}
                    />
                  </div>

                  <button
                    type="button"
                    disabled={saving}
                    onClick={submitRequest}
                    style={{
                      background: '#0f172a',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '10px',
                      padding: '11px 16px',
                      fontWeight: 700,
                      cursor: saving ? 'not-allowed' : 'pointer',
                      opacity: saving ? 0.7 : 1,
                    }}
                  >
                    {saving ? 'Submitting request...' : 'Submit request'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', minHeight: '200px', textAlign: 'center', color: '#64748b' }}>
                  <Archive size={42} style={{ marginBottom: '12px', color: '#94a3b8' }} />
                  <h3 style={{ margin: '0 0 8px', color: '#0f172a' }}>No request form open</h3>
                  <p style={{ margin: 0, maxWidth: '260px' }}>Use the action above to start a retirement or disposal request tied to real university asset records.</p>
                </div>
              </>
            )}
          </div>

          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', boxShadow: '0 8px 18px rgba(15, 23, 42, 0.04)', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap' }}>
              <div>
                <div style={{ color: '#64748b', fontSize: '0.76rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>Queue</div>
                <h3 style={{ margin: '8px 0 0', color: '#0f172a', fontSize: '1.35rem' }}>Disposal requests</h3>
              </div>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative' }}>
                  <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search requests"
                    style={{ padding: '9px 12px 9px 34px', borderRadius: '10px', border: '1px solid #cbd5e1', minWidth: '210px', background: '#fff' }}
                  />
                </div>
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} style={{ padding: '9px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', background: '#fff' }}>
                  <option value="all">All statuses</option>
                  <option value="Requested">Requested</option>
                  <option value="Under Review">Under Review</option>
                  <option value="Approved">Approved</option>
                  <option value="Rejected">Rejected</option>
                  <option value="Scheduled">Scheduled</option>
                  <option value="Retired">Retired</option>
                  <option value="Disposed">Disposed</option>
                </select>
              </div>
            </div>

            {loading ? (
              <div style={{ padding: '26px 0', color: '#475569' }}>Loading disposal records from the university asset database...</div>
            ) : filteredRequests.length === 0 ? (
              <div style={{ padding: '22px', borderRadius: '12px', background: '#f8fafc', border: '1px dashed #cbd5e1', color: '#475569', textAlign: 'center' }}>
                No matching disposal requests were found.
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '14px' }}>
                {filteredRequests.map((request) => {
                  const buttons = getActionButtons(request);
                  const asset = request.asset || {};
                  return (
                    <div key={request.id} style={{ border: '1px solid #e2e8f0', borderRadius: '14px', background: '#fff', padding: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '1.1rem' }}>{request.assetName || asset.name || `Asset ${request.assetId || request.asset_id || ''}`}</div>
                          <div style={{ color: '#64748b', fontSize: '0.82rem', marginTop: '4px' }}>
                            {request.disposalNumber || `${request.type || 'Retirement'} #${request.id}`} · {request.type || 'Retirement'}
                          </div>
                        </div>
                        <span style={{ ...getStatusStyle(request.status), padding: '6px 10px', borderRadius: '999px', fontSize: '0.76rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          {request.status || 'Requested'}
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginTop: '14px' }}>
                        <div>
                          <div style={{ color: '#64748b', fontSize: '0.76rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date</div>
                          <div style={{ color: '#0f172a', fontWeight: 600, marginTop: '4px' }}>{request.createdAt ? new Date(request.createdAt).toLocaleDateString() : 'Not set'}</div>
                        </div>
                        <div>
                          <div style={{ color: '#64748b', fontSize: '0.76rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Condition</div>
                          <div style={{ color: '#0f172a', fontWeight: 600, marginTop: '4px' }}>{request.condition || asset.condition || 'Not set'}</div>
                        </div>
                        <div>
                          <div style={{ color: '#64748b', fontSize: '0.76rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Book value</div>
                          <div style={{ color: '#0f172a', fontWeight: 600, marginTop: '4px' }}>{Number(request.netBookValue || request.bookValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                        </div>
                        <div>
                          <div style={{ color: '#64748b', fontSize: '0.76rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Recovery value</div>
                          <div style={{ color: '#0f172a', fontWeight: 600, marginTop: '4px' }}>{Number(request.estimatedDisposalValue || request.recoveryValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                        </div>
                      </div>

                      {request.reason && (
                        <div style={{ marginTop: '14px', padding: '10px 12px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', color: '#475569' }}>
                          <strong style={{ color: '#0f172a' }}>Reason:</strong> {request.reason}
                        </div>
                      )}

                      {buttons && buttons.length > 0 && (
                        <div style={{ display: 'flex', gap: '10px', marginTop: '14px', flexWrap: 'wrap' }}>
                          {buttons.map((button) => (
                            <button
                              key={button.action}
                              type="button"
                              onClick={() => {
                                if (button.action === 'view') return;
                                updateStatus(request.id, button.action);
                              }}
                              disabled={button.disabled}
                              style={{
                                background: button.tone === 'danger' ? '#dc2626' : button.tone === 'success' ? '#16a34a' : '#e2e8f0',
                                color: button.tone === 'neutral' ? '#0f172a' : '#fff',
                                border: 'none',
                                borderRadius: '10px',
                                padding: '8px 12px',
                                cursor: button.disabled ? 'default' : 'pointer',
                                fontWeight: 700,
                                opacity: button.disabled ? 0.7 : 1,
                              }}
                            >
                              {button.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
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
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState('');

  const documentTypes = ['Invoice', 'Warranty', 'Purchase Document', 'Maintenance Document', 'Transfer Document', 'Assignment Document', 'Disposal Document', 'Other'];

  const readFileAsBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

  const mapDocument = (raw, asset) => ({
    id: raw.id,
    assetId: String(raw.assetId),
    assetName: asset?.name || raw.assetName || raw.asset?.name || `Asset ${raw.assetId}`,
    name: raw.originalName || raw.fileName || raw.name || 'Document',
    type: raw.documentType || raw.document_type || raw.type || 'Other',
    uploadedAt: String(raw.createdAt || raw.uploadedAt || '').slice(0, 10),
    size: raw.fileSize ? `${Math.max(1, Math.round(Number(raw.fileSize) / 1024))} KB` : 'Unknown size'
  });

  const loadDocuments = useCallback(async (assetId) => {
    setLoading(true);
    try {
      const queryId = assetId === 'all' ? null : String(assetId);
      let rows = [];
      if (queryId) {
        const response = await axios.get(`/api/assets/${queryId}/documents`).catch(() => ({ data: { documents: [] } }));
        rows = normalizeListResponse(response?.data ?? []);
      } else {
        const targets = assets.slice(0, 40);
        const settled = await Promise.allSettled(
          targets.map((asset) => axios.get(`/api/assets/${asset.id}/documents`).catch(() => ({ data: { documents: [] } })))
        );
        rows = settled.flatMap((entry) => (entry.status === 'fulfilled' ? normalizeListResponse(entry.value?.data ?? []) : []));
      }
      const assetById = new Map(assets.map((asset) => [String(asset.id), asset]));
      setDocuments(rows.map((raw) => mapDocument(raw, assetById.get(String(raw.assetId)))));
    } catch (error) {
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [assets]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const assetsResponse = await axios.get('/api/assets').catch(() => ({ data: { assets: [] } }));
        const assetRows = normalizeListResponse(assetsResponse?.data ?? []);
        setAssets(assetRows);
      } catch (error) {
        setAssets([]);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    if (assets.length === 0) return;
    loadDocuments(assetFilter);
  }, [assetFilter, assets, loadDocuments]);

  const filteredDocuments = useMemo(() => {
    const query = search.trim().toLowerCase();
    return documents.filter((document) => {
      const matchesSearch = !query || [document.name, document.type, document.assetName].some((value) => String(value || '').toLowerCase().includes(query));
      const matchesAsset = assetFilter === 'all' || String(document.assetId) === String(assetFilter);
      const matchesType = typeFilter === 'all' || document.type === typeFilter;
      return matchesSearch && matchesAsset && matchesType;
    });
  }, [documents, search, assetFilter, typeFilter]);

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const targetAssetId = assetFilter === 'all' ? '' : String(assetFilter);
    if (!targetAssetId) {
      setNotice('Select a specific asset before uploading a document.');
      return;
    }
    setUploading(true);
    setNotice('');
    try {
      const base64 = await readFileAsBase64(file);
      await axios.post(`/api/assets/${targetAssetId}/documents`, {
        fileName: file.name,
        mimeType: file.type,
        data: base64,
        documentType: typeFilter === 'all' ? 'Other' : typeFilter,
        description: ''
      });
      await loadDocuments(targetAssetId);
      setNotice('Document uploaded successfully.');
    } catch (uploadError) {
      setNotice(uploadError?.response?.data?.message || 'Failed to upload document.');
    } finally {
      setUploading(false);
    }
  };

  const removeDocument = async (document) => {
    try {
      await axios.delete(`/api/assets/${document.assetId}/documents/${document.id}`);
      setDocuments((previous) => previous.filter((entry) => String(entry.id) !== String(document.id)));
    } catch (deleteError) {
      setNotice(deleteError?.response?.data?.message || 'Failed to remove document.');
    }
  };

  const openDocument = async (document) => {
    try {
      const response = await axios.get(`/api/assets/${document.assetId}/documents/${document.id}/file`, { responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      window.open(url, '_blank');
    } catch (viewError) {
      setNotice('Unable to open the document file.');
    }
  };

  return (
    <div style={{ padding: '24px', background: '#ffffff', borderRadius: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ color: '#5a6b8a', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Admin / Assets</div>
          <h2 style={{ margin: '8px 0 0', color: '#1a365d', fontSize: '2rem' }}>📄 Asset Documents</h2>
        </div>
      </div>

      {notice && (
        <div style={{ padding: '12px 14px', borderRadius: '8px', background: '#eff6ff', color: '#1e40af', marginBottom: '16px' }}>{notice}</div>
      )}

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
            <label style={{ border: '1px dashed #94a3b8', background: '#fff', borderRadius: '8px', padding: '14px 12px', cursor: assetFilter === 'all' ? 'not-allowed' : 'pointer', fontWeight: 600, color: '#1a365d', textAlign: 'center', opacity: assetFilter === 'all' ? 0.6 : 1, pointerEvents: assetFilter === 'all' ? 'none' : 'auto' }}>
              <input type="file" onChange={handleUpload} style={{ display: 'none' }} disabled={assetFilter === 'all'} />
              {uploading ? 'Uploading...' : 'Upload file'}
            </label>
            {assetFilter === 'all' && <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Select an asset above to enable uploads.</div>}
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
                      <button type="button" onClick={() => removeDocument(document)} style={{ background: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: '8px', padding: '8px 12px', cursor: 'pointer' }}>Delete</button>
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

// ==========================================
// LAYOUT COMPONENT - Renders Outlet for nested routes
// ==========================================

const RoleLayout = () => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  return (
    <div style={{
      backgroundColor: isDark ? '#0f172a' : '#f8fafc',
      color: isDark ? '#cbd5e1' : '#1e293b',
      padding: '24px',
      minHeight: 'calc(100vh - var(--header-height))'
    }}>
      <Suspense fallback={<LoadingFallback />}>
        <Outlet />
      </Suspense>
    </div>
  );
};

const DashboardOverview = () => (
  <div style={{ display: 'grid', gap: '20px' }}>
    <div style={{ padding: '28px', borderRadius: '18px', background: '#fff', border: '1px solid #e2e8f0' }}>
      <h2 style={{ margin: 0, fontSize: '2rem', color: '#0f172a' }}>Dashboard Overview</h2>
      <p style={{ margin: '12px 0 0', color: '#475569' }}>Welcome to the asset management dashboard. Use the sidebar to navigate the system.</p>
    </div>
  </div>
);

const DashboardLayout = () => (
  <Suspense fallback={<LoadingFallback />}>
    <Outlet />
  </Suspense>
);

const EthiopianClock = ({ language, theme }) => {
  const [time, setTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const ethiopiaTime = new Date(now.getTime() + (3 * 60 * 60 * 1000));
      setTime(ethiopiaTime.toLocaleTimeString(language === 'en' ? 'en-US' : 'am-ET', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      }));
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, [language]);

  return (
    <div style={{
      minWidth: '140px',
      textAlign: 'right',
      color: theme.headerText,
      fontWeight: 700,
      display: 'flex',
      flexDirection: 'column',
      gap: '2px',
      lineHeight: 1.3,
      fontSize: '0.78rem'
    }} aria-live="polite">
      <span style={{ opacity: 0.9, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        {language === 'en' ? 'Ethiopia Time' : 'የኢትዮጵያ ሰዓት'}
      </span>
      <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.9rem' }}>{time}</span>
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
      backgroundColor: isDark ? '#0f172a' : '#f8fafc',
      minHeight: 'calc(100vh - var(--header-height))'
    }}>
      {/* Main Content */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        maxHeight: 'calc(100vh - var(--header-height))',
        padding: '24px',
        color: isDark ? '#cbd5e1' : '#1e293b'
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
  const { language, setLanguage } = useLanguage();
  const { theme, setTheme } = useTheme();
  const [logoError, setLogoError] = useState(false);
  const [organizationProfile, setOrganizationProfile] = useState({
    name: 'Mekdela Amba University',
    institutionName: 'Mekdela Amba University',
    logo: UNIVERSITY_LOGO,
    website: '',
    email: '',
    phone: '',
    address: ''
  });
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [collegeManagementOpen, setCollegeManagementOpen] = useState(() => JSON.parse(localStorage.getItem('collegeManagementOpen') || 'true'));
  const [departmentManagementOpen, setDepartmentManagementOpen] = useState(() => JSON.parse(localStorage.getItem('departmentManagementOpen') || 'false'));
  const [departmentsNavOpen, setDepartmentsNavOpen] = useState(() => JSON.parse(localStorage.getItem('departmentsNavOpen') || (location.pathname.startsWith('/department') ? 'true' : 'false')));
  const [pendingPublicPath, setPendingPublicPath] = useState(null);
  const allowPublicNavigationRef = useRef(false);
  const logoutDestinationRef = useRef(null);
  const notificationMenuRef = useRef(null);
  const mobileNavRef = useRef(null);
  const mobileNavToggleRef = useRef(null);

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
    if (!user) {
      setUnreadNotificationCount(0);
      return;
    }

    let active = true;

    const fetchUnreadNotificationCount = async () => {
      try {
        const unreadResponse = await apiClient.get('/api/notifications/unread-count');
        const unreadCount = Number(unreadResponse?.data?.unreadCount ?? unreadResponse?.data?.count ?? 0);
        if (active) setUnreadNotificationCount(unreadCount);
      } catch (error) {
        if (active) setUnreadNotificationCount(0);
      }
    };

    fetchUnreadNotificationCount();
    const interval = window.setInterval(fetchUnreadNotificationCount, 30000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [user?.id, user?.role, location.pathname]);

  useEffect(() => {
    const handleDocumentClick = (event) => {
      if (notificationMenuRef.current && !notificationMenuRef.current.contains(event.target)) {
        setProfileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleDocumentClick);
    return () => document.removeEventListener('mousedown', handleDocumentClick);
  }, []);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileNavOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      setMobileNavOpen(false);
      mobileNavToggleRef.current?.focus();
    };

    const handleDocumentClick = (event) => {
      const panel = mobileNavRef.current;
      const toggle = mobileNavToggleRef.current;
      const target = event.target;
      if (panel?.contains(target) || toggle?.contains(target)) return;
      setMobileNavOpen(false);
    };

    const handleResize = () => {
      if (window.innerWidth > 1023) setMobileNavOpen(false);
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleDocumentClick);
    window.addEventListener('resize', handleResize);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleDocumentClick);
      window.removeEventListener('resize', handleResize);
    };
  }, [mobileNavOpen]);

  useEffect(() => {
    const collegeManagementActive = [
      '/college',
      '/college/profile',
      '/college/staff',
      '/college/locations',
      '/college/departments',
      '/college/assets',
      '/college/inventory',
      '/college/requests',
      '/college/approvals',
      '/college/assignments',
      '/college/transfers',
      '/college/returns',
      '/college/maintenance',
      '/college/rfid',
      '/college/verification',
      '/college/reports',
      '/college/analytics/assets',
      '/college/analytics/departments',
      '/college/notifications',
      '/college/history'
    ].includes(location.pathname);
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
    let active = true;

    if (authLoading || user?.role !== 'admin') {
      return () => { active = false; };
    }

    const fetchOrganizationProfile = async () => {
      try {
        const response = await apiClient.get('/api/admin/settings', { timeout: 10000 });
        const raw = response?.data?.settings?.organization || response?.data?.data?.organization || {};
        const nextProfile = {
          name: raw.orgName || raw.university_name || 'Mekdela Amba University',
          institutionName: raw.instName || raw.institution_name || raw.orgName || 'Mekdela Amba University',
          logo: raw.logo || raw.logo_url || UNIVERSITY_LOGO,
          website: raw.website || '',
          email: raw.email || raw.contact_email || '',
          phone: raw.phone || raw.contact_phone || '',
          address: raw.address || ''
        };
        if (active) setOrganizationProfile(nextProfile);
      } catch (error) {
        if (active) setOrganizationProfile((current) => current || {
          name: 'Mekdela Amba University',
          institutionName: 'Mekdela Amba University',
          logo: UNIVERSITY_LOGO,
          website: '',
          email: '',
          phone: '',
          address: ''
        });
      }
    };

    fetchOrganizationProfile();
    return () => { active = false; };
  }, [authLoading, user?.role]);

  const handleLogout = async () => {
    logoutDestinationRef.current = '/login';
    allowPublicNavigationRef.current = true;
    navigate('/login', { replace: true });
    await logout();
    navigate('/login', { replace: true });
  };

  const dashboardRoute = getDashboardRoute(user?.role);
  const publicPaths = ['/home', '/about', '/contact', '/register', '/forgot-password', '/reset-password'];
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
      headerBg: '#B1BAC4',
      headerText: '#17212B',
      footerBg: '#687784',
      footerText: '#FFFFFF',
      mainBg: '#F5F7F9',
      mainText: '#17212B',
      cardBg: '#FFFFFF',
      cardBorder: '#D7DEE5',
      cardShadow: 'none',
      sidebarBg: '#8F9BA7',
      sidebarHover: '#C5CED6',
      sidebarActive: '#D9E0E6',
      accent: '#536575',
      accentLight: '#EEF2F5',
      subText: '#334155',
      danger: '#EF4444',
      success: '#10B981'
    },
    dark: {
      headerBg: '#B1BAC4',
      headerText: '#17212B',
      footerBg: '#687784',
      footerText: '#FFFFFF',
      mainBg: '#F5F7F9',
      mainText: '#17212B',
      cardBg: '#FFFFFF',
      cardBorder: '#D7DEE5',
      cardShadow: 'none',
      sidebarBg: '#8F9BA7',
      sidebarHover: '#C5CED6',
      sidebarActive: '#D9E0E6',
      accent: '#536575',
      accentLight: '#EEF2F5',
      subText: '#334155',
      danger: '#EF4444',
      success: '#10B981'
    }
  };

  const currentTheme = themeStyles[theme];

  // ==========================================
  // HEADER COMPONENT
  // ==========================================

  // Only destinations backed by a real registered route are listed here.
  // Services / Features / Help are intentionally absent: no such route exists.
  const publicNavLinks = [
    { to: '/home', label: t.home, icon: HomeIcon },
    { to: '/about', label: t.about, icon: Info },
    { to: '/contact', label: t.contact, icon: Mail }
  ];

  const isPublicNavActive = (to) => {
    if (to === '/home') return location.pathname === '/' || location.pathname === '/home';
    return location.pathname === to || location.pathname.startsWith(`${to}/`);
  };

  const HeaderLink = ({ to, children, icon: Icon, className = '' }) => {
    const active = isPublicNavActive(to);
    return (
      <Link
        to={to}
        onClick={(event) => requestPublicNavigation(to, event)}
        aria-current={active ? 'page' : undefined}
        className={`public-nav-link${active ? ' is-active' : ''}${className ? ` ${className}` : ''}`}
        style={{
          color: !user && (location.pathname === '/' || location.pathname === '/home') ? '#FFFFFF' : currentTheme.headerText,
          textDecoration: 'none',
          fontWeight: 700,
          fontSize: '1.08rem',
          cursor: 'pointer',
          letterSpacing: '0.01em'
        }}
      >
        {Icon ? <Icon size={17} aria-hidden="true" className="public-nav-link-icon" /> : null}
        <span>{children}</span>
      </Link>
    );
  };

  const Header = () => {
    const onHomeRoute = !user && (location.pathname === '/' || location.pathname === '/home');
    const headerTextColor = onHomeRoute ? '#FFFFFF' : currentTheme.headerText;

    const LanguageToggle = ({ variant }) => (
      <button
        type="button"
        onClick={toggleLanguage}
        aria-label={language === 'en' ? 'Switch to Amharic' : 'Switch to English'}
        className={`public-language-toggle${variant ? ` ${variant}` : ''}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
          background: '#FFFFFF',
          border: '1px solid #CBD5E1',
          padding: '4px 10px',
          borderRadius: '5px',
          cursor: 'pointer',
          color: '#0F172A',
          fontSize: '0.8rem',
          fontWeight: 600
        }}
      >
        <Languages size={15} aria-hidden="true" />
        <span>{language === 'en' ? 'አማ' : 'EN'}</span>
      </button>
    );

    const ThemeToggle = () => (
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
        className="public-theme-toggle"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#E2E8F0',
          border: '1px solid #CBD5E1',
          padding: '4px 10px',
          borderRadius: '5px',
          cursor: 'pointer',
          color: '#0F172A',
          fontSize: '0.9rem'
        }}
      >
        {theme === 'light' ? <Moon size={16} aria-hidden="true" /> : <Sun size={16} aria-hidden="true" />}
      </button>
    );

    const LoginButton = () => (
      <Link className="public-login-button" to="/login" style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        background: '#ffffff',
        color: '#17212B',
        textDecoration: 'none',
        padding: '10px 18px',
        borderRadius: 12,
        fontWeight: 800,
        fontSize: '1.02rem',
        minHeight: '48px',
        boxShadow: '0 4px 10px rgba(23, 43, 61, 0.12)'
      }}>
        <LockKeyhole size={18} aria-hidden="true" />
        <span>{t.login}</span>
      </Link>
    );

    return (
      <header
        className={`app-header public-site-header${onHomeRoute ? ' home-public-header' : ''}${mobileNavOpen ? ' mobile-nav-open' : ''}`}
        style={{
          background: onHomeRoute ? 'rgba(15, 23, 42, 0.38)' : '#5e7f95',
          color: headerTextColor,
          padding: '0.9rem 2rem',
          borderBottom: '1px solid rgba(23, 33, 43, 0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '20px',
          width: '100%',
          boxSizing: 'border-box',
          boxShadow: 'none',
          position: onHomeRoute ? 'absolute' : 'sticky',
          top: 0,
          left: 0,
          zIndex: 50
        }}
      >
        <div className="app-header-brand" style={{ display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap', flex: '1 1 auto', minWidth: 0 }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '14px',
            border: '1px solid rgba(255,255,255,0.7)',
            background: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            flexShrink: 0,
            boxShadow: '0 4px 12px rgba(23, 43, 61, 0.12)'
          }}>
            {!logoError ? (
              <img
                src={organizationProfile.logo || UNIVERSITY_LOGO}
                alt={organizationProfile.name || 'Institution logo'}
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                onError={handleLogoError}
              />
            ) : (
              <span style={{ fontSize: '1.5rem' }}>🏫</span>
            )}
          </div>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: 'clamp(1.1rem, 2.4vw, 2.1rem)', fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.12, color: headerTextColor }}>
              {organizationProfile.name || t.university}
            </h1>
            <p style={{ margin: '6px 0 0', fontSize: '0.9rem', color: onHomeRoute ? 'rgba(255,255,255,0.86)' : 'rgba(23,33,43,0.82)', fontWeight: 600 }}>
              {t.systemName}
            </p>
          </div>
        </div>

        <div className="app-header-actions public-header-actions" style={{ display: 'flex', gap: '18px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <div className="public-header-desktop-actions" style={{ display: 'flex', gap: '18px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <nav className="public-desktop-nav" aria-label={t.footerNavigation} style={{ display: 'flex', gap: '28px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center' }}>
              {publicNavLinks.map((item) => (
                <HeaderLink key={item.to} to={item.to} icon={item.icon}>{item.label}</HeaderLink>
              ))}
            </nav>

            <EthiopianClock language={language} theme={currentTheme} />

            <LanguageToggle />
            <ThemeToggle />
            <LoginButton />
          </div>

          <button
            type="button"
            ref={mobileNavToggleRef}
            className="public-mobile-nav-toggle"
            onClick={() => setMobileNavOpen((current) => !current)}
            aria-expanded={mobileNavOpen}
            aria-controls="public-mobile-nav"
            aria-label={mobileNavOpen ? 'Close navigation menu' : 'Open navigation menu'}
          >
            {mobileNavOpen ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
          </button>
        </div>

        <div
          id="public-mobile-nav"
          ref={mobileNavRef}
          className="public-mobile-nav"
          hidden={!mobileNavOpen}
          style={{
            width: '100%',
            flexBasis: '100%',
            flexDirection: 'column',
            gap: '4px',
            padding: '12px 0 4px'
          }}
        >
          {publicNavLinks.map((item) => (
            <HeaderLink key={item.to} to={item.to} icon={item.icon} className="public-mobile-nav-link">
              {item.label}
            </HeaderLink>
          ))}

          <div className="public-mobile-nav-actions" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', paddingTop: '10px', marginTop: '6px', borderTop: '1px solid rgba(23, 33, 43, 0.12)' }}>
            <LanguageToggle variant="public-mobile-language-toggle" />
            <ThemeToggle />
            <LoginButton />
          </div>
        </div>
      </header>
    );
  };
  const Footer = () => (
    <footer className={`app-footer${!user ? ' public-site-footer' : ''}`}>
      <div className="footer-grid">
        <div className="footer-brand">
          <h2>{organizationProfile.name || t.companyName}</h2>
          <p>{t.footerDescription}</p>
          <div className="footer-contact" aria-label="Contact information">
            <p><MapPin size={15} aria-hidden="true" />{t.addressValue}</p>
            <p><Phone size={15} aria-hidden="true" />{t.phoneValue}</p>
            <p><Mail size={15} aria-hidden="true" />{t.emailValue}</p>
          </div>
        </div>

        <nav className="footer-section" aria-label={t.footerNavigation}>
          <h3>Quick Links</h3>
          {publicNavLinks.map((item) => {
            const NavIcon = item.icon;
            return (
              <Link
                key={item.to}
                className="footer-link"
                to={item.to}
                aria-current={isPublicNavActive(item.to) ? 'page' : undefined}
                onClick={(event) => requestPublicNavigation(item.to, event)}
              >
                <NavIcon size={16} aria-hidden="true" />{item.label}
              </Link>
            );
          })}
          <Link className="footer-link" to="/login"><LogIn size={16} aria-hidden="true" />Sign In</Link>
        </nav>

        <div className="footer-controls">
          <button type="button" onClick={toggleLanguage} aria-label={language === 'en' ? 'Switch to Amharic' : 'Switch to English'}>
            <Languages size={16} aria-hidden="true" />
            <span>{language === 'en' ? 'አማ' : 'EN'}</span>
          </button>
          <button type="button" onClick={toggleTheme} aria-label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}>
            {theme === 'light' ? <Moon size={16} aria-hidden="true" /> : <Sun size={16} aria-hidden="true" />}
          </button>
        </div>
      </div>

      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} {organizationProfile.name || t.companyName}</span>
        <span>{t.footerCopyright}</span>
      </div>
    </footer>
  );

  const PublicHeader = () => <Header />;
  const PublicFooter = () => <Footer />;

  const PublicLayout = ({ children }) => {
    const isHomeRoute = location.pathname === '/' || location.pathname === '/home';

    return (
      <div className={`public-layout${isHomeRoute ? ' home-route' : ''}`}>
        <PublicHeader />
        <main className="public-main" style={{ backgroundColor: currentTheme.mainBg }}>
          {children}
        </main>
        <PublicFooter />
        <ToastContainer position="top-right" autoClose={3000} />
      </div>
    );
  };

  const DashboardHeader = () => {
    const activeItem = navigationItems
      .slice()
      .sort((left, right) => right.path.length - left.path.length)
      .find((item) => item.path === currentActiveSidebar);
    const pageTitle = String(activeItem?.label || t.dashboard).replace(/^[^\w]+\s*/, '');
    const notificationPath = sidebarItems.find((item) => item.path.endsWith('/notifications'))?.path || getDashboardRoute(user?.role);
    const settingsPath = sidebarItems.find((item) => item.path.endsWith('/settings'))?.path;
    const toggleSidebar = () => {
      if (window.innerWidth <= 900) {
        setSidebarOpen(true);
        return;
      }
      setSidebarCollapsed((current) => !current);
    };

    return (
      <header className="dashboard-header">
        <div className="dashboard-header-left">
          <button
            type="button"
            className="dashboard-menu-button"
            onClick={toggleSidebar}
            aria-label={sidebarCollapsed ? 'Expand navigation menu' : 'Collapse navigation menu'}
            aria-expanded={!sidebarCollapsed}
            title={sidebarCollapsed ? 'Expand navigation menu' : 'Collapse navigation menu'}
          >
            <PanelLeft size={19} aria-hidden="true" />
          </button>
          <div className="dashboard-heading">
            <span className="dashboard-heading-context">Dashboard</span>
            <h1>{pageTitle}</h1>
          </div>
        </div>

        <div className="dashboard-header-actions">
          <button
            type="button"
            className="dashboard-icon-button"
            onClick={() => navigate(notificationPath)}
            aria-label="Open notifications"
            title="Notifications"
          >
            <Bell size={18} aria-hidden="true" />
            {unreadNotificationCount > 0 && <span className="dashboard-notification-count">{unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}</span>}
          </button>

          <button
            type="button"
            className="dashboard-language-button"
            onClick={() => setLanguage((current) => current === 'en' ? 'am' : 'en')}
            aria-label={language === 'en' ? 'Switch to Amharic' : 'Switch to English'}
          >
            <Languages size={16} aria-hidden="true" />
            <span>{language === 'en' ? 'አማ' : 'EN'}</span>
          </button>

          <div className="dashboard-profile" ref={notificationMenuRef}>
            <button
              type="button"
              className="dashboard-profile-button"
              onClick={() => setProfileMenuOpen((current) => !current)}
              aria-expanded={profileMenuOpen}
              aria-haspopup="menu"
              aria-label="Open user menu"
            >
              <UserAvatar user={user} size="sm" className="dashboard-profile-avatar" />
              <span className="dashboard-profile-name">{user.fullName || user.username || 'User'}</span>
              <ChevronDown size={16} aria-hidden="true" />
            </button>
            {profileMenuOpen && (
              <div className="dashboard-profile-menu" role="menu">
                {settingsPath && (
                  <Link to={settingsPath} role="menuitem" onClick={() => setProfileMenuOpen(false)}>
                    <Settings size={15} aria-hidden="true" /> Settings
                  </Link>
                )}
                <button type="button" role="menuitem" onClick={handleLogout}>
                  <LogOut size={15} aria-hidden="true" /> {t.logout}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
    );
  };

  const AuthenticatedLayout = ({ children }) => (
    <div className="App" style={{ backgroundColor: currentTheme.mainBg, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <DashboardHeader />
      {showDashboardSidebar && (
        <>
          {sidebarOpen && <button className="sidebar-backdrop is-visible" type="button" onClick={() => setSidebarOpen(false)} aria-label="Close navigation menu" />}
        </>
      )}
      <div className={`authenticated-shell${isStoreManager ? ' store-manager-body' : ''}`} style={hideSidebar || !showDashboardSidebar ? { display: 'block' } : undefined}>
        {showDashboardSidebar && (
          <aside className={`admin-sidebar${isStoreManager ? ' store-manager-sidebar' : ''}${sidebarOpen ? ' is-open' : ''}${sidebarCollapsed ? ' is-collapsed' : ''}`} style={{
            backgroundColor: '#8F9BA7',
            borderRight: `1px solid ${currentTheme.cardBorder}`,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0
          }}>
            <div className="admin-sidebar-profile">
              <button className="sidebar-close" type="button" onClick={() => setSidebarOpen(false)} aria-label="Close navigation menu"><X size={18} /></button>
              <UserAvatar user={user} size="lg" className="sidebar-avatar" />
              <div className="sidebar-user-name">{user.fullName || user.username || 'Admin'}</div>
              <div className="sidebar-role">{getRoleDisplay(sidebarRole).label}</div>
              <div className="sidebar-organization">{user.department ? getDepartmentLabel(user.department) : 'Administration'}</div>
              <div className="sidebar-status"><span /> Online</div>
            </div>

            <nav className="admin-sidebar-nav" aria-label="Application navigation">
              {showCollegeNavigation && <div className="sidebar-subsection-label">COLLEGE MANAGER</div>}
              {showCollegeNavigation && (
                <>
                  <div className="sidebar-subsection-label">OVERVIEW</div>
                  {collegeOverviewItems.map((item) => renderSidebarLink(item, true))}
                  <div className="sidebar-subsection-label">COLLEGE MANAGEMENT</div>
                  {collegeManagementItems.map((item) => renderSidebarLink(item, true))}
                  <div className="sidebar-subsection-label">ASSET MANAGEMENT</div>
                  {collegeAssetItems.map((item) => renderSidebarLink(item, true))}
                  <div className="sidebar-subsection-label">OPERATIONS</div>
                  {collegeOperationsItems.map((item) => renderSidebarLink(item, true))}
                  <div className="sidebar-subsection-label">REPORTS & ANALYTICS</div>
                  {collegeAnalyticsItems.map((item) => renderSidebarLink(item, true))}
                  <div className="sidebar-subsection-label">SYSTEM</div>
                  {collegeSystemItems.map((item) => renderSidebarLink(item, true))}
                </>
              )}
              {showDepartmentsNavigation && renderCollapsibleSection(
                sidebarRole === 'department_head' ? 'DEPARTMENT MANAGER' : 'DEPARTMENT HEAD',
                departmentsNavOpen,
                setDepartmentsNavOpen,
                isDepartmentDean || sidebarRole === 'department_head'
                  ? sidebarRole === 'department_head'
                    ? departmentManagerSections.map((section) => (
                      <React.Fragment key={section.label}>
                        <div className="sidebar-subsection-label">{section.label}</div>
                        {section.items.map((item) => renderSidebarLink(item, true))}
                      </React.Fragment>
                    ))
                    : <><div className="sidebar-subsection-label">Overview</div>{departmentDeanItems.map((item) => renderSidebarLink(item, true))}</>
                  : isDepartmentStaff
                    ? <><div className="sidebar-subsection-label">Department Assets</div>{departmentStaffItems.map((item) => renderSidebarLink(item, true))}</>
                    : <><div className="sidebar-subsection-label">Department Workspace</div>{renderSidebarLink({ path: '/department', label: 'Dashboard', icon: LayoutDashboard }, true)}</>,
                'departments'
              )}
              {!showCollegeNavigation && !showDepartmentsNavigation && sidebarRole === 'finance' && (
                <>
                  {Object.keys(financeSectionLabels).map((sectionKey) => {
                    const visibleItems = sidebarItems.filter((item) => item.section === sectionKey || (sectionKey === 'Overview' && item.path === '/finance'));
                    if (!visibleItems.length) return null;
                    return (
                      <React.Fragment key={sectionKey}>
                        <div className="sidebar-section-label">{financeSectionLabels[sectionKey]}</div>
                        {visibleItems.map((item) => renderSidebarLink(item))}
                      </React.Fragment>
                    );
                  })}
                </>
              )}
              {!showCollegeNavigation && !showDepartmentsNavigation && sidebarRole === 'infrastructure' && (
                <>
                  {['OVERVIEW','ASSET MANAGEMENT','BUILDINGS & FACILITIES','MAINTENANCE & WORK ORDERS','ENERGY & FUEL','TRACKING','REQUESTS','ANALYTICS','DOCUMENTS','SYSTEM'].map((sectionName) => {
                    const visibleItems = sidebarItems.filter((item) => item.section === sectionName || (sectionName === 'OVERVIEW' && item.path === '/infrastructure'));
                    if (!visibleItems.length) return null;
                    return (
                      <React.Fragment key={sectionName}>
                        <div className="sidebar-section-label">{sectionName}</div>
                        {visibleItems.map((item) => renderSidebarLink(item))}
                      </React.Fragment>
                    );
                  })}
                </>
              )}
              {!showCollegeNavigation && !showDepartmentsNavigation && sidebarRole === 'ict_officer' && (
                <>
                  {['IT ASSET MANAGEMENT', 'ASSET MANAGEMENT', 'TECHNICAL OPERATIONS', 'MAINTENANCE', 'TRACKING', 'ANALYTICS & REPORTS', 'SYSTEM'].map((sectionName) => {
                    const visibleItems = sidebarItems.filter((item) => item.section === sectionName);
                    if (!visibleItems.length) return null;
                    return (
                      <React.Fragment key={sectionName}>
                        <div className="sidebar-section-label">{sectionName}</div>
                        {visibleItems.map((item) => renderSidebarLink(item))}
                      </React.Fragment>
                    );
                  })}
                </>
              )}
              {!showCollegeNavigation && !showDepartmentsNavigation && sidebarRole === 'store_manager' && (
                <>
                  {['Overview', 'INVENTORY MANAGEMENT', 'ASSET OPERATIONS', 'TRACKING', 'MAINTENANCE', 'REPORTING', 'SYSTEM'].map((sectionName) => {
                    const visibleItems = sidebarItems.filter((item) => item.section === sectionName || (sectionName === 'Overview' && item.path === '/store'));
                    if (!visibleItems.length) return null;
                    return (
                      <React.Fragment key={sectionName}>
                        <div className="sidebar-section-label">{sectionName}</div>
                        {visibleItems.map((item) => renderSidebarLink(item))}
                      </React.Fragment>
                    );
                  })}
                </>
              )}
              {!showCollegeNavigation && !showDepartmentsNavigation && sidebarRole === 'maintenance' && (
                <>
                  {['Dashboard', 'OPERATIONS', 'PREVENTIVE', 'RESOURCES', 'QUALITY', 'ANALYTICS'].map((sectionName) => {
                    const visibleItems = sidebarItems.filter((item) => item.section === sectionName || (sectionName === 'Dashboard' && item.path === '/maintenance'));
                    if (!visibleItems.length) return null;
                    return (
                      <React.Fragment key={sectionName}>
                        <div className="sidebar-section-label">{sectionName}</div>
                        {visibleItems.map((item) => renderSidebarLink(item))}
                      </React.Fragment>
                    );
                  })}
                </>
              )}
              {!showCollegeNavigation && !showDepartmentsNavigation && sidebarRole !== 'finance' && sidebarRole !== 'infrastructure' && sidebarRole !== 'ict_officer' && sidebarRole !== 'store_manager' && sidebarRole !== 'maintenance' && sidebarItems.map((item, index) => {
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
              <div className="sidebar-account"><UserAvatar user={user} size="sm" className="sidebar-account-avatar" /><div><strong>{user.username || 'Admin'}</strong><span>System Administrator</span></div></div>
              <button className="sidebar-logout" type="button" onClick={handleLogout}><LogOut size={16} aria-hidden="true" /><span>{t.logout}</span></button>
            </div>
          </aside>
        )}

        <main className={`admin-main-content app-main-content${isStoreManager ? ' store-manager-main' : ''}${hideSidebar ? ' create-asset-main' : ''}`} style={hideSidebar || !showDashboardSidebar ? { width: '100%', maxWidth: '100%' } : undefined}>
          {children}
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

  // ==========================================
  // NAVIGATION LINK STYLE
  // ==========================================

  // ==========================================
  // GET DASHBOARD ROUTE BASED ON ROLE
  // ==========================================

  // ==========================================
  // PUBLIC ROUTES
  // ==========================================

  if (!user) {
    const isLoginRoute = shouldUseStandaloneLoginLayout(location.pathname);

    return (
      <>
        {isLoginRoute ? (
          <Login />
        ) : (
          <PublicLayout>
            <Suspense fallback={<LoadingFallback />}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/reset-password/:token" element={<ResetPassword />} />
                <Route path="/home" element={<Home />} />
                <Route path="/about" element={<AboutUs />} />
                <Route path="/about-us" element={<AboutUs />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/ict/*" element={<Navigate to="/login" replace />} />
                <Route path="*" element={<Navigate to={logoutDestinationRef.current || '/login'} replace />} />
              </Routes>
            </Suspense>
          </PublicLayout>
        )}
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
        { path: '/admin/assets', label: 'All Assets', icon: Package, group: 'Asset Governance' },
        { path: '/admin/assets/categories', label: 'Asset Categories', icon: Package, group: 'Asset Governance' },
        { path: '/admin/assets/assign', label: 'Asset Assignment', icon: ClipboardList, group: 'Asset Governance' },
        { path: '/admin/assets/transfer', label: 'Asset Transfer', icon: ArrowLeftRight, group: 'Asset Governance' },
        { path: '/admin/assets/disposal', label: 'Disposal & Retirement', icon: Archive, group: 'Asset Governance' },
        { path: '/admin/maintenance', label: 'Maintenance Oversight', icon: Wrench, group: 'Asset Governance' },
        { path: '/admin/rfid', label: 'RFID / QR Tracking', icon: Radio, group: 'Asset Governance' },
        { path: '/admin/users', label: 'Users', icon: Users, group: 'Organization' },
        { path: '/admin/roles-permissions', label: 'Roles & Permissions', icon: ShieldCheck, group: 'Organization' },
        { path: '/admin/colleges', label: 'Colleges', icon: Building2, group: 'Organization' },
        { path: '/admin/departments', label: 'Departments', icon: Building2, group: 'Organization' },
        { path: '/admin/locations', label: 'Locations', icon: Building2, group: 'Organization' },
        { path: '/admin/reports', label: 'Reports & Analytics', icon: BarChart3, group: 'Analytics' },
        { path: '/admin/reports/analytics', label: 'Asset Analytics', icon: BarChart3, group: 'Analytics' },
        { path: '/admin/analytics/system', label: 'System Analytics', icon: BarChart3, group: 'Analytics' },
        { path: '/admin/settings', label: t.settings, icon: Settings, group: 'System' },
        { path: '/admin/notifications', label: t.notifications, icon: Bell, group: 'System' },
        { path: '/admin/backup', label: t.backup, icon: DatabaseBackup, group: 'System' },
        { path: '/admin/monitoring', label: 'System Monitoring', icon: BarChart3, group: 'System' }
      ],
      'ict_officer': [
        { path: '/ict/dashboard', label: 'Dashboard Overview', icon: LayoutDashboard, section: 'IT ASSET MANAGEMENT' },
        { path: '/ict/assets', label: 'ICT Assets', section: 'ASSET MANAGEMENT' },
        { path: '/ict/inventory', label: 'Inventory', section: 'ASSET MANAGEMENT' },
        { path: '/ict/assignments', label: 'Assignments', section: 'ASSET MANAGEMENT' },
        { path: '/ict/asset-requests', label: 'Asset Requests', section: 'ASSET MANAGEMENT' },
        { path: '/ict/equipment', label: 'IT Equipment', section: 'TECHNICAL OPERATIONS' },
        { path: '/ict/network', label: 'Network Equipment', section: 'TECHNICAL OPERATIONS' },
        { path: '/ict/software-licenses', label: 'Software Licenses', section: 'TECHNICAL OPERATIONS' },
        { path: '/ict/support', label: 'Technical Support', section: 'TECHNICAL OPERATIONS' },
        { path: '/ict/incidents', label: 'Incident Management', section: 'TECHNICAL OPERATIONS' },
        { path: '/ict/maintenance', label: 'ICT Maintenance', section: 'MAINTENANCE' },
        { path: '/ict/repairs', label: 'Repair History', section: 'MAINTENANCE' },
        { path: '/ict/device-health', label: 'Device Health', section: 'MAINTENANCE' },
        { path: '/ict/tracking', label: 'RFID / QR Tracking', section: 'TRACKING' },
        { path: '/ict/asset-history', label: 'Asset History', section: 'TRACKING' },
        { path: '/ict/reports', label: 'ICT Reports', section: 'ANALYTICS & REPORTS' },
        { path: '/ict/analytics', label: 'Asset Analytics', section: 'ANALYTICS & REPORTS' },
        { path: '/ict/notifications', label: 'Notifications', section: 'SYSTEM' }
      ],
      'college': [
        { path: '/college', label: 'Dashboard' },
        { path: '/college/profile', label: 'College Profile' },
        { path: '/college/staff', label: 'College Staff' },
        { path: '/college/locations', label: 'Locations' },
        { path: '/college/departments', label: 'Departments' },
        { path: '/college/assets', label: 'All College Assets' },
        { path: '/college/inventory', label: 'Inventory' },
        { path: '/college/requests', label: 'Asset Requests' },
        { path: '/college/approvals', label: 'Approvals' },
        { path: '/college/assignments', label: 'Assignments' },
        { path: '/college/transfers', label: 'Transfers' },
        { path: '/college/returns', label: 'Returns' },
        { path: '/college/maintenance', label: 'Maintenance Oversight' },
        { path: '/college/rfid', label: 'RFID / QR Tracking' },
        { path: '/college/verification', label: 'Asset Verification' },
        { path: '/college/reports', label: 'College Reports' },
        { path: '/college/analytics/assets', label: 'College Analytics' },
        { path: '/college/notifications', label: 'Notifications' }
      ],
      'staff': [],
      'finance': [
        { path: '/finance', label: '📊 ' + t.dashboard, section: 'Overview' },
        { path: '/finance/purchase-requests', label: '📝 Purchase Requests', section: 'PROCUREMENT' },
        { path: '/finance/purchase-orders', label: '📦 Purchase Orders', section: 'PROCUREMENT' },
        { path: '/finance/suppliers', label: '🤝 Suppliers', section: 'PROCUREMENT' },
        { path: '/finance/purchase-history', label: '🕘 Purchase History', section: 'PROCUREMENT' },
        { path: '/finance/invoices', label: '🧾 Invoices', section: 'FINANCIAL OPERATIONS' },
        { path: '/finance/payments', label: '💳 Payments', section: 'FINANCIAL OPERATIONS' },
        { path: '/finance/transactions', label: '🧾 Transactions', section: 'FINANCIAL OPERATIONS' },
        { path: '/finance/budget-management', label: '🏦 Budget Management', section: 'FINANCIAL OPERATIONS' },
        { path: '/finance/valuation', label: '📦 Asset Valuation', section: 'ASSET FINANCE' },
        { path: '/finance/depreciation', label: '💰 Depreciation', section: 'ASSET FINANCE' },
        { path: '/finance/capitalization', label: '🏛️ Capitalization', section: 'ASSET FINANCE' },
        { path: '/finance/disposal-financial-records', label: '♻️ Disposal Financial Records', section: 'ASSET FINANCE' },
        { path: '/finance/financial-reports', label: '📊 Financial Reports', section: 'REPORTING' },
        { path: '/finance/budget-reports', label: '🏦 Budget Reports', section: 'REPORTING' },
        { path: '/finance/depreciation-reports', label: '💰 Depreciation Reports', section: 'REPORTING' },
        { path: '/finance/asset-value-reports', label: '📦 Asset Value Reports', section: 'REPORTING' },
        { path: '/finance/notifications', label: '🔔 Notifications', section: 'CONTROL' }
      ],
      'store_manager': [
        { path: '/store', label: '📊 ' + t.dashboard, section: 'Overview' },
        { path: '/store/inventory', label: '📦 Inventory', section: 'INVENTORY MANAGEMENT' },
        { path: '/store/available-assets', label: '📦 Available Assets', section: 'INVENTORY MANAGEMENT' },
        { path: '/store/low-stock', label: '⚠️ Low Stock Alerts', section: 'INVENTORY MANAGEMENT' },
        { path: '/store/stock-adjustments', label: '⚙️ Stock Adjustments', section: 'INVENTORY MANAGEMENT' },
        { path: '/store/receive', label: '📥 Receive Assets', section: 'ASSET OPERATIONS' },
        { path: '/store/issue', label: '📤 Issue Assets', section: 'ASSET OPERATIONS' },
        { path: '/store/returns', label: '↩️ Returns', section: 'ASSET OPERATIONS' },
        { path: '/store/transfers', label: '🔄 Transfers', section: 'ASSET OPERATIONS' },
        { path: '/store/requests', label: '📝 Asset Requests', section: 'ASSET OPERATIONS' },
        { path: '/store/tracking', label: '📡 RFID / QR Tracking', section: 'TRACKING' },
        { path: '/store/history', label: '📜 Asset Movement History', section: 'TRACKING' },
        { path: '/store/verification', label: '✅ Asset Verification', section: 'TRACKING' },
        { path: '/store/maintenance', label: '🔧 Send to Maintenance', section: 'MAINTENANCE' },
        { path: '/store/maintenance/status', label: '📋 Maintenance Status', section: 'MAINTENANCE' },
        { path: '/store/reports/inventory', label: '📊 Inventory Reports', section: 'REPORTING' },
        { path: '/store/reports/issues', label: '📝 Issue Reports', section: 'REPORTING' },
        { path: '/store/reports/returns', label: '↩️ Return Reports', section: 'REPORTING' },
        { path: '/store/reports/movements', label: '🔄 Movement Reports', section: 'REPORTING' },
        { path: '/store/notifications', label: '🔔 ' + t.notifications, section: 'SYSTEM' }
      ],
      'maintenance': [
        { path: '/maintenance', label: '📊 ' + t.dashboard, section: 'Dashboard' },
        { path: '/maintenance/requests', label: '🔧 ' + t.requests, section: 'OPERATIONS' },
        { path: '/maintenance/inspection', label: '🔍 Inspection', section: 'OPERATIONS' },
        { path: '/maintenance/work-orders', label: '📋 Work Orders', section: 'OPERATIONS' },
        { path: '/maintenance/repairs', label: '🛠️ Repairs', section: 'OPERATIONS' },
        { path: '/maintenance/assets-under-maintenance', label: '📦 Assets Under Maintenance', section: 'OPERATIONS' },
        { path: '/maintenance/schedule', label: '📅 Schedule', section: 'PREVENTIVE' },
        { path: '/maintenance/preventive', label: '🛡️ Preventive Maintenance', section: 'PREVENTIVE' },
        { path: '/maintenance/calendar', label: '📆 Calendar', section: 'PREVENTIVE' },
        { path: '/maintenance/technicians', label: '👨‍🔧 Technicians', section: 'RESOURCES' },
        { path: '/maintenance/spare-parts', label: '🧰 Spare Parts', section: 'RESOURCES' },
        { path: '/maintenance/vendors', label: '🤝 Vendors', section: 'RESOURCES' },
        { path: '/maintenance/testing-quality', label: '🧪 Testing', section: 'QUALITY' },
        { path: '/maintenance/quality-control', label: '✅ Quality Control', section: 'QUALITY' },
        { path: '/maintenance/history', label: '📜 History', section: 'ANALYTICS' },
        { path: '/maintenance/cost-analysis', label: '💰 Cost Analysis', section: 'ANALYTICS' },
        { path: '/maintenance/reports', label: '📊 Reports', section: 'ANALYTICS' }
      ],
      'infrastructure': [
        { path: '/infrastructure', label: '📊 Dashboard', section: 'OVERVIEW' },
        { path: '/infrastructure/assets', label: '🏢 Infrastructure Assets', section: 'ASSET MANAGEMENT' },
        { path: '/infrastructure/assets/register', label: '➕ Register Asset', section: 'ASSET MANAGEMENT' },
        { path: '/infrastructure/inventory', label: '📦 Asset Inventory', section: 'ASSET MANAGEMENT' },
        { path: '/infrastructure/assignment', label: '👤 Asset Assignment', section: 'ASSET MANAGEMENT' },
        { path: '/infrastructure/transfer', label: '🔄 Asset Transfer', section: 'ASSET MANAGEMENT' },
        { path: '/infrastructure/verification', label: '✅ Asset Verification', section: 'ASSET MANAGEMENT' },
        { path: '/infrastructure/buildings', label: '🏛️ Buildings & Facilities', section: 'BUILDINGS & FACILITIES' },
        { path: '/infrastructure/electrical', label: '⚡ Electrical Systems', section: 'BUILDINGS & FACILITIES' },
        { path: '/infrastructure/generators', label: '🔋 Generators', section: 'BUILDINGS & FACILITIES' },
        { path: '/infrastructure/transformers', label: '🔌 Transformers', section: 'BUILDINGS & FACILITIES' },
        { path: '/infrastructure/ups', label: '🔋 UPS / Inverters', section: 'BUILDINGS & FACILITIES' },
        { path: '/infrastructure/solar', label: '☀️ Solar Energy', section: 'BUILDINGS & FACILITIES' },
        { path: '/infrastructure/water', label: '💧 Water Systems', section: 'BUILDINGS & FACILITIES' },
        { path: '/infrastructure/roads', label: '🛣️ Roads & Drainage', section: 'BUILDINGS & FACILITIES' },
        { path: '/infrastructure/maintenance', label: '🔧 Facility Maintenance', section: 'MAINTENANCE & WORK ORDERS' },
        { path: '/infrastructure/work-orders', label: '📋 Work Orders', section: 'MAINTENANCE & WORK ORDERS' },
        { path: '/infrastructure/preventive', label: '📅 Preventive Maintenance', section: 'MAINTENANCE & WORK ORDERS' },
        { path: '/infrastructure/inspection', label: '🔍 Inspections & Condition', section: 'MAINTENANCE & WORK ORDERS' },
        { path: '/infrastructure/spare-parts', label: '🧰 Spare Parts', section: 'MAINTENANCE & WORK ORDERS' },
        { path: '/infrastructure/energy', label: '⚡ Energy Management', section: 'ENERGY & FUEL' },
        { path: '/infrastructure/fuel', label: '⛽ Fuel Management', section: 'ENERGY & FUEL' },
        { path: '/infrastructure/tracking', label: '📡 RFID / QR Tracking', section: 'TRACKING' },
        { path: '/infrastructure/requests', label: '📝 Requests', section: 'REQUESTS' },
        { path: '/infrastructure/reports', label: '📊 Reports & Analytics', section: 'ANALYTICS' },
        { path: '/infrastructure/documents', label: '📄 Documents', section: 'DOCUMENTS' },
        { path: '/infrastructure/notifications', label: '🔔 Notifications', section: 'SYSTEM' }
      ]
    };
    return items[normalizedRole] || [];
  };

  const sidebarRole = normalizeRole(user?.role || user?.roles);
  const isStoreManager = sidebarRole === 'store_manager';
  const hideSidebar = shouldHideSidebarForPath(location.pathname);
  const showDashboardSidebar = shouldShowDashboardSidebar(location.pathname) && !hideSidebar;
  const sidebarItems = getSidebarItems(sidebarRole);
  const responsibility = String(user?.departmentRole || user?.responsibility || user?.position || '').trim().toLowerCase().replace(/[_-]+/g, ' ');
  const isDepartmentStaff = sidebarRole === 'staff' || responsibility === 'department staff';
  const isDepartmentDean = responsibility === 'department dean' || responsibility === 'dean';
  const showCollegeNavigation = sidebarRole === 'college' && !isDepartmentStaff && !isDepartmentDean;
  const showDepartmentsNavigation = sidebarRole === 'department_head' || isDepartmentStaff || isDepartmentDean;
  const financeSectionLabels = {
    'Overview': 'OVERVIEW',
    'PROCUREMENT': 'PROCUREMENT',
    'FINANCIAL OPERATIONS': 'FINANCIAL OPERATIONS',
    'ASSET FINANCE': 'ASSET FINANCE',
    'REPORTING': 'REPORTING',
    'CONTROL': 'CONTROL'
  };
  const collegeOverviewItems = [
    { path: '/college', label: 'Dashboard', icon: LayoutDashboard, group: 'Overview' }
  ];
  const collegeManagementItems = [
    { path: '/college/profile', label: 'College Profile', icon: Building2, group: 'College Management' },
    { path: '/college/staff', label: 'College Staff', icon: Users, group: 'College Management' },
    { path: '/college/locations', label: 'Locations', icon: MapPin, group: 'College Management' },
    { path: '/college/departments', label: 'Departments', icon: Building2, group: 'College Management' }
  ];
  const collegeAssetItems = [
    { path: '/college/assets', label: 'All College Assets', icon: Package, group: 'Asset Management' },
    { path: '/college/inventory', label: 'Inventory', icon: ClipboardList, group: 'Asset Management' },
    { path: '/college/requests', label: 'Asset Requests', icon: ClipboardList, group: 'Asset Management' },
    { path: '/college/approvals', label: 'Approvals', icon: ClipboardCheck, group: 'Asset Management' },
    { path: '/college/assignments', label: 'Assignments', icon: Users, group: 'Asset Management' },
    { path: '/college/transfers', label: 'Transfers', icon: ArrowLeftRight, group: 'Asset Management' },
    { path: '/college/returns', label: 'Returns', icon: ArrowLeftRight, group: 'Asset Management' }
  ];
  const collegeOperationsItems = [
    { path: '/college/maintenance', label: 'Maintenance Oversight', icon: Wrench, group: 'Operations' },
    { path: '/college/rfid', label: 'RFID / QR Tracking', icon: Radio, group: 'Operations' },
    { path: '/college/verification', label: 'Asset Verification', icon: Radio, group: 'Operations' }
  ];
  const collegeAnalyticsItems = [
    { path: '/college/reports', label: 'College Reports', icon: BarChart3, group: 'Reports & Analytics' },
    { path: '/college/analytics/assets', label: 'College Analytics', icon: BarChart3, group: 'Reports & Analytics' }
  ];
  const collegeSystemItems = [
    { path: '/college/notifications', label: 'Notifications', icon: Bell, group: 'System' }
  ];
  const departmentDeanItems = [
    { path: '/department', label: 'Overview Dashboard', icon: LayoutDashboard },
    { path: '/department/profile', label: 'Department Profile', icon: Users },
    { path: '/department/staff', label: 'Department Staff', icon: Users },
    { path: '/department/locations', label: 'Department Locations', icon: MapPin },
    { path: '/department/assets', label: 'Assets', icon: Package },
    { path: '/department/assignments', label: 'Asset Assignments', icon: ClipboardList },
    { path: '/department/inventory', label: 'Inventory', icon: Package },
    { path: '/department/verification', label: 'Asset Verification', icon: Radio },
    { path: '/department/requests', label: 'Asset Requests', icon: ClipboardList },
    { path: '/department/approvals', label: 'Pending Approvals', icon: ClipboardCheck },
    { path: '/department/transfers', label: 'Transfer Requests', icon: ArrowLeftRight },
    { path: '/department/maintenance', label: 'Maintenance Requests', icon: Wrench },
    { path: '/department/returns', label: 'Asset Returns', icon: ArrowLeftRight },
    { path: '/department/movement', label: 'Asset Movement', icon: ArrowLeftRight },
    { path: '/department/maintenance', label: 'Maintenance Status', icon: Wrench },
    { path: '/department/reports', label: 'Department Reports', icon: BarChart3 },
    { path: '/department/utilization', label: 'Asset Utilization', icon: BarChart3 },
    { path: '/department/notifications', label: 'Notifications', icon: Bell }
  ];
  const departmentStaffItems = [
    { path: '/department', label: 'Overview Dashboard', icon: LayoutDashboard },
    { path: '/department/profile', label: 'My Profile', icon: Users },
    { path: '/department/assets', label: 'Assets', icon: Package },
    { path: '/department/assignments', label: 'Assigned Assets', icon: ClipboardList },
    { path: '/department/inventory', label: 'Inventory', icon: Package },
    { path: '/department/verification', label: 'Asset Verification', icon: Radio },
    { path: '/department/requests', label: 'Asset Requests', icon: ClipboardList },
    { path: '/department/approvals', label: 'Pending Approvals', icon: ClipboardCheck },
    { path: '/department/transfers', label: 'Transfer Requests', icon: ArrowLeftRight },
    { path: '/department/maintenance', label: 'Maintenance Requests', icon: Wrench },
    { path: '/department/returns', label: 'Asset Returns', icon: ArrowLeftRight },
    { path: '/department/movement', label: 'Asset Movement', icon: ArrowLeftRight },
    { path: '/department/notifications', label: 'Notifications', icon: Bell },
    { path: '/department/history', label: 'Asset History', icon: ClipboardCheck }
  ];
  const departmentManagerSections = [
    { label: 'OVERVIEW', items: departmentDeanItems.slice(0, 1) },
    { label: 'DEPARTMENT MANAGEMENT', items: departmentDeanItems.slice(1, 4) },
    { label: 'ASSET MANAGEMENT', items: departmentDeanItems.slice(4, 10) },
    { label: 'OPERATIONS', items: departmentDeanItems.slice(10, 13) },
    { label: 'REPORTS & ANALYTICS', items: departmentDeanItems.slice(13, 15) },
    { label: 'SYSTEM', items: departmentDeanItems.slice(15) }
  ];
  const navigationItems = [...sidebarItems, ...(isDepartmentDean ? departmentDeanItems : isDepartmentStaff ? departmentStaffItems : [])];
  const currentActiveSidebar = [...navigationItems]
    .sort((left, right) => right.path.length - left.path.length)
    .find((item) => location.pathname === item.path || location.pathname.startsWith(`${item.path}/`))?.path
    || getDashboardRoute(user?.role);

  const getNavigationIcon = (item) => {
    if (item.icon) return item.icon;
    const path = item.path || '';
    if (path === '/admin' || /\/dashboard$/.test(path)) return LayoutDashboard;
    if (path.includes('create')) return ClipboardList;
    if (path.includes('asset') || path.includes('inventory')) return Package;
    if (path.includes('assignment') || path.includes('request') || path.includes('approval')) return ClipboardList;
    if (path.includes('transfer') || path.includes('return')) return ArrowLeftRight;
    if (path.includes('maintenance') || path.includes('repair')) return Wrench;
    if (path.includes('rfid') || path.includes('tracking')) return Radio;
    if (path.includes('report') || path.includes('analytics')) return BarChart3;
    if (path.includes('user') || path.includes('staff') || path.includes('technician')) return Users;
    if (path.includes('department') || path.includes('college') || path.includes('location')) return Building2;
    if (path.includes('notification')) return Bell;
    if (path.includes('profile')) return UserCircle;
    if (path.includes('setting')) return Settings;
    if (path.includes('backup')) return DatabaseBackup;
    return FileText;
  };

  const renderSidebarLink = (item, nested = false) => {
    const isActive = item.path === currentActiveSidebar;
    const Icon = getNavigationIcon(item);
    return (
      <Link
        key={item.path}
        to={item.path}
        className={`admin-nav-link${isActive ? ' is-active' : ''}`}
        aria-current={isActive ? 'page' : undefined}
        onClick={() => setSidebarOpen(false)}
        title={sidebarCollapsed ? item.label.replace(/^[^\w]+\s*/, '') : undefined}
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
    <AuthenticatedLayout>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Navigate to={getDashboardRoute(user?.role)} replace />} />
          <Route path="/home" element={<Navigate to={getDashboardRoute(user?.role)} replace />} />
          <Route path="/about" element={<Navigate to={getDashboardRoute(user?.role)} replace />} />
          <Route path="/contact" element={<Navigate to={getDashboardRoute(user?.role)} replace />} />
          <Route path="/login" element={<Navigate to={getDashboardRoute(user?.role)} replace />} />

          <Route path="/dashboard" element={<ProtectedRoute allowedRoles={['admin']}><DashboardLayout /></ProtectedRoute>}>
            <Route index element={<DashboardOverview />} />
            <Route path="assets" element={<AdminAssets />} />
            <Route path="categories" element={<AdminAssetCategories />} />
            <Route path="documents" element={<AdminAssetDocuments />} />
            <Route path="files" element={<AdminAssetDocuments />} />
            <Route path="users" element={<AdminUserManagement />} />
            <Route path="reports" element={<AdminReports />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>

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
            <Route path="assets/lifecycle" element={<AdminAssetLifecycle />} />
            <Route path="assets/disposal" element={<AdminAssetDisposal />} />
            <Route path="assets/documents" element={<AdminAssetDocuments />} />
            
            {/* Asset Assignment */}
            <Route path="assets/assign" element={<AdminAssignment />} />
            <Route path="assignment/assigned" element={<AdminAssignment />} />
            <Route path="assignment/returns" element={<AdminAssignment />} />
            <Route path="assignment/history" element={<AdminAssignment />} />
            
            {/* Asset Transfer */}
            <Route path="assets/transfer" element={<AdminTransfer />} />
            <Route path="transfer/pending" element={<AdminTransfer />} />
            <Route path="transfer/approved" element={<AdminTransfer />} />
            <Route path="transfer/history" element={<AdminTransfer />} />
            
            {/* Inventory */}
            <Route path="inventory/available" element={<AdminAssets />} />
            <Route path="inventory/overview" element={<AdminAssets />} />
            <Route path="inventory/movement" element={<AdminAssets />} />
            <Route path="inventory/history" element={<AdminAssets />} />
            
            {/* RFID/QR Tracking */}
            <Route path="rfid" element={<AdminRFIDTracking />} />
            <Route path="rfid/qr" element={<AdminRFIDTracking />} />
            <Route path="rfid/register" element={<AdminRFIDTracking />} />
            <Route path="rfid/activity" element={<AdminRFIDTracking />} />
            <Route path="rfid/history" element={<AdminRFIDTracking />} />
            
            {/* Maintenance */}
            <Route path="maintenance" element={<AdminMaintenance />} />
            <Route path="maintenance/requests" element={<AdminMaintenance />} />
            <Route path="maintenance/scheduled" element={<AdminMaintenance />} />
            <Route path="maintenance/pending" element={<AdminMaintenance />} />
            <Route path="maintenance/inprogress" element={<AdminMaintenance />} />
            <Route path="maintenance/completed" element={<AdminMaintenance />} />
            <Route path="maintenance/technicians" element={<AdminMaintenance />} />
            <Route path="maintenance/history" element={<AdminMaintenance />} />
            
            {/* Warranty */}
            <Route path="warranty/active" element={<AdminAssets />} />
            <Route path="warranty/expiring" element={<AdminAssets />} />
            <Route path="warranty/expired" element={<AdminAssets />} />
            
            {/* Procurement (owned by Finance) */}
            <Route path="procurement/requests" element={<Navigate to="/finance/purchase-requests" replace />} />
            <Route path="procurement/purchases" element={<Navigate to="/finance/purchase-orders" replace />} />
            <Route path="procurement/suppliers" element={<Navigate to="/finance/suppliers" replace />} />
            <Route path="procurement/invoices" element={<Navigate to="/finance/invoices" replace />} />
            <Route path="procurement/history" element={<Navigate to="/finance/purchase-history" replace />} />

            {/* Organization / governance alias routes */}
            <Route path="colleges" element={<AdminCollegeManagement />} />
            <Route path="colleges/create" element={<AdminCollegeManagement initialCreate />} />
            <Route path="colleges/:id" element={<AdminCollegeDetails />} />
            <Route path="locations" element={<AdminAssetLocations />} />
            <Route path="monitoring" element={<SystemMonitoring />} />
            <Route path="analytics/system" element={<AdminAnalyticsCenter system />} />
            <Route path="analytics/assets" element={<AdminAnalyticsCenter />} />
            
            {/* User Management */}
            <Route path="users" element={<AdminUserManagement />} />
            <Route path="users/create" element={<AdminUserManagement initialSection="create" />} />
            <Route path="users/active" element={<AdminUserManagement initialSection="status" />} />
            <Route path="users/inactive" element={<AdminUserManagement initialSection="status" />} />
            <Route path="users/activity" element={<AdminUserManagement initialSection="activity" />} />
            <Route path="roles-permissions" element={<AdminRolesPermissions />} />
            <Route path="roles" element={<AdminRolesPermissions />} />
            <Route path="permissions" element={<AdminRolesPermissions />} />
            
            {/* Department Management */}
            <Route path="departments" element={<AdminDepartmentManagement />} />
            <Route path="departments/create" element={<AdminDepartmentManagement />} />
            <Route path="departments/heads" element={<AdminDepartmentManagement />} />
            <Route path="departments/users" element={<AdminDepartmentManagement />} />
            <Route path="departments/assets" element={<AdminDepartmentManagement />} />
            <Route path="departments/locations" element={<AdminDepartmentManagement />} />
            
            {/* Reports & Analytics */}
            <Route path="reports" element={<AdminReports />} />
            <Route path="reports/analytics" element={<AdminAnalyticsCenter />} />
            <Route path="reports/:legacyReportType" element={<Navigate to="/admin/reports" replace />} />
            
            {/* Notifications */}
            <Route path="notifications" element={<AdminNotifications />} />
            <Route path="notifications/:id" element={<AdminNotificationDetails />} />
            <Route path="notifications/unread" element={<AdminNotifications />} />
            <Route path="notifications/maintenance" element={<AdminNotifications />} />
            <Route path="notifications/assignment" element={<AdminNotifications />} />
            <Route path="notifications/transfer" element={<AdminNotifications />} />
            <Route path="notifications/missing" element={<AdminNotifications />} />
            <Route path="notifications/warranty" element={<AdminNotifications />} />
            <Route path="notifications/rfid" element={<AdminNotifications />} />
            <Route path="notifications/security" element={<AdminNotifications />} />
            
            {/* Approvals */}
            <Route path="approvals/assignment" element={<AdminAssignment />} />
            <Route path="approvals/transfer" element={<AdminTransfer />} />
            <Route path="approvals/purchase" element={<Navigate to="/finance/purchase-requests" replace />} />
            <Route path="approvals/disposal" element={<AdminAssetDisposal />} />
            <Route path="approvals/pending" element={<AdminAssignment />} />
            
            {/* Settings */}
            <Route path="settings" element={<AdminSettings />} />
            <Route path="settings/system-monitoring" element={<SystemMonitoring />} />
            <Route path="system-monitoring" element={<SystemMonitoring />} />
            
            {/* Backup */}
            <Route path="backup" element={<AdminBackup />} />
            <Route path="backup/history" element={<AdminBackup />} />
            <Route path="backup/restore" element={<AdminBackup />} />
            <Route path="backup/status" element={<AdminBackup />} />
            
          </Route>

          {/* ICT OFFICER ROUTES - Fixed with RoleLayout */}
          <Route path="/ict" element={<ProtectedRoute allowedRoles={['ict_officer', 'admin']}><RoleLayout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/ict/dashboard" replace />} />
            <Route path="dashboard" element={<ICTDashboard />} />
            <Route path="assets" element={<ICTAssets />} />
            <Route path="assets/create" element={<AssetCreate />} />
            <Route path="assignments" element={<ICTAssignments />} />
            <Route path="assets/assign" element={<Navigate to="/ict/assignments" replace />} />
            <Route path="assets/:id" element={<AssetDetails />} />
            <Route path="maintenance" element={<ICTMaintenance />} />
            <Route path="repairs" element={<ICTRepairHistory />} />
            <Route path="repair-history" element={<Navigate to="/ict/repairs" replace />} />
            <Route path="device-health" element={<ICTDeviceHealth />} />
            <Route path="tracking" element={<ICTRFIDTracking />} />
            <Route path="rfid" element={<Navigate to="/ict/tracking" replace />} />
            <Route path="asset-history" element={<ICTAssetHistory />} />
            <Route path="reports" element={<ICTReports />} />
            <Route path="analytics" element={<ICTAssetAnalytics />} />
            <Route path="asset-analytics" element={<Navigate to="/ict/analytics" replace />} />
            <Route path="inventory" element={<ICTInventory />} />
            <Route path="asset-requests" element={<ICTAssetRequests />} />
            <Route path="requests" element={<Navigate to="/ict/asset-requests" replace />} />
            <Route path="equipment" element={<ICTEquipment />} />
            <Route path="network" element={<ICTNetwork />} />
            <Route path="software-licenses" element={<ICTSoftwareLicenses />} />
            <Route path="technical-support" element={<ICTTechnicalSupport />} />
            <Route path="support" element={<Navigate to="/ict/technical-support" replace />} />
            <Route path="incidents" element={<ICTIncidents />} />
            <Route path="notifications" element={<ICTNotifications />} />
            <Route path="assets/:id/history" element={<ICTAssetHistory />} />
          </Route>

          {/* COLLEGE ROUTES - canonical route for department-head responsibilities under the college role */}
          <Route path="/college" element={<ProtectedRoute allowedRoles={['college']}><RoleLayout /></ProtectedRoute>}>
            <Route index element={<CollegeManagerPages section="dashboard" />} />
            <Route path="profile" element={<CollegeManagerPages section="profile" />} />
            <Route path="departments" element={<CollegeDepartments />} />
            <Route path="departments/:departmentId" element={<DepartmentDetails />} />
            <Route path="department-overview" element={<CollegeManagerPages section="departments" />} />
            <Route path="department-deans" element={<CollegeManagerPages section="department-deans" />} />
            <Route path="department-staff" element={<CollegeManagerPages section="department-staff" />} />
            <Route path="department-assets" element={<CollegeManagerPages section="department-assets" />} />
            <Route path="department-requests" element={<CollegeManagerPages section="department-requests" />} />
            <Route path="department-performance" element={<CollegeManagerPages section="department-performance" />} />
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
            <Route path="verification" element={<CollegeManagerPages section="verification" />} />
            <Route path="reports" element={<CollegeManagerPages section="reports" />} />
            <Route path="analytics/assets" element={<CollegeManagerPages section="analytics-assets" />} />
            <Route path="analytics/departments" element={<CollegeManagerPages section="department-reports" />} />
            <Route path="notifications" element={<CollegeManagerPages section="notifications" />} />
            <Route path="history" element={<CollegeManagerPages section="history" />} />
            <Route path="history/:id" element={<DeptAssetHistory />} />
          </Route>

          <Route path="/department" element={<DepartmentWorkspaceRoute />}>
            <Route index element={<DeptDashboard />} />
            <Route path="profile" element={<DeptProfile />} />
            <Route path="staff" element={<DeptStaff />} />
            <Route path="locations" element={<DeptLocations />} />
            <Route path="assets" element={<DeptAssets />} />
            <Route path="inventory" element={<DeptReports />} />
            <Route path="requests" element={<DeptApprovals />} />
            <Route path="approvals" element={<DepartmentDeanRoute />} />
            <Route path="assignments" element={<DeptAssets />} />
            <Route path="transfers" element={<ScopedWorkflowPage type="transfers" />} />
            <Route path="returns" element={<ScopedWorkflowPage type="returns" />} />
            <Route path="maintenance" element={<DepartmentMaintenance />} />
            <Route path="maintenance-requests" element={<DepartmentMaintenance />} />
            <Route path="movement" element={<Navigate to="/department/history" replace />} />
            <Route path="utilization" element={<DeptUtilization />} />
            <Route path="verification" element={<DeptAssets />} />
            <Route path="reports" element={<DeptReports />} />
            <Route path="notifications" element={<DeptNotifications />} />
            <Route path="history" element={<DeptAssetHistory />} />
            <Route path="history/:id" element={<DeptAssetHistory />} />
          </Route>

          {/* FINANCE ROUTES - Fixed with RoleLayout */}
          <Route path="/finance" element={<ProtectedRoute allowedRoles={['admin', 'finance']}><RoleLayout /></ProtectedRoute>}>
            <Route index element={<FinanceDashboard />} />
            <Route path="purchase-requests" element={<FinancePurchaseRequests />} />
            <Route path="purchase-orders" element={<FinancePurchaseOrders />} />
            <Route path="suppliers" element={<FinanceSuppliers />} />
            <Route path="purchase-history" element={<FinancePurchaseHistory />} />
            <Route path="invoices" element={<FinanceInvoices />} />
            <Route path="payments" element={<FinancePayments />} />
            <Route path="transactions" element={<FinanceTransactions />} />
            <Route path="budget" element={<FinanceReports />} />
            <Route path="budget-management" element={<FinanceBudgetManagement />} />
            <Route path="valuation" element={<FinanceValuation />} />
            <Route path="depreciation" element={<FinanceDepreciation />} />
            <Route path="capitalization" element={<Capitalization />} />
            <Route path="disposal-financial-records" element={<DisposalFinancialRecords />} />
            <Route path="financial-reports" element={<FinanceReports />} />
            <Route path="budget-reports" element={<FinanceBudgetReports />} />
            <Route path="depreciation-reports" element={<FinanceDepreciationReports />} />
            <Route path="asset-value-reports" element={<FinanceAssetValueReports />} />
            <Route path="notifications" element={<FinanceNotifications />} />
          </Route>

          {/* STORE MANAGER ROUTES - Fixed with RoleLayout */}
          <Route path="/store" element={<ProtectedRoute allowedRoles={['store_manager']}><RoleLayout /></ProtectedRoute>}>
            <Route index element={<StoreDashboard />} />
            <Route path="inventory" element={<StoreInventory />} />
            <Route path="available-assets" element={<StoreAssets />} />
            <Route path="low-stock" element={<StoreLowStock />} />
            <Route path="stock-adjustments" element={<StoreAdjustments />} />
            <Route path="receive" element={<StoreReceivePage />} />
            <Route path="issue" element={<StoreIssuePage />} />
            <Route path="returns" element={<StoreReturnsPage />} />
            <Route path="transfers" element={<StoreTransfers />} />
            <Route path="requests" element={<StoreAssetRequests />} />
            <Route path="tracking" element={<StoreTracking />} />
            <Route path="history" element={<StoreHistory />} />
            <Route path="verification" element={<StoreTracking />} />
            <Route path="maintenance" element={<StoreMaintenance />} />
            <Route path="maintenance/status" element={<StoreMaintenance />} />
            <Route path="warranty" element={<StoreWarranty />} />
            <Route path="reports" element={<StoreReports />} />
            <Route path="reports/inventory" element={<StoreReports />} />
            <Route path="reports/issues" element={<StoreReports />} />
            <Route path="reports/returns" element={<StoreReports />} />
            <Route path="reports/movements" element={<StoreReports />} />
            <Route path="notifications" element={<StoreNotifications />} />
            <Route path="available" element={<Navigate to="/store/available-assets" replace />} />
            <Route path="rfid" element={<Navigate to="/store/tracking" replace />} />
            <Route path="movement-history" element={<Navigate to="/store/history" replace />} />
            <Route path="maintenance-status" element={<Navigate to="/store/maintenance/status" replace />} />
            <Route path="reports/movement" element={<Navigate to="/store/reports/movements" replace />} />
          </Route>

          {/* MAINTENANCE ROUTES - Fixed with RoleLayout */}
          <Route path="/maintenance" element={<ProtectedRoute allowedRoles={['maintenance', 'admin', 'ict_officer']}><MaintenanceLayout /></ProtectedRoute>}>
            <Route index element={<MaintDashboard />} />
            <Route path="requests" element={<MaintRequests />} />
            <Route path="inspection" element={<MaintAssetInspection />} />
            <Route path="work-orders" element={<MaintWorkOrders />} />
            <Route path="repairs" element={<MaintRepairs />} />
            <Route path="schedule" element={<MaintPreventive />} />
            <Route path="preventive" element={<MaintPreventive />} />
            <Route path="calendar" element={<MaintPreventive />} />
            <Route path="technicians" element={<MaintTechnicians />} />
            <Route path="spare-parts" element={<MaintSpareParts />} />
            <Route path="materials" element={<MaintSpareParts />} />
            <Route path="vendors" element={<MaintSpareParts />} />
            <Route path="assets-under-maintenance" element={<MaintAssetsUnderMaintenance />} />
            <Route path="testing-quality" element={<MaintTestingQuality />} />
            <Route path="quality-control" element={<MaintTestingQuality />} />
            <Route path="assigned-tasks" element={<MaintAssigned />} />
            <Route path="notifications" element={<MaintNotifications />} />
            <Route path="history" element={<MaintHistory />} />
            <Route path="cost-analysis" element={<MaintReports />} />
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
            <Route path="inventory" element={<InfrastructureInventory />} />
            <Route path="assignment" element={<InfrastructureAssignment />} />
            <Route path="transfer" element={<InfrastructureAssets />} />
            <Route path="verification" element={<InfrastructureVerification />} />
            
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
          </Route>

          {/* Catch-all redirect for authenticated routes. */}
          <Route path="*" element={<Navigate to={getDashboardRoute(user.role)} replace />} />
        </Routes>
      </Suspense>
    </AuthenticatedLayout>
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