import {
  AppFooter,
  shouldHideSidebarForPath,
  shouldUseStandaloneLoginLayout,
  shouldShowDashboardSidebar,
  isDashboardRoute,
  isPublicRoute,
} from './App';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import Login from './components/public/Login';
import fs from 'fs';
import path from 'path';

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    create: jest.fn(() => ({
      get: jest.fn(() => Promise.resolve({ status: 200 })),
      post: jest.fn(() => Promise.resolve({ status: 200 })),
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
    })),
    get: jest.fn(() => Promise.resolve({ status: 200 })),
    post: jest.fn(() => Promise.resolve({ status: 200 })),
    defaults: {
      headers: {
        common: {},
      },
    },
  },
}));

jest.mock('./contexts/UiContext', () => ({
  useLanguage: () => ({ language: 'en' }),
}));

jest.mock('./contexts/AuthContext', () => ({
  useAuth: () => ({ login: jest.fn(() => Promise.resolve({ success: true, user: { role: 'admin' } })) }),
  AuthProvider: ({ children }) => <>{children}</>,
}));

describe('Create Asset route visibility', () => {
  it('hides the sidebar on the create asset route', () => {
    expect(shouldHideSidebarForPath('/ict/assets/create')).toBe(true);
    expect(shouldHideSidebarForPath('/ict/assets/create/step-two')).toBe(true);
  });

  it('keeps the sidebar for normal dashboard routes', () => {
    expect(shouldHideSidebarForPath('/ict')).toBe(false);
    expect(shouldHideSidebarForPath('/ict/assets')).toBe(false);
  });
});

describe('Public and dashboard route rules', () => {
  it('treats only the public website pages as public', () => {
    expect(isPublicRoute('/')).toBe(true);
    expect(isPublicRoute('/home')).toBe(true);
    expect(isPublicRoute('/about')).toBe(true);
    expect(isPublicRoute('/contact')).toBe(true);
    expect(isPublicRoute('/help')).toBe(true);
    expect(isPublicRoute('/register')).toBe(true);
    expect(isPublicRoute('/forgot-password')).toBe(true);
    expect(isPublicRoute('/reset-password')).toBe(true);
    expect(isPublicRoute('/reset-password/token-123')).toBe(true);
    expect(isPublicRoute('/login')).toBe(false);
    expect(isPublicRoute('/dashboard')).toBe(false);
  });

  it('keeps login isolated and exposes the shared dashboard route', () => {
    expect(shouldUseStandaloneLoginLayout('/login')).toBe(true);
    expect(shouldUseStandaloneLoginLayout('/register')).toBe(false);
    expect(shouldUseStandaloneLoginLayout('/home')).toBe(false);

    expect(isDashboardRoute('/dashboard')).toBe(true);
    expect(isDashboardRoute('/dashboard/assets')).toBe(true);
    expect(isDashboardRoute('/dashboard/settings')).toBe(true);
    expect(isDashboardRoute('/home')).toBe(false);
  });

  it('shows the dashboard sidebar only on authenticated dashboard routes', () => {
    expect(shouldShowDashboardSidebar('/admin')).toBe(true);
    expect(shouldShowDashboardSidebar('/admin/assets')).toBe(true);
    expect(shouldShowDashboardSidebar('/dashboard')).toBe(true);
    expect(shouldShowDashboardSidebar('/dashboard/assets')).toBe(true);
    expect(shouldShowDashboardSidebar('/home')).toBe(false);
    expect(shouldShowDashboardSidebar('/login')).toBe(false);
    expect(shouldShowDashboardSidebar('/contact')).toBe(false);
    expect(shouldShowDashboardSidebar('/help')).toBe(false);
  });
});

describe('Administrator route wiring', () => {
  const appSource = fs.readFileSync(path.resolve(__dirname, 'App.jsx'), 'utf8');
  const documentedRoutes = [
    ['/admin', '', 'AdminDashboard'],
    ['/admin/assets', 'assets', 'AdminAssets'],
    ['/admin/assets/categories', 'assets/categories', 'AdminAssetCategories'],
    ['/admin/assets/assign', 'assets/assign', 'AdminAssignment'],
    ['/admin/assets/transfer', 'assets/transfer', 'AdminTransfer'],
    ['/admin/assets/disposal', 'assets/disposal', 'AdminAssetDisposal'],
    ['/admin/maintenance', 'maintenance', 'AdminMaintenance'],
    ['/admin/rfid', 'rfid', 'AdminRFIDTracking'],
    ['/admin/users', 'users', 'AdminUserManagement'],
    ['/admin/roles-permissions', 'roles-permissions', 'AdminRolesPermissions'],
    ['/admin/colleges', 'colleges', 'AdminCollegeManagement'],
    ['/admin/departments', 'departments', 'AdminDepartmentManagement'],
    ['/admin/locations', 'locations', 'AdminAssetLocations'],
    ['/admin/reports', 'reports', 'AdminReports'],
    ['/admin/reports/analytics', 'reports/analytics', 'AdminAnalyticsCenter'],
    ['/admin/analytics/system', 'analytics/system', 'AdminAnalyticsCenter'],
    ['/admin/audit-logs', 'audit-logs', 'AdminAuditLogs'],
    ['/admin/settings', 'settings', 'AdminSettings'],
    ['/admin/notifications', 'notifications', 'AdminNotifications'],
    ['/admin/backup', 'backup', 'AdminBackup'],
    ['/admin/monitoring', 'monitoring', 'SystemMonitoring'],
    ['/admin/inventory/quarantine', 'inventory/quarantine', 'AdminChemicalQuarantine'],
  ];

  it('registers all documented paths in the sidebar and renders their owning page under admin RBAC', () => {
    expect(appSource).toContain('<Route path="/admin" element={<ProtectedRoute allowedRoles={[\'admin\']}><AdminLayout /></ProtectedRoute>}>');
    for (const [route, nestedPath, component] of documentedRoutes) {
      expect(appSource).toContain(`path: '${route}'`);
      if (nestedPath) {
        expect(appSource).toContain(`<Route path="${nestedPath}" element={<${component}`);
      } else {
        expect(appSource).toContain('<Route index element={<AdminDashboard />} />');
      }
    }
  });
});

describe('Maintenance coordinator route wiring', () => {
  const appSource = fs.readFileSync(path.resolve(__dirname, 'App.jsx'), 'utf8');
  const maintenanceRoutes = [
    '/maintenance',
    '/maintenance/requests',
    '/maintenance/inspection',
    '/maintenance/work-orders',
    '/maintenance/repairs',
    '/maintenance/assets-under-maintenance',
    '/maintenance/schedule',
    '/maintenance/preventive',
    '/maintenance/calendar',
    '/maintenance/technicians',
    '/maintenance/spare-parts',
    '/maintenance/vendors',
    '/maintenance/testing-quality',
    '/maintenance/quality-control',
    '/maintenance/history',
    '/maintenance/reports',
  ];

  it('removes Cost Analysis while retaining the requested maintenance navigation', () => {
    expect(appSource).not.toContain('/maintenance/cost-analysis');
    expect(appSource).not.toContain('Cost Analysis');
    for (const route of maintenanceRoutes) {
      expect(appSource).toContain(`path: '${route}'`);
    }
  });

  it('routes technical testing separately from quality-control review', () => {
    expect(appSource).toContain('<Route path="testing-quality" element={<MaintTechnicalTesting />} />');
    expect(appSource).toContain('<Route path="testing" element={<MaintTechnicalTesting />} />');
    expect(appSource).toContain('<Route path="quality-control" element={<MaintTestingQuality />} />');
  });
});

describe('Login page navigation', () => {
  it('renders a homepage link on the standalone login page', () => {
    const { container } = render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    const homepageLink = screen.getByRole('link', { name: '← Back to Homepage' });
    expect(homepageLink).toHaveAttribute('href', 'https://smart-asset-management-six.vercel.app/home');
    expect(homepageLink.parentElement).toHaveClass('login-panel');
    const loginCard = container.querySelector('.login-panel .login-card');
    expect(loginCard).toBeInTheDocument();
    expect(loginCard.compareDocumentPosition(homepageLink) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('hides the global footer on login while keeping it on normal pages', () => {
    const footerProps = {
      t: {
        footerLabel: 'University footer',
        university: 'University',
        footerBrandTitle: 'Asset Management',
        footerDescription: 'University assets',
        footerNavigation: 'Navigation',
        home: 'Home',
        about: 'About',
        help: 'Help',
        contact: 'Contact',
        footerSystem: 'System',
        footerAssetManagement: 'Assets',
        inventory: 'Inventory',
        footerQrRfid: 'QR and RFID',
        maintenance: 'Maintenance',
        reports: 'Reports',
        footerSupport: 'Support',
        footerHelpCenter: 'Help center',
        footerFaq: 'FAQ',
        footerContactSupport: 'Contact support',
        footerLegal: 'Legal',
        privacyPolicy: 'Privacy policy',
        footerLegalUnavailable: 'Unavailable',
        footerTermsOfUse: 'Terms of use',
        language: 'Language',
        languageEnglish: 'English',
        languageAmharic: 'Amharic',
      },
      language: 'en',
      setLanguage: jest.fn(),
      organization: { name: 'Mekdela Amba University' },
    };
    const renderAt = (path) => render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/home" element={<h1>Home page</h1>} />
        </Routes>
        <AppFooter {...footerProps} />
      </MemoryRouter>
    );

    const loginPage = renderAt('/login');
    expect(screen.getByRole('heading', { name: 'Welcome Back' })).toBeInTheDocument();
    expect(screen.queryByRole('contentinfo', { name: 'University footer' })).not.toBeInTheDocument();
    loginPage.unmount();

    renderAt('/home');
    expect(screen.getByRole('heading', { name: 'Home page' })).toBeInTheDocument();
    expect(screen.getByRole('contentinfo', { name: 'University footer' })).toBeInTheDocument();
  });
});
