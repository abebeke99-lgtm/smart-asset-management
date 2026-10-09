/* eslint-disable no-unused-vars, no-dupe-keys, no-template-curly-in-string */
import React from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { getDashboardRoute, ProtectedRoute } from './App';
import { useAuth } from './contexts/AuthContext';

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
  useTranslation: () => ({ language: 'en', t: (_key, fallback) => fallback }),
}));

jest.mock('./contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('./services/apiClient', () => ({
  __esModule: true,
  default: {
    get: jest.fn(() => Promise.resolve({ status: 200 })),
    post: jest.fn(() => Promise.resolve({ status: 200 })),
  },
  getApiErrorMessage: jest.fn((error, fallback) => fallback || 'Request failed'),
}));

const returnLink = () => screen.getByRole('link', { name: 'Return to your dashboard' });

const renderProtectedRoute = (user, allowedRoles = ['admin']) => {
  useAuth.mockReturnValue({
    user,
    loading: false,
    hasPermission: () => true,
  });

  return render(
    <MemoryRouter initialEntries={['/protected']}>
      <Routes>
        <Route
          path="/protected"
          element={
            <ProtectedRoute allowedRoles={allowedRoles}>
              <div>Protected content</div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>
  );
};

describe('AccessDenied dashboard redirect', () => {
  const roleCases = [
    ['admin', 'ict-officer-only'],
    ['ict_officer', 'admin'],
    ['college_manager', 'admin'],
    ['department_head', 'admin'],
    ['store_manager', 'admin'],
    ['maintenance', 'admin'],
    ['infrastructure', 'admin'],
    ['staff', 'admin'],
    ['student', 'admin'],
  ];

  it.each(roleCases)(
    'sends a %s user to the dashboard mapped by getDashboardRoute',
    (role, disallowedRole) => {
      renderProtectedRoute({ role }, [disallowedRole]);

      expect(returnLink()).toHaveAttribute('href', getDashboardRoute(role));
    }
  );

  it('keeps the existing AccessDenied content for a disallowed user', () => {
    renderProtectedRoute({ role: 'finance' });

    expect(screen.getByRole('heading', { name: 'Access denied' })).toBeInTheDocument();
    expect(screen.getByText('You do not have permission to access this section.')).toBeInTheDocument();
    expect(returnLink()).toHaveAttribute('href', getDashboardRoute('finance'));
  });

  it('does not send non-administrator users to the administrator-only /dashboard route', () => {
    for (const role of ['ict_officer', 'college_manager', 'department_head', 'store_manager', 'maintenance', 'infrastructure', 'staff', 'student', 'finance']) {
      const { unmount } = renderProtectedRoute({ role });
      expect(returnLink()).not.toHaveAttribute('href', '/dashboard');
      expect(returnLink()).toHaveAttribute('href', getDashboardRoute(role));
      unmount();
    }
  });

  it('falls back to the public route when the authenticated user has no usable role', () => {
    renderProtectedRoute({ role: null, roles: [] });

    expect(returnLink()).toHaveAttribute('href', getDashboardRoute());
    expect(returnLink()).toHaveAttribute('href', '/home');
  });
});