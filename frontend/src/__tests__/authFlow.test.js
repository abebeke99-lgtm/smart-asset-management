import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from '../App';
import { useAuth } from '../contexts/AuthContext';

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
});
