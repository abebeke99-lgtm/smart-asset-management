import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import StoreManagerAccounts from './StoreManagerAccounts';
import apiClient from '../../services/apiClient';

jest.mock('../../services/apiClient', () => ({
  __esModule: true,
  default: { get: jest.fn() },
  getApiErrorMessage: (error, fallback) => {
    if (error?.response?.status === 401) return 'Session expired. Please sign in again.';
    if (error?.response?.status === 403) return error.response.data.message || 'Access denied.';
    if (error?.response?.status === 404) return 'The requested resource was not found.';
    if (error?.response?.status >= 500) return 'Unable to load dashboard data. Please try again.';
    return error?.response?.data?.message || fallback;
  },
}));

beforeEach(() => {
  apiClient.get.mockReset();
});

test('shows the live account count and safe Store Manager account fields without registration controls', async () => {
  apiClient.get.mockResolvedValue({
    data: {
      success: true,
      data: {
        count: 1,
        limit: 8,
        users: [{
          id: 3,
          fullName: 'Store Lead',
          username: 'store.lead',
          status: 'active',
          createdAt: '2026-10-01T00:00:00.000Z',
        }],
      },
    },
  });

  render(<StoreManagerAccounts />);

  expect(await screen.findByText('1 of 8 accounts registered')).toBeInTheDocument();
  expect(screen.getByText('Store Lead')).toBeInTheDocument();
  expect(screen.getByText('store.lead')).toBeInTheDocument();
  expect(screen.getByText('active')).toBeInTheDocument();
  expect(screen.getByText('7 accounts remaining.')).toBeInTheDocument();
  expect(screen.getByText(/provisioned by an administrator/i)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /register/i })).not.toBeInTheDocument();
  expect(apiClient.get).toHaveBeenCalledWith('/api/users/store-manager-accounts');
});

test('shows an empty-state message and the full remaining capacity', async () => {
  apiClient.get.mockResolvedValue({
    data: { success: true, data: { count: 0, limit: 8, remaining: 8, users: [] } },
  });

  render(<StoreManagerAccounts />);

  expect(await screen.findByText('0 of 8 accounts registered')).toBeInTheDocument();
  expect(screen.getByText('8 accounts remaining.')).toBeInTheDocument();
  expect(screen.getByText('No Store Manager accounts are registered.')).toBeInTheDocument();
});

test('reports account-list failures and allows retry', async () => {
  apiClient.get.mockRejectedValueOnce(new Error('Account list unavailable')).mockResolvedValueOnce({
    data: { success: true, data: { count: 0, limit: 8, users: [] } },
  });

  render(<StoreManagerAccounts />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load Store Manager accounts.');

  fireEvent.click(screen.getByRole('button', { name: /retry/i }));
  await waitFor(() => expect(screen.getByText('0 of 8 accounts registered')).toBeInTheDocument());
});

test('Refresh updates the count and account list with the latest response', async () => {
  apiClient.get
    .mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          count: 1,
          limit: 8,
          visibleCount: 1,
          users: [{ id: 1, fullName: 'First Manager', username: 'first.manager', status: 'active' }],
        },
      },
    })
    .mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          count: 2,
          limit: 8,
          visibleCount: 2,
          users: [
            { id: 1, fullName: 'First Manager', username: 'first.manager', status: 'active' },
            { id: 2, fullName: 'Second Manager', username: 'second.manager', status: 'active' },
          ],
        },
      },
    });

  render(<StoreManagerAccounts />);
  expect(await screen.findByText('1 of 8 accounts registered')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /refresh/i }));

  expect(await screen.findByText('2 of 8 accounts registered')).toBeInTheDocument();
  expect(screen.getByText('Second Manager')).toBeInTheDocument();
  expect(screen.getByText('6 accounts remaining.')).toBeInTheDocument();
  expect(apiClient.get).toHaveBeenCalledTimes(2);
});

test.each([
  [401, 'Session expired. Please sign in again.'],
  [403, 'College scope is not configured for this account'],
  [404, 'The requested resource was not found.'],
  [500, 'Unable to load dashboard data. Please try again.'],
])('distinguishes HTTP %s account-list failures from an empty account list', async (status, message) => {
  apiClient.get.mockRejectedValue({ response: { status, data: { message } } });

  render(<StoreManagerAccounts />);

  expect(await screen.findByRole('alert')).toHaveTextContent(message);
  expect(screen.queryByText('No Store Manager accounts are registered.')).not.toBeInTheDocument();
});

test('shows the backend message when the account-list response reports failure', async () => {
  apiClient.get.mockResolvedValue({
    data: { success: false, message: 'Account access denied' },
  });

  render(<StoreManagerAccounts />);

  expect(await screen.findByRole('alert')).toHaveTextContent('Account access denied');
});

test('shows the organization scope returned by the API for each account', async () => {
  apiClient.get.mockResolvedValue({
    data: {
      success: true,
      data: {
        count: 1,
        limit: 8,
        visibleCount: 1,
        users: [{
          id: 11,
          fullName: 'Scoped Manager',
          username: 'scoped.manager',
          email: 'manager@example.edu',
          status: 'active',
          College: { id: 2, collegeName: 'Science College' },
          DepartmentRecord: { id: 7, name: 'Biology' },
          createdAt: '2026-10-03T00:00:00.000Z',
        }],
      },
    },
  });

  render(<StoreManagerAccounts />);

  expect(await screen.findByText('manager@example.edu')).toBeInTheDocument();
  expect(screen.getByText('Science College')).toBeInTheDocument();
  expect(screen.getByText('Biology')).toBeInTheDocument();
});

test('prevents duplicate account-list requests while a refresh is in flight', async () => {
  let resolveRequest;
  apiClient.get.mockReturnValue(new Promise((resolve) => { resolveRequest = resolve; }));

  render(<StoreManagerAccounts />);
  await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(1));
  expect(screen.getByRole('button', { name: /refresh/i })).toBeDisabled();

  resolveRequest({ data: { success: true, data: { count: 0, limit: 8, users: [] } } });
  await waitFor(() => expect(screen.getByText('0 of 8 accounts registered')).toBeInTheDocument());
  expect(apiClient.get).toHaveBeenCalledTimes(1);
});

test('surfaces an invalid list response instead of reporting a false empty account list', async () => {
  apiClient.get.mockResolvedValue({
    data: { success: true, data: { count: 0, limit: 8, users: [{ id: 1 }] } },
  });

  render(<StoreManagerAccounts />);

  expect(await screen.findByRole('alert')).toHaveTextContent('The Store Manager account response was incomplete.');
  expect(screen.queryByText('No Store Manager accounts are registered.')).not.toBeInTheDocument();
});
