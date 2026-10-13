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
  default: {
    get: jest.fn(() => Promise.resolve({ data: { data: {} } })),
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
    expect(sidebar).toHaveTextContent('Mekdela Amba University');
    expect(sidebar).toHaveTextContent('Asset Management System');
    expect(sidebar).toHaveTextContent('Admin User');
    expect(screen.getByRole('link', { name: 'Users' })).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByRole('link', { name: 'Transactions' })).not.toBeInTheDocument();
    expect(sidebar.querySelector('.sidebar-logout')).toHaveTextContent('Logout');
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

  it('removes duplicate identity and branding from the college manager sidebar while retaining header logout', async () => {
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
    expect(sidebarElement.querySelector('.sidebar-logout')).not.toBeInTheDocument();
    expect(sidebar.queryByText('bekele')).not.toBeInTheDocument();
    expect(sidebar.queryByText('COLLEGE MANAGER')).not.toBeInTheDocument();
    expect(sidebar.queryByText('Active')).not.toBeInTheDocument();
    expect(sidebar.queryByText('Mekdela Amba University')).not.toBeInTheDocument();
    expect(sidebar.getByRole('link', { name: 'Assignments' })).toBeInTheDocument();
    expect(sidebar.getByRole('link', { name: 'Transfers' })).toBeInTheDocument();
    expect(sidebar.getByRole('link', { name: 'Returns' })).toBeInTheDocument();
    expect(sidebar.getByRole('link', { name: 'Asset Requests' })).toBeInTheDocument();
    expect(screen.getByText('Mekdela Amba University')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open user menu' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Logout' }));

    await waitFor(() => expect(mockLogout).toHaveBeenCalledTimes(1));
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
