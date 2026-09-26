import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import ForgotPassword from './ForgotPassword';
import { apiClient } from '../../utils/api';
import { toast } from 'react-toastify';
import { UIProvider } from '../../contexts/UiContext';

jest.mock('../../utils/api', () => ({
  apiClient: { post: jest.fn() },
}));

jest.mock('react-toastify', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

const originalLanguage = window.localStorage.getItem('language');

const renderPage = (route = '/forgot-password', initialEntries = [route]) => render(
  <MemoryRouter initialEntries={initialEntries}>
    <UIProvider>
      <Routes>
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/login" element={<h1>Login page</h1>} />
      </Routes>
    </UIProvider>
  </MemoryRouter>,
);

const typeEmail = (value) => {
  const input = screen.getByLabelText('Email address');
  fireEvent.change(input, { target: { value } });
};

const submitForm = () => {
  fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));
};

describe('ForgotPassword', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.setItem('language', 'en');
  });

  afterAll(() => {
    if (originalLanguage === null) window.localStorage.removeItem('language');
    else window.localStorage.setItem('language', originalLanguage);
  });

  it('offers both recovery methods and a single route back to login', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: 'Forgot Password?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Email$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mobile Phone/ })).toBeInTheDocument();
    expect(screen.getByLabelText('Email address')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Send Reset Link/ })).toBeInTheDocument();

    const backLinks = screen.getAllByRole('link', { name: /Back to Login/ });
    expect(backLinks).toHaveLength(1);
    expect(backLinks[0]).toHaveAttribute('href', '/login');
  });

  it('rejects an invalid email in the browser without calling the API', async () => {
    renderPage();

    typeEmail('not-an-email');
    submitForm();

    expect(await screen.findByRole('alert')).toHaveTextContent('Please enter a valid email address.');
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it('rejects an empty email in the browser without calling the API', async () => {
    renderPage();

    submitForm();

    expect(await screen.findByRole('alert')).toHaveTextContent('Please enter your email address.');
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it('requests a reset link and shows the generic confirmation that does not reveal account existence', async () => {
    const genericMessage = 'If an eligible account exists, password reset instructions will be sent.';
    apiClient.post.mockResolvedValue({ data: { success: true, message: genericMessage } });

    renderPage();
    typeEmail('Student@university.edu');
    submitForm();

    await waitFor(() => expect(apiClient.post).toHaveBeenCalledTimes(1));
    expect(apiClient.post).toHaveBeenCalledWith('/api/auth/forgot-password', {
      method: 'email',
      email: 'student@university.edu',
    });

    expect(await screen.findByRole('heading', { name: 'Check Your Email' })).toBeInTheDocument();
    expect(screen.getByText(genericMessage)).toBeInTheDocument();
    expect(screen.queryByText(/does not exist|not found|no account/i)).not.toBeInTheDocument();
  });

  it('blocks duplicate submissions while a request is in flight', async () => {
    let releaseRequest;
    apiClient.post.mockImplementation(() => new Promise((resolve) => { releaseRequest = resolve; }));

    renderPage();
    typeEmail('student@university.edu');
    submitForm();

    const button = await screen.findByRole('button', { name: /Sending/ });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(apiClient.post).toHaveBeenCalledTimes(1);

    releaseRequest({ data: { success: true, message: 'ok' } });
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Check Your Email' })).toBeInTheDocument());
  });

  it('surfaces a server failure instead of claiming the email was sent', async () => {
    apiClient.post.mockResolvedValue({ data: { success: false, message: 'Password reset email service is not configured.' } });

    renderPage();
    typeEmail('student@university.edu');
    submitForm();

    expect(await screen.findByRole('alert')).toHaveTextContent('Password reset email service is not configured.');
    expect(screen.queryByRole('heading', { name: 'Check Your Email' })).not.toBeInTheDocument();
    expect(toast.error).toHaveBeenCalled();
  });

  it('reports a rate limit without leaking a stack trace', async () => {
    apiClient.post.mockRejectedValue({ response: { status: 429 } });

    renderPage();
    typeEmail('student@university.edu');
    submitForm();

    expect(await screen.findByRole('alert')).toHaveTextContent('Too many requests. Please wait a moment and try again.');
  });

  it('reports a network failure instead of a false success', async () => {
    apiClient.post.mockRejectedValue({ message: 'Network Error' });

    renderPage();
    typeEmail('student@university.edu');
    submitForm();

    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to reach the server. Please check your connection and try again.');
    expect(screen.queryByRole('heading', { name: 'Check Your Email' })).not.toBeInTheDocument();
  });

  it('runs the phone recovery flow from code request through to a new password', async () => {
    apiClient.post
      .mockResolvedValueOnce({ data: { success: true, message: 'If this phone number is registered, a verification code has been sent.' } })
      .mockResolvedValueOnce({ data: { success: true, message: 'Verification successful.', resetToken: 'a'.repeat(64) } })
      .mockResolvedValueOnce({ data: { success: true, message: 'Password reset successfully.' } });

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Mobile Phone/ }));
    fireEvent.change(screen.getByLabelText('Mobile phone number'), { target: { value: '0912345678' } });
    fireEvent.click(screen.getByRole('button', { name: /Send Verification Code/ }));

    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith(
      '/api/auth/forgot-password/request-otp',
      { phoneNumber: '+251912345678' },
    ));

    expect(await screen.findByRole('heading', { name: 'Verification Code' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Resend code \(\d+s\)$/ })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Verification Code'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: /Verify Code/ }));

    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith(
      '/api/auth/forgot-password/verify-otp',
      { phoneNumber: '+251912345678', otp: '123456' },
    ));

    expect(await screen.findByLabelText('New password')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'Str0ng!Pass' } });
    fireEvent.change(screen.getByLabelText('Confirm New Password'), { target: { value: 'Str0ng!Pass' } });
    fireEvent.click(screen.getByRole('button', { name: /Update Password/ }));

    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith(
      '/api/auth/forgot-password/reset-password',
      { resetToken: 'a'.repeat(64), newPassword: 'Str0ng!Pass', confirmPassword: 'Str0ng!Pass' },
    ));

    expect(await screen.findByRole('heading', { name: 'Password Reset Successfully' })).toBeInTheDocument();
  });

  it('rejects a phone number that is not a valid Ethiopian mobile number', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Mobile Phone/ }));
    fireEvent.change(screen.getByLabelText('Mobile phone number'), { target: { value: '12345' } });
    fireEvent.click(screen.getByRole('button', { name: /Send Verification Code/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/valid Ethiopian mobile number/i);
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it('enforces the password policy on the new password before calling the API', async () => {
    apiClient.post
      .mockResolvedValueOnce({ data: { success: true, message: 'code sent' } })
      .mockResolvedValueOnce({ data: { success: true, resetToken: 'b'.repeat(64) } });

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Mobile Phone/ }));
    fireEvent.change(screen.getByLabelText('Mobile phone number'), { target: { value: '0912345678' } });
    fireEvent.click(screen.getByRole('button', { name: /Send Verification Code/ }));
    await screen.findByRole('heading', { name: 'Verification Code' });

    fireEvent.change(screen.getByLabelText('Verification Code'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: /Verify Code/ }));
    await screen.findByLabelText('New password');

    apiClient.post.mockClear();

    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'weak' } });
    fireEvent.change(screen.getByLabelText('Confirm New Password'), { target: { value: 'weak' } });
    fireEvent.click(screen.getByRole('button', { name: /Update Password/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/at least 8 characters/i);
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it('rejects mismatched passwords before calling the API', async () => {
    apiClient.post
      .mockResolvedValueOnce({ data: { success: true, message: 'code sent' } })
      .mockResolvedValueOnce({ data: { success: true, resetToken: 'c'.repeat(64) } });

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Mobile Phone/ }));
    fireEvent.change(screen.getByLabelText('Mobile phone number'), { target: { value: '0912345678' } });
    fireEvent.click(screen.getByRole('button', { name: /Send Verification Code/ }));
    await screen.findByRole('heading', { name: 'Verification Code' });

    fireEvent.change(screen.getByLabelText('Verification Code'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: /Verify Code/ }));
    await screen.findByLabelText('New password');

    apiClient.post.mockClear();

    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'Str0ng!Pass' } });
    fireEvent.change(screen.getByLabelText('Confirm New Password'), { target: { value: 'Different!1' } });
    fireEvent.click(screen.getByRole('button', { name: /Update Password/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('The passwords do not match. Please try again.');
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it('keeps the user on the verification step when the code is rejected', async () => {
    apiClient.post
      .mockResolvedValueOnce({ data: { success: true, message: 'code sent' } })
      .mockResolvedValueOnce({ data: { success: false, message: 'Invalid verification code.' } });

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Mobile Phone/ }));
    fireEvent.change(screen.getByLabelText('Mobile phone number'), { target: { value: '0912345678' } });
    fireEvent.click(screen.getByRole('button', { name: /Send Verification Code/ }));
    await screen.findByRole('heading', { name: 'Verification Code' });

    fireEvent.change(screen.getByLabelText('Verification Code'), { target: { value: '000000' } });
    fireEvent.click(screen.getByRole('button', { name: /Verify Code/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid verification code.');
    expect(screen.getByRole('heading', { name: 'Verification Code' })).toBeInTheDocument();
    expect(screen.queryByLabelText('New password')).not.toBeInTheDocument();
  });

  it('reveals the new password on demand', async () => {
    apiClient.post
      .mockResolvedValueOnce({ data: { success: true, message: 'code sent' } })
      .mockResolvedValueOnce({ data: { success: true, resetToken: 'd'.repeat(64) } });

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Mobile Phone/ }));
    fireEvent.change(screen.getByLabelText('Mobile phone number'), { target: { value: '0912345678' } });
    fireEvent.click(screen.getByRole('button', { name: /Send Verification Code/ }));
    await screen.findByRole('heading', { name: 'Verification Code' });

    fireEvent.change(screen.getByLabelText('Verification Code'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: /Verify Code/ }));

    const passwordInput = await screen.findByLabelText('New password');
    expect(passwordInput).toHaveAttribute('type', 'password');

    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(passwordInput).toHaveAttribute('type', 'text');
  });

  it('returns the user to the login page from the confirmation state', async () => {
    apiClient.post.mockResolvedValue({ data: { success: true, message: 'If an eligible account exists, instructions will be sent.' } });

    renderPage();
    typeEmail('student@university.edu');
    submitForm();
    await screen.findByRole('heading', { name: 'Check Your Email' });

    fireEvent.click(screen.getByRole('button', { name: /Back to Login/ }));

    expect(await screen.findByRole('heading', { name: 'Login page' })).toBeInTheDocument();
  });

  it('can return to the form to request a link for a different address', async () => {
    apiClient.post.mockResolvedValue({ data: { success: true, message: 'If an eligible account exists, instructions will be sent.' } });

    renderPage();
    typeEmail('student@university.edu');
    submitForm();
    await screen.findByRole('heading', { name: 'Check Your Email' });

    fireEvent.click(screen.getByRole('button', { name: /Send to a different email address/ }));

    expect(await screen.findByLabelText('Email address')).toBeInTheDocument();
  });

  it('renders the Amharic interface from the shared language context', () => {
    window.localStorage.setItem('language', 'am');
    renderPage();

    expect(screen.getByRole('heading', { name: 'የይለፍ ቃል ረሱ?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ኢሜይል' })).toBeInTheDocument();
    expect(screen.getByLabelText('የኢሜይል አድራሻ')).toBeInTheDocument();
  });
});
