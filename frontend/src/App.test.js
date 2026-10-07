/* eslint-disable no-unused-vars, no-dupe-keys, no-template-curly-in-string */
import {
  AppFooter,
  shouldHideSidebarForPath,
  shouldUseStandaloneLoginLayout,
  shouldShowDashboardSidebar,
  shouldShowDashboardHeader,
  isDashboardRoute,
  isPublicRoute,
} from './App';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Login from './components/public/Login';
import AdminDashboard from './components/admin/AdminDashboard';
import apiClient from './services/apiClient';
import fs from 'fs';
import path from 'path';

const mockLogin = jest.fn();

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
  useAuth: () => ({ login: mockLogin }),
  AuthProvider: ({ children }) => <>{children}</>,
}));

jest.mock('./services/apiClient', () => ({
  __esModule: true,
  default: {
    get: jest.fn(() => Promise.resolve({
      data: {
        assets: { total: 0, active: 0, damaged: 0, assigned: 0, available: 0, maintenance: 0, expired: 0 },
        users: 0,
        colleges: 0,
        departments: 0,
        maintenance: { submitted: 0, scheduled: 0, inProgress: 0, completed: 0, overdue: 0 },
        recentActivity: [],
        recentAssets: [],
        assetByStatus: [],
        assetByCategory: [],
        alerts: [],
        quickActions: [],
      },
    })),
  },
  getApiErrorMessage: jest.fn((error, fallback) => fallback || 'Request failed'),
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

  it('uses the shared dashboard header for every authenticated role', () => {
    expect(shouldShowDashboardHeader('/admin')).toBe(true);
    expect(shouldShowDashboardHeader('/admin/assets')).toBe(true);
    expect(shouldShowDashboardHeader('/ict')).toBe(true);
    expect(shouldShowDashboardHeader('/login')).toBe(false);
  });

  it('keeps the shared admin shell header and removes the duplicate page title from the dashboard content', async () => {
    apiClient.get.mockResolvedValueOnce({
      data: {
        data: {
          statistics: {},
          thresholds: {},
        },
      },
    });
    render(<AdminDashboard />);

    await waitFor(() => expect(screen.getByText('Asset Overview')).toBeInTheDocument());

    expect(screen.queryByText('Administrator Dashboard')).not.toBeInTheDocument();
  });

  it('shows an error state when the dashboard request never settles', async () => {
    jest.useFakeTimers();
    apiClient.get.mockReturnValueOnce(new Promise(() => {}));

    try {
      render(<AdminDashboard />);
      expect(screen.getByLabelText('Loading administrator dashboard')).toBeInTheDocument();

      await act(async () => {
        jest.advanceTimersByTime(15000);
      });

      expect(screen.getByRole('heading', { name: 'Admin Dashboard' })).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent('Dashboard data took too long to load. Please try again.');
      expect(screen.queryByLabelText('Loading administrator dashboard')).not.toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
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
    ['/admin/inventory/quarantine', 'inventory/quarantine', 'AdminChemicalQuarantine'],
    ['/admin/users', 'users', 'AdminUserManagement'],
    ['/admin/roles-permissions', 'roles-permissions', 'AdminRolesPermissions'],
    ['/admin/colleges', 'colleges', 'AdminCollegeManagement'],
    ['/admin/departments', 'departments', 'AdminDepartmentManagement'],
    ['/admin/locations', 'locations', 'AdminAssetLocations'],
    ['/admin/reports', 'reports', 'AdminReports'],
    ['/admin/reports/analytics', 'reports/analytics', 'AdminAssetAnalytics'],
    ['/admin/analytics/system', 'analytics/system', 'AdminAnalyticsCenter'],
    ['/admin/settings', 'settings', 'AdminSettings'],
    ['/admin/notifications', 'notifications', 'AdminNotifications'],
    ['/admin/backup', 'backup', 'AdminBackup'],
    ['/admin/enam', 'enam', 'EnamIntegration'],
    ['/admin/monitoring', 'monitoring', 'SystemMonitoring'],
  ];

  it('registers all documented paths in the sidebar and renders their owning page under admin RBAC', () => {
    expect(appSource).toContain('<Route path="/admin" element={<ProtectedRoute allowedRoles={[\'admin\']}><AdminLayout /></ProtectedRoute>}>');
    expect(appSource).toContain('<Route path="roles-permissions" element={<ProtectedRoute allowedRoles={[\'admin\']} allowedPermissions={[\'roles.view\']}><AdminRolesPermissions /></ProtectedRoute>} />');
    for (const [route, nestedPath, component] of documentedRoutes) {
      if (nestedPath) {
        if (nestedPath !== 'roles-permissions') {
          expect(appSource).toContain(`<Route path="${nestedPath}" element={<${component}`);
        }
      } else {
        expect(appSource).toContain('<Route index element={<AdminDashboard />} />');
      }
    }
  });

  it('has one canonical shared app shell and redirects the analytics grouping to system analytics', () => {
    expect(appSource).toContain('const DashboardLayout = ({ header, sidebar, sidebarOpen, onCloseSidebar');
    expect(appSource).toContain('return <AuthenticatedLayout>{routeTree}</AuthenticatedLayout>;');
    expect(appSource).toContain('const AdminLayout = () => (');
    expect(appSource).toContain('<Route path="/admin" element={<ProtectedRoute allowedRoles={[\'admin\']}><AdminLayout /></ProtectedRoute>}>' );
    expect(appSource).toContain('<Route path="analytics" element={<Navigate to="/admin/analytics/system" replace />} />');
    expect(appSource).not.toContain('<Route path="system-analytics" element={<AdminAnalyticsCenter system />} />');
  });
});

describe('ICT Officer sidebar specification', () => {
  const appSource = fs.readFileSync(path.resolve(__dirname, 'App.jsx'), 'utf8');
  const dashboardSource = fs.readFileSync(path.resolve(__dirname, 'components/ict/ICTDashboard.jsx'), 'utf8');
  const sidebarMatch = appSource.match(/'ict_officer': \[([\s\S]*?)\],\s*'college_manager':/);
  const sidebarItems = [...(sidebarMatch?.[1] || '').matchAll(/\{ path: '([^']+)', label: '([^']+)',(?: icon: [^,}]+,)? section: '([^']+)' \}/g)]
    .map(([, route, label, section]) => ({ route, label, section }));
  const expectedSidebarItems = [
    { route: '/ict/dashboard', label: 'Dashboard', section: 'DASHBOARD' },
    { route: '/ict/assets', label: 'ICT Assets', section: 'ASSET MANAGEMENT' },
    { route: '/ict/inventory', label: 'Inventory', section: 'ASSET MANAGEMENT' },
    { route: '/ict/assignments', label: 'Assignments', section: 'ASSET MANAGEMENT' },
    { route: '/ict/asset-requests', label: 'Asset Requests', section: 'ASSET MANAGEMENT' },
    { route: '/ict/equipment', label: 'IT Equipment', section: 'TECHNICAL OPERATIONS' },
    { route: '/ict/network', label: 'Network Equipment', section: 'TECHNICAL OPERATIONS' },
    { route: '/ict/software-licenses', label: 'Software Licenses', section: 'TECHNICAL OPERATIONS' },
    { route: '/ict/support', label: 'Technical Support', section: 'TECHNICAL OPERATIONS' },
    { route: '/ict/incidents', label: 'Incident Management', section: 'TECHNICAL OPERATIONS' },
    { route: '/ict/maintenance', label: 'ICT Maintenance', section: 'MAINTENANCE' },
    { route: '/ict/repairs', label: 'Repair History', section: 'MAINTENANCE' },
    { route: '/ict/device-health', label: 'Device Health', section: 'MAINTENANCE' },
    { route: '/ict/tracking', label: 'RFID / QR Tracking', section: 'TRACKING' },
    { route: '/ict/asset-history', label: 'Asset History', section: 'TRACKING' },
    { route: '/ict/reports', label: 'ICT Reports', section: 'ANALYTICS & REPORTS' },
    { route: '/ict/analytics', label: 'Asset Analytics', section: 'ANALYTICS & REPORTS' },
    { route: '/ict/notifications', label: 'Notifications', section: 'SYSTEM' },
  ];

  it('contains only the documented ICT sidebar items and sections in the approved order', () => {
    expect(sidebarMatch).not.toBeNull();
    expect(sidebarItems).toEqual(expectedSidebarItems);
  });

  it('maps every ICT sidebar item to its page within the role-protected ICT route tree', () => {
    expect(appSource).toContain('<Route path="/ict" element={<ProtectedRoute allowedRoles={[\'ict_officer\', \'admin\']}><RoleLayout /></ProtectedRoute>}>');
    const pageRoutes = {
      '/ict/dashboard': 'dashboard',
      '/ict/assets': 'assets',
      '/ict/inventory': 'inventory',
      '/ict/assignments': 'assignments',
      '/ict/asset-requests': 'asset-requests',
      '/ict/equipment': 'equipment',
      '/ict/network': 'network',
      '/ict/software-licenses': 'software-licenses',
      '/ict/support': 'support',
      '/ict/incidents': 'incidents',
      '/ict/maintenance': 'maintenance',
      '/ict/repairs': 'repairs',
      '/ict/device-health': 'device-health',
      '/ict/tracking': 'tracking',
      '/ict/asset-history': 'asset-history',
      '/ict/reports': 'reports',
      '/ict/analytics': 'analytics',
      '/ict/notifications': 'notifications',
    };

    for (const path of Object.keys(pageRoutes)) {
      expect(appSource).toContain(`<Route path="${pageRoutes[path]}" element={<`);
    }
  });

  it('keeps the ICT dashboard free of extra module cards and navigation shortcuts', () => {
    expect(dashboardSource).not.toContain('ICT_MODULES');
    expect(dashboardSource).not.toContain('ict-module-card');
    expect(dashboardSource).not.toMatch(/<Link\b|<a\b|href=|to=\s*["'{]/);
  });
});

describe('Department Head sidebar specification', () => {
  const appSource = fs.readFileSync(path.resolve(__dirname, 'App.jsx'), 'utf8');
  const sidebarCss = fs.readFileSync(path.resolve(__dirname, 'App.css'), 'utf8');
  const expectedItems = [
    ['/department-head', 'Dashboard'],
    ['/department-head/profile', 'Department Profile'],
    ['/department-head/staff', 'Staff'],
    ['/department-head/locations', 'Locations'],
    ['/department-head/laboratories', 'Laboratories'],
    ['/department-head/assets', 'Assets'],
    ['/department-head/inventory', 'Inventory'],
    ['/department-head/requests', 'Asset Requests'],
    ['/department-head/approvals', 'Approval Queue'],
    ['/department-head/assignments', 'Assignments'],
    ['/department-head/transfers', 'Transfers'],
    ['/department-head/returns', 'Returns'],
    ['/department-head/verification', 'Verification'],
    ['/department-head/maintenance-requests', 'Service Requests'],
    ['/department-head/maintenance', 'Maintenance'],
    ['/department-head/history', 'History'],
    ['/department-head/tickets', 'Tickets'],
    ['/department-head/tickets/escalated', 'Escalated Tickets'],
    ['/department-head/tracking', 'Tracking'],
    ['/department-head/reports', 'Reports'],
    ['/department-head/analytics', 'Analytics'],
    ['/department-head/notifications', 'Notifications'],
  ];
  const itemSource = appSource.match(/const departmentHeadItems = \[([\s\S]*?)\];/)?.[1] || '';
  const sidebarItems = [...itemSource.matchAll(/\{ path: '([^']+)', label: '([^']+)'/g)]
    .map(([, route, label]) => [route, label]);

  it('contains exactly the approved 22 items once, in the approved order and categories', () => {
    expect(sidebarItems).toEqual(expectedItems);
    expect(new Set(sidebarItems.map(([route]) => route)).size).toBe(22);
    expect(new Set(sidebarItems.map(([, label]) => label)).size).toBe(22);

    const sectionSource = appSource.match(/const departmentManagerSections = \[([\s\S]*?)\];/)?.[1] || '';
    expect([...sectionSource.matchAll(/\{ label: '([^']+)'/g)].map(([, label]) => label)).toEqual([
      'MAIN',
      'DEPARTMENT MANAGEMENT',
      'ASSET MANAGEMENT',
      'OPERATIONS',
      'REPORTS & ANALYTICS',
    ]);
    expect(sectionSource).toContain('departmentHeadItems.slice(0, 1)');
    expect(sectionSource).toContain('departmentHeadItems.slice(1, 5)');
    expect(sectionSource).toContain('departmentHeadItems.slice(5, 13)');
    expect(sectionSource).toContain('departmentHeadItems.slice(13, 19)');
    expect(sectionSource).toContain('departmentHeadItems.slice(19)');
    expect(itemSource).not.toContain("label: 'Asset History'");
    expect(appSource).toContain("sidebarRole === 'department_head' && departmentManagerSections.map");
    expect(appSource).toMatch(/sidebarRole === 'department_head'\s*\?\s*departmentHeadItems/);
  });

  describe('Department Head analytics route access', () => {
    const appSource = fs.readFileSync(path.resolve(__dirname, 'App.jsx'), 'utf8');

    it('relies on the Department Head protected parent route instead of optional permission configuration', () => {
      expect(appSource).toMatch(/<Route path="analytics" element={<DeptAnalytics \/>} \/>/);
      expect(appSource).not.toMatch(/<Route path="analytics" element={<ProtectedRoute allowedPermissions=\{\['department_head\.analytics\.view'\]\}/);
    });
  });

  it('maps Department Head inventory to the inventory view and keeps reports separate', () => {
    expect(appSource).toContain('<Route path="dashboard" element={<DeptDashboard />} />');
    expect(appSource).toContain('<Route path="inventory" element={<DeptReports inventoryMode />} />');
    expect(appSource).toContain('<Route path="reports" element={<DeptReports />} />');
    expect(appSource).toContain('<Route path="notifications" element={<DeptNotifications />} />');
  });

  it('keeps legacy Department Head request and service URLs mapped to their existing scoped pages', () => {
    expect(appSource).toContain('<Route path="asset-requests" element={<DeptApprovals />} />');
    expect(appSource).toContain('<Route path="approval-queue" element={<DepartmentDeanRoute />} />');
    expect(appSource).toContain('<Route path="service-requests" element={<DepartmentMaintenance />} />');
  });

  it('keeps active-route matching and the approved visual/responsive styling scoped to Department Head', () => {
    expect(appSource).toContain(".find((item) => location.pathname === item.path || location.pathname.startsWith(`${item.path}/`))?.path");
    expect(appSource).toContain("sidebarRole === 'department_head' ? ' department-head-sidebar' : ''");
    expect(sidebarCss).toMatch(/\.department-head-sidebar,\s*body\.dark \.department-head-sidebar/);
    expect(sidebarCss).toContain('background: #111827 !important;');
    expect(sidebarCss).toContain('color: #E5E7EB;');
    expect(sidebarCss).toContain('color: #94A3B8;');
    expect(sidebarCss).toContain('background: #1E3A5F;');
    expect(sidebarCss).toContain('background: #2563EB;');
    expect(sidebarCss).toContain('background: #F4C542;');
    expect(sidebarCss).toContain('.authenticated-shell > .admin-sidebar.department-head-sidebar');
  });
});

describe('College Manager sidebar specification', () => {
  const appSource = fs.readFileSync(path.resolve(__dirname, 'App.jsx'), 'utf8');
  const collegeSections = [
    { name: 'collegeOverviewItems', heading: 'MAIN', items: [['/college', 'Dashboard']] },
    {
      name: 'collegeManagementItems',
      heading: 'COLLEGE MANAGEMENT',
      items: [
        ['/college/profile', 'College Profile'],
        ['/college/staff', 'College Staff'],
        ['/college/locations', 'Locations'],
        ['/college/departments', 'Departments'],
      ],
    },
    {
      name: 'collegeAssetItems',
      heading: 'ASSET MANAGEMENT',
      items: [
        ['/college/assets', 'All College Assets'],
        ['/college/inventory', 'Inventory'],
        ['/college/requests', 'Asset Requests'],
        ['/college/approvals', 'Approvals'],
        ['/college/assignments', 'Assignments'],
        ['/college/transfers', 'Transfers'],
        ['/college/returns', 'Returns'],
      ],
    },
    {
      name: 'collegeOperationsItems',
      heading: 'OPERATIONS',
      items: [
        ['/college/maintenance', 'Maintenance Oversight'],
        ['/college/rfid', 'RFID / QR Tracking'],
        ['/college/verification', 'Asset Verification'],
      ],
    },
    {
      name: 'collegeAnalyticsItems',
      heading: 'REPORTS & ANALYTICS',
      items: [
        ['/college/reports', 'College Reports'],
        ['/college/analytics/assets', 'College Analytics'],
        ['/college/notifications', 'Notifications'],
      ],
    },
  ];

  it('renders only the 18 approved items under the five approved sections', () => {
    const actualSections = collegeSections.map(({ name, heading }) => {
      const sectionSource = appSource.match(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\];`))?.[1] || '';
      const items = [...sectionSource.matchAll(/\{ path: '([^']+)', label: '([^']+)'/g)]
        .map(([, route, label]) => [route, label]);
      return { heading, items };
    });
    expect(actualSections).toEqual(collegeSections.map(({ heading, items }) => ({ heading, items })));
    expect(actualSections.flatMap(({ items }) => items)).toHaveLength(18);
    for (const { heading } of collegeSections) {
      expect(appSource).toContain(`translateCollegeNavigation('${heading}')`);
    }
    expect(appSource).not.toContain("translateCollegeNavigation('SYSTEM')");
    expect(appSource).not.toContain("translateCollegeNavigation('COLLEGE MANAGER')");
  });

  it('links each approved item to a registered College route', () => {
    const collegeRouteTree = appSource.split('<Route path="/college"')[1]?.split('<Route path="/department-head"')[0] || '';
    expect(collegeRouteTree).toContain('<Route index element={<CollegeManagerPages section="dashboard" />} />');
    for (const [route] of collegeSections.flatMap(({ items }) => items)) {
      if (route === '/college') continue;
      expect(collegeRouteTree).toContain(`<Route path="${route.slice('/college/'.length)}"`);
    }
    expect(appSource).toContain('to={item.path}');
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
    expect(homepageLink).toHaveAttribute('href', '/home');
    expect(homepageLink.parentElement).toHaveClass('login-panel');
    const loginCard = container.querySelector('.login-panel .login-card');
    expect(loginCard).toBeInTheDocument();
    expect(loginCard.compareDocumentPosition(homepageLink) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('prevents duplicate login submissions while a request is in flight', async () => {
    mockLogin.mockResolvedValue({ success: true, user: { role: 'admin' } });

    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/admin" element={<div>Admin Dashboard</div>} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText('Username or Email'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Password123!' } });

    const submitButton = screen.getByRole('button', { name: /sign in/i });
    fireEvent.click(submitButton);
    fireEvent.click(submitButton);

    await waitFor(() => expect(mockLogin).toHaveBeenCalledTimes(1));
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
