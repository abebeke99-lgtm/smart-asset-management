import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from '../App';

let mockAuthUser;
const mockLogout = jest.fn(async () => {
  mockAuthUser = null;
});

jest.mock('../contexts/AuthContext', () => ({
  AuthProvider: ({ children }) => children,
  useAuth: () => ({
    user: mockAuthUser,
    loading: false,
    logout: mockLogout,
    hasPermission: (permission) => mockAuthUser?.permissions
      ? mockAuthUser.permissions.includes(permission)
      : true,
  }),
}));

jest.mock('../contexts/DataContext', () => ({
  DataProvider: ({ children }) => children,
}));

const createMockApiClient = () => {
  const mockGet = jest.fn((url) => {
    if (url === '/api/infrastructure/dashboard') {
      return Promise.resolve({
        data: {
          data: {
            totalInfrastructureAssets: 10,
            buildings: 5,
            operationalAssets: 8,
            generators: 2,
            transformers: 3,
            criticalAlerts: 0,
            recentAssets: [],
            recentWorkOrders: [],
            workflowDataNote: 'Test data',
            summary: { totalInfrastructureAssets: 10, buildings: 5, operationalAssets: 8, criticalAlerts: 0 },
            operational: { operationalAssets: 8, generators: 2, transformers: 3 },
            statusBreakdown: {},
          },
        },
      });
    }
    if (url === '/api/notifications/unread-count') {
      return Promise.resolve({ data: { unreadCount: 0 } });
    }
    if (url.includes('/api/admin/settings')) {
      return Promise.resolve({ data: { settings: { organization: {} } } });
    }
    return Promise.resolve({ data: { data: {} } });
  });
  return {
    get: mockGet,
    post: jest.fn(() => Promise.resolve({ data: {} })),
  };
};

jest.mock('../utils/api', () => ({
  __esModule: true,
  apiBase: () => 'http://localhost',
  apiClient: createMockApiClient(),
  getApiErrorMessage: (_error, fallback) => fallback || 'Request failed',
}));

jest.mock('../services/apiClient', () => ({
  __esModule: true,
  getApiErrorMessage: (_error, fallback) => fallback || 'Request failed',
  default: createMockApiClient(),
}));

jest.mock('../components/admin/AdminUserManagement', () => () => <div>Admin users page</div>);
jest.mock('../components/finance/FinanceTransactions', () => () => <div>Finance transactions page</div>);

const setViewport = (matches) => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: jest.fn((media) => ({
      matches,
      media,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    })),
  });
};

describe('authenticated dashboard sidebar', () => {
  beforeEach(() => {
    mockAuthUser = {
      id: 1,
      role: 'admin',
      username: 'admin.user',
      fullName: 'Admin User',
    };
    mockLogout.mockClear();
    window.history.pushState({}, '', '/admin/users');
    setViewport(false);
  });

  it('renders the role-specific menu in the authenticated layout and marks the active link', async () => {
    await act(async () => {
      render(<App />);
    });

    const sidebar = screen.getByLabelText('Primary navigation');
    expect(sidebar).toBeInTheDocument();
    expect(sidebar).toHaveClass('admin-sidebar');
    expect(sidebar.querySelector('.admin-sidebar-profile')).not.toBeInTheDocument();
    expect(sidebar.querySelector('.sidebar-brand')).not.toBeInTheDocument();
    expect(sidebar.querySelector('.sidebar-account')).not.toBeInTheDocument();
    expect(within(sidebar).queryByText('Admin User')).not.toBeInTheDocument();
    expect(within(sidebar).queryByText('Mekdela Amba University')).not.toBeInTheDocument();
    expect(screen.getByText('Mekdela Amba University')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Users' })).toHaveAttribute('aria-current', 'page');
    expect(within(sidebar).getByRole('link', { name: 'Assets' })).toBeInTheDocument();
    expect(within(sidebar).getByRole('link', { name: 'Reports' })).toBeInTheDocument();
    for (const label of ['Chemical Quarantine', 'Analytics', 'Profile', 'Roles & Permissions']) {
      expect(within(sidebar).queryByRole('link', { name: label })).not.toBeInTheDocument();
    }
    expect(screen.queryByRole('link', { name: 'Transactions' })).not.toBeInTheDocument();
    expect(within(sidebar).queryByRole('button', { name: 'Logout' })).not.toBeInTheDocument();
  });

  it('updates the available menu when the authenticated role changes', async () => {
    let rerender;
    await act(async () => {
      ({ rerender } = render(<App />));
    });
    expect(screen.getByRole('link', { name: 'Users' })).toBeInTheDocument();

    mockAuthUser = {
      id: 2,
      role: 'finance',
      username: 'finance.user',
      fullName: 'Finance User',
    };
    await act(async () => rerender(<App />));

    expect(screen.getByRole('link', { name: 'Transactions' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Users' })).not.toBeInTheDocument();
  });

  it('removes College Analytics and sidebar Logout while retaining the other college menus', async () => {
    mockAuthUser = {
      id: 3,
      role: 'college_manager',
      username: 'bekele',
      fullName: 'bekele',
    };
    window.history.pushState({}, '', '/college/requests');

    await act(async () => {
      render(<App />);
    });

    const sidebarElement = screen.getByLabelText('Primary navigation');
    const sidebar = within(sidebarElement);
    expect(sidebarElement.querySelector('.admin-sidebar-profile')).not.toBeInTheDocument();
    expect(sidebarElement.querySelector('.sidebar-brand')).not.toBeInTheDocument();
    expect(sidebarElement.querySelector('.sidebar-account')).not.toBeInTheDocument();
    expect(sidebar.queryByRole('button', { name: 'Logout' })).not.toBeInTheDocument();
    expect(sidebar.queryByText('bekele')).not.toBeInTheDocument();
    expect(sidebar.queryByText('COLLEGE MANAGER')).not.toBeInTheDocument();
    expect(sidebar.queryByText('Active')).not.toBeInTheDocument();
    expect(sidebar.queryByText('Mekdela Amba University')).not.toBeInTheDocument();
    expect(sidebar.getByRole('link', { name: 'Assignments' })).toBeInTheDocument();
    expect(sidebar.getByRole('link', { name: 'Transfers' })).toBeInTheDocument();
    expect(sidebar.getByRole('link', { name: 'Returns' })).toBeInTheDocument();
    expect(sidebar.getByRole('link', { name: 'Asset Requests' })).toBeInTheDocument();
    expect(sidebar.getByRole('link', { name: 'College Reports' })).toBeInTheDocument();
    expect(sidebar.queryByRole('link', { name: 'College Analytics' })).not.toBeInTheDocument();
    expect(sidebar.getByRole('link', { name: 'Notifications' })).toBeInTheDocument();
    expect(screen.getByText('Mekdela Amba University')).toBeInTheDocument();
  });

  it.each([
    ['admin', 'Users'],
    ['ict_officer', 'ICT Assets'],
    ['college_manager', 'Assignments'],
    ['college', 'Assets'],
    ['department_head', 'Asset Requests'],
    ['teaching_assistant', 'Department Assets'],
    ['staff', 'Department Assets'],
    ['student', 'Dashboard'],
    ['finance', 'Transactions'],
    ['store_manager', 'Inventory'],
    ['maintenance', 'Requests'],
    ['maintenance_coordinator', 'Requests'],
    ['infrastructure', 'Assets'],
  ])('keeps the %s menu and removes sidebar Logout while removing all duplicate sidebar cards', async (role, expectedMenu) => {
    mockAuthUser = {
      id: 40,
      role,
      username: `${role}.user`,
      fullName: `${role} User`,
    };

    await act(async () => {
      render(<App />);
    });

    const sidebar = screen.getByLabelText('Primary navigation');
    expect(sidebar.querySelector('.admin-sidebar-profile')).not.toBeInTheDocument();
    expect(sidebar.querySelector('.sidebar-brand')).not.toBeInTheDocument();
    expect(sidebar.querySelector('.sidebar-account')).not.toBeInTheDocument();
    expect(within(sidebar).queryByText(`${role} User`)).not.toBeInTheDocument();
    expect(within(sidebar).queryByText('Active')).not.toBeInTheDocument();
    expect(within(sidebar).queryByText('University Asset Management System')).not.toBeInTheDocument();
    expect(within(sidebar).getByRole('link', { name: expectedMenu })).toBeInTheDocument();
    expect(within(sidebar).queryByRole('button', { name: 'Logout' })).not.toBeInTheDocument();
  });

  it('shows the infrastructure feature navigation', async () => {
    mockAuthUser = {
      id: 41,
      role: 'infrastructure',
      username: 'infrastructure.user',
      fullName: 'Infrastructure User',
    };
    window.history.pushState({}, '', '/infrastructure/dashboard');

    await act(async () => {
      render(<App />);
    });

    const sidebarElement = screen.getByLabelText('Primary navigation');
    expect(sidebarElement).toHaveClass('infrastructure-sidebar');
    const sidebar = within(sidebarElement);
    expect(sidebarElement.querySelectorAll('.sidebar-section')).toHaveLength(6);
    const expectedItems = [
      'Dashboard',
      'Infrastructure',
      'Assets',
      'Register Asset',
      'Inventory',
      'Buildings',
      'Electrical',
      'Generators',
      'Transformers',
      'UPS',
      'Solar',
      'Water',
      'Roads',
      'Spare Parts',
      'Energy',
      'Fuel',
      'Assignment',
      'Tracking',
      'Transfer',
      'Inspection',
      'Verification',
      'Maintenance',
      'Preventive Maintenance',
      'Work Orders',
      'Requests',
      'Documents',
      'Notifications',
      'Reports',
      'Audit',
    ];
    expectedItems.forEach((label) => {
      expect(sidebar.getByRole('link', { name: label })).toBeInTheDocument();
    });

    const infrastructureLinks = within(sidebarElement).getAllByRole('link');
    expect(infrastructureLinks.map((link) => link.textContent.trim())).toEqual(expectedItems);
    expect(within(sidebarElement).getAllByRole('link', { name: 'Infrastructure' })).toHaveLength(1);
    expect(within(sidebarElement).getAllByRole('link', { name: 'Dashboard' })).toHaveLength(1);
    expect(infrastructureLinks.map((link) => link.getAttribute('href'))).toEqual([
      '/infrastructure/dashboard',
      '/infrastructure',
      '/infrastructure/assets',
      '/infrastructure/assets/register',
      '/infrastructure/inventory',
      '/infrastructure/buildings',
      '/infrastructure/electrical',
      '/infrastructure/generators',
      '/infrastructure/transformers',
      '/infrastructure/ups',
      '/infrastructure/solar',
      '/infrastructure/water',
      '/infrastructure/roads',
      '/infrastructure/spare-parts',
      '/infrastructure/energy',
      '/infrastructure/fuel',
      '/infrastructure/assignment',
      '/infrastructure/tracking',
      '/infrastructure/transfer',
      '/infrastructure/inspection',
      '/infrastructure/verification',
      '/infrastructure/maintenance',
      '/infrastructure/preventive',
      '/infrastructure/work-orders',
      '/infrastructure/requests',
      '/infrastructure/documents',
      '/infrastructure/notifications',
      '/infrastructure/reports',
      '/infrastructure/audit',
    ]);
  });

  it.each([
    ['/infrastructure/assets/register', 'Register Asset', 'Register New Asset'],
    ['/infrastructure/assignment', 'Assignment', 'Asset Assignment'],
    ['/infrastructure/transfer', 'Transfer', 'Asset Transfer'],
    ['/infrastructure/verification', 'Verification', 'Asset Verification'],
    ['/infrastructure/inventory', 'Inventory', 'Asset Inventory'],
  ])('navigates to %s, renders its page in the dashboard content, and activates its link', async (path, label, heading) => {
    mockAuthUser = {
      id: 42,
      role: 'infrastructure',
      username: 'infrastructure.user',
      fullName: 'Infrastructure User',
    };
    window.history.pushState({}, '', '/infrastructure/dashboard');

    await act(async () => {
      render(<App />);
    });

    const sidebar = within(screen.getByLabelText('Primary navigation'));
    const link = sidebar.getByRole('link', { name: label });
    fireEvent.click(link);

    await waitFor(() => {
      expect(window.location.pathname).toBe(path);
      expect(link).toHaveAttribute('aria-current', 'page');
    });
    if (path === '/infrastructure/assets/register') {
      expect(sidebar.getByRole('link', { name: 'Assets' })).toHaveClass('is-active');
    }
    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
    expect(document.querySelector('.dashboard-layout-body')).toContainElement(
      screen.getByRole('heading', { name: heading }),
    );
  });

  it('redirects the Infrastructure root to the dashboard within the layout', async () => {
    mockAuthUser = {
      id: 45,
      role: 'infrastructure',
      username: 'infrastructure.user',
      fullName: 'Infrastructure User',
    };
    window.history.pushState({}, '', '/infrastructure');

    await act(async () => {
      render(<App />);
    });

    await waitFor(() => expect(window.location.pathname).toBe('/infrastructure/dashboard'));
    await waitFor(() => {
      expect(document.querySelector('.dashboard-layout-body')?.textContent.trim()).not.toBe('');
    });
  });

  it('renders an Infrastructure not-found page inside the dashboard layout', async () => {
    mockAuthUser = {
      id: 43,
      role: 'infrastructure',
      username: 'infrastructure.user',
      fullName: 'Infrastructure User',
    };
    window.history.pushState({}, '', '/infrastructure/unknown-page');

    await act(async () => {
      render(<App />);
    });

    const heading = await screen.findByRole('heading', { name: 'Page not found' });
    expect(document.querySelector('.dashboard-layout-body')).toContainElement(heading);
  });

  it('opens and closes the mobile navigation with its button and Escape key', async () => {
    setViewport(true);
    await act(async () => {
      render(<App />);
    });

    const sidebar = screen.getByLabelText('Primary navigation');
    expect(sidebar).toHaveAttribute('aria-hidden', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Expand navigation menu' }));
    expect(sidebar).toHaveClass('is-mobile-open');
    expect(sidebar).toHaveAttribute('aria-hidden', 'false');
    expect(screen.getByRole('button', { name: 'Collapse navigation menu' })).toHaveAttribute('aria-expanded', 'true');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(sidebar).not.toHaveClass('is-mobile-open');
    expect(sidebar).toHaveAttribute('aria-hidden', 'true');
  });

  it('keeps Logout in the profile menu and returns to the signed-out route', async () => {
    await act(async () => {
      render(<App />);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Open user menu' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Logout' }));

    await waitFor(() => expect(window.location.pathname).toBe('/login'));
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });
});
