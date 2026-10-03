import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

import ForgotPassword, { amharicTranslations, englishTranslations } from './ForgotPassword';
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

const LocationProbe = () => {
  const location = useLocation();
  return <output data-testid="current-location">{`${location.pathname}${location.search}`}</output>;
};

const renderPage = (route = '/forgot-password', initialEntries = [route]) => render(
  <MemoryRouter initialEntries={initialEntries}>
    <UIProvider>
      <Routes>
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/forgot-password/request" element={<ForgotPassword />} />
        <Route path="/forgot-password/verify" element={<ForgotPassword />} />
        <Route path="/forgot-password/reset" element={<ForgotPassword />} />
        <Route path="/login" element={<h1>Login page</h1>} />
      </Routes>
      <LocationProbe />
    </UIProvider>
  </MemoryRouter>,
);

const typeEmail = (value) => {
  const input = screen.getByLabelText('Email address');
  fireEvent.change(input, { target: { value } });
};

const submitForm = () => {
  fireEvent.click(screen.getByRole('button', { name: /send verification code/i }));
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

  it('provides a translated value for every EN and AM message key', () => {
    const getTranslationShape = (translations) => Object.fromEntries(Object.entries(translations).map(([key, value]) => [
      key,
      typeof value === 'object' ? getTranslationShape(value) : typeof value,
    ]));

    expect(getTranslationShape(englishTranslations)).toEqual(getTranslationShape(amharicTranslations));
  });

  it('offers both recovery methods and a single route back to login', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: 'Forgot Password?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Email$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mobile Phone/ })).toBeInTheDocument();
    expect(screen.getByLabelText('Email address')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Send Verification Code/ })).toBeInTheDocument();

    const backLinks = screen.getAllByRole('link', { name: /Back to Login/ });
    expect(backLinks).toHaveLength(1);
    expect(backLinks[0]).toHaveAttribute('href', '/login');
  });

  it('renders the request step on direct navigation to the request route', () => {
    renderPage('/forgot-password/request');

    expect(screen.getByRole('heading', { name: 'Forgot Password?' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email address')).toBeInTheDocument();
  });

  it('renders the verification step on direct navigation to the verify route', () => {
    renderPage('/forgot-password/verify');

    expect(screen.getByRole('heading', { name: 'Verification Code' })).toBeInTheDocument();
  });

  it('renders the reset route and consumes a legacy query token into component state', async () => {
    const token = 'z'.repeat(64);
    renderPage(`/forgot-password/reset?token=${token}&keep=1`);

    expect(await screen.findByLabelText('New password')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('current-location')).toHaveTextContent('/forgot-password/reset?keep=1'));
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

  it('requests an email OTP and advances to the verification step without revealing account existence', async () => {
    const genericMessage = 'If this email address is registered, a verification code has been sent.';
    apiClient.post.mockResolvedValue({ data: { success: true, message: genericMessage } });

    renderPage();
    typeEmail('Student@university.edu');
    submitForm();

    await waitFor(() => expect(apiClient.post).toHaveBeenCalledTimes(1));
    expect(apiClient.post).toHaveBeenCalledWith('/api/auth/forgot-password/request', {
      method: 'email',
      email: 'student@university.edu',
    });

    expect(await screen.findByRole('heading', { name: 'Verification Code' })).toBeInTheDocument();
    expect(screen.getByText(genericMessage)).toBeInTheDocument();
    expect(screen.queryByText(/does not exist|not found|no account/i)).not.toBeInTheDocument();
  });

  it('verifies an email OTP without requiring a phone number', async () => {
    apiClient.post
      .mockResolvedValueOnce({ data: { success: true, message: 'code sent' } })
      .mockResolvedValueOnce({ data: { success: true, resetToken: 'e'.repeat(64) } });

    renderPage();
    typeEmail('student@university.edu');
    submitForm();
    await screen.findByRole('heading', { name: 'Verification Code' });

    fireEvent.change(screen.getByLabelText('Verification Code'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: /Verify Code/ }));

    await waitFor(() => expect(apiClient.post).toHaveBeenLastCalledWith(
      '/api/auth/forgot-password/verify',
      { method: 'email', email: 'student@university.edu', otp: '123456' },
    ));
    expect(await screen.findByLabelText('New password')).toBeInTheDocument();
  });

  it('blocks duplicate email OTP submissions while a request is in flight', async () => {
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
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Verification Code' })).toBeInTheDocument());
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

    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to reach the server. Please check your connection.');
    expect(screen.queryByRole('heading', { name: 'Check Your Email' })).not.toBeInTheDocument();
  });

  it('shows the email service message for an HTTP 503 response', async () => {
    apiClient.post.mockRejectedValue({ response: { status: 503, data: { code: 'EMAIL_AUTH_FAILED' } } });

    renderPage();
    typeEmail('student@university.edu');
    submitForm();

    expect(await screen.findByRole('alert')).toHaveTextContent('Email service is temporarily unavailable. Please try again later.');
  });

  it('recognizes a server status when the HTTP client omits the response wrapper', async () => {
    apiClient.post.mockRejectedValue({ status: 503, code: 'EMAIL_NETWORK_ERROR' });

    renderPage();
    typeEmail('student@university.edu');
    submitForm();

    expect(await screen.findByRole('alert')).toHaveTextContent('Email service is temporarily unavailable. Please try again later.');
  });

  it('shows the translated SMS-unavailable message when no SMS provider is configured', async () => {
    apiClient.post.mockRejectedValue({ response: { status: 503, data: { code: 'SMS_NOT_CONFIGURED' } } });

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Mobile Phone/ }));
    fireEvent.change(screen.getByLabelText('Mobile phone number'), { target: { value: '0912345678' } });
    fireEvent.click(screen.getByRole('button', { name: /Send Verification Code/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('SMS service is not available yet.');
  });

  it('translates the email service error into Amharic', async () => {
    window.localStorage.setItem('language', 'am');
    apiClient.post.mockRejectedValue({ response: { status: 503 } });

    renderPage();
    fireEvent.change(screen.getByLabelText('የኢሜይል አድራሻ'), { target: { value: 'student@university.edu' } });
    fireEvent.click(screen.getByRole('button', { name: /የማረጋገጫ ኮድ ላክ/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('የኢሜይል አገልግሎቱ ለጊዜው አይገኝም። እባክዎ ቆይተው እንደገና ይሞክሩ።');
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
      '/api/auth/forgot-password/request',
      { phoneNumber: '+251912345678' },
    ));

    expect(await screen.findByRole('heading', { name: 'Verification Code' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resend code (60s)' })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Verification Code'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: /Verify Code/ }));

    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith(
      '/api/auth/forgot-password/verify',
      { phoneNumber: '+251912345678', otp: '123456' },
    ));

    expect(await screen.findByLabelText('New password')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'Str0ng!Pass' } });
    fireEvent.change(screen.getByLabelText('Confirm New Password'), { target: { value: 'Str0ng!Pass' } });
    fireEvent.click(screen.getByRole('button', { name: /Update Password/ }));

    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith(
      '/api/auth/forgot-password/reset',
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

  it('returns the user to the login page from the verification state', async () => {
    apiClient.post.mockResolvedValue({ data: { success: true, message: 'If this email address is registered, a verification code has been sent.' } });

    renderPage();
    typeEmail('student@university.edu');
    submitForm();
    await screen.findByRole('heading', { name: 'Verification Code' });

    fireEvent.click(screen.getByRole('link', { name: /Back to Login/ }));

    expect(await screen.findByRole('heading', { name: 'Login page' })).toBeInTheDocument();
  });

  it('keeps the user on the verification step after an email OTP request', async () => {
    apiClient.post.mockResolvedValue({ data: { success: true, message: 'If this email address is registered, a verification code has been sent.' } });

    renderPage();
    typeEmail('student@university.edu');
    submitForm();
    await screen.findByRole('heading', { name: 'Verification Code' });

    expect(screen.getByLabelText('Verification Code')).toBeInTheDocument();
  });

  it('renders the Amharic interface from the shared language context', () => {
    window.localStorage.setItem('language', 'am');
    renderPage();

    expect(screen.getByRole('heading', { name: 'የይለፍ ቃል ረሱ?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ኢሜይል' })).toBeInTheDocument();
    expect(screen.getByLabelText('የኢሜይል አድራሻ')).toBeInTheDocument();
  });
});
