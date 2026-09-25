import {
  shouldHideSidebarForPath,
  shouldUseStandaloneLoginLayout,
  shouldShowDashboardSidebar,
  isDashboardRoute,
  isPublicRoute,
} from './App';
import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import Login from './components/public/Login';

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
  });
});

describe('Login page navigation', () => {
  it('renders a homepage link on the standalone login page', () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    const homepageLink = screen.getByRole('link', { name: '← Back to Homepage' });
    expect(homepageLink).toHaveAttribute('href', '/home');
  });
});
