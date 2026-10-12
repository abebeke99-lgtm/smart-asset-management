import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { UiProvider } from '../../contexts/UiContext';
import api from '../../services/apiClient';
import { useAuth } from '../../contexts/AuthContext';
import CollegeStaff from './CollegeStaff';

jest.mock('../../services/apiClient', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
  },
}));

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

const staff = {
  id: 18,
  staffId: 'EMP-018',
  username: 'EMP-018',
  fullName: 'Staff Member',
  email: 'staff@example.edu',
  phone: '+251 911 234567',
  departmentId: 14,
  departmentRecord: { id: 14, name: 'Physics' },
  role: 'staff',
  active: true,
  assignedAssetsCount: 1,
  createdAt: '2025-03-12T10:00:00.000Z',
};

const listResponse = {
  data: {
    success: true,
    data: [staff],
    summary: { total: 1, active: 1, inactive: 0, activeAssetAssignments: 1, withAssignedAssets: 1 },
    filters: { departments: [{ id: 14, name: 'Physics' }], statuses: ['active', 'inactive'] },
    pagination: { page: 1, limit: 10, total: 1, pages: 1 },
  },
};

const renderPage = () => render(<UiProvider><CollegeStaff /></UiProvider>);

beforeEach(() => {
  localStorage.setItem('language', 'en');
  api.get.mockReset();
  api.post.mockReset();
  api.put.mockReset();
  api.patch.mockReset();
  api.get.mockResolvedValue(listResponse);
  useAuth.mockReturnValue({
    user: { id: 7, role: 'college_manager' },
    hasPermission: (permission) => ['college.staff.view', 'college.staff.manage', 'college.assignments.manage'].includes(permission),
  });
});

test('loads the college staff list and summary from the scoped API', async () => {
  renderPage();

  expect(await screen.findByRole('heading', { name: 'College Staff' })).toBeInTheDocument();
  expect(await screen.findByText('EMP-018')).toBeInTheDocument();
  expect(screen.getByText('Staff Member')).toBeInTheDocument();
  expect(screen.getByRole('cell', { name: 'Physics' })).toBeInTheDocument();
  expect(screen.getByText('Total Staff').parentElement.querySelector('strong')).toHaveTextContent('1');
  expect(api.get).toHaveBeenCalledWith('/api/college/staff', expect.objectContaining({
    params: expect.objectContaining({ page: 1, limit: 10 }),
  }));
});

test('regular College users can view staff but cannot manage staff accounts or assignments', async () => {
  useAuth.mockReturnValue({
    user: { id: 8, role: 'college' },
    hasPermission: (permission) => permission === 'college.staff.view',
  });
  api.get.mockImplementation((url) => Promise.resolve(url.endsWith('/18') ? {
    data: { success: true, data: { ...staff, assignedAssets: [], activity: [] } },
  } : listResponse));
  renderPage();

  expect(await screen.findByText('Staff Member')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Add Staff' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'View: EMP-018' }));
  const details = await screen.findByRole('dialog', { name: 'Staff Details' });
  expect(within(details).getByText('Role').nextSibling).toHaveTextContent('staff');
  expect(within(details).queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  expect(within(details).queryByRole('button', { name: 'Assign Asset' })).not.toBeInTheDocument();
});

test('manager can create a staff-role account and sees its temporary password only once', async () => {
  api.get.mockImplementation((url) => Promise.resolve(url.endsWith('/options')
    ? { data: { success: true, data: { departments: [{ id: 14, name: 'Physics' }] } } }
    : listResponse));
  api.post.mockResolvedValue({
    data: {
      success: true,
      data: { id: 21, staffId: 'EMP-021', username: 'EMP-021', fullName: 'New Staff', role: 'staff' },
      temporaryPassword: 'A7bcD9efG2hJ4kLm',
    },
  });
  renderPage();

  fireEvent.click(await screen.findByRole('button', { name: 'Add Staff' }));
  const dialog = await screen.findByRole('dialog', { name: 'Register Staff' });
  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/college/staff/options'));
  fireEvent.change(within(dialog).getByLabelText(/Full Name/), { target: { value: 'New Staff' } });
  fireEvent.change(within(dialog).getByLabelText(/Staff ID \/ Employee Number/), { target: { value: 'EMP-021' } });
  fireEvent.change(within(dialog).getByLabelText('Department'), { target: { value: '14' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Register Staff' }));

  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/college/staff', expect.objectContaining({
    fullName: 'New Staff',
    staffId: 'EMP-021',
    departmentId: '14',
  })));
  const passwordDialog = await screen.findByRole('dialog', { name: 'Temporary password' });
  expect(within(passwordDialog).getByText('A7bcD9efG2hJ4kLm')).toBeInTheDocument();
  fireEvent.click(within(passwordDialog).getAllByRole('button', { name: 'Close' })[0]);
  expect(screen.queryByRole('dialog', { name: 'Temporary password' })).not.toBeInTheDocument();
  expect(await screen.findByRole('dialog', { name: 'Staff Details' })).toBeInTheDocument();
});

test('shows a recoverable API error and an explicit empty state', async () => {
  api.get.mockRejectedValueOnce(new Error('API unavailable'));
  renderPage();

  expect(await screen.findByRole('alert')).toHaveTextContent('API unavailable');
  api.get.mockResolvedValueOnce({
    data: {
      success: true,
      data: [],
      summary: { total: 0, active: 0, inactive: 0, activeAssetAssignments: 0, withAssignedAssets: 0 },
      filters: { departments: [], statuses: ['active', 'inactive'] },
      pagination: { page: 1, limit: 10, total: 0, pages: 1 },
    },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(await screen.findByText('No staff members found for this college.')).toBeInTheDocument();
});
