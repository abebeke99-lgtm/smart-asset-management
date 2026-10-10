import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { apiClient } from '../../utils/api';
import DeptAssignments from './DeptAssignments';

const mockHasPermission = jest.fn();

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ hasPermission: mockHasPermission }),
}));

jest.mock('../../utils/api', () => ({
  apiClient: { get: jest.fn(), post: jest.fn() },
  getApiErrorMessage: (error, fallback) => error?.response?.data?.message || fallback,
}));

const getDefaultResponse = (path) => {
  if (path === '/department-head/assignments') {
    return Promise.resolve({ data: { data: [], pagination: { pages: 1 } } });
  }
  if (path === '/department-head/assignments/history') {
    return Promise.resolve({ data: { history: [] } });
  }
  if (path === '/department-head/assets') {
    return Promise.resolve({ data: { data: [{ id: 45, assetCode: 'AST-45', name: 'Projector', status: 'available' }], pagination: { pages: 1 } } });
  }
  if (path === '/department-head/staff') {
    return Promise.resolve({ data: { data: [{ id: 81, fullName: 'Alem Bekele', active: true, status: 'active' }], pagination: { pages: 1 } } });
  }
  if (path === '/department-head/locations') {
    return Promise.resolve({ data: { data: [{ id: 6, name: 'Room 12', status: 'active' }], pagination: { pages: 1 } } });
  }
  return Promise.reject(new Error(`Unexpected endpoint: ${path}`));
};

const mockGetResponses = () => {
  apiClient.get.mockImplementation(getDefaultResponse);
};

describe('DeptAssignments', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetResponses();
    mockHasPermission.mockImplementation((permission) => permission === 'assets.view' || permission === 'assets.assign');
  });

  test('shows scoped assignment history and hides creation when assignment permission is absent', async () => {
    mockHasPermission.mockImplementation((permission) => permission === 'assets.view');
    apiClient.get.mockImplementation((path) => {
      if (path === '/department-head/assignments') {
        return Promise.resolve({
          data: {
            data: [{ id: 11, asset_name: 'Laptop', asset_tag: 'AST-11', assigned_to_name: 'Alem Bekele', status: 'active' }],
            pagination: { pages: 1 },
          },
        });
      }
      if (path === '/department-head/assignments/history') {
        return Promise.resolve({
          data: { history: [{ id: 10, asset_name: 'Monitor', assigned_to_name: 'Alem Bekele', status: 'returned' }] },
        });
      }
      return getDefaultResponse(path);
    });
    render(<DeptAssignments />);

    expect(await screen.findByText('Laptop')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /new assignment/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /assignment history/i }));
    expect(await screen.findByText('Monitor')).toBeInTheDocument();
  });

  test('creates an assignment for a selected department asset and active staff member', async () => {
    apiClient.post.mockResolvedValue({ data: { success: true } });
    render(<DeptAssignments />);
    await screen.findByRole('button', { name: /new assignment/i });

    fireEvent.click(screen.getByRole('button', { name: /new assignment/i }));
    fireEvent.change(screen.getByLabelText('Asset'), { target: { value: '45' } });
    fireEvent.change(screen.getByLabelText('Recipient'), { target: { value: '81' } });
    fireEvent.change(screen.getByLabelText('Location'), { target: { value: 'Room 12' } });
    fireEvent.click(screen.getByRole('button', { name: /create assignment/i }));

    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/department-head/assignments', expect.objectContaining({
      asset_id: 45,
      assigned_to_type: 'user',
      assigned_to_id: 81,
      location: 'Room 12',
      assigned_date: expect.any(String),
    })));
    expect(await screen.findByRole('status')).toHaveTextContent(/added to assignment history/i);
  });

  test('uses the local calendar day for the assignment date near the UTC date boundary', async () => {
    const originalTimezone = process.env.TZ;
    render(<DeptAssignments />);
    await screen.findByRole('button', { name: /new assignment/i });

    try {
      process.env.TZ = 'America/Los_Angeles';
      jest.useFakeTimers().setSystemTime(new Date('2024-01-01T01:00:00.000Z'));
      fireEvent.click(screen.getByRole('button', { name: /new assignment/i }));

      expect(screen.getByLabelText('Assignment date')).toHaveValue('2023-12-31');
      expect(screen.getByLabelText('Assignment date')).toHaveAttribute('max', '2023-12-31');
    } finally {
      jest.useRealTimers();
      if (originalTimezone === undefined) delete process.env.TZ;
      else process.env.TZ = originalTimezone;
    }
  });
});
