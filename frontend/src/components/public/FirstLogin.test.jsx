import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import FirstLogin from './FirstLogin';
import { useAuth } from '../../contexts/AuthContext';
import { apiClient } from '../../utils/api';
import { UIProvider } from '../../contexts/UiContext';

jest.mock('../../contexts/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../utils/api', () => ({ apiClient: { post: jest.fn() } }));

const pendingUser = {
  id: 7,
  fullName: 'Test User',
  role: 'maintenance',
  contactMethods: [{ channel: 'email', masked: 't***@university.edu' }],
};
const completeSession = jest.fn();

const renderPage = () => render(
  <MemoryRouter initialEntries={['/first-login']}>
    <UIProvider>
      <Routes>
        <Route path="/first-login" element={<FirstLogin />} />
        <Route path="/maintenance/dashboard" element={<h1>Maintenance dashboard</h1>} />
      </Routes>
    </UIProvider>
  </MemoryRouter>,
);

describe('FirstLogin', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.setItem('language', 'en');
    useAuth.mockReturnValue({ firstLoginUser: pendingUser, completeFirstLogin: completeSession });
  });

  it('only presents the contact methods provided by the limited login session', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: 'Secure your account' })).toBeInTheDocument();
    expect(screen.getByText('t***@university.edu')).toBeInTheDocument();
    expect(screen.queryByText('Mobile phone')).not.toBeInTheDocument();
  });

  it('verifies a code, checks password strength, completes login, and redirects by role', async () => {
    apiClient.post
      .mockResolvedValueOnce({ data: { success: true, message: 'Code sent' } })
      .mockResolvedValueOnce({ data: { success: true } })
      .mockResolvedValueOnce({
        data: { success: true, token: 'normal.session.token', user: { id: 7, role: 'maintenance' } },
      });
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /send verification code/i }));
    await waitFor(() => expect(screen.getByLabelText('6-digit verification code')).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('6-digit verification code'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: /verify code/i }));
    await waitFor(() => expect(screen.getByLabelText('New password')).toBeInTheDocument());

    const password = 'StrongPass1!';
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: password } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: password } });
    fireEvent.click(screen.getByRole('button', { name: /set new password/i }));

    expect(await screen.findByRole('heading', { name: 'Maintenance dashboard' })).toBeInTheDocument();
    expect(apiClient.post).toHaveBeenNthCalledWith(3, '/api/auth/first-login/complete', {
      channel: 'email',
      code: '123456',
      newPassword: password,
      confirmPassword: password,
    });
    expect(completeSession).toHaveBeenCalledWith(expect.objectContaining({ token: 'normal.session.token' }));
  });
});
