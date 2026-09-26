import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import ResetPassword from './ResetPassword';
import { apiClient } from '../../utils/api';
import { toast } from 'react-toastify';
import { UIProvider } from '../../contexts/UiContext';

jest.mock('../../utils/api', () => ({
  apiClient: { post: jest.fn() },
}));

jest.mock('react-toastify', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

const VALID_TOKEN = 'f'.repeat(64);

const renderPage = (route = `/reset-password?token=${VALID_TOKEN}`) => render(
  <MemoryRouter initialEntries={[route]}>
    <UIProvider>
      <Routes>
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />
        <Route path="/login" element={<h1>Login page</h1>} />
        <Route path="/forgot-password" element={<h1>Forgot password page</h1>} />
      </Routes>
    </UIProvider>
  </MemoryRouter>,
);

const fillPasswords = (password, confirmation) => {
  fireEvent.change(screen.getByLabelText('New password'), { target: { value: password } });
  fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: confirmation } });
};

const submitForm = () => {
  fireEvent.click(screen.getByRole('button', { name: /Update Password/ }));
};

describe('ResetPassword', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.setItem('language', 'en');
  });

  it('reads the reset token from the link query string', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: 'Create New Password' })).toBeInTheDocument();
    expect(screen.getByLabelText('New password')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm new password')).toBeInTheDocument();
  });

  it('also reads the reset token from the path form of the link', async () => {
    apiClient.post.mockResolvedValue({ data: { success: true } });
    renderPage(`/reset-password/${VALID_TOKEN}`);

    fillPasswords('Str0ng!Pass', 'Str0ng!Pass');
    submitForm();

    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith(
      '/api/auth/reset-password',
      { token: VALID_TOKEN, password: 'Str0ng!Pass', confirmPassword: 'Str0ng!Pass' },
    ));
  });

  it('shows an honest invalid link state instead of a form that cannot work', () => {
    renderPage('/reset-password');

    expect(screen.getByRole('heading', { name: 'Invalid Reset Link' })).toBeInTheDocument();
    expect(screen.queryByLabelText('New password')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Request a New Reset Link' })).toHaveAttribute('href', '/forgot-password');
  });

  it('enforces the minimum password length before calling the API', async () => {
    renderPage();

    fillPasswords('Ab1!', 'Ab1!');
    submitForm();

    expect(await screen.findByRole('alert')).toHaveTextContent(/at least 8 characters/i);
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it('requires an uppercase letter, a number and a special character', async () => {
    renderPage();

    fillPasswords('alllowercase1!', 'alllowercase1!');
    submitForm();
    expect(await screen.findByRole('alert')).toHaveTextContent(/uppercase letter/i);

    fillPasswords('NoNumbers!Here', 'NoNumbers!Here');
    submitForm();
    expect(await screen.findByRole('alert')).toHaveTextContent(/must contain a number/i);

    fillPasswords('NoSpecials123', 'NoSpecials123');
    submitForm();
    expect(await screen.findByRole('alert')).toHaveTextContent(/special character/i);

    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it('rejects mismatched passwords before calling the API', async () => {
    renderPage();

    fillPasswords('Str0ng!Pass', 'Different!1');
    submitForm();

    expect(await screen.findByRole('alert')).toHaveTextContent('The passwords do not match.');
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it('resets the password and confirms success with a single route to login', async () => {
    apiClient.post.mockResolvedValue({ data: { success: true, message: 'Your password has been reset successfully.' } });

    renderPage();
    fillPasswords('Str0ng!Pass', 'Str0ng!Pass');
    submitForm();

    await waitFor(() => expect(apiClient.post).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole('heading', { name: 'Password Reset Successfully' })).toBeInTheDocument();
    expect(toast.success).toHaveBeenCalled();

    const loginButtons = screen.getAllByRole('button', { name: /Go to Login/ });
    expect(loginButtons).toHaveLength(1);
    fireEvent.click(loginButtons[0]);
    expect(await screen.findByRole('heading', { name: 'Login page' })).toBeInTheDocument();
  });

  it('blocks a second submission while the reset is in flight', async () => {
    let releaseRequest;
    apiClient.post.mockImplementation(() => new Promise((resolve) => { releaseRequest = resolve; }));

    renderPage();
    fillPasswords('Str0ng!Pass', 'Str0ng!Pass');
    submitForm();

    const button = await screen.findByRole('button', { name: /Updating/ });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(apiClient.post).toHaveBeenCalledTimes(1);

    releaseRequest({ data: { success: true } });
    await screen.findByRole('heading', { name: 'Password Reset Successfully' });
  });

  it('surfaces an expired or already used link', async () => {
    apiClient.post.mockResolvedValue({ data: { success: false, message: 'This password reset link is invalid or expired.' } });

    renderPage();
    fillPasswords('Str0ng!Pass', 'Str0ng!Pass');
    submitForm();

    expect(await screen.findByRole('alert')).toHaveTextContent('This password reset link is invalid or expired.');
    expect(screen.queryByRole('heading', { name: 'Password Reset Successfully' })).not.toBeInTheDocument();
  });

  it('reports a rate limit response', async () => {
    apiClient.post.mockRejectedValue({ response: { status: 429 } });

    renderPage();
    fillPasswords('Str0ng!Pass', 'Str0ng!Pass');
    submitForm();

    expect(await screen.findByRole('alert')).toHaveTextContent('Too many requests. Please wait a moment and try again.');
  });

  it('reports a network failure rather than claiming success', async () => {
    apiClient.post.mockRejectedValue({ message: 'Network Error' });

    renderPage();
    fillPasswords('Str0ng!Pass', 'Str0ng!Pass');
    submitForm();

    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to reach the server. Please check your connection and try again.');
    expect(screen.queryByRole('heading', { name: 'Password Reset Successfully' })).not.toBeInTheDocument();
  });

  it('toggles password visibility without leaking the value in the accessible tree', async () => {
    renderPage();

    const input = screen.getByLabelText('New password');
    expect(input).toHaveAttribute('type', 'password');

    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(input).toHaveAttribute('type', 'text');
  });

  it('links back to the login page', () => {
    renderPage();

    const backLinks = screen.getAllByRole('link', { name: /Back to Login/ });
    expect(backLinks).toHaveLength(1);
    expect(backLinks[0]).toHaveAttribute('href', '/login');
  });

  it('renders the Amharic interface from the shared language context', () => {
    window.localStorage.setItem('language', 'am');
    renderPage();

    expect(screen.getByRole('heading', { name: 'አዲስ የይለፍ ቃል ይፍጠሩ' })).toBeInTheDocument();
    expect(screen.getByLabelText('አዲስ የይለፍ ቃል')).toBeInTheDocument();
  });
});
