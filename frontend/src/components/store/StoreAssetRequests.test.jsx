import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import StoreAssetRequests from './StoreAssetRequests';
import { apiClient } from '../../utils/api';

jest.mock('../../contexts/UiContext', () => ({
  useLanguage: () => ({ language: 'en', theme: 'light' }),
}));

jest.mock('../../utils/api', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
  },
}));

const request = {
  id: 25,
  assetId: 3,
  asset_name: 'Laptop',
  requestedBy: 42,
  requested_by: 'Requester',
  departmentId: 12,
  department: 'Information Technology',
  type: 'asset_issue',
  quantity: 2,
  status: 'approved',
};
let fulfillmentRecorded = false;
let requestCancelled = false;

beforeEach(() => {
  jest.clearAllMocks();
  fulfillmentRecorded = false;
  requestCancelled = false;
  apiClient.get.mockImplementation((url) => {
    if (url === '/api/approvals') {
      const currentRequest = requestCancelled
        ? { ...request, status: 'cancelled' }
        : fulfillmentRecorded
          ? { ...request, fulfilledAt: '2026-10-10T00:00:00.000Z' }
          : request;
      return Promise.resolve({ data: { requests: [currentRequest] } });
    }
    if (url === '/api/assets') return Promise.resolve({ data: { assets: [] } });
    if (url === '/api/users') return Promise.resolve({ data: { users: [] } });
    if (url === '/api/departments') return Promise.resolve({ data: { departments: [] } });
    return Promise.resolve({ data: {} });
  });
  apiClient.post.mockImplementation(async () => {
    fulfillmentRecorded = true;
    return { data: { success: true } };
  });
  apiClient.patch.mockImplementation(async () => {
    requestCancelled = true;
    return { data: { success: true } };
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('fulfills an approved request and refreshes its status', async () => {
  render(<StoreAssetRequests />);

  fireEvent.click(await screen.findByRole('button', { name: /Approved Requests/ }));
  fireEvent.click(await screen.findByRole('button', { name: 'Fulfill' }));

  await waitFor(() => {
    expect(apiClient.post).toHaveBeenCalledWith('/api/assignments/fulfill-request/25');
  });
  await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(8));
  expect(await screen.findByText('Fulfilled')).toBeInTheDocument();
});

test('shows the server error when approved request fulfillment fails', async () => {
  apiClient.post.mockRejectedValue({
    response: { data: { message: 'Reserved stock is no longer available for this request' } },
  });
  const toastError = jest.spyOn(require('react-toastify').toast, 'error').mockImplementation(() => {});
  render(<StoreAssetRequests />);

  fireEvent.click(await screen.findByRole('button', { name: /Approved Requests/ }));
  fireEvent.click(await screen.findByRole('button', { name: 'Fulfill' }));

  await waitFor(() => {
    expect(toastError).toHaveBeenCalledWith('Reserved stock is no longer available for this request');
  });
});

test('cancels an approved request with a reason and refreshes its status', async () => {
  jest.spyOn(window, 'prompt').mockReturnValue('No longer needed');
  render(<StoreAssetRequests />);

  fireEvent.click(await screen.findByRole('button', { name: /Approved Requests/ }));
  fireEvent.click(await screen.findByRole('button', { name: 'Cancel Request' }));

  await waitFor(() => {
    expect(apiClient.patch).toHaveBeenCalledWith('/api/approvals/25', {
      status: 'cancelled',
      reason: 'No longer needed',
      comment: 'No longer needed',
    });
  });
  expect(await screen.findByText('Cancelled')).toBeInTheDocument();
});
