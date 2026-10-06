import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ApprovalQueue from './ApprovalQueue';
import { useAuth } from '../../contexts/AuthContext';
import { apiClient } from '../../utils/api';

jest.mock('../../contexts/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../utils/api', () => ({
  apiClient: { get: jest.fn(), post: jest.fn() },
  getApiErrorMessage: (_error, fallback) => fallback,
  resolveAssetUrl: (path) => path,
}));

const approval = {
  id: 25,
  requestNumber: 'AR-2026-25',
  requestedItem: 'Microscope',
  requester: { name: 'Requester' },
  status: 'Submitted',
  justification: 'Required for laboratory work',
  supportingDocuments: [{ id: 4, name: 'quote.pdf', filePath: '/uploads/quote.pdf' }],
  history: [{ id: 5, previousStatus: 'Draft', newStatus: 'Submitted', changedByName: 'Requester', createdAt: '2026-01-01T00:00:00Z' }],
};

beforeEach(() => {
  jest.clearAllMocks();
  useAuth.mockReturnValue({ hasPermission: () => true });
  apiClient.get.mockImplementation((url) => Promise.resolve({
    data: { data: url.endsWith('/25') ? approval : [approval] },
  }));
  apiClient.post.mockResolvedValue({ data: { success: true } });
});

test('reviews a request and submits only the named action, not a caller-selected status', async () => {
  render(<ApprovalQueue />);
  await screen.findByText('Microscope');
  fireEvent.click(screen.getByRole('button', { name: 'Review' }));

  expect(await screen.findByText('Required for laboratory work')).toBeInTheDocument();
  expect(screen.getByText('quote.pdf')).toBeInTheDocument();
  expect(screen.getByText(/Draft → Submitted/)).toBeInTheDocument();

  fireEvent.click(screen.getAllByRole('button', { name: 'Approve' })[0]);
  const confirmationButtons = screen.getAllByRole('button', { name: 'Approve' });
  fireEvent.click(confirmationButtons[confirmationButtons.length - 1]);
  await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/api/department-head/approvals/25/approve', {}));
  expect(apiClient.post.mock.calls[0][1]).not.toHaveProperty('status');
});

test('does not render actions the current user is not permitted to perform', async () => {
  useAuth.mockReturnValue({ hasPermission: (permission) => permission === 'department_head.approvals.review' });
  render(<ApprovalQueue />);
  await screen.findByText('Microscope');
  fireEvent.click(screen.getByRole('button', { name: 'Review' }));
  expect(await screen.findByText('Required for laboratory work')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Reject' })).not.toBeInTheDocument();
});
