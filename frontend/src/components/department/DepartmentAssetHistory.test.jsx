import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { apiClient } from '../../utils/api';
import DepartmentAssetHistory from './DepartmentAssetHistory';

jest.mock('../../utils/api', () => ({
  __esModule: true,
  apiClient: { get: jest.fn() },
}));

describe('DepartmentAssetHistory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    apiClient.get.mockResolvedValue({
      data: {
        data: [{
          id: 21,
          user: 'Ada User',
          action: 'ASSIGN_ASSET',
          dateTime: '2026-06-04T10:00:00.000Z',
          previousValue: { status: 'available' },
          newValue: { status: 'assigned' },
          status: 'assigned',
          entity: 'Department laptop (AST-21)',
          entityId: '21',
          auditEntity: 'asset:21',
        }],
      },
    });
  });

  it('shows real department-scoped audit events with lifecycle values and the linked asset', async () => {
    render(<DepartmentAssetHistory />);

    expect(await screen.findByText('ASSIGN_ASSET')).toBeInTheDocument();
    expect(screen.getByText('Ada User')).toBeInTheDocument();
    expect(screen.getByText('{"status":"available"}')).toBeInTheDocument();
    expect(screen.getByText('{"status":"assigned"}')).toBeInTheDocument();
    expect(screen.getByText('Department laptop (AST-21) · ID 21')).toBeInTheDocument();
    expect(screen.getByText('Record: asset:21')).toBeInTheDocument();
    expect(apiClient.get).toHaveBeenCalledWith('/department-head/asset-history', {
      params: { date: '', user: '', action: '', entity: '', status: '' },
    });
  });

  it('submits filter values to the department asset-history endpoint', async () => {
    render(<DepartmentAssetHistory />);
    await screen.findByText('ASSIGN_ASSET');
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'assigned' } });

    await waitFor(() => expect(apiClient.get).toHaveBeenLastCalledWith('/department-head/asset-history', {
      params: { date: '', user: '', action: '', entity: '', status: 'assigned' },
    }));
  });

  it('does not fill an empty history with lifecycle placeholders', async () => {
    apiClient.get.mockResolvedValue({ data: { data: [] } });
    render(<DepartmentAssetHistory />);

    expect(await screen.findByText('No recorded asset lifecycle events in this department.')).toBeInTheDocument();
    expect(screen.queryByText('Registered')).not.toBeInTheDocument();
  });
});
