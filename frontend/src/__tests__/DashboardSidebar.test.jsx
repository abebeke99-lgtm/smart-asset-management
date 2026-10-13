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

jest.mock('../utils/api', () => ({
  __esModule: true,
  apiBase: () => 'http://localhost',
  apiClient: {
    get: jest.fn(() => new Promise(() => {})),
    post: jest.fn(async () => ({ data: {} })),
  },
  getApiErrorMessage: (_error, fallback) => fallback || 'Request failed',
}));

jest.mock('../services/apiClient', () => ({
  __esModule: true,
  getApiErrorMessage: (_error, fallback) => fallback || 'Request failed',
  default: {
    get: jest.fn(() => Promise.resolve({ data: { data: { statistics: {} } } })),
    post: jest.fn(() => Promise.resolve({ data: {} })),
  },
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
    expect(screen.queryByRole('link', { name: 'Transactions' })).not.toBeInTheDocument();
    expect(within(sidebar).getByRole('button', { name: 'Logout' })).toBeInTheDocument();
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

  it('removes duplicate identity and branding from the college manager sidebar while retaining its menus and Logout', async () => {
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
    expect(sidebar.getByRole('button', { name: 'Logout' })).toBeInTheDocument();
    expect(sidebar.queryByText('bekele')).not.toBeInTheDocument();
    expect(sidebar.queryByText('COLLEGE MANAGER')).not.toBeInTheDocument();
    expect(sidebar.queryByText('Active')).not.toBeInTheDocument();
    expect(sidebar.queryByText('Mekdela Amba University')).not.toBeInTheDocument();
    expect(sidebar.getByRole('link', { name: 'Assignments' })).toBeInTheDocument();
    expect(sidebar.getByRole('link', { name: 'Transfers' })).toBeInTheDocument();
    expect(sidebar.getByRole('link', { name: 'Returns' })).toBeInTheDocument();
    expect(sidebar.getByRole('link', { name: 'Asset Requests' })).toBeInTheDocument();
    expect(screen.getByText('Mekdela Amba University')).toBeInTheDocument();

    fireEvent.click(sidebar.getByRole('button', { name: 'Logout' }));

    await waitFor(() => expect(mockLogout).toHaveBeenCalledTimes(1));
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
    ['infrastructure', 'Infrastructure Assets'],
  ])('keeps the %s menu and Logout while removing all duplicate sidebar cards', async (role, expectedMenu) => {
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
    expect(within(sidebar).getByRole('button', { name: 'Logout' })).toBeInTheDocument();
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

  it('logs out from the sidebar and returns to the signed-out route', async () => {
    await act(async () => {
      render(<App />);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Logout' }));

    await waitFor(() => expect(window.location.pathname).toBe('/login'));
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });
});
