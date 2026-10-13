import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import apiClient from '../../services/apiClient';
import { useAuth } from '../../contexts/AuthContext';
import CollegeApprovals from './CollegeApprovals';

jest.mock('../../services/apiClient', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

const approvalsResponse = {
  data: {
    success: true,
    data: {
      summary: { total: 0, pending: 0, approved: 0, rejected: 0, cancelled: 0 },
      requests: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
      filters: { departments: [], statuses: ['pending', 'approved', 'rejected', 'cancelled'], types: [], priorities: [] },
    },
  },
};

const managerPermissions = ['college.requests.create', 'college.approvals.approve', 'college.approvals.reject', 'college.approvals.request_changes'];

beforeEach(() => {
  apiClient.get.mockReset();
  apiClient.post.mockReset();
  apiClient.get.mockResolvedValue(approvalsResponse);
  useAuth.mockReturnValue({ user: { id: 7, role: 'college_manager' }, hasPermission: (permission) => managerPermissions.includes(permission) });
});

test('College Manager can create a college-scoped approval and refresh its list', async () => {
  const options = {
    data: {
      success: true,
      data: {
        departments: [{ id: 14, name: 'Physics', code: 'PHY' }],
        assets: [{ id: 8, assetCode: 'AST-8', name: 'Microscope', category: 'Lab' }],
        types: ['new_asset', 'asset_issue'],
        priorities: ['low', 'normal', 'high', 'urgent'],
      },
    },
  };
  apiClient.get.mockImplementation((url) => Promise.resolve(url.endsWith('/options') ? options : approvalsResponse));
  apiClient.post.mockResolvedValue({ data: { success: true, request: { id: 51 } } });
  render(<CollegeApprovals />);

  fireEvent.click(await screen.findByRole('button', { name: 'New Approval' }));
  const dialog = await screen.findByRole('dialog', { name: 'New Approval Request' });
  await waitFor(() => expect(apiClient.get).toHaveBeenCalledWith('/api/college/approvals/options'));
  fireEvent.change(within(dialog).getByLabelText('Request title'), { target: { value: 'Physics lab equipment' } });
  fireEvent.change(within(dialog).getByLabelText('Reason'), { target: { value: 'Needed for instruction' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Submit for Approval' }));

  await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/api/college/approvals', {
    type: 'new_asset',
    item: 'Physics lab equipment',
    department_id: 14,
    asset_id: undefined,
    quantity: 1,
    priority: 'normal',
    reason: 'Needed for instruction',
  }));
  await waitFor(() => expect(apiClient.get).toHaveBeenCalledWith('/api/college/approvals', expect.objectContaining({
    params: expect.objectContaining({ page: 1, limit: 20 }),
  })));
  expect(await screen.findByText('No approval records found.')).toBeInTheDocument();
});

test('read-only College role cannot create approvals', async () => {
  useAuth.mockReturnValue({ user: { id: 9, role: 'college' }, hasPermission: (permission) => permission === 'college.approvals.view' });
  render(<CollegeApprovals />);

  expect(await screen.findByText('No approval records found.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'New Approval' })).not.toBeInTheDocument();
});

test('approval API failure is distinct from a successful empty list', async () => {
  apiClient.get.mockRejectedValue(new Error('Network unavailable'));
  render(<CollegeApprovals />);

  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load approvals.');
  expect(screen.queryByText('No approval records found.')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
});

test('approval details fetch and render authorized audit history', async () => {
  apiClient.get.mockImplementation((url) => {
    if (url === '/api/college/approvals/3') return Promise.resolve({
      data: { success: true, data: { id: 3, requestNumber: 'REQ-000003', status: 'rejected', type: 'other', priority: 'normal', item: 'Lab equipment', quantity: 1, reason: 'Missing details', history: [{ id: 1, changedBy: 12, action: 'REQUEST_REJECTED', comment: 'Insufficient reason', createdAt: '2026-01-01T00:00:00Z' }] } },
    });
    return Promise.resolve({
      data: {
        success: true,
        data: {
          ...approvalsResponse.data.data,
          summary: { total: 1, pending: 0, approved: 0, rejected: 1 },
          requests: [{ id: 3, requestNumber: 'REQ-000003', status: 'rejected', type: 'other', priority: 'normal', item: 'Lab equipment', quantity: 1, createdAt: '2026-01-01T00:00:00Z' }],
          pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
        },
      },
    });
  });
  render(<CollegeApprovals />);

  fireEvent.click(await screen.findByRole('button', { name: 'View REQ-000003 details' }));
  expect(await screen.findByText('Insufficient reason')).toBeInTheDocument();
  expect(apiClient.get).toHaveBeenCalledWith('/api/college/approvals/3');
});
