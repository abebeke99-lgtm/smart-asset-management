import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { UiProvider } from '../../contexts/UiContext';
import { useAuth } from '../../contexts/AuthContext';
import apiClient from '../../services/apiClient';
import CollegeAssignments from './CollegeAssignments';

jest.mock('../../services/apiClient', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

const assignmentList = {
  data: {
    success: true,
    data: {
      summary: { total: 1, active: 1, pending: 0, returned: 0 },
      assignments: [{
        id: 63,
        assetId: 29,
        asset: { id: 29, name: 'Microscope', code: 'AST-029', category: 'Laboratory', serialNumber: 'SN-029' },
        assignee: { id: 18, name: 'Staff Member', username: 'staff-18' },
        department: { id: 14, name: 'Physics' },
        assignedDate: '2026-05-12T10:00:00.000Z',
        expectedReturnDate: null,
        status: 'active',
        notes: 'Teaching laboratory',
      }],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      filters: { departments: [{ id: 14, name: 'Physics' }], statuses: ['active'], users: [], categories: ['Laboratory'], locations: [] },
    },
  },
};

const assignmentOptions = {
  data: {
    success: true,
    data: {
      assets: [{ id: 29, name: 'Microscope', assetCode: 'AST-029', category: 'Laboratory', serialNumber: '', availableQuantity: 3 }],
      staff: [{ id: 18, fullName: 'Staff Member', username: 'staff-18', departmentId: 14, department: { id: 14, name: 'Physics' } }],
      departments: [{ id: 14, name: 'Physics' }],
    },
  },
};

const renderPage = () => render(<UiProvider><CollegeAssignments /></UiProvider>);

beforeEach(() => {
  localStorage.setItem('language', 'en');
  apiClient.get.mockReset();
  apiClient.post.mockReset();
  apiClient.get.mockImplementation((url) => Promise.resolve(url === '/api/college/assignment-options' ? assignmentOptions : assignmentList));
  apiClient.post.mockResolvedValue({ data: { success: true, message: 'Asset assigned successfully' } });
  useAuth.mockReturnValue({
    user: { id: 7, role: 'college_manager' },
    hasPermission: (permission) => ['college.assignments.manage', 'college.assignments.view'].includes(permission),
  });
});

test('College Manager registers an assignment through the existing API and refreshes list data', async () => {
  renderPage();

  expect(await screen.findByRole('heading', { name: 'Asset Assignments' })).toBeInTheDocument();
  expect(screen.getByText('Microscope')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Create Assignment' }));

  const dialog = await screen.findByRole('dialog', { name: 'Create an asset assignment' });
  await waitFor(() => expect(apiClient.get).toHaveBeenCalledWith('/api/college/assignment-options'));
  fireEvent.change(within(dialog).getByLabelText('Asset *'), { target: { value: '29' } });
  fireEvent.change(within(dialog).getByLabelText('Staff member *'), { target: { value: '18' } });
  fireEvent.change(within(dialog).getByRole('spinbutton'), { target: { value: '2' } });
  fireEvent.change(within(dialog).getByLabelText('Expected return date'), { target: { value: '2026-12-30' } });
  fireEvent.change(within(dialog).getByLabelText('Purpose'), { target: { value: 'Teaching laboratory' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Register Assignment' }));

  await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/api/assignments', expect.objectContaining({
    asset_id: 29,
    assigned_to_type: 'user',
    assigned_to_id: 18,
    department_id: 14,
    quantity: 2,
    expected_return_date: '2026-12-30',
    purpose: 'Teaching laboratory',
  })));
  await waitFor(() => expect(apiClient.get.mock.calls.filter(([url]) => url === '/api/college/assignments').length).toBeGreaterThan(1));
  expect(await screen.findByText('Staff Member')).toBeInTheDocument();
});

test('regular College users can view assignments but cannot register or return them', async () => {
  useAuth.mockReturnValue({
    user: { id: 8, role: 'college' },
    hasPermission: (permission) => permission === 'college.assignments.view',
  });
  renderPage();

  expect(await screen.findByText('Microscope')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Create Assignment' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Return Asset' })).not.toBeInTheDocument();
});

test('Amharic labels are used for assignment registration and empty options report clearly', async () => {
  localStorage.setItem('language', 'am');
  apiClient.get.mockImplementation((url) => Promise.resolve(url === '/api/college/assignment-options'
    ? { data: { success: true, data: { assets: [], staff: [], departments: [] } } }
    : { data: { success: true, data: { summary: { total: 0 }, assignments: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 1 }, filters: { departments: [], statuses: [], users: [], categories: [], locations: [] } } } }));
  renderPage();

  expect(await screen.findByRole('heading', { name: 'የንብረት ምደባዎች' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'ምደባ ፍጠር' }));
  const dialog = await screen.findByRole('dialog', { name: 'የንብረት ምደባ ፍጠር' });
  await waitFor(() => expect(dialog.querySelectorAll('.college-assignments-field-hint')).toHaveLength(2));
});
