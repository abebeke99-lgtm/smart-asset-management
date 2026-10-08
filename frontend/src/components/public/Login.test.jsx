import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Login from './Login';
import { UiProvider } from '../../contexts/UiContext';

const mockLogin = jest.fn();

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ login: mockLogin }),
}));

jest.mock('../../utils/api', () => ({
  apiBase: () => '',
}));

jest.mock('axios', () => ({
  __esModule: true,
  default: { get: jest.fn().mockResolvedValue({}) },
}));

const renderLogin = () => render(
  <UiProvider>
    <MemoryRouter>
      <Login />
    </MemoryRouter>
  </UiProvider>
);

describe('Login error feedback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('shows the authentication error returned by the backend', async () => {
    mockLogin.mockResolvedValue({
      success: false,
      error: 'Account temporarily locked. Please try again later.',
    });
    renderLogin();

    fireEvent.change(screen.getByLabelText('Username or Email'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'not-shown' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Account temporarily locked. Please try again later.');
  });

  test('falls back to the localized invalid-credentials message when the API returns no error', async () => {
    mockLogin.mockResolvedValue({ success: false });
    renderLogin();

    fireEvent.change(screen.getByLabelText('Username or Email'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'not-shown' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(mockLogin).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid username or password.');
  });
});
