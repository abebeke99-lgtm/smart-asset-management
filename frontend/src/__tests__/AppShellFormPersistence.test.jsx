import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from '../App';

const mockAdminUser = {
  id: 1,
  role: 'admin',
  username: 'admin.user',
  fullName: 'Admin User',
  permissions: ['users.create'],
};

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    create: jest.fn(() => ({
      get: jest.fn(() => Promise.resolve({ status: 200, data: {} })),
      post: jest.fn(() => Promise.resolve({ status: 200, data: {} })),
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
    })),
    get: jest.fn(() => Promise.resolve({ status: 200, data: {} })),
    post: jest.fn(() => Promise.resolve({ status: 200, data: {} })),
    defaults: { headers: { common: {} } },
  },
}));

jest.mock('../contexts/AuthContext', () => ({
  AuthProvider: ({ children }) => children,
  useAuth: () => ({
    user: mockAdminUser,
    loading: false,
    logout: jest.fn(),
    hasPermission: () => true,
  }),
}));

jest.mock('../services/apiClient', () => ({
  __esModule: true,
  default: {
    request: jest.fn(({ url } = {}) => {
      if (String(url).startsWith('/api/users/stats')) {
        return Promise.resolve({ data: { data: { total: 0, active: 0, inactive: 0, suspended: 0 } } });
      }
      if (String(url).startsWith('/api/roles')) {
        return Promise.resolve({ data: { roles: [{ id: 'admin', name: 'admin' }] } });
      }
      if (String(url).startsWith('/api/colleges')) {
        return Promise.resolve({ data: { colleges: [] } });
      }
      if (String(url).startsWith('/api/users')) {
        return Promise.resolve({ data: { users: [], pagination: { total: 0, pages: 1 } } });
      }
      return Promise.resolve({ data: {} });
    }),
    get: jest.fn(() => Promise.resolve({ data: {} })),
    post: jest.fn(() => Promise.resolve({ data: {} })),
    put: jest.fn(() => Promise.resolve({ data: {} })),
    delete: jest.fn(() => Promise.resolve({ data: {} })),
  },
  getApiErrorMessage: (error, fallback) => fallback || 'Request failed',
}));

describe('Authenticated shell identity across re-renders', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/admin/users');
  });

  it('keeps the Create User form open with typed values when the shell re-renders via language switch', async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: /add user/i }));

    fireEvent.change(screen.getByLabelText(/Full Name/), { target: { value: 'Persistence User' } });
    fireEvent.change(screen.getByLabelText('Username *'), { target: { value: 'persist.user' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'persist@example.edu' } });
    expect(screen.getByLabelText('Username *')).toHaveValue('persist.user');

    fireEvent.click(screen.getByRole('button', { name: 'Switch language to Amharic' }));

    expect(screen.getByLabelText('Username *')).toHaveValue('persist.user');
    expect(screen.getByLabelText('Email')).toHaveValue('persist@example.edu');
  });
});