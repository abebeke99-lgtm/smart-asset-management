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

  await waitFor(() => {
    expect(apiClient.get).toHaveBeenCalledWith('/api/assets', {
      params: { page: 1, limit: 50 }
    });
  });
  fireEvent.click(await screen.findByRole('button', { name: /Approved Requests/ }));
  fireEvent.click(await screen.findByRole('button', { name: 'Fulfill' }));

  await waitFor(() => {
    expect(apiClient.post).toHaveBeenCalledWith('/api/assignments/fulfill-request/25');
  });
  await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(8));
  expect(await screen.findByText('Fulfilled')).toBeInTheDocument();
});

test('loads assets across the supported paginated API instead of requesting an invalid limit', async () => {
  apiClient.get.mockImplementation((url, options) => {
    if (url === '/api/assets') {
      if (options.params.page === 1) {
        return Promise.resolve({
          data: {
            assets: [{ id: 3, name: 'Laptop' }],
            pagination: { pages: 2 },
          },
        });
      }
      return Promise.resolve({ data: { assets: [{ id: 4, name: 'Projector' }] } });
    }
    if (url === '/api/approvals') return Promise.resolve({ data: { requests: [] } });
    if (url === '/api/users') return Promise.resolve({ data: { users: [] } });
    if (url === '/api/departments') return Promise.resolve({ data: { departments: [] } });
    return Promise.resolve({ data: {} });
  });

  render(<StoreAssetRequests />);

  await waitFor(() => {
    expect(apiClient.get).toHaveBeenCalledWith('/api/assets', {
      params: { page: 2, limit: 50 }
    });
  });
  expect(apiClient.get).toHaveBeenCalledWith('/api/assets', {
    params: { page: 1, limit: 50 }
  });
  await waitFor(() => {
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    expect(screen.queryByText('Unable to load request data. Please try again.')).not.toBeInTheDocument();
  });
});

test('loads all users across the supported pagination for the requested-for selector', async () => {
  apiClient.get.mockImplementation((url, options) => {
    if (url === '/api/users') {
      if (options.params.page === 1) {
        return Promise.resolve({
          data: {
            users: [{ id: 1, full_name: 'First User' }],
            pagination: { pages: 2 },
          },
        });
      }
      return Promise.resolve({
        data: { users: [{ id: 2, full_name: 'Second User' }] },
      });
    }
    if (url === '/api/assets') return Promise.resolve({ data: { assets: [] } });
    if (url === '/api/approvals') return Promise.resolve({ data: { requests: [] } });
    if (url === '/api/departments') return Promise.resolve({ data: { departments: [] } });
    return Promise.resolve({ data: {} });
  });

  render(<StoreAssetRequests />);

  expect(await screen.findByRole('option', { name: 'Second User' })).toBeInTheDocument();
  expect(apiClient.get).toHaveBeenCalledWith('/api/users', {
    params: { page: 1, limit: 100 }
  });
  expect(apiClient.get).toHaveBeenCalledWith('/api/users', {
    params: { page: 2, limit: 100 }
  });
});

test('keeps successful form choices available when approvals fail and retries the request list', async () => {
  let approvalsFail = true;
  const approvalError = {
    response: { status: 500, data: { message: 'Internal server error' } },
  };
  const toastError = jest.spyOn(require('react-toastify').toast, 'error').mockImplementation(() => {});
  const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  apiClient.get.mockImplementation((url) => {
    if (url === '/api/approvals') {
      return approvalsFail
        ? Promise.reject(approvalError)
        : Promise.resolve({ data: { requests: [] } });
    }
    if (url === '/api/assets') return Promise.resolve({ data: { assets: [{ id: 3, name: 'Laptop' }] } });
    if (url === '/api/users') return Promise.resolve({ data: { users: [{ id: 42, full_name: 'Beneficiary' }] } });
    if (url === '/api/departments') return Promise.resolve({ data: { departments: [{ id: 12, name: 'IT' }] } });
    return Promise.resolve({ data: {} });
  });

  render(<StoreAssetRequests />);

  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load request data. Please try again.');
  expect(await screen.findByRole('option', { name: 'Laptop' })).toBeInTheDocument();
  expect(await screen.findByRole('option', { name: 'Beneficiary' })).toBeInTheDocument();
  expect(await screen.findByRole('option', { name: 'IT' })).toBeInTheDocument();
  expect(consoleError).not.toHaveBeenCalled();
  expect(toastError).toHaveBeenCalledWith('Operation failed');

  approvalsFail = false;
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await waitFor(() => {
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

test('does not show a request-load error when reference data fails but approvals load', async () => {
  const toastError = jest.spyOn(require('react-toastify').toast, 'error').mockImplementation(() => {});
  apiClient.get.mockImplementation((url) => {
    if (url === '/api/approvals') return Promise.resolve({ data: { requests: [request] } });
    return Promise.reject(new Error(`${url} unavailable`));
  });

  render(<StoreAssetRequests />);

  await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument());
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(toastError).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: /History/ })).toBeInTheDocument();
});

test('loads history and status counters from the approval response', async () => {
  const requests = ['pending', 'approved', 'rejected', 'cancelled'].map((status, index) => ({
    id: index + 1,
    status,
  }));
  apiClient.get.mockImplementation((url) => {
    if (url === '/api/approvals') return Promise.resolve({ data: { requests } });
    if (url === '/api/assets') return Promise.resolve({ data: { assets: [] } });
    if (url === '/api/users') return Promise.resolve({ data: { users: [] } });
    if (url === '/api/departments') return Promise.resolve({ data: { departments: [] } });
    return Promise.resolve({ data: {} });
  });

  render(<StoreAssetRequests />);

  await waitFor(() => expect(screen.getByText('Request History').parentElement.children[1]).toHaveTextContent('4'));
  expect(screen.getByText('Pending Requests').parentElement.children[1]).toHaveTextContent('1');
  expect(screen.getByText('Approved Requests').parentElement.children[1]).toHaveTextContent('1');
  expect(screen.getByText('Rejected Requests').parentElement.children[1]).toHaveTextContent('1');
  expect(screen.getByText('Cancelled').parentElement.children[1]).toHaveTextContent('1');
});

test('submits the requested-for user, required date, purpose, and remarks', async () => {
  apiClient.get.mockImplementation((url) => {
    if (url === '/api/assets') return Promise.resolve({ data: { assets: [{ id: 3, name: 'Laptop' }] } });
    if (url === '/api/departments') return Promise.resolve({ data: { departments: [{ id: 12, name: 'IT' }] } });
    if (url === '/api/users') return Promise.resolve({ data: { users: [{ id: 42, full_name: 'Beneficiary' }] } });
    if (url === '/api/approvals') return Promise.resolve({ data: { requests: [] } });
    return Promise.resolve({ data: {} });
  });
  const { container } = render(<StoreAssetRequests />);

  await screen.findByRole('button', { name: /Submit Request/ });
  const selects = container.querySelectorAll('select');
  const textareas = container.querySelectorAll('textarea');
  fireEvent.change(selects[0], { target: { value: '3' } });
  fireEvent.change(selects[1], { target: { value: '12' } });
  fireEvent.change(selects[2], { target: { value: '42' } });
  fireEvent.change(container.querySelector('input[type="date"]'), { target: { value: '2026-11-01' } });
  fireEvent.change(textareas[0], { target: { value: 'For the lab' } });
  fireEvent.change(textareas[1], { target: { value: 'Needed before term starts' } });
  fireEvent.click(screen.getByRole('button', { name: /Submit Request/ }));

  await waitFor(() => {
    expect(apiClient.post).toHaveBeenCalledWith('/api/approvals', {
      type: 'asset_issue',
      asset_id: '3',
      item: 'Laptop',
      quantity: 1,
      department_id: '12',
      requested_for: '42',
      priority: 'normal',
      required_date: '2026-11-01',
      reason: 'For the lab',
      comment: 'Needed before term starts'
    });
  });
});

test('rejects fractional request quantities before sending them to the API', async () => {
  const toastError = jest.spyOn(require('react-toastify').toast, 'error').mockImplementation(() => {});
  apiClient.get.mockImplementation((url) => {
    if (url === '/api/assets') return Promise.resolve({ data: { assets: [{ id: 3, name: 'Laptop' }] } });
    if (url === '/api/departments') return Promise.resolve({ data: { departments: [{ id: 12, name: 'IT' }] } });
    if (url === '/api/approvals') return Promise.resolve({ data: { requests: [] } });
    if (url === '/api/users') return Promise.resolve({ data: { users: [] } });
    return Promise.resolve({ data: {} });
  });

  const { container } = render(<StoreAssetRequests />);

  await screen.findByRole('button', { name: /Submit Request/ });
  const selects = container.querySelectorAll('select');
  fireEvent.change(selects[0], { target: { value: '3' } });
  fireEvent.change(selects[1], { target: { value: '12' } });
  fireEvent.change(container.querySelector('input[type="number"]'), { target: { value: '1.5' } });
  fireEvent.click(screen.getByRole('button', { name: /Submit Request/ }));

  expect(apiClient.post).not.toHaveBeenCalled();
  expect(toastError).toHaveBeenCalledWith('Enter a valid quantity');
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
