import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { UiProvider } from '../../contexts/UiContext';
import apiClient from '../../services/apiClient';
import { useAuth } from '../../contexts/AuthContext';
import CollegeRequests from './CollegeRequests';

jest.mock('../../services/apiClient', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
  },
}));

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

const listResponse = {
  data: {
    success: true,
    data: {
      requests: [],
      summary: { total: 0, pending: 0, approved: 0, rejected: 0, cancelled: 0 },
      filters: { departments: [{ id: 14, name: 'Physics', code: 'PHY' }], statuses: ['Submitted', 'Approved'], priorities: ['low', 'medium', 'high', 'critical'] },
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    },
  },
};

beforeEach(() => {
  localStorage.setItem('language', 'en');
  apiClient.get.mockReset();
  apiClient.post.mockReset();
  apiClient.put.mockReset();
  apiClient.get.mockResolvedValue(listResponse);
  useAuth.mockReturnValue({ user: { id: 7, role: 'college' }, hasPermission: (permission) => permission === 'college.requests.view' });
});

const renderRequests = () => render(<UiProvider><CollegeRequests /></UiProvider>);

test('regular College users can view the queue but cannot create or review requests', async () => {
  renderRequests();

  expect(await screen.findByRole('heading', { name: 'Asset Requests' })).toBeInTheDocument();
  expect(screen.getByText('No requests found')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Create Request/i })).not.toBeInTheDocument();
  expect(apiClient.get).toHaveBeenCalledWith('/api/college/requests', expect.objectContaining({
    params: expect.objectContaining({ page: 1, limit: 20 }),
  }));
});

test('College Managers can load real form options and submit a scoped request', async () => {
  useAuth.mockReturnValue({
    user: { id: 7, role: 'college_manager' },
    hasPermission: (permission) => ['college.requests.view', 'college.requests.create', 'college.requests.update', 'college.requests.cancel', 'college.approvals.approve'].includes(permission),
  });
  apiClient.get.mockImplementation((url) => Promise.resolve(url.endsWith('/options') ? {
    data: { success: true, data: { categories: [{ id: 2, name: 'Laboratory Equipment' }], departments: [{ id: 14, name: 'Physics' }] } },
  } : listResponse));
  apiClient.post.mockResolvedValue({
    data: { success: true, data: { id: 52, requestNumber: 'CM-2026-TEST', requestTitle: 'Physics lab supplies', requestedBy: 7, status: 'Submitted' } },
  });
  renderRequests();

  fireEvent.click((await screen.findAllByRole('button', { name: 'Create Request', exact: true }))[0]);
  const dialog = await screen.findByRole('dialog', { name: 'Create asset request' });
  await waitFor(() => expect(apiClient.get).toHaveBeenCalledWith('/api/college/requests/options'));
  fireEvent.change(within(dialog).getByLabelText(/Request title/i), { target: { value: 'Physics lab supplies' } });
  fireEvent.change(within(dialog).getByLabelText(/Asset or item name/i), { target: { value: 'Microscope' } });
  fireEvent.change(within(dialog).getByLabelText(/Asset category/i), { target: { value: 'Laboratory Equipment' } });
  fireEvent.change(within(dialog).getByLabelText(/Requesting department/i), { target: { value: '14' } });
  fireEvent.change(within(dialog).getByLabelText(/Business justification/i), { target: { value: 'For laboratory teaching' } });
  fireEvent.click(within(dialog).getByRole('button', { name: /Submit request/i }));

  await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/api/college/requests', expect.objectContaining({
    requestTitle: 'Physics lab supplies',
    requestedItem: 'Microscope',
    category: 'Laboratory Equipment',
    departmentId: 14,
    justification: 'For laboratory teaching',
  })));
  expect(await screen.findByRole('heading', { name: 'CM-2026-TEST' })).toBeInTheDocument();
});
