import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Login from './Login';
import { UiProvider } from '../../contexts/UiContext';

const SESSION_EXPIRED_STORAGE_KEY = 'uams-session-expired';

const mockLogin = jest.fn();

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ login: mockLogin }),
}));

jest.mock('../../utils/api', () => ({
  apiBase: () => '',
  SESSION_EXPIRED_STORAGE_KEY: 'uams-session-expired',
}));

jest.mock('axios', () => ({
  __esModule: true,
  default: { get: jest.fn().mockResolvedValue({}) },
}));

const renderLogin = async () => {
  const view = render(
    <UiProvider>
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    </UiProvider>
  );
  await screen.findByText('System: online');
  return view;
};

describe('Login error feedback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.setItem('language', 'en');
    sessionStorage.clear();
  });

  test('uses the provided university photo as the login page background', async () => {
    const { container } = await renderLogin();
    const loginPage = container.querySelector('.login-page');

    expect(loginPage).toHaveStyle({
      backgroundImage: expect.stringContaining('/images/login-background.jpg'),
      backgroundPosition: 'center',
      backgroundSize: 'cover',
    });
  });

  test('shows the authentication error returned by the backend', async () => {
    mockLogin.mockResolvedValue({
      success: false,
      error: 'Account temporarily locked. Please try again later.',
    });
    await renderLogin();

    fireEvent.change(screen.getByLabelText('Username or Email'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'not-shown' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Account temporarily locked. Please try again later.');
  });

  test('falls back to the localized invalid-credentials message when the API returns no error', async () => {
    mockLogin.mockResolvedValue({ success: false });
    await renderLogin();

    fireEvent.change(screen.getByLabelText('Username or Email'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'not-shown' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(mockLogin).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid username or password.');
  });

  test('explains that the session expired and leaves the login form available', async () => {
    sessionStorage.setItem(SESSION_EXPIRED_STORAGE_KEY, 'true');

    await renderLogin();

    expect(screen.getByRole('alert')).toHaveTextContent('Your session has expired. Please sign in again.');
    expect(screen.getByLabelText('Username or Email')).toBeInTheDocument();
    expect(sessionStorage.getItem(SESSION_EXPIRED_STORAGE_KEY)).toBeNull();
  });
});
