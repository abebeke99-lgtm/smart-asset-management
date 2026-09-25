import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from '../App';
import { useAuth } from '../contexts/AuthContext';
import { AccountProfile } from '../components/admin/AdminSettings';
import { apiClient } from '../utils/api';

jest.mock('../utils/api', () => ({
  apiClient: {
    post: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock('react-toastify', () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
  },
}));

jest.mock('../contexts/AuthContext', () => ({
  useAuth: jest.fn(),
  AuthProvider: ({ children }) => <>{children}</>,
}));

describe('ProtectedRoute auth flow', () => {
  it('waits for auth initialization before redirecting unauthenticated users', () => {
    useAuth.mockReturnValue({ user: null, loading: true, role: null });

    render(
      <MemoryRouter initialEntries={['/ict/network']}>
        <Routes>
          <Route path="/login" element={<div>Login page</div>} />
          <Route
            path="/ict/network"
            element={
              <ProtectedRoute allowedRoles={['ict_officer']}>
                <div>ICT Network</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('redirects unauthenticated users to login', () => {
    useAuth.mockReturnValue({ user: null, loading: false, role: null });

    render(
      <MemoryRouter initialEntries={['/ict/network']}>
        <Routes>
          <Route path="/login" element={<div>Login page</div>} />
          <Route
            path="/ict/network"
            element={
              <ProtectedRoute allowedRoles={['ict_officer']}>
                <div>ICT Network</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Login page')).toBeInTheDocument();
  });

  it('shows access denied for an authenticated user with the wrong role', () => {
    useAuth.mockReturnValue({ user: { role: 'college' }, loading: false });

    render(
      <MemoryRouter initialEntries={['/ict/network']}>
        <Routes>
          <Route path="/ict/network" element={<ProtectedRoute allowedRoles={['ict_officer']}><div>ICT Network</div></ProtectedRoute>} />
          <Route path="/dashboard" element={<div>Dashboard</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole('alert')).toHaveTextContent('You do not have permission to access this section.');
    expect(screen.queryByText('ICT Network')).not.toBeInTheDocument();
  });

  it('uploads profile photos without forcing a multipart content-type header', async () => {
    const updateUser = jest.fn();
    useAuth.mockReturnValue({ updateUser });
    apiClient.post.mockResolvedValue({
      data: {
        user: {
          username: 'admin',
          fullName: 'Admin User',
          role: 'admin',
          profilePhoto: 'uploads/profile/user-1.png',
        },
      },
    });

    render(<AccountProfile user={{ username: 'admin', fullName: 'Admin User', role: 'admin', profilePhoto: null }} />);

    const input = document.querySelector('input[type="file"]');
    const file = new File(['hello'], 'avatar.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });

    await Promise.resolve();

    expect(apiClient.post).toHaveBeenCalledTimes(1);
    expect(apiClient.post.mock.calls[0][0]).toBe('/api/users/profile/photo');
    expect(apiClient.post.mock.calls[0][2]).toBeUndefined();
    expect(apiClient.post.mock.calls[0][1] instanceof FormData).toBe(true);
  });
});
