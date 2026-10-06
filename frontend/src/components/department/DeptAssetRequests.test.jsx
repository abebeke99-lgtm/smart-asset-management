import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import DeptAssetRequests from './DeptAssetRequests';
import { apiClient } from '../../utils/api';

jest.mock('../../utils/api', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
  },
  getApiErrorMessage: (error, fallback) => error?.response?.data?.message || fallback,
  resolveAssetUrl: (path) => path,
}));

const requestData = {
  id: 5,
  requestCode: 'AR-2026-TEST',
  requestedItem: 'Microscope',
  quantity: 2,
  unit: 'units',
  priority: 'high',
  status: 'Submitted',
  justification: 'Required for laboratory classes',
  createdAt: '2026-10-06T09:00:00.000Z',
  history: [{ id: 1, newStatus: 'Submitted', comment: 'Request submitted', changedByName: 'Department Head', createdAt: '2026-10-06T09:00:00.000Z' }],
};

beforeEach(() => {
  jest.clearAllMocks();
  apiClient.get.mockResolvedValue({ data: { data: [requestData] } });
});

test('shows real request status and loads request history in details', async () => {
  apiClient.get.mockImplementation((url) => Promise.resolve({
    data: { data: url.endsWith('/5') ? requestData : [requestData] },
  }));
  render(<DeptAssetRequests />);

  expect(await screen.findByText('AR-2026-TEST')).toBeInTheDocument();
  expect(screen.getAllByText('Submitted').length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole('button', { name: 'View AR-2026-TEST' }));

  expect(await screen.findByRole('heading', { name: 'Microscope' })).toBeInTheDocument();
  expect(screen.getByText(/Request submitted/)).toBeInTheDocument();
});

test('shows supporting documents supplied by the existing asset document record', async () => {
  const requestWithDocument = {
    ...requestData,
    supportingDocuments: [{ id: 3, name: 'Warranty.pdf', filePath: '/uploads/warranty.pdf', description: 'Warranty certificate' }],
  };
  apiClient.get.mockImplementation((url) => Promise.resolve({
    data: { data: url.endsWith('/5') ? requestWithDocument : [requestData] },
  }));
  render(<DeptAssetRequests />);
  await screen.findByText('AR-2026-TEST');
  fireEvent.click(screen.getByRole('button', { name: 'View AR-2026-TEST' }));

  expect(await screen.findByRole('link', { name: 'Open Warranty.pdf' })).toHaveAttribute('href', '/uploads/warranty.pdf');
});

test('creates a request with mandatory justification and refreshes the real list', async () => {
  apiClient.post.mockResolvedValue({ data: { data: { ...requestData, id: 6, requestCode: 'AR-2026-NEW' } } });
  render(<DeptAssetRequests />);
  await screen.findByText('AR-2026-TEST');

  fireEvent.click(screen.getByRole('button', { name: /New request/i }));
  fireEvent.change(screen.getByLabelText(/Requested item/i), { target: { value: 'New projector' } });
  fireEvent.change(screen.getByLabelText(/Justification/i), { target: { value: 'Needed for lectures' } });
  fireEvent.click(screen.getByRole('button', { name: 'Submit request' }));

  await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith(
    '/api/department-head/asset-requests',
    expect.objectContaining({ requestedItem: 'New projector', justification: 'Needed for lectures', quantity: 1, status: 'Submitted' }),
  ));
  expect(await screen.findByRole('heading', { name: 'Microscope' })).toBeInTheDocument();
});

test('requires justification before a draft or submitted request can be sent', async () => {
  render(<DeptAssetRequests />);
  await screen.findByText('AR-2026-TEST');
  fireEvent.click(screen.getByRole('button', { name: /New request/i }));
  fireEvent.change(screen.getByLabelText(/Requested item/i), { target: { value: 'New projector' } });
  fireEvent.click(screen.getByRole('button', { name: 'Submit request' }));

  expect(await screen.findByText('Justification is required.')).toBeInTheDocument();
  expect(apiClient.post).not.toHaveBeenCalled();
});

test('search and status filters are passed to the department-scoped request API', async () => {
  render(<DeptAssetRequests />);
  await screen.findByText('AR-2026-TEST');
  fireEvent.change(screen.getByRole('textbox', { name: 'Search asset requests' }), { target: { value: 'lab' } });
  fireEvent.change(screen.getByRole('combobox', { name: 'Filter by status' }), { target: { value: 'Under Review' } });

  await waitFor(() => expect(apiClient.get).toHaveBeenLastCalledWith(
    '/api/department-head/asset-requests',
    expect.objectContaining({ params: expect.objectContaining({ search: 'lab', status: 'Under Review' }) }),
  ));
});
