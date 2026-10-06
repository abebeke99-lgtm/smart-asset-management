import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { apiClient } from '../../utils/api';
import DepartmentActivityHistory from './DepartmentActivityHistory';

jest.mock('../../utils/api', () => ({
  __esModule: true,
  apiClient: { get: jest.fn() },
}));

describe('DepartmentActivityHistory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    apiClient.get.mockResolvedValue({
      data: {
        data: [{
          id: 8,
          user: 'Ada User',
          action: 'REQUEST_APPROVED',
          entity: 'department_asset_request',
          entityId: '27',
          status: 'Approved',
          dateTime: '2026-06-04T10:00:00.000Z',
          department: 'Engineering',
        }],
      },
    });
  });

  it('loads and displays authorized department activity fields', async () => {
    render(<DepartmentActivityHistory />);
    expect(await screen.findByText('Ada User')).toBeInTheDocument();
    expect(screen.getByText('REQUEST_APPROVED')).toBeInTheDocument();
    expect(screen.getByText('department_asset_request')).toBeInTheDocument();
    expect(screen.getByText('27')).toBeInTheDocument();
    expect(screen.getByText('Approved')).toBeInTheDocument();
    expect(screen.getByText('Engineering')).toBeInTheDocument();
  });

  it('submits filter values to the department-scoped history endpoint', async () => {
    render(<DepartmentActivityHistory />);
    await screen.findByText('Ada User');
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'approved' } });

    await waitFor(() => expect(apiClient.get).toHaveBeenLastCalledWith('/department-head/history', {
      params: { date: '', user: '', action: '', entity: '', status: 'approved' },
    }));
  });
});
