import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import ApprovalQueue from './ApprovalQueue';
import { apiClient } from '../../utils/api';

const mockPermissions = new Set([
  'department_head.approvals.review',
  'department_head.approvals.approve',
  'department_head.approvals.reject',
  'department_head.approvals.request_changes',
  'department_head.approvals.escalate',
]);

jest.mock('../../utils/api', () => ({
  apiClient: { get: jest.fn(), post: jest.fn() },
  getApiErrorMessage: (_error, fallback) => fallback,
  resolveAssetUrl: (path) => path,
}));

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ hasPermission: (permission) => mockPermissions.has(permission) }),
}));

const approval = {
  id: 25,
  requestNumber: 'AR-2026-25',
  requestCode: 'AR-2026-25',
  requestType: 'Equipment',
  requestedItem: 'Microscope',
  asset: { id: 51, assetCode: 'ASSET-51', name: 'Microscope', category: 'Optical', status: 'Available', condition: 'Functional', location: 'Lab 2' },
  department: { id: 12, name: 'Biology' },
  requester: { id: 42, name: 'Requester', role: 'staff' },
  status: 'Submitted',
  priority: 'high',
  description: 'A microscope for microscopy work.',
  justification: 'Required for laboratory work',
  supportingDocuments: [{ id: 4, assetId: 51, name: 'quote.pdf', mimeType: 'application/pdf' }],
  history: [{ id: 5, previousStatus: 'Draft', newStatus: 'Submitted', changedByName: 'Requester', changedByRole: 'staff', createdAt: '2026-01-01T00:00:00Z' }],
};

const queueResponse = (rows = [approval], extra = {}) => ({
  data: {
    data: rows,
    summary: { total: 1, Submitted: 1, Approved: 0, Rejected: 0, 'Changes Requested': 0 },
    filters: { priorities: ['high', 'medium'], requestTypes: ['Equipment'] },
    pagination: { page: 1, limit: 20, total: 1, pages: 1 },
    ...extra,
  },
});
const originalUrlMethods = {
  createObjectURL: window.URL.createObjectURL,
  revokeObjectURL: window.URL.revokeObjectURL,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockPermissions.clear();
  [
    'department_head.approvals.review',
    'department_head.approvals.approve',
    'department_head.approvals.reject',
    'department_head.approvals.request_changes',
    'department_head.approvals.escalate',
  ].forEach((permission) => mockPermissions.add(permission));
  window.URL.createObjectURL = jest.fn(() => 'blob:secure-asset-document');
  window.URL.revokeObjectURL = jest.fn();
  apiClient.get.mockImplementation((url) => Promise.resolve(
    url.endsWith('/file')
      ? { data: new Blob(['document']) }
      : url.endsWith('/25') ? { data: { data: approval } } : queueResponse(),
  ));
  apiClient.post.mockResolvedValue({ data: { success: true, data: { ...approval, status: 'Approved' } } });
});

afterEach(() => {
  if (originalUrlMethods.createObjectURL) window.URL.createObjectURL = originalUrlMethods.createObjectURL;
  else delete window.URL.createObjectURL;
  if (originalUrlMethods.revokeObjectURL) window.URL.revokeObjectURL = originalUrlMethods.revokeObjectURL;
  else delete window.URL.revokeObjectURL;
});

test('loads the queue and reviews request details, attachment, requester and history', async () => {
  render(<ApprovalQueue />);
  expect(await screen.findByText('Microscope')).toBeInTheDocument();
  expect(screen.getByText('Biology')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /All/ })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Review' }));

  expect(await screen.findByText('Required for laboratory work')).toBeInTheDocument();
  expect(screen.getByText('quote.pdf')).toBeInTheDocument();
  expect(screen.getAllByText('Requester').length).toBeGreaterThan(1);
  expect(screen.getByText(/Submitted · Draft → Submitted/)).toBeInTheDocument();
  expect(screen.getByText('Lab 2')).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /quote\.pdf/i })).not.toBeInTheDocument();
});

test('downloads supporting files through the authenticated, department-scoped asset endpoint', async () => {
  jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  render(<ApprovalQueue />);
  await screen.findByText('Microscope');
  fireEvent.click(screen.getByRole('button', { name: 'Review' }));
  await screen.findByText('Required for laboratory work');
  fireEvent.click(screen.getByRole('button', { name: 'Download quote.pdf' }));

  await waitFor(() => expect(apiClient.get).toHaveBeenCalledWith(
    '/api/assets/51/documents/4/file',
    { responseType: 'blob' },
  ));
});

test('submits authorized approval through the named action endpoint and refreshes queue', async () => {
  render(<ApprovalQueue />);
  await screen.findByText('Microscope');
  fireEvent.click(screen.getByRole('button', { name: 'Review' }));
  await screen.findByText('Required for laboratory work');

  fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
  expect(screen.getByRole('dialog', { name: 'Approve' })).toBeInTheDocument();
  expect(screen.getByText(/This request will proceed to the next workflow stage/)).toBeInTheDocument();
  fireEvent.click(within(screen.getByRole('dialog', { name: 'Approve' })).getByRole('button', { name: 'Approve', exact: true }));
  await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/api/department-head/approvals/25/approve', {}));
  expect(apiClient.post.mock.calls[0][1]).not.toHaveProperty('status');
});

test('requires a rejection reason and does not show success when the server rejects the action', async () => {
  apiClient.post.mockRejectedValueOnce({ response: { status: 403 } });
  render(<ApprovalQueue />);
  await screen.findByText('Microscope');
  fireEvent.click(screen.getByRole('button', { name: 'Review' }));
  await screen.findByText('Required for laboratory work');

  fireEvent.click(screen.getByRole('button', { name: 'Reject' }));
  const rejectDialog = screen.getByRole('dialog', { name: 'Reject' });
  const submitButton = within(rejectDialog).getByRole('button', { name: 'Reject', exact: true });
  expect(submitButton).toBeDisabled();
  fireEvent.change(within(rejectDialog).getByLabelText('Reason (required)'), { target: { value: 'Insufficient justification' } });
  expect(submitButton).toBeEnabled();
  fireEvent.click(submitButton);

  await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith(
    '/api/department-head/approvals/25/reject',
    { reason: 'Insufficient justification' },
  ));
  expect(await within(rejectDialog).findByRole('alert')).toHaveTextContent('You do not have permission');
  expect(screen.getByRole('dialog', { name: 'Reject' })).toBeInTheDocument();
});

test('filters by status and priority using backend query parameters', async () => {
  render(<ApprovalQueue />);
  await screen.findByText('Microscope');
  fireEvent.click(screen.getByRole('button', { name: /Approved/ }));
  await waitFor(() => expect(apiClient.get).toHaveBeenLastCalledWith(
    '/api/department-head/approvals',
    expect.objectContaining({ params: expect.objectContaining({ status: 'Approved', page: 1 }) }),
  ));

  fireEvent.change(screen.getByRole('combobox', { name: 'Filter by priority' }), { target: { value: 'high' } });
  await waitFor(() => expect(apiClient.get).toHaveBeenLastCalledWith(
    '/api/department-head/approvals',
    expect.objectContaining({ params: expect.objectContaining({ status: 'Approved', priority: 'high' }) }),
  ));
});

test('shows only actions allowed by the authenticated permission set', async () => {
  mockPermissions.delete('department_head.approvals.reject');
  mockPermissions.delete('department_head.approvals.request_changes');
  mockPermissions.delete('department_head.approvals.escalate');
  render(<ApprovalQueue />);
  await screen.findByText('Microscope');
  fireEvent.click(screen.getByRole('button', { name: 'Review' }));
  await screen.findByText('Required for laboratory work');
  expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Reject' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Request Changes' })).not.toBeInTheDocument();
});

test('denies queue access when the view permission is absent', () => {
  mockPermissions.clear();
  render(<ApprovalQueue />);
  expect(screen.getByRole('alert')).toHaveTextContent('You do not have permission');
  expect(apiClient.get).not.toHaveBeenCalled();
});

test('shows load errors with retry and an accurate empty state', async () => {
  apiClient.get.mockRejectedValueOnce({ response: { status: 503 } }).mockResolvedValueOnce(queueResponse([]));
  render(<ApprovalQueue />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load the approval queue.');
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(await screen.findByText('No requests are currently waiting for departmental approval.')).toBeInTheDocument();
});
